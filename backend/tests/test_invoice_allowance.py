"""Paid invoice snapshots, schema compatibility, and retry-safe allowance grants."""

import uuid
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock

import pytest
from fastapi import HTTPException

from app.api import billing


@pytest.fixture(autouse=True)
def prices(monkeypatch):
    for name, value in {
        "STRIPE_PRICE_PLUS_MONTHLY": "price_plus",
        "STRIPE_PRICE_PLUS_ANNUAL": "price_plus_annual",
        "STRIPE_PRICE_PRO_MONTHLY": "price_pro",
        "STRIPE_PRICE_PRO_ANNUAL": "price_pro_annual",
        "PLAN_PLUS_MONTHLY_CREDITS": 3000,
        "PLAN_PRO_MONTHLY_CREDITS": 9000,
    }.items():
        monkeypatch.setattr(billing.settings, name, value)
    monkeypatch.setattr(
        billing.stripe.Subscription,
        "retrieve",
        Mock(side_effect=AssertionError("Do not read live subscription prices")),
    )


def invoice(version="basil", price="price_plus"):
    line = {"id": "il_recurring", "amount": 0, "quantity": 1}
    result = {
        "id": "in_paid",
        "customer": "cus_fixture",
        "status": "paid",
        "amount_paid": 0,
        "billing_reason": "subscription_create",
        "lines": {"data": [line], "has_more": False},
    }
    if version == "basil":
        result["parent"] = {
            "type": "subscription_details",
            "subscription_details": {"subscription": "sub_bought"},
        }
        line.update(
            {
                "parent": {
                    "type": "subscription_item_details",
                    "subscription_item_details": {
                        "subscription": "sub_bought",
                        "proration": False,
                    },
                },
                "pricing": {"type": "price_details", "price_details": {"price": price}},
            }
        )
    else:
        result["subscription"] = "sub_bought"
        line.update(
            {
                "type": "subscription",
                "subscription": "sub_bought",
                "proration": False,
                "price": {"id": price},
            }
        )
    return result


def database(plan="free", subscription="pending"):
    user = SimpleNamespace(
        id=uuid.uuid4(), plan=plan, stripe_subscription_id=subscription
    )
    db = SimpleNamespace(
        scalar=AsyncMock(side_effect=[user, None, user, None]),
        commit=AsyncMock(),
        rollback=AsyncMock(),
    )
    return user, db


@pytest.mark.asyncio
@pytest.mark.parametrize("version", ["legacy", "basil"])
@pytest.mark.parametrize(
    "price,amount",
    [
        ("price_plus", 3000),

        ("price_pro", 9000),

    ],
)
async def test_paid_invoice_before_checkout_including_zero_cash(
    monkeypatch, version, price, amount
):
    user, db = database()
    grant = AsyncMock()
    monkeypatch.setattr(billing, "credit_credits", grant)
    assert await billing._handle_invoice_payment_succeeded(
        invoice(version, price), db
    ) == {"received": True}
    assert grant.await_args.kwargs["amount"] == amount
    assert grant.await_args.kwargs["ref_id"] == "in_paid"
    assert (user.plan, user.stripe_subscription_id) == ("free", "pending")
    db.commit.assert_awaited_once()


@pytest.mark.asyncio
@pytest.mark.parametrize("plan,subscription", [("pro", "sub_new"), ("free", None)])
async def test_late_invoice_preserves_current_entitlements(
    monkeypatch, plan, subscription
):
    user, db = database(plan, subscription)
    grant = AsyncMock()
    monkeypatch.setattr(billing, "credit_credits", grant)
    item = invoice()
    item["billing_reason"] = "subscription_cycle"
    await billing._handle_invoice_payment_succeeded(item, db)
    assert grant.await_args.kwargs["amount"] == 3000
    assert (user.plan, user.stripe_subscription_id) == (plan, subscription)


@pytest.mark.asyncio
async def test_pagination_ignores_proration_and_one_off(monkeypatch):
    item = invoice()
    recurring = item["lines"]["data"][0]
    item["lines"] = {
        "has_more": True,
        "data": [
            {"id": "il_extra", "type": "invoiceitem", "price": {"id": "price_pro"}},
            {
                "id": "il_proration",
                "type": "subscription",
                "subscription": "sub_bought",
                "proration": True,
                "price": {"id": "price_pro"},
            },
        ],
    }
    pages = Mock(return_value={"has_more": False, "data": [recurring]})
    monkeypatch.setattr(billing.stripe.Invoice, "list_lines", pages)
    assert await billing._invoice_allowance_plan(item) == "plus"
    pages.assert_called_once_with("in_paid", limit=100, starting_after="il_proration")


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "failure",
    [
        "unknown",
        "missing",
        "conflict",
        "foreign",
        "missing_subscription",
        "missing_proration",
        "pagination",
        "api",
    ],
)
async def test_unresolved_invoice_never_writes_fallback_grant(monkeypatch, failure):
    item = invoice("legacy")
    line = item["lines"]["data"][0]
    if failure == "unknown":
        line["price"]["id"] = "price_unconfigured"
    if failure == "missing":
        line.pop("price")
        monkeypatch.setattr(billing.settings, "STRIPE_PRICE_PLUS_MONTHLY", "")
    if failure == "conflict":
        item["lines"]["data"].append(
            {**line, "id": "il_pro", "price": {"id": "price_pro"}}
        )
    if failure == "foreign":
        line["subscription"] = "sub_someone_else"
    if failure == "missing_subscription":
        item.pop("subscription")
    if failure == "missing_proration":
        line.pop("proration")
    if failure == "pagination":
        item["lines"] = {"data": [], "has_more": True}
    if failure == "api":
        item.pop("lines")
        monkeypatch.setattr(
            billing.stripe.Invoice,
            "list_lines",
            Mock(side_effect=billing.stripe.StripeError("offline")),
        )
    user, db = database()
    grant = AsyncMock()
    monkeypatch.setattr(billing, "credit_credits", grant)
    with pytest.raises(HTTPException) as exc:
        await billing._handle_invoice_payment_succeeded(item, db)
    assert exc.value.status_code == 503
    grant.assert_not_awaited()
    db.commit.assert_not_awaited()
    db.rollback.assert_awaited_once()
    assert user.plan == "free"


@pytest.mark.asyncio
async def test_duplicate_old_undergrant_not_implicitly_repaired(monkeypatch):
    user, db = database()
    db.scalar.side_effect = [user, SimpleNamespace(delta=300)]
    resolve = AsyncMock(side_effect=AssertionError("Already settled"))
    monkeypatch.setattr(billing, "_invoice_allowance_plan", resolve)
    grant = AsyncMock()
    monkeypatch.setattr(billing, "credit_credits", grant)
    assert await billing._handle_invoice_payment_succeeded(invoice(), db) == {
        "received": True
    }
    grant.assert_not_awaited()
    resolve.assert_not_awaited()


@pytest.mark.asyncio
async def test_delivery_rechecks_after_lock(monkeypatch):
    user, db = database()
    db.scalar.side_effect = [user, None, user, SimpleNamespace(delta=3000)]
    grant = AsyncMock()
    monkeypatch.setattr(billing, "credit_credits", grant)
    assert await billing._handle_invoice_payment_succeeded(invoice(), db) == {
        "received": True
    }
    grant.assert_not_awaited()


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "reason,status",
    [
        ("subscription_update", "paid"),
        ("manual", "paid"),
        ("subscription_create", "open"),
    ],
)
async def test_non_allowance_or_unpaid_invoice_has_no_side_effects(
    monkeypatch, reason, status
):
    item = invoice()
    item.update(billing_reason=reason, status=status)
    _, db = database()
    grant = AsyncMock()
    monkeypatch.setattr(billing, "credit_credits", grant)
    assert await billing._handle_invoice_payment_succeeded(item, db) == {
        "received": True
    }
    db.scalar.assert_not_awaited()
    grant.assert_not_awaited()


def test_empty_price_cannot_match_empty_configuration(monkeypatch):
    monkeypatch.setattr(billing.settings, "STRIPE_PRICE_PLUS_MONTHLY", "")
    monkeypatch.setattr(billing.settings, "STRIPE_PRICE_PRO_MONTHLY", "")
    assert billing._plan_from_price_id("") is None
