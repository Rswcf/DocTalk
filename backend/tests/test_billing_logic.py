from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from app.api import billing as billing_api


@pytest.mark.asyncio
async def test_recover_pending_subscription_syncs_active_subscription(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    user = SimpleNamespace(
        id=uuid.uuid4(),
        stripe_subscription_id="pending",
        stripe_customer_id="cus_123",
        updated_at=datetime.now(timezone.utc),
        plan="free",
    )
    db = SimpleNamespace(commit=AsyncMock())
    cache_delete = AsyncMock()

    monkeypatch.setattr(
        billing_api,
        "_get_customer_active_subscription",
        AsyncMock(
            return_value={
                "id": "sub_live",
                "items": {"data": [{"price": {"id": "price_pro_test"}}]},
            }
        ),
    )
    monkeypatch.setattr(billing_api, "_plan_from_price_id", lambda _price_id: "pro")
    monkeypatch.setattr(billing_api, "cache_delete", cache_delete)

    recovered = await billing_api._recover_pending_subscription(user, db)

    assert recovered is True
    assert user.stripe_subscription_id == "sub_live"
    assert user.plan == "pro"
    db.commit.assert_awaited_once()
    # Recovery path invalidates both profile and billing_state caches.
    cache_delete.assert_any_await(f"user:profile:{user.id}")
    cache_delete.assert_any_await(f"user:billing_state:{user.id}")
    assert cache_delete.await_count == 2


@pytest.mark.asyncio
async def test_recover_pending_subscription_clears_stale_pending_without_active_sub(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    user = SimpleNamespace(
        id=uuid.uuid4(),
        stripe_subscription_id="pending",
        stripe_customer_id="cus_123",
        updated_at=datetime.now(timezone.utc) - billing_api.PENDING_SUBSCRIPTION_TTL - timedelta(minutes=1),
    )
    db = SimpleNamespace(commit=AsyncMock())

    monkeypatch.setattr(
        billing_api,
        "_get_customer_active_subscription",
        AsyncMock(return_value=None),
    )

    recovered = await billing_api._recover_pending_subscription(user, db)

    assert recovered is False
    assert user.stripe_subscription_id is None
    db.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_invoice_payment_succeeded_skips_allowance_for_proration_invoice(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    user = SimpleNamespace(
        id=uuid.uuid4(),
        plan="pro",
        stripe_customer_id="cus_123",
    )
    db = SimpleNamespace(
        scalar=AsyncMock(return_value=user),
        commit=AsyncMock(),
        rollback=AsyncMock(),
    )
    credit_credits = AsyncMock()

    monkeypatch.setattr(billing_api, "credit_credits", credit_credits)

    response = await billing_api._handle_invoice_payment_succeeded(
        {
            "id": "in_proration",
            "customer": "cus_123",
            "billing_reason": "subscription_update",
        },
        db,
    )

    assert response == {"received": True}
    credit_credits.assert_not_awaited()
    db.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_subscription_deleted_ignores_stale_deleted_subscription() -> None:
    user = SimpleNamespace(
        id=uuid.uuid4(),
        plan="pro",
        stripe_customer_id="cus_123",
        stripe_subscription_id="sub_live",
        monthly_credits_granted_at=datetime.now(timezone.utc),
    )
    db = SimpleNamespace(
        scalar=AsyncMock(return_value=user),
        commit=AsyncMock(),
    )

    response = await billing_api._handle_subscription_deleted(
        {"id": "sub_old", "customer": "cus_123"},
        db,
    )

    assert response == {"received": True}
    assert user.plan == "pro"
    assert user.stripe_subscription_id == "sub_live"
    db.commit.assert_not_awaited()
