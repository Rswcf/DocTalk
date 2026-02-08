from __future__ import annotations

import io
from typing import List

from .base import ExtractedPage


def extract_docx(file_bytes: bytes) -> List[ExtractedPage]:
    """Extract text from DOCX files using python-docx.

    Detects Heading styles as section boundaries. Splits at ~3000 chars per page.
    """
    from docx import Document

    doc = Document(io.BytesIO(file_bytes))

    pages: List[ExtractedPage] = []
    current_text: List[str] = []
    current_title: str | None = None
    current_chars = 0
    page_num = 1
    MAX_CHARS = 3000

    def flush_page():
        nonlocal page_num, current_chars
        if current_text:
            text = '\n'.join(current_text)
            if text.strip():
                pages.append(ExtractedPage(
                    page_number=page_num,
                    text=text,
                    section_title=current_title,
                ))
                page_num += 1
            current_text.clear()
            current_chars = 0

    for para in doc.paragraphs:
        text = para.text.strip()
        if not text:
            continue

        # Detect heading styles
        style_name = (para.style.name or '').lower()
        if style_name.startswith('heading'):
            flush_page()
            current_title = text[:200]
            continue

        current_text.append(text)
        current_chars += len(text)

        if current_chars >= MAX_CHARS:
            flush_page()

    flush_page()

    if not pages:
        pages.append(ExtractedPage(page_number=1, text='(empty document)'))

    return pages
