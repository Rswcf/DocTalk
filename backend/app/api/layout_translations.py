"""Layout-preserving PDF translation APIs."""
from __future__ import annotations

import asyncio
import re
import uuid
from datetime import datetime, timezone
from typing import Any, Literal
from urllib.parse import quote

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.document_jobs import DocumentJobDetailResponse, _artifact_for_job
from app.core.deps import get_db_session, require_auth
from app.models.tables import Document, DocumentJob, ProductEvent, User
from app.services.doc_service import can_access_document
from app.services.layout_translation_service import (
    DEFAULT_LAYOUT_TRANSLATION_TARGET,
    LAYOUT_TRANSLATION_ACTIVE_STATUSES,
    LAYOUT_TRANSLATION_JOB_TYPE,
    LAYOUT_TRANSLATION_REQUIRED_PLAN,
    LayoutTranslationLimitError,
    layout_translation_config_status,
    layout_translation_file_size_limit_mb,
    layout_translation_max_pages_for_plan,
    layout_translation_next_plan_for_page_limit,
    layout_translation_public_error_message,
    layout_translation_trial_limit,
    normalize_target_language,
    plan_allows_unlimited_layout_translation,
    target_language_label,
    validate_layout_translation_size_limits,
)
from app.services.storage_service import storage_service

router = APIRouter(prefix="/api", tags=["layout-translations"])


class CreateLayoutTranslationRequest(BaseModel):
    target_language: str = Field(DEFAULT_LAYOUT_TRANSLATION_TARGET, min_length=2, max_length=32)
    locale: str | None = Field(None, max_length=16)


def _content_disposition(filename: str) -> str:
    clean = re.sub(r"[\r\n\t]", " ", filename)
    ascii_fallback = clean.encode("ascii", "replace").decode("ascii")
    ascii_fallback = re.sub(r'[?"\\]', "_", ascii_fallback)
    if not ascii_fallback.strip("_. "):
        ascii_fallback = "layout-translation"
    return f"attachment; filename=\"{ascii_fallback}\"; filename*=UTF-8''{quote(clean, safe='')}"


def _iso(value: Any) -> str:
    if hasattr(value, "isoformat"):
        return value.isoformat()
    return datetime.now(timezone.utc).isoformat()


async def _job_response(job: DocumentJob, db: AsyncSession, user: User) -> DocumentJobDetailResponse:
    error_message = layout_translation_public_error_message(job.error_message)
    return DocumentJobDetailResponse(
        id=str(job.id),
        document_id=str(job.document_id) if job.document_id else None,
        collection_id=str(job.collection_id) if job.collection_id else None,
        job_type=job.job_type,
        status=job.status,
        input_scope=job.input_scope or {},
        cost_credits=int(job.cost_credits or 0),
        error_code=job.error_code,
        error_message=error_message,
        metadata_json=job.metadata_json or {},
        created_at=_iso(job.created_at),
        updated_at=_iso(job.updated_at),
        completed_at=job.completed_at.isoformat() if job.completed_at else None,
        artifact=await _artifact_for_job(job, db, user),
    )


async def _get_owned_ready_pdf(document_id: uuid.UUID, user: User, db: AsyncSession) -> Document:
    doc = await db.get(Document, document_id)
    if not doc or not can_access_document(doc, user):
        raise HTTPException(
            status_code=404,
            detail={"error": "DOCUMENT_NOT_FOUND", "message": "Document not found"},
        )
    if doc.user_id != user.id:
        raise HTTPException(
            status_code=404,
            detail={"error": "DOCUMENT_NOT_FOUND", "message": "Document not found"},
        )
    if doc.status != "ready":
        raise HTTPException(
            status_code=409,
            detail={"error": "DOCUMENT_NOT_READY", "message": "Document is not ready"},
        )
    if doc.file_type != "pdf":
        raise HTTPException(
            status_code=400,
            detail={
                "error": "LAYOUT_TRANSLATION_REQUIRES_PDF",
                "message": "Layout-preserving translation currently supports PDF files only",
            },
        )
    return doc


async def _find_active_layout_translation(
    *, document_id: uuid.UUID, user_id: uuid.UUID, target_language: str, db: AsyncSession
) -> DocumentJob | None:
    rows = await db.execute(
        select(DocumentJob)
        .where(DocumentJob.user_id == user_id)
        .where(DocumentJob.document_id == document_id)
        .where(DocumentJob.job_type == LAYOUT_TRANSLATION_JOB_TYPE)
        .where(DocumentJob.status.in_(["queued", "running"]))
        .order_by(DocumentJob.created_at.desc())
        .limit(10)
    )
    for job in rows.scalars():
        if (job.input_scope or {}).get("target_language") == target_language:
            return job
    return None


async def _free_layout_translation_used(user: User, db: AsyncSession) -> int:
    used = await db.scalar(
        select(func.count())
        .select_from(DocumentJob)
        .where(DocumentJob.user_id == user.id)
        .where(DocumentJob.job_type == LAYOUT_TRANSLATION_JOB_TYPE)
        .where(DocumentJob.status.in_(list(LAYOUT_TRANSLATION_ACTIVE_STATUSES)))
    )
    return int(used or 0)


def _enqueue_layout_translation_job(job_id: str) -> None:
    from app.workers.layout_translation_worker import run_layout_translation_job

    run_layout_translation_job.delay(job_id)


def _raise_layout_translation_limit_error(doc: Document, plan: str) -> None:
    try:
        validate_layout_translation_size_limits(
            plan=plan,
            file_size=doc.file_size,
            page_count=doc.page_count,
        )
    except LayoutTranslationLimitError as exc:
        if exc.code == "LAYOUT_TRANSLATION_FILE_TOO_LARGE":
            max_mb = layout_translation_file_size_limit_mb()
            raise HTTPException(
                status_code=status.HTTP_413_CONTENT_TOO_LARGE,
                detail={
                    "error": "LAYOUT_TRANSLATION_FILE_TOO_LARGE",
                    "message": str(exc),
                    "max_mb": max_mb,
                    "file_size": int(doc.file_size or 0),
                },
            ) from exc
        if exc.code == "LAYOUT_TRANSLATION_PAGE_LIMIT_EXCEEDED":
            max_pages = layout_translation_max_pages_for_plan(plan)
            required_plan = layout_translation_next_plan_for_page_limit(plan)
            detail = {
                "error": "LAYOUT_TRANSLATION_PAGE_LIMIT_EXCEEDED",
                "message": str(exc),
                "page_count": int(doc.page_count or 0),
                "max_pages": max_pages,
                "plan": plan,
            }
            if required_plan:
                detail["required_plan"] = required_plan
            raise HTTPException(
                status_code=status.HTTP_413_CONTENT_TOO_LARGE,
                detail=detail,
            ) from exc
        raise


@router.post(
    "/documents/{document_id}/layout-translation",
    response_model=DocumentJobDetailResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
async def create_layout_translation(
    document_id: uuid.UUID,
    body: CreateLayoutTranslationRequest,
    user: User = Depends(require_auth),
    db: AsyncSession = Depends(get_db_session),
):
    doc = await _get_owned_ready_pdf(document_id, user, db)
    try:
        target_language = normalize_target_language(body.target_language)
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail={
                "error": "UNSUPPORTED_LAYOUT_TRANSLATION_TARGET",
                "message": "This translation target is not supported yet",
                "supported": [DEFAULT_LAYOUT_TRANSLATION_TARGET],
            },
        )

    existing = await _find_active_layout_translation(
        document_id=doc.id,
        user_id=user.id,
        target_language=target_language,
        db=db,
    )
    if existing:
        return await _job_response(existing, db, user)

    plan = (user.plan or "free").lower()
    _raise_layout_translation_limit_error(doc, plan)

    config_status = layout_translation_config_status()
    if not config_status.ready:
        raise HTTPException(
            status_code=503,
            detail={
                "error": "LAYOUT_TRANSLATION_NOT_CONFIGURED",
                "message": "Layout-preserving translation is temporarily unavailable.",
                "missing": list(config_status.missing),
            },
        )

    free_used = 0
    free_limit = layout_translation_trial_limit()
    if not plan_allows_unlimited_layout_translation(plan):
        free_used = await _free_layout_translation_used(user, db)
        if free_used >= free_limit:
            raise HTTPException(
                status_code=403,
                detail={
                    "error": "LAYOUT_TRANSLATION_LIMIT_REACHED",
                    "message": "Free plan layout-preserving PDF translation limit reached",
                    "limit": free_limit,
                    "used": free_used,
                    "required_plan": LAYOUT_TRANSLATION_REQUIRED_PLAN,
                },
            )

    engine = str(getattr(config_status, "engine", "retainpdf") or "retainpdf")
    provider = str(getattr(config_status, "ocr_provider", engine) or engine)
    job = DocumentJob(
        id=uuid.uuid4(),
        user_id=user.id,
        document_id=doc.id,
        job_type=LAYOUT_TRANSLATION_JOB_TYPE,
        status="queued",
        input_scope={
            "target_language": target_language,
            "target_language_label": target_language_label(target_language),
            "locale": body.locale,
            "source": "document_reader",
            "source_filename": doc.filename,
        },
        cost_credits=0,
        metadata_json={
            "provider": provider,
            "engine": engine,
            "target_language": target_language,
            "target_language_label": target_language_label(target_language),
            "plan": plan,
            "page_count": doc.page_count,
            "max_pages": layout_translation_max_pages_for_plan(plan),
            "max_file_size_mb": layout_translation_file_size_limit_mb(),
            "free_limit": free_limit,
            "free_used_before": free_used,
            "free_remaining_after": None if plan_allows_unlimited_layout_translation(plan) else max(0, free_limit - free_used - 1),
            "required_plan": LAYOUT_TRANSLATION_REQUIRED_PLAN,
        },
    )
    db.add(job)
    db.add(
        ProductEvent(
            user_id=user.id,
            event_name="layout_translation_created",
            source="document_reader",
            reason=target_language,
            plan=plan,
            metadata_json={
                "job_id": str(job.id),
                "document_id": str(doc.id),
                "target_language": target_language,
                "engine": engine,
                "provider": provider,
                "page_count": doc.page_count,
                "max_pages": layout_translation_max_pages_for_plan(plan),
                "free_used_before": free_used,
            },
        )
    )
    await db.commit()
    await db.refresh(job)

    try:
        _enqueue_layout_translation_job(str(job.id))
    except Exception as exc:
        job.status = "failed"
        job.error_code = "LAYOUT_TRANSLATION_QUEUE_FAILED"
        job.error_message = "Failed to queue layout-preserving translation"
        await db.commit()
        raise HTTPException(
            status_code=500,
            detail={
                "error": "LAYOUT_TRANSLATION_QUEUE_FAILED",
                "message": "Failed to queue layout-preserving translation",
            },
        ) from exc

    return await _job_response(job, db, user)


@router.get("/layout-translations/{job_id}/download")
async def download_layout_translation_artifact(
    job_id: uuid.UUID,
    artifact: Literal["pdf", "markdown", "bundle"] = Query("pdf"),
    user: User = Depends(require_auth),
    db: AsyncSession = Depends(get_db_session),
):
    row = await db.execute(
        select(DocumentJob)
        .where(DocumentJob.id == job_id)
        .where(DocumentJob.user_id == user.id)
        .where(DocumentJob.job_type == LAYOUT_TRANSLATION_JOB_TYPE)
    )
    job = row.scalar_one_or_none()
    metadata = job.metadata_json if job else {}
    artifacts = metadata.get("artifacts") if isinstance(metadata, dict) else None
    item = artifacts.get(artifact) if isinstance(artifacts, dict) else None
    if not job or job.status != "succeeded" or not isinstance(item, dict):
        raise HTTPException(
            status_code=404,
            detail={"error": "LAYOUT_TRANSLATION_ARTIFACT_NOT_FOUND", "message": "Translated artifact not found"},
        )
    storage_key = item.get("storage_key")
    if not isinstance(storage_key, str) or not storage_key:
        raise HTTPException(
            status_code=404,
            detail={"error": "LAYOUT_TRANSLATION_ARTIFACT_NOT_FOUND", "message": "Translated artifact not found"},
        )
    content = await asyncio.to_thread(storage_service.download_file, storage_key)
    filename = str(item.get("filename") or f"layout-translation-{job.id}.{artifact}")
    content_type = str(item.get("content_type") or "application/octet-stream")
    return StreamingResponse(
        iter([content]),
        media_type=content_type,
        headers={"Content-Disposition": _content_disposition(filename)},
    )
