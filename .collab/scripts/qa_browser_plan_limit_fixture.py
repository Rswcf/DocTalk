#!/usr/bin/env python3
"""Create or clean up a Free-plan document-limit fixture for browser QA."""

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
    parser = argparse.ArgumentParser(description="Create/cleanup Free-plan document limit browser QA fixture.")
    sub = parser.add_subparsers(dest="command", required=True)
    create = sub.add_parser("create")
    create.add_argument("--json-out", required=True)
    cleanup = sub.add_parser("cleanup")
    cleanup.add_argument("--user-id", required=True)
    cleanup.add_argument("--json-out", required=True)
    return parser.parse_args()


async def create_fixture(_args: argparse.Namespace) -> dict[str, Any]:
    from app.core.config import settings
    from app.models.database import AsyncSessionLocal
    from app.models.tables import Document, Page
    from app.services import auth_service

    email = f"qa-browser-plan-limit-{datetime.now(timezone.utc).strftime('%Y%m%d-%H%M%S')}-{uuid.uuid4().hex[:8]}@example.com"
    async with AsyncSessionLocal() as db:
        user = await auth_service.create_user(db, email=email, name="QA Browser Plan Limit")
        user.plan = "free"
        max_docs = int(settings.FREE_MAX_DOCUMENTS)
        docs = []
        for idx in range(max_docs):
            doc_id = uuid.uuid4()
            doc = Document(
                id=doc_id,
                filename=f"qa-free-limit-existing-{idx + 1}.txt",
                file_size=128,
                storage_key=f"qa/browser-plan-limit/{doc_id}/existing-{idx + 1}.txt",
                status="ready",
                page_count=1,
                pages_parsed=1,
                chunks_total=0,
                chunks_indexed=0,
                user_id=user.id,
                file_type="txt",
                summary="Synthetic document occupying the Free plan document limit.",
                suggested_questions=[],
            )
            db.add(doc)
            db.add(Page(document_id=doc_id, page_number=1, content="Synthetic Free plan limit fixture."))
            docs.append({"id": str(doc_id), "filename": doc.filename})
        await db.commit()
        await db.refresh(user)

    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "result": "pass",
        "user": {"id": str(user.id), "email": user.email, "name": user.name, "plan": user.plan},
        "max_documents": max_docs,
        "documents": docs,
    }


async def cleanup(user_id: str) -> dict[str, Any]:
    from app.models.database import AsyncSessionLocal
    from app.models.tables import Document, User

    uid = uuid.UUID(user_id)
    async with AsyncSessionLocal() as db:
        doc_ids = (await db.scalars(select(Document.id).where(Document.user_id == uid))).all()
        for doc_id in doc_ids:
            doc = await db.get(Document, doc_id)
            if doc is not None:
                await db.delete(doc)
        user = await db.get(User, uid)
        if user is not None:
            await db.delete(user)
        await db.commit()

    async with AsyncSessionLocal() as db:
        users = await db.scalar(select(func.count()).select_from(User).where(User.id == uid))
        docs = await db.scalar(select(func.count()).select_from(Document).where(Document.user_id == uid))
    return {"result": "pass", "user_id": user_id, "users": int(users or 0), "documents": int(docs or 0)}


def write_report(path: str, report: dict[str, Any]) -> None:
    out = Path(path)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main() -> None:
    args = parse_args()
    if args.command == "create":
        report = asyncio.run(create_fixture(args))
        write_report(args.json_out, report)
        print(f"created plan-limit fixture user={report['user']['id']} docs={len(report['documents'])}")
    elif args.command == "cleanup":
        report = asyncio.run(cleanup(args.user_id))
        write_report(args.json_out, report)
        print(f"cleanup users={report['users']} documents={report['documents']}")


if __name__ == "__main__":
    main()
