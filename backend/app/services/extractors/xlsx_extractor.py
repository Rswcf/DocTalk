from __future__ import annotations

import io
from typing import List

from .base import ExtractedPage


def extract_xlsx(file_bytes: bytes) -> List[ExtractedPage]:
    """Extract text from XLSX files. Each sheet = one page."""
    from openpyxl import load_workbook

    wb = load_workbook(io.BytesIO(file_bytes), read_only=True, data_only=True)
    pages: List[ExtractedPage] = []

    for i, sheet_name in enumerate(wb.sheetnames, start=1):
        ws = wb[sheet_name]
        rows: List[str] = []
        for row in ws.iter_rows(values_only=True):
            cells = [str(cell) if cell is not None else '' for cell in row]
            row_text = '\t'.join(cells).strip()
            if row_text:
                rows.append(row_text)

        text = '\n'.join(rows)
        if text.strip():
            pages.append(ExtractedPage(
                page_number=i,
                text=text,
                section_title=sheet_name,
            ))

    wb.close()

    if not pages:
        pages.append(ExtractedPage(page_number=1, text='(empty spreadsheet)'))

    return pages
