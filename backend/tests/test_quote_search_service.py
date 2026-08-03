"""Tests for the verified quote-search service (B3, plan §8.3 + §9 scout).

"LLM proposes, verifier disposes" end-to-end: retrieval/candidate-expansion
and the source selector (B2) are stubbed so these tests isolate the part that
actually carries verbatim-guarantee risk — ref validation, verify_quote
disposition, and §8.1 dedup — against a REAL verify_quote + text_normalizer.
Only the LLM call is mocked (same style as test_citation_quote_service.py).

FIX-2 (Codex r1 BLOCKER #2, page attribution): verification runs per
QuoteSource segment (never against a concatenated multi-page/multi-chunk
blob), and QuoteCard.page/page_end/bboxes/chunk_id are derived from the
SEGMENT that actually verified — never a majority-vote guess over the whole
candidate chunk's bbox distribution. `TestPageAttributionFromVerifiedSlice`
reproduces Codex's exact repro case as a regression test.
"""
from __future__ import annotations

import hashlib
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
from app.services.quote_search_service import (  # noqa: E402
    QuoteSource,
    QuoteSourceSegment,
    quote_search,
)

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


def _chunk_source(chunk, *, text=None, kind="extracted_text") -> QuoteSource:
    """A single-segment extracted_text QuoteSource matching one chunk — the
    common case for tests that don't care about multi-segment attribution."""
    segment_text = text if text is not None else chunk.text
    segment = QuoteSourceSegment(
        text=segment_text, page_start=chunk.page_start, page_end=chunk.page_end,
        chunk_id=chunk.id, bboxes=list(chunk.bboxes or []),
    )
    return QuoteSource(
        text=segment_text, kind=kind, page_start=chunk.page_start, page_end=chunk.page_end,
        segments=[segment],
    )


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
            source_by_chunk_id={chunk.id: _chunk_source(chunk, text=SOURCE)},
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
            source_by_chunk_id={chunk.id: _chunk_source(chunk, text=SOURCE)},
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
            source_by_chunk_id={chunk.id: _chunk_source(chunk, text=SOURCE)},
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
        _patch_common(
            monkeypatch,
            candidates=[chunk_a, chunk_b],
            scanned_chunks=8,
            quotes_payload={"quotes": [
                {"quote_text": "the most prized quality in translation today", "source_ref_n": 1, "page": 2},
                {"quote_text": "the most prized quality in translation today", "source_ref_n": 2, "page": 2},
            ]},
            source_by_chunk_id={
                chunk_a.id: _chunk_source(chunk_a, text=SOURCE),
                chunk_b.id: _chunk_source(chunk_b, text=SOURCE),
            },
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
            source_by_chunk_id={chunk.id: _chunk_source(chunk, text=SOURCE)},
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


class TestSearchTelemetryFields:
    """FIX-6 (Codex r1 IMPORTANT #6): QuoteSearchResult must carry
    retrieved_count, candidate_pages, and no_result per the locked §8.3
    telemetry contract (2026-06-12-quote-finder-evidence-board.md)."""

    @pytest.mark.asyncio
    async def test_verified_result_reports_retrieved_count_and_candidate_pages(self, monkeypatch):
        chunk_a = _chunk(SOURCE, page_start=4, page_end=4, chunk_index=0)
        chunk_b = _chunk("A second, unrelated candidate.", page_start=6, page_end=7, chunk_index=1)
        _patch_common(
            monkeypatch,
            candidates=[chunk_a, chunk_b],
            scanned_chunks=12,
            quotes_payload={"quotes": [
                {"quote_text": "the most prized quality in translation today", "source_ref_n": 1, "page": 4}
            ]},
            source_by_chunk_id={
                chunk_a.id: _chunk_source(chunk_a, text=SOURCE),
                chunk_b.id: _chunk_source(chunk_b),
            },
        )

        result = await quote_search(_fake_db(), document=_document(), user=None, topic="fluency", locale="en")

        assert result.retrieved_count == 2  # both candidates handed to the LLM
        assert result.candidate_pages == 3  # page 4 (chunk_a) + pages 6,7 (chunk_b)
        assert result.no_result is False  # one card verified

    @pytest.mark.asyncio
    async def test_no_verified_cards_sets_no_result_true_despite_candidates(self, monkeypatch):
        chunk = _chunk(SOURCE, page_start=1, page_end=1, chunk_index=0)
        _patch_common(
            monkeypatch,
            candidates=[chunk],
            scanned_chunks=5,
            quotes_payload={"quotes": [
                {"quote_text": "The committee approved the merger next fiscal quarter.", "source_ref_n": 1, "page": 1}
            ]},
            source_by_chunk_id={chunk.id: _chunk_source(chunk, text=SOURCE)},
        )

        result = await quote_search(_fake_db(), document=_document(), user=None, topic="mergers", locale="en")

        assert result.retrieved_count == 1  # a candidate WAS retrieved...
        assert result.no_result is True  # ...but nothing verified

    @pytest.mark.asyncio
    async def test_no_candidates_reports_zero_retrieved_and_no_result(self, monkeypatch):
        async def fake_build_candidates(_db, _document, _topic):
            return [], 0

        monkeypatch.setattr(qss, "_build_candidates", fake_build_candidates)

        result = await quote_search(_fake_db(), document=_document(), user=None, topic="anything", locale="en")

        assert result.retrieved_count == 0
        assert result.candidate_pages == 0
        assert result.no_result is True


class TestAmbiguousMultiPageExtractedSegmentDiscarded:
    """FIX2-A(a) (Codex r2 #2, NOT ADDRESSED): an extracted_text segment
    spanning multiple pages (its own page_start != page_end) has no
    reliable way to attribute a match to a single page — majority-bbox
    voting over the segment's whole bbox pool doesn't reflect which page
    the matched TEXT actually sits on. Codex's exact adversarial probe:
    segment range p1-2, quote physically in the page-1 portion, bboxes
    1xp1 + 2xp2 (majority vote would pick p2) — must discard, never report
    page=2/page_end=2 with page-2 bboxes."""

    @pytest.mark.asyncio
    async def test_codex_r2_probe_quote_in_p1_portion_of_p1_2_segment_is_discarded(self, monkeypatch):
        p1_bbox = {"x": 0.1, "y": 0.1, "w": 0.2, "h": 0.05, "page": 1}
        p2_bbox_a = {"x": 0.1, "y": 0.1, "w": 0.2, "h": 0.05, "page": 2}
        p2_bbox_b = {"x": 0.1, "y": 0.2, "w": 0.2, "h": 0.05, "page": 2}
        chunk = _chunk(
            "unused chunk text", page_start=1, page_end=2, chunk_index=0,
            bboxes=[p1_bbox, p2_bbox_a, p2_bbox_b],
        )
        source = QuoteSource(
            text="unused", kind="extracted_text", page_start=1, page_end=2,
            segments=[
                QuoteSourceSegment(
                    text="The quote lives in the page-1 portion of this chunk. Filler continues onto page two.",
                    page_start=1, page_end=2, chunk_id=chunk.id,
                    bboxes=[p1_bbox, p2_bbox_a, p2_bbox_b],
                ),
            ],
        )
        _patch_common(
            monkeypatch,
            candidates=[chunk],
            scanned_chunks=1,
            quotes_payload={"quotes": [
                {"quote_text": "The quote lives in the page-1 portion of this chunk.", "source_ref_n": 1, "page": 1}
            ]},
            source_by_chunk_id={chunk.id: source},
        )

        result = await quote_search(_fake_db(), document=_document(), user=None, topic="quote", locale="en")

        assert result.cards == []
        assert result.verified == 0
        assert len(result.discarded) == 1
        reason, _tier, _score = result.discarded[0]
        assert reason == "ambiguous_page_range"

    @pytest.mark.asyncio
    async def test_single_page_extracted_segment_is_unaffected(self, monkeypatch):
        """A single-page (page_start == page_end) extracted_text segment
        must NOT be discarded — only multi-page segments are ambiguous."""
        bbox = {"x": 0.1, "y": 0.1, "w": 0.2, "h": 0.05, "page": 3}
        chunk = _chunk("The exact quoted sentence here.", page_start=3, page_end=3, chunk_index=0, bboxes=[bbox])
        _patch_common(
            monkeypatch,
            candidates=[chunk],
            scanned_chunks=1,
            quotes_payload={"quotes": [
                {"quote_text": "The exact quoted sentence here.", "source_ref_n": 1, "page": 3}
            ]},
            source_by_chunk_id={chunk.id: _chunk_source(chunk)},
        )

        result = await quote_search(_fake_db(), document=_document(), user=None, topic="quoted", locale="en")

        assert result.verified == 1
        assert result.cards[0].page == 3
        assert result.cards[0].page_end == 3


class TestPageTextDuplicateWordingAcrossPagesEmitsOneCardPerPage:
    """FIX2-A(b) (Codex r2 #2, NOT ADDRESSED): "first segment wins" silently
    dropped genuine duplicate occurrences of the SAME exact wording on
    different pages within the cited chunk's own page_text range. Must
    emit ONE card per matching page instead."""

    @pytest.mark.asyncio
    async def test_identical_wording_on_two_pages_yields_two_cards(self, monkeypatch):
        chunk = _chunk("unused", page_start=1, page_end=2, chunk_index=0)
        shared = "The exact boilerplate clause repeated verbatim."
        source = QuoteSource(
            text=f"{shared}\n{shared}",
            kind="page_text", page_start=1, page_end=2,
            segments=[
                QuoteSourceSegment(text=shared, page_start=1, page_end=1),
                QuoteSourceSegment(text=shared, page_start=2, page_end=2),
            ],
        )
        _patch_common(
            monkeypatch,
            candidates=[chunk],
            scanned_chunks=1,
            quotes_payload={"quotes": [{"quote_text": shared, "source_ref_n": 1, "page": 1}]},
            source_by_chunk_id={chunk.id: source},
        )

        result = await quote_search(_fake_db(), document=_document(), user=None, topic="boilerplate", locale="en")

        assert result.verified == 2
        assert sorted(c.page for c in result.cards) == [1, 2]
        assert sorted(c.page_end for c in result.cards) == [1, 2]

    @pytest.mark.asyncio
    async def test_extracted_text_kind_still_collapses_to_one_card_not_multi(self, monkeypatch):
        """The multi-match behavior is page_text-ONLY — extracted_text keeps
        the existing "cited chunk wins, stop at first match" behavior
        (test_extracted_text_tries_cited_chunk_before_neighbor's contract),
        never emitting one card per candidate segment."""
        shared_text = "the shared overlapping sentence"
        cited_bbox = {"x": 0.1, "y": 0.1, "w": 0.2, "h": 0.05, "page": 2}
        neighbor_bbox = {"x": 0.1, "y": 0.3, "w": 0.2, "h": 0.05, "page": 2}
        cited = _chunk(f"Prefix. {shared_text}.", page_start=2, page_end=2, chunk_index=0, bboxes=[cited_bbox])
        neighbor = _chunk(f"{shared_text}. Suffix.", page_start=2, page_end=2, chunk_index=1, bboxes=[neighbor_bbox])
        source = QuoteSource(
            text=cited.text + "\n\n" + neighbor.text, kind="extracted_text", page_start=2, page_end=2,
            segments=[
                QuoteSourceSegment(text=cited.text, page_start=2, page_end=2, chunk_id=cited.id, bboxes=[cited_bbox]),
                QuoteSourceSegment(text=neighbor.text, page_start=2, page_end=2, chunk_id=neighbor.id, bboxes=[neighbor_bbox]),
            ],
        )
        _patch_common(
            monkeypatch,
            candidates=[cited],
            scanned_chunks=1,
            quotes_payload={"quotes": [{"quote_text": shared_text, "source_ref_n": 1, "page": 2}]},
            source_by_chunk_id={cited.id: source},
        )

        result = await quote_search(_fake_db(), document=_document(), user=None, topic="shared", locale="en")

        assert result.verified == 1
        assert result.cards[0].chunk_id == str(cited.id)


class TestTopicHardCap:
    """FIX-7 (Codex r1 IMPORTANT #7): REST's QuoteSearchRequest.topic is
    Pydantic-capped at 300 chars before quote_search() is ever called, but
    ChatRequest.message has no such limit and strict chat routing passes the
    complete message straight through as `topic`. quote_search() must cap it
    itself, before both the term-scan split and the LLM prompt embedding."""

    @pytest.mark.asyncio
    async def test_over_cap_topic_is_truncated_before_build_candidates(self, monkeypatch):
        long_topic = "x" * 500
        seen: list[str] = []

        async def fake_build_candidates(_db, _document, topic):
            seen.append(topic)
            return [], 0

        monkeypatch.setattr(qss, "_build_candidates", fake_build_candidates)

        await quote_search(_fake_db(), document=_document(), user=None, topic=long_topic, locale="en")

        assert len(seen) == 1
        assert seen[0] == "x" * qss.MAX_TOPIC_CHARS
        assert len(seen[0]) == 300

    @pytest.mark.asyncio
    async def test_over_cap_topic_is_truncated_before_call_llm(self, monkeypatch):
        long_topic = "y" * 500
        chunk = _chunk(SOURCE, page_start=1, page_end=1, chunk_index=0)

        async def fake_build_candidates(_db, _document, _topic):
            return [chunk], 1

        captured: dict[str, str] = {}

        async def fake_call_llm(_candidates, topic, _locale):
            captured["topic"] = topic
            return [], 0, 0

        monkeypatch.setattr(qss, "_build_candidates", fake_build_candidates)
        monkeypatch.setattr(qss, "_call_llm", fake_call_llm)

        await quote_search(_fake_db(), document=_document(), user=None, topic=long_topic, locale="en")

        assert captured["topic"] == "y" * qss.MAX_TOPIC_CHARS

    @pytest.mark.asyncio
    async def test_topic_at_or_under_cap_is_left_unchanged(self, monkeypatch):
        short_topic = "well within the limit"
        seen: list[str] = []

        async def fake_build_candidates(_db, _document, topic):
            seen.append(topic)
            return [], 0

        monkeypatch.setattr(qss, "_build_candidates", fake_build_candidates)

        await quote_search(_fake_db(), document=_document(), user=None, topic=short_topic, locale="en")

        assert seen == [short_topic]


class TestPageAttributionFromVerifiedSlice:
    """FIX-2 (Codex r1 BLOCKER #2). Page/bboxes/chunk_id must come from the
    segment that ACTUALLY verified, never a majority-vote guess over the
    whole candidate chunk's bbox distribution."""

    @pytest.mark.asyncio
    async def test_codex_repro_page_text_quote_only_on_page_two_attributes_to_page_two(self, monkeypatch):
        """Exact Codex r1 repro: a page-1..2 chunk whose bboxes are MOSTLY on
        page 1 (majority vote would pick page 1) must attribute a quote that
        only exists on page 2 to page=2/page_end=2 with ONLY page-2 bboxes —
        never page=1 with page-1 bboxes."""
        page1_bbox = {"x": 0.1, "y": 0.1, "w": 0.3, "h": 0.05, "page": 1}
        page1_bbox_2 = {"x": 0.1, "y": 0.2, "w": 0.3, "h": 0.05, "page": 1}
        page2_bbox = {"x": 0.1, "y": 0.1, "w": 0.3, "h": 0.05, "page": 2}
        chunk = _chunk(
            "chunk-level text is not used for page_text verification",
            page_start=1, page_end=2, chunk_index=0,
            bboxes=[page1_bbox, page1_bbox_2, page2_bbox],  # 2 bboxes on page 1, 1 on page 2
        )
        source = QuoteSource(
            text="Introductory unrelated text on page one.\nThe pivotal insight lives here on page two.",
            kind="page_text", page_start=1, page_end=2,
            segments=[
                QuoteSourceSegment(text="Introductory unrelated text on page one.", page_start=1, page_end=1),
                QuoteSourceSegment(text="The pivotal insight lives here on page two.", page_start=2, page_end=2),
            ],
        )
        _patch_common(
            monkeypatch,
            candidates=[chunk],
            scanned_chunks=4,
            quotes_payload={"quotes": [
                {"quote_text": "The pivotal insight lives here on page two.", "source_ref_n": 1, "page": 2}
            ]},
            source_by_chunk_id={chunk.id: source},
        )

        result = await quote_search(_fake_db(), document=_document(), user=None, topic="pivotal insight", locale="en")

        assert result.verified == 1
        card = result.cards[0]
        assert card.page == 2
        assert card.page_end == 2
        assert card.bboxes == [page2_bbox]
        assert card.source_kind == "page_text"

    @pytest.mark.asyncio
    async def test_page_text_quote_on_page_one_attributes_to_page_one(self, monkeypatch):
        """Symmetric case — proves this isn't just "always pick the last page"."""
        page1_bbox = {"x": 0.1, "y": 0.1, "w": 0.3, "h": 0.05, "page": 1}
        page2_bbox = {"x": 0.1, "y": 0.1, "w": 0.3, "h": 0.05, "page": 2}
        chunk = _chunk("unused", page_start=1, page_end=2, chunk_index=0, bboxes=[page1_bbox, page2_bbox])
        source = QuoteSource(
            text="The pivotal insight lives here on page one.\nUnrelated text on page two.",
            kind="page_text", page_start=1, page_end=2,
            segments=[
                QuoteSourceSegment(text="The pivotal insight lives here on page one.", page_start=1, page_end=1),
                QuoteSourceSegment(text="Unrelated text on page two.", page_start=2, page_end=2),
            ],
        )
        _patch_common(
            monkeypatch,
            candidates=[chunk],
            scanned_chunks=4,
            quotes_payload={"quotes": [
                {"quote_text": "The pivotal insight lives here on page one.", "source_ref_n": 1, "page": 1}
            ]},
            source_by_chunk_id={chunk.id: source},
        )

        result = await quote_search(_fake_db(), document=_document(), user=None, topic="pivotal insight", locale="en")

        assert result.verified == 1
        card = result.cards[0]
        assert card.page == 1
        assert card.page_end == 1
        assert card.bboxes == [page1_bbox]

    @pytest.mark.asyncio
    async def test_extracted_text_quote_only_in_neighbor_attributes_to_neighbor_not_cited_chunk(self, monkeypatch):
        """extracted_text kind: when the proposal only verifies against a
        NEIGHBOR segment (not the cited chunk itself), the card's page,
        bboxes, and chunk_id must follow the neighbor — never the originally
        cited chunk's page/bboxes."""
        cited_bbox = {"x": 0.1, "y": 0.1, "w": 0.2, "h": 0.05, "page": 2}
        neighbor_bbox = {"x": 0.1, "y": 0.3, "w": 0.2, "h": 0.05, "page": 3}
        cited = _chunk("Cited chunk text without the quotation.", page_start=2, page_end=2, chunk_index=0, bboxes=[cited_bbox])
        neighbor = _chunk("The neighbor chunk carries the actual quotation here.", page_start=3, page_end=3, chunk_index=1, bboxes=[neighbor_bbox])
        source = QuoteSource(
            text=cited.text + "\n\n" + neighbor.text, kind="extracted_text", page_start=2, page_end=2,
            segments=[
                QuoteSourceSegment(text=cited.text, page_start=2, page_end=2, chunk_id=cited.id, bboxes=[cited_bbox]),
                QuoteSourceSegment(text=neighbor.text, page_start=3, page_end=3, chunk_id=neighbor.id, bboxes=[neighbor_bbox]),
            ],
        )
        _patch_common(
            monkeypatch,
            candidates=[cited],
            scanned_chunks=4,
            quotes_payload={"quotes": [
                {"quote_text": "the actual quotation here", "source_ref_n": 1, "page": 2}
            ]},
            source_by_chunk_id={cited.id: source},
        )

        result = await quote_search(_fake_db(), document=_document(), user=None, topic="quotation", locale="en")

        assert result.verified == 1
        card = result.cards[0]
        assert card.page == 3
        assert card.page_end == 3
        assert card.chunk_id == str(neighbor.id)
        assert card.bboxes == [neighbor_bbox]

    @pytest.mark.asyncio
    async def test_extracted_text_tries_cited_chunk_before_neighbor(self, monkeypatch):
        """When the quote exists in BOTH the cited chunk and a neighbor
        (chunking overlap), the cited chunk wins — it's checked first."""
        shared_text = "the shared overlapping sentence"
        cited_bbox = {"x": 0.1, "y": 0.1, "w": 0.2, "h": 0.05, "page": 2}
        neighbor_bbox = {"x": 0.1, "y": 0.3, "w": 0.2, "h": 0.05, "page": 2}
        cited = _chunk(f"Prefix. {shared_text}.", page_start=2, page_end=2, chunk_index=0, bboxes=[cited_bbox])
        neighbor = _chunk(f"{shared_text}. Suffix.", page_start=2, page_end=2, chunk_index=1, bboxes=[neighbor_bbox])
        source = QuoteSource(
            text=cited.text + "\n\n" + neighbor.text, kind="extracted_text", page_start=2, page_end=2,
            segments=[
                QuoteSourceSegment(text=cited.text, page_start=2, page_end=2, chunk_id=cited.id, bboxes=[cited_bbox]),
                QuoteSourceSegment(text=neighbor.text, page_start=2, page_end=2, chunk_id=neighbor.id, bboxes=[neighbor_bbox]),
            ],
        )
        _patch_common(
            monkeypatch,
            candidates=[cited],
            scanned_chunks=4,
            quotes_payload={"quotes": [{"quote_text": shared_text, "source_ref_n": 1, "page": 2}]},
            source_by_chunk_id={cited.id: source},
        )

        result = await quote_search(_fake_db(), document=_document(), user=None, topic="shared", locale="en")

        assert result.verified == 1
        assert result.cards[0].chunk_id == str(cited.id)

    @pytest.mark.asyncio
    async def test_quote_verified_nowhere_is_discarded_with_a_score(self, monkeypatch):
        """No segment verifies -> discarded, and the reported score is the
        BEST (highest-scoring) failure across segments, not just the last
        one tried — useful diagnostic signal, never a crash."""
        chunk = _chunk("unused", page_start=1, page_end=2, chunk_index=0)
        source = QuoteSource(
            text="Nothing relevant here.\nNor here either.",
            kind="page_text", page_start=1, page_end=2,
            segments=[
                QuoteSourceSegment(text="Nothing relevant here.", page_start=1, page_end=1),
                QuoteSourceSegment(text="Nor here either.", page_start=2, page_end=2),
            ],
        )
        _patch_common(
            monkeypatch,
            candidates=[chunk],
            scanned_chunks=2,
            quotes_payload={"quotes": [
                {"quote_text": "A completely unrelated hallucinated sentence.", "source_ref_n": 1, "page": 1}
            ]},
            source_by_chunk_id={chunk.id: source},
        )

        result = await quote_search(_fake_db(), document=_document(), user=None, topic="x", locale="en")

        assert result.cards == []
        assert result.verified == 0
        assert len(result.discarded) == 1
        _reason, tier, _score = result.discarded[0]
        assert tier == "dropped"


def _page(page_number: int, content: str | None):
    return SimpleNamespace(page_number=page_number, content=content)


class TestTermScanCandidates:
    """Pure unit coverage for the deterministic normalized term/phrase scan
    (§8.3 candidate expansion) — no DB/LLM involved.

    FIX-6 (Codex r1 IMPORTANT #6): two corrections — casefold (fuzzy)
    normalization, and Page.content scanning in addition to Chunk.text."""

    def test_phrase_match_and_no_match(self):
        hit = _chunk("The full phrase authorial voice appears here.", 1, 1, 0)
        miss = _chunk("Completely unrelated content about weather.", 2, 2, 1)

        hits = qss._term_scan_candidates([hit, miss], [], "authorial voice")

        assert hits == [hit]

    def test_empty_topic_yields_no_hits(self):
        chunk = _chunk("Some content.", 1, 1, 0)
        assert qss._term_scan_candidates([chunk], [], "   ") == []

    def test_casefold_matches_regardless_of_topic_or_text_case(self):
        """Codex r1 repro: title-case topic 'Climate Risk' must match a
        chunk containing only lowercase 'climate risk' (and vice versa) —
        the prior case-preserving normalize() missed this."""
        lower_hit = _chunk("The report discusses climate risk at length.", 1, 1, 0)
        upper_hit = _chunk("CLIMATE RISK dominates the executive summary.", 2, 2, 1)
        miss = _chunk("Nothing relevant in this passage.", 3, 3, 2)

        hits = qss._term_scan_candidates([lower_hit, upper_hit, miss], [], "Climate Risk")

        assert hits == [lower_hit, upper_hit]

    def test_page_content_match_surfaces_owning_chunks_not_matched_via_chunk_text(self):
        """A term present only in Page.content (chunking split it oddly
        across chunk.text boundaries) still surfaces via every chunk
        overlapping that page — never the raw page text itself."""
        untouched = _chunk("Unrelated chunk text.", page_start=1, page_end=1, chunk_index=0)
        spans_page_two = _chunk("Half of the elu-", page_start=2, page_end=2, chunk_index=1)
        also_page_two = _chunk("-sive phrase, split across chunks.", page_start=2, page_end=2, chunk_index=2)
        page_two = _page(2, "Half of the elusive phrase lives whole on page two.")

        hits = qss._term_scan_candidates(
            [untouched, spans_page_two, also_page_two], [page_two], "elusive phrase",
        )

        assert untouched not in hits
        assert spans_page_two in hits
        assert also_page_two in hits

    def test_page_with_no_content_is_skipped_without_error(self):
        chunk = _chunk("Some content.", 1, 1, 0)
        page_without_content = _page(1, None)

        assert qss._term_scan_candidates([chunk], [page_without_content], "nomatch") == []


class TestJsonFromText:
    """Direct unit coverage for _json_from_text (extraction_service's
    test_json_from_text_accepts_fenced_json precedent) — the repair-retry
    branch in _call_llm had zero direct coverage before this (B1 review
    follow-up)."""

    def test_accepts_fenced_json(self):
        assert qss._json_from_text('```json\n{"quotes": []}\n```') == {"quotes": []}

    def test_accepts_bare_json(self):
        assert qss._json_from_text('{"quotes": [{"quote_text": "x"}]}') == {
            "quotes": [{"quote_text": "x"}]
        }

    def test_extracts_embedded_json_from_surrounding_prose(self):
        text = 'Sure, here is the JSON: {"quotes": []} — let me know if you need more.'
        assert qss._json_from_text(text) == {"quotes": []}

    def test_non_dict_json_raises(self):
        with pytest.raises(ValueError):
            qss._json_from_text("[1, 2, 3]")

    def test_unparseable_text_raises(self):
        with pytest.raises(Exception):
            qss._json_from_text("not json at all")


def _llm_response(content: str, *, prompt_tokens: int = 5, completion_tokens: int = 5):
    return types.SimpleNamespace(
        choices=[types.SimpleNamespace(message=types.SimpleNamespace(content=content))],
        usage=types.SimpleNamespace(prompt_tokens=prompt_tokens, completion_tokens=completion_tokens),
    )


class TestCallLlmRepairRetry:
    """Direct coverage for _call_llm's fence-strip/repair-retry path — the
    quote_search() end-to-end tests never exercise this because the mocked
    LLM always returns clean JSON on the first try."""

    @pytest.mark.asyncio
    async def test_malformed_first_response_recovers_via_repair_retry(self, monkeypatch):
        create_mock = AsyncMock(
            side_effect=[
                _llm_response("Sure! Here are some quotes I found for you.", prompt_tokens=100, completion_tokens=20),
                _llm_response('{"quotes": [{"quote_text": "x", "source_ref_n": 1, "page": 1}]}', prompt_tokens=40, completion_tokens=10),
            ]
        )
        client = types.SimpleNamespace(chat=types.SimpleNamespace(completions=types.SimpleNamespace(create=create_mock)))
        monkeypatch.setattr(qss, "_get_llm_client", lambda _model: client)
        chunk = _chunk(SOURCE, page_start=1, page_end=1, chunk_index=0)

        quotes, prompt_tokens, completion_tokens = await qss._call_llm([chunk], "fluency", "en")

        assert quotes == [{"quote_text": "x", "source_ref_n": 1, "page": 1}]
        # Token usage accumulates ACROSS both calls — the repair call's tokens
        # are real cost too, and must be reflected in what gets billed.
        assert prompt_tokens == 140
        assert completion_tokens == 30
        assert create_mock.await_count == 2

    @pytest.mark.asyncio
    async def test_unrecoverable_output_degrades_to_empty_quotes_never_raises(self, monkeypatch):
        create_mock = AsyncMock(
            side_effect=[
                _llm_response("garbage, not json"),
                _llm_response("still not json after repair"),
            ]
        )
        client = types.SimpleNamespace(chat=types.SimpleNamespace(completions=types.SimpleNamespace(create=create_mock)))
        monkeypatch.setattr(qss, "_get_llm_client", lambda _model: client)
        chunk = _chunk(SOURCE, page_start=1, page_end=1, chunk_index=0)

        quotes, prompt_tokens, completion_tokens = await qss._call_llm([chunk], "fluency", "en")

        assert quotes == []
        assert create_mock.await_count == 2
        # Usage from both attempts still accumulates (both cost real tokens).
        assert prompt_tokens == 10
        assert completion_tokens == 10


def _fake_db_with_chunk(chunk, *, neighbors=None):
    """Like _fake_db(), plus db.get(Chunk, id) resolving to `chunk` (or None)
    — verify_saved_quote's entry point, unlike quote_search()'s candidate
    list, starts from a single chunk_id lookup."""
    class _Scalars:
        def __init__(self_inner, rows):
            self_inner._rows = rows

        def all(self_inner):
            return self_inner._rows

    async def _get(_model, chunk_id):
        return chunk if chunk is not None and chunk_id == chunk.id else None

    result = SimpleNamespace(scalars=lambda: _Scalars(neighbors or []))
    return SimpleNamespace(get=_get, execute=AsyncMock(return_value=result))


class TestVerifySavedQuote:
    """M3-B2 (plan §8.1's fabrication-safety corollary, team-lead directive):
    saving a quote must NOT trust client-supplied tier/score/page/bboxes —
    verify_saved_quote re-derives every trust field through the SAME
    verify_quote gate quote_search() uses, from ONLY (chunk_id, quote_text).
    A client that supplies a chunk_id + text that never verify gets None,
    never a fabricated card."""

    @pytest.mark.asyncio
    async def test_exact_match_reproduces_the_same_card_fields_as_search(self, monkeypatch):
        chunk = _chunk(SOURCE, page_start=4, page_end=4, chunk_index=0)
        monkeypatch.setattr(
            qss, "build_quote_source",
            AsyncMock(return_value=_chunk_source(chunk, text=SOURCE)),
        )

        card = await qss.verify_saved_quote(
            _fake_db_with_chunk(chunk),
            document=_document(),
            chunk_id=chunk.id,
            quote_text="the most prized quality in translation today",
        )

        assert card is not None
        assert card.display_text == "the most prized quality in translation today"
        assert card.tier == "exact"
        assert card.source_kind == "extracted_text"
        assert card.page == 4
        assert card.page_end == 4
        assert card.chunk_id == str(chunk.id)
        assert card.score == 100.0
        # M3 review addition (plan §8.1 anchor fields): raw offsets of the
        # verified slice within the corpus, and a hash of that corpus.
        expected_start = SOURCE.index("the most prized quality in translation today")
        expected_end = expected_start + len("the most prized quality in translation today")
        assert card.quote_start == expected_start
        assert card.quote_end == expected_end
        assert card.source_text_hash == hashlib.sha256(SOURCE.encode("utf-8")).hexdigest()

    @pytest.mark.asyncio
    async def test_unknown_chunk_id_returns_none(self, monkeypatch):
        card = await qss.verify_saved_quote(
            _fake_db_with_chunk(None),
            document=_document(),
            chunk_id=uuid.uuid4(),
            quote_text="anything",
        )
        assert card is None

    @pytest.mark.asyncio
    async def test_chunk_belonging_to_a_different_document_returns_none(self, monkeypatch):
        """A client cannot point chunk_id at a chunk from a document it
        doesn't even have open — cross-document forgery must fail closed."""
        chunk = _chunk(SOURCE, page_start=4, page_end=4, chunk_index=0)
        other_document = _document(id=uuid.uuid4())

        card = await qss.verify_saved_quote(
            _fake_db_with_chunk(chunk),
            document=other_document,
            chunk_id=chunk.id,
            quote_text="the most prized quality in translation today",
        )

        assert card is None

    @pytest.mark.asyncio
    async def test_fabricated_text_that_never_appears_in_the_source_returns_none(self, monkeypatch):
        """The core anti-fabrication guarantee: a client cannot save
        self-typed text as a "verified" card just by pointing chunk_id at a
        real chunk — the text must ACTUALLY be located there."""
        chunk = _chunk(SOURCE, page_start=4, page_end=4, chunk_index=0)
        monkeypatch.setattr(
            qss, "build_quote_source",
            AsyncMock(return_value=_chunk_source(chunk, text=SOURCE)),
        )

        card = await qss.verify_saved_quote(
            _fake_db_with_chunk(chunk),
            document=_document(),
            chunk_id=chunk.id,
            quote_text="I confess to fraud on page four",
        )

        assert card is None

    @pytest.mark.asyncio
    async def test_ambiguous_multipage_extracted_segment_is_excluded_like_search(self, monkeypatch):
        chunk = _chunk(SOURCE, page_start=1, page_end=2, chunk_index=0)
        ambiguous_source = QuoteSource(
            text=SOURCE, kind="extracted_text", page_start=1, page_end=2,
            segments=[
                QuoteSourceSegment(
                    text=SOURCE, page_start=1, page_end=2, chunk_id=chunk.id, bboxes=[],
                )
            ],
        )
        monkeypatch.setattr(qss, "build_quote_source", AsyncMock(return_value=ambiguous_source))

        card = await qss.verify_saved_quote(
            _fake_db_with_chunk(chunk),
            document=_document(),
            chunk_id=chunk.id,
            quote_text="the most prized quality in translation today",
        )

        assert card is None

    @pytest.mark.asyncio
    async def test_page_hint_disambiguates_a_repeated_page_text_occurrence(self, monkeypatch):
        """page_text kind can genuinely verify the SAME wording on more than
        one page (repeated boilerplate) — _verify_against_segments returns
        every match. page_hint picks which already-independently-verified
        occurrence the client actually saw and meant to save; it can never
        conjure an unverified one."""
        chunk = _chunk(SOURCE, page_start=3, page_end=3, chunk_index=0, bboxes=[
            {"x": 0.1, "y": 0.2, "w": 0.3, "h": 0.05, "page": 3},
        ])
        two_page_source = QuoteSource(
            text=SOURCE, kind="page_text", page_start=3, page_end=7,
            segments=[
                QuoteSourceSegment(text=SOURCE, page_start=3, page_end=3, chunk_id=None, bboxes=[]),
                QuoteSourceSegment(text=SOURCE, page_start=7, page_end=7, chunk_id=None, bboxes=[]),
            ],
        )
        monkeypatch.setattr(qss, "build_quote_source", AsyncMock(return_value=two_page_source))

        card = await qss.verify_saved_quote(
            _fake_db_with_chunk(chunk),
            document=_document(),
            chunk_id=chunk.id,
            quote_text="the most prized quality in translation today",
            page_hint=7,
        )

        assert card is not None
        assert card.page == 7
        assert card.source_kind == "page_text"

    @pytest.mark.asyncio
    async def test_missing_page_hint_falls_back_to_the_first_verified_occurrence(self, monkeypatch):
        chunk = _chunk(SOURCE, page_start=3, page_end=3, chunk_index=0)
        two_page_source = QuoteSource(
            text=SOURCE, kind="page_text", page_start=3, page_end=7,
            segments=[
                QuoteSourceSegment(text=SOURCE, page_start=3, page_end=3, chunk_id=None, bboxes=[]),
                QuoteSourceSegment(text=SOURCE, page_start=7, page_end=7, chunk_id=None, bboxes=[]),
            ],
        )
        monkeypatch.setattr(qss, "build_quote_source", AsyncMock(return_value=two_page_source))

        card = await qss.verify_saved_quote(
            _fake_db_with_chunk(chunk),
            document=_document(),
            chunk_id=chunk.id,
            quote_text="the most prized quality in translation today",
        )

        assert card is not None
        assert card.page == 3
