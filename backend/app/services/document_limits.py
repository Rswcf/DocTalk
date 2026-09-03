"""Plan-derived ingestion limits and pre-persistence page counting."""
from __future__ import annotations

import fitz
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.tables import Document


def normalized_plan(plan: str | None) -> str:
    value = (plan or "free").lower()
    return value if value in {"free", "plus", "pro"} else "free"


def max_file_size_mb_for_plan(plan: str | None) -> int:
    return {
        "free": settings.FREE_MAX_FILE_SIZE_MB,
        "plus": settings.PLUS_MAX_FILE_SIZE_MB,
        "pro": settings.PRO_MAX_FILE_SIZE_MB,
    }[normalized_plan(plan)]


def max_pages_for_plan(plan: str | None) -> int:
    return {
        "free": settings.FREE_MAX_PAGES,
        "plus": settings.PLUS_MAX_PAGES,
        "pro": settings.PRO_MAX_PAGES,
    }[normalized_plan(plan)]


def max_documents_for_plan(plan: str | None) -> int:
    return {
        "free": settings.FREE_MAX_DOCUMENTS,
        "plus": settings.PLUS_MAX_DOCUMENTS,
        "pro": settings.PRO_MAX_DOCUMENTS,
    }[normalized_plan(plan)]


async def count_plan_slot_documents(
    db: AsyncSession,
    user_id: object,
) -> tuple[int, int]:
    """Return live plan slots and retained failed rows for one user.

    Failed documents do not consume a live plan slot, but they have their own
    ceiling so repeated parse failures cannot accumulate unbounded storage.
    """
    slot_count = await db.scalar(
        select(func.count())
        .select_from(Document)
        .where(Document.user_id == user_id)
        .where(Document.status.notin_(("deleting", "error")))
    )
    errored_count = await db.scalar(
        select(func.count())
        .select_from(Document)
        .where(Document.user_id == user_id)
        .where(Document.status == "error")
    )
    return int(slot_count or 0), int(errored_count or 0)


def document_capacity_error_detail(
    *,
    plan: str | None,
    slot_count: int,
    errored_count: int,
) -> dict[str, object] | None:
    """Build the canonical limit response, or return None when capacity remains."""
    normalized = normalized_plan(plan)
    max_docs = max_documents_for_plan(normalized)
    if slot_count >= max_docs:
        return {
            "error": "DOCUMENT_LIMIT_REACHED",
            "message": "Document limit reached for current plan",
            "limit": max_docs,
            "current": slot_count,
            "plan": normalized,
        }
    if errored_count >= max_docs:
        return {
            "error": "DOCUMENT_LIMIT_REACHED",
            "message": "Delete failed documents to continue",
            "limit": max_docs,
            "current": errored_count,
            "plan": normalized,
            "reason": "failed_documents",
        }
    return None


def count_document_pages(file_bytes: bytes, file_type: str) -> int:
    """Return the exact logical page count the parse worker will persist.

    PDFs need only their page tree opened; no text, rendering, or OCR work is
    performed. Other supported formats reuse the worker's deterministic
    extractor so the preflight count matches ``documents.page_count`` (slides
    for PPTX, non-empty sheets for XLSX, and ~3,000-character logical pages
    for DOCX/TXT/MD/URL snapshots).
    """
    if file_type == "pdf":
        with fitz.open(stream=file_bytes, filetype="pdf") as pdf:
            if pdf.needs_pass:
                raise ValueError("PDF_PASSWORD_PROTECTED")
            page_count = int(pdf.page_count)
            if page_count < 1:
                raise ValueError("INVALID_FILE_CONTENT")
            return page_count

    from app.services.extractors import extract_document

    return len(extract_document(file_bytes, file_type))
