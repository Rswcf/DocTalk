"""Tests for ParseService — detect_scanned and OCR interface."""
from __future__ import annotations

import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

# Ensure backend is importable
BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.services.parse_service import (  # noqa: E402
    BlockInfo,
    CleanBlock,
    PageInfo,
    ParseService,
)


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
        # get_text is called twice on the SAME textpage: once for the block
        # dict (chunking geometry), once for raw linear text (B1 — feeds
        # Page.content). No second document/page open.
        mock_page.get_text.assert_any_call("dict", textpage=mock_textpage)
        mock_page.get_text.assert_any_call("text", textpage=mock_textpage)
        assert mock_page.get_text.call_count == 2
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

    def test_extract_elements_keeps_heading_and_paragraph_order(self):
        page = PageInfo(
            page_number=1,
            width_pt=600,
            height_pt=800,
            rotation=0,
            blocks=[
                BlockInfo(page=1, text="Executive Summary", bbox=(50, 50, 300, 70), font_size=18),
                BlockInfo(page=1, text="First material paragraph.", bbox=(50, 100, 350, 116), font_size=10),
                BlockInfo(page=1, text="Second material paragraph.", bbox=(50, 130, 350, 146), font_size=10),
            ],
        )

        elements = self.svc.extract_elements([page])

        assert [element.element_type for element in elements] == ["heading", "paragraph", "paragraph"]
        assert [element.reading_order for element in elements] == [10000, 10001, 10002]
        assert elements[1].metadata_json["section_title"] == "Executive Summary"
        assert elements[0].bbox["page"] == 1

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


ATTENTION_SEED_PDF = BACKEND_DIR / "seed_data" / "attention-paper.pdf"
ARXIV_STAMP = "arXiv:1706.03762v7"


def _vertical_writing_pdf() -> bytes:
    """One-page PDF with a genuine vertical-writing (tategaki) line in the right
    margin band — a Type0 font on the predefined UniJIS-UTF16-V CMap, which
    PyMuPDF reports as wmode=1 — and a rotated horizontal arXiv stamp (wmode=0)
    in the left margin."""
    content = (
        b"BT /F1 14 Tf 1 0 0 1 560 700 Tm <65E5672C8A9E306E7E2667F8304D3002> Tj ET\n"
        b"BT /F2 20 Tf 0 1 -1 0 30 200 Tm (arXiv:1706.03762v7 [cs.CL] 2 Aug 2023) Tj ET\n"
    )
    objs = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] "
        b"/Resources << /Font << /F1 4 0 R /F2 7 0 R >> >> /Contents 6 0 R >>",
        b"<< /Type /Font /Subtype /Type0 /BaseFont /KozMinPr6N-Regular "
        b"/Encoding /UniJIS-UTF16-V /DescendantFonts [5 0 R] >>",
        b"<< /Type /Font /Subtype /CIDFontType0 /BaseFont /KozMinPr6N-Regular "
        b"/CIDSystemInfo << /Registry (Adobe) /Ordering (Japan1) /Supplement 6 >> /FontDescriptor 8 0 R >>",
        b"<< /Length %d >>\nstream\n" % len(content) + content + b"endstream",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
        b"<< /Type /FontDescriptor /FontName /KozMinPr6N-Regular /Flags 4 /FontBBox [0 -120 1000 880] "
        b"/ItalicAngle 0 /Ascent 880 /Descent -120 /CapHeight 700 /StemV 80 >>",
    ]
    pdf = b"%PDF-1.7\n"
    offsets = []
    for i, obj in enumerate(objs, 1):
        offsets.append(len(pdf))
        pdf += b"%d 0 obj\n" % i + obj + b"\nendobj\n"
    xref = len(pdf)
    pdf += b"xref\n0 %d\n0000000000 65535 f \n" % (len(objs) + 1)
    for off in offsets:
        pdf += b"%010d 00000 n \n" % off
    pdf += b"trailer\n<< /Size %d /Root 1 0 R >>\nstartxref\n%d\n%%%%EOF\n" % (len(objs) + 1, xref)
    return pdf


class TestMarginStampIsNotContent:
    """arXiv prints a vertical stamp ("arXiv:1706.03762v7 [cs.CL] 2 Aug 2023")
    in the left margin of page 1. At 20pt it passed the heading font-size test,
    became the section title of every following chunk, and so prefixed every
    citation snippet of the production demo doc (2026-10-10)."""

    def setup_method(self):
        self.svc = ParseService()

    def test_seed_pdf_stamp_is_neither_section_title_nor_chunk_text(self):
        pages = self.svc.extract_pages(ATTENTION_SEED_PDF.read_bytes())

        chunks = self.svc.chunk_document(pages)

        assert chunks
        assert not any(ARXIV_STAMP in (c.section_title or "") for c in chunks)
        assert not any(ARXIV_STAMP in c.text for c in chunks)
        # The stamp's bbox (x≈11–38pt of 612) must not reach the highlights.
        assert all(b["x"] >= 0.1 for c in chunks for b in c.bboxes if b["page"] == 1)
        # The page-1 title (17pt) is now the heading the stamp used to shadow.
        page_one_titles = {c.section_title for c in chunks if c.page_start == 1 and c.section_title}
        assert page_one_titles == {"Attention Is All You Need"}

    def test_seed_pdf_stamp_is_not_a_heading_element(self):
        pages = self.svc.extract_pages(ATTENTION_SEED_PDF.read_bytes())

        elements = self.svc.extract_elements(pages)

        assert not any(ARXIV_STAMP in e.text for e in elements)
        assert not any(
            ARXIV_STAMP in (e.metadata_json.get("section_title") or "") for e in elements
        )

    def test_extract_pages_records_line_direction(self):
        pages = self.svc.extract_pages(ATTENTION_SEED_PDF.read_bytes())

        stamp = [b for b in pages[0].blocks if b.text.startswith(ARXIV_STAMP)]

        assert len(stamp) == 1
        assert stamp[0].direction == (0.0, -1.0)
        assert all(b.direction == (1.0, 0.0) for b in pages[0].blocks if b is not stamp[0])

    def test_line_without_direction_defaults_to_horizontal(self):
        lines = [{"bbox": (50, 50, 300, 62), "spans": [{"text": "Plain line", "size": 10}]}]

        blocks = self.svc._extract_line_blocks(1, lines)

        assert blocks[0].direction == (1.0, 0.0)

    def test_rotated_text_inside_the_body_stays_content_but_is_not_a_heading(self):
        # A rotated table label mid-page: real content, never a section title.
        page = PageInfo(
            page_number=1,
            width_pt=600,
            height_pt=800,
            rotation=0,
            blocks=[
                BlockInfo(page=1, text="Results", bbox=(50, 50, 300, 70), font_size=18),
                BlockInfo(page=1, text="First body sentence here.", bbox=(50, 100, 450, 116), font_size=10),
                BlockInfo(
                    page=1, text="QUARTERLY TOTALS", bbox=(280, 130, 296, 260),
                    font_size=18, direction=(0.0, -1.0),
                ),
                BlockInfo(page=1, text="Second body sentence here.", bbox=(50, 300, 450, 316), font_size=10),
            ],
        )

        chunks = self.svc.chunk_document([page])

        assert "QUARTERLY TOTALS" in " ".join(c.text for c in chunks)
        assert {c.section_title for c in chunks} == {"Results"}

    def test_vertical_writing_page_keeps_its_headings(self):
        # Tategaki: every line runs top-to-bottom, so vertical is the page's
        # own direction, not a margin artifact. Nothing may be dropped.
        down = (0.0, 1.0)
        page = PageInfo(
            page_number=1,
            width_pt=600,
            height_pt=800,
            rotation=0,
            blocks=[
                BlockInfo(page=1, text="第一章", bbox=(540, 40, 560, 180), font_size=18, direction=down),
                BlockInfo(page=1, text="本文の一行目です。", bbox=(500, 60, 512, 400), font_size=10, direction=down),
                BlockInfo(page=1, text="本文の二行目です。", bbox=(480, 60, 492, 400), font_size=10, direction=down),
                BlockInfo(page=1, text="余白の注記です。", bbox=(20, 60, 32, 400), font_size=10, direction=down),
            ],
        )

        chunks = self.svc.chunk_document([page])
        text = "".join(c.text for c in chunks)

        assert chunks[0].section_title == "第一章"
        assert "本文の一行目です。" in text
        assert "余白の注記です。" in text

    def test_horizontal_text_in_the_margin_is_kept(self):
        # Pleading-paper line numbers and non-PDF extractor blocks sit at
        # x≈0 but run with the page: only OFF-axis margin text is dropped.
        page = PageInfo(
            page_number=1,
            width_pt=612,
            height_pt=792,
            rotation=0,
            blocks=[
                BlockInfo(page=1, text="Margin note text.", bbox=(5, 100, 40, 112), font_size=10),
                BlockInfo(page=1, text="Body sentence one.", bbox=(80, 100, 500, 112), font_size=10),
            ],
        )

        chunks = self.svc.chunk_document([page])

        assert "Margin note text." in chunks[0].text

    def test_long_margin_stamp_cannot_outvote_sparse_body_text(self):
        # Codex r1: on a figure page with one caption line, a long vertical
        # licence stamp has more characters than the body. Margin-band lines
        # must not vote on the page direction while the interior has text.
        stamp = "For the exclusive use of a licensee. " * 6
        page = PageInfo(
            page_number=1,
            width_pt=612,
            height_pt=792,
            rotation=0,
            blocks=[
                BlockInfo(page=1, text="Results", bbox=(80, 60, 300, 80), font_size=18),
                BlockInfo(page=1, text="Figure 2: Sparse caption.", bbox=(80, 600, 400, 612), font_size=10),
                BlockInfo(page=1, text="Second caption line.", bbox=(80, 620, 400, 632), font_size=10),
                BlockInfo(page=1, text=stamp, bbox=(8, 100, 18, 700), font_size=10, direction=(0.0, -1.0)),
            ],
        )

        cleaned = self.svc.clean_text_blocks(page.blocks, page.width_pt, page.height_pt)
        chunks = self.svc.chunk_document([page])

        assert [b.text for b in cleaned] == ["Results", "Figure 2: Sparse caption.", "Second caption line."]
        assert not any(b.off_axis for b in cleaned)
        assert chunks[0].section_title == "Results"

    def test_image_only_page_uses_the_document_direction(self):
        # A full-page figure inside a horizontal paper: the page has no text
        # outside the margin band, so it takes the document's direction and
        # its vertical stamp is still dropped.
        body = PageInfo(
            page_number=1,
            width_pt=612,
            height_pt=792,
            rotation=0,
            blocks=[BlockInfo(page=1, text="Body sentence on page one.", bbox=(80, 100, 500, 112), font_size=10)],
        )
        figure = PageInfo(
            page_number=2,
            width_pt=612,
            height_pt=792,
            rotation=0,
            blocks=[
                BlockInfo(
                    page=2, text="For the exclusive use of a licensee. " * 3, bbox=(8, 100, 18, 700),
                    font_size=10, direction=(0.0, -1.0),
                ),
                BlockInfo(page=2, text="7", bbox=(300, 740, 306, 752), font_size=10),
            ],
        )

        text = " ".join(c.text for c in self.svc.chunk_document([body, figure]))

        assert "exclusive use" not in text
        assert "7" in text

    def test_vertical_writing_text_inside_the_margin_band_is_kept(self):
        # Codex r2: a tategaki page whose only lines sit in the outer band
        # (the last lines of a chapter) must not be emptied by a
        # left-to-right fallback.
        down = (0.0, 1.0)
        body = PageInfo(
            page_number=1,
            width_pt=600,
            height_pt=800,
            rotation=0,
            blocks=[
                BlockInfo(page=1, text="本文の一行目です。", bbox=(500, 90, 512, 700), font_size=10, direction=down),
                BlockInfo(page=1, text="本文の二行目です。", bbox=(480, 90, 492, 700), font_size=10, direction=down),
            ],
        )
        tail = PageInfo(
            page_number=2,
            width_pt=600,
            height_pt=800,
            rotation=0,
            blocks=[
                BlockInfo(page=2, text="最後の一行です。", bbox=(560, 90, 572, 700), font_size=10, direction=down),
                BlockInfo(page=2, text="最後の二行目です。", bbox=(545, 90, 557, 700), font_size=10, direction=down),
            ],
        )

        single = "".join(c.text for c in self.svc.chunk_document([tail]))
        both = "".join(c.text for c in self.svc.chunk_document([body, tail]))

        assert "最後の一行です。" in single and "最後の二行目です。" in single
        assert "最後の一行です。" in both and "本文の一行目です。" in both

    def test_real_vertical_writing_in_the_margin_band_is_kept(self):
        # Codex r3, on real PDF bytes: a tategaki line inside the right band
        # (x≈553 of 612) is body text (wmode=1); the rotated arXiv stamp
        # (wmode=0) next to it is still dropped.
        pages = self.svc.extract_pages(_vertical_writing_pdf())

        assert {b.vertical_writing for b in pages[0].blocks if b.text.startswith("arXiv")} == {False}
        assert {b.vertical_writing for b in pages[0].blocks if not b.text.startswith("arXiv")} == {True}
        text = "".join(c.text for c in self.svc.chunk_document(pages))
        # MuPDF extracts this hand-built font one glyph per line and skips 書.
        assert "日本語の縦" in text
        assert "arXiv" not in text

    def test_vertical_writing_page_in_the_band_survives_a_horizontal_document(self):
        # Codex r3 probe: page 1 is horizontal, page 2 is tategaki whose only
        # lines sit in the right band; the document fallback says horizontal.
        down = (0.0, 1.0)
        body = PageInfo(
            page_number=1,
            width_pt=600,
            height_pt=800,
            rotation=0,
            blocks=[BlockInfo(page=1, text="Horizontal body sentence.", bbox=(80, 100, 500, 112), font_size=10)],
        )
        tail = PageInfo(
            page_number=2,
            width_pt=600,
            height_pt=800,
            rotation=0,
            blocks=[
                BlockInfo(page=2, text="最後の一行です。", bbox=(560, 90, 572, 700), font_size=10,
                          direction=down, vertical_writing=True),
                BlockInfo(page=2, text="最後の二行目です。", bbox=(545, 90, 557, 700), font_size=10,
                          direction=down, vertical_writing=True),
            ],
        )

        text = "".join(c.text for c in self.svc.chunk_document([body, tail]))

        assert "最後の一行です。" in text and "最後の二行目です。" in text

    def test_arxiv_stamp_without_direction_in_the_margin_is_dropped(self):
        # Codex r2: OCR can lose the stamp's direction; the identifier regex
        # still drops it when it lies in the margin band.
        page = PageInfo(
            page_number=1,
            width_pt=612,
            height_pt=792,
            rotation=0,
            blocks=[
                BlockInfo(page=1, text="arXiv:2101.00001v2 [cs.LG] 5 Jan 2021", bbox=(8, 200, 40, 560), font_size=20),
                BlockInfo(page=1, text="Body sentence one.", bbox=(80, 100, 500, 112), font_size=10),
                BlockInfo(page=1, text="See arXiv:2101.00001 for details.", bbox=(80, 130, 500, 142), font_size=10),
            ],
        )

        text = " ".join(c.text for c in self.svc.chunk_document([page]))

        assert "[cs.LG]" not in text
        assert "See arXiv:2101.00001 for details." in text

    def test_margin_band_uses_unrotated_page_size(self):
        # /Rotate 90: PageInfo carries the rotated rect (792 x 612) while line
        # bboxes stay in unrotated space (612 x 792). y0=600 is mid-page there,
        # so this rotated chart label is content, not a bottom-margin artifact.
        page = PageInfo(
            page_number=1,
            width_pt=792,
            height_pt=612,
            rotation=90,
            blocks=[
                BlockInfo(page=1, text="Body sentence one.", bbox=(80, 100, 500, 112), font_size=10),
                BlockInfo(
                    page=1, text="Axis label", bbox=(300, 600, 310, 650),
                    font_size=10, direction=(0.0, -1.0),
                ),
            ],
        )

        cleaned = self.svc.clean_text_blocks(
            page.blocks, page.width_pt, page.height_pt, rotation=page.rotation
        )

        assert [b.text for b in cleaned] == ["Body sentence one.", "Axis label"]
        assert cleaned[1].off_axis is True

    def test_arxiv_identifier_line_is_never_a_heading(self):
        # Regex guard for a stamp whose direction was lost (e.g. OCR output).
        page = PageInfo(
            page_number=1,
            width_pt=600,
            height_pt=800,
            rotation=0,
            blocks=[
                BlockInfo(page=1, text="Introduction", bbox=(50, 50, 300, 70), font_size=18),
                BlockInfo(page=1, text="arXiv:2101.00001v2 [cs.LG] 5 Jan 2021", bbox=(50, 90, 400, 110), font_size=20),
                BlockInfo(page=1, text="Body sentence follows here.", bbox=(50, 130, 450, 146), font_size=10),
                BlockInfo(page=1, text="Another body sentence here.", bbox=(50, 160, 450, 176), font_size=10),
                BlockInfo(page=1, text="A third body sentence here.", bbox=(50, 190, 450, 206), font_size=10),
            ],
        )

        chunks = self.svc.chunk_document([page])

        assert {c.section_title for c in chunks} == {"Introduction"}


SEED_DIR = BACKEND_DIR / "seed_data"


def _page(number: int, blocks: list[BlockInfo], width: float = 612, height: float = 792) -> PageInfo:
    return PageInfo(page_number=number, width_pt=width, height_pt=height, rotation=0, blocks=blocks)


def _body_lines(
    page: int, x: float, y0: float, n: int, size: float = 10.0, width: float = 330,
    text: str = "Body line of running text that wraps",
) -> list[BlockInfo]:
    """n stacked lines of one paragraph at 1.25x leading."""
    return [
        BlockInfo(page=page, text=f"{text} {i}", bbox=(x, y0 + i * size * 1.25, x + width, y0 + i * size * 1.25 + size * 1.15),
                  font_size=size)
        for i in range(n)
    ]


def _cells(page: int, y0: float, rows: int, cols: int = 6, size: float = 6.5) -> list[BlockInfo]:
    """A table or chart: short small-type lines side by side."""
    return [
        BlockInfo(page=page, text=f"{r}.{c}", bbox=(40 + c * 60, y0 + r * 9, 70 + c * 60, y0 + r * 9 + 7), font_size=size)
        for r in range(rows)
        for c in range(cols)
    ]


class TestHeadingSizeUsesPageBodySize:
    """Parse v5 (2026-10-11, .collab/plans/2026-10-11-parse-heading-body-size.md).

    The size rule compared each line with 1.25 x the median size of ALL lines of the
    document. Chart labels and table cells are short small-type lines, so in broker
    research they outnumber body lines and pulled the median under the body (5.47pt
    against 10pt): every body line became a heading, was dropped from chunk text and
    became the section title of citation snippets (41-80% of the text of nine
    research notes). The reference is now the page's body size from running text.
    """

    def setup_method(self):
        self.svc = ParseService()

    def _headings(self, pages: list[PageInfo]) -> set[tuple[int, str]]:
        return {(e.page_start, e.text) for e in self.svc.extract_elements(pages) if e.element_type == "heading"}

    def test_chart_heavy_page_body_is_not_a_heading(self):
        blocks = [BlockInfo(page=1, text="Section heading", bbox=(40, 60, 300, 76), font_size=14)]
        blocks += _body_lines(1, 40, 90, 8) + _cells(1, 400, 12)  # line median 6.5pt
        page = _page(1, blocks)

        assert self._headings([page]) == {(1, "Section heading")}
        chunk_text = " ".join(c.text for c in self.svc.chunk_document([page]))
        assert all(f"Body line of running text that wraps {i}" in chunk_text for i in range(8))

    def test_two_body_sizes_keep_main_body_and_find_appendix_headings(self):
        # 10pt report, then a longer 7pt disclosure appendix: neither the line
        # median nor a char-weighted median is the body size of both parts.
        pages = [
            _page(pn, [BlockInfo(page=pn, text=f"Main heading {pn}", bbox=(40, 60, 300, 76), font_size=14)]
                  + _body_lines(pn, 40, 90, 20))
            for pn in (1, 2)
        ]
        pages += [
            _page(pn, [BlockInfo(page=pn, text=f"Appendix heading {pn}", bbox=(40, 60, 300, 72), font_size=10)]
                  + _body_lines(pn, 40, 90, 60, size=7, width=500, text="Disclosure text"))
            for pn in (3, 4, 5)
        ]

        assert self._headings(pages) == {
            (1, "Main heading 1"), (2, "Main heading 2"),
            (3, "Appendix heading 3"), (4, "Appendix heading 4"), (5, "Appendix heading 5"),
        }
        chunks = self.svc.chunk_document(pages)
        assert {c.section_title for c in chunks if c.page_start >= 3} <= {
            "Main heading 2", "Appendix heading 3", "Appendix heading 4", "Appendix heading 5",
        }
        assert any(c.section_title == "Appendix heading 5" for c in chunks)

    def test_chart_page_short_comment_uses_document_body_size(self):
        # A chart page has too little running text for a body size of its own, so
        # it takes the document's: the largest page body size that at least a
        # quarter of the pages share (10pt here, not the 7pt of the longer appendix).
        pages = [
            _page(pn, [BlockInfo(page=pn, text=f"Heading {pn}", bbox=(40, 60, 300, 76), font_size=14)]
                  + _body_lines(pn, 40, 90, 20))
            for pn in (1, 2)
        ]
        pages += [_page(pn, _body_lines(pn, 40, 90, 60, size=7, width=500, text="Disclosure text")) for pn in (3, 4, 5)]
        pages.append(_page(6, _cells(6, 100, 30) + _body_lines(6, 40, 500, 2, text="Short comment on the chart")))

        assert self._headings(pages) == {(1, "Heading 1"), (2, "Heading 2")}

    def test_page_body_size_is_the_largest_substantial_size(self):
        # 12pt body set as two-line paragraphs beside a longer 9pt footnote block:
        # both hold 30%+ of the page's running text and the larger one is the body.
        blocks, y = [], 60
        for i in range(6):
            blocks += _body_lines(1, 40, y, 2, size=12, width=480, text=f"Short paragraph {i} of the main text")
            y += 50
        blocks += _body_lines(1, 40, 400, 20, size=9, width=480, text="Footnote text in a smaller size")

        assert self._headings([_page(1, blocks)]) == set()

    def test_slides_wrapped_bullets_are_body(self):
        pages = []
        for pn in (1, 2, 3):
            blocks = [BlockInfo(page=pn, text=f"Slide title {pn}", bbox=(50, 60, 500, 92), font_size=28)]
            y = 120
            for b in range(3):
                for ln in range(2):
                    blocks.append(BlockInfo(page=pn, text=f"Bullet {b} line {ln} of wrapped slide text",
                                            bbox=(70, y, 600, y + 20), font_size=18))
                    y += 23
                blocks.append(BlockInfo(page=pn, text=f"Sub bullet {b} with more detail", bbox=(100, y, 500, y + 16), font_size=14))
                y += 24
            pages.append(_page(pn, blocks, width=792, height=612))

        assert self._headings(pages) == {(1, "Slide title 1"), (2, "Slide title 2"), (3, "Slide title 3")}

    def test_superscript_does_not_hide_a_heading(self):
        # Spans of 14pt "Results and discussion" + an 8pt footnote marker: the
        # plain span mean is 11pt, the dominant size is 14pt.
        blocks = [BlockInfo(page=1, text="Results and discussion1", bbox=(40, 60, 300, 76), font_size=11.0, dominant_size=14.0)]
        blocks += _body_lines(1, 40, 90, 10)

        assert self._headings([_page(1, blocks)]) == {(1, "Results and discussion1")}

    def test_extract_line_blocks_records_dominant_size(self):
        lines = [{
            "bbox": (50, 50, 300, 66),
            "spans": [{"text": "Results", "size": 14.0}, {"text": "1", "size": 8.0}, {"text": " ", "size": 6.0}],
        }]

        block = self.svc._extract_line_blocks(1, lines)[0]

        assert block.dominant_size == 14.0
        assert block.font_size == (14.0 + 8.0 + 6.0) / 3  # persisted metadata is unchanged

    def test_dominant_size_does_not_reach_element_metadata(self):
        blocks = [BlockInfo(page=1, text="Results and discussion1", bbox=(40, 60, 300, 76), font_size=11.0, dominant_size=14.0)]
        blocks += _body_lines(1, 40, 90, 10)

        heading = next(e for e in self.svc.extract_elements([_page(1, blocks)]) if e.element_type == "heading")

        assert heading.metadata_json["font_size"] == 11.0

    def test_wrapped_heading_up_to_three_lines(self):
        title = ["Why the memory upcycle has further to run:", "pricing, capacity discipline and", "the HBM transition"]
        blocks, y = [], 60
        for line in title:
            blocks.append(BlockInfo(page=1, text=line, bbox=(50, y, 400, y + 21), font_size=18))
            y += 23
        y += 10
        for i in range(4):  # a 4-line standfirst set larger than the body is a paragraph
            blocks.append(BlockInfo(page=1, text=f"Standfirst line {i} set larger than the body",
                                    bbox=(50, y, 400, y + 16), font_size=14))
            y += 18
        blocks += _body_lines(1, 50, y + 10, 12)

        assert {text for _p, text in self._headings([_page(1, blocks)])} == set(title)

    def test_one_line_bullets_are_body(self):
        blocks = [BlockInfo(page=1, text="Heading", bbox=(40, 60, 300, 80), font_size=16)] + _body_lines(1, 40, 90, 10)
        y = 250
        for i in range(3):
            blocks.append(BlockInfo(page=1, text=f"• Key point number {i} stated in one line",
                                    bbox=(40, y, 330, y + 14), font_size=12))
            y += 16

        assert self._headings([_page(1, blocks)]) == {(1, "Heading")}

    def test_non_pdf_extractor_path_keeps_section_titles(self):
        # parse_worker's DOCX/PPTX/XLSX/TXT branch: unit-box bboxes, an 18pt title
        # line and one 12pt block per page. Never running text -> median fallback.
        pages = []
        for pn in range(1, 6):
            blocks = []
            if pn in (1, 3):
                blocks.append(BlockInfo(page=pn, text=f"Section {pn}", bbox=(0.0, 0.0, 1.0, 0.08), font_size=18.0))
            blocks.append(BlockInfo(page=pn, text=f"Body text of page {pn}. " * 30, bbox=(0.0, 0.1, 1.0, 1.0), font_size=12.0))
            pages.append(_page(pn, blocks))

        assert self._headings(pages) == {(1, "Section 1"), (3, "Section 3")}

    def test_vertical_writing_runs_follow_the_reading_axis(self):
        down = (0.0, 1.0)
        blocks = [BlockInfo(page=1, text="縦書きの見出し", bbox=(500, 60, 516, 200), font_size=14,
                            direction=down, vertical_writing=True)]
        for i in range(12):
            x = 470 - i * 14
            blocks.append(BlockInfo(page=1, text="本文の行です本文の行です本文の行です本文の行です", bbox=(x, 60, x + 11, 500),
                                    font_size=10, direction=down, vertical_writing=True))

        assert self._headings([_page(1, blocks)]) == {(1, "縦書きの見出し")}

    def test_vertical_page_runs_stack_along_x(self):
        # Short 6.5pt vertical labels pull the median line to 6.5pt; the 10pt body
        # columns are a run only when lines are stacked along x, not y.
        down = (0.0, 1.0)
        blocks = [BlockInfo(page=1, text="縦書きの見出し", bbox=(560, 60, 576, 200), font_size=14, direction=down)]
        for i in range(12):
            x = 530 - i * 14
            blocks.append(BlockInfo(page=1, text=f"本文の行です本文の行です本文の行です{i}", bbox=(x, 60, x + 11, 500),
                                    font_size=10, direction=down))
        blocks += [
            BlockInfo(page=1, text="図表", bbox=(40 + i * 12, 600 + (i % 2) * 40, 47 + i * 12, 615 + (i % 2) * 40),
                      font_size=6.5, direction=down)
            for i in range(30)
        ]

        assert self._headings([_page(1, blocks)]) == {(1, "縦書きの見出し")}

    def test_cjk_broker_page(self):
        blocks = [BlockInfo(page=1, text="石油危机复盘：油价与衰退", bbox=(40, 60, 250, 76), font_size=14)]
        blocks += _body_lines(1, 40, 90, 10, size=10.5, text="原油价格在供给冲击下大幅上涨全球经济增速放缓")
        blocks += [
            BlockInfo(page=1, text="2008年", bbox=(395 + (i % 5) * 34, 100 + (i // 5) * 16, 412 + (i % 5) * 34, 107 + (i // 5) * 16),
                      font_size=6.5)
            for i in range(40)
        ]

        assert self._headings([_page(1, blocks)]) == {(1, "石油危机复盘：油价与衰退")}

    def test_size_rule_rejects_number_callouts_and_addresses(self):
        def by_size(text: str) -> bool:
            block = CleanBlock(page=1, text=text, bbox=(40, 60, 200, 90), font_size=28, rule_size=28)
            return self.svc._is_heading_by_size(block, 10.0)

        for text in ("+12%", "Q3 2025", "2026E", "P", "www.plindia.com", "https://example.com/report", "ir@example.com"):
            assert not by_size(text), text
        for text in ("U.S.", "Exhibit 12: Capex", "1. Introduction", "Visit www.example.com for more"):
            assert by_size(text), text

    def test_annotate_runs(self):
        blocks = [
            CleanBlock(page=1, text="Heading", bbox=(40, 40, 300, 58), font_size=16),
            *[CleanBlock(page=1, text=f"left {i}", bbox=(40, 80 + i * 12.5, 280, 91.5 + i * 12.5), font_size=10)
              for i in range(5)],
            *[CleanBlock(page=1, text=f"right {i}", bbox=(320, 80 + i * 12.5, 560, 91.5 + i * 12.5), font_size=10)
              for i in range(3)],
            CleanBlock(page=1, text="cell a", bbox=(40, 300, 90, 307), font_size=6.5),
            CleanBlock(page=1, text="cell b", bbox=(100, 300, 150, 307), font_size=6.5),
            CleanBlock(page=1, text="far below", bbox=(40, 400, 280, 411.5), font_size=10),
            CleanBlock(page=1, text="rotated", bbox=(40, 412, 52, 500), font_size=10, off_axis=True),
            # A line drawn twice a fraction of a point apart (fake bold) is one line, not a run.
            CleanBlock(page=1, text="Drawn twice", bbox=(40, 600, 200, 616), font_size=14),
            CleanBlock(page=1, text="Drawn twice", bbox=(40.4, 600.4, 200.4, 616.4), font_size=14),
        ]

        self.svc._annotate_runs(blocks)

        assert [b.run_len for b in blocks] == [1, 5, 5, 5, 5, 5, 3, 3, 3, 1, 1, 1, 1, 1, 1]

    def test_reference_floor_keeps_chart_legends_body(self):
        # Chart-deck pages: 12pt title, 9pt legend entries, a 7pt note paragraph.
        # The only running text is the 7pt note; 9pt > 1.25 x 7pt, but the
        # reference never drops below the document's median line (9pt here).
        pages = []
        for pn in (1, 2, 3):
            blocks = [BlockInfo(page=pn, text=f"Chart title {pn}", bbox=(40, 40, 400, 56), font_size=12)]
            blocks += [BlockInfo(page=pn, text=f"Legend series {i}", bbox=(40 + (i % 4) * 130, 400 + (i // 4) * 20,
                                                                         150 + (i % 4) * 130, 410 + (i // 4) * 20), font_size=9)
                       for i in range(8)]
            blocks += _body_lines(pn, 40, 600, 3, size=7, width=500, text=f"Note on chart {pn}: company data and estimates")
            pages.append(_page(pn, blocks))

        assert self._headings(pages) == {(1, "Chart title 1"), (2, "Chart title 2"), (3, "Chart title 3")}

    def test_chunk_document_and_extract_elements_agree(self):
        blocks = [BlockInfo(page=1, text="Section heading", bbox=(40, 60, 300, 76), font_size=14)]
        blocks += _body_lines(1, 40, 90, 8) + _cells(1, 400, 12)
        page = _page(1, blocks)

        headings = {e.text for e in self.svc.extract_elements([page]) if e.element_type == "heading"}
        chunks = self.svc.chunk_document([page])

        assert headings == {"Section heading"}
        assert all("Section heading" not in c.text for c in chunks)
        assert {c.section_title for c in chunks} == {"Section heading"}

    def test_seed_pdfs_keep_titles_and_body(self):
        cases = {
            "attention-paper.pdf": ("Attention Is All You Need",
                                    "The dominant sequence transduction models are based on complex recurrent or"),
            "alphabet-earnings.pdf": ("Alphabet Announces Fourth Quarter and Fiscal Year 2025 Results",
                                      "Sundar Pichai, CEO of Alphabet and Google, said:"),
            "court-filing.pdf": ("REPORT AND RECOMMENDATION",
                                 "Because Plaintiff failed to comply with four court orders and failed to"),
        }
        for name, (title, body) in cases.items():
            elements = self.svc.extract_elements(self.svc.extract_pages((SEED_DIR / name).read_bytes()))
            assert any(e.element_type == "heading" and e.text == title for e in elements), name
            assert any(e.element_type == "paragraph" and e.text.startswith(body) for e in elements), name

    # ---- review r1 (2026-10-11, .collab/reviews/2026-10-11-parse-heading-body-size-review-r1.md) ----

    def test_wrapped_slide_title_is_not_the_page_body(self):
        # F1: a 2-line action title over three one-line bullets. The title is a run
        # of 2 wide lines; as the page's largest size it must not become the body.
        pages = []
        for pn in (1, 2, 3):
            blocks = [
                BlockInfo(page=pn, text=f"Data center demand remains the largest driver {pn}", bbox=(60, 60, 700, 90), font_size=28),
                BlockInfo(page=pn, text="of our 2026 revenue and margin outlook", bbox=(60, 94, 600, 124), font_size=28),
            ]
            blocks += [
                BlockInfo(page=pn, text=f"• Signed leases up {18 + b}% year on year across all markets",
                          bbox=(60, 160 + b * 24, 700, 180 + b * 24), font_size=18)
                for b in range(3)
            ]
            pages.append(_page(pn, blocks, width=960, height=540))

        assert len(self._headings(pages)) == 6

    def test_wrapped_cover_title_is_not_the_page_body(self):
        # F1: a cover with a 2-line 20pt title over a 2-line 10pt standfirst,
        # followed by ordinary 10pt pages.
        cover = [
            BlockInfo(page=1, text="AI, data centres and the coming surge in", bbox=(50, 200, 560, 224), font_size=20),
            BlockInfo(page=1, text="US power demand: our 2030 base-case view", bbox=(50, 226, 560, 250), font_size=20),
            *_body_lines(1, 50, 280, 2, width=500, text="We expect data-centre power demand to grow strongly by 2030"),
        ]
        pages = [_page(1, cover)] + [_page(pn, _body_lines(pn, 50, 90, 30, width=500)) for pn in (2, 3)]

        assert self._headings(pages) == {
            (1, "AI, data centres and the coming surge in"), (1, "US power demand: our 2030 base-case view"),
        }

    def test_one_text_page_does_not_set_the_body_size_of_a_chart_book(self):
        # F2: one 12pt intro page and twenty chart pages; the document body size
        # must be shared by a quarter of ALL pages, else chart pages keep the floor.
        pages = [_page(1, [BlockInfo(page=1, text="Market outlook", bbox=(40, 40, 400, 64), font_size=20)]
                       + _body_lines(1, 40, 80, 14, size=12, width=700, text="Introductory text of the chart book"),
                       width=842, height=595)]
        for pn in range(2, 22):
            blocks = [BlockInfo(page=pn, text=f"S&P 500 earnings growth and margins, chart {pn}", bbox=(40, 40, 500, 54), font_size=12)]
            blocks += [BlockInfo(page=pn, text=f"Legend {i}", bbox=(40 + i * 70, 500, 100 + i * 70, 509), font_size=8)
                       for i in range(10)]
            blocks += [BlockInfo(page=pn, text=f"{t}", bbox=(30, 80 + t * 12, 45, 87 + t * 12), font_size=7) for t in range(30)]
            pages.append(_page(pn, blocks, width=842, height=595))

        headings = self._headings(pages)

        assert (1, "Market outlook") in headings
        assert all((pn, f"S&P 500 earnings growth and margins, chart {pn}") in headings for pn in range(2, 22))

    def test_small_whitespace_spans_do_not_turn_body_into_headings(self):
        # F3: every word followed by a 4pt space run: span mean 8pt, dominant 12pt.
        # Double spacing forms no runs, so only the floors decide, and each size is
        # compared with the median of its own kind: the body clears neither, the
        # 14pt section titles (found by v3 through the 8pt span-mean median) stay.
        pages = []
        for pn in (1, 2, 3):
            blocks = [BlockInfo(page=pn, text=f"Section {pn}", bbox=(72, 60, 300, 78), font_size=14, dominant_size=14)]
            blocks += [
                BlockInfo(page=pn, text=f"the committee reviewed new evidence on productivity growth {i}",
                          bbox=(72, 100 + i * 27.6, 540, 113.3 + i * 27.6), font_size=8.0, dominant_size=12.0)
                for i in range(20)
            ]
            pages.append(_page(pn, blocks))

        assert self._headings(pages) == {(1, "Section 1"), (2, "Section 2"), (3, "Section 3")}
        assert len(self.svc.chunk_document(pages)) > 0

    def test_superscripts_inside_body_lines_do_not_break_the_paragraph_run(self):
        # Every other line carries a 6pt footnote marker (span mean 8.67pt,
        # dominant 10pt). Runs and the body size read the dominant size.
        blocks = [BlockInfo(page=1, text="Heading", bbox=(40, 40, 300, 58), font_size=16, dominant_size=16)]
        for i in range(10):
            y = 90 + i * 12.5
            marked = i % 2 == 1
            blocks.append(BlockInfo(page=1, text=f"Body line {i} with text{'1' if marked else ''}", bbox=(40, y, 400, y + 11.5),
                                    font_size=26 / 3 if marked else 10.0, dominant_size=10.0))
        blocks += _cells(1, 400, 12)

        assert self._headings([_page(1, blocks)]) == {(1, "Heading")}

    def test_ocr_jitter_stays_one_size_class(self):
        # Body lines alternate 10.0 / 10.5pt (OCR-style jitter) beside small cells.
        blocks = [BlockInfo(page=1, text="Section heading", bbox=(40, 40, 300, 58), font_size=16)]
        for i in range(10):
            y = 90 + i * 12.5
            blocks.append(BlockInfo(page=1, text=f"Body line {i} of scanned text", bbox=(40, y, 400, y + 11.5),
                                    font_size=10.5 if i % 2 else 10.0))
        blocks += _cells(1, 400, 12)

        assert self._headings([_page(1, blocks)]) == {(1, "Section heading")}

    def test_isolated_lines_are_not_running_text(self):
        # Six one-line 14pt headings over six 3-line 10pt paragraphs: the headings
        # hold over 30% of the wide text but are not a paragraph run, so 10pt
        # stays the page body and they stay headings.
        blocks, y = [], 40
        for k in range(6):
            blocks.append(BlockInfo(page=1, text=f"Heading number {k} that spans a wide line of text", bbox=(40, y, 500, y + 16),
                                    font_size=14))
            y += 30
            blocks += _body_lines(1, 40, y, 3, width=400, text=f"Para {k} body")
            y += 60

        assert len(self._headings([_page(1, blocks)])) == 6

    def test_extractor_titles_skip_the_pdf_shape_guards(self):
        from types import SimpleNamespace

        from app.workers.parse_worker import _extracted_pages_to_page_infos

        extracted = [
            SimpleNamespace(page_number=pn, text=f"Changes in release {pn}. " * 20, width_pt=None, height_pt=None,
                            section_title=title)
            for pn, title in ((1, None), (2, None), (3, "v2.0.0 (2024-05-01)"), (4, None), (5, "Release 2024.10.11"))
        ]
        pages = _extracted_pages_to_page_infos(extracted)

        assert self._headings(pages) == {(3, "v2.0.0 (2024-05-01)"), (5, "Release 2024.10.11")}

    def test_size_rule_counts_cjk_characters_as_words(self):
        def by_size(text: str) -> bool:
            block = CleanBlock(page=1, text=text, bbox=(40, 60, 200, 90), font_size=14, rule_size=14)
            return self.svc._is_heading_by_size(block, 10.0)

        for text in ("3、2026年展望", "2026年3月期決算", "2026년 전망", "长鑫科技（688825） 电子", "2025Q3业绩点评"):
            assert by_size(text), text
        for text in ("1503.10亿元", "2026年", "AB 12"):
            assert not by_size(text), text

    def test_extract_line_blocks_dominant_size_ignores_whitespace_and_prefers_larger(self):
        lines = [
            {"bbox": (50, 50, 300, 66), "spans": [{"text": "A", "size": 12.0}, {"text": "     ", "size": 8.0}]},
            {"bbox": (50, 70, 300, 86), "spans": [{"text": "ab", "size": 10.0}, {"text": "cd", "size": 14.0}]},
        ]

        blocks = self.svc._extract_line_blocks(1, lines)

        assert [b.dominant_size for b in blocks] == [12.0, 14.0]

    def test_run_gap_and_overlap_thresholds(self):
        h = 11.5
        blocks = [
            CleanBlock(page=1, text="close a", bbox=(40, 100, 280, 100 + h), font_size=10),
            CleanBlock(page=1, text="close b", bbox=(40, 100 + h + 0.8 * h, 280, 100 + 2.8 * h), font_size=10),
            CleanBlock(page=1, text="far a", bbox=(40, 300, 280, 300 + h), font_size=10),
            CleanBlock(page=1, text="far b", bbox=(40, 300 + h + 1.2 * h, 280, 300 + 3.2 * h), font_size=10),
            # Stacked but only 10% of the narrower line overlapping: another column.
            CleanBlock(page=1, text="col a", bbox=(40, 500, 240, 500 + h), font_size=10),
            CleanBlock(page=1, text="col b", bbox=(220, 500 + 1.1 * h, 420, 500 + 2.1 * h), font_size=10),
        ]

        self.svc._annotate_runs(blocks)

        assert [b.run_len for b in blocks] == [2, 2, 1, 1, 1, 1]

    def test_size_rule_counts_combining_marks_as_letters(self):
        block = CleanBlock(page=1, text="विकास २०२६", bbox=(40, 60, 200, 90), font_size=14, rule_size=14)

        assert self.svc._is_heading_by_size(block, 10.0)  # 3 letters + 2 matras vs 4 digits

    def test_floor_gate_compares_each_size_with_its_own_median(self):
        line = CleanBlock(page=1, text="Section heading", bbox=(40, 60, 200, 72), font_size=12, rule_size=12)

        # Clears 1.25x the span-mean median (8pt) though not the dominant one (12pt).
        assert self.svc._is_heading_by_size(line, 0.0, floors=(8.0, 12.0))
        assert not self.svc._is_heading_by_size(line, 0.0, floors=(12.0, 12.0))
        # A span mean pulled down (8pt) does not count against the dominant median.
        pulled = CleanBlock(page=1, text="Body text line", bbox=(40, 60, 200, 72), font_size=8, rule_size=12)
        assert not self.svc._is_heading_by_size(pulled, 0.0, floors=(8.0, 12.0))

    def test_minor_size_class_is_not_the_page_body(self):
        # Two 2-line 14pt callouts hold under 30% of the running text: the 10pt body
        # stays the reference and the 16pt heading clears it.
        blocks = [BlockInfo(page=1, text="Sixteen point heading", bbox=(40, 40, 400, 60), font_size=16)]
        blocks += _body_lines(1, 40, 80, 24, width=420)
        for k, y in enumerate((420, 480)):
            blocks += [BlockInfo(page=1, text=f"Callout {k} line {i} set larger", bbox=(40, y + i * 17, 300, y + 15 + i * 17),
                                 font_size=14) for i in range(2)]

        assert (1, "Sixteen point heading") in self._headings([_page(1, blocks)])

    def test_runs_are_swept_per_size_class(self):
        # 450 tiny cells start between two body lines. Swept together they would
        # push the first line out of the capped active list before the second
        # arrives; each size class is swept on its own.
        blocks = [CleanBlock(page=1, text="first body line", bbox=(40, 100, 500, 111.5), font_size=10)]
        blocks += [CleanBlock(page=1, text=".", bbox=(40 + (i % 225) * 2.4, 101 + (i // 225) * 4, 41 + (i % 225) * 2.4, 103 + (i // 225) * 4),
                              font_size=2) for i in range(450)]
        blocks.append(CleanBlock(page=1, text="second body line", bbox=(40, 112.5, 500, 124), font_size=10))

        self.svc._annotate_runs(blocks)

        assert blocks[0].run_len == blocks[-1].run_len == 2

    # ---- review r2 (2026-10-11, .collab/reviews/2026-10-11-parse-heading-body-size-review-r2.md) ----

    def test_wrapped_three_line_slide_title_is_not_the_page_body(self):
        pages = []
        for pn in (1, 2):
            blocks = [BlockInfo(page=pn, text=f"Title line {k} of a long action title on slide {pn}",
                                bbox=(60, 50 + k * 34, 760, 80 + k * 34), font_size=28) for k in range(3)]
            blocks += [BlockInfo(page=pn, text=f"• Bullet {b} states one result in a single line", bbox=(60, 200 + b * 24, 700, 220 + b * 24),
                                 font_size=18) for b in range(5)]
            pages.append(_page(pn, blocks, width=960, height=540))

        assert len(self._headings(pages)) == 6

    def test_chart_subtitle_over_an_axis_tick_is_not_a_paragraph(self):
        # R2-1 (JPM Guide p18): an 11.8pt chart title over a one-line 9.6pt subtitle,
        # whose top axis tick (8.9pt) sits right under it. Subtitle + tick share a
        # size class and stack, but one wide line is not running text.
        blocks = []
        for k, x in enumerate((40, 330)):
            blocks += [
                BlockInfo(page=1, text=f"Nonfarm payroll gains, chart {k}", bbox=(x, 60, x + 240, 74), font_size=11.8),
                BlockInfo(page=1, text=f"Change in thousands of jobs, seasonally adjusted, chart {k}", bbox=(x, 80, x + 260, 92),
                          font_size=9.6),
                BlockInfo(page=1, text="1,000", bbox=(x, 94, x + 20, 105), font_size=8.9),
            ]
        blocks += _cells(1, 300, 30, size=8)  # median line 8pt, as on the JPM page
        blocks += _body_lines(1, 40, 620, 4, size=8, width=520, text="Source: BLS, FactSet, J.P. Morgan Asset Management")
        headings = self._headings([_page(1, blocks)])

        assert {text for _p, text in headings} == {"Nonfarm payroll gains, chart 0", "Nonfarm payroll gains, chart 1"}

    def test_four_line_display_title_is_not_a_paragraph(self):
        # R2-2 (BIS working-paper cover): a 22pt title wrapped to 4 lines in a narrow column.
        title = ["AI adoption, productivity", "and employment:", "evidence from European", "firms"]
        blocks = [BlockInfo(page=1, text=line, bbox=(60, 120 + k * 26, 310, 144 + k * 26), font_size=22) for k, line in enumerate(title)]
        blocks += _body_lines(1, 60, 300, 12, width=480)

        assert {text for _p, text in self._headings([_page(1, blocks)])} == set(title)

    def test_lone_comment_on_an_exhibit_page_uses_other_pages_body_size(self):
        # R2-3: a broker note — 10pt body pages, exhibit pages with one 3-line 10pt
        # comment, a longer 7pt disclosure appendix. The comment's size is another
        # page's body size, so it is that page's body too.
        pages = [_page(pn, [BlockInfo(page=pn, text=f"Note title {pn}", bbox=(40, 40, 400, 60), font_size=16)]
                       + _body_lines(pn, 40, 80, 40, width=500)) for pn in (1, 2)]
        for pn in (3, 4, 5, 6):
            blocks = [BlockInfo(page=pn, text=f"Exhibit {pn}: DRAM contract prices", bbox=(40, 40, 400, 54), font_size=12)]
            blocks += _cells(pn, 80, 25)
            blocks += _body_lines(pn, 40, 400, 3, width=500,
                                  text=f"DRAM contract prices rose for a fourth straight quarter on exhibit page {pn}")
            pages.append(_page(pn, blocks))
        pages += [_page(pn, _body_lines(pn, 40, 60, 80, size=7, width=520, text="Disclosure text")) for pn in (7, 8, 9, 10)]

        chunk_text = " ".join(c.text for c in self.svc.chunk_document(pages))

        assert self._headings(pages) == {(1, "Note title 1"), (2, "Note title 2")}
        assert "rose for a fourth straight quarter on exhibit page 3 0" in chunk_text

    def test_dominant_size_is_held_to_the_larger_median(self):
        # R2-4: table cells whose span mean is pushed UP by a large trailing space
        # (mean 9.5pt, dominant 7pt) put the dominant-size median under the span-mean
        # one; a 9pt source line must not clear the lower of the two.
        pages = [_page(1, _body_lines(1, 40, 60, 30, width=500))]
        for pn in range(2, 8):
            blocks = [BlockInfo(page=pn, text="12.3", bbox=(40 + c * 60, 60 + r * 10, 70 + c * 60, 68 + r * 10),
                                font_size=9.5, dominant_size=7.0) for r in range(10) for c in range(5)]
            blocks.append(BlockInfo(page=pn, text=f"Source: Company filings, FactSet and our estimates {pn}",
                                    bbox=(40, 200, 400, 210), font_size=9.0, dominant_size=9.0))
            pages.append(_page(pn, blocks))

        assert self._headings(pages) == set()

    def test_drifting_sizes_stay_one_run(self):
        # OCR drift 10.0 -> 10.7 -> 11.5: each step is one size class, the ends are not.
        sizes = [10.0, 10.7, 11.5, 10.7, 10.0]
        blocks = [CleanBlock(page=1, text=f"line {i}", bbox=(40, 100 + i * 14, 400, 112 + i * 14), font_size=s)
                  for i, s in enumerate(sizes)]

        self.svc._annotate_runs(blocks)

        assert [b.run_len for b in blocks] == [5] * 5

    def test_short_last_line_stays_in_its_paragraph(self):
        blocks = [CleanBlock(page=1, text=f"long line {i}", bbox=(40, 100 + i * 12.5, 440, 111.5 + i * 12.5), font_size=10)
                  for i in range(3)]
        blocks.append(CleanBlock(page=1, text="end.", bbox=(40, 137.5, 70, 149), font_size=10))

        self.svc._annotate_runs(blocks)

        assert [b.run_len for b in blocks] == [4] * 4

    def test_size_rule_weights_kana_and_rare_ideographs(self):
        def by_size(text: str) -> bool:
            block = CleanBlock(page=1, text=text, bbox=(40, 60, 200, 90), font_size=14, rule_size=14)
            return self.svc._is_heading_by_size(block, 10.0)

        for text in ("トヨタ 2026", "㐂㐆㐇 2026", "\uf900\uf901\uf902 2026"):  # U+F900.. compatibility ideographs
            assert by_size(text), text

    # ---- review r3 (2026-10-11, .collab/reviews/2026-10-11-parse-heading-body-size-review-r3.md) ----

    def test_second_look_skips_a_title_over_the_pages_text(self):
        # R3-1: a note whose cover standfirst and key-points page are 14pt makes 14pt a
        # body size; on the exhibit pages the 2-line 14pt exhibit title is still a title
        # over a 9pt comment.
        cover = [BlockInfo(page=1, text="AI rate of change", bbox=(40, 40, 500, 70), font_size=26)]
        cover += _body_lines(1, 40, 100, 4, size=14, width=520, text="Standfirst set in fourteen point type across the cover")
        pages = [_page(1, cover), _page(2, _body_lines(2, 40, 60, 6, size=14, width=520, text="Key point in fourteen point type"))]
        pages += [_page(pn, _body_lines(pn, 40, 60, 40, size=9, width=520)) for pn in (3, 4)]
        for pn in range(5, 11):
            blocks = [BlockInfo(page=pn, text=f"Exhibit {pn}: Enterprise AI adoption rose in every region we survey,",
                                bbox=(40, 40, 560, 57), font_size=14),
                      BlockInfo(page=pn, text="led by financials and software, while industrials still lag behind",
                                bbox=(40, 59, 560, 76), font_size=14)]
            blocks += _cells(pn, 100, 25)
            blocks += _body_lines(pn, 40, 420, 3, size=9, width=520, text=f"Comment on exhibit {pn} explaining what the chart shows")
            pages.append(_page(pn, blocks))

        headings = self._headings(pages)

        assert all((pn, f"Exhibit {pn}: Enterprise AI adoption rose in every region we survey,") in headings for pn in range(5, 11))

    def test_document_body_size_comes_from_first_look_sizes(self):
        # R3-1: second-look sizes (12pt comments on six exhibit pages) must not raise
        # the document body size that chart pages inherit.
        pages = [_page(pn, [BlockInfo(page=pn, text=f"Section {pn}", bbox=(40, 40, 400, 60), font_size=16)]
                       + _body_lines(pn, 40, 80, 40, width=500)) for pn in (1, 2, 3, 4)]
        pages += [_page(pn, _body_lines(pn, 40, 80, 5, size=12, width=520, text="A twelve point summary page of the report"))
                  for pn in (5, 6)]
        for pn in range(7, 13):
            blocks = [BlockInfo(page=pn, text=f"Exhibit {pn}: memory prices", bbox=(40, 40, 400, 60), font_size=16)]
            blocks += _cells(pn, 100, 25)
            blocks += _body_lines(pn, 40, 420, 3, size=12, width=520,
                                  text=f"Twelve point comment on exhibit {pn}, long enough to give the page a body size")
            pages.append(_page(pn, blocks))
        for pn in (13, 14):
            pages.append(_page(pn, [BlockInfo(page=pn, text=f"Chart title {pn}", bbox=(40, 40, 400, 57), font_size=14)]
                               + _cells(pn, 100, 25)))

        headings = self._headings(pages)

        assert (13, "Chart title 13") in headings and (14, "Chart title 14") in headings

    def test_second_look_is_only_for_pages_without_a_body_size(self):
        # A page with its own 10pt body keeps it; its lone 3-line 12pt standfirst (12pt
        # is another page's body) does not get to raise the page body over its heading.
        page1 = [BlockInfo(page=1, text="Fourteen point heading", bbox=(40, 40, 400, 58), font_size=14)]
        page1 += _body_lines(1, 40, 80, 3, size=12, width=520, text="Standfirst in twelve point type that runs across the page")
        page1 += _body_lines(1, 40, 160, 6, width=520)
        page1 += _cells(1, 300, 12)
        pages = [_page(1, page1)] + [_page(pn, _body_lines(pn, 40, 80, 8, size=12, width=520) + _cells(pn, 300, 12)) for pn in (2, 3)]

        assert (1, "Fourteen point heading") in self._headings(pages)

    def test_display_exemption_thresholds(self):
        def run_line(size: float, run_chars: int, reference: float, floors: tuple[float, float]) -> bool:
            block = CleanBlock(page=1, text="Display title line", bbox=(40, 60, 300, 80), font_size=size, rule_size=size,
                               run_len=4, run_chars=run_chars)
            return self.svc._is_heading_by_size(block, reference, floors)

        assert run_line(15.0, 80, 10.0, (8.0, 8.0))  # 1.5x the page body, short: a 4-line title
        assert not run_line(14.9, 80, 10.0, (8.0, 8.0))
        assert not run_line(15.0, 161, 10.0, (8.0, 8.0))  # a paragraph is longer
        assert run_line(15.0, 160, 10.0, (8.0, 8.0))
        assert not run_line(16.0, 80, 10.0, (11.0, 11.0))  # 1.6x the page body but under 1.5x the median line

    def test_second_look_does_not_lower_a_page_below_the_document_body(self):
        # R3-3: exhibit pages carry a 3-line 7pt source note; 7pt is the disclosure
        # appendix's body size, but the exhibit page keeps the document's 10pt body,
        # so its 10pt comment (one wide line and a short one) stays body text.
        pages = [_page(pn, [BlockInfo(page=pn, text=f"Section {pn}", bbox=(40, 40, 400, 60), font_size=16)]
                       + _body_lines(pn, 40, 80, 40, width=500)) for pn in (1, 2, 3, 4)]
        for pn in range(5, 10):
            blocks = [BlockInfo(page=pn, text=f"Exhibit {pn}: DRAM contract prices", bbox=(40, 40, 400, 54), font_size=12)]
            blocks += _cells(pn, 80, 25)
            blocks += [
                BlockInfo(page=pn, text=f"DRAM contract prices rose for a fourth straight quarter as hyperscalers {pn}",
                          bbox=(40, 400, 520, 411.5), font_size=10),
                BlockInfo(page=pn, text="pre-bought capacity.", bbox=(40, 412.5, 130, 424), font_size=10),
            ]
            blocks += _body_lines(pn, 40, 600, 3, size=7, width=520,
                                  text="Source: Company data, TrendForce, our estimates; note: contract prices are quarterly averages")
            pages.append(_page(pn, blocks))
        pages += [_page(pn, _body_lines(pn, 40, 60, 80, size=7, width=520, text="Disclosure text")) for pn in (10, 11, 12)]

        chunk_text = " ".join(c.text for c in self.svc.chunk_document(pages))

        assert "as hyperscalers 5" in chunk_text and "pre-bought capacity." in chunk_text

    # ---- review r4 (2026-10-11, .collab/reviews/2026-10-11-parse-heading-body-size-review-r4.md) ----

    def test_four_line_slide_title_is_not_the_page_body(self):
        # R4-1: a 4-line 28pt title (152 characters) over four stacked one-line points
        # and three 9pt notes; alone, the title run is display text, not body.
        pages = []
        for pn in range(1, 6):
            title = [BlockInfo(page=pn, text=f"Title line {k} of slide {pn} in large type", bbox=(60, 40 + k * 32, 900, 70 + k * 32),
                               font_size=28) for k in range(4)]
            points = [BlockInfo(page=pn, text=f"• Point {b} states one result in a single line", bbox=(60, 200 + b * 22, 900, 219 + b * 22),
                                font_size=18) for b in range(4)]
            notes = [BlockInfo(page=pn, text=f"Note {k} on slide {pn}: source data", bbox=(60, 400 + k * 12, 300, 410 + k * 12),
                               font_size=9) for k in range(3)]
            pages.append(_page(pn, title + points + notes, width=960, height=540))

        headings = self._headings(pages)

        assert all((pn, f"Title line {k} of slide {pn} in large type") in headings for pn in range(1, 6) for k in range(4))

    def test_one_page_standfirst_size_is_not_a_body_size_for_the_second_look(self):
        # R4-3: a 14pt cover standfirst; exhibit pages whose only run is a 3-line 14pt
        # exhibit title of over 200 characters. One page's body size does not make it
        # body text on every page.
        cover = [BlockInfo(page=1, text="AI rate of change", bbox=(40, 40, 500, 70), font_size=26)]
        cover += _body_lines(1, 40, 100, 4, size=14, width=520, text="Standfirst set in fourteen point type across the cover")
        pages = [_page(1, cover)] + [_page(pn, _body_lines(pn, 40, 60, 40, size=9, width=520)) for pn in (2, 3, 4)]
        title = ["Exhibit {pn}: Enterprise AI adoption rose in every region we survey, led by",
                 "financials and software, while industrials and the public sector still lag",
                 "behind, and the gap between leaders and laggards widened again this year"]
        for pn in range(5, 11):
            blocks = [BlockInfo(page=pn, text=line.format(pn=pn), bbox=(40, 40 + k * 19, 570, 57 + k * 19), font_size=14)
                      for k, line in enumerate(title)]
            blocks += _cells(pn, 120, 25)
            blocks.append(BlockInfo(page=pn, text="One-line comment on the exhibit.", bbox=(40, 420, 300, 430), font_size=9))
            pages.append(_page(pn, blocks))

        headings = self._headings(pages)

        assert all((pn, title[0].format(pn=pn)) in headings for pn in range(5, 11))

    def test_display_cap_counts_cjk_twice(self):
        # R4-4: a 4-line 11pt CJK paragraph of about 150 characters over a 7pt
        # disclaimer is a paragraph, not display text.
        pages = [_page(pn, _body_lines(pn, 40, 60, 30, size=10.5, width=520, text="原油价格在供给冲击下大幅上涨全球经济增速放缓")) for pn in (1, 2, 3)]
        pages += [_page(pn, _cells(pn, 80, 30)) for pn in (5, 6, 7, 8)]  # chart pages: the median line is 6.5pt
        last = [BlockInfo(page=4, text=f"本报告所载的资料意见及推测仅反映本公司于发布本报告当日的判断在不同时期{k}",
                          bbox=(40, 60 + k * 14, 560, 72 + k * 14), font_size=11) for k in range(4)]
        last += _body_lines(4, 40, 140, 60, size=7, width=520, text="免责声明正文以七号字排印于报告的最后一页")
        pages.append(_page(4, last))

        assert not any(pn == 4 for pn, _t in self._headings(pages))

    def test_display_cap_counts_the_whole_run(self):
        # R4-5: four 50-character lines at 1.6x the body are a 200-character paragraph,
        # however short each line is.
        blocks = [BlockInfo(page=1, text=f"Sixteen point paragraph line {k} of fifty chars.", bbox=(40, 60 + k * 19, 560, 77 + k * 19),
                            font_size=16) for k in range(4)]
        blocks += _body_lines(1, 40, 160, 30, width=520)

        assert self._headings([_page(1, blocks)]) == set()
