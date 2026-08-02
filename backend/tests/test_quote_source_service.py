"""Tests for the verification-source selector (B2, plan §8.1/§9).

Honest trust labels: a quote card can only claim "verified against page text"
when the ENTIRE cited page range has real Page.content (B1). If even one page
in range is missing content (legacy doc, or a page row that never persisted),
the selector falls back to the cited chunk's text ± neighbours and is labelled
"verified against extracted text" instead — never silently upgraded.
"""
from __future__ import annotations

import sys
import uuid
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.services.quote_source_service import (  # noqa: E402
    QuoteSource,
    build_quote_source,
)

DOCUMENT_ID = uuid.uuid4()


def _page(page_number: int, content: str | None):
    return SimpleNamespace(page_number=page_number, content=content)


def _chunk(text: str, page_start: int, page_end: int, chunk_index: int, chunk_id=None):
    return SimpleNamespace(
        id=chunk_id or uuid.uuid4(),
        document_id=DOCUMENT_ID,
        text=text,
        page_start=page_start,
        page_end=page_end,
        chunk_index=chunk_index,
    )


def _fake_db(page_rows):
    """db.execute(select(Page)...) -> canned scalars().all()."""
    class _Scalars:
        def all(self_inner):
            return page_rows

    result = SimpleNamespace(scalars=lambda: _Scalars())
    return SimpleNamespace(execute=AsyncMock(return_value=result))


class TestPageTextWhenComplete:
    @pytest.mark.asyncio
    async def test_single_page_chunk_with_full_page_content_uses_page_text(self):
        chunk = _chunk("cited chunk text", page_start=3, page_end=3, chunk_index=5)
        db = _fake_db([_page(3, "Full raw page three content.")])

        source = await build_quote_source(db, DOCUMENT_ID, chunk, [])

        assert source == QuoteSource(
            text="Full raw page three content.",
            kind="page_text",
            page_start=3,
            page_end=3,
        )

    @pytest.mark.asyncio
    async def test_multi_page_chunk_with_all_pages_content_concatenates_in_page_order(self):
        chunk = _chunk("cited chunk text", page_start=2, page_end=4, chunk_index=1)
        # Deliberately out-of-order rows — selector must sort by page_number.
        db = _fake_db([
            _page(4, "Page four."),
            _page(2, "Page two."),
            _page(3, "Page three."),
        ])

        source = await build_quote_source(db, DOCUMENT_ID, chunk, [])

        assert source.kind == "page_text"
        assert source.page_start == 2
        assert source.page_end == 4
        assert source.text == "Page two.\nPage three.\nPage four."


class TestExtractedTextFallback:
    @pytest.mark.asyncio
    async def test_any_missing_page_content_falls_back_to_chunk_and_neighbors(self):
        chunk = _chunk("cited chunk text", page_start=2, page_end=3, chunk_index=5)
        neighbor = _chunk("neighbor chunk text", page_start=3, page_end=3, chunk_index=6)
        # Page 3 has no content — one missing page must reject the whole range.
        db = _fake_db([_page(2, "Page two content."), _page(3, None)])

        source = await build_quote_source(db, DOCUMENT_ID, chunk, [neighbor])

        assert source.kind == "extracted_text"
        assert source.page_start == 2
        assert source.page_end == 3
        assert "cited chunk text" in source.text
        assert "neighbor chunk text" in source.text
        # Document order: chunk_index 5 before 6.
        assert source.text.index("cited chunk text") < source.text.index("neighbor chunk text")

    @pytest.mark.asyncio
    async def test_no_page_rows_at_all_falls_back_to_extracted_text(self):
        chunk = _chunk("only source available", page_start=1, page_end=1, chunk_index=0)
        db = _fake_db([])  # legacy doc: no Page rows persisted at all

        source = await build_quote_source(db, DOCUMENT_ID, chunk, [])

        assert source.kind == "extracted_text"
        assert source.text == "only source available"

    @pytest.mark.asyncio
    async def test_neighbors_joined_in_document_order_regardless_of_argument_order(self):
        chunk = _chunk("middle chunk", page_start=5, page_end=5, chunk_index=10)
        before = _chunk("before chunk", page_start=4, page_end=4, chunk_index=9)
        after = _chunk("after chunk", page_start=6, page_end=6, chunk_index=11)
        db = _fake_db([_page(5, None)])  # forces extracted_text fallback

        # Pass neighbors in reverse/scrambled order — output must still be sorted.
        source = await build_quote_source(db, DOCUMENT_ID, chunk, [after, before])

        assert source.kind == "extracted_text"
        idx_before = source.text.index("before chunk")
        idx_middle = source.text.index("middle chunk")
        idx_after = source.text.index("after chunk")
        assert idx_before < idx_middle < idx_after

    @pytest.mark.asyncio
    async def test_duplicate_chunk_in_neighbors_is_not_repeated(self):
        chunk = _chunk("solo chunk", page_start=1, page_end=1, chunk_index=0, chunk_id=uuid.uuid4())
        db = _fake_db([_page(1, None)])

        # Caller accidentally includes the cited chunk itself as a "neighbor".
        source = await build_quote_source(db, DOCUMENT_ID, chunk, [chunk])

        assert source.text.count("solo chunk") == 1
