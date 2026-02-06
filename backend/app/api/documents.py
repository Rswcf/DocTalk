from __future__ import annotations

import uuid
from typing import Optional

from fastapi import APIRouter, Depends, File, UploadFile, status, HTTPException, Query
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.deps import get_current_user_optional, get_db_session, require_auth
from app.models.tables import User
from app.schemas.document import DocumentFileUrlResponse, DocumentResponse, DocumentBrief
from app.services.doc_service import doc_service
from app.services.storage_service import storage_service


documents_router = APIRouter(prefix="/documents", tags=["documents"])


@documents_router.get("", response_model=list[DocumentBrief])
async def list_documents(
    mine: bool = Query(False, description="Filter by current user"),
    user: Optional[User] = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db_session),
):
    """List documents. Use ?mine=1 to get only current user's documents."""
    if mine:
        if not user:
            raise HTTPException(status_code=401, detail="Authentication required")
        from sqlalchemy import select
        from app.models.tables import Document

        result = await db.execute(
            select(Document)
            .where(Document.user_id == user.id)
            .where(Document.status != "deleting")
            .order_by(Document.created_at.desc())
            .limit(50)
        )
        docs = result.scalars().all()
        return [
            DocumentBrief(
                id=str(d.id),
                filename=d.filename,
                status=d.status,
                created_at=d.created_at.isoformat() if d.created_at else None,
            )
            for d in docs
        ]
    return []


@documents_router.get("/demo")
async def get_demo_documents(
    db: AsyncSession = Depends(get_db_session),
):
    """Return list of demo documents for the demo selection page."""
    from sqlalchemy import select
    from app.models.tables import Document

    result = await db.execute(
        select(Document)
        .where(Document.demo_slug.isnot(None))
        .order_by(Document.demo_slug)
    )
    docs = result.scalars().all()
    return [
        {
            "slug": d.demo_slug,
            "document_id": str(d.id),
            "filename": d.filename,
            "status": d.status,
        }
        for d in docs
    ]


@documents_router.post("/upload", status_code=status.HTTP_202_ACCEPTED)
async def upload_document(
    file: UploadFile = File(...),
    user: User = Depends(require_auth),
    db: AsyncSession = Depends(get_db_session),
):
    # Validate content type
    if (file.content_type or "").lower() != "application/pdf":
        return JSONResponse(status_code=400, content={"error": "NOT_PDF"})

    # Validate size by reading bytes (DocService will re-validate too)
    data = await file.read()
    max_bytes = int(settings.MAX_PDF_SIZE_MB) * 1024 * 1024
    if len(data) > max_bytes:
        return JSONResponse(status_code=400, content={"error": "FILE_TOO_LARGE"})

    # FastAPI resets file after read? We already have bytes; reconstruct UploadFile-like
    # to pass filename/content_type to service: create an in-memory UploadFile proxy
    class _MemUpload:
        filename = file.filename
        content_type = file.content_type

        async def read(self):
            return data

    try:
        document_id = await doc_service.create_document(_MemUpload(), db, user_id=user.id)
    except ValueError as ve:
        # Map known validation errors to spec error codes
        code = str(ve)
        return JSONResponse(status_code=400, content={"error": code})

    return JSONResponse(
        status_code=status.HTTP_202_ACCEPTED,
        content={"document_id": str(document_id), "status": "parsing", "filename": file.filename},
    )


@documents_router.get("/{document_id}", response_model=DocumentResponse)
async def get_document(
    document_id: uuid.UUID,
    user: Optional[User] = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db_session),
):
    doc = await doc_service.get_document(document_id, db)
    if not doc:
        return JSONResponse(status_code=404, content={"detail": "Document not found"})
    # Authorization: if document has owner, verify user matches
    if doc.user_id and (not user or doc.user_id != user.id):
        return JSONResponse(status_code=404, content={"detail": "Document not found"})
    return doc


@documents_router.get("/{document_id}/file-url", response_model=DocumentFileUrlResponse)
async def get_document_file_url(
    document_id: uuid.UUID,
    user: Optional[User] = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db_session),
):
    doc = await doc_service.get_document(document_id, db)
    if not doc:
        return JSONResponse(status_code=404, content={"detail": "Document not found"})
    # Authorization: if document has owner, verify user matches
    if doc.user_id and (not user or doc.user_id != user.id):
        return JSONResponse(status_code=404, content={"detail": "Document not found"})
    url = storage_service.get_presigned_url(doc.storage_key, ttl=settings.MINIO_PRESIGN_TTL)
    return DocumentFileUrlResponse(url=url, expires_in=int(settings.MINIO_PRESIGN_TTL))


@documents_router.delete("/{document_id}", status_code=status.HTTP_202_ACCEPTED)
async def delete_document(
    document_id: uuid.UUID,
    user: Optional[User] = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db_session),
):
    doc = await doc_service.get_document(document_id, db)
    if not doc:
        return JSONResponse(status_code=404, content={"detail": "Document not found"})
    # Authorization: if document has owner, verify user matches
    if doc.user_id and (not user or doc.user_id != user.id):
        return JSONResponse(status_code=404, content={"detail": "Document not found"})
    await doc_service.delete_document(document_id, db)
    return JSONResponse(status_code=202, content={"status": "deleted", "message": "文档已删除"})
