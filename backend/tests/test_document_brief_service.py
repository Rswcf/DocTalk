from __future__ import annotations

import uuid
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from app.services.document_brief_service import (
    DocumentBriefService,
    MapStepResult,
    SectionMapGroup,
    SectionMapReducePlanner,
    _dynamic_section_group_count,
    _select_representative_chunks,
)


class _ScalarOneOrNoneResult:
    def __init__(self, value):
        self._value = value

    def scalar_one_or_none(self):
        return self._value


class _ScalarsResult:
    def __init__(self, values):
        self._values = values

    def scalars(self):
        return self._values


def _chunk(index: int, *, section: str | None = None, text: str | None = None):
    return SimpleNamespace(
        id=uuid.uuid4(),
        document_id=uuid.uuid4(),
        chunk_index=index,
        text=text or f"Chunk {index} " + ("important document content " * 8),
        section_title=section,
        page_start=index + 1,
        page_end=index + 1,
        bboxes=[],
    )


def test_representative_selection_covers_front_middle_and_tail() -> None:
    chunks = [_chunk(i, section=f"Section {i // 5}") for i in range(30)]

    selected = _select_representative_chunks(chunks, max_chunks=10)
    selected_indices = [item.chunk_index for item in selected]

    assert 0 in selected_indices
    assert 1 in selected_indices
    assert any(10 <= idx <= 20 for idx in selected_indices)
    assert 28 in selected_indices
    assert 29 in selected_indices
    assert selected_indices == sorted(selected_indices)
    assert len(selected_indices) <= 10


def test_representative_selection_skips_tiny_sidebar_chunks() -> None:
    chunks = [
        _chunk(0, text="p.1"),
        _chunk(1, text="short"),
        _chunk(2, text="Main narrative " * 20),
        _chunk(3, text="Conclusion narrative " * 20),
    ]

    selected = _select_representative_chunks(chunks, max_chunks=4)

    assert [item.chunk_index for item in selected] == [2, 3]


def test_representative_selection_falls_back_for_short_documents() -> None:
    chunks = [
        _chunk(0, text="Short memo."),
        _chunk(1, text="Tiny appendix."),
    ]

    selected = _select_representative_chunks(chunks, max_chunks=4)

    assert [item.chunk_index for item in selected] == [0, 1]


def test_representative_selection_keeps_all_small_documents() -> None:
    chunks = [_chunk(i) for i in range(4)]

    selected = _select_representative_chunks(chunks, max_chunks=10)

    assert [item.chunk_index for item in selected] == [0, 1, 2, 3]


@pytest.mark.asyncio
async def test_collection_summary_context_caps_docs_and_chunks(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    service = DocumentBriefService()
    doc_ids = [uuid.uuid4() for _ in range(10)]
    calls: list[tuple[uuid.UUID, int]] = []

    async def fake_context(_db, document_id, *, max_chunks):
        calls.append((document_id, max_chunks))
        return [
            {"chunk_id": uuid.uuid4(), "document_id": document_id, "text": f"{document_id}:{idx}"}
            for idx in range(max_chunks)
        ]

    monkeypatch.setattr(service, "get_summary_context", AsyncMock(side_effect=fake_context))

    contexts = await service.get_collection_summary_context(
        SimpleNamespace(),
        doc_ids,
        max_chunks=12,
        max_docs=4,
    )

    assert [doc_id for doc_id, _budget in calls] == doc_ids[:4]
    assert all(budget == 3 for _doc_id, budget in calls)
    assert len(contexts) == 12


@pytest.mark.asyncio
async def test_summary_context_prefers_persisted_coverage_order() -> None:
    document_id = uuid.uuid4()
    first = _chunk(0)
    second = _chunk(1)
    first.document_id = document_id
    second.document_id = document_id
    db = SimpleNamespace(
        execute=AsyncMock(
            side_effect=[
                _ScalarOneOrNoneResult(
                    {"selected_chunk_ids": [str(second.id), str(uuid.uuid4()), str(first.id)]}
                ),
                _ScalarsResult([first, second]),
            ]
        )
    )

    contexts = await DocumentBriefService().get_summary_context(db, document_id, max_chunks=8)

    assert [item["chunk_id"] for item in contexts] == [second.id, first.id]


@pytest.mark.asyncio
async def test_summary_context_falls_back_when_persisted_coverage_is_stale() -> None:
    document_id = uuid.uuid4()
    chunks = [_chunk(i) for i in range(3)]
    for chunk in chunks:
        chunk.document_id = document_id
    db = SimpleNamespace(
        execute=AsyncMock(
            side_effect=[
                _ScalarOneOrNoneResult({"selected_chunk_ids": [str(uuid.uuid4())]}),
                _ScalarsResult([]),
                _ScalarsResult([]),
                _ScalarsResult(chunks),
            ]
        )
    )

    contexts = await DocumentBriefService().get_summary_context(db, document_id, max_chunks=8)

    assert [item["chunk_id"] for item in contexts] == [chunk.id for chunk in chunks]


@pytest.mark.asyncio
async def test_summary_context_uses_document_elements_before_chunk_fallback() -> None:
    document_id = uuid.uuid4()
    first = _chunk(0, text="Intro narrative " * 20)
    table_page = _chunk(1, text="Target price table context " * 20)
    first.document_id = document_id
    table_page.document_id = document_id
    table_page.page_start = 7
    table_page.page_end = 7
    element = SimpleNamespace(
        element_type="table",
        page_start=7,
        page_end=7,
        reading_order=70_000,
        text="Table page 7\nCompany | Rating | Target price",
    )
    db = SimpleNamespace(
        execute=AsyncMock(
            side_effect=[
                _ScalarOneOrNoneResult(None),
                _ScalarsResult([element]),
                _ScalarsResult([first, table_page]),
            ]
        )
    )

    contexts = await DocumentBriefService().get_summary_context(db, document_id, max_chunks=4)

    assert contexts[0]["chunk_id"] == table_page.id


@pytest.mark.asyncio
async def test_section_map_reduce_covers_all_sections_with_stubbed_llm() -> None:
    section_count = 26
    chunks = [
        _chunk(index, section=f"Chapter {index}", text=(f"Section {index} narrative " * 20))
        for index in range(section_count)
    ]
    expected_sections = {chunk.section_title for chunk in chunks}

    sampled = _select_representative_chunks(chunks, max_chunks=18)
    sampled_sections = {chunk.section_title for chunk in sampled}
    assert sampled_sections != expected_sections

    async def fake_map(group: SectionMapGroup) -> MapStepResult:
        selected_ids: list[uuid.UUID] = []
        covered_sections: list[str] = []
        seen_sections: set[str] = set()
        for chunk in group.chunks:
            section = (chunk.section_title or "").strip()
            if not section or section in seen_sections:
                continue
            seen_sections.add(section)
            covered_sections.append(section)
            selected_ids.append(chunk.id)
        return MapStepResult(
            group_index=group.group_index,
            summary=f"covers {len(covered_sections)} sections",
            selected_chunk_ids=tuple(selected_ids),
            covered_sections=tuple(covered_sections),
        )

    async def fake_reduce(
        mapped: list[MapStepResult],
        *,
        max_total_chunks: int,
    ) -> list[uuid.UUID]:
        ordered: list[uuid.UUID] = []
        seen: set[uuid.UUID] = set()
        for item in mapped:
            for chunk_id in item.selected_chunk_ids:
                if chunk_id in seen:
                    continue
                seen.add(chunk_id)
                ordered.append(chunk_id)
        return ordered[:max_total_chunks]

    planner = SectionMapReducePlanner(
        map_step=fake_map,
        reduce_step=fake_reduce,
        max_total_chunks_cap=64,
        max_group_chunks=6,
        max_groups=18,
    )
    selected = await planner.select_chunks_for_summary(chunks, max_chunks=18)
    selected_sections = {chunk.section_title for chunk in selected}

    assert selected_sections == expected_sections


def test_dynamic_section_group_count_scales_with_document_size() -> None:
    small = _dynamic_section_group_count(24)
    medium = _dynamic_section_group_count(240)
    huge = _dynamic_section_group_count(2400)

    assert small >= 2
    assert medium > small
    assert huge >= medium


@pytest.mark.asyncio
async def test_large_document_summary_context_uses_section_map_reduce() -> None:
    document_id = uuid.uuid4()
    chunks = [_chunk(i, section=f"Chapter {i}", text=("Long narrative " * 25)) for i in range(50)]
    for chunk in chunks:
        chunk.document_id = document_id

    map_reduce_selected = chunks[:30]
    planner = SectionMapReducePlanner()
    planner.select_chunks_for_summary = AsyncMock(return_value=map_reduce_selected)
    service = DocumentBriefService(
        section_map_reduce=planner,
        map_reduce_min_chunks=36,
    )
    db = SimpleNamespace(
        execute=AsyncMock(
            side_effect=[
                _ScalarOneOrNoneResult(None),
                _ScalarsResult([]),
                _ScalarsResult(chunks),
            ]
        )
    )

    contexts = await service.get_summary_context(db, document_id, max_chunks=18)

    planner.select_chunks_for_summary.assert_awaited_once_with(chunks, max_chunks=18)
    assert len(contexts) == 30


@pytest.mark.asyncio
async def test_large_document_bypasses_persisted_coverage_when_map_reduce_needed(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    document_id = uuid.uuid4()
    chunks = [_chunk(i, section=f"Chapter {i}", text=("Long narrative " * 25)) for i in range(50)]
    for chunk in chunks:
        chunk.document_id = document_id

    persisted = [
        {
            "chunk_id": chunk.id,
            "text": chunk.text,
            "page": chunk.page_start,
            "page_end": chunk.page_end,
            "bboxes": chunk.bboxes,
            "score": 1.0,
            "section_title": chunk.section_title,
            "document_id": chunk.document_id,
        }
        for chunk in chunks[:18]
    ]

    map_reduce_selected = chunks[:30]
    planner = SectionMapReducePlanner()
    planner.select_chunks_for_summary = AsyncMock(return_value=map_reduce_selected)
    service = DocumentBriefService(
        section_map_reduce=planner,
        map_reduce_min_chunks=36,
    )
    monkeypatch.setattr(
        service,
        "_get_persisted_summary_context",
        AsyncMock(return_value=persisted),
    )
    monkeypatch.setattr(
        service,
        "_should_use_map_reduce",
        lambda *_args, **_kwargs: True,
    )
    monkeypatch.setattr(
        "app.services.document_brief_service.get_element_aware_chunks_async",
        AsyncMock(return_value=[]),
    )
    db = SimpleNamespace(execute=AsyncMock(return_value=_ScalarsResult(chunks)))

    contexts = await service.get_summary_context(db, document_id, max_chunks=18)

    planner.select_chunks_for_summary.assert_awaited_once_with(chunks, max_chunks=18)
    assert len(contexts) > 18
    assert len({item.get("section_title") for item in contexts}) > 18


def test_truncate_group_chunks_hard_caps_multi_section_group() -> None:
    planner = SectionMapReducePlanner(max_group_chunks=4)
    chunks = tuple(_chunk(i, section=f"Section {i}", text=("Long narrative " * 20)) for i in range(9))
    group = SectionMapGroup(
        group_index=0,
        chunks=chunks,
        section_titles=tuple(f"Section {i}" for i in range(9)),
    )

    truncated = planner._truncate_group_chunks(group)

    assert len(truncated.chunks) == 4
    assert [chunk.chunk_index for chunk in truncated.chunks] == [0, 2, 5, 8]


@pytest.mark.asyncio
async def test_small_per_doc_budget_skips_map_reduce_for_collection_path() -> None:
    document_id = uuid.uuid4()
    chunks = [_chunk(i, section=f"Chapter {i}", text=("Long narrative " * 25)) for i in range(50)]
    for chunk in chunks:
        chunk.document_id = document_id

    planner = SectionMapReducePlanner()
    planner.select_chunks_for_summary = AsyncMock(return_value=chunks[:20])
    service = DocumentBriefService(
        section_map_reduce=planner,
        map_reduce_min_chunks=36,
    )
    db = SimpleNamespace(
        execute=AsyncMock(
            side_effect=[
                _ScalarOneOrNoneResult(None),
                _ScalarsResult([]),
                _ScalarsResult(chunks),
            ]
        )
    )

    contexts = await service.get_summary_context(db, document_id, max_chunks=3)

    planner.select_chunks_for_summary.assert_not_awaited()
    assert len(contexts) == 3
