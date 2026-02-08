from __future__ import annotations

from typing import List

from .base import ExtractedPage


def extract_text(file_bytes: bytes, file_type: str = 'txt') -> List[ExtractedPage]:
    """Extract text from TXT/MD files. Split by paragraph breaks at ~3000 char boundaries.

    For MD files, headings (lines starting with #) become section_titles.
    """
    text = file_bytes.decode('utf-8', errors='replace')

    if not text.strip():
        return [ExtractedPage(page_number=1, text='(empty file)')]

    pages: List[ExtractedPage] = []
    current_text: List[str] = []
    current_title: str | None = None
    current_chars = 0
    page_num = 1
    MAX_CHARS = 3000

    def flush_page():
        nonlocal page_num, current_chars
        if current_text:
            content = '\n'.join(current_text)
            if content.strip():
                pages.append(ExtractedPage(
                    page_number=page_num,
                    text=content,
                    section_title=current_title,
                ))
                page_num += 1
            current_text.clear()
            current_chars = 0

    lines = text.split('\n')
    for line in lines:
        stripped = line.strip()

        # Detect markdown headings
        if file_type == 'md' and stripped.startswith('#'):
            heading = stripped.lstrip('#').strip()
            if heading:
                flush_page()
                current_title = heading[:200]
                continue

        current_text.append(line)
        current_chars += len(line)

        if current_chars >= MAX_CHARS:
            flush_page()

    flush_page()

    if not pages:
        pages.append(ExtractedPage(page_number=1, text=text[:MAX_CHARS]))

    return pages
