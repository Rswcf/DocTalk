"""Unified document job status API for chat-native artifacts."""
from __future__ import annotations

import uuid
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.deps import get_db_session, require_auth
from app.models.tables import DocumentJob, DocumentTable, User
from app.services.layout_translation_service import (
    LAYOUT_TRANSLATION_JOB_TYPE,
    layout_translation_public_error_message,
)

router = APIRouter(prefix="/api", tags=["document-jobs"])


class DocumentJobArtifactResponse(BaseModel):
    artifact_type: str
    status: str
    job_id: str | None
    title: str
    summary: str
    preview: Any | None = None
    download_urls: list[dict[str, str]] = Field(default_factory=list)
    citations: list[dict[str, Any]] = Field(default_factory=list)
    warning: str | None = None
    required_plan: str | None = None


class DocumentJobDetailResponse(BaseModel):
    id: str
    document_id: str | None
    collection_id: str | None
    job_type: str
    status: str
    input_scope: dict[str, Any]
    cost_credits: int
    error_code: str | None
    error_message: str | None
    metadata_json: dict[str, Any]
    created_at: str
    updated_at: str
    completed_at: str | None
    artifact: DocumentJobArtifactResponse


def _loaded_extraction_result(job: Any) -> Any | None:
    return job.__dict__.get("extraction_result")


def _table_preview(tables: list[DocumentTable]) -> list[dict[str, Any]]:
    payload: list[dict[str, Any]] = []
    for table in tables[:3]:
        rows = (table.cells or {}).get("rows")
        payload.append(
            {
                "table_id": str(table.id),
                "page": table.page,
                "table_index": table.table_index,
                "rows": rows[:4] if isinstance(rows, list) else [],
                "confidence": float(table.confidence or 0),
                "method": table.method,
            }
        )
    return payload


async def _artifact_for_job(job: DocumentJob, db: AsyncSession, user: User) -> DocumentJobArtifactResponse:
    if job.job_type == LAYOUT_TRANSLATION_JOB_TYPE:
        metadata = job.metadata_json or {}
        artifacts = metadata.get("artifacts") if isinstance(metadata, dict) else {}
        target = str(metadata.get("target_language_label") or "Simplified Chinese")
        error_message = layout_translation_public_error_message(job.error_message)
        preview = {
            "target_language": metadata.get("target_language"),
            "target_language_label": target,
            "retainpdf": metadata.get("retainpdf"),
            "free_limit": metadata.get("free_limit"),
            "free_remaining_after": metadata.get("free_remaining_after"),
            "page_count": metadata.get("page_count"),
            "max_pages": metadata.get("max_pages"),
            "max_file_size_mb": metadata.get("max_file_size_mb"),
            "add_to_library_requested": metadata.get("add_to_library_requested"),
            "imported_document_id": metadata.get("imported_document_id"),
            "imported_document_filename": metadata.get("imported_document_filename"),
            "imported_document_status": metadata.get("imported_document_status"),
            "import_error": metadata.get("import_error"),
        }
        download_urls: list[dict[str, str]] = []
        if job.status == "succeeded" and isinstance(artifacts, dict):
            if "pdf" in artifacts:
                download_urls.append(
                    {
                        "label": "Translated PDF",
                        "format": "pdf",
                        "url": f"/api/layout-translations/{job.id}/download?artifact=pdf",
                    }
                )
            if "markdown" in artifacts:
                download_urls.append(
                    {
                        "label": "Markdown",
                        "format": "md",
                        "url": f"/api/layout-translations/{job.id}/download?artifact=markdown",
                    }
                )
            if "bundle" in artifacts:
                download_urls.append(
                    {
                        "label": "Bundle",
                        "format": "zip",
                        "url": f"/api/layout-translations/{job.id}/download?artifact=bundle",
                    }
                )
        if job.status == "succeeded":
            summary = f"Layout-preserved PDF translation to {target} is ready."
        elif job.status == "failed":
            summary = error_message or "Layout-preserving translation failed."
        else:
            summary = f"Translating this PDF to {target} while preserving layout."
        return DocumentJobArtifactResponse(
            artifact_type="layout_translation",
            status=job.status,
            job_id=str(job.id),
            title="Layout-preserved PDF translation",
            summary=summary,
            preview=preview,
            download_urls=download_urls,
            warning=error_message if job.status == "failed" else None,
        )

    if job.job_type == "table_scan":
        tables: list[DocumentTable] = []
        if job.document_id:
            rows = await db.execute(
                select(DocumentTable)
                .where(DocumentTable.document_id == job.document_id)
                .order_by(DocumentTable.page, DocumentTable.table_index)
            )
            tables = list(rows.scalars())
        export_requested = bool((job.input_scope or {}).get("export_requested"))
        plan = (user.plan or "free").lower()
        download_urls = []
        required_plan = None
        job_metadata = job.metadata_json or {}
        warning = job.error_message or job_metadata.get("fallback_warning")
        if export_requested and job.document_id:
            if plan in {"plus", "pro"}:
                download_urls.append(
                    {"label": "Download CSV", "format": "csv", "url": f"/api/documents/{job.document_id}/tables/export"}
                )
            else:
                required_plan = "plus"
                warning = warning or "CSV export requires Plus."
        provider = job_metadata.get("provider")
        summary = f"{len(tables)} table(s) detected."
        if provider and job.status == "succeeded":
            summary = f"{summary} Provider: {provider}."
        if job.status != "succeeded":
            summary = "Scanning document tables."
        return DocumentJobArtifactResponse(
            artifact_type="table_export" if export_requested else "table_scan",
            status=job.status,
            job_id=str(job.id),
            title="Tables",
            summary=summary,
            preview=_table_preview(tables),
            download_urls=download_urls,
            warning=warning,
            required_plan=required_plan,
        )

    result = _loaded_extraction_result(job)
    rendered = result.rendered_markdown if result else ""
    preview = {"markdown": rendered[:2000]} if rendered else None
    citations = result.citations if result else []
    template_key = (result.template_key if result else None) or (job.input_scope or {}).get("template_key") or job.job_type
    if job.job_type == "document_diff":
        artifact_type = "document_diff"
        title = "Document comparison"
        download_urls = [
            {"label": "Markdown", "format": "md", "url": f"/api/document-diffs/{job.id}/export?format=md"},
            {"label": "CSV", "format": "csv", "url": f"/api/document-diffs/{job.id}/export?format=csv"},
        ]
    elif job.job_type == "batch_template":
        artifact_type = "template_run"
        title = "Question template"
        download_urls = [
            {"label": "Markdown", "format": "md", "url": f"/api/question-template-runs/{job.id}/export?format=md"},
            {"label": "CSV", "format": "csv", "url": f"/api/question-template-runs/{job.id}/export?format=csv"},
        ]
    else:
        artifact_type = "extraction"
        title = str(template_key).replace("_", " ").title()
        download_urls = [
            {"label": "Markdown", "format": "md", "url": f"/api/extractions/{job.id}/export?format=md"},
            {"label": "CSV", "format": "csv", "url": f"/api/extractions/{job.id}/export?format=csv"},
        ]
    return DocumentJobArtifactResponse(
        artifact_type=artifact_type,
        status=job.status,
        job_id=str(job.id),
        title=title,
        summary=job.error_message or ("Ready." if job.status == "succeeded" else "Working..."),
        preview=preview,
        download_urls=download_urls,
        citations=citations or [],
        warning=job.error_message,
    )


@router.get("/document-jobs/{job_id}", response_model=DocumentJobDetailResponse)
async def get_document_job(
    job_id: uuid.UUID,
    user: User = Depends(require_auth),
    db: AsyncSession = Depends(get_db_session),
):
    row = await db.execute(
        select(DocumentJob)
        .options(selectinload(DocumentJob.extraction_result))
        .where(DocumentJob.id == job_id)
        .where(DocumentJob.user_id == user.id)
    )
    job = row.scalar_one_or_none()
    if not job:
        raise HTTPException(
            status_code=404,
            detail={"error": "DOCUMENT_JOB_NOT_FOUND", "message": "Document job not found"},
        )
    return DocumentJobDetailResponse(
        id=str(job.id),
        document_id=str(job.document_id) if job.document_id else None,
        collection_id=str(job.collection_id) if job.collection_id else None,
        job_type=job.job_type,
        status=job.status,
        input_scope=job.input_scope or {},
        cost_credits=int(job.cost_credits or 0),
        error_code=job.error_code,
        error_message=layout_translation_public_error_message(job.error_message)
        if job.job_type == LAYOUT_TRANSLATION_JOB_TYPE
        else job.error_message,
        metadata_json=job.metadata_json or {},
        created_at=job.created_at.isoformat(),
        updated_at=job.updated_at.isoformat(),
        completed_at=job.completed_at.isoformat() if job.completed_at else None,
        artifact=await _artifact_for_job(job, db, user),
    )
