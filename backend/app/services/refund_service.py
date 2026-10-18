"""Explicitly confirmed, future-enrolled refunds with durable recovery.

All database mutations lock user then operation. Provider calls happen only
outside those transactions. No document locks or predebit settlement changes.
"""

from __future__ import annotations

import asyncio
import uuid
from datetime import datetime, timedelta, timezone

import sqlalchemy as sa
import stripe
from fastapi import HTTPException

from app.core.config import settings
from app.models.tables import (
    CheckoutAttempt,
    CreditLedger,
    Document,
    DocumentJob,
    RefundOperation,
    User,
)

POLICY = "monthly-zero-use-v1"
ACTIVE = {
    "reserved",
    "submitting",
    "cash_unknown",
    "cash_pending",
    "cash_succeeded",
    "repair_required",
    "manual_unknown",
    "cash_reversed",
}
RUNNABLE = ACTIVE - {"manual_unknown", "cash_reversed"}


def now_utc():
    return datetime.now(timezone.utc)


def configured_identity():
    """No inferred environment/account and no restricted or global SDK keys."""
    mode = settings.AUTO_REFUND_MODE
    account = settings.AUTO_REFUND_EXPECTED_ACCOUNT_ID
    key = settings.STRIPE_SECRET_KEY or ""
    if mode not in {"sandbox", "live"} or not account or not account.startswith("acct_"):
        return None
    if not key.startswith("sk_test_" if mode == "sandbox" else "sk_live_"):
        return None
    return mode, account


def sandbox_enabled():
    # Retained name for existing callers; enablement is now explicitly mode-bound.
    return bool(settings.AUTO_REFUND_ENABLED and configured_identity())


def operation_identity(data):
    return data.get("provider_mode"), data.get("provider_account_id")


def matches_environment(data):
    identity = configured_identity()
    return identity is not None and operation_identity(data) == identity


def provider_matches(provider, data):
    return matches_environment(data) and (
        getattr(provider, "mode", None), getattr(provider, "account_id", None)
    ) == operation_identity(data)


def user_in_scope(user_id):
    if settings.AUTO_REFUND_MODE != "live":
        return True
    scope = settings.AUTO_REFUND_LIVE_USER_IDS
    return "*" in scope or (user_id is not None and str(user_id) in scope)


def enrollment(now=None, user_id=None):
    now = now or now_utc()
    if (
        not sandbox_enabled()
        or not user_in_scope(user_id)
        or settings.AUTO_REFUND_POLICY_VERSION != POLICY
        or not settings.AUTO_REFUND_POLICY_START_AT
    ):
        return {}
    try:
        start = datetime.fromisoformat(
            settings.AUTO_REFUND_POLICY_START_AT.replace("Z", "+00:00")
        )
        if start.tzinfo is None or now < start:
            return {}
    except ValueError:
        return {}
    return {
        "refund_policy_version": POLICY, "refund_policy_enrolled_at": now,
        "refund_provider_mode": configured_identity()[0],
        "refund_provider_account_id": configured_identity()[1],
    }


def sid(value):
    return value.get("id") if isinstance(value, dict) else value


class Provider:
    """Pinned client, explicit mode and exact current-account attestation."""

    def __init__(self):
        key = settings.STRIPE_SECRET_KEY or ""
        identity = configured_identity()
        if identity is None:
            raise ValueError("refund_environment_unconfigured")
        self.mode, self.account_id = identity
        self.attested = False
        self.client = stripe.StripeClient(
            key,
            stripe_version="2026-01-28.clover",
            http_client=stripe.RequestsClient(timeout=10),
            max_network_retries=0,
        ).v1

    def attest(self):
        if configured_identity() != (self.mode, self.account_id):
            raise ValueError("refund_environment_changed")
        # Invoked inside the caller's to_thread, never on the API event loop.
        if not self.attested:
            account = self.client.accounts.retrieve_current()
            if account.get("id") != self.account_id:
                raise ValueError("refund_provider_account_mismatch")
            self.attested = True

    def pages(self, service, params):
        rows = []
        for _ in range(10):
            page = service.list(params)
            data = page.get("data") or []
            rows.extend(data)
            if not page.get("has_more"):
                return rows
            if not data or not data[-1].get("id"):
                raise ValueError("provider_pagination_unresolved")
            params = {**params, "starting_after": data[-1]["id"]}
        raise ValueError("provider_pagination_limit")

    def facts(self, invoice_id):
        self.attest()
        invoice = self.client.invoices.retrieve(invoice_id)
        parent = invoice.get("parent") or {}
        sub_id = sid(invoice.get("subscription")) or sid(
            (parent.get("subscription_details") or {}).get("subscription")
        )
        sub = self.client.subscriptions.retrieve(sub_id) if sub_id else {}
        # Only a single successful PaymentIntent-backed payment is supported.
        pi_id = sid(invoice.get("payment_intent"))
        if not pi_id:
            payments = self.pages(
                self.client.invoice_payments, {"invoice": invoice_id, "limit": 100}
            )
            paid = [p for p in payments if p.get("status") == "paid"]
            if len(paid) == 1:
                pi_id = sid((paid[0].get("payment") or {}).get("payment_intent"))
        intent = self.client.payment_intents.retrieve(pi_id) if pi_id else {}
        charge_id = sid(intent.get("latest_charge"))
        charge = self.client.charges.retrieve(charge_id) if charge_id else {}
        items = (sub.get("items") or {}).get("data") or []
        price = items[0].get("price") if len(items) == 1 else {}
        if isinstance(price, str):
            price = self.client.prices.retrieve(price)
        return {
            "invoice": dict(invoice),
            "subscription": dict(sub),
            "intent": dict(intent),
            "charge": dict(charge),
            "price": dict(price or {}),
        }

    def refunds(self, charge_id):
        self.attest()
        return [
            dict(x)
            for x in self.pages(
                self.client.refunds, {"charge": charge_id, "limit": 100}
            )
        ]

    def create(self, op):
        self.attest()
        if not user_in_scope(op.get("user_id")):
            raise ValueError("refund_live_user_out_of_scope")
        if not provider_matches(self, op):
            raise ValueError("refund_operation_environment_mismatch")
        if not sandbox_enabled() or not settings.AUTO_REFUND_PROVIDER_CREATES_ENABLED:
            raise ValueError("refund_provider_creates_disabled")
        return dict(
            self.client.refunds.create(
                {
                    "charge": op["charge_id"],
                    "amount": op["amount_minor"],
                    "metadata": {"doctalk_refund_operation": op["id"]},
                },
                options={"idempotency_key": op["idempotency_key"]},
            )
        )

    def cancel(self, sub_id, operation_id):
        self.attest()
        sub = self.client.subscriptions.retrieve(sub_id)
        if sub.get("status") != "canceled":
            sub = self.client.subscriptions.cancel(
                sub_id,
                options={"idempotency_key": f"doctalk:refund-cancel:{operation_id}"},
            )
        if sub.get("status") != "canceled":
            raise ValueError("subscription_cancel_unconfirmed")

    def options(self, customer):
        self.attest()
        return [
            dict(x)
            for x in self.client.invoices.list({"customer": customer, "limit": 10}).data
        ]


def refund_identity(refund, data):
    """Clover Refund has no livemode; provenance comes from its pinned charge chain."""
    return (
        (refund.get("livemode") is None or refund.get("livemode") is (data.get("provider_mode") == "live"))
        and sid(refund.get("charge")) == data["charge_id"]
        and refund.get("amount") == data["amount_minor"]
        and refund.get("currency") == data["currency"]
        and (refund.get("metadata") or {}).get("doctalk_refund_operation")
        == str(data["id"])
        and (
            refund.get("payment_intent") is None
            or sid(refund["payment_intent"]) == data["payment_intent_id"]
        )
        and (
            refund.get("customer") is None
            or sid(refund["customer"]) == data["customer_id"]
        )
    )


def payment_chain_identity(facts, data):
    """Confirm mode/ownership on actual objects that carry those provider facts."""
    invoice, sub, intent, charge = (
        facts[k] for k in ["invoice", "subscription", "intent", "charge"]
    )
    return (
        matches_environment(data)
        and all(obj.get("livemode") is (data.get("provider_mode") == "live") for obj in [invoice, sub, intent, charge])
        and all(
            sid(obj.get("customer")) == data["customer_id"]
            for obj in [invoice, sub, intent, charge]
        )
        and invoice.get("id") == data["invoice_id"]
        and sub.get("id") == data["subscription_id"]
        and intent.get("id") == data["payment_intent_id"]
        and charge.get("id") == data["charge_id"]
        and charge.get("amount") == data["amount_minor"]
        and charge.get("currency") == data["currency"]
    )


def provider_reason(f, customer, now):
    i, sub, pi, charge, price = (
        f[k] for k in ["invoice", "subscription", "intent", "charge", "price"]
    )
    if configured_identity() is None or any(
        obj.get("livemode") is not (settings.AUTO_REFUND_MODE == "live")
        for obj in [i, sub, pi, charge, price]
    ):
        return "provider_mode_provenance"
    if (
        sid(i.get("customer")) != customer
        or sid(sub.get("customer")) != customer
        or sid(pi.get("customer")) != customer
        or sid(charge.get("customer")) != customer
    ):
        return "ownership_unresolved"
    if (
        i.get("status") != "paid"
        or i.get("billing_reason") != "subscription_create"
        or i.get("paid_out_of_band")
    ):
        return "not_initial_paid_invoice"
    amount = i.get("amount_paid")
    if (
        isinstance(amount, bool)
        or not isinstance(amount, int)
        or not 0 < amount <= min(2500, settings.AUTO_REFUND_MAX_AMOUNT_MINOR)
        or i.get("currency") != "usd"
    ):
        return "amount_or_currency_review"
    if (
        pi.get("status") != "succeeded"
        or charge.get("paid") is not True
        or charge.get("amount") != amount
        or charge.get("currency") != "usd"
    ):
        return "payment_unresolved"
    if (
        charge.get("amount_refunded", 0)
        or charge.get("disputed")
        or i.get("post_payment_credit_notes_amount", 0)
    ):
        return "refund_dispute_or_credit_note"
    paid = (i.get("status_transitions") or {}).get("paid_at")
    if not isinstance(paid, int) or isinstance(paid, bool):
        return "paid_time_unknown"
    age = now - datetime.fromtimestamp(paid, timezone.utc)
    if age < timedelta(0) or age > timedelta(days=14):
        return "outside_commercial_window"
    recurring = price.get("recurring") or {}
    if (
        recurring.get("interval") != "month"
        or recurring.get("interval_count") != 1
        or price.get("id")
        not in {settings.STRIPE_PRICE_PLUS_MONTHLY, settings.STRIPE_PRICE_PRO_MONTHLY}
    ):
        return "not_supported_monthly_price"
    if sub.get("status") != "active":
        return "subscription_not_active"
    return None


async def lock_user(db, user_id):
    return await db.scalar(
        sa.select(User)
        .where(User.id == user_id)
        .with_for_update(key_share=True, of=User)
        .execution_options(populate_existing=True)
    )


async def active_operation(db, user_id):
    return await db.scalar(
        sa.select(RefundOperation.id)
        .where(RefundOperation.user_id == user_id, RefundOperation.status.in_(ACTIVE))
        .limit(1)
    )


async def assert_mutation_allowed(db, user_id):
    if await active_operation(db, user_id):
        raise HTTPException(
            409, "Refund processing; account changes are temporarily unavailable"
        )


async def capture_baseline(db, user, invoice, contract, allowance):
    """Called only inside the first invoice grant's existing user-lock transaction."""
    if (
        not sandbox_enabled()
        or contract.interval != "monthly"
        or invoice.get("billing_reason") != "subscription_create"
    ):
        return
    attempts = (
        await db.scalars(
            sa.select(CheckoutAttempt)
            .where(
                CheckoutAttempt.user_id == user.id,
                CheckoutAttempt.refund_policy_version == POLICY,
                CheckoutAttempt.billing_period == "monthly",
            )
            .with_for_update(of=CheckoutAttempt)
        )
    ).all()
    # Match via the provider's durable checkout attempt metadata, never timestamps.
    meta = (
        ((invoice.get("parent") or {}).get("subscription_details") or {}).get(
            "metadata"
        )
        or (invoice.get("subscription_details") or {}).get("metadata")
        or {}
    )
    attempt_id = meta.get("checkout_attempt_id")
    matching = [a for a in attempts if str(a.id) == attempt_id]
    if len(matching) != 1:
        return  # Unknown provenance stays manual, never backfill on webhook replay.
    attempt = matching[0]
    if (attempt.refund_provider_mode, attempt.refund_provider_account_id) != configured_identity():
        return
    if invoice.get("livemode") is not (settings.AUTO_REFUND_MODE == "live"):
        return
    if attempt.refund_debit_baseline is None:
        attempt.refund_debit_baseline = user.credit_debit_version
        attempt.refund_invoice_id = invoice["id"]
        attempt.refund_subscription_id = contract.subscription_id
        attempt.refund_price_id = (
            settings.STRIPE_PRICE_PLUS_MONTHLY
            if contract.plan == "plus"
            else settings.STRIPE_PRICE_PRO_MONTHLY
        )
        attempt.refund_grant_credits = allowance


async def eligibility(db, user, facts, requested_at, operation_id=None):
    if not sandbox_enabled():
        return "automatic_refunds_disabled", None
    if not user_in_scope(user.id):
        return "live_user_out_of_scope", None
    if user.refund_delete_requested_at is not None:
        return "account_deletion_in_progress", None
    reason = provider_reason(facts, user.stripe_customer_id, requested_at)
    if reason:
        return reason, None
    i, sub, price = facts["invoice"], facts["subscription"], facts["price"]
    attempt = await db.scalar(
        sa.select(CheckoutAttempt).where(
            CheckoutAttempt.user_id == user.id,
            CheckoutAttempt.refund_invoice_id == i["id"],
        )
    )
    if (
        not attempt
        or attempt.refund_policy_version != POLICY
        or attempt.refund_policy_enrolled_at is None
        or attempt.refund_debit_baseline is None
        or attempt.status != "complete"
        or (attempt.refund_provider_mode, attempt.refund_provider_account_id) != configured_identity()
    ):
        return "not_future_policy_enrolled", None
    if (
        attempt.refund_subscription_id != sub["id"]
        or user.stripe_subscription_id != sub["id"]
        or user.plan != attempt.plan
        or price["id"] != attempt.refund_price_id
    ):
        return "subscription_or_plan_changed", None
    if user.credit_debit_version != attempt.refund_debit_baseline:
        return "usage_after_payment", None
    rows = (
        await db.scalars(sa.select(CreditLedger).where(CreditLedger.user_id == user.id))
    ).all()
    grants = [r for r in rows if r.ref_type == "stripe_invoice" and r.ref_id == i["id"]]
    if (
        len(grants) != 1
        or grants[0].delta != attempt.refund_grant_credits
        or grants[0].delta <= 0
    ):
        return "grant_unresolved", None
    from app.services.legacy_settlement_service import attested_ledger_ids

    legacy_settled = await attested_ledger_ids(db, rows)
    for row in rows:
        if row.delta > 0 and row.id != grants[0].id and row.reason != "signup_bonus":
            return "complex_funding", None
        if row.delta < 0 and row.reconciled_at is None and row.id not in legacy_settled:
            return "inflight_predebit", None
    if await db.scalar(
        sa.select(Document.id)
        .where(
            Document.user_id == user.id,
            Document.status.in_(["parsing", "uploading", "processing"]),
        )
        .limit(1)
    ):
        return "inflight_document", None
    if await db.scalar(
        sa.select(DocumentJob.id)
        .where(
            DocumentJob.user_id == user.id,
            DocumentJob.status.in_(["queued", "running", "pending"]),
        )
        .limit(1)
    ):
        return "inflight_job", None
    if user.credits_balance < grants[0].delta:
        return "grant_balance_unresolved", None
    if user.refund_reserved_credits and operation_id is None:
        return "refund_already_processing", None
    recent = await db.scalar(
        sa.select(RefundOperation.id)
        .where(
            RefundOperation.user_id == user.id,
            RefundOperation.confirmed_at >= requested_at - timedelta(days=365),
            RefundOperation.status.notin_(["eligible", "review", "cash_failed"]),
            RefundOperation.id != operation_id if operation_id else sa.true(),
        )
        .limit(1)
    )
    if recent:
        return "commercial_frequency_review", None
    return None, attempt


def view(op):
    return {
        "id": str(op.id),
        "invoice_id": op.invoice_id,
        "status": op.status,
        "review_reason": op.review_reason,
        "amount_minor": op.amount_minor,
        "currency": op.currency,
        "credits_to_revoke": op.credits_to_revoke,
        "policy_version": op.policy_version,
        "confirmation_required": op.status == "eligible",
        "cash_status": op.cash_status,
        "consequences": {
            "ends_subscription_immediately": op.status == "eligible",
            "revokes_credits": op.credits_to_revoke,
        },
        "created_at": op.requested_at.isoformat(),
    }


async def request_refund(db, user_id, invoice_id, kind, reason=None, provider=None):
    if not sandbox_enabled() or not user_in_scope(user_id):
        raise HTTPException(503, "Automatic refund requests are disabled for this account")
    provider = provider or Provider()
    user = await db.get(User, user_id)
    try:
        facts = await asyncio.to_thread(provider.facts, invoice_id)
    except Exception as exc:
        raise HTTPException(503, "Payment evidence temporarily unavailable") from exc
    if sid(facts["invoice"].get("customer")) != user.stripe_customer_id:
        raise HTTPException(404, "Invoice not found")
    await db.rollback()  # End read transaction before claiming serialization lock.
    user = await lock_user(db, user_id)
    existing = await db.scalar(
        sa.select(RefundOperation).where(RefundOperation.invoice_id == invoice_id)
    )
    if existing:
        if existing.user_id != user_id:
            raise HTTPException(404, "Invoice not found")
        if kind != "commercial" and existing.status == "eligible":
            existing.status, existing.review_reason, existing.request_kind = (
                "review",
                "manual_" + kind,
                kind,
            )
            await db.commit()
        return existing
    requested = now_utc()
    if (getattr(provider, "mode", None), getattr(provider, "account_id", None)) != configured_identity():
        raise HTTPException(503, "Refund provider identity unavailable")
    why, attempt = await eligibility(db, user, facts, requested)
    if kind != "commercial":
        why = "manual_" + kind
    invoice, sub, charge, pi = (
        facts[k] for k in ["invoice", "subscription", "charge", "intent"]
    )
    oid = uuid.uuid4()
    paid = (invoice.get("status_transitions") or {}).get("paid_at")
    op = RefundOperation(
        id=oid,
        user_id=user_id,
        invoice_id=invoice_id,
        request_kind=kind,
        policy_version=POLICY,
        provider_mode=provider.mode,
        provider_account_id=provider.account_id,
        status="review" if why else "eligible",
        review_reason=why,
        subscription_id=sub.get("id"),
        customer_id=user.stripe_customer_id,
        charge_id=charge.get("id"),
        payment_intent_id=pi.get("id"),
        price_id=facts["price"].get("id"),
        plan=attempt.plan if attempt else None,
        amount_minor=invoice.get("amount_paid") or 0,
        currency=invoice.get("currency") or "usd",
        credits_to_revoke=attempt.refund_grant_credits if attempt and not why else 0,
        paid_at=datetime.fromtimestamp(paid, timezone.utc)
        if isinstance(paid, int)
        else None,
        requested_at=requested,
        idempotency_key=f"doctalk:refund:{oid}",
        evidence_json={"reason": reason, "debit_version": user.credit_debit_version},
    )
    db.add(op)
    await db.commit()
    return op


async def confirm_refund(db, user_id, operation_id, provider=None):
    op = await db.get(RefundOperation, operation_id)
    if not op or op.user_id != user_id:
        raise HTTPException(404, "Refund request not found")
    if op.status != "eligible":
        return op  # Repeated confirm cannot create a second execution.
    if not sandbox_enabled() or not user_in_scope(user_id) or not settings.AUTO_REFUND_PROVIDER_CREATES_ENABLED:
        raise HTTPException(503, "Automatic refund execution is disabled")
    provider = provider or Provider()
    identity = {c.name: getattr(op, c.name) for c in RefundOperation.__table__.columns}
    if not provider_matches(provider, identity):
        raise HTTPException(503, "Refund environment does not match this request")
    facts = await asyncio.to_thread(provider.facts, op.invoice_id)
    await db.rollback()
    user = await lock_user(db, user_id)
    op = await db.scalar(
        sa.select(RefundOperation)
        .where(RefundOperation.id == operation_id)
        .with_for_update(of=RefundOperation)
        .execution_options(populate_existing=True)
    )
    if op.status != "eligible":
        return op
    why, attempt = await eligibility(db, user, facts, op.requested_at, op.id)
    if why:
        op.status, op.review_reason = "review", why
    else:
        user.refund_reserved_credits = attempt.refund_grant_credits
        op.status, op.confirmed_at, op.next_retry_at = "reserved", now_utc(), now_utc()
        op.credits_to_revoke = attempt.refund_grant_credits
    await db.commit()
    return op


async def process_operation(factory, operation_id, provider=None, now=None):
    """One bounded saga pass. Durable scanner recovers lost tasks/expired leases."""
    now = now or now_utc()
    try:
        provider = provider or Provider()
    except ValueError:
        return False  # Explicit environment guard protects recovery, not only create.
    async with factory() as db:
        peek = await db.get(RefundOperation, operation_id)
        if not peek or not provider_matches(provider, {c.name: getattr(peek, c.name) for c in RefundOperation.__table__.columns}):
            return False
        audit_only = bool(peek.status == "completed")
    if audit_only:
        return await audit_completed(factory, operation_id, provider, now)
    async with factory() as db:
        peek = await db.get(RefundOperation, operation_id)
        if not peek or peek.status not in RUNNABLE or not peek.user_id:
            return False
        user = await lock_user(db, peek.user_id)
        op = await db.scalar(
            sa.select(RefundOperation)
            .where(RefundOperation.id == operation_id)
            .with_for_update(of=RefundOperation)
            .execution_options(populate_existing=True)
        )
        if op.status not in RUNNABLE:
            return False
        if op.lease_until and op.lease_until > now:
            return False
        token = uuid.uuid4().hex
        op.lease_token, op.lease_until = token, now + timedelta(minutes=10)
        data = {c.name: getattr(op, c.name) for c in RefundOperation.__table__.columns}
        data["id"] = str(op.id)
        await db.commit()

    async def save(**values):
        async with factory() as db:
            await lock_user(db, data["user_id"])
            op = await db.scalar(
                sa.select(RefundOperation)
                .where(RefundOperation.id == operation_id)
                .with_for_update(of=RefundOperation)
                .execution_options(populate_existing=True)
            )
            if op.lease_token != token:
                return False
            for name, value in values.items():
                setattr(op, name, value)
            await db.commit()
            return True

    async def release_review(reason):
        async with factory() as db:
            user = await lock_user(db, data["user_id"])
            op = await db.scalar(
                sa.select(RefundOperation)
                .where(RefundOperation.id == operation_id)
                .with_for_update(of=RefundOperation)
            )
            if op.lease_token != token:
                return
            if user.refund_reserved_credits != op.credits_to_revoke:
                raise ValueError("reservation_mismatch")
            user.refund_reserved_credits = 0
            op.status, op.review_reason = "review", reason
            op.lease_token = op.lease_until = None
            await db.commit()

    try:
        matches = [
            r
            for r in await asyncio.to_thread(provider.refunds, data["charge_id"])
            if (r.get("metadata") or {}).get("doctalk_refund_operation") == data["id"]
        ]
        if len(matches) > 1:
            await save(status="manual_unknown", last_error="multiple_provider_refunds")
            return False
        refund = matches[0] if matches else None
        if refund is None:
            if data["provider_refund_id"]:
                await save(
                    status="manual_unknown", last_error="recorded_refund_missing"
                )
                return False
            if data["first_submitted_at"] and now - data[
                "first_submitted_at"
            ] >= timedelta(hours=24):
                await save(
                    status="manual_unknown",
                    last_error="provider_idempotency_window_expired",
                )
                return False
            if (
                not sandbox_enabled()
                or not user_in_scope(data["user_id"])
                or not settings.AUTO_REFUND_PROVIDER_CREATES_ENABLED
            ):
                await save(next_retry_at=now + timedelta(minutes=5))
                return False
            facts = await asyncio.to_thread(provider.facts, data["invoice_id"])
            async with factory() as db:
                user = await lock_user(db, data["user_id"])
                op = await db.scalar(
                    sa.select(RefundOperation)
                    .where(RefundOperation.id == operation_id)
                    .with_for_update(of=RefundOperation)
                )
                if op.lease_token != token:
                    return False
                why, _ = await eligibility(db, user, facts, op.requested_at, op.id)
                if not why and (
                    facts["charge"].get("id") != op.charge_id
                    or facts["intent"].get("id") != op.payment_intent_id
                    or facts["invoice"].get("amount_paid") != op.amount_minor
                ):
                    why = "payment_identity_changed"
                await db.rollback()
            if why:
                # An earlier POST may have succeeded despite a lost response or
                # temporarily incomplete refund list. Never free its funds on
                # ambiguous provider facts; only a never-submitted intent can release.
                if (
                    data["first_submitted_at"] is not None
                    or data["status"] != "reserved"
                ):
                    await save(
                        status="manual_unknown",
                        review_reason=why,
                        last_error="submitted_cash_outcome_unresolved",
                    )
                else:
                    await release_review(why)
                return False
            if not await save(
                status="submitting",
                first_submitted_at=data["first_submitted_at"] or now,
            ):
                return False
            try:
                refund = await asyncio.to_thread(provider.create, data)
            except Exception as exc:
                await save(
                    status="cash_unknown",
                    last_error=type(exc).__name__,
                    next_retry_at=now + timedelta(minutes=1),
                )
                return False
        provenance = await asyncio.to_thread(provider.facts, data["invoice_id"])
        if not refund_identity(refund, data) or not payment_chain_identity(
            provenance, data
        ):
            await save(status="manual_unknown", last_error="refund_identity_mismatch")
            return False
        status = refund.get("status")
        if not await save(provider_refund_id=refund["id"], cash_status=status):
            return False
        if status in {"failed", "canceled"}:
            if data["cash_status"] == "succeeded" or data["adjustment_ledger_id"]:
                await save(
                    status="cash_reversed",
                    review_reason="provider_post_success_failure",
                )
            else:
                async with factory() as db:
                    user = await lock_user(db, data["user_id"])
                    op = await db.scalar(
                        sa.select(RefundOperation)
                        .where(RefundOperation.id == operation_id)
                        .with_for_update(of=RefundOperation)
                    )
                    if op.lease_token == token:
                        if user.refund_reserved_credits not in {
                            0,
                            op.credits_to_revoke,
                        }:
                            raise ValueError("reservation_mismatch")
                        user.refund_reserved_credits = 0
                        op.status = "cash_failed"
                        await db.commit()
            return False
        if status != "succeeded":
            await save(status="cash_pending", next_retry_at=now + timedelta(minutes=1))
            return False
        if not await save(status="cash_succeeded"):
            return False
        data["cash_status"] = "succeeded"
        current_matches = [
            x
            for x in await asyncio.to_thread(provider.refunds, data["charge_id"])
            if x.get("id") == refund["id"]
        ]
        if len(current_matches) != 1 or current_matches[0].get("status") != "succeeded":
            await save(
                status="repair_required", last_error="cash_changed_before_cancel"
            )
            return False
        current_facts = await asyncio.to_thread(provider.facts, data["invoice_id"])
        if (
            current_facts["subscription"].get("id") != data["subscription_id"]
            or current_facts["price"].get("id") != data["price_id"]
        ):
            await save(
                status="repair_required",
                review_reason="subscription_changed_after_cash",
            )
            return False
        if not await save(lease_until=now_utc() + timedelta(minutes=10)):
            return False
        await asyncio.to_thread(provider.cancel, data["subscription_id"], data["id"])
        async with factory() as db:
            user = await lock_user(db, data["user_id"])
            op = await db.scalar(
                sa.select(RefundOperation)
                .where(RefundOperation.id == operation_id)
                .with_for_update(of=RefundOperation)
            )
            if op.lease_token != token:
                return False
            existing = await db.scalar(
                sa.select(CreditLedger).where(
                    CreditLedger.user_id == user.id,
                    CreditLedger.ref_type == "cash_refund",
                    CreditLedger.ref_id == refund["id"],
                )
            )
            if existing is None:
                if (
                    user.refund_reserved_credits != op.credits_to_revoke
                    or user.credits_balance < op.credits_to_revoke
                ):
                    raise ValueError("reservation_or_balance_mismatch")
                user.credits_balance -= op.credits_to_revoke
                user.refund_reserved_credits = 0
                ledger = CreditLedger(
                    user_id=user.id,
                    delta=-op.credits_to_revoke,
                    balance_after=user.credits_balance,
                    reason="cash_refund",
                    ref_type="cash_refund",
                    ref_id=refund["id"],
                    reconciled_at=now,
                )
                db.add(ledger)
                await db.flush()
                op.adjustment_ledger_id = ledger.id
            elif existing.delta != -op.credits_to_revoke:
                raise ValueError("refund_adjustment_conflict")
            op.subscription_canceled_at = now
            if user.stripe_subscription_id == op.subscription_id:
                user.plan, user.stripe_subscription_id = "free", None
            elif user.stripe_subscription_id is not None:
                op.review_reason = "new_subscription_preserved"
            op.status = "completed"
            op.next_retry_at = now + timedelta(hours=6)
            await db.commit()
        from app.api.billing import _invalidate_user_caches

        await _invalidate_user_caches(data["user_id"])
        return True
    except Exception as exc:
        await save(
            status="repair_required"
            if data["cash_status"] == "succeeded"
            else "cash_unknown",
            last_error=type(exc).__name__,
            next_retry_at=now + timedelta(minutes=1),
        )
        return False
    finally:
        await save(lease_token=None, lease_until=None)


async def wake_refund(db, refund):
    """Webhook is a wake-up hint only. Authoritative provider read decides status."""
    oid = (refund.get("metadata") or {}).get("doctalk_refund_operation")
    try:
        oid = uuid.UUID(oid)
    except (ValueError, TypeError, AttributeError):
        return
    op = await db.get(RefundOperation, oid)
    if not op:
        return
    identity = {c.name: getattr(op, c.name) for c in RefundOperation.__table__.columns}
    if not matches_environment(identity) or not refund_identity(refund, identity):
        return  # Envelope mode is checked by webhook; this only queues a provider read.
    if op.status == "cash_failed":
        return  # Terminal failed refunds already released their reservation.
    if op.status == "completed":
        # Durable callback hint must bypass the periodic age window.
        op.next_retry_at = op.requested_at
    elif op.status in RUNNABLE:
        op.next_retry_at = now_utc()
    await db.commit()


async def refunded_subscription(db, user_id, subscription_id):
    if not subscription_id:
        return False
    return bool(
        await db.scalar(
            sa.select(RefundOperation.id)
            .where(
                RefundOperation.user_id == user_id,
                RefundOperation.subscription_id == subscription_id,
                sa.or_(
                    RefundOperation.cash_status == "succeeded",
                    RefundOperation.adjustment_ledger_id.is_not(None),
                ),
            )
            .limit(1)
        )
    )


async def begin_user_deletion(db, user_id):
    user = await lock_user(db, user_id)
    await assert_mutation_allowed(db, user_id)
    user.refund_delete_requested_at = now_utc()
    await db.commit()  # Release users before any document locks.


async def record_paid_use(db, user_id):
    """Caller must already lock every existing document before this user lock.

    Records irreversible usage evidence even for zero-credit paid/OCR features.
    Never commits: the counter and durable job/document share caller transaction.
    """
    user = await lock_user(db, user_id)
    if not user or user.refund_reserved_credits or user.refund_delete_requested_at:
        raise HTTPException(409, "Refund or account deletion is processing")
    user.credit_debit_version += 1
    return user


async def audit_completed(factory, operation_id, provider, now):
    """Cash can genuinely fail after succeeded; never recreate or reverse rights automatically."""
    async with factory() as db:
        op = await db.get(RefundOperation, operation_id)
        if not op or op.status != "completed":
            return False
        charge, refund_id, uid = op.charge_id, op.provider_refund_id, op.user_id
        identity = {
            c.name: getattr(op, c.name) for c in RefundOperation.__table__.columns
        }
    if not provider_matches(provider, identity):
        return False
    try:
        provenance = await asyncio.to_thread(provider.facts, identity["invoice_id"])
        matches = [
            x
            for x in await asyncio.to_thread(provider.refunds, charge)
            if x.get("id") == refund_id
        ]
    except Exception as exc:
        # Back off failed audits rather than repeatedly monopolizing the bounded scan.
        async with factory() as db:
            if uid:
                await lock_user(db, uid)
            op = await db.scalar(
                sa.select(RefundOperation).where(RefundOperation.id == operation_id)
                .with_for_update(of=RefundOperation)
                .execution_options(populate_existing=True)
            )
            if op and op.status == "completed":
                op.next_retry_at = now + timedelta(minutes=5)
                op.last_error = "audit_" + type(exc).__name__
                await db.commit()
        return False  # Preserve last known cash fact until authoritative read succeeds.
    async with factory() as db:
        if uid:
            await lock_user(db, uid)
        op = await db.scalar(
            sa.select(RefundOperation)
            .where(RefundOperation.id == operation_id)
            .with_for_update(of=RefundOperation)
            .execution_options(populate_existing=True)
        )
        if op.status != "completed":
            return False
        if len(matches) != 1:
            op.status, op.review_reason = "manual_unknown", "completed_refund_missing"
        else:
            current = matches[0]
            if not refund_identity(current, identity) or not payment_chain_identity(
                provenance, identity
            ):
                op.status, op.review_reason = (
                    "manual_unknown",
                    "completed_refund_identity_changed",
                )
            elif current.get("status") in {"failed", "canceled"}:
                op.status, op.cash_status, op.review_reason = (
                    "cash_reversed",
                    current["status"],
                    "provider_post_success_failure",
                )
            elif current.get("status") != "succeeded":
                op.status, op.cash_status, op.review_reason = (
                    "manual_unknown",
                    current.get("status"),
                    "provider_status_reconsidered",
                )
        op.next_retry_at = now + timedelta(hours=6)
        await db.commit()
    return True
