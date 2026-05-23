#!/usr/bin/env python3
"""API golden path for generated non-PDF uploads.

Runs real `/api/documents/upload`, manual parse worker execution, document
detail, text-content, and search API checks for DOCX/PPTX/XLSX/TXT/MD without
external embedding provider credentials.
"""

from __future__ import annotations

import argparse
import asyncio
import importlib.util
import json
import os
import sys
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any
from unittest.mock import AsyncMock

ROOT = Path(__file__).resolve().parents[2]
BACKEND_DIR = ROOT / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://doctalk:doctalk@localhost:5432/doctalk")
os.environ.setdefault("AUTH_SECRET", "qa-local-auth-secret")
os.environ.setdefault("ADAPTER_SECRET", "qa-local-adapter-secret")
os.environ.setdefault("TESTING", "1")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--json-out", required=True)
    return parser.parse_args()


def load_fixture_module():
    path = ROOT / ".collab/scripts/qa_multiformat_extraction_matrix.py"
    spec = importlib.util.spec_from_file_location("qa_multiformat_extraction_matrix", path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"failed to load fixture module: {path}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


def token_for(user_id: uuid.UUID) -> str:
    from jose import jwt

    from app.core.config import settings

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


class FakeQdrantClient:
    def __init__(self) -> None:
        self.upserted = 0
        self.deleted = 0

    def upsert(self, *, collection_name: str, points: list[Any], wait: bool) -> None:
        self.upserted += len(points)

    def delete(self, **_: Any) -> None:
        self.deleted += 1


def install_worker_fakes() -> FakeQdrantClient:
    from app.api import search as search_api
    from app.workers import parse_worker

    fake_qdrant = FakeQdrantClient()
    parse_worker.parse_document.delay = lambda *_args, **_kwargs: None
    parse_worker._queue_document_brief = lambda _document_id: None
    parse_worker.embedding_service.ensure_collection = lambda: None
    parse_worker.embedding_service.get_qdrant_client = lambda: fake_qdrant
    parse_worker.embedding_service.embed_texts = lambda texts, **_kwargs: [[0.0] * 1536 for _ in texts]
    search_api.retrieval_service.search = AsyncMock(return_value=[])
    return fake_qdrant


async def create_user() -> Any:
    from app.models.database import AsyncSessionLocal
    from app.services import auth_service

    email = f"qa-multiformat-api-{datetime.now(timezone.utc).strftime('%Y%m%d-%H%M%S')}-{uuid.uuid4().hex[:8]}@example.com"
    async with AsyncSessionLocal() as db:
        user = await auth_service.create_user(db, email=email, name="QA Multi-format API")
        user.plan = "pro"
        user.credits_balance = 20000
        await db.commit()
        await db.refresh(user)
        return user


async def cleanup_user(user_id: uuid.UUID) -> dict[str, int]:
    from sqlalchemy import func, select

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


async def run_case(client: Any, headers: dict[str, str], case: Any, fake_qdrant: FakeQdrantClient) -> dict[str, Any]:
    from app.workers.parse_worker import parse_document

    before_upserts = fake_qdrant.upserted
    upload = await client.post(
        "/api/documents/upload",
        headers=headers,
        files={"file": (case.filename, case.data, case.content_type)},
    )
    upload_body = safe_json(upload)
    result: dict[str, Any] = {
        "name": case.name,
        "file_type": case.file_type,
        "filename": case.filename,
        "upload_status": upload.status_code,
        "upload_body": upload_body,
    }
    if upload.status_code != 202:
        result["result"] = "fail"
        return result

    document_id = upload_body["document_id"]
    result["document_id"] = document_id
    parse_document.run(document_id)

    detail = await client.get(f"/api/documents/{document_id}", headers=headers)
    detail_body = safe_json(detail)
    text = await client.get(f"/api/documents/{document_id}/text-content", headers=headers)
    text_body = safe_json(text)
    pages = text_body.get("pages") if isinstance(text_body, dict) else []
    all_text = "\n\n".join(page.get("text") or "" for page in pages or [])
    query = case.expected_terms[0]
    search = await client.post(
        f"/api/documents/{document_id}/search",
        headers=headers,
        json={"query": query, "top_k": 3},
    )
    search_body = safe_json(search)
    search_results = search_body.get("results") if isinstance(search_body, dict) else []

    checks = [
        ("detail_ready", detail.status_code == 200 and detail_body.get("status") == "ready"),
        ("file_type_preserved", detail_body.get("file_type") == case.file_type),
        ("pages_present", text.status_code == 200 and len(pages or []) >= case.min_pages),
        ("expected_terms_in_text_content", all(term in all_text for term in case.expected_terms)),
        ("search_result_present", search.status_code == 200 and len(search_results or []) > 0),
        ("vectors_indexed_with_fake_qdrant", fake_qdrant.upserted > before_upserts),
    ]
    result.update(
        {
            "detail": compact_doc(detail_body),
            "text_content": {
                "status_code": text.status_code,
                "page_count": len(pages or []),
                "chars": len(all_text),
            },
            "search": {
                "status_code": search.status_code,
                "query": query,
                "result_count": len(search_results or []),
                "first": compact_body(search_results[0]) if search_results else None,
            },
            "fake_qdrant_upserts_added": fake_qdrant.upserted - before_upserts,
            "checks": [{"name": name, "result": "pass" if ok else "fail"} for name, ok in checks],
            "result": "pass" if all(ok for _, ok in checks) else "fail",
        }
    )
    return result


async def main_async(args: argparse.Namespace) -> dict[str, Any]:
    from httpx import ASGITransport, AsyncClient

    from app.main import app
    from app.services.storage_service import storage_service

    fixture_module = load_fixture_module()
    cases = fixture_module.cases()
    fake_qdrant = install_worker_fakes()
    storage_service.ensure_bucket()
    user = await create_user()
    report: dict[str, Any] = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "scope": "non-pdf API upload -> manual parse -> ready -> text-content -> search",
        "user": {"id": str(user.id), "email": user.email, "plan": user.plan},
        "cases": [],
        "cleanup": "pending",
    }
    try:
        headers = {"Authorization": f"Bearer {token_for(user.id)}"}
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            for case in cases:
                case_result = await run_case(client, headers, case, fake_qdrant)
                report["cases"].append(case_result)
                print(
                    "CASE {name}: {result} type={file_type} pages={pages} search={search}".format(
                        name=case.name,
                        result=case_result["result"].upper(),
                        file_type=case.file_type,
                        pages=(case_result.get("text_content") or {}).get("page_count"),
                        search=(case_result.get("search") or {}).get("result_count"),
                    )
                )
    finally:
        report["cleanup"] = await cleanup_user(user.id)

    failures = [case["name"] for case in report["cases"] if case["result"] != "pass"]
    report["summary"] = {
        "total": len(report["cases"]),
        "passed": len(report["cases"]) - len(failures),
        "failed": failures,
        "fake_qdrant_total_upserts": fake_qdrant.upserted,
    }
    report["result"] = "fail" if failures else "pass"
    return report


def compact_doc(body: Any) -> Any:
    if not isinstance(body, dict):
        return body
    keys = [
        "id",
        "filename",
        "status",
        "page_count",
        "pages_parsed",
        "chunks_total",
        "chunks_indexed",
        "file_type",
        "has_converted_pdf",
        "error_msg",
    ]
    return {key: body.get(key) for key in keys if key in body}


def compact_body(body: Any) -> Any:
    text = json.dumps(body, ensure_ascii=False, default=str)
    if len(text) <= 1200:
        return body
    return {"truncated_json": text[:1200]}


def safe_json(response: Any) -> Any:
    try:
        return response.json()
    except Exception:
        return {"text": response.text[:1000]}


def main() -> int:
    args = parse_args()
    report = asyncio.run(main_async(args))
    out = Path(args.json_out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"MULTIFORMAT_API_GOLDEN_PATH {report['result'].upper()}: wrote {args.json_out}")
    return 0 if report["result"] == "pass" else 1


if __name__ == "__main__":
    raise SystemExit(main())
