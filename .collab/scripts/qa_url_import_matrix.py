#!/usr/bin/env python3
"""Run URL import positive/negative QA matrix against a running DocTalk backend."""

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


NEGATIVE_CASES = [
    {
        "name": "missing_supported_scheme",
        "url": "ftp://example.com/report",
        "expected_status": 400,
        "expected_error": "URL_INVALID",
    },
    {
        "name": "localhost_blocked",
        "url": "http://127.0.0.1:8000/health",
        "expected_status": 400,
        "expected_error": "URL_FETCH_BLOCKED",
    },
    {
        "name": "internal_port_blocked",
        "url": "http://example.com:5432/",
        "expected_status": 400,
        "expected_error": "URL_FETCH_BLOCKED",
    },
]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run DocTalk URL import QA matrix.")
    parser.add_argument("--api-base", default="http://127.0.0.1:8000", help="Running backend base URL.")
    parser.add_argument("--positive-url", default="https://example.com", help="URL expected to import successfully.")
    parser.add_argument("--timeout", type=int, default=180, help="Seconds to wait for positive URL ready.")
    parser.add_argument("--poll-interval", type=float, default=3.0, help="Seconds between document polls.")
    parser.add_argument("--json-out", help="Write JSON report to this path.")
    parser.add_argument("--keep", action="store_true", help="Keep QA user/document instead of cleanup.")
    return parser.parse_args()


async def create_qa_user() -> Any:
    from app.models.database import AsyncSessionLocal
    from app.services import auth_service

    email = f"qa-url-{datetime.now(timezone.utc).strftime('%Y%m%d-%H%M%S')}-{uuid.uuid4().hex[:8]}@example.com"
    async with AsyncSessionLocal() as db:
        return await auth_service.create_user(db, email=email, name="QA URL Import")


async def delete_qa_user(user_id: uuid.UUID) -> None:
    from sqlalchemy import select

    from app.models.database import AsyncSessionLocal
    from app.models.tables import Document, User
    from app.services.doc_service import doc_service

    async with AsyncSessionLocal() as db:
        doc_ids = (
            await db.scalars(select(Document.id).where(Document.user_id == user_id))
        ).all()
        for document_id in doc_ids:
            await doc_service.delete_document(document_id, db)
        user = await db.get(User, user_id)
        if user is not None:
            await db.delete(user)
            await db.commit()


def make_token(user_id: uuid.UUID) -> str:
    from app.core.config import settings

    if not settings.AUTH_SECRET:
        raise RuntimeError("AUTH_SECRET is required to generate QA JWT")
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


async def run_matrix(args: argparse.Namespace) -> dict[str, Any]:
    user = await create_qa_user()
    headers = {"Authorization": f"Bearer {make_token(user.id)}"}
    report: dict[str, Any] = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "api_base": args.api_base,
        "positive_url": args.positive_url,
        "qa_user_id": str(user.id),
        "qa_user_email": user.email,
        "negative_cases": [],
        "positive_case": None,
        "cleanup": "pending",
    }

    try:
        async with httpx.AsyncClient(base_url=args.api_base, timeout=45.0) as client:
            health = await client.get("/health")
            report["health"] = {"status_code": health.status_code, "body": safe_json(health)}
            health.raise_for_status()

            for case in NEGATIVE_CASES:
                res = await client.post("/api/documents/ingest-url", headers=headers, json={"url": case["url"]})
                body = safe_json(res)
                actual_error = extract_error(body)
                passed = res.status_code == case["expected_status"] and actual_error == case["expected_error"]
                report["negative_cases"].append({
                    **case,
                    "actual_status": res.status_code,
                    "actual_error": actual_error,
                    "body": body,
                    "result": "pass" if passed else "fail",
                })

            pos_started = time.monotonic()
            pos = await client.post("/api/documents/ingest-url", headers=headers, json={"url": args.positive_url})
            positive: dict[str, Any] = {
                "ingest_status_code": pos.status_code,
                "ingest_body": safe_json(pos),
                "polls": [],
            }
            pos.raise_for_status()
            document_id = pos.json()["document_id"]
            positive["document_id"] = document_id

            deadline = time.monotonic() + args.timeout
            final_doc: dict[str, Any] | None = None
            while time.monotonic() < deadline:
                doc_res = await client.get(f"/api/documents/{document_id}", headers=headers)
                doc_body = safe_json(doc_res)
                status = doc_body.get("status") if isinstance(doc_body, dict) else None
                positive["polls"].append({
                    "at_seconds": round(time.monotonic() - pos_started, 3),
                    "status_code": doc_res.status_code,
                    "status": status,
                    "filename": doc_body.get("filename") if isinstance(doc_body, dict) else None,
                    "file_type": doc_body.get("file_type") if isinstance(doc_body, dict) else None,
                    "source_url": doc_body.get("source_url") if isinstance(doc_body, dict) else None,
                })
                doc_res.raise_for_status()
                if status in {"ready", "error"}:
                    final_doc = doc_body
                    break
                await asyncio.sleep(args.poll_interval)

            if not final_doc:
                raise TimeoutError(f"URL document {document_id} did not finish within {args.timeout}s")
            if final_doc.get("status") != "ready":
                raise RuntimeError(f"URL document ended with status {final_doc.get('status')}")

            text = await client.get(f"/api/documents/{document_id}/text-content", headers=headers)
            text_body = safe_json(text)
            text.raise_for_status()
            positive["text_content"] = {
                "status_code": text.status_code,
                "page_count": len(text_body.get("pages", [])) if isinstance(text_body, dict) else None,
                "source_meta": text_body.get("source_meta") if isinstance(text_body, dict) else None,
            }
            report["positive_case"] = positive

        report["result"] = (
            "pass"
            if all(case["result"] == "pass" for case in report["negative_cases"])
            else "fail"
        )
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
                await delete_qa_user(user.id)
                report["cleanup"] = "deleted qa user and owned docs"
            except Exception as cleanup_exc:
                report["cleanup"] = f"failed: {type(cleanup_exc).__name__}: {cleanup_exc}"
        if args.json_out:
            out = Path(args.json_out)
            out.parent.mkdir(parents=True, exist_ok=True)
            out.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def safe_json(response: httpx.Response) -> Any:
    try:
        return response.json()
    except Exception:
        return {"text": response.text[:1000]}


def extract_error(body: Any) -> str | None:
    if isinstance(body, dict):
        detail = body.get("detail")
        if isinstance(detail, dict) and isinstance(detail.get("error"), str):
            return detail["error"]
        if isinstance(body.get("error"), str):
            return body["error"]
    return None


def main() -> None:
    args = parse_args()
    try:
        report = asyncio.run(run_matrix(args))
    except Exception as exc:
        print(f"FAIL: {type(exc).__name__}: {exc}", file=sys.stderr)
        raise SystemExit(1)
    print(
        "PASS: url matrix result={result}; negative={neg}; cleanup={cleanup}".format(
            result=report["result"],
            neg=len(report["negative_cases"]),
            cleanup=report["cleanup"],
        )
    )


if __name__ == "__main__":
    main()

