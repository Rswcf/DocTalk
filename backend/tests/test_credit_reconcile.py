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


def _locked_ledger_row():
    """Stand-in for the SELECT ... FOR UPDATE result — reconcile_credits
    only checks it's not None; the row's own field values aren't read."""
    return _ScalarResult(SimpleNamespace(id=uuid.uuid4()))


@pytest.mark.asyncio
async def test_reconcile_updates_balance_and_ledger_for_undercharge() -> None:
    db = SimpleNamespace(
        execute=AsyncMock(
            side_effect=[
                _locked_ledger_row(),  # FIX3-A(b): SELECT ... FOR UPDATE locks the ledger row first
                _ScalarResult(85),  # new user balance after charging extra credits
                _ScalarResult(None),  # ledger UPDATE (delta/balance_after/reconciled_at) — return value unused
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

    assert db.execute.await_count == 3
    db.flush.assert_awaited_once()
    # FIX2-B(b) (Codex r2 #4): callers must be able to use the returned
    # balance directly instead of a separate get_user_credits() round-trip.
    assert result == 85


@pytest.mark.asyncio
async def test_reconcile_locks_the_ledger_row_before_any_update() -> None:
    """FIX3-A(b) (Codex r3 #4, NOT ADDRESSED): the row lock (SELECT ... FOR
    UPDATE) must be the FIRST statement issued — it's what SERIALIZES this
    reconciliation against a concurrent _refund_predebit's conditional
    DELETE (FIX3-A(c)), closing the "resolver reads uncommitted marker as
    absent while the atomic transaction is still landing" race Codex r3
    demonstrated."""
    calls: list[str] = []

    async def execute(stmt):
        calls.append(str(stmt))
        if len(calls) == 1:
            return _locked_ledger_row()
        if len(calls) == 2:
            return _ScalarResult(85)
        return _ScalarResult(None)

    db = SimpleNamespace(execute=AsyncMock(side_effect=execute), flush=AsyncMock())

    await reconcile_credits(
        db=db,
        user_id=uuid.uuid4(),
        predebit_ledger_id=uuid.uuid4(),
        pre_debited=10,
        actual_cost=25,
    )

    assert len(calls) == 3
    assert "FOR UPDATE" in calls[0].upper()


@pytest.mark.asyncio
async def test_reconcile_noop_still_locks_and_stamps_reconciled_at() -> None:
    """FIX3-A(b): pre_debited == actual_cost is no longer a true no-op for
    the ledger row — the row is STILL locked and reconciled_at is STILL
    stamped (even though delta/balance_after don't change), because that
    stamp is the durable settlement marker the conditional refund path
    depends on. The prior version left the row completely untouched here,
    which is exactly the "equal-cost path has no lock, nothing serializes
    the transactions" gap Codex r3 found."""
    user_id = uuid.uuid4()
    fake_user = SimpleNamespace(id=user_id, credits_balance=470)
    db = SimpleNamespace(
        get=AsyncMock(return_value=fake_user),
        execute=AsyncMock(side_effect=[_locked_ledger_row(), _ScalarResult(None)]),
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
    assert db.execute.await_count == 2  # lock + reconciled_at stamp — NOT zero anymore
    db.flush.assert_awaited_once()


@pytest.mark.asyncio
async def test_reconcile_noop_raises_when_user_missing() -> None:
    db = SimpleNamespace(
        get=AsyncMock(return_value=None),
        execute=AsyncMock(side_effect=[_locked_ledger_row(), _ScalarResult(None)]),
        flush=AsyncMock(),
    )

    with pytest.raises(RuntimeError, match="not found during credit reconciliation"):
        await reconcile_credits(
            db=db,
            user_id=uuid.uuid4(),
            predebit_ledger_id=uuid.uuid4(),
            pre_debited=15,
            actual_cost=15,
        )


@pytest.mark.asyncio
async def test_reconcile_raises_when_ledger_row_missing_at_lock_time() -> None:
    """The "ledger not found" check now happens entirely at the lock step
    — SELECT ... FOR UPDATE finding no row is the ONLY way this can fire
    (the later UPDATE statements no longer carry their own separate
    existence check, since the lock already proved the row exists)."""
    db = SimpleNamespace(
        execute=AsyncMock(side_effect=[_ScalarResult(None)]),
        flush=AsyncMock(),
    )

    with pytest.raises(RuntimeError, match="Predebit ledger .* not found"):
        await reconcile_credits(
            db=db,
            user_id=uuid.uuid4(),
            predebit_ledger_id=uuid.uuid4(),
            pre_debited=15,
            actual_cost=15,
        )

    db.flush.assert_not_awaited()


@pytest.mark.asyncio
async def test_reconcile_raises_when_balance_update_misses_user() -> None:
    db = SimpleNamespace(
        execute=AsyncMock(side_effect=[_locked_ledger_row(), _ScalarResult(None)]),
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
