"""Tests for ParseService — detect_scanned and OCR interface."""
from __future__ import annotations

import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

# Ensure backend is importable
BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.services.parse_service import BlockInfo, PageInfo, ParseService  # noqa: E402


class TestDetectScanned:
    def setup_method(self):
        self.svc = ParseService()

    def test_empty_pages_is_scanned(self):
        assert self.svc.detect_scanned([]) is True

    def test_pages_with_text_not_scanned(self):
        pages = [
            PageInfo(
                page_number=1,
                width_pt=612,
                height_pt=792,
                rotation=0,
                blocks=[
                    BlockInfo(page=1, text="A" * 100, bbox=(0, 0, 100, 20), font_size=12)
                ],
            )
        ]
        assert self.svc.detect_scanned(pages) is False

    def test_pages_with_little_text_is_scanned(self):
        pages = [
            PageInfo(
                page_number=i,
                width_pt=612,
                height_pt=792,
                rotation=0,
                blocks=[BlockInfo(page=i, text="x", bbox=(0, 0, 10, 10), font_size=12)],
            )
            for i in range(1, 11)
        ]
        assert self.svc.detect_scanned(pages) is True

    def test_mixed_pages_threshold(self):
        """If 30% have text, not scanned (threshold is >70% low-text)."""
        text_pages = [
            PageInfo(
                page_number=i,
                width_pt=612,
                height_pt=792,
                rotation=0,
                blocks=[BlockInfo(page=i, text="A" * 100, bbox=(0, 0, 100, 20), font_size=12)],
            )
            for i in range(1, 4)
        ]
        empty_pages = [
            PageInfo(
                page_number=i,
                width_pt=612,
                height_pt=792,
                rotation=0,
                blocks=[],
            )
            for i in range(4, 11)
        ]
        assert self.svc.detect_scanned(text_pages + empty_pages) is False


class TestExtractPagesOcr:
    """Test that extract_pages_ocr calls PyMuPDF OCR API correctly."""

    def setup_method(self):
        self.svc = ParseService()

    @patch("app.services.parse_service.fitz")
    def test_ocr_calls_get_textpage_ocr(self, mock_fitz):
        # Build mock page
        mock_textpage = MagicMock()
        mock_page = MagicMock()
        mock_page.rect.width = 612
        mock_page.rect.height = 792
        mock_page.rotation = 0
        mock_page.get_textpage_ocr.return_value = mock_textpage
        mock_page.get_text.return_value = {"blocks": []}

        mock_doc = MagicMock()
        mock_doc.__iter__ = MagicMock(return_value=iter([mock_page]))
        mock_fitz.open.return_value = mock_doc

        pages = self.svc.extract_pages_ocr(b"fake-pdf", languages="eng", dpi=150)

        mock_page.get_textpage_ocr.assert_called_once_with(language="eng", dpi=150, full=True)
        mock_page.get_text.assert_called_once_with("dict", textpage=mock_textpage)
        assert len(pages) == 1
        assert pages[0].page_number == 1

    @patch("app.services.parse_service.fitz")
    def test_ocr_skips_failed_page(self, mock_fitz):
        mock_page = MagicMock()
        mock_page.get_textpage_ocr.side_effect = RuntimeError("tesseract not found")

        mock_doc = MagicMock()
        mock_doc.__iter__ = MagicMock(return_value=iter([mock_page]))
        mock_fitz.open.return_value = mock_doc

        pages = self.svc.extract_pages_ocr(b"fake-pdf")
        assert len(pages) == 0  # page was skipped, no crash

    @patch("app.services.parse_service.fitz")
    def test_ocr_caps_dpi_for_large_pages(self, mock_fitz):
        """A very tall page (e.g. 640 inches) should get reduced DPI to stay under 20MP."""
        mock_textpage = MagicMock()
        mock_page = MagicMock()
        # 612pt wide x 46080pt tall (=640 inches tall)
        mock_page.rect.width = 612
        mock_page.rect.height = 46080
        mock_page.rotation = 0
        mock_page.get_textpage_ocr.return_value = mock_textpage
        mock_page.get_text.return_value = {"blocks": []}

        mock_doc = MagicMock()
        mock_doc.__iter__ = MagicMock(return_value=iter([mock_page]))
        mock_fitz.open.return_value = mock_doc

        self.svc.extract_pages_ocr(b"fake-pdf", dpi=300)

        # At 300 DPI: 612/72*300=2550 x 46080/72*300=192000 = 489M pixels >> 20M
        # Should have been reduced to minimum 72 DPI
        actual_dpi = mock_page.get_textpage_ocr.call_args[1]["dpi"]
        assert actual_dpi < 300, f"DPI should be reduced but was {actual_dpi}"
        assert actual_dpi >= 72, "DPI should not go below 72"
