#!/usr/bin/env python3
"""Run a real LLM document-diff job without relying on Celery.

Creates controlled ready text documents directly in the local DB, executes
run_document_diff_job_sync(), validates the persisted result, then cleans up.
"""

from __future__ import annotations

import argparse
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

from app.models.sync_database import SyncSessionLocal  # noqa: E402
from app.models.tables import (  # noqa: E402
    Chunk,
    CreditLedger,
    Document,
    DocumentJob,
    ExtractionResult,
    UsageRecord,
    User,
)
from app.services.document_diff_service import (  # noqa: E402
    DOCUMENT_DIFF_JOB_TYPE,
    DOCUMENT_DIFF_PREDEBIT_CREDITS,
    run_document_diff_job_sync,
)

OLD_TEXT = (
    "Policy v1: Customers may request a refund review within 7 days when usage is below "
    "100 credits. The support contact is old-support@example.com. Enterprise approval is "
    "not mentioned in this version."
)

NEW_TEXT = (
    "Policy v2: Customers may request a refund review within 14 days when usage is below "
    "500 credits. The support contact is support@doctalk.site. Enterprise purchases now "
    "require manager approval before renewal."
)


def write_report(path: str, report: dict[str, Any]) -> None:
    out = Path(path)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(report, indent=2, ensure_ascii=False, default=str) + "\n", encoding="utf-8")


def make_doc(db, user_id: uuid.UUID, *, filename: str, text: str) -> Document:
    doc = Document(
        filename=filename,
        file_size=len(text.encode("utf-8")),
        page_count=1,
        storage_key=f"qa-live-diff/{uuid.uuid4()}/{filename}",
        status="ready",
        pages_parsed=1,
        chunks_total=1,
        chunks_indexed=1,
        user_id=user_id,
        file_type="txt",
    )
    db.add(doc)
    db.flush()
    db.add(
        Chunk(
            document_id=doc.id,
            chunk_index=0,
            text=text,
            token_count=max(1, len(text.split())),
            page_start=1,
            page_end=1,
            bboxes=[{"page": 1, "x": 0.08, "y": 0.12, "w": 0.82, "h": 0.2}],
            section_title="Policy",
            vector_id=str(uuid.uuid4()),
        )
    )
    return doc


def create_fixture() -> dict[str, Any]:
    with SyncSessionLocal() as db:
        user = User(
            email=f"qa-live-diff-{datetime.now(timezone.utc).strftime('%Y%m%d-%H%M%S')}-{uuid.uuid4().hex[:8]}@example.com",
            name="QA Live Diff",
            plan="pro",
            credits_balance=1000,
        )
        db.add(user)
        db.flush()
        old_doc = make_doc(db, user.id, filename="refund-policy-v1.txt", text=OLD_TEXT)
        new_doc = make_doc(db, user.id, filename="refund-policy-v2.txt", text=NEW_TEXT)
        job = DocumentJob(
            user_id=user.id,
            document_id=new_doc.id,
            job_type=DOCUMENT_DIFF_JOB_TYPE,
            status="queued",
            input_scope={
                "old_document_id": str(old_doc.id),
                "old_document_filename": old_doc.filename,
                "new_document_id": str(new_doc.id),
                "new_document_filename": new_doc.filename,
                "locale": "en",
            },
            cost_credits=0,
        )
        db.add(job)
        db.flush()
        balance_after_predebit = user.credits_balance - DOCUMENT_DIFF_PREDEBIT_CREDITS
        ledger = CreditLedger(
            user_id=user.id,
            delta=-DOCUMENT_DIFF_PREDEBIT_CREDITS,
            balance_after=balance_after_predebit,
            reason="document_diff",
            ref_type="document_job",
            ref_id=str(job.id),
        )
        user.credits_balance = balance_after_predebit
        db.add(ledger)
        db.flush()
        job.metadata_json = {
            "predebit_ledger_id": str(ledger.id),
            "pre_debited": DOCUMENT_DIFF_PREDEBIT_CREDITS,
        }
        db.commit()
        return {
            "user_id": user.id,
            "old_doc_id": old_doc.id,
            "new_doc_id": new_doc.id,
            "job_id": job.id,
            "ledger_id": ledger.id,
        }


def cleanup(user_id: uuid.UUID) -> dict[str, int]:
    with SyncSessionLocal() as db:
        for model, column in [
            (Document, Document.user_id),
            (User, User.id),
        ]:
            for row in db.execute(select(model).where(column == user_id)).scalars():
                db.delete(row)
        db.commit()
    with SyncSessionLocal() as db:
        return {
            "users": int(db.scalar(select(func.count()).select_from(User).where(User.id == user_id)) or 0),
            "documents": int(db.scalar(select(func.count()).select_from(Document).where(Document.user_id == user_id)) or 0),
            "jobs": int(db.scalar(select(func.count()).select_from(DocumentJob).where(DocumentJob.user_id == user_id)) or 0),
            "usage_records": int(db.scalar(select(func.count()).select_from(UsageRecord).where(UsageRecord.user_id == user_id)) or 0),
            "ledger_rows": int(db.scalar(select(func.count()).select_from(CreditLedger).where(CreditLedger.user_id == user_id)) or 0),
        }


def inspect_result(fixture: dict[str, Any]) -> dict[str, Any]:
    with SyncSessionLocal() as db:
        job = db.get(DocumentJob, fixture["job_id"])
        result = db.execute(
            select(ExtractionResult).where(ExtractionResult.job_id == fixture["job_id"])
        ).scalar_one_or_none()
        usage = db.execute(
            select(UsageRecord).where(UsageRecord.user_id == fixture["user_id"])
        ).scalars().all()
        ledger = db.get(CreditLedger, fixture["ledger_id"])
        user = db.get(User, fixture["user_id"])
        structured = result.structured_json if result else {}
        changes = structured.get("changes") if isinstance(structured, dict) else []
        citations = result.citations if result else []
        rendered = result.rendered_markdown if result else ""
        checks = {
            "job_succeeded": bool(job and job.status == "succeeded"),
            "result_persisted": result is not None,
            "summary_present": bool(str(structured.get("summary") or "").strip()),
            "changes_present": isinstance(changes, list) and len(changes) > 0,
            "citations_present": isinstance(citations, list) and len(citations) > 0,
            "markdown_rendered": "# Document Diff" in rendered,
            "usage_recorded": bool(usage and usage[0].total_tokens > 0 and usage[0].cost_credits >= 0),
            "ledger_reconciled": bool(
                job
                and ledger
                and user
                and ledger.delta == -int(job.cost_credits or 0)
                and user.credits_balance == 1000 - int(job.cost_credits or 0)
            ),
        }
        return {
            "job": {
                "id": str(job.id) if job else None,
                "status": job.status if job else None,
                "cost_credits": int(job.cost_credits or 0) if job else None,
                "error_code": job.error_code if job else None,
            },
            "structured": structured,
            "rendered_markdown_preview": rendered[:1200],
            "citations_count": len(citations or []),
            "usage": [
                {
                    "model": item.model,
                    "prompt_tokens": item.prompt_tokens,
                    "completion_tokens": item.completion_tokens,
                    "total_tokens": item.total_tokens,
                    "cost_credits": item.cost_credits,
                }
                for item in usage
            ],
            "ledger": {
                "delta": ledger.delta if ledger else None,
                "balance_after": ledger.balance_after if ledger else None,
                "user_balance": user.credits_balance if user else None,
            },
            "checks": checks,
        }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--json-out", required=True)
    parser.add_argument("--keep", action="store_true")
    args = parser.parse_args()

    fixture = create_fixture()
    report: dict[str, Any] = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "fixture": {key: str(value) for key, value in fixture.items()},
        "cleanup": "pending",
    }
    try:
        run_document_diff_job_sync(str(fixture["job_id"]))
        report["result_detail"] = inspect_result(fixture)
        checks = report["result_detail"]["checks"]
        report["result"] = "pass" if all(checks.values()) else "fail"
    finally:
        if args.keep:
            report["cleanup"] = "kept"
        else:
            report["cleanup"] = cleanup(fixture["user_id"])
    write_report(args.json_out, report)
    passed = sum(1 for value in (report.get("result_detail", {}).get("checks") or {}).values() if value)
    total = len(report.get("result_detail", {}).get("checks") or {})
    print(f"DOCUMENT_DIFF_LIVE_LLM {report.get('result', 'fail').upper()}: {passed}/{total} checks")
    return 0 if report.get("result") == "pass" else 1


if __name__ == "__main__":
    raise SystemExit(main())
