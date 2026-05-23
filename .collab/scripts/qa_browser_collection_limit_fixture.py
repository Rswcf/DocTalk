#!/usr/bin/env python3
"""Create or clean up Free-plan collection-limit fixtures for browser QA."""

from __future__ import annotations

import argparse
import asyncio
import json
import sys
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

from sqlalchemy import func, select

ROOT = Path(__file__).resolve().parents[2]
BACKEND_DIR = ROOT / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Create/cleanup Free-plan collection limit browser QA fixtures.")
    sub = parser.add_subparsers(dest="command", required=True)
    create = sub.add_parser("create")
    create.add_argument("--json-out", required=True)
    cleanup = sub.add_parser("cleanup")
    cleanup.add_argument("--fixture")
    cleanup.add_argument("--user-id", action="append", default=[])
    cleanup.add_argument("--json-out", required=True)
    return parser.parse_args()


async def create_scenario(label: str, offset_seconds: int) -> dict[str, Any]:
    from app.core.config import settings
    from app.models.database import AsyncSessionLocal
    from app.models.tables import Collection
    from app.services import auth_service

    email = (
        f"qa-browser-collection-limit-{label}-"
        f"{datetime.now(timezone.utc).strftime('%Y%m%d-%H%M%S')}-"
        f"{uuid.uuid4().hex[:8]}@example.com"
    )
    created_base = datetime.now(timezone.utc) + timedelta(seconds=offset_seconds)
    collections = []
    async with AsyncSessionLocal() as db:
        user = await auth_service.create_user(db, email=email, name=f"QA Collection Limit {label.title()}")
        user.plan = "free"
        user.credits_balance = 500
        for idx in range(int(settings.FREE_MAX_COLLECTIONS)):
            coll_id = uuid.uuid4()
            created_at = created_base + timedelta(seconds=idx)
            coll = Collection(
                id=coll_id,
                name=f"Existing Free Workspace {idx + 1}",
                description="Synthetic collection occupying the Free plan collection limit.",
                user_id=user.id,
                created_at=created_at,
                updated_at=created_at,
            )
            db.add(coll)
            collections.append({"id": str(coll_id), "name": coll.name, "created_at": created_at.isoformat()})
        await db.commit()
        await db.refresh(user)

    return {
        "user": {"id": str(user.id), "email": user.email, "name": user.name, "plan": user.plan},
        "max_collections": int(settings.FREE_MAX_COLLECTIONS),
        "collections": collections,
    }


async def create_fixture(_args: argparse.Namespace) -> dict[str, Any]:
    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "result": "pass",
        "scenarios": {
            "desktop": await create_scenario("desktop", 10),
            "mobile": await create_scenario("mobile", 20),
        },
    }


def user_ids_from_fixture(path: str | None) -> list[str]:
    if not path:
        return []
    data = json.loads(Path(path).read_text(encoding="utf-8"))
    ids = []
    for scenario in (data.get("scenarios") or {}).values():
        user = scenario.get("user") or {}
        if user.get("id"):
            ids.append(user["id"])
    return ids


async def cleanup(user_ids: list[str]) -> dict[str, Any]:
    from app.models.database import AsyncSessionLocal
    from app.models.tables import Collection, User

    parsed_ids = [uuid.UUID(user_id) for user_id in user_ids]
    async with AsyncSessionLocal() as db:
        for uid in parsed_ids:
            collection_ids = (await db.scalars(select(Collection.id).where(Collection.user_id == uid))).all()
            for collection_id in collection_ids:
                coll = await db.get(Collection, collection_id)
                if coll is not None:
                    await db.delete(coll)
            user = await db.get(User, uid)
            if user is not None:
                await db.delete(user)
        await db.commit()

    async with AsyncSessionLocal() as db:
        users = await db.scalar(select(func.count()).select_from(User).where(User.id.in_(parsed_ids))) if parsed_ids else 0
        collections = await db.scalar(select(func.count()).select_from(Collection).where(Collection.user_id.in_(parsed_ids))) if parsed_ids else 0
        pattern_users = await db.scalar(
            select(func.count()).select_from(User).where(User.email.like("qa-browser-collection-limit-%@example.com"))
        )
    return {
        "result": "pass",
        "user_ids": user_ids,
        "users": int(users or 0),
        "collections": int(collections or 0),
        "collection_limit_users": int(pattern_users or 0),
    }


def write_report(path: str, report: dict[str, Any]) -> None:
    out = Path(path)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main() -> None:
    args = parse_args()
    if args.command == "create":
        report = asyncio.run(create_fixture(args))
        write_report(args.json_out, report)
        count = sum(len(s["collections"]) for s in report["scenarios"].values())
        print(f"created collection-limit fixture scenarios={len(report['scenarios'])} collections={count}")
    elif args.command == "cleanup":
        user_ids = [*args.user_id, *user_ids_from_fixture(args.fixture)]
        report = asyncio.run(cleanup(sorted(set(user_ids))))
        write_report(args.json_out, report)
        print(
            "cleanup "
            f"users={report['users']} collections={report['collections']} "
            f"collection_limit_users={report['collection_limit_users']}"
        )


if __name__ == "__main__":
    main()
