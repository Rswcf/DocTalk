#!/usr/bin/env python3
"""Create or clean up an authenticated chat sharing fixture for browser UX QA."""

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


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Create/cleanup DocTalk browser chat sharing QA fixture.")
    sub = parser.add_subparsers(dest="command", required=True)

    create = sub.add_parser("create")
    create.add_argument("--api-base", default="http://127.0.0.1:8000")
    create.add_argument("--file", default="test_inputs/semiconductor.pdf")
    create.add_argument("--plan", default="plus")
    create.add_argument("--timeout", type=int, default=180)
    create.add_argument("--poll-interval", type=float, default=2.0)
    create.add_argument("--json-out", required=True)

    cleanup = sub.add_parser("cleanup")
    cleanup.add_argument("--user-id", required=True)
    cleanup.add_argument("--json-out", required=True)
    return parser.parse_args()


async def create_user(plan: str) -> dict[str, Any]:
    from app.models.database import AsyncSessionLocal
    from app.services import auth_service

    stamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
    email = f"qa-browser-chat-share-{stamp}-{uuid.uuid4().hex[:8]}@example.com"
    async with AsyncSessionLocal() as db:
        user = await auth_service.create_user(db, email=email, name="QA Browser Chat Share")
        user.plan = plan
        await db.commit()
        await db.refresh(user)
        return {"id": str(user.id), "email": user.email, "name": user.name, "plan": user.plan}


async def delete_user(user_id: uuid.UUID) -> dict[str, int]:
    from sqlalchemy import func, select

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


async def create_fixture(args: argparse.Namespace) -> dict[str, Any]:
    from app.core.config import settings

    user = await create_user(args.plan)
    headers = {"Authorization": f"Bearer {token_for(user['id'])}"}
    file_path = ROOT / args.file
    report: dict[str, Any] = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "api_base": args.api_base,
        "frontend_url": settings.FRONTEND_URL,
        "file": args.file,
        "user": user,
    }
    async with httpx.AsyncClient(base_url=args.api_base, timeout=90.0) as client:
        health = await client.get("/health")
        report["health"] = {"status_code": health.status_code, "body": safe_json(health)}
        health.raise_for_status()

        upload = await client.post(
            "/api/documents/upload",
            headers=headers,
            files={"file": (file_path.name, file_path.read_bytes(), "application/pdf")},
        )
        upload_body = safe_json(upload)
        report["upload"] = {"status_code": upload.status_code, "body": upload_body}
        upload.raise_for_status()
        document_id = upload_body["document_id"]

        final = await poll_ready(client, headers, document_id, args.timeout, args.poll_interval)
        report["document"] = compact_doc(final["body"])
        report["polls"] = final["polls"]
        if final["body"].get("status") != "ready":
            raise RuntimeError(f"document did not become ready: {final['body']}")

        session_res = await client.post(f"/api/documents/{document_id}/sessions", headers=headers)
        session_body = safe_json(session_res)
        report["session"] = {"status_code": session_res.status_code, "body": session_body}
        session_res.raise_for_status()
        session_id = session_body["session_id"]

        search = await client.post(
            f"/api/documents/{document_id}/search",
            headers=headers,
            json={"query": "semiconductor", "top_k": 1},
        )
        search_body = safe_json(search)
        report["search"] = {"status_code": search.status_code, "body": compact_body(search_body)}
        search.raise_for_status()
        results = search_body.get("results") or []
        if not results:
            raise RuntimeError("fixture search returned no results")
        chunk = results[0]

    inserted = await insert_messages(
        session_id=session_id,
        document_id=document_id,
        filename=file_path.name,
        chunk=chunk,
    )
    report["document_id"] = document_id
    report["session_id"] = session_id
    report["chunk_id"] = str(chunk["chunk_id"])
    report.update(inserted)
    report["result"] = "pass"
    return report


async def insert_messages(session_id: str, document_id: str, filename: str, chunk: dict[str, Any]) -> dict[str, str]:
    from app.models.database import AsyncSessionLocal
    from app.models.tables import ChatSession, Message
    from app.services.share_anchor_service import message_share_anchor

    async with AsyncSessionLocal() as db:
        sess = await db.get(ChatSession, uuid.UUID(session_id))
        if sess is None:
            raise RuntimeError(f"session not found: {session_id}")
        sess.title = "QA chat share browser session"
        db.add(sess)
        user_msg = Message(
            session_id=uuid.UUID(session_id),
            role="user",
            content="Summarize the semiconductor document with one citation.",
            citations=None,
            metadata_json={},
        )
        assistant_msg = Message(
            session_id=uuid.UUID(session_id),
            role="assistant",
            content="The document contains a semiconductor reading list and related market notes. [1]",
            citations=[
                {
                    "ref_index": 1,
                    "chunk_id": str(chunk["chunk_id"]),
                    "document_id": document_id,
                    "document_filename": filename,
                    "page": int(chunk.get("page") or 1),
                    "page_end": int(chunk.get("page_end") or chunk.get("page") or 1),
                    "text_snippet": str(chunk.get("text") or "")[:400],
                    "bboxes": chunk.get("bboxes") or [{"x": 0.08, "y": 0.12, "w": 0.36, "h": 0.08}],
                    "confidence_score": 0.91,
                }
            ],
            metadata_json={},
        )
        db.add(user_msg)
        db.add(assistant_msg)
        await db.flush()
        assistant_id = str(assistant_msg.id)
        await db.commit()
        return {
            "assistant_message_id": assistant_id,
            "assistant_anchor": message_share_anchor(assistant_id),
        }


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
        for key in ["id", "filename", "status", "page_count", "pages_parsed", "chunks_total", "chunks_indexed", "error_msg", "file_type"]
        if key in body
    }


def compact_body(body: Any) -> Any:
    text = json.dumps(body, ensure_ascii=False, default=str)
    if len(text) <= 1200:
        return body
    return {"truncated_json": text[:1200]}


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
        report = {
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "user_id": args.user_id,
            "cleanup": await delete_user(uuid.UUID(args.user_id)),
        }
        report["result"] = "pass" if all(value == 0 for value in report["cleanup"].values()) else "fail"
    write_report(args.json_out, report)
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    asyncio.run(async_main())
