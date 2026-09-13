"""Bounded cleanup which survives ASGI scopes and repeated Task.cancel().

Only database cleanup runs in the child task. Async-generator closure and its
ContextVar token reset stay in the original ASGI task.
"""
from __future__ import annotations

import asyncio
import logging
from contextlib import asynccontextmanager

import anyio

logger = logging.getLogger(__name__)
# Maximum shutdown path: settlement 14+3, heartbeat 3+3, request rollback
# 6+3, lease release 3+3, background fallback 3+3 = 44 seconds. This includes
# cancel-and-drain rather than treating cancellation as instantaneous. The API
# graceful shutdown is 60s. Each resource stage gets its own reserved window.
SETTLEMENT_SECONDS = 14.0
RESOURCE_SECONDS = 3.0


def _consume_result(task):
    if not task.cancelled():
        try:
            task.exception()
        except BaseException:
            pass


async def protected_cleanup(coro, *, timeout: float, label: str):
    """One task, one phase deadline; repeated cancellation cannot restart it."""
    task = asyncio.create_task(coro, name=f'chat-cleanup:{label}')
    deadline = asyncio.get_running_loop().time() + timeout
    interrupted = False
    async def drain_cancelled():
        nonlocal interrupted
        # Cancellation can enter SQLAlchemy's own rollback/invalidate finally.
        # Drain that phase before anyone reuses the request session. A second
        # cancellation terminates a stuck driver-close rather than abandoning
        # a task which is still operating on the same connection.
        for grace in (2.0, 1.0):
            task.cancel()
            end = asyncio.get_running_loop().time() + grace
            while not task.done() and asyncio.get_running_loop().time() < end:
                try:
                    await asyncio.wait({task}, timeout=end - asyncio.get_running_loop().time())
                except asyncio.CancelledError:
                    interrupted = True
            if task.done():
                _consume_result(task)
                return
        logger.critical('chat_cleanup.task_unresponsive label=%s', label)
        task.add_done_callback(_consume_result)
    try:
        with anyio.CancelScope(shield=True):
            while not task.done():
                left = deadline - asyncio.get_running_loop().time()
                if left <= 0:
                    await drain_cancelled()
                    logger.error('chat_cleanup.deadline label=%s', label)
                    raise TimeoutError(f'Chat cleanup exceeded deadline: {label}')
                try:
                    # asyncio.wait does not forward the parent's cancellation
                    # into the settlement transaction, unlike a direct await.
                    await asyncio.wait({task}, timeout=left)
                except asyncio.CancelledError:
                    interrupted = True
            result = task.result()
        if interrupted:
            raise asyncio.CancelledError
        return result
    finally:
        if not task.done():
            task.cancel()
            task.add_done_callback(_consume_result)


async def rollback_or_invalidate(db):
    """A failed rollback must not leave the request's transaction holding locks."""
    try:
        async with asyncio.timeout(RESOURCE_SECONDS):
            await db.rollback()
    except BaseException as exc:
        # SQLAlchemy invalidates/terminates the driver connection rather than
        # returning an ambiguous transaction to the pool.
        async with asyncio.timeout(RESOURCE_SECONDS):
            await db.invalidate()
        if isinstance(exc, asyncio.CancelledError):
            raise
        logger.warning('chat_cleanup.connection_invalidated', exc_info=True)


@asynccontextmanager
async def cleanup_session(factory):
    """Close the actual session in the tracked task, without a hidden close task.

    AsyncSession.__aexit__ starts a shielded child task for close(). Cancelling
    its caller can leave that child holding a transaction after cleanup returns.
    Explicit close/invalidate keeps the connection lifecycle in our task.
    """
    manager = factory()
    db = await manager.__aenter__()
    try:
        yield db
    finally:
        try:
            async with asyncio.timeout(RESOURCE_SECONDS):
                close = getattr(db, 'close', None)
                if close is not None:
                    await close()
                else:
                    await manager.__aexit__(None, None, None)
        except BaseException:
            invalidate = getattr(db, 'invalidate', None)
            if invalidate is not None:
                async with asyncio.timeout(RESOURCE_SECONDS):
                    await invalidate()
            raise
