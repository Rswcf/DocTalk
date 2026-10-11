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


ALPHABET_SEED_PDF = BACKEND_DIR / "seed_data" / "alphabet-earnings.pdf"
COURT_SEED_PDF = BACKEND_DIR / "seed_data" / "court-filing.pdf"


def _heading_texts(svc: ParseService, pdf_path: Path) -> list[str]:
    elements = svc.extract_elements(svc.extract_pages(pdf_path.read_bytes()))
    return [e.text for e in elements if e.element_type == "heading"]


class TestHeadingDetection:
    """Before parse v4 the all-caps rule had no letter minimum and no table check,
    so formula and table tokens (")V", "O(1)", "<EOS>", "EMEA") became section
    titles and prefixed citation snippets, while LaTeX section headings (12pt on a
    10pt body, below the 1.25x size rule) were never detected (2026-10-11)."""

    TABLE_AND_FORMULA_TOKENS = {
        ")V", "O(1)", "GNMT + RL [38]", "100K", "300K", "WSJ 23 F1", "<EOS>",
        "BLEU", "EN-DE", "EN-FR", "PPL", "N", "(A)", "(B)", "(C)", "(D)", "(E)",
    }

    def setup_method(self):
        self.svc = ParseService()

    def test_seed_pdf_table_and_formula_tokens_are_not_section_titles(self):
        pages = self.svc.extract_pages(ATTENTION_SEED_PDF.read_bytes())

        titles = {c.section_title for c in self.svc.chunk_document(pages)}
        headings = {e.text for e in self.svc.extract_elements(pages) if e.element_type == "heading"}

        assert not titles & self.TABLE_AND_FORMULA_TOKENS
        assert not headings & self.TABLE_AND_FORMULA_TOKENS

    def test_seed_pdf_numbered_section_headings_are_detected(self):
        pages = self.svc.extract_pages(ATTENTION_SEED_PDF.read_bytes())

        headings = [e for e in self.svc.extract_elements(pages) if e.element_type == "heading"]
        chunks = self.svc.chunk_document(pages)

        assert [e.text for e in headings] == [
            "Attention Is All You Need",
            "1 Introduction",
            "2 Background",
            "3 Model Architecture",
            "4 Why Self-Attention",
            "5 Training",
            "6 Results",
            "7 Conclusion",
        ]
        # The section number is a separate line in the PDF; the heading element
        # covers both ("3" at x=108pt, "Model Architecture" ends at x=226pt).
        model = next(e for e in headings if e.text == "3 Model Architecture")
        assert model.page_start == 2
        assert model.bbox["x"] == 108 / 612
        assert round(model.bbox["w"] * 612) == 118
        assert any(c.section_title == "3 Model Architecture" and c.page_start == 3 for c in chunks)
        # Neither half of a heading is left behind as chunk text.
        assert not any("Model Architecture Most competitive" in c.text for c in chunks)
        assert not any(" 3 Most competitive" in c.text for c in chunks)

    def test_alphabet_seed_keeps_statement_titles_and_drops_table_headers(self):
        headings = _heading_texts(self.svc, ALPHABET_SEED_PDF)

        assert "CONSOLIDATED BALANCE SHEETS" in headings
        assert "CONSOLIDATED STATEMENTS OF INCOME" in headings
        assert "CONSOLIDATED STATEMENTS OF CASH FLOWS" in headings
        assert not {"EMEA", "APAC", "TTM", "Q1 2025", "Q4 2025"} & set(headings)

    def test_court_seed_keeps_its_caps_headings(self):
        headings = _heading_texts(self.svc, COURT_SEED_PDF)

        for heading in ("REPORT AND RECOMMENDATION", "I. BACKGROUND", "II. DISCUSSION",
                        "III. CONCLUSION", "NOTICE TO THE PARTIES"):
            assert heading in headings

    @staticmethod
    def _page(*blocks: BlockInfo) -> PageInfo:
        return PageInfo(page_number=1, width_pt=612, height_pt=792, rotation=0, blocks=list(blocks))

    @staticmethod
    def _body(y: float, text: str = "Body text continues on this line of the page.") -> BlockInfo:
        return BlockInfo(page=1, text=text, bbox=(72, y, 300, y + 10), font_size=10)

    def test_caps_heading_beside_a_two_column_body_line_stays_a_heading(self):
        # Two-column paper: the right column's body line shares the heading's row.
        page = self._page(
            BlockInfo(page=1, text="RELATED WORK", bbox=(72, 100, 160, 110), font_size=10),
            BlockInfo(page=1, text="the right column carries on with its paragraph", bbox=(320, 100, 540, 110),
                      font_size=10),
            self._body(120),
            self._body(132),
        )

        headings = [e.text for e in self.svc.extract_elements([page]) if e.element_type == "heading"]

        assert headings == ["RELATED WORK"]

    def test_caps_cells_in_a_table_row_are_content(self):
        page = self._page(
            self._body(60),
            BlockInfo(page=1, text="REVENUE", bbox=(72, 100, 140, 110), font_size=10),
            BlockInfo(page=1, text="EBITDA", bbox=(200, 100, 250, 110), font_size=10),
            BlockInfo(page=1, text="MARGIN", bbox=(320, 100, 370, 110), font_size=10),
            self._body(120),
        )

        chunks = self.svc.chunk_document([page])
        elements = self.svc.extract_elements([page])

        assert {c.section_title for c in chunks} == {None}
        assert not any(e.element_type == "heading" for e in elements)
        assert "REVENUE EBITDA MARGIN" in chunks[0].text

    def test_caps_header_cell_with_one_neighbour_in_the_same_half_is_content(self):
        # Attention p8: "BLEU" shares its header row only with "Training Cost (FLOPs)".
        page = self._page(
            self._body(60),
            BlockInfo(page=1, text="BLEU", bbox=(311, 98, 337, 108), font_size=10),
            BlockInfo(page=1, text="Training Cost (FLOPs)", bbox=(383, 98, 475, 108), font_size=10),
            self._body(120),
        )

        assert not any(e.element_type == "heading" for e in self.svc.extract_elements([page]))

    def test_caps_line_needs_four_capital_letters(self):
        page = self._page(
            self._body(60),
            BlockInfo(page=1, text="O(1)", bbox=(72, 80, 100, 90), font_size=10),
            BlockInfo(page=1, text="<EOS>", bbox=(72, 100, 110, 110), font_size=10),
            BlockInfo(page=1, text="TTM", bbox=(72, 120, 100, 130), font_size=10),
            BlockInfo(page=1, text="ABSTRACT", bbox=(72, 140, 140, 150), font_size=10),
            self._body(160),
        )

        headings = [e.text for e in self.svc.extract_elements([page]) if e.element_type == "heading"]

        assert headings == ["ABSTRACT"]

    def test_section_number_line_joins_the_title_on_its_baseline(self):
        page = self._page(
            self._body(60),
            BlockInfo(page=1, text="3", bbox=(108, 100, 114, 112), font_size=12),
            BlockInfo(page=1, text="Model Architecture", bbox=(126, 100, 226, 112), font_size=12),
            self._body(120, "Most competitive models have an encoder-decoder structure."),
            self._body(132),
        )

        chunks = self.svc.chunk_document([page])
        heading = [e for e in self.svc.extract_elements([page]) if e.element_type == "heading"]

        assert [e.text for e in heading] == ["3 Model Architecture"]
        assert heading[0].bbox["x"] == 108 / 612
        assert round(heading[0].bbox["w"] * 612) == 118
        assert chunks[0].section_title is None
        assert chunks[-1].section_title == "3 Model Architecture"
        assert " 3 " not in " ".join(c.text for c in chunks)

    def test_numbered_heading_on_one_line(self):
        page = self._page(
            self._body(60),
            BlockInfo(page=1, text="4.2 Training Data", bbox=(72, 100, 200, 112), font_size=11.5),
            self._body(120),
            self._body(132),
        )

        headings = [e.text for e in self.svc.extract_elements([page]) if e.element_type == "heading"]

        assert headings == ["4.2 Training Data"]

    def test_numbered_lines_that_are_not_headings(self):
        long_line = "4. The possibility for the two parties to negotiate a comprehensive agreement in time"
        page = self._page(
            self._body(40),
            # Body-size list item.
            BlockInfo(page=1, text="1 First item of the list", bbox=(72, 60, 250, 70), font_size=10),
            # A year is not a section number.
            BlockInfo(page=1, text="2025 Revenue Outlook", bbox=(72, 80, 250, 92), font_size=12),
            # A numbered body line is too long for a heading.
            BlockInfo(page=1, text=long_line, bbox=(72, 100, 540, 112), font_size=12),
            # A numbered sentence ends with a full stop.
            BlockInfo(page=1, text="2 Revenue grew strongly.", bbox=(72, 120, 250, 132), font_size=12),
            # Report dates (The Flow Show, Alibaba preview) and chart axis labels.
            BlockInfo(page=1, text="06 February 2026", bbox=(72, 140, 250, 152), font_size=12),
            BlockInfo(page=1, text="8. Januar 2026", bbox=(72, 160, 250, 172), font_size=12),
            BlockInfo(page=1, text="20 US$", bbox=(72, 180, 120, 192), font_size=12),
            self._body(200),
            self._body(212),
            self._body(224),
            self._body(236),
            self._body(248),
            self._body(260),
            self._body(272),
        )

        assert not any(e.element_type == "heading" for e in self.svc.extract_elements([page]))

    def test_numbered_list_items_in_body_text_stay_content(self):
        # Codex r1: chart cells at 9pt pull the median below the 10pt body, so a
        # body list item passes 1.1x. A line inside a same-size run is not a heading.
        cells = [
            BlockInfo(page=1, text=f"{v}%", bbox=(72 + 60 * (i % 6), 400 + 12 * (i // 6), 100 + 60 * (i % 6),
                                                   409 + 12 * (i // 6)), font_size=9)
            for i, v in enumerate(range(40))
        ]
        page = self._page(
            BlockInfo(page=1, text="The survey asked three questions.", bbox=(72, 100, 400, 111), font_size=10),
            BlockInfo(page=1, text="1 First item of the list", bbox=(72, 113, 250, 124), font_size=10),
            BlockInfo(page=1, text="2 Second item of the list", bbox=(72, 126, 250, 137), font_size=10),
            BlockInfo(page=1, text="3 Third item of the list", bbox=(72, 139, 250, 150), font_size=10),
            *cells,
        )

        chunks = self.svc.chunk_document([page])
        text = " ".join(c.text for c in chunks)

        assert not any(e.element_type == "heading" for e in self.svc.extract_elements([page]))
        assert "1 First item of the list 2 Second item of the list 3 Third item" in text

    def test_numbered_label_in_a_table_row_is_not_joined_into_a_heading(self):
        # Codex r1: "1 | Revenue Outlook | $100m" at 12pt on a 10pt body. The value
        # cell sits in the other half, but a narrow lone cell is not a column.
        page = self._page(
            self._body(60),
            BlockInfo(page=1, text="1", bbox=(72, 100, 78, 112), font_size=12),
            BlockInfo(page=1, text="Revenue Outlook", bbox=(90, 100, 200, 112), font_size=12),
            BlockInfo(page=1, text="$100m", bbox=(420, 100, 460, 112), font_size=12),
            *(self._body(130 + 14 * i) for i in range(5)),
        )

        elements = self.svc.extract_elements([page])

        assert not any(e.element_type == "heading" for e in elements)
        # The two cells stay separate lines with their own highlight boxes.
        assert [e.text for e in elements if e.text in {"1", "Revenue Outlook"}] == ["1", "Revenue Outlook"]

    def test_numbered_heading_in_a_caseless_script(self):
        page = self._page(
            self._body(60),
            BlockInfo(page=1, text="1 はじめに", bbox=(72, 100, 160, 112), font_size=12),
            self._body(130),
            BlockInfo(page=1, text="2 引言", bbox=(72, 160, 130, 172), font_size=12),
            self._body(190),
        )

        headings = [e.text for e in self.svc.extract_elements([page]) if e.element_type == "heading"]

        assert headings == ["1 はじめに", "2 引言"]

    def test_row_lookup_on_a_dense_table_page_is_not_quadratic(self):
        # Codex r1: 10,000 caps cells on one page took ~21s with a full scan per
        # candidate. The row index looks only at lines near the candidate's row.
        cells = [
            BlockInfo(page=1, text="ABCD", bbox=(72 + 90 * (i % 5), 10 + 0.35 * (i // 5) * 2,
                                                 120 + 90 * (i % 5), 10.6 + 0.35 * (i // 5) * 2), font_size=0.6)
            for i in range(10000)
        ]
        page = PageInfo(page_number=1, width_pt=612, height_pt=1600, rotation=0, blocks=cells)
        cleaned = self.svc.clean_text_blocks(page.blocks, page.width_pt, page.height_pt)
        counted = []
        real_shares_row = ParseService._shares_row

        def counting_shares_row(a, b):
            counted.append(1)
            return real_shares_row(a, b)

        with patch.object(ParseService, "_shares_row", staticmethod(counting_shares_row)):
            pairs = self.svc._classify_headings(cleaned, 0.6, {1: 612.0})

        assert not any(is_heading for _block, is_heading in pairs)
        assert len(counted) < 20 * len(cleaned)

    def test_one_tall_line_does_not_widen_every_row_lookup(self):
        # Codex r2: the scan window used the page's tallest line, so one 1,600pt
        # line made every lookup scan the whole page (1.6M calls for 2,000 cells).
        cells = [
            BlockInfo(page=1, text="ABCD", bbox=(72 + 90 * (i % 5), 10 + 0.7 * (i // 5),
                                                 120 + 90 * (i % 5), 10.6 + 0.7 * (i // 5)), font_size=0.6)
            for i in range(2000)
        ]
        tall = BlockInfo(page=1, text="ABCD", bbox=(560, 0, 600, 1600), font_size=0.6)
        page = PageInfo(page_number=1, width_pt=612, height_pt=1600, rotation=0, blocks=[*cells, tall])
        cleaned = self.svc.clean_text_blocks(page.blocks, page.width_pt, page.height_pt)
        assert any(b.bbox[3] - b.bbox[1] > 1000 for b in cleaned)
        counted = []
        real_shares_row = ParseService._shares_row

        def counting_shares_row(a, b):
            counted.append(1)
            return real_shares_row(a, b)

        with patch.object(ParseService, "_shares_row", staticmethod(counting_shares_row)):
            self.svc._classify_headings(cleaned, 0.6, {1: 612.0})

        assert len(counted) < 20 * len(cleaned)

    def test_caps_rule_needs_every_letter_capitalised(self):
        # A Chinese body line with Latin acronyms has no lowercase letter, so
        # str.isupper() is true for it. The caps signal only means something in a
        # cased script; numbered headings are the route for caseless scripts.
        cjk_line = "MCP 集成：支持外部 MCP 服务器的工具发现与调用"
        page = self._page(
            self._body(60),
            BlockInfo(page=1, text=cjk_line, bbox=(72, 80, 300, 90), font_size=10),
            self._body(100),
            BlockInfo(page=1, text="PART II — 2026 RESULTS", bbox=(72, 120, 240, 130), font_size=10),
            self._body(140),
        )

        chunks = self.svc.chunk_document([page])
        headings = [e.text for e in self.svc.extract_elements([page]) if e.element_type == "heading"]

        assert headings == ["PART II — 2026 RESULTS"]
        assert cjk_line in " ".join(c.text for c in chunks)

    def test_numbered_heading_directly_above_its_subheading(self):
        # Codex r2: "2 Methods" and "2.1 Data" share a size and column. Two numbers
        # of different depth are a heading and its subheading, not a list.
        page = self._page(
            self._body(60),
            BlockInfo(page=1, text="2 Methods", bbox=(72, 100, 150, 112), font_size=12),
            BlockInfo(page=1, text="2.1 Data", bbox=(72, 116, 140, 128), font_size=12),
            self._body(140),
            self._body(152),
            BlockInfo(page=1, text="3", bbox=(72, 180, 78, 192), font_size=12),
            BlockInfo(page=1, text="Results", bbox=(90, 180, 150, 192), font_size=12),
            BlockInfo(page=1, text="3.1", bbox=(72, 196, 90, 208), font_size=12),
            BlockInfo(page=1, text="Accuracy", bbox=(102, 196, 170, 208), font_size=12),
            *(self._body(220 + 12 * i) for i in range(5)),
        )

        headings = [e.text for e in self.svc.extract_elements([page]) if e.element_type == "heading"]

        assert headings == ["2 Methods", "2.1 Data", "3 Results", "3.1 Accuracy"]

    def test_numbered_heading_beside_a_short_line_in_the_other_column(self):
        # Codex r2: the right column's last paragraph line ("therefore.") is narrow,
        # but it is body text, smaller than the heading. A value cell in a table
        # row shares the label's size.
        page = self._page(
            self._body(60),
            BlockInfo(page=1, text="2 Background", bbox=(72, 100, 160, 112), font_size=12),
            BlockInfo(page=1, text="therefore.", bbox=(320, 101, 382, 111), font_size=10),
            *(self._body(130 + 14 * i) for i in range(5)),
        )

        headings = [e.text for e in self.svc.extract_elements([page]) if e.element_type == "heading"]

        assert headings == ["2 Background"]
