from __future__ import annotations

from dataclasses import dataclass
from typing import List, Optional


@dataclass
class ExtractedPage:
    """A page/section of extracted content from a non-PDF document."""
    page_number: int  # 1-based
    text: str
    section_title: Optional[str] = None
    # Non-PDF documents don't have physical dimensions
    width_pt: Optional[float] = None
    height_pt: Optional[float] = None


def extract_document(file_bytes: bytes, file_type: str) -> List[ExtractedPage]:
    """Route extraction to the appropriate handler based on file_type."""
    if file_type == 'docx':
        from .docx_extractor import extract_docx
        return extract_docx(file_bytes)
    elif file_type == 'pptx':
        from .pptx_extractor import extract_pptx
        return extract_pptx(file_bytes)
    elif file_type == 'xlsx':
        from .xlsx_extractor import extract_xlsx
        return extract_xlsx(file_bytes)
    elif file_type in ('txt', 'md'):
        from .text_extractor import extract_text
        return extract_text(file_bytes, file_type)
    elif file_type == 'url':
        from .text_extractor import extract_text
        return extract_text(file_bytes, 'txt')
    else:
        raise ValueError(f"Unsupported file type: {file_type}")
