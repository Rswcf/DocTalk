"""Pending checkout retries preserve access and serialize against a real database."""
import asyncio
import uuid
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, Mock

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient
from sqlalchemy import delete, select

from app.api import billing
from app.core.deps import get_db_session, require_auth
from app.models.database import AsyncSessionLocal
from app.models.tables import CheckoutAttempt, User

pytestmark = [pytest.mark.integration, pytest.mark.asyncio(loop_scope="session")]


@pytest.mark.parametrize("remote_state", ["open", "expired", "expiration_race"])
async def test_paid_pending_retry_resolves_durable_session_without_credit_changes(monkeypatch, remote_state):
    async with AsyncSessionLocal() as db:
        user = User(email=f"pending-{uuid.uuid4().hex}@example.com", plan="plus", credits_balance=173,
                    stripe_customer_id="cus_fixture", stripe_subscription_id="pending")
        db.add(user)
        await db.flush()
        attempt = CheckoutAttempt(user_id=user.id, idempotency_key=uuid.uuid4().hex, plan="plus",
                                  billing_period="monthly", stripe_session_id="cs_previous", status="open",
                                  started_at=datetime.now(timezone.utc) - timedelta(days=2) if remote_state == "expiration_race" else datetime.now(timezone.utc))
        db.add(attempt)
        await db.commit()
        user_id, attempt_id = user.id, attempt.id
    monkeypatch.setattr(billing.settings, "STRIPE_SECRET_KEY", "sk_test_fixture")
    monkeypatch.setattr(billing, "_get_subscription_price_id", lambda *_: "price_plus")
    monkeypatch.setattr(billing, "_invalidate_user_caches", AsyncMock())
    subscription_lookup = Mock(side_effect=AssertionError("pending must not be retrieved as subscription"))
    monkeypatch.setattr(billing.stripe.Subscription, "retrieve", subscription_lookup)
    def session(state):
        return {"id": "cs_previous", "status": state, "url": "https://checkout.stripe.test/previous",
                "subscription": "sub_completed", "customer": "cus_fixture"}
    retrieve = Mock(side_effect=[session("open"), session("complete")] if remote_state == "expiration_race" else None,
                    return_value=session(remote_state))
    monkeypatch.setattr(billing.stripe.checkout.Session, "retrieve", retrieve)
    expire = Mock(side_effect=billing.stripe.StripeError("completed concurrently"))
    monkeypatch.setattr(billing.stripe.checkout.Session, "expire", expire)
    created = []
    async def create(_user, new_attempt, db):
        created.append(new_attempt.id)
        new_attempt.status = "open"
        new_attempt.stripe_session_id = "cs_replacement"
        new_attempt.checkout_url = "https://checkout.stripe.test/replacement"
        await db.commit()
        return billing.CheckoutResolution(checkout_url=new_attempt.checkout_url, stripe_session_id="cs_replacement")
    monkeypatch.setattr(billing, "_create_or_recover_checkout_session", create)
    app = FastAPI()
    app.include_router(billing.router)
    async def connection():
        async with AsyncSessionLocal() as db:
            yield db
    app.dependency_overrides[get_db_session] = connection
    app.dependency_overrides[require_auth] = lambda: user
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.post("/api/billing/subscribe", json={"plan": "plus", "billing": "monthly"})
        assert response.status_code == 200, response.text
        async with AsyncSessionLocal() as db:
            saved = await db.get(User, user_id)
            prior = await db.get(CheckoutAttempt, attempt_id)
            attempts = list((await db.scalars(select(CheckoutAttempt).where(CheckoutAttempt.user_id == user_id))).all())
            assert (saved.plan, saved.credits_balance) == ("plus", 173)
            assert prior.status == {"open": "open", "expired": "expired", "expiration_race": "complete"}[remote_state]
            assert len(attempts) == (2 if remote_state == "expired" else 1)
            assert len(created) == (1 if remote_state == "expired" else 0)
            assert saved.stripe_subscription_id == ("sub_completed" if remote_state == "expiration_race" else "pending")
        subscription_lookup.assert_not_called()
        assert expire.call_count == (1 if remote_state == "expiration_race" else 0)
    finally:
        async with AsyncSessionLocal() as db:
            await db.execute(delete(User).where(User.id == user_id))
            await db.commit()


async def test_paid_pending_concurrent_retries_reuse_one_session(monkeypatch):
    async with AsyncSessionLocal() as db:
        user = User(email=f"pending-concurrent-{uuid.uuid4().hex}@example.com", plan="plus", credits_balance=173,
                    stripe_customer_id="cus_fixture", stripe_subscription_id="pending")
        db.add(user)
        await db.flush()
        db.add(CheckoutAttempt(user_id=user.id, idempotency_key=uuid.uuid4().hex, plan="plus", billing_period="monthly",
                               stripe_session_id="cs_shared", status="open"))
        await db.commit()
        user_id = user.id
    monkeypatch.setattr(billing.settings, "STRIPE_SECRET_KEY", "sk_test_fixture")
    monkeypatch.setattr(billing, "_get_subscription_price_id", lambda *_: "price_plus")
    monkeypatch.setattr(billing.stripe.checkout.Session, "retrieve", lambda _: {
        "id": "cs_shared", "status": "open", "url": "https://checkout.stripe.test/shared"})
    create = Mock(side_effect=AssertionError("concurrent retries must not create another Session"))
    monkeypatch.setattr(billing.stripe.checkout.Session, "create", create)
    async def retry():
        async with AsyncSessionLocal() as db:
            auth = await db.get(User, user_id)
            return await billing.subscribe(billing.SubscribeRequest(plan="plus", billing="monthly"), auth, db)
    try:
        first, second = await asyncio.gather(retry(), retry())
        assert first == second == {"checkout_url": "https://checkout.stripe.test/shared"}
        async with AsyncSessionLocal() as db:
            saved = await db.get(User, user_id)
            attempts = list((await db.scalars(select(CheckoutAttempt).where(CheckoutAttempt.user_id == user_id))).all())
            assert len(attempts) == 1
            assert (saved.plan, saved.credits_balance, saved.stripe_subscription_id) == ("plus", 173, "pending")
        create.assert_not_called()
    finally:
        async with AsyncSessionLocal() as db:
            await db.execute(delete(User).where(User.id == user_id))
            await db.commit()
