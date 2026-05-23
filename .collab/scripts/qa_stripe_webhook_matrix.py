#!/usr/bin/env python3
"""Run signed Stripe webhook QA checks against a local DocTalk API."""

from __future__ import annotations

import argparse
import asyncio
import hashlib
import hmac
import json
import sys
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import httpx
import stripe

ROOT = Path(__file__).resolve().parents[2]
BACKEND_DIR = ROOT / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run DocTalk Stripe signed webhook QA matrix.")
    parser.add_argument("--api-base", default="http://127.0.0.1:8000")
    parser.add_argument("--json-out")
    parser.add_argument("--keep", action="store_true")
    return parser.parse_args()


async def create_user(prefix: str) -> dict[str, Any]:
    from app.models.database import AsyncSessionLocal
    from app.services import auth_service

    email = f"qa-webhook-{prefix}-{datetime.now(timezone.utc).strftime('%Y%m%d-%H%M%S')}-{uuid.uuid4().hex[:8]}@example.com"
    async with AsyncSessionLocal() as db:
        user = await auth_service.create_user(db, email=email, name=f"QA Stripe Webhook {prefix}")
        return {"id": user.id, "email": user.email, "plan": user.plan}


async def set_user_stripe_state(
    user_id: uuid.UUID,
    *,
    plan: str | None = None,
    customer_id: str | None = None,
    subscription_id: str | None = None,
) -> None:
    from app.models.database import AsyncSessionLocal
    from app.models.tables import User

    async with AsyncSessionLocal() as db:
        user = await db.get(User, user_id)
        if not user:
            raise RuntimeError(f"User not found: {user_id}")
        if plan is not None:
            user.plan = plan
        if customer_id is not None:
            user.stripe_customer_id = customer_id
        if subscription_id is not None:
            user.stripe_subscription_id = subscription_id
        await db.commit()


async def user_state(user_id: uuid.UUID) -> dict[str, Any]:
    from sqlalchemy import func, select

    from app.models.database import AsyncSessionLocal
    from app.models.tables import CreditLedger, PlanTransition, ProductEvent, User

    async with AsyncSessionLocal() as db:
        user = await db.get(User, user_id)
        if not user:
            return {"exists": False}
        ledgers = (
            await db.execute(
                select(CreditLedger.reason, CreditLedger.ref_type, CreditLedger.ref_id, CreditLedger.delta)
                .where(CreditLedger.user_id == user_id)
                .order_by(CreditLedger.created_at.asc())
            )
        ).all()
        product_events = await db.scalar(
            select(func.count()).select_from(ProductEvent).where(ProductEvent.user_id == user_id)
        )
        transitions = await db.scalar(
            select(func.count()).select_from(PlanTransition).where(PlanTransition.user_id == user_id)
        )
        return {
            "exists": True,
            "plan": user.plan,
            "credits_balance": user.credits_balance,
            "stripe_customer_id": user.stripe_customer_id,
            "stripe_subscription_id": user.stripe_subscription_id,
            "product_event_count": int(product_events or 0),
            "plan_transition_count": int(transitions or 0),
            "ledgers": [
                {
                    "reason": row.reason,
                    "ref_type": row.ref_type,
                    "ref_id": row.ref_id,
                    "delta": row.delta,
                }
                for row in ledgers
            ],
        }


async def delete_users(user_ids: list[uuid.UUID]) -> None:
    from app.models.database import AsyncSessionLocal
    from app.models.tables import User

    async with AsyncSessionLocal() as db:
        for user_id in user_ids:
            user = await db.get(User, user_id)
            if user is not None:
                await db.delete(user)
        await db.commit()


async def create_stripe_customer_and_subscription(email: str) -> dict[str, Any]:
    from app.core.config import settings

    customer = await asyncio.to_thread(stripe.Customer.create, email=email, name="QA Stripe Webhook")
    payment_method = await asyncio.to_thread(
        stripe.PaymentMethod.create,
        type="card",
        card={"token": "tok_visa"},
    )
    await asyncio.to_thread(stripe.PaymentMethod.attach, payment_method.id, customer=customer.id)
    await asyncio.to_thread(
        stripe.Customer.modify,
        customer.id,
        invoice_settings={"default_payment_method": payment_method.id},
    )
    subscription = await asyncio.to_thread(
        stripe.Subscription.create,
        customer=customer.id,
        items=[{"price": settings.STRIPE_PRICE_PLUS_MONTHLY}],
        default_payment_method=payment_method.id,
        metadata={"source": "qa_stripe_webhook_matrix", "plan": "plus", "billing": "monthly"},
    )
    return {
        "customer_id": customer.id,
        "subscription_id": subscription.id,
        "subscription_status": subscription.get("status"),
        "payment_method_id": payment_method.id,
    }


async def cleanup_stripe(customer_ids: list[str], subscription_ids: list[str]) -> list[dict[str, Any]]:
    actions: list[dict[str, Any]] = []
    for subscription_id in subscription_ids:
        try:
            sub = await asyncio.to_thread(stripe.Subscription.retrieve, subscription_id)
            if sub.get("status") != "canceled":
                await asyncio.to_thread(stripe.Subscription.cancel, subscription_id)
                actions.append({"resource": subscription_id, "action": "subscription_cancel", "result": "ok"})
        except Exception as exc:
            actions.append(
                {
                    "resource": subscription_id,
                    "action": "subscription_cancel",
                    "result": "error",
                    "error": f"{type(exc).__name__}: {exc}",
                }
            )
    for customer_id in customer_ids:
        try:
            await asyncio.to_thread(stripe.Customer.delete, customer_id)
            actions.append({"resource": customer_id, "action": "customer_delete", "result": "ok"})
        except Exception as exc:
            actions.append(
                {
                    "resource": customer_id,
                    "action": "customer_delete",
                    "result": "error",
                    "error": f"{type(exc).__name__}: {exc}",
                }
            )
    return actions


def event_payload(event_type: str, obj: dict[str, Any]) -> bytes:
    payload = {
        "id": f"evt_qa_{uuid.uuid4().hex}",
        "object": "event",
        "api_version": "2025-02-24.acacia",
        "created": int(time.time()),
        "livemode": False,
        "pending_webhooks": 1,
        "request": {"id": None, "idempotency_key": None},
        "type": event_type,
        "data": {"object": obj},
    }
    return json.dumps(payload, separators=(",", ":"), ensure_ascii=False).encode("utf-8")


def stripe_signature(payload: bytes, secret: str, *, timestamp: int | None = None) -> str:
    ts = int(time.time()) if timestamp is None else timestamp
    signed = f"{ts}.".encode("utf-8") + payload
    digest = hmac.new(secret.encode("utf-8"), signed, hashlib.sha256).hexdigest()
    return f"t={ts},v1={digest}"


async def post_event(
    client: httpx.AsyncClient,
    secret: str,
    event_type: str,
    obj: dict[str, Any],
    *,
    invalid_signature: bool = False,
) -> dict[str, Any]:
    payload = event_payload(event_type, obj)
    sig_secret = f"{secret}_wrong" if invalid_signature else secret
    res = await client.post(
        "/api/billing/webhook",
        content=payload,
        headers={
            "content-type": "application/json",
            "stripe-signature": stripe_signature(payload, sig_secret),
        },
    )
    return {"status_code": res.status_code, "body": safe_json(res)}


def safe_json(response: httpx.Response) -> Any:
    try:
        return response.json()
    except Exception:
        return {"text": response.text[:1000]}


def check(name: str, passed: bool, evidence: Any = None) -> dict[str, Any]:
    return {
        "name": name,
        "result": "pass" if passed else "fail",
        "evidence": compact(evidence),
    }


def compact(value: Any) -> Any:
    if isinstance(value, dict):
        return {key: compact(item) for key, item in value.items()}
    if isinstance(value, list):
        return [compact(item) for item in value[:20]]
    return value


def ledger_amount(state: dict[str, Any], ref_type: str, ref_id: str) -> int:
    total = 0
    for ledger in state.get("ledgers", []):
        if ledger.get("ref_type") == ref_type and ledger.get("ref_id") == ref_id:
            total += int(ledger.get("delta") or 0)
    return total


async def run(args: argparse.Namespace) -> dict[str, Any]:
    from app.core.config import settings

    if not settings.STRIPE_WEBHOOK_SECRET:
        raise RuntimeError("STRIPE_WEBHOOK_SECRET is required")
    if not settings.STRIPE_SECRET_KEY or not settings.STRIPE_SECRET_KEY.startswith("sk_test_"):
        raise RuntimeError("This matrix only runs with a Stripe sk_test key")

    stripe.api_key = settings.STRIPE_SECRET_KEY
    report: dict[str, Any] = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "api_base": args.api_base,
        "stripe_mode": "test",
        "checks": [],
        "users": {},
        "created_stripe": {"customer_ids": [], "subscription_ids": []},
        "cleanup": "pending",
    }
    user_ids: list[uuid.UUID] = []

    try:
        credit_user = await create_user("credits")
        subscription_user = await create_user("subscription")
        expired_user = await create_user("expired")
        user_ids = [credit_user["id"], subscription_user["id"], expired_user["id"]]
        report["users"] = {
            "credit": {"id": str(credit_user["id"]), "email": credit_user["email"]},
            "subscription": {"id": str(subscription_user["id"]), "email": subscription_user["email"]},
            "expired": {"id": str(expired_user["id"]), "email": expired_user["email"]},
        }

        stripe_resources = await create_stripe_customer_and_subscription(subscription_user["email"])
        report["created_stripe"]["customer_ids"].append(stripe_resources["customer_id"])
        report["created_stripe"]["subscription_ids"].append(stripe_resources["subscription_id"])
        await set_user_stripe_state(
            subscription_user["id"],
            plan="free",
            customer_id=stripe_resources["customer_id"],
            subscription_id="pending",
        )

        expired_customer = await asyncio.to_thread(
            stripe.Customer.create,
            email=expired_user["email"],
            name="QA Stripe Webhook Expired",
        )
        report["created_stripe"]["customer_ids"].append(expired_customer.id)
        await set_user_stripe_state(
            expired_user["id"],
            plan="free",
            customer_id=expired_customer.id,
            subscription_id="pending",
        )

        async with httpx.AsyncClient(base_url=args.api_base, timeout=60.0) as client:
            health = await client.get("/health")
            report["health"] = {"status_code": health.status_code, "body": safe_json(health)}
            health.raise_for_status()

            invalid = await post_event(
                client,
                settings.STRIPE_WEBHOOK_SECRET,
                "checkout.session.completed",
                {"id": "cs_invalid", "object": "checkout.session"},
                invalid_signature=True,
            )
            report["checks"].append(
                check(
                    "invalid_webhook_signature_rejected",
                    invalid["status_code"] == 401,
                    invalid,
                )
            )

            credit_before = await user_state(credit_user["id"])
            payment_intent = f"pi_qa_{uuid.uuid4().hex}"
            payment_session = {
                "id": f"cs_qa_{uuid.uuid4().hex}",
                "object": "checkout.session",
                "mode": "payment",
                "client_reference_id": str(credit_user["id"]),
                "payment_intent": payment_intent,
                "metadata": {"credits": "777", "pack_id": "boost"},
            }
            payment_first = await post_event(
                client,
                settings.STRIPE_WEBHOOK_SECRET,
                "checkout.session.completed",
                payment_session,
            )
            payment_after_first = await user_state(credit_user["id"])
            payment_second = await post_event(
                client,
                settings.STRIPE_WEBHOOK_SECRET,
                "checkout.session.completed",
                payment_session,
            )
            payment_after_second = await user_state(credit_user["id"])
            report["states_payment"] = {
                "before": credit_before,
                "after_first": payment_after_first,
                "after_second": payment_after_second,
            }
            report["checks"].append(
                check(
                    "credit_pack_checkout_completed_grants_once",
                    payment_first["status_code"] == 200
                    and payment_second["status_code"] == 200
                    and payment_after_first["credits_balance"] - credit_before["credits_balance"] == 777
                    and payment_after_second["credits_balance"] == payment_after_first["credits_balance"]
                    and ledger_amount(payment_after_second, "stripe_payment", payment_intent) == 777,
                    {"first": payment_first, "second": payment_second, "after_second": payment_after_second},
                )
            )

            checkout_subscription = {
                "id": f"cs_sub_{uuid.uuid4().hex}",
                "object": "checkout.session",
                "mode": "subscription",
                "client_reference_id": str(subscription_user["id"]),
                "customer": stripe_resources["customer_id"],
                "subscription": stripe_resources["subscription_id"],
                "metadata": {"source": "qa_webhook", "reason": "subscription_completed"},
            }
            sub_checkout = await post_event(
                client,
                settings.STRIPE_WEBHOOK_SECRET,
                "checkout.session.completed",
                checkout_subscription,
            )
            state_after_sub_checkout = await user_state(subscription_user["id"])
            report["state_after_subscription_checkout"] = state_after_sub_checkout
            report["checks"].append(
                check(
                    "subscription_checkout_completed_sets_plan_and_ids",
                    sub_checkout["status_code"] == 200
                    and state_after_sub_checkout["plan"] == "plus"
                    and state_after_sub_checkout["stripe_customer_id"] == stripe_resources["customer_id"]
                    and state_after_sub_checkout["stripe_subscription_id"] == stripe_resources["subscription_id"]
                    and state_after_sub_checkout["product_event_count"] >= 1,
                    {"response": sub_checkout, "state": state_after_sub_checkout},
                )
            )

            invoice_id = f"in_qa_{uuid.uuid4().hex}"
            invoice_obj = {
                "id": invoice_id,
                "object": "invoice",
                "customer": stripe_resources["customer_id"],
                "subscription": stripe_resources["subscription_id"],
                "billing_reason": "subscription_create",
            }
            invoice_first = await post_event(
                client,
                settings.STRIPE_WEBHOOK_SECRET,
                "invoice.payment_succeeded",
                invoice_obj,
            )
            state_after_invoice_first = await user_state(subscription_user["id"])
            invoice_second = await post_event(
                client,
                settings.STRIPE_WEBHOOK_SECRET,
                "invoice.payment_succeeded",
                invoice_obj,
            )
            state_after_invoice_second = await user_state(subscription_user["id"])
            report["states_invoice"] = {
                "after_first": state_after_invoice_first,
                "after_second": state_after_invoice_second,
            }
            report["checks"].append(
                check(
                    "invoice_payment_succeeded_grants_monthly_allowance_once",
                    invoice_first["status_code"] == 200
                    and invoice_second["status_code"] == 200
                    and ledger_amount(state_after_invoice_second, "stripe_invoice", invoice_id)
                    == int(settings.PLAN_PLUS_MONTHLY_CREDITS or 0)
                    and state_after_invoice_second["credits_balance"]
                    == state_after_invoice_first["credits_balance"],
                    {
                        "first": invoice_first,
                        "second": invoice_second,
                        "after_second": state_after_invoice_second,
                    },
                )
            )

            plan_change_start = int(time.time())
            updated_sub = {
                "id": stripe_resources["subscription_id"],
                "object": "subscription",
                "customer": stripe_resources["customer_id"],
                "status": "active",
                "cancel_at_period_end": False,
                "current_period_start": plan_change_start,
                "items": {
                    "data": [
                        {
                            "id": "si_qa_upgrade",
                            "price": {"id": settings.STRIPE_PRICE_PRO_MONTHLY},
                        }
                    ]
                },
            }
            update_first = await post_event(
                client,
                settings.STRIPE_WEBHOOK_SECRET,
                "customer.subscription.updated",
                updated_sub,
            )
            state_after_update_first = await user_state(subscription_user["id"])
            update_second = await post_event(
                client,
                settings.STRIPE_WEBHOOK_SECRET,
                "customer.subscription.updated",
                updated_sub,
            )
            state_after_update_second = await user_state(subscription_user["id"])
            supplement = int(settings.PLAN_PRO_MONTHLY_CREDITS or 0) - int(settings.PLAN_PLUS_MONTHLY_CREDITS or 0)
            plan_change_ref = f"plan_change_{stripe_resources['subscription_id']}_{plan_change_start}"
            report["states_subscription_update"] = {
                "after_first": state_after_update_first,
                "after_second": state_after_update_second,
            }
            report["checks"].append(
                check(
                    "subscription_updated_upgrade_syncs_plan_and_supplement_once",
                    update_first["status_code"] == 200
                    and update_second["status_code"] == 200
                    and state_after_update_second["plan"] == "pro"
                    and ledger_amount(state_after_update_second, "plan_change", plan_change_ref) == supplement
                    and state_after_update_second["credits_balance"]
                    == state_after_update_first["credits_balance"],
                    {
                        "first": update_first,
                        "second": update_second,
                        "after_second": state_after_update_second,
                    },
                )
            )

            failed_invoice = await post_event(
                client,
                settings.STRIPE_WEBHOOK_SECRET,
                "invoice.payment_failed",
                {
                    "id": f"in_fail_{uuid.uuid4().hex}",
                    "object": "invoice",
                    "customer": stripe_resources["customer_id"],
                },
            )
            state_after_failed_invoice = await user_state(subscription_user["id"])
            report["checks"].append(
                check(
                    "invoice_payment_failed_acknowledged_without_state_change",
                    failed_invoice["status_code"] == 200
                    and state_after_failed_invoice["plan"] == state_after_update_second["plan"]
                    and state_after_failed_invoice["credits_balance"]
                    == state_after_update_second["credits_balance"],
                    {"response": failed_invoice, "state": state_after_failed_invoice},
                )
            )

            deleted = await post_event(
                client,
                settings.STRIPE_WEBHOOK_SECRET,
                "customer.subscription.deleted",
                {
                    "id": stripe_resources["subscription_id"],
                    "object": "subscription",
                    "customer": stripe_resources["customer_id"],
                    "status": "canceled",
                },
            )
            state_after_deleted = await user_state(subscription_user["id"])
            report["state_after_subscription_deleted"] = state_after_deleted
            report["checks"].append(
                check(
                    "subscription_deleted_demotes_to_free_and_clears_sub",
                    deleted["status_code"] == 200
                    and state_after_deleted["plan"] == "free"
                    and state_after_deleted["stripe_subscription_id"] is None,
                    {"response": deleted, "state": state_after_deleted},
                )
            )

            expired = await post_event(
                client,
                settings.STRIPE_WEBHOOK_SECRET,
                "checkout.session.expired",
                {
                    "id": f"cs_expired_{uuid.uuid4().hex}",
                    "object": "checkout.session",
                    "client_reference_id": str(expired_user["id"]),
                    "customer": expired_customer.id,
                    "mode": "subscription",
                },
            )
            state_after_expired = await user_state(expired_user["id"])
            report["state_after_checkout_expired"] = state_after_expired
            report["checks"].append(
                check(
                    "checkout_session_expired_clears_pending_without_active_sub",
                    expired["status_code"] == 200
                    and state_after_expired["plan"] == "free"
                    and state_after_expired["stripe_subscription_id"] is None,
                    {"response": expired, "state": state_after_expired},
                )
            )

        report["result"] = "pass" if all(item["result"] == "pass" for item in report["checks"]) else "fail"
        return report
    except Exception as exc:
        report["result"] = "fail"
        report["error"] = f"{type(exc).__name__}: {exc}"
        raise
    finally:
        if args.keep:
            report["cleanup"] = "kept"
        else:
            try:
                stripe_actions = await cleanup_stripe(
                    report.get("created_stripe", {}).get("customer_ids") or [],
                    report.get("created_stripe", {}).get("subscription_ids") or [],
                )
                await delete_users(user_ids)
                report["cleanup"] = {
                    "result": "deleted qa users and attempted stripe cleanup",
                    "stripe_actions": stripe_actions,
                    "user_states_after_cleanup": {
                        str(user_id): await user_state(user_id) for user_id in user_ids
                    },
                }
            except Exception as cleanup_exc:
                report["cleanup"] = f"failed: {type(cleanup_exc).__name__}: {cleanup_exc}"
        if args.json_out:
            out = Path(args.json_out)
            out.parent.mkdir(parents=True, exist_ok=True)
            out.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main() -> None:
    args = parse_args()
    try:
        report = asyncio.run(run(args))
    except Exception as exc:
        print(f"FAIL: {type(exc).__name__}: {exc}", file=sys.stderr)
        raise SystemExit(1)

    passed = sum(1 for item in report["checks"] if item["result"] == "pass")
    total = len(report["checks"])
    print(f"STRIPE_WEBHOOK {report['result'].upper()}: {passed}/{total} checks; cleanup={report['cleanup']}")
    if report["result"] != "pass":
        raise SystemExit(1)


if __name__ == "__main__":
    main()
