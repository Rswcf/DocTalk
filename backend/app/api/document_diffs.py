"""Semantic document comparison APIs."""
from __future__ import annotations

import re
import uuid
from typing import Any, Literal
from urllib.parse import quote

import sqlalchemy as sa
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.deps import get_db_session, require_auth
from app.models.tables import (
    Collection,
    CreditLedger,
    Document,
    DocumentJob,
    ProductEvent,
    User,
)
from app.services import credit_service
from app.services.document_diff_service import (
    DOCUMENT_DIFF_JOB_TYPE,
    DOCUMENT_DIFF_PREDEBIT_CREDITS,
    render_document_diff_csv,
)

router = APIRouter(prefix="/api", tags=["document-diffs"])


class CreateDocumentDiffRequest(BaseModel):
    old_document_id: uuid.UUID
    new_document_id: uuid.UUID
    collection_id: uuid.UUID | None = None
    locale: str | None = Field(None, max_length=16)


class ExtractionResultPayload(BaseModel):
    template_key: str
    structured_json: dict[str, Any]
    rendered_markdown: str
    citations: list[dict[str, Any]]
    created_at: str


class DocumentDiffRunResponse(BaseModel):
    id: str
    document_id: str | None
    collection_id: str | None
    job_type: str
    status: str
    input_scope: dict[str, Any]
    cost_credits: int
    error_code: str | None
    error_message: str | None
    created_at: str
    updated_at: str
    completed_at: str | None
    result: ExtractionResultPayload | None = None


def _content_disposition(filename: str) -> str:
    clean = re.sub(r"[\r\n\t]", " ", filename)
    ascii_fallback = clean.encode("ascii", "replace").decode("ascii")
    ascii_fallback = re.sub(r'[?"\\]', "_", ascii_fallback)
    if not ascii_fallback.strip("_. "):
        ascii_fallback = "document-diff"
    return f"attachment; filename=\"{ascii_fallback}\"; filename*=UTF-8''{quote(clean, safe='')}"


def _loaded_extraction_result(job: Any) -> Any | None:
    # Async SQLAlchemy cannot lazy-load relationships during response building.
    # Use only values already loaded by selectinload or explicitly assigned.
    return job.__dict__.get("extraction_result")


def _run_response(job: DocumentJob) -> DocumentDiffRunResponse:
    result = None
    er = _loaded_extraction_result(job)
    if er:
        result = ExtractionResultPayload(
            template_key=er.template_key,
            structured_json=er.structured_json or {},
            rendered_markdown=er.rendered_markdown or "",
            citations=er.citations or [],
            created_at=er.created_at.isoformat(),
        )
    return DocumentDiffRunResponse(
        id=str(job.id),
        document_id=str(job.document_id) if job.document_id else None,
        collection_id=str(job.collection_id) if job.collection_id else None,
        job_type=job.job_type,
        status=job.status,
        input_scope=job.input_scope or {},
        cost_credits=int(job.cost_credits or 0),
        error_code=job.error_code,
        error_message=job.error_message,
        created_at=job.created_at.isoformat(),
        updated_at=job.updated_at.isoformat(),
        completed_at=job.completed_at.isoformat() if job.completed_at else None,
        result=result,
    )


def _require_pro(user: User) -> None:
    if (user.plan or "free").lower() == "pro":
        return
    raise HTTPException(
        status_code=403,
        detail={
            "error": "PLAN_REQUIRED",
            "message": "Document comparison requires Pro",
            "required_plan": "pro",
        },
    )


async def _get_owned_ready_document(document_id: uuid.UUID, user: User, db: AsyncSession) -> Document:
    doc = await db.get(Document, document_id)
    if not doc or doc.user_id != user.id:
        raise HTTPException(
            status_code=404,
            detail={"error": "DOCUMENT_NOT_FOUND", "message": "Document not found"},
        )
    if doc.status != "ready":
        raise HTTPException(
            status_code=409,
            detail={"error": "DOCUMENT_NOT_READY", "message": "Document is not ready"},
        )
    return doc


async def _get_owned_collection(collection_id: uuid.UUID, user: User, db: AsyncSession) -> Collection:
    row = await db.execute(
        select(Collection)
        .options(selectinload(Collection.documents))
        .where(Collection.id == collection_id)
        .where(Collection.user_id == user.id)
    )
    collection = row.scalar_one_or_none()
    if not collection:
        raise HTTPException(
            status_code=404,
            detail={"error": "COLLECTION_NOT_FOUND", "message": "Collection not found"},
        )
    return collection


def _verify_collection_membership(collection: Collection, old_doc_id: uuid.UUID, new_doc_id: uuid.UUID) -> None:
    document_ids = {doc.id for doc in collection.documents}
    if old_doc_id not in document_ids or new_doc_id not in document_ids:
        raise HTTPException(
            status_code=400,
            detail={
                "error": "DOCUMENT_DIFF_COLLECTION_MISMATCH",
                "message": "Both documents must belong to the selected collection",
            },
        )


async def _create_diff_job(
    *,
    user: User,
    db: AsyncSession,
    old_doc: Document,
    new_doc: Document,
    collection_id: uuid.UUID | None,
    locale: str | None,
) -> DocumentJob:
    job = DocumentJob(
        user_id=user.id,
        document_id=new_doc.id,
        collection_id=collection_id,
        job_type=DOCUMENT_DIFF_JOB_TYPE,
        status="queued",
        input_scope={
            "old_document_id": str(old_doc.id),
            "old_document_filename": old_doc.filename,
            "new_document_id": str(new_doc.id),
            "new_document_filename": new_doc.filename,
            "locale": locale,
        },
        cost_credits=0,
    )
    db.add(job)
    await db.flush()

    ledger_id = await credit_service.debit_credits(
        db,
        user_id=user.id,
        cost=DOCUMENT_DIFF_PREDEBIT_CREDITS,
        reason="document_diff",
        ref_type="document_job",
        ref_id=str(job.id),
    )
    if ledger_id is None:
        await db.rollback()
        balance = await credit_service.get_user_credits(db, user.id)
        raise HTTPException(
            status_code=402,
            detail={
                "error": "INSUFFICIENT_CREDITS",
                "message": "Insufficient credits to compare documents",
                "required": DOCUMENT_DIFF_PREDEBIT_CREDITS,
                "balance": balance,
            },
        )

    job.metadata_json = {
        "predebit_ledger_id": str(ledger_id),
        "pre_debited": DOCUMENT_DIFF_PREDEBIT_CREDITS,
    }
    db.add(
        ProductEvent(
            user_id=user.id,
            event_name="document_diff_created",
            source="collection_reader" if collection_id else "compare_page",
            reason="document_diff",
            plan=(user.plan or "free").lower(),
            metadata_json={
                "job_id": str(job.id),
                "old_document_id": str(old_doc.id),
                "new_document_id": str(new_doc.id),
                "collection_id": str(collection_id) if collection_id else None,
            },
        )
    )
    await db.commit()
    await db.refresh(job)

    try:
        _enqueue_document_diff_job(str(job.id))
    except Exception as exc:
        job.status = "failed"
        job.error_code = "DOCUMENT_DIFF_QUEUE_FAILED"
        job.error_message = "Failed to queue document comparison"
        result = await db.execute(sa.delete(CreditLedger).where(CreditLedger.id == ledger_id))
        if result.rowcount and result.rowcount > 0:
            await db.execute(
                sa.update(User)
                .where(User.id == user.id)
                .values(credits_balance=User.credits_balance + DOCUMENT_DIFF_PREDEBIT_CREDITS)
            )
        await db.commit()
        raise HTTPException(
            status_code=500,
            detail={"error": "DOCUMENT_DIFF_QUEUE_FAILED", "message": "Failed to queue document comparison"},
        ) from exc

    return job


def _enqueue_document_diff_job(job_id: str) -> None:
    from app.workers.document_diff_worker import run_document_diff_job

    run_document_diff_job.delay(job_id)


@router.post("/document-diffs", response_model=DocumentDiffRunResponse, status_code=status.HTTP_202_ACCEPTED)
async def create_document_diff(
    body: CreateDocumentDiffRequest,
    user: User = Depends(require_auth),
    db: AsyncSession = Depends(get_db_session),
):
    _require_pro(user)
    if body.old_document_id == body.new_document_id:
        raise HTTPException(
            status_code=400,
            detail={"error": "DOCUMENT_DIFF_SAME_DOCUMENT", "message": "Choose two different documents"},
        )
    old_doc = await _get_owned_ready_document(body.old_document_id, user, db)
    new_doc = await _get_owned_ready_document(body.new_document_id, user, db)
    if body.collection_id:
        collection = await _get_owned_collection(body.collection_id, user, db)
        _verify_collection_membership(collection, old_doc.id, new_doc.id)
    job = await _create_diff_job(
        user=user,
        db=db,
        old_doc=old_doc,
        new_doc=new_doc,
        collection_id=body.collection_id,
        locale=body.locale,
    )
    return _run_response(job)


@router.get("/document-diffs", response_model=list[DocumentDiffRunResponse])
async def list_document_diffs(
    collection_id: uuid.UUID | None = Query(None),
    user: User = Depends(require_auth),
    db: AsyncSession = Depends(get_db_session),
):
    stmt = (
        select(DocumentJob)
        .options(selectinload(DocumentJob.extraction_result))
        .where(DocumentJob.user_id == user.id)
        .where(DocumentJob.job_type == DOCUMENT_DIFF_JOB_TYPE)
        .order_by(DocumentJob.created_at.desc())
        .limit(30)
    )
    if collection_id:
        await _get_owned_collection(collection_id, user, db)
        stmt = stmt.where(DocumentJob.collection_id == collection_id)
    rows = await db.execute(stmt)
    return [_run_response(job) for job in rows.scalars()]


@router.get("/document-diffs/{job_id}", response_model=DocumentDiffRunResponse)
async def get_document_diff(
    job_id: uuid.UUID,
    user: User = Depends(require_auth),
    db: AsyncSession = Depends(get_db_session),
):
    row = await db.execute(
        select(DocumentJob)
        .options(selectinload(DocumentJob.extraction_result))
        .where(DocumentJob.id == job_id)
        .where(DocumentJob.user_id == user.id)
        .where(DocumentJob.job_type == DOCUMENT_DIFF_JOB_TYPE)
    )
    job = row.scalar_one_or_none()
    if not job:
        raise HTTPException(
            status_code=404,
            detail={"error": "DOCUMENT_DIFF_NOT_FOUND", "message": "Document comparison not found"},
        )
    return _run_response(job)


@router.get("/document-diffs/{job_id}/export")
async def export_document_diff(
    job_id: uuid.UUID,
    format: Literal["md", "csv"] = Query("md"),
    user: User = Depends(require_auth),
    db: AsyncSession = Depends(get_db_session),
):
    row = await db.execute(
        select(DocumentJob)
        .options(selectinload(DocumentJob.extraction_result))
        .where(DocumentJob.id == job_id)
        .where(DocumentJob.user_id == user.id)
        .where(DocumentJob.job_type == DOCUMENT_DIFF_JOB_TYPE)
    )
    job = row.scalar_one_or_none()
    result = _loaded_extraction_result(job) if job else None
    if not job or not result:
        raise HTTPException(
            status_code=404,
            detail={"error": "DOCUMENT_DIFF_NOT_FOUND", "message": "Document comparison not found"},
        )
    stem = f"document-diff-{str(job.id)[:8]}"
    if format == "csv":
        content = render_document_diff_csv(result.structured_json or {})
        return StreamingResponse(
            iter([content.encode("utf-8-sig")]),
            media_type="text/csv; charset=utf-8",
            headers={"Content-Disposition": _content_disposition(f"{stem}.csv")},
        )
    return StreamingResponse(
        iter([(result.rendered_markdown or "").encode("utf-8")]),
        media_type="text/markdown; charset=utf-8",
        headers={"Content-Disposition": _content_disposition(f"{stem}.md")},
    )
