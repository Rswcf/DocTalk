#!/usr/bin/env python3
"""Create or clean up a completed document-diff browser UX fixture."""

from __future__ import annotations

import argparse
import asyncio
import json
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from sqlalchemy import func, select

ROOT = Path(__file__).resolve().parents[2]
BACKEND_DIR = ROOT / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))


OLD_TEXT = """# Refund Policy v1

Customers may request refunds within 7 days. The policy covers starter accounts and standard credit packs.

Enterprise exceptions require support review.
"""

NEW_TEXT = """# Refund Policy v2

Customers may request refunds within 14 days. The policy covers starter accounts, standard credit packs, and enterprise annual plans.

Enterprise exceptions require manager approval before support review.
"""


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    sub = parser.add_subparsers(dest="command", required=True)
    create = sub.add_parser("create")
    create.add_argument("--json-out", required=True)
    create_running = sub.add_parser("create-running")
    create_running.add_argument("--json-out", required=True)
    create_real_queued = sub.add_parser("create-real-queued")
    create_real_queued.add_argument("--json-out", required=True)
    complete = sub.add_parser("complete")
    complete.add_argument("--job-id", required=True)
    complete.add_argument("--json-out")
    cleanup = sub.add_parser("cleanup")
    cleanup.add_argument("--user-id", required=True)
    cleanup.add_argument("--json-out")
    return parser.parse_args()


def diff_payload(
    *,
    old_doc_id: uuid.UUID,
    old_filename: str,
    new_doc_id: uuid.UUID,
    new_filename: str,
    old_chunk_id: uuid.UUID,
    new_chunk_id: uuid.UUID,
) -> tuple[dict[str, Any], str, list[dict[str, Any]]]:
    structured = {
        "old_document": {"id": str(old_doc_id), "filename": old_filename},
        "new_document": {"id": str(new_doc_id), "filename": new_filename},
        "summary": "The new policy extends the refund window and adds enterprise annual plan coverage.",
        "changes": [
            {
                "kind": "modified",
                "title": "Refund window extended",
                "detail": "The refund request window changes from 7 days to 14 days.",
                "old_refs": [1],
                "new_refs": [1],
            },
            {
                "kind": "added",
                "title": "Enterprise annual plans added",
                "detail": "The new policy explicitly covers enterprise annual plans.",
                "old_refs": [],
                "new_refs": [1],
            },
        ],
    }
    markdown = (
        "# Document Diff\n\n"
        f"**Old:** {old_filename}\n"
        f"**New:** {new_filename}\n\n"
        "## Summary\n"
        "The new policy extends the refund window and adds enterprise annual plan coverage.\n\n"
        "## Modified\n"
        "- **Refund window extended**: The refund request window changes from 7 days to 14 days. [O1] [N1]\n\n"
        "## Added\n"
        "- **Enterprise annual plans added**: The new policy explicitly covers enterprise annual plans. [N1]\n"
    )
    citations = [
        {
            "ref_index": 1,
            "side": "old",
            "label": "O1",
            "chunk_id": str(old_chunk_id),
            "document_id": str(old_doc_id),
            "document_filename": old_filename,
            "page": 1,
            "page_end": 1,
            "text_snippet": "Customers may request refunds within 7 days.",
            "bboxes": [],
            "confidence_score": 0.91,
        },
        {
            "ref_index": 1,
            "side": "new",
            "label": "N1",
            "chunk_id": str(new_chunk_id),
            "document_id": str(new_doc_id),
            "document_filename": new_filename,
            "page": 1,
            "page_end": 1,
            "text_snippet": "Customers may request refunds within 14 days and enterprise annual plans are covered.",
            "bboxes": [],
            "confidence_score": 0.93,
        },
    ]
    return structured, markdown, citations


async def create_fixture(args: argparse.Namespace, *, completed: bool = True, real_queued: bool = False) -> dict[str, Any]:
    from app.models.database import AsyncSessionLocal
    from app.models.tables import Chunk, CreditLedger, Document, DocumentJob, ExtractionResult, Page
    from app.services import auth_service
    from app.services.document_diff_service import (
        DOCUMENT_DIFF_JOB_TYPE,
        DOCUMENT_DIFF_PREDEBIT_CREDITS,
        DOCUMENT_DIFF_RESULT_KEY,
    )

    email = f"qa-browser-diff-result-{datetime.now(timezone.utc).strftime('%Y%m%d-%H%M%S')}-{uuid.uuid4().hex[:8]}@example.com"
    now = datetime.now(timezone.utc)
    async with AsyncSessionLocal() as db:
        user = await auth_service.create_user(db, email=email, name="QA Browser Diff Result")
        user.plan = "pro"
        user.credits_balance = 20000

        old_doc_id = uuid.uuid4()
        new_doc_id = uuid.uuid4()
        old_filename = "refund-policy-v1.md"
        new_filename = "refund-policy-v2.md"
        old_doc = Document(
            id=old_doc_id,
            filename=old_filename,
            file_size=len(OLD_TEXT),
            storage_key=f"qa/browser-diff-result/{old_doc_id}.md",
            status="ready",
            page_count=1,
            pages_parsed=1,
            chunks_total=1,
            chunks_indexed=1,
            user_id=user.id,
            file_type="md",
            summary="Synthetic old refund policy.",
            suggested_questions=[],
        )
        new_doc = Document(
            id=new_doc_id,
            filename=new_filename,
            file_size=len(NEW_TEXT),
            storage_key=f"qa/browser-diff-result/{new_doc_id}.md",
            status="ready",
            page_count=1,
            pages_parsed=1,
            chunks_total=1,
            chunks_indexed=1,
            user_id=user.id,
            file_type="md",
            summary="Synthetic new refund policy.",
            suggested_questions=[],
        )
        db.add_all([old_doc, new_doc])
        db.add_all(
            [
                Page(document_id=old_doc_id, page_number=1, content=OLD_TEXT),
                Page(document_id=new_doc_id, page_number=1, content=NEW_TEXT),
            ]
        )
        old_chunk_id = uuid.uuid4()
        new_chunk_id = uuid.uuid4()
        db.add_all(
            [
                Chunk(
                    id=old_chunk_id,
                    document_id=old_doc_id,
                    chunk_index=0,
                    text="Customers may request refunds within 7 days.",
                    token_count=8,
                    page_start=1,
                    page_end=1,
                    bboxes=[],
                    section_title="Refund Policy v1",
                    vector_id=None,
                ),
                Chunk(
                    id=new_chunk_id,
                    document_id=new_doc_id,
                    chunk_index=0,
                    text="Customers may request refunds within 14 days and enterprise annual plans are covered.",
                    token_count=12,
                    page_start=1,
                    page_end=1,
                    bboxes=[],
                    section_title="Refund Policy v2",
                    vector_id=None,
                ),
            ]
        )

        structured, markdown, citations = diff_payload(
            old_doc_id=old_doc_id,
            old_filename=old_filename,
            new_doc_id=new_doc_id,
            new_filename=new_filename,
            old_chunk_id=old_chunk_id,
            new_chunk_id=new_chunk_id,
        )
        job = DocumentJob(
            user_id=user.id,
            document_id=new_doc_id,
            job_type=DOCUMENT_DIFF_JOB_TYPE,
            status="queued" if real_queued else ("succeeded" if completed else "running"),
            input_scope={
                "old_document_id": str(old_doc_id),
                "old_document_filename": old_filename,
                "new_document_id": str(new_doc_id),
                "new_document_filename": new_filename,
                "locale": "en",
            },
            cost_credits=0 if real_queued else 7,
            metadata_json={"qa_synthetic": True, "qa_real_worker": real_queued},
            completed_at=now if completed else None,
        )
        db.add(job)
        await db.flush()
        if real_queued:
            user.credits_balance -= DOCUMENT_DIFF_PREDEBIT_CREDITS
            ledger = CreditLedger(
                user_id=user.id,
                delta=-DOCUMENT_DIFF_PREDEBIT_CREDITS,
                balance_after=user.credits_balance,
                reason="document_diff",
                ref_type="document_job",
                ref_id=str(job.id),
            )
            db.add(ledger)
            await db.flush()
            job.metadata_json = {
                **(job.metadata_json or {}),
                "predebit_ledger_id": str(ledger.id),
                "pre_debited": DOCUMENT_DIFF_PREDEBIT_CREDITS,
            }
        if completed:
            db.add(
                ExtractionResult(
                    job_id=job.id,
                    template_key=DOCUMENT_DIFF_RESULT_KEY,
                    structured_json=structured,
                    rendered_markdown=markdown,
                    citations=citations,
                )
            )
        await db.commit()

    if real_queued:
        from app.workers.document_diff_worker import run_document_diff_job

        run_document_diff_job.delay(str(job.id))

    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "result": "pass",
        "user": {"id": str(user.id), "email": user.email, "name": user.name, "plan": user.plan},
        "old_document_id": str(old_doc_id),
        "new_document_id": str(new_doc_id),
        "old_filename": old_filename,
        "new_filename": new_filename,
        "job_id": str(job.id),
        "initial_status": "queued" if real_queued else ("succeeded" if completed else "running"),
        "old_chunk_id": str(old_chunk_id),
        "new_chunk_id": str(new_chunk_id),
        "expected_summary": structured["summary"],
        "expected_terms": ["14 days", "enterprise", "O1", "N1"] if real_queued else ["Refund window extended", "Enterprise annual plans added", "O1", "N1"],
        "export_terms": ["14 days", "enterprise"] if real_queued else ["Refund window extended", "Enterprise annual plans added"],
    }


async def complete_job(job_id: str) -> dict[str, Any]:
    from app.models.database import AsyncSessionLocal
    from app.models.tables import Chunk, DocumentJob, ExtractionResult
    from app.services.document_diff_service import DOCUMENT_DIFF_RESULT_KEY

    jid = uuid.UUID(job_id)
    async with AsyncSessionLocal() as db:
        job = await db.get(DocumentJob, jid)
        if job is None:
            raise RuntimeError(f"job not found: {job_id}")
        scope = job.input_scope or {}
        old_doc_id = uuid.UUID(str(scope["old_document_id"]))
        new_doc_id = uuid.UUID(str(scope["new_document_id"]))
        old_filename = str(scope["old_document_filename"])
        new_filename = str(scope["new_document_filename"])
        old_chunk = (
            await db.scalars(select(Chunk).where(Chunk.document_id == old_doc_id).order_by(Chunk.chunk_index).limit(1))
        ).first()
        new_chunk = (
            await db.scalars(select(Chunk).where(Chunk.document_id == new_doc_id).order_by(Chunk.chunk_index).limit(1))
        ).first()
        if old_chunk is None or new_chunk is None:
            raise RuntimeError("diff fixture chunks not found")
        structured, markdown, citations = diff_payload(
            old_doc_id=old_doc_id,
            old_filename=old_filename,
            new_doc_id=new_doc_id,
            new_filename=new_filename,
            old_chunk_id=old_chunk.id,
            new_chunk_id=new_chunk.id,
        )
        existing = (
            await db.scalars(select(ExtractionResult).where(ExtractionResult.job_id == jid).limit(1))
        ).first()
        if existing is None:
            db.add(
                ExtractionResult(
                    job_id=jid,
                    template_key=DOCUMENT_DIFF_RESULT_KEY,
                    structured_json=structured,
                    rendered_markdown=markdown,
                    citations=citations,
                )
            )
        else:
            existing.structured_json = structured
            existing.rendered_markdown = markdown
            existing.citations = citations
            db.add(existing)
        job.status = "succeeded"
        job.completed_at = datetime.now(timezone.utc)
        db.add(job)
        await db.commit()

    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "result": "pass",
        "job_id": job_id,
        "status": "succeeded",
        "expected_summary": structured["summary"],
        "new_chunk_id": str(new_chunk.id),
    }


async def cleanup(user_id: str) -> dict[str, Any]:
    from app.models.database import AsyncSessionLocal
    from app.models.tables import Document, DocumentJob, User

    uid = uuid.UUID(user_id)
    async with AsyncSessionLocal() as db:
        jobs = (await db.scalars(select(DocumentJob).where(DocumentJob.user_id == uid))).all()
        for job in jobs:
            await db.delete(job)
        docs = (await db.scalars(select(Document).where(Document.user_id == uid))).all()
        for doc in docs:
            await db.delete(doc)
        user = await db.get(User, uid)
        if user is not None:
            await db.delete(user)
        await db.commit()

    async with AsyncSessionLocal() as db:
        users = await db.scalar(select(func.count()).select_from(User).where(User.id == uid))
        docs = await db.scalar(select(func.count()).select_from(Document).where(Document.user_id == uid))
        jobs = await db.scalar(select(func.count()).select_from(DocumentJob).where(DocumentJob.user_id == uid))
    return {"result": "pass", "user_id": user_id, "users": int(users or 0), "documents": int(docs or 0), "jobs": int(jobs or 0)}


def write_report(path: str | None, report: dict[str, Any]) -> None:
    if not path:
        print(json.dumps(report, ensure_ascii=False, indent=2))
        return
    out = Path(path)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main() -> None:
    args = parse_args()
    if args.command == "create":
        report = asyncio.run(create_fixture(args))
        write_report(args.json_out, report)
        print(f"created document diff fixture user={report['user']['id']} job={report['job_id']}")
    elif args.command == "create-running":
        report = asyncio.run(create_fixture(args, completed=False))
        write_report(args.json_out, report)
        print(f"created running document diff fixture user={report['user']['id']} job={report['job_id']}")
    elif args.command == "create-real-queued":
        report = asyncio.run(create_fixture(args, completed=False, real_queued=True))
        write_report(args.json_out, report)
        print(f"created real queued document diff fixture user={report['user']['id']} job={report['job_id']}")
    elif args.command == "complete":
        report = asyncio.run(complete_job(args.job_id))
        write_report(args.json_out, report)
        print(f"completed document diff job={report['job_id']}")
    elif args.command == "cleanup":
        report = asyncio.run(cleanup(args.user_id))
        write_report(args.json_out, report)
        print(f"cleanup users={report['users']} documents={report['documents']} jobs={report['jobs']}")


if __name__ == "__main__":
    main()
