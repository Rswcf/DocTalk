from __future__ import annotations

import asyncio
import math
import uuid
from dataclasses import dataclass
from typing import Any, Protocol, Sequence

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.tables import Chunk, Document, DocumentBrief
from app.services.document_element_service import (
    chunk_to_retrieval_item,
    get_element_aware_chunks_async,
)

MIN_SUMMARY_CHUNK_CHARS = 80
DEFAULT_MAX_SUMMARY_CHUNKS = 18
DEFAULT_MAX_COLLECTION_SUMMARY_CHUNKS = 24
DEFAULT_MAX_COLLECTION_SUMMARY_DOCS = 8
DEFAULT_MAP_REDUCE_MIN_CHUNKS = 36


@dataclass(frozen=True)
class SectionMapGroup:
    group_index: int
    chunks: tuple[Any, ...]
    section_titles: tuple[str, ...]


@dataclass(frozen=True)
class MapStepResult:
    group_index: int
    summary: str
    selected_chunk_ids: tuple[uuid.UUID, ...]
    covered_sections: tuple[str, ...]


class MapStep(Protocol):
    async def __call__(self, group: SectionMapGroup) -> MapStepResult: ...


class ReduceStep(Protocol):
    async def __call__(
        self,
        mapped: list[MapStepResult],
        *,
        max_total_chunks: int,
    ) -> list[uuid.UUID]: ...


def _chunk_text_length(chunk: Any) -> int:
    return len((getattr(chunk, "text", "") or "").strip())


def _chunk_section_title(chunk: Any) -> str:
    section = str(getattr(chunk, "section_title", "") or "").strip()
    if section:
        return section[:200]
    page = getattr(chunk, "page_start", None)
    if isinstance(page, int):
        return f"Page {page}"
    return "Untitled"


def _dynamic_section_group_count(
    chunks_total: int,
    *,
    min_groups: int = 2,
    max_groups: int = 18,
    target_chunks_per_group: int = 12,
) -> int:
    total = max(0, int(chunks_total or 0))
    if total <= 0:
        return min_groups
    groups = math.ceil(total / max(1, target_chunks_per_group))
    return max(min_groups, min(max_groups, groups))


def _dynamic_summary_chunk_budget(
    base_max_chunks: int,
    *,
    chunks_total: int,
    section_total: int,
    max_total_chunks_cap: int,
) -> int:
    floor = max(int(base_max_chunks or DEFAULT_MAX_SUMMARY_CHUNKS), DEFAULT_MAX_SUMMARY_CHUNKS)
    budget = max(floor, min(max_total_chunks_cap, floor + (max(0, chunks_total) // 24)))
    if section_total > 0:
        budget = max(budget, min(max_total_chunks_cap, section_total))
    return min(max_total_chunks_cap, max(1, budget))


def _section_segments(chunks: Sequence[Any]) -> list[tuple[str, list[Any]]]:
    segments: list[tuple[str, list[Any]]] = []
    current_title: str | None = None
    current_items: list[Any] = []

    for chunk in chunks:
        title = _chunk_section_title(chunk)
        if current_title is None:
            current_title = title
            current_items = [chunk]
            continue
        if title == current_title:
            current_items.append(chunk)
            continue
        segments.append((current_title, current_items))
        current_title = title
        current_items = [chunk]

    if current_title is not None and current_items:
        segments.append((current_title, current_items))
    return segments


def _group_segments(
    segments: Sequence[tuple[str, list[Any]]],
    *,
    target_groups: int,
) -> list[SectionMapGroup]:
    if not segments:
        return []
    if target_groups <= 0:
        target_groups = 1
    target_groups = min(target_groups, len(segments))
    grouped: list[list[tuple[str, list[Any]]]] = [[] for _ in range(target_groups)]
    total = len(segments)
    for idx, segment in enumerate(segments):
        group_index = min(target_groups - 1, (idx * target_groups) // total)
        grouped[group_index].append(segment)

    result: list[SectionMapGroup] = []
    for group_index, raw_segments in enumerate(grouped):
        if not raw_segments:
            continue
        section_titles: list[str] = []
        chunks: list[Any] = []
        for title, seg_chunks in raw_segments:
            section_titles.append(title)
            chunks.extend(seg_chunks)
        result.append(
            SectionMapGroup(
                group_index=group_index,
                chunks=tuple(chunks),
                section_titles=tuple(section_titles),
            )
        )
    return result


class SectionMapReducePlanner:
    def __init__(
        self,
        *,
        map_step: MapStep | None = None,
        reduce_step: ReduceStep | None = None,
        min_groups: int = 2,
        max_groups: int = 18,
        max_group_chunks: int = 6,
        max_total_chunks_cap: int = 64,
        max_concurrency: int = 4,
    ) -> None:
        self._map_step = map_step
        self._reduce_step = reduce_step
        self._min_groups = max(1, int(min_groups))
        self._max_groups = max(self._min_groups, int(max_groups))
        self._max_group_chunks = max(1, int(max_group_chunks))
        self._max_total_chunks_cap = max(1, int(max_total_chunks_cap))
        self._max_concurrency = max(1, int(max_concurrency))

    def _truncate_group_chunks(self, group: SectionMapGroup) -> SectionMapGroup:
        """Cap per-group map context while preserving at least one chunk/section."""
        section_anchor_set: set[uuid.UUID] = set()
        selected: list[Any] = []
        seen_sections: set[str] = set()
        for chunk in group.chunks:
            section = _chunk_section_title(chunk)
            if section in seen_sections:
                continue
            seen_sections.add(section)
            selected.append(chunk)
            section_anchor_set.add(chunk.id)

        # Fill extra room with evenly spaced body chunks for long sections.
        if len(selected) < self._max_group_chunks and len(group.chunks) > len(selected):
            remaining = [
                chunk
                for chunk in group.chunks
                if chunk.id not in section_anchor_set
            ]
            budget = self._max_group_chunks - len(selected)
            if remaining and budget > 0:
                if len(remaining) <= budget:
                    selected.extend(remaining)
                elif budget == 1:
                    selected.append(remaining[len(remaining) // 2])
                else:
                    for slot in range(budget):
                        selected.append(
                            remaining[round(slot * (len(remaining) - 1) / (budget - 1))]
                        )

        if not selected:
            return group

        # Keep map payload ordered by chunk index.
        selected.sort(key=lambda chunk: int(getattr(chunk, "chunk_index", 0) or 0))
        if len(selected) > self._max_group_chunks:
            if self._max_group_chunks == 1:
                selected = [selected[len(selected) // 2]]
            else:
                last_index = len(selected) - 1
                selected = [
                    selected[(slot * last_index) // (self._max_group_chunks - 1)]
                    for slot in range(self._max_group_chunks)
                ]
        return SectionMapGroup(
            group_index=group.group_index,
            chunks=tuple(selected),
            section_titles=group.section_titles,
        )

    async def _default_map_step(self, group: SectionMapGroup) -> MapStepResult:
        selected_ids: list[uuid.UUID] = []
        covered_sections: list[str] = []
        seen_sections: set[str] = set()

        for chunk in group.chunks:
            section = _chunk_section_title(chunk)
            if section in seen_sections:
                continue
            seen_sections.add(section)
            covered_sections.append(section)
            selected_ids.append(chunk.id)

        if not selected_ids and group.chunks:
            selected_ids.append(group.chunks[0].id)
            covered_sections.append(_chunk_section_title(group.chunks[0]))

        summary = f"Group {group.group_index} covers {len(covered_sections)} sections."
        return MapStepResult(
            group_index=group.group_index,
            summary=summary,
            selected_chunk_ids=tuple(selected_ids),
            covered_sections=tuple(covered_sections),
        )

    async def _default_reduce_step(
        self,
        mapped: list[MapStepResult],
        *,
        max_total_chunks: int,
    ) -> list[uuid.UUID]:
        ordered: list[uuid.UUID] = []
        seen: set[uuid.UUID] = set()
        for item in sorted(mapped, key=lambda value: value.group_index):
            for chunk_id in item.selected_chunk_ids:
                if chunk_id in seen:
                    continue
                seen.add(chunk_id)
                ordered.append(chunk_id)
                if len(ordered) >= max_total_chunks:
                    return ordered
        return ordered[:max_total_chunks]

    async def _run_map_step(self, group: SectionMapGroup, semaphore: asyncio.Semaphore) -> MapStepResult:
        async with semaphore:
            step = self._map_step or self._default_map_step
            return await step(group)

    async def select_chunks_for_summary(
        self,
        chunks: Sequence[Any],
        *,
        max_chunks: int,
    ) -> list[Any]:
        ordered_chunks = sorted(chunks, key=lambda chunk: int(getattr(chunk, "chunk_index", 0) or 0))
        if not ordered_chunks:
            return []

        segments = _section_segments(ordered_chunks)
        if not segments:
            return list(ordered_chunks[:max_chunks])

        section_total = len(segments)
        desired_groups = _dynamic_section_group_count(
            len(ordered_chunks),
            min_groups=self._min_groups,
            max_groups=self._max_groups,
        )
        section_bound_groups = math.ceil(section_total / max(1, self._max_group_chunks))
        target_groups = min(self._max_groups, max(desired_groups, section_bound_groups))
        target_groups = max(self._min_groups, min(target_groups, section_total))

        groups = _group_segments(segments, target_groups=target_groups)
        prepared_groups = [self._truncate_group_chunks(group) for group in groups]
        if not prepared_groups:
            return list(ordered_chunks[:max_chunks])

        max_total_chunks = _dynamic_summary_chunk_budget(
            max_chunks,
            chunks_total=len(ordered_chunks),
            section_total=section_total,
            max_total_chunks_cap=self._max_total_chunks_cap,
        )

        semaphore = asyncio.Semaphore(self._max_concurrency)
        mapped = await asyncio.gather(
            *(self._run_map_step(group, semaphore) for group in prepared_groups)
        )
        reduce_step = self._reduce_step or self._default_reduce_step
        selected_ids = await reduce_step(mapped, max_total_chunks=max_total_chunks)

        if not selected_ids:
            selected_ids = [
                group.chunks[0].id
                for group in prepared_groups
                if group.chunks
            ][:max_total_chunks]

        chunk_by_id = {chunk.id: chunk for chunk in ordered_chunks}
        selected: list[Any] = []
        seen: set[uuid.UUID] = set()
        for chunk_id in selected_ids:
            chunk = chunk_by_id.get(chunk_id)
            if chunk is None or chunk.id in seen:
                continue
            seen.add(chunk.id)
            selected.append(chunk)

        return selected


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
    def __init__(
        self,
        *,
        section_map_reduce: SectionMapReducePlanner | None = None,
        map_reduce_min_chunks: int = DEFAULT_MAP_REDUCE_MIN_CHUNKS,
    ) -> None:
        self._section_map_reduce = section_map_reduce or SectionMapReducePlanner()
        self._map_reduce_min_chunks = max(1, int(map_reduce_min_chunks))

    def _should_use_map_reduce(
        self,
        chunks: Sequence[Any],
        *,
        max_chunks: int,
        element_chunks_count: int,
        section_total: int = 0,
    ) -> bool:
        if max_chunks < DEFAULT_MAX_SUMMARY_CHUNKS:
            # Collection summary allocates a narrow per-document budget.
            return False
        chunks_total = len(chunks)
        scale_units = max(chunks_total, max(0, int(section_total or 0)))
        if scale_units < self._map_reduce_min_chunks:
            return False
        if chunks_total <= max_chunks and section_total <= max_chunks:
            return False
        if section_total > max_chunks:
            return True
        if element_chunks_count >= max_chunks:
            return True
        # No reliable element coverage: still promote large docs to section map-reduce.
        return scale_units >= max(max_chunks * 2, self._map_reduce_min_chunks)

    async def get_summary_context(
        self,
        db: AsyncSession,
        document_id: uuid.UUID,
        *,
        max_chunks: int = DEFAULT_MAX_SUMMARY_CHUNKS,
    ) -> list[dict[str, Any]]:
        persisted = await self._get_persisted_summary_context(
            db,
            document_id,
            max_chunks=max_chunks,
        )
        if persisted and max_chunks < DEFAULT_MAX_SUMMARY_CHUNKS:
            # Collection / narrow-budget paths should keep using persisted brief context.
            return persisted

        element_result = await get_element_aware_chunks_async(
            db,
            document_id,
            max_chunks=max_chunks,
            return_prefetched_chunks=True,
        )
        element_chunks: list[tuple[Chunk, float]]
        prefetched_chunks: list[Chunk]
        if (
            isinstance(element_result, tuple)
            and len(element_result) == 2
            and isinstance(element_result[0], list)
            and isinstance(element_result[1], list)
        ):
            element_chunks = element_result[0]
            prefetched_chunks = element_result[1]
        else:
            element_chunks = list(element_result or [])
            prefetched_chunks = []
        if prefetched_chunks:
            chunks = prefetched_chunks
        else:
            rows = await db.execute(
                select(Chunk)
                .where(Chunk.document_id == document_id)
                .order_by(Chunk.chunk_index)
            )
            chunks = list(rows.scalars())

        section_total = len({_chunk_section_title(chunk) for chunk in chunks})
        if self._should_use_map_reduce(
            chunks,
            max_chunks=max_chunks,
            element_chunks_count=len(element_chunks),
            section_total=section_total,
        ):
            selected_map_reduce = await self._section_map_reduce.select_chunks_for_summary(
                chunks,
                max_chunks=max_chunks,
            )
            if selected_map_reduce:
                total = max(1, len(selected_map_reduce))
                return [
                    _chunk_to_retrieval_item(
                        chunk,
                        1.0 - (idx / (total + 1)) * 0.2,
                    )
                    for idx, chunk in enumerate(selected_map_reduce)
                ]

        if persisted:
            return persisted

        if element_chunks:
            return [
                chunk_to_retrieval_item(chunk, score, include_document_id=True)
                for chunk, score in element_chunks
            ]

        selected = _select_representative_chunks(chunks, max_chunks=max_chunks)
        total = max(1, len(selected))
        return [
            _chunk_to_retrieval_item(chunk, 1.0 - (idx / (total + 1)) * 0.2)
            for idx, chunk in enumerate(selected)
        ]

    async def _get_persisted_summary_context(
        self,
        db: AsyncSession,
        document_id: uuid.UUID,
        *,
        max_chunks: int,
    ) -> list[dict[str, Any]]:
        brief_row = await db.execute(
            select(DocumentBrief.coverage).where(DocumentBrief.document_id == document_id)
        )
        coverage = brief_row.scalar_one_or_none()
        if not isinstance(coverage, dict):
            return []
        raw_ids = coverage.get("selected_chunk_ids")
        if not isinstance(raw_ids, list) or not raw_ids:
            return []

        chunk_ids: list[uuid.UUID] = []
        for raw_id in raw_ids[:max_chunks]:
            try:
                chunk_ids.append(uuid.UUID(str(raw_id)))
            except (TypeError, ValueError):
                continue
        if not chunk_ids:
            return []

        rows = await db.execute(
            select(Chunk)
            .where(Chunk.document_id == document_id)
            .where(Chunk.id.in_(chunk_ids))
        )
        chunks_by_id = {chunk.id: chunk for chunk in rows.scalars()}
        ordered = [
            chunks_by_id[chunk_id]
            for chunk_id in chunk_ids
            if chunk_id in chunks_by_id
        ]
        total = max(1, len(ordered))
        return [
            _chunk_to_retrieval_item(chunk, 1.0 - (idx / (total + 1)) * 0.2)
            for idx, chunk in enumerate(ordered)
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
