from __future__ import annotations

import io
import uuid
import zipfile
from typing import Optional

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.deps import get_current_user_optional, get_db_session, require_auth
from app.core.security_log import log_security_event
from app.models.tables import User
from app.schemas.document import (
    DocumentBrief,
    DocumentFileUrlResponse,
    DocumentResponse,
)
from app.services.doc_service import doc_service
from app.services.storage_service import storage_service

documents_router = APIRouter(prefix="/documents", tags=["documents"])

_MAGIC_SIGNATURES: dict[str, list[bytes]] = {
    'pdf': [b'%PDF'],
    'docx': [b'PK\x03\x04'],
    'pptx': [b'PK\x03\x04'],
    'xlsx': [b'PK\x03\x04'],
    'txt': [],
    'md': [],
}

_MAX_UNCOMPRESSED_SIZE = 500 * 1024 * 1024  # 500MB zip bomb protection


def _validate_file_content(data: bytes, file_type: str) -> bool:
    """Validate file content against expected magic bytes and structure."""
    sigs = _MAGIC_SIGNATURES.get(file_type, [])
    if sigs and not any(data[:len(sig)] == sig for sig in sigs):
        return False
    # For Office Open XML formats, verify ZIP structure
    if file_type in ('docx', 'pptx', 'xlsx'):
        try:
            with zipfile.ZipFile(io.BytesIO(data)) as zf:
                if '[Content_Types].xml' not in zf.namelist():
                    return False
                total_uncompressed = sum(info.file_size for info in zf.infolist())
                if total_uncompressed > _MAX_UNCOMPRESSED_SIZE:
                    return False
        except zipfile.BadZipFile:
            return False
    return True


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
    # Validate file type
    import os

    from app.core.config import EXTENSION_TYPE_MAP, FILE_TYPE_MAP
    content_type = (file.content_type or "").lower()
    file_type = FILE_TYPE_MAP.get(content_type)

    # Fallback: detect by extension for ambiguous MIME types
    if file_type is None and file.filename:
        ext = os.path.splitext(file.filename)[1].lower()
        file_type = EXTENSION_TYPE_MAP.get(ext)

    if file_type is None or file_type not in settings.ALLOWED_FILE_TYPES:
        return JSONResponse(status_code=400, content={"error": "UNSUPPORTED_FORMAT"})

    # Enforce per-plan document count limit
    from sqlalchemy import func
    from sqlalchemy import select as sa_select

    from app.models.tables import Document
    user_doc_count = await db.scalar(
        sa_select(func.count()).select_from(Document)
        .where(Document.user_id == user.id)
        .where(Document.status != "deleting")
    )
    plan = getattr(user, 'plan', None) or "free"
    max_docs = {
        "free": settings.FREE_MAX_DOCUMENTS,
        "plus": settings.PLUS_MAX_DOCUMENTS,
        "pro": settings.PRO_MAX_DOCUMENTS,
    }.get(plan, settings.FREE_MAX_DOCUMENTS)
    if user_doc_count >= max_docs:
        log_security_event("plan_limit_hit", user_id=user.id, plan=plan, limit_type="documents", limit=max_docs, current=user_doc_count)
        return JSONResponse(status_code=403, content={
            "error": "DOCUMENT_LIMIT_REACHED", "limit": max_docs, "current": user_doc_count,
        })

    # Validate size by reading bytes
    data = await file.read()
    max_size_mb = {
        "free": settings.FREE_MAX_FILE_SIZE_MB,
        "plus": settings.PLUS_MAX_FILE_SIZE_MB,
        "pro": settings.PRO_MAX_FILE_SIZE_MB,
    }.get(plan, settings.FREE_MAX_FILE_SIZE_MB)
    if len(data) > max_size_mb * 1024 * 1024:
        log_security_event("upload_rejected", user_id=user.id, reason="file_too_large", size=len(data), max_mb=max_size_mb)
        return JSONResponse(status_code=400, content={"error": "FILE_TOO_LARGE", "max_mb": max_size_mb})

    # Validate file content matches declared type (magic bytes + structure)
    if not _validate_file_content(data, file_type):
        log_security_event("upload_rejected", user_id=user.id, reason="invalid_magic_bytes", filename=file.filename, file_type=file_type)
        return JSONResponse(status_code=400, content={"error": "INVALID_FILE_CONTENT"})

    # FastAPI resets file after read? We already have bytes; reconstruct UploadFile-like
    # to pass filename/content_type to service: create an in-memory UploadFile proxy
    class _MemUpload:
        filename = file.filename
        content_type = file.content_type

        async def read(self):
            return data

    try:
        document_id = await doc_service.create_document(_MemUpload(), db, user_id=user.id, file_type=file_type)
    except ValueError as ve:
        # Map known validation errors to spec error codes
        code = str(ve)
        return JSONResponse(status_code=400, content={"error": code})

    log_security_event("file_upload", user_id=user.id, document_id=document_id, filename=file.filename, file_type=file_type, size=len(data))
    return JSONResponse(
        status_code=status.HTTP_202_ACCEPTED,
        content={"document_id": str(document_id), "status": "parsing", "filename": file.filename},
    )


class IngestUrlRequest(BaseModel):
    url: str = Field(..., max_length=2000)


@documents_router.post("/ingest-url", status_code=status.HTTP_202_ACCEPTED)
async def ingest_url(
    body: IngestUrlRequest,
    user: User = Depends(require_auth),
    db: AsyncSession = Depends(get_db_session),
):
    """Ingest a URL/webpage as a document."""
    url = body.url.strip()
    if not url.startswith(('http://', 'https://')):
        return JSONResponse(status_code=400, content={"error": "URL must start with http:// or https://"})

    # Validate URL before fetching (SSRF protection)
    from app.core.url_validator import validate_url
    try:
        validate_url(url)
    except ValueError as e:
        return JSONResponse(status_code=400, content={"error": str(e)})

    try:
        from app.services.extractors.url_extractor import fetch_and_extract_url
        title, pages, pdf_bytes = fetch_and_extract_url(url)
    except ValueError as e:
        code = str(e)
        if code in ("BLOCKED_HOST", "BLOCKED_PORT", "INVALID_URL_SCHEME",
                     "INVALID_URL_HOST", "DNS_RESOLUTION_FAILED",
                     "REDIRECT_LOOP", "TOO_MANY_REDIRECTS"):
            return JSONResponse(status_code=400, content={"error": code})
        if code == "URL_CONTENT_TOO_LARGE":
            return JSONResponse(status_code=400, content={"error": "URL_CONTENT_TOO_LARGE"})
        if code == "NO_TEXT_CONTENT":
            return JSONResponse(status_code=400, content={"error": "NO_TEXT_CONTENT"})
        return JSONResponse(status_code=400, content={"error": f"Failed to fetch URL: {code}"})
    except Exception as e:
        return JSONResponse(status_code=400, content={"error": f"Failed to fetch URL: {str(e)}"})

    if pdf_bytes:
        # URL returned a PDF — process through normal PDF pipeline
        doc_id = uuid.uuid4()
        storage_key = f"documents/{doc_id}/{title}"
        storage_service.upload_file(pdf_bytes, storage_key, content_type='application/pdf')

        from app.models.tables import Document
        doc = Document(
            id=doc_id,
            filename=title,
            file_size=len(pdf_bytes),
            storage_key=storage_key,
            status="parsing",
            user_id=user.id,
            file_type="pdf",
            source_url=url,
        )
        db.add(doc)
        await db.commit()

        from app.workers.parse_worker import parse_document
        parse_document.delay(str(doc.id))

        return JSONResponse(
            status_code=status.HTTP_202_ACCEPTED,
            content={"document_id": str(doc_id), "status": "parsing", "filename": title},
        )
    else:
        # URL returned HTML — store extracted text as .txt, process through text pipeline
        text_content = '\n\n'.join(p.text for p in pages)
        text_bytes = text_content.encode('utf-8')
        doc_id = uuid.uuid4()
        filename = f"{title[:100]}.txt"
        storage_key = f"documents/{doc_id}/{filename}"
        storage_service.upload_file(text_bytes, storage_key, content_type='text/plain')

        from app.models.tables import Document
        doc = Document(
            id=doc_id,
            filename=filename,
            file_size=len(text_bytes),
            storage_key=storage_key,
            status="parsing",
            user_id=user.id,
            file_type="txt",
            source_url=url,
        )
        db.add(doc)
        await db.commit()

        from app.workers.parse_worker import parse_document
        parse_document.delay(str(doc.id))

        return JSONResponse(
            status_code=status.HTTP_202_ACCEPTED,
            content={"document_id": str(doc_id), "status": "parsing", "filename": filename},
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


@documents_router.get("/{document_id}/text-content")
async def get_document_text_content(
    document_id: uuid.UUID,
    user: Optional[User] = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db_session),
):
    """Return extracted text content grouped by page for non-PDF viewer.

    Prefers Page.content (original extracted text) over chunk reconstruction
    to avoid overlap/duplication artifacts from the chunking pipeline.
    """
    from sqlalchemy import select as sa_select  # noqa: I001

    from app.models.tables import Chunk, Page as PageModel

    doc = await doc_service.get_document(document_id, db)
    if not doc:
        return JSONResponse(status_code=404, content={"detail": "Document not found"})
    if doc.user_id and (not user or doc.user_id != user.id):
        return JSONResponse(status_code=404, content={"detail": "Document not found"})

    # Try Page.content first (available for newly parsed non-PDF documents)
    result = await db.execute(
        sa_select(PageModel)
        .where(PageModel.document_id == document_id)
        .order_by(PageModel.page_number)
    )
    db_pages = result.scalars().all()

    # Check if any page has content stored
    has_content = any(p.content for p in db_pages)

    if has_content:
        pages_list = [
            {"page_number": p.page_number, "text": p.content or ''}
            for p in db_pages
            if p.content
        ]
    else:
        # Fallback: reconstruct from chunks (for legacy documents parsed before this change)
        result = await db.execute(
            sa_select(Chunk)
            .where(Chunk.document_id == document_id)
            .order_by(Chunk.page_start, Chunk.chunk_index)
        )
        chunks = result.scalars().all()

        pages_dict: dict[int, list[str]] = {}
        for chunk in chunks:
            for page_num in range(chunk.page_start, chunk.page_end + 1):
                if page_num not in pages_dict:
                    pages_dict[page_num] = []
                pages_dict[page_num].append(chunk.text)

        pages_list = [
            {"page_number": pn, "text": "\n".join(texts)}
            for pn, texts in sorted(pages_dict.items())
        ]

    return {"file_type": getattr(doc, 'file_type', 'pdf'), "pages": pages_list}


@documents_router.post("/{document_id}/reparse", status_code=status.HTTP_202_ACCEPTED)
async def reparse_document(
    document_id: uuid.UUID,
    user: User = Depends(require_auth),
    db: AsyncSession = Depends(get_db_session),
):
    """Re-parse an existing document (e.g., after chunk config changes)."""
    from app.models.tables import Document

    doc = await db.get(Document, document_id)
    if not doc or doc.user_id != user.id:
        raise HTTPException(status_code=404)
    if doc.status not in ("ready", "error"):
        raise HTTPException(status_code=409, detail="Document is still processing")
    doc.status = "parsing"
    db.add(doc)
    await db.commit()
    from app.workers.parse_worker import parse_document
    parse_document.delay(str(doc.id))
    return {"status": "reparsing"}


@documents_router.delete("/{document_id}", status_code=status.HTTP_202_ACCEPTED)
async def delete_document(
    document_id: uuid.UUID,
    user: User = Depends(require_auth),
    db: AsyncSession = Depends(get_db_session),
):
    doc = await doc_service.get_document(document_id, db)
    if not doc:
        return JSONResponse(status_code=404, content={"detail": "Document not found"})
    # Only the document owner can delete; demo docs (user_id=None) are not deletable via API
    if doc.user_id != user.id:
        return JSONResponse(status_code=404, content={"detail": "Document not found"})
    await doc_service.delete_document(document_id, db)
    return JSONResponse(status_code=202, content={"status": "deleted"})


class UpdateDocumentRequest(BaseModel):
    custom_instructions: Optional[str] = Field(None, max_length=2000)


@documents_router.patch("/{document_id}")
async def update_document(
    document_id: uuid.UUID,
    body: UpdateDocumentRequest,
    user: User = Depends(require_auth),
    db: AsyncSession = Depends(get_db_session),
):
    from app.models.tables import Document

    doc = await db.get(Document, document_id)
    if not doc or doc.user_id != user.id:
        raise HTTPException(status_code=404)
    if body.custom_instructions is not None:
        if len(body.custom_instructions) > 2000:
            raise HTTPException(status_code=400, detail="Instructions too long (max 2000 chars)")
        # Custom instructions require Pro plan
        if body.custom_instructions.strip():
            plan = (user.plan or "free").lower()
            if plan != "pro":
                raise HTTPException(status_code=403, detail="Custom instructions require Pro plan")
        doc.custom_instructions = body.custom_instructions if body.custom_instructions.strip() else None
    db.add(doc)
    await db.commit()
    return {"status": "updated"}
