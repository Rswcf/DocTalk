from __future__ import annotations

import asyncio
import hashlib
import json
import logging
import math
import re
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
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
MAP_REDUCE_SUMMARY_CACHE_KEY = "map_reduce_summary_context"
MAP_REDUCE_PROMPT_VERSION = "summary_map_reduce_v2"
FRONT_MATTER_SECTION_TITLE = "Front matter"


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
    target_sections: tuple[str, ...] = ()
    model_covered_sections: tuple[str, ...] = ()
    fallback_sections: tuple[str, ...] = ()
    missing_sections: tuple[str, ...] = ()


@dataclass(frozen=True)
class MapReduceContextItem:
    group_index: int
    text: str
    anchor_chunk_id: uuid.UUID
    source_chunk_ids: tuple[uuid.UUID, ...]
    covered_sections: tuple[str, ...]
    target_sections: tuple[str, ...] = ()
    model_covered_sections: tuple[str, ...] = ()
    fallback_sections: tuple[str, ...] = ()
    missing_sections: tuple[str, ...] = ()


@dataclass(frozen=True)
class MapReduceSummaryResult:
    summary: str
    context_items: tuple[MapReduceContextItem, ...]
    selected_chunk_ids: tuple[uuid.UUID, ...]
    covered_sections: tuple[str, ...]
    target_sections: tuple[str, ...] = ()
    model_covered_sections: tuple[str, ...] = ()
    fallback_sections: tuple[str, ...] = ()
    missing_sections: tuple[str, ...] = ()
    strategy: str = "map_reduce"


@dataclass(frozen=True)
class MapReduceUsageEvent:
    model: str
    prompt_tokens: int
    completion_tokens: int
    phase: str


@dataclass
class MapReduceUsageCollector:
    events: list[MapReduceUsageEvent] = field(default_factory=list)

    def add(
        self,
        *,
        model: str,
        prompt_tokens: int,
        completion_tokens: int,
        phase: str,
    ) -> None:
        if prompt_tokens <= 0 and completion_tokens <= 0:
            return
        self.events.append(
            MapReduceUsageEvent(
                model=model,
                prompt_tokens=max(0, int(prompt_tokens or 0)),
                completion_tokens=max(0, int(completion_tokens or 0)),
                phase=str(phase or "unknown")[:32],
            )
        )

    def totals_by_model(self) -> dict[str, tuple[int, int]]:
        totals: dict[str, tuple[int, int]] = {}
        for event in self.events:
            prompt, completion = totals.get(event.model, (0, 0))
            totals[event.model] = (
                prompt + event.prompt_tokens,
                completion + event.completion_tokens,
            )
        return totals


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


_ROMAN_NUMERAL_TITLE_RE = re.compile(r"(?i)^[ivxlcdm]+[.)]?$")


def _is_noisy_section_title(title: str) -> bool:
    normalized = re.sub(r"\s+", " ", (title or "").strip())
    if not normalized:
        return False
    if len(normalized) <= 1:
        return True
    if len(normalized) <= 8 and _ROMAN_NUMERAL_TITLE_RE.fullmatch(normalized):
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


def _ordered_unique(values: Sequence[Any]) -> tuple[str, ...]:
    result: list[str] = []
    seen: set[str] = set()
    for value in values:
        section = str(value or "").strip()
        if not section or section in seen:
            continue
        seen.add(section)
        result.append(section)
    return tuple(result)


def _sections_not_in(target_sections: Sequence[str], covered_sections: Sequence[str]) -> tuple[str, ...]:
    covered = {section for section in covered_sections if section}
    return tuple(section for section in target_sections if section and section not in covered)


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
    leading_noisy: list[Any] = []

    for chunk in chunks:
        if _chunk_has_noisy_section_title(chunk):
            if current_title is not None:
                current_items.append(chunk)
            else:
                leading_noisy.append(chunk)
            continue
        title = _chunk_section_title(chunk)
        if current_title is None:
            if leading_noisy:
                segments.append((FRONT_MATTER_SECTION_TITLE, leading_noisy))
                leading_noisy = []
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
    elif leading_noisy:
        segments.append((FRONT_MATTER_SECTION_TITLE, leading_noisy))
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
        map_phase_timeout_seconds: float | None = None,
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
        default_map_phase_timeout = (math.ceil(self._max_groups / self._max_concurrency) * self._map_timeout_seconds) + 5.0
        self._map_phase_timeout_seconds = (
            max(0.01, float(map_phase_timeout_seconds))
            if map_phase_timeout_seconds is not None
            else default_map_phase_timeout
        )

    @property
    def map_model(self) -> str:
        return self._map_model

    @property
    def reduce_model(self) -> str:
        return self._reduce_model

    @property
    def prompt_version(self) -> str:
        return MAP_REDUCE_PROMPT_VERSION

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
            target_sections=group.section_titles,
            model_covered_sections=(),
            fallback_sections=tuple(covered_sections),
            missing_sections=_sections_not_in(group.section_titles, covered_sections),
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
        usage_collector: MapReduceUsageCollector | None = None,
        phase: str = "unknown",
    ) -> dict[str, Any]:
        from app.services.chat_service import _apply_provider_options, _get_llm_client

        client = _get_llm_client(model)
        last_error: Exception | None = None
        for attempt in range(2):
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
            usage = getattr(response, "usage", None)
            if usage_collector is not None and usage is not None:
                usage_collector.add(
                    model=model,
                    prompt_tokens=int(getattr(usage, "prompt_tokens", 0) or 0),
                    completion_tokens=int(getattr(usage, "completion_tokens", 0) or 0),
                    phase=phase,
                )
            content = ""
            if getattr(response, "choices", None):
                message = getattr(response.choices[0], "message", None)
                content = str(getattr(message, "content", "") or "")
            try:
                return _json_from_text(content)
            except (json.JSONDecodeError, ValueError) as exc:
                last_error = exc
                logger.warning(
                    "map_reduce_json_retry",
                    extra={
                        "phase": phase,
                        "model": model,
                        "attempt": attempt + 1,
                        "empty_content": not bool(content.strip()),
                    },
                )
                if attempt == 0:
                    continue
                raise
        if last_error is not None:
            raise last_error
        raise ValueError("Map-reduce JSON completion failed without a response")

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

    async def _llm_map_step(
        self,
        group: SectionMapGroup,
        *,
        usage_collector: MapReduceUsageCollector | None = None,
    ) -> MapStepResult:
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
            usage_collector=usage_collector,
            phase="map",
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
        model_covered_sections: list[str] = []
        fallback_sections: list[str] = []
        missing_sections: list[str] = []
        for title in group.section_titles:
            raw_item = raw_by_title.get(title.casefold(), {})
            section_summary = str(raw_item.get("summary") or "").strip()
            model_returned_summary = bool(section_summary)
            if not section_summary:
                section_chunk = self._first_chunk_for_section(group, title)
                section_summary = ((getattr(section_chunk, "text", "") or "").strip()[:500])
                if section_summary:
                    fallback_sections.append(title)
                else:
                    missing_sections.append(title)
                    continue
            else:
                model_covered_sections.append(title)
            source_ids = self._chunk_ids_from_source_refs(group, raw_item.get("source_refs"))
            if not source_ids:
                section_chunk = self._first_chunk_for_section(group, title)
                if section_chunk is not None:
                    source_ids = [section_chunk.id]
                    if model_returned_summary:
                        logger.warning(
                            "map_reduce_map_missing_source_refs",
                            extra={"group_index": group.group_index, "section_title": title},
                        )
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
            covered_sections=_ordered_unique((*model_covered_sections, *fallback_sections)),
            target_sections=group.section_titles,
            model_covered_sections=tuple(model_covered_sections),
            fallback_sections=tuple(fallback_sections),
            missing_sections=tuple(missing_sections),
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
            coverage_lines = [
                f"target sections: {', '.join(item.target_sections or item.covered_sections)}",
                f"model-covered sections: {', '.join(item.model_covered_sections) or '(none)'}",
            ]
            if item.fallback_sections:
                coverage_lines.append(
                    f"deterministic fallback sections: {', '.join(item.fallback_sections)}"
                )
            if item.missing_sections:
                coverage_lines.append(
                    f"missing sections: {', '.join(item.missing_sections)}"
                )
            text = (
                f"{prefix}Section group {item.group_index + 1} map summary "
                f"coverage:\n- " + "\n- ".join(coverage_lines) + f"\n{item.summary}"
            )
            items.append(
                MapReduceContextItem(
                    group_index=item.group_index,
                    text=text[:MAP_REDUCE_MAX_CONTEXT_ITEM_CHARS],
                    anchor_chunk_id=item.selected_chunk_ids[0],
                    source_chunk_ids=item.selected_chunk_ids,
                    covered_sections=item.covered_sections,
                    target_sections=item.target_sections,
                    model_covered_sections=item.model_covered_sections,
                    fallback_sections=item.fallback_sections,
                    missing_sections=item.missing_sections,
                )
            )
        return tuple(items)

    def _mapped_sections(self, mapped: list[MapStepResult], attr_name: str) -> tuple[str, ...]:
        covered: list[str] = []
        seen: set[str] = set()
        for item in sorted(mapped, key=lambda value: value.group_index):
            for section in getattr(item, attr_name):
                if section in seen:
                    continue
                seen.add(section)
                covered.append(section)
        return tuple(covered)

    def _mapped_covered_sections(self, mapped: list[MapStepResult]) -> tuple[str, ...]:
        return self._mapped_sections(mapped, "covered_sections")

    def _mapped_target_sections(self, mapped: list[MapStepResult]) -> tuple[str, ...]:
        target = self._mapped_sections(mapped, "target_sections")
        return target or self._mapped_covered_sections(mapped)

    def _mapped_model_covered_sections(self, mapped: list[MapStepResult]) -> tuple[str, ...]:
        return self._mapped_sections(mapped, "model_covered_sections")

    def _mapped_fallback_sections(self, mapped: list[MapStepResult]) -> tuple[str, ...]:
        return self._mapped_sections(mapped, "fallback_sections")

    def _mapped_missing_sections(self, mapped: list[MapStepResult]) -> tuple[str, ...]:
        return self._mapped_sections(mapped, "missing_sections")

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
        usage_collector: MapReduceUsageCollector | None = None,
    ) -> MapReduceSummaryResult:
        covered_sections = self._mapped_covered_sections(mapped)
        target_sections = self._mapped_target_sections(mapped)
        model_covered_sections = self._mapped_model_covered_sections(mapped)
        fallback_sections = self._mapped_fallback_sections(mapped)
        missing_sections = self._mapped_missing_sections(mapped)
        coverage_payload = {
            "target_sections": list(target_sections),
            "model_covered_sections": list(model_covered_sections),
            "fallback_sections": list(fallback_sections),
            "missing_sections": list(missing_sections),
        }
        mapped_payload = [
            {
                "group_index": item.group_index,
                "target_sections": list(item.target_sections),
                "covered_sections": list(item.covered_sections),
                "model_covered_sections": list(item.model_covered_sections),
                "fallback_sections": list(item.fallback_sections),
                "missing_sections": list(item.missing_sections),
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
            "- Preserve coverage of every target section listed below; do not drop tail sections.\n"
            "- Sections in fallback_sections were filled by deterministic source-text fallback; summarize them conservatively.\n"
            "- If missing_sections is non-empty, explicitly say those sections have limited or missing coverage.\n"
            "- Stay within a compact answer budget by grouping related details.\n"
            "- Use only the map summaries.\n\n"
            f"Coverage status:\n{json.dumps(coverage_payload, ensure_ascii=False)}\n\n"
            f"All target section titles:\n{json.dumps(list(target_sections), ensure_ascii=False)}\n\n"
            f"Map summaries:\n{json.dumps(mapped_payload, ensure_ascii=False)}"
        )
        data = await self._llm_json_completion(
            model=self._reduce_model,
            messages=[{"role": "user", "content": prompt}],
            max_tokens=2200,
            timeout_seconds=self._reduce_timeout_seconds,
            usage_collector=usage_collector,
            phase="reduce",
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
            target_sections=target_sections,
            model_covered_sections=model_covered_sections,
            fallback_sections=fallback_sections,
            missing_sections=missing_sections,
        )

    async def _run_map_step(
        self,
        group: SectionMapGroup,
        semaphore: asyncio.Semaphore,
        *,
        use_llm_default: bool,
        use_injected_step: bool,
        usage_collector: MapReduceUsageCollector | None = None,
    ) -> MapStepResult:
        async with semaphore:
            if use_injected_step and self._map_step is not None:
                step = self._map_step
            elif use_llm_default:
                return await self._llm_map_step(group, usage_collector=usage_collector)
            else:
                step = self._default_map_step
            return await step(group)

    def _normalize_map_step_result(
        self,
        result: MapStepResult,
        group: SectionMapGroup,
    ) -> MapStepResult:
        target_sections = result.target_sections or group.section_titles
        model_covered = result.model_covered_sections
        fallback = result.fallback_sections
        missing = result.missing_sections
        if not model_covered and not fallback and not missing:
            model_covered = result.covered_sections
            missing = _sections_not_in(target_sections, model_covered)
        selected_ids = list(result.selected_chunk_ids)
        if missing:
            supplemented_fallback = list(fallback)
            still_missing: list[str] = []
            summary_lines: list[str] = []
            seen_ids = set(selected_ids)
            for section in missing:
                chunk = self._first_chunk_for_section(group, section)
                text = (getattr(chunk, "text", "") or "").strip()[:500] if chunk is not None else ""
                if chunk is None or not text:
                    still_missing.append(section)
                    continue
                if chunk.id not in seen_ids:
                    seen_ids.add(chunk.id)
                    selected_ids.append(chunk.id)
                supplemented_fallback.append(section)
                summary_lines.append(f"- {section}: {text}")
            if summary_lines:
                result_summary = (
                    result.summary.rstrip()
                    + "\nDeterministic fallback for map-missing sections:\n"
                    + "\n".join(summary_lines)
                )
                result = MapStepResult(
                    group_index=result.group_index,
                    summary=result_summary[:MAP_REDUCE_MAX_CONTEXT_ITEM_CHARS],
                    selected_chunk_ids=tuple(selected_ids),
                    covered_sections=result.covered_sections,
                    target_sections=result.target_sections,
                    model_covered_sections=result.model_covered_sections,
                    fallback_sections=result.fallback_sections,
                    missing_sections=result.missing_sections,
                )
            fallback = tuple(supplemented_fallback)
            missing = tuple(still_missing)
        covered = _ordered_unique((*model_covered, *fallback))
        if not covered:
            covered = _ordered_unique(result.covered_sections)
        return MapStepResult(
            group_index=result.group_index,
            summary=result.summary,
            selected_chunk_ids=tuple(selected_ids),
            covered_sections=covered,
            target_sections=target_sections,
            model_covered_sections=model_covered,
            fallback_sections=fallback,
            missing_sections=missing,
        )

    def _fallback_map_step_result(
        self,
        group: SectionMapGroup,
        *,
        reason: str,
    ) -> MapStepResult:
        selected_ids: list[uuid.UUID] = []
        seen_ids: set[uuid.UUID] = set()
        lines: list[str] = []
        fallback_sections: list[str] = []
        missing_sections: list[str] = []
        for title in group.section_titles:
            chunk = self._first_chunk_for_section(group, title)
            if chunk is None:
                missing_sections.append(title)
                continue
            text = (getattr(chunk, "text", "") or "").strip()[:500]
            if not text:
                missing_sections.append(title)
                continue
            if chunk.id not in seen_ids:
                seen_ids.add(chunk.id)
                selected_ids.append(chunk.id)
            fallback_sections.append(title)
            lines.append(f"- {title}: {text}")
        summary = (
            f"Deterministic fallback map summary ({reason}).\n"
            + "\n".join(lines)
        ).strip()
        return MapStepResult(
            group_index=group.group_index,
            summary=summary[:MAP_REDUCE_MAX_CONTEXT_ITEM_CHARS],
            selected_chunk_ids=tuple(selected_ids),
            covered_sections=tuple(fallback_sections),
            target_sections=group.section_titles,
            model_covered_sections=(),
            fallback_sections=tuple(fallback_sections),
            missing_sections=tuple(missing_sections),
        )

    async def _run_map_tasks(
        self,
        groups: Sequence[SectionMapGroup],
        *,
        use_llm_default: bool,
        use_injected_steps: bool,
        usage_collector: MapReduceUsageCollector | None = None,
    ) -> list[MapStepResult]:
        semaphore = asyncio.Semaphore(self._max_concurrency)
        tasks = [
            asyncio.create_task(
                self._run_map_step(
                    group,
                    semaphore,
                    use_llm_default=use_llm_default,
                    use_injected_step=use_injected_steps,
                    usage_collector=usage_collector,
                )
            )
            for group in groups
        ]
        _done, pending = await asyncio.wait(
            tasks,
            timeout=self._map_phase_timeout_seconds,
            return_when=asyncio.ALL_COMPLETED,
        )
        timed_out_tasks = set(pending)
        if pending:
            for task in pending:
                task.cancel()
            await asyncio.gather(*pending, return_exceptions=True)

        raw_results = await asyncio.gather(*tasks, return_exceptions=True)
        for idx, task in enumerate(tasks):
            if task in timed_out_tasks:
                raw_results[idx] = asyncio.TimeoutError("map phase deadline exceeded")

        mapped: list[MapStepResult] = []
        for group, raw in zip(groups, raw_results):
            if isinstance(raw, MapStepResult):
                mapped.append(self._normalize_map_step_result(raw, group))
                continue
            logger.warning(
                "map_reduce_map_group_failed",
                extra={
                    "group_index": group.group_index,
                    "error_type": type(raw).__name__,
                    "target_sections": list(group.section_titles),
                },
            )
            mapped.append(
                self._fallback_map_step_result(
                    group,
                    reason=type(raw).__name__,
                )
            )
        return mapped

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
                target_sections=(_chunk_section_title(chunk),),
                model_covered_sections=(),
                fallback_sections=(_chunk_section_title(chunk),),
                missing_sections=(),
            )
            for idx, chunk in enumerate(selected)
        )
        covered_sections = tuple(_chunk_section_title(chunk) for chunk in selected)
        return MapReduceSummaryResult(
            summary="Fallback representative chunk selection.",
            context_items=context_items,
            selected_chunk_ids=tuple(chunk.id for chunk in selected),
            covered_sections=covered_sections,
            target_sections=covered_sections,
            model_covered_sections=(),
            fallback_sections=covered_sections,
            missing_sections=(),
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
        mapped_target = self._mapped_target_sections(mapped)
        mapped_model_covered = self._mapped_model_covered_sections(mapped)
        mapped_fallback = self._mapped_fallback_sections(mapped)
        mapped_missing = self._mapped_missing_sections(mapped)
        if isinstance(reduced, MapReduceSummaryResult):
            summary = reduced.summary
            raw_selected = list(reduced.selected_chunk_ids)
            raw_items = list(reduced.context_items)
            raw_model_covered = tuple(reduced.model_covered_sections) or mapped_model_covered
            raw_fallback = tuple(reduced.fallback_sections) or mapped_fallback
            raw_missing = tuple(reduced.missing_sections) or mapped_missing
            raw_target = tuple(reduced.target_sections) or mapped_target
            strategy = reduced.strategy or "map_reduce"
        else:
            summary = "\n".join(item.summary for item in sorted(mapped, key=lambda value: value.group_index))
            raw_selected = list(reduced)
            raw_items = list(self._context_items_from_mapped(mapped))
            raw_model_covered = mapped_model_covered
            raw_fallback = mapped_fallback
            raw_missing = mapped_missing
            raw_target = mapped_target
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
                    target_sections=item.target_sections,
                    model_covered_sections=item.model_covered_sections,
                    fallback_sections=item.fallback_sections,
                    missing_sections=item.missing_sections,
                )
            )

        if not context_items:
            context_items = list(self._context_items_from_mapped(mapped, overview=summary))

        covered = _ordered_unique((*raw_model_covered, *raw_fallback, *mapped_covered))
        target = _ordered_unique((*raw_target, *mapped_target))
        missing = _ordered_unique((*raw_missing, *_sections_not_in(target, covered)))

        return MapReduceSummaryResult(
            summary=summary[:6000],
            context_items=tuple(context_items[: self._max_groups]),
            selected_chunk_ids=tuple(selected[:max_total_chunks]),
            covered_sections=covered,
            target_sections=target,
            model_covered_sections=_ordered_unique((*raw_model_covered, *mapped_model_covered)),
            fallback_sections=_ordered_unique((*raw_fallback, *mapped_fallback)),
            missing_sections=missing,
            strategy=strategy,
        )

    async def build_summary_context(
        self,
        chunks: Sequence[Any],
        *,
        max_chunks: int,
        usage_collector: MapReduceUsageCollector | None = None,
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
                target_sections=(),
                model_covered_sections=(),
                fallback_sections=(),
                missing_sections=(),
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

        mapped = await self._run_map_tasks(
            prepared_groups,
            use_llm_default=True,
            use_injected_steps=True,
            usage_collector=usage_collector,
        )
        try:
            if self._reduce_step is not None:
                reduced = await self._reduce_step(mapped, max_total_chunks=max_total_chunks)
            elif self._map_step is not None:
                reduced = await self._default_reduce_step(
                    mapped,
                    max_total_chunks=max_total_chunks,
                )
            else:
                reduced = await self._llm_reduce_step(
                    mapped,
                    max_total_chunks=max_total_chunks,
                    usage_collector=usage_collector,
                )
        except Exception:
            logger.exception("Section map-reduce reduce step failed; using mapped fallback selection")
            reduced = await self._default_reduce_step(
                mapped,
                max_total_chunks=max_total_chunks,
            )

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


def _chunk_set_fingerprint(document_id: uuid.UUID, chunks: Sequence[Any]) -> str:
    hasher = hashlib.sha256()
    hasher.update(str(document_id).encode("utf-8"))
    ordered = sorted(chunks, key=lambda chunk: int(getattr(chunk, "chunk_index", 0) or 0))
    hasher.update(str(len(ordered)).encode("ascii"))
    for chunk in ordered:
        text = getattr(chunk, "text", "") or ""
        hasher.update(str(getattr(chunk, "id", "")).encode("utf-8"))
        hasher.update(str(getattr(chunk, "chunk_index", "")).encode("utf-8"))
        hasher.update(str(getattr(chunk, "page_start", "")).encode("utf-8"))
        hasher.update(str(getattr(chunk, "page_end", "")).encode("utf-8"))
        hasher.update(str(getattr(chunk, "token_count", "")).encode("utf-8"))
        hasher.update((_raw_chunk_section_title(chunk) or "").encode("utf-8"))
        hasher.update(hashlib.sha256(text.encode("utf-8")).hexdigest().encode("ascii"))
    return hasher.hexdigest()


def _map_reduce_context_item_to_cache(item: MapReduceContextItem) -> dict[str, Any]:
    return {
        "group_index": item.group_index,
        "text": item.text,
        "anchor_chunk_id": str(item.anchor_chunk_id),
        "source_chunk_ids": [str(chunk_id) for chunk_id in item.source_chunk_ids],
        "covered_sections": list(item.covered_sections),
        "target_sections": list(item.target_sections),
        "model_covered_sections": list(item.model_covered_sections),
        "fallback_sections": list(item.fallback_sections),
        "missing_sections": list(item.missing_sections),
    }


def _map_reduce_cache_entry(
    *,
    document_id: uuid.UUID,
    fingerprint: str,
    chunk_count: int,
    section_count: int,
    max_chunks: int,
    planner: SectionMapReducePlanner,
    result: MapReduceSummaryResult,
) -> dict[str, Any]:
    return {
        "cache_schema": 1,
        "document_id": str(document_id),
        "fingerprint": fingerprint,
        "chunk_count": int(chunk_count),
        "section_count": int(section_count),
        "max_chunks": int(max_chunks),
        "prompt_version": planner.prompt_version,
        "map_model": planner.map_model,
        "reduce_model": planner.reduce_model,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "result": {
            "summary": result.summary,
            "context_items": [
                _map_reduce_context_item_to_cache(item)
                for item in result.context_items
            ],
            "selected_chunk_ids": [str(chunk_id) for chunk_id in result.selected_chunk_ids],
            "covered_sections": list(result.covered_sections),
            "target_sections": list(result.target_sections),
            "model_covered_sections": list(result.model_covered_sections),
            "fallback_sections": list(result.fallback_sections),
            "missing_sections": list(result.missing_sections),
            "strategy": result.strategy,
        },
    }


def _uuid_tuple_from_cache(values: Any) -> tuple[uuid.UUID, ...]:
    if not isinstance(values, list):
        return ()
    parsed: list[uuid.UUID] = []
    for value in values:
        try:
            parsed.append(uuid.UUID(str(value)))
        except (TypeError, ValueError):
            continue
    return tuple(parsed)


def _str_tuple_from_cache(values: Any) -> tuple[str, ...]:
    return _ordered_unique(values if isinstance(values, list) else [])


def _map_reduce_result_from_cache(
    entry: Any,
    *,
    document_id: uuid.UUID,
    fingerprint: str,
    max_chunks: int,
    planner: SectionMapReducePlanner,
) -> MapReduceSummaryResult | None:
    if not isinstance(entry, dict):
        return None
    if entry.get("cache_schema") != 1:
        return None
    if entry.get("document_id") != str(document_id):
        return None
    if entry.get("fingerprint") != fingerprint:
        return None
    if int(entry.get("max_chunks") or 0) != int(max_chunks):
        return None
    if entry.get("prompt_version") != planner.prompt_version:
        return None
    if entry.get("map_model") != planner.map_model or entry.get("reduce_model") != planner.reduce_model:
        return None
    raw_result = entry.get("result")
    if not isinstance(raw_result, dict):
        return None
    raw_items = raw_result.get("context_items")
    if not isinstance(raw_items, list):
        return None
    context_items: list[MapReduceContextItem] = []
    for raw_item in raw_items:
        if not isinstance(raw_item, dict):
            continue
        source_chunk_ids = _uuid_tuple_from_cache(raw_item.get("source_chunk_ids"))
        try:
            anchor_chunk_id = uuid.UUID(str(raw_item.get("anchor_chunk_id")))
        except (TypeError, ValueError):
            anchor_chunk_id = source_chunk_ids[0] if source_chunk_ids else None
        if anchor_chunk_id is None:
            continue
        text = str(raw_item.get("text") or "").strip()
        if not text:
            continue
        context_items.append(
            MapReduceContextItem(
                group_index=int(raw_item.get("group_index") or 0),
                text=text[:MAP_REDUCE_MAX_CONTEXT_ITEM_CHARS],
                anchor_chunk_id=anchor_chunk_id,
                source_chunk_ids=source_chunk_ids or (anchor_chunk_id,),
                covered_sections=_str_tuple_from_cache(raw_item.get("covered_sections")),
                target_sections=_str_tuple_from_cache(raw_item.get("target_sections")),
                model_covered_sections=_str_tuple_from_cache(raw_item.get("model_covered_sections")),
                fallback_sections=_str_tuple_from_cache(raw_item.get("fallback_sections")),
                missing_sections=_str_tuple_from_cache(raw_item.get("missing_sections")),
            )
        )
    if not context_items:
        return None
    return MapReduceSummaryResult(
        summary=str(raw_result.get("summary") or "")[:6000],
        context_items=tuple(context_items),
        selected_chunk_ids=_uuid_tuple_from_cache(raw_result.get("selected_chunk_ids")),
        covered_sections=_str_tuple_from_cache(raw_result.get("covered_sections")),
        target_sections=_str_tuple_from_cache(raw_result.get("target_sections")),
        model_covered_sections=_str_tuple_from_cache(raw_result.get("model_covered_sections")),
        fallback_sections=_str_tuple_from_cache(raw_result.get("fallback_sections")),
        missing_sections=_str_tuple_from_cache(raw_result.get("missing_sections")),
        strategy=str(raw_result.get("strategy") or "map_reduce"),
    )


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
        source_chunks = [
            chunk_by_id[chunk_id]
            for chunk_id in context_item.source_chunk_ids
            if chunk_id in chunk_by_id
        ] or [anchor]
        page_start = min(int(getattr(chunk, "page_start", 1) or 1) for chunk in source_chunks)
        page_end = max(int(getattr(chunk, "page_end", page_start) or page_start) for chunk in source_chunks)
        retrieval_item = {
            "chunk_id": anchor.id,
            "text": context_item.text,
            "page": page_start,
            "page_end": page_end,
            "bboxes": [],
            "score": 1.0 - (idx / (total + 1)) * 0.2,
            "section_title": "Map-reduce section summary",
            "document_id": anchor.document_id,
            "retrieval_modality": "summary",
            "map_reduce_strategy": result.strategy,
            "map_reduce_source_chunk_ids": [
                str(chunk_id) for chunk_id in context_item.source_chunk_ids
            ],
            "map_reduce_covered_sections": list(context_item.covered_sections),
            "map_reduce_target_sections": list(context_item.target_sections),
            "map_reduce_model_covered_sections": list(context_item.model_covered_sections),
            "map_reduce_fallback_sections": list(context_item.fallback_sections),
            "map_reduce_missing_sections": list(context_item.missing_sections),
        }
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
        allow_map_reduce: bool = True,
        usage_collector: MapReduceUsageCollector | None = None,
    ) -> list[dict[str, Any]]:
        coverage = await self._get_document_brief_coverage(db, document_id)
        persisted = await self._get_persisted_summary_context(
            db,
            document_id,
            max_chunks=max_chunks,
            coverage=coverage,
        )
        if persisted and (not allow_map_reduce or max_chunks < DEFAULT_MAX_SUMMARY_CHUNKS):
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
        if allow_map_reduce and self._should_use_map_reduce(
            chunks,
            max_chunks=max_chunks,
            element_chunks_count=len(element_chunks),
            section_total=section_total,
        ):
            fingerprint = _chunk_set_fingerprint(document_id, chunks)
            cached_result = _map_reduce_result_from_cache(
                coverage.get(MAP_REDUCE_SUMMARY_CACHE_KEY),
                document_id=document_id,
                fingerprint=fingerprint,
                max_chunks=max_chunks,
                planner=self._section_map_reduce,
            )
            if cached_result is not None:
                cached_items = _map_reduce_context_to_retrieval_items(
                    cached_result,
                    chunks,
                )
                if cached_items:
                    return cached_items

            map_reduce_result = await self._section_map_reduce.build_summary_context(
                chunks,
                max_chunks=max_chunks,
                usage_collector=usage_collector,
            )
            if (
                map_reduce_result.strategy == "map_reduce"
                and map_reduce_result.context_items
            ):
                await self._persist_map_reduce_cache(
                    db,
                    document_id,
                    coverage=coverage,
                    entry=_map_reduce_cache_entry(
                        document_id=document_id,
                        fingerprint=fingerprint,
                        chunk_count=len(chunks),
                        section_count=section_total,
                        max_chunks=max_chunks,
                        planner=self._section_map_reduce,
                        result=map_reduce_result,
                    ),
                )
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

    async def _get_document_brief_coverage(
        self,
        db: AsyncSession,
        document_id: uuid.UUID,
    ) -> dict[str, Any]:
        brief_row = await db.execute(
            select(DocumentBrief.coverage).where(DocumentBrief.document_id == document_id)
        )
        if not hasattr(brief_row, "scalar_one_or_none"):
            return {}
        coverage = brief_row.scalar_one_or_none()
        return dict(coverage) if isinstance(coverage, dict) else {}

    async def _get_persisted_summary_context(
        self,
        db: AsyncSession,
        document_id: uuid.UUID,
        *,
        max_chunks: int,
        coverage: dict[str, Any] | None = None,
    ) -> list[dict[str, Any]]:
        if coverage is None:
            coverage = await self._get_document_brief_coverage(db, document_id)
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

    async def _persist_map_reduce_cache(
        self,
        db: AsyncSession,
        document_id: uuid.UUID,
        *,
        coverage: dict[str, Any],
        entry: dict[str, Any],
    ) -> None:
        if not all(hasattr(db, attr) for attr in ("add", "commit")):
            return
        next_coverage = dict(coverage or {})
        next_coverage[MAP_REDUCE_SUMMARY_CACHE_KEY] = entry
        try:
            row = await db.execute(
                select(DocumentBrief).where(DocumentBrief.document_id == document_id)
            )
            brief = row.scalar_one_or_none()
            if brief is None:
                brief = DocumentBrief(
                    document_id=document_id,
                    outline=[],
                    key_points=[],
                    facts=[],
                    questions=[],
                    coverage=next_coverage,
                )
            else:
                brief.coverage = next_coverage
            db.add(brief)
            await db.commit()
            coverage.clear()
            coverage.update(next_coverage)
        except Exception:
            if hasattr(db, "rollback"):
                await db.rollback()
            logger.warning(
                "Failed to persist map-reduce summary context cache for document %s",
                document_id,
                exc_info=True,
            )

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
                    allow_map_reduce=False,
                )
            )
            if len(contexts) >= max_chunks:
                break
        return contexts[:max_chunks]

    async def get_document_label(self, db: AsyncSession, document_id: uuid.UUID) -> str:
        doc = await db.get(Document, document_id)
        return doc.filename if doc else "document"


document_brief_service = DocumentBriefService()
