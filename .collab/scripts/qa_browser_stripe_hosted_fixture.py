#!/usr/bin/env python3
"""Create/cleanup users for hosted Stripe browser click-through QA."""

from __future__ import annotations

import argparse
import asyncio
import json
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import stripe

ROOT = Path(__file__).resolve().parents[2]
BACKEND_DIR = ROOT / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Create/cleanup hosted Stripe browser QA fixture.")
    sub = parser.add_subparsers(dest="command", required=True)

    create = sub.add_parser("create")
    create.add_argument("--json-out", required=True)

    cleanup = sub.add_parser("cleanup")
    cleanup.add_argument("--fixture", required=True)
    cleanup.add_argument("--json-out", required=True)
    return parser.parse_args()


async def create_user(label: str, *, plan: str = "free", credits: int = 500) -> dict[str, Any]:
    from app.models.database import AsyncSessionLocal
    from app.services import auth_service

    email = f"qa-hosted-stripe-{label}-{datetime.now(timezone.utc).strftime('%Y%m%d-%H%M%S')}-{uuid.uuid4().hex[:8]}@example.com"
    async with AsyncSessionLocal() as db:
        user = await auth_service.create_user(db, email=email, name=f"QA Hosted Stripe {label}")
        user.plan = plan
        user.credits_balance = credits
        await db.commit()
        await db.refresh(user)
        return {"id": str(user.id), "email": user.email, "name": user.name, "plan": user.plan}


async def set_stripe_state(
    user_id: str,
    *,
    plan: str,
    customer_id: str,
    subscription_id: str,
) -> None:
    from app.models.database import AsyncSessionLocal
    from app.models.tables import User

    async with AsyncSessionLocal() as db:
        user = await db.get(User, uuid.UUID(user_id))
        if not user:
            raise RuntimeError(f"User not found: {user_id}")
        user.plan = plan
        user.stripe_customer_id = customer_id
        user.stripe_subscription_id = subscription_id
        await db.commit()


async def user_state(user_id: str) -> dict[str, Any]:
    from app.models.database import AsyncSessionLocal
    from app.models.tables import User

    async with AsyncSessionLocal() as db:
        user = await db.get(User, uuid.UUID(user_id))
        if not user:
            return {"exists": False}
        return {
            "exists": True,
            "id": str(user.id),
            "email": user.email,
            "plan": user.plan,
            "stripe_customer_id": user.stripe_customer_id,
            "stripe_subscription_id": user.stripe_subscription_id,
        }


async def delete_users(user_ids: list[str]) -> dict[str, dict[str, Any]]:
    from app.models.database import AsyncSessionLocal
    from app.models.tables import User

    before = {user_id: await user_state(user_id) for user_id in user_ids}
    async with AsyncSessionLocal() as db:
        for user_id in user_ids:
            user = await db.get(User, uuid.UUID(user_id))
            if user is not None:
                await db.delete(user)
        await db.commit()
    after = {user_id: await user_state(user_id) for user_id in user_ids}
    return {"before": before, "after": after}


async def create_active_subscription(email: str, label: str) -> dict[str, Any]:
    from app.core.config import settings

    customer = await asyncio.to_thread(
        stripe.Customer.create,
        email=email,
        name=f"QA Hosted Stripe {label}",
    )
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
        metadata={"source": "qa_browser_stripe_hosted", "label": label},
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


async def create_fixture() -> dict[str, Any]:
    from app.core.config import settings

    if not settings.STRIPE_SECRET_KEY or not settings.STRIPE_SECRET_KEY.startswith("sk_test_"):
        raise RuntimeError("This fixture only runs with a Stripe sk_test key")
    stripe.api_key = settings.STRIPE_SECRET_KEY

    checkout_desktop = await create_user("checkout-desktop")
    checkout_mobile = await create_user("checkout-mobile")
    portal_desktop = await create_user("portal-desktop", plan="plus", credits=3500)
    portal_mobile = await create_user("portal-mobile", plan="plus", credits=3500)

    desktop_stripe = await create_active_subscription(portal_desktop["email"], "portal-desktop")
    mobile_stripe = await create_active_subscription(portal_mobile["email"], "portal-mobile")
    await set_stripe_state(
        portal_desktop["id"],
        plan="plus",
        customer_id=desktop_stripe["customer_id"],
        subscription_id=desktop_stripe["subscription_id"],
    )
    await set_stripe_state(
        portal_mobile["id"],
        plan="plus",
        customer_id=mobile_stripe["customer_id"],
        subscription_id=mobile_stripe["subscription_id"],
    )

    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "stripe_mode": "test",
        "users": {
            "checkout_desktop": checkout_desktop,
            "checkout_mobile": checkout_mobile,
            "portal_desktop": {**portal_desktop, "stripe": desktop_stripe},
            "portal_mobile": {**portal_mobile, "stripe": mobile_stripe},
        },
        "created_stripe": {
            "customer_ids": [desktop_stripe["customer_id"], mobile_stripe["customer_id"]],
            "subscription_ids": [desktop_stripe["subscription_id"], mobile_stripe["subscription_id"]],
        },
        "result": "pass",
    }


async def cleanup_fixture(fixture_path: str) -> dict[str, Any]:
    from app.core.config import settings

    if settings.STRIPE_SECRET_KEY:
        stripe.api_key = settings.STRIPE_SECRET_KEY

    fixture = json.loads(Path(fixture_path).read_text(encoding="utf-8"))
    user_ids = [user["id"] for user in fixture.get("users", {}).values()]

    # Include customers created by subscription checkout browser clicks, which
    # are only known after the local user row is updated by /billing/subscribe.
    current_states = {user_id: await user_state(user_id) for user_id in user_ids}
    customer_ids = set(fixture.get("created_stripe", {}).get("customer_ids", []))
    subscription_ids = set(fixture.get("created_stripe", {}).get("subscription_ids", []))
    for state in current_states.values():
        customer_id = state.get("stripe_customer_id")
        subscription_id = state.get("stripe_subscription_id")
        if customer_id:
            customer_ids.add(customer_id)
        if subscription_id and str(subscription_id).startswith("sub_"):
            subscription_ids.add(subscription_id)

    stripe_actions = await cleanup_stripe(sorted(customer_ids), sorted(subscription_ids))
    user_cleanup = await delete_users(user_ids)
    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "fixture": fixture_path,
        "stripe_actions": stripe_actions,
        "user_cleanup": user_cleanup,
        "result": "pass"
        if all(not state.get("exists") for state in user_cleanup["after"].values())
        else "fail",
    }


def write_report(path: str, report: dict[str, Any]) -> None:
    out = Path(path)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main() -> None:
    args = parse_args()
    if args.command == "create":
        report = asyncio.run(create_fixture())
        write_report(args.json_out, report)
        print(
            "PASS: hosted Stripe fixture created "
            f"users={len(report['users'])} subscriptions={len(report['created_stripe']['subscription_ids'])}"
        )
        return

    report = asyncio.run(cleanup_fixture(args.fixture))
    write_report(args.json_out, report)
    print(f"{report['result'].upper()}: hosted Stripe cleanup")
    if report["result"] != "pass":
        raise SystemExit(1)


if __name__ == "__main__":
    main()
