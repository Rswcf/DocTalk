from __future__ import annotations

import uuid
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from app.services.credit_service import reconcile_credits


class _ScalarResult:
    def __init__(self, value):
        self._value = value

    def scalar_one_or_none(self):
        return self._value


@pytest.mark.asyncio
async def test_reconcile_updates_balance_and_ledger_for_undercharge() -> None:
    db = SimpleNamespace(
        execute=AsyncMock(
            side_effect=[
                _ScalarResult(85),  # new user balance after charging extra credits
                _ScalarResult(uuid.uuid4()),  # updated ledger row exists
            ]
        ),
        flush=AsyncMock(),
    )

    result = await reconcile_credits(
        db=db,
        user_id=uuid.uuid4(),
        predebit_ledger_id=uuid.uuid4(),
        pre_debited=10,
        actual_cost=25,
    )

    assert db.execute.await_count == 2
    db.flush.assert_awaited_once()
    # FIX2-B(b) (Codex r2 #4): callers must be able to use the returned
    # balance directly instead of a separate get_user_credits() round-trip.
    assert result == 85


@pytest.mark.asyncio
async def test_reconcile_noop_still_returns_current_balance() -> None:
    """FIX2-B(b): pre_debited == actual_cost is a no-op for the UPDATE
    statements, but callers still need SOME balance value back — must not
    silently return None, forcing a caller to re-query."""
    user_id = uuid.uuid4()
    fake_user = SimpleNamespace(id=user_id, credits_balance=470)
    db = SimpleNamespace(
        get=AsyncMock(return_value=fake_user),
        execute=AsyncMock(),
        flush=AsyncMock(),
    )

    result = await reconcile_credits(
        db=db,
        user_id=user_id,
        predebit_ledger_id=uuid.uuid4(),
        pre_debited=15,
        actual_cost=15,
    )

    assert result == 470
    db.execute.assert_not_awaited()  # true no-op: no UPDATE statements at all
    db.flush.assert_not_awaited()


@pytest.mark.asyncio
async def test_reconcile_noop_raises_when_user_missing() -> None:
    db = SimpleNamespace(get=AsyncMock(return_value=None), execute=AsyncMock(), flush=AsyncMock())

    with pytest.raises(RuntimeError, match="not found during credit reconciliation"):
        await reconcile_credits(
            db=db,
            user_id=uuid.uuid4(),
            predebit_ledger_id=uuid.uuid4(),
            pre_debited=15,
            actual_cost=15,
        )


@pytest.mark.asyncio
async def test_reconcile_raises_when_balance_update_misses_user() -> None:
    db = SimpleNamespace(
        execute=AsyncMock(side_effect=[_ScalarResult(None)]),
        flush=AsyncMock(),
    )

    with pytest.raises(RuntimeError, match="not found during credit reconciliation"):
        await reconcile_credits(
            db=db,
            user_id=uuid.uuid4(),
            predebit_ledger_id=uuid.uuid4(),
            pre_debited=10,
            actual_cost=25,
        )

    db.flush.assert_not_awaited()


@pytest.mark.asyncio
async def test_reconcile_raises_when_ledger_update_misses_row() -> None:
    db = SimpleNamespace(
        execute=AsyncMock(
            side_effect=[
                _ScalarResult(85),
                _ScalarResult(None),
            ]
        ),
        flush=AsyncMock(),
    )

    with pytest.raises(RuntimeError, match="Predebit ledger .* not found"):
        await reconcile_credits(
            db=db,
            user_id=uuid.uuid4(),
            predebit_ledger_id=uuid.uuid4(),
            pre_debited=10,
            actual_cost=25,
        )

    db.flush.assert_not_awaited()
