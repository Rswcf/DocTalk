"""Tests for forward-only PDF page-text persistence (B1, plan §8.1/§9).

`pages.content` is NULL for every PDF today because only the non-PDF branch of
the parse worker populates it. This closes that gap for NEW/re-parsed PDFs by
capturing `page.get_text("text")` during the EXISTING PyMuPDF pass (no extra
document open) and feeding it through the same `extracted_content_map`
mechanism the non-PDF branch already uses.

Three layers:
1. `ParseService.extract_pages` / `extract_pages_ocr` now also return each
   page's raw linear text (`PageInfo.raw_text`), captured on the SAME open
   `fitz.Page` object used for block extraction.
2. `parse_worker.parse_document`'s PDF branch feeds `raw_text` into
   `extracted_content_map`, which the shared persist-pages loop (already
   written for non-PDF) uses to set `Page.content`.
3. KNOWN INTERACTION (not a code change — `get_document_text_content` already
   prefers `Page.content` when present): newly-parsed PDFs now take that
   branch instead of the chunk-concatenation fallback. Verified explicitly
   here, not discovered.
"""
from __future__ import annotations

import sys
import uuid
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock

import fitz
import pytest

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.services.parse_service import ParseService  # noqa: E402
from app.workers import parse_worker  # noqa: E402


def _build_two_page_pdf() -> bytes:
    doc = fitz.open()
    p1 = doc.new_page(width=612, height=792)
    p1.insert_text((72, 72), "Hello page one.\nSecond line here.")
    p2 = doc.new_page(width=612, height=792)
    p2.insert_text((72, 72), "Hello page two content.")
    data = doc.tobytes()
    doc.close()
    return data


def _expected_raw_text_per_page(pdf_bytes: bytes) -> dict[int, str]:
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    try:
        return {pi: page.get_text("text") for pi, page in enumerate(doc, start=1)}
    finally:
        doc.close()


class TestExtractPagesCapturesRawText:
    """Layer 1: ParseService captures page.get_text('text') during the existing pass."""

    def test_every_page_raw_text_matches_pymupdf_get_text(self):
        pdf_bytes = _build_two_page_pdf()
        expected = _expected_raw_text_per_page(pdf_bytes)

        pages = ParseService().extract_pages(pdf_bytes)

        assert len(pages) == 2
        for page_info in pages:
            assert page_info.raw_text == expected[page_info.page_number]
            assert page_info.raw_text.strip() != ""


class TestParseWorkerPersistsPdfPageContent:
    """Layer 2: parse_worker's PDF branch wires raw_text into extracted_content_map
    -> Page.content, mirroring the non-PDF branch (no change to the shared
    persist-pages loop itself)."""

    def _run_pdf_parse(self, monkeypatch, *, page_texts: dict[int, str]):
        doc_id = uuid.uuid4()
        doc = SimpleNamespace(
            id=doc_id,
            storage_key="documents/example.pdf",
            file_type="pdf",
            converted_storage_key=None,
            status="parsing",
            page_count=None,
            pages_parsed=0,
            chunks_total=0,
            chunks_indexed=0,
            summary=None,
            suggested_questions=None,
            error_msg=None,
        )

        class _StubParseSession:
            def __init__(self, doc):
                self._doc = doc
                self.added: list[object] = []
                self.commits = 0

            def __enter__(self):
                return self

            def __exit__(self, exc_type, exc, tb):
                return False

            def get(self, _model, _doc_id):
                return self._doc

            def add(self, obj):
                self.added.append(obj)

            def commit(self):
                self.commits += 1

            def execute(self, _stmt):
                return None

            def rollback(self):
                return None

        stub_session = _StubParseSession(doc)
        monkeypatch.setattr(parse_worker, "SyncSessionLocal", lambda: stub_session)
        monkeypatch.setattr(parse_worker, "_download_file_bytes", lambda *_a, **_k: b"%PDF-1.4\nfake")
        monkeypatch.setattr(parse_worker.settings, "OCR_ENABLED", False)

        monkeypatch.setattr(parse_worker.embedding_service, "ensure_collection", lambda *_a, **_k: None)

        class _StubQdrant:
            def delete(self, *_a, **_k):
                return None

        monkeypatch.setattr(parse_worker.embedding_service, "get_qdrant_client", lambda *_a, **_k: _StubQdrant())

        class _FakeParseService:
            def extract_pages(self, _pdf_bytes: bytes):
                return [
                    SimpleNamespace(
                        page_number=pn,
                        width_pt=612.0,
                        height_pt=792.0,
                        rotation=0,
                        blocks=[SimpleNamespace(text=text, bbox=(0, 0, 1, 1), font_size=12.0, page=pn)],
                        raw_text=text,
                    )
                    for pn, text in page_texts.items()
                ]

            def detect_scanned(self, _pages) -> bool:
                return False

        monkeypatch.setattr(parse_worker, "ParseService", _FakeParseService)
        monkeypatch.setattr(
            parse_worker, "detect_low_quality_text", lambda _pages, file_type=None: (False, 0.95)
        )

        # Stop right after page persistence — chunking/embedding are out of
        # scope for this test; SoftTimeLimitExceeded is not raised so a Chunk
        # persistence exception further down is caught and logged, harmless.
        parse_worker.parse_document.run(str(doc_id))
        return stub_session

    def test_pdf_page_rows_get_raw_text_content(self, monkeypatch):
        page_texts = {1: "Hello page one.\nSecond line here.\n", 2: "Hello page two content.\n"}
        stub_session = self._run_pdf_parse(monkeypatch, page_texts=page_texts)

        from app.models.tables import Page

        persisted_pages = [obj for obj in stub_session.added if isinstance(obj, Page)]
        assert len(persisted_pages) == 2
        by_number = {p.page_number: p.content for p in persisted_pages}
        assert by_number == page_texts


class TestGetDocumentTextContentInteraction:
    """Layer 3 (KNOWN INTERACTION, no code change): get_document_text_content
    already prefers Page.content when present, else falls back to chunk
    concatenation. Verified deliberately for a PDF now that Page.content is
    populated for PDFs too."""

    @staticmethod
    def _page(page_number: int, content: str | None):
        return SimpleNamespace(page_number=page_number, content=content)

    @staticmethod
    def _chunk(text: str, page_start: int, page_end: int, section_title: str | None = None):
        return SimpleNamespace(text=text, page_start=page_start, page_end=page_end, section_title=section_title)

    def _fake_db(self, *, page_rows, section_chunks, fallback_chunks):
        """Sequential db.execute() calls in the exact order the endpoint issues
        them: (1) Page query, (2) section-title Chunk query, (3, only when no
        page has content) fallback Chunk query."""
        calls = {"n": 0}

        def _scalars_result(values):
            class _Scalars:
                def all(self_inner):
                    return values
            return SimpleNamespace(scalars=lambda: _Scalars())

        async def execute(_stmt):
            calls["n"] += 1
            if calls["n"] == 1:
                return _scalars_result(page_rows)
            if calls["n"] == 2:
                return _scalars_result(section_chunks)
            return _scalars_result(fallback_chunks)

        return SimpleNamespace(execute=AsyncMock(side_effect=execute))

    @pytest.mark.asyncio
    async def test_pdf_with_page_content_uses_page_text_not_chunks(self, monkeypatch):
        import app.api.documents as documents_module

        doc = SimpleNamespace(id=uuid.uuid4(), file_type="pdf", filename="report.pdf", source_url=None, page_count=2)
        monkeypatch.setattr(documents_module.doc_service, "get_document", AsyncMock(return_value=doc))
        monkeypatch.setattr(documents_module, "can_access_document", lambda *_a, **_k: True)

        page_rows = [self._page(1, "Raw page-one text."), self._page(2, "Raw page-two text.")]
        # A chunk-reconstruction fallback that would produce DIFFERENT text —
        # proves the page-text branch, not the fallback, was used.
        fallback_chunks = [self._chunk("CHUNK RECONSTRUCTED TEXT", 1, 2)]
        db = self._fake_db(page_rows=page_rows, section_chunks=[], fallback_chunks=fallback_chunks)

        result = await documents_module.get_document_text_content(doc.id, user=None, db=db)

        assert result["pages"] == [
            {"page_number": 1, "text": "Raw page-one text.", "section_title": None},
            {"page_number": 2, "text": "Raw page-two text.", "section_title": None},
        ]

    @pytest.mark.asyncio
    async def test_legacy_pdf_without_page_content_falls_back_to_chunks(self, monkeypatch):
        import app.api.documents as documents_module

        doc = SimpleNamespace(id=uuid.uuid4(), file_type="pdf", filename="legacy.pdf", source_url=None, page_count=2)
        monkeypatch.setattr(documents_module.doc_service, "get_document", AsyncMock(return_value=doc))
        monkeypatch.setattr(documents_module, "can_access_document", lambda *_a, **_k: True)

        # Pre-B1 PDF: every Page row has content=None.
        page_rows = [self._page(1, None), self._page(2, None)]
        fallback_chunks = [self._chunk("Chunk-reconstructed page one.", 1, 1)]
        db = self._fake_db(page_rows=page_rows, section_chunks=[], fallback_chunks=fallback_chunks)

        result = await documents_module.get_document_text_content(doc.id, user=None, db=db)

        assert result["pages"] == [
            {"page_number": 1, "text": "Chunk-reconstructed page one.", "section_title": None},
        ]

    @pytest.mark.asyncio
    async def test_mixed_content_pdf_falls_back_to_chunks_not_partial_page_text(self, monkeypatch):
        """FIX-8 (Codex r1 MINOR #8): a document where SOME pages have
        Page.content and others don't (partial/mixed persistence) must fall
        back to full chunk reconstruction for the WHOLE document — never
        silently drop the pages without content while serving page-text for
        the rest (the prior any()-gated branch did exactly that)."""
        import app.api.documents as documents_module

        doc = SimpleNamespace(id=uuid.uuid4(), file_type="pdf", filename="mixed.pdf", source_url=None, page_count=2)
        monkeypatch.setattr(documents_module.doc_service, "get_document", AsyncMock(return_value=doc))
        monkeypatch.setattr(documents_module, "can_access_document", lambda *_a, **_k: True)

        # page 1 has content, page 2 does NOT (mixed persistence).
        page_rows = [self._page(1, "Raw page-one text."), self._page(2, None)]
        fallback_chunks = [
            self._chunk("Chunk-reconstructed page one.", 1, 1),
            self._chunk("Chunk-reconstructed page two.", 2, 2),
        ]
        db = self._fake_db(page_rows=page_rows, section_chunks=[], fallback_chunks=fallback_chunks)

        result = await documents_module.get_document_text_content(doc.id, user=None, db=db)

        # Falls back to chunk reconstruction for BOTH pages — page 2 is not
        # silently dropped, and page 1 isn't served partial page-text either.
        assert result["pages"] == [
            {"page_number": 1, "text": "Chunk-reconstructed page one.", "section_title": None},
            {"page_number": 2, "text": "Chunk-reconstructed page two.", "section_title": None},
        ]

    @pytest.mark.asyncio
    async def test_whitespace_only_page_content_also_triggers_fallback(self, monkeypatch):
        """A page with content == "" or whitespace-only counts as NOT having
        real content — same non-blank bar B2's build_quote_source() uses."""
        import app.api.documents as documents_module

        doc = SimpleNamespace(id=uuid.uuid4(), file_type="pdf", filename="blank.pdf", source_url=None, page_count=2)
        monkeypatch.setattr(documents_module.doc_service, "get_document", AsyncMock(return_value=doc))
        monkeypatch.setattr(documents_module, "can_access_document", lambda *_a, **_k: True)

        page_rows = [self._page(1, "Raw page-one text."), self._page(2, "   ")]
        fallback_chunks = [self._chunk("Chunk-reconstructed.", 1, 2)]
        db = self._fake_db(page_rows=page_rows, section_chunks=[], fallback_chunks=fallback_chunks)

        result = await documents_module.get_document_text_content(doc.id, user=None, db=db)

        # The chunk spans pages 1-2, so fallback reconstruction yields BOTH.
        assert result["pages"] == [
            {"page_number": 1, "text": "Chunk-reconstructed.", "section_title": None},
            {"page_number": 2, "text": "Chunk-reconstructed.", "section_title": None},
        ]

    @pytest.mark.asyncio
    async def test_codex_r2_probe_missing_page_row_in_the_middle_falls_back_to_chunks(self, monkeypatch):
        """FIX2-D (Codex r2 #8, NOT ADDRESSED): Codex's exact probe — a
        3-page document (doc.page_count=3) with Page ROWS only for pages 1
        and 3 (page 2's row is entirely MISSING, not merely blank). Both
        existing rows have real content, so the prior all(content)-only
        check trivially passed over just those 2 rows and silently dropped
        page 2 entirely. Must require complete, consecutive 1..page_count
        coverage and fall back to chunks when it's missing."""
        import app.api.documents as documents_module

        doc = SimpleNamespace(
            id=uuid.uuid4(), file_type="pdf", filename="gap.pdf", source_url=None, page_count=3,
        )
        monkeypatch.setattr(documents_module.doc_service, "get_document", AsyncMock(return_value=doc))
        monkeypatch.setattr(documents_module, "can_access_document", lambda *_a, **_k: True)

        # doc.page_count=3, but only rows for pages 1 and 3 exist — page 2's
        # row is entirely missing (not present at all, not merely blank).
        page_rows = [self._page(1, "Raw page-one text."), self._page(3, "Raw page-three text.")]
        fallback_chunks = [
            self._chunk("Chunk-reconstructed page one.", 1, 1),
            self._chunk("Chunk-reconstructed page two.", 2, 2),
            self._chunk("Chunk-reconstructed page three.", 3, 3),
        ]
        db = self._fake_db(page_rows=page_rows, section_chunks=[], fallback_chunks=fallback_chunks)

        result = await documents_module.get_document_text_content(doc.id, user=None, db=db)

        # Falls back to chunk reconstruction for ALL THREE pages — page 2
        # is never silently omitted from the response.
        assert result["pages"] == [
            {"page_number": 1, "text": "Chunk-reconstructed page one.", "section_title": None},
            {"page_number": 2, "text": "Chunk-reconstructed page two.", "section_title": None},
            {"page_number": 3, "text": "Chunk-reconstructed page three.", "section_title": None},
        ]

    @pytest.mark.asyncio
    async def test_unknown_page_count_fails_closed_to_chunk_fallback(self, monkeypatch):
        """doc.page_count is None (unparsed/unknown) — completeness cannot
        be verified against an unknown total, so this fails closed to
        chunk reconstruction rather than trusting whatever rows happen to
        exist."""
        import app.api.documents as documents_module

        doc = SimpleNamespace(
            id=uuid.uuid4(), file_type="pdf", filename="unknown-count.pdf", source_url=None, page_count=None,
        )
        monkeypatch.setattr(documents_module.doc_service, "get_document", AsyncMock(return_value=doc))
        monkeypatch.setattr(documents_module, "can_access_document", lambda *_a, **_k: True)

        page_rows = [self._page(1, "Raw page-one text."), self._page(2, "Raw page-two text.")]
        fallback_chunks = [self._chunk("Chunk-reconstructed.", 1, 2)]
        db = self._fake_db(page_rows=page_rows, section_chunks=[], fallback_chunks=fallback_chunks)

        result = await documents_module.get_document_text_content(doc.id, user=None, db=db)

        assert result["pages"] == [
            {"page_number": 1, "text": "Chunk-reconstructed.", "section_title": None},
            {"page_number": 2, "text": "Chunk-reconstructed.", "section_title": None},
        ]
