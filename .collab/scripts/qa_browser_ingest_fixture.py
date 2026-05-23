#!/usr/bin/env python3
"""Create or clean up an authenticated user fixture for browser ingest QA."""

from __future__ import annotations

import argparse
import asyncio
import json
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[2]
BACKEND_DIR = ROOT / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Create/cleanup DocTalk browser ingest QA fixture.")
    sub = parser.add_subparsers(dest="command", required=True)

    create = sub.add_parser("create")
    create.add_argument("--plan", default="plus")
    create.add_argument("--json-out", required=True)

    cleanup = sub.add_parser("cleanup")
    cleanup.add_argument("--user-id", required=True)
    cleanup.add_argument("--json-out", required=True)
    return parser.parse_args()


async def create_user(plan: str) -> dict[str, Any]:
    from app.models.database import AsyncSessionLocal
    from app.services import auth_service

    email = f"qa-browser-ingest-{datetime.now(timezone.utc).strftime('%Y%m%d-%H%M%S')}-{uuid.uuid4().hex[:8]}@example.com"
    async with AsyncSessionLocal() as db:
        user = await auth_service.create_user(db, email=email, name="QA Browser Ingest")
        user.plan = plan
        await db.commit()
        await db.refresh(user)
        return {"id": str(user.id), "email": user.email, "name": user.name, "plan": user.plan}


async def delete_user(user_id: uuid.UUID) -> dict[str, int]:
    from sqlalchemy import func, select

    from app.models.database import AsyncSessionLocal
    from app.models.tables import Document, User
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
        return {"users": int(users or 0), "documents": int(docs or 0)}


def write_report(path: str, report: dict[str, Any]) -> None:
    out = Path(path)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main() -> None:
    args = parse_args()
    if args.command == "create":
        user = asyncio.run(create_user(args.plan))
        report = {
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "user": user,
            "result": "pass",
        }
        write_report(args.json_out, report)
        print(f"PASS: fixture created user={user['id']} plan={user['plan']}")
        return

    counts = asyncio.run(delete_user(uuid.UUID(args.user_id)))
    report = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "user_id": args.user_id,
        "cleanup_counts": counts,
        "result": "pass" if counts == {"users": 0, "documents": 0} else "fail",
    }
    write_report(args.json_out, report)
    print(f"PASS: cleanup user={args.user_id} counts={counts}")


if __name__ == "__main__":
    main()
