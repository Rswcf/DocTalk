"""Structured extraction APIs for the document workbench."""
from __future__ import annotations

import re
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Literal
from urllib.parse import quote

import sqlalchemy as sa
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.deps import get_db_session, require_auth
from app.models.tables import (
    CreditLedger,
    Document,
    DocumentJob,
    ProductEvent,
    User,
)
from app.services import credit_service
from app.services.doc_service import can_access_document
from app.services.extraction_service import (
    EXTRACTION_JOB_TYPE,
    EXTRACTION_PREDEBIT_CREDITS,
    FREE_MONTHLY_EXTRACTION_LIMIT,
    get_template,
    list_templates,
    render_csv,
)

router = APIRouter(prefix="/api", tags=["extractions"])


class ExtractionTemplateResponse(BaseModel):
    key: str
    title: str
    description: str


class CreateExtractionRequest(BaseModel):
    template_key: str = Field(..., min_length=1, max_length=64)
    locale: str | None = Field(None, max_length=16)
    domain_mode: Literal["legal", "academic"] | None = None


class ExtractionResultPayload(BaseModel):
    template_key: str
    structured_json: dict[str, Any]
    rendered_markdown: str
    citations: list[dict[str, Any]]
    created_at: str


class ExtractionJobResponse(BaseModel):
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


def _as_utc(dt):
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def _content_disposition(filename: str) -> str:
    clean = re.sub(r"[\r\n\t]", " ", filename)
    ascii_fallback = clean.encode("ascii", "replace").decode("ascii")
    ascii_fallback = re.sub(r'[?"\\]', "_", ascii_fallback)
    if not ascii_fallback.strip("_. "):
        ascii_fallback = "extraction"
    return f"attachment; filename=\"{ascii_fallback}\"; filename*=UTF-8''{quote(clean, safe='')}"


def _loaded_extraction_result(job: Any) -> Any | None:
    # Async SQLAlchemy cannot lazy-load relationships during response building.
    # Use only values already loaded by selectinload or explicitly assigned.
    return job.__dict__.get("extraction_result")


def _job_response(job: DocumentJob) -> ExtractionJobResponse:
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
    return ExtractionJobResponse(
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


async def _verify_document(document_id: uuid.UUID, user: User, db: AsyncSession) -> Document:
    doc = await db.get(Document, document_id)
    if not doc or not can_access_document(doc, user):
        raise HTTPException(
            status_code=404,
            detail={"error": "DOCUMENT_NOT_FOUND", "message": "Document not found"},
        )
    return doc


async def _enforce_free_extraction_limit(user: User, db: AsyncSession) -> None:
    if (user.plan or "free").lower() != "free":
        return
    window_start = _as_utc(user.monthly_credits_granted_at)
    if window_start is None:
        window_start = datetime.now(timezone.utc) - timedelta(days=30)
    used = await db.scalar(
        select(func.count())
        .select_from(DocumentJob)
        .where(DocumentJob.user_id == user.id)
        .where(DocumentJob.job_type == EXTRACTION_JOB_TYPE)
        .where(DocumentJob.status.in_(["queued", "running", "succeeded"]))
        .where(DocumentJob.created_at >= window_start)
    )
    if int(used or 0) >= FREE_MONTHLY_EXTRACTION_LIMIT:
        raise HTTPException(
            status_code=403,
            detail={
                "error": "EXTRACTION_LIMIT_REACHED",
                "message": "Free plan structured extraction limit reached",
                "limit": FREE_MONTHLY_EXTRACTION_LIMIT,
                "used": int(used or 0),
                "required_plan": "plus",
            },
        )


@router.get("/extraction-templates", response_model=list[ExtractionTemplateResponse])
async def get_extraction_templates() -> list[dict[str, str]]:
    return list_templates()


@router.post(
    "/documents/{document_id}/extractions",
    response_model=ExtractionJobResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
async def create_extraction(
    document_id: uuid.UUID,
    body: CreateExtractionRequest,
    user: User = Depends(require_auth),
    db: AsyncSession = Depends(get_db_session),
):
    doc = await _verify_document(document_id, user, db)
    if doc.status != "ready":
        raise HTTPException(
            status_code=409,
            detail={"error": "DOCUMENT_NOT_READY", "message": "Document is not ready"},
        )
    try:
        template = get_template(body.template_key)
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail={"error": "UNSUPPORTED_EXTRACTION_TEMPLATE", "message": "Unsupported extraction template"},
        )

    await _enforce_free_extraction_limit(user, db)

    job = DocumentJob(
        user_id=user.id,
        document_id=doc.id,
        job_type=EXTRACTION_JOB_TYPE,
        status="queued",
        input_scope={
            "template_key": template.key,
            "locale": body.locale,
            "domain_mode": body.domain_mode,
        },
    )
    db.add(job)
    await db.flush()

    ledger_id = await credit_service.debit_credits(
        db,
        user_id=user.id,
        cost=EXTRACTION_PREDEBIT_CREDITS,
        reason="extraction",
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
                "message": "Insufficient credits to start extraction",
                "required": EXTRACTION_PREDEBIT_CREDITS,
                "balance": balance,
            },
        )

    job.metadata_json = {
        "predebit_ledger_id": str(ledger_id),
        "pre_debited": EXTRACTION_PREDEBIT_CREDITS,
    }
    db.add(
        ProductEvent(
            user_id=user.id,
            event_name="extraction_created",
            source="document_reader",
            reason=template.key,
            plan=(user.plan or "free").lower(),
            metadata_json={"document_id": str(doc.id), "job_id": str(job.id), "template_key": template.key},
        )
    )
    await db.commit()
    await db.refresh(job)

    try:
        from app.workers.extraction_worker import run_extraction_job

        run_extraction_job.delay(str(job.id))
    except Exception as exc:
        job.status = "failed"
        job.error_code = "EXTRACTION_QUEUE_FAILED"
        job.error_message = "Failed to queue extraction"
        result = await db.execute(sa.delete(CreditLedger).where(CreditLedger.id == ledger_id))
        if result.rowcount and result.rowcount > 0:
            await db.execute(
                sa.update(User)
                .where(User.id == user.id)
                .values(credits_balance=User.credits_balance + EXTRACTION_PREDEBIT_CREDITS)
            )
        await db.commit()
        raise HTTPException(
            status_code=500,
            detail={"error": "EXTRACTION_QUEUE_FAILED", "message": "Failed to queue extraction"},
        ) from exc

    return _job_response(job)


@router.get("/documents/{document_id}/extractions", response_model=list[ExtractionJobResponse])
async def list_document_extractions(
    document_id: uuid.UUID,
    user: User = Depends(require_auth),
    db: AsyncSession = Depends(get_db_session),
):
    doc = await _verify_document(document_id, user, db)
    rows = await db.execute(
        select(DocumentJob)
        .options(selectinload(DocumentJob.extraction_result))
        .where(DocumentJob.user_id == user.id)
        .where(DocumentJob.document_id == doc.id)
        .where(DocumentJob.job_type == EXTRACTION_JOB_TYPE)
        .order_by(DocumentJob.created_at.desc())
        .limit(20)
    )
    return [_job_response(job) for job in rows.scalars()]


@router.get("/extractions/{job_id}", response_model=ExtractionJobResponse)
async def get_extraction(
    job_id: uuid.UUID,
    user: User = Depends(require_auth),
    db: AsyncSession = Depends(get_db_session),
):
    row = await db.execute(
        select(DocumentJob)
        .options(selectinload(DocumentJob.extraction_result))
        .where(DocumentJob.id == job_id)
        .where(DocumentJob.user_id == user.id)
        .where(DocumentJob.job_type == EXTRACTION_JOB_TYPE)
    )
    job = row.scalar_one_or_none()
    if not job:
        raise HTTPException(
            status_code=404,
            detail={"error": "EXTRACTION_NOT_FOUND", "message": "Extraction not found"},
        )
    return _job_response(job)


@router.get("/extractions/{job_id}/export")
async def export_extraction(
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
        .where(DocumentJob.job_type == EXTRACTION_JOB_TYPE)
    )
    job = row.scalar_one_or_none()
    result = _loaded_extraction_result(job) if job else None
    if not job or not result:
        raise HTTPException(
            status_code=404,
            detail={"error": "EXTRACTION_NOT_FOUND", "message": "Extraction not found"},
        )
    stem = f"extraction-{result.template_key}-{str(job.id)[:8]}"
    if format == "csv":
        content = render_csv(result.template_key, result.structured_json or {})
        return StreamingResponse(
            iter([content.encode("utf-8-sig")]),
            media_type="text/csv; charset=utf-8",
            headers={"Content-Disposition": _content_disposition(f"{stem}.csv")},
        )
    content = result.rendered_markdown or ""
    return StreamingResponse(
        iter([content.encode("utf-8")]),
        media_type="text/markdown; charset=utf-8",
        headers={"Content-Disposition": _content_disposition(f"{stem}.md")},
    )
