from __future__ import annotations

import uuid
from types import SimpleNamespace

from app.services import document_diff_service, extraction_service


def _chunk(page: int, text: str):
    return SimpleNamespace(
        id=uuid.uuid4(),
        document_id=uuid.uuid4(),
        page_start=page,
        page_end=page,
        text=text,
        section_title=None,
        bboxes=[],
        chunk_index=page,
    )


def test_extraction_context_prefers_element_coverage_before_vector_queries(monkeypatch) -> None:
    document_id = uuid.uuid4()
    element_chunk = _chunk(7, "Element-selected target price table context")
    query_chunk = _chunk(2, "Vector-selected metric context")

    monkeypatch.setattr(
        extraction_service,
        "get_element_aware_chunks",
        lambda *_args, **_kwargs: [(element_chunk, 0.91)],
    )
    monkeypatch.setattr(
        extraction_service,
        "_retrieve_by_query",
        lambda *_args, **_kwargs: [(query_chunk, 0.82)],
    )

    selected = extraction_service.retrieve_extraction_chunks(
        SimpleNamespace(),
        document_id,
        extraction_service.get_template("key_facts"),
        max_chunks=2,
    )

    assert selected[0][0] is element_chunk
    assert selected[1][0] is query_chunk


def test_document_diff_context_prefers_element_coverage_before_vector_queries(monkeypatch) -> None:
    document_id = uuid.uuid4()
    element_chunk = _chunk(9, "Element-selected change section context")
    query_chunk = _chunk(3, "Vector-selected clause context")

    monkeypatch.setattr(
        document_diff_service,
        "get_element_aware_chunks",
        lambda *_args, **_kwargs: [(element_chunk, 0.9)],
    )
    monkeypatch.setattr(
        document_diff_service,
        "_retrieve_by_query",
        lambda *_args, **_kwargs: [(query_chunk, 0.81)],
    )

    selected = document_diff_service.retrieve_diff_chunks(
        SimpleNamespace(),
        document_id,
        max_chunks=2,
    )

    assert selected[0][0] is element_chunk
    assert selected[1][0] is query_chunk
