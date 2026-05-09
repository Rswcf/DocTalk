from __future__ import annotations

import math
import uuid
from typing import Any, Sequence

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Session

from app.models.tables import Chunk, DocumentElement

MIN_ELEMENT_TEXT_CHARS = 24
MIN_CONTEXT_CHUNK_CHARS = 80


def _element_text_length(element: Any) -> int:
    return len((getattr(element, "text", "") or "").strip())


def _usable_elements(elements: Sequence[Any]) -> list[Any]:
    usable: list[Any] = []
    for element in elements:
        element_type = (getattr(element, "element_type", "") or "").strip()
        text_len = _element_text_length(element)
        if element_type == "table":
            usable.append(element)
        elif element_type == "heading" and text_len >= 3:
            usable.append(element)
        elif text_len >= MIN_ELEMENT_TEXT_CHARS:
            usable.append(element)
    return sorted(usable, key=lambda el: int(getattr(el, "reading_order", 0) or 0))


def select_representative_elements(
    elements: Sequence[Any],
    *,
    max_elements: int,
) -> list[Any]:
    """Select broad document structure without relying on vector top-k.

    The selector keeps orientation, section transitions, table elements, tail
    coverage, and evenly spaced body coverage. The result is deterministic so
    summaries/extractions/diffs get stable context while the legacy chunk
    retriever remains available for local question answering.
    """
    usable = _usable_elements(elements)
    if not usable or max_elements <= 0:
        return []
    if len(usable) <= max_elements:
        return usable

    selected_indices: set[int] = set()
    front_count = min(4, max(1, max_elements // 3))
    selected_indices.update(range(front_count))
    selected_indices.update(range(max(0, len(usable) - 2), len(usable)))

    for priority_type in ("table", "heading"):
        for idx, element in enumerate(usable):
            if getattr(element, "element_type", "") == priority_type:
                selected_indices.add(idx)
            if len(selected_indices) >= max_elements:
                break
        if len(selected_indices) >= max_elements:
            break

    remaining = max_elements - len(selected_indices)
    if remaining > 0:
        if remaining == 1:
            selected_indices.add(len(usable) // 2)
        else:
            for slot in range(remaining):
                selected_indices.add(round(slot * (len(usable) - 1) / (remaining - 1)))

    if len(selected_indices) > max_elements:
        fixed = set(range(front_count))
        fixed.update(range(max(0, len(usable) - 2), len(usable)))
        middle_budget = max(0, max_elements - len(fixed))
        middle = [idx for idx in sorted(selected_indices) if idx not in fixed]
        if middle_budget and middle:
            step = max(1, math.ceil(len(middle) / middle_budget))
            fixed.update(middle[::step][:middle_budget])
        selected_indices = set(sorted(fixed)[:max_elements])

    return [usable[idx] for idx in sorted(selected_indices)[:max_elements]]


def _chunk_overlaps_element(chunk: Chunk, element: Any) -> bool:
    return (
        int(chunk.page_start or 1) <= int(getattr(element, "page_end", 1) or 1)
        and int(chunk.page_end or chunk.page_start or 1) >= int(getattr(element, "page_start", 1) or 1)
    )


def _element_score(element: Any, rank: int) -> float:
    element_type = getattr(element, "element_type", "") or ""
    base = {
        "table": 0.92,
        "heading": 0.88,
        "paragraph": 0.82,
        "caption": 0.80,
        "figure": 0.78,
        "footnote": 0.76,
    }.get(element_type, 0.78)
    return max(0.55, base - rank * 0.01)


def select_chunks_for_elements(
    chunks: Sequence[Chunk],
    elements: Sequence[Any],
    *,
    max_chunks: int,
) -> list[tuple[Chunk, float]]:
    if max_chunks <= 0:
        return []

    ordered_chunks = sorted(chunks, key=lambda ch: int(ch.chunk_index or 0))
    usable_chunks = [
        chunk for chunk in ordered_chunks
        if len((chunk.text or "").strip()) >= MIN_CONTEXT_CHUNK_CHARS
    ] or ordered_chunks
    if not usable_chunks:
        return []

    selected: list[tuple[Chunk, float]] = []
    seen: set[uuid.UUID] = set()
    representative_elements = select_representative_elements(
        elements,
        max_elements=max(max_chunks * 2, max_chunks),
    )

    for rank, element in enumerate(representative_elements):
        if len(selected) >= max_chunks:
            break
        element_mid = (
            int(getattr(element, "page_start", 1) or 1)
            + int(getattr(element, "page_end", getattr(element, "page_start", 1)) or 1)
        ) / 2
        candidates = [
            chunk for chunk in usable_chunks
            if chunk.id not in seen and _chunk_overlaps_element(chunk, element)
        ]
        if not candidates:
            continue
        chosen = min(
            candidates,
            key=lambda chunk: (
                abs(element_mid - ((int(chunk.page_start or 1) + int(chunk.page_end or chunk.page_start or 1)) / 2)),
                int(chunk.chunk_index or 0),
            ),
        )
        seen.add(chosen.id)
        selected.append((chosen, _element_score(element, rank)))

    if len(selected) >= max_chunks:
        return selected[:max_chunks]

    remaining = [chunk for chunk in usable_chunks if chunk.id not in seen]
    remaining_budget = max_chunks - len(selected)
    if remaining_budget <= 0 or not remaining:
        return selected

    if len(remaining) <= remaining_budget:
        fill = remaining
    elif remaining_budget == 1:
        fill = [remaining[len(remaining) // 2]]
    else:
        fill = [
            remaining[round(slot * (len(remaining) - 1) / (remaining_budget - 1))]
            for slot in range(remaining_budget)
        ]
    for idx, chunk in enumerate(fill):
        if chunk.id in seen:
            continue
        selected.append((chunk, max(0.5, 0.72 - idx * 0.01)))
        seen.add(chunk.id)
        if len(selected) >= max_chunks:
            break
    return selected[:max_chunks]


def chunk_to_retrieval_item(chunk: Chunk, score: float, *, include_document_id: bool = False) -> dict[str, Any]:
    item = {
        "chunk_id": chunk.id,
        "text": chunk.text,
        "page": chunk.page_start,
        "page_end": chunk.page_end,
        "bboxes": chunk.bboxes,
        "score": score,
        "section_title": chunk.section_title,
    }
    if include_document_id:
        item["document_id"] = chunk.document_id
    return item


def get_element_aware_chunks(
    db: Session,
    document_id: uuid.UUID,
    *,
    max_chunks: int,
) -> list[tuple[Chunk, float]]:
    element_rows = db.execute(
        select(DocumentElement)
        .where(DocumentElement.document_id == document_id)
        .order_by(DocumentElement.reading_order)
    )
    elements = list(element_rows.scalars())
    if not _usable_elements(elements):
        return []

    chunk_rows = db.execute(
        select(Chunk)
        .where(Chunk.document_id == document_id)
        .order_by(Chunk.chunk_index)
    )
    chunks = list(chunk_rows.scalars())
    return select_chunks_for_elements(chunks, elements, max_chunks=max_chunks)


async def get_element_aware_chunks_async(
    db: AsyncSession,
    document_id: uuid.UUID,
    *,
    max_chunks: int,
) -> list[tuple[Chunk, float]]:
    element_rows = await db.execute(
        select(DocumentElement)
        .where(DocumentElement.document_id == document_id)
        .order_by(DocumentElement.reading_order)
    )
    elements = list(element_rows.scalars())
    if not _usable_elements(elements):
        return []

    chunk_rows = await db.execute(
        select(Chunk)
        .where(Chunk.document_id == document_id)
        .order_by(Chunk.chunk_index)
    )
    chunks = list(chunk_rows.scalars())
    return select_chunks_for_elements(chunks, elements, max_chunks=max_chunks)
