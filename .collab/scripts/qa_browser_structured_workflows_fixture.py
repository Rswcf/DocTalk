#!/usr/bin/env python3
"""Create or clean up browser fixtures for structured workflow UX QA."""

from __future__ import annotations

import argparse
import asyncio
import json
import sys
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

from sqlalchemy import delete, func, insert, select

ROOT = Path(__file__).resolve().parents[2]
BACKEND_DIR = ROOT / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))


DOCUMENT_TEXT = """# QA Structured Workflow Fixture

| Metric | Value | Notes |
|---|---:|---|
| Revenue | 42 | Synthetic table row |
| Churn | 3% | Synthetic table row |

Revenue is 42 in the synthetic structured workflow fixture. This sentence is the citation target for browser tests.
"""


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Create/cleanup structured workflow browser QA fixture.")
    sub = parser.add_subparsers(dest="command", required=True)
    create = sub.add_parser("create")
    create.add_argument("--json-out", required=True)
    cleanup = sub.add_parser("cleanup")
    cleanup.add_argument("--user-id", required=True)
    cleanup.add_argument("--json-out", required=True)
    return parser.parse_args()


def citation_payload(document_id: uuid.UUID, chunk_id: uuid.UUID, filename: str) -> dict[str, Any]:
    return {
        "ref_index": 1,
        "chunk_id": str(chunk_id),
        "document_id": str(document_id),
        "document_filename": filename,
        "page": 1,
        "page_end": 1,
        "text_snippet": "Revenue is 42 in the synthetic structured workflow fixture.",
        "bboxes": [],
        "confidence_score": 0.94,
    }


async def create_fixture(args: argparse.Namespace) -> dict[str, Any]:
    from app.models.database import AsyncSessionLocal
    from app.models.tables import (
        ChatSession,
        Chunk,
        Collection,
        Document,
        DocumentJob,
        DocumentTable,
        ExtractionResult,
        Message,
        Page,
        QuestionTemplate,
        collection_documents,
    )
    from app.services import auth_service
    from app.services.extraction_service import EXTRACTION_JOB_TYPE
    from app.services.question_template_service import (
        BATCH_TEMPLATE_JOB_TYPE,
        QUESTION_TEMPLATE_RESULT_KEY,
    )
    from app.services.table_service import TABLE_SCAN_JOB_TYPE

    stamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
    email = f"qa-browser-structured-{stamp}-{uuid.uuid4().hex[:8]}@example.com"
    now = datetime.now(timezone.utc)
    async with AsyncSessionLocal() as db:
        user = await auth_service.create_user(db, email=email, name="QA Browser Structured Workflows")
        user.plan = "pro"
        user.credits_balance = 20000

        document_id = uuid.uuid4()
        filename = "qa-structured-workflows.md"
        document = Document(
            id=document_id,
            filename=filename,
            file_size=len(DOCUMENT_TEXT.encode("utf-8")),
            page_count=1,
            storage_key=f"qa/browser-structured/{document_id}.md",
            status="ready",
            pages_parsed=1,
            chunks_total=1,
            chunks_indexed=1,
            user_id=user.id,
            file_type="md",
            summary="Synthetic structured workflow fixture.",
            suggested_questions=["Extract key facts", "Extract all tables as CSV"],
        )
        db.add(document)
        db.add(
            Page(
                document_id=document_id,
                page_number=1,
                width_pt=612,
                height_pt=792,
                rotation=0,
                content=DOCUMENT_TEXT,
            )
        )
        chunk_id = uuid.uuid4()
        db.add(
            Chunk(
                id=chunk_id,
                document_id=document_id,
                chunk_index=0,
                text="Revenue is 42 in the synthetic structured workflow fixture.",
                token_count=12,
                page_start=1,
                page_end=1,
                bboxes=[],
                section_title="QA Structured Workflow Fixture",
                vector_id=None,
            )
        )

        table_id = uuid.uuid4()
        table_rows = [
            ["Metric", "Value", "Notes"],
            ["Revenue", "42", "Synthetic table row"],
            ["Churn", "3%", "Synthetic table row"],
        ]
        db.add(
            DocumentTable(
                id=table_id,
                document_id=document_id,
                page=1,
                table_index=0,
                cells={"rows": table_rows},
                confidence=0.98,
                method="markdown",
            )
        )

        collection_id = uuid.uuid4()
        db.add(
            Collection(
                id=collection_id,
                name="QA Structured Workflows Collection",
                description="Synthetic collection for structured workflow browser QA.",
                user_id=user.id,
            )
        )
        await db.flush()
        await db.execute(insert(collection_documents).values(collection_id=collection_id, document_id=document_id))

        document_session_id = uuid.uuid4()
        collection_session_id = uuid.uuid4()
        db.add_all(
            [
                ChatSession(
                    id=document_session_id,
                    document_id=document_id,
                    user_id=user.id,
                    title="Structured workflow artifacts",
                    created_at=now,
                    updated_at=now,
                ),
                ChatSession(
                    id=collection_session_id,
                    collection_id=collection_id,
                    user_id=user.id,
                    title="Collection template session",
                    created_at=now,
                    updated_at=now,
                ),
            ]
        )

        extraction_job_id = uuid.uuid4()
        table_job_id = uuid.uuid4()
        template_run_job_id = uuid.uuid4()
        completed = now + timedelta(seconds=1)
        citation = citation_payload(document_id, chunk_id, filename)
        db.add_all(
            [
                DocumentJob(
                    id=extraction_job_id,
                    user_id=user.id,
                    document_id=document_id,
                    job_type=EXTRACTION_JOB_TYPE,
                    status="succeeded",
                    input_scope={"template_key": "key_facts", "locale": "en"},
                    cost_credits=2,
                    metadata_json={"source": "qa_browser_structured_workflows"},
                    completed_at=completed,
                ),
                ExtractionResult(
                    job_id=extraction_job_id,
                    template_key="key_facts",
                    structured_json={
                        "facts": [
                            {
                                "label": "Revenue",
                                "value": "42",
                                "context": "Synthetic browser QA fixture.",
                                "source_refs": [1],
                            }
                        ]
                    },
                    rendered_markdown="# Key Facts\n\n- Revenue: 42 [1]\n",
                    citations=[citation],
                ),
                DocumentJob(
                    id=table_job_id,
                    user_id=user.id,
                    document_id=document_id,
                    job_type=TABLE_SCAN_JOB_TYPE,
                    status="succeeded",
                    input_scope={"document_id": str(document_id), "export_requested": True},
                    cost_credits=0,
                    metadata_json={"provider": "markdown", "source": "qa_browser_structured_workflows"},
                    completed_at=completed,
                ),
                DocumentJob(
                    id=template_run_job_id,
                    user_id=user.id,
                    document_id=document_id,
                    collection_id=collection_id,
                    job_type=BATCH_TEMPLATE_JOB_TYPE,
                    status="succeeded",
                    input_scope={
                        "template_name": "QA Revenue Checklist",
                        "questions": ["What is the revenue?"],
                        "document_ids": [str(document_id)],
                        "locale": "en",
                    },
                    cost_credits=2,
                    metadata_json={"source": "qa_browser_structured_workflows"},
                    completed_at=completed,
                ),
                ExtractionResult(
                    job_id=template_run_job_id,
                    template_key=QUESTION_TEMPLATE_RESULT_KEY,
                    structured_json={
                        "template": {"name": "QA Revenue Checklist"},
                        "answers": [
                            {
                                "document_id": str(document_id),
                                "document_filename": filename,
                                "question": "What is the revenue?",
                                "answer": "Revenue is 42.",
                                "citations": [citation],
                            }
                        ],
                    },
                    rendered_markdown=(
                        "# QA Revenue Checklist\n\n"
                        "| Document | Question | Answer | Sources |\n"
                        "|---|---|---|---|\n"
                        f"| {filename} | What is the revenue? | Revenue is 42. | [1] |\n"
                    ),
                    citations=[citation],
                ),
            ]
        )

        template_id = uuid.uuid4()
        db.add(
            QuestionTemplate(
                id=template_id,
                user_id=user.id,
                name="QA Revenue Checklist",
                description="Synthetic checklist for browser QA.",
                questions=["What is the revenue?"],
            )
        )

        artifacts = [
            {
                "artifact_type": "extraction",
                "status": "succeeded",
                "job_id": str(extraction_job_id),
                "title": "Key Facts",
                "summary": "Ready.",
                "preview": {"markdown": "# Key Facts\n\n- Revenue: 42 [1]\n"},
                "download_urls": [
                    {"label": "Markdown", "format": "md", "url": f"/api/extractions/{extraction_job_id}/export?format=md"},
                    {"label": "CSV", "format": "csv", "url": f"/api/extractions/{extraction_job_id}/export?format=csv"},
                ],
                "citations": [citation],
            },
            {
                "artifact_type": "table_export",
                "status": "succeeded",
                "job_id": str(table_job_id),
                "title": "Tables",
                "summary": "1 table(s) detected. Provider: markdown.",
                "preview": [
                    {
                        "table_id": str(table_id),
                        "page": 1,
                        "table_index": 0,
                        "rows": table_rows,
                        "confidence": 0.98,
                        "method": "markdown",
                    }
                ],
                "download_urls": [
                    {"label": "Download CSV", "format": "csv", "url": f"/api/documents/{document_id}/tables/export"}
                ],
                "citations": [citation],
            },
            {
                "artifact_type": "template_run",
                "status": "succeeded",
                "job_id": str(template_run_job_id),
                "title": "Question template",
                "summary": "Ready.",
                "preview": {"markdown": "# QA Revenue Checklist\n\n- Revenue is 42. [1]\n"},
                "download_urls": [
                    {"label": "Markdown", "format": "md", "url": f"/api/question-template-runs/{template_run_job_id}/export?format=md"},
                    {"label": "CSV", "format": "csv", "url": f"/api/question-template-runs/{template_run_job_id}/export?format=csv"},
                ],
                "citations": [citation],
            },
        ]
        db.add_all(
            [
                Message(
                    session_id=document_session_id,
                    role="user",
                    content="Run the structured tools on this document.",
                    metadata_json={},
                    created_at=now + timedelta(seconds=2),
                ),
                Message(
                    session_id=document_session_id,
                    role="assistant",
                    content="Structured tool results are ready.",
                    citations=[],
                    metadata_json={"artifacts": artifacts},
                    created_at=now + timedelta(seconds=3),
                ),
                Message(
                    session_id=collection_session_id,
                    role="assistant",
                    content="Collection template fixture is ready.",
                    metadata_json={},
                    created_at=now + timedelta(seconds=3),
                ),
            ]
        )

        await db.commit()
        await db.refresh(user)

    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "result": "pass",
        "user": {"id": str(user.id), "email": user.email, "name": user.name, "plan": user.plan},
        "document_id": str(document_id),
        "document_session_id": str(document_session_id),
        "collection_id": str(collection_id),
        "collection_session_id": str(collection_session_id),
        "chunk_id": str(chunk_id),
        "table_id": str(table_id),
        "extraction_job_id": str(extraction_job_id),
        "table_job_id": str(table_job_id),
        "template_run_job_id": str(template_run_job_id),
        "question_template_id": str(template_id),
    }


async def cleanup_fixture(user_id: uuid.UUID) -> dict[str, Any]:
    from app.core.cache import cache_delete
    from app.models.database import AsyncSessionLocal
    from app.models.tables import Collection, Document, ProductEvent, User

    async with AsyncSessionLocal() as db:
        await db.execute(delete(ProductEvent).where(ProductEvent.user_id == user_id))
        collections = (await db.scalars(select(Collection).where(Collection.user_id == user_id))).all()
        for collection in collections:
            await db.delete(collection)
        documents = (await db.scalars(select(Document).where(Document.user_id == user_id))).all()
        for document in documents:
            await db.delete(document)
        user = await db.get(User, user_id)
        if user is not None:
            await db.delete(user)
        await cache_delete(f"user:profile:{user_id}")
        await cache_delete(f"user:billing_state:{user_id}")
        await db.commit()

    async with AsyncSessionLocal() as db:
        users = await db.scalar(select(func.count()).select_from(User).where(User.id == user_id))
        docs = await db.scalar(select(func.count()).select_from(Document).where(Document.user_id == user_id))
        prefixed_users = await db.scalar(
            select(func.count()).select_from(User).where(User.email.like("qa-browser-structured-%@example.com"))
        )
        prefixed_docs = await db.scalar(
            select(func.count()).select_from(Document).where(Document.filename.like("qa-structured-workflows%"))
        )
    return {
        "result": "pass",
        "cleanup": {
            "users": int(users or 0),
            "documents": int(docs or 0),
            "qa_browser_structured_users": int(prefixed_users or 0),
            "qa_browser_structured_documents": int(prefixed_docs or 0),
        },
    }


def write_json(path: str, payload: dict[str, Any]) -> None:
    output = ROOT / path if not Path(path).is_absolute() else Path(path)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


async def main() -> None:
    args = parse_args()
    if args.command == "create":
        payload = await create_fixture(args)
        write_json(args.json_out, payload)
        print(f"PASS: created structured workflow browser fixture user={payload['user']['id']}")
        return
    payload = await cleanup_fixture(uuid.UUID(args.user_id))
    write_json(args.json_out, payload)
    print(f"PASS: cleanup {payload['cleanup']}")


if __name__ == "__main__":
    asyncio.run(main())
