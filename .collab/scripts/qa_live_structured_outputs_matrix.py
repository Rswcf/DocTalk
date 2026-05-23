#!/usr/bin/env python3
"""Run or plan live structured-output quality checks.

This matrix targets the LLM-backed worker paths for structured extraction and
question templates. It creates synthetic ready Markdown documents with chunks
only during execution. It never accepts or writes provider keys; the backend
environment must already be configured normally for live mode.
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

import sqlalchemy as sa
from sqlalchemy import delete, func, insert, select

ROOT = Path(__file__).resolve().parents[2]
BACKEND_DIR = ROOT / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://doctalk:doctalk@localhost:5432/doctalk")
os.environ.setdefault("AUTH_SECRET", "qa-local-auth-secret")
os.environ.setdefault("ADAPTER_SECRET", "qa-local-adapter-secret")
os.environ.setdefault("TESTING", "1")


DOCUMENT_SPECS: list[dict[str, Any]] = [
    {
        "id": "finance-memo",
        "filename": "qa-live-structured-finance.md",
        "title": "Finance Operating Memo",
        "chunks": [
            {
                "section_title": "Quarterly Metrics",
                "text": (
                    "Revenue was 42 million dollars in Q2. Retention was 94 percent, churn was 3 percent, "
                    "and the finance team flagged two escalation risks for enterprise accounts."
                ),
            },
            {
                "section_title": "Operating Risks",
                "text": (
                    "The company must monitor support coverage, renewal timing, and delayed procurement. "
                    "Management recommends weekly review until the Q3 operating checkpoint."
                ),
            },
        ],
    },
    {
        "id": "product-plan",
        "filename": "qa-live-structured-product.md",
        "title": "Product Launch Plan",
        "chunks": [
            {
                "section_title": "Launch Readiness",
                "text": (
                    "The launch plan requires support coverage, rollback checks, and a documented escalation channel. "
                    "The support owner is ready and rollback is documented."
                ),
            },
            {
                "section_title": "Customer Notes",
                "text": "Chinese coverage note: 客户反馈稳定。The team should validate citation jumps after release.",
            },
        ],
    },
]


MATRIX_CASES: list[dict[str, Any]] = [
    {
        "id": "extraction-executive-summary",
        "kind": "extraction",
        "document": "finance-memo",
        "template_key": "executive_summary",
        "expect_any": ["Revenue", "Q2", "retention", "risk", "support"],
        "require_citations": True,
    },
    {
        "id": "extraction-key-facts",
        "kind": "extraction",
        "document": "finance-memo",
        "template_key": "key_facts",
        "expect_any": ["42", "94", "3", "Revenue", "Retention"],
        "require_citations": True,
    },
    {
        "id": "extraction-evidence-table",
        "kind": "extraction",
        "document": "product-plan",
        "template_key": "evidence_table",
        "expect_any": ["support", "rollback", "escalation", "客户反馈"],
        "require_citations": True,
    },
    {
        "id": "question-template-document",
        "kind": "question_template",
        "documents": ["finance-memo"],
        "template_name": "Finance QA Checklist",
        "questions": [
            "What was Q2 revenue?",
            "What retention or churn metrics are stated?",
            "What risks should management monitor?",
        ],
        "expect_any": ["42", "94", "3", "risk", "support"],
        "require_citations": True,
    },
    {
        "id": "question-template-collection",
        "kind": "question_template",
        "documents": ["finance-memo", "product-plan"],
        "template_name": "Cross Document Launch Checklist",
        "questions": [
            "What risks or readiness items are mentioned?",
            "Which operational follow-up is recommended?",
        ],
        "expect_any": ["support", "rollback", "Q3", "review", "风险"],
        "require_citations": True,
    },
]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--json-out", required=True)
    parser.add_argument("--plan-only", action="store_true")
    parser.add_argument("--case", action="append", help="Run only matching case id. May be repeated.")
    parser.add_argument("--allow-blocked", action="store_true")
    parser.add_argument("--keep", action="store_true")
    return parser.parse_args()


def selected_cases(args: argparse.Namespace) -> list[dict[str, Any]]:
    wanted = set(args.case or [])
    return [case for case in MATRIX_CASES if not wanted or case["id"] in wanted]


def contains_any(text: str, terms: list[str]) -> bool:
    lowered = text.lower()
    return any(term.lower() in lowered for term in terms)


def has_provider_config() -> tuple[bool, str | None]:
    from app.core.config import settings
    from app.services.extraction_service import EXTRACTION_MODEL

    if EXTRACTION_MODEL in settings.DEEPSEEK_OFFICIAL_MODELS:
        return bool(settings.DEEPSEEK_API_KEY), "DEEPSEEK_API_KEY"
    return bool(settings.OPENROUTER_API_KEY), "OPENROUTER_API_KEY"


async def create_user() -> Any:
    from app.models.database import AsyncSessionLocal
    from app.services import auth_service

    email = f"qa-live-structured-{datetime.now(timezone.utc).strftime('%Y%m%d-%H%M%S')}-{uuid.uuid4().hex[:8]}@example.com"
    async with AsyncSessionLocal() as db:
        user = await auth_service.create_user(db, email=email, name="QA Live Structured")
        user.plan = "pro"
        user.credits_balance = 20000
        await db.commit()
        await db.refresh(user)
        return user


async def create_documents(user_id: uuid.UUID) -> dict[str, str]:
    from app.models.database import AsyncSessionLocal
    from app.models.tables import Chunk, Document, Page

    doc_ids: dict[str, str] = {}
    async with AsyncSessionLocal() as db:
        for spec in DOCUMENT_SPECS:
            doc_id = uuid.uuid4()
            full_text = "\n\n".join(
                f"## {chunk['section_title']}\n{chunk['text']}" for chunk in spec["chunks"]
            )
            db.add(
                Document(
                    id=doc_id,
                    filename=spec["filename"],
                    file_size=len(full_text.encode("utf-8")),
                    page_count=len(spec["chunks"]),
                    storage_key=f"qa-live-structured/{doc_id}.md",
                    status="ready",
                    pages_parsed=len(spec["chunks"]),
                    chunks_total=len(spec["chunks"]),
                    chunks_indexed=len(spec["chunks"]),
                    user_id=user_id,
                    file_type="md",
                )
            )
            for idx, chunk in enumerate(spec["chunks"], start=1):
                db.add(
                    Page(
                        document_id=doc_id,
                        page_number=idx,
                        width_pt=612,
                        height_pt=792,
                        rotation=0,
                        content=f"## {chunk['section_title']}\n{chunk['text']}",
                    )
                )
                db.add(
                    Chunk(
                        document_id=doc_id,
                        chunk_index=idx - 1,
                        text=chunk["text"],
                        token_count=max(1, len(chunk["text"].split())),
                        page_start=idx,
                        page_end=idx,
                        bboxes=[
                            {
                                "page": idx,
                                "x": 0.08,
                                "y": 0.12,
                                "w": 0.84,
                                "h": 0.12,
                            }
                        ],
                        section_title=chunk["section_title"],
                        vector_id=str(uuid.uuid4()),
                    )
                )
            doc_ids[spec["id"]] = str(doc_id)
        await db.commit()
    return doc_ids


async def create_collection(user_id: uuid.UUID, document_ids: list[str]) -> str:
    from app.models.database import AsyncSessionLocal
    from app.models.tables import Collection, collection_documents

    collection_id = uuid.uuid4()
    async with AsyncSessionLocal() as db:
        db.add(
            Collection(
                id=collection_id,
                name="QA Live Structured Collection",
                description="Synthetic live structured-output QA collection",
                user_id=user_id,
            )
        )
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


async def predebit(user_id: uuid.UUID, job_id: uuid.UUID, cost: int, reason: str) -> str:
    from app.models.database import AsyncSessionLocal
    from app.services import credit_service

    async with AsyncSessionLocal() as db:
        ledger_id = await credit_service.debit_credits(
            db,
            user_id=user_id,
            cost=cost,
            reason=reason,
            ref_type="document_job",
            ref_id=str(job_id),
        )
        if ledger_id is None:
            raise RuntimeError(f"Insufficient credits for {reason}")
        await db.commit()
        return str(ledger_id)


async def create_extraction_job(user_id: uuid.UUID, document_id: str, template_key: str) -> str:
    from app.models.database import AsyncSessionLocal
    from app.models.tables import DocumentJob
    from app.services.extraction_service import EXTRACTION_JOB_TYPE, EXTRACTION_PREDEBIT_CREDITS

    job_id = uuid.uuid4()
    ledger_id = await predebit(user_id, job_id, EXTRACTION_PREDEBIT_CREDITS, "extraction")
    async with AsyncSessionLocal() as db:
        db.add(
            DocumentJob(
                id=job_id,
                user_id=user_id,
                document_id=uuid.UUID(document_id),
                job_type=EXTRACTION_JOB_TYPE,
                status="queued",
                input_scope={"template_key": template_key, "locale": "en", "domain_mode": None},
                metadata_json={
                    "predebit_ledger_id": ledger_id,
                    "pre_debited": EXTRACTION_PREDEBIT_CREDITS,
                },
            )
        )
        await db.commit()
    return str(job_id)


async def create_question_template_job(
    user_id: uuid.UUID,
    document_ids: list[str],
    template_name: str,
    questions: list[str],
    collection_id: str | None,
) -> str:
    from app.models.database import AsyncSessionLocal
    from app.models.tables import DocumentJob, QuestionTemplate
    from app.services.question_template_service import (
        BATCH_TEMPLATE_JOB_TYPE,
        estimated_template_cost,
    )

    template_id = uuid.uuid4()
    job_id = uuid.uuid4()
    predebit_cost = estimated_template_cost(len(questions), len(document_ids))
    ledger_id = await predebit(user_id, job_id, predebit_cost, "question_template")
    async with AsyncSessionLocal() as db:
        db.add(
            QuestionTemplate(
                id=template_id,
                user_id=user_id,
                name=template_name,
                description="QA live structured-output template",
                questions=questions,
            )
        )
        db.add(
            DocumentJob(
                id=job_id,
                user_id=user_id,
                document_id=uuid.UUID(document_ids[0]) if len(document_ids) == 1 else None,
                collection_id=uuid.UUID(collection_id) if collection_id else None,
                job_type=BATCH_TEMPLATE_JOB_TYPE,
                status="queued",
                input_scope={
                    "template_id": str(template_id),
                    "template_name": template_name,
                    "questions": questions,
                    "document_ids": document_ids,
                    "locale": "en",
                },
                metadata_json={
                    "predebit_ledger_id": ledger_id,
                    "pre_debited": predebit_cost,
                },
            )
        )
        await db.commit()
    return str(job_id)


async def load_job(job_id: str) -> dict[str, Any]:
    from sqlalchemy.orm import selectinload

    from app.models.database import AsyncSessionLocal
    from app.models.tables import DocumentJob

    async with AsyncSessionLocal() as db:
        row = await db.execute(
            select(DocumentJob)
            .options(selectinload(DocumentJob.extraction_result))
            .where(DocumentJob.id == uuid.UUID(job_id))
        )
        job = row.scalar_one()
        result = job.__dict__.get("extraction_result")
        return {
            "id": str(job.id),
            "job_type": job.job_type,
            "status": job.status,
            "error_code": job.error_code,
            "error_message": job.error_message,
            "cost_credits": job.cost_credits,
            "result": {
                "template_key": result.template_key,
                "structured_json": result.structured_json,
                "rendered_markdown": result.rendered_markdown,
                "citations": result.citations,
            }
            if result
            else None,
        }


def evaluate_case(case: dict[str, Any], job: dict[str, Any]) -> dict[str, Any]:
    result = job.get("result") or {}
    structured = result.get("structured_json") or {}
    rendered = result.get("rendered_markdown") or ""
    citations = result.get("citations") or []
    body = json.dumps(structured, ensure_ascii=False) + "\n" + rendered

    checks = {
        "job_succeeded": job.get("status") == "succeeded",
        "structured_json_present": bool(structured),
        "rendered_markdown_present": len(rendered.strip()) >= 40,
        "expected_any_present": contains_any(body, case.get("expect_any") or []),
        "citation_requirement_met": bool(citations) if case.get("require_citations") else True,
        "citation_shape_valid": all(
            isinstance(citation.get("text_snippet"), str)
            and isinstance(citation.get("page"), int)
            and isinstance(citation.get("chunk_id"), str)
            for citation in citations
            if isinstance(citation, dict)
        )
        and (bool(citations) if case.get("require_citations") else True),
        "credits_reconciled": isinstance(job.get("cost_credits"), int) and job.get("cost_credits") >= 0,
    }
    blocked_reason = None
    if job.get("status") == "failed" and job.get("error_code") in {"EXTRACTION_FAILED", "BATCH_TEMPLATE_FAILED"}:
        ok, missing_key = has_provider_config()
        if not ok:
            blocked_reason = f"{missing_key} is not configured"

    result_status = "pass" if all(checks.values()) else "fail"
    if blocked_reason:
        result_status = "blocked"
    return {
        "result": result_status,
        "blocked_reason": blocked_reason,
        "quality_score": round(sum(1 for passed in checks.values() if passed) / len(checks), 3),
        "checks": checks,
        "citations_count": len(citations),
        "rendered_chars": len(rendered),
    }


async def cleanup_user(user_id: uuid.UUID | None) -> dict[str, int]:
    from app.models.database import AsyncSessionLocal
    from app.models.tables import Document, ProductEvent, User
    from app.services.doc_service import doc_service

    if user_id is None:
        return {"users": 0, "documents": 0, "product_events": 0}

    async with AsyncSessionLocal() as db:
        doc_ids = (await db.scalars(select(Document.id).where(Document.user_id == user_id))).all()
        for document_id in doc_ids:
            await doc_service.delete_document(document_id, db)
        await db.execute(delete(ProductEvent).where(ProductEvent.user_id == user_id))
        user = await db.get(User, user_id)
        if user is not None:
            await db.delete(user)
        await db.commit()

    async with AsyncSessionLocal() as db:
        users = await db.scalar(select(func.count()).select_from(User).where(User.id == user_id))
        docs = await db.scalar(select(func.count()).select_from(Document).where(Document.user_id == user_id))
        events = await db.scalar(select(func.count()).select_from(ProductEvent).where(ProductEvent.user_id == user_id))
    return {
        "users": int(users or 0),
        "documents": int(docs or 0),
        "product_events": int(events or 0),
    }


async def run(args: argparse.Namespace) -> dict[str, Any]:
    cases = selected_cases(args)
    provider_ready, required_key = has_provider_config()
    report: dict[str, Any] = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "provider_ready": provider_ready,
        "required_key": required_key,
        "documents": DOCUMENT_SPECS,
        "plan": cases,
        "cases": [],
    }
    if args.plan_only:
        report["status"] = "plan_only"
        report["summary"] = {
            "cases_total": len(cases),
            "extraction_cases": len([case for case in cases if case["kind"] == "extraction"]),
            "question_template_cases": len([case for case in cases if case["kind"] == "question_template"]),
            "required_key": required_key,
        }
        return report

    user = None
    doc_ids: dict[str, str] = {}
    collection_id: str | None = None
    try:
        user = await create_user()
        doc_ids = await create_documents(user.id)
        report["qa_user"] = {"id": str(user.id), "email": user.email, "plan": user.plan}
        report["document_ids"] = doc_ids
        if any(case["kind"] == "question_template" and len(case.get("documents") or []) > 1 for case in cases):
            collection_id = await create_collection(user.id, list(doc_ids.values()))
            report["collection_id"] = collection_id

        from app.services.extraction_service import run_extraction_job_sync
        from app.services.question_template_service import run_batch_template_job_sync

        for case in cases:
            case_report = {"id": case["id"], "kind": case["kind"]}
            try:
                if case["kind"] == "extraction":
                    job_id = await create_extraction_job(user.id, doc_ids[case["document"]], case["template_key"])
                    run_extraction_job_sync(job_id)
                else:
                    selected_doc_ids = [doc_ids[item] for item in case["documents"]]
                    job_id = await create_question_template_job(
                        user.id,
                        selected_doc_ids,
                        case["template_name"],
                        case["questions"],
                        collection_id if len(selected_doc_ids) > 1 else None,
                    )
                    run_batch_template_job_sync(job_id)
                job = await load_job(job_id)
                evaluation = evaluate_case(case, job)
                case_report.update({"job_id": job_id, "job": job, "evaluation": evaluation, "result": evaluation["result"]})
            except Exception as exc:
                case_report.update({"result": "fail", "error": f"{type(exc).__name__}: {exc}"})
            report["cases"].append(case_report)
            print(
                "CASE {case}: {result} kind={kind} score={score} citations={citations}".format(
                    case=case["id"],
                    result=str(case_report["result"]).upper(),
                    kind=case["kind"],
                    score=(case_report.get("evaluation") or {}).get("quality_score"),
                    citations=(case_report.get("evaluation") or {}).get("citations_count"),
                )
            )
    finally:
        if args.keep:
            report["cleanup"] = "kept"
        else:
            report["cleanup"] = await cleanup_user(user.id if user else None)

    failed = [case for case in report["cases"] if case.get("result") == "fail"]
    blocked = [case for case in report["cases"] if case.get("result") == "blocked"]
    report["status"] = "fail" if failed else "blocked" if blocked else "pass"
    report["summary"] = {
        "cases_total": len(report["cases"]),
        "cases_passed": len([case for case in report["cases"] if case.get("result") == "pass"]),
        "cases_failed": len(failed),
        "cases_blocked": len(blocked),
    }
    return report


def main() -> int:
    args = parse_args()
    report = asyncio.run(run(args))
    out = Path(args.json_out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    if report["status"] == "plan_only":
        print(
            "LIVE_STRUCTURED_OUTPUTS PLAN_ONLY: cases={cases_total} extractions={extraction_cases} question_templates={question_template_cases}".format(
                **report["summary"]
            )
        )
    else:
        print(
            "LIVE_STRUCTURED_OUTPUTS {status}: cases={cases_passed}/{cases_total} blocked={cases_blocked} failed={cases_failed}".format(
                status=report["status"].upper(),
                **report["summary"],
            )
        )
    return 0 if report["status"] in {"pass", "plan_only"} or (report["status"] == "blocked" and args.allow_blocked) else 1


if __name__ == "__main__":
    raise SystemExit(main())
