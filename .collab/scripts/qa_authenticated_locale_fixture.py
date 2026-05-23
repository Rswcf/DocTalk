#!/usr/bin/env python3
"""Create or clean up a user for authenticated locale browser QA."""

from __future__ import annotations

import argparse
import asyncio
import json
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from sqlalchemy import select

ROOT = Path(__file__).resolve().parents[2]
BACKEND_DIR = ROOT / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Create/cleanup DocTalk authenticated locale QA fixture.")
    sub = parser.add_subparsers(dest="command", required=True)

    create = sub.add_parser("create")
    create.add_argument("--plan", default="pro")
    create.add_argument("--json-out", required=True)

    cleanup = sub.add_parser("cleanup")
    cleanup.add_argument("--user-id", required=True)
    cleanup.add_argument("--json-out", required=True)
    return parser.parse_args()


async def create_user(plan: str) -> dict[str, Any]:
    from app.models.database import AsyncSessionLocal
    from app.services import auth_service

    stamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
    email = f"qa-auth-locale-{stamp}-{uuid.uuid4().hex[:8]}@example.com"
    async with AsyncSessionLocal() as db:
        user = await auth_service.create_user(db, email=email, name="QA Auth Locale")
        user.plan = plan
        user.credits_balance = 20000
        await db.commit()
        await db.refresh(user)
        return {"id": str(user.id), "email": user.email, "name": user.name, "plan": user.plan}


async def delete_user(user_id: uuid.UUID) -> dict[str, int]:
    from sqlalchemy import func

    from app.models.database import AsyncSessionLocal
    from app.models.tables import ChatSession, Collection, Document, SharedSession, User
    from app.services.doc_service import doc_service

    async with AsyncSessionLocal() as db:
        doc_ids = (await db.scalars(select(Document.id).where(Document.user_id == user_id))).all()
        for document_id in doc_ids:
            await doc_service.delete_document(document_id, db)
        user = await db.get(User, user_id)
        if user is not None:
            await db.delete(user)
        await db.commit()

    async with AsyncSessionLocal() as db:
        users = await db.scalar(select(func.count()).select_from(User).where(User.id == user_id))
        docs = await db.scalar(select(func.count()).select_from(Document).where(Document.user_id == user_id))
        sessions = await db.scalar(select(func.count()).select_from(ChatSession).where(ChatSession.user_id == user_id))
        collections = await db.scalar(select(func.count()).select_from(Collection).where(Collection.user_id == user_id))
        shares = await db.scalar(select(func.count()).select_from(SharedSession).where(SharedSession.user_id == user_id))
        return {
            "users": int(users or 0),
            "documents": int(docs or 0),
            "sessions": int(sessions or 0),
            "collections": int(collections or 0),
            "shared_sessions": int(shares or 0),
        }


def write_report(path: str, report: dict[str, Any]) -> None:
    out = Path(path)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


async def async_main() -> None:
    args = parse_args()
    if args.command == "create":
        report = {
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "user": await create_user(args.plan),
            "result": "pass",
        }
    else:
        cleanup = await delete_user(uuid.UUID(args.user_id))
        report = {
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "user_id": args.user_id,
            "cleanup": cleanup,
            "result": "pass" if all(value == 0 for value in cleanup.values()) else "fail",
        }
    write_report(args.json_out, report)
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    asyncio.run(async_main())
