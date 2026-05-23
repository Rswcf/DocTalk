#!/usr/bin/env python3
"""API matrix for structured extraction, table scan, and question templates.

This is a contract/UX-support matrix, not a live LLM quality run. It uses
synthetic ready Markdown documents and no-op worker enqueue hooks, then marks
selected jobs completed with deterministic results so export/list/get paths are
verified without external model credentials.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import sys
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

from jose import jwt
from sqlalchemy import delete, func, insert, select

ROOT = Path(__file__).resolve().parents[2]
BACKEND_DIR = ROOT / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://doctalk:doctalk@localhost:5432/doctalk")
os.environ.setdefault("AUTH_SECRET", "qa-local-auth-secret")
os.environ.setdefault("ADAPTER_SECRET", "qa-local-adapter-secret")
os.environ.setdefault("TESTING", "1")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run structured workflow API QA matrix.")
    parser.add_argument("--json-out", required=True)
    parser.add_argument("--keep", action="store_true")
    return parser.parse_args()


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


async def create_user(label: str, plan: str, credits: int = 20000) -> dict[str, Any]:
    from app.models.database import AsyncSessionLocal
    from app.services import auth_service

    email = (
        f"qa-structured-{label}-"
        f"{datetime.now(timezone.utc).strftime('%Y%m%d-%H%M%S')}-"
        f"{uuid.uuid4().hex[:8]}@example.com"
    )
    async with AsyncSessionLocal() as db:
        user = await auth_service.create_user(db, email=email, name=f"QA Structured {label.title()}")
        user.plan = plan
        user.credits_balance = credits
        await db.commit()
        await db.refresh(user)
        return {"id": user.id, "email": user.email, "plan": user.plan}


async def create_markdown_document(user_id: uuid.UUID, label: str, *, ready: bool = True) -> dict[str, Any]:
    from app.models.database import AsyncSessionLocal
    from app.models.tables import Document, Page

    doc_id = uuid.uuid4()
    table_text = (
        f"# QA Structured {label}\n\n"
        "| Metric | Value | Notes |\n"
        "|---|---:|---|\n"
        "| Revenue | 42 | Synthetic table row |\n"
        "| Churn | 3% | Synthetic table row |\n\n"
        "This synthetic document is used only for structured workflow API QA.\n"
    )
    async with AsyncSessionLocal() as db:
        doc = Document(
            id=doc_id,
            filename=f"qa-structured-{label}.md",
            file_size=len(table_text.encode("utf-8")),
            page_count=1,
            storage_key=f"qa-structured/{doc_id}.md",
            status="ready" if ready else "processing",
            pages_parsed=1 if ready else 0,
            chunks_total=1 if ready else 0,
            chunks_indexed=1 if ready else 0,
            user_id=user_id,
            file_type="md",
        )
        db.add(doc)
        if ready:
            db.add(
                Page(
                    document_id=doc_id,
                    page_number=1,
                    width_pt=612,
                    height_pt=792,
                    rotation=0,
                    content=table_text,
                )
            )
        await db.commit()
    return {"id": str(doc_id), "filename": f"qa-structured-{label}.md", "ready": ready}


async def create_collection(user_id: uuid.UUID, name: str, document_ids: list[str]) -> str:
    from app.models.database import AsyncSessionLocal
    from app.models.tables import Collection, collection_documents

    collection_id = uuid.uuid4()
    async with AsyncSessionLocal() as db:
        db.add(Collection(id=collection_id, name=name, description="QA structured workflow collection", user_id=user_id))
        await db.flush()
        for document_id in document_ids:
            await db.execute(
                insert(collection_documents).values(
                    collection_id=collection_id,
                    document_id=uuid.UUID(document_id),
                )
            )
        await db.commit()
    return str(collection_id)


async def seed_free_extraction_limit(user_id: uuid.UUID, document_id: str) -> None:
    from app.models.database import AsyncSessionLocal
    from app.models.tables import DocumentJob
    from app.services.extraction_service import (
        EXTRACTION_JOB_TYPE,
        FREE_MONTHLY_EXTRACTION_LIMIT,
    )

    async with AsyncSessionLocal() as db:
        for _idx in range(FREE_MONTHLY_EXTRACTION_LIMIT):
            db.add(
                DocumentJob(
                    user_id=user_id,
                    document_id=uuid.UUID(document_id),
                    job_type=EXTRACTION_JOB_TYPE,
                    status="succeeded",
                    input_scope={"qa_seed": True},
                    cost_credits=0,
                )
            )
        await db.commit()


async def complete_extraction_job(job_id: str, template_key: str = "key_facts") -> None:
    from app.models.database import AsyncSessionLocal
    from app.models.tables import DocumentJob, ExtractionResult

    now = datetime.now(timezone.utc)
    structured = {
        "facts": [
            {
                "label": "Revenue",
                "value": "42",
                "source_ref": 1,
            }
        ],
        "confidence": "high",
    }
    markdown = "# Key Facts\n\n- Revenue: 42 [1]\n"
    citations = [
        {
            "ref_index": 1,
            "document_id": None,
            "page": 1,
            "text_snippet": "Revenue | 42",
            "bboxes": [],
            "confidence_score": 0.91,
        }
    ]
    async with AsyncSessionLocal() as db:
        job = await db.get(DocumentJob, uuid.UUID(job_id))
        if job is None:
            raise RuntimeError(f"job not found: {job_id}")
        job.status = "succeeded"
        job.cost_credits = max(int(job.cost_credits or 0), 2)
        job.completed_at = now
        job.updated_at = now
        db.add(
            ExtractionResult(
                job_id=job.id,
                template_key=template_key,
                structured_json=structured,
                rendered_markdown=markdown,
                citations=citations,
            )
        )
        await db.commit()


async def complete_question_template_job(job_id: str) -> None:
    from app.models.database import AsyncSessionLocal
    from app.models.tables import DocumentJob, ExtractionResult
    from app.services.question_template_service import QUESTION_TEMPLATE_RESULT_KEY

    now = datetime.now(timezone.utc)
    structured = {
        "template": {"name": "QA Checklist"},
        "answers": [
            {
                "document_id": "synthetic",
                "document_filename": "qa-structured-owner.md",
                "question": "What is the revenue?",
                "answer": "Revenue is 42.",
                "citations": [
                    {
                        "ref_index": 1,
                        "page": 1,
                        "text_snippet": "Revenue | 42",
                    }
                ],
            }
        ],
    }
    markdown = "# QA Checklist\n\n| Document | Question | Answer | Sources |\n|---|---|---|---|\n| qa-structured-owner.md | What is the revenue? | Revenue is 42. | [1] |\n"
    async with AsyncSessionLocal() as db:
        job = await db.get(DocumentJob, uuid.UUID(job_id))
        if job is None:
            raise RuntimeError(f"job not found: {job_id}")
        job.status = "succeeded"
        job.cost_credits = max(int(job.cost_credits or 0), 2)
        job.completed_at = now
        job.updated_at = now
        db.add(
            ExtractionResult(
                job_id=job.id,
                template_key=QUESTION_TEMPLATE_RESULT_KEY,
                structured_json=structured,
                rendered_markdown=markdown,
                citations=[],
            )
        )
        await db.commit()


def safe_json(response: Any) -> Any:
    try:
        return response.json()
    except Exception:
        return {"text": response.text[:1000]}


def error_code(body: Any) -> str | None:
    detail = body.get("detail") if isinstance(body, dict) else None
    if isinstance(detail, dict):
        return detail.get("error")
    if isinstance(body, dict):
        return body.get("error")
    return None


def compact_response(response: Any, body: Any) -> dict[str, Any]:
    return {
        "status": response.status_code,
        "content_type": response.headers.get("content-type"),
        "body": body,
    }


def check(
    checks: list[dict[str, Any]],
    name: str,
    response: Any,
    expected_status: int,
    body: Any,
    *,
    predicate: bool = True,
    extra: dict[str, Any] | None = None,
) -> Any:
    passed = response.status_code == expected_status and bool(predicate)
    checks.append(
        {
            "name": name,
            "result": "pass" if passed else "fail",
            "expected_status": expected_status,
            "actual_status": response.status_code,
            "error": error_code(body),
            "body": body if not passed else compact_body(body),
            "extra": extra or {},
        }
    )
    return body


def check_export(
    checks: list[dict[str, Any]],
    name: str,
    response: Any,
    *,
    expected_status: int = 200,
    expected_content_type: str,
    expected_text: str | None = None,
) -> None:
    text = response.content.decode("utf-8-sig", errors="replace")
    passed = (
        response.status_code == expected_status
        and expected_content_type in (response.headers.get("content-type") or "")
        and (expected_text is None or expected_text in text)
    )
    checks.append(
        {
            "name": name,
            "result": "pass" if passed else "fail",
            "expected_status": expected_status,
            "actual_status": response.status_code,
            "content_type": response.headers.get("content-type"),
            "bytes": len(response.content),
            "preview": text[:240],
        }
    )


def compact_body(body: Any) -> Any:
    if isinstance(body, list):
        return {"count": len(body), "first": compact_body(body[0]) if body else None}
    if not isinstance(body, dict):
        return body
    keys = [
        "id",
        "name",
        "status",
        "job_type",
        "document_id",
        "collection_id",
        "template_key",
        "questions",
        "cost_credits",
        "error_code",
        "error_message",
        "required_plan",
        "limit",
        "used",
        "page",
        "table_index",
        "rows",
        "method",
        "confidence",
    ]
    return {key: body.get(key) for key in keys if key in body}


def install_noop_worker_enqueues() -> None:
    from app.workers import extraction_worker, question_template_worker, table_worker

    table_worker.run_table_scan_job.delay = lambda _job_id: None
    extraction_worker.run_extraction_job.delay = lambda _job_id: None
    question_template_worker.run_batch_template_job.delay = lambda _job_id: None


async def cleanup(user_ids: list[uuid.UUID]) -> dict[str, int]:
    from app.core.cache import cache_delete
    from app.models.database import AsyncSessionLocal
    from app.models.tables import Document, ProductEvent, User

    async with AsyncSessionLocal() as db:
        if user_ids:
            await db.execute(delete(ProductEvent).where(ProductEvent.user_id.in_(user_ids)))
            doc_ids = (await db.scalars(select(Document.id).where(Document.user_id.in_(user_ids)))).all()
            for document_id in doc_ids:
                doc = await db.get(Document, document_id)
                if doc is not None:
                    await db.delete(doc)
            for user_id in user_ids:
                user = await db.get(User, user_id)
                if user is not None:
                    await db.delete(user)
                await cache_delete(f"user:profile:{user_id}")
                await cache_delete(f"user:billing_state:{user_id}")
        await db.commit()

    async with AsyncSessionLocal() as db:
        users = await db.scalar(select(func.count()).select_from(User).where(User.id.in_(user_ids))) if user_ids else 0
        docs = await db.scalar(select(func.count()).select_from(Document).where(Document.user_id.in_(user_ids))) if user_ids else 0
        events = await db.scalar(select(func.count()).select_from(ProductEvent).where(ProductEvent.user_id.in_(user_ids))) if user_ids else 0
        pattern_users = await db.scalar(
            select(func.count()).select_from(User).where(User.email.like("qa-structured-%@example.com"))
        )
        pattern_docs = await db.scalar(
            select(func.count()).select_from(Document).where(Document.filename.like("qa-structured-%"))
        )
    return {
        "users": int(users or 0),
        "documents": int(docs or 0),
        "product_events": int(events or 0),
        "qa_structured_users": int(pattern_users or 0),
        "qa_structured_documents": int(pattern_docs or 0),
    }


async def run_matrix(args: argparse.Namespace) -> dict[str, Any]:
    from httpx import ASGITransport, AsyncClient

    from app.main import app
    from app.services.table_service import run_table_scan_job_sync

    install_noop_worker_enqueues()
    owner = await create_user("owner", "pro")
    plus = await create_user("plus", "plus")
    free = await create_user("free", "free", credits=20000)
    other = await create_user("other", "pro")
    user_ids = [owner["id"], plus["id"], free["id"], other["id"]]
    headers = {
        "owner": {"Authorization": f"Bearer {token_for(owner['id'])}"},
        "plus": {"Authorization": f"Bearer {token_for(plus['id'])}"},
        "free": {"Authorization": f"Bearer {token_for(free['id'])}"},
        "other": {"Authorization": f"Bearer {token_for(other['id'])}"},
    }
    report: dict[str, Any] = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "scope": "structured extraction, table scan, and question-template API contract matrix",
        "users": {
            "owner": {"id": str(owner["id"]), "plan": owner["plan"]},
            "plus": {"id": str(plus["id"]), "plan": plus["plan"]},
            "free": {"id": str(free["id"]), "plan": free["plan"]},
            "other": {"id": str(other["id"]), "plan": other["plan"]},
        },
        "checks": [],
        "cleanup": "pending",
    }
    try:
        owner_doc = await create_markdown_document(owner["id"], "owner", ready=True)
        owner_not_ready = await create_markdown_document(owner["id"], "not-ready", ready=False)
        free_doc = await create_markdown_document(free["id"], "free", ready=True)
        plus_doc = await create_markdown_document(plus["id"], "plus", ready=True)
        collection_id = await create_collection(owner["id"], "QA Structured Collection", [owner_doc["id"]])
        plus_collection_id = await create_collection(plus["id"], "QA Structured Plus Collection", [plus_doc["id"]])
        await seed_free_extraction_limit(free["id"], free_doc["id"])
        report["documents"] = {
            "owner": owner_doc,
            "owner_not_ready": owner_not_ready,
            "free": free_doc,
            "plus": plus_doc,
        }
        report["collections"] = {
            "owner": collection_id,
            "plus": plus_collection_id,
        }

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            checks = report["checks"]

            # Structured extraction templates and jobs.
            res = await client.get("/api/extraction-templates")
            templates = safe_json(res)
            check(
                checks,
                "extraction_templates_public_list",
                res,
                200,
                templates,
                predicate=isinstance(templates, list) and {"executive_summary", "key_facts", "evidence_table"}.issubset(
                    {item.get("key") for item in templates if isinstance(item, dict)}
                ),
            )

            res = await client.post(
                f"/api/documents/{owner_doc['id']}/extractions",
                headers=headers["owner"],
                json={"template_key": "not_real", "locale": "en"},
            )
            body = safe_json(res)
            check(
                checks,
                "extraction_unsupported_template",
                res,
                400,
                body,
                predicate=error_code(body) == "UNSUPPORTED_EXTRACTION_TEMPLATE",
            )

            res = await client.post(
                f"/api/documents/{owner_not_ready['id']}/extractions",
                headers=headers["owner"],
                json={"template_key": "key_facts", "locale": "en"},
            )
            body = safe_json(res)
            check(checks, "extraction_document_not_ready", res, 409, body, predicate=error_code(body) == "DOCUMENT_NOT_READY")

            res = await client.post(
                f"/api/documents/{free_doc['id']}/extractions",
                headers=headers["free"],
                json={"template_key": "key_facts", "locale": "en"},
            )
            body = safe_json(res)
            check(
                checks,
                "extraction_free_limit_reached",
                res,
                403,
                body,
                predicate=error_code(body) == "EXTRACTION_LIMIT_REACHED",
            )

            res = await client.post(
                f"/api/documents/{owner_doc['id']}/extractions",
                headers=headers["owner"],
                json={"template_key": "key_facts", "locale": "en", "domain_mode": "legal"},
            )
            extraction_job = safe_json(res)
            extraction_job_id = extraction_job.get("id")
            check(
                checks,
                "extraction_create_job",
                res,
                202,
                extraction_job,
                predicate=extraction_job.get("status") == "queued"
                and extraction_job.get("input_scope", {}).get("template_key") == "key_facts",
            )
            await complete_extraction_job(extraction_job_id, "key_facts")

            res = await client.get(f"/api/documents/{owner_doc['id']}/extractions", headers=headers["owner"])
            body = safe_json(res)
            check(
                checks,
                "extraction_list_document_jobs",
                res,
                200,
                body,
                predicate=isinstance(body, list) and any(item.get("id") == extraction_job_id and item.get("result") for item in body),
            )

            res = await client.get(f"/api/extractions/{extraction_job_id}", headers=headers["owner"])
            body = safe_json(res)
            check(
                checks,
                "extraction_get_completed_job",
                res,
                200,
                body,
                predicate=body.get("status") == "succeeded" and body.get("result", {}).get("template_key") == "key_facts",
            )
            res = await client.get(f"/api/extractions/{extraction_job_id}", headers=headers["other"])
            body = safe_json(res)
            check(checks, "extraction_get_other_user_404", res, 404, body, predicate=error_code(body) == "EXTRACTION_NOT_FOUND")
            res = await client.get(f"/api/extractions/{extraction_job_id}/export?format=md", headers=headers["owner"])
            check_export(checks, "extraction_export_md", res, expected_content_type="text/markdown", expected_text="Revenue")
            res = await client.get(f"/api/extractions/{extraction_job_id}/export?format=csv", headers=headers["owner"])
            check_export(checks, "extraction_export_csv", res, expected_content_type="text/csv", expected_text="Revenue")
            res = await client.get(f"/api/extractions/{extraction_job_id}/export?format=md", headers=headers["other"])
            body = safe_json(res)
            check(checks, "extraction_export_other_user_404", res, 404, body, predicate=error_code(body) == "EXTRACTION_NOT_FOUND")

            # Table scan workflow.
            res = await client.post(f"/api/documents/{owner_not_ready['id']}/tables/scan", headers=headers["owner"])
            body = safe_json(res)
            check(checks, "tables_scan_document_not_ready", res, 409, body, predicate=error_code(body) == "DOCUMENT_NOT_READY")

            res = await client.post(f"/api/documents/{owner_doc['id']}/tables/scan", headers=headers["owner"])
            table_job = safe_json(res)
            table_job_id = table_job.get("id")
            check(
                checks,
                "tables_scan_create_job",
                res,
                202,
                table_job,
                predicate=table_job.get("status") == "queued" and table_job.get("job_type") == "table_scan",
            )
            res = await client.post(f"/api/documents/{owner_doc['id']}/tables/scan", headers=headers["owner"])
            duplicate_job = safe_json(res)
            check(
                checks,
                "tables_scan_duplicate_returns_existing",
                res,
                202,
                duplicate_job,
                predicate=duplicate_job.get("id") == table_job_id,
            )
            run_table_scan_job_sync(table_job_id)

            res = await client.get(f"/api/document-table-scans/{table_job_id}", headers=headers["owner"])
            body = safe_json(res)
            check(
                checks,
                "tables_get_scan_job_succeeded",
                res,
                200,
                body,
                predicate=body.get("status") == "succeeded" and body.get("metadata_json", {}).get("tables_detected") == 1,
            )
            res = await client.get(f"/api/document-table-scans/{table_job_id}", headers=headers["other"])
            body = safe_json(res)
            check(checks, "tables_get_scan_other_user_404", res, 404, body, predicate=error_code(body) == "TABLE_SCAN_NOT_FOUND")

            res = await client.get(f"/api/documents/{owner_doc['id']}/tables", headers=headers["owner"])
            tables = safe_json(res)
            table_id = tables[0]["id"] if isinstance(tables, list) and tables else None
            check(
                checks,
                "tables_list_detected_table",
                res,
                200,
                tables,
                predicate=isinstance(tables, list)
                and len(tables) == 1
                and tables[0].get("rows", [[]])[0][:2] == ["Metric", "Value"],
            )
            res = await client.get(f"/api/documents/{owner_doc['id']}/tables", headers=headers["other"])
            body = safe_json(res)
            check(checks, "tables_list_other_user_404", res, 404, body, predicate=error_code(body) == "DOCUMENT_NOT_FOUND")
            res = await client.get(f"/api/document-tables/{table_id}/export", headers=headers["owner"])
            check_export(checks, "tables_export_single_csv", res, expected_content_type="text/csv", expected_text="Revenue")
            res = await client.get(f"/api/documents/{owner_doc['id']}/tables/export", headers=headers["owner"])
            check_export(checks, "tables_export_document_csv", res, expected_content_type="text/csv", expected_text="Page 1 Table 1")
            res = await client.get(f"/api/document-tables/{table_id}/export", headers=headers["other"])
            body = safe_json(res)
            check(checks, "tables_export_other_user_404", res, 404, body, predicate=error_code(body) == "DOCUMENT_NOT_FOUND")
            res = await client.get(f"/api/document-tables/{table_id}/export", headers=headers["free"])
            body = safe_json(res)
            check(checks, "tables_export_free_plan_required", res, 403, body, predicate=error_code(body) == "PLAN_REQUIRED")

            # Question template CRUD and deterministic completed run exports.
            res = await client.post(
                "/api/question-templates",
                headers=headers["owner"],
                json={"name": "   QA Checklist   ", "description": "  Structured API QA  ", "questions": ["What is the revenue?", "   ", "What is churn?"]},
            )
            template = safe_json(res)
            template_id = template.get("id")
            check(
                checks,
                "question_template_create_normalizes_questions",
                res,
                201,
                template,
                predicate=template.get("name") == "QA Checklist" and template.get("questions") == ["What is the revenue?", "What is churn?"],
            )
            res = await client.post(
                "/api/question-templates",
                headers=headers["owner"],
                json={"name": "Empty", "questions": ["   "]},
            )
            body = safe_json(res)
            check(checks, "question_template_create_empty_questions", res, 400, body, predicate=error_code(body) == "QUESTION_TEMPLATE_EMPTY")
            res = await client.get("/api/question-templates", headers=headers["owner"])
            body = safe_json(res)
            check(
                checks,
                "question_template_list_owner",
                res,
                200,
                body,
                predicate=isinstance(body, list) and any(item.get("id") == template_id for item in body),
            )
            res = await client.get("/api/question-templates", headers=headers["other"])
            body = safe_json(res)
            check(checks, "question_template_list_other_empty", res, 200, body, predicate=body == [])
            res = await client.patch(
                f"/api/question-templates/{template_id}",
                headers=headers["owner"],
                json={"name": "QA Checklist Updated", "description": None, "questions": ["What is revenue?"]},
            )
            template = safe_json(res)
            check(
                checks,
                "question_template_update_owner",
                res,
                200,
                template,
                predicate=template.get("name") == "QA Checklist Updated" and template.get("description") is None,
            )
            res = await client.patch(
                f"/api/question-templates/{template_id}",
                headers=headers["other"],
                json={"name": "Steal", "questions": ["No"]},
            )
            body = safe_json(res)
            check(checks, "question_template_update_other_404", res, 404, body, predicate=error_code(body) == "QUESTION_TEMPLATE_NOT_FOUND")

            res = await client.post(
                f"/api/documents/{owner_doc['id']}/question-template-runs",
                headers=headers["free"],
                json={"template_id": template_id, "locale": "en"},
            )
            body = safe_json(res)
            check(checks, "question_template_document_run_free_requires_plus", res, 403, body, predicate=error_code(body) == "PLAN_REQUIRED")
            res = await client.post(
                f"/api/collections/{plus_collection_id}/question-template-runs",
                headers=headers["plus"],
                json={"template_id": template_id, "locale": "en"},
            )
            body = safe_json(res)
            check(checks, "question_template_collection_run_plus_requires_pro", res, 403, body, predicate=error_code(body) == "PLAN_REQUIRED")
            res = await client.post(
                f"/api/documents/{owner_not_ready['id']}/question-template-runs",
                headers=headers["owner"],
                json={"template_id": template_id, "locale": "en"},
            )
            body = safe_json(res)
            check(checks, "question_template_document_run_not_ready", res, 409, body, predicate=error_code(body) == "DOCUMENT_NOT_READY")
            res = await client.post(
                f"/api/documents/{owner_doc['id']}/question-template-runs",
                headers=headers["owner"],
                json={"template_id": template_id, "locale": "en"},
            )
            question_run = safe_json(res)
            question_run_id = question_run.get("id")
            check(
                checks,
                "question_template_document_run_create",
                res,
                202,
                question_run,
                predicate=question_run.get("status") == "queued"
                and question_run.get("job_type") == "batch_template"
                and int(question_run.get("cost_credits") or 0) == 0,
            )
            await complete_question_template_job(question_run_id)
            res = await client.get(f"/api/question-template-runs/{question_run_id}", headers=headers["owner"])
            body = safe_json(res)
            check(
                checks,
                "question_template_get_completed_run",
                res,
                200,
                body,
                predicate=body.get("status") == "succeeded" and body.get("result", {}).get("template_key") == "question_template",
            )
            res = await client.get(f"/api/documents/{owner_doc['id']}/question-template-runs", headers=headers["owner"])
            body = safe_json(res)
            check(
                checks,
                "question_template_list_document_runs",
                res,
                200,
                body,
                predicate=isinstance(body, list) and any(item.get("id") == question_run_id for item in body),
            )
            res = await client.get(f"/api/question-template-runs/{question_run_id}", headers=headers["other"])
            body = safe_json(res)
            check(checks, "question_template_get_other_user_404", res, 404, body, predicate=error_code(body) == "QUESTION_TEMPLATE_RUN_NOT_FOUND")
            res = await client.get(f"/api/question-template-runs/{question_run_id}/export?format=md", headers=headers["owner"])
            check_export(checks, "question_template_export_md", res, expected_content_type="text/markdown", expected_text="QA Checklist")
            res = await client.get(f"/api/question-template-runs/{question_run_id}/export?format=csv", headers=headers["owner"])
            check_export(checks, "question_template_export_csv", res, expected_content_type="text/csv", expected_text="Revenue is 42")

            res = await client.delete(f"/api/question-templates/{template_id}", headers=headers["other"])
            body = safe_json(res)
            check(checks, "question_template_delete_other_404", res, 404, body, predicate=error_code(body) == "QUESTION_TEMPLATE_NOT_FOUND")
            res = await client.delete(f"/api/question-templates/{template_id}", headers=headers["owner"])
            body = safe_json(res)
            check(checks, "question_template_delete_owner", res, 204, body)
            res = await client.get("/api/question-templates", headers=headers["owner"])
            body = safe_json(res)
            check(checks, "question_template_list_empty_after_delete", res, 200, body, predicate=body == [])

    finally:
        if args.keep:
            report["cleanup"] = "kept"
        else:
            report["cleanup"] = await cleanup(user_ids)

    failed = [item["name"] for item in report["checks"] if item["result"] != "pass"]
    cleanup_ok = report["cleanup"] == "kept" or all(value == 0 for value in report["cleanup"].values())
    report["summary"] = {
        "total": len(report["checks"]),
        "passed": len(report["checks"]) - len(failed),
        "failed": failed,
        "cleanup_ok": cleanup_ok,
    }
    report["result"] = "pass" if not failed and cleanup_ok else "fail"
    return report


def write_report(path: str, report: dict[str, Any]) -> None:
    out = Path(path)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main() -> None:
    args = parse_args()
    report = asyncio.run(run_matrix(args))
    write_report(args.json_out, report)
    print(
        f"{report['result'].upper()}: structured workflow matrix "
        f"passed={report['summary']['passed']}/{report['summary']['total']} "
        f"failed={len(report['summary']['failed'])}"
    )
    if report["result"] != "pass":
        raise SystemExit(1)


if __name__ == "__main__":
    main()
