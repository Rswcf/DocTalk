"""Durable single-session operations and atomic replacement of text answers.

Only the current answer lives in Message. Older versions are snapshots, so
context, sharing, exports and message counts keep their existing semantics.
"""
from __future__ import annotations

import asyncio
import copy
import logging
import time
import uuid
from contextvars import ContextVar
from dataclasses import dataclass, field
from datetime import timedelta

import anyio
from fastapi import HTTPException
from sqlalchemy import delete, func, select, update
from sqlalchemy.dialects.postgresql import insert
from starlette.responses import StreamingResponse

from app.models.database import AsyncSessionLocal
from app.models.tables import ChatStreamLease, Message, MessageRevision

LEASE_SECONDS = 120
RENEW_SECONDS = 30
logger = logging.getLogger(__name__)


class LeaseLost(RuntimeError):
    pass


class ChatStreamingResponse(StreamingResponse):
    async def stream_response(self, send):
        try:
            await super().stream_response(send)
        finally:
            # Disconnect can arrive while ASGI is sending a yielded chunk.
            # Close in this same task before response background cleanup runs.
            with anyio.move_on_after(20, shield=True):
                await self.body_iterator.aclose()


@dataclass(frozen=True)
class ChatOperation:
    session_id: uuid.UUID
    token: uuid.UUID
    replace_id: uuid.UUID | None = None
    expected_version: uuid.UUID | None = None
    retry_question: bool = False
    save_retry_question: bool = False
    result_version: uuid.UUID = field(default_factory=uuid.uuid4)


current_operation: ContextVar[ChatOperation | None] = ContextVar("chat_operation", default=None)


def conflict(code: str, message: str) -> HTTPException:
    return HTTPException(status_code=409, detail={"error": code, "message": message})


async def claim_operation(session_id, *, regenerate_of=None, expected_version=None,
                          retry_question=False, question=None, continue_id=None, retry_after=None,
                          continue_version_supplied=False):
    """Claim and validate together, after the endpoint has verified ownership."""
    token = uuid.uuid4()
    save_retry_question = False
    async with AsyncSessionLocal() as db:
        claimed = await db.execute(
            insert(ChatStreamLease).values(session_id=session_id, token=token,
                expires_at=func.clock_timestamp() + timedelta(seconds=LEASE_SECONDS))
            .on_conflict_do_update(index_elements=[ChatStreamLease.session_id],
                set_={"token": token, "expires_at": func.clock_timestamp() + timedelta(seconds=LEASE_SECONDS)},
                where=ChatStreamLease.expires_at <= func.clock_timestamp())
            .returning(ChatStreamLease.token)
        )
        if claimed.scalar_one_or_none() is None:
            raise conflict("CHAT_IN_PROGRESS", "Another response is being generated in this conversation.")
        if regenerate_of or retry_question or continue_id:
            rows = list((await db.execute(select(Message)
                .where(Message.session_id == session_id)
                .order_by(Message.created_at.desc(), Message.id.desc()).limit(2))).scalars())
            latest = rows[0] if rows else None
            if regenerate_of and retry_question:
                raise conflict("RESPONSE_CHANGED", "Choose either regenerate or retry.")
            if regenerate_of or continue_id:
                target = regenerate_of or continue_id
                if latest is None or latest.id != target or latest.role != "assistant":
                    raise conflict("RESPONSE_CHANGED", "The latest answer changed. Reload the conversation.")
                if (latest.metadata_json or {}).get("artifacts") or (latest.metadata_json or {}).get("action_plan"):
                    raise conflict("TOOL_RETRY_UNSUPPORTED", "Use the tool's own action to start another task.")
                if continue_id and continue_version_supplied and latest.response_version != expected_version:
                    raise conflict("RESPONSE_CHANGED", "The latest answer changed. Reload the conversation.")
                if regenerate_of:
                    if latest.response_version != expected_version or len(rows) < 2 or rows[1].role != "user" or rows[1].content != question:
                        raise conflict("RESPONSE_CHANGED", "The latest answer changed. Reload the conversation.")
            elif latest is not None and latest.role == "user" and latest.content == question:
                pass  # The first request saved its question but no answer.
            elif (latest is None and retry_after is None) or (
                latest is not None and latest.role == "assistant" and latest.id == retry_after
            ):
                save_retry_question = True  # First request never saved its question.
            else:
                raise conflict("RESPONSE_CHANGED", "The question already has an answer or is no longer current.")
        await db.commit()
    return ChatOperation(session_id, token, regenerate_of, expected_version, retry_question, save_retry_question)


async def fence_message_write(db):
    """Take a short fencing lock in the SAME transaction as the message write.

Call before flushing/committing messages, including disconnect recovery. An
expired/replaced operation must not append a late answer or overwrite a winner.
"""
    op = current_operation.get()
    if op is None:
        return
    with db.no_autoflush:
        row = await db.execute(update(ChatStreamLease).where(
            ChatStreamLease.session_id == op.session_id,
            ChatStreamLease.token == op.token,
            ChatStreamLease.expires_at > func.clock_timestamp(),
        ).values(expires_at=func.clock_timestamp() + timedelta(seconds=LEASE_SECONDS)).returning(ChatStreamLease.token))
    if row.scalar_one_or_none() is None:
        raise LeaseLost("Chat operation lease expired")


async def replace_answer(db, candidate: Message) -> Message:
    op = current_operation.get()
    if op is None or op.replace_id is None:
        raise RuntimeError("No replacement operation")
    await fence_message_write(db)
    original = (await db.execute(select(Message).where(
        Message.id == op.replace_id, Message.session_id == op.session_id,
    ).with_for_update().execution_options(populate_existing=True))).scalar_one()
    if original.response_version != op.expected_version:
        raise RuntimeError("Answer version changed")
    db.add(MessageRevision(message_id=original.id, snapshot={
        "content": original.content, "citations": copy.deepcopy(original.citations),
        "metadata_json": copy.deepcopy(original.metadata_json),
        "prompt_tokens": original.prompt_tokens, "output_tokens": original.output_tokens,
        "continuation_count": original.continuation_count,
        "response_version": str(original.response_version) if original.response_version else None,
        "created_at": original.created_at.isoformat(),
    }))
    original.content = candidate.content
    original.citations = candidate.citations
    original.metadata_json = candidate.metadata_json or {}
    original.prompt_tokens = candidate.prompt_tokens
    original.output_tokens = candidate.output_tokens
    original.continuation_count = 0
    original.response_version = op.result_version
    await db.commit()
    return original


async def replacement_delivered(operation: ChatOperation) -> bool:
    """Resolve an ambiguous commit before deciding whether to refund.

    Locking waits for an in-flight commit. A later replacement may already
    have archived our version; that is also durable delivery evidence.
    Caller must release its failed transaction before opening this session.
    """
    async with AsyncSessionLocal() as db:
        version = await db.scalar(select(Message.response_version).where(
            Message.id == operation.replace_id,
            Message.session_id == operation.session_id,
        ).with_for_update())
        if version == operation.result_version:
            return True
        return bool(await db.scalar(select(MessageRevision.id).where(
            MessageRevision.message_id == operation.replace_id,
            MessageRevision.snapshot["response_version"].astext == str(operation.result_version),
        ).limit(1)))


async def release_operation(operation: ChatOperation):
    # Also registered on the response, covering an iterator never started.
    with anyio.move_on_after(15, shield=True):
        async with AsyncSessionLocal() as db:
            await db.execute(delete(ChatStreamLease).where(
                ChatStreamLease.session_id == operation.session_id,
                ChatStreamLease.token == operation.token))
            await db.commit()


async def stream_with_operation(source, operation: ChatOperation, request_db):
    """Renew in fresh short transactions; release on all stream exit paths."""
    context_token = current_operation.set(operation)
    owner_task = asyncio.current_task()

    async def renew():
        last_success = time.monotonic()
        while True:
            deadline = last_success + LEASE_SECONDS - RENEW_SECONDS
            await asyncio.sleep(min(RENEW_SECONDS, max(0, deadline - time.monotonic())))
            try:
                async with asyncio.timeout(min(10, max(0.01, deadline - time.monotonic()))):
                    async with AsyncSessionLocal() as db:
                        await fence_message_write(db)
                        await db.commit()
                last_success = time.monotonic()
            except LeaseLost:
                if owner_task:
                    owner_task.cancel()
                return
            except Exception:
                logger.warning("chat_lease.renew_failed", exc_info=True)
                if time.monotonic() - last_success >= LEASE_SECONDS - RENEW_SECONDS:
                    if owner_task:
                        owner_task.cancel()
                    return

    heartbeat = asyncio.create_task(renew())
    try:
        deadline = time.monotonic() + 600
        while True:
            try:
                # Never leave a timeout scope across yield/ASGI backpressure.
                async with asyncio.timeout(max(0, deadline - time.monotonic())):
                    event = await anext(source)
            except StopAsyncIteration:
                break
            yield event
    finally:
        try:
            # A failed connection must not keep the response task alive forever.
            # If cleanup cannot finish, expiry still makes the lease reclaimable.
            with anyio.move_on_after(15, shield=True):
                heartbeat.cancel()
                await asyncio.gather(heartbeat, return_exceptions=True)
                try:
                    await source.aclose()
                finally:
                    await request_db.rollback()
                    await release_operation(operation)
        finally:
            current_operation.reset(context_token)
