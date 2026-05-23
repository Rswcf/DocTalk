#!/usr/bin/env python3
"""Run live DocTalk chat/RAG quality checks against a running API.

This harness intentionally has two modes:
- `demo`: anonymous public demo document chat, suitable for production smoke.
- `upload` / `url`: authenticated local QA user flow using test_inputs or URL import.

The local authenticated modes require backend settings and database access so
they can create and clean up a synthetic QA user.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import sys
import time
import uuid
from collections.abc import AsyncIterator
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

import httpx
from jose import jwt

ROOT = Path(__file__).resolve().parents[2]
BACKEND_DIR = ROOT / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))


DEFAULT_EXPECTED_TERMS = {
    "attention-paper": ["attention", "heads", "linear"],
    "alphabet-earnings": ["revenue", "alphabet"],
    "court-filing": ["claim", "court"],
    "upload": ["semiconductor"],
    "url": ["example"],
}


@dataclass
class QaIdentity:
    user_id: uuid.UUID
    email: str
    token: str


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run live chat/RAG QA checks.")
    parser.add_argument(
        "--api-base",
        default="https://backend-production-a62e.up.railway.app",
        help="Backend API base URL.",
    )
    parser.add_argument(
        "--source",
        choices=["demo", "upload", "url"],
        default="demo",
        help="Document source under test.",
    )
    parser.add_argument("--demo-slug", default="attention-paper")
    parser.add_argument("--file", default="test_inputs/semiconductor.pdf")
    parser.add_argument("--url", default="https://example.com/")
    parser.add_argument(
        "--message",
        default="Explain how multi-head attention works in this paper. Keep it concise and cite the source.",
    )
    parser.add_argument("--locale", default="en")
    parser.add_argument("--mode", default="quick", choices=["quick", "balanced", "thorough"])
    parser.add_argument("--timeout", type=int, default=240)
    parser.add_argument("--poll-interval", type=float, default=3.0)
    parser.add_argument("--expect-term", action="append", default=[])
    parser.add_argument("--json-out")
    parser.add_argument(
        "--allow-blocked",
        action="store_true",
        help="Exit 0 when the only failure is a known missing local LLM provider.",
    )
    parser.add_argument("--keep", action="store_true", help="Keep local QA user/document.")
    return parser.parse_args()


def safe_json(response: httpx.Response) -> Any:
    try:
        return response.json()
    except Exception:
        return {"text": response.text[:1000]}


def headers(identity: QaIdentity | None) -> dict[str, str]:
    if identity is None:
        return {}
    return {"Authorization": f"Bearer {identity.token}"}


async def create_qa_identity() -> QaIdentity:
    from app.core.config import settings
    from app.models.database import AsyncSessionLocal
    from app.services import auth_service

    if not settings.AUTH_SECRET:
        raise RuntimeError("AUTH_SECRET is required for local authenticated QA")

    email = f"qa-live-chat-{datetime.now(timezone.utc).strftime('%Y%m%d-%H%M%S')}-{uuid.uuid4().hex[:8]}@example.com"
    async with AsyncSessionLocal() as db:
        user = await auth_service.create_user(db, email=email, name="QA Live Chat")
        user.plan = "pro"
        user.credits_balance = max(int(user.credits_balance or 0), 20000)
        db.add(user)
        await db.commit()
        await db.refresh(user)

    now = datetime.now(timezone.utc)
    token = jwt.encode(
        {
            "sub": str(user.id),
            "iat": int(now.timestamp()),
            "exp": int((now + timedelta(hours=2)).timestamp()),
        },
        settings.AUTH_SECRET,
        algorithm="HS256",
    )
    return QaIdentity(user_id=user.id, email=email, token=token)


async def delete_qa_identity(identity: QaIdentity | None) -> str:
    if identity is None:
        return "not needed"

    from sqlalchemy import select

    from app.models.database import AsyncSessionLocal
    from app.models.tables import Document, User
    from app.services.doc_service import doc_service

    async with AsyncSessionLocal() as db:
        doc_ids = (
            await db.scalars(select(Document.id).where(Document.user_id == identity.user_id))
        ).all()
        for document_id in doc_ids:
            await doc_service.delete_document(document_id, db)
        user = await db.get(User, identity.user_id)
        if user is not None:
            await db.delete(user)
            await db.commit()
    return "deleted qa user and owned docs"


async def wait_ready(
    client: httpx.AsyncClient,
    document_id: str,
    request_headers: dict[str, str],
    timeout: int,
    poll_interval: float,
) -> dict[str, Any]:
    statuses: list[dict[str, Any]] = []
    started = time.monotonic()
    deadline = started + timeout
    final_body: dict[str, Any] | None = None
    while time.monotonic() < deadline:
        res = await client.get(f"/api/documents/{document_id}", headers=request_headers)
        body = safe_json(res)
        status = body.get("status") if isinstance(body, dict) else None
        statuses.append(
            {
                "at_seconds": round(time.monotonic() - started, 3),
                "status_code": res.status_code,
                "status": status,
                "pages": body.get("pages") if isinstance(body, dict) else None,
                "chunks": body.get("chunks") if isinstance(body, dict) else None,
            }
        )
        res.raise_for_status()
        if status in {"ready", "error"}:
            final_body = body
            break
        await asyncio.sleep(poll_interval)

    if not final_body:
        raise TimeoutError(f"Document {document_id} did not finish within {timeout}s")
    return {"statuses": statuses, "final": final_body}


async def resolve_document(
    args: argparse.Namespace,
    client: httpx.AsyncClient,
    identity: QaIdentity | None,
    report: dict[str, Any],
) -> str:
    request_headers = headers(identity)
    if args.source == "demo":
        res = await client.get("/api/documents/demo")
        body = safe_json(res)
        report["steps"].append({"name": "list_demo_documents", "status_code": res.status_code, "body": body})
        res.raise_for_status()
        doc = next((item for item in body if item.get("slug") == args.demo_slug), None)
        if not doc:
            raise RuntimeError(f"Demo slug not found: {args.demo_slug}")
        if doc.get("status") != "ready":
            raise RuntimeError(f"Demo doc {args.demo_slug} is not ready: {doc.get('status')}")
        report["document"] = doc
        return str(doc["document_id"])

    if identity is None:
        raise RuntimeError("upload/url source requires local QA identity")

    if args.source == "upload":
        file_path = (ROOT / args.file).resolve()
        if not file_path.exists():
            raise FileNotFoundError(file_path)
        with file_path.open("rb") as fh:
            res = await client.post(
                "/api/documents/upload",
                headers=request_headers,
                files={"file": (file_path.name, fh, "application/pdf")},
            )
        body = safe_json(res)
        report["steps"].append({"name": "upload_document", "status_code": res.status_code, "body": body})
        res.raise_for_status()
        document_id = str(body["document_id"])
    else:
        res = await client.post("/api/documents/ingest-url", headers=request_headers, json={"url": args.url})
        body = safe_json(res)
        report["steps"].append({"name": "import_url", "status_code": res.status_code, "body": body})
        res.raise_for_status()
        document_id = str(body["document_id"])

    poll = await wait_ready(client, document_id, request_headers, args.timeout, args.poll_interval)
    report["steps"].append({"name": "poll_document", **poll})
    if poll["final"].get("status") != "ready":
        raise RuntimeError(f"Document {document_id} ended with status {poll['final'].get('status')}")
    return document_id


async def iter_sse_lines(response: httpx.Response) -> AsyncIterator[dict[str, Any]]:
    event_name = "message"
    data_lines: list[str] = []
    async for line in response.aiter_lines():
        if not line:
            if data_lines:
                raw_data = "\n".join(data_lines)
                try:
                    data = json.loads(raw_data)
                except Exception:
                    data = {"raw": raw_data}
                yield {"event": event_name, "data": data}
            event_name = "message"
            data_lines = []
            continue
        if line.startswith("event:"):
            event_name = line.split(":", 1)[1].strip()
        elif line.startswith("data:"):
            data_lines.append(line.split(":", 1)[1].strip())

    if data_lines:
        raw_data = "\n".join(data_lines)
        try:
            data = json.loads(raw_data)
        except Exception:
            data = {"raw": raw_data}
        yield {"event": event_name, "data": data}


async def stream_chat(
    args: argparse.Namespace,
    client: httpx.AsyncClient,
    session_id: str,
    request_headers: dict[str, str],
) -> dict[str, Any]:
    events: list[dict[str, Any]] = []
    answer_parts: list[str] = []
    citations: list[dict[str, Any]] = []
    started = time.monotonic()

    async with client.stream(
        "POST",
        f"/api/sessions/{session_id}/chat",
        headers=request_headers,
        json={"message": args.message, "mode": args.mode, "locale": args.locale},
        timeout=httpx.Timeout(args.timeout, connect=30.0, read=args.timeout),
    ) as res:
        status_code = res.status_code
        content_type = res.headers.get("content-type")
        if status_code != 200:
            text = await res.aread()
            return {
                "status_code": status_code,
                "content_type": content_type,
                "error_body": text.decode("utf-8", errors="replace")[:2000],
                "elapsed_seconds": round(time.monotonic() - started, 3),
                "events": [],
                "answer": "",
                "citations": [],
            }
        async for ev in iter_sse_lines(res):
            events.append(ev)
            if ev["event"] == "token":
                text = ev.get("data", {}).get("text")
                if isinstance(text, str):
                    answer_parts.append(text)
            elif ev["event"] == "citation":
                data = ev.get("data")
                if isinstance(data, dict):
                    citations.append(data)

    done_events = [ev for ev in events if ev["event"] == "done"]
    error_events = [ev for ev in events if ev["event"] == "error"]
    return {
        "status_code": status_code,
        "content_type": content_type,
        "elapsed_seconds": round(time.monotonic() - started, 3),
        "events": events,
        "event_counts": event_counts(events),
        "answer": "".join(answer_parts),
        "answer_chars": len("".join(answer_parts)),
        "citations": citations,
        "done": done_events[-1]["data"] if done_events else None,
        "errors": [ev["data"] for ev in error_events],
    }


def event_counts(events: list[dict[str, Any]]) -> dict[str, int]:
    counts: dict[str, int] = {}
    for ev in events:
        name = str(ev.get("event") or "unknown")
        counts[name] = counts.get(name, 0) + 1
    return counts


async def fetch_citation_chunks(
    client: httpx.AsyncClient,
    citations: list[dict[str, Any]],
    request_headers: dict[str, str],
) -> list[dict[str, Any]]:
    details = []
    seen: set[str] = set()
    for citation in citations[:3]:
        chunk_id = citation.get("chunk_id")
        if not chunk_id or chunk_id in seen:
            continue
        seen.add(str(chunk_id))
        res = await client.get(f"/api/chunks/{chunk_id}", headers=request_headers)
        body = safe_json(res)
        details.append(
            {
                "chunk_id": chunk_id,
                "status_code": res.status_code,
                "page_start": body.get("page_start") if isinstance(body, dict) else None,
                "text_preview": (body.get("text") or "")[:240] if isinstance(body, dict) else None,
                "bboxes_count": len(body.get("bboxes") or []) if isinstance(body, dict) else None,
            }
        )
    return details


def evaluate(report: dict[str, Any], expected_terms: list[str]) -> dict[str, Any]:
    chat = report.get("chat") or {}
    answer = (chat.get("answer") or "").lower()
    citations = chat.get("citations") or []
    done = chat.get("done") or {}
    errors = chat.get("errors") or []

    checks = {
        "stream_http_200": chat.get("status_code") == 200,
        "no_error_event": not errors,
        "done_event_present": bool(done),
        "answer_min_120_chars": len(answer) >= 120,
        "citation_event_present": len(citations) > 0,
        "done_reports_citations": int(done.get("citations_count") or 0) > 0 if isinstance(done, dict) else False,
        "expected_terms_present": all(term.lower() in answer for term in expected_terms),
        "citation_shape_valid": all(
            isinstance(c.get("chunk_id"), str)
            and isinstance(c.get("page"), int)
            and isinstance(c.get("text_snippet"), str)
            for c in citations
            if isinstance(c, dict)
        )
        and bool(citations),
    }

    messages = report.get("messages") or {}
    message_items = messages.get("body", {}).get("messages") if isinstance(messages.get("body"), dict) else None
    if isinstance(message_items, list):
        assistant_messages = [m for m in message_items if m.get("role") == "assistant"]
        checks["messages_api_has_assistant"] = bool(assistant_messages)
        checks["messages_api_has_citations"] = bool(
            assistant_messages and assistant_messages[-1].get("citations")
        )
    else:
        checks["messages_api_has_assistant"] = False
        checks["messages_api_has_citations"] = False

    quality_score = sum(1 for passed in checks.values() if passed) / max(len(checks), 1)
    blocked_reason = None
    if errors:
        first = errors[0] if isinstance(errors[0], dict) else {}
        if first.get("code") == "LLM_ERROR":
            blocked_reason = first.get("message") or "LLM provider unavailable"

    result = "pass" if all(checks.values()) else "fail"
    if blocked_reason:
        result = "blocked"

    return {
        "result": result,
        "blocked_reason": blocked_reason,
        "quality_score": round(quality_score, 3),
        "expected_terms": expected_terms,
        "checks": checks,
    }


async def run(args: argparse.Namespace) -> dict[str, Any]:
    identity: QaIdentity | None = None
    report: dict[str, Any] = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "api_base": args.api_base,
        "source": args.source,
        "demo_slug": args.demo_slug if args.source == "demo" else None,
        "file": args.file if args.source == "upload" else None,
        "url": args.url if args.source == "url" else None,
        "message": args.message,
        "mode": args.mode,
        "locale": args.locale,
        "steps": [],
        "cleanup": "pending",
    }
    expected_terms = args.expect_term or DEFAULT_EXPECTED_TERMS.get(
        args.demo_slug if args.source == "demo" else args.source,
        [],
    )

    try:
        if args.source in {"upload", "url"}:
            identity = await create_qa_identity()
            report["qa_user"] = {"id": str(identity.user_id), "email": identity.email}

        request_headers = headers(identity)
        async with httpx.AsyncClient(base_url=args.api_base, timeout=30.0) as client:
            health = await client.get("/health")
            report["steps"].append({"name": "health", "status_code": health.status_code, "body": safe_json(health)})

            document_id = await resolve_document(args, client, identity, report)
            report["document_id"] = document_id

            session_res = await client.post(
                f"/api/documents/{document_id}/sessions",
                headers=request_headers,
            )
            session_body = safe_json(session_res)
            report["steps"].append(
                {"name": "create_session", "status_code": session_res.status_code, "body": session_body}
            )
            session_res.raise_for_status()
            session_id = str(session_body["session_id"])
            report["session_id"] = session_id

            report["chat"] = await stream_chat(args, client, session_id, request_headers)
            report["citation_chunks"] = await fetch_citation_chunks(
                client,
                report["chat"].get("citations") or [],
                request_headers,
            )

            messages_res = await client.get(f"/api/sessions/{session_id}/messages", headers=request_headers)
            report["messages"] = {
                "status_code": messages_res.status_code,
                "body": safe_json(messages_res),
            }
            report["evaluation"] = evaluate(report, expected_terms)
            report["result"] = report["evaluation"]["result"]
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
                report["cleanup"] = await delete_qa_identity(identity)
            except Exception as cleanup_exc:
                report["cleanup"] = f"failed: {type(cleanup_exc).__name__}: {cleanup_exc}"
        if args.json_out:
            out = Path(args.json_out)
            out.parent.mkdir(parents=True, exist_ok=True)
            out.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main() -> None:
    args = parse_args()
    try:
        report = asyncio.run(run(args))
    except Exception as exc:
        print(f"FAIL: {type(exc).__name__}: {exc}", file=sys.stderr)
        raise SystemExit(1)

    evaluation = report.get("evaluation") or {}
    result = evaluation.get("result") or report.get("result")
    print(
        "LIVE_CHAT_RAG {result}: source={source} session={session} score={score} answer_chars={chars} citations={citations}".format(
            result=str(result).upper(),
            source=report.get("source"),
            session=report.get("session_id"),
            score=evaluation.get("quality_score"),
            chars=(report.get("chat") or {}).get("answer_chars"),
            citations=len((report.get("chat") or {}).get("citations") or []),
        )
    )
    if result == "blocked" and args.allow_blocked:
        raise SystemExit(0)
    if result != "pass":
        raise SystemExit(1)


if __name__ == "__main__":
    main()
