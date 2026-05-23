#!/usr/bin/env python3
"""Create or clean up authenticated app-workflow fixtures for browser UX QA."""

from __future__ import annotations

import argparse
import asyncio
import json
import sys
import time
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

import httpx
from jose import jwt

ROOT = Path(__file__).resolve().parents[2]
BACKEND_DIR = ROOT / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))


DEFAULT_FILES = [
    "test_inputs/semiconductor.pdf",
    "test_inputs/charting_library_license_agreement.pdf",
]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Create/cleanup DocTalk browser app-workflow QA fixture.")
    sub = parser.add_subparsers(dest="command", required=True)

    create = sub.add_parser("create")
    create.add_argument("--api-base", default="http://127.0.0.1:8000")
    create.add_argument("--file", dest="files", action="append", default=None)
    create.add_argument("--plan", default="pro")
    create.add_argument("--credits", type=int, default=20000)
    create.add_argument("--timeout", type=int, default=180)
    create.add_argument("--poll-interval", type=float, default=2.0)
    create.add_argument("--json-out", required=True)

    cleanup = sub.add_parser("cleanup")
    cleanup.add_argument("--user-id", required=True)
    cleanup.add_argument("--json-out", required=True)
    return parser.parse_args()


async def create_user(plan: str, credits: int) -> dict[str, Any]:
    from app.models.database import AsyncSessionLocal
    from app.services import auth_service

    email = f"qa-browser-app-{datetime.now(timezone.utc).strftime('%Y%m%d-%H%M%S')}-{uuid.uuid4().hex[:8]}@example.com"
    async with AsyncSessionLocal() as db:
        user = await auth_service.create_user(db, email=email, name="QA Browser App Workflows")
        user.plan = plan
        user.credits_balance = credits
        await db.commit()
        await db.refresh(user)
        return {
            "id": str(user.id),
            "email": user.email,
            "name": user.name,
            "plan": user.plan,
            "credits_balance": user.credits_balance,
        }


async def delete_user(user_id: uuid.UUID) -> dict[str, int]:
    from sqlalchemy import func, select

    from app.models.database import AsyncSessionLocal
    from app.models.tables import ChatSession, Collection, Document, User
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
        collections = await db.scalar(select(func.count()).select_from(Collection).where(Collection.user_id == user_id))
        sessions = await db.scalar(select(func.count()).select_from(ChatSession).where(ChatSession.user_id == user_id))
        return {
            "users": int(users or 0),
            "documents": int(docs or 0),
            "collections": int(collections or 0),
            "sessions": int(sessions or 0),
        }


def token_for(user_id: str) -> str:
    from app.core.config import settings

    if not settings.AUTH_SECRET:
        raise RuntimeError("AUTH_SECRET is required")
    now = datetime.now(timezone.utc)
    return jwt.encode(
        {
            "sub": user_id,
            "iat": int(now.timestamp()),
            "exp": int((now + timedelta(hours=2)).timestamp()),
        },
        settings.AUTH_SECRET,
        algorithm="HS256",
    )


async def upload_document(
    client: httpx.AsyncClient,
    headers: dict[str, str],
    file_path: Path,
    timeout: int,
    poll_interval: float,
) -> dict[str, Any]:
    upload = await client.post(
        "/api/documents/upload",
        headers=headers,
        files={"file": (file_path.name, file_path.read_bytes(), "application/pdf")},
    )
    upload_body = safe_json(upload)
    upload.raise_for_status()
    document_id = upload_body["document_id"]
    final = await poll_ready(client, headers, document_id, timeout, poll_interval)
    if final["body"].get("status") != "ready":
        raise RuntimeError(f"document did not become ready: {final['body']}")
    return {
        "file": str(file_path.relative_to(ROOT)),
        "upload_status_code": upload.status_code,
        "upload_body": upload_body,
        "document": compact_doc(final["body"]),
        "polls": final["polls"],
    }


async def create_fixture(args: argparse.Namespace) -> dict[str, Any]:
    files = args.files or DEFAULT_FILES
    user = await create_user(args.plan, args.credits)
    headers = {"Authorization": f"Bearer {token_for(user['id'])}"}
    report: dict[str, Any] = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "api_base": args.api_base,
        "files": files,
        "user": user,
        "documents": [],
    }
    async with httpx.AsyncClient(base_url=args.api_base, timeout=90.0) as client:
        health = await client.get("/health")
        report["health"] = {"status_code": health.status_code, "body": safe_json(health)}
        health.raise_for_status()
        for rel_path in files:
            uploaded = await upload_document(
                client=client,
                headers=headers,
                file_path=ROOT / rel_path,
                timeout=args.timeout,
                poll_interval=args.poll_interval,
            )
            report["documents"].append(uploaded)
    report["document_ids"] = [item["document"]["id"] for item in report["documents"]]
    report["result"] = "pass"
    return report


async def poll_ready(
    client: httpx.AsyncClient,
    headers: dict[str, str],
    document_id: str,
    timeout: int,
    poll_interval: float,
) -> dict[str, Any]:
    started = time.monotonic()
    deadline = started + timeout
    polls = []
    while time.monotonic() < deadline:
        res = await client.get(f"/api/documents/{document_id}", headers=headers)
        body = safe_json(res)
        polls.append(
            {
                "at_seconds": round(time.monotonic() - started, 3),
                "status_code": res.status_code,
                "status": body.get("status") if isinstance(body, dict) else None,
                "pages_parsed": body.get("pages_parsed") if isinstance(body, dict) else None,
                "chunks_indexed": body.get("chunks_indexed") if isinstance(body, dict) else None,
            }
        )
        res.raise_for_status()
        if body.get("status") in {"ready", "error"}:
            return {"body": body, "polls": polls}
        await asyncio.sleep(poll_interval)
    raise TimeoutError(f"Document {document_id} did not reach ready/error within {timeout}s")


def compact_doc(body: dict[str, Any]) -> dict[str, Any]:
    return {
        key: body.get(key)
        for key in [
            "id",
            "filename",
            "status",
            "page_count",
            "pages_parsed",
            "chunks_total",
            "chunks_indexed",
            "error_msg",
            "file_type",
        ]
        if key in body
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


def main() -> None:
    args = parse_args()
    if args.command == "create":
        report = asyncio.run(create_fixture(args))
        write_report(args.json_out, report)
        print(
            "PASS: app-workflow fixture created "
            f"user={report['user']['id']} docs={len(report['documents'])}"
        )
        return

    counts = asyncio.run(delete_user(uuid.UUID(args.user_id)))
    report = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "user_id": args.user_id,
        "cleanup_counts": counts,
        "result": "pass" if all(value == 0 for value in counts.values()) else "fail",
    }
    write_report(args.json_out, report)
    print(f"PASS: cleanup user={args.user_id} counts={counts}")


if __name__ == "__main__":
    main()
