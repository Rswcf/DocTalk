"""Tests for the verified quote-search service (B3, plan §8.3 + §9 scout).

"LLM proposes, verifier disposes" end-to-end: retrieval/candidate-expansion
and the source selector (B2) are stubbed so these tests isolate the part that
actually carries verbatim-guarantee risk — ref validation, verify_quote
disposition, and §8.1 dedup — against a REAL verify_quote + text_normalizer.
Only the LLM call is mocked (same style as test_citation_quote_service.py).
"""
from __future__ import annotations

import json
import sys
import types
import uuid
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

import app.services.quote_search_service as qss  # noqa: E402
from app.services.quote_search_service import QuoteSource, quote_search  # noqa: E402

DOCUMENT_ID = uuid.uuid4()


def _document(**overrides):
    base = dict(id=DOCUMENT_ID, page_count=10, text_quality=0.95, parse_method="text")
    base.update(overrides)
    return SimpleNamespace(**base)


def _chunk(text: str, page_start: int, page_end: int, chunk_index: int, bboxes=None, chunk_id=None):
    return SimpleNamespace(
        id=chunk_id or uuid.uuid4(),
        document_id=DOCUMENT_ID,
        text=text,
        page_start=page_start,
        page_end=page_end,
        chunk_index=chunk_index,
        bboxes=bboxes or [],
    )


def _llm_client(quotes_payload: dict) -> types.SimpleNamespace:
    resp = types.SimpleNamespace(
        choices=[types.SimpleNamespace(message=types.SimpleNamespace(content=json.dumps(quotes_payload)))],
        usage=types.SimpleNamespace(prompt_tokens=42, completion_tokens=17),
    )
    client = types.SimpleNamespace()
    client.chat = types.SimpleNamespace()
    client.chat.completions = types.SimpleNamespace(create=AsyncMock(return_value=resp))
    return client


def _fake_db():
    """Generic stand-in for neighbor-chunk lookups; build_quote_source itself
    is monkeypatched in every test below, so the query result is unused."""
    class _Scalars:
        def all(self_inner):
            return []
    result = SimpleNamespace(scalars=lambda: _Scalars())
    return SimpleNamespace(execute=AsyncMock(return_value=result))


def _patch_common(monkeypatch, *, candidates, scanned_chunks, quotes_payload, source_by_chunk_id=None):
    async def fake_build_candidates(_db, _document, _topic):
        return candidates, scanned_chunks

    monkeypatch.setattr(qss, "_build_candidates", fake_build_candidates)
    monkeypatch.setattr(qss, "_get_llm_client", lambda _model: _llm_client(quotes_payload))

    source_by_chunk_id = source_by_chunk_id or {}

    async def fake_build_quote_source(_db, _document_id, chunk, _neighbors):
        return source_by_chunk_id[chunk.id]

    monkeypatch.setattr(qss, "build_quote_source", fake_build_quote_source)


SOURCE = (
    "Fluency is the most prized quality in translation today, and it renders "
    "the translator's labour invisible to the reader."
)


class TestVerifiedExactQuote:
    @pytest.mark.asyncio
    async def test_exact_quote_becomes_card_with_raw_slice_display(self, monkeypatch):
        chunk = _chunk(SOURCE, page_start=4, page_end=4, chunk_index=0)
        _patch_common(
            monkeypatch,
            candidates=[chunk],
            scanned_chunks=12,
            quotes_payload={"quotes": [
                {"quote_text": "the most prized quality in translation today", "source_ref_n": 1, "page": 4}
            ]},
            source_by_chunk_id={chunk.id: QuoteSource(text=SOURCE, kind="extracted_text", page_start=4, page_end=4)},
        )

        result = await quote_search(_fake_db(), document=_document(), user=None, topic="fluency", locale="en")

        assert result.proposed == 1
        assert result.verified == 1
        assert result.discarded == []
        assert result.scanned_chunks == 12
        assert result.usage == (42, 17)
        assert result.model == qss.MODEL
        assert len(result.cards) == 1
        card = result.cards[0]
        assert card.display_text == "the most prized quality in translation today"
        assert card.tier == "exact"
        assert card.source_kind == "extracted_text"
        assert card.page == 4
        assert card.page_end == 4
        assert card.chunk_id == str(chunk.id)
        assert card.score == 100.0


class TestParaphraseDiscarded:
    @pytest.mark.asyncio
    async def test_llm_paraphrase_not_verbatim_in_source_is_discarded(self, monkeypatch):
        chunk = _chunk(SOURCE, page_start=1, page_end=1, chunk_index=0)
        _patch_common(
            monkeypatch,
            candidates=[chunk],
            scanned_chunks=5,
            quotes_payload={"quotes": [
                {"quote_text": "The committee approved the merger next fiscal quarter.", "source_ref_n": 1, "page": 1}
            ]},
            source_by_chunk_id={chunk.id: QuoteSource(text=SOURCE, kind="extracted_text", page_start=1, page_end=1)},
        )

        result = await quote_search(_fake_db(), document=_document(), user=None, topic="mergers", locale="en")

        assert result.cards == []
        assert result.verified == 0
        assert result.proposed == 1
        assert len(result.discarded) == 1
        reason, tier, score = result.discarded[0]
        assert tier == "dropped"
        assert score == 0.0


class TestHallucinatedRefDiscarded:
    @pytest.mark.asyncio
    async def test_out_of_range_ref_n_is_discarded_not_crashed(self, monkeypatch):
        chunk = _chunk(SOURCE, page_start=1, page_end=1, chunk_index=0)
        _patch_common(
            monkeypatch,
            candidates=[chunk],  # only 1 candidate — ref_n=5 is out of range
            scanned_chunks=3,
            quotes_payload={"quotes": [
                {"quote_text": "the most prized quality in translation today", "source_ref_n": 5, "page": 1}
            ]},
            source_by_chunk_id={chunk.id: QuoteSource(text=SOURCE, kind="extracted_text", page_start=1, page_end=1)},
        )

        result = await quote_search(_fake_db(), document=_document(), user=None, topic="fluency", locale="en")

        assert result.cards == []
        assert result.verified == 0
        assert result.proposed == 1
        assert result.discarded == [("ref_out_of_range", "n/a", 0.0)]


class TestDuplicateQuoteInOverlappingChunksCollapses:
    @pytest.mark.asyncio
    async def test_same_quote_from_two_overlapping_chunks_yields_one_card(self, monkeypatch):
        # Adjacent chunks overlap (parse-time OVERLAP_TOKENS) — the SAME real
        # occurrence can be located via either chunk's source text.
        chunk_a = _chunk("chunk A text", page_start=2, page_end=2, chunk_index=0)
        chunk_b = _chunk("chunk B text", page_start=2, page_end=2, chunk_index=1)
        shared_source = QuoteSource(text=SOURCE, kind="extracted_text", page_start=2, page_end=2)
        _patch_common(
            monkeypatch,
            candidates=[chunk_a, chunk_b],
            scanned_chunks=8,
            quotes_payload={"quotes": [
                {"quote_text": "the most prized quality in translation today", "source_ref_n": 1, "page": 2},
                {"quote_text": "the most prized quality in translation today", "source_ref_n": 2, "page": 2},
            ]},
            source_by_chunk_id={chunk_a.id: shared_source, chunk_b.id: shared_source},
        )

        result = await quote_search(_fake_db(), document=_document(), user=None, topic="fluency", locale="en")

        assert result.proposed == 2
        assert result.verified == 1
        assert len(result.cards) == 1
        assert result.discarded == []


class TestEmptyProposals:
    @pytest.mark.asyncio
    async def test_empty_quotes_list_returns_empty_result_with_counts(self, monkeypatch):
        chunk = _chunk(SOURCE, page_start=1, page_end=1, chunk_index=0)
        _patch_common(
            monkeypatch,
            candidates=[chunk],
            scanned_chunks=9,
            quotes_payload={"quotes": []},
            source_by_chunk_id={chunk.id: QuoteSource(text=SOURCE, kind="extracted_text", page_start=1, page_end=1)},
        )

        result = await quote_search(_fake_db(), document=_document(), user=None, topic="nothing relevant", locale="en")

        assert result.cards == []
        assert result.proposed == 0
        assert result.verified == 0
        assert result.discarded == []
        assert result.scanned_chunks == 9
        assert result.usage == (42, 17)
        assert result.model == qss.MODEL

    @pytest.mark.asyncio
    async def test_no_candidates_short_circuits_without_llm_call(self, monkeypatch):
        async def fake_build_candidates(_db, _document, _topic):
            return [], 0

        monkeypatch.setattr(qss, "_build_candidates", fake_build_candidates)
        llm_called = []
        monkeypatch.setattr(qss, "_get_llm_client", lambda _model: llm_called.append(1) or _llm_client({"quotes": []}))

        result = await quote_search(_fake_db(), document=_document(), user=None, topic="anything", locale="en")

        assert result.cards == []
        assert result.proposed == 0
        assert result.verified == 0
        assert result.usage == (0, 0)
        assert llm_called == []  # no candidates -> no LLM call


class TestTermScanCandidates:
    """Pure unit coverage for the deterministic normalized term/phrase scan
    (§8.3 candidate expansion) — no DB/LLM involved."""

    def test_phrase_match_and_no_match(self):
        hit = _chunk("The full phrase authorial voice appears here.", 1, 1, 0)
        miss = _chunk("Completely unrelated content about weather.", 2, 2, 1)

        hits = qss._term_scan_candidates([hit, miss], "authorial voice")

        assert hits == [hit]

    def test_empty_topic_yields_no_hits(self):
        chunk = _chunk("Some content.", 1, 1, 0)
        assert qss._term_scan_candidates([chunk], "   ") == []
