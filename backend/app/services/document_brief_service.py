from __future__ import annotations

import asyncio
import json
import logging
import math
import re
import uuid
from dataclasses import dataclass
from typing import Any, Protocol, Sequence

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.tables import Chunk, Document, DocumentBrief
from app.services.document_element_service import (
    chunk_to_retrieval_item,
    get_element_aware_chunks_async,
)

logger = logging.getLogger(__name__)

MIN_SUMMARY_CHUNK_CHARS = 80
DEFAULT_MAX_SUMMARY_CHUNKS = 18
DEFAULT_MAX_COLLECTION_SUMMARY_CHUNKS = 24
DEFAULT_MAX_COLLECTION_SUMMARY_DOCS = 8
DEFAULT_MAP_REDUCE_MIN_CHUNKS = 36
MAP_REDUCE_MAX_CHARS_PER_CHUNK = 900
MAP_REDUCE_MAX_CONTEXT_ITEM_CHARS = 3000


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


@dataclass(frozen=True)
class MapReduceContextItem:
    group_index: int
    text: str
    anchor_chunk_id: uuid.UUID
    source_chunk_ids: tuple[uuid.UUID, ...]
    covered_sections: tuple[str, ...]


@dataclass(frozen=True)
class MapReduceSummaryResult:
    summary: str
    context_items: tuple[MapReduceContextItem, ...]
    selected_chunk_ids: tuple[uuid.UUID, ...]
    covered_sections: tuple[str, ...]
    strategy: str = "map_reduce"


class MapStep(Protocol):
    async def __call__(self, group: SectionMapGroup) -> MapStepResult: ...


class ReduceStep(Protocol):
    async def __call__(
        self,
        mapped: list[MapStepResult],
        *,
        max_total_chunks: int,
    ) -> list[uuid.UUID] | MapReduceSummaryResult: ...


def _chunk_text_length(chunk: Any) -> int:
    return len((getattr(chunk, "text", "") or "").strip())


def _raw_chunk_section_title(chunk: Any) -> str:
    return str(getattr(chunk, "section_title", "") or "").strip()[:200]


def _is_noisy_section_title(title: str) -> bool:
    normalized = re.sub(r"\s+", " ", (title or "").strip())
    if not normalized:
        return False
    if len(normalized) <= 1:
        return True
    if not re.search(r"[A-Za-z0-9\u0080-\uffff]", normalized):
        return True
    return bool(re.fullmatch(r"[\d\s\.,;:()\[\]{}#\-_/]+", normalized))


def _chunk_has_noisy_section_title(chunk: Any) -> bool:
    raw_title = _raw_chunk_section_title(chunk)
    return bool(raw_title) and _is_noisy_section_title(raw_title)


def _json_from_text(text: str) -> dict[str, Any]:
    content = (text or "").strip()
    if content.startswith("```"):
        content = re.sub(r"^```(?:json)?\s*", "", content)
        content = re.sub(r"\s*```$", "", content)
    try:
        data = json.loads(content)
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", content, flags=re.DOTALL)
        if not match:
            raise
        data = json.loads(match.group(0))
    if not isinstance(data, dict):
        raise ValueError("Map-reduce response must be a JSON object")
    return data


def _chunk_section_title(chunk: Any) -> str:
    section = _raw_chunk_section_title(chunk)
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
        if _chunk_has_noisy_section_title(chunk):
            if current_title is not None:
                current_items.append(chunk)
            continue
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
        map_model: str | None = None,
        reduce_model: str | None = None,
        map_timeout_seconds: float = 20.0,
        reduce_timeout_seconds: float = 30.0,
    ) -> None:
        self._map_step = map_step
        self._reduce_step = reduce_step
        self._min_groups = max(1, int(min_groups))
        self._max_groups = max(self._min_groups, int(max_groups))
        self._max_group_chunks = max(1, int(max_group_chunks))
        self._max_total_chunks_cap = max(1, int(max_total_chunks_cap))
        self._max_concurrency = max(1, int(max_concurrency))
        self._map_model = map_model or settings.MODE_MODELS.get("quick", settings.LLM_MODEL)
        self._reduce_model = reduce_model or settings.MODE_MODELS.get("quick", settings.LLM_MODEL)
        self._map_timeout_seconds = max(1.0, float(map_timeout_seconds))
        self._reduce_timeout_seconds = max(1.0, float(reduce_timeout_seconds))

    def _truncate_group_chunks(
        self,
        group: SectionMapGroup,
        *,
        max_group_chunks: int | None = None,
    ) -> SectionMapGroup:
        """Cap per-group map context while preserving at least one chunk/section."""
        group_chunk_limit = max(1, int(max_group_chunks or self._max_group_chunks))
        section_anchor_set: set[uuid.UUID] = set()
        selected: list[Any] = []
        seen_sections: set[str] = set()
        for chunk in group.chunks:
            if _chunk_has_noisy_section_title(chunk):
                continue
            section = _chunk_section_title(chunk)
            if section in seen_sections:
                continue
            seen_sections.add(section)
            selected.append(chunk)
            section_anchor_set.add(chunk.id)

        # Fill extra room with evenly spaced body chunks for long sections.
        if len(selected) < group_chunk_limit and len(group.chunks) > len(selected):
            remaining = [
                chunk
                for chunk in group.chunks
                if chunk.id not in section_anchor_set
            ]
            budget = group_chunk_limit - len(selected)
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
        if len(selected) > group_chunk_limit:
            if group_chunk_limit == 1:
                selected = [selected[len(selected) // 2]]
            else:
                last_index = len(selected) - 1
                selected = [
                    selected[(slot * last_index) // (group_chunk_limit - 1)]
                    for slot in range(group_chunk_limit)
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
            if _chunk_has_noisy_section_title(chunk):
                continue
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

    def _build_map_chunks_text(self, group: SectionMapGroup) -> str:
        parts: list[str] = []
        for ref, chunk in enumerate(group.chunks, start=1):
            section = _chunk_section_title(chunk)
            page_start = int(getattr(chunk, "page_start", 0) or 0)
            page_end = int(getattr(chunk, "page_end", page_start) or page_start)
            page = f"p.{page_start}" if page_start == page_end else f"p.{page_start}-{page_end}"
            text = (getattr(chunk, "text", "") or "").strip()[:MAP_REDUCE_MAX_CHARS_PER_CHUNK]
            parts.append(f"ref {ref} | {page} | section: {section}\n{text}")
        return "\n\n".join(parts)

    async def _llm_json_completion(
        self,
        *,
        model: str,
        messages: list[dict[str, str]],
        max_tokens: int,
        timeout_seconds: float,
    ) -> dict[str, Any]:
        from app.services.chat_service import _apply_provider_options, _get_llm_client

        client = _get_llm_client(model)
        kwargs: dict[str, Any] = {
            "model": model,
            "max_tokens": max_tokens,
            "temperature": 0.1,
            "messages": messages,
            "stream": False,
            "response_format": {"type": "json_object"},
        }
        _apply_provider_options(kwargs, model)
        response = await asyncio.wait_for(
            client.chat.completions.create(**kwargs),
            timeout=timeout_seconds,
        )
        content = ""
        if getattr(response, "choices", None):
            message = getattr(response.choices[0], "message", None)
            content = str(getattr(message, "content", "") or "")
        return _json_from_text(content)

    def _chunk_ids_from_source_refs(
        self,
        group: SectionMapGroup,
        source_refs: Any,
    ) -> list[uuid.UUID]:
        refs = source_refs if isinstance(source_refs, list) else []
        selected: list[uuid.UUID] = []
        seen: set[uuid.UUID] = set()
        for raw_ref in refs:
            try:
                ref = int(raw_ref)
            except (TypeError, ValueError):
                continue
            if ref < 1 or ref > len(group.chunks):
                continue
            chunk_id = group.chunks[ref - 1].id
            if chunk_id in seen:
                continue
            seen.add(chunk_id)
            selected.append(chunk_id)
        return selected

    def _first_chunk_for_section(
        self,
        group: SectionMapGroup,
        section_title: str,
    ) -> Any | None:
        for chunk in group.chunks:
            if _chunk_has_noisy_section_title(chunk):
                continue
            if _chunk_section_title(chunk) == section_title:
                return chunk
        return group.chunks[0] if group.chunks else None

    async def _llm_map_step(self, group: SectionMapGroup) -> MapStepResult:
        prompt = (
            "You are the map step in a document map-reduce summary pipeline.\n"
            "Summarize this contiguous group of document sections using only the excerpts.\n"
            "Return valid JSON only with this shape:\n"
            '{"group_summary": string, "sections": ['
            '{"title": string, "summary": string, "source_refs": [number]}'
            "]}\n\n"
            "Rules:\n"
            "- Include every section title listed in Target sections exactly once.\n"
            "- source_refs must use the local ref numbers shown in the excerpts.\n"
            "- Keep each section summary concise and factual.\n\n"
            f"Target sections:\n{json.dumps(list(group.section_titles), ensure_ascii=False)}\n\n"
            f"Excerpts:\n{self._build_map_chunks_text(group)}"
        )
        data = await self._llm_json_completion(
            model=self._map_model,
            messages=[{"role": "user", "content": prompt}],
            max_tokens=1800,
            timeout_seconds=self._map_timeout_seconds,
        )

        raw_sections = data.get("sections") if isinstance(data.get("sections"), list) else []
        raw_by_title: dict[str, dict[str, Any]] = {}
        for item in raw_sections:
            if not isinstance(item, dict):
                continue
            title = str(item.get("title") or "").strip()
            if title:
                raw_by_title[title.casefold()] = item

        selected_ids: list[uuid.UUID] = []
        seen_ids: set[uuid.UUID] = set()
        lines: list[str] = []
        for title in group.section_titles:
            raw_item = raw_by_title.get(title.casefold(), {})
            section_summary = str(raw_item.get("summary") or "").strip()
            if not section_summary:
                section_chunk = self._first_chunk_for_section(group, title)
                section_summary = ((getattr(section_chunk, "text", "") or "").strip()[:500])
            source_ids = self._chunk_ids_from_source_refs(group, raw_item.get("source_refs"))
            if not source_ids:
                section_chunk = self._first_chunk_for_section(group, title)
                if section_chunk is not None:
                    source_ids = [section_chunk.id]
            for chunk_id in source_ids:
                if chunk_id in seen_ids:
                    continue
                seen_ids.add(chunk_id)
                selected_ids.append(chunk_id)
            lines.append(f"- {title}: {section_summary}")

        group_summary = str(data.get("group_summary") or "").strip()
        summary = "\n".join(
            part for part in (f"Group summary: {group_summary}" if group_summary else "", *lines) if part
        )
        return MapStepResult(
            group_index=group.group_index,
            summary=summary[:MAP_REDUCE_MAX_CONTEXT_ITEM_CHARS],
            selected_chunk_ids=tuple(selected_ids),
            covered_sections=group.section_titles,
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

    def _context_items_from_mapped(
        self,
        mapped: list[MapStepResult],
        *,
        overview: str = "",
    ) -> tuple[MapReduceContextItem, ...]:
        items: list[MapReduceContextItem] = []
        for position, item in enumerate(sorted(mapped, key=lambda value: value.group_index)):
            if not item.selected_chunk_ids:
                continue
            prefix = ""
            if position == 0 and overview.strip():
                prefix = f"Full-document reduce summary:\n{overview.strip()}\n\n"
            text = (
                f"{prefix}Section group {item.group_index + 1} map summary "
                f"covering: {', '.join(item.covered_sections)}\n{item.summary}"
            )
            items.append(
                MapReduceContextItem(
                    group_index=item.group_index,
                    text=text[:MAP_REDUCE_MAX_CONTEXT_ITEM_CHARS],
                    anchor_chunk_id=item.selected_chunk_ids[0],
                    source_chunk_ids=item.selected_chunk_ids,
                    covered_sections=item.covered_sections,
                )
            )
        return tuple(items)

    def _mapped_covered_sections(self, mapped: list[MapStepResult]) -> tuple[str, ...]:
        covered: list[str] = []
        seen: set[str] = set()
        for item in sorted(mapped, key=lambda value: value.group_index):
            for section in item.covered_sections:
                if section in seen:
                    continue
                seen.add(section)
                covered.append(section)
        return tuple(covered)

    def _mapped_selected_chunk_ids(
        self,
        mapped: list[MapStepResult],
        *,
        max_total_chunks: int,
    ) -> tuple[uuid.UUID, ...]:
        selected: list[uuid.UUID] = []
        seen: set[uuid.UUID] = set()
        for item in sorted(mapped, key=lambda value: value.group_index):
            for chunk_id in item.selected_chunk_ids:
                if chunk_id in seen:
                    continue
                seen.add(chunk_id)
                selected.append(chunk_id)
                if len(selected) >= max_total_chunks:
                    return tuple(selected)
        return tuple(selected)

    async def _llm_reduce_step(
        self,
        mapped: list[MapStepResult],
        *,
        max_total_chunks: int,
    ) -> MapReduceSummaryResult:
        covered_sections = self._mapped_covered_sections(mapped)
        mapped_payload = [
            {
                "group_index": item.group_index,
                "covered_sections": list(item.covered_sections),
                "summary": item.summary,
            }
            for item in sorted(mapped, key=lambda value: value.group_index)
        ]
        prompt = (
            "You are the reduce step in a document map-reduce summary pipeline.\n"
            "Merge the map summaries into a compact, structured full-document brief.\n"
            "Return valid JSON only with this shape:\n"
            '{"summary": string, "covered_sections": [string]}\n\n'
            "Rules:\n"
            "- Preserve coverage of every section title listed below; do not drop tail sections.\n"
            "- Stay within a compact answer budget by grouping related details.\n"
            "- Use only the map summaries.\n\n"
            f"All section titles:\n{json.dumps(list(covered_sections), ensure_ascii=False)}\n\n"
            f"Map summaries:\n{json.dumps(mapped_payload, ensure_ascii=False)}"
        )
        data = await self._llm_json_completion(
            model=self._reduce_model,
            messages=[{"role": "user", "content": prompt}],
            max_tokens=2200,
            timeout_seconds=self._reduce_timeout_seconds,
        )
        overview = str(data.get("summary") or "").strip()
        if not overview:
            overview = "\n".join(item.summary for item in sorted(mapped, key=lambda value: value.group_index))
        return MapReduceSummaryResult(
            summary=overview[:6000],
            context_items=self._context_items_from_mapped(mapped, overview=overview),
            selected_chunk_ids=self._mapped_selected_chunk_ids(
                mapped,
                max_total_chunks=max_total_chunks,
            ),
            covered_sections=covered_sections,
        )

    async def _run_map_step(
        self,
        group: SectionMapGroup,
        semaphore: asyncio.Semaphore,
        *,
        use_llm_default: bool,
        use_injected_step: bool,
    ) -> MapStepResult:
        async with semaphore:
            if use_injected_step and self._map_step is not None:
                step = self._map_step
            elif use_llm_default:
                step = self._llm_map_step
            else:
                step = self._default_map_step
            return await step(group)

    def _plan_groups(
        self,
        chunks: Sequence[Any],
        *,
        ensure_all_section_anchors: bool,
    ) -> tuple[list[Any], list[tuple[str, list[Any]]], list[SectionMapGroup]]:
        ordered_chunks = sorted(chunks, key=lambda chunk: int(getattr(chunk, "chunk_index", 0) or 0))
        if not ordered_chunks:
            return [], [], []

        segments = _section_segments(ordered_chunks)
        if not segments:
            return ordered_chunks, [], []

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
        max_group_chunks = self._max_group_chunks
        if ensure_all_section_anchors and groups:
            max_group_chunks = max(max_group_chunks, max(len(group.section_titles) for group in groups))
        prepared_groups = [
            self._truncate_group_chunks(group, max_group_chunks=max_group_chunks)
            for group in groups
        ]
        return ordered_chunks, segments, prepared_groups

    async def _select_chunks_for_summary(
        self,
        chunks: Sequence[Any],
        *,
        max_chunks: int,
        use_injected_steps: bool,
    ) -> list[Any]:
        ordered_chunks, segments, prepared_groups = self._plan_groups(
            chunks,
            ensure_all_section_anchors=False,
        )
        if not ordered_chunks:
            return []
        if not segments:
            return list(ordered_chunks[:max_chunks])
        if not prepared_groups:
            return list(ordered_chunks[:max_chunks])

        max_total_chunks = _dynamic_summary_chunk_budget(
            max_chunks,
            chunks_total=len(ordered_chunks),
            section_total=len(segments),
            max_total_chunks_cap=self._max_total_chunks_cap,
        )

        semaphore = asyncio.Semaphore(self._max_concurrency)
        mapped = await asyncio.gather(
            *(
                self._run_map_step(
                    group,
                    semaphore,
                    use_llm_default=False,
                    use_injected_step=use_injected_steps,
                )
                for group in prepared_groups
            )
        )
        if use_injected_steps and self._reduce_step is not None:
            reduced = await self._reduce_step(mapped, max_total_chunks=max_total_chunks)
            selected_ids = (
                list(reduced.selected_chunk_ids)
                if isinstance(reduced, MapReduceSummaryResult)
                else list(reduced)
            )
        else:
            selected_ids = await self._default_reduce_step(mapped, max_total_chunks=max_total_chunks)

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

    async def select_chunks_for_summary(
        self,
        chunks: Sequence[Any],
        *,
        max_chunks: int,
    ) -> list[Any]:
        return await self._select_chunks_for_summary(
            chunks,
            max_chunks=max_chunks,
            use_injected_steps=True,
        )

    def _fallback_summary_result(self, selected: Sequence[Any]) -> MapReduceSummaryResult:
        context_items = tuple(
            MapReduceContextItem(
                group_index=idx,
                text=(getattr(chunk, "text", "") or "").strip()[:1400],
                anchor_chunk_id=chunk.id,
                source_chunk_ids=(chunk.id,),
                covered_sections=(_chunk_section_title(chunk),),
            )
            for idx, chunk in enumerate(selected)
        )
        return MapReduceSummaryResult(
            summary="Fallback representative chunk selection.",
            context_items=context_items,
            selected_chunk_ids=tuple(chunk.id for chunk in selected),
            covered_sections=tuple(_chunk_section_title(chunk) for chunk in selected),
            strategy="chunk_selection_fallback",
        )

    def _normalize_summary_result(
        self,
        reduced: list[uuid.UUID] | MapReduceSummaryResult,
        mapped: list[MapStepResult],
        *,
        chunk_by_id: dict[uuid.UUID, Any],
        max_total_chunks: int,
    ) -> MapReduceSummaryResult:
        mapped_covered = self._mapped_covered_sections(mapped)
        if isinstance(reduced, MapReduceSummaryResult):
            summary = reduced.summary
            raw_selected = list(reduced.selected_chunk_ids)
            raw_items = list(reduced.context_items)
            raw_covered = tuple(reduced.covered_sections) or mapped_covered
            strategy = reduced.strategy or "map_reduce"
        else:
            summary = "\n".join(item.summary for item in sorted(mapped, key=lambda value: value.group_index))
            raw_selected = list(reduced)
            raw_items = list(self._context_items_from_mapped(mapped))
            raw_covered = mapped_covered
            strategy = "map_reduce"

        selected: list[uuid.UUID] = []
        seen_selected: set[uuid.UUID] = set()
        for chunk_id in raw_selected:
            if chunk_id not in chunk_by_id or chunk_id in seen_selected:
                continue
            seen_selected.add(chunk_id)
            selected.append(chunk_id)
            if len(selected) >= max_total_chunks:
                break
        if not selected:
            selected = list(
                self._mapped_selected_chunk_ids(
                    mapped,
                    max_total_chunks=max_total_chunks,
                )
            )

        context_items: list[MapReduceContextItem] = []
        for item in raw_items:
            source_ids = tuple(
                chunk_id
                for chunk_id in item.source_chunk_ids
                if chunk_id in chunk_by_id
            )
            if item.anchor_chunk_id in chunk_by_id:
                anchor_id = item.anchor_chunk_id
            elif source_ids:
                anchor_id = source_ids[0]
            else:
                continue
            text = (item.text or "").strip()
            if not text:
                continue
            context_items.append(
                MapReduceContextItem(
                    group_index=item.group_index,
                    text=text[:MAP_REDUCE_MAX_CONTEXT_ITEM_CHARS],
                    anchor_chunk_id=anchor_id,
                    source_chunk_ids=source_ids or (anchor_id,),
                    covered_sections=item.covered_sections,
                )
            )

        if not context_items:
            context_items = list(self._context_items_from_mapped(mapped, overview=summary))

        covered: list[str] = []
        seen_sections: set[str] = set()
        for section in (*raw_covered, *mapped_covered):
            if not section or section in seen_sections:
                continue
            seen_sections.add(section)
            covered.append(section)

        return MapReduceSummaryResult(
            summary=summary[:6000],
            context_items=tuple(context_items[: self._max_groups]),
            selected_chunk_ids=tuple(selected[:max_total_chunks]),
            covered_sections=tuple(covered),
            strategy=strategy,
        )

    async def build_summary_context(
        self,
        chunks: Sequence[Any],
        *,
        max_chunks: int,
    ) -> MapReduceSummaryResult:
        ordered_chunks, segments, prepared_groups = self._plan_groups(
            chunks,
            ensure_all_section_anchors=True,
        )
        if not ordered_chunks:
            return MapReduceSummaryResult(
                summary="",
                context_items=(),
                selected_chunk_ids=(),
                covered_sections=(),
                strategy="empty",
            )
        if not segments or not prepared_groups:
            selected = await self._select_chunks_for_summary(
                ordered_chunks,
                max_chunks=max_chunks,
                use_injected_steps=False,
            )
            return self._fallback_summary_result(selected)

        max_total_chunks = _dynamic_summary_chunk_budget(
            max_chunks,
            chunks_total=len(ordered_chunks),
            section_total=len(segments),
            max_total_chunks_cap=self._max_total_chunks_cap,
        )

        semaphore = asyncio.Semaphore(self._max_concurrency)
        try:
            mapped = await asyncio.gather(
                *(
                    self._run_map_step(
                        group,
                        semaphore,
                        use_llm_default=True,
                        use_injected_step=True,
                    )
                    for group in prepared_groups
                )
            )
            if self._reduce_step is not None:
                reduced = await self._reduce_step(mapped, max_total_chunks=max_total_chunks)
            else:
                reduced = await self._llm_reduce_step(mapped, max_total_chunks=max_total_chunks)
        except Exception:
            logger.exception("Section map-reduce failed; falling back to representative chunks")
            selected = await self._select_chunks_for_summary(
                ordered_chunks,
                max_chunks=max_chunks,
                use_injected_steps=False,
            )
            return self._fallback_summary_result(selected)

        chunk_by_id = {chunk.id: chunk for chunk in ordered_chunks}
        return self._normalize_summary_result(
            reduced,
            mapped,
            chunk_by_id=chunk_by_id,
            max_total_chunks=max_total_chunks,
        )


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


def _map_reduce_context_to_retrieval_items(
    result: MapReduceSummaryResult,
    chunks: Sequence[Chunk],
) -> list[dict[str, Any]]:
    chunk_by_id = {chunk.id: chunk for chunk in chunks}
    items: list[dict[str, Any]] = []
    total = max(1, len(result.context_items))
    for idx, context_item in enumerate(result.context_items):
        anchor = chunk_by_id.get(context_item.anchor_chunk_id)
        if anchor is None:
            continue
        retrieval_item = _chunk_to_retrieval_item(
            anchor,
            1.0 - (idx / (total + 1)) * 0.2,
        )
        retrieval_item["text"] = context_item.text
        retrieval_item["section_title"] = "Map-reduce section summary"
        retrieval_item["retrieval_modality"] = "summary"
        retrieval_item["map_reduce_strategy"] = result.strategy
        retrieval_item["map_reduce_source_chunk_ids"] = [
            str(chunk_id) for chunk_id in context_item.source_chunk_ids
        ]
        retrieval_item["map_reduce_covered_sections"] = list(context_item.covered_sections)
        items.append(retrieval_item)
    return items


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

        section_total = len(_section_segments(chunks))
        if self._should_use_map_reduce(
            chunks,
            max_chunks=max_chunks,
            element_chunks_count=len(element_chunks),
            section_total=section_total,
        ):
            map_reduce_result = await self._section_map_reduce.build_summary_context(
                chunks,
                max_chunks=max_chunks,
            )
            if (
                map_reduce_result.strategy == "map_reduce"
                and map_reduce_result.context_items
            ):
                map_reduce_items = _map_reduce_context_to_retrieval_items(
                    map_reduce_result,
                    chunks,
                )
                if map_reduce_items:
                    return map_reduce_items

            chunk_by_id = {chunk.id: chunk for chunk in chunks}
            selected_map_reduce = [
                chunk_by_id[chunk_id]
                for chunk_id in map_reduce_result.selected_chunk_ids
                if chunk_id in chunk_by_id
            ]
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
