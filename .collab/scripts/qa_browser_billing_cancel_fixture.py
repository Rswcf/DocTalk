#!/usr/bin/env python3
"""Create or clean up admin-managed paid users for Billing cancel browser QA."""

from __future__ import annotations

import argparse
import asyncio
import json
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from sqlalchemy import func, select

ROOT = Path(__file__).resolve().parents[2]
BACKEND_DIR = ROOT / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Create/cleanup Billing cancel browser QA fixtures.")
    sub = parser.add_subparsers(dest="command", required=True)

    create = sub.add_parser("create")
    create.add_argument("--json-out", required=True)

    cleanup = sub.add_parser("cleanup")
    cleanup.add_argument("--fixture")
    cleanup.add_argument("--user-id", action="append", default=[])
    cleanup.add_argument("--json-out", required=True)
    return parser.parse_args()


async def create_scenario(label: str) -> dict[str, Any]:
    from app.models.database import AsyncSessionLocal
    from app.services import auth_service

    email = (
        f"qa-browser-billing-cancel-{label}-"
        f"{datetime.now(timezone.utc).strftime('%Y%m%d-%H%M%S')}-"
        f"{uuid.uuid4().hex[:8]}@example.com"
    )
    async with AsyncSessionLocal() as db:
        user = await auth_service.create_user(db, email=email, name=f"QA Billing Cancel {label.title()}")
        user.plan = "plus"
        user.credits_balance = 3500
        user.stripe_customer_id = None
        user.stripe_subscription_id = None
        await db.commit()
        await db.refresh(user)
        return {
            "user": {
                "id": str(user.id),
                "email": user.email,
                "name": user.name,
                "plan": user.plan,
                "credits_balance": user.credits_balance,
            },
            "expected_billing_state": {
                "managed_by": "admin",
                "can_cancel": True,
                "status": "none",
            },
        }


async def create_fixture() -> dict[str, Any]:
    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "result": "pass",
        "scenarios": {
            "desktop": await create_scenario("desktop"),
            "mobile": await create_scenario("mobile"),
        },
    }


def user_ids_from_fixture(path: str | None) -> list[str]:
    if not path:
        return []
    data = json.loads(Path(path).read_text(encoding="utf-8"))
    return [
        scenario["user"]["id"]
        for scenario in (data.get("scenarios") or {}).values()
        if scenario.get("user", {}).get("id")
    ]


async def cleanup(user_ids: list[str]) -> dict[str, Any]:
    from app.core.cache import cache_delete
    from app.models.database import AsyncSessionLocal
    from app.models.tables import PlanTransition, ProductEvent, User

    parsed_ids = [uuid.UUID(user_id) for user_id in user_ids]
    async with AsyncSessionLocal() as db:
        if parsed_ids:
            product_events = (await db.scalars(select(ProductEvent).where(ProductEvent.user_id.in_(parsed_ids)))).all()
            for event in product_events:
                await db.delete(event)
            for uid in parsed_ids:
                user = await db.get(User, uid)
                if user is not None:
                    await db.delete(user)
                await cache_delete(f"user:profile:{uid}")
                await cache_delete(f"user:billing_state:{uid}")
        await db.commit()

    async with AsyncSessionLocal() as db:
        users = await db.scalar(select(func.count()).select_from(User).where(User.id.in_(parsed_ids))) if parsed_ids else 0
        transitions = await db.scalar(
            select(func.count()).select_from(PlanTransition).where(PlanTransition.user_id.in_(parsed_ids))
        ) if parsed_ids else 0
        events = await db.scalar(select(func.count()).select_from(ProductEvent).where(ProductEvent.user_id.in_(parsed_ids))) if parsed_ids else 0
        pattern_users = await db.scalar(
            select(func.count()).select_from(User).where(User.email.like("qa-browser-billing-cancel-%@example.com"))
        )
    residual_ok = not any([users, transitions, events, pattern_users])
    return {
        "result": "pass" if residual_ok else "fail",
        "user_ids": user_ids,
        "users": int(users or 0),
        "plan_transitions": int(transitions or 0),
        "product_events": int(events or 0),
        "billing_cancel_users": int(pattern_users or 0),
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
        print(f"created billing-cancel fixture scenarios={len(report['scenarios'])}")
        return

    user_ids = [*args.user_id, *user_ids_from_fixture(args.fixture)]
    report = asyncio.run(cleanup(sorted(set(user_ids))))
    write_report(args.json_out, report)
    print(
        "cleanup "
        f"users={report['users']} plan_transitions={report['plan_transitions']} "
        f"product_events={report['product_events']} billing_cancel_users={report['billing_cancel_users']}"
    )
    if report["result"] != "pass":
        raise SystemExit(1)


if __name__ == "__main__":
    main()
