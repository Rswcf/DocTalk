#!/usr/bin/env python3
"""Run a backend upload/parse/search smoke against a running local DocTalk API."""

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
    parser = argparse.ArgumentParser(description="Run DocTalk backend golden-path QA smoke.")
    parser.add_argument("--api-base", default="http://127.0.0.1:8000", help="Running backend base URL.")
    parser.add_argument("--file", default="test_inputs/semiconductor.pdf", help="File to upload.")
    parser.add_argument("--query", default="semiconductor", help="Search query after parse is ready.")
    parser.add_argument("--timeout", type=int, default=180, help="Seconds to wait for document ready.")
    parser.add_argument("--poll-interval", type=float, default=3.0, help="Seconds between document status polls.")
    parser.add_argument("--json-out", help="Write JSON report to this path.")
    parser.add_argument("--keep", action="store_true", help="Keep QA user/document instead of cleanup.")
    return parser.parse_args()


async def create_qa_user() -> Any:
    from app.models.database import AsyncSessionLocal
    from app.services import auth_service

    email = f"qa-{datetime.now(timezone.utc).strftime('%Y%m%d-%H%M%S')}-{uuid.uuid4().hex[:8]}@example.com"
    async with AsyncSessionLocal() as db:
        return await auth_service.create_user(db, email=email, name="QA Golden Path")


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


async def run_flow(args: argparse.Namespace) -> dict[str, Any]:
    file_path = (ROOT / args.file).resolve()
    if not file_path.exists():
        raise FileNotFoundError(file_path)

    user = await create_qa_user()
    token = make_token(user.id)
    headers = {"Authorization": f"Bearer {token}"}
    report: dict[str, Any] = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "api_base": args.api_base,
        "file": str(file_path.relative_to(ROOT)),
        "query": args.query,
        "qa_user_id": str(user.id),
        "qa_user_email": user.email,
        "steps": [],
        "cleanup": "pending",
    }

    document_id: str | None = None
    started = time.monotonic()
    try:
        async with httpx.AsyncClient(base_url=args.api_base, timeout=30.0) as client:
            health = await client.get("/health")
            report["steps"].append({
                "name": "health",
                "status_code": health.status_code,
                "body": safe_json(health),
            })
            health.raise_for_status()

            with file_path.open("rb") as fh:
                upload = await client.post(
                    "/api/documents/upload",
                    headers=headers,
                    files={"file": (file_path.name, fh, "application/pdf")},
                )
            report["steps"].append({
                "name": "upload",
                "status_code": upload.status_code,
                "body": safe_json(upload),
            })
            upload.raise_for_status()
            document_id = upload.json()["document_id"]

            statuses: list[dict[str, Any]] = []
            deadline = time.monotonic() + args.timeout
            final_doc: dict[str, Any] | None = None
            while time.monotonic() < deadline:
                doc_res = await client.get(f"/api/documents/{document_id}", headers=headers)
                body = safe_json(doc_res)
                status = body.get("status") if isinstance(body, dict) else None
                statuses.append({
                    "at_seconds": round(time.monotonic() - started, 3),
                    "status_code": doc_res.status_code,
                    "status": status,
                    "pages": body.get("pages") if isinstance(body, dict) else None,
                    "chunks": body.get("chunks") if isinstance(body, dict) else None,
                })
                doc_res.raise_for_status()
                if status in {"ready", "error"}:
                    final_doc = body
                    break
                await asyncio.sleep(args.poll_interval)

            report["steps"].append({"name": "poll_document", "statuses": statuses})
            if not final_doc:
                raise TimeoutError(f"Document {document_id} did not finish within {args.timeout}s")
            if final_doc.get("status") != "ready":
                raise RuntimeError(f"Document {document_id} ended with status {final_doc.get('status')}")

            search = await client.post(
                f"/api/documents/{document_id}/search",
                headers=headers,
                json={"query": args.query, "top_k": 3},
            )
            report["steps"].append({
                "name": "search",
                "status_code": search.status_code,
                "body": safe_json(search),
            })
            search.raise_for_status()

            text = await client.get(f"/api/documents/{document_id}/text-content", headers=headers)
            text_body = safe_json(text)
            report["steps"].append({
                "name": "text_content",
                "status_code": text.status_code,
                "page_count": len(text_body.get("pages", [])) if isinstance(text_body, dict) else None,
                "source_meta": text_body.get("source_meta") if isinstance(text_body, dict) else None,
            })
            text.raise_for_status()

            report["result"] = "pass"
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
            except Exception as cleanup_exc:  # pragma: no cover - diagnostic path
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


def main() -> None:
    args = parse_args()
    try:
        report = asyncio.run(run_flow(args))
    except Exception as exc:
        print(f"FAIL: {type(exc).__name__}: {exc}", file=sys.stderr)
        raise SystemExit(1)
    print(
        "PASS: uploaded {file}; result={result}; cleanup={cleanup}".format(
            file=report["file"],
            result=report.get("result"),
            cleanup=report.get("cleanup"),
        )
    )


if __name__ == "__main__":
    main()

