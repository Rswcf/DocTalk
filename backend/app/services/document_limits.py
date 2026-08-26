"""Plan-derived ingestion limits and pre-persistence page counting."""
from __future__ import annotations

import fitz

from app.core.config import settings


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
            return int(pdf.page_count)

    from app.services.extractors import extract_document

    return len(extract_document(file_bytes, file_type))
