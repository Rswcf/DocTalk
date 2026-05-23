#!/usr/bin/env python3
"""Create or clean up a long-PDF reader fixture for browser performance QA."""

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
from sqlalchemy import select

ROOT = Path(__file__).resolve().parents[2]
BACKEND_DIR = ROOT / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Create/cleanup long PDF browser QA fixture.")
    sub = parser.add_subparsers(dest="command", required=True)

    create = sub.add_parser("create")
    create.add_argument("--api-base", default="http://127.0.0.1:8000")
    create.add_argument("--file", default="test_inputs/ssrn-3247865.pdf")
    create.add_argument("--min-target-page", type=int, default=300)
    create.add_argument("--timeout", type=int, default=600)
    create.add_argument("--poll-interval", type=float, default=3.0)
    create.add_argument("--json-out", required=True)

    cleanup = sub.add_parser("cleanup")
    cleanup.add_argument("--user-id", required=True)
    cleanup.add_argument("--json-out", required=True)
    return parser.parse_args()


async def create_user() -> dict[str, Any]:
    from app.models.database import AsyncSessionLocal
    from app.services import auth_service

    email = f"qa-browser-long-pdf-{datetime.now(timezone.utc).strftime('%Y%m%d-%H%M%S')}-{uuid.uuid4().hex[:8]}@example.com"
    async with AsyncSessionLocal() as db:
        user = await auth_service.create_user(db, email=email, name="QA Browser Long PDF")
        user.plan = "pro"
        user.credits_balance = 20000
        await db.commit()
        await db.refresh(user)
        return {"id": user.id, "email": user.email, "name": user.name, "plan": user.plan}


async def delete_user(user_id: uuid.UUID) -> dict[str, int]:
    from sqlalchemy import func

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


async def create_fixture(args: argparse.Namespace) -> dict[str, Any]:
    user = await create_user()
    headers = {"Authorization": f"Bearer {token_for(user['id'])}"}
    file_path = ROOT / args.file
    report: dict[str, Any] = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "api_base": args.api_base,
        "file": args.file,
        "min_target_page": args.min_target_page,
        "user": {"id": str(user["id"]), "email": user["email"], "name": user["name"], "plan": user["plan"]},
    }
    async with httpx.AsyncClient(base_url=args.api_base, timeout=120.0) as client:
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

    chunk = await select_late_chunk(uuid.UUID(document_id), args.min_target_page)
    session_id = await insert_messages(
        user_id=user["id"],
        document_id=uuid.UUID(document_id),
        filename=file_path.name,
        chunk=chunk,
    )
    report["document_id"] = document_id
    report["session_id"] = str(session_id)
    report["target"] = {
        "chunk_id": str(chunk["id"]),
        "page": chunk["page"],
        "text_preview": chunk["text"][:500],
        "bboxes_count": len(chunk["bboxes"]),
    }
    report["result"] = "pass"
    return report


async def select_late_chunk(document_id: uuid.UUID, min_page: int) -> dict[str, Any]:
    from app.models.database import AsyncSessionLocal
    from app.models.tables import Chunk

    async with AsyncSessionLocal() as db:
        rows = await db.execute(
            select(Chunk)
            .where(Chunk.document_id == document_id)
            .where(Chunk.page_start >= min_page)
            .order_by(Chunk.page_start.desc(), Chunk.chunk_index.desc())
        )
        chunks = list(rows.scalars())

    for chunk in chunks:
        bboxes = chunk.bboxes or []
        text = (chunk.text or "").strip()
        if len(text) >= 120 and isinstance(bboxes, list) and bboxes:
            return {
                "id": chunk.id,
                "page": int(chunk.page_start or min_page),
                "page_end": int(chunk.page_end or chunk.page_start or min_page),
                "text": text,
                "bboxes": bboxes,
            }
    raise RuntimeError(f"No late chunk with bboxes found for document={document_id} min_page={min_page}")


async def insert_messages(
    *,
    user_id: uuid.UUID,
    document_id: uuid.UUID,
    filename: str,
    chunk: dict[str, Any],
) -> uuid.UUID:
    from app.models.database import AsyncSessionLocal
    from app.models.tables import ChatSession, Message

    session_id = uuid.uuid4()
    now = datetime.now(timezone.utc)
    async with AsyncSessionLocal() as db:
        db.add(
            ChatSession(
                id=session_id,
                document_id=document_id,
                user_id=user_id,
                title="QA long PDF late citation",
                created_at=now,
                updated_at=now,
            )
        )
        db.add(
            Message(
                session_id=session_id,
                role="user",
                content="Show me a cited point from late in this long academic PDF.",
                citations=None,
                metadata_json={},
            )
        )
        db.add(
            Message(
                session_id=session_id,
                role="assistant",
                content=(
                    f"This deterministic QA answer cites a late-page passage from page {chunk['page']} "
                    "so the browser can verify long-PDF citation jumping and virtualization. [1]"
                ),
                citations=[
                    {
                        "ref_index": 1,
                        "chunk_id": str(chunk["id"]),
                        "document_id": str(document_id),
                        "document_filename": filename,
                        "page": chunk["page"],
                        "page_end": chunk["page_end"],
                        "text_snippet": chunk["text"][:500],
                        "bboxes": chunk["bboxes"],
                        "confidence_score": 0.9,
                    }
                ],
                metadata_json={},
            )
        )
        await db.commit()
    return session_id


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
                "pages_parsed": body.get("pages_parsed") if isinstance(body, dict) else None,
            }
        )
        res.raise_for_status()
        if body.get("status") in {"ready", "error"}:
            return {"body": body, "polls": polls}
        await asyncio.sleep(poll_interval)
    raise TimeoutError(f"Document {document_id} did not reach ready/error within {timeout}s")


def compact_doc(body: dict[str, Any]) -> dict[str, Any]:
    keys = [
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
    return {key: body.get(key) for key in keys if key in body}


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
            "PASS: long PDF fixture created user={user} doc={doc} session={session} page={page}".format(
                user=report["user"]["id"],
                doc=report["document_id"],
                session=report["session_id"],
                page=report["target"]["page"],
            )
        )
    elif args.command == "cleanup":
        counts = asyncio.run(delete_user(uuid.UUID(args.user_id)))
        report = {
            "user_id": args.user_id,
            "cleanup_counts": counts,
            "result": "pass" if counts == {"users": 0, "documents": 0} else "fail",
        }
        write_report(args.json_out, report)
        print(f"PASS: cleanup user={args.user_id} counts={counts}")


if __name__ == "__main__":
    main()
