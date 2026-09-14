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
async def test_legacy_sentinel_is_cleared_when_stripe_has_no_live_state(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    user = _checkout_user()
    db = SimpleNamespace(commit=AsyncMock())
    invalidate = AsyncMock()
    monkeypatch.setattr(
        billing_api,
        "_list_customer_subscriptions",
        AsyncMock(return_value=[]),
    )
    monkeypatch.setattr(
        billing_api,
        "_list_customer_subscription_checkouts",
        AsyncMock(return_value=[]),
    )
    monkeypatch.setattr(billing_api, "_invalidate_user_caches", invalidate)

    recovered = await billing_api._reconcile_legacy_subscription_sentinel(
        user,
        db,
        expected_price_id="price_pro",
    )

    assert recovered is None
    assert user.stripe_subscription_id is None
    db.commit.assert_not_awaited()
    invalidate.assert_not_awaited()


@pytest.mark.asyncio
async def test_legacy_sentinel_reuses_verified_open_checkout(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    user = _checkout_user()
    db = SimpleNamespace(commit=AsyncMock())
    monkeypatch.setattr(
        billing_api,
        "_list_customer_subscriptions",
        AsyncMock(return_value=[]),
    )
    monkeypatch.setattr(
        billing_api,
        "_list_customer_subscription_checkouts",
        AsyncMock(
            return_value=[
                {
                    "id": "cs_legacy_open",
                    "url": "https://checkout.stripe.test/cs_legacy_open",
                    "status": "open",
                    "client_reference_id": str(user.id),
                    "line_items": {"data": [{"price": "price_pro"}]},
                }
            ]
        ),
    )

    recovered = await billing_api._reconcile_legacy_subscription_sentinel(
        user,
        db,
        expected_price_id="price_pro",
    )

    assert recovered is not None
    assert recovered.checkout_url.endswith("/cs_legacy_open")
    assert recovered.stripe_session_id == "cs_legacy_open"
    assert user.stripe_subscription_id == "pending"
    db.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_legacy_sentinel_blocks_unresolved_subscription(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    user = _checkout_user()
    db = SimpleNamespace(commit=AsyncMock())
    list_checkouts = AsyncMock(return_value=[])
    monkeypatch.setattr(
        billing_api,
        "_list_customer_subscriptions",
        AsyncMock(return_value=[{"id": "sub_incomplete", "status": "incomplete"}]),
    )
    monkeypatch.setattr(
        billing_api,
        "_list_customer_subscription_checkouts",
        list_checkouts,
    )

    with pytest.raises(HTTPException) as exc:
        await billing_api._reconcile_legacy_subscription_sentinel(
            user,
            db,
            expected_price_id="price_pro",
        )

    assert exc.value.status_code == 409
    assert user.stripe_subscription_id == "pending"
    db.commit.assert_not_awaited()
    list_checkouts.assert_awaited_once_with(user.stripe_customer_id)


@pytest.mark.asyncio
async def test_legacy_sentinel_adopts_active_subscription(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    user = _checkout_user()
    db = SimpleNamespace(commit=AsyncMock())
    invalidate = AsyncMock()
    monkeypatch.setattr(
        billing_api,
        "_list_customer_subscriptions",
        AsyncMock(
            return_value=[
                {
                    "id": "sub_active",
                    "status": "active",
                    "items": {"data": [{"price": {"id": "price_pro"}}]},
                }
            ]
        ),
    )
    monkeypatch.setattr(
        billing_api,
        "_list_customer_subscription_checkouts",
        AsyncMock(
            return_value=[
                {
                    "id": "cs_completed",
                    "status": "complete",
                    "subscription": "sub_active",
                }
            ]
        ),
    )
    monkeypatch.setattr(
        billing_api,
        "_plan_from_price_id",
        lambda price_id: "pro" if price_id == "price_pro" else None,
    )
    monkeypatch.setattr(billing_api, "_invalidate_user_caches", invalidate)

    with pytest.raises(HTTPException) as exc:
        await billing_api._reconcile_legacy_subscription_sentinel(
            user,
            db,
            expected_price_id="price_pro",
        )

    assert exc.value.status_code == 400
    assert user.stripe_subscription_id == "sub_active"
    assert user.plan == "pro"
    db.commit.assert_awaited_once()
    invalidate.assert_awaited_once_with(user.id)


@pytest.mark.asyncio
async def test_legacy_sentinel_rejects_open_checkout_for_different_price(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    user = _checkout_user()
    db = SimpleNamespace(commit=AsyncMock())
    monkeypatch.setattr(
        billing_api,
        "_list_customer_subscription_checkouts",
        AsyncMock(
            return_value=[
                {
                    "id": "cs_annual",
                    "url": "https://checkout.stripe.test/cs_annual",
                    "status": "open",
                    "client_reference_id": str(user.id),
                    "line_items": {"data": [{"price": "price_pro_annual"}]},
                }
            ]
        ),
    )
    monkeypatch.setattr(
        billing_api,
        "_list_customer_subscriptions",
        AsyncMock(return_value=[]),
    )

    with pytest.raises(HTTPException) as exc:
        await billing_api._reconcile_legacy_subscription_sentinel(
            user,
            db,
            expected_price_id="price_pro_monthly",
        )

    assert exc.value.status_code == 409
    assert user.stripe_subscription_id == "pending"
    db.commit.assert_not_awaited()


@pytest.mark.asyncio
async def test_legacy_sentinel_clears_after_completed_checkout_is_terminal(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    user = _checkout_user()
    db = SimpleNamespace(commit=AsyncMock())
    monkeypatch.setattr(
        billing_api,
        "_list_customer_subscription_checkouts",
        AsyncMock(
            return_value=[
                {
                    "id": "cs_completed_old",
                    "status": "complete",
                    "subscription": "sub_canceled",
                }
            ]
        ),
    )
    monkeypatch.setattr(
        billing_api,
        "_list_customer_subscriptions",
        AsyncMock(return_value=[{"id": "sub_canceled", "status": "canceled"}]),
    )

    recovered = await billing_api._reconcile_legacy_subscription_sentinel(
        user,
        db,
        expected_price_id="price_pro",
    )

    assert recovered is None
    assert user.stripe_subscription_id is None
    db.commit.assert_not_awaited()


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "other_session",
    [
        {
            "id": "cs_completed_unresolved",
            "status": "complete",
            "subscription": "sub_not_visible",
        },
        {"id": "cs_unknown", "status": "processing"},
    ],
)
async def test_legacy_open_checkout_does_not_hide_unresolved_history(
    monkeypatch: pytest.MonkeyPatch,
    other_session: dict,
) -> None:
    user = _checkout_user()
    db = SimpleNamespace(commit=AsyncMock())
    open_session = {
        "id": "cs_open",
        "url": "https://checkout.stripe.test/cs_open",
        "status": "open",
        "client_reference_id": str(user.id),
        "line_items": {"data": [{"price": "price_pro"}]},
    }
    monkeypatch.setattr(
        billing_api,
        "_list_customer_subscription_checkouts",
        AsyncMock(return_value=[open_session, other_session]),
    )
    monkeypatch.setattr(
        billing_api,
        "_list_customer_subscriptions",
        AsyncMock(return_value=[]),
    )

    with pytest.raises(HTTPException) as exc:
        await billing_api._reconcile_legacy_subscription_sentinel(
            user,
            db,
            expected_price_id="price_pro",
        )

    assert exc.value.status_code == 409
    assert user.stripe_subscription_id == "pending"
    db.commit.assert_not_awaited()


@pytest.mark.asyncio
async def test_terminal_completed_history_allows_verified_open_checkout(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    user = _checkout_user()
    db = SimpleNamespace(commit=AsyncMock())
    monkeypatch.setattr(
        billing_api,
        "_list_customer_subscription_checkouts",
        AsyncMock(
            return_value=[
                {
                    "id": "cs_open",
                    "url": "https://checkout.stripe.test/cs_open",
                    "status": "open",
                    "client_reference_id": str(user.id),
                    "line_items": {"data": [{"price": "price_pro"}]},
                },
                {
                    "id": "cs_completed_old",
                    "status": "complete",
                    "subscription": "sub_canceled",
                },
            ]
        ),
    )
    monkeypatch.setattr(
        billing_api,
        "_list_customer_subscriptions",
        AsyncMock(return_value=[{"id": "sub_canceled", "status": "canceled"}]),
    )

    recovered = await billing_api._reconcile_legacy_subscription_sentinel(
        user,
        db,
        expected_price_id="price_pro",
    )

    assert recovered is not None
    assert recovered.stripe_session_id == "cs_open"
    db.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_customer_subscription_reconciliation_reads_every_page(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    pages = AsyncMock(
        side_effect=[
            SimpleNamespace(
                data=[{"id": "sub_terminal", "status": "canceled"}],
                has_more=True,
            ),
            SimpleNamespace(
                data=[{"id": "sub_live", "status": "active"}],
                has_more=False,
            ),
        ]
    )
    monkeypatch.setattr(billing_api.asyncio, "to_thread", pages)

    subscriptions = await billing_api._list_customer_subscriptions("cus_123")

    assert [subscription["id"] for subscription in subscriptions] == [
        "sub_terminal",
        "sub_live",
    ]
    assert pages.await_args_list[0].kwargs["limit"] == 100
    assert pages.await_args_list[1].kwargs["starting_after"] == "sub_terminal"


@pytest.mark.asyncio
async def test_subscribe_continues_after_orphaned_legacy_sentinel_is_cleared(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    user = _checkout_user()
    added: list[object] = []
    db = SimpleNamespace(
        add=added.append,
        commit=AsyncMock(),
        rollback=AsyncMock(),
    )
    reconcile = AsyncMock(return_value=None)
    create_checkout = AsyncMock(
        return_value=billing_api.CheckoutResolution(
            checkout_url="https://checkout.stripe.test/cs_new",
            stripe_session_id="cs_new",
        )
    )
    monkeypatch.setattr(billing_api.settings, "STRIPE_SECRET_KEY", "sk_test_placeholder")
    monkeypatch.setattr(
        billing_api,
        "_get_subscription_price_id",
        lambda *_args: "price_pro",
    )
    monkeypatch.setattr(billing_api, "_lock_user", AsyncMock(return_value=user))
    monkeypatch.setattr(
        billing_api,
        "_latest_checkout_attempt",
        AsyncMock(return_value=None),
    )
    monkeypatch.setattr(
        billing_api,
        "_reconcile_legacy_subscription_sentinel",
        reconcile,
    )
    monkeypatch.setattr(
        billing_api,
        "_create_or_recover_checkout_session",
        create_checkout,
    )

    response = await billing_api.subscribe(
        body=billing_api.SubscribeRequest(plan="pro", billing="monthly"),
        user=user,
        db=db,
    )

    assert response == {"checkout_url": "https://checkout.stripe.test/cs_new"}
    reconcile.assert_awaited_once_with(user, db, expected_price_id="price_pro")
    assert len(added) == 1
    assert added[0].status == "creating"
    create_checkout.assert_awaited_once()
    db.rollback.assert_not_awaited()


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
