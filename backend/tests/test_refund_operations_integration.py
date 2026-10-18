"""Real isolated PostgreSQL refund saga with fault-injected provider."""

import asyncio
import copy
import uuid
from datetime import timedelta

import pytest
import pytest_asyncio
from sqlalchemy import delete, select

from app.core.config import settings
from app.models.database import AsyncSessionLocal
from app.models.tables import CheckoutAttempt, CreditLedger, RefundOperation, User
from app.services import refund_service as r
from app.services.credit_service import debit_credits

pytestmark = [pytest.mark.integration, pytest.mark.asyncio(loop_scope="session")]


class Provider:
    def __init__(self, facts):
        self.mode, self.account_id = "sandbox", "acct_fixture"
        self.data, self.rows = facts, []
        self.creates = self.cancels = 0
        self.timeout = self.cancel_failure = False
        self.result = "succeeded"

    def facts(self, invoice):
        assert invoice == self.data["invoice"]["id"]
        return copy.deepcopy(self.data)

    def refunds(self, charge):
        return copy.deepcopy(self.rows)

    def create(self, op):
        self.creates += 1
        row = dict(
            id="re_" + op["id"],
            charge=op["charge_id"],
            amount=op["amount_minor"],
            currency="usd",
            payment_intent=op["payment_intent_id"],
            customer=None,
            status=self.result,
            metadata={"doctalk_refund_operation": op["id"]},
        )
        self.rows.append(row)
        if self.timeout:
            self.timeout = False
            raise TimeoutError("cash succeeded but response lost")
        return copy.deepcopy(row)

    def cancel(self, sub, oid):
        self.cancels += 1
        if self.cancel_failure:
            raise RuntimeError("cancel unavailable")
        self.data["subscription"]["status"] = "canceled"


@pytest_asyncio.fixture(loop_scope="session")
async def purchase(monkeypatch):
    monkeypatch.setattr(settings, "AUTO_REFUND_MODE", "sandbox")
    monkeypatch.setattr(settings, "AUTO_REFUND_EXPECTED_ACCOUNT_ID", "acct_fixture")
    monkeypatch.setattr(settings, "AUTO_REFUND_ENABLED", True)
    monkeypatch.setattr(settings, "AUTO_REFUND_PROVIDER_CREATES_ENABLED", True)
    monkeypatch.setattr(settings, "STRIPE_SECRET_KEY", "sk_test_fixture")
    monkeypatch.setattr(settings, "STRIPE_PRICE_PLUS_MONTHLY", "price_fixture")
    uid = uuid.uuid4()
    suffix = uid.hex
    now = r.now_utc()
    customer, invoice, sub = "cus_" + suffix, "in_" + suffix, "sub_" + suffix
    async with AsyncSessionLocal() as db:
        db.add(
            User(
                id=uid,
                email=suffix + "@example.invalid",
                plan="plus",
                stripe_customer_id=customer,
                stripe_subscription_id=sub,
                credits_balance=3250,
                credit_debit_version=1,
            )
        )
        await db.flush()
        db.add_all(
            [
                CreditLedger(
                    user_id=uid, delta=300, balance_after=300, reason="signup_bonus"
                ),
                CreditLedger(
                    user_id=uid,
                    delta=-50,
                    balance_after=250,
                    reason="chat",
                    reconciled_at=now,
                ),
                CreditLedger(
                    user_id=uid,
                    delta=3000,
                    balance_after=3250,
                    reason="monthly_allowance",
                    ref_type="stripe_invoice",
                    ref_id=invoice,
                ),
                CheckoutAttempt(
                    user_id=uid,
                    plan="plus",
                    billing_period="monthly",
                    status="complete",
                    idempotency_key=suffix,
                    refund_provider_mode="sandbox",
                    refund_provider_account_id="acct_fixture",
                    refund_policy_version=r.POLICY,
                    refund_policy_enrolled_at=now - timedelta(hours=1),
                    refund_debit_baseline=1,
                    refund_invoice_id=invoice,
                    refund_subscription_id=sub,
                    refund_price_id="price_fixture",
                    refund_grant_credits=3000,
                ),
            ]
        )
        await db.commit()
    common = {"customer": customer, "livemode": False}
    facts = {
        "invoice": dict(
            common,
            id=invoice,
            status="paid",
            billing_reason="subscription_create",
            amount_paid=100,
            currency="usd",
            status_transitions={"paid_at": int(now.timestamp())},
        ),
        "subscription": dict(common, id=sub, status="active"),
        "intent": dict(common, id="pi_" + suffix, status="succeeded"),
        "charge": dict(
            common,
            id="ch_" + suffix,
            paid=True,
            amount=100,
            currency="usd",
            amount_refunded=0,
        ),
        "price": {
            "id": "price_fixture",
            "livemode": False,
            "recurring": {"interval": "month", "interval_count": 1},
        },
    }
    try:
        yield uid, invoice, Provider(facts)
    finally:
        async with AsyncSessionLocal() as db:
            await db.execute(
                delete(RefundOperation).where(RefundOperation.user_id == uid)
            )
            await db.execute(delete(User).where(User.id == uid))
            await db.commit()


async def reserve(p):
    async with AsyncSessionLocal() as db:
        op = await r.request_refund(db, p[0], p[1], "commercial", provider=p[2])
        assert op.status == "eligible"
        oid = op.id
        op = await r.confirm_refund(db, p[0], oid, provider=p[2])
        assert op.status == "reserved"
        return oid


async def state(p, oid):
    async with AsyncSessionLocal() as db:
        op = await db.get(RefundOperation, oid)
        u = await db.get(User, p[0])
        return op.status, op.cash_status, u.credits_balance, u.refund_reserved_credits


async def test_free_trial_before_purchase_preserved_and_concurrent_worker_is_once(
    purchase,
):
    oid = await reserve(purchase)
    async with AsyncSessionLocal() as db:
        from fastapi import HTTPException

        with pytest.raises(HTTPException) as exc:
            await debit_credits(db, purchase[0], 1, "chat")
        assert exc.value.status_code == 409
        await db.rollback()
    await asyncio.gather(
        *(r.process_operation(AsyncSessionLocal, oid, purchase[2]) for _ in range(2))
    )
    assert await state(purchase, oid) == ("completed", "succeeded", 250, 0)
    assert purchase[2].creates == 1
    async with AsyncSessionLocal() as db:
        user = await db.get(User, purchase[0])
        assert user.plan == "free" and user.stripe_subscription_id is None
        assert (
            len(
                (
                    await db.scalars(
                        select(CreditLedger).where(
                            CreditLedger.user_id == user.id,
                            CreditLedger.ref_type == "cash_refund",
                        )
                    )
                ).all()
            )
            == 1
        )
        assert await r.refunded_subscription(
            db, user.id, purchase[2].data["subscription"]["id"]
        )


@pytest.mark.parametrize("fault", ["timeout", "cancel"])
async def test_cash_success_response_loss_and_cancel_failure_recover_without_second_refund(
    purchase, fault
):
    oid = await reserve(purchase)
    p = purchase[2]
    p.timeout = fault == "timeout"
    p.cancel_failure = fault == "cancel"
    await r.process_operation(AsyncSessionLocal, oid, p)
    assert (await state(purchase, oid))[0] in {"cash_unknown", "repair_required"}
    assert (await state(purchase, oid))[2:] == (3250, 3000)
    p.cancel_failure = False
    await r.process_operation(AsyncSessionLocal, oid, p)
    assert (
        await state(purchase, oid) == ("completed", "succeeded", 250, 0)
        and p.creates == 1
    )


@pytest.mark.parametrize("result", ["pending", "failed", "canceled"])
async def test_pending_failed_no_cancellation_no_credit_revocation(purchase, result):
    oid = await reserve(purchase)
    p = purchase[2]
    p.result = result
    await r.process_operation(AsyncSessionLocal, oid, p)
    s = await state(purchase, oid)
    assert s[2] == 3250 and p.cancels == 0
    assert s[3] == (3000 if result == "pending" else 0)
    if result == "pending":
        p.rows[0]["status"] = "succeeded"
        await r.process_operation(AsyncSessionLocal, oid, p)
        assert await state(purchase, oid) == ("completed", "succeeded", 250, 0)


async def test_post_success_real_provider_failure_is_manual_not_second_cash_refund(
    purchase,
):
    oid = await reserve(purchase)
    p = purchase[2]
    await r.process_operation(AsyncSessionLocal, oid, p)
    p.rows[0]["status"] = "failed"
    async with AsyncSessionLocal() as db:
        await r.wake_refund(db, p.rows[0])
    await r.process_operation(AsyncSessionLocal, oid, p)
    assert (
        await state(purchase, oid) == ("cash_reversed", "failed", 250, 0)
        and p.creates == 1
    )


@pytest.mark.parametrize(
    "change,expected",
    [
        ("usage", "usage_after_payment"),
        ("old", "not_future_policy_enrolled"),
        ("annual", "not_supported_monthly_price"),
        ("renewal", "not_initial_paid_invoice"),
        ("partial", "refund_dispute_or_credit_note"),
        ("dispute", "refund_dispute_or_credit_note"),
        ("statutory", "manual_statutory"),
        ("grant", "complex_funding"),
    ],
)
async def test_noauto_is_manual_review(purchase, change, expected):
    uid, invoice, p = purchase
    async with AsyncSessionLocal() as db:
        if change == "usage":
            (await db.get(User, uid)).credit_debit_version += 1
        if change == "old":
            (
                await db.scalar(
                    select(CheckoutAttempt).where(CheckoutAttempt.user_id == uid)
                )
            ).refund_policy_version = None
        if change == "grant":
            db.add(
                CreditLedger(user_id=uid, delta=1, balance_after=3251, reason="admin")
            )
        await db.commit()
        if change == "annual":
            p.data["price"]["recurring"]["interval"] = "year"
        if change == "renewal":
            p.data["invoice"]["billing_reason"] = "subscription_cycle"
        if change == "partial":
            p.data["charge"]["amount_refunded"] = 1
        if change == "dispute":
            p.data["charge"]["disputed"] = True
        op = await r.request_refund(
            db,
            uid,
            invoice,
            "statutory" if change == "statutory" else "commercial",
            provider=p,
        )
        assert op.status == "review" and op.review_reason == expected and p.creates == 0


async def test_unknown_beyond_24h_does_not_blind_create(purchase):
    oid = await reserve(purchase)
    p = purchase[2]
    async with AsyncSessionLocal() as db:
        op = await db.get(RefundOperation, oid)
        op.status = "cash_unknown"
        op.first_submitted_at = r.now_utc() - timedelta(hours=25)
        await db.commit()
    await r.process_operation(AsyncSessionLocal, oid, p)
    assert (await state(purchase, oid))[0] == "manual_unknown" and p.creates == 0


async def test_lease_takeover_stops_old_worker_before_cancel(purchase):
    import psycopg

    from app.core.config import settings

    oid = await reserve(purchase)
    provider = purchase[2]
    # Pretend cash was created by an earlier delivery, then transfer lease
    # during the old worker's read-only provider lookup.
    async with AsyncSessionLocal() as db:
        op = await db.get(RefundOperation, oid)
        data = {c.name: getattr(op, c.name) for c in RefundOperation.__table__.columns}
        data["id"] = str(op.id)
    provider.create(data)
    original = provider.refunds

    def stolen(charge):
        with psycopg.connect(settings.DATABASE_URL.replace("+asyncpg", "")) as conn:
            conn.execute(
                "UPDATE refund_operations SET lease_token='new-owner' WHERE id=%s",
                (oid,),
            )
        return original(charge)

    provider.refunds = stolen
    await r.process_operation(AsyncSessionLocal, oid, provider)
    assert provider.cancels == 0
    assert (await state(purchase, oid))[2:] == (3250, 3000)


async def test_duplicate_confirm_reserves_once_and_inflight_usage_goes_review(purchase):
    uid, invoice, provider = purchase
    async with AsyncSessionLocal() as db:
        op = await r.request_refund(db, uid, invoice, "commercial", provider=provider)
        oid = op.id

    async def confirm():
        async with AsyncSessionLocal() as db:
            await r.confirm_refund(db, uid, oid, provider=provider)

    await asyncio.gather(confirm(), confirm())
    assert (await state(purchase, oid))[3] == 3000


async def test_first_invoice_baseline_captures_current_epoch_without_replay_reset(
    purchase,
):
    from types import SimpleNamespace

    uid, invoice, provider = purchase
    async with AsyncSessionLocal() as db:
        user = await r.lock_user(db, uid)
        attempt = await db.scalar(
            select(CheckoutAttempt).where(CheckoutAttempt.user_id == uid)
        )
        attempt.refund_debit_baseline = None
        metadata = {"checkout_attempt_id": str(attempt.id)}
        inv = {
            "livemode": False,
            "id": invoice,
            "billing_reason": "subscription_create",
            "parent": {"subscription_details": {"metadata": metadata}},
        }
        contract = SimpleNamespace(
            interval="monthly",
            subscription_id=provider.data["subscription"]["id"],
            plan="plus",
        )
        await r.capture_baseline(db, user, inv, contract, 3000)
        assert attempt.refund_debit_baseline == 1
        user.credit_debit_version = 2
        await r.capture_baseline(db, user, inv, contract, 3000)
        assert attempt.refund_debit_baseline == 1
        await db.rollback()


async def test_failed_refund_duplicate_webhook_does_not_reactivate_or_reserve(purchase):
    oid = await reserve(purchase)
    provider = purchase[2]
    provider.result = "failed"
    await r.process_operation(AsyncSessionLocal, oid, provider)
    assert await state(purchase, oid) == ("cash_failed", "failed", 3250, 0)
    async with AsyncSessionLocal() as db:
        await r.wake_refund(db, provider.rows[0])
    await r.process_operation(AsyncSessionLocal, oid, provider)
    assert await state(purchase, oid) == ("cash_failed", "failed", 3250, 0)
    assert provider.creates == 1 and provider.cancels == 0


async def test_unknown_cash_with_invisible_refund_but_refunded_charge_keeps_reservation(
    purchase,
):
    oid = await reserve(purchase)
    provider = purchase[2]
    async with AsyncSessionLocal() as db:
        op = await db.get(RefundOperation, oid)
        op.status = "cash_unknown"
        op.first_submitted_at = r.now_utc() - timedelta(minutes=1)
        await db.commit()
    provider.data["charge"]["amount_refunded"] = 100
    assert provider.rows == []  # Provider list temporarily lacks the accepted refund.
    await r.process_operation(AsyncSessionLocal, oid, provider)
    assert await state(purchase, oid) == ("manual_unknown", None, 3250, 3000)
    assert provider.creates == 0 and provider.cancels == 0


async def test_old_completed_refund_callback_bypasses_periodic_audit_window(
    purchase, monkeypatch
):
    from app.workers import refund_worker

    oid = await reserve(purchase)
    provider = purchase[2]
    await r.process_operation(AsyncSessionLocal, oid, provider)
    async with AsyncSessionLocal() as db:
        op = await db.get(RefundOperation, oid)
        op.requested_at = r.now_utc() - timedelta(days=60)
        op.first_submitted_at = r.now_utc() - timedelta(days=45)
        await db.commit()
    provider.rows[0]["status"] = "failed"
    async with AsyncSessionLocal() as db:
        await r.wake_refund(db, provider.rows[0])
    monkeypatch.setattr(r, "Provider", lambda: provider)
    assert await refund_worker.recover(settings.DATABASE_URL) >= 1
    assert (await state(purchase, oid))[0] == "cash_reversed"


async def test_refund_explicit_live_mode_is_rejected_even_in_test_key_namespace(
    purchase,
):
    oid = await reserve(purchase)
    provider = purchase[2]
    async with AsyncSessionLocal() as db:
        op = await db.get(RefundOperation, oid)
        data = {c.name: getattr(op, c.name) for c in RefundOperation.__table__.columns}
        data["id"] = str(op.id)
    provider.create(data)
    assert "livemode" not in provider.rows[0]
    provider.rows[0]["livemode"] = True
    await r.process_operation(AsyncSessionLocal, oid, provider)
    assert (await state(purchase, oid))[0] == "manual_unknown"
    assert provider.cancels == 0


async def test_clover_missing_refund_mode_callback_and_completed_audit(purchase):
    oid = await reserve(purchase)
    provider = purchase[2]
    provider.result = "pending"
    await r.process_operation(AsyncSessionLocal, oid, provider)
    assert "livemode" not in provider.rows[0]
    assert (await state(purchase, oid))[0] == "cash_pending"
    provider.rows[0]["status"] = "succeeded"
    async with AsyncSessionLocal() as db:
        await r.wake_refund(db, provider.rows[0])
    await r.process_operation(AsyncSessionLocal, oid, provider)
    assert await state(purchase, oid) == ("completed", "succeeded", 250, 0)
    await r.process_operation(AsyncSessionLocal, oid, provider)
    assert (await state(purchase, oid))[0] == "completed"
    provider.rows[0]["status"] = "failed"
    async with AsyncSessionLocal() as db:
        await r.wake_refund(db, provider.rows[0])
    await r.process_operation(AsyncSessionLocal, oid, provider)
    assert await state(purchase, oid) == ("cash_reversed", "failed", 250, 0)
    assert provider.creates == 1


@pytest.mark.parametrize(
    "field,value", [("customer", "cus_wrong"), ("payment_intent", "pi_wrong")]
)
async def test_refund_optional_identity_if_present_cannot_conflict(
    purchase, field, value
):
    oid = await reserve(purchase)
    provider = purchase[2]
    async with AsyncSessionLocal() as db:
        op = await db.get(RefundOperation, oid)
        data = {c.name: getattr(op, c.name) for c in RefundOperation.__table__.columns}
        data["id"] = str(op.id)
    provider.create(data)
    provider.rows[0][field] = value
    await r.process_operation(AsyncSessionLocal, oid, provider)
    assert (await state(purchase, oid))[0] == "manual_unknown"
    assert provider.cancels == 0


async def use_mock_live_purchase(purchase, monkeypatch):
    """Convert isolated test facts only. Never calls a real live provider."""
    monkeypatch.setattr(settings, "AUTO_REFUND_LIVE_USER_IDS", [str(purchase[0])])
    monkeypatch.setattr(settings, "AUTO_REFUND_MODE", "live")
    monkeypatch.setattr(settings, "STRIPE_SECRET_KEY", "sk_live_dummy_never_sent")
    monkeypatch.setattr(settings, "AUTO_REFUND_EXPECTED_ACCOUNT_ID", "acct_mock_live")
    purchase[2].mode, purchase[2].account_id = "live", "acct_mock_live"
    for obj in purchase[2].data.values():
        obj["livemode"] = True
    async with AsyncSessionLocal() as db:
        attempt = await db.scalar(select(CheckoutAttempt).where(CheckoutAttempt.user_id == purchase[0]))
        attempt.refund_provider_mode, attempt.refund_provider_account_id = "live", "acct_mock_live"
        await db.commit()


async def test_mock_live_saga_and_off_switch_existing_cash_converges(purchase, monkeypatch):
    await use_mock_live_purchase(purchase, monkeypatch)
    oid = await reserve(purchase)
    purchase[2].timeout = True
    assert not await r.process_operation(AsyncSessionLocal, oid, provider=purchase[2])
    assert purchase[2].creates == 1
    monkeypatch.setattr(settings, "AUTO_REFUND_LIVE_USER_IDS", [])
    monkeypatch.setattr(settings, "AUTO_REFUND_ENABLED", False)
    monkeypatch.setattr(settings, "AUTO_REFUND_PROVIDER_CREATES_ENABLED", False)
    assert await r.process_operation(AsyncSessionLocal, oid, provider=purchase[2])
    assert purchase[2].creates == 1 and purchase[2].cancels == 1
    async with AsyncSessionLocal() as db:
        op = await db.get(RefundOperation, oid)
        assert (op.status, op.provider_mode, op.provider_account_id) == ("completed", "live", "acct_mock_live")
        assert (await db.get(User, purchase[0])).credits_balance == 250


@pytest.mark.parametrize("field,value", [("provider_mode", None), ("provider_mode", "live"), ("provider_account_id", "acct_wrong")])
async def test_persisted_environment_mismatch_blocks_worker_without_provider_reads(purchase, monkeypatch, field, value):
    oid = await reserve(purchase)
    async with AsyncSessionLocal() as db:
        op = await db.get(RefundOperation, oid)
        setattr(op, field, value)
        await db.commit()
    def forbidden(*args):
        raise AssertionError("no provider reads for unbound operation")
    monkeypatch.setattr(purchase[2], "refunds", forbidden)
    assert not await r.process_operation(AsyncSessionLocal, oid, provider=purchase[2])
    assert purchase[2].creates == purchase[2].cancels == 0
    async with AsyncSessionLocal() as db:
        assert (await db.get(RefundOperation, oid)).status == "reserved"
        assert (await db.get(User, purchase[0])).refund_reserved_credits == 3000


async def test_completed_audit_failure_backs_off_without_changing_cash(purchase, monkeypatch):
    oid = await reserve(purchase)
    assert await r.process_operation(AsyncSessionLocal, oid, provider=purchase[2])
    def unavailable(*args):
        raise TimeoutError("provider unavailable")
    monkeypatch.setattr(purchase[2], "facts", unavailable)
    now = r.now_utc()
    assert not await r.audit_completed(AsyncSessionLocal, oid, purchase[2], now)
    async with AsyncSessionLocal() as db:
        op = await db.get(RefundOperation, oid)
        assert (op.status, op.cash_status) == ("completed", "succeeded")
        assert op.next_retry_at == now + timedelta(minutes=5)
        assert op.last_error == "audit_TimeoutError"


async def test_live_scope_removed_before_cash_never_posts(purchase, monkeypatch):
    await use_mock_live_purchase(purchase, monkeypatch)
    oid = await reserve(purchase)
    monkeypatch.setattr(settings, "AUTO_REFUND_LIVE_USER_IDS", [])
    assert not await r.process_operation(AsyncSessionLocal, oid, provider=purchase[2])
    assert purchase[2].creates == purchase[2].cancels == 0
    assert (await state(purchase, oid))[3] == 3000


async def test_unenrolled_environment_identity_cannot_auto_qualify(purchase):
    async with AsyncSessionLocal() as db:
        attempt = await db.scalar(select(CheckoutAttempt).where(CheckoutAttempt.user_id == purchase[0]))
        attempt.refund_provider_mode = attempt.refund_provider_account_id = None
        await db.commit()
        op = await r.request_refund(db, purchase[0], purchase[1], "commercial", provider=purchase[2])
        assert op.status == "review" and op.review_reason == "not_future_policy_enrolled"
    assert purchase[2].creates == purchase[2].cancels == 0


async def test_runnable_precedes_more_than_one_page_of_completed_audits(purchase, monkeypatch):
    from app.workers import refund_worker
    oid = await reserve(purchase)
    async with AsyncSessionLocal() as db:
        for n in range(101):
            unique = uuid.uuid4().hex
            db.add(RefundOperation(user_id=purchase[0], invoice_id="in_audit_"+unique, policy_version=r.POLICY, request_kind="commercial", status="completed", provider_mode="sandbox", provider_account_id="acct_fixture", idempotency_key=unique, first_submitted_at=r.now_utc()))
        await db.commit()
    visited = []
    async def record(factory, operation):
        visited.append(operation)
    monkeypatch.setattr(refund_worker, "process_operation", record)
    assert await refund_worker.recover(settings.DATABASE_URL) == 100
    assert visited[0] == oid
