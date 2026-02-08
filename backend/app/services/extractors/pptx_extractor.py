from __future__ import annotations

import io
from typing import List

from .base import ExtractedPage


def extract_pptx(file_bytes: bytes) -> List[ExtractedPage]:
    """Extract text from PPTX files. Each slide = one page."""
    from pptx import Presentation

    prs = Presentation(io.BytesIO(file_bytes))
    pages: List[ExtractedPage] = []

    for i, slide in enumerate(prs.slides, start=1):
        texts: List[str] = []
        title = None

        for shape in slide.shapes:
            if shape.has_text_frame:
                shape_text = shape.text_frame.text.strip()
                if shape_text:
                    texts.append(shape_text)
            if hasattr(shape, 'text') and shape == slide.shapes.title:
                title = shape.text.strip()[:200] if shape.text else None

            # Handle tables in slides
            if shape.has_table:
                table = shape.table
                for row in table.rows:
                    row_texts = [cell.text.strip() for cell in row.cells if cell.text.strip()]
                    if row_texts:
                        texts.append('\t'.join(row_texts))

        text = '\n'.join(texts)
        if text.strip():
            pages.append(ExtractedPage(
                page_number=i,
                text=text,
                section_title=title,
            ))

    if not pages:
        pages.append(ExtractedPage(page_number=1, text='(empty presentation)'))

    return pages
