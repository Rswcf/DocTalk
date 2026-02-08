from __future__ import annotations

import io
from typing import List

from .base import ExtractedPage


def _table_to_markdown(table) -> str:
    """Convert a python-docx Table to a markdown table string."""
    rows: List[List[str]] = []
    for row in table.rows:
        cells = [cell.text.strip().replace('\n', ' ') for cell in row.cells]
        rows.append(cells)

    if not rows:
        return ''

    # Build markdown table
    lines: List[str] = []
    # Header row
    lines.append('| ' + ' | '.join(rows[0]) + ' |')
    # Separator
    lines.append('| ' + ' | '.join('---' for _ in rows[0]) + ' |')
    # Data rows
    for row in rows[1:]:
        # Pad row to match header length
        while len(row) < len(rows[0]):
            row.append('')
        lines.append('| ' + ' | '.join(row[:len(rows[0])]) + ' |')

    return '\n'.join(lines)


def extract_docx(file_bytes: bytes) -> List[ExtractedPage]:
    """Extract text from DOCX files using python-docx.

    Iterates document body elements to properly interleave paragraphs and tables.
    Detects Heading styles as section boundaries. Splits at ~3000 chars per page.
    Tables are formatted as markdown tables.
    """
    from docx import Document
    from docx.oxml.ns import qn

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

    # Build a lookup of table elements for quick access
    table_map = {}
    for table in doc.tables:
        table_map[id(table._tbl)] = table

    # Iterate body elements in document order (paragraphs + tables interleaved)
    for element in doc.element.body:
        tag = element.tag

        if tag == qn('w:p'):
            # Paragraph element
            from docx.text.paragraph import Paragraph
            para = Paragraph(element, doc)
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

        elif tag == qn('w:tbl'):
            # Table element
            table = table_map.get(id(element))
            if table:
                md_table = _table_to_markdown(table)
                if md_table:
                    current_text.append('')  # blank line before table
                    current_text.append(md_table)
                    current_text.append('')  # blank line after table
                    current_chars += len(md_table)

                    if current_chars >= MAX_CHARS:
                        flush_page()

    flush_page()

    if not pages:
        pages.append(ExtractedPage(page_number=1, text='(empty document)'))

    return pages
