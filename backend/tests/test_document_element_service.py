from __future__ import annotations

import uuid
from types import SimpleNamespace

from app.services.document_element_service import (
    select_chunks_for_elements,
    select_representative_elements,
)


def _element(
    order: int,
    element_type: str,
    page: int,
    text: str | None = None,
):
    return SimpleNamespace(
        id=uuid.uuid4(),
        element_type=element_type,
        page_start=page,
        page_end=page,
        reading_order=order,
        text=text or f"{element_type} content {order} " + ("detail " * 8),
    )


def _chunk(index: int, page: int):
    return SimpleNamespace(
        id=uuid.uuid4(),
        document_id=uuid.uuid4(),
        chunk_index=index,
        text=f"Chunk {index} " + ("material context " * 10),
        page_start=page,
        page_end=page,
        bboxes=[],
        section_title=None,
    )


def test_representative_elements_keep_structure_and_tail() -> None:
    elements = [
        _element(0, "heading", 1, "Intro"),
        *[_element(i, "paragraph", i + 1) for i in range(1, 12)],
        _element(12, "table", 8, "Table page 8\nCompany | Rating"),
        _element(13, "paragraph", 14, "Conclusion " * 8),
    ]

    selected = select_representative_elements(elements, max_elements=6)
    selected_orders = [element.reading_order for element in selected]

    assert 0 in selected_orders
    assert 12 in selected_orders
    assert 13 in selected_orders
    assert selected_orders == sorted(selected_orders)
    assert len(selected_orders) <= 6


def test_select_chunks_for_elements_covers_table_page_without_vector_top_k() -> None:
    chunks = [_chunk(0, 1), _chunk(1, 4), _chunk(2, 8), _chunk(3, 12)]
    elements = [
        _element(0, "heading", 1, "Intro"),
        _element(1, "paragraph", 4),
        _element(2, "table", 8, "Table page 8\nMetric | Value\nRevenue | $42m"),
        _element(3, "paragraph", 12, "Conclusion " * 8),
    ]

    selected = select_chunks_for_elements(chunks, elements, max_chunks=3)
    selected_pages = [chunk.page_start for chunk, _score in selected]

    assert 8 in selected_pages
    assert len(selected) == 3
