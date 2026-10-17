"""Real transaction and HMAC regressions; dedicated scratch PostgreSQL only."""
import uuid
from unittest.mock import AsyncMock

import pytest
from sqlalchemy import delete, select

from app.api import billing
from app.models.database import AsyncSessionLocal
from app.models.tables import CreditLedger, User
from tests.test_billing_webhook_payment_guards import SECRET, event, signed_request

pytestmark = [pytest.mark.integration, pytest.mark.asyncio(loop_scope="session")]


@pytest.mark.parametrize("case", ["paid_replays", "delayed_success", "unpaid", "no_payment_required",
                                  "async_failed", "wrong_mode", "invalid_signature"])
async def test_signed_payment_event_preserves_balance_and_ledger_policy(monkeypatch, case):
    monkeypatch.setattr(billing.settings, "STRIPE_WEBHOOK_SECRET", SECRET)
    monkeypatch.setattr(billing.settings, "STRIPE_SECRET_KEY", "sk_test_local_only")
    monkeypatch.setattr(billing, "_record_product_event", AsyncMock())
    uid = uuid.uuid4()
    async with AsyncSessionLocal() as db:
        db.add(User(id=uid, email=f"payment-guard-{uid}@example.com", plan="free", credits_balance=100))
        await db.commit()
    item = {"id": f"cs_{uid.hex}", "mode": "payment", "payment_status": "paid",
            "client_reference_id": str(uid), "payment_intent": f"pi_{uid.hex}",
            "metadata": {"credits": "500"}}

    async def deliver(kind="checkout.session.completed", *, event_id=None, **kwargs):
        payload = event(item, event_type=kind, **kwargs)
        payload["id"] = event_id or "evt_" + uuid.uuid4().hex
        async with AsyncSessionLocal() as db:
            return await billing.stripe_webhook(
                signed_request(payload, invalid=case == "invalid_signature"), db
            )

    async def verify(balance, count):
        async with AsyncSessionLocal() as db:
            assert (await db.get(User, uid)).credits_balance == balance
            rows = list(await db.scalars(select(CreditLedger).where(CreditLedger.user_id == uid)))
            assert len(rows) == count

    try:
        if case in {"wrong_mode", "invalid_signature"}:
            from fastapi import HTTPException
            with pytest.raises(HTTPException) as exc:
                await deliver(livemode=case == "wrong_mode")
            assert exc.value.status_code == (400 if case == "wrong_mode" else 401)
        elif case == "delayed_success":
            item["payment_status"] = "unpaid"
            await deliver()
            await verify(100, 0)
            await deliver("checkout.session.async_payment_failed")
            await verify(100, 0)
            item["payment_status"] = "paid"
            await deliver("checkout.session.async_payment_succeeded", event_id="evt_delayed_replay")
            # Same event replay and a distinct event ID referencing the same payment.
            await deliver("checkout.session.async_payment_succeeded", event_id="evt_delayed_replay")
            await deliver()
        elif case == "paid_replays":
            await deliver(event_id="evt_paid_replay")
            await deliver(event_id="evt_paid_replay")
            await deliver("checkout.session.async_payment_succeeded")
        else:
            item["payment_status"] = case if case != "async_failed" else "unpaid"
            await deliver("checkout.session.async_payment_failed" if case == "async_failed"
                          else "checkout.session.completed")
        await verify(600 if case in {"paid_replays", "delayed_success"} else 100,
                     1 if case in {"paid_replays", "delayed_success"} else 0)
    finally:
        async with AsyncSessionLocal() as db:
            await db.execute(delete(User).where(User.id == uid))
            await db.commit()
