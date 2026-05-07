from __future__ import annotations

import math
import uuid
from typing import Any, Sequence

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.tables import Chunk, Document

MIN_SUMMARY_CHUNK_CHARS = 80
DEFAULT_MAX_SUMMARY_CHUNKS = 18
DEFAULT_MAX_COLLECTION_SUMMARY_CHUNKS = 24
DEFAULT_MAX_COLLECTION_SUMMARY_DOCS = 8


def _chunk_text_length(chunk: Any) -> int:
    return len((getattr(chunk, "text", "") or "").strip())


def _select_representative_chunks(
    chunks: Sequence[Any],
    *,
    max_chunks: int = DEFAULT_MAX_SUMMARY_CHUNKS,
) -> list[Any]:
    """Select ordered chunks for broad document coverage.

    This deliberately does not use query similarity. Whole-document summaries
    need beginning/middle/end coverage and section diversity, while semantic
    top-k often over-selects tables, appendices, or repeated sidebars for vague
    prompts like "summarize this document".
    """
    usable = [
        ch for ch in chunks
        if _chunk_text_length(ch) >= MIN_SUMMARY_CHUNK_CHARS
    ]
    if not usable:
        return list(chunks[:max_chunks])
    if len(usable) <= max_chunks:
        return list(usable)

    selected_indices: set[int] = set()

    # Preserve early orientation: title, thesis, intro, abstract often appear
    # near the front, but cap it to avoid front-loaded summaries.
    front_count = min(4, max_chunks // 3)
    selected_indices.update(range(front_count))

    # Keep likely conclusion / appendix tail coverage without over-weighting it.
    selected_indices.update(range(max(0, len(usable) - 2), len(usable)))

    # Add chunks when a new section title appears. This recovers broad structure
    # cheaply until a durable section index exists.
    seen_sections: set[str] = set()
    for idx, chunk in enumerate(usable):
        section = (getattr(chunk, "section_title", None) or "").strip().lower()
        if not section or section in seen_sections:
            continue
        seen_sections.add(section)
        selected_indices.add(idx)
        if len(selected_indices) >= max_chunks:
            break

    # Fill remaining budget with evenly spaced coverage.
    remaining = max_chunks - len(selected_indices)
    if remaining > 0:
        if remaining == 1:
            selected_indices.add(len(usable) // 2)
        else:
            for slot in range(remaining):
                idx = round(slot * (len(usable) - 1) / (remaining - 1))
                selected_indices.add(idx)

    # If section titles consumed too much budget, keep deterministic coverage:
    # earliest orientation, evenly-spaced body, tail.
    if len(selected_indices) > max_chunks:
        fixed = set(range(front_count))
        fixed.update(range(max(0, len(usable) - 2), len(usable)))
        middle_budget = max_chunks - len(fixed)
        middle = [
            idx for idx in selected_indices
            if idx not in fixed
        ]
        if middle_budget > 0 and middle:
            step = max(1, math.ceil(len(middle) / middle_budget))
            fixed.update(middle[::step][:middle_budget])
        selected_indices = set(sorted(fixed)[:max_chunks])

    return [usable[idx] for idx in sorted(selected_indices)[:max_chunks]]


def _chunk_to_retrieval_item(chunk: Chunk, score: float) -> dict[str, Any]:
    return {
        "chunk_id": chunk.id,
        "text": chunk.text,
        "page": chunk.page_start,
        "page_end": chunk.page_end,
        "bboxes": chunk.bboxes,
        "score": score,
        "section_title": chunk.section_title,
        "document_id": chunk.document_id,
    }


class DocumentBriefService:
    async def get_summary_context(
        self,
        db: AsyncSession,
        document_id: uuid.UUID,
        *,
        max_chunks: int = DEFAULT_MAX_SUMMARY_CHUNKS,
    ) -> list[dict[str, Any]]:
        rows = await db.execute(
            select(Chunk)
            .where(Chunk.document_id == document_id)
            .order_by(Chunk.chunk_index)
        )
        chunks = list(rows.scalars())
        selected = _select_representative_chunks(chunks, max_chunks=max_chunks)
        total = max(1, len(selected))
        return [
            _chunk_to_retrieval_item(chunk, 1.0 - (idx / (total + 1)) * 0.2)
            for idx, chunk in enumerate(selected)
        ]

    async def get_collection_summary_context(
        self,
        db: AsyncSession,
        document_ids: Sequence[uuid.UUID],
        *,
        max_chunks: int = DEFAULT_MAX_COLLECTION_SUMMARY_CHUNKS,
        max_docs: int = DEFAULT_MAX_COLLECTION_SUMMARY_DOCS,
    ) -> list[dict[str, Any]]:
        selected_doc_ids = list(document_ids[:max_docs])
        if not selected_doc_ids:
            return []

        per_doc_budget = max(1, max_chunks // len(selected_doc_ids))
        contexts: list[dict[str, Any]] = []
        for doc_id in selected_doc_ids:
            contexts.extend(
                await self.get_summary_context(
                    db,
                    doc_id,
                    max_chunks=per_doc_budget,
                )
            )
            if len(contexts) >= max_chunks:
                break
        return contexts[:max_chunks]

    async def get_document_label(self, db: AsyncSession, document_id: uuid.UUID) -> str:
        doc = await db.get(Document, document_id)
        return doc.filename if doc else "document"


document_brief_service = DocumentBriefService()
