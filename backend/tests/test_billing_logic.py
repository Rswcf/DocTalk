from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from fastapi import HTTPException

from app.api import billing as billing_api


def _checkout_user() -> SimpleNamespace:
    return SimpleNamespace(
        id=uuid.uuid4(),
        email="reader@example.com",
        name="Reader",
        stripe_subscription_id="pending",
        stripe_customer_id="cus_123",
        plan="free",
    )


def _checkout_attempt(user: SimpleNamespace, **overrides) -> SimpleNamespace:
    attempt_id = uuid.uuid4()
    values = {
        "id": attempt_id,
        "idempotency_key": f"subscription_checkout_{attempt_id}",
        "user_id": user.id,
        "plan": "pro",
        "billing_period": "monthly",
        "source": "paywall_modal",
        "reason": "credits",
        "started_at": datetime.now(timezone.utc),
        "stripe_session_id": None,
        "checkout_url": None,
        "status": "creating",
    }
    values.update(overrides)
    return SimpleNamespace(**values)


@pytest.mark.asyncio
async def test_ambiguous_stripe_create_reuses_attempt_idempotency_key(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    user = _checkout_user()
    attempt = _checkout_attempt(user)
    db = SimpleNamespace()
    ambiguous = billing_api.stripe.StripeError("connection dropped after Stripe accepted POST")
    remote = {
        "id": "cs_same",
        "url": "https://checkout.stripe.test/cs_same",
        "status": "open",
    }
    to_thread = AsyncMock(side_effect=[ambiguous, remote])
    apply_remote = AsyncMock(
        return_value=billing_api.CheckoutResolution(
            checkout_url=remote["url"],
            stripe_session_id=remote["id"],
            newly_opened=True,
        )
    )
    monkeypatch.setattr(billing_api.asyncio, "to_thread", to_thread)
    monkeypatch.setattr(billing_api, "_apply_remote_checkout_session", apply_remote)
    monkeypatch.setattr(billing_api, "_get_subscription_price_id", lambda *_args: "price_pro")

    with pytest.raises(billing_api.stripe.StripeError):
        await billing_api._create_or_recover_checkout_session(user, attempt, db)
    recovered = await billing_api._create_or_recover_checkout_session(user, attempt, db)

    assert recovered is not None
    assert attempt.status == "creating"
    create_calls = to_thread.await_args_list
    assert len(create_calls) == 2
    assert create_calls[0].kwargs["idempotency_key"] == attempt.idempotency_key
    assert create_calls[1].kwargs["idempotency_key"] == attempt.idempotency_key


@pytest.mark.asyncio
async def test_lost_client_response_returns_open_attempt_url(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    user = _checkout_user()
    attempt = _checkout_attempt(
        user,
        status="open",
        stripe_session_id="cs_open",
        checkout_url="https://checkout.stripe.test/cs_open",
    )
    db = SimpleNamespace(commit=AsyncMock())
    monkeypatch.setattr(
        billing_api.asyncio,
        "to_thread",
        AsyncMock(return_value={
            "id": "cs_open",
            "url": attempt.checkout_url,
            "status": "open",
        }),
    )
    monkeypatch.setattr(
        billing_api,
        "_lock_checkout_state",
        AsyncMock(return_value=(user, attempt)),
    )

    recovered = await billing_api._recover_checkout_attempt(user, attempt, db)

    assert recovered is not None
    assert recovered.checkout_url == attempt.checkout_url
    assert recovered.stripe_session_id == "cs_open"
    assert attempt.status == "open"


@pytest.mark.asyncio
async def test_open_session_after_ttl_is_expired_before_replacement(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    user = _checkout_user()
    attempt = _checkout_attempt(
        user,
        status="open",
        started_at=(
            datetime.now(timezone.utc)
            - billing_api.PENDING_SUBSCRIPTION_TTL
            - timedelta(minutes=1)
        ),
        stripe_session_id="cs_stale",
        checkout_url="https://checkout.stripe.test/cs_stale",
    )
    db = SimpleNamespace(commit=AsyncMock())
    to_thread = AsyncMock(side_effect=[
        {"id": "cs_stale", "url": attempt.checkout_url, "status": "open"},
        {"id": "cs_stale", "url": None, "status": "expired"},
    ])
    monkeypatch.setattr(billing_api.asyncio, "to_thread", to_thread)
    monkeypatch.setattr(
        billing_api,
        "_lock_checkout_state",
        AsyncMock(return_value=(user, attempt)),
    )
    monkeypatch.setattr(billing_api, "_invalidate_user_caches", AsyncMock())

    recovered = await billing_api._recover_checkout_attempt(user, attempt, db)

    assert recovered is None
    assert attempt.status == "expired"
    assert user.stripe_subscription_id is None
    assert to_thread.await_args_list[1].args[0].__name__ == "expire"


@pytest.mark.asyncio
async def test_two_tab_retry_adopts_completed_checkout_without_new_session(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    user = _checkout_user()
    attempt = _checkout_attempt(
        user,
        status="open",
        stripe_session_id="cs_completed",
        checkout_url="https://checkout.stripe.test/cs_completed",
    )
    db = SimpleNamespace(commit=AsyncMock())
    to_thread = AsyncMock(return_value={
        "id": "cs_completed",
        "url": None,
        "status": "complete",
        "subscription": "sub_completed",
        "customer": "cus_123",
    })
    monkeypatch.setattr(billing_api.asyncio, "to_thread", to_thread)
    monkeypatch.setattr(
        billing_api,
        "_lock_checkout_state",
        AsyncMock(return_value=(user, attempt)),
    )
    monkeypatch.setattr(billing_api, "_invalidate_user_caches", AsyncMock())

    recovered = await billing_api._recover_checkout_attempt(user, attempt, db)

    assert recovered is not None
    assert recovered.completed is True
    assert recovered.checkout_url.endswith("/billing?success=1&session_id=cs_completed")
    assert user.stripe_subscription_id == "sub_completed"
    assert user.plan == "pro"
    assert attempt.status == "complete"
    assert len(to_thread.await_args_list) == 1


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
    db.commit.assert_not_awaited()


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


@pytest.mark.asyncio
async def test_fresh_annual_checkout_is_expired_before_monthly_replacement(monkeypatch):
    user = _checkout_user()
    attempt = _checkout_attempt(user, status='open', stripe_session_id='cs_annual', billing_period='annual')
    db = SimpleNamespace(commit=AsyncMock())
    calls=AsyncMock(side_effect=[{'id':'cs_annual','status':'open'},{'id':'cs_annual','status':'expired'}])
    monkeypatch.setattr(billing_api.asyncio,'to_thread',calls)
    monkeypatch.setattr(billing_api,'_lock_checkout_state',AsyncMock(return_value=(user,attempt)))
    monkeypatch.setattr(billing_api,'_invalidate_user_caches',AsyncMock())
    assert await billing_api._recover_checkout_attempt(user,attempt,db) is None
    assert attempt.status == 'expired' and user.stripe_subscription_id is None
    assert calls.await_args_list[1].args[0].__name__ == 'expire'


@pytest.mark.asyncio
async def test_ambiguous_sessionless_annual_checkout_is_not_recreated_or_abandoned(monkeypatch):
    user = _checkout_user()
    attempt = _checkout_attempt(user,billing_period='annual')
    calls=AsyncMock()
    monkeypatch.setattr(billing_api.asyncio,'to_thread',calls)
    with pytest.raises(HTTPException) as exc:
        await billing_api._recover_checkout_attempt(user,attempt,SimpleNamespace())
    assert exc.value.detail['error'] == 'ANNUAL_CHECKOUT_UNRESOLVED'
    assert attempt.status == 'creating'
    calls.assert_not_awaited()
