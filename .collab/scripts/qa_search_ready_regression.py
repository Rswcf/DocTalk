#!/usr/bin/env python3
"""Repeatedly verify exact search immediately after document ready."""

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
    parser = argparse.ArgumentParser(description="Run repeated ready->search regression checks.")
    parser.add_argument("--api-base", default="http://127.0.0.1:8000")
    parser.add_argument("--path", default="test_inputs/semiconductor.pdf")
    parser.add_argument("--query", default="semiconductor")
    parser.add_argument("--iterations", type=int, default=8)
    parser.add_argument("--searches-per-doc", type=int, default=5)
    parser.add_argument("--timeout", type=int, default=180)
    parser.add_argument("--poll-interval", type=float, default=2.0)
    parser.add_argument("--json-out")
    parser.add_argument("--keep", action="store_true")
    return parser.parse_args()


async def create_user() -> dict[str, Any]:
    from app.models.database import AsyncSessionLocal
    from app.services import auth_service

    email = f"qa-search-ready-{datetime.now(timezone.utc).strftime('%Y%m%d-%H%M%S')}-{uuid.uuid4().hex[:8]}@example.com"
    async with AsyncSessionLocal() as db:
        user = await auth_service.create_user(db, email=email, name="QA search ready")
        user.plan = "pro"
        await db.commit()
        await db.refresh(user)
        return {"id": user.id, "email": user.email, "plan": user.plan}


async def delete_user(user_id: uuid.UUID) -> None:
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


async def qa_counts(user_id: uuid.UUID) -> dict[str, int]:
    from sqlalchemy import func, select

    from app.models.database import AsyncSessionLocal
    from app.models.tables import Document, User

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
            "exp": int((now + timedelta(hours=1)).timestamp()),
        },
        settings.AUTH_SECRET,
        algorithm="HS256",
    )


async def run(args: argparse.Namespace) -> dict[str, Any]:
    user = await create_user()
    headers = {"Authorization": f"Bearer {token_for(user['id'])}"}
    path = ROOT / args.path
    report: dict[str, Any] = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "api_base": args.api_base,
        "path": args.path,
        "query": args.query,
        "iterations": args.iterations,
        "searches_per_doc": args.searches_per_doc,
        "user": {"id": str(user["id"]), "plan": user["plan"]},
        "cases": [],
        "cleanup": "pending",
    }
    try:
        async with httpx.AsyncClient(base_url=args.api_base, timeout=90.0) as client:
            health = await client.get("/health")
            report["health"] = {"status_code": health.status_code, "body": safe_json(health)}
            health.raise_for_status()
            data = path.read_bytes()
            for index in range(1, args.iterations + 1):
                print(f"[{index}/{args.iterations}] upload -> ready -> repeated exact search", flush=True)
                report["cases"].append(
                    await run_case(
                        client,
                        headers,
                        data,
                        path.name,
                        args.query,
                        searches_per_doc=args.searches_per_doc,
                        timeout=args.timeout,
                        poll_interval=args.poll_interval,
                    )
                )
        failures = [case for case in report["cases"] if case.get("result") != "pass"]
        report["summary"] = {
            "passed": len(report["cases"]) - len(failures),
            "failed": len(failures),
            "total_searches": sum(len(case.get("searches", [])) for case in report["cases"]),
            "zero_result_searches": sum(
                1
                for case in report["cases"]
                for search in case.get("searches", [])
                if search.get("result_count") == 0
            ),
        }
        report["result"] = "pass" if not failures else "fail"
        return report
    finally:
        if args.keep:
            report["cleanup"] = "kept"
        else:
            try:
                await delete_user(user["id"])
                report["cleanup"] = "deleted qa user and owned docs"
            except Exception as cleanup_exc:
                report["cleanup"] = f"failed: {type(cleanup_exc).__name__}: {cleanup_exc}"
        report["cleanup_counts"] = await qa_counts(user["id"])
        if args.json_out:
            out = Path(args.json_out)
            out.parent.mkdir(parents=True, exist_ok=True)
            out.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


async def run_case(
    client: httpx.AsyncClient,
    headers: dict[str, str],
    data: bytes,
    filename: str,
    query: str,
    *,
    searches_per_doc: int,
    timeout: int,
    poll_interval: float,
) -> dict[str, Any]:
    started = time.monotonic()
    upload = await client.post(
        "/api/documents/upload",
        headers=headers,
        files={"file": (filename, data, "application/pdf")},
    )
    upload_body = safe_json(upload)
    result: dict[str, Any] = {
        "upload_status": upload.status_code,
        "upload_body": upload_body,
    }
    if upload.status_code != 202:
        result["result"] = "fail"
        result["reason"] = "upload did not return 202"
        return result

    document_id = upload_body.get("document_id")
    result["document_id"] = document_id
    final = await poll_ready(client, headers, document_id, timeout, poll_interval)
    result["polls"] = final["polls"]
    result["final_document"] = compact_doc(final["body"])
    if final["body"].get("status") != "ready":
        result["result"] = "fail"
        result["reason"] = "document did not reach ready"
        return result

    searches = []
    for search_index in range(1, searches_per_doc + 1):
        search = await client.post(
            f"/api/documents/{document_id}/search",
            headers=headers,
            json={"query": query, "top_k": 1},
        )
        body = safe_json(search)
        results = body.get("results") if isinstance(body, dict) else []
        searches.append(
            {
                "index": search_index,
                "status_code": search.status_code,
                "result_count": len(results or []),
                "first": compact_body((results or [None])[0]) if results else None,
            }
        )
    result["searches"] = searches
    result["elapsed_seconds"] = round(time.monotonic() - started, 3)
    result["result"] = "pass" if all(s["status_code"] == 200 and s["result_count"] > 0 for s in searches) else "fail"
    return result


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
        for key in ["id", "filename", "status", "page_count", "pages_parsed", "chunks_total", "chunks_indexed", "error_msg"]
        if key in body
    }


def compact_body(body: Any) -> Any:
    text = json.dumps(body, ensure_ascii=False, default=str)
    if len(text) <= 900:
        return body
    return {"truncated_json": text[:900]}


def safe_json(response: httpx.Response) -> Any:
    try:
        return response.json()
    except Exception:
        return {"text": response.text[:1000]}


def main() -> None:
    args = parse_args()
    report = asyncio.run(run(args))
    summary = report.get("summary", {})
    if report.get("result") != "pass":
        print(
            f"FAIL: {summary.get('failed')} failed cases, {summary.get('zero_result_searches')} zero-result searches",
            file=sys.stderr,
        )
        raise SystemExit(1)
    print(
        f"PASS: {summary.get('passed')} repeated ready/search cases, "
        f"{summary.get('total_searches')} searches, "
        f"zero_result_searches={summary.get('zero_result_searches')}; "
        f"cleanup={report['cleanup']}"
    )


if __name__ == "__main__":
    main()
