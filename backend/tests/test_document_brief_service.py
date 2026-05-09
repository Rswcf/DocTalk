from __future__ import annotations

import uuid
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from app.services.document_brief_service import (
    DocumentBriefService,
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
