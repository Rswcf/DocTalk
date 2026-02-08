from .base import ExtractedPage, extract_document
from .docx_extractor import extract_docx
from .pptx_extractor import extract_pptx
from .text_extractor import extract_text
from .xlsx_extractor import extract_xlsx

__all__ = [
    'ExtractedPage', 'extract_document',
    'extract_docx', 'extract_pptx', 'extract_xlsx', 'extract_text',
]
