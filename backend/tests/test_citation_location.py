from __future__ import annotations

import uuid
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest

from app.services.chat_service import (
    _ChunkInfo,
    _citation_payload,
    _hydrate_citation_pages,
    _refine_citation_focus,
)
from app.services.citation_location import citation_location

FIRST = "The approved annual budget totals 125000 dollars."
SECOND = "The technical committee meets every Friday morning."
BOXES = [
    {"page": page, "x": .1, "y": y, "w": .5, "h": .1}
    for page, y in [(2, .2), (1, .1), (2, .1), (2, .3)]
]


def chunk(**kwargs):
    return _ChunkInfo(
        id=uuid.uuid4(), document_id=uuid.uuid4(), page_start=1, page_end=2,
        text=FIRST + " " + SECOND, bboxes=BOXES,
        page_texts={1: FIRST, 2: SECOND}, **kwargs,
    )


@pytest.mark.parametrize("focus,page", [(FIRST, 1), (SECOND, 2)])
def test_unique_support_page_outvotes_nothing(focus, page):
    result = citation_location(1, 2, BOXES, source_text=FIRST + " " + SECOND,
                               focus=focus, page_texts={1: FIRST, 2: SECOND})
    assert (result["page"], result["page_end"]) == (page, page)
    assert {bb["page"] for bb in result["bboxes"]} == {page}


@pytest.mark.parametrize("pages,focus,source", [
    ({1: FIRST}, FIRST, FIRST),  # missing second page could hide a duplicate
    ({1: FIRST, 2: FIRST}, FIRST, FIRST),
    ({1: FIRST, 2: SECOND}, "Made up quote about the approved budget.", FIRST),
    ({1: FIRST, 2: SECOND}, FIRST, SECOND),  # page match outside cited chunk
    ({1: FIRST, 2: SECOND}, FIRST + " " + SECOND, FIRST + " " + SECOND),
    ({1: FIRST, 2: " "}, FIRST, FIRST),
])
def test_incomplete_ambiguous_or_unverified_support_retains_range(pages, focus, source):
    result = citation_location(1, 2, BOXES, source_text=source, focus=focus, page_texts=pages)
    assert (result["page"], result["page_end"]) == (1, 2)
    assert [bb["page"] for bb in result["bboxes"]] == [1, 2, 2, 2]


def test_layout_whitespace_can_differ_without_changing_numbers_or_punctuation():
    result = citation_location(1, 2, BOXES, source_text=FIRST, focus=FIRST,
                               page_texts={1: FIRST.replace(" ", "\n"), 2: SECOND})
    assert result["page_end"] == 1


def test_malformed_boxes_cannot_forge_location_or_break_json():
    invalid = [{**BOXES[0], key: value} for key, value in [
        ("x", float("nan")), ("page", float("inf")), ("page", True),
        ("page", 1.5), ("page", 99), ("h", "bad"),
    ]]
    assert citation_location(1, 2, invalid)["bboxes"] == []


def test_chat_lexical_focus_and_conservative_fallback():
    source = chunk()
    exact = _citation_payload(1, source, 12, FIRST)
    assert exact["focus_snippet"] == FIRST
    assert (exact["page"], exact["page_end"]) == (1, 1)
    broad = _citation_payload(1, source, 12)
    assert (broad["page"], broad["page_end"]) == (1, 2)


@pytest.mark.asyncio
async def test_focus_refinement_also_updates_page_and_boxes():
    source = chunk()
    citations = [_citation_payload(1, source, 12)]
    with patch("app.services.chat_service.extract_focus_quotes", new=AsyncMock(
        return_value=({1: SECOND}, (8, 3)),
    )), patch("app.services.chat_service._get_llm_client"):
        changed, _, pt, ct = await _refine_citation_focus(
            answer="委员会每周五开会。", citations=citations, chunk_map={1: source},
            fallback_model="deepseek-v4-flash", user=SimpleNamespace(id=uuid.uuid4()),
        )
    assert changed and (pt, ct) == (8, 3)
    assert (citations[0]["page"], citations[0]["page_end"]) == (2, 2)
    assert all(bb["page"] == 2 for bb in citations[0]["bboxes"])


@pytest.mark.asyncio
async def test_page_hydration_batches_and_keeps_collection_documents_separate():
    a, b = chunk(), chunk()
    summary = chunk(retrieval_modality="summary")
    db = SimpleNamespace(execute=AsyncMock(return_value=SimpleNamespace(all=lambda: [
        (a.document_id, 1, FIRST), (a.document_id, 2, SECOND),
        (b.document_id, 1, SECOND), (b.document_id, 2, FIRST),
    ])))
    await _hydrate_citation_pages(db, {1: a, 2: b, 3: summary})
    db.execute.assert_awaited_once()
    assert a.page_texts == {1: FIRST, 2: SECOND}
    assert b.page_texts == {1: SECOND, 2: FIRST}
    assert summary.page_texts == {}


@pytest.mark.asyncio
async def test_repeated_ref_keeps_independent_occurrence_ranges_and_lexical_focus():
    source = chunk()
    citations = [_citation_payload(1, source, 10), _citation_payload(1, source, 24),
                 _citation_payload(1, source, 45, SECOND)]
    with patch("app.services.chat_service.extract_focus_quotes", new=AsyncMock(
        return_value=({1: FIRST}, (8, 3)),
    )), patch("app.services.chat_service._get_llm_client"):
        await _refine_citation_focus(
            answer="预算为125000。每周五开会。", citations=citations, chunk_map={1: source},
            fallback_model="deepseek-v4-flash", user=SimpleNamespace(id=uuid.uuid4()),
        )
    assert [(c["page"], c["page_end"]) for c in citations] == [(1, 2), (1, 2), (2, 2)]
    assert "focus_snippet" not in citations[0] and "focus_snippet" not in citations[1]
    assert citations[2]["focus_snippet"] == SECOND


@pytest.mark.asyncio
async def test_sparse_and_many_document_hydration_is_bounded():
    sources = [chunk() for _ in range(16)]
    for source in sources:
        source.page_end = 64
    sparse = chunk()
    sparse.page_end = 3000
    db = SimpleNamespace(execute=AsyncMock(return_value=SimpleNamespace(all=lambda: [])))
    await _hydrate_citation_pages(db, dict(enumerate([sparse, *sources])))
    query = db.execute.call_args.args[0]
    pairs = next(iter(query.compile().params.values()))
    assert len(pairs) == 512
    assert all(doc_id != sparse.document_id for doc_id, _ in pairs)
    assert sparse.page_texts == {} and sources[-1].page_texts == {}
    fallback = _citation_payload(1, sparse, 12, FIRST)
    assert (fallback["page"], fallback["page_end"]) == (1, 3000)


@pytest.mark.asyncio
@pytest.mark.parametrize("elapsed", [1, 46])
async def test_legacy_continuation_repeated_focus_does_not_gain_false_precision(elapsed):
    source = chunk()
    citations = [_citation_payload(1, source, offset) for offset in [10, 24]]
    for citation in citations:
        citation["focus_snippet"] = FIRST
    with patch("app.services.chat_service.extract_focus_quotes", new=AsyncMock(
        return_value=({}, (0, 0)),
    )), patch("app.services.chat_service._get_llm_client"):
        changed, _, _, _ = await _refine_citation_focus(
            answer="预算为125000。每周五开会。", citations=citations, chunk_map={1: source},
            fallback_model="deepseek-v4-flash", user=SimpleNamespace(id=uuid.uuid4()),
            elapsed_seconds=elapsed,
        )
    assert changed
    assert [(c["page"], c["page_end"]) for c in citations] == [(1, 2), (1, 2)]
    assert all("focus_snippet" not in c for c in citations)
