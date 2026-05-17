"""Table extraction APIs for document workbench."""
from __future__ import annotations

import re
import uuid
from typing import Any
from urllib.parse import quote

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db_session, require_auth
from app.models.tables import Document, DocumentJob, DocumentTable, ProductEvent, User
from app.services.doc_service import can_access_document
from app.services.table_service import (
    TABLE_JOB_TYPES,
    TABLE_RECONSTRUCT_JOB_TYPE,
    TABLE_SCAN_JOB_TYPE,
    render_table_csv,
)

router = APIRouter(prefix="/api", tags=["tables"])


class DocumentJobResponse(BaseModel):
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


class DocumentTableResponse(BaseModel):
    id: str
    document_id: str
    page: int
    page_end: int | None
    table_index: int
    rows: list[list[str]]
    confidence: float
    method: str
    metadata_json: dict[str, Any]
    warnings: list[str]
    created_at: str
    updated_at: str


def _content_disposition(filename: str) -> str:
    clean = re.sub(r"[\r\n\t]", " ", filename)
    ascii_fallback = clean.encode("ascii", "replace").decode("ascii")
    ascii_fallback = re.sub(r'[?"\\]', "_", ascii_fallback)
    if not ascii_fallback.strip("_. "):
        ascii_fallback = "table"
    return f"attachment; filename=\"{ascii_fallback}\"; filename*=UTF-8''{quote(clean, safe='')}"


def _job_response(job: DocumentJob) -> DocumentJobResponse:
    return DocumentJobResponse(
        id=str(job.id),
        document_id=str(job.document_id) if job.document_id else None,
        collection_id=str(job.collection_id) if job.collection_id else None,
        job_type=job.job_type,
        status=job.status,
        input_scope=job.input_scope or {},
        cost_credits=int(job.cost_credits or 0),
        error_code=job.error_code,
        error_message=job.error_message,
        metadata_json=job.metadata_json or {},
        created_at=job.created_at.isoformat(),
        updated_at=job.updated_at.isoformat(),
        completed_at=job.completed_at.isoformat() if job.completed_at else None,
    )


def _table_response(table: DocumentTable) -> DocumentTableResponse:
    cells = table.cells or {}
    rows = cells.get("rows")
    metadata_json = cells.get("metadata")
    warnings = cells.get("warnings")
    try:
        page_end = int(cells.get("page_end")) if cells.get("page_end") is not None else None
    except (TypeError, ValueError):
        page_end = None
    return DocumentTableResponse(
        id=str(table.id),
        document_id=str(table.document_id),
        page=table.page,
        page_end=page_end,
        table_index=table.table_index,
        rows=rows if isinstance(rows, list) else [],
        confidence=float(table.confidence or 0),
        method=table.method,
        metadata_json=metadata_json if isinstance(metadata_json, dict) else {},
        warnings=[str(item) for item in warnings] if isinstance(warnings, list) else [],
        created_at=table.created_at.isoformat(),
        updated_at=table.updated_at.isoformat(),
    )


async def _verify_document(document_id: uuid.UUID, user: User, db: AsyncSession) -> Document:
    doc = await db.get(Document, document_id)
    if not doc or not can_access_document(doc, user):
        raise HTTPException(
            status_code=404,
            detail={"error": "DOCUMENT_NOT_FOUND", "message": "Document not found"},
        )
    return doc


@router.post(
    "/documents/{document_id}/tables/scan",
    response_model=DocumentJobResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
async def scan_document_tables(
    document_id: uuid.UUID,
    user: User = Depends(require_auth),
    db: AsyncSession = Depends(get_db_session),
):
    doc = await _verify_document(document_id, user, db)
    if doc.status != "ready":
        raise HTTPException(
            status_code=409,
            detail={"error": "DOCUMENT_NOT_READY", "message": "Document is not ready"},
        )
    existing = await db.scalar(
        select(DocumentJob)
        .where(DocumentJob.user_id == user.id)
        .where(DocumentJob.document_id == doc.id)
        .where(DocumentJob.job_type == TABLE_SCAN_JOB_TYPE)
        .where(DocumentJob.status.in_(["queued", "running"]))
        .order_by(DocumentJob.created_at.desc())
    )
    if existing:
        return _job_response(existing)

    job = DocumentJob(
        user_id=user.id,
        document_id=doc.id,
        job_type=TABLE_SCAN_JOB_TYPE,
        status="queued",
        input_scope={"document_id": str(doc.id)},
        cost_credits=0,
    )
    db.add(job)
    await db.flush()
    db.add(
        ProductEvent(
            user_id=user.id,
            event_name="table_scan_created",
            source="document_reader",
            reason="tables",
            plan=(user.plan or "free").lower(),
            metadata_json={"document_id": str(doc.id), "job_id": str(job.id)},
        )
    )
    await db.commit()
    await db.refresh(job)

    try:
        from app.workers.table_worker import run_table_scan_job

        run_table_scan_job.delay(str(job.id))
    except Exception as exc:
        job.status = "failed"
        job.error_code = "TABLE_SCAN_QUEUE_FAILED"
        job.error_message = "Failed to queue table scan"
        await db.commit()
        raise HTTPException(
            status_code=500,
            detail={"error": "TABLE_SCAN_QUEUE_FAILED", "message": "Failed to queue table scan"},
        ) from exc
    return _job_response(job)


@router.post(
    "/document-tables/{table_id}/reconstruct",
    response_model=DocumentJobResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
async def reconstruct_document_table(
    table_id: uuid.UUID,
    user: User = Depends(require_auth),
    db: AsyncSession = Depends(get_db_session),
):
    if (user.plan or "free").lower() not in {"plus", "pro"}:
        raise HTTPException(
            status_code=403,
            detail={
                "error": "PLAN_REQUIRED",
                "message": "AI table reconstruction requires Plus",
                "required_plan": "plus",
            },
        )
    table = await db.get(DocumentTable, table_id)
    if not table:
        raise HTTPException(
            status_code=404,
            detail={"error": "TABLE_NOT_FOUND", "message": "Table not found"},
        )
    doc = await _verify_document(table.document_id, user, db)
    if doc.status != "ready":
        raise HTTPException(
            status_code=409,
            detail={"error": "DOCUMENT_NOT_READY", "message": "Document is not ready"},
        )
    existing = await db.scalar(
        select(DocumentJob)
        .where(DocumentJob.user_id == user.id)
        .where(DocumentJob.document_id == doc.id)
        .where(DocumentJob.job_type == TABLE_RECONSTRUCT_JOB_TYPE)
        .where(DocumentJob.status.in_(["queued", "running"]))
        .order_by(DocumentJob.created_at.desc())
    )
    if existing:
        return _job_response(existing)

    job = DocumentJob(
        user_id=user.id,
        document_id=doc.id,
        job_type=TABLE_RECONSTRUCT_JOB_TYPE,
        status="queued",
        input_scope={"document_id": str(doc.id), "table_id": str(table.id)},
        cost_credits=0,
    )
    db.add(job)
    await db.flush()
    db.add(
        ProductEvent(
            user_id=user.id,
            event_name="table_reconstruct_created",
            source="document_reader",
            reason="tables_ai_rebuild",
            plan=(user.plan or "free").lower(),
            metadata_json={"document_id": str(doc.id), "table_id": str(table.id), "job_id": str(job.id)},
        )
    )
    await db.commit()
    await db.refresh(job)

    try:
        from app.workers.table_worker import run_table_reconstruction_job

        run_table_reconstruction_job.delay(str(job.id))
    except Exception as exc:
        job.status = "failed"
        job.error_code = "TABLE_RECONSTRUCTION_QUEUE_FAILED"
        job.error_message = "Failed to queue table reconstruction"
        await db.commit()
        raise HTTPException(
            status_code=500,
            detail={
                "error": "TABLE_RECONSTRUCTION_QUEUE_FAILED",
                "message": "Failed to queue table reconstruction",
            },
        ) from exc
    return _job_response(job)


@router.get("/documents/{document_id}/tables", response_model=list[DocumentTableResponse])
async def list_document_tables(
    document_id: uuid.UUID,
    user: User = Depends(require_auth),
    db: AsyncSession = Depends(get_db_session),
):
    doc = await _verify_document(document_id, user, db)
    rows = await db.execute(
        select(DocumentTable)
        .where(DocumentTable.document_id == doc.id)
        .order_by(DocumentTable.page, DocumentTable.table_index)
    )
    return [_table_response(table) for table in rows.scalars()]


@router.get("/documents/{document_id}/tables/export")
async def export_document_tables(
    document_id: uuid.UUID,
    user: User = Depends(require_auth),
    db: AsyncSession = Depends(get_db_session),
):
    if (user.plan or "free").lower() not in {"plus", "pro"}:
        raise HTTPException(
            status_code=403,
            detail={"error": "PLAN_REQUIRED", "message": "CSV export requires Plus", "required_plan": "plus"},
        )
    doc = await _verify_document(document_id, user, db)
    rows = await db.execute(
        select(DocumentTable)
        .where(DocumentTable.document_id == doc.id)
        .order_by(DocumentTable.page, DocumentTable.table_index)
    )
    tables = list(rows.scalars())
    csv_parts: list[str] = []
    for table in tables:
        table_rows = (table.cells or {}).get("rows")
        if not isinstance(table_rows, list) or not table_rows:
            continue
        csv_parts.append(f"# Page {table.page} Table {table.table_index + 1}\n")
        csv_parts.append(render_table_csv(table_rows))
        csv_parts.append("\n")
    content = "".join(csv_parts)
    stem = f"{doc.filename.rsplit('.', 1)[0]}-tables.csv"
    return StreamingResponse(
        iter([content.encode("utf-8-sig")]),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": _content_disposition(stem)},
    )


@router.get("/document-table-scans/{job_id}", response_model=DocumentJobResponse)
async def get_table_scan_job(
    job_id: uuid.UUID,
    user: User = Depends(require_auth),
    db: AsyncSession = Depends(get_db_session),
):
    job = await db.scalar(
        select(DocumentJob)
        .where(DocumentJob.id == job_id)
        .where(DocumentJob.user_id == user.id)
        .where(DocumentJob.job_type.in_(TABLE_JOB_TYPES))
    )
    if not job:
        raise HTTPException(
            status_code=404,
            detail={"error": "TABLE_SCAN_NOT_FOUND", "message": "Table scan not found"},
        )
    return _job_response(job)


@router.get("/document-tables/{table_id}/export")
async def export_document_table(
    table_id: uuid.UUID,
    user: User = Depends(require_auth),
    db: AsyncSession = Depends(get_db_session),
):
    if (user.plan or "free").lower() not in {"plus", "pro"}:
        raise HTTPException(
            status_code=403,
            detail={"error": "PLAN_REQUIRED", "message": "CSV export requires Plus", "required_plan": "plus"},
        )
    table = await db.get(DocumentTable, table_id)
    if not table:
        raise HTTPException(
            status_code=404,
            detail={"error": "TABLE_NOT_FOUND", "message": "Table not found"},
        )
    doc = await _verify_document(table.document_id, user, db)
    rows = (table.cells or {}).get("rows")
    content = render_table_csv(rows if isinstance(rows, list) else [])
    stem = f"{doc.filename.rsplit('.', 1)[0]}-p{table.page}-table{table.table_index + 1}.csv"
    return StreamingResponse(
        iter([content.encode("utf-8-sig")]),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": _content_disposition(stem)},
    )
