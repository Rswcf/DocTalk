from __future__ import annotations

import asyncio
import logging
import uuid
from typing import Optional
from urllib.parse import urlparse

from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    HTTPException,
    Query,
    UploadFile,
    status,
)
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.cache import cache_get, cache_set
from app.core.config import settings
from app.core.deps import get_current_user_optional, get_db_session, require_auth
from app.core.security_log import log_security_event
from app.models.tables import User
from app.schemas.common import StatusResponse
from app.schemas.document import (
    DemoDocumentResponse,
    DocumentBrief,
    DocumentFileUrlResponse,
    DocumentHierarchicalBriefResponse,
    DocumentIngestResponse,
    DocumentResponse,
    DocumentTextContentResponse,
)
from app.services.doc_service import can_access_document, doc_service
from app.services.document_limits import (
    count_document_pages,
    count_plan_slot_documents,
    document_capacity_error_detail,
    max_documents_for_plan,
    max_file_size_mb_for_plan,
    max_pages_for_plan,
    normalized_plan,
)
from app.services.extractors.url_extractor import MAX_URL_CONTENT_SIZE
from app.services.file_validation import validate_file_content
from app.services.storage_service import StorageUnavailableError, storage_service

logger = logging.getLogger(__name__)

documents_router = APIRouter(prefix="/api/documents", tags=["documents"])

DOCUMENT_NOT_FOUND_DETAIL = {
    "error": "DOCUMENT_NOT_FOUND",
    "message": "Document not found",
}
SERVER_ERROR_DETAIL = {
    "error": "SERVER_ERROR",
    "message": "Internal error",
}
STORAGE_UNAVAILABLE_DETAIL = {
    "error": "STORAGE_UNAVAILABLE",
    "message": "Document storage is temporarily unavailable",
}
URL_BLOCKED_REASONS = {
    "BLOCKED_HOST",
    "BLOCKED_PORT",
    "INVALID_URL_SCHEME",
    "INVALID_URL_HOST",
    "DNS_RESOLUTION_FAILED",
    "REDIRECT_LOOP",
    "TOO_MANY_REDIRECTS",
}
_UPLOAD_VALUE_ERROR_MAP: dict[str, dict[str, object]] = {
    "UNSUPPORTED_FORMAT": {
        "error": "UNSUPPORTED_FORMAT",
        "message": "Unsupported file format",
    },
    "INVALID_FILE_CONTENT": {
        "error": "INVALID_FILE_CONTENT",
        "message": "Invalid file content",
    },
    "PDF_PASSWORD_PROTECTED": {
        "error": "PDF_PASSWORD_PROTECTED",
        "message": "Password-protected PDFs are not supported. Remove the password and try again.",
    },
}


def _page_limit_detail(*, page_count: int, max_pages: int, plan: str) -> dict[str, object]:
    return {
        "error": "DOCUMENT_PAGE_LIMIT_EXCEEDED",
        "message": f"This document has {page_count} pages; the {plan} plan supports up to {max_pages}",
        "page_count": page_count,
        "max_pages": max_pages,
        "plan": plan,
    }


def _enforce_page_limit(*, page_count: int, plan: str) -> None:
    max_pages = max_pages_for_plan(plan)
    if page_count <= max_pages:
        return
    log_security_event(
        "upload_rejected",
        reason="page_limit",
        page_count=page_count,
        max_pages=max_pages,
        plan=plan,
    )
    raise HTTPException(
        status_code=400,
        detail=_page_limit_detail(page_count=page_count, max_pages=max_pages, plan=plan),
    )


@documents_router.get("", response_model=list[DocumentBrief])
async def list_documents(
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    user: Optional[User] = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db_session),
):
    """List current user's documents. Returns empty list for anonymous users."""
    if not user:
        return []

    from sqlalchemy import select

    from app.models.tables import Document

    result = await db.execute(
        select(Document)
        .where(Document.user_id == user.id)
        .where(Document.status != "deleting")
        .order_by(Document.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    docs = result.scalars().all()
    return [
        DocumentBrief(
            id=str(d.id),
            filename=d.filename,
            status=d.status,
            created_at=d.created_at.isoformat() if d.created_at else None,
            error_msg=d.error_msg,
        )
        for d in docs
    ]


@documents_router.get("/demo", response_model=list[DemoDocumentResponse])
async def get_demo_documents(
    db: AsyncSession = Depends(get_db_session),
):
    """Return list of demo documents for the demo selection page."""
    cache_key = "documents:demo:list"
    cached = await cache_get(cache_key)
    if isinstance(cached, list):
        return cached

    from sqlalchemy import select

    from app.models.tables import Document

    result = await db.execute(
        select(Document)
        .where(Document.demo_slug.isnot(None))
        .order_by(Document.demo_slug)
    )
    docs = result.scalars().all()
    payload = [
        {
            "slug": d.demo_slug,
            "document_id": str(d.id),
            "filename": d.filename,
            "status": d.status,
        }
        for d in docs
    ]
    await cache_set(cache_key, payload, ttl_seconds=300)
    return payload


@documents_router.post(
    "/upload",
    status_code=status.HTTP_202_ACCEPTED,
    response_model=DocumentIngestResponse,
)
async def upload_document(
    file: UploadFile = File(...),
    locale: Optional[str] = Form(default=None),
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
        raise HTTPException(
            status_code=400,
            detail={"error": "UNSUPPORTED_FORMAT", "message": "Unsupported file format"},
        )

    # Unlocked pre-check only: never hold the authoritative user-row lock
    # across the upload byte stream. DocService repeats this under FOR UPDATE
    # immediately before the INSERT.
    plan = normalized_plan(getattr(user, "plan", None))
    slot_count, errored_count = await count_plan_slot_documents(db, user.id)
    limit_detail = document_capacity_error_detail(
        plan=plan,
        slot_count=slot_count,
        errored_count=errored_count,
    )
    if limit_detail is not None:
        log_security_event(
            "plan_limit_hit",
            user_id=user.id,
            plan=plan,
            limit_type="documents",
            limit=max_documents_for_plan(plan),
            current=limit_detail["current"],
            reason=limit_detail.get("reason"),
        )
        raise HTTPException(status_code=403, detail=limit_detail)

    # Validate size by streaming bytes with early abort to prevent memory DoS
    max_size_mb = max_file_size_mb_for_plan(plan)
    max_bytes = max_size_mb * 1024 * 1024
    buf = bytearray()
    while True:
        chunk = await file.read(64 * 1024)
        if not chunk:
            break
        buf.extend(chunk)
        if len(buf) > max_bytes:
            log_security_event("upload_rejected", user_id=user.id, reason="file_too_large", size=len(buf), max_mb=max_size_mb)
            raise HTTPException(
                status_code=400,
                detail={
                    "error": "FILE_TOO_LARGE",
                    "message": "File is too large",
                    "max_mb": max_size_mb,
                    "plan": plan,
                },
            )
    data = bytes(buf)

    # Validate file content matches declared type (magic bytes + structure)
    if not validate_file_content(data, file_type):
        log_security_event("upload_rejected", user_id=user.id, reason="invalid_magic_bytes", filename=file.filename, file_type=file_type)
        raise HTTPException(
            status_code=400,
            detail={"error": "INVALID_FILE_CONTENT", "message": "Invalid file content"},
        )

    # Reject before object storage or a Document row exists. This makes page
    # limits real cost controls and guarantees a rejected upload cannot occupy
    # a Free-plan document slot.
    try:
        page_count = await asyncio.to_thread(count_document_pages, data, file_type)
    except ValueError as exc:
        code = str(exc)
        if code in _UPLOAD_VALUE_ERROR_MAP:
            raise HTTPException(status_code=400, detail=_UPLOAD_VALUE_ERROR_MAP[code])
        logger.exception("Failed to count pages for uploaded %s", file_type)
        raise HTTPException(
            status_code=400,
            detail=_UPLOAD_VALUE_ERROR_MAP["INVALID_FILE_CONTENT"],
        )
    except Exception:
        logger.exception("Failed to count pages for uploaded %s", file_type)
        raise HTTPException(
            status_code=400,
            detail=_UPLOAD_VALUE_ERROR_MAP["INVALID_FILE_CONTENT"],
        )
    _enforce_page_limit(page_count=page_count, plan=plan)

    # FastAPI resets file after read? We already have bytes; reconstruct UploadFile-like
    # to pass filename/content_type to service: create an in-memory UploadFile proxy
    class _MemUpload:
        filename = file.filename
        content_type = file.content_type

        async def read(self):
            return data

    try:
        document_id = await doc_service.create_document(
            _MemUpload(),
            db,
            user_id=user.id,
            file_type=file_type,
            locale=locale,
        )
    except StorageUnavailableError:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=STORAGE_UNAVAILABLE_DETAIL)
    except ValueError as ve:
        code = str(ve)
        if code in _UPLOAD_VALUE_ERROR_MAP:
            raise HTTPException(status_code=400, detail=_UPLOAD_VALUE_ERROR_MAP[code])
        logger.exception("Unexpected ValueError in upload_document")
        raise HTTPException(status_code=500, detail=SERVER_ERROR_DETAIL)

    log_security_event("file_upload", user_id=user.id, document_id=document_id, filename=file.filename, file_type=file_type, size=len(data))
    return JSONResponse(
        status_code=status.HTTP_202_ACCEPTED,
        content={"document_id": str(document_id), "status": "parsing", "filename": file.filename},
    )


class IngestUrlRequest(BaseModel):
    url: str = Field(..., max_length=2000)
    locale: str | None = Field(default=None, max_length=16)


@documents_router.post(
    "/ingest-url",
    status_code=status.HTTP_202_ACCEPTED,
    response_model=DocumentIngestResponse,
)
async def ingest_url(
    body: IngestUrlRequest,
    user: User = Depends(require_auth),
    db: AsyncSession = Depends(get_db_session),
):
    """Ingest a URL/webpage as a document."""
    url = body.url.strip()
    if not url.startswith(('http://', 'https://')):
        raise HTTPException(
            status_code=400,
            detail={"error": "URL_INVALID", "message": "URL must start with http:// or https://"},
        )

    # Validate URL before fetching (SSRF protection)
    from app.core.url_validator import validate_url
    try:
        validate_url(url)
    except ValueError as e:
        code = str(e)
        if code in URL_BLOCKED_REASONS:
            log_security_event("url_fetch_blocked", user_id=user.id, reason=code, url=url)
            raise HTTPException(
                status_code=400,
                detail={"error": "URL_FETCH_BLOCKED", "message": "This URL can't be imported"},
            )
        logger.exception("Unexpected ValueError in ingest_url validation")
        raise HTTPException(status_code=500, detail=SERVER_ERROR_DETAIL)

    # Unlocked pre-check; the insert path repeats it under the per-user lock.
    plan = normalized_plan(getattr(user, "plan", None))
    slot_count, errored_count = await count_plan_slot_documents(db, user.id)
    limit_detail = document_capacity_error_detail(
        plan=plan,
        slot_count=slot_count,
        errored_count=errored_count,
    )
    if limit_detail is not None:
        log_security_event(
            "plan_limit_hit",
            user_id=user.id,
            plan=plan,
            limit_type="documents",
            limit=max_documents_for_plan(plan),
            current=limit_detail["current"],
            reason=limit_detail.get("reason"),
        )
        raise HTTPException(status_code=403, detail=limit_detail)

    try:
        from app.services.extractors.url_extractor import fetch_and_extract_url
        title, pages, pdf_bytes = await asyncio.to_thread(
            fetch_and_extract_url,
            url,
        )
    except ValueError as e:
        code = str(e)
        if code in URL_BLOCKED_REASONS:
            log_security_event("url_fetch_blocked", user_id=user.id, reason=code, url=url)
            raise HTTPException(
                status_code=400,
                detail={"error": "URL_FETCH_BLOCKED", "message": "This URL can't be imported"},
            )
        if code == "URL_CONTENT_TOO_LARGE":
            raise HTTPException(
                status_code=400,
                detail={
                    "error": "URL_CONTENT_TOO_LARGE",
                    "message": "URL content is too large",
                },
            )
        if code == "NO_TEXT_CONTENT":
            raise HTTPException(
                status_code=400,
                detail={"error": "NO_TEXT_CONTENT", "message": "No text content found at URL"},
            )
        if code == "REDIRECT_NO_LOCATION":
            log_security_event("url_fetch_failed", user_id=user.id, reason=code, url=url)
            raise HTTPException(
                status_code=400,
                detail={"error": "URL_FETCH_FAILED", "message": "Failed to fetch URL"},
            )
        logger.exception("Unexpected ValueError in ingest_url fetch")
        raise HTTPException(status_code=500, detail=SERVER_ERROR_DETAIL)
    except Exception as e:
        logger.error("URL fetch failed for %s: %s", url, e)
        log_security_event("url_fetch_failed", user_id=user.id, reason=type(e).__name__, url=url)
        raise HTTPException(
            status_code=400,
            detail={"error": "URL_FETCH_FAILED", "message": "Failed to fetch URL"},
        )

    if pdf_bytes:
        if len(pdf_bytes) > MAX_URL_CONTENT_SIZE:
            log_security_event(
                "upload_rejected",
                user_id=user.id,
                reason="url_content_too_large",
                size=len(pdf_bytes),
                max_mb=MAX_URL_CONTENT_SIZE // (1024 * 1024),
            )
            raise HTTPException(
                status_code=400,
                detail={
                    "error": "URL_CONTENT_TOO_LARGE",
                    "message": "URL content exceeds the 10 MB import limit",
                },
            )

        try:
            page_count = await asyncio.to_thread(count_document_pages, pdf_bytes, "pdf")
        except ValueError as exc:
            code = str(exc)
            if code in _UPLOAD_VALUE_ERROR_MAP:
                raise HTTPException(status_code=400, detail=_UPLOAD_VALUE_ERROR_MAP[code])
            logger.exception("Failed to count pages for URL-imported PDF")
            raise HTTPException(
                status_code=400,
                detail=_UPLOAD_VALUE_ERROR_MAP["INVALID_FILE_CONTENT"],
            )
        except Exception:
            logger.exception("Failed to count pages for URL-imported PDF")
            raise HTTPException(
                status_code=400,
                detail=_UPLOAD_VALUE_ERROR_MAP["INVALID_FILE_CONTENT"],
            )
        _enforce_page_limit(page_count=page_count, plan=plan)

        # URL returned a PDF — process through the same authoritative,
        # per-user locked insert path as direct uploads.
        class _MemUpload:
            filename = title
            content_type = "application/pdf"

            async def read(self):
                return pdf_bytes

        try:
            doc_id = await doc_service.create_document(
                _MemUpload(),
                db,
                user_id=user.id,
                file_type="pdf",
                locale=body.locale,
                source_url=url,
            )
        except StorageUnavailableError:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=STORAGE_UNAVAILABLE_DETAIL,
            )

        return JSONResponse(
            status_code=status.HTTP_202_ACCEPTED,
            content={"document_id": str(doc_id), "status": "parsing", "filename": title},
        )
    else:
        # URL returned HTML: store a structured Markdown snapshot and process
        # it through the URL text pipeline.
        text_content = '\n\n'.join(p.text for p in pages)
        text_bytes = text_content.encode('utf-8')
        # Count the stored Markdown through the same extractor the worker will
        # use; the fetcher's article-section pages are not necessarily the
        # final documents.page_count split.
        page_count = await asyncio.to_thread(count_document_pages, text_bytes, "url")
        _enforce_page_limit(page_count=page_count, plan=plan)
        if len(text_bytes) > MAX_URL_CONTENT_SIZE:
            log_security_event(
                "upload_rejected",
                user_id=user.id,
                reason="url_content_too_large",
                size=len(text_bytes),
                max_mb=MAX_URL_CONTENT_SIZE // (1024 * 1024),
            )
            raise HTTPException(
                status_code=400,
                detail={
                    "error": "URL_CONTENT_TOO_LARGE",
                    "message": "URL content exceeds the 10 MB import limit",
                },
            )

        display_title = (title or urlparse(url).netloc or "Imported webpage")[:100]

        class _MemUpload:
            filename = display_title
            content_type = "text/markdown"

            async def read(self):
                return text_bytes

        try:
            doc_id = await doc_service.create_document(
                _MemUpload(),
                db,
                user_id=user.id,
                file_type="url",
                locale=body.locale,
                source_url=url,
            )
        except StorageUnavailableError:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=STORAGE_UNAVAILABLE_DETAIL,
            )

        return JSONResponse(
            status_code=status.HTTP_202_ACCEPTED,
            content={"document_id": str(doc_id), "status": "parsing", "filename": display_title},
        )


@documents_router.get("/{document_id}", response_model=DocumentResponse)
async def get_document(
    document_id: uuid.UUID,
    user: Optional[User] = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db_session),
):
    doc = await doc_service.get_document(document_id, db)
    if not doc:
        raise HTTPException(status_code=404, detail=DOCUMENT_NOT_FOUND_DETAIL)
    if not can_access_document(doc, user):
        raise HTTPException(status_code=404, detail=DOCUMENT_NOT_FOUND_DETAIL)
    resp = DocumentResponse.model_validate(doc)
    if doc.source_url and resp.filename.lower().endswith((".txt", ".md")):
        resp.filename = resp.filename.rsplit(".", 1)[0]
    resp.has_converted_pdf = bool(doc.converted_storage_key)
    return resp


def _brief_chunk_ids(*groups: list[dict]) -> list[uuid.UUID]:
    chunk_ids: list[uuid.UUID] = []
    seen: set[uuid.UUID] = set()
    for group in groups:
        for item in group or []:
            if not isinstance(item, dict):
                continue
            refs = item.get("source_refs")
            if not isinstance(refs, list):
                continue
            for ref in refs:
                if not isinstance(ref, dict):
                    continue
                try:
                    chunk_id = uuid.UUID(str(ref.get("chunk_id")))
                except (TypeError, ValueError):
                    continue
                if chunk_id in seen:
                    continue
                seen.add(chunk_id)
                chunk_ids.append(chunk_id)
    return chunk_ids


def _brief_ref_payload(chunk) -> dict:
    bboxes = chunk.bboxes if isinstance(chunk.bboxes, list) else []
    snippet = ((f"{chunk.section_title}: " if chunk.section_title else "") + (chunk.text or ""))[:180]
    return {
        "chunk_id": str(chunk.id),
        "chunk_index": int(chunk.chunk_index),
        "page": int(chunk.page_start),
        "page_end": int(chunk.page_end),
        "bboxes": bboxes,
        "text_snippet": snippet,
    }


def _hydrate_brief_items(items: list[dict], chunks_by_id: dict[uuid.UUID, object]) -> list[dict]:
    hydrated: list[dict] = []
    for item in items or []:
        if not isinstance(item, dict):
            continue
        copied = dict(item)
        refs = item.get("source_refs")
        hydrated_refs: list[dict] = []
        expects_refs = "source_refs" in item
        if isinstance(refs, list):
            for ref in refs:
                if not isinstance(ref, dict):
                    continue
                try:
                    chunk_id = uuid.UUID(str(ref.get("chunk_id")))
                except (TypeError, ValueError):
                    continue
                chunk = chunks_by_id.get(chunk_id)
                if chunk is not None:
                    hydrated_refs.append(_brief_ref_payload(chunk))
        if expects_refs and not hydrated_refs:
            continue
        copied["source_refs"] = hydrated_refs
        hydrated.append(copied)
    return hydrated


@documents_router.get("/{document_id}/brief", response_model=DocumentHierarchicalBriefResponse)
async def get_document_brief(
    document_id: uuid.UUID,
    user: Optional[User] = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db_session),
):
    from sqlalchemy import select

    from app.models.tables import Chunk
    from app.models.tables import DocumentBrief as DocumentBriefModel

    doc = await doc_service.get_document(document_id, db)
    if not doc:
        raise HTTPException(status_code=404, detail=DOCUMENT_NOT_FOUND_DETAIL)
    if not can_access_document(doc, user):
        raise HTTPException(status_code=404, detail=DOCUMENT_NOT_FOUND_DETAIL)

    brief = (
        await db.execute(
            select(DocumentBriefModel).where(DocumentBriefModel.document_id == document_id)
        )
    ).scalar_one_or_none()

    if brief is None:
        if doc.summary or doc.suggested_questions:
            return DocumentHierarchicalBriefResponse(
                status="ready",
                updated_at=doc.updated_at,
                summary=doc.summary,
                questions=doc.suggested_questions or [],
                coverage={"status": "legacy_summary"},
            )
        return DocumentHierarchicalBriefResponse(
            status="pending" if doc.status != "ready" else "empty",
            coverage={"status": doc.status},
        )

    outline = brief.outline if isinstance(brief.outline, list) else []
    key_points = brief.key_points if isinstance(brief.key_points, list) else []
    facts = brief.facts if isinstance(brief.facts, list) else []
    chunk_ids = _brief_chunk_ids(outline, key_points, facts)
    chunks_by_id: dict[uuid.UUID, object] = {}
    if chunk_ids:
        rows = await db.execute(
            select(Chunk)
            .where(Chunk.document_id == document_id)
            .where(Chunk.id.in_(chunk_ids))
        )
        chunks_by_id = {chunk.id: chunk for chunk in rows.scalars()}

    status_value = "failed" if brief.error_code else "ready"
    return DocumentHierarchicalBriefResponse(
        status=status_value,
        updated_at=brief.updated_at,
        generated_at=brief.generated_at,
        summary=brief.summary,
        outline=_hydrate_brief_items(outline, chunks_by_id),
        key_points=_hydrate_brief_items(key_points, chunks_by_id),
        facts=_hydrate_brief_items(facts, chunks_by_id),
        questions=brief.questions if isinstance(brief.questions, list) else [],
        coverage=brief.coverage if isinstance(brief.coverage, dict) else {},
        error_code=brief.error_code,
        error_message=brief.error_message,
    )


@documents_router.get("/{document_id}/file-url", response_model=DocumentFileUrlResponse)
async def get_document_file_url(
    document_id: uuid.UUID,
    variant: Optional[str] = Query(None, description="'converted' for converted PDF"),
    user: Optional[User] = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db_session),
):
    import asyncio

    doc = await doc_service.get_document(document_id, db)
    if not doc:
        raise HTTPException(status_code=404, detail=DOCUMENT_NOT_FOUND_DETAIL)
    if not can_access_document(doc, user):
        raise HTTPException(status_code=404, detail=DOCUMENT_NOT_FOUND_DETAIL)

    storage_key = doc.converted_storage_key if variant == "converted" else doc.storage_key
    if variant == "converted" and not doc.converted_storage_key:
        raise HTTPException(status_code=404, detail=DOCUMENT_NOT_FOUND_DETAIL)

    # Run synchronous MinIO call in a thread to avoid blocking the event loop.
    # When MinIO is unreachable, urllib3 retries can block for seconds.
    try:
        url = await asyncio.to_thread(
            storage_service.get_presigned_url, storage_key, settings.MINIO_PRESIGN_TTL
        )
    except Exception:
        raise HTTPException(
            status_code=502,
            detail={
                "error": "STORAGE_UNAVAILABLE",
                "message": "Storage service unavailable",
            },
        )

    return DocumentFileUrlResponse(url=url, expires_in=int(settings.MINIO_PRESIGN_TTL))


@documents_router.get("/{document_id}/text-content", response_model=DocumentTextContentResponse)
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
        raise HTTPException(status_code=404, detail=DOCUMENT_NOT_FOUND_DETAIL)
    if not can_access_document(doc, user):
        raise HTTPException(status_code=404, detail=DOCUMENT_NOT_FOUND_DETAIL)

    # Try Page.content first (available for newly parsed non-PDF documents)
    result = await db.execute(
        sa_select(PageModel)
        .where(PageModel.document_id == document_id)
        .order_by(PageModel.page_number)
    )
    db_pages = result.scalars().all()

    section_titles: dict[int, str] = {}
    result = await db.execute(
        sa_select(Chunk)
        .where(Chunk.document_id == document_id)
        .where(Chunk.section_title.is_not(None))
        .order_by(Chunk.chunk_index)
    )
    for chunk in result.scalars().all():
        title = (chunk.section_title or "").strip()
        if not title:
            continue
        for page_num in range(chunk.page_start, chunk.page_end + 1):
            section_titles.setdefault(page_num, title)

    # FIX-8 (Codex r1 MINOR #8): require ALL pages to have real content, not
    # "any" — the prior any()-gated branch then silently filtered out every
    # page without content, so a partial/mixed persistence state (some pages
    # parsed with Page.content, some without) served an incomplete document
    # instead of falling back. Mirrors B2's build_quote_source() page_text
    # trust bar (quote_source_service.py): the WHOLE range must have real
    # (non-blank) content, never a majority/any check.
    #
    # FIX2-D (Codex r2 #8, NOT ADDRESSED): all(content) alone only checks
    # the ROWS THAT EXIST — it never verifies every expected page ROW
    # exists at all. Codex's exact probe: a 3-page document with Page rows
    # only for pages 1 and 3 (page 2's row is entirely MISSING, not merely
    # blank) passes all(content) trivially over those 2 rows and silently
    # drops page 2. Require COMPLETE, CONSECUTIVE coverage — the returned
    # page numbers must be exactly 1..doc.page_count, no gaps — before even
    # checking content. When doc.page_count is unknown (None), we cannot
    # verify completeness at all, so fail closed to chunk reconstruction.
    expected_page_count = getattr(doc, "page_count", None)
    page_numbers = sorted(p.page_number for p in db_pages)
    complete_consecutive_coverage = (
        expected_page_count is not None
        and page_numbers == list(range(1, expected_page_count + 1))
    )
    has_content = complete_consecutive_coverage and all((p.content or "").strip() for p in db_pages)

    if has_content:
        pages_list = [
            {
                "page_number": p.page_number,
                "text": p.content or '',
                "section_title": section_titles.get(p.page_number),
            }
            for p in db_pages
        ]
    else:
        # Fallback: reconstruct from chunks (for legacy documents parsed
        # before this change, or documents with partial/mixed Page.content
        # persistence)
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
            {
                "page_number": pn,
                "text": "\n".join(texts),
                "section_title": section_titles.get(pn),
            }
            for pn, texts in sorted(pages_dict.items())
        ]

    source_url = getattr(doc, 'source_url', None)
    domain = urlparse(source_url).netloc if source_url else None
    title = getattr(doc, 'filename', None)
    if source_url and isinstance(title, str) and title.lower().endswith((".txt", ".md")):
        title = title.rsplit(".", 1)[0]
    return {
        "file_type": getattr(doc, 'file_type', 'pdf'),
        "pages": pages_list,
        "title": title,
        "source_url": source_url,
        "domain": domain,
    }


class ReparseRequest(BaseModel):
    locale: str | None = Field(default=None, max_length=16)


@documents_router.post(
    "/{document_id}/reparse",
    status_code=status.HTTP_202_ACCEPTED,
    response_model=StatusResponse,
)
async def reparse_document(
    document_id: uuid.UUID,
    body: Optional[ReparseRequest] = None,
    user: User = Depends(require_auth),
    db: AsyncSession = Depends(get_db_session),
):
    """Re-parse an existing document (e.g. after a parser/OCR upgrade or chunk
    config change). Re-parsing clears stale Qdrant vectors first (handled in the
    worker). An optional `locale` selects the OCR language set (e.g. 'ur' for an
    Urdu scan) — without it OCR uses the configured default set."""
    from app.models.tables import Document

    doc = await db.get(Document, document_id)
    if not doc or doc.user_id != user.id:
        raise HTTPException(status_code=404, detail=DOCUMENT_NOT_FOUND_DETAIL)
    if doc.status not in ("ready", "error"):
        raise HTTPException(
            status_code=409,
            detail={
                "error": "DOCUMENT_PROCESSING",
                "message": "Document is still processing",
                "status": doc.status,
            },
        )

    # Serialize every retry-into-success claim with uploads/imports for this
    # user. Refresh after acquiring the lock so a second retry of the same
    # document still observes the winner's in-flight state and returns the
    # established 409 contract rather than a stale limit response.
    from sqlalchemy import select as sa_select

    await db.scalar(sa_select(User.id).where(User.id == user.id).with_for_update())
    await db.refresh(doc, attribute_names=["status"])
    if doc.status not in ("ready", "error"):
        await db.rollback()
        raise HTTPException(
            status_code=409,
            detail={
                "error": "DOCUMENT_PROCESSING",
                "message": "Document is still processing",
                "status": doc.status,
            },
        )

    if doc.status == "error":
        slot_count, _errored_count = await count_plan_slot_documents(db, user.id)
        limit_detail = document_capacity_error_detail(
            plan=getattr(user, "plan", None),
            slot_count=slot_count,
            # Rule C is independent of the retained-error ceiling: the row
            # already exists, so only its return to the live set needs room.
            errored_count=0,
        )
        if limit_detail is not None:
            await db.rollback()
            raise HTTPException(status_code=403, detail=limit_detail)

    # Atomic claim (Codex r5): a plain read-then-write lets two concurrent
    # reparse requests both observe 'ready', both write their locale and both
    # publish — the advisory lock makes the loser's task a no-op, so the run
    # that executes can use a locale the row no longer records. The
    # conditional UPDATE picks exactly one winner; it also overwrites (or
    # intentionally RESETS to NULL = platform defaults) the stored request in
    # the same statement that opens 'parsing', BEFORE publishing — the worker
    # reads only this column (Codex r4).
    from sqlalchemy import update as sa_update

    requested_locale = body.locale if body else None
    claimed = await db.execute(
        sa_update(Document)
        .where(Document.id == doc.id, Document.status.in_(("ready", "error")))
        .values(status="parsing", parse_requested_locale=requested_locale)
    )
    await db.commit()
    if claimed.rowcount != 1:
        raise HTTPException(
            status_code=409,
            detail={
                "error": "DOCUMENT_PROCESSING",
                "message": "Document is still processing",
                "status": "parsing",
            },
        )
    from app.workers.parse_worker import parse_document
    parse_document.delay(str(doc.id), locale=requested_locale)
    return {"status": "reparsing"}


@documents_router.delete(
    "/{document_id}",
    status_code=status.HTTP_202_ACCEPTED,
    response_model=StatusResponse,
)
async def delete_document(
    document_id: uuid.UUID,
    user: User = Depends(require_auth),
    db: AsyncSession = Depends(get_db_session),
):
    doc = await doc_service.get_document(document_id, db)
    if not doc:
        raise HTTPException(status_code=404, detail=DOCUMENT_NOT_FOUND_DETAIL)
    # Only the document owner can delete; demo docs (user_id=None) are not deletable via API
    if doc.user_id != user.id:
        raise HTTPException(status_code=404, detail=DOCUMENT_NOT_FOUND_DETAIL)
    await doc_service.delete_document(document_id, db)
    return JSONResponse(status_code=202, content={"status": "deleted"})


class UpdateDocumentRequest(BaseModel):
    custom_instructions: Optional[str] = Field(None)


@documents_router.patch("/{document_id}", response_model=StatusResponse)
async def update_document(
    document_id: uuid.UUID,
    body: UpdateDocumentRequest,
    user: User = Depends(require_auth),
    db: AsyncSession = Depends(get_db_session),
):
    from app.models.tables import Document

    doc = await db.get(Document, document_id)
    if not doc or doc.user_id != user.id:
        raise HTTPException(status_code=404, detail=DOCUMENT_NOT_FOUND_DETAIL)
    if body.custom_instructions is not None:
        if len(body.custom_instructions) > 2000:
            raise HTTPException(
                status_code=400,
                detail={
                    "error": "INSTRUCTIONS_TOO_LONG",
                    "message": "Instructions too long",
                    "max": 2000,
                },
            )
        # Custom instructions require Pro plan
        if body.custom_instructions.strip():
            plan = (user.plan or "free").lower()
            if plan != "pro":
                raise HTTPException(
                    status_code=403,
                    detail={
                        "error": "CUSTOM_INSTRUCTIONS_REQUIRE_PRO",
                        "message": "Custom instructions require Pro plan",
                    },
                )
        doc.custom_instructions = body.custom_instructions if body.custom_instructions.strip() else None
    db.add(doc)
    await db.commit()
    return {"status": "updated"}
