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

    await reconcile_credits(
        db=db,
        user_id=uuid.uuid4(),
        predebit_ledger_id=uuid.uuid4(),
        pre_debited=10,
        actual_cost=25,
    )

    assert db.execute.await_count == 2
    db.flush.assert_awaited_once()


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
