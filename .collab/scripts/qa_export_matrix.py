#!/usr/bin/env python3
"""Run session export workflow, gating, and boundary checks."""

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
    parser = argparse.ArgumentParser(description="Run DocTalk export QA matrix.")
    parser.add_argument("--api-base", default="http://127.0.0.1:8000")
    parser.add_argument("--file", default="test_inputs/semiconductor.pdf")
    parser.add_argument("--timeout", type=int, default=180)
    parser.add_argument("--poll-interval", type=float, default=3.0)
    parser.add_argument("--json-out")
    parser.add_argument("--keep", action="store_true")
    return parser.parse_args()


async def create_user(prefix: str, plan: str) -> dict[str, Any]:
    from app.models.database import AsyncSessionLocal
    from app.services import auth_service

    email = f"qa-export-{prefix}-{datetime.now(timezone.utc).strftime('%Y%m%d-%H%M%S')}-{uuid.uuid4().hex[:8]}@example.com"
    async with AsyncSessionLocal() as db:
        user = await auth_service.create_user(db, email=email, name=f"QA export {prefix}")
        if plan != getattr(user, "plan", "free"):
            user.plan = plan
            await db.commit()
            await db.refresh(user)
        return {"id": user.id, "email": user.email, "plan": user.plan}


async def delete_users(user_ids: list[uuid.UUID]) -> None:
    from sqlalchemy import select

    from app.models.database import AsyncSessionLocal
    from app.models.tables import Document, User
    from app.services.doc_service import doc_service

    async with AsyncSessionLocal() as db:
        for user_id in user_ids:
            doc_ids = (
                await db.scalars(select(Document.id).where(Document.user_id == user_id))
            ).all()
            for document_id in doc_ids:
                await doc_service.delete_document(document_id, db)
            user = await db.get(User, user_id)
            if user is not None:
                await db.delete(user)
        await db.commit()


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


async def insert_messages(
    session_id: str,
    document_id: str,
    filename: str,
    *,
    title: str,
    count: int = 2,
) -> None:
    from app.models.database import AsyncSessionLocal
    from app.models.tables import ChatSession, Message

    async with AsyncSessionLocal() as db:
        sess = await db.get(ChatSession, uuid.UUID(session_id))
        if sess is None:
            raise RuntimeError(f"Session {session_id} not found")
        sess.title = title
        db.add(sess)
        if count == 2:
            db.add(
                Message(
                    session_id=uuid.UUID(session_id),
                    role="user",
                    content="Summarize the semiconductor document.",
                    citations=None,
                    metadata_json={},
                )
            )
            db.add(
                Message(
                    session_id=uuid.UUID(session_id),
                    role="assistant",
                    content="The document includes a semiconductor reading list and notes. [1]",
                    citations=[
                        {
                            "ref_index": 1,
                            "document_id": document_id,
                            "document_filename": filename,
                            "page": 1,
                            "text_snippet": "semiconductor reading list",
                            "bboxes": [{"x": 0.1, "y": 0.2, "w": 0.3, "h": 0.1, "page": 1}],
                            "confidence_score": 0.91,
                        }
                    ],
                    metadata_json={},
                )
            )
        else:
            for idx in range(count):
                db.add(
                    Message(
                        session_id=uuid.UUID(session_id),
                        role="user" if idx % 2 == 0 else "assistant",
                        content=f"QA export validation message {idx + 1}",
                        citations=None,
                        metadata_json={},
                    )
                )
        await db.commit()


async def run(args: argparse.Namespace) -> dict[str, Any]:
    plus_user = await create_user("plus", "plus")
    free_user = await create_user("free", "free")
    other_user = await create_user("other", "free")
    plus_headers = {"Authorization": f"Bearer {token_for(plus_user['id'])}"}
    free_headers = {"Authorization": f"Bearer {token_for(free_user['id'])}"}
    other_headers = {"Authorization": f"Bearer {token_for(other_user['id'])}"}
    report: dict[str, Any] = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "api_base": args.api_base,
        "file": args.file,
        "users": {
            "plus": {"id": str(plus_user["id"]), "plan": plus_user["plan"]},
            "free": {"id": str(free_user["id"]), "plan": free_user["plan"]},
            "other": {"id": str(other_user["id"]), "plan": other_user["plan"]},
        },
        "checks": [],
        "cleanup": "pending",
    }

    try:
        async with httpx.AsyncClient(base_url=args.api_base, timeout=90.0) as client:
            health = await client.get("/health")
            report["health"] = {"status_code": health.status_code, "body": safe_json(health)}
            health.raise_for_status()

            file_path = ROOT / args.file
            plus_doc = await upload_and_wait(client, plus_headers, file_path, args.timeout, args.poll_interval)
            free_doc = await upload_and_wait(client, free_headers, file_path, args.timeout, args.poll_interval)
            report["documents"] = {"plus_doc": plus_doc, "free_doc": free_doc}

            plus_session = await create_session(client, plus_headers, plus_doc["document_id"])
            free_session = await create_session(client, free_headers, free_doc["document_id"])
            plus_large_session = await create_session(client, plus_headers, plus_doc["document_id"])
            report["sessions"] = {
                "plus_session": plus_session,
                "free_session": free_session,
                "plus_large_session": plus_large_session,
            }

            await insert_messages(
                plus_session["session_id"],
                plus_doc["document_id"],
                file_path.name,
                title='QA Export 文档 "bad"\r\nname',
            )
            await insert_messages(
                free_session["session_id"],
                free_doc["document_id"],
                file_path.name,
                title="QA Free Export",
            )
            await insert_messages(
                plus_large_session["session_id"],
                plus_doc["document_id"],
                file_path.name,
                title="QA Export Too Many Messages",
                count=501,
            )

            for fmt in ("md", "docx", "pdf"):
                res = await client.get(f"/api/sessions/{plus_session['session_id']}/export?format={fmt}", headers=plus_headers)
                report["checks"].append(export_check(f"plus_export_{fmt}", res, 200, fmt))

            res = await client.get(f"/api/sessions/{free_session['session_id']}/export?format=md", headers=free_headers)
            report["checks"].append(export_check("free_export_md_allowed", res, 200, "md"))
            for fmt in ("docx", "pdf"):
                res = await client.get(f"/api/sessions/{free_session['session_id']}/export?format={fmt}", headers=free_headers)
                body = safe_json(res)
                report["checks"].append(
                    check(
                        f"free_export_{fmt}_paid_gate",
                        res.status_code,
                        403,
                        body,
                        predicate=lambda body=body: error_code(body) == "EXPORT_REQUIRES_PAID_PLAN",
                    )
                )

            res = await client.get(f"/api/sessions/{plus_session['session_id']}/export?format=md", headers=other_headers)
            report["checks"].append(check("other_export_owner_session", res.status_code, 404, safe_json(res)))
            res = await client.get(f"/api/sessions/{plus_session['session_id']}/export?format=md")
            report["checks"].append(check("anon_export_requires_auth", res.status_code, 401, safe_json(res)))
            res = await client.get(f"/api/sessions/{plus_session['session_id']}/export?format=txt", headers=plus_headers)
            report["checks"].append(check("export_invalid_format_validation", res.status_code, 422, compact_body(safe_json(res))))
            res = await client.get(f"/api/sessions/{uuid.uuid4()}/export?format=md", headers=plus_headers)
            report["checks"].append(check("export_missing_session", res.status_code, 404, safe_json(res)))

            res = await client.get(f"/api/sessions/{plus_large_session['session_id']}/export?format=md", headers=plus_headers)
            body = safe_json(res)
            report["checks"].append(
                check(
                    "export_message_limit_validation",
                    res.status_code,
                    400,
                    body,
                    predicate=lambda: error_code(body) == "EXPORT_VALIDATION_FAILED"
                    and (body.get("detail") or {}).get("reason") == "MESSAGE_LIMIT_EXCEEDED",
                )
            )

        report["result"] = "pass" if all(c.get("result") == "pass" for c in report["checks"]) else "fail"
        return report
    except Exception as exc:
        report["result"] = "fail"
        report["error"] = f"{type(exc).__name__}: {exc}"
        raise
    finally:
        if args.keep:
            report["cleanup"] = "kept"
        else:
            try:
                await delete_users([plus_user["id"], free_user["id"], other_user["id"]])
                report["cleanup"] = "deleted qa users and owned docs"
            except Exception as cleanup_exc:
                report["cleanup"] = f"failed: {type(cleanup_exc).__name__}: {cleanup_exc}"
        if args.json_out:
            out = Path(args.json_out)
            out.parent.mkdir(parents=True, exist_ok=True)
            out.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


async def upload_and_wait(
    client: httpx.AsyncClient,
    headers: dict[str, str],
    path: Path,
    timeout: int,
    poll_interval: float,
) -> dict[str, Any]:
    started = time.monotonic()
    data = path.read_bytes()
    res = await client.post(
        "/api/documents/upload",
        headers=headers,
        files={"file": (path.name, data, "application/pdf")},
    )
    body = safe_json(res)
    res.raise_for_status()
    document_id = body["document_id"]
    final = await poll_ready(client, document_id, headers, timeout, poll_interval)
    return {
        "document_id": document_id,
        "filename": path.name,
        "upload_status": res.status_code,
        "ready_seconds": round(time.monotonic() - started, 3),
        "final": compact_doc(final["body"]),
        "polls": final["polls"],
    }


async def poll_ready(
    client: httpx.AsyncClient,
    document_id: str,
    headers: dict[str, str],
    timeout: int,
    poll_interval: float,
) -> dict[str, Any]:
    started = time.monotonic()
    deadline = started + timeout
    polls: list[dict[str, Any]] = []
    while time.monotonic() < deadline:
        res = await client.get(f"/api/documents/{document_id}", headers=headers)
        body = safe_json(res)
        status = body.get("status") if isinstance(body, dict) else None
        polls.append({
            "at_seconds": round(time.monotonic() - started, 3),
            "status_code": res.status_code,
            "status": status,
        })
        res.raise_for_status()
        if status == "ready":
            return {"body": body, "polls": polls}
        if status == "error":
            raise RuntimeError(f"Document ended with error: {body}")
        await asyncio.sleep(poll_interval)
    raise TimeoutError(f"Document {document_id} did not become ready within {timeout}s")


async def create_session(
    client: httpx.AsyncClient,
    headers: dict[str, str],
    document_id: str,
) -> dict[str, Any]:
    res = await client.post(f"/api/documents/{document_id}/sessions", headers=headers)
    body = safe_json(res)
    res.raise_for_status()
    return {
        "session_id": body["session_id"],
        "document_id": document_id,
        "status_code": res.status_code,
    }


def export_check(name: str, response: httpx.Response, expected_status: int, fmt: str) -> dict[str, Any]:
    body = response.content
    headers = {
        "content_type": response.headers.get("content-type"),
        "content_disposition": response.headers.get("content-disposition"),
        "content_length": len(body),
    }
    def ok() -> bool:
        if response.status_code != expected_status:
            return False
        cd = headers["content_disposition"] or ""
        if "\r" in cd or "\n" in cd:
            return False
        if "filename=" not in cd or "filename*=" not in cd:
            return False
        if fmt == "md":
            text = body.decode("utf-8", errors="replace")
            private_fields_absent = all(
                field not in text
                for field in ("document_id", "bboxes", "confidence_score")
            )
            return (
                "text/markdown" in (headers["content_type"] or "")
                and "**Q:**" in text
                and "## References" in text
                and "semiconductor reading list" in text
                and private_fields_absent
            )
        if fmt == "docx":
            return (
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                in (headers["content_type"] or "")
                and body.startswith(b"PK")
                and len(body) > 1000
            )
        if fmt == "pdf":
            return (
                "application/pdf" in (headers["content_type"] or "")
                and body.startswith(b"%PDF")
                and len(body) > 1000
            )
        return False

    result = {
        "name": name,
        "actual_status": response.status_code,
        "expected_status": expected_status,
        "result": "pass" if ok() else "fail",
        "headers": headers,
    }
    if response.status_code != expected_status:
        result["body"] = compact_body(safe_json(response))
    elif fmt == "md":
        result["body_preview"] = body.decode("utf-8", errors="replace")[:500]
    return result


def check(
    name: str,
    actual_status: int,
    expected_status: int,
    body: Any,
    *,
    predicate=None,
) -> dict[str, Any]:
    ok = actual_status == expected_status
    if predicate is not None:
        try:
            ok = ok and bool(predicate())
        except Exception:
            ok = False
    return {
        "name": name,
        "actual_status": actual_status,
        "expected_status": expected_status,
        "result": "pass" if ok else "fail",
        "body": compact_body(body),
    }


def error_code(body: Any) -> str | None:
    if not isinstance(body, dict):
        return None
    detail = body.get("detail")
    if isinstance(detail, dict):
        return detail.get("error")
    if isinstance(body.get("error"), str):
        return body["error"]
    return None


def compact_doc(body: dict[str, Any]) -> dict[str, Any]:
    keys = ["id", "filename", "status", "page_count", "pages_parsed", "chunks_total", "chunks_indexed", "error_msg", "file_type"]
    return {k: body.get(k) for k in keys if k in body}


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


def main() -> None:
    args = parse_args()
    try:
        report = asyncio.run(run(args))
    except Exception as exc:
        print(f"FAIL: {type(exc).__name__}: {exc}", file=sys.stderr)
        raise SystemExit(1)
    failed = [c["name"] for c in report["checks"] if c.get("result") != "pass"]
    if failed:
        print(f"FAIL: {len(failed)} checks failed: {', '.join(failed)}", file=sys.stderr)
        raise SystemExit(1)
    print(f"PASS: {len(report['checks'])} export checks; cleanup={report['cleanup']}")


if __name__ == "__main__":
    main()
