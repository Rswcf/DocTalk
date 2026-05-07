from __future__ import annotations

import uuid
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from app.services.document_brief_service import (
    DocumentBriefService,
    _select_representative_chunks,
)


def _chunk(index: int, *, section: str | None = None, text: str | None = None):
    return SimpleNamespace(
        chunk_index=index,
        text=text or f"Chunk {index} " + ("important document content " * 8),
        section_title=section,
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
