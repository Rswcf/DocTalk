"""Real database proof that status reads cannot mistake another payment for fulfillment."""
import uuid

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient
from sqlalchemy import delete, func, select

from app.api import billing
from app.core.deps import get_db_session, require_auth
from app.models.database import AsyncSessionLocal
from app.models.tables import CheckoutAttempt, CreditLedger, User

pytestmark = [pytest.mark.integration, pytest.mark.asyncio(loop_scope="session")]


async def test_checkout_status_uses_owned_exact_ledger_and_does_not_mutate(monkeypatch):
    async with AsyncSessionLocal() as db:
        users = [User(email=f"status-{uuid.uuid4().hex}@example.com", plan="free") for _ in range(2)]
        db.add_all(users)
        await db.flush()
        owner, other = users
        reference = "pi_" + uuid.uuid4().hex
        # Same reference owned by someone else, and an unrelated owner grant.
        db.add_all([
            CreditLedger(user_id=other.id, delta=500, balance_after=500, reason="purchase", ref_type="stripe_payment", ref_id=reference),
            CreditLedger(user_id=owner.id, delta=500, balance_after=500, reason="purchase", ref_type="stripe_payment", ref_id=reference + "other"),
        ])
        await db.commit()
        user_ids = [user.id for user in users]
    session = {"client_reference_id": str(owner.id), "status": "complete", "payment_status": "paid", "mode": "payment", "payment_intent": reference}
    monkeypatch.setattr(billing.stripe.checkout.Session, "retrieve", lambda _: session)
    app = FastAPI()
    app.include_router(billing.router)

    async def connection():
        async with AsyncSessionLocal() as db:
            yield db

    app.dependency_overrides[get_db_session] = connection
    app.dependency_overrides[require_auth] = lambda: owner
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            endpoint = "/api/billing/checkout-status?session_id=cs_fixture"
            result = await client.get(endpoint)
            assert result.json() == {"status": "processing"}
            assert result.headers["Cache-Control"] == "private, no-store"
            async with AsyncSessionLocal() as db:
                assert await db.scalar(select(func.count()).select_from(CreditLedger).where(CreditLedger.user_id.in_(user_ids))) == 2
                grant = CreditLedger(user_id=owner.id, delta=500, balance_after=1000, reason="purchase", ref_type="stripe_payment", ref_id=reference)
                db.add(grant)
                await db.commit()
            assert (await client.get(endpoint)).json() == {"status": "complete"}
            app.dependency_overrides[require_auth] = lambda: other
            assert (await client.get(endpoint)).status_code == 404
            app.dependency_overrides.pop(require_auth)
            assert (await client.get(endpoint)).status_code == 401
            app.dependency_overrides[require_auth] = lambda: owner
            assert (await client.get("/api/billing/checkout-status?session_id=invalid")).status_code == 422
            async with AsyncSessionLocal() as db:
                assert await db.scalar(select(func.count()).select_from(CreditLedger).where(CreditLedger.user_id.in_(user_ids))) == 3
    finally:
        async with AsyncSessionLocal() as db:
            await db.execute(delete(User).where(User.id.in_(user_ids)))
            await db.commit()


async def test_subscription_status_requires_both_checkout_and_invoice_commit(monkeypatch):
    async with AsyncSessionLocal() as db:
        user = User(email=f"status-{uuid.uuid4().hex}@example.com", plan="free")
        db.add(user)
        await db.flush()
        session_id, invoice_id = "cs_" + uuid.uuid4().hex, "in_" + uuid.uuid4().hex
        attempt = CheckoutAttempt(user_id=user.id, idempotency_key=uuid.uuid4().hex, plan="plus", billing_period="annual", stripe_session_id=session_id, status="open")
        db.add(attempt)
        db.add(CreditLedger(user_id=user.id, delta=3000, balance_after=3300, reason="subscription", ref_type="stripe_invoice", ref_id=invoice_id))
        await db.commit()
        user_id, attempt_id = user.id, attempt.id
    monkeypatch.setattr(billing.stripe.checkout.Session, "retrieve", lambda _: {
        "client_reference_id": str(user_id), "status": "complete", "payment_status": "paid", "mode": "subscription", "invoice": invoice_id, "subscription": "sub_fixture"})
    from fastapi import Response
    try:
        async with AsyncSessionLocal() as db:
            assert await billing.checkout_status(Response(), session_id, user, db) == {"status": "processing"}
            saved = await db.get(CheckoutAttempt, attempt_id)
            saved.status = "complete"
            await db.commit()
            assert await billing.checkout_status(Response(), session_id, user, db) == {"status": "complete"}
    finally:
        async with AsyncSessionLocal() as db:
            await db.execute(delete(User).where(User.id == user_id))
            await db.commit()


async def test_checkout_locks_refresh_auth_identity_map_after_webhook_commit():
    import asyncio
    async with AsyncSessionLocal() as db:
        user=User(email=f'lock-refresh-{uuid.uuid4().hex}@example.com',plan='free',stripe_subscription_id='pending')
        db.add(user)
        await db.flush()
        attempt=CheckoutAttempt(user_id=user.id,idempotency_key=uuid.uuid4().hex,plan='plus',billing_period='monthly',status='open')
        db.add(attempt)
        await db.commit()
        user_id,attempt_id=user.id,attempt.id
    try:
        async with AsyncSessionLocal() as writer, AsyncSessionLocal() as request:
            remote=await billing._lock_user(writer,user_id)
            remote_attempt=await writer.get(CheckoutAttempt,attempt_id)
            remote.stripe_subscription_id='sub_webhook_winner'
            remote.plan='plus'
            remote_attempt.status='complete'
            await writer.flush()
            # Auth and the earlier attempt read see the old committed values.
            cached=await request.get(User,user_id)
            cached_attempt=await request.get(CheckoutAttempt,attempt_id)
            assert cached.stripe_subscription_id=='pending' and cached_attempt.status=='open'
            waiting=asyncio.create_task(billing._lock_checkout_state(request,user_id,attempt_id))
            await asyncio.sleep(0.02)
            assert not waiting.done()
            await writer.commit()
            locked,locked_attempt=await waiting
            assert locked is cached and locked_attempt is cached_attempt
            assert locked.stripe_subscription_id=='sub_webhook_winner' and locked.plan=='plus'
            assert locked_attempt.status=='complete'
            await request.rollback()
    finally:
        async with AsyncSessionLocal() as db:
            await db.execute(delete(User).where(User.id==user_id))
            await db.commit()
