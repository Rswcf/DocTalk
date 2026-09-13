"""Real Postgres guarantees for paid invoice delivery order and atomic grants."""

from __future__ import annotations

import asyncio
import uuid
from unittest.mock import AsyncMock, Mock

import pytest
import pytest_asyncio
from fastapi import HTTPException
from sqlalchemy import delete, select

from app.api import billing
from app.models.database import AsyncSessionLocal
from app.models.tables import CreditLedger, User

pytestmark = [pytest.mark.integration, pytest.mark.asyncio(loop_scope="session")]


@pytest_asyncio.fixture(loop_scope="session")
async def purchase(monkeypatch):
    suffix = uuid.uuid4().hex
    customer_id, subscription_id = f"cus_{suffix}", f"sub_{suffix}"
    monkeypatch.setattr(billing.settings, "STRIPE_PRICE_PLUS_MONTHLY", "price_plus")
    monkeypatch.setattr(billing.settings, "PLAN_PLUS_MONTHLY_CREDITS", 3000)
    monkeypatch.setattr(billing, "_invalidate_user_caches", AsyncMock())
    monkeypatch.setattr(
        billing.stripe.Subscription,
        "retrieve",
        Mock(
            return_value={
                "id": subscription_id,
                "customer": customer_id,
                "status": "active",
                "items": {"data": [{"price": {"id": "price_plus"}}]},
            }
        ),
    )
    monkeypatch.setattr(
        billing.stripe.Subscription,
        "cancel",
        Mock(side_effect=AssertionError("Unexpected cancellation")),
    )
    monkeypatch.setattr(
        billing.stripe.Invoice,
        "list_lines",
        Mock(side_effect=AssertionError("Fixture contains all lines")),
    )
    async with AsyncSessionLocal() as db:
        user = User(
            email=f"invoice-{suffix}@example.com",
            plan="free",
            credits_balance=300,
            stripe_customer_id=customer_id,
            stripe_subscription_id="pending",
        )
        db.add(user)
        await db.commit()
        user_id = user.id
    try:
        yield user_id, customer_id, subscription_id, f"in_{suffix}"
    finally:
        async with AsyncSessionLocal() as db:
            await db.execute(delete(User).where(User.id == user_id))
            await db.commit()


def paid_invoice(purchase, version="basil", price="price_plus"):
    _, customer_id, subscription_id, invoice_id = purchase
    line = {"id": "il_recurring", "amount": 0}
    item = {
        "id": invoice_id,
        "customer": customer_id,
        "status": "paid",
        "amount_paid": 0,
        "billing_reason": "subscription_create",
        "lines": {"data": [line], "has_more": False},
    }
    if version == "basil":
        item["parent"] = {
            "type": "subscription_details",
            "subscription_details": {"subscription": subscription_id},
        }
        line.update(
            {
                "parent": {
                    "type": "subscription_item_details",
                    "subscription_item_details": {
                        "subscription": subscription_id,
                        "proration": False,
                    },
                },
                "pricing": {"type": "price_details", "price_details": {"price": price}},
            }
        )
    else:
        item["subscription"] = subscription_id
        line.update(
            {
                "type": "subscription",
                "subscription": subscription_id,
                "proration": False,
                "price": {"id": price},
            }
        )
    return item


async def deliver_invoice(item):
    async with AsyncSessionLocal() as db:
        return await billing._handle_invoice_payment_succeeded(item, db)


async def deliver_checkout(purchase):
    user_id, customer_id, subscription_id, _ = purchase
    async with AsyncSessionLocal() as db:
        return await billing._handle_checkout_session_subscription_completed(
            {
                "id": f"cs_{user_id.hex}",
                "client_reference_id": str(user_id),
                "customer": customer_id,
                "subscription": subscription_id,
            },
            db,
        )


async def assert_state(purchase, *, balance, plan, deltas):
    async with AsyncSessionLocal() as db:
        user = await db.get(User, purchase[0])
        assert (user.credits_balance, user.plan) == (balance, plan)
        ledger = list(
            (
                await db.scalars(
                    select(CreditLedger).where(
                        CreditLedger.user_id == user.id,
                        CreditLedger.ref_type == "stripe_invoice",
                    )
                )
            ).all()
        )
        assert [row.delta for row in ledger] == deltas
        if ledger:
            assert ledger[0].ref_id == purchase[3]
            assert ledger[0].balance_after == balance


@pytest.mark.parametrize("version", ["legacy", "basil"])
@pytest.mark.parametrize("invoice_first", [True, False])
async def test_delivery_order_and_replay_preserve_exact_allowance(
    purchase, version, invoice_first
):
    item = paid_invoice(purchase, version)
    if invoice_first:
        await deliver_invoice(item)
        await assert_state(purchase, balance=3300, plan="free", deltas=[3000])
        await deliver_checkout(purchase)
    else:
        await deliver_checkout(purchase)
        await assert_state(purchase, balance=300, plan="plus", deltas=[])
        await deliver_invoice(item)
    await assert_state(purchase, balance=3300, plan="plus", deltas=[3000])
    await deliver_invoice(item)
    await deliver_checkout(purchase)
    await assert_state(purchase, balance=3300, plan="plus", deltas=[3000])


async def test_two_connections_grant_same_invoice_once(purchase, monkeypatch):
    # Both deliveries must pass the initial ledger read before either takes the
    # row lock, making this exercise the locked recheck rather than the fast path.
    resolve = billing._invoice_allowance_details
    both_resolving = asyncio.Event()
    arrived = 0

    async def synchronized_resolve(item):
        nonlocal arrived
        arrived += 1
        if arrived == 2:
            both_resolving.set()
        await asyncio.wait_for(both_resolving.wait(), timeout=5)
        return await resolve(item)

    monkeypatch.setattr(billing, "_invoice_allowance_details", synchronized_resolve)
    item = paid_invoice(purchase)
    results = await asyncio.wait_for(
        asyncio.gather(deliver_invoice(item), deliver_invoice(item)), timeout=10
    )
    assert results == [{"received": True}, {"received": True}]
    await assert_state(purchase, balance=3300, plan="free", deltas=[3000])


async def test_unconfigured_price_can_retry_after_configuration_recovers(
    purchase, monkeypatch
):
    item = paid_invoice(purchase, price="price_rotated")
    with pytest.raises(HTTPException) as exc:
        await deliver_invoice(item)
    assert exc.value.status_code == 503
    await assert_state(purchase, balance=300, plan="free", deltas=[])
    monkeypatch.setattr(billing.settings, "STRIPE_PRICE_PLUS_MONTHLY", "price_rotated")
    await deliver_invoice(item)
    await assert_state(purchase, balance=3300, plan="free", deltas=[3000])


async def test_failed_commit_rolls_back_balance_and_ledger_then_retry_succeeds(
    purchase, monkeypatch
):
    item = paid_invoice(purchase)
    async with AsyncSessionLocal() as db:
        monkeypatch.setattr(
            db, "commit", AsyncMock(side_effect=RuntimeError("injected commit failure"))
        )
        with pytest.raises(HTTPException) as exc:
            await billing._handle_invoice_payment_succeeded(item, db)
        assert exc.value.status_code == 500
    await assert_state(purchase, balance=300, plan="free", deltas=[])
    await deliver_invoice(item)
    await assert_state(purchase, balance=3300, plan="free", deltas=[3000])


async def test_delayed_paid_invoice_does_not_reactivate_cancelled_subscription(
    purchase,
):
    async with AsyncSessionLocal() as db:
        user = await db.get(User, purchase[0])
        user.stripe_subscription_id = None
        await db.commit()
    await deliver_invoice(paid_invoice(purchase))
    await assert_state(purchase, balance=3300, plan="free", deltas=[3000])
    async with AsyncSessionLocal() as db:
        assert (await db.get(User, purchase[0])).stripe_subscription_id is None
