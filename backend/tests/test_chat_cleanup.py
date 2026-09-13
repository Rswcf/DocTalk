"""Native cancellation and deadline cleanup must release the original task."""
import asyncio
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from app.services.chat_cleanup import protected_cleanup, rollback_or_invalidate


@pytest.mark.asyncio
async def test_timeout_drains_rollback_invalidation_before_return():
    invalidating, exited = asyncio.Event(), asyncio.Event()
    async def rollback():
        await asyncio.Event().wait()
    async def invalidate():
        invalidating.set()
        try:
            await asyncio.sleep(0.03)
        finally:
            exited.set()
    db = SimpleNamespace(rollback=rollback, invalidate=invalidate)
    with pytest.raises(TimeoutError):
        await protected_cleanup(rollback_or_invalidate(db), timeout=0.01, label='drain-test')
    assert invalidating.is_set() and exited.is_set()
    assert not [task for task in asyncio.all_tasks() if task.get_name() == 'chat-cleanup:drain-test']


@pytest.mark.asyncio
async def test_rollback_failure_invalidates_connection_and_can_continue_resolution():
    db = SimpleNamespace(rollback=AsyncMock(side_effect=RuntimeError('connection failed')), invalidate=AsyncMock())
    await rollback_or_invalidate(db)
    db.invalidate.assert_awaited_once()
