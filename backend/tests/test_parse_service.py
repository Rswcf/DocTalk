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


class TestChunkDocumentIntegrity:
    def setup_method(self):
        self.svc = ParseService()
        self.svc.TARGET_MIN_TOKENS = 1
        self.svc.TARGET_MAX_TOKENS = 120
        self.svc.OVERLAP_TOKENS = 0

    def test_two_column_page_reads_left_column_before_right_column(self):
        page = PageInfo(
            page_number=1,
            width_pt=600,
            height_pt=800,
            rotation=0,
            blocks=[
                BlockInfo(page=1, text="Report Title", bbox=(50, 20, 550, 48), font_size=18),
                BlockInfo(page=1, text="Left one sentence.", bbox=(50, 100, 250, 116), font_size=10),
                BlockInfo(page=1, text="Right one sentence.", bbox=(330, 100, 550, 116), font_size=10),
                BlockInfo(page=1, text="Left two sentence.", bbox=(50, 130, 250, 146), font_size=10),
                BlockInfo(page=1, text="Right two sentence.", bbox=(330, 130, 550, 146), font_size=10),
                BlockInfo(page=1, text="Left three sentence.", bbox=(50, 160, 250, 176), font_size=10),
                BlockInfo(page=1, text="Right three sentence.", bbox=(330, 160, 550, 176), font_size=10),
                BlockInfo(page=1, text="Left four sentence.", bbox=(50, 190, 250, 206), font_size=10),
                BlockInfo(page=1, text="Right four sentence.", bbox=(330, 190, 550, 206), font_size=10),
            ],
        )

        chunks = self.svc.chunk_document([page])
        text = " ".join(chunk.text for chunk in chunks)

        assert text.index("Left one") < text.index("Left four")
        assert text.index("Left four") < text.index("Right one")
        assert chunks[0].section_title == "Report Title"

    def test_two_column_page_keeps_midpage_full_width_block_in_position(self):
        page = PageInfo(
            page_number=1,
            width_pt=600,
            height_pt=800,
            rotation=0,
            blocks=[
                BlockInfo(page=1, text="Report Title", bbox=(50, 20, 550, 48), font_size=18),
                BlockInfo(page=1, text="Left intro one.", bbox=(50, 90, 250, 106), font_size=10),
                BlockInfo(page=1, text="Right intro one.", bbox=(330, 90, 550, 106), font_size=10),
                BlockInfo(page=1, text="Left intro two.", bbox=(50, 120, 250, 136), font_size=10),
                BlockInfo(page=1, text="Right intro two.", bbox=(330, 120, 550, 136), font_size=10),
                BlockInfo(page=1, text="Middle Section", bbox=(50, 160, 550, 186), font_size=17),
                BlockInfo(page=1, text="Left tight after heading.", bbox=(50, 170, 250, 186), font_size=10),
                BlockInfo(page=1, text="Left detail one.", bbox=(50, 220, 250, 236), font_size=10),
                BlockInfo(page=1, text="Right detail one.", bbox=(330, 220, 550, 236), font_size=10),
                BlockInfo(page=1, text="Left detail two.", bbox=(50, 250, 250, 266), font_size=10),
                BlockInfo(page=1, text="Right detail two.", bbox=(330, 250, 550, 266), font_size=10),
            ],
        )

        cleaned = self.svc.clean_text_blocks(page.blocks, page.width_pt, page.height_pt)
        ordered_text = [
            block.text
            for block in self.svc._order_blocks_for_reading(cleaned, page.width_pt, page.height_pt)
        ]

        assert ordered_text.index("Right intro two.") < ordered_text.index("Middle Section")
        assert ordered_text.index("Middle Section") < ordered_text.index("Left tight after heading.")
        assert ordered_text.index("Left tight after heading.") < ordered_text.index("Left detail one.")

    def test_english_sentence_joining_keeps_word_boundary(self):
        page = PageInfo(
            page_number=1,
            width_pt=600,
            height_pt=800,
            rotation=0,
            blocks=[
                BlockInfo(page=1, text="Executive Summary", bbox=(50, 50, 300, 70), font_size=18),
                BlockInfo(page=1, text="Alpha ends here.", bbox=(50, 100, 350, 116), font_size=10),
                BlockInfo(page=1, text="Beta starts here.", bbox=(50, 130, 350, 146), font_size=10),
            ],
        )

        chunks = self.svc.chunk_document([page])

        assert chunks[0].text == "Alpha ends here. Beta starts here."
        assert chunks[0].section_title == "Executive Summary"

    def test_title_case_body_line_is_not_dropped_as_heading(self):
        page = PageInfo(
            page_number=1,
            width_pt=600,
            height_pt=800,
            rotation=0,
            blocks=[
                BlockInfo(page=1, text="Revenue Analysis", bbox=(50, 50, 300, 70), font_size=18),
                BlockInfo(page=1, text="Revenue Increased In Europe", bbox=(50, 100, 350, 116), font_size=10),
                BlockInfo(page=1, text="This sentence explains the reported result.", bbox=(50, 130, 400, 146), font_size=10),
            ],
        )

        text = " ".join(chunk.text for chunk in self.svc.chunk_document([page]))

        assert "Revenue Increased In Europe" in text

    def test_short_document_keeps_micro_chunk(self):
        page = PageInfo(
            page_number=1,
            width_pt=600,
            height_pt=800,
            rotation=0,
            blocks=[BlockInfo(page=1, text="Tiny note.", bbox=(50, 50, 180, 66), font_size=10)],
        )

        chunks = self.svc.chunk_document([page])

        assert len(chunks) == 1
        assert chunks[0].text == "Tiny note."

    def test_cjk_punctuation_joining_avoids_extra_space(self):
        page = PageInfo(
            page_number=1,
            width_pt=600,
            height_pt=800,
            rotation=0,
            blocks=[
                BlockInfo(page=1, text="摘要", bbox=(50, 50, 120, 70), font_size=18),
                BlockInfo(page=1, text="这是第一句", bbox=(50, 100, 180, 116), font_size=10),
                BlockInfo(page=1, text="，继续说明。", bbox=(180, 100, 320, 116), font_size=10),
            ],
        )

        chunks = self.svc.chunk_document([page])

        assert chunks[0].text == "这是第一句，继续说明。"
