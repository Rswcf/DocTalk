#!/usr/bin/env python3
"""Run Stripe test-mode checkout, portal, change-plan, and cancel QA checks."""

from __future__ import annotations

import argparse
import asyncio
import json
import sys
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

import httpx
import stripe
from jose import jwt

ROOT = Path(__file__).resolve().parents[2]
BACKEND_DIR = ROOT / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run DocTalk Stripe test-mode QA matrix.")
    parser.add_argument("--api-base", default="http://127.0.0.1:8000")
    parser.add_argument("--json-out")
    parser.add_argument("--keep", action="store_true")
    return parser.parse_args()


async def create_user() -> dict[str, Any]:
    from app.models.database import AsyncSessionLocal
    from app.services import auth_service

    email = f"qa-stripe-{datetime.now(timezone.utc).strftime('%Y%m%d-%H%M%S')}-{uuid.uuid4().hex[:8]}@example.com"
    async with AsyncSessionLocal() as db:
        user = await auth_service.create_user(db, email=email, name="QA Stripe Test")
        return {"id": user.id, "email": user.email, "plan": user.plan}


def token_for(user_id: uuid.UUID) -> str:
    from app.core.config import settings

    if not settings.AUTH_SECRET:
        raise RuntimeError("AUTH_SECRET is required")
    now = datetime.now(timezone.utc)
    return jwt.encode(
        {
            "sub": str(user_id),
            "iat": int(now.timestamp()),
            "exp": int((now + timedelta(hours=2)).timestamp()),
        },
        settings.AUTH_SECRET,
        algorithm="HS256",
    )


async def user_state(user_id: uuid.UUID) -> dict[str, Any]:
    from sqlalchemy import func, select

    from app.models.database import AsyncSessionLocal
    from app.models.tables import CreditLedger, PlanTransition, ProductEvent, User

    async with AsyncSessionLocal() as db:
        user = await db.get(User, user_id)
        if not user:
            return {"exists": False}
        product_events = await db.scalar(
            select(func.count()).select_from(ProductEvent).where(ProductEvent.user_id == user_id)
        )
        transitions = await db.scalar(
            select(func.count()).select_from(PlanTransition).where(PlanTransition.user_id == user_id)
        )
        ledgers = await db.scalar(
            select(func.count()).select_from(CreditLedger).where(CreditLedger.user_id == user_id)
        )
        return {
            "exists": True,
            "plan": user.plan,
            "credits_balance": user.credits_balance,
            "stripe_customer_id": user.stripe_customer_id,
            "stripe_subscription_id": user.stripe_subscription_id,
            "product_event_count": int(product_events or 0),
            "plan_transition_count": int(transitions or 0),
            "credit_ledger_count": int(ledgers or 0),
        }


async def set_local_subscription_state(user_id: uuid.UUID, *, plan: str, subscription_id: str) -> None:
    from app.models.database import AsyncSessionLocal
    from app.models.tables import User

    async with AsyncSessionLocal() as db:
        user = await db.get(User, user_id)
        if not user:
            raise RuntimeError(f"User not found: {user_id}")
        user.plan = plan
        user.stripe_subscription_id = subscription_id
        await db.commit()


async def delete_user(user_id: uuid.UUID) -> None:
    from app.models.database import AsyncSessionLocal
    from app.models.tables import User

    async with AsyncSessionLocal() as db:
        user = await db.get(User, user_id)
        if user is not None:
            await db.delete(user)
            await db.commit()


async def create_active_test_subscription(customer_id: str) -> dict[str, Any]:
    from app.core.config import settings

    payment_method = await asyncio.to_thread(
        stripe.PaymentMethod.create,
        type="card",
        card={"token": "tok_visa"},
    )
    await asyncio.to_thread(stripe.PaymentMethod.attach, payment_method.id, customer=customer_id)
    await asyncio.to_thread(
        stripe.Customer.modify,
        customer_id,
        invoice_settings={"default_payment_method": payment_method.id},
    )
    subscription = await asyncio.to_thread(
        stripe.Subscription.create,
        customer=customer_id,
        items=[{"price": settings.STRIPE_PRICE_PLUS_MONTHLY}],
        default_payment_method=payment_method.id,
        metadata={"source": "qa_stripe_testmode_matrix", "plan": "plus", "billing": "monthly"},
    )
    return {
        "id": subscription.id,
        "status": subscription.get("status"),
        "current_period_end": subscription.get("current_period_end"),
        "payment_method_id": payment_method.id,
    }


async def cleanup_stripe(customer_id: str | None, subscription_ids: list[str]) -> list[dict[str, Any]]:
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
    if customer_id:
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


def safe_json(response: httpx.Response) -> Any:
    try:
        return response.json()
    except Exception:
        return {"text": response.text[:1000]}


def check(
    name: str,
    actual_status: int,
    expected_status: int,
    body: Any,
    *,
    predicate=None,
) -> dict[str, Any]:
    ok = actual_status == expected_status
    if predicate is not None:
        try:
            ok = ok and bool(predicate())
        except Exception:
            ok = False
    return {
        "name": name,
        "actual_status": actual_status,
        "expected_status": expected_status,
        "result": "pass" if ok else "fail",
        "body": compact_body(body),
    }


def compact_body(body: Any) -> Any:
    if isinstance(body, dict):
        compact: dict[str, Any] = {}
        for key, value in body.items():
            if key.endswith("_url") and isinstance(value, str):
                compact[key] = value.split("?", 1)[0]
            elif key in {"checkout_url", "portal_url"} and isinstance(value, str):
                compact[key] = value.split("?", 1)[0]
            else:
                compact[key] = compact_body(value)
        return compact
    if isinstance(body, list):
        return [compact_body(item) for item in body[:10]]
    return body


def is_checkout_url(value: Any) -> bool:
    return isinstance(value, str) and value.startswith("https://checkout.stripe.com/")


def is_portal_url(value: Any) -> bool:
    return isinstance(value, str) and value.startswith("https://billing.stripe.com/")


async def run(args: argparse.Namespace) -> dict[str, Any]:
    from app.core.config import settings

    if not settings.STRIPE_SECRET_KEY or not settings.STRIPE_SECRET_KEY.startswith("sk_test_"):
        raise RuntimeError("This matrix only runs with a Stripe sk_test key")

    stripe.api_key = settings.STRIPE_SECRET_KEY
    qa_user = await create_user()
    auth_headers = {"Authorization": f"Bearer {token_for(qa_user['id'])}"}
    report: dict[str, Any] = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "api_base": args.api_base,
        "stripe_mode": "test",
        "user": {"id": str(qa_user["id"]), "email": qa_user["email"]},
        "checks": [],
        "created_stripe": {"customer_id": None, "subscription_ids": []},
        "cleanup": "pending",
    }

    try:
        async with httpx.AsyncClient(base_url=args.api_base, timeout=60.0) as client:
            health = await client.get("/health")
            report["health"] = {"status_code": health.status_code, "body": safe_json(health)}
            health.raise_for_status()

            res = await client.post("/api/billing/checkout?pack_id=boost", headers=auth_headers)
            credit_checkout_body = safe_json(res)
            report["checks"].append(
                check(
                    "credit_pack_checkout_creates_stripe_test_session",
                    res.status_code,
                    200,
                    credit_checkout_body,
                    predicate=lambda: is_checkout_url(credit_checkout_body.get("checkout_url")),
                )
            )

            res = await client.post(
                "/api/billing/subscribe",
                headers=auth_headers,
                json={"plan": "plus", "billing": "monthly", "source": "qa_stripe", "reason": "testmode_matrix"},
            )
            subscribe_body = safe_json(res)
            state_after_subscribe = await user_state(qa_user["id"])
            report["state_after_subscribe"] = state_after_subscribe
            report["created_stripe"]["customer_id"] = state_after_subscribe.get("stripe_customer_id")
            report["checks"].append(
                check(
                    "subscription_checkout_sets_pending_and_customer",
                    res.status_code,
                    200,
                    subscribe_body,
                    predicate=lambda: is_checkout_url(subscribe_body.get("checkout_url"))
                    and state_after_subscribe.get("stripe_customer_id", "").startswith("cus_")
                    and state_after_subscribe.get("stripe_subscription_id") == "pending",
                )
            )

            res = await client.post(
                "/api/billing/subscribe",
                headers=auth_headers,
                json={"plan": "pro", "billing": "monthly", "source": "qa_stripe", "reason": "duplicate_pending"},
            )
            duplicate_body = safe_json(res)
            report["checks"].append(
                check(
                    "subscription_duplicate_pending_rejected",
                    res.status_code,
                    409,
                    duplicate_body,
                    predicate=lambda: "checkout is already in progress" in str(duplicate_body).lower(),
                )
            )

            res = await client.get("/api/users/profile", headers=auth_headers)
            pending_profile = safe_json(res)
            pending_state = pending_profile.get("billing_state") if isinstance(pending_profile, dict) else {}
            report["checks"].append(
                check(
                    "profile_surfaces_pending_subscription_state",
                    res.status_code,
                    200,
                    pending_profile,
                    predicate=lambda: pending_state.get("managed_by") == "stripe"
                    and pending_state.get("status") == "pending"
                    and pending_state.get("can_cancel") is False,
                )
            )

            customer_id = state_after_subscribe.get("stripe_customer_id")
            active_subscription = await create_active_test_subscription(customer_id)
            report["created_stripe"]["subscription_ids"].append(active_subscription["id"])
            report["active_subscription_created"] = active_subscription
            await set_local_subscription_state(
                qa_user["id"],
                plan="plus",
                subscription_id=active_subscription["id"],
            )

            res = await client.get("/api/users/profile", headers=auth_headers)
            active_profile = safe_json(res)
            active_state = active_profile.get("billing_state") if isinstance(active_profile, dict) else {}
            report["checks"].append(
                check(
                    "profile_surfaces_active_stripe_subscription",
                    res.status_code,
                    200,
                    active_profile,
                    predicate=lambda: active_profile.get("plan") == "plus"
                    and active_state.get("managed_by") == "stripe"
                    and active_state.get("status") in {"active", "trialing"}
                    and active_state.get("can_cancel") is True,
                )
            )

            res = await client.post("/api/billing/portal", headers=auth_headers)
            portal_body = safe_json(res)
            report["checks"].append(
                check(
                    "billing_portal_creates_stripe_test_session",
                    res.status_code,
                    200,
                    portal_body,
                    predicate=lambda: is_portal_url(portal_body.get("portal_url")),
                )
            )

            res = await client.post(
                "/api/billing/change-plan",
                headers=auth_headers,
                json={"plan": "pro", "billing": "monthly", "source": "qa_stripe", "reason": "upgrade_test"},
            )
            change_body = safe_json(res)
            state_after_change = await user_state(qa_user["id"])
            report["state_after_change"] = state_after_change
            report["checks"].append(
                check(
                    "change_plan_plus_to_pro_updates_stripe_and_local_plan",
                    res.status_code,
                    200,
                    change_body,
                    predicate=lambda: change_body.get("status") == "upgraded"
                    and change_body.get("new_plan") == "pro"
                    and state_after_change.get("plan") == "pro"
                    and state_after_change.get("credit_ledger_count", 0) >= 2,
                )
            )

            res = await client.post(
                "/api/billing/change-plan",
                headers=auth_headers,
                json={"plan": "pro", "billing": "monthly"},
            )
            same_plan_body = safe_json(res)
            report["checks"].append(
                check(
                    "change_plan_same_plan_rejected",
                    res.status_code,
                    400,
                    same_plan_body,
                    predicate=lambda: "already on this plan" in str(same_plan_body).lower(),
                )
            )

            res = await client.post(
                "/api/billing/cancel",
                headers=auth_headers,
                json={
                    "reason": "answer_quality",
                    "feedback": "QA test-mode cancel path",
                    "refund_requested": True,
                },
            )
            cancel_body = safe_json(res)
            state_after_cancel = await user_state(qa_user["id"])
            report["state_after_cancel"] = state_after_cancel
            report["checks"].append(
                check(
                    "cancel_active_stripe_subscription_schedules_period_end",
                    res.status_code,
                    200,
                    cancel_body,
                    predicate=lambda: cancel_body.get("status") == "scheduled_cancel"
                    and cancel_body.get("effective_at")
                    and cancel_body.get("refund_requested") is True
                    and state_after_cancel.get("plan") == "pro"
                    and state_after_cancel.get("plan_transition_count", 0) >= 1,
                )
            )

            res = await client.get("/api/users/profile", headers=auth_headers)
            canceled_profile = safe_json(res)
            canceled_state = canceled_profile.get("billing_state") if isinstance(canceled_profile, dict) else {}
            report["checks"].append(
                check(
                    "profile_surfaces_scheduled_cancel_state",
                    res.status_code,
                    200,
                    canceled_profile,
                    predicate=lambda: canceled_state.get("managed_by") == "stripe"
                    and canceled_state.get("cancel_at_period_end") is True
                    and canceled_state.get("can_cancel") is False,
                )
            )

        report["result"] = "pass" if all(c.get("result") == "pass" for c in report["checks"]) else "fail"
        return report
    except Exception as exc:
        report["result"] = "fail"
        report["error"] = f"{type(exc).__name__}: {exc}"
        raise
    finally:
        if args.keep:
            report["cleanup"] = "kept"
        else:
            customer_id = report.get("created_stripe", {}).get("customer_id")
            subscription_ids = report.get("created_stripe", {}).get("subscription_ids") or []
            try:
                stripe_actions = await cleanup_stripe(customer_id, subscription_ids)
                await delete_user(qa_user["id"])
                report["cleanup"] = {
                    "result": "deleted qa user and attempted stripe cleanup",
                    "stripe_actions": stripe_actions,
                    "user_state_after_cleanup": await user_state(qa_user["id"]),
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

    passed = sum(1 for check_item in report["checks"] if check_item["result"] == "pass")
    total = len(report["checks"])
    print(f"STRIPE_TESTMODE {report['result'].upper()}: {passed}/{total} checks; cleanup={report['cleanup']}")
    if report["result"] != "pass":
        raise SystemExit(1)


if __name__ == "__main__":
    main()
