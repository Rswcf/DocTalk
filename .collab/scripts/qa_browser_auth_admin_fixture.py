#!/usr/bin/env python3
"""Create or clean up users for authenticated auth/admin browser UX QA."""

from __future__ import annotations

import argparse
import asyncio
import json
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import httpx
from sqlalchemy import select

ROOT = Path(__file__).resolve().parents[2]
BACKEND_DIR = ROOT / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Create/cleanup DocTalk auth/admin browser QA fixture.")
    sub = parser.add_subparsers(dest="command", required=True)

    create = sub.add_parser("create")
    create.add_argument("--api-base", default="http://127.0.0.1:8000")
    create.add_argument("--json-out", required=True)

    cleanup = sub.add_parser("cleanup")
    cleanup.add_argument("--regular-user-id", required=True)
    cleanup.add_argument("--admin-user-id", required=True)
    cleanup.add_argument("--admin-created", action="store_true")
    cleanup.add_argument("--json-out", required=True)
    return parser.parse_args()


async def user_by_email(email: str):
    from app.models.database import AsyncSessionLocal
    from app.models.tables import User

    async with AsyncSessionLocal() as db:
        return (await db.scalars(select(User).where(User.email == email))).first()


async def create_user(email: str, name: str, plan: str = "free") -> dict[str, Any]:
    from app.models.database import AsyncSessionLocal
    from app.services import auth_service

    async with AsyncSessionLocal() as db:
        user = await auth_service.create_user(db, email=email, name=name)
        user.plan = plan
        await db.commit()
        await db.refresh(user)
        return as_user(user)


async def delete_user(user_id: uuid.UUID) -> dict[str, int]:
    from sqlalchemy import func

    from app.models.database import AsyncSessionLocal
    from app.models.tables import ChatSession, Document, SharedSession, User
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
        shares = await db.scalar(select(func.count()).select_from(SharedSession).where(SharedSession.user_id == user_id))
        return {
            "users": int(users or 0),
            "documents": int(docs or 0),
            "sessions": int(sessions or 0),
            "shared_sessions": int(shares or 0),
        }


def as_user(user: Any) -> dict[str, Any]:
    return {
        "id": str(user.id),
        "email": user.email,
        "name": user.name,
        "plan": user.plan,
    }


async def create_fixture(args: argparse.Namespace) -> dict[str, Any]:
    from app.core.config import settings

    admin_emails = [email.strip() for email in settings.ADMIN_EMAILS.split(",") if email.strip()]
    if not admin_emails:
        raise RuntimeError("ADMIN_EMAILS is required for admin browser QA")
    admin_email = admin_emails[0]

    health_body: Any = None
    async with httpx.AsyncClient(base_url=args.api_base, timeout=30.0) as client:
        health = await client.get("/health")
        health_body = safe_json(health)
        health.raise_for_status()

    existing_admin = await user_by_email(admin_email)
    admin_created = existing_admin is None
    admin = (
        await create_user(admin_email, "QA Browser Admin", "pro")
        if admin_created
        else as_user(existing_admin)
    )

    stamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
    regular = await create_user(
        email=f"qa-browser-auth-admin-{stamp}-{uuid.uuid4().hex[:8]}@example.com",
        name="QA Browser Non Admin",
        plan="free",
    )

    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "api_base": args.api_base,
        "health": health_body,
        "admin_email": admin_email,
        "admin_created": admin_created,
        "admin_user": admin,
        "regular_user": regular,
        "result": "pass",
    }


def safe_json(response: httpx.Response) -> Any:
    try:
        return response.json()
    except Exception:
        return {"text": response.text[:1000]}


def write_report(path: str, report: dict[str, Any]) -> None:
    out = Path(path)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


async def async_main() -> None:
    args = parse_args()
    if args.command == "create":
        report = await create_fixture(args)
    else:
        regular_cleanup = await delete_user(uuid.UUID(args.regular_user_id))
        admin_cleanup = (
            await delete_user(uuid.UUID(args.admin_user_id))
            if args.admin_created
            else {"users": "preexisting-not-deleted"}
        )
        report = {
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "regular_user_id": args.regular_user_id,
            "admin_user_id": args.admin_user_id,
            "admin_created": args.admin_created,
            "regular_cleanup": regular_cleanup,
            "admin_cleanup": admin_cleanup,
        }
        regular_ok = all(value == 0 for value in regular_cleanup.values())
        admin_ok = (
            all(value == 0 for value in admin_cleanup.values())
            if args.admin_created
            else admin_cleanup["users"] == "preexisting-not-deleted"
        )
        report["result"] = "pass" if regular_ok and admin_ok else "fail"
    write_report(args.json_out, report)
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    asyncio.run(async_main())
