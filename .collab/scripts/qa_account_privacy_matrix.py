#!/usr/bin/env python3
"""Run user profile, data export, rate-limit, and account deletion checks."""

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
    parser = argparse.ArgumentParser(description="Run DocTalk account privacy QA matrix.")
    parser.add_argument("--api-base", default="http://127.0.0.1:8000")
    parser.add_argument("--file", default="test_inputs/semiconductor.pdf")
    parser.add_argument("--timeout", type=int, default=180)
    parser.add_argument("--poll-interval", type=float, default=3.0)
    parser.add_argument("--json-out")
    parser.add_argument("--keep", action="store_true")
    return parser.parse_args()


async def create_user(prefix: str, plan: str = "free") -> dict[str, Any]:
    from app.models.database import AsyncSessionLocal
    from app.services import auth_service

    email = f"qa-account-{prefix}-{datetime.now(timezone.utc).strftime('%Y%m%d-%H%M%S')}-{uuid.uuid4().hex[:8]}@example.com"
    async with AsyncSessionLocal() as db:
        user = await auth_service.create_user(db, email=email, name=f"QA account {prefix}")
        if plan != getattr(user, "plan", "free"):
            user.plan = plan
            await db.commit()
            await db.refresh(user)
        return {"id": user.id, "email": user.email, "plan": user.plan}


async def cleanup_user(user_id: uuid.UUID) -> None:
    from sqlalchemy import select

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


async def account_counts(user_id: uuid.UUID) -> dict[str, int]:
    from sqlalchemy import func, select

    from app.models.database import AsyncSessionLocal
    from app.models.tables import ChatSession, CreditLedger, Document, Message, User

    async with AsyncSessionLocal() as db:
        users = await db.scalar(select(func.count()).select_from(User).where(User.id == user_id))
        docs = await db.scalar(select(func.count()).select_from(Document).where(Document.user_id == user_id))
        sessions = await db.scalar(select(func.count()).select_from(ChatSession).where(ChatSession.user_id == user_id))
        ledger = await db.scalar(select(func.count()).select_from(CreditLedger).where(CreditLedger.user_id == user_id))
        messages = await db.scalar(
            select(func.count())
            .select_from(Message)
            .join(ChatSession, Message.session_id == ChatSession.id)
            .where(ChatSession.user_id == user_id)
        )
        return {
            "users": int(users or 0),
            "documents": int(docs or 0),
            "sessions": int(sessions or 0),
            "messages": int(messages or 0),
            "credit_ledger": int(ledger or 0),
        }


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


async def insert_messages(session_id: str) -> None:
    from app.models.database import AsyncSessionLocal
    from app.models.tables import Message

    async with AsyncSessionLocal() as db:
        db.add(
            Message(
                session_id=uuid.UUID(session_id),
                role="user",
                content="Please summarize this document for data export.",
                citations=None,
                metadata_json={},
            )
        )
        db.add(
            Message(
                session_id=uuid.UUID(session_id),
                role="assistant",
                content="This is a QA account export answer.",
                citations=[],
                metadata_json={},
            )
        )
        await db.commit()


async def run(args: argparse.Namespace) -> dict[str, Any]:
    user = await create_user("owner", "free")
    headers = {"Authorization": f"Bearer {token_for(user['id'])}"}
    deleted_via_api = False
    report: dict[str, Any] = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "api_base": args.api_base,
        "file": args.file,
        "user": {"id": str(user["id"]), "email": user["email"], "plan": user["plan"]},
        "checks": [],
        "cleanup": "pending",
    }

    try:
        async with httpx.AsyncClient(base_url=args.api_base, timeout=60.0) as client:
            health = await client.get("/health")
            report["health"] = {"status_code": health.status_code, "body": safe_json(health)}
            health.raise_for_status()

            doc = await upload_and_wait(client, headers, ROOT / args.file, args.timeout, args.poll_interval)
            session = await create_session(client, headers, doc["document_id"])
            await insert_messages(session["session_id"])
            report["document"] = doc
            report["session"] = session
            report["counts_before_delete"] = await account_counts(user["id"])

            res = await client.get("/api/users/me", headers=headers)
            me_body = safe_json(res)
            report["checks"].append(
                check(
                    "get_me",
                    res.status_code,
                    200,
                    me_body,
                    predicate=lambda: me_body.get("id") == str(user["id"]) and me_body.get("email") == user["email"],
                )
            )
            res = await client.get("/api/users/profile", headers=headers)
            profile_body = safe_json(res)
            report["checks"].append(
                check(
                    "get_profile_stats",
                    res.status_code,
                    200,
                    compact_body(profile_body),
                    predicate=lambda: (profile_body.get("stats") or {}).get("total_documents") == 1
                    and (profile_body.get("stats") or {}).get("total_sessions") == 1
                    and (profile_body.get("stats") or {}).get("total_messages") == 2,
                )
            )
            res = await client.get("/api/users/usage-breakdown", headers=headers)
            usage_body = safe_json(res)
            report["checks"].append(
                check(
                    "get_usage_breakdown_empty",
                    res.status_code,
                    200,
                    usage_body,
                    predicate=lambda: usage_body.get("by_mode") == [],
                )
            )

            res = await client.get("/api/users/me/export", headers=headers)
            export_body = safe_json(res)
            report["checks"].append(
                check(
                    "export_my_data",
                    res.status_code,
                    200,
                    compact_export(export_body),
                    predicate=lambda: export_body.get("user", {}).get("id") == str(user["id"])
                    and len(export_body.get("documents", [])) == 1
                    and len(export_body.get("conversations", [])) == 1
                    and len((export_body.get("conversations") or [{}])[0].get("messages", [])) == 2
                    and len(export_body.get("credit_history", [])) >= 1
                    and "attachment;" in (res.headers.get("content-disposition") or ""),
                )
            )
            res = await client.get("/api/users/me/export", headers=headers)
            rate_body = safe_json(res)
            report["checks"].append(
                check(
                    "export_my_data_rate_limit",
                    res.status_code,
                    429,
                    rate_body,
                    predicate=lambda: rate_body.get("error") == "EXPORT_RATE_LIMITED" and "retry-after" in {k.lower() for k in res.headers.keys()},
                )
            )
            res = await client.get("/api/users/me/export")
            report["checks"].append(check("anon_export_my_data_requires_auth", res.status_code, 401, safe_json(res)))

            res = await client.delete("/api/users/me", headers=headers)
            delete_body = safe_json(res)
            deleted_via_api = res.status_code == 200
            report["checks"].append(
                check(
                    "delete_my_account",
                    res.status_code,
                    200,
                    delete_body,
                    predicate=lambda: delete_body.get("deleted") is True,
                )
            )
            report["counts_after_delete"] = await account_counts(user["id"])
            report["checks"].append(
                check(
                    "account_rows_removed_after_delete",
                    200,
                    200,
                    report["counts_after_delete"],
                    predicate=lambda: report["counts_after_delete"] == {
                        "users": 0,
                        "documents": 0,
                        "sessions": 0,
                        "messages": 0,
                        "credit_ledger": 0,
                    },
                )
            )
            res = await client.get("/api/users/me", headers=headers)
            report["checks"].append(check("deleted_token_no_longer_authenticates", res.status_code, 401, safe_json(res)))
            res = await client.delete("/api/users/me")
            report["checks"].append(check("anon_delete_my_account_requires_auth", res.status_code, 401, safe_json(res)))

        report["result"] = "pass" if all(c.get("result") == "pass" for c in report["checks"]) else "fail"
        return report
    except Exception as exc:
        report["result"] = "fail"
        report["error"] = f"{type(exc).__name__}: {exc}"
        raise
    finally:
        if args.keep:
            report["cleanup"] = "kept"
        elif deleted_via_api:
            report["cleanup"] = "deleted via account API"
        else:
            try:
                await cleanup_user(user["id"])
                report["cleanup"] = "deleted qa user and owned docs via cleanup"
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


async def create_session(client: httpx.AsyncClient, headers: dict[str, str], document_id: str) -> dict[str, Any]:
    res = await client.post(f"/api/documents/{document_id}/sessions", headers=headers)
    body = safe_json(res)
    res.raise_for_status()
    return {"session_id": body["session_id"], "document_id": document_id, "status_code": res.status_code}


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


def compact_doc(body: dict[str, Any]) -> dict[str, Any]:
    keys = ["id", "filename", "status", "page_count", "pages_parsed", "chunks_total", "chunks_indexed", "error_msg", "file_type"]
    return {k: body.get(k) for k in keys if k in body}


def compact_export(body: Any) -> Any:
    if not isinstance(body, dict):
        return body
    conversations = body.get("conversations") or []
    return {
        "exported_at": body.get("exported_at"),
        "user": body.get("user"),
        "document_count": len(body.get("documents") or []),
        "conversation_count": len(conversations),
        "first_conversation_message_count": len(conversations[0].get("messages", [])) if conversations else 0,
        "credit_history_count": len(body.get("credit_history") or []),
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
    print(f"PASS: {len(report['checks'])} account privacy checks; cleanup={report['cleanup']}")


if __name__ == "__main__":
    main()
