warning: `--full-auto` is deprecated; use `--sandbox workspace-write` instead.
Reading prompt from stdin...
2026-05-24T09:22:32.001352Z ERROR codex_core::session::session: failed to load skill /Users/mayijie/Projects/Code/010_DocTalk/.agents/skills/deploy/SKILL.md: missing YAML frontmatter delimited by ---
2026-05-24T09:22:32.001383Z ERROR codex_core::session::session: failed to load skill /Users/mayijie/Projects/Code/010_DocTalk/.agents/skills/codex-implement/SKILL.md: missing YAML frontmatter delimited by ---
OpenAI Codex v0.133.0
--------
workdir: /Users/mayijie/Projects/Code/010_DocTalk
model: gpt-5.5
provider: openai
approval: never
sandbox: workspace-write [workdir, /tmp, $TMPDIR]
reasoning effort: xhigh
reasoning summaries: none
session id: 019e594b-0f71-7730-8de5-b7602c074bfe
--------
user
# 角色:对抗式代码审查 — DocTalk Phase 2b 真 map-reduce(全文覆盖)
我(Claude)在 `fix/phase2b-true-mapreduce` 实现了真 LLM map-reduce 整篇覆盖(eval 证明 section 覆盖 12%→100%)。全量非集成 405 passed/0 failed,ruff 干净。请**对抗式复审**,不要盖章。你不能 git。
## surface
- diff:`.collab/reviews/2026-05-24-phase2b-diff.patch`
- 现网:`backend/app/services/document_brief_service.py`(build_summary_context/map/reduce/denoise/fallback)、`chat_service.py`(DOCUMENT_SUMMARY 接入 + prompt)
- 测试:`backend/tests/test_document_brief_service.py`、`test_chat_summary_routing.py`
## 重点(逐项,file:line)
1. **成本/延迟**:大文档 summary 现发 ≤18 个 Flash map + 1 reduce。并发上限、超时、组数上限是否真的封顶?free 用户滥用(反复 summary 大文档)的成本风险?有无缓存(同文档 summary 复用 brief)?
2. **引用质量**:summary context item 的 [n] 锚是单个 anchor chunk,但 text 是整组摘要 → 引用页码是否会误导(摘要覆盖多节,却只指向一个 chunk 的页)?bbox 高亮是否仍有意义?
3. **鲁棒性**:map/reduce 的 LLM JSON 解析(response_format json_object 的 provider 兼容)、map 部分失败(部分组成功部分失败)、超时回退路径是否完整且不丢覆盖。
4. **回归**:小文档/collection/persisted/element-aware 路径未受影响?map-reduce 只在大单文档 summary 触发?
5. **质量真伪**:覆盖 100% 是"结构性"(所有节进了某组)。若某组 map 摘要质量差/漏内容,covered_sections 仍标记已覆盖 → 是否存在"假覆盖"?如何降低?
6. 跑 `SKIP_INTEGRATION=1 python3 -m pytest -q`(应 405/0 failed)。
## 输出:Must-fix/Should-fix/Nit(file:line+可证伪+建议),最后给「可否合并 main」。

codex
我会按代码审查姿态先读补丁和相关实现，再跑指定的非集成测试；全程不使用 `git`。重点会放在可证伪的行为和 file:line 上。
exec
/bin/zsh -lc 'wc -l .collab/reviews/2026-05-24-phase2b-diff.patch backend/app/services/document_brief_service.py backend/app/services/chat_service.py backend/tests/test_document_brief_service.py backend/tests/test_chat_summary_routing.py' in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
     875 .collab/reviews/2026-05-24-phase2b-diff.patch
    1212 backend/app/services/document_brief_service.py
    2275 backend/app/services/chat_service.py
     554 backend/tests/test_document_brief_service.py
     285 backend/tests/test_chat_summary_routing.py
    5201 total

exec
/bin/zsh -lc "sed -n '1,260p' backend/app/services/document_brief_service.py" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
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

exec
/bin/zsh -lc "sed -n '260,620p' backend/app/services/document_brief_service.py" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
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


exec
/bin/zsh -lc 'rg -n "build_summary_context|map|reduce|denoise|fallback|DOCUMENT_SUMMARY|summary|covered_sections|response_format|timeout|asyncio|semaphore|gather|cache|brief" backend/app/services/document_brief_service.py backend/app/services/chat_service.py backend/tests/test_document_brief_service.py backend/tests/test_chat_summary_routing.py' in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
backend/tests/test_chat_summary_routing.py:125:@pytest.mark.asyncio
backend/tests/test_chat_summary_routing.py:126:async def test_whole_document_summary_uses_brief_context_not_semantic_retrieval(
backend/tests/test_chat_summary_routing.py:142:    summary_context = AsyncMock(
backend/tests/test_chat_summary_routing.py:174:        chat_service_module.document_brief_service,
backend/tests/test_chat_summary_routing.py:175:        "get_summary_context",
backend/tests/test_chat_summary_routing.py:176:        summary_context,
backend/tests/test_chat_summary_routing.py:196:    summary_context.assert_awaited_once_with(db, document_id, max_chunks=18)
backend/tests/test_chat_summary_routing.py:206:@pytest.mark.asyncio
backend/tests/test_chat_summary_routing.py:207:async def test_collection_summary_uses_collection_brief_context_not_search_multi(
backend/tests/test_chat_summary_routing.py:223:    collection_summary_context = AsyncMock(
backend/tests/test_chat_summary_routing.py:255:        chat_service_module.document_brief_service,
backend/tests/test_chat_summary_routing.py:256:        "get_collection_summary_context",
backend/tests/test_chat_summary_routing.py:257:        collection_summary_context,
backend/tests/test_chat_summary_routing.py:277:    collection_summary_context.assert_awaited_once_with(
backend/tests/test_document_brief_service.py:9:from app.services.document_brief_service import (
backend/tests/test_document_brief_service.py:98:@pytest.mark.asyncio
backend/tests/test_document_brief_service.py:99:async def test_collection_summary_context_caps_docs_and_chunks(
backend/tests/test_document_brief_service.py:113:    monkeypatch.setattr(service, "get_summary_context", AsyncMock(side_effect=fake_context))
backend/tests/test_document_brief_service.py:115:    contexts = await service.get_collection_summary_context(
backend/tests/test_document_brief_service.py:127:@pytest.mark.asyncio
backend/tests/test_document_brief_service.py:128:async def test_summary_context_prefers_persisted_coverage_order() -> None:
backend/tests/test_document_brief_service.py:145:    contexts = await DocumentBriefService().get_summary_context(db, document_id, max_chunks=8)
backend/tests/test_document_brief_service.py:150:@pytest.mark.asyncio
backend/tests/test_document_brief_service.py:151:async def test_summary_context_falls_back_when_persisted_coverage_is_stale() -> None:
backend/tests/test_document_brief_service.py:167:    contexts = await DocumentBriefService().get_summary_context(db, document_id, max_chunks=8)
backend/tests/test_document_brief_service.py:172:@pytest.mark.asyncio
backend/tests/test_document_brief_service.py:173:async def test_summary_context_uses_document_elements_before_chunk_fallback() -> None:
backend/tests/test_document_brief_service.py:198:    contexts = await DocumentBriefService().get_summary_context(db, document_id, max_chunks=4)
backend/tests/test_document_brief_service.py:203:@pytest.mark.asyncio
backend/tests/test_document_brief_service.py:204:async def test_section_map_reduce_covers_all_sections_with_stubbed_llm() -> None:
backend/tests/test_document_brief_service.py:216:    async def fake_map(group: SectionMapGroup) -> MapStepResult:
backend/tests/test_document_brief_service.py:218:        covered_sections: list[str] = []
backend/tests/test_document_brief_service.py:225:            covered_sections.append(section)
backend/tests/test_document_brief_service.py:229:            summary=f"covers {len(covered_sections)} sections",
backend/tests/test_document_brief_service.py:231:            covered_sections=tuple(covered_sections),
backend/tests/test_document_brief_service.py:234:    async def fake_reduce(
backend/tests/test_document_brief_service.py:235:        mapped: list[MapStepResult],
backend/tests/test_document_brief_service.py:241:        for item in mapped:
backend/tests/test_document_brief_service.py:250:        map_step=fake_map,
backend/tests/test_document_brief_service.py:251:        reduce_step=fake_reduce,
backend/tests/test_document_brief_service.py:256:    selected = await planner.select_chunks_for_summary(chunks, max_chunks=18)
backend/tests/test_document_brief_service.py:262:@pytest.mark.asyncio
backend/tests/test_document_brief_service.py:263:async def test_map_reduce_summary_context_covers_113_sections_under_fixed_context_budget() -> None:
backend/tests/test_document_brief_service.py:271:    async def fake_map(group: SectionMapGroup) -> MapStepResult:
backend/tests/test_document_brief_service.py:274:            summary="\n".join(f"- {title}: mapped summary" for title in group.section_titles),
backend/tests/test_document_brief_service.py:276:            covered_sections=group.section_titles,
backend/tests/test_document_brief_service.py:279:    async def fake_reduce(
backend/tests/test_document_brief_service.py:280:        mapped: list[MapStepResult],
backend/tests/test_document_brief_service.py:286:        covered_sections: list[str] = []
backend/tests/test_document_brief_service.py:287:        for item in sorted(mapped, key=lambda value: value.group_index):
backend/tests/test_document_brief_service.py:289:            covered_sections.extend(item.covered_sections)
backend/tests/test_document_brief_service.py:293:                    text=item.summary,
backend/tests/test_document_brief_service.py:296:                    covered_sections=item.covered_sections,
backend/tests/test_document_brief_service.py:300:            summary="full reduce summary",
backend/tests/test_document_brief_service.py:303:            covered_sections=tuple(covered_sections),
backend/tests/test_document_brief_service.py:307:        map_step=fake_map,
backend/tests/test_document_brief_service.py:308:        reduce_step=fake_reduce,
backend/tests/test_document_brief_service.py:314:    result = await planner.build_summary_context(chunks, max_chunks=18)
backend/tests/test_document_brief_service.py:316:    assert result.strategy == "map_reduce"
backend/tests/test_document_brief_service.py:317:    assert result.covered_sections == expected_sections
backend/tests/test_document_brief_service.py:320:    assert len(result.covered_sections) > len(result.selected_chunk_ids)
backend/tests/test_document_brief_service.py:324:@pytest.mark.asyncio
backend/tests/test_document_brief_service.py:325:async def test_map_reduce_summary_context_items_keep_clickable_source_refs() -> None:
backend/tests/test_document_brief_service.py:331:    async def fake_map(group: SectionMapGroup) -> MapStepResult:
backend/tests/test_document_brief_service.py:334:            summary="\n".join(f"{title}: summary" for title in group.section_titles),
backend/tests/test_document_brief_service.py:336:            covered_sections=group.section_titles,
backend/tests/test_document_brief_service.py:339:    planner = SectionMapReducePlanner(map_step=fake_map, max_groups=4, max_group_chunks=4)
backend/tests/test_document_brief_service.py:341:    result = await planner.build_summary_context(chunks, max_chunks=18)
backend/tests/test_document_brief_service.py:349:        assert item.covered_sections
backend/tests/test_document_brief_service.py:368:@pytest.mark.asyncio
backend/tests/test_document_brief_service.py:369:async def test_map_reduce_summary_context_falls_back_to_chunk_selection_when_map_fails() -> None:
backend/tests/test_document_brief_service.py:375:    async def failing_map(_group: SectionMapGroup) -> MapStepResult:
backend/tests/test_document_brief_service.py:376:        raise TimeoutError("map timeout")
backend/tests/test_document_brief_service.py:378:    planner = SectionMapReducePlanner(map_step=failing_map, max_total_chunks_cap=64)
backend/tests/test_document_brief_service.py:380:    result = await planner.build_summary_context(chunks, max_chunks=18)
backend/tests/test_document_brief_service.py:382:    assert result.strategy == "chunk_selection_fallback"
backend/tests/test_document_brief_service.py:398:@pytest.mark.asyncio
backend/tests/test_document_brief_service.py:399:async def test_large_document_summary_context_uses_section_map_reduce() -> None:
backend/tests/test_document_brief_service.py:405:    map_reduce_selected = chunks[:30]
backend/tests/test_document_brief_service.py:406:    map_reduce_result = MapReduceSummaryResult(
backend/tests/test_document_brief_service.py:407:        summary="full document summary",
backend/tests/test_document_brief_service.py:411:                text="\n".join(f"{chunk.section_title}: summary" for chunk in map_reduce_selected),
backend/tests/test_document_brief_service.py:412:                anchor_chunk_id=map_reduce_selected[0].id,
backend/tests/test_document_brief_service.py:413:                source_chunk_ids=tuple(chunk.id for chunk in map_reduce_selected),
backend/tests/test_document_brief_service.py:414:                covered_sections=tuple(chunk.section_title for chunk in map_reduce_selected),
backend/tests/test_document_brief_service.py:417:        selected_chunk_ids=tuple(chunk.id for chunk in map_reduce_selected),
backend/tests/test_document_brief_service.py:418:        covered_sections=tuple(chunk.section_title for chunk in map_reduce_selected),
backend/tests/test_document_brief_service.py:421:    planner.build_summary_context = AsyncMock(return_value=map_reduce_result)
backend/tests/test_document_brief_service.py:423:        section_map_reduce=planner,
backend/tests/test_document_brief_service.py:424:        map_reduce_min_chunks=36,
backend/tests/test_document_brief_service.py:436:    contexts = await service.get_summary_context(db, document_id, max_chunks=18)
backend/tests/test_document_brief_service.py:438:    planner.build_summary_context.assert_awaited_once_with(chunks, max_chunks=18)
backend/tests/test_document_brief_service.py:440:    assert contexts[0]["retrieval_modality"] == "summary"
backend/tests/test_document_brief_service.py:441:    assert len(contexts[0]["map_reduce_source_chunk_ids"]) == 30
backend/tests/test_document_brief_service.py:444:@pytest.mark.asyncio
backend/tests/test_document_brief_service.py:445:async def test_large_document_bypasses_persisted_coverage_when_map_reduce_needed(
backend/tests/test_document_brief_service.py:467:    map_reduce_selected = chunks[:30]
backend/tests/test_document_brief_service.py:468:    map_reduce_result = MapReduceSummaryResult(
backend/tests/test_document_brief_service.py:469:        summary="full document summary",
backend/tests/test_document_brief_service.py:473:                text="\n".join(f"{chunk.section_title}: summary" for chunk in map_reduce_selected),
backend/tests/test_document_brief_service.py:474:                anchor_chunk_id=map_reduce_selected[0].id,
backend/tests/test_document_brief_service.py:475:                source_chunk_ids=tuple(chunk.id for chunk in map_reduce_selected),
backend/tests/test_document_brief_service.py:476:                covered_sections=tuple(chunk.section_title for chunk in map_reduce_selected),
backend/tests/test_document_brief_service.py:479:        selected_chunk_ids=tuple(chunk.id for chunk in map_reduce_selected),
backend/tests/test_document_brief_service.py:480:        covered_sections=tuple(chunk.section_title for chunk in map_reduce_selected),
backend/tests/test_document_brief_service.py:483:    planner.build_summary_context = AsyncMock(return_value=map_reduce_result)
backend/tests/test_document_brief_service.py:485:        section_map_reduce=planner,
backend/tests/test_document_brief_service.py:486:        map_reduce_min_chunks=36,
backend/tests/test_document_brief_service.py:490:        "_get_persisted_summary_context",
backend/tests/test_document_brief_service.py:495:        "_should_use_map_reduce",
backend/tests/test_document_brief_service.py:499:        "app.services.document_brief_service.get_element_aware_chunks_async",
backend/tests/test_document_brief_service.py:504:    contexts = await service.get_summary_context(db, document_id, max_chunks=18)
backend/tests/test_document_brief_service.py:506:    planner.build_summary_context.assert_awaited_once_with(chunks, max_chunks=18)
backend/tests/test_document_brief_service.py:508:    assert len(contexts[0]["map_reduce_covered_sections"]) > 18
backend/tests/test_document_brief_service.py:526:@pytest.mark.asyncio
backend/tests/test_document_brief_service.py:527:async def test_small_per_doc_budget_skips_map_reduce_for_collection_path() -> None:
backend/tests/test_document_brief_service.py:534:    planner.build_summary_context = AsyncMock()
backend/tests/test_document_brief_service.py:535:    planner.select_chunks_for_summary = AsyncMock(return_value=chunks[:20])
backend/tests/test_document_brief_service.py:537:        section_map_reduce=planner,
backend/tests/test_document_brief_service.py:538:        map_reduce_min_chunks=36,
backend/tests/test_document_brief_service.py:550:    contexts = await service.get_summary_context(db, document_id, max_chunks=3)
backend/tests/test_document_brief_service.py:552:    planner.build_summary_context.assert_not_awaited()
backend/tests/test_document_brief_service.py:553:    planner.select_chunks_for_summary.assert_not_awaited()
backend/app/services/document_brief_service.py:3:import asyncio
backend/app/services/document_brief_service.py:13:from sqlalchemy.ext.asyncio import AsyncSession
backend/app/services/document_brief_service.py:43:    summary: str
backend/app/services/document_brief_service.py:45:    covered_sections: tuple[str, ...]
backend/app/services/document_brief_service.py:54:    covered_sections: tuple[str, ...]
backend/app/services/document_brief_service.py:59:    summary: str
backend/app/services/document_brief_service.py:62:    covered_sections: tuple[str, ...]
backend/app/services/document_brief_service.py:63:    strategy: str = "map_reduce"
backend/app/services/document_brief_service.py:73:        mapped: list[MapStepResult],
backend/app/services/document_brief_service.py:116:        raise ValueError("Map-reduce response must be a JSON object")
backend/app/services/document_brief_service.py:144:def _dynamic_summary_chunk_budget(
backend/app/services/document_brief_service.py:224:        map_step: MapStep | None = None,
backend/app/services/document_brief_service.py:225:        reduce_step: ReduceStep | None = None,
backend/app/services/document_brief_service.py:231:        map_model: str | None = None,
backend/app/services/document_brief_service.py:232:        reduce_model: str | None = None,
backend/app/services/document_brief_service.py:233:        map_timeout_seconds: float = 20.0,
backend/app/services/document_brief_service.py:234:        reduce_timeout_seconds: float = 30.0,
backend/app/services/document_brief_service.py:236:        self._map_step = map_step
backend/app/services/document_brief_service.py:237:        self._reduce_step = reduce_step
backend/app/services/document_brief_service.py:243:        self._map_model = map_model or settings.MODE_MODELS.get("quick", settings.LLM_MODEL)
backend/app/services/document_brief_service.py:244:        self._reduce_model = reduce_model or settings.MODE_MODELS.get("quick", settings.LLM_MODEL)
backend/app/services/document_brief_service.py:245:        self._map_timeout_seconds = max(1.0, float(map_timeout_seconds))
backend/app/services/document_brief_service.py:246:        self._reduce_timeout_seconds = max(1.0, float(reduce_timeout_seconds))
backend/app/services/document_brief_service.py:254:        """Cap per-group map context while preserving at least one chunk/section."""
backend/app/services/document_brief_service.py:291:        # Keep map payload ordered by chunk index.
backend/app/services/document_brief_service.py:308:    async def _default_map_step(self, group: SectionMapGroup) -> MapStepResult:
backend/app/services/document_brief_service.py:310:        covered_sections: list[str] = []
backend/app/services/document_brief_service.py:320:            covered_sections.append(section)
backend/app/services/document_brief_service.py:325:            covered_sections.append(_chunk_section_title(group.chunks[0]))
backend/app/services/document_brief_service.py:327:        summary = f"Group {group.group_index} covers {len(covered_sections)} sections."
backend/app/services/document_brief_service.py:330:            summary=summary,
backend/app/services/document_brief_service.py:332:            covered_sections=tuple(covered_sections),
backend/app/services/document_brief_service.py:335:    def _build_map_chunks_text(self, group: SectionMapGroup) -> str:
backend/app/services/document_brief_service.py:352:        timeout_seconds: float,
backend/app/services/document_brief_service.py:363:            "response_format": {"type": "json_object"},
backend/app/services/document_brief_service.py:366:        response = await asyncio.wait_for(
backend/app/services/document_brief_service.py:368:            timeout=timeout_seconds,
backend/app/services/document_brief_service.py:410:    async def _llm_map_step(self, group: SectionMapGroup) -> MapStepResult:
backend/app/services/document_brief_service.py:412:            "You are the map step in a document map-reduce summary pipeline.\n"
backend/app/services/document_brief_service.py:415:            '{"group_summary": string, "sections": ['
backend/app/services/document_brief_service.py:416:            '{"title": string, "summary": string, "source_refs": [number]}'
backend/app/services/document_brief_service.py:421:            "- Keep each section summary concise and factual.\n\n"
backend/app/services/document_brief_service.py:423:            f"Excerpts:\n{self._build_map_chunks_text(group)}"
backend/app/services/document_brief_service.py:426:            model=self._map_model,
backend/app/services/document_brief_service.py:429:            timeout_seconds=self._map_timeout_seconds,
backend/app/services/document_brief_service.py:446:            section_summary = str(raw_item.get("summary") or "").strip()
backend/app/services/document_brief_service.py:447:            if not section_summary:
backend/app/services/document_brief_service.py:449:                section_summary = ((getattr(section_chunk, "text", "") or "").strip()[:500])
backend/app/services/document_brief_service.py:460:            lines.append(f"- {title}: {section_summary}")
backend/app/services/document_brief_service.py:462:        group_summary = str(data.get("group_summary") or "").strip()
backend/app/services/document_brief_service.py:463:        summary = "\n".join(
backend/app/services/document_brief_service.py:464:            part for part in (f"Group summary: {group_summary}" if group_summary else "", *lines) if part
backend/app/services/document_brief_service.py:468:            summary=summary[:MAP_REDUCE_MAX_CONTEXT_ITEM_CHARS],
backend/app/services/document_brief_service.py:470:            covered_sections=group.section_titles,
backend/app/services/document_brief_service.py:473:    async def _default_reduce_step(
backend/app/services/document_brief_service.py:475:        mapped: list[MapStepResult],
backend/app/services/document_brief_service.py:481:        for item in sorted(mapped, key=lambda value: value.group_index):
backend/app/services/document_brief_service.py:491:    def _context_items_from_mapped(
backend/app/services/document_brief_service.py:493:        mapped: list[MapStepResult],
backend/app/services/document_brief_service.py:498:        for position, item in enumerate(sorted(mapped, key=lambda value: value.group_index)):
backend/app/services/document_brief_service.py:503:                prefix = f"Full-document reduce summary:\n{overview.strip()}\n\n"
backend/app/services/document_brief_service.py:505:                f"{prefix}Section group {item.group_index + 1} map summary "
backend/app/services/document_brief_service.py:506:                f"covering: {', '.join(item.covered_sections)}\n{item.summary}"
backend/app/services/document_brief_service.py:514:                    covered_sections=item.covered_sections,
backend/app/services/document_brief_service.py:519:    def _mapped_covered_sections(self, mapped: list[MapStepResult]) -> tuple[str, ...]:
backend/app/services/document_brief_service.py:522:        for item in sorted(mapped, key=lambda value: value.group_index):
backend/app/services/document_brief_service.py:523:            for section in item.covered_sections:
backend/app/services/document_brief_service.py:530:    def _mapped_selected_chunk_ids(
backend/app/services/document_brief_service.py:532:        mapped: list[MapStepResult],
backend/app/services/document_brief_service.py:538:        for item in sorted(mapped, key=lambda value: value.group_index):
backend/app/services/document_brief_service.py:548:    async def _llm_reduce_step(
backend/app/services/document_brief_service.py:550:        mapped: list[MapStepResult],
backend/app/services/document_brief_service.py:554:        covered_sections = self._mapped_covered_sections(mapped)
backend/app/services/document_brief_service.py:555:        mapped_payload = [
backend/app/services/document_brief_service.py:558:                "covered_sections": list(item.covered_sections),
backend/app/services/document_brief_service.py:559:                "summary": item.summary,
backend/app/services/document_brief_service.py:561:            for item in sorted(mapped, key=lambda value: value.group_index)
backend/app/services/document_brief_service.py:564:            "You are the reduce step in a document map-reduce summary pipeline.\n"
backend/app/services/document_brief_service.py:565:            "Merge the map summaries into a compact, structured full-document brief.\n"
backend/app/services/document_brief_service.py:567:            '{"summary": string, "covered_sections": [string]}\n\n'
backend/app/services/document_brief_service.py:571:            "- Use only the map summaries.\n\n"
backend/app/services/document_brief_service.py:572:            f"All section titles:\n{json.dumps(list(covered_sections), ensure_ascii=False)}\n\n"
backend/app/services/document_brief_service.py:573:            f"Map summaries:\n{json.dumps(mapped_payload, ensure_ascii=False)}"
backend/app/services/document_brief_service.py:576:            model=self._reduce_model,
backend/app/services/document_brief_service.py:579:            timeout_seconds=self._reduce_timeout_seconds,
backend/app/services/document_brief_service.py:581:        overview = str(data.get("summary") or "").strip()
backend/app/services/document_brief_service.py:583:            overview = "\n".join(item.summary for item in sorted(mapped, key=lambda value: value.group_index))
backend/app/services/document_brief_service.py:585:            summary=overview[:6000],
backend/app/services/document_brief_service.py:586:            context_items=self._context_items_from_mapped(mapped, overview=overview),
backend/app/services/document_brief_service.py:587:            selected_chunk_ids=self._mapped_selected_chunk_ids(
backend/app/services/document_brief_service.py:588:                mapped,
backend/app/services/document_brief_service.py:591:            covered_sections=covered_sections,
backend/app/services/document_brief_service.py:594:    async def _run_map_step(
backend/app/services/document_brief_service.py:597:        semaphore: asyncio.Semaphore,
backend/app/services/document_brief_service.py:602:        async with semaphore:
backend/app/services/document_brief_service.py:603:            if use_injected_step and self._map_step is not None:
backend/app/services/document_brief_service.py:604:                step = self._map_step
backend/app/services/document_brief_service.py:606:                step = self._llm_map_step
backend/app/services/document_brief_service.py:608:                step = self._default_map_step
backend/app/services/document_brief_service.py:645:    async def _select_chunks_for_summary(
backend/app/services/document_brief_service.py:663:        max_total_chunks = _dynamic_summary_chunk_budget(
backend/app/services/document_brief_service.py:670:        semaphore = asyncio.Semaphore(self._max_concurrency)
backend/app/services/document_brief_service.py:671:        mapped = await asyncio.gather(
backend/app/services/document_brief_service.py:673:                self._run_map_step(
backend/app/services/document_brief_service.py:675:                    semaphore,
backend/app/services/document_brief_service.py:682:        if use_injected_steps and self._reduce_step is not None:
backend/app/services/document_brief_service.py:683:            reduced = await self._reduce_step(mapped, max_total_chunks=max_total_chunks)
backend/app/services/document_brief_service.py:685:                list(reduced.selected_chunk_ids)
backend/app/services/document_brief_service.py:686:                if isinstance(reduced, MapReduceSummaryResult)
backend/app/services/document_brief_service.py:687:                else list(reduced)
backend/app/services/document_brief_service.py:690:            selected_ids = await self._default_reduce_step(mapped, max_total_chunks=max_total_chunks)
backend/app/services/document_brief_service.py:711:    async def select_chunks_for_summary(
backend/app/services/document_brief_service.py:717:        return await self._select_chunks_for_summary(
backend/app/services/document_brief_service.py:723:    def _fallback_summary_result(self, selected: Sequence[Any]) -> MapReduceSummaryResult:
backend/app/services/document_brief_service.py:730:                covered_sections=(_chunk_section_title(chunk),),
backend/app/services/document_brief_service.py:735:            summary="Fallback representative chunk selection.",
backend/app/services/document_brief_service.py:738:            covered_sections=tuple(_chunk_section_title(chunk) for chunk in selected),
backend/app/services/document_brief_service.py:739:            strategy="chunk_selection_fallback",
backend/app/services/document_brief_service.py:742:    def _normalize_summary_result(
backend/app/services/document_brief_service.py:744:        reduced: list[uuid.UUID] | MapReduceSummaryResult,
backend/app/services/document_brief_service.py:745:        mapped: list[MapStepResult],
backend/app/services/document_brief_service.py:750:        mapped_covered = self._mapped_covered_sections(mapped)
backend/app/services/document_brief_service.py:751:        if isinstance(reduced, MapReduceSummaryResult):
backend/app/services/document_brief_service.py:752:            summary = reduced.summary
backend/app/services/document_brief_service.py:753:            raw_selected = list(reduced.selected_chunk_ids)
backend/app/services/document_brief_service.py:754:            raw_items = list(reduced.context_items)
backend/app/services/document_brief_service.py:755:            raw_covered = tuple(reduced.covered_sections) or mapped_covered
backend/app/services/document_brief_service.py:756:            strategy = reduced.strategy or "map_reduce"
backend/app/services/document_brief_service.py:758:            summary = "\n".join(item.summary for item in sorted(mapped, key=lambda value: value.group_index))
backend/app/services/document_brief_service.py:759:            raw_selected = list(reduced)
backend/app/services/document_brief_service.py:760:            raw_items = list(self._context_items_from_mapped(mapped))
backend/app/services/document_brief_service.py:761:            raw_covered = mapped_covered
backend/app/services/document_brief_service.py:762:            strategy = "map_reduce"
backend/app/services/document_brief_service.py:775:                self._mapped_selected_chunk_ids(
backend/app/services/document_brief_service.py:776:                    mapped,
backend/app/services/document_brief_service.py:803:                    covered_sections=item.covered_sections,
backend/app/services/document_brief_service.py:808:            context_items = list(self._context_items_from_mapped(mapped, overview=summary))
backend/app/services/document_brief_service.py:812:        for section in (*raw_covered, *mapped_covered):
backend/app/services/document_brief_service.py:819:            summary=summary[:6000],
backend/app/services/document_brief_service.py:822:            covered_sections=tuple(covered),
backend/app/services/document_brief_service.py:826:    async def build_summary_context(
backend/app/services/document_brief_service.py:838:                summary="",
backend/app/services/document_brief_service.py:841:                covered_sections=(),
backend/app/services/document_brief_service.py:845:            selected = await self._select_chunks_for_summary(
backend/app/services/document_brief_service.py:850:            return self._fallback_summary_result(selected)
backend/app/services/document_brief_service.py:852:        max_total_chunks = _dynamic_summary_chunk_budget(
backend/app/services/document_brief_service.py:859:        semaphore = asyncio.Semaphore(self._max_concurrency)
backend/app/services/document_brief_service.py:861:            mapped = await asyncio.gather(
backend/app/services/document_brief_service.py:863:                    self._run_map_step(
backend/app/services/document_brief_service.py:865:                        semaphore,
backend/app/services/document_brief_service.py:872:            if self._reduce_step is not None:
backend/app/services/document_brief_service.py:873:                reduced = await self._reduce_step(mapped, max_total_chunks=max_total_chunks)
backend/app/services/document_brief_service.py:875:                reduced = await self._llm_reduce_step(mapped, max_total_chunks=max_total_chunks)
backend/app/services/document_brief_service.py:877:            logger.exception("Section map-reduce failed; falling back to representative chunks")
backend/app/services/document_brief_service.py:878:            selected = await self._select_chunks_for_summary(
backend/app/services/document_brief_service.py:883:            return self._fallback_summary_result(selected)
backend/app/services/document_brief_service.py:886:        return self._normalize_summary_result(
backend/app/services/document_brief_service.py:887:            reduced,
backend/app/services/document_brief_service.py:888:            mapped,
backend/app/services/document_brief_service.py:978:def _map_reduce_context_to_retrieval_items(
backend/app/services/document_brief_service.py:994:        retrieval_item["section_title"] = "Map-reduce section summary"
backend/app/services/document_brief_service.py:995:        retrieval_item["retrieval_modality"] = "summary"
backend/app/services/document_brief_service.py:996:        retrieval_item["map_reduce_strategy"] = result.strategy
backend/app/services/document_brief_service.py:997:        retrieval_item["map_reduce_source_chunk_ids"] = [
backend/app/services/document_brief_service.py:1000:        retrieval_item["map_reduce_covered_sections"] = list(context_item.covered_sections)
backend/app/services/document_brief_service.py:1009:        section_map_reduce: SectionMapReducePlanner | None = None,
backend/app/services/document_brief_service.py:1010:        map_reduce_min_chunks: int = DEFAULT_MAP_REDUCE_MIN_CHUNKS,
backend/app/services/document_brief_service.py:1012:        self._section_map_reduce = section_map_reduce or SectionMapReducePlanner()
backend/app/services/document_brief_service.py:1013:        self._map_reduce_min_chunks = max(1, int(map_reduce_min_chunks))
backend/app/services/document_brief_service.py:1015:    def _should_use_map_reduce(
backend/app/services/document_brief_service.py:1024:            # Collection summary allocates a narrow per-document budget.
backend/app/services/document_brief_service.py:1028:        if scale_units < self._map_reduce_min_chunks:
backend/app/services/document_brief_service.py:1036:        # No reliable element coverage: still promote large docs to section map-reduce.
backend/app/services/document_brief_service.py:1037:        return scale_units >= max(max_chunks * 2, self._map_reduce_min_chunks)
backend/app/services/document_brief_service.py:1039:    async def get_summary_context(
backend/app/services/document_brief_service.py:1046:        persisted = await self._get_persisted_summary_context(
backend/app/services/document_brief_service.py:1052:            # Collection / narrow-budget paths should keep using persisted brief context.
backend/app/services/document_brief_service.py:1085:        if self._should_use_map_reduce(
backend/app/services/document_brief_service.py:1091:            map_reduce_result = await self._section_map_reduce.build_summary_context(
backend/app/services/document_brief_service.py:1096:                map_reduce_result.strategy == "map_reduce"
backend/app/services/document_brief_service.py:1097:                and map_reduce_result.context_items
backend/app/services/document_brief_service.py:1099:                map_reduce_items = _map_reduce_context_to_retrieval_items(
backend/app/services/document_brief_service.py:1100:                    map_reduce_result,
backend/app/services/document_brief_service.py:1103:                if map_reduce_items:
backend/app/services/document_brief_service.py:1104:                    return map_reduce_items
backend/app/services/document_brief_service.py:1107:            selected_map_reduce = [
backend/app/services/document_brief_service.py:1109:                for chunk_id in map_reduce_result.selected_chunk_ids
backend/app/services/document_brief_service.py:1112:            if selected_map_reduce:
backend/app/services/document_brief_service.py:1113:                total = max(1, len(selected_map_reduce))
backend/app/services/document_brief_service.py:1119:                    for idx, chunk in enumerate(selected_map_reduce)
backend/app/services/document_brief_service.py:1138:    async def _get_persisted_summary_context(
backend/app/services/document_brief_service.py:1145:        brief_row = await db.execute(
backend/app/services/document_brief_service.py:1148:        coverage = brief_row.scalar_one_or_none()
backend/app/services/document_brief_service.py:1181:    async def get_collection_summary_context(
backend/app/services/document_brief_service.py:1197:                await self.get_summary_context(
backend/app/services/document_brief_service.py:1212:document_brief_service = DocumentBriefService()
backend/app/services/chat_service.py:3:import asyncio
backend/app/services/chat_service.py:15:from sqlalchemy.ext.asyncio import AsyncSession
backend/app/services/chat_service.py:36:from app.services.document_brief_service import document_brief_service
backend/app/services/chat_service.py:284:def _fallback_citations(
backend/app/services/chat_service.py:286:    chunk_map: dict[int, "_ChunkInfo"],
backend/app/services/chat_service.py:293:    The primary path is still model-authored [n] markers. This fallback prevents
backend/app/services/chat_service.py:297:    if not assistant_text.strip() or not chunk_map:
backend/app/services/chat_service.py:302:        for ref_num, chunk in chunk_map.items()
backend/app/services/chat_service.py:304:    fallback: List[Dict[str, Any]] = []
backend/app/services/chat_service.py:317:            best_ref = min(chunk_map.keys())
backend/app/services/chat_service.py:322:        fallback.append(_citation_payload(best_ref, chunk_map[best_ref], base_offset + offset))
backend/app/services/chat_service.py:324:    return fallback
backend/app/services/chat_service.py:329:    chunk_map: dict[int, "_ChunkInfo"],
backend/app/services/chat_service.py:331:    fsm = RefParserFSM(chunk_map)
backend/app/services/chat_service.py:342:        citations = _fallback_citations(clean_text, chunk_map)
backend/app/services/chat_service.py:381:    chunk_map: dict[int, "_ChunkInfo"],
backend/app/services/chat_service.py:386:    if verification.get("status") == "pass" or not chunk_map or not assistant_text.strip():
backend/app/services/chat_service.py:439:        repaired_text, repaired_citations = _parse_cited_answer(repaired_raw, chunk_map)
backend/app/services/chat_service.py:443:            set(chunk_map.keys()),
backend/app/services/chat_service.py:444:            retrieved_count=len(chunk_map),
backend/app/services/chat_service.py:563:# that also makes them uncancellable, so without a timeout a DB blip during a
backend/app/services/chat_service.py:564:# client disconnect could pin a task on asyncpg's 60s default connect timeout.
backend/app/services/chat_service.py:781:    def __init__(self, chunk_map: dict[int, _ChunkInfo]):
backend/app/services/chat_service.py:782:        self.chunk_map = chunk_map
backend/app/services/chat_service.py:802:                    if inner.isdigit() and (int(inner) in self.chunk_map):
backend/app/services/chat_service.py:804:                        chunk = self.chunk_map[ref_num]
backend/app/services/chat_service.py:1028:            if query_route.primary_intent == QueryIntent.DOCUMENT_SUMMARY:
backend/app/services/chat_service.py:1079:            # summary prompts frequently retrieve tables/appendices instead of
backend/app/services/chat_service.py:1081:            # selector until the durable hierarchical brief index lands.
backend/app/services/chat_service.py:1087:                query_route.primary_intent == QueryIntent.DOCUMENT_SUMMARY
backend/app/services/chat_service.py:1092:                retrieved = await document_brief_service.get_summary_context(
backend/app/services/chat_service.py:1097:                retrieval_strategy = "document_summary_context"
backend/app/services/chat_service.py:1099:                query_route.primary_intent == QueryIntent.DOCUMENT_SUMMARY
backend/app/services/chat_service.py:1103:                retrieved = await document_brief_service.get_collection_summary_context(
backend/app/services/chat_service.py:1109:                retrieval_strategy = "collection_summary_context"
backend/app/services/chat_service.py:1158:            chunk_map: dict[int, _ChunkInfo] = {}
backend/app/services/chat_service.py:1159:            has_map_reduce_summary_context = any(
backend/app/services/chat_service.py:1160:                item.get("retrieval_modality") == "summary"
backend/app/services/chat_service.py:1161:                or item.get("map_reduce_strategy") == "map_reduce"
backend/app/services/chat_service.py:1177:                chunk_map[idx] = _ChunkInfo(
backend/app/services/chat_service.py:1197:            if is_collection_session and retrieval_strategy == "collection_summary_context":
backend/app/services/chat_service.py:1200:                    "You are a document analysis assistant. The user is asking for a broad summary across a document collection.\n\n"
backend/app/services/chat_service.py:1227:            elif retrieval_strategy == "document_summary_context":
backend/app/services/chat_service.py:1228:                map_reduce_rule = (
backend/app/services/chat_service.py:1229:                    "7. The excerpts may be map-reduce section summaries generated from source chunks; "
backend/app/services/chat_service.py:1231:                    if has_map_reduce_summary_context
backend/app/services/chat_service.py:1235:                    "You are a document analysis assistant. The user is asking for a broad, whole-document summary.\n\n"
backend/app/services/chat_service.py:1246:                    + "3. Produce a useful document-level summary with clear headings, key points, and important caveats when supported.\n"
backend/app/services/chat_service.py:1250:                    + map_reduce_rule
backend/app/services/chat_service.py:1291:        except asyncio.CancelledError:
backend/app/services/chat_service.py:1295:                        await asyncio.wait_for(
backend/app/services/chat_service.py:1306:                            timeout=_CANCEL_IO_TIMEOUT_S,
backend/app/services/chat_service.py:1345:        # cache_control is Anthropic-specific — only include for Anthropic models
backend/app/services/chat_service.py:1347:        if profile.supports_cache_control:
backend/app/services/chat_service.py:1354:                        "cache_control": {"type": "ephemeral"},
backend/app/services/chat_service.py:1364:        fsm = RefParserFSM(chunk_map)
backend/app/services/chat_service.py:1432:                    fallback_citations = _fallback_citations(assistant_snapshot, chunk_map)
backend/app/services/chat_service.py:1433:                    if fallback_citations:
backend/app/services/chat_service.py:1435:                            "LLM emitted no citation markers; generated %d fallback citations model=%s",
backend/app/services/chat_service.py:1436:                            len(fallback_citations),
backend/app/services/chat_service.py:1439:                        for citation in fallback_citations:
backend/app/services/chat_service.py:1517:                set(chunk_map.keys()),
backend/app/services/chat_service.py:1518:                retrieved_count=len(chunk_map),
backend/app/services/chat_service.py:1530:                    chunk_map=chunk_map,
backend/app/services/chat_service.py:1548:                            set(chunk_map.keys()),
backend/app/services/chat_service.py:1549:                            retrieved_count=len(chunk_map),
backend/app/services/chat_service.py:1590:                retrieved_count=len(chunk_map),
backend/app/services/chat_service.py:1629:        except asyncio.CancelledError:
backend/app/services/chat_service.py:1637:                        await asyncio.wait_for(
backend/app/services/chat_service.py:1645:                            timeout=_CANCEL_IO_TIMEOUT_S,
backend/app/services/chat_service.py:1661:                        await asyncio.wait_for(
backend/app/services/chat_service.py:1672:                            timeout=_CANCEL_IO_TIMEOUT_S,
backend/app/services/chat_service.py:1791:            # 6) Reconstruct chunk_map from original citations
backend/app/services/chat_service.py:1792:            chunk_map: dict[int, _ChunkInfo] = {}
backend/app/services/chat_service.py:1849:                            chunk_map[ref_num] = _chunk_info_from_persisted_citation(
backend/app/services/chat_service.py:1877:            # 8) Build system prompt with chunk_map context
backend/app/services/chat_service.py:1879:            for idx in sorted(chunk_map.keys()):
backend/app/services/chat_service.py:1880:                info = chunk_map[idx]
backend/app/services/chat_service.py:1922:        except asyncio.CancelledError:
backend/app/services/chat_service.py:1926:                        await asyncio.wait_for(
backend/app/services/chat_service.py:1937:                            timeout=_CANCEL_IO_TIMEOUT_S,
backend/app/services/chat_service.py:1976:        if profile.supports_cache_control:
backend/app/services/chat_service.py:1979:                "content": [{"type": "text", "text": system_prompt, "cache_control": {"type": "ephemeral"}}],
backend/app/services/chat_service.py:1987:        fsm = RefParserFSM(chunk_map)
backend/app/services/chat_service.py:2043:                    fallback_citations = _fallback_citations(
backend/app/services/chat_service.py:2045:                        chunk_map,
backend/app/services/chat_service.py:2048:                    if fallback_citations:
backend/app/services/chat_service.py:2050:                            "LLM emitted no continuation citation markers; generated %d fallback citations model=%s",
backend/app/services/chat_service.py:2051:                            len(fallback_citations),
backend/app/services/chat_service.py:2054:                        for citation in fallback_citations:
backend/app/services/chat_service.py:2115:                set(chunk_map.keys()),
backend/app/services/chat_service.py:2116:                retrieved_count=len(chunk_map),
backend/app/services/chat_service.py:2128:                    chunk_map=chunk_map,
backend/app/services/chat_service.py:2145:                            set(chunk_map.keys()),
backend/app/services/chat_service.py:2146:                            retrieved_count=len(chunk_map),
backend/app/services/chat_service.py:2184:                retrieved_count=len(chunk_map),
backend/app/services/chat_service.py:2222:        except asyncio.CancelledError:
backend/app/services/chat_service.py:2230:                        await asyncio.wait_for(
backend/app/services/chat_service.py:2237:                            timeout=_CANCEL_IO_TIMEOUT_S,
backend/app/services/chat_service.py:2253:                        await asyncio.wait_for(
backend/app/services/chat_service.py:2264:                            timeout=_CANCEL_IO_TIMEOUT_S,

codex
初读看到了真正的 LLM map/reduce 路径、并发信号量和超时，但也看到 coverage 是由目标 section 列表回填出来的，不完全等价于模型实际覆盖。我继续读关键分支和聊天接入，确认是否会导致用户可见误引或成本失控。
exec
/bin/zsh -lc "sed -n '940,1225p' backend/app/services/document_brief_service.py" in /Users/mayijie/Projects/Code/010_DocTalk
exec
/bin/zsh -lc "sed -n '1000,1285p' backend/app/services/chat_service.py" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
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

 succeeded in 0ms:
            locale=locale,
        )
        if not action_plan.uses_rag_answer_path:
            async for ev in self._tool_action_stream(
                session_id=session_id,
                user_message=user_message,
                db=db,
                user=user,
                locale=locale,
                domain_mode=domain_mode,
                document_id=document_id,
                collection_doc_ids=collection_doc_ids,
                action_plan=action_plan,
            ):
                yield ev
            return

        query_route = query_router.route(
            user_message,
            is_collection=is_collection_session,
            domain_mode=domain_mode,
        )

        # Pre-debit estimated credits BEFORE streaming (prevents TOCTOU + free rides)
        pre_debited = 0
        predebit_ledger_id = None
        if user is not None:
            estimated = credit_service.get_estimated_cost(effective_mode)
            if query_route.primary_intent == QueryIntent.DOCUMENT_SUMMARY:
                estimated = max(estimated, estimated * 2)
            predebit_ledger_id = await credit_service.debit_credits(
                db, user_id=user.id, cost=estimated,
                reason="chat", ref_type="mode", ref_id=effective_mode,
            )
            if predebit_ledger_id:
                pre_debited = estimated
                await db.commit()
            else:
                balance = await credit_service.get_user_credits(db, user.id)
                yield sse(
                    "error",
                    {
                        "code": "INSUFFICIENT_CREDITS",
                        "message": "Insufficient credits to start chat",
                        "required": estimated,
                        "balance": balance,
                    },
                )
                return

        settled = False
        setup_error_code = "CHAT_SETUP_ERROR"
        try:
            # 2) Save user message
            await self._persist_user_message_and_title(
                db=db,
                session_id=session_id,
                user_message=user_message,
            )

            # 3) Load history (last N*2 messages before current user msg)
            max_turns = int(settings.MAX_CHAT_HISTORY_TURNS or 6)
            max_msgs = max_turns * 2
            msgs_row = await db.execute(
                select(Message)
                .where(Message.session_id == session_id)
                .order_by(Message.created_at.desc())
                .limit(max_msgs + 1)
            )
            history_msgs: List[Message] = list(msgs_row.scalars().all())
            history_msgs.reverse()  # back to chronological order

            # Convert to Claude message format (excluding system)
            claude_messages: List[dict] = []
            for m in history_msgs:
                claude_messages.append({"role": m.role, "content": m.content})

            # 4) Route + retrieval (with error handling — e.g. Qdrant down or no vectors yet).
            # Whole-document summaries must not use ordinary semantic top-k: vague
            # summary prompts frequently retrieve tables/appendices instead of
            # representative document structure. Route them to an ordered context
            # selector until the durable hierarchical brief index lands.
            setup_error_code = "RETRIEVAL_ERROR"
            retrieval_strategy = "semantic_top_k"
            retrieval_evaluation = None
            retrieval_plan: QueryPlan | None = None
            if (
                query_route.primary_intent == QueryIntent.DOCUMENT_SUMMARY
                and document_id
                and not is_collection_session
            ):
                yield sse("tool_status", {"message": "Summarizing the document section by section…"})
                retrieved = await document_brief_service.get_summary_context(
                    db,
                    document_id,
                    max_chunks=18,
                )
                retrieval_strategy = "document_summary_context"
            elif (
                query_route.primary_intent == QueryIntent.DOCUMENT_SUMMARY
                and is_collection_session
                and collection_doc_ids
            ):
                retrieved = await document_brief_service.get_collection_summary_context(
                    db,
                    collection_doc_ids,
                    max_chunks=24,
                    max_docs=8,
                )
                retrieval_strategy = "collection_summary_context"
            elif is_collection_session and collection_doc_ids:
                corrective = await corrective_retrieval_service.retrieve_multi(
                    user_message,
                    query_route,
                    collection_doc_ids,
                    top_k=8,
                    db=db,
                )
                retrieved = corrective.retrieved
                retrieval_strategy = corrective.strategy
                retrieval_evaluation = corrective.evaluation
                retrieval_plan = corrective.plan
            elif (
                document_id
                and query_route.primary_intent == QueryIntent.PAGE_LOOKUP
                and query_route.page_ref is not None
            ):
                retrieved = await _fetch_page_chunks(db, document_id, query_route.page_ref)
                retrieval_strategy = "page_lookup"
                if not retrieved:
                    # Page out of range / no chunks there → fall back to semantic.
                    corrective = await corrective_retrieval_service.retrieve_single(
                        user_message, query_route, document_id, top_k=8, db=db,
                        doc_pages=getattr(doc, "page_count", None),
                    )
                    retrieved = corrective.retrieved
                    retrieval_strategy = corrective.strategy
                    retrieval_evaluation = corrective.evaluation
                    retrieval_plan = corrective.plan
            elif document_id:
                corrective = await corrective_retrieval_service.retrieve_single(
                    user_message,
                    query_route,
                    document_id,
                    top_k=8,
                    db=db,
                    doc_pages=getattr(doc, "page_count", None),
                )
                retrieved = corrective.retrieved
                retrieval_strategy = corrective.strategy
                retrieval_evaluation = corrective.evaluation
                retrieval_plan = corrective.plan
            else:
                retrieved = []

            # 5) Build prompt (system)
            setup_error_code = "CHAT_SETUP_ERROR"
            numbered_chunks: List[str] = []
            chunk_map: dict[int, _ChunkInfo] = {}
            has_map_reduce_summary_context = any(
                item.get("retrieval_modality") == "summary"
                or item.get("map_reduce_strategy") == "map_reduce"
                for item in retrieved
            )
            for idx, item in enumerate(retrieved, start=1):
                # Heuristic truncation to ~350 tokens (roughly 1200-1400 chars)
                text = item["text"] or ""
                truncated = text[:1400]
                chunk_doc_id = item.get("document_id")
                doc_label = ""
                if is_collection_session and chunk_doc_id:
                    fname = collection_doc_names.get(chunk_doc_id, "")
                    if fname:
                        doc_label = f"(from: {fname}) "
                plan_label = _safe_plan_label(item.get("retrieval_plan_step"))
                evidence_label = f"(evidence: {plan_label}) " if plan_label else ""
                numbered_chunks.append(f"[{idx}] {doc_label}{evidence_label}{truncated}")
                chunk_map[idx] = _ChunkInfo(
                    id=item["chunk_id"],
                    page_start=int(item["page"]),
                    page_end=int(item.get("page_end", item["page"])),
                    bboxes=item.get("bboxes") or [],
                    text=text,
                    section_title=item.get("section_title") or "",
                    document_id=chunk_doc_id if chunk_doc_id else document_id,
                    document_filename=collection_doc_names.get(chunk_doc_id, "")
                    if chunk_doc_id
                    else "",
                    score=item.get("score", 0.0),
                    table_id=str(item.get("table_id")) if item.get("table_id") else None,
                    retrieval_modality=str(item.get("retrieval_modality") or "text"),
                )

            rules = get_rules_for_model(
                effective_model, is_collection=is_collection_session
            )

            if is_collection_session and retrieval_strategy == "collection_summary_context":
                doc_list = ", ".join(collection_doc_names.values()) if collection_doc_names else "(no documents)"
                system_prompt = (
                    "You are a document analysis assistant. The user is asking for a broad summary across a document collection.\n\n"
                    + SYSTEM_PROMPT_META_RULE
                    + f"## Available Documents\n{doc_list}\n\n"
                    + "## Collection Coverage Excerpts\n"
                    + ("\n".join(numbered_chunks) if numbered_chunks else "(none)")
                    + "\n\n## Summary Rules\n"
                    + "1. Treat these excerpts as representative coverage selected across the collection, not as semantic search results for a narrow question.\n"
                    + "2. Do NOT say the collection is just unrelated excerpts merely because the context is excerpted.\n"
                    + "3. Summarize shared themes, document-specific points, and important caveats when supported.\n"
                    + "4. If coverage is incomplete, say the answer is based on the cited representative sections instead of refusing.\n"
                    + "5. Cite every factual paragraph or bullet using the excerpt numbers listed above.\n"
                    + "6. Your response language MUST match the language of the user's question.\n"
                    + _citation_contract()
                )
            elif is_collection_session:
                doc_list = ", ".join(collection_doc_names.values()) if collection_doc_names else "(no documents)"
                system_prompt = (
                    "You are a document analysis assistant. Answer the user's question based on excerpts from multiple documents.\n\n"
                    + SYSTEM_PROMPT_META_RULE
                    + f"## Available Documents\n{doc_list}\n\n"
                    + "## Document Excerpts\n"
                    + ("\n".join(numbered_chunks) if numbered_chunks else "(none)")
                    + _retrieval_quality_contract(retrieval_evaluation, retrieval_strategy)
                    + _query_plan_contract(retrieval_plan)
                    + "\n\n## Rules\n" + rules
                    + _citation_contract()
                )
            elif retrieval_strategy == "document_summary_context":
                map_reduce_rule = (
                    "7. The excerpts may be map-reduce section summaries generated from source chunks; "
                    "when they are present, treat their listed section coverage as the full-document structure and cover all listed sections.\n"
                    if has_map_reduce_summary_context
                    else ""
                )
                system_prompt = (
                    "You are a document analysis assistant. The user is asking for a broad, whole-document summary.\n\n"
                    + SYSTEM_PROMPT_META_RULE
                    + "## Document Coverage Excerpts\n"
                    + (
                        "\n".join(numbered_chunks)
                        if numbered_chunks
                        else "(none)"
                    )
                    + "\n\n## Summary Rules\n"
                    + "1. Treat these excerpts as representative coverage selected across the document, not as semantic search results for a narrow question.\n"
                    + "2. Do NOT say the user's ready document is not a complete document merely because the context is excerpted.\n"
                    + "3. Produce a useful document-level summary with clear headings, key points, and important caveats when supported.\n"
                    + "4. If coverage is incomplete, say the answer is based on the cited representative sections instead of refusing.\n"
                    + "5. Cite every factual paragraph or bullet using the excerpt numbers listed above.\n"
                    + "6. Your response language MUST match the language of the user's question.\n"
                    + map_reduce_rule
                    + _citation_contract()
                )
            else:
                system_prompt = (
                    "You are a document analysis assistant. Answer the user's question based on the following document excerpts.\n\n"
                    + SYSTEM_PROMPT_META_RULE
                    + "## Document Excerpts\n"
                    + ("\n".join(numbered_chunks) if numbered_chunks else "(none)")
                    + _retrieval_quality_contract(retrieval_evaluation, retrieval_strategy)
                    + _query_plan_contract(retrieval_plan)
                    + "\n\n## Rules\n" + rules
                    + _citation_contract()
                )

            # Inject custom instructions if present
            if doc and doc.custom_instructions:
                system_prompt += (
                    "\n## Custom Instructions\n"
                    "The user has provided the following custom instructions for this document. Follow them:\n"
                    + doc.custom_instructions + "\n"
                )

            # Inject domain-specific rules (legal/academic mode overlay)
            # Frontend always sends domain_mode: null (default) or "legal"/"academic"
            # domain_mode=None means Default (no extra rules), string means apply rules
            if domain_mode:
                from app.core.model_profiles import DOMAIN_RULES
                domain_rules = DOMAIN_RULES.get(domain_mode)
                if domain_rules:
                    base_rule_count = len(rules.strip().split('\n'))
                    domain_rules_text = f"\n\n## {domain_mode.title()} Mode Rules\n"
                    for i, rule in enumerate(domain_rules, start=base_rule_count + 1):
                        domain_rules_text += f"{i}. {rule}\n"
                    system_prompt += domain_rules_text


exec
/bin/zsh -lc "sed -n '1,220p' .collab/reviews/2026-05-24-phase2b-diff.patch" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
diff --git a/backend/app/services/chat_service.py b/backend/app/services/chat_service.py
index 4807439..dba1429 100644
--- a/backend/app/services/chat_service.py
+++ b/backend/app/services/chat_service.py
@@ -1088,6 +1088,7 @@ class ChatService:
                 and document_id
                 and not is_collection_session
             ):
+                yield sse("tool_status", {"message": "Summarizing the document section by section…"})
                 retrieved = await document_brief_service.get_summary_context(
                     db,
                     document_id,
@@ -1155,6 +1156,11 @@ class ChatService:
             setup_error_code = "CHAT_SETUP_ERROR"
             numbered_chunks: List[str] = []
             chunk_map: dict[int, _ChunkInfo] = {}
+            has_map_reduce_summary_context = any(
+                item.get("retrieval_modality") == "summary"
+                or item.get("map_reduce_strategy") == "map_reduce"
+                for item in retrieved
+            )
             for idx, item in enumerate(retrieved, start=1):
                 # Heuristic truncation to ~350 tokens (roughly 1200-1400 chars)
                 text = item["text"] or ""
@@ -1219,6 +1225,12 @@ class ChatService:
                     + _citation_contract()
                 )
             elif retrieval_strategy == "document_summary_context":
+                map_reduce_rule = (
+                    "7. The excerpts may be map-reduce section summaries generated from source chunks; "
+                    "when they are present, treat their listed section coverage as the full-document structure and cover all listed sections.\n"
+                    if has_map_reduce_summary_context
+                    else ""
+                )
                 system_prompt = (
                     "You are a document analysis assistant. The user is asking for a broad, whole-document summary.\n\n"
                     + SYSTEM_PROMPT_META_RULE
@@ -1235,6 +1247,7 @@ class ChatService:
                     + "4. If coverage is incomplete, say the answer is based on the cited representative sections instead of refusing.\n"
                     + "5. Cite every factual paragraph or bullet using the excerpt numbers listed above.\n"
                     + "6. Your response language MUST match the language of the user's question.\n"
+                    + map_reduce_rule
                     + _citation_contract()
                 )
             else:
diff --git a/backend/app/services/document_brief_service.py b/backend/app/services/document_brief_service.py
index 3f3bdbb..1312bf4 100644
--- a/backend/app/services/document_brief_service.py
+++ b/backend/app/services/document_brief_service.py
@@ -1,7 +1,10 @@
 from __future__ import annotations
 
 import asyncio
+import json
+import logging
 import math
+import re
 import uuid
 from dataclasses import dataclass
 from typing import Any, Protocol, Sequence
@@ -9,17 +12,22 @@ from typing import Any, Protocol, Sequence
 from sqlalchemy import select
 from sqlalchemy.ext.asyncio import AsyncSession
 
+from app.core.config import settings
 from app.models.tables import Chunk, Document, DocumentBrief
 from app.services.document_element_service import (
     chunk_to_retrieval_item,
     get_element_aware_chunks_async,
 )
 
+logger = logging.getLogger(__name__)
+
 MIN_SUMMARY_CHUNK_CHARS = 80
 DEFAULT_MAX_SUMMARY_CHUNKS = 18
 DEFAULT_MAX_COLLECTION_SUMMARY_CHUNKS = 24
 DEFAULT_MAX_COLLECTION_SUMMARY_DOCS = 8
 DEFAULT_MAP_REDUCE_MIN_CHUNKS = 36
+MAP_REDUCE_MAX_CHARS_PER_CHUNK = 900
+MAP_REDUCE_MAX_CONTEXT_ITEM_CHARS = 3000
 
 
 @dataclass(frozen=True)
@@ -37,6 +45,24 @@ class MapStepResult:
     covered_sections: tuple[str, ...]
 
 
+@dataclass(frozen=True)
+class MapReduceContextItem:
+    group_index: int
+    text: str
+    anchor_chunk_id: uuid.UUID
+    source_chunk_ids: tuple[uuid.UUID, ...]
+    covered_sections: tuple[str, ...]
+
+
+@dataclass(frozen=True)
+class MapReduceSummaryResult:
+    summary: str
+    context_items: tuple[MapReduceContextItem, ...]
+    selected_chunk_ids: tuple[uuid.UUID, ...]
+    covered_sections: tuple[str, ...]
+    strategy: str = "map_reduce"
+
+
 class MapStep(Protocol):
     async def __call__(self, group: SectionMapGroup) -> MapStepResult: ...
 
@@ -47,15 +73,52 @@ class ReduceStep(Protocol):
         mapped: list[MapStepResult],
         *,
         max_total_chunks: int,
-    ) -> list[uuid.UUID]: ...
+    ) -> list[uuid.UUID] | MapReduceSummaryResult: ...
 
 
 def _chunk_text_length(chunk: Any) -> int:
     return len((getattr(chunk, "text", "") or "").strip())
 
 
+def _raw_chunk_section_title(chunk: Any) -> str:
+    return str(getattr(chunk, "section_title", "") or "").strip()[:200]
+
+
+def _is_noisy_section_title(title: str) -> bool:
+    normalized = re.sub(r"\s+", " ", (title or "").strip())
+    if not normalized:
+        return False
+    if len(normalized) <= 1:
+        return True
+    if not re.search(r"[A-Za-z0-9\u0080-\uffff]", normalized):
+        return True
+    return bool(re.fullmatch(r"[\d\s\.,;:()\[\]{}#\-_/]+", normalized))
+
+
+def _chunk_has_noisy_section_title(chunk: Any) -> bool:
+    raw_title = _raw_chunk_section_title(chunk)
+    return bool(raw_title) and _is_noisy_section_title(raw_title)
+
+
+def _json_from_text(text: str) -> dict[str, Any]:
+    content = (text or "").strip()
+    if content.startswith("```"):
+        content = re.sub(r"^```(?:json)?\s*", "", content)
+        content = re.sub(r"\s*```$", "", content)
+    try:
+        data = json.loads(content)
+    except json.JSONDecodeError:
+        match = re.search(r"\{.*\}", content, flags=re.DOTALL)
+        if not match:
+            raise
+        data = json.loads(match.group(0))
+    if not isinstance(data, dict):
+        raise ValueError("Map-reduce response must be a JSON object")
+    return data
+
+
 def _chunk_section_title(chunk: Any) -> str:
-    section = str(getattr(chunk, "section_title", "") or "").strip()
+    section = _raw_chunk_section_title(chunk)
     if section:
         return section[:200]
     page = getattr(chunk, "page_start", None)
@@ -98,6 +161,10 @@ def _section_segments(chunks: Sequence[Any]) -> list[tuple[str, list[Any]]]:
     current_items: list[Any] = []
 
     for chunk in chunks:
+        if _chunk_has_noisy_section_title(chunk):
+            if current_title is not None:
+                current_items.append(chunk)
+            continue
         title = _chunk_section_title(chunk)
         if current_title is None:
             current_title = title
@@ -161,6 +228,10 @@ class SectionMapReducePlanner:
         max_group_chunks: int = 6,
         max_total_chunks_cap: int = 64,
         max_concurrency: int = 4,
+        map_model: str | None = None,
+        reduce_model: str | None = None,
+        map_timeout_seconds: float = 20.0,
+        reduce_timeout_seconds: float = 30.0,
     ) -> None:
         self._map_step = map_step
         self._reduce_step = reduce_step
@@ -169,13 +240,25 @@ class SectionMapReducePlanner:
         self._max_group_chunks = max(1, int(max_group_chunks))
         self._max_total_chunks_cap = max(1, int(max_total_chunks_cap))
         self._max_concurrency = max(1, int(max_concurrency))
+        self._map_model = map_model or settings.MODE_MODELS.get("quick", settings.LLM_MODEL)
+        self._reduce_model = reduce_model or settings.MODE_MODELS.get("quick", settings.LLM_MODEL)
+        self._map_timeout_seconds = max(1.0, float(map_timeout_seconds))
+        self._reduce_timeout_seconds = max(1.0, float(reduce_timeout_seconds))
 
-    def _truncate_group_chunks(self, group: SectionMapGroup) -> SectionMapGroup:
+    def _truncate_group_chunks(
+        self,
+        group: SectionMapGroup,
+        *,
+        max_group_chunks: int | None = None,
+    ) -> SectionMapGroup:
         """Cap per-group map context while preserving at least one chunk/section."""
+        group_chunk_limit = max(1, int(max_group_chunks or self._max_group_chunks))
         section_anchor_set: set[uuid.UUID] = set()
         selected: list[Any] = []
         seen_sections: set[str] = set()
         for chunk in group.chunks:
+            if _chunk_has_noisy_section_title(chunk):
+                continue
             section = _chunk_section_title(chunk)
             if section in seen_sections:
                 continue
@@ -184,13 +267,13 @@ class SectionMapReducePlanner:
             section_anchor_set.add(chunk.id)
 
         # Fill extra room with evenly spaced body chunks for long sections.
-        if len(selected) < self._max_group_chunks and len(group.chunks) > len(selected):
+        if len(selected) < group_chunk_limit and len(group.chunks) > len(selected):
             remaining = [
                 chunk

exec
/bin/zsh -lc "sed -n '620,940p' backend/app/services/document_brief_service.py" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:

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

exec
/bin/zsh -lc "nl -ba backend/app/services/document_brief_service.py | sed -n '80,180p'" in /Users/mayijie/Projects/Code/010_DocTalk
exec
/bin/zsh -lc "nl -ba backend/app/services/document_brief_service.py | sed -n '220,540p'" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
    80	    return len((getattr(chunk, "text", "") or "").strip())
    81	
    82	
    83	def _raw_chunk_section_title(chunk: Any) -> str:
    84	    return str(getattr(chunk, "section_title", "") or "").strip()[:200]
    85	
    86	
    87	def _is_noisy_section_title(title: str) -> bool:
    88	    normalized = re.sub(r"\s+", " ", (title or "").strip())
    89	    if not normalized:
    90	        return False
    91	    if len(normalized) <= 1:
    92	        return True
    93	    if not re.search(r"[A-Za-z0-9\u0080-\uffff]", normalized):
    94	        return True
    95	    return bool(re.fullmatch(r"[\d\s\.,;:()\[\]{}#\-_/]+", normalized))
    96	
    97	
    98	def _chunk_has_noisy_section_title(chunk: Any) -> bool:
    99	    raw_title = _raw_chunk_section_title(chunk)
   100	    return bool(raw_title) and _is_noisy_section_title(raw_title)
   101	
   102	
   103	def _json_from_text(text: str) -> dict[str, Any]:
   104	    content = (text or "").strip()
   105	    if content.startswith("```"):
   106	        content = re.sub(r"^```(?:json)?\s*", "", content)
   107	        content = re.sub(r"\s*```$", "", content)
   108	    try:
   109	        data = json.loads(content)
   110	    except json.JSONDecodeError:
   111	        match = re.search(r"\{.*\}", content, flags=re.DOTALL)
   112	        if not match:
   113	            raise
   114	        data = json.loads(match.group(0))
   115	    if not isinstance(data, dict):
   116	        raise ValueError("Map-reduce response must be a JSON object")
   117	    return data
   118	
   119	
   120	def _chunk_section_title(chunk: Any) -> str:
   121	    section = _raw_chunk_section_title(chunk)
   122	    if section:
   123	        return section[:200]
   124	    page = getattr(chunk, "page_start", None)
   125	    if isinstance(page, int):
   126	        return f"Page {page}"
   127	    return "Untitled"
   128	
   129	
   130	def _dynamic_section_group_count(
   131	    chunks_total: int,
   132	    *,
   133	    min_groups: int = 2,
   134	    max_groups: int = 18,
   135	    target_chunks_per_group: int = 12,
   136	) -> int:
   137	    total = max(0, int(chunks_total or 0))
   138	    if total <= 0:
   139	        return min_groups
   140	    groups = math.ceil(total / max(1, target_chunks_per_group))
   141	    return max(min_groups, min(max_groups, groups))
   142	
   143	
   144	def _dynamic_summary_chunk_budget(
   145	    base_max_chunks: int,
   146	    *,
   147	    chunks_total: int,
   148	    section_total: int,
   149	    max_total_chunks_cap: int,
   150	) -> int:
   151	    floor = max(int(base_max_chunks or DEFAULT_MAX_SUMMARY_CHUNKS), DEFAULT_MAX_SUMMARY_CHUNKS)
   152	    budget = max(floor, min(max_total_chunks_cap, floor + (max(0, chunks_total) // 24)))
   153	    if section_total > 0:
   154	        budget = max(budget, min(max_total_chunks_cap, section_total))
   155	    return min(max_total_chunks_cap, max(1, budget))
   156	
   157	
   158	def _section_segments(chunks: Sequence[Any]) -> list[tuple[str, list[Any]]]:
   159	    segments: list[tuple[str, list[Any]]] = []
   160	    current_title: str | None = None
   161	    current_items: list[Any] = []
   162	
   163	    for chunk in chunks:
   164	        if _chunk_has_noisy_section_title(chunk):
   165	            if current_title is not None:
   166	                current_items.append(chunk)
   167	            continue
   168	        title = _chunk_section_title(chunk)
   169	        if current_title is None:
   170	            current_title = title
   171	            current_items = [chunk]
   172	            continue
   173	        if title == current_title:
   174	            current_items.append(chunk)
   175	            continue
   176	        segments.append((current_title, current_items))
   177	        current_title = title
   178	        current_items = [chunk]
   179	
   180	    if current_title is not None and current_items:

 succeeded in 0ms:
   220	class SectionMapReducePlanner:
   221	    def __init__(
   222	        self,
   223	        *,
   224	        map_step: MapStep | None = None,
   225	        reduce_step: ReduceStep | None = None,
   226	        min_groups: int = 2,
   227	        max_groups: int = 18,
   228	        max_group_chunks: int = 6,
   229	        max_total_chunks_cap: int = 64,
   230	        max_concurrency: int = 4,
   231	        map_model: str | None = None,
   232	        reduce_model: str | None = None,
   233	        map_timeout_seconds: float = 20.0,
   234	        reduce_timeout_seconds: float = 30.0,
   235	    ) -> None:
   236	        self._map_step = map_step
   237	        self._reduce_step = reduce_step
   238	        self._min_groups = max(1, int(min_groups))
   239	        self._max_groups = max(self._min_groups, int(max_groups))
   240	        self._max_group_chunks = max(1, int(max_group_chunks))
   241	        self._max_total_chunks_cap = max(1, int(max_total_chunks_cap))
   242	        self._max_concurrency = max(1, int(max_concurrency))
   243	        self._map_model = map_model or settings.MODE_MODELS.get("quick", settings.LLM_MODEL)
   244	        self._reduce_model = reduce_model or settings.MODE_MODELS.get("quick", settings.LLM_MODEL)
   245	        self._map_timeout_seconds = max(1.0, float(map_timeout_seconds))
   246	        self._reduce_timeout_seconds = max(1.0, float(reduce_timeout_seconds))
   247	
   248	    def _truncate_group_chunks(
   249	        self,
   250	        group: SectionMapGroup,
   251	        *,
   252	        max_group_chunks: int | None = None,
   253	    ) -> SectionMapGroup:
   254	        """Cap per-group map context while preserving at least one chunk/section."""
   255	        group_chunk_limit = max(1, int(max_group_chunks or self._max_group_chunks))
   256	        section_anchor_set: set[uuid.UUID] = set()
   257	        selected: list[Any] = []
   258	        seen_sections: set[str] = set()
   259	        for chunk in group.chunks:
   260	            if _chunk_has_noisy_section_title(chunk):
   261	                continue
   262	            section = _chunk_section_title(chunk)
   263	            if section in seen_sections:
   264	                continue
   265	            seen_sections.add(section)
   266	            selected.append(chunk)
   267	            section_anchor_set.add(chunk.id)
   268	
   269	        # Fill extra room with evenly spaced body chunks for long sections.
   270	        if len(selected) < group_chunk_limit and len(group.chunks) > len(selected):
   271	            remaining = [
   272	                chunk
   273	                for chunk in group.chunks
   274	                if chunk.id not in section_anchor_set
   275	            ]
   276	            budget = group_chunk_limit - len(selected)
   277	            if remaining and budget > 0:
   278	                if len(remaining) <= budget:
   279	                    selected.extend(remaining)
   280	                elif budget == 1:
   281	                    selected.append(remaining[len(remaining) // 2])
   282	                else:
   283	                    for slot in range(budget):
   284	                        selected.append(
   285	                            remaining[round(slot * (len(remaining) - 1) / (budget - 1))]
   286	                        )
   287	
   288	        if not selected:
   289	            return group
   290	
   291	        # Keep map payload ordered by chunk index.
   292	        selected.sort(key=lambda chunk: int(getattr(chunk, "chunk_index", 0) or 0))
   293	        if len(selected) > group_chunk_limit:
   294	            if group_chunk_limit == 1:
   295	                selected = [selected[len(selected) // 2]]
   296	            else:
   297	                last_index = len(selected) - 1
   298	                selected = [
   299	                    selected[(slot * last_index) // (group_chunk_limit - 1)]
   300	                    for slot in range(group_chunk_limit)
   301	                ]
   302	        return SectionMapGroup(
   303	            group_index=group.group_index,
   304	            chunks=tuple(selected),
   305	            section_titles=group.section_titles,
   306	        )
   307	
   308	    async def _default_map_step(self, group: SectionMapGroup) -> MapStepResult:
   309	        selected_ids: list[uuid.UUID] = []
   310	        covered_sections: list[str] = []
   311	        seen_sections: set[str] = set()
   312	
   313	        for chunk in group.chunks:
   314	            if _chunk_has_noisy_section_title(chunk):
   315	                continue
   316	            section = _chunk_section_title(chunk)
   317	            if section in seen_sections:
   318	                continue
   319	            seen_sections.add(section)
   320	            covered_sections.append(section)
   321	            selected_ids.append(chunk.id)
   322	
   323	        if not selected_ids and group.chunks:
   324	            selected_ids.append(group.chunks[0].id)
   325	            covered_sections.append(_chunk_section_title(group.chunks[0]))
   326	
   327	        summary = f"Group {group.group_index} covers {len(covered_sections)} sections."
   328	        return MapStepResult(
   329	            group_index=group.group_index,
   330	            summary=summary,
   331	            selected_chunk_ids=tuple(selected_ids),
   332	            covered_sections=tuple(covered_sections),
   333	        )
   334	
   335	    def _build_map_chunks_text(self, group: SectionMapGroup) -> str:
   336	        parts: list[str] = []
   337	        for ref, chunk in enumerate(group.chunks, start=1):
   338	            section = _chunk_section_title(chunk)
   339	            page_start = int(getattr(chunk, "page_start", 0) or 0)
   340	            page_end = int(getattr(chunk, "page_end", page_start) or page_start)
   341	            page = f"p.{page_start}" if page_start == page_end else f"p.{page_start}-{page_end}"
   342	            text = (getattr(chunk, "text", "") or "").strip()[:MAP_REDUCE_MAX_CHARS_PER_CHUNK]
   343	            parts.append(f"ref {ref} | {page} | section: {section}\n{text}")
   344	        return "\n\n".join(parts)
   345	
   346	    async def _llm_json_completion(
   347	        self,
   348	        *,
   349	        model: str,
   350	        messages: list[dict[str, str]],
   351	        max_tokens: int,
   352	        timeout_seconds: float,
   353	    ) -> dict[str, Any]:
   354	        from app.services.chat_service import _apply_provider_options, _get_llm_client
   355	
   356	        client = _get_llm_client(model)
   357	        kwargs: dict[str, Any] = {
   358	            "model": model,
   359	            "max_tokens": max_tokens,
   360	            "temperature": 0.1,
   361	            "messages": messages,
   362	            "stream": False,
   363	            "response_format": {"type": "json_object"},
   364	        }
   365	        _apply_provider_options(kwargs, model)
   366	        response = await asyncio.wait_for(
   367	            client.chat.completions.create(**kwargs),
   368	            timeout=timeout_seconds,
   369	        )
   370	        content = ""
   371	        if getattr(response, "choices", None):
   372	            message = getattr(response.choices[0], "message", None)
   373	            content = str(getattr(message, "content", "") or "")
   374	        return _json_from_text(content)
   375	
   376	    def _chunk_ids_from_source_refs(
   377	        self,
   378	        group: SectionMapGroup,
   379	        source_refs: Any,
   380	    ) -> list[uuid.UUID]:
   381	        refs = source_refs if isinstance(source_refs, list) else []
   382	        selected: list[uuid.UUID] = []
   383	        seen: set[uuid.UUID] = set()
   384	        for raw_ref in refs:
   385	            try:
   386	                ref = int(raw_ref)
   387	            except (TypeError, ValueError):
   388	                continue
   389	            if ref < 1 or ref > len(group.chunks):
   390	                continue
   391	            chunk_id = group.chunks[ref - 1].id
   392	            if chunk_id in seen:
   393	                continue
   394	            seen.add(chunk_id)
   395	            selected.append(chunk_id)
   396	        return selected
   397	
   398	    def _first_chunk_for_section(
   399	        self,
   400	        group: SectionMapGroup,
   401	        section_title: str,
   402	    ) -> Any | None:
   403	        for chunk in group.chunks:
   404	            if _chunk_has_noisy_section_title(chunk):
   405	                continue
   406	            if _chunk_section_title(chunk) == section_title:
   407	                return chunk
   408	        return group.chunks[0] if group.chunks else None
   409	
   410	    async def _llm_map_step(self, group: SectionMapGroup) -> MapStepResult:
   411	        prompt = (
   412	            "You are the map step in a document map-reduce summary pipeline.\n"
   413	            "Summarize this contiguous group of document sections using only the excerpts.\n"
   414	            "Return valid JSON only with this shape:\n"
   415	            '{"group_summary": string, "sections": ['
   416	            '{"title": string, "summary": string, "source_refs": [number]}'
   417	            "]}\n\n"
   418	            "Rules:\n"
   419	            "- Include every section title listed in Target sections exactly once.\n"
   420	            "- source_refs must use the local ref numbers shown in the excerpts.\n"
   421	            "- Keep each section summary concise and factual.\n\n"
   422	            f"Target sections:\n{json.dumps(list(group.section_titles), ensure_ascii=False)}\n\n"
   423	            f"Excerpts:\n{self._build_map_chunks_text(group)}"
   424	        )
   425	        data = await self._llm_json_completion(
   426	            model=self._map_model,
   427	            messages=[{"role": "user", "content": prompt}],
   428	            max_tokens=1800,
   429	            timeout_seconds=self._map_timeout_seconds,
   430	        )
   431	
   432	        raw_sections = data.get("sections") if isinstance(data.get("sections"), list) else []
   433	        raw_by_title: dict[str, dict[str, Any]] = {}
   434	        for item in raw_sections:
   435	            if not isinstance(item, dict):
   436	                continue
   437	            title = str(item.get("title") or "").strip()
   438	            if title:
   439	                raw_by_title[title.casefold()] = item
   440	
   441	        selected_ids: list[uuid.UUID] = []
   442	        seen_ids: set[uuid.UUID] = set()
   443	        lines: list[str] = []
   444	        for title in group.section_titles:
   445	            raw_item = raw_by_title.get(title.casefold(), {})
   446	            section_summary = str(raw_item.get("summary") or "").strip()
   447	            if not section_summary:
   448	                section_chunk = self._first_chunk_for_section(group, title)
   449	                section_summary = ((getattr(section_chunk, "text", "") or "").strip()[:500])
   450	            source_ids = self._chunk_ids_from_source_refs(group, raw_item.get("source_refs"))
   451	            if not source_ids:
   452	                section_chunk = self._first_chunk_for_section(group, title)
   453	                if section_chunk is not None:
   454	                    source_ids = [section_chunk.id]
   455	            for chunk_id in source_ids:
   456	                if chunk_id in seen_ids:
   457	                    continue
   458	                seen_ids.add(chunk_id)
   459	                selected_ids.append(chunk_id)
   460	            lines.append(f"- {title}: {section_summary}")
   461	
   462	        group_summary = str(data.get("group_summary") or "").strip()
   463	        summary = "\n".join(
   464	            part for part in (f"Group summary: {group_summary}" if group_summary else "", *lines) if part
   465	        )
   466	        return MapStepResult(
   467	            group_index=group.group_index,
   468	            summary=summary[:MAP_REDUCE_MAX_CONTEXT_ITEM_CHARS],
   469	            selected_chunk_ids=tuple(selected_ids),
   470	            covered_sections=group.section_titles,
   471	        )
   472	
   473	    async def _default_reduce_step(
   474	        self,
   475	        mapped: list[MapStepResult],
   476	        *,
   477	        max_total_chunks: int,
   478	    ) -> list[uuid.UUID]:
   479	        ordered: list[uuid.UUID] = []
   480	        seen: set[uuid.UUID] = set()
   481	        for item in sorted(mapped, key=lambda value: value.group_index):
   482	            for chunk_id in item.selected_chunk_ids:
   483	                if chunk_id in seen:
   484	                    continue
   485	                seen.add(chunk_id)
   486	                ordered.append(chunk_id)
   487	                if len(ordered) >= max_total_chunks:
   488	                    return ordered
   489	        return ordered[:max_total_chunks]
   490	
   491	    def _context_items_from_mapped(
   492	        self,
   493	        mapped: list[MapStepResult],
   494	        *,
   495	        overview: str = "",
   496	    ) -> tuple[MapReduceContextItem, ...]:
   497	        items: list[MapReduceContextItem] = []
   498	        for position, item in enumerate(sorted(mapped, key=lambda value: value.group_index)):
   499	            if not item.selected_chunk_ids:
   500	                continue
   501	            prefix = ""
   502	            if position == 0 and overview.strip():
   503	                prefix = f"Full-document reduce summary:\n{overview.strip()}\n\n"
   504	            text = (
   505	                f"{prefix}Section group {item.group_index + 1} map summary "
   506	                f"covering: {', '.join(item.covered_sections)}\n{item.summary}"
   507	            )
   508	            items.append(
   509	                MapReduceContextItem(
   510	                    group_index=item.group_index,
   511	                    text=text[:MAP_REDUCE_MAX_CONTEXT_ITEM_CHARS],
   512	                    anchor_chunk_id=item.selected_chunk_ids[0],
   513	                    source_chunk_ids=item.selected_chunk_ids,
   514	                    covered_sections=item.covered_sections,
   515	                )
   516	            )
   517	        return tuple(items)
   518	
   519	    def _mapped_covered_sections(self, mapped: list[MapStepResult]) -> tuple[str, ...]:
   520	        covered: list[str] = []
   521	        seen: set[str] = set()
   522	        for item in sorted(mapped, key=lambda value: value.group_index):
   523	            for section in item.covered_sections:
   524	                if section in seen:
   525	                    continue
   526	                seen.add(section)
   527	                covered.append(section)
   528	        return tuple(covered)
   529	
   530	    def _mapped_selected_chunk_ids(
   531	        self,
   532	        mapped: list[MapStepResult],
   533	        *,
   534	        max_total_chunks: int,
   535	    ) -> tuple[uuid.UUID, ...]:
   536	        selected: list[uuid.UUID] = []
   537	        seen: set[uuid.UUID] = set()
   538	        for item in sorted(mapped, key=lambda value: value.group_index):
   539	            for chunk_id in item.selected_chunk_ids:
   540	                if chunk_id in seen:

exec
/bin/zsh -lc "nl -ba backend/app/services/document_brief_service.py | sed -n '540,910p'" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
   540	                if chunk_id in seen:
   541	                    continue
   542	                seen.add(chunk_id)
   543	                selected.append(chunk_id)
   544	                if len(selected) >= max_total_chunks:
   545	                    return tuple(selected)
   546	        return tuple(selected)
   547	
   548	    async def _llm_reduce_step(
   549	        self,
   550	        mapped: list[MapStepResult],
   551	        *,
   552	        max_total_chunks: int,
   553	    ) -> MapReduceSummaryResult:
   554	        covered_sections = self._mapped_covered_sections(mapped)
   555	        mapped_payload = [
   556	            {
   557	                "group_index": item.group_index,
   558	                "covered_sections": list(item.covered_sections),
   559	                "summary": item.summary,
   560	            }
   561	            for item in sorted(mapped, key=lambda value: value.group_index)
   562	        ]
   563	        prompt = (
   564	            "You are the reduce step in a document map-reduce summary pipeline.\n"
   565	            "Merge the map summaries into a compact, structured full-document brief.\n"
   566	            "Return valid JSON only with this shape:\n"
   567	            '{"summary": string, "covered_sections": [string]}\n\n'
   568	            "Rules:\n"
   569	            "- Preserve coverage of every section title listed below; do not drop tail sections.\n"
   570	            "- Stay within a compact answer budget by grouping related details.\n"
   571	            "- Use only the map summaries.\n\n"
   572	            f"All section titles:\n{json.dumps(list(covered_sections), ensure_ascii=False)}\n\n"
   573	            f"Map summaries:\n{json.dumps(mapped_payload, ensure_ascii=False)}"
   574	        )
   575	        data = await self._llm_json_completion(
   576	            model=self._reduce_model,
   577	            messages=[{"role": "user", "content": prompt}],
   578	            max_tokens=2200,
   579	            timeout_seconds=self._reduce_timeout_seconds,
   580	        )
   581	        overview = str(data.get("summary") or "").strip()
   582	        if not overview:
   583	            overview = "\n".join(item.summary for item in sorted(mapped, key=lambda value: value.group_index))
   584	        return MapReduceSummaryResult(
   585	            summary=overview[:6000],
   586	            context_items=self._context_items_from_mapped(mapped, overview=overview),
   587	            selected_chunk_ids=self._mapped_selected_chunk_ids(
   588	                mapped,
   589	                max_total_chunks=max_total_chunks,
   590	            ),
   591	            covered_sections=covered_sections,
   592	        )
   593	
   594	    async def _run_map_step(
   595	        self,
   596	        group: SectionMapGroup,
   597	        semaphore: asyncio.Semaphore,
   598	        *,
   599	        use_llm_default: bool,
   600	        use_injected_step: bool,
   601	    ) -> MapStepResult:
   602	        async with semaphore:
   603	            if use_injected_step and self._map_step is not None:
   604	                step = self._map_step
   605	            elif use_llm_default:
   606	                step = self._llm_map_step
   607	            else:
   608	                step = self._default_map_step
   609	            return await step(group)
   610	
   611	    def _plan_groups(
   612	        self,
   613	        chunks: Sequence[Any],
   614	        *,
   615	        ensure_all_section_anchors: bool,
   616	    ) -> tuple[list[Any], list[tuple[str, list[Any]]], list[SectionMapGroup]]:
   617	        ordered_chunks = sorted(chunks, key=lambda chunk: int(getattr(chunk, "chunk_index", 0) or 0))
   618	        if not ordered_chunks:
   619	            return [], [], []
   620	
   621	        segments = _section_segments(ordered_chunks)
   622	        if not segments:
   623	            return ordered_chunks, [], []
   624	
   625	        section_total = len(segments)
   626	        desired_groups = _dynamic_section_group_count(
   627	            len(ordered_chunks),
   628	            min_groups=self._min_groups,
   629	            max_groups=self._max_groups,
   630	        )
   631	        section_bound_groups = math.ceil(section_total / max(1, self._max_group_chunks))
   632	        target_groups = min(self._max_groups, max(desired_groups, section_bound_groups))
   633	        target_groups = max(self._min_groups, min(target_groups, section_total))
   634	
   635	        groups = _group_segments(segments, target_groups=target_groups)
   636	        max_group_chunks = self._max_group_chunks
   637	        if ensure_all_section_anchors and groups:
   638	            max_group_chunks = max(max_group_chunks, max(len(group.section_titles) for group in groups))
   639	        prepared_groups = [
   640	            self._truncate_group_chunks(group, max_group_chunks=max_group_chunks)
   641	            for group in groups
   642	        ]
   643	        return ordered_chunks, segments, prepared_groups
   644	
   645	    async def _select_chunks_for_summary(
   646	        self,
   647	        chunks: Sequence[Any],
   648	        *,
   649	        max_chunks: int,
   650	        use_injected_steps: bool,
   651	    ) -> list[Any]:
   652	        ordered_chunks, segments, prepared_groups = self._plan_groups(
   653	            chunks,
   654	            ensure_all_section_anchors=False,
   655	        )
   656	        if not ordered_chunks:
   657	            return []
   658	        if not segments:
   659	            return list(ordered_chunks[:max_chunks])
   660	        if not prepared_groups:
   661	            return list(ordered_chunks[:max_chunks])
   662	
   663	        max_total_chunks = _dynamic_summary_chunk_budget(
   664	            max_chunks,
   665	            chunks_total=len(ordered_chunks),
   666	            section_total=len(segments),
   667	            max_total_chunks_cap=self._max_total_chunks_cap,
   668	        )
   669	
   670	        semaphore = asyncio.Semaphore(self._max_concurrency)
   671	        mapped = await asyncio.gather(
   672	            *(
   673	                self._run_map_step(
   674	                    group,
   675	                    semaphore,
   676	                    use_llm_default=False,
   677	                    use_injected_step=use_injected_steps,
   678	                )
   679	                for group in prepared_groups
   680	            )
   681	        )
   682	        if use_injected_steps and self._reduce_step is not None:
   683	            reduced = await self._reduce_step(mapped, max_total_chunks=max_total_chunks)
   684	            selected_ids = (
   685	                list(reduced.selected_chunk_ids)
   686	                if isinstance(reduced, MapReduceSummaryResult)
   687	                else list(reduced)
   688	            )
   689	        else:
   690	            selected_ids = await self._default_reduce_step(mapped, max_total_chunks=max_total_chunks)
   691	
   692	        if not selected_ids:
   693	            selected_ids = [
   694	                group.chunks[0].id
   695	                for group in prepared_groups
   696	                if group.chunks
   697	            ][:max_total_chunks]
   698	
   699	        chunk_by_id = {chunk.id: chunk for chunk in ordered_chunks}
   700	        selected: list[Any] = []
   701	        seen: set[uuid.UUID] = set()
   702	        for chunk_id in selected_ids:
   703	            chunk = chunk_by_id.get(chunk_id)
   704	            if chunk is None or chunk.id in seen:
   705	                continue
   706	            seen.add(chunk.id)
   707	            selected.append(chunk)
   708	
   709	        return selected
   710	
   711	    async def select_chunks_for_summary(
   712	        self,
   713	        chunks: Sequence[Any],
   714	        *,
   715	        max_chunks: int,
   716	    ) -> list[Any]:
   717	        return await self._select_chunks_for_summary(
   718	            chunks,
   719	            max_chunks=max_chunks,
   720	            use_injected_steps=True,
   721	        )
   722	
   723	    def _fallback_summary_result(self, selected: Sequence[Any]) -> MapReduceSummaryResult:
   724	        context_items = tuple(
   725	            MapReduceContextItem(
   726	                group_index=idx,
   727	                text=(getattr(chunk, "text", "") or "").strip()[:1400],
   728	                anchor_chunk_id=chunk.id,
   729	                source_chunk_ids=(chunk.id,),
   730	                covered_sections=(_chunk_section_title(chunk),),
   731	            )
   732	            for idx, chunk in enumerate(selected)
   733	        )
   734	        return MapReduceSummaryResult(
   735	            summary="Fallback representative chunk selection.",
   736	            context_items=context_items,
   737	            selected_chunk_ids=tuple(chunk.id for chunk in selected),
   738	            covered_sections=tuple(_chunk_section_title(chunk) for chunk in selected),
   739	            strategy="chunk_selection_fallback",
   740	        )
   741	
   742	    def _normalize_summary_result(
   743	        self,
   744	        reduced: list[uuid.UUID] | MapReduceSummaryResult,
   745	        mapped: list[MapStepResult],
   746	        *,
   747	        chunk_by_id: dict[uuid.UUID, Any],
   748	        max_total_chunks: int,
   749	    ) -> MapReduceSummaryResult:
   750	        mapped_covered = self._mapped_covered_sections(mapped)
   751	        if isinstance(reduced, MapReduceSummaryResult):
   752	            summary = reduced.summary
   753	            raw_selected = list(reduced.selected_chunk_ids)
   754	            raw_items = list(reduced.context_items)
   755	            raw_covered = tuple(reduced.covered_sections) or mapped_covered
   756	            strategy = reduced.strategy or "map_reduce"
   757	        else:
   758	            summary = "\n".join(item.summary for item in sorted(mapped, key=lambda value: value.group_index))
   759	            raw_selected = list(reduced)
   760	            raw_items = list(self._context_items_from_mapped(mapped))
   761	            raw_covered = mapped_covered
   762	            strategy = "map_reduce"
   763	
   764	        selected: list[uuid.UUID] = []
   765	        seen_selected: set[uuid.UUID] = set()
   766	        for chunk_id in raw_selected:
   767	            if chunk_id not in chunk_by_id or chunk_id in seen_selected:
   768	                continue
   769	            seen_selected.add(chunk_id)
   770	            selected.append(chunk_id)
   771	            if len(selected) >= max_total_chunks:
   772	                break
   773	        if not selected:
   774	            selected = list(
   775	                self._mapped_selected_chunk_ids(
   776	                    mapped,
   777	                    max_total_chunks=max_total_chunks,
   778	                )
   779	            )
   780	
   781	        context_items: list[MapReduceContextItem] = []
   782	        for item in raw_items:
   783	            source_ids = tuple(
   784	                chunk_id
   785	                for chunk_id in item.source_chunk_ids
   786	                if chunk_id in chunk_by_id
   787	            )
   788	            if item.anchor_chunk_id in chunk_by_id:
   789	                anchor_id = item.anchor_chunk_id
   790	            elif source_ids:
   791	                anchor_id = source_ids[0]
   792	            else:
   793	                continue
   794	            text = (item.text or "").strip()
   795	            if not text:
   796	                continue
   797	            context_items.append(
   798	                MapReduceContextItem(
   799	                    group_index=item.group_index,
   800	                    text=text[:MAP_REDUCE_MAX_CONTEXT_ITEM_CHARS],
   801	                    anchor_chunk_id=anchor_id,
   802	                    source_chunk_ids=source_ids or (anchor_id,),
   803	                    covered_sections=item.covered_sections,
   804	                )
   805	            )
   806	
   807	        if not context_items:
   808	            context_items = list(self._context_items_from_mapped(mapped, overview=summary))
   809	
   810	        covered: list[str] = []
   811	        seen_sections: set[str] = set()
   812	        for section in (*raw_covered, *mapped_covered):
   813	            if not section or section in seen_sections:
   814	                continue
   815	            seen_sections.add(section)
   816	            covered.append(section)
   817	
   818	        return MapReduceSummaryResult(
   819	            summary=summary[:6000],
   820	            context_items=tuple(context_items[: self._max_groups]),
   821	            selected_chunk_ids=tuple(selected[:max_total_chunks]),
   822	            covered_sections=tuple(covered),
   823	            strategy=strategy,
   824	        )
   825	
   826	    async def build_summary_context(
   827	        self,
   828	        chunks: Sequence[Any],
   829	        *,
   830	        max_chunks: int,
   831	    ) -> MapReduceSummaryResult:
   832	        ordered_chunks, segments, prepared_groups = self._plan_groups(
   833	            chunks,
   834	            ensure_all_section_anchors=True,
   835	        )
   836	        if not ordered_chunks:
   837	            return MapReduceSummaryResult(
   838	                summary="",
   839	                context_items=(),
   840	                selected_chunk_ids=(),
   841	                covered_sections=(),
   842	                strategy="empty",
   843	            )
   844	        if not segments or not prepared_groups:
   845	            selected = await self._select_chunks_for_summary(
   846	                ordered_chunks,
   847	                max_chunks=max_chunks,
   848	                use_injected_steps=False,
   849	            )
   850	            return self._fallback_summary_result(selected)
   851	
   852	        max_total_chunks = _dynamic_summary_chunk_budget(
   853	            max_chunks,
   854	            chunks_total=len(ordered_chunks),
   855	            section_total=len(segments),
   856	            max_total_chunks_cap=self._max_total_chunks_cap,
   857	        )
   858	
   859	        semaphore = asyncio.Semaphore(self._max_concurrency)
   860	        try:
   861	            mapped = await asyncio.gather(
   862	                *(
   863	                    self._run_map_step(
   864	                        group,
   865	                        semaphore,
   866	                        use_llm_default=True,
   867	                        use_injected_step=True,
   868	                    )
   869	                    for group in prepared_groups
   870	                )
   871	            )
   872	            if self._reduce_step is not None:
   873	                reduced = await self._reduce_step(mapped, max_total_chunks=max_total_chunks)
   874	            else:
   875	                reduced = await self._llm_reduce_step(mapped, max_total_chunks=max_total_chunks)
   876	        except Exception:
   877	            logger.exception("Section map-reduce failed; falling back to representative chunks")
   878	            selected = await self._select_chunks_for_summary(
   879	                ordered_chunks,
   880	                max_chunks=max_chunks,
   881	                use_injected_steps=False,
   882	            )
   883	            return self._fallback_summary_result(selected)
   884	
   885	        chunk_by_id = {chunk.id: chunk for chunk in ordered_chunks}
   886	        return self._normalize_summary_result(
   887	            reduced,
   888	            mapped,
   889	            chunk_by_id=chunk_by_id,
   890	            max_total_chunks=max_total_chunks,
   891	        )
   892	
   893	
   894	def _select_representative_chunks(
   895	    chunks: Sequence[Any],
   896	    *,
   897	    max_chunks: int = DEFAULT_MAX_SUMMARY_CHUNKS,
   898	) -> list[Any]:
   899	    """Select ordered chunks for broad document coverage.
   900	
   901	    This deliberately does not use query similarity. Whole-document summaries
   902	    need beginning/middle/end coverage and section diversity, while semantic
   903	    top-k often over-selects tables, appendices, or repeated sidebars for vague
   904	    prompts like "summarize this document".
   905	    """
   906	    usable = [
   907	        ch for ch in chunks
   908	        if _chunk_text_length(ch) >= MIN_SUMMARY_CHUNK_CHARS
   909	    ]
   910	    if not usable:

exec
/bin/zsh -lc "nl -ba backend/app/services/document_brief_service.py | sed -n '978,1125p'" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
   978	def _map_reduce_context_to_retrieval_items(
   979	    result: MapReduceSummaryResult,
   980	    chunks: Sequence[Chunk],
   981	) -> list[dict[str, Any]]:
   982	    chunk_by_id = {chunk.id: chunk for chunk in chunks}
   983	    items: list[dict[str, Any]] = []
   984	    total = max(1, len(result.context_items))
   985	    for idx, context_item in enumerate(result.context_items):
   986	        anchor = chunk_by_id.get(context_item.anchor_chunk_id)
   987	        if anchor is None:
   988	            continue
   989	        retrieval_item = _chunk_to_retrieval_item(
   990	            anchor,
   991	            1.0 - (idx / (total + 1)) * 0.2,
   992	        )
   993	        retrieval_item["text"] = context_item.text
   994	        retrieval_item["section_title"] = "Map-reduce section summary"
   995	        retrieval_item["retrieval_modality"] = "summary"
   996	        retrieval_item["map_reduce_strategy"] = result.strategy
   997	        retrieval_item["map_reduce_source_chunk_ids"] = [
   998	            str(chunk_id) for chunk_id in context_item.source_chunk_ids
   999	        ]
  1000	        retrieval_item["map_reduce_covered_sections"] = list(context_item.covered_sections)
  1001	        items.append(retrieval_item)
  1002	    return items
  1003	
  1004	
  1005	class DocumentBriefService:
  1006	    def __init__(
  1007	        self,
  1008	        *,
  1009	        section_map_reduce: SectionMapReducePlanner | None = None,
  1010	        map_reduce_min_chunks: int = DEFAULT_MAP_REDUCE_MIN_CHUNKS,
  1011	    ) -> None:
  1012	        self._section_map_reduce = section_map_reduce or SectionMapReducePlanner()
  1013	        self._map_reduce_min_chunks = max(1, int(map_reduce_min_chunks))
  1014	
  1015	    def _should_use_map_reduce(
  1016	        self,
  1017	        chunks: Sequence[Any],
  1018	        *,
  1019	        max_chunks: int,
  1020	        element_chunks_count: int,
  1021	        section_total: int = 0,
  1022	    ) -> bool:
  1023	        if max_chunks < DEFAULT_MAX_SUMMARY_CHUNKS:
  1024	            # Collection summary allocates a narrow per-document budget.
  1025	            return False
  1026	        chunks_total = len(chunks)
  1027	        scale_units = max(chunks_total, max(0, int(section_total or 0)))
  1028	        if scale_units < self._map_reduce_min_chunks:
  1029	            return False
  1030	        if chunks_total <= max_chunks and section_total <= max_chunks:
  1031	            return False
  1032	        if section_total > max_chunks:
  1033	            return True
  1034	        if element_chunks_count >= max_chunks:
  1035	            return True
  1036	        # No reliable element coverage: still promote large docs to section map-reduce.
  1037	        return scale_units >= max(max_chunks * 2, self._map_reduce_min_chunks)
  1038	
  1039	    async def get_summary_context(
  1040	        self,
  1041	        db: AsyncSession,
  1042	        document_id: uuid.UUID,
  1043	        *,
  1044	        max_chunks: int = DEFAULT_MAX_SUMMARY_CHUNKS,
  1045	    ) -> list[dict[str, Any]]:
  1046	        persisted = await self._get_persisted_summary_context(
  1047	            db,
  1048	            document_id,
  1049	            max_chunks=max_chunks,
  1050	        )
  1051	        if persisted and max_chunks < DEFAULT_MAX_SUMMARY_CHUNKS:
  1052	            # Collection / narrow-budget paths should keep using persisted brief context.
  1053	            return persisted
  1054	
  1055	        element_result = await get_element_aware_chunks_async(
  1056	            db,
  1057	            document_id,
  1058	            max_chunks=max_chunks,
  1059	            return_prefetched_chunks=True,
  1060	        )
  1061	        element_chunks: list[tuple[Chunk, float]]
  1062	        prefetched_chunks: list[Chunk]
  1063	        if (
  1064	            isinstance(element_result, tuple)
  1065	            and len(element_result) == 2
  1066	            and isinstance(element_result[0], list)
  1067	            and isinstance(element_result[1], list)
  1068	        ):
  1069	            element_chunks = element_result[0]
  1070	            prefetched_chunks = element_result[1]
  1071	        else:
  1072	            element_chunks = list(element_result or [])
  1073	            prefetched_chunks = []
  1074	        if prefetched_chunks:
  1075	            chunks = prefetched_chunks
  1076	        else:
  1077	            rows = await db.execute(
  1078	                select(Chunk)
  1079	                .where(Chunk.document_id == document_id)
  1080	                .order_by(Chunk.chunk_index)
  1081	            )
  1082	            chunks = list(rows.scalars())
  1083	
  1084	        section_total = len(_section_segments(chunks))
  1085	        if self._should_use_map_reduce(
  1086	            chunks,
  1087	            max_chunks=max_chunks,
  1088	            element_chunks_count=len(element_chunks),
  1089	            section_total=section_total,
  1090	        ):
  1091	            map_reduce_result = await self._section_map_reduce.build_summary_context(
  1092	                chunks,
  1093	                max_chunks=max_chunks,
  1094	            )
  1095	            if (
  1096	                map_reduce_result.strategy == "map_reduce"
  1097	                and map_reduce_result.context_items
  1098	            ):
  1099	                map_reduce_items = _map_reduce_context_to_retrieval_items(
  1100	                    map_reduce_result,
  1101	                    chunks,
  1102	                )
  1103	                if map_reduce_items:
  1104	                    return map_reduce_items
  1105	
  1106	            chunk_by_id = {chunk.id: chunk for chunk in chunks}
  1107	            selected_map_reduce = [
  1108	                chunk_by_id[chunk_id]
  1109	                for chunk_id in map_reduce_result.selected_chunk_ids
  1110	                if chunk_id in chunk_by_id
  1111	            ]
  1112	            if selected_map_reduce:
  1113	                total = max(1, len(selected_map_reduce))
  1114	                return [
  1115	                    _chunk_to_retrieval_item(
  1116	                        chunk,
  1117	                        1.0 - (idx / (total + 1)) * 0.2,
  1118	                    )
  1119	                    for idx, chunk in enumerate(selected_map_reduce)
  1120	                ]
  1121	
  1122	        if persisted:
  1123	            return persisted
  1124	
  1125	        if element_chunks:

exec
/bin/zsh -lc "nl -ba backend/app/services/chat_service.py | sed -n '760,830p'" in /Users/mayijie/Projects/Code/010_DocTalk
exec
/bin/zsh -lc "nl -ba backend/app/services/chat_service.py | sed -n '1068,1260p'" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
   760	        page_start=int(citation.get("page") or chunk.page_start) if is_table else chunk.page_start,
   761	        page_end=int(citation.get("page_end") or citation.get("page") or chunk.page_end) if is_table else chunk.page_end,
   762	        bboxes=citation.get("bboxes") or [] if is_table else chunk.bboxes or [],
   763	        text=table_context if is_table else chunk.text,
   764	        section_title=(table_context.splitlines()[0][:200] if is_table else chunk.section_title or ""),
   765	        document_id=chunk.document_id,
   766	        document_filename=collection_doc_names.get(chunk.document_id, ""),
   767	        score=float(citation.get("confidence_score") or 0.0),
   768	        table_id=table_id,
   769	        retrieval_modality="table" if is_table else "text",
   770	    )
   771	
   772	
   773	class RefParserFSM:
   774	    """解析 LLM 流式输出中的 [n] 引用标记
   775	
   776	    - state: TEXT | MAYBE_REF
   777	    - buffer 上限 8 字符，超限回退
   778	    - char_offset: 已输出字符计数
   779	    """
   780	
   781	    def __init__(self, chunk_map: dict[int, _ChunkInfo]):
   782	        self.chunk_map = chunk_map
   783	        self.buffer: str = ""
   784	        self.char_offset: int = 0
   785	        self.state: str = "TEXT"  # TEXT | MAYBE_REF
   786	
   787	    def feed(self, token: str) -> List[Dict[str, Any]]:
   788	        events: List[Dict[str, Any]] = []
   789	        for ch in token:
   790	            if self.state == "TEXT":
   791	                if ch == "[":
   792	                    self.state = "MAYBE_REF"
   793	                    self.buffer = "["
   794	                else:
   795	                    events.append(sse("token", {"text": ch}))
   796	                    self.char_offset += 1
   797	
   798	            elif self.state == "MAYBE_REF":
   799	                self.buffer += ch
   800	                if ch == "]":
   801	                    inner = self.buffer[1:-1]
   802	                    if inner.isdigit() and (int(inner) in self.chunk_map):
   803	                        ref_num = int(inner)
   804	                        chunk = self.chunk_map[ref_num]
   805	                        events.append(sse("citation", _citation_payload(ref_num, chunk, self.char_offset)))
   806	                    else:
   807	                        # 非有效引用，回退为普通文本
   808	                        events.append(sse("token", {"text": self.buffer}))
   809	                        self.char_offset += len(self.buffer)
   810	                    self.buffer = ""
   811	                    self.state = "TEXT"
   812	                elif len(self.buffer) > 8:
   813	                    # 超限回退
   814	                    events.append(sse("token", {"text": self.buffer}))
   815	                    self.char_offset += len(self.buffer)
   816	                    self.buffer = ""
   817	                    self.state = "TEXT"
   818	        return events
   819	
   820	    def flush(self) -> List[Dict[str, Any]]:
   821	        events: List[Dict[str, Any]] = []
   822	        if self.buffer:
   823	            events.append(sse("token", {"text": self.buffer}))
   824	            self.buffer = ""
   825	        return events
   826	
   827	
   828	# ---------------------------
   829	# Chat Service
   830	# ---------------------------

 succeeded in 0ms:
  1068	            )
  1069	            history_msgs: List[Message] = list(msgs_row.scalars().all())
  1070	            history_msgs.reverse()  # back to chronological order
  1071	
  1072	            # Convert to Claude message format (excluding system)
  1073	            claude_messages: List[dict] = []
  1074	            for m in history_msgs:
  1075	                claude_messages.append({"role": m.role, "content": m.content})
  1076	
  1077	            # 4) Route + retrieval (with error handling — e.g. Qdrant down or no vectors yet).
  1078	            # Whole-document summaries must not use ordinary semantic top-k: vague
  1079	            # summary prompts frequently retrieve tables/appendices instead of
  1080	            # representative document structure. Route them to an ordered context
  1081	            # selector until the durable hierarchical brief index lands.
  1082	            setup_error_code = "RETRIEVAL_ERROR"
  1083	            retrieval_strategy = "semantic_top_k"
  1084	            retrieval_evaluation = None
  1085	            retrieval_plan: QueryPlan | None = None
  1086	            if (
  1087	                query_route.primary_intent == QueryIntent.DOCUMENT_SUMMARY
  1088	                and document_id
  1089	                and not is_collection_session
  1090	            ):
  1091	                yield sse("tool_status", {"message": "Summarizing the document section by section…"})
  1092	                retrieved = await document_brief_service.get_summary_context(
  1093	                    db,
  1094	                    document_id,
  1095	                    max_chunks=18,
  1096	                )
  1097	                retrieval_strategy = "document_summary_context"
  1098	            elif (
  1099	                query_route.primary_intent == QueryIntent.DOCUMENT_SUMMARY
  1100	                and is_collection_session
  1101	                and collection_doc_ids
  1102	            ):
  1103	                retrieved = await document_brief_service.get_collection_summary_context(
  1104	                    db,
  1105	                    collection_doc_ids,
  1106	                    max_chunks=24,
  1107	                    max_docs=8,
  1108	                )
  1109	                retrieval_strategy = "collection_summary_context"
  1110	            elif is_collection_session and collection_doc_ids:
  1111	                corrective = await corrective_retrieval_service.retrieve_multi(
  1112	                    user_message,
  1113	                    query_route,
  1114	                    collection_doc_ids,
  1115	                    top_k=8,
  1116	                    db=db,
  1117	                )
  1118	                retrieved = corrective.retrieved
  1119	                retrieval_strategy = corrective.strategy
  1120	                retrieval_evaluation = corrective.evaluation
  1121	                retrieval_plan = corrective.plan
  1122	            elif (
  1123	                document_id
  1124	                and query_route.primary_intent == QueryIntent.PAGE_LOOKUP
  1125	                and query_route.page_ref is not None
  1126	            ):
  1127	                retrieved = await _fetch_page_chunks(db, document_id, query_route.page_ref)
  1128	                retrieval_strategy = "page_lookup"
  1129	                if not retrieved:
  1130	                    # Page out of range / no chunks there → fall back to semantic.
  1131	                    corrective = await corrective_retrieval_service.retrieve_single(
  1132	                        user_message, query_route, document_id, top_k=8, db=db,
  1133	                        doc_pages=getattr(doc, "page_count", None),
  1134	                    )
  1135	                    retrieved = corrective.retrieved
  1136	                    retrieval_strategy = corrective.strategy
  1137	                    retrieval_evaluation = corrective.evaluation
  1138	                    retrieval_plan = corrective.plan
  1139	            elif document_id:
  1140	                corrective = await corrective_retrieval_service.retrieve_single(
  1141	                    user_message,
  1142	                    query_route,
  1143	                    document_id,
  1144	                    top_k=8,
  1145	                    db=db,
  1146	                    doc_pages=getattr(doc, "page_count", None),
  1147	                )
  1148	                retrieved = corrective.retrieved
  1149	                retrieval_strategy = corrective.strategy
  1150	                retrieval_evaluation = corrective.evaluation
  1151	                retrieval_plan = corrective.plan
  1152	            else:
  1153	                retrieved = []
  1154	
  1155	            # 5) Build prompt (system)
  1156	            setup_error_code = "CHAT_SETUP_ERROR"
  1157	            numbered_chunks: List[str] = []
  1158	            chunk_map: dict[int, _ChunkInfo] = {}
  1159	            has_map_reduce_summary_context = any(
  1160	                item.get("retrieval_modality") == "summary"
  1161	                or item.get("map_reduce_strategy") == "map_reduce"
  1162	                for item in retrieved
  1163	            )
  1164	            for idx, item in enumerate(retrieved, start=1):
  1165	                # Heuristic truncation to ~350 tokens (roughly 1200-1400 chars)
  1166	                text = item["text"] or ""
  1167	                truncated = text[:1400]
  1168	                chunk_doc_id = item.get("document_id")
  1169	                doc_label = ""
  1170	                if is_collection_session and chunk_doc_id:
  1171	                    fname = collection_doc_names.get(chunk_doc_id, "")
  1172	                    if fname:
  1173	                        doc_label = f"(from: {fname}) "
  1174	                plan_label = _safe_plan_label(item.get("retrieval_plan_step"))
  1175	                evidence_label = f"(evidence: {plan_label}) " if plan_label else ""
  1176	                numbered_chunks.append(f"[{idx}] {doc_label}{evidence_label}{truncated}")
  1177	                chunk_map[idx] = _ChunkInfo(
  1178	                    id=item["chunk_id"],
  1179	                    page_start=int(item["page"]),
  1180	                    page_end=int(item.get("page_end", item["page"])),
  1181	                    bboxes=item.get("bboxes") or [],
  1182	                    text=text,
  1183	                    section_title=item.get("section_title") or "",
  1184	                    document_id=chunk_doc_id if chunk_doc_id else document_id,
  1185	                    document_filename=collection_doc_names.get(chunk_doc_id, "")
  1186	                    if chunk_doc_id
  1187	                    else "",
  1188	                    score=item.get("score", 0.0),
  1189	                    table_id=str(item.get("table_id")) if item.get("table_id") else None,
  1190	                    retrieval_modality=str(item.get("retrieval_modality") or "text"),
  1191	                )
  1192	
  1193	            rules = get_rules_for_model(
  1194	                effective_model, is_collection=is_collection_session
  1195	            )
  1196	
  1197	            if is_collection_session and retrieval_strategy == "collection_summary_context":
  1198	                doc_list = ", ".join(collection_doc_names.values()) if collection_doc_names else "(no documents)"
  1199	                system_prompt = (
  1200	                    "You are a document analysis assistant. The user is asking for a broad summary across a document collection.\n\n"
  1201	                    + SYSTEM_PROMPT_META_RULE
  1202	                    + f"## Available Documents\n{doc_list}\n\n"
  1203	                    + "## Collection Coverage Excerpts\n"
  1204	                    + ("\n".join(numbered_chunks) if numbered_chunks else "(none)")
  1205	                    + "\n\n## Summary Rules\n"
  1206	                    + "1. Treat these excerpts as representative coverage selected across the collection, not as semantic search results for a narrow question.\n"
  1207	                    + "2. Do NOT say the collection is just unrelated excerpts merely because the context is excerpted.\n"
  1208	                    + "3. Summarize shared themes, document-specific points, and important caveats when supported.\n"
  1209	                    + "4. If coverage is incomplete, say the answer is based on the cited representative sections instead of refusing.\n"
  1210	                    + "5. Cite every factual paragraph or bullet using the excerpt numbers listed above.\n"
  1211	                    + "6. Your response language MUST match the language of the user's question.\n"
  1212	                    + _citation_contract()
  1213	                )
  1214	            elif is_collection_session:
  1215	                doc_list = ", ".join(collection_doc_names.values()) if collection_doc_names else "(no documents)"
  1216	                system_prompt = (
  1217	                    "You are a document analysis assistant. Answer the user's question based on excerpts from multiple documents.\n\n"
  1218	                    + SYSTEM_PROMPT_META_RULE
  1219	                    + f"## Available Documents\n{doc_list}\n\n"
  1220	                    + "## Document Excerpts\n"
  1221	                    + ("\n".join(numbered_chunks) if numbered_chunks else "(none)")
  1222	                    + _retrieval_quality_contract(retrieval_evaluation, retrieval_strategy)
  1223	                    + _query_plan_contract(retrieval_plan)
  1224	                    + "\n\n## Rules\n" + rules
  1225	                    + _citation_contract()
  1226	                )
  1227	            elif retrieval_strategy == "document_summary_context":
  1228	                map_reduce_rule = (
  1229	                    "7. The excerpts may be map-reduce section summaries generated from source chunks; "
  1230	                    "when they are present, treat their listed section coverage as the full-document structure and cover all listed sections.\n"
  1231	                    if has_map_reduce_summary_context
  1232	                    else ""
  1233	                )
  1234	                system_prompt = (
  1235	                    "You are a document analysis assistant. The user is asking for a broad, whole-document summary.\n\n"
  1236	                    + SYSTEM_PROMPT_META_RULE
  1237	                    + "## Document Coverage Excerpts\n"
  1238	                    + (
  1239	                        "\n".join(numbered_chunks)
  1240	                        if numbered_chunks
  1241	                        else "(none)"
  1242	                    )
  1243	                    + "\n\n## Summary Rules\n"
  1244	                    + "1. Treat these excerpts as representative coverage selected across the document, not as semantic search results for a narrow question.\n"
  1245	                    + "2. Do NOT say the user's ready document is not a complete document merely because the context is excerpted.\n"
  1246	                    + "3. Produce a useful document-level summary with clear headings, key points, and important caveats when supported.\n"
  1247	                    + "4. If coverage is incomplete, say the answer is based on the cited representative sections instead of refusing.\n"
  1248	                    + "5. Cite every factual paragraph or bullet using the excerpt numbers listed above.\n"
  1249	                    + "6. Your response language MUST match the language of the user's question.\n"
  1250	                    + map_reduce_rule
  1251	                    + _citation_contract()
  1252	                )
  1253	            else:
  1254	                system_prompt = (
  1255	                    "You are a document analysis assistant. Answer the user's question based on the following document excerpts.\n\n"
  1256	                    + SYSTEM_PROMPT_META_RULE
  1257	                    + "## Document Excerpts\n"
  1258	                    + ("\n".join(numbered_chunks) if numbered_chunks else "(none)")
  1259	                    + _retrieval_quality_contract(retrieval_evaluation, retrieval_strategy)
  1260	                    + _query_plan_contract(retrieval_plan)

exec
/bin/zsh -lc "nl -ba backend/app/services/chat_service.py | sed -n '260,360p'" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
   260	    return features
   261	
   262	
   263	def _citation_anchor_offsets(text: str, *, limit: int = 8) -> list[tuple[int, str]]:
   264	    anchors: list[tuple[int, str]] = []
   265	    cursor = 0
   266	    for raw_line in text.splitlines(keepends=True):
   267	        line = raw_line.strip()
   268	        cursor += len(raw_line)
   269	        if not line:
   270	            continue
   271	        if len(line) < 24 and not re.match(r"^(\d+\.|[-*•])\s+", line):
   272	            continue
   273	        anchors.append((max(0, cursor - len(raw_line) + len(raw_line.rstrip("\n\r"))), line))
   274	        if len(anchors) >= limit:
   275	            return anchors
   276	
   277	    if anchors:
   278	        return anchors
   279	
   280	    stripped = text.strip()
   281	    return [(len(text), stripped)] if stripped else []
   282	
   283	
   284	def _fallback_citations(
   285	    assistant_text: str,
   286	    chunk_map: dict[int, "_ChunkInfo"],
   287	    *,
   288	    limit: int = 8,
   289	    base_offset: int = 0,
   290	) -> List[Dict[str, Any]]:
   291	    """Create deterministic citations when the model forgets bracket refs.
   292	
   293	    The primary path is still model-authored [n] markers. This fallback prevents
   294	    a cited-answer product from returning an uncited response when retrieval
   295	    succeeded but the model omitted markers.
   296	    """
   297	    if not assistant_text.strip() or not chunk_map:
   298	        return []
   299	
   300	    chunk_features = {
   301	        ref_num: _text_features(chunk.text or "")
   302	        for ref_num, chunk in chunk_map.items()
   303	    }
   304	    fallback: List[Dict[str, Any]] = []
   305	    used_offsets: set[int] = set()
   306	
   307	    for offset, anchor_text in _citation_anchor_offsets(assistant_text, limit=limit):
   308	        anchor_features = _text_features(anchor_text)
   309	        best_ref = None
   310	        best_score = 0
   311	        for ref_num, features in chunk_features.items():
   312	            score = len(anchor_features & features)
   313	            if score > best_score:
   314	                best_ref = ref_num
   315	                best_score = score
   316	        if best_ref is None:
   317	            best_ref = min(chunk_map.keys())
   318	
   319	        if offset in used_offsets:
   320	            continue
   321	        used_offsets.add(offset)
   322	        fallback.append(_citation_payload(best_ref, chunk_map[best_ref], base_offset + offset))
   323	
   324	    return fallback
   325	
   326	
   327	def _parse_cited_answer(
   328	    answer_text: str,
   329	    chunk_map: dict[int, "_ChunkInfo"],
   330	) -> tuple[str, List[dict]]:
   331	    fsm = RefParserFSM(chunk_map)
   332	    text_parts: List[str] = []
   333	    citations: List[dict] = []
   334	    for ev in [*fsm.feed(answer_text or ""), *fsm.flush()]:
   335	        if ev["event"] == "token":
   336	            text_parts.append(ev["data"]["text"])
   337	        elif ev["event"] == "citation":
   338	            citations.append(ev["data"])
   339	
   340	    clean_text = "".join(text_parts)
   341	    if not citations:
   342	        citations = _fallback_citations(clean_text, chunk_map)
   343	    return clean_text, citations
   344	
   345	
   346	def _verification_issue_total(verification: dict) -> int:
   347	    total = 0
   348	    for key in (
   349	        "uncited_claim_count",
   350	        "invalid_citation_count",
   351	        "low_overlap_citation_count",
   352	        "numeric_mismatch_citation_count",
   353	    ):
   354	        try:
   355	            total += int(verification.get(key) or 0)
   356	        except (TypeError, ValueError):
   357	            continue
   358	    return total
   359	
   360	

exec
/bin/zsh -lc "find . -maxdepth 3 -name 'pytest.ini' -o -name 'pyproject.toml' -o -name 'setup.cfg' | sort" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
./backend/pytest.ini

exec
/bin/zsh -lc 'rg -n "def _citation_payload|class _ChunkInfo|bboxes|citation" backend/app/services/chat_service.py | head -n 80' in /Users/mayijie/Projects/Code/010_DocTalk
exec
/bin/zsh -lc "nl -ba backend/app/services/chat_service.py | sed -n '700,765p'" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
   700	            "route": getattr(getattr(query_route, "primary_intent", None), "value", None),
   701	        }
   702	        if repair_metadata:
   703	            metadata_json.update(repair_metadata)
   704	        db.add(
   705	            ProductEvent(
   706	                user_id=user.id if user else None,
   707	                event_name="rag_verification_completed",
   708	                source="chat",
   709	                reason=str(verification.get("status") or "unknown")[:64],
   710	                plan=(user.plan if user else None),
   711	                metadata_json=metadata_json,
   712	            )
   713	        )
   714	        await db.commit()
   715	    except Exception:
   716	        await db.rollback()
   717	        logger.warning("Failed to record RAG verification event", exc_info=True)
   718	
   719	
   720	# ---------------------------
   721	# RefParserFSM
   722	# ---------------------------
   723	
   724	@dataclass
   725	class _ChunkInfo:
   726	    id: uuid.UUID
   727	    page_start: int
   728	    page_end: int
   729	    bboxes: list
   730	    text: str
   731	    section_title: str = ""
   732	    document_id: Optional[uuid.UUID] = None
   733	    document_filename: str = ""
   734	    score: float = 0.0
   735	    table_id: Optional[str] = None
   736	    retrieval_modality: str = "text"
   737	
   738	
   739	@dataclass
   740	class _CitationRepairResult:
   741	    text: str
   742	    citations: List[dict]
   743	    verification: dict
   744	    metadata: dict[str, Any]
   745	    prompt_tokens: int = 0
   746	    output_tokens: int = 0
   747	    applied: bool = False
   748	
   749	
   750	def _chunk_info_from_persisted_citation(
   751	    chunk: Chunk,
   752	    citation: dict,
   753	    collection_doc_names: dict[uuid.UUID, str],
   754	) -> _ChunkInfo:
   755	    table_id = str(citation.get("table_id") or "") or None
   756	    table_context = citation.get("table_context")
   757	    is_table = table_id is not None and isinstance(table_context, str) and table_context.strip()
   758	    return _ChunkInfo(
   759	        id=chunk.id,
   760	        page_start=int(citation.get("page") or chunk.page_start) if is_table else chunk.page_start,
   761	        page_end=int(citation.get("page_end") or citation.get("page") or chunk.page_end) if is_table else chunk.page_end,
   762	        bboxes=citation.get("bboxes") or [] if is_table else chunk.bboxes or [],
   763	        text=table_context if is_table else chunk.text,
   764	        section_title=(table_context.splitlines()[0][:200] if is_table else chunk.section_title or ""),
   765	        document_id=chunk.document_id,

 succeeded in 0ms:
198:def _citation_payload(ref_num: int, chunk: "_ChunkInfo", offset: int) -> Dict[str, Any]:
201:        for bb in (chunk.bboxes or [])
227:    citation_data: Dict[str, Any] = {
232:        "bboxes": all_bbs,
236:    citation_data["confidence_score"] = round(chunk.score, 3)
237:    citation_data["context_text"] = (chunk.text or "")[:900]
239:        citation_data["document_id"] = str(chunk.document_id)
241:        citation_data["document_filename"] = chunk.document_filename
243:        citation_data["table_id"] = chunk.table_id
244:        citation_data["retrieval_modality"] = chunk.retrieval_modality or "table"
245:        citation_data["table_context"] = (chunk.text or "")[:1400]
246:    return citation_data
263:def _citation_anchor_offsets(text: str, *, limit: int = 8) -> list[tuple[int, str]]:
284:def _fallback_citations(
291:    """Create deterministic citations when the model forgets bracket refs.
307:    for offset, anchor_text in _citation_anchor_offsets(assistant_text, limit=limit):
322:        fallback.append(_citation_payload(best_ref, chunk_map[best_ref], base_offset + offset))
333:    citations: List[dict] = []
337:        elif ev["event"] == "citation":
338:            citations.append(ev["data"])
341:    if not citations:
342:        citations = _fallback_citations(clean_text, chunk_map)
343:    return clean_text, citations
350:        "invalid_citation_count",
351:        "low_overlap_citation_count",
352:        "numeric_mismatch_citation_count",
380:    citations: List[dict],
402:        "Every factual sentence, paragraph, or bullet must end with one or more bracket citations like [1].\n"
405:        f"Write in {language}. Return only the corrected final answer, with citations."
439:        repaired_text, repaired_citations = _parse_cited_answer(repaired_raw, chunk_map)
442:            repaired_citations,
457:            citations=repaired_citations if applied else citations,
465:        logger.warning("Failed to repair RAG answer citations", exc_info=True)
469:            citations=citations,
478:def _citation_contract() -> str:
481:        "- Every answer based on document excerpts MUST include clickable bracket citations like [1].\n"
482:        "- Put a citation at the end of every factual paragraph or bullet that uses document content.\n"
483:        "- Prefer short factual bullets over dense paragraphs; one bullet should contain one main claim and its citation.\n"
485:        "- A response with no [n] citations is invalid unless there are no relevant excerpts.\n"
522:        "- If one side has evidence and another side does not, state that asymmetry with citations instead of filling the gap.\n"
572:    citations: Optional[List[dict]] = None,
585:            citations=citations or None,
598:    new_citations: List[dict],
609:        merged_citations = list(asst_msg.citations or []) + list(new_citations or [])
611:        asst_msg.citations = merged_citations if merged_citations else None
694:            "citation_count": verification.get("citation_count"),
695:            "invalid_citation_count": verification.get("invalid_citation_count"),
696:            "low_overlap_citation_count": verification.get("low_overlap_citation_count"),
697:            "numeric_mismatch_citation_count": verification.get("numeric_mismatch_citation_count"),
725:class _ChunkInfo:
729:    bboxes: list
742:    citations: List[dict]
750:def _chunk_info_from_persisted_citation(
752:    citation: dict,
755:    table_id = str(citation.get("table_id") or "") or None
756:    table_context = citation.get("table_context")
760:        page_start=int(citation.get("page") or chunk.page_start) if is_table else chunk.page_start,
761:        page_end=int(citation.get("page_end") or citation.get("page") or chunk.page_end) if is_table else chunk.page_end,
762:        bboxes=citation.get("bboxes") or [] if is_table else chunk.bboxes or [],
767:        score=float(citation.get("confidence_score") or 0.0),
805:                        events.append(sse("citation", _citation_payload(ref_num, chunk, self.char_offset)))
892:                citations=(artifact_payload or {}).get("citations") if artifact_payload else None,
908:                    "citations_count": 0,
939:        8) Save assistant message + citations
1181:                    bboxes=item.get("bboxes") or [],
1212:                    + _citation_contract()
1225:                    + _citation_contract()
1251:                    + _citation_contract()
1262:                    + _citation_contract()
1363:        citations: List[dict] = []
1405:                            elif ev["event"] == "citation":
1406:                                citations.append(ev["data"])
1430:                if not citations:
1432:                    fallback_citations = _fallback_citations(assistant_snapshot, chunk_map)
1433:                    if fallback_citations:
1435:                            "LLM emitted no citation markers; generated %d fallback citations model=%s",
1436:                            len(fallback_citations),
1439:                        for citation in fallback_citations:
1440:                            citations.append(citation)
1441:                            yield sse("citation", citation)

exec
/bin/zsh -lc "nl -ba backend/tests/test_document_brief_service.py | sed -n '200,560p'" in /Users/mayijie/Projects/Code/010_DocTalk
exec
/bin/zsh -lc "nl -ba backend/tests/test_chat_summary_routing.py | sed -n '120,285p'" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
   120	        commit=AsyncMock(),
   121	        rollback=AsyncMock(),
   122	    )
   123	
   124	
   125	@pytest.mark.asyncio
   126	async def test_whole_document_summary_uses_brief_context_not_semantic_retrieval(
   127	    monkeypatch: pytest.MonkeyPatch,
   128	) -> None:
   129	    session_id = uuid.uuid4()
   130	    document_id = uuid.uuid4()
   131	    chunk_id = uuid.uuid4()
   132	    session_obj = SimpleNamespace(
   133	        id=session_id,
   134	        document_id=document_id,
   135	        collection_id=None,
   136	        title=None,
   137	        domain_mode=None,
   138	    )
   139	    doc_obj = SimpleNamespace(demo_slug=None, custom_instructions=None)
   140	    db = _make_db(session_obj, doc_obj)
   141	
   142	    summary_context = AsyncMock(
   143	        return_value=[
   144	            {
   145	                "chunk_id": chunk_id,
   146	                "text": "This report explains China's AI accelerator market and company positioning.",
   147	                "page": 1,
   148	                "page_end": 1,
   149	                "bboxes": [{"x": 0.1, "y": 0.1, "w": 0.4, "h": 0.1, "page": 1}],
   150	                "score": 1.0,
   151	                "section_title": "China's AI Accelerators",
   152	                "document_id": document_id,
   153	            }
   154	        ]
   155	    )
   156	    corrective_retrieval = AsyncMock(return_value=None)
   157	    create = AsyncMock(
   158	        return_value=_FakeStream(
   159	            [
   160	                _FakeChunk("这份报告总结了中国 AI 加速器市场的核心竞争格局。[1]"),
   161	                _FakeChunk(
   162	                    None,
   163	                    finish_reason="stop",
   164	                    usage=SimpleNamespace(prompt_tokens=10, completion_tokens=12),
   165	                ),
   166	            ]
   167	        )
   168	    )
   169	    fake_client = SimpleNamespace(
   170	        chat=SimpleNamespace(completions=SimpleNamespace(create=create))
   171	    )
   172	
   173	    monkeypatch.setattr(
   174	        chat_service_module.document_brief_service,
   175	        "get_summary_context",
   176	        summary_context,
   177	    )
   178	    monkeypatch.setattr(
   179	        chat_service_module.corrective_retrieval_service,
   180	        "retrieve_single",
   181	        corrective_retrieval,
   182	    )
   183	    monkeypatch.setattr(chat_service_module, "_get_llm_client", lambda _model: fake_client)
   184	
   185	    events = [
   186	        event
   187	        async for event in chat_service_module.chat_service.chat_stream(
   188	            session_id=session_id,
   189	            user_message="请总结这篇文档的要点",
   190	            db=db,
   191	            user=None,
   192	            mode="balanced",
   193	        )
   194	    ]
   195	
   196	    summary_context.assert_awaited_once_with(db, document_id, max_chunks=18)
   197	    corrective_retrieval.assert_not_awaited()
   198	    assert {
   199	        "event": "tool_status",
   200	        "data": {"message": "Summarizing the document section by section…"},
   201	    } in events
   202	    assert any(event["event"] == "citation" for event in events)
   203	    assert events[-1]["event"] == "done"
   204	
   205	
   206	@pytest.mark.asyncio
   207	async def test_collection_summary_uses_collection_brief_context_not_search_multi(
   208	    monkeypatch: pytest.MonkeyPatch,
   209	) -> None:
   210	    session_id = uuid.uuid4()
   211	    collection_id = uuid.uuid4()
   212	    document_ids = [uuid.uuid4(), uuid.uuid4()]
   213	    chunk_id = uuid.uuid4()
   214	    session_obj = SimpleNamespace(
   215	        id=session_id,
   216	        document_id=None,
   217	        collection_id=collection_id,
   218	        title=None,
   219	        domain_mode=None,
   220	    )
   221	    db = _make_collection_db(session_obj, document_ids)
   222	
   223	    collection_summary_context = AsyncMock(
   224	        return_value=[
   225	            {
   226	                "chunk_id": chunk_id,
   227	                "text": "Document one covers contract obligations and renewal terms.",
   228	                "page": 1,
   229	                "page_end": 1,
   230	                "bboxes": [{"x": 0.1, "y": 0.1, "w": 0.4, "h": 0.1, "page": 1}],
   231	                "score": 1.0,
   232	                "section_title": "Summary",
   233	                "document_id": document_ids[0],
   234	            }
   235	        ]
   236	    )
   237	    corrective_retrieval = AsyncMock(return_value=None)
   238	    create = AsyncMock(
   239	        return_value=_FakeStream(
   240	            [
   241	                _FakeChunk("The collection mainly covers obligations and renewals.[1]"),
   242	                _FakeChunk(
   243	                    None,
   244	                    finish_reason="stop",
   245	                    usage=SimpleNamespace(prompt_tokens=10, completion_tokens=12),
   246	                ),
   247	            ]
   248	        )
   249	    )
   250	    fake_client = SimpleNamespace(
   251	        chat=SimpleNamespace(completions=SimpleNamespace(create=create))
   252	    )
   253	
   254	    monkeypatch.setattr(
   255	        chat_service_module.document_brief_service,
   256	        "get_collection_summary_context",
   257	        collection_summary_context,
   258	    )
   259	    monkeypatch.setattr(
   260	        chat_service_module.corrective_retrieval_service,
   261	        "retrieve_multi",
   262	        corrective_retrieval,
   263	    )
   264	    monkeypatch.setattr(chat_service_module, "_get_llm_client", lambda _model: fake_client)
   265	
   266	    events = [
   267	        event
   268	        async for event in chat_service_module.chat_service.chat_stream(
   269	            session_id=session_id,
   270	            user_message="Summarize these documents",
   271	            db=db,
   272	            user=None,
   273	            mode="balanced",
   274	        )
   275	    ]
   276	
   277	    collection_summary_context.assert_awaited_once_with(
   278	        db,
   279	        document_ids,
   280	        max_chunks=24,
   281	        max_docs=8,
   282	    )
   283	    corrective_retrieval.assert_not_awaited()
   284	    assert any(event["event"] == "citation" for event in events)
   285	    assert events[-1]["event"] == "done"

 succeeded in 0ms:
   200	    assert contexts[0]["chunk_id"] == table_page.id
   201	
   202	
   203	@pytest.mark.asyncio
   204	async def test_section_map_reduce_covers_all_sections_with_stubbed_llm() -> None:
   205	    section_count = 26
   206	    chunks = [
   207	        _chunk(index, section=f"Chapter {index}", text=(f"Section {index} narrative " * 20))
   208	        for index in range(section_count)
   209	    ]
   210	    expected_sections = {chunk.section_title for chunk in chunks}
   211	
   212	    sampled = _select_representative_chunks(chunks, max_chunks=18)
   213	    sampled_sections = {chunk.section_title for chunk in sampled}
   214	    assert sampled_sections != expected_sections
   215	
   216	    async def fake_map(group: SectionMapGroup) -> MapStepResult:
   217	        selected_ids: list[uuid.UUID] = []
   218	        covered_sections: list[str] = []
   219	        seen_sections: set[str] = set()
   220	        for chunk in group.chunks:
   221	            section = (chunk.section_title or "").strip()
   222	            if not section or section in seen_sections:
   223	                continue
   224	            seen_sections.add(section)
   225	            covered_sections.append(section)
   226	            selected_ids.append(chunk.id)
   227	        return MapStepResult(
   228	            group_index=group.group_index,
   229	            summary=f"covers {len(covered_sections)} sections",
   230	            selected_chunk_ids=tuple(selected_ids),
   231	            covered_sections=tuple(covered_sections),
   232	        )
   233	
   234	    async def fake_reduce(
   235	        mapped: list[MapStepResult],
   236	        *,
   237	        max_total_chunks: int,
   238	    ) -> list[uuid.UUID]:
   239	        ordered: list[uuid.UUID] = []
   240	        seen: set[uuid.UUID] = set()
   241	        for item in mapped:
   242	            for chunk_id in item.selected_chunk_ids:
   243	                if chunk_id in seen:
   244	                    continue
   245	                seen.add(chunk_id)
   246	                ordered.append(chunk_id)
   247	        return ordered[:max_total_chunks]
   248	
   249	    planner = SectionMapReducePlanner(
   250	        map_step=fake_map,
   251	        reduce_step=fake_reduce,
   252	        max_total_chunks_cap=64,
   253	        max_group_chunks=6,
   254	        max_groups=18,
   255	    )
   256	    selected = await planner.select_chunks_for_summary(chunks, max_chunks=18)
   257	    selected_sections = {chunk.section_title for chunk in selected}
   258	
   259	    assert selected_sections == expected_sections
   260	
   261	
   262	@pytest.mark.asyncio
   263	async def test_map_reduce_summary_context_covers_113_sections_under_fixed_context_budget() -> None:
   264	    section_count = 113
   265	    chunks = [
   266	        _chunk(index, section=f"Section {index}", text=(f"Section {index} narrative " * 20))
   267	        for index in range(section_count)
   268	    ]
   269	    expected_sections = tuple(chunk.section_title for chunk in chunks)
   270	
   271	    async def fake_map(group: SectionMapGroup) -> MapStepResult:
   272	        return MapStepResult(
   273	            group_index=group.group_index,
   274	            summary="\n".join(f"- {title}: mapped summary" for title in group.section_titles),
   275	            selected_chunk_ids=tuple(chunk.id for chunk in group.chunks),
   276	            covered_sections=group.section_titles,
   277	        )
   278	
   279	    async def fake_reduce(
   280	        mapped: list[MapStepResult],
   281	        *,
   282	        max_total_chunks: int,
   283	    ) -> MapReduceSummaryResult:
   284	        context_items: list[MapReduceContextItem] = []
   285	        selected_ids: list[uuid.UUID] = []
   286	        covered_sections: list[str] = []
   287	        for item in sorted(mapped, key=lambda value: value.group_index):
   288	            selected_ids.extend(item.selected_chunk_ids)
   289	            covered_sections.extend(item.covered_sections)
   290	            context_items.append(
   291	                MapReduceContextItem(
   292	                    group_index=item.group_index,
   293	                    text=item.summary,
   294	                    anchor_chunk_id=item.selected_chunk_ids[0],
   295	                    source_chunk_ids=item.selected_chunk_ids,
   296	                    covered_sections=item.covered_sections,
   297	                )
   298	            )
   299	        return MapReduceSummaryResult(
   300	            summary="full reduce summary",
   301	            context_items=tuple(context_items),
   302	            selected_chunk_ids=tuple(selected_ids[:max_total_chunks]),
   303	            covered_sections=tuple(covered_sections),
   304	        )
   305	
   306	    planner = SectionMapReducePlanner(
   307	        map_step=fake_map,
   308	        reduce_step=fake_reduce,
   309	        max_groups=18,
   310	        max_group_chunks=6,
   311	        max_total_chunks_cap=64,
   312	    )
   313	
   314	    result = await planner.build_summary_context(chunks, max_chunks=18)
   315	
   316	    assert result.strategy == "map_reduce"
   317	    assert result.covered_sections == expected_sections
   318	    assert len(result.context_items) <= 18
   319	    assert len(result.selected_chunk_ids) <= 64
   320	    assert len(result.covered_sections) > len(result.selected_chunk_ids)
   321	    assert all(section in "\n".join(item.text for item in result.context_items) for section in expected_sections)
   322	
   323	
   324	@pytest.mark.asyncio
   325	async def test_map_reduce_summary_context_items_keep_clickable_source_refs() -> None:
   326	    chunks = [
   327	        _chunk(index, section=f"Section {index}", text=(f"Section {index} narrative " * 20))
   328	        for index in range(12)
   329	    ]
   330	
   331	    async def fake_map(group: SectionMapGroup) -> MapStepResult:
   332	        return MapStepResult(
   333	            group_index=group.group_index,
   334	            summary="\n".join(f"{title}: summary" for title in group.section_titles),
   335	            selected_chunk_ids=tuple(chunk.id for chunk in group.chunks),
   336	            covered_sections=group.section_titles,
   337	        )
   338	
   339	    planner = SectionMapReducePlanner(map_step=fake_map, max_groups=4, max_group_chunks=4)
   340	
   341	    result = await planner.build_summary_context(chunks, max_chunks=18)
   342	    chunk_ids = {chunk.id for chunk in chunks}
   343	
   344	    assert result.context_items
   345	    for item in result.context_items:
   346	        assert item.anchor_chunk_id in chunk_ids
   347	        assert item.source_chunk_ids
   348	        assert set(item.source_chunk_ids).issubset(chunk_ids)
   349	        assert item.covered_sections
   350	
   351	
   352	def test_section_segments_filters_noisy_section_titles() -> None:
   353	    chunks = [
   354	        _chunk(0, section="+"),
   355	        _chunk(1, section="2"),
   356	        _chunk(2, section="2026."),
   357	        _chunk(3, section="A"),
   358	        _chunk(4, section="Valid Section"),
   359	        _chunk(5, section="Valid Section"),
   360	        _chunk(6, section="Next Section"),
   361	    ]
   362	
   363	    segments = _section_segments(chunks)
   364	
   365	    assert [title for title, _items in segments] == ["Valid Section", "Next Section"]
   366	
   367	
   368	@pytest.mark.asyncio
   369	async def test_map_reduce_summary_context_falls_back_to_chunk_selection_when_map_fails() -> None:
   370	    chunks = [
   371	        _chunk(index, section=f"Section {index}", text=(f"Section {index} narrative " * 20))
   372	        for index in range(80)
   373	    ]
   374	
   375	    async def failing_map(_group: SectionMapGroup) -> MapStepResult:
   376	        raise TimeoutError("map timeout")
   377	
   378	    planner = SectionMapReducePlanner(map_step=failing_map, max_total_chunks_cap=64)
   379	
   380	    result = await planner.build_summary_context(chunks, max_chunks=18)
   381	
   382	    assert result.strategy == "chunk_selection_fallback"
   383	    assert result.context_items
   384	    assert result.selected_chunk_ids
   385	    assert len(result.selected_chunk_ids) <= 64
   386	
   387	
   388	def test_dynamic_section_group_count_scales_with_document_size() -> None:
   389	    small = _dynamic_section_group_count(24)
   390	    medium = _dynamic_section_group_count(240)
   391	    huge = _dynamic_section_group_count(2400)
   392	
   393	    assert small >= 2
   394	    assert medium > small
   395	    assert huge >= medium
   396	
   397	
   398	@pytest.mark.asyncio
   399	async def test_large_document_summary_context_uses_section_map_reduce() -> None:
   400	    document_id = uuid.uuid4()
   401	    chunks = [_chunk(i, section=f"Chapter {i}", text=("Long narrative " * 25)) for i in range(50)]
   402	    for chunk in chunks:
   403	        chunk.document_id = document_id
   404	
   405	    map_reduce_selected = chunks[:30]
   406	    map_reduce_result = MapReduceSummaryResult(
   407	        summary="full document summary",
   408	        context_items=(
   409	            MapReduceContextItem(
   410	                group_index=0,
   411	                text="\n".join(f"{chunk.section_title}: summary" for chunk in map_reduce_selected),
   412	                anchor_chunk_id=map_reduce_selected[0].id,
   413	                source_chunk_ids=tuple(chunk.id for chunk in map_reduce_selected),
   414	                covered_sections=tuple(chunk.section_title for chunk in map_reduce_selected),
   415	            ),
   416	        ),
   417	        selected_chunk_ids=tuple(chunk.id for chunk in map_reduce_selected),
   418	        covered_sections=tuple(chunk.section_title for chunk in map_reduce_selected),
   419	    )
   420	    planner = SectionMapReducePlanner()
   421	    planner.build_summary_context = AsyncMock(return_value=map_reduce_result)
   422	    service = DocumentBriefService(
   423	        section_map_reduce=planner,
   424	        map_reduce_min_chunks=36,
   425	    )
   426	    db = SimpleNamespace(
   427	        execute=AsyncMock(
   428	            side_effect=[
   429	                _ScalarOneOrNoneResult(None),
   430	                _ScalarsResult([]),
   431	                _ScalarsResult(chunks),
   432	            ]
   433	        )
   434	    )
   435	
   436	    contexts = await service.get_summary_context(db, document_id, max_chunks=18)
   437	
   438	    planner.build_summary_context.assert_awaited_once_with(chunks, max_chunks=18)
   439	    assert len(contexts) == 1
   440	    assert contexts[0]["retrieval_modality"] == "summary"
   441	    assert len(contexts[0]["map_reduce_source_chunk_ids"]) == 30
   442	
   443	
   444	@pytest.mark.asyncio
   445	async def test_large_document_bypasses_persisted_coverage_when_map_reduce_needed(
   446	    monkeypatch: pytest.MonkeyPatch,
   447	) -> None:
   448	    document_id = uuid.uuid4()
   449	    chunks = [_chunk(i, section=f"Chapter {i}", text=("Long narrative " * 25)) for i in range(50)]
   450	    for chunk in chunks:
   451	        chunk.document_id = document_id
   452	
   453	    persisted = [
   454	        {
   455	            "chunk_id": chunk.id,
   456	            "text": chunk.text,
   457	            "page": chunk.page_start,
   458	            "page_end": chunk.page_end,
   459	            "bboxes": chunk.bboxes,
   460	            "score": 1.0,
   461	            "section_title": chunk.section_title,
   462	            "document_id": chunk.document_id,
   463	        }
   464	        for chunk in chunks[:18]
   465	    ]
   466	
   467	    map_reduce_selected = chunks[:30]
   468	    map_reduce_result = MapReduceSummaryResult(
   469	        summary="full document summary",
   470	        context_items=(
   471	            MapReduceContextItem(
   472	                group_index=0,
   473	                text="\n".join(f"{chunk.section_title}: summary" for chunk in map_reduce_selected),
   474	                anchor_chunk_id=map_reduce_selected[0].id,
   475	                source_chunk_ids=tuple(chunk.id for chunk in map_reduce_selected),
   476	                covered_sections=tuple(chunk.section_title for chunk in map_reduce_selected),
   477	            ),
   478	        ),
   479	        selected_chunk_ids=tuple(chunk.id for chunk in map_reduce_selected),
   480	        covered_sections=tuple(chunk.section_title for chunk in map_reduce_selected),
   481	    )
   482	    planner = SectionMapReducePlanner()
   483	    planner.build_summary_context = AsyncMock(return_value=map_reduce_result)
   484	    service = DocumentBriefService(
   485	        section_map_reduce=planner,
   486	        map_reduce_min_chunks=36,
   487	    )
   488	    monkeypatch.setattr(
   489	        service,
   490	        "_get_persisted_summary_context",
   491	        AsyncMock(return_value=persisted),
   492	    )
   493	    monkeypatch.setattr(
   494	        service,
   495	        "_should_use_map_reduce",
   496	        lambda *_args, **_kwargs: True,
   497	    )
   498	    monkeypatch.setattr(
   499	        "app.services.document_brief_service.get_element_aware_chunks_async",
   500	        AsyncMock(return_value=[]),
   501	    )
   502	    db = SimpleNamespace(execute=AsyncMock(return_value=_ScalarsResult(chunks)))
   503	
   504	    contexts = await service.get_summary_context(db, document_id, max_chunks=18)
   505	
   506	    planner.build_summary_context.assert_awaited_once_with(chunks, max_chunks=18)
   507	    assert len(contexts) == 1
   508	    assert len(contexts[0]["map_reduce_covered_sections"]) > 18
   509	
   510	
   511	def test_truncate_group_chunks_hard_caps_multi_section_group() -> None:
   512	    planner = SectionMapReducePlanner(max_group_chunks=4)
   513	    chunks = tuple(_chunk(i, section=f"Section {i}", text=("Long narrative " * 20)) for i in range(9))
   514	    group = SectionMapGroup(
   515	        group_index=0,
   516	        chunks=chunks,
   517	        section_titles=tuple(f"Section {i}" for i in range(9)),
   518	    )
   519	
   520	    truncated = planner._truncate_group_chunks(group)
   521	
   522	    assert len(truncated.chunks) == 4
   523	    assert [chunk.chunk_index for chunk in truncated.chunks] == [0, 2, 5, 8]
   524	
   525	
   526	@pytest.mark.asyncio
   527	async def test_small_per_doc_budget_skips_map_reduce_for_collection_path() -> None:
   528	    document_id = uuid.uuid4()
   529	    chunks = [_chunk(i, section=f"Chapter {i}", text=("Long narrative " * 25)) for i in range(50)]
   530	    for chunk in chunks:
   531	        chunk.document_id = document_id
   532	
   533	    planner = SectionMapReducePlanner()
   534	    planner.build_summary_context = AsyncMock()
   535	    planner.select_chunks_for_summary = AsyncMock(return_value=chunks[:20])
   536	    service = DocumentBriefService(
   537	        section_map_reduce=planner,
   538	        map_reduce_min_chunks=36,
   539	    )
   540	    db = SimpleNamespace(
   541	        execute=AsyncMock(
   542	            side_effect=[
   543	                _ScalarOneOrNoneResult(None),
   544	                _ScalarsResult([]),
   545	                _ScalarsResult(chunks),
   546	            ]
   547	        )
   548	    )
   549	
   550	    contexts = await service.get_summary_context(db, document_id, max_chunks=3)
   551	
   552	    planner.build_summary_context.assert_not_awaited()
   553	    planner.select_chunks_for_summary.assert_not_awaited()
   554	    assert len(contexts) == 3

exec
/bin/zsh -lc "nl -ba backend/app/services/chat_service.py | sed -n '188,248p'" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
   188	    a separately priced reasoning path.
   189	    """
   190	    if _is_deepseek_official_model(model):
   191	        create_kwargs["extra_body"] = {"thinking": {"type": "disabled"}}
   192	
   193	
   194	def _is_valid_bbox(bb: dict) -> bool:
   195	    return all(isinstance(bb.get(k), (int, float)) for k in ("x", "y", "w", "h"))
   196	
   197	
   198	def _citation_payload(ref_num: int, chunk: "_ChunkInfo", offset: int) -> Dict[str, Any]:
   199	    all_bbs = [
   200	        bb
   201	        for bb in (chunk.bboxes or [])
   202	        if isinstance(bb, dict) and _is_valid_bbox(bb)
   203	    ]
   204	    all_bbs.sort(
   205	        key=lambda b: (
   206	            int(b.get("page", chunk.page_start))
   207	            if isinstance(b.get("page", chunk.page_start), (int, float))
   208	            else chunk.page_start,
   209	            b.get("y", 0),
   210	            b.get("x", 0),
   211	        )
   212	    )
   213	    page_counts: dict[int, int] = {}
   214	    for bb in all_bbs:
   215	        page_val = bb.get("page", chunk.page_start)
   216	        page = (
   217	            int(page_val)
   218	            if isinstance(page_val, (int, float))
   219	            else chunk.page_start
   220	        )
   221	        page_counts[page] = page_counts.get(page, 0) + 1
   222	    best_page = (
   223	        min(page_counts, key=lambda p: (-page_counts[p], p))
   224	        if page_counts
   225	        else chunk.page_start
   226	    )
   227	    citation_data: Dict[str, Any] = {
   228	        "ref_index": ref_num,
   229	        "chunk_id": str(chunk.id),
   230	        "page": best_page,
   231	        "page_end": chunk.page_end,
   232	        "bboxes": all_bbs,
   233	        "text_snippet": ((f"{chunk.section_title}: " if chunk.section_title else "") + (chunk.text or ""))[:100],
   234	        "offset": offset,
   235	    }
   236	    citation_data["confidence_score"] = round(chunk.score, 3)
   237	    citation_data["context_text"] = (chunk.text or "")[:900]
   238	    if chunk.document_id:
   239	        citation_data["document_id"] = str(chunk.document_id)
   240	    if chunk.document_filename:
   241	        citation_data["document_filename"] = chunk.document_filename
   242	    if chunk.table_id:
   243	        citation_data["table_id"] = chunk.table_id
   244	        citation_data["retrieval_modality"] = chunk.retrieval_modality or "table"
   245	        citation_data["table_context"] = (chunk.text or "")[:1400]
   246	    return citation_data
   247	
   248	

exec
/bin/zsh -lc 'rg -n "context_text|text_snippet|bboxes|retrieval_modality|citation" frontend | head -n 120' in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
frontend/src/store/index.ts:68:  navigateToCitation: (citation: Citation) => void;
frontend/src/store/index.ts:71:  addCitationToLastMessage: (citation: Citation) => void;
frontend/src/store/index.ts:154:  navigateToCitation: (citation: Citation) => {
frontend/src/store/index.ts:155:    const bboxes = (citation.bboxes || []).map((bb: NormalizedBBox) => ({
frontend/src/store/index.ts:157:      page: bb.page ?? citation.page,
frontend/src/store/index.ts:160:      currentPage: citation.page,
frontend/src/store/index.ts:161:      highlights: bboxes,
frontend/src/store/index.ts:162:      highlightSnippet: citation.textSnippet || null,
frontend/src/store/index.ts:217:  addCitationToLastMessage: (citation: Citation) => {
frontend/src/store/index.ts:221:    const citations = [...(last.citations || []), citation];
frontend/src/store/index.ts:222:    const updated = { ...last, citations } as Message;
frontend/src/store/index.ts:290:  // document switch (search query/matches, citation highlights, grab mode,
frontend/src/lib/citations.ts:4: * Re-number citations by first-appearance order to produce continuous [1..N] refs.
frontend/src/lib/citations.ts:6:export function renumberCitations(citations: Citation[]): Citation[] {
frontend/src/lib/citations.ts:7:  if (!citations || citations.length === 0) return [];
frontend/src/lib/citations.ts:9:  const unique = citations.filter(
frontend/src/lib/citations.ts:10:    (citation, index, all) => all.findIndex((item) => item.refIndex === citation.refIndex) === index,
frontend/src/lib/citations.ts:15:  sorted.forEach((citation, index) => refMap.set(citation.refIndex, index + 1));
frontend/src/lib/citations.ts:17:  return citations.map((citation) => ({
frontend/src/lib/citations.ts:18:    ...citation,
frontend/src/lib/citations.ts:19:    refIndex: refMap.get(citation.refIndex) ?? citation.refIndex,
frontend/src/types/index.ts:17:  bboxes: NormalizedBBox[];
frontend/src/types/index.ts:20:  documentId?: string; // for cross-document citations
frontend/src/types/index.ts:40:  citations?: Citation[];
frontend/src/types/index.ts:49:  citations?: Citation[];
frontend/src/types/index.ts:84:  bboxes: NormalizedBBox[];
frontend/src/types/index.ts:85:  text_snippet: string;
frontend/src/types/index.ts:124:  text_snippet: string;
frontend/src/types/index.ts:126:  bboxes?: NormalizedBBox[];
frontend/src/types/index.ts:235:  citations: Array<Record<string, unknown>>;
frontend/content/blog/citation-highlighting-matters.md:3:description: "AI tools that generate answers without source citations are a liability. Learn why citation highlighting is essential for trust, accuracy, and professional use of AI document analysis."
frontend/content/blog/citation-highlighting-matters.md:8:tags: ["citations", "hallucination", "trust", "rag", "verification", "ai insights"]
frontend/content/blog/citation-highlighting-matters.md:10:imageAlt: "AI-generated answer with numbered citations highlighted in the original document, showing the verification workflow"
frontend/content/blog/citation-highlighting-matters.md:11:keywords: ["ai citation highlighting", "verify ai answers documents", "ai document citation", "ai hallucination prevention", "rag citations", "ai document verification"]
frontend/content/blog/citation-highlighting-matters.md:16:Without citation highlighting — the ability to click a source reference and see the exact passage highlighted in the original document — you have no efficient way to tell. And in professional contexts, that distinction is the difference between a useful tool and a dangerous one.
frontend/content/blog/citation-highlighting-matters.md:18:This article makes the case that citation highlighting is not a nice-to-have feature. It is the single most important capability that separates reliable AI document analysis from unreliable AI document analysis.
frontend/content/blog/citation-highlighting-matters.md:48:This residual hallucination risk is exactly why citation highlighting matters. It provides a verification mechanism that lets you check every claim against the actual source.
frontend/content/blog/citation-highlighting-matters.md:52:Not all citations are equal. There is a meaningful spectrum of citation quality across AI document tools.
frontend/content/blog/citation-highlighting-matters.md:68:This is what DocTalk provides through its [citation highlighting feature](/features/citations). Each numbered citation in the AI's answer is a clickable link. When you click it, the document viewer scrolls to the exact page and highlights the specific passage in the original document. You see the cited text in its full context — the surrounding paragraphs, the section heading, the neighboring content that might qualify or contradict the AI's interpretation.
frontend/content/blog/citation-highlighting-matters.md:74:The value of citation highlighting is not just about whether verification is possible — it is about whether verification is practical in a real workflow.
frontend/content/blog/citation-highlighting-matters.md:80:Citation highlighting resolves this paradox. You do not need to read the whole document. You click each citation, spend 5-10 seconds confirming the highlighted passage supports the AI's claim, and move on. A response with four citations takes about 30-60 seconds to verify. Compare that to the 20-30 minutes of reading you avoided by using AI in the first place.
frontend/content/blog/citation-highlighting-matters.md:82:Without click-to-navigate highlighting, verification takes 2-3 minutes per citation (finding the right page, scanning for the relevant text, confirming it matches). Most users skip verification when it takes that long — which means they are effectively using the AI without any accuracy check.
frontend/content/blog/citation-highlighting-matters.md:94:A [lawyer reviewing a contract](/use-cases/lawyers) asks: "What is the indemnification cap?" The AI responds: "The indemnification is capped at $2 million per occurrence, as stated in Section 8.3." Click the citation. The highlighted text in the contract reads: "The total aggregate liability under this Section shall not exceed $2,000,000." The AI correctly identified the cap amount and location.
frontend/content/blog/citation-highlighting-matters.md:100:A [finance professional](/use-cases/finance) asks about a company's revenue: "What was Q3 revenue?" The AI says: "Q3 revenue was $12.4 million, representing a 15% year-over-year increase." Two claims, two things to verify. Click the first citation: "$12.4 million" is highlighted in the earnings report. Click the second: "15% growth compared to the same quarter last year" is highlighted two paragraphs later. Both verified in 15 seconds.
frontend/content/blog/citation-highlighting-matters.md:102:Without citation highlighting, the analyst would need to find these numbers manually in a 40-page report. The time savings per question are small, but over the course of reviewing multiple reports per week, they compound significantly.
frontend/content/blog/citation-highlighting-matters.md:106:A [student or researcher](/use-cases/students) asks about a paper's methodology: "What sample size was used?" The AI responds: "The study used a sample of 1,247 participants recruited from three university campuses." Click the citation. The highlighted text in the Methods section confirms the number and adds context about the recruitment criteria. The researcher can now cite this fact in their own work with confidence, having verified it directly against the source.
frontend/content/blog/citation-highlighting-matters.md:110:A clinician reviewing a patient's medical history asks about medication allergies. The AI lists three allergies with citations. Each click shows the highlighted note from the relevant medical record. An error here — a missed allergy or a fabricated one — could have direct patient safety implications. Citation highlighting makes verification fast enough to be consistently practiced, not just theoretically possible.
frontend/content/blog/citation-highlighting-matters.md:114:A compliance officer asks about a policy document: "What are the reporting deadlines?" The AI lists three deadlines with dates. Clicking each citation shows the highlighted text in the regulatory document, including the specific conditions and exceptions that qualify each deadline. These nuances — "within 30 days of discovery, except when..." — are exactly the kind of detail that hallucination can get wrong and that citation highlighting makes easy to verify.
frontend/content/blog/citation-highlighting-matters.md:120:| **DocTalk** | Click-to-navigate highlighting | Seconds per citation | Yes — highlighted in original document |
frontend/content/blog/citation-highlighting-matters.md:132:Citation highlighting is ultimately about transparency. It says: "Here is my answer, and here is exactly where I got it. Check for yourself." This is the same principle behind academic citation, legal footnoting, and journalistic source attribution — you show your work so others can verify it.
frontend/content/blog/citation-highlighting-matters.md:136:An interesting secondary benefit: users who regularly verify citations develop better calibration about when to trust the AI and when to be skeptical. After clicking through a few dozen citations, you start to notice patterns — the AI is very reliable for direct factual extraction, somewhat less reliable for synthesis across distant sections, and occasionally imprecise with numerical comparisons. This calibration makes you a more effective user of the tool.
frontend/content/blog/citation-highlighting-matters.md:140:There is also evidence that AI systems produce more accurate outputs when citations are required in the prompt. When the system knows it will need to provide a specific source for each claim, the generation process is constrained in ways that reduce fabrication. The citation requirement acts as a structural deterrent against hallucination.
frontend/content/blog/citation-highlighting-matters.md:144:Not all citation highlighting implementations are equal. Here is what makes DocTalk's approach effective.
frontend/content/blog/citation-highlighting-matters.md:148:Citations appear as numbered references [1], [2], [3] inline with the answer text, positioned at the end of the claim they support. This mirrors academic citation conventions, making it intuitive to know which claim each citation supports.
frontend/content/blog/citation-highlighting-matters.md:152:Clicking a citation number immediately scrolls the document viewer to the relevant page and highlights the passage. No secondary modal, no separate search step, no "see page X" instructions. One click, one destination.
frontend/content/blog/citation-highlighting-matters.md:160:You can move between the AI's answer and the document freely. Check a citation, read the surrounding text, go back to the answer, check another citation. The interface supports the natural verification workflow without forcing a linear path.
frontend/content/blog/citation-highlighting-matters.md:164:### Do all AI document tools have citation highlighting?
frontend/content/blog/citation-highlighting-matters.md:168:### Can the citations ever be wrong?
frontend/content/blog/citation-highlighting-matters.md:170:The citation points to the passage the AI actually used to generate its answer. If the AI retrieved the wrong passage (a retrieval error rather than a generation error), the citation will accurately show you that wrong passage — which lets you catch the mistake. This is actually a feature, not a bug: you can see exactly what went wrong and why.
frontend/content/blog/citation-highlighting-matters.md:172:### Does citation highlighting slow down the response?
frontend/content/blog/citation-highlighting-matters.md:174:No. The citation references are generated as part of the AI's answer. The highlighting is rendered client-side when you click the citation. There is no additional processing delay.
frontend/content/blog/citation-highlighting-matters.md:176:### Is citation highlighting available on all plans?
frontend/content/blog/citation-highlighting-matters.md:180:### How many citations does a typical answer include?
frontend/content/blog/citation-highlighting-matters.md:182:Most answers include 2-5 citations, depending on the complexity of the question and how many document passages were used. Simple factual lookups may have 1-2 citations. Synthesis questions that draw from multiple sections may have 4-6.
frontend/content/blog/citation-highlighting-matters.md:186:Try the citation highlighting experience yourself. Upload any document to [DocTalk](/) and ask a question. Click the numbered citations in the answer to see the source passages highlighted in the original document.
frontend/content/blog/citation-highlighting-matters.md:188:The [free demo](/demo) works without signing up — you can see how citations look and feel with sample documents in about 30 seconds. For a complete walkthrough of the document chat experience, see our guide on [how to chat with a PDF](/blog/how-to-chat-with-pdf-ai).
frontend/content/blog/chat-with-excel-spreadsheet-ai.md:10:imageAlt: "An Excel spreadsheet being analyzed by AI with highlighted citations pointing to specific cells and rows"
frontend/content/blog/chat-with-excel-spreadsheet-ai.md:94:Click the numbered citations in the AI's response to jump to the relevant section in the document viewer. The highlighted passage shows the exact rows and columns the AI used. This is especially important for numerical data, where misinterpretation can have real consequences.
frontend/content/blog/chat-with-excel-spreadsheet-ai.md:104:When you receive a financial model from a startup, analyst, or vendor, uploading the XLSX file lets you quickly interrogate the assumptions: "What growth rate is assumed for Year 2?" or "What is the projected EBITDA margin?" The citations point to the exact cells, so you can verify the numbers are not hallucinated.
frontend/content/blog/chat-with-excel-spreadsheet-ai.md:172:| **DocTalk** | Yes | Yes (markdown tables) | Click-to-highlight citations | 2-3 minutes |
frontend/content/blog/chat-with-excel-spreadsheet-ai.md:175:| **Google Sheets + Gemini** | Google Sheets only | Yes | No citation highlighting | Variable |
frontend/content/blog/chat-with-excel-spreadsheet-ai.md:179:ChatGPT's Code Interpreter can work with Excel files using Python (pandas), which is powerful for programmatic analysis. However, it does not provide citation-style source verification — you cannot click an answer to see which cell it came from. DocTalk's approach is designed for quick question-answering with verification, not for running custom code against the data.
frontend/scripts/check-chat-prompt-i18n.js:12:  'landing.proof.citations',
frontend/content/blog/best-ai-tools-academic-research-2026.md:10:imageAlt: "Researcher using AI tools to analyze academic papers with citation highlights and literature search results"
frontend/content/blog/best-ai-tools-academic-research-2026.md:25:4. **Reference and knowledge management** — Organize papers, extract key information, manage citations
frontend/content/blog/best-ai-tools-academic-research-2026.md:37:**Why researchers care:** The [citation highlighting](/features/citations) feature is particularly valuable for academic work. When DocTalk cites a passage, you click the citation number and the app scrolls to the exact sentence in the original paper and highlights it. This makes it fast to verify claims — essential when you are building arguments that depend on accurate interpretation of source material.
frontend/content/blog/best-ai-tools-academic-research-2026.md:47:- Click-to-verify citation highlighting
frontend/content/blog/best-ai-tools-academic-research-2026.md:70:- Inline citations grounded in source material
frontend/content/blog/best-ai-tools-academic-research-2026.md:98:- No citation highlighting — it refers to content but you cannot click to verify
frontend/content/blog/best-ai-tools-academic-research-2026.md:161:[Connected Papers](https://www.connectedpapers.com/) takes a single paper and generates a visual graph of related papers based on citation overlap (co-citation and bibliographic coupling). It does not use AI to answer questions — it uses graph algorithms to show you the research neighborhood around a paper.
frontend/content/blog/best-ai-tools-academic-research-2026.md:175:- Graph quality depends on the paper having sufficient citations
frontend/content/blog/best-ai-tools-academic-research-2026.md:184:[Semantic Scholar](https://www.semanticscholar.org/) is an AI-powered academic search engine developed by the Allen Institute for AI. It indexes over 200 million papers across all academic disciplines and uses AI to extract key information — TLDR summaries, citation contexts, and influential citations.
frontend/content/blog/best-ai-tools-academic-research-2026.md:186:**Why researchers care:** It is the most comprehensive free academic search engine with AI features. The "TLDR" one-sentence summaries save time when scanning search results, and the "highly influential citations" feature identifies which of a paper's citations actually build meaningfully on its work.
frontend/content/blog/best-ai-tools-academic-research-2026.md:191:- Influential citation detection
frontend/content/blog/best-ai-tools-academic-research-2026.md:263:3. Use [citation highlighting](/features/citations) to verify every AI-generated claim against the original text
frontend/content/blog/best-ai-tools-academic-research-2026.md:273:2. Export citations from Zotero in the required format
frontend/content/blog/best-ai-tools-academic-research-2026.md:274:3. Verify every factual claim against the original source using DocTalk's citation highlighting
frontend/content/blog/best-ai-tools-academic-research-2026.md:280:| **DocTalk** | Document analysis | Yes (7 formats) | 300 credits/mo | From $9.99/mo | Multi-format Q&A with citations |
frontend/content/blog/best-ai-tools-academic-research-2026.md:296:**Always verify citations.** AI tools sometimes misattribute findings or subtly distort claims. If you are citing a finding in your own paper, go back to the original source and read the relevant section yourself. Tools with [citation highlighting](/features/citations) make this verification step fast — tools without it make it tedious.
frontend/content/blog/notebooklm-alternatives-2026.md:3:description: "Looking for a Google NotebookLM alternative? We compare 5 AI document tools — DocTalk, ChatPDF, AskYourPDF, Humata, and PDF.ai — on format support, citations, languages, and pricing."
frontend/content/blog/notebooklm-alternatives-2026.md:30:**Inline citations.** NotebookLM grounds its answers in the source material and provides inline citations you can click to see the relevant passage.
frontend/content/blog/notebooklm-alternatives-2026.md:48:**No citation highlighting in original documents.** While NotebookLM provides inline citations, it does not highlight the source passage in the original document's layout. You see the cited text, but not in its original visual context — which matters for PDFs with complex layouts, tables, or figures.
frontend/content/blog/notebooklm-alternatives-2026.md:54:[DocTalk](/) is an AI document Q&A platform that supports seven file formats and provides [citation highlighting](/features/citations) — the ability to click a citation and see the exact source passage highlighted in the original document.
frontend/content/blog/notebooklm-alternatives-2026.md:58:DocTalk fills NotebookLM's two biggest gaps: format support and citation verification. Where NotebookLM requires you to convert DOCX and XLSX files to Google Docs, DocTalk handles PDF, DOCX, PPTX, XLSX, TXT, Markdown, and web URLs [natively](/features/multi-format). Where NotebookLM shows cited text inline, DocTalk scrolls to the exact page and highlights the passage in the original document — so you see the citation in its full visual context.
frontend/content/blog/notebooklm-alternatives-2026.md:73:**Best for:** Users who work with Microsoft Office formats, need verifiable citations in the original document context, or work with documents in CJK or RTL languages.
frontend/content/blog/notebooklm-alternatives-2026.md:92:- Page-level citations (not passage-level)
frontend/content/blog/notebooklm-alternatives-2026.md:107:On the other hand, AskYourPDF is PDF-only and does not offer multi-source notebooks, audio overviews, or the kind of synthesis across sources that NotebookLM provides. Its citation quality is page-level rather than passage-level.
frontend/content/blog/notebooklm-alternatives-2026.md:115:- Page-level citations
frontend/content/blog/notebooklm-alternatives-2026.md:159:- Page-level citations only
frontend/content/blog/notebooklm-alternatives-2026.md:195:- **You need verifiable citations in the original document.** DocTalk's [citation highlighting](/features/citations) lets you click to verify in context — important for legal, academic, and compliance work.
frontend/content/blog/notebooklm-alternatives-2026.md:207:If format support and citation verification are your priorities, [try DocTalk free](/demo). If you need Zotero integration, try AskYourPDF. If you need team features, try Humata. And if none of NotebookLM's limitations affect you, keep using NotebookLM — it is a genuinely good tool.
frontend/content/blog/ai-hr-contract-review.md:31:- Checking non-compete and non-solicitation clauses for enforceability
frontend/content/blog/ai-hr-contract-review.md:110:For any information that will be communicated to employees or used in decision-making, click through to the [cited source text](/features/citations) and verify the exact language. This is especially important for:
frontend/content/blog/ai-hr-contract-review.md:233:If you manage HR documents and want to test AI-assisted review, start with a low-stakes document — upload your current employee handbook to [DocTalk's free demo](/demo) and ask a few of the questions above. See whether the AI correctly identifies the provisions you already know about, and check the [citations](/features/citations) to verify accuracy.
frontend/public/llms.txt:9:- [Citation Highlighting](https://www.doctalk.site/features/citations)
frontend/public/llms.txt:66:- [Why Citation Highlighting Matters](https://www.doctalk.site/blog/citation-highlighting-matters)
frontend/content/blog/ai-document-analysis-languages.md:14:Most AI document analysis tools work well in English and poorly in everything else. They might accept a document in French or German, but the retrieval accuracy drops, citations become unreliable, and nuanced questions get generic answers. For the hundreds of millions of professionals who work with documents in languages other than English, this is not a minor inconvenience — it is a dealbreaker.
frontend/content/blog/ai-document-analysis-languages.md:60:The citations in the AI's answer point back to the original text in the document. If you uploaded a German contract, the citations show the original German passages highlighted in the document viewer. This is important: the AI's answer may be in English, but the source verification happens against the original text.
frontend/content/blog/ai-document-analysis-languages.md:92:A law firm in London receives a contract in German from a Frankfurt-based partner. Instead of waiting for a full translation, the legal team uploads the German PDF and asks questions in English: "What are the termination provisions?" or "What liability caps are specified?" The AI retrieves the relevant German clauses and answers in English, with citations pointing to the original German text for review by a German-speaking attorney.
frontend/content/blog/ai-document-analysis-languages.md:126:When the AI answers in a different language than the source document, always click the citations to check the original text. The LLM's cross-lingual synthesis is generally accurate, but specialized terminology, idiomatic expressions, and legal language can occasionally be paraphrased rather than precisely translated. The citation highlighting lets you catch these cases.
frontend/content/blog/ai-document-analysis-languages.md:130:Cross-lingual questions are inherently more complex for the AI. Using DocTalk's Pro mode gives the model more room for careful language bridging and citation-aware synthesis. Flash mode works well for same-language queries and quick lookups.
frontend/content/blog/ai-document-analysis-languages.md:162:No. DocTalk does not translate the document text. It uses cross-lingual embeddings to find relevant passages in the original language and then the LLM generates an answer in your question's language. The citations always point to the original text. This is a deliberate design choice — translation can introduce errors and lose nuance, while the original text remains the authoritative source.
frontend/content/blog/ai-document-analysis-languages.md:170:Arabic document extraction and analysis is fully supported. The document viewer renders Arabic text correctly, and the citation highlighting works with right-to-left text. Retrieval accuracy for Arabic is in the "Good" tier — accurate for most queries, with occasional reduced precision on highly specialized vocabulary.
frontend/content/blog/ai-contract-review-guide.md:10:imageAlt: "A professional reviewing a contract on screen with AI-highlighted key clauses and citations"
frontend/content/blog/ai-contract-review-guide.md:16:AI does not replace the need for legal judgment. But it fundamentally changes how fast you can get through the reading part. Instead of scanning every paragraph looking for the termination clause, you ask "What are the termination provisions?" and get an answer with a citation pointing to the exact section. This guide shows you how to do that effectively, what kinds of questions work best, and where AI still falls short.
frontend/content/blog/ai-contract-review-guide.md:35:- **Spotting standard vs. unusual terms.** If you ask "Is there anything unusual about the liability cap?", AI can describe what the document says and [cite the exact passage](/features/citations) so you can evaluate it yourself.
frontend/content/blog/ai-contract-review-guide.md:48:Here is the workflow, using [DocTalk](/) as the AI tool. The process is similar with any RAG-based document chat tool, but DocTalk's [citation highlighting](/features/citations) makes verification particularly fast because you can click through to see the exact source text in the original document.
frontend/content/blog/ai-contract-review-guide.md:94:> "Are there any non-compete or non-solicitation provisions in this agreement?"
frontend/content/blog/ai-contract-review-guide.md:140:For any provision that affects your decision — the liability cap, the term, the auto-renewal mechanism — click through to the [cited source text](/features/citations) and read the actual contract language. AI is excellent at finding the right section and summarizing it accurately, but contract language often has nuances (qualifiers, carve-outs, cross-references) that matter.
frontend/content/blog/ai-financial-report-analysis.md:10:imageAlt: "An analyst using AI to quickly extract key metrics from a financial report with highlighted citations"

exec
/bin/zsh -lc 'rg -n "map_reduce|summary_context|retrieval_modality" -S backend frontend | head -n 120' in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
backend/tests/test_corrective_retrieval_service.py:153:        "retrieval_modality": "table",
backend/tests/test_corrective_retrieval_service.py:357:        "retrieval_modality": "table",
backend/tests/test_chat_summary_routing.py:142:    summary_context = AsyncMock(
backend/tests/test_chat_summary_routing.py:175:        "get_summary_context",
backend/tests/test_chat_summary_routing.py:176:        summary_context,
backend/tests/test_chat_summary_routing.py:196:    summary_context.assert_awaited_once_with(db, document_id, max_chunks=18)
backend/tests/test_chat_summary_routing.py:223:    collection_summary_context = AsyncMock(
backend/tests/test_chat_summary_routing.py:256:        "get_collection_summary_context",
backend/tests/test_chat_summary_routing.py:257:        collection_summary_context,
backend/tests/test_chat_summary_routing.py:277:    collection_summary_context.assert_awaited_once_with(
backend/tests/test_chat_corrective_retrieval.py:146:        retrieval_modality="table",
backend/tests/test_chat_corrective_retrieval.py:153:    assert payload["retrieval_modality"] == "table"
backend/tests/test_chat_corrective_retrieval.py:175:        "retrieval_modality": "table",
backend/tests/test_document_brief_service.py:99:async def test_collection_summary_context_caps_docs_and_chunks(
backend/tests/test_document_brief_service.py:113:    monkeypatch.setattr(service, "get_summary_context", AsyncMock(side_effect=fake_context))
backend/tests/test_document_brief_service.py:115:    contexts = await service.get_collection_summary_context(
backend/tests/test_document_brief_service.py:128:async def test_summary_context_prefers_persisted_coverage_order() -> None:
backend/tests/test_document_brief_service.py:145:    contexts = await DocumentBriefService().get_summary_context(db, document_id, max_chunks=8)
backend/tests/test_document_brief_service.py:151:async def test_summary_context_falls_back_when_persisted_coverage_is_stale() -> None:
backend/tests/test_document_brief_service.py:167:    contexts = await DocumentBriefService().get_summary_context(db, document_id, max_chunks=8)
backend/tests/test_document_brief_service.py:173:async def test_summary_context_uses_document_elements_before_chunk_fallback() -> None:
backend/tests/test_document_brief_service.py:198:    contexts = await DocumentBriefService().get_summary_context(db, document_id, max_chunks=4)
backend/tests/test_document_brief_service.py:204:async def test_section_map_reduce_covers_all_sections_with_stubbed_llm() -> None:
backend/tests/test_document_brief_service.py:263:async def test_map_reduce_summary_context_covers_113_sections_under_fixed_context_budget() -> None:
backend/tests/test_document_brief_service.py:314:    result = await planner.build_summary_context(chunks, max_chunks=18)
backend/tests/test_document_brief_service.py:316:    assert result.strategy == "map_reduce"
backend/tests/test_document_brief_service.py:325:async def test_map_reduce_summary_context_items_keep_clickable_source_refs() -> None:
backend/tests/test_document_brief_service.py:341:    result = await planner.build_summary_context(chunks, max_chunks=18)
backend/tests/test_document_brief_service.py:369:async def test_map_reduce_summary_context_falls_back_to_chunk_selection_when_map_fails() -> None:
backend/tests/test_document_brief_service.py:380:    result = await planner.build_summary_context(chunks, max_chunks=18)
backend/tests/test_document_brief_service.py:399:async def test_large_document_summary_context_uses_section_map_reduce() -> None:
backend/tests/test_document_brief_service.py:405:    map_reduce_selected = chunks[:30]
backend/tests/test_document_brief_service.py:406:    map_reduce_result = MapReduceSummaryResult(
backend/tests/test_document_brief_service.py:411:                text="\n".join(f"{chunk.section_title}: summary" for chunk in map_reduce_selected),
backend/tests/test_document_brief_service.py:412:                anchor_chunk_id=map_reduce_selected[0].id,
backend/tests/test_document_brief_service.py:413:                source_chunk_ids=tuple(chunk.id for chunk in map_reduce_selected),
backend/tests/test_document_brief_service.py:414:                covered_sections=tuple(chunk.section_title for chunk in map_reduce_selected),
backend/tests/test_document_brief_service.py:417:        selected_chunk_ids=tuple(chunk.id for chunk in map_reduce_selected),
backend/tests/test_document_brief_service.py:418:        covered_sections=tuple(chunk.section_title for chunk in map_reduce_selected),
backend/tests/test_document_brief_service.py:421:    planner.build_summary_context = AsyncMock(return_value=map_reduce_result)
backend/tests/test_document_brief_service.py:423:        section_map_reduce=planner,
backend/tests/test_document_brief_service.py:424:        map_reduce_min_chunks=36,
backend/tests/test_document_brief_service.py:436:    contexts = await service.get_summary_context(db, document_id, max_chunks=18)
backend/tests/test_document_brief_service.py:438:    planner.build_summary_context.assert_awaited_once_with(chunks, max_chunks=18)
backend/tests/test_document_brief_service.py:440:    assert contexts[0]["retrieval_modality"] == "summary"
backend/tests/test_document_brief_service.py:441:    assert len(contexts[0]["map_reduce_source_chunk_ids"]) == 30
backend/tests/test_document_brief_service.py:445:async def test_large_document_bypasses_persisted_coverage_when_map_reduce_needed(
backend/tests/test_document_brief_service.py:467:    map_reduce_selected = chunks[:30]
backend/tests/test_document_brief_service.py:468:    map_reduce_result = MapReduceSummaryResult(
backend/tests/test_document_brief_service.py:473:                text="\n".join(f"{chunk.section_title}: summary" for chunk in map_reduce_selected),
backend/tests/test_document_brief_service.py:474:                anchor_chunk_id=map_reduce_selected[0].id,
backend/tests/test_document_brief_service.py:475:                source_chunk_ids=tuple(chunk.id for chunk in map_reduce_selected),
backend/tests/test_document_brief_service.py:476:                covered_sections=tuple(chunk.section_title for chunk in map_reduce_selected),
backend/tests/test_document_brief_service.py:479:        selected_chunk_ids=tuple(chunk.id for chunk in map_reduce_selected),
backend/tests/test_document_brief_service.py:480:        covered_sections=tuple(chunk.section_title for chunk in map_reduce_selected),
backend/tests/test_document_brief_service.py:483:    planner.build_summary_context = AsyncMock(return_value=map_reduce_result)
backend/tests/test_document_brief_service.py:485:        section_map_reduce=planner,
backend/tests/test_document_brief_service.py:486:        map_reduce_min_chunks=36,
backend/tests/test_document_brief_service.py:490:        "_get_persisted_summary_context",
backend/tests/test_document_brief_service.py:495:        "_should_use_map_reduce",
backend/tests/test_document_brief_service.py:504:    contexts = await service.get_summary_context(db, document_id, max_chunks=18)
backend/tests/test_document_brief_service.py:506:    planner.build_summary_context.assert_awaited_once_with(chunks, max_chunks=18)
backend/tests/test_document_brief_service.py:508:    assert len(contexts[0]["map_reduce_covered_sections"]) > 18
backend/tests/test_document_brief_service.py:527:async def test_small_per_doc_budget_skips_map_reduce_for_collection_path() -> None:
backend/tests/test_document_brief_service.py:534:    planner.build_summary_context = AsyncMock()
backend/tests/test_document_brief_service.py:537:        section_map_reduce=planner,
backend/tests/test_document_brief_service.py:538:        map_reduce_min_chunks=36,
backend/tests/test_document_brief_service.py:550:    contexts = await service.get_summary_context(db, document_id, max_chunks=3)
backend/tests/test_document_brief_service.py:552:    planner.build_summary_context.assert_not_awaited()
backend/tests/test_retrieval_service_lexical.py:255:    assert payloads[0]["retrieval_modality"] == "table"
backend/app/services/document_brief_service.py:28:DEFAULT_MAP_REDUCE_MIN_CHUNKS = 36
backend/app/services/document_brief_service.py:29:MAP_REDUCE_MAX_CHARS_PER_CHUNK = 900
backend/app/services/document_brief_service.py:30:MAP_REDUCE_MAX_CONTEXT_ITEM_CHARS = 3000
backend/app/services/document_brief_service.py:63:    strategy: str = "map_reduce"
backend/app/services/document_brief_service.py:342:            text = (getattr(chunk, "text", "") or "").strip()[:MAP_REDUCE_MAX_CHARS_PER_CHUNK]
backend/app/services/document_brief_service.py:468:            summary=summary[:MAP_REDUCE_MAX_CONTEXT_ITEM_CHARS],
backend/app/services/document_brief_service.py:511:                    text=text[:MAP_REDUCE_MAX_CONTEXT_ITEM_CHARS],
backend/app/services/document_brief_service.py:756:            strategy = reduced.strategy or "map_reduce"
backend/app/services/document_brief_service.py:762:            strategy = "map_reduce"
backend/app/services/document_brief_service.py:800:                    text=text[:MAP_REDUCE_MAX_CONTEXT_ITEM_CHARS],
backend/app/services/document_brief_service.py:826:    async def build_summary_context(
backend/app/services/document_brief_service.py:978:def _map_reduce_context_to_retrieval_items(
backend/app/services/document_brief_service.py:995:        retrieval_item["retrieval_modality"] = "summary"
backend/app/services/document_brief_service.py:996:        retrieval_item["map_reduce_strategy"] = result.strategy
backend/app/services/document_brief_service.py:997:        retrieval_item["map_reduce_source_chunk_ids"] = [
backend/app/services/document_brief_service.py:1000:        retrieval_item["map_reduce_covered_sections"] = list(context_item.covered_sections)
backend/app/services/document_brief_service.py:1009:        section_map_reduce: SectionMapReducePlanner | None = None,
backend/app/services/document_brief_service.py:1010:        map_reduce_min_chunks: int = DEFAULT_MAP_REDUCE_MIN_CHUNKS,
backend/app/services/document_brief_service.py:1012:        self._section_map_reduce = section_map_reduce or SectionMapReducePlanner()
backend/app/services/document_brief_service.py:1013:        self._map_reduce_min_chunks = max(1, int(map_reduce_min_chunks))
backend/app/services/document_brief_service.py:1015:    def _should_use_map_reduce(
backend/app/services/document_brief_service.py:1028:        if scale_units < self._map_reduce_min_chunks:
backend/app/services/document_brief_service.py:1037:        return scale_units >= max(max_chunks * 2, self._map_reduce_min_chunks)
backend/app/services/document_brief_service.py:1039:    async def get_summary_context(
backend/app/services/document_brief_service.py:1046:        persisted = await self._get_persisted_summary_context(
backend/app/services/document_brief_service.py:1085:        if self._should_use_map_reduce(
backend/app/services/document_brief_service.py:1091:            map_reduce_result = await self._section_map_reduce.build_summary_context(
backend/app/services/document_brief_service.py:1096:                map_reduce_result.strategy == "map_reduce"
backend/app/services/document_brief_service.py:1097:                and map_reduce_result.context_items
backend/app/services/document_brief_service.py:1099:                map_reduce_items = _map_reduce_context_to_retrieval_items(
backend/app/services/document_brief_service.py:1100:                    map_reduce_result,
backend/app/services/document_brief_service.py:1103:                if map_reduce_items:
backend/app/services/document_brief_service.py:1104:                    return map_reduce_items
backend/app/services/document_brief_service.py:1107:            selected_map_reduce = [
backend/app/services/document_brief_service.py:1109:                for chunk_id in map_reduce_result.selected_chunk_ids
backend/app/services/document_brief_service.py:1112:            if selected_map_reduce:
backend/app/services/document_brief_service.py:1113:                total = max(1, len(selected_map_reduce))
backend/app/services/document_brief_service.py:1119:                    for idx, chunk in enumerate(selected_map_reduce)
backend/app/services/document_brief_service.py:1138:    async def _get_persisted_summary_context(
backend/app/services/document_brief_service.py:1181:    async def get_collection_summary_context(
backend/app/services/document_brief_service.py:1197:                await self.get_summary_context(
backend/app/services/retrieval_service.py:193:            "retrieval_modality": "table",
backend/app/services/chat_service.py:244:        citation_data["retrieval_modality"] = chunk.retrieval_modality or "table"
backend/app/services/chat_service.py:736:    retrieval_modality: str = "text"
backend/app/services/chat_service.py:769:        retrieval_modality="table" if is_table else "text",
backend/app/services/chat_service.py:1092:                retrieved = await document_brief_service.get_summary_context(
backend/app/services/chat_service.py:1097:                retrieval_strategy = "document_summary_context"
backend/app/services/chat_service.py:1103:                retrieved = await document_brief_service.get_collection_summary_context(
backend/app/services/chat_service.py:1109:                retrieval_strategy = "collection_summary_context"
backend/app/services/chat_service.py:1159:            has_map_reduce_summary_context = any(

exec
/bin/zsh -lc "sed -n '1,180p' backend/pytest.ini" in /Users/mayijie/Projects/Code/010_DocTalk
exec
/bin/zsh -lc 'rg -n "DocumentBrief|coverage|selected_chunk_ids|summary_context|brief" backend/app backend/tests | head -n 160' in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
[pytest]
asyncio_mode = strict
asyncio_default_fixture_loop_scope = function
markers =
    integration: tests that require real infrastructure (DB, Redis, MinIO, Qdrant)

 succeeded in 0ms:
backend/tests/test_corrective_retrieval_service.py:17:        coverage=kwargs.get("coverage", "top_hits"),
backend/tests/test_corrective_retrieval_service.py:117:        _route(intents=(QueryIntent.EXISTENCE_CHECK,), coverage="exhaustive_scan"),
backend/tests/test_corrective_retrieval_service.py:286:    assert result.plan and result.plan.needs_balanced_coverage
backend/app/services/document_brief_service.py:16:from app.models.tables import Chunk, Document, DocumentBrief
backend/app/services/document_brief_service.py:44:    selected_chunk_ids: tuple[uuid.UUID, ...]
backend/app/services/document_brief_service.py:61:    selected_chunk_ids: tuple[uuid.UUID, ...]
backend/app/services/document_brief_service.py:331:            selected_chunk_ids=tuple(selected_ids),
backend/app/services/document_brief_service.py:469:            selected_chunk_ids=tuple(selected_ids),
backend/app/services/document_brief_service.py:482:            for chunk_id in item.selected_chunk_ids:
backend/app/services/document_brief_service.py:499:            if not item.selected_chunk_ids:
backend/app/services/document_brief_service.py:512:                    anchor_chunk_id=item.selected_chunk_ids[0],
backend/app/services/document_brief_service.py:513:                    source_chunk_ids=item.selected_chunk_ids,
backend/app/services/document_brief_service.py:530:    def _mapped_selected_chunk_ids(
backend/app/services/document_brief_service.py:539:            for chunk_id in item.selected_chunk_ids:
backend/app/services/document_brief_service.py:565:            "Merge the map summaries into a compact, structured full-document brief.\n"
backend/app/services/document_brief_service.py:569:            "- Preserve coverage of every section title listed below; do not drop tail sections.\n"
backend/app/services/document_brief_service.py:587:            selected_chunk_ids=self._mapped_selected_chunk_ids(
backend/app/services/document_brief_service.py:685:                list(reduced.selected_chunk_ids)
backend/app/services/document_brief_service.py:737:            selected_chunk_ids=tuple(chunk.id for chunk in selected),
backend/app/services/document_brief_service.py:753:            raw_selected = list(reduced.selected_chunk_ids)
backend/app/services/document_brief_service.py:775:                self._mapped_selected_chunk_ids(
backend/app/services/document_brief_service.py:821:            selected_chunk_ids=tuple(selected[:max_total_chunks]),
backend/app/services/document_brief_service.py:826:    async def build_summary_context(
backend/app/services/document_brief_service.py:840:                selected_chunk_ids=(),
backend/app/services/document_brief_service.py:899:    """Select ordered chunks for broad document coverage.
backend/app/services/document_brief_service.py:902:    need beginning/middle/end coverage and section diversity, while semantic
backend/app/services/document_brief_service.py:922:    # Keep likely conclusion / appendix tail coverage without over-weighting it.
backend/app/services/document_brief_service.py:937:    # Fill remaining budget with evenly spaced coverage.
backend/app/services/document_brief_service.py:947:    # If section titles consumed too much budget, keep deterministic coverage:
backend/app/services/document_brief_service.py:1005:class DocumentBriefService:
backend/app/services/document_brief_service.py:1036:        # No reliable element coverage: still promote large docs to section map-reduce.
backend/app/services/document_brief_service.py:1039:    async def get_summary_context(
backend/app/services/document_brief_service.py:1046:        persisted = await self._get_persisted_summary_context(
backend/app/services/document_brief_service.py:1052:            # Collection / narrow-budget paths should keep using persisted brief context.
backend/app/services/document_brief_service.py:1091:            map_reduce_result = await self._section_map_reduce.build_summary_context(
backend/app/services/document_brief_service.py:1109:                for chunk_id in map_reduce_result.selected_chunk_ids
backend/app/services/document_brief_service.py:1138:    async def _get_persisted_summary_context(
backend/app/services/document_brief_service.py:1145:        brief_row = await db.execute(
backend/app/services/document_brief_service.py:1146:            select(DocumentBrief.coverage).where(DocumentBrief.document_id == document_id)
backend/app/services/document_brief_service.py:1148:        coverage = brief_row.scalar_one_or_none()
backend/app/services/document_brief_service.py:1149:        if not isinstance(coverage, dict):
backend/app/services/document_brief_service.py:1151:        raw_ids = coverage.get("selected_chunk_ids")
backend/app/services/document_brief_service.py:1181:    async def get_collection_summary_context(
backend/app/services/document_brief_service.py:1197:                await self.get_summary_context(
backend/app/services/document_brief_service.py:1212:document_brief_service = DocumentBriefService()
backend/tests/test_parse_worker_bridge.py:100:def test_queue_document_brief_dispatches_task(monkeypatch) -> None:
backend/tests/test_parse_worker_bridge.py:108:    import app.workers.brief_worker as brief_worker
backend/tests/test_parse_worker_bridge.py:110:    monkeypatch.setattr(brief_worker, "generate_document_brief", _Task)
backend/tests/test_parse_worker_bridge.py:112:    parse_worker._queue_document_brief("doc-123")
backend/tests/test_document_brief_generation.py:9:    _apply_payload_to_doc_and_brief,
backend/tests/test_document_brief_generation.py:10:    normalize_document_brief,
backend/tests/test_document_brief_generation.py:28:def test_normalize_document_brief_maps_model_refs_to_chunk_metadata() -> None:
backend/tests/test_document_brief_generation.py:38:    brief = normalize_document_brief(raw, chunks, chunks_total=20, pages_total=9)
backend/tests/test_document_brief_generation.py:40:    assert brief["outline"][0]["source_refs"] == [
backend/tests/test_document_brief_generation.py:48:    assert brief["key_points"][0]["source_refs"][0]["chunk_id"] == str(chunks[0].id)
backend/tests/test_document_brief_generation.py:49:    assert brief["facts"][0]["source_refs"][0]["chunk_index"] == 5
backend/tests/test_document_brief_generation.py:50:    assert brief["coverage"]["selected_chunk_indices"] == [0, 5]
backend/tests/test_document_brief_generation.py:53:def test_normalize_document_brief_drops_items_without_valid_refs() -> None:
backend/tests/test_document_brief_generation.py:73:    brief = normalize_document_brief(raw, chunks, chunks_total=1, pages_total=1)
backend/tests/test_document_brief_generation.py:75:    assert [item["title"] for item in brief["outline"]] == ["Supported"]
backend/tests/test_document_brief_generation.py:76:    assert [item["text"] for item in brief["key_points"]] == ["Supported point."]
backend/tests/test_document_brief_generation.py:77:    assert [item["label"] for item in brief["facts"]] == ["Supported"]
backend/tests/test_document_brief_generation.py:82:    brief = SimpleNamespace()
backend/tests/test_document_brief_generation.py:89:        "coverage": {"status": "representative"},
backend/tests/test_document_brief_generation.py:92:    _apply_payload_to_doc_and_brief(doc, brief, payload, model="deepseek-v4-flash")
backend/tests/test_document_brief_generation.py:94:    assert brief.summary == "A useful summary."
backend/tests/test_document_brief_generation.py:95:    assert brief.questions == ["What is the core point?"]
backend/tests/test_document_brief_generation.py:98:    assert brief.error_code is None
backend/tests/test_document_brief_generation.py:118:    def __init__(self, doc, chunks, existing_brief=None, execute_results=None) -> None:
backend/tests/test_document_brief_generation.py:121:        self.existing_brief = existing_brief
backend/tests/test_document_brief_generation.py:124:            _ScalarResult(existing_brief),
backend/tests/test_document_brief_generation.py:167:def test_generate_document_brief_bad_json_records_error_without_status_change(monkeypatch) -> None:
backend/tests/test_document_brief_generation.py:179:    summary_service.generate_document_brief_sync(str(doc.id))
backend/tests/test_document_brief_generation.py:186:def test_generate_document_brief_records_error_when_llm_unavailable(monkeypatch) -> None:
backend/tests/test_document_brief_generation.py:198:    summary_service.generate_document_brief_sync(str(doc.id))
backend/tests/test_document_brief_generation.py:205:def test_generate_document_brief_discards_stale_chunks_after_reparse(monkeypatch) -> None:
backend/tests/test_document_brief_generation.py:215:      "summary": "A generated brief.",
backend/tests/test_document_brief_generation.py:232:    summary_service.generate_document_brief_sync(str(doc.id))
backend/tests/test_query_planner_service.py:12:        coverage=kwargs.get("coverage", "top_hits"),
backend/tests/test_query_planner_service.py:41:    assert any(step.purpose == "entity-metric-coverage" for step in plan.steps)
backend/tests/test_query_planner_service.py:46:def test_collection_comparison_requests_balanced_document_coverage() -> None:
backend/tests/test_query_planner_service.py:59:    assert plan.needs_balanced_coverage is True
backend/tests/test_query_planner_service.py:60:    assert "balanced-doc-coverage" in plan.reason
backend/tests/test_chat_summary_routing.py:126:async def test_whole_document_summary_uses_brief_context_not_semantic_retrieval(
backend/tests/test_chat_summary_routing.py:142:    summary_context = AsyncMock(
backend/tests/test_chat_summary_routing.py:174:        chat_service_module.document_brief_service,
backend/tests/test_chat_summary_routing.py:175:        "get_summary_context",
backend/tests/test_chat_summary_routing.py:176:        summary_context,
backend/tests/test_chat_summary_routing.py:196:    summary_context.assert_awaited_once_with(db, document_id, max_chunks=18)
backend/tests/test_chat_summary_routing.py:207:async def test_collection_summary_uses_collection_brief_context_not_search_multi(
backend/tests/test_chat_summary_routing.py:223:    collection_summary_context = AsyncMock(
backend/tests/test_chat_summary_routing.py:255:        chat_service_module.document_brief_service,
backend/tests/test_chat_summary_routing.py:256:        "get_collection_summary_context",
backend/tests/test_chat_summary_routing.py:257:        collection_summary_context,
backend/tests/test_chat_summary_routing.py:277:    collection_summary_context.assert_awaited_once_with(
backend/tests/test_chat_corrective_retrieval.py:120:                purpose="entity-metric-coverage",
backend/tests/test_chat_corrective_retrieval.py:123:        needs_balanced_coverage=True,
backend/tests/test_chat_corrective_retrieval.py:124:        reason="comparison+balanced-doc-coverage",
backend/tests/test_chat_corrective_retrieval.py:130:    assert "entity-metric-coverage" in prompt
backend/tests/test_chat_corrective_retrieval.py:131:    assert "Balanced per-document coverage" in prompt
backend/app/services/table_service.py:528:                    "warnings": ["brief uncertainty notes"],
backend/app/services/summary_service.py:1:"""Generate persisted hierarchical document briefs after parsing.
backend/app/services/summary_service.py:5:brief row when possible, but never change the document's parse status.
backend/app/services/summary_service.py:22:from app.models.tables import Chunk, Document, DocumentBrief
backend/app/services/summary_service.py:23:from app.services.document_brief_service import _select_representative_chunks
backend/app/services/summary_service.py:27:BRIEF_PROMPT_VERSION = "document_brief_v1"
backend/app/services/summary_service.py:33:BRIEF_PROMPT = """You are building a structured document brief for a professional document workspace.
backend/app/services/summary_service.py:187:def normalize_document_brief(
backend/app/services/summary_service.py:235:        "coverage": {
backend/app/services/summary_service.py:240:            "selected_chunk_ids": [str(chunk.id) for chunk in selected_chunks],
backend/app/services/summary_service.py:257:def _get_existing_brief(db: Session, document_id: uuid.UUID) -> DocumentBrief | None:
backend/app/services/summary_service.py:259:        select(DocumentBrief).where(DocumentBrief.document_id == document_id)
backend/app/services/summary_service.py:263:def _apply_payload_to_doc_and_brief(
backend/app/services/summary_service.py:265:    brief: DocumentBrief,
backend/app/services/summary_service.py:270:    brief.schema_version = BRIEF_SCHEMA_VERSION
backend/app/services/summary_service.py:271:    brief.prompt_version = BRIEF_PROMPT_VERSION
backend/app/services/summary_service.py:272:    brief.model = model
backend/app/services/summary_service.py:273:    brief.summary = payload.get("summary") or None
backend/app/services/summary_service.py:274:    brief.outline = payload.get("outline") or []
backend/app/services/summary_service.py:275:    brief.key_points = payload.get("key_points") or []
backend/app/services/summary_service.py:276:    brief.facts = payload.get("facts") or []
backend/app/services/summary_service.py:277:    brief.questions = payload.get("questions") or []
backend/app/services/summary_service.py:278:    brief.coverage = payload.get("coverage") or {}
backend/app/services/summary_service.py:279:    brief.error_code = None
backend/app/services/summary_service.py:280:    brief.error_message = None
backend/app/services/summary_service.py:281:    brief.generated_at = datetime.now(timezone.utc)
backend/app/services/summary_service.py:283:    doc.summary = brief.summary
backend/app/services/summary_service.py:284:    doc.suggested_questions = brief.questions
backend/app/services/summary_service.py:287:def _persist_brief_error(
backend/app/services/summary_service.py:295:    brief = _get_existing_brief(db, doc.id)
backend/app/services/summary_service.py:296:    if brief is None:
backend/app/services/summary_service.py:297:        brief = DocumentBrief(
backend/app/services/summary_service.py:303:            coverage={},
backend/app/services/summary_service.py:305:    brief.schema_version = BRIEF_SCHEMA_VERSION
backend/app/services/summary_service.py:306:    brief.prompt_version = BRIEF_PROMPT_VERSION
backend/app/services/summary_service.py:307:    brief.model = model
backend/app/services/summary_service.py:308:    brief.error_code = code
backend/app/services/summary_service.py:309:    brief.error_message = message[:2000]
backend/app/services/summary_service.py:310:    brief.generated_at = datetime.now(timezone.utc)
backend/app/services/summary_service.py:311:    db.add(brief)
backend/app/services/summary_service.py:332:def generate_document_brief_sync(document_id: str) -> None:
backend/app/services/summary_service.py:333:    """Load representative chunks, call the LLM, and persist a structured brief."""
backend/app/services/summary_service.py:337:            logger.warning("Document %s not found for brief generation", document_id)
backend/app/services/summary_service.py:342:            logger.warning("No LLM API key configured, recording brief generation failure")
backend/app/services/summary_service.py:343:            _persist_brief_error(
backend/app/services/summary_service.py:347:                message="No LLM API key configured for document brief generation",
backend/app/services/summary_service.py:360:            logger.warning("No chunks found for document %s, skipping brief generation", document_id)
backend/app/services/summary_service.py:361:            _persist_brief_error(
backend/app/services/summary_service.py:365:                message="No chunks found for document brief generation",
backend/app/services/summary_service.py:373:            _persist_brief_error(
backend/app/services/summary_service.py:377:                message="No representative chunks selected for document brief generation",
backend/app/services/summary_service.py:394:            payload = normalize_document_brief(
backend/app/services/summary_service.py:403:                logger.warning("Document %s changed during brief generation; discarding stale brief", document_id)
backend/app/services/summary_service.py:406:            brief = _get_existing_brief(db, doc.id)
backend/app/services/summary_service.py:407:            if brief is None:
backend/app/services/summary_service.py:408:                brief = DocumentBrief(document_id=doc.id)
backend/app/services/summary_service.py:409:            _apply_payload_to_doc_and_brief(doc, brief, payload, model=BRIEF_MODEL)
backend/app/services/summary_service.py:410:            db.add(brief)
backend/app/services/summary_service.py:414:                "Document brief generated for %s: %d outline items, %d key points, %d facts",
backend/app/services/summary_service.py:416:                len(brief.outline),

exec
/bin/zsh -lc "nl -ba frontend/src/store/index.ts | sed -n '145,170p'" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
   145	    } catch {
   146	      // localStorage unavailable in private browsing
   147	    }
   148	  },
   149	  setPdfUrl: (url: string | null) => set({ pdfUrl: url }),
   150	  setPage: (page: number) => set({ currentPage: Math.max(1, page) }),
   151	  setScale: (scale: number) => set({ scale: Math.max(0.25, scale) }),
   152	  setGrabMode: (v: boolean) => set({ grabMode: v }),
   153	  setHighlights: (highlights: NormalizedBBox[]) => set({ highlights }),
   154	  navigateToCitation: (citation: Citation) => {
   155	    const bboxes = (citation.bboxes || []).map((bb: NormalizedBBox) => ({
   156	      ...bb,
   157	      page: bb.page ?? citation.page,
   158	    }));
   159	    set((state) => ({
   160	      currentPage: citation.page,
   161	      highlights: bboxes,
   162	      highlightSnippet: citation.textSnippet || null,
   163	      scrollNonce: state.scrollNonce + 1,
   164	    }));
   165	  },
   166	  addMessage: (msg: Message) => set({ messages: [...get().messages, msg] }),
   167	  setMessages: (msgs: Message[]) => set({ messages: msgs }),
   168	  updateLastMessage: (text: string) => {
   169	    if (!text) return;
   170	    const state = get();

exec
/bin/zsh -lc "nl -ba backend/app/services/summary_service.py | sed -n '360,410p'" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
   360	            logger.warning("No chunks found for document %s, skipping brief generation", document_id)
   361	            _persist_brief_error(
   362	                db,
   363	                doc,
   364	                code="BRIEF_NO_CHUNKS",
   365	                message="No chunks found for document brief generation",
   366	                model=BRIEF_MODEL,
   367	            )
   368	            return
   369	
   370	        selected_chunks = _select_representative_chunks(chunks, max_chunks=BRIEF_MAX_CHUNKS)
   371	        if not selected_chunks:
   372	            logger.warning("No representative chunks selected for document %s", document_id)
   373	            _persist_brief_error(
   374	                db,
   375	                doc,
   376	                code="BRIEF_NO_REPRESENTATIVE_CHUNKS",
   377	                message="No representative chunks selected for document brief generation",
   378	                model=BRIEF_MODEL,
   379	            )
   380	            return
   381	
   382	        prompt = BRIEF_PROMPT.format(chunks_text=_build_chunks_text(selected_chunks))
   383	
   384	        try:
   385	            kwargs: dict[str, Any] = {
   386	                "model": BRIEF_MODEL,
   387	                "messages": [{"role": "user", "content": prompt}],
   388	                "temperature": 0.2,
   389	                "max_tokens": 2200,
   390	            }
   391	            _apply_provider_options(kwargs, BRIEF_MODEL)
   392	            response = client.chat.completions.create(**kwargs)
   393	            raw = _json_from_text(response.choices[0].message.content or "")
   394	            payload = normalize_document_brief(
   395	                raw,
   396	                selected_chunks,
   397	                chunks_total=len(chunks),
   398	                pages_total=doc.page_count,
   399	            )
   400	
   401	            db.refresh(doc)
   402	            if doc.status != "ready" or not _selected_chunks_still_current(db, doc, selected_chunks):
   403	                logger.warning("Document %s changed during brief generation; discarding stale brief", document_id)
   404	                return
   405	
   406	            brief = _get_existing_brief(db, doc.id)
   407	            if brief is None:
   408	                brief = DocumentBrief(document_id=doc.id)
   409	            _apply_payload_to_doc_and_brief(doc, brief, payload, model=BRIEF_MODEL)
   410	            db.add(brief)

codex
我现在跑指定的非集成测试。这里 `pytest.ini` 在 `backend/`，所以我会在 `backend` 目录执行同一个环境变量和 pytest 参数。
exec
/bin/zsh -lc 'SKIP_INTEGRATION=1 python3 -m pytest -q' in /Users/mayijie/Projects/Code/010_DocTalk/backend
 succeeded in 5948ms:
..........................ss............................................ [ 17%]
........................................................................ [ 34%]
........................................................................ [ 52%]
.......s.s...............s....................s......................... [ 69%]
........................................................................ [ 87%]
........................s...........................                     [100%]
=============================== warnings summary ===============================
app/api/admin.py:325
  /Users/mayijie/Projects/Code/010_DocTalk/backend/app/api/admin.py:325: DeprecationWarning: `regex` has been deprecated, please use `pattern` instead
    period: str = Query("day", regex="^(day|week|month)$"),

app/api/admin.py:461
  /Users/mayijie/Projects/Code/010_DocTalk/backend/app/api/admin.py:461: DeprecationWarning: `regex` has been deprecated, please use `pattern` instead
    period: str = Query("day", regex="^(day|week|month)$"),

app/api/admin.py:1482
  /Users/mayijie/Projects/Code/010_DocTalk/backend/app/api/admin.py:1482: DeprecationWarning: `regex` has been deprecated, please use `pattern` instead
    by: str = Query("tokens", regex="^(tokens|credits|documents)$"),

../../../../Library/Python/3.9/lib/python/site-packages/urllib3/__init__.py:35
  /Users/mayijie/Library/Python/3.9/lib/python/site-packages/urllib3/__init__.py:35: NotOpenSSLWarning: urllib3 v2 only supports OpenSSL 1.1.1+, currently the 'ssl' module is compiled with 'LibreSSL 2.8.3'. See: https://github.com/urllib3/urllib3/issues/3020
    warnings.warn(

<frozen importlib._bootstrap>:228
<frozen importlib._bootstrap>:228
  <frozen importlib._bootstrap>:228: DeprecationWarning: builtin type SwigPyPacked has no __module__ attribute

<frozen importlib._bootstrap>:228
<frozen importlib._bootstrap>:228
  <frozen importlib._bootstrap>:228: DeprecationWarning: builtin type SwigPyObject has no __module__ attribute

<frozen importlib._bootstrap>:228
  <frozen importlib._bootstrap>:228: DeprecationWarning: builtin type swigvarlink has no __module__ attribute

app/api/collections.py:43
  /Users/mayijie/Projects/Code/010_DocTalk/backend/app/api/collections.py:43: PydanticDeprecatedSince20: Support for class-based `config` is deprecated, use ConfigDict instead. Deprecated in Pydantic V2.0 to be removed in V3.0. See Pydantic V2 Migration Guide at https://errors.pydantic.dev/2.12/migration/
    class CollectionBrief(BaseModel):

app/api/users.py:38
  /Users/mayijie/Projects/Code/010_DocTalk/backend/app/api/users.py:38: PydanticDeprecatedSince20: Support for class-based `config` is deprecated, use ConfigDict instead. Deprecated in Pydantic V2.0 to be removed in V3.0. See Pydantic V2 Migration Guide at https://errors.pydantic.dev/2.12/migration/
    class UserMeResponse(BaseModel):

app/schemas/document.py:18
  /Users/mayijie/Projects/Code/010_DocTalk/backend/app/schemas/document.py:18: PydanticDeprecatedSince20: Support for class-based `config` is deprecated, use ConfigDict instead. Deprecated in Pydantic V2.0 to be removed in V3.0. See Pydantic V2 Migration Guide at https://errors.pydantic.dev/2.12/migration/
    class DocumentResponse(BaseModel):

app/schemas/chat.py:23
  /Users/mayijie/Projects/Code/010_DocTalk/backend/app/schemas/chat.py:23: PydanticDeprecatedSince20: Support for class-based `config` is deprecated, use ConfigDict instead. Deprecated in Pydantic V2.0 to be removed in V3.0. See Pydantic V2 Migration Guide at https://errors.pydantic.dev/2.12/migration/
    class ChatMessageResponse(BaseModel):

tests/test_export_api.py::test_export_requires_auth
  /Users/mayijie/Projects/Code/010_DocTalk/backend/app/schemas/auth.py:18: PydanticDeprecatedSince20: Support for class-based `config` is deprecated, use ConfigDict instead. Deprecated in Pydantic V2.0 to be removed in V3.0. See Pydantic V2 Migration Guide at https://errors.pydantic.dev/2.12/migration/
    class UserResponse(BaseModel):

tests/test_export_api.py::test_export_requires_auth
  /Users/mayijie/Projects/Code/010_DocTalk/backend/app/schemas/auth.py:52: PydanticDeprecatedSince20: Support for class-based `config` is deprecated, use ConfigDict instead. Deprecated in Pydantic V2.0 to be removed in V3.0. See Pydantic V2 Migration Guide at https://errors.pydantic.dev/2.12/migration/
    class AccountResponse(BaseModel):

-- Docs: https://docs.pytest.org/en/stable/how-to/capture-warnings.html
405 passed, 7 skipped, 15 warnings in 5.14s
sys:1: DeprecationWarning: builtin type swigvarlink has no __module__ attribute

codex
测试结果符合预期：`405 passed, 7 skipped`，只有既有 deprecation/OpenSSL 警告。现在我把重点转到实际风险排序，特别是 repeated summary 的计费/缓存和 citation payload 的用户可见行为。
exec
/bin/zsh -lc "nl -ba backend/app/services/credit_service.py | sed -n '1,220p'" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
     1	from __future__ import annotations
     2	
     3	from typing import Optional
     4	from uuid import UUID
     5	
     6	import sqlalchemy as sa
     7	from sqlalchemy.ext.asyncio import AsyncSession
     8	
     9	from app.core.config import settings
    10	from app.models.tables import CreditLedger, UsageRecord, User
    11	
    12	# Token-to-credit rates by model tier
    13	CREDIT_RATES = {
    14	    # Active models (reachable via mode system)
    15	    "deepseek-v4-flash": (1, 3),
    16	    "deepseek-v4-pro": (2, 6),
    17	    "deepseek/deepseek-v3.2": (1, 5),
    18	    "mistralai/mistral-medium-3.1": (2, 10),
    19	    "mistralai/mistral-large-2512": (2, 10),
    20	    # Fallback models (in ALLOWED_MODELS)
    21	    "qwen/qwen3-30b-a3b": (1, 5),
    22	    "mistralai/mistral-medium-3": (2, 10),
    23	    "openai/gpt-5.2": (3, 15),
    24	    # Legacy rates (kept for historical UsageRecord cost lookups)
    25	    "x-ai/grok-4.1-fast": (1, 5),
    26	    "minimax/minimax-m2.1": (1, 5),
    27	    "moonshotai/kimi-k2.5": (1, 5),
    28	    "google/gemini-3-flash-preview": (1, 5),
    29	    "google/gemini-3-pro-preview": (3, 15),
    30	    "anthropic/claude-sonnet-4.5": (3, 15),
    31	    "anthropic/claude-opus-4.6": (15, 75),
    32	}
    33	DEFAULT_RATE = (3, 15)
    34	MIN_CREDITS_FOR_CHAT = 10
    35	
    36	# Estimated cost per mode for pre-debit (generous upper bound to avoid under-debit).
    37	# Internal mode IDs are kept for compatibility: quick=Flash, balanced=Pro.
    38	MODE_ESTIMATED_COST: dict[str, int] = {"quick": 5, "balanced": 15}
    39	
    40	
    41	def get_estimated_cost(mode: str) -> int:
    42	    """Return estimated credit cost for a mode (used for pre-debit)."""
    43	    return MODE_ESTIMATED_COST.get(mode, MODE_ESTIMATED_COST["balanced"])
    44	
    45	
    46	def calculate_cost(prompt_tokens: int, completion_tokens: int, model: str, mode: str | None = None) -> int:
    47	    """Calculate credit cost for token usage, with optional mode multiplier."""
    48	    input_rate, output_rate = CREDIT_RATES.get(model, DEFAULT_RATE)
    49	    input_cost = round(prompt_tokens * input_rate / 1000)
    50	    output_cost = round(completion_tokens * output_rate / 1000)
    51	    base_cost = max(1, input_cost + output_cost)
    52	    # Apply mode multiplier
    53	    multiplier = settings.MODE_CREDIT_MULTIPLIER.get(mode or "balanced", 1.0)
    54	    return max(1, int(base_cost * multiplier))
    55	
    56	
    57	async def get_user_credits(db: AsyncSession, user_id: UUID) -> int:
    58	    """Get user's current credit balance."""
    59	    user = await db.get(User, user_id)
    60	    return user.credits_balance if user else 0
    61	
    62	
    63	async def debit_credits(
    64	    db: AsyncSession,
    65	    user_id: UUID,
    66	    cost: int,
    67	    reason: str,
    68	    ref_type: Optional[str] = None,
    69	    ref_id: Optional[str] = None,
    70	) -> Optional[UUID]:
    71	    """Atomically debit credits. Returns the CreditLedger entry ID on success, None if insufficient.
    72	
    73	    The balance update and ledger entry are written in the same transaction.
    74	    Caller must call db.commit() to persist changes.
    75	    """
    76	    if cost <= 0:
    77	        raise ValueError("Cost must be positive")
    78	
    79	    result = await db.execute(
    80	        sa.update(User)
    81	        .where(User.id == user_id)
    82	        .where(User.credits_balance >= cost)
    83	        .values(credits_balance=User.credits_balance - cost)
    84	        .returning(User.credits_balance)
    85	    )
    86	    row = result.fetchone()
    87	
    88	    if row is None:
    89	        return None
    90	
    91	    new_balance = row[0]
    92	    ledger = CreditLedger(
    93	        user_id=user_id,
    94	        delta=-cost,
    95	        balance_after=new_balance,
    96	        reason=reason,
    97	        ref_type=ref_type,
    98	        ref_id=ref_id,
    99	    )
   100	    db.add(ledger)
   101	    # Flush to ensure ledger is written in same transaction as balance update
   102	    await db.flush()
   103	    return ledger.id
   104	
   105	
   106	async def credit_credits(
   107	    db: AsyncSession,
   108	    user_id: UUID,
   109	    amount: int,
   110	    reason: str,
   111	    ref_type: Optional[str] = None,
   112	    ref_id: Optional[str] = None,
   113	) -> int:
   114	    """Add credits. Returns new balance.
   115	
   116	    The balance update and ledger entry are written in the same transaction.
   117	    Caller must call db.commit() to persist changes.
   118	    """
   119	    if amount <= 0:
   120	        raise ValueError("Amount must be positive")
   121	
   122	    result = await db.execute(
   123	        sa.update(User)
   124	        .where(User.id == user_id)
   125	        .values(credits_balance=User.credits_balance + amount)
   126	        .returning(User.credits_balance)
   127	    )
   128	    new_balance = result.scalar_one()
   129	
   130	    ledger = CreditLedger(
   131	        user_id=user_id,
   132	        delta=amount,
   133	        balance_after=new_balance,
   134	        reason=reason,
   135	        ref_type=ref_type,
   136	        ref_id=ref_id,
   137	    )
   138	    db.add(ledger)
   139	    # Flush to ensure ledger is written in same transaction as balance update
   140	    await db.flush()
   141	    return new_balance
   142	
   143	
   144	async def record_usage(
   145	    db: AsyncSession,
   146	    user_id: UUID,
   147	    message_id: Optional[UUID],
   148	    model: str,
   149	    prompt_tokens: int,
   150	    completion_tokens: int,
   151	    cost_credits: int,
   152	) -> UsageRecord:
   153	    """Record detailed usage information."""
   154	    usage = UsageRecord(
   155	        user_id=user_id,
   156	        message_id=message_id,
   157	        model=model,
   158	        prompt_tokens=prompt_tokens,
   159	        completion_tokens=completion_tokens,
   160	        total_tokens=prompt_tokens + completion_tokens,
   161	        cost_credits=cost_credits,
   162	    )
   163	    db.add(usage)
   164	    return usage
   165	
   166	
   167	async def reconcile_credits(
   168	    db: AsyncSession,
   169	    user_id: UUID,
   170	    predebit_ledger_id: UUID,
   171	    pre_debited: int,
   172	    actual_cost: int,
   173	) -> None:
   174	    """Reconcile pre-debited credits against actual cost after streaming.
   175	
   176	    Updates the ORIGINAL ledger entry in-place so each chat produces exactly
   177	    one ledger row (reason="chat") instead of two (predebit + reconcile).
   178	
   179	    - If pre_debited == actual_cost → no-op
   180	    - If diff != 0 → adjust user balance and update the original ledger entry
   181	    """
   182	    diff = pre_debited - actual_cost
   183	    if diff == 0:
   184	        return
   185	
   186	    balance_result = await db.execute(
   187	        sa.update(User)
   188	        .where(User.id == user_id)
   189	        .values(credits_balance=User.credits_balance + diff)
   190	        .returning(User.credits_balance)
   191	    )
   192	    if balance_result.scalar_one_or_none() is None:
   193	        raise RuntimeError(f"User {user_id} not found during credit reconciliation")
   194	
   195	    # Update the original ledger entry to reflect actual cost
   196	    ledger_result = await db.execute(
   197	        sa.update(CreditLedger)
   198	        .where(CreditLedger.id == predebit_ledger_id)
   199	        .values(
   200	            delta=-actual_cost,
   201	            balance_after=CreditLedger.balance_after + diff,
   202	        )
   203	        .returning(CreditLedger.id)
   204	    )
   205	    if ledger_result.scalar_one_or_none() is None:
   206	        raise RuntimeError(
   207	            f"Predebit ledger {predebit_ledger_id} not found during credit reconciliation"
   208	        )
   209	    await db.flush()
   210	
   211	
   212	async def ensure_monthly_credits(db: AsyncSession, user: User) -> None:
   213	    """Grant monthly credits if last grant was over 30 days ago.
   214	
   215	    Idempotency: checks CreditLedger for any recent 'monthly_allowance' within 30 days.
   216	    """
   217	    from datetime import datetime, timedelta, timezone
   218	
   219	    if (user.plan or "free").lower() != "free":
   220	        return

exec
/bin/zsh -lc 'rg -n "class Credit|def get_estimated_cost|estimated|debit_credits|credit" backend/app/services backend/app | head -n 120' in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
backend/app/services/question_template_service.py:17:from app.services.credit_service import calculate_cost
backend/app/services/question_template_service.py:54:def estimated_template_cost(question_count: int, document_count: int) -> int:
backend/app/services/question_template_service.py:232:                    cost_credits=actual_cost,
backend/app/services/question_template_service.py:235:            job.cost_credits = actual_cost
backend/app/services/question_template_service.py:17:from app.services.credit_service import calculate_cost
backend/app/services/question_template_service.py:54:def estimated_template_cost(question_count: int, document_count: int) -> int:
backend/app/services/question_template_service.py:232:                    cost_credits=actual_cost,
backend/app/services/question_template_service.py:235:            job.cost_credits = actual_cost
backend/app/services/table_service.py:856:            job.cost_credits = 0
backend/app/services/table_service.py:910:            job.cost_credits = 0
backend/app/services/table_service.py:856:            job.cost_credits = 0
backend/app/services/table_service.py:910:            job.cost_credits = 0
backend/app/services/credit_service.py:12:# Token-to-credit rates by model tier
backend/app/services/credit_service.py:41:def get_estimated_cost(mode: str) -> int:
backend/app/services/credit_service.py:42:    """Return estimated credit cost for a mode (used for pre-debit)."""
backend/app/services/credit_service.py:47:    """Calculate credit cost for token usage, with optional mode multiplier."""
backend/app/services/credit_service.py:57:async def get_user_credits(db: AsyncSession, user_id: UUID) -> int:
backend/app/services/credit_service.py:58:    """Get user's current credit balance."""
backend/app/services/credit_service.py:60:    return user.credits_balance if user else 0
backend/app/services/credit_service.py:63:async def debit_credits(
backend/app/services/credit_service.py:71:    """Atomically debit credits. Returns the CreditLedger entry ID on success, None if insufficient.
backend/app/services/credit_service.py:82:        .where(User.credits_balance >= cost)
backend/app/services/credit_service.py:83:        .values(credits_balance=User.credits_balance - cost)
backend/app/services/credit_service.py:84:        .returning(User.credits_balance)
backend/app/services/credit_service.py:106:async def credit_credits(
backend/app/services/credit_service.py:114:    """Add credits. Returns new balance.
backend/app/services/credit_service.py:125:        .values(credits_balance=User.credits_balance + amount)
backend/app/services/credit_service.py:126:        .returning(User.credits_balance)
backend/app/services/credit_service.py:151:    cost_credits: int,
backend/app/services/credit_service.py:161:        cost_credits=cost_credits,
backend/app/services/credit_service.py:167:async def reconcile_credits(
backend/app/services/credit_service.py:174:    """Reconcile pre-debited credits against actual cost after streaming.
backend/app/services/credit_service.py:189:        .values(credits_balance=User.credits_balance + diff)
backend/app/services/credit_service.py:190:        .returning(User.credits_balance)
backend/app/services/credit_service.py:193:        raise RuntimeError(f"User {user_id} not found during credit reconciliation")
backend/app/services/credit_service.py:207:            f"Predebit ledger {predebit_ledger_id} not found during credit reconciliation"
backend/app/services/credit_service.py:212:async def ensure_monthly_credits(db: AsyncSession, user: User) -> None:
backend/app/services/credit_service.py:213:    """Grant monthly credits if last grant was over 30 days ago.
backend/app/services/credit_service.py:224:    last = user.monthly_credits_granted_at
backend/app/services/credit_service.py:242:        user.monthly_credits_granted_at = now
backend/app/services/credit_service.py:251:        user.monthly_credits_granted_at = now
backend/app/services/credit_service.py:255:    # Grant credits and update marker
backend/app/services/credit_service.py:256:    await credit_credits(
backend/app/services/credit_service.py:264:    user.monthly_credits_granted_at = now
backend/app/services/auth_service.py:51:        credits_balance=settings.SIGNUP_BONUS_CREDITS,
backend/app/services/auth_service.py:53:        monthly_credits_granted_at=datetime.now(timezone.utc),
backend/app/services/chat_service.py:31:from app.services import credit_service
backend/app/services/chat_service.py:556:            .values(credits_balance=User.credits_balance + pre_debited)
backend/app/services/chat_service.py:631:            actual_cost = credit_service.calculate_cost(
backend/app/services/chat_service.py:637:            await credit_service.reconcile_credits(
backend/app/services/chat_service.py:1023:        # Pre-debit estimated credits BEFORE streaming (prevents TOCTOU + free rides)
backend/app/services/chat_service.py:1027:            estimated = credit_service.get_estimated_cost(effective_mode)
backend/app/services/chat_service.py:1029:                estimated = max(estimated, estimated * 2)
backend/app/services/chat_service.py:1030:            predebit_ledger_id = await credit_service.debit_credits(
backend/app/services/chat_service.py:1031:                db, user_id=user.id, cost=estimated,
backend/app/services/chat_service.py:1035:                pre_debited = estimated
backend/app/services/chat_service.py:1038:                balance = await credit_service.get_user_credits(db, user.id)
backend/app/services/chat_service.py:1043:                        "message": "Insufficient credits to start chat",
backend/app/services/chat_service.py:1044:                        "required": estimated,
backend/app/services/chat_service.py:1322:                        "Failed to refund pre-debited credits during chat setup failure for user %s",
backend/app/services/chat_service.py:1338:                        "Failed to refund pre-debited credits before LLM client setup for user %s",
backend/app/services/chat_service.py:1474:                            "Failed to refund pre-debited credits after LLM error for user %s",
backend/app/services/chat_service.py:1508:                            "Failed to refund pre-debited credits after PERSIST_FAILED for user %s",
backend/app/services/chat_service.py:1599:                    actual_cost = credit_service.calculate_cost(pt, ct, effective_model, mode=effective_mode)
backend/app/services/chat_service.py:1600:                    await credit_service.reconcile_credits(
backend/app/services/chat_service.py:1603:                    await credit_service.record_usage(
backend/app/services/chat_service.py:1610:                        cost_credits=actual_cost,
backend/app/services/chat_service.py:1767:        # 5) Pre-debit credits
backend/app/services/chat_service.py:1771:            estimated = credit_service.get_estimated_cost(effective_mode)
backend/app/services/chat_service.py:1772:            predebit_ledger_id = await credit_service.debit_credits(
backend/app/services/chat_service.py:1773:                db, user_id=user.id, cost=estimated,
backend/app/services/chat_service.py:1777:                pre_debited = estimated
backend/app/services/chat_service.py:1780:                balance = await credit_service.get_user_credits(db, user.id)
backend/app/services/chat_service.py:1783:                    "message": "Insufficient credits",
backend/app/services/chat_service.py:1784:                    "required": estimated,
backend/app/services/chat_service.py:1953:                        "Failed to refund pre-debited credits during continuation setup failure for user %s",
backend/app/services/chat_service.py:1969:                        "Failed to refund pre-debited credits before continuation LLM client setup for user %s",
backend/app/services/chat_service.py:2075:                            "Failed to refund pre-debited credits after continuation LLM error for user %s",
backend/app/services/chat_service.py:2106:                            "Failed to refund pre-debited credits after continuation PERSIST_FAILED for user %s",
backend/app/services/chat_service.py:2193:                    actual_cost = credit_service.calculate_cost(pt, ct, effective_model, mode=effective_mode)
backend/app/services/chat_service.py:2194:                    await credit_service.reconcile_credits(
backend/app/services/chat_service.py:2197:                    await credit_service.record_usage(
backend/app/services/chat_service.py:2204:                        cost_credits=actual_cost,
backend/app/services/extraction_service.py:29:from app.services.credit_service import calculate_cost
backend/app/services/extraction_service.py:488:            .values(credits_balance=User.credits_balance + pre_debited)
backend/app/services/extraction_service.py:504:            .values(credits_balance=User.credits_balance + diff)
backend/app/services/extraction_service.py:565:                    cost_credits=actual_cost,
backend/app/services/extraction_service.py:568:            job.cost_credits = actual_cost
backend/app/services/auth_service.py:51:        credits_balance=settings.SIGNUP_BONUS_CREDITS,
backend/app/services/auth_service.py:53:        monthly_credits_granted_at=datetime.now(timezone.utc),
backend/app/services/chat_service.py:31:from app.services import credit_service
backend/app/services/chat_service.py:556:            .values(credits_balance=User.credits_balance + pre_debited)
backend/app/services/chat_service.py:631:            actual_cost = credit_service.calculate_cost(
backend/app/services/chat_service.py:637:            await credit_service.reconcile_credits(
backend/app/services/chat_service.py:1023:        # Pre-debit estimated credits BEFORE streaming (prevents TOCTOU + free rides)
backend/app/services/chat_service.py:1027:            estimated = credit_service.get_estimated_cost(effective_mode)
backend/app/services/chat_service.py:1029:                estimated = max(estimated, estimated * 2)
backend/app/services/chat_service.py:1030:            predebit_ledger_id = await credit_service.debit_credits(
backend/app/services/chat_service.py:1031:                db, user_id=user.id, cost=estimated,
backend/app/services/chat_service.py:1035:                pre_debited = estimated
backend/app/services/chat_service.py:1038:                balance = await credit_service.get_user_credits(db, user.id)
backend/app/services/chat_service.py:1043:                        "message": "Insufficient credits to start chat",
backend/app/services/chat_service.py:1044:                        "required": estimated,
backend/app/services/chat_service.py:1322:                        "Failed to refund pre-debited credits during chat setup failure for user %s",
backend/app/services/chat_service.py:1338:                        "Failed to refund pre-debited credits before LLM client setup for user %s",
backend/app/services/chat_service.py:1474:                            "Failed to refund pre-debited credits after LLM error for user %s",
backend/app/services/chat_service.py:1508:                            "Failed to refund pre-debited credits after PERSIST_FAILED for user %s",
backend/app/services/chat_service.py:1599:                    actual_cost = credit_service.calculate_cost(pt, ct, effective_model, mode=effective_mode)
backend/app/services/chat_service.py:1600:                    await credit_service.reconcile_credits(
backend/app/services/chat_service.py:1603:                    await credit_service.record_usage(
backend/app/services/chat_service.py:1610:                        cost_credits=actual_cost,
backend/app/services/chat_service.py:1767:        # 5) Pre-debit credits
backend/app/services/chat_service.py:1771:            estimated = credit_service.get_estimated_cost(effective_mode)
backend/app/services/chat_service.py:1772:            predebit_ledger_id = await credit_service.debit_credits(
backend/app/services/chat_service.py:1773:                db, user_id=user.id, cost=estimated,
backend/app/services/chat_service.py:1777:                pre_debited = estimated
backend/app/services/chat_service.py:1780:                balance = await credit_service.get_user_credits(db, user.id)
backend/app/services/chat_service.py:1783:                    "message": "Insufficient credits",
backend/app/services/chat_service.py:1784:                    "required": estimated,
backend/app/services/chat_service.py:1953:                        "Failed to refund pre-debited credits during continuation setup failure for user %s",

exec
/bin/zsh -lc "nl -ba backend/app/core/config.py | sed -n '1,180p'" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
     1	from __future__ import annotations
     2	
     3	from pathlib import Path
     4	from typing import Optional
     5	
     6	from pydantic import Field
     7	from pydantic_settings import BaseSettings, SettingsConfigDict
     8	
     9	
    10	class Settings(BaseSettings):
    11	    # OpenRouter — 统一 API 网关
    12	    OPENROUTER_API_KEY: Optional[str] = None
    13	    OPENROUTER_BASE_URL: str = Field(default="https://openrouter.ai/api/v1")
    14	
    15	    # DeepSeek official API — production chat modes
    16	    DEEPSEEK_API_KEY: Optional[str] = None
    17	    DEEPSEEK_BASE_URL: str = Field(default="https://api.deepseek.com")
    18	    DEEPSEEK_OFFICIAL_MODELS: list[str] = Field(default=[
    19	        "deepseek-v4-flash",
    20	        "deepseek-v4-pro",
    21	    ])
    22	
    23	    # Embedding — 模型与维度强绑定 (通过 OpenRouter 调用)
    24	    EMBEDDING_MODEL: str = Field(default="openai/text-embedding-3-small")
    25	    EMBEDDING_DIM: int = Field(default=1536)
    26	
    27	    # Qdrant
    28	    QDRANT_URL: str = Field(default="http://localhost:6333")
    29	    QDRANT_API_KEY: Optional[str] = None
    30	    QDRANT_COLLECTION: str = Field(default="doc_chunks")
    31	
    32	    # LLM defaults
    33	    LLM_MODEL: str = Field(default="deepseek-v4-pro")
    34	    ALLOWED_MODELS: list[str] = Field(default=[
    35	        "deepseek-v4-flash",
    36	        "deepseek-v4-pro",
    37	        "deepseek/deepseek-v3.2",
    38	        "mistralai/mistral-medium-3.1",
    39	        "mistralai/mistral-large-2512",
    40	        # Fallbacks
    41	        "qwen/qwen3-30b-a3b",
    42	        "mistralai/mistral-medium-3",
    43	        "openai/gpt-5.2",
    44	    ])
    45	
    46	    # Object Storage (MinIO local / S3-compatible in production)
    47	    MINIO_ENDPOINT: str = Field(default="localhost:9000")
    48	    MINIO_ACCESS_KEY: str = Field(default="minioadmin")
    49	    MINIO_SECRET_KEY: str = Field(default="minioadmin")
    50	    MINIO_BUCKET: str = Field(default="doctalk-pdfs")
    51	    MINIO_PRESIGN_TTL: int = Field(default=300)
    52	    MINIO_SECURE: bool = Field(default=False)
    53	    # Optional browser-facing endpoint used only for presigned file URLs.
    54	    # Server-side upload/download should use MINIO_ENDPOINT, preferably via
    55	    # Railway private networking in production.
    56	    MINIO_PUBLIC_ENDPOINT: Optional[str] = None
    57	
    58	    # Celery
    59	    CELERY_BROKER_URL: str = Field(default="redis://localhost:6379/0")
    60	    EMBED_BATCH_SIZE: int = Field(default=64)
    61	    EMBED_MAX_CONCURRENCY: int = Field(default=4)
    62	
    63	    # Limits
    64	    MAX_PDF_SIZE_MB: int = Field(default=50)
    65	    MAX_PDF_PAGES: int = Field(default=500)
    66	    MAX_CHAT_HISTORY_TURNS: int = Field(default=6)
    67	    MAX_RETRIEVAL_TOKENS: int = Field(default=1750)
    68	    LLM_MAX_CONTEXT_TOKENS: int = Field(default=180000)
    69	    MAX_CONTINUATIONS_PER_MESSAGE: int = 3
    70	
    71	    # Chat-native tool planning. The planner may call the low-latency chat
    72	    # model to classify ambiguous user requests, then falls back to the
    73	    # deterministic router when the model or provider is unavailable.
    74	    ACTION_PLANNER_USE_LLM: bool = Field(default=True)
    75	    ACTION_PLANNER_TIMEOUT_SECONDS: float = Field(default=3.0)
    76	
    77	    # Document Intelligence providers. Azure prebuilt-layout is the preferred
    78	    # provider for PDF layout/table extraction; PyMuPDF remains the safe local
    79	    # fallback when Azure is not configured or unavailable.
    80	    DOCUMENT_INTELLIGENCE_PROVIDER: str = Field(default="azure")
    81	    AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT: Optional[str] = None
    82	    AZURE_DOCUMENT_INTELLIGENCE_KEY: Optional[str] = None
    83	    DOCUMENT_INTELLIGENCE_TIMEOUT_SECONDS: int = Field(default=120)
    84	    DOCUMENT_INTELLIGENCE_FALLBACK_PROVIDER: str = Field(default="pymupdf")
    85	
    86	    # OCR
    87	    OCR_ENABLED: bool = Field(default=True)
    88	    OCR_LANGUAGES: str = Field(default="eng+chi_sim+jpn+kor+spa+deu+fra+por+ita+ara+hin")
    89	    OCR_DPI: int = Field(default=300)
    90	
    91	    # Multi-format support
    92	    ALLOWED_FILE_TYPES: list[str] = Field(default=[
    93	        'pdf', 'docx', 'pptx', 'xlsx', 'txt', 'md',
    94	    ])
    95	
    96	    # CORS
    97	    FRONTEND_URL: str = Field(default="http://localhost:3000")
    98	
    99	    # Optional DB URL placeholder for future use
   100	    DATABASE_URL: Optional[str] = None
   101	
   102	    # Auth
   103	    AUTH_SECRET: Optional[str] = None  # Shared with Next.js Auth.js
   104	    ADAPTER_SECRET: Optional[str] = None  # For internal adapter API calls
   105	
   106	    # Demo LLM — faster model for anonymous demo conversations
   107	    DEMO_LLM_MODEL: str = "deepseek-v4-flash"
   108	
   109	    # Mode-based model selection.
   110	    # Internal IDs are kept for backwards compatibility:
   111	    # quick = Flash, balanced = Pro.
   112	    MODE_MODELS: dict[str, str] = {
   113	        "quick": "deepseek-v4-flash",
   114	        "balanced": "deepseek-v4-pro",
   115	    }
   116	    MODE_CREDIT_MULTIPLIER: dict[str, float] = {
   117	        "quick": 1.0,
   118	        "balanced": 1.0,
   119	    }
   120	    PREMIUM_MODES: list[str] = Field(default=[])
   121	
   122	    # Sentry
   123	    SENTRY_DSN: Optional[str] = None
   124	    SENTRY_ENVIRONMENT: str = Field(default="production")
   125	    SENTRY_TRACES_SAMPLE_RATE: float = Field(default=0.1)
   126	
   127	    # Stripe
   128	    STRIPE_SECRET_KEY: Optional[str] = None
   129	    STRIPE_WEBHOOK_SECRET: Optional[str] = None
   130	    STRIPE_PRICE_BOOST: str = "price_boost"
   131	    STRIPE_PRICE_POWER: str = "price_power"
   132	    STRIPE_PRICE_ULTRA: str = "price_ultra"
   133	
   134	    # Credit amounts
   135	    CREDITS_BOOST: int = 500
   136	    CREDITS_POWER: int = 2000
   137	    CREDITS_ULTRA: int = 5000
   138	    SIGNUP_BONUS_CREDITS: int = 500
   139	    # Subscription tiers
   140	    PLAN_FREE_MONTHLY_CREDITS: int = 300
   141	    PLAN_PLUS_MONTHLY_CREDITS: int = 3000
   142	    PLAN_PRO_MONTHLY_CREDITS: int = 9000
   143	    # Legacy name kept for existing env vars; this now limits Free-plan Pro answers.
   144	    FREE_BALANCED_MONTHLY_LIMIT: int = 20
   145	    FREE_PRO_MONTHLY_LIMIT: Optional[int] = None
   146	    STRIPE_PRICE_PLUS_MONTHLY: str = ''
   147	    STRIPE_PRICE_PLUS_ANNUAL: str = ''
   148	    STRIPE_PRICE_PRO_MONTHLY: str = ''
   149	    STRIPE_PRICE_PRO_ANNUAL: str = ''
   150	
   151	    # Per-plan limits
   152	    FREE_MAX_DOCUMENTS: int = 3
   153	    PLUS_MAX_DOCUMENTS: int = 20
   154	    PRO_MAX_DOCUMENTS: int = 999
   155	    FREE_MAX_SESSIONS_PER_DOC: int = 3
   156	    FREE_MAX_FILE_SIZE_MB: int = 25
   157	    PLUS_MAX_FILE_SIZE_MB: int = 50
   158	    PRO_MAX_FILE_SIZE_MB: int = 100
   159	
   160	    # Collection limits per plan
   161	    FREE_MAX_COLLECTIONS: int = 1
   162	    PLUS_MAX_COLLECTIONS: int = 5
   163	    PRO_MAX_COLLECTIONS: int = 999
   164	    FREE_MAX_DOCS_PER_COLLECTION: int = 3
   165	    PLUS_MAX_DOCS_PER_COLLECTION: int = 10
   166	    PRO_MAX_DOCS_PER_COLLECTION: int = 999
   167	
   168	    # Admin access — comma-separated email list
   169	    ADMIN_EMAILS: str = ""
   170	
   171	    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", case_sensitive=False)
   172	
   173	
   174	# Try to load .env from backend/ or repo root for local dev
   175	_candidates = [Path(".env"), Path("..") / ".env"]
   176	_env_file = next((str(p) for p in _candidates if p.exists()), None)
   177	
   178	settings = Settings(_env_file=_env_file) if _env_file else Settings()
   179	
   180	# Reverse lookup: model → mode (for enforcing correct credit multiplier)

exec
/bin/zsh -lc "rg -n \"MODE_COSTS|MODE_MODELS|LLM_MODEL|quick|balanced\" backend/app/core/config.py backend/app -g '*.py' | head -n 160" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
backend/app/core/config.py:33:    LLM_MODEL: str = Field(default="deepseek-v4-pro")
backend/app/core/config.py:107:    DEMO_LLM_MODEL: str = "deepseek-v4-flash"
backend/app/core/config.py:111:    # quick = Flash, balanced = Pro.
backend/app/core/config.py:112:    MODE_MODELS: dict[str, str] = {
backend/app/core/config.py:113:        "quick": "deepseek-v4-flash",
backend/app/core/config.py:114:        "balanced": "deepseek-v4-pro",
backend/app/core/config.py:117:        "quick": 1.0,
backend/app/core/config.py:118:        "balanced": 1.0,
backend/app/core/config.py:181:MODEL_TO_MODE: dict[str, str] = {v: k for k, v in settings.MODE_MODELS.items()}
backend/app/services/document_brief_service.py:243:        self._map_model = map_model or settings.MODE_MODELS.get("quick", settings.LLM_MODEL)
backend/app/services/document_brief_service.py:244:        self._reduce_model = reduce_model or settings.MODE_MODELS.get("quick", settings.LLM_MODEL)
backend/app/services/extractors/docx_extractor.py:68:    # Build a lookup of table elements for quick access
backend/app/services/table_service.py:44:TABLE_RECONSTRUCTION_MODE = "balanced"
backend/app/services/table_service.py:45:TABLE_RECONSTRUCTION_MODEL = settings.MODE_MODELS.get(TABLE_RECONSTRUCTION_MODE, settings.LLM_MODEL)
backend/app/services/summary_service.py:29:BRIEF_MODEL = settings.MODE_MODELS.get("quick", settings.LLM_MODEL)
backend/app/services/action_planner.py:296:        model = settings.MODE_MODELS.get("quick", settings.LLM_MODEL)
backend/app/services/credit_service.py:37:# Internal mode IDs are kept for compatibility: quick=Flash, balanced=Pro.
backend/app/services/credit_service.py:38:MODE_ESTIMATED_COST: dict[str, int] = {"quick": 5, "balanced": 15}
backend/app/services/credit_service.py:43:    return MODE_ESTIMATED_COST.get(mode, MODE_ESTIMATED_COST["balanced"])
backend/app/services/credit_service.py:53:    multiplier = settings.MODE_CREDIT_MULTIPLIER.get(mode or "balanced", 1.0)
backend/app/services/document_diff_service.py:38:DOCUMENT_DIFF_MODE = "balanced"
backend/app/services/document_diff_service.py:39:DOCUMENT_DIFF_MODEL = settings.MODE_MODELS.get(DOCUMENT_DIFF_MODE, settings.LLM_MODEL)
backend/app/services/corrective_retrieval_service.py:52:    balanced: list[dict],
backend/app/services/corrective_retrieval_service.py:62:    if balanced:
backend/app/services/corrective_retrieval_service.py:63:        parts.append("balanced_compare")
backend/app/services/corrective_retrieval_service.py:219:        balanced_required: list[dict] = []
backend/app/services/corrective_retrieval_service.py:220:        balanced_extra: list[dict] = []
backend/app/services/corrective_retrieval_service.py:221:        if plan.needs_balanced_coverage:
backend/app/services/corrective_retrieval_service.py:223:                label = f"balanced-doc-{index}"
backend/app/services/corrective_retrieval_service.py:232:                    balanced_required.append(annotated[0])
backend/app/services/corrective_retrieval_service.py:233:                    balanced_extra.extend(annotated[1:])
backend/app/services/corrective_retrieval_service.py:234:        return planned, balanced_required, balanced_extra
backend/app/services/corrective_retrieval_service.py:300:            balanced=[],
backend/app/services/corrective_retrieval_service.py:327:        planned, balanced_required, balanced_extra = await self._planned_multi(query, plan, route, document_ids, db=db)
backend/app/services/corrective_retrieval_service.py:328:        balanced_all = [*balanced_required, *balanced_extra]
backend/app/services/corrective_retrieval_service.py:329:        if not initial_eval.should_correct and not table_evidence and not planned and not balanced_all:
backend/app/services/corrective_retrieval_service.py:352:            _merge_results(balanced_required, table_evidence, top_k=result_limit)
backend/app/services/corrective_retrieval_service.py:353:            if balanced_required
backend/app/services/corrective_retrieval_service.py:356:        merged = _merge_results(merged, balanced_extra, top_k=result_limit)
backend/app/services/corrective_retrieval_service.py:363:            balanced=balanced_all,
backend/app/services/chat_service.py:512:    balanced = (
backend/app/services/chat_service.py:514:        if plan.needs_balanced_coverage
backend/app/services/chat_service.py:520:        f"{balanced}"
backend/app/services/chat_service.py:975:        effective_mode = mode if mode in settings.MODE_MODELS else "balanced"
backend/app/services/chat_service.py:976:        effective_model = settings.MODE_MODELS[effective_mode]
backend/app/services/chat_service.py:980:            effective_model = settings.DEMO_LLM_MODEL
backend/app/services/chat_service.py:981:            effective_mode = "quick"
backend/app/services/chat_service.py:1747:        effective_mode = mode if mode in settings.MODE_MODELS else "balanced"
backend/app/services/chat_service.py:1748:        effective_model = settings.MODE_MODELS[effective_mode]
backend/app/services/chat_service.py:1751:            effective_model = settings.DEMO_LLM_MODEL
backend/app/services/chat_service.py:1752:            effective_mode = "quick"
backend/app/services/extraction_service.py:36:EXTRACTION_MODE = "balanced"
backend/app/services/extraction_service.py:37:EXTRACTION_MODEL = settings.MODE_MODELS.get(EXTRACTION_MODE, settings.LLM_MODEL)
backend/app/services/query_planner_service.py:19:    needs_balanced_coverage: bool
backend/app/services/query_planner_service.py:24:        return len(self.steps) > 1 or self.needs_balanced_coverage
backend/app/services/query_planner_service.py:144:            return QueryPlan(steps=(), needs_balanced_coverage=False, reason="empty")
backend/app/services/query_planner_service.py:159:        needs_balanced_coverage = bool(is_comparison and document_count > 1)
backend/app/services/query_planner_service.py:160:        if not needs_planning and not needs_balanced_coverage:
backend/app/services/query_planner_service.py:163:                needs_balanced_coverage=False,
backend/app/services/query_planner_service.py:213:        if needs_balanced_coverage:
backend/app/services/query_planner_service.py:214:            reason = f"{reason}+balanced-doc-coverage"
backend/app/services/query_planner_service.py:217:            needs_balanced_coverage=needs_balanced_coverage,
backend/app/core/config.py:33:    LLM_MODEL: str = Field(default="deepseek-v4-pro")
backend/app/core/config.py:107:    DEMO_LLM_MODEL: str = "deepseek-v4-flash"
backend/app/core/config.py:111:    # quick = Flash, balanced = Pro.
backend/app/core/config.py:112:    MODE_MODELS: dict[str, str] = {
backend/app/core/config.py:113:        "quick": "deepseek-v4-flash",
backend/app/core/config.py:114:        "balanced": "deepseek-v4-pro",
backend/app/core/config.py:117:        "quick": 1.0,
backend/app/core/config.py:118:        "balanced": 1.0,
backend/app/core/config.py:181:MODEL_TO_MODE: dict[str, str] = {v: k for k, v in settings.MODE_MODELS.items()}
backend/app/schemas/chat.py:12:    mode: Optional[Literal["quick", "balanced", "thorough"]] = None
backend/app/schemas/chat.py:19:    mode: Optional[Literal["quick", "balanced", "thorough"]] = None
backend/app/api/users.py:220:    mode_order = {"quick": 0, "balanced": 1, "thorough": 2}
backend/app/api/chat.py:79:    effective_mode = mode if mode in settings.MODE_MODELS else "balanced"
backend/app/api/chat.py:80:    # Internal "balanced" now maps to the visible Pro mode.
backend/app/api/chat.py:81:    if effective_mode != "balanced":
backend/app/api/chat.py:97:    pro_model = settings.MODE_MODELS["balanced"]
backend/app/api/chat.py:112:                "mode": "balanced",
backend/app/api/chat.py:360:        effective_mode = body.mode or "balanced"
backend/app/api/chat.py:495:        effective_mode = body.mode or "balanced"
backend/app/api/admin.py:74:    "balanced_mode": "Pro analysis mode selected",
backend/app/api/admin.py:75:    "quick_mode": "Flash mode selected",

exec
/bin/zsh -lc "nl -ba backend/app/services/chat_service.py | sed -n '1578,1615p'" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
  1578	            except Exception:
  1579	                await db.rollback()
  1580	                yield sse("error", {"code": "PERSIST_FAILED", "message": "Failed to save response"})
  1581	                return
  1582	
  1583	            await _record_rag_verification_event(
  1584	                db,
  1585	                user=user,
  1586	                message_id=getattr(asst_msg, "id", None),
  1587	                verification=verification_payload,
  1588	                retrieval_strategy=retrieval_strategy,
  1589	                query_route=query_route,
  1590	                retrieved_count=len(chunk_map),
  1591	                repair_metadata=repair_metadata,
  1592	            )
  1593	
  1594	            # Credits: reconcile pre-debited estimate against actual cost
  1595	            if user is not None and pre_debited > 0 and predebit_ledger_id is not None:
  1596	                pt = int(prompt_tokens or 0)
  1597	                ct = int(output_tokens or 0)
  1598	                try:
  1599	                    actual_cost = credit_service.calculate_cost(pt, ct, effective_model, mode=effective_mode)
  1600	                    await credit_service.reconcile_credits(
  1601	                        db, user.id, predebit_ledger_id, pre_debited, actual_cost,
  1602	                    )
  1603	                    await credit_service.record_usage(
  1604	                        db,
  1605	                        user_id=user.id,
  1606	                        message_id=asst_msg.id,
  1607	                        model=effective_model,
  1608	                        prompt_tokens=pt,
  1609	                        completion_tokens=ct,
  1610	                        cost_credits=actual_cost,
  1611	                    )
  1612	                    await db.commit()
  1613	                    settled = True
  1614	                except Exception as e:
  1615	                    # Non-fatal accounting error

exec
/bin/zsh -lc "nl -ba backend/app/services/chat_service.py | sed -n '80,135p'" in /Users/mayijie/Projects/Code/010_DocTalk
exec
/bin/zsh -lc "nl -ba backend/app/services/chat_service.py | sed -n '120,194p'" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
   120	    return None
   121	
   122	
   123	def _continuation_prompt(locale: Optional[str], existing_response: Optional[str]) -> str:
   124	    language = _continuation_language_label(locale, existing_response)
   125	    target = f" Continue in {language}." if language else ""
   126	    return (
   127	        "Continue exactly from where the previous assistant response stopped. "
   128	        "Do not repeat content."
   129	        f"{target} "
   130	        "The previous assistant response, not this control instruction, determines the answer language. "
   131	        "Do not switch languages because this continuation instruction is written in English."
   132	    )
   133	
   134	
   135	def _continuation_system_rule(locale: Optional[str], existing_response: Optional[str]) -> str:
   136	    language = _continuation_language_label(locale, existing_response)
   137	    target = f" The target language is {language}." if language else ""
   138	    return (
   139	        "## Continuation Rule\n"
   140	        "The final user message is only a continuation control signal, not a new question. "
   141	        "Continue the existing assistant answer in the same language and style already used."
   142	        f"{target} "
   143	        "Do not translate, restart, summarize, or switch to English.\n"
   144	    )
   145	
   146	
   147	def _get_openai_client() -> AsyncOpenAI:
   148	    global _openai_client
   149	    if _openai_client is None:
   150	        _openai_client = AsyncOpenAI(
   151	            api_key=settings.OPENROUTER_API_KEY,
   152	            base_url=settings.OPENROUTER_BASE_URL,
   153	            default_headers={
   154	                "HTTP-Referer": settings.FRONTEND_URL,
   155	                "X-Title": "DocTalk",
   156	            },
   157	        )
   158	    return _openai_client
   159	
   160	
   161	def _is_deepseek_official_model(model: str) -> bool:
   162	    return model in settings.DEEPSEEK_OFFICIAL_MODELS
   163	
   164	
   165	def _get_deepseek_client() -> AsyncOpenAI:
   166	    global _deepseek_client
   167	    if not settings.DEEPSEEK_API_KEY:
   168	        raise RuntimeError("DEEPSEEK_API_KEY is not configured")
   169	    if _deepseek_client is None:
   170	        _deepseek_client = AsyncOpenAI(
   171	            api_key=settings.DEEPSEEK_API_KEY,
   172	            base_url=settings.DEEPSEEK_BASE_URL,
   173	        )
   174	    return _deepseek_client
   175	
   176	
   177	def _get_llm_client(model: str) -> AsyncOpenAI:
   178	    if _is_deepseek_official_model(model):
   179	        return _get_deepseek_client()
   180	    return _get_openai_client()
   181	
   182	
   183	def _apply_provider_options(create_kwargs: dict[str, Any], model: str) -> None:
   184	    """Apply provider-specific body options.
   185	
   186	    DeepSeek V4 defaults to thinking enabled. DocTalk's interactive Flash/Pro
   187	    modes are the non-thinking variants unless a future product surface enables
   188	    a separately priced reasoning path.
   189	    """
   190	    if _is_deepseek_official_model(model):
   191	        create_kwargs["extra_body"] = {"thinking": {"type": "disabled"}}
   192	
   193	
   194	def _is_valid_bbox(bb: dict) -> bool:

 succeeded in 0ms:
    80	
    81	
    82	_openai_client: AsyncOpenAI | None = None
    83	_deepseek_client: AsyncOpenAI | None = None
    84	
    85	_LOCALE_LANGUAGE_LABELS = {
    86	    "en": "English",
    87	    "zh": "Chinese",
    88	    "ja": "Japanese",
    89	    "ko": "Korean",
    90	    "es": "Spanish",
    91	    "de": "German",
    92	    "fr": "French",
    93	    "pt": "Portuguese",
    94	    "it": "Italian",
    95	    "ar": "Arabic",
    96	    "hi": "Hindi",
    97	}
    98	
    99	
   100	def _normalize_locale(locale: Optional[str]) -> str:
   101	    return (locale or "").strip().lower().replace("_", "-").split("-")[0]
   102	
   103	
   104	def _continuation_language_label(locale: Optional[str], existing_response: Optional[str]) -> Optional[str]:
   105	    normalized = _normalize_locale(locale)
   106	    if normalized in _LOCALE_LANGUAGE_LABELS:
   107	        return _LOCALE_LANGUAGE_LABELS[normalized]
   108	
   109	    text = existing_response or ""
   110	    if re.search(r"[\u3040-\u30ff]", text):
   111	        return "Japanese"
   112	    if re.search(r"[\uac00-\ud7af]", text):
   113	        return "Korean"
   114	    if re.search(r"[\u4e00-\u9fff]", text):
   115	        return "Chinese"
   116	    if re.search(r"[\u0600-\u06ff]", text):
   117	        return "Arabic"
   118	    if re.search(r"[\u0900-\u097f]", text):
   119	        return "Hindi"
   120	    return None
   121	
   122	
   123	def _continuation_prompt(locale: Optional[str], existing_response: Optional[str]) -> str:
   124	    language = _continuation_language_label(locale, existing_response)
   125	    target = f" Continue in {language}." if language else ""
   126	    return (
   127	        "Continue exactly from where the previous assistant response stopped. "
   128	        "Do not repeat content."
   129	        f"{target} "
   130	        "The previous assistant response, not this control instruction, determines the answer language. "
   131	        "Do not switch languages because this continuation instruction is written in English."
   132	    )
   133	
   134	
   135	def _continuation_system_rule(locale: Optional[str], existing_response: Optional[str]) -> str:

exec
/bin/zsh -lc 'rg -n "free|FREE|monthly|limit|PREMIUM|mode" backend/app/api/chat.py backend/app/services/chat_service.py backend/app/services/auth_service.py backend/app/api/users.py | head -n 160' in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
backend/app/services/auth_service.py:14:from app.models.tables import Account, CreditLedger, User, VerificationToken
backend/app/services/auth_service.py:53:        monthly_credits_granted_at=datetime.now(timezone.utc),
backend/app/api/users.py:21:from app.models.tables import (
backend/app/api/users.py:59:        limit=10,
backend/app/api/users.py:67:@router.get("/me", response_model=UserMeResponse)
backend/app/api/users.py:78:@router.get("/profile", response_model=UserProfileResponse)
backend/app/api/users.py:144:                # Account model has no created_at column; return None for compatibility
backend/app/api/users.py:163:    plan = (user.plan or "free").lower()
backend/app/api/users.py:165:        monthly_allowance = int(settings.PLAN_PRO_MONTHLY_CREDITS or 0)
backend/app/api/users.py:167:        monthly_allowance = int(settings.PLAN_PLUS_MONTHLY_CREDITS or 0)
backend/app/api/users.py:169:        monthly_allowance = int(settings.PLAN_FREE_MONTHLY_CREDITS or 0)
backend/app/api/users.py:181:        "monthly_allowance": monthly_allowance,
backend/app/api/users.py:182:        "monthly_credits_granted_at": user.monthly_credits_granted_at.isoformat()
backend/app/api/users.py:183:        if user.monthly_credits_granted_at
backend/app/api/users.py:192:@router.get("/usage-breakdown", response_model=UsageBreakdownResponse)
backend/app/api/users.py:199:            UsageRecord.model.label("model"),
backend/app/api/users.py:204:        .group_by(UsageRecord.model)
backend/app/api/users.py:208:    # Aggregate by mode
backend/app/api/users.py:209:    mode_agg: dict[str, dict] = {}
backend/app/api/users.py:211:        mode = MODEL_TO_MODE.get(r.model, "other")
backend/app/api/users.py:212:        if mode not in mode_agg:
backend/app/api/users.py:213:            mode_agg[mode] = {"total_calls": 0, "total_credits": 0}
backend/app/api/users.py:214:        mode_agg[mode]["total_calls"] += int(r.total_calls or 0)
backend/app/api/users.py:215:        mode_agg[mode]["total_credits"] += int(r.total_credits or 0)
backend/app/api/users.py:217:    grand_total_credits = sum(m["total_credits"] for m in mode_agg.values())
backend/app/api/users.py:219:    # Sort order: current modes first, legacy Thorough next, then "other" last.
backend/app/api/users.py:220:    mode_order = {"quick": 0, "balanced": 1, "thorough": 2}
backend/app/api/users.py:221:    sorted_modes = sorted(mode_agg.keys(), key=lambda m: mode_order.get(m, 99))
backend/app/api/users.py:224:        "by_mode": [
backend/app/api/users.py:226:                "mode": mode,
backend/app/api/users.py:227:                "total_calls": mode_agg[mode]["total_calls"],
backend/app/api/users.py:228:                "total_credits": mode_agg[mode]["total_credits"],
backend/app/api/users.py:229:                "avg_credits_per_chat": round(mode_agg[mode]["total_credits"] / mode_agg[mode]["total_calls"])
backend/app/api/users.py:230:                if mode_agg[mode]["total_calls"] > 0
backend/app/api/users.py:232:                "share": round(mode_agg[mode]["total_credits"] / grand_total_credits * 100, 1)
backend/app/api/users.py:236:            for mode in sorted_modes
backend/app/api/users.py:241:_export_rate_limit: dict[str, float] = {}  # user_id -> last export timestamp
backend/app/api/users.py:253:    last_export = _export_rate_limit.get(uid, 0)
backend/app/api/users.py:321:        .limit(1000)
backend/app/api/users.py:341:    _export_rate_limit[uid] = now
backend/app/api/users.py:352:@router.delete("/me", response_model=DeletedResponse)
backend/app/services/chat_service.py:18:from app.core.model_profiles import get_model_profile, get_rules_for_model
backend/app/services/chat_service.py:19:from app.models.database import AsyncSessionLocal
backend/app/services/chat_service.py:20:from app.models.tables import (
backend/app/services/chat_service.py:161:def _is_deepseek_official_model(model: str) -> bool:
backend/app/services/chat_service.py:162:    return model in settings.DEEPSEEK_OFFICIAL_MODELS
backend/app/services/chat_service.py:177:def _get_llm_client(model: str) -> AsyncOpenAI:
backend/app/services/chat_service.py:178:    if _is_deepseek_official_model(model):
backend/app/services/chat_service.py:183:def _apply_provider_options(create_kwargs: dict[str, Any], model: str) -> None:
backend/app/services/chat_service.py:187:    modes are the non-thinking variants unless a future product surface enables
backend/app/services/chat_service.py:190:    if _is_deepseek_official_model(model):
backend/app/services/chat_service.py:263:def _citation_anchor_offsets(text: str, *, limit: int = 8) -> list[tuple[int, str]]:
backend/app/services/chat_service.py:274:        if len(anchors) >= limit:
backend/app/services/chat_service.py:288:    limit: int = 8,
backend/app/services/chat_service.py:291:    """Create deterministic citations when the model forgets bracket refs.
backend/app/services/chat_service.py:293:    The primary path is still model-authored [n] markers. This fallback prevents
backend/app/services/chat_service.py:295:    succeeded but the model omitted markers.
backend/app/services/chat_service.py:307:    for offset, anchor_text in _citation_anchor_offsets(assistant_text, limit=limit):
backend/app/services/chat_service.py:376:    model: str,
backend/app/services/chat_service.py:423:            "model": model,
backend/app/services/chat_service.py:432:        _apply_provider_options(create_kwargs, model)
backend/app/services/chat_service.py:626:    model: str,
backend/app/services/chat_service.py:627:    mode: str,
backend/app/services/chat_service.py:634:                model,
backend/app/services/chat_service.py:635:                mode=mode,
backend/app/services/chat_service.py:654:    limit: int = 12,
backend/app/services/chat_service.py:668:        .limit(limit)
backend/app/services/chat_service.py:859:        domain_mode: Optional[str],
backend/app/services/chat_service.py:879:                domain_mode=domain_mode,
backend/app/services/chat_service.py:926:        mode: Optional[str] = None,
backend/app/services/chat_service.py:927:        domain_mode: Optional[str] = None,
backend/app/services/chat_service.py:974:        # Resolve mode → model (mode is the ONLY way to select a model)
backend/app/services/chat_service.py:975:        effective_mode = mode if mode in settings.MODE_MODELS else "balanced"
backend/app/services/chat_service.py:976:        effective_model = settings.MODE_MODELS[effective_mode]
backend/app/services/chat_service.py:978:        # Force demo model for anonymous users on demo documents
backend/app/services/chat_service.py:980:            effective_model = settings.DEMO_LLM_MODEL
backend/app/services/chat_service.py:981:            effective_mode = "quick"
backend/app/services/chat_service.py:983:        # Premium mode gating: require Plus or Pro plan
backend/app/services/chat_service.py:984:        if effective_mode in settings.PREMIUM_MODES:
backend/app/services/chat_service.py:985:            user_plan = (user.plan or "free").lower() if user else "free"
backend/app/services/chat_service.py:986:            if user_plan == "free":
backend/app/services/chat_service.py:991:                        "message": "Upgrade to Plus to use this mode",
backend/app/services/chat_service.py:1009:                domain_mode=domain_mode,
backend/app/services/chat_service.py:1020:            domain_mode=domain_mode,
backend/app/services/chat_service.py:1023:        # Pre-debit estimated credits BEFORE streaming (prevents TOCTOU + free rides)
backend/app/services/chat_service.py:1027:            estimated = credit_service.get_estimated_cost(effective_mode)
backend/app/services/chat_service.py:1032:                reason="chat", ref_type="mode", ref_id=effective_mode,
backend/app/services/chat_service.py:1067:                .limit(max_msgs + 1)
backend/app/services/chat_service.py:1193:            rules = get_rules_for_model(
backend/app/services/chat_service.py:1194:                effective_model, is_collection=is_collection_session
backend/app/services/chat_service.py:1273:            # Inject domain-specific rules (legal/academic mode overlay)
backend/app/services/chat_service.py:1274:            # Frontend always sends domain_mode: null (default) or "legal"/"academic"
backend/app/services/chat_service.py:1275:            # domain_mode=None means Default (no extra rules), string means apply rules
backend/app/services/chat_service.py:1276:            if domain_mode:
backend/app/services/chat_service.py:1277:                from app.core.model_profiles import DOMAIN_RULES
backend/app/services/chat_service.py:1278:                domain_rules = DOMAIN_RULES.get(domain_mode)
backend/app/services/chat_service.py:1281:                    domain_rules_text = f"\n\n## {domain_mode.title()} Mode Rules\n"
backend/app/services/chat_service.py:1286:            # Persist domain_mode to session (null clears, string sets)
backend/app/services/chat_service.py:1287:            if domain_mode != session_obj.domain_mode:
backend/app/services/chat_service.py:1288:                session_obj.domain_mode = domain_mode
backend/app/services/chat_service.py:1303:                                model=effective_model,
backend/app/services/chat_service.py:1304:                                mode=effective_mode,
backend/app/services/chat_service.py:1330:            client = _get_llm_client(effective_model)
backend/app/services/chat_service.py:1345:        # cache_control is Anthropic-specific — only include for Anthropic models
backend/app/services/chat_service.py:1346:        profile = get_model_profile(effective_model)
backend/app/services/chat_service.py:1381:                    "model": effective_model,
backend/app/services/chat_service.py:1389:                _apply_provider_options(create_kwargs, effective_model)
backend/app/services/chat_service.py:1400:                            logger.info("LLM first_token_latency=%.2fs model=%s", latency, effective_model)
backend/app/services/chat_service.py:1435:                            "LLM emitted no citation markers; generated %d fallback citations model=%s",
backend/app/services/chat_service.py:1437:                            effective_model,
backend/app/services/chat_service.py:1443:                # Warn if response was truncated due to token limit
backend/app/services/chat_service.py:1446:                        "LLM response truncated (finish_reason=length) model=%s max_tokens=%d output_tokens=%s",
backend/app/services/chat_service.py:1447:                        effective_model, profile.max_tokens, output_tokens,
backend/app/services/chat_service.py:1454:                    "LLM total_latency=%.2fs tokens=%d model=%s",
backend/app/services/chat_service.py:1457:                    effective_model,
backend/app/services/chat_service.py:1525:                    model=effective_model,
backend/app/services/chat_service.py:1599:                    actual_cost = credit_service.calculate_cost(pt, ct, effective_model, mode=effective_mode)
backend/app/services/chat_service.py:1607:                        model=effective_model,
backend/app/services/chat_service.py:1669:                                model=effective_model,
backend/app/services/chat_service.py:1670:                                mode=effective_mode,
backend/app/services/chat_service.py:1688:        mode: Optional[str] = None,
backend/app/services/chat_service.py:1708:            from app.models.tables import collection_documents as cd_table
backend/app/services/chat_service.py:1729:                .limit(1)
backend/app/services/chat_service.py:1741:        # 3) Check continuation limit
backend/app/services/chat_service.py:1746:        # 4) Resolve mode → model
backend/app/services/chat_service.py:1747:        effective_mode = mode if mode in settings.MODE_MODELS else "balanced"
backend/app/services/chat_service.py:1748:        effective_model = settings.MODE_MODELS[effective_mode]
backend/app/services/chat_service.py:1751:            effective_model = settings.DEMO_LLM_MODEL
backend/app/services/chat_service.py:1752:            effective_mode = "quick"
backend/app/services/chat_service.py:1754:        if effective_mode in settings.PREMIUM_MODES:
backend/app/services/chat_service.py:1755:            user_plan = (user.plan or "free").lower() if user else "free"
backend/app/services/chat_service.py:1756:            if user_plan == "free":
backend/app/services/chat_service.py:1761:                        "message": "Upgrade to Plus to use this mode",
backend/app/services/chat_service.py:1771:            estimated = credit_service.get_estimated_cost(effective_mode)
backend/app/services/chat_service.py:1774:                reason="chat", ref_type="mode", ref_id=effective_mode,
backend/app/services/chat_service.py:1862:                .limit(max_msgs + 1)
backend/app/services/chat_service.py:1889:            rules = get_rules_for_model(
backend/app/services/chat_service.py:1890:                effective_model, is_collection=is_collection_session
backend/app/services/chat_service.py:1934:                                model=effective_model,
backend/app/services/chat_service.py:1935:                                mode=effective_mode,
backend/app/services/chat_service.py:1961:            client = _get_llm_client(effective_model)
backend/app/services/chat_service.py:1974:        profile = get_model_profile(effective_model)
backend/app/services/chat_service.py:2003:                    "model": effective_model,
backend/app/services/chat_service.py:2011:                _apply_provider_options(create_kwargs, effective_model)
backend/app/services/chat_service.py:2050:                            "LLM emitted no continuation citation markers; generated %d fallback citations model=%s",
backend/app/services/chat_service.py:2052:                            effective_model,
backend/app/services/chat_service.py:2123:                    model=effective_model,
backend/app/services/chat_service.py:2193:                    actual_cost = credit_service.calculate_cost(pt, ct, effective_model, mode=effective_mode)
backend/app/services/chat_service.py:2201:                        model=effective_model,
backend/app/services/chat_service.py:2261:                                model=effective_model,
backend/app/services/chat_service.py:2262:                                mode=effective_mode,
backend/app/api/chat.py:16:from app.core.rate_limit import (
backend/app/api/chat.py:17:    auth_chat_limiter,
backend/app/api/chat.py:18:    demo_chat_limiter,
backend/app/api/chat.py:20:    demo_session_create_limiter,
backend/app/api/chat.py:24:from app.models.tables import (
backend/app/api/chat.py:74:async def enforce_free_mode_limits(db: AsyncSession, user: User, mode: Optional[str]) -> None:
backend/app/api/chat.py:75:    """Limit Free-plan access to higher-cost modes without adding a new table."""
backend/app/api/chat.py:76:    if (user.plan or "free").lower() != "free":
backend/app/api/chat.py:79:    effective_mode = mode if mode in settings.MODE_MODELS else "balanced"

exec
/bin/zsh -lc "rg -n \"def _get_llm_client|OpenAI|DEEPSEEK|OPENROUTER|base_url|response_format|extra_body\" backend/app/services/chat_service.py backend/app/services -g '*.py'" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
backend/app/services/chat_service.py:13:from openai import AsyncOpenAI
backend/app/services/chat_service.py:82:_openai_client: AsyncOpenAI | None = None
backend/app/services/chat_service.py:83:_deepseek_client: AsyncOpenAI | None = None
backend/app/services/chat_service.py:147:def _get_openai_client() -> AsyncOpenAI:
backend/app/services/chat_service.py:150:        _openai_client = AsyncOpenAI(
backend/app/services/chat_service.py:151:            api_key=settings.OPENROUTER_API_KEY,
backend/app/services/chat_service.py:152:            base_url=settings.OPENROUTER_BASE_URL,
backend/app/services/chat_service.py:162:    return model in settings.DEEPSEEK_OFFICIAL_MODELS
backend/app/services/chat_service.py:165:def _get_deepseek_client() -> AsyncOpenAI:
backend/app/services/chat_service.py:167:    if not settings.DEEPSEEK_API_KEY:
backend/app/services/chat_service.py:168:        raise RuntimeError("DEEPSEEK_API_KEY is not configured")
backend/app/services/chat_service.py:170:        _deepseek_client = AsyncOpenAI(
backend/app/services/chat_service.py:171:            api_key=settings.DEEPSEEK_API_KEY,
backend/app/services/chat_service.py:172:            base_url=settings.DEEPSEEK_BASE_URL,
backend/app/services/chat_service.py:177:def _get_llm_client(model: str) -> AsyncOpenAI:
backend/app/services/chat_service.py:191:        create_kwargs["extra_body"] = {"thinking": {"type": "disabled"}}
backend/app/services/chat_service.py:1328:        # 6) Stream from the configured OpenAI-compatible LLM provider
backend/app/services/chat_service.py:1344:        # Build OpenAI-format messages (system + history)
backend/app/services/document_brief_service.py:363:            "response_format": {"type": "json_object"},
backend/app/services/table_service.py:15:from openai import OpenAI
backend/app/services/table_service.py:96:    return model in settings.DEEPSEEK_OFFICIAL_MODELS
backend/app/services/table_service.py:99:def _get_llm_client(model: str) -> OpenAI:
backend/app/services/table_service.py:101:        if not settings.DEEPSEEK_API_KEY:
backend/app/services/table_service.py:102:            raise RuntimeError("DEEPSEEK_API_KEY is not configured")
backend/app/services/table_service.py:103:        return OpenAI(api_key=settings.DEEPSEEK_API_KEY, base_url=settings.DEEPSEEK_BASE_URL)
backend/app/services/table_service.py:104:    if not settings.OPENROUTER_API_KEY:
backend/app/services/table_service.py:105:        raise RuntimeError("OPENROUTER_API_KEY is not configured")
backend/app/services/table_service.py:106:    return OpenAI(api_key=settings.OPENROUTER_API_KEY, base_url=settings.OPENROUTER_BASE_URL)
backend/app/services/table_service.py:111:        kwargs["extra_body"] = {"thinking": {"type": "disabled"}}
backend/app/services/table_service.py:112:        kwargs["response_format"] = {"type": "json_object"}
backend/app/services/summary_service.py:3:Runs in Celery worker context with synchronous DB and OpenAI-compatible clients.
backend/app/services/summary_service.py:16:from openai import OpenAI
backend/app/services/summary_service.py:69:    return model in settings.DEEPSEEK_OFFICIAL_MODELS
backend/app/services/summary_service.py:72:def _get_llm_client(model: str) -> OpenAI | None:
backend/app/services/summary_service.py:74:        if not settings.DEEPSEEK_API_KEY:
backend/app/services/summary_service.py:76:        return OpenAI(api_key=settings.DEEPSEEK_API_KEY, base_url=settings.DEEPSEEK_BASE_URL)
backend/app/services/summary_service.py:77:    if not settings.OPENROUTER_API_KEY:
backend/app/services/summary_service.py:79:    return OpenAI(api_key=settings.OPENROUTER_API_KEY, base_url=settings.OPENROUTER_BASE_URL)
backend/app/services/summary_service.py:84:        kwargs["extra_body"] = {"thinking": {"type": "disabled"}}
backend/app/services/action_planner.py:11:from openai import AsyncOpenAI
backend/app/services/action_planner.py:270:    def _client_for_model(self, model: str) -> AsyncOpenAI | None:
backend/app/services/action_planner.py:271:        if model in settings.DEEPSEEK_OFFICIAL_MODELS and settings.DEEPSEEK_API_KEY:
backend/app/services/action_planner.py:272:            return AsyncOpenAI(api_key=settings.DEEPSEEK_API_KEY, base_url=settings.DEEPSEEK_BASE_URL)
backend/app/services/action_planner.py:273:        if settings.OPENROUTER_API_KEY:
backend/app/services/action_planner.py:274:            return AsyncOpenAI(api_key=settings.OPENROUTER_API_KEY, base_url=settings.OPENROUTER_BASE_URL)
backend/app/services/embedding_service.py:9:from openai import OpenAI
backend/app/services/embedding_service.py:22:    - Provides batch embedding via OpenRouter (OpenAI-compatible)
backend/app/services/embedding_service.py:29:        self._client: Optional[OpenAI] = None
backend/app/services/embedding_service.py:33:    def _get_client(self) -> OpenAI:
backend/app/services/embedding_service.py:34:        if not settings.OPENROUTER_API_KEY:
backend/app/services/embedding_service.py:35:            raise RuntimeError("OPENROUTER_API_KEY is not configured")
backend/app/services/embedding_service.py:39:                    self._client = OpenAI(
backend/app/services/embedding_service.py:40:                        api_key=settings.OPENROUTER_API_KEY,
backend/app/services/embedding_service.py:41:                        base_url=settings.OPENROUTER_BASE_URL,
backend/app/services/chat_service.py:13:from openai import AsyncOpenAI
backend/app/services/chat_service.py:82:_openai_client: AsyncOpenAI | None = None
backend/app/services/chat_service.py:83:_deepseek_client: AsyncOpenAI | None = None
backend/app/services/chat_service.py:147:def _get_openai_client() -> AsyncOpenAI:
backend/app/services/chat_service.py:150:        _openai_client = AsyncOpenAI(
backend/app/services/chat_service.py:151:            api_key=settings.OPENROUTER_API_KEY,
backend/app/services/chat_service.py:152:            base_url=settings.OPENROUTER_BASE_URL,
backend/app/services/chat_service.py:162:    return model in settings.DEEPSEEK_OFFICIAL_MODELS
backend/app/services/chat_service.py:165:def _get_deepseek_client() -> AsyncOpenAI:
backend/app/services/chat_service.py:167:    if not settings.DEEPSEEK_API_KEY:
backend/app/services/chat_service.py:168:        raise RuntimeError("DEEPSEEK_API_KEY is not configured")
backend/app/services/chat_service.py:170:        _deepseek_client = AsyncOpenAI(
backend/app/services/chat_service.py:171:            api_key=settings.DEEPSEEK_API_KEY,
backend/app/services/chat_service.py:172:            base_url=settings.DEEPSEEK_BASE_URL,
backend/app/services/chat_service.py:177:def _get_llm_client(model: str) -> AsyncOpenAI:
backend/app/services/chat_service.py:191:        create_kwargs["extra_body"] = {"thinking": {"type": "disabled"}}
backend/app/services/chat_service.py:1328:        # 6) Stream from the configured OpenAI-compatible LLM provider
backend/app/services/chat_service.py:1344:        # Build OpenAI-format messages (system + history)
backend/app/services/extraction_service.py:14:from openai import OpenAI
backend/app/services/extraction_service.py:115:    return model in settings.DEEPSEEK_OFFICIAL_MODELS
backend/app/services/extraction_service.py:118:def _get_llm_client(model: str) -> OpenAI:
backend/app/services/extraction_service.py:120:        if not settings.DEEPSEEK_API_KEY:
backend/app/services/extraction_service.py:121:            raise RuntimeError("DEEPSEEK_API_KEY is not configured")
backend/app/services/extraction_service.py:122:        return OpenAI(api_key=settings.DEEPSEEK_API_KEY, base_url=settings.DEEPSEEK_BASE_URL)
backend/app/services/extraction_service.py:123:    if not settings.OPENROUTER_API_KEY:
backend/app/services/extraction_service.py:124:        raise RuntimeError("OPENROUTER_API_KEY is not configured")
backend/app/services/extraction_service.py:125:    return OpenAI(api_key=settings.OPENROUTER_API_KEY, base_url=settings.OPENROUTER_BASE_URL)
backend/app/services/extraction_service.py:130:        kwargs["extra_body"] = {"thinking": {"type": "disabled"}}

exec
/bin/zsh -lc "nl -ba backend/app/api/chat.py | sed -n '60,130p'" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
    60	MESSAGE_NOT_FOUND_DETAIL = {
    61	    "error": "MESSAGE_NOT_FOUND",
    62	    "message": "Message not found",
    63	}
    64	
    65	
    66	def _as_utc(dt):
    67	    if dt is None:
    68	        return None
    69	    if dt.tzinfo is None:
    70	        return dt.replace(tzinfo=timezone.utc)
    71	    return dt.astimezone(timezone.utc)
    72	
    73	
    74	async def enforce_free_mode_limits(db: AsyncSession, user: User, mode: Optional[str]) -> None:
    75	    """Limit Free-plan access to higher-cost modes without adding a new table."""
    76	    if (user.plan or "free").lower() != "free":
    77	        return
    78	
    79	    effective_mode = mode if mode in settings.MODE_MODELS else "balanced"
    80	    # Internal "balanced" now maps to the visible Pro mode.
    81	    if effective_mode != "balanced":
    82	        return
    83	
    84	    configured_limit = (
    85	        settings.FREE_PRO_MONTHLY_LIMIT
    86	        if settings.FREE_PRO_MONTHLY_LIMIT is not None
    87	        else settings.FREE_BALANCED_MONTHLY_LIMIT
    88	    )
    89	    limit = int(configured_limit or 0)
    90	    if limit <= 0:
    91	        return
    92	
    93	    window_start = _as_utc(getattr(user, "monthly_credits_granted_at", None))
    94	    if window_start is None:
    95	        window_start = datetime.now(timezone.utc) - timedelta(days=30)
    96	
    97	    pro_model = settings.MODE_MODELS["balanced"]
    98	    used = await db.scalar(
    99	        select(func.count())
   100	        .select_from(UsageRecord)
   101	        .where(UsageRecord.user_id == user.id)
   102	        .where(UsageRecord.model == pro_model)
   103	        .where(UsageRecord.created_at >= window_start)
   104	    )
   105	    used_count = int(used or 0)
   106	    if used_count >= limit:
   107	        raise HTTPException(
   108	            status_code=402,
   109	            detail={
   110	                "error": "PRO_MODE_LIMIT_REACHED",
   111	                "message": "Free plan Pro mode limit reached",
   112	                "mode": "balanced",
   113	                "limit": limit,
   114	                "used": used_count,
   115	                "required_plan": "plus",
   116	            },
   117	        )
   118	
   119	
   120	async def verify_session_access(
   121	    session_id: uuid.UUID,
   122	    user: Optional[User],
   123	    db: AsyncSession,
   124	) -> Optional[ChatSession]:
   125	    """Verify user has access to the session. Returns session if authorized, None otherwise."""
   126	    result = await db.execute(
   127	        select(ChatSession)
   128	        .options(selectinload(ChatSession.document), selectinload(ChatSession.collection))
   129	        .where(ChatSession.id == session_id)
   130	    )

exec
/bin/zsh -lc "nl -ba backend/app/api/chat.py | sed -n '340,390p'" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
   340	    # Tracker key is global per IP across demo docs and survives session recreation.
   341	    if user is None and session.document and session.document.demo_slug:
   342	        allowed, _count = await demo_message_tracker.check_and_increment(client_ip, DEMO_MESSAGE_LIMIT)
   343	        if not allowed:
   344	            log_security_event("demo_message_limit", ip=client_ip, document_id=session.document_id)
   345	            raise HTTPException(
   346	                status_code=429,
   347	                detail={
   348	                    "error": "DEMO_MESSAGE_LIMIT_REACHED",
   349	                    "message": "Demo message limit reached",
   350	                    "limit": DEMO_MESSAGE_LIMIT,
   351	                },
   352	            )
   353	
   354	    # If authenticated, ensure sufficient credits before opening stream
   355	    if user is not None:
   356	        from app.services.credit_service import ensure_monthly_credits
   357	        await ensure_monthly_credits(db, user)
   358	        await db.commit()
   359	        # Use mode-specific estimated cost for pre-check (actual pre-debit happens in chat_service)
   360	        effective_mode = body.mode or "balanced"
   361	        await enforce_free_mode_limits(db, user, effective_mode)
   362	        estimated_cost = credit_service.get_estimated_cost(effective_mode)
   363	        balance = await credit_service.get_user_credits(db, user.id)
   364	        if balance < estimated_cost:
   365	            raise HTTPException(
   366	                status_code=402,
   367	                detail={
   368	                    "error": "INSUFFICIENT_CREDITS",
   369	                    "message": "Insufficient credits",
   370	                    "required": estimated_cost,
   371	                    "balance": balance,
   372	                },
   373	            )
   374	
   375	    async def event_generator() -> AsyncGenerator[str, None]:
   376	        async for ev in chat_service.chat_stream(
   377	            session_id, body.message, db, user=user, locale=body.locale, mode=body.mode,
   378	            domain_mode=body.domain_mode
   379	        ):
   380	            # Format per SSE: event: <type>\ndata: {json}\n\n
   381	            line = f"event: {ev['event']}\n"
   382	            payload = json.dumps(ev.get("data", {}), ensure_ascii=False)
   383	            data_line = f"data: {payload}\n\n"
   384	            yield line + data_line
   385	
   386	    return StreamingResponse(
   387	        event_generator(),
   388	        media_type="text/event-stream",
   389	        headers={
   390	            "Cache-Control": "no-cache, no-transform",

exec
/bin/zsh -lc "nl -ba backend/app/api/chat.py | sed -n '300,345p'" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
   300	
   301	    # Block chat if document is not fully processed
   302	    if session.document and session.document.status != "ready":
   303	        raise HTTPException(
   304	            status_code=409,
   305	            detail={
   306	                "error": "DOCUMENT_PROCESSING",
   307	                "message": "Document is still being processed",
   308	                "status": session.document.status,
   309	            },
   310	        )
   311	
   312	    # Rate limit anonymous users
   313	    if user is None:
   314	        client_ip = get_client_ip(request)
   315	        if not await demo_chat_limiter.is_allowed(client_ip):
   316	            log_security_event("demo_rate_limit", ip=client_ip, session_id=session_id)
   317	            raise HTTPException(
   318	                status_code=429,
   319	                detail={
   320	                    "error": "RATE_LIMITED",
   321	                    "message": "Rate limit exceeded",
   322	                    "retry_after": 60,
   323	                },
   324	                headers={"Retry-After": "60"},
   325	            )
   326	    else:
   327	        # Rate limit authenticated users (30 req/min per user)
   328	        if not await auth_chat_limiter.is_allowed(str(user.id)):
   329	            raise HTTPException(
   330	                status_code=429,
   331	                detail={
   332	                    "error": "RATE_LIMITED",
   333	                    "message": "Rate limit exceeded",
   334	                    "retry_after": 60,
   335	                },
   336	                headers={"Retry-After": "60"},
   337	            )
   338	
   339	    # Enforce message limit for anonymous users on demo documents.
   340	    # Tracker key is global per IP across demo docs and survives session recreation.
   341	    if user is None and session.document and session.document.demo_slug:
   342	        allowed, _count = await demo_message_tracker.check_and_increment(client_ip, DEMO_MESSAGE_LIMIT)
   343	        if not allowed:
   344	            log_security_event("demo_message_limit", ip=client_ip, document_id=session.document_id)
   345	            raise HTTPException(

web search: 
web search: DeepSeek API response_format json_object chat completions official docs ...
web search: 
web search: https://api-docs.deepseek.com/guides/json_mode/
exec
/bin/zsh -lc "rg -n \"def _verify|verify.*citation|context_text|low_overlap\" backend/app/services/chat_service.py backend/app/services -g '*.py'" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
backend/app/services/chat_service.py:237:    citation_data["context_text"] = (chunk.text or "")[:900]
backend/app/services/chat_service.py:351:        "low_overlap_citation_count",
backend/app/services/chat_service.py:696:            "low_overlap_citation_count": verification.get("low_overlap_citation_count"),
backend/app/services/claim_verifier_service.py:81:    low_overlap_citation_count: int
backend/app/services/claim_verifier_service.py:94:            "low_overlap_citation_count": self.low_overlap_citation_count,
backend/app/services/claim_verifier_service.py:159:        citation.get("context_text"),
backend/app/services/claim_verifier_service.py:200:        low_overlap_count = 0
backend/app/services/claim_verifier_service.py:214:                low_overlap_count += 1
backend/app/services/claim_verifier_service.py:229:        if low_overlap_count > 0:
backend/app/services/claim_verifier_service.py:237:            + low_overlap_count * 0.18
backend/app/services/claim_verifier_service.py:256:            low_overlap_citation_count=low_overlap_count,
backend/app/services/chat_service.py:237:    citation_data["context_text"] = (chunk.text or "")[:900]
backend/app/services/chat_service.py:351:        "low_overlap_citation_count",
backend/app/services/chat_service.py:696:            "low_overlap_citation_count": verification.get("low_overlap_citation_count"),
backend/app/services/extraction_service.py:182:        "context_text": (chunk.text or "")[:300],
backend/app/services/extraction_service.py:257:def _context_text(chunks: Sequence[tuple[Chunk, float]]) -> str:
backend/app/services/extraction_service.py:286:        f"{_context_text(chunks)}"
backend/app/services/chat_tool_executor.py:87:async def _verify_document(document_id: uuid.UUID, user: User, db: AsyncSession) -> Document | None:
backend/app/services/document_diff_service.py:119:def _context_text(label: str, chunks: Sequence[tuple[Chunk, float]]) -> str:
backend/app/services/document_diff_service.py:155:        f"{_context_text('O', old_chunks)}\n\n"
backend/app/services/document_diff_service.py:157:        f"{_context_text('N', new_chunks)}"

exec
/bin/zsh -lc "nl -ba backend/app/services/claim_verifier_service.py | sed -n '145,220p'" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
   145	
   146	
   147	def _unit_for_offset(units: list[ClaimUnit], offset: int) -> ClaimUnit | None:
   148	    if not units:
   149	        return None
   150	    for unit in units:
   151	        if unit.start <= offset <= unit.end + 2:
   152	            return unit
   153	    return min(units, key=lambda unit: min(abs(offset - unit.start), abs(offset - unit.end)))
   154	
   155	
   156	def _citation_context(citation: dict) -> str:
   157	    parts = [
   158	        citation.get("table_context"),
   159	        citation.get("context_text"),
   160	        citation.get("text_snippet"),
   161	    ]
   162	    return " ".join(str(part or "") for part in parts)
   163	
   164	
   165	def _safe_int(value: object, default: int = 0) -> int:
   166	    try:
   167	        return int(value)  # type: ignore[arg-type]
   168	    except (TypeError, ValueError):
   169	        return default
   170	
   171	
   172	class ClaimVerifierService:
   173	    def verify(
   174	        self,
   175	        assistant_text: str,
   176	        citations: list[dict],
   177	        valid_ref_indexes: set[int],
   178	        *,
   179	        retrieved_count: int,
   180	    ) -> ClaimVerificationReport:
   181	        units = _claim_units(assistant_text or "")
   182	        valid_refs = {int(ref) for ref in valid_ref_indexes if isinstance(ref, int)}
   183	        citation_offsets = [
   184	            _safe_int(citation.get("offset"), 0)
   185	            for citation in citations
   186	            if isinstance(citation, dict)
   187	        ]
   188	        cited_unit_indexes = {
   189	            index
   190	            for index, unit in enumerate(units)
   191	            if any(unit.start <= offset <= unit.end + 2 for offset in citation_offsets)
   192	        }
   193	        invalid_citations = [
   194	            citation
   195	            for citation in citations
   196	            if not isinstance(citation, dict)
   197	            or _safe_int(citation.get("ref_index"), -1) not in valid_refs
   198	        ]
   199	
   200	        low_overlap_count = 0
   201	        numeric_mismatch_count = 0
   202	        for citation in citations:
   203	            if not isinstance(citation, dict):
   204	                continue
   205	            citation_context = _citation_context(citation)
   206	            context_features = _text_features(citation_context)
   207	            if len(context_features) < 2:
   208	                continue
   209	            unit = _unit_for_offset(units, _safe_int(citation.get("offset"), 0))
   210	            if unit is None:
   211	                continue
   212	            claim_features = _text_features(unit.text)
   213	            if len(claim_features) >= 2 and not (claim_features & context_features):
   214	                low_overlap_count += 1
   215	            claim_numbers = _numeric_features(unit.text)
   216	            if claim_numbers and not claim_numbers.issubset(_numeric_features(citation_context)):
   217	                numeric_mismatch_count += 1
   218	
   219	        claim_count = len(units)
   220	        cited_claim_count = len(cited_unit_indexes)

codex
**Must-Fix**
- **成本/缓存没有闭环**: 大单文档 summary 先读 persisted brief，但只在 `max_chunks < 18` 时复用；大文档会绕过 persisted 并每次重新跑 map-reduce。见 [document_brief_service.py:1046](/Users/mayijie/Projects/Code/010_DocTalk/backend/app/services/document_brief_service.py:1046), [document_brief_service.py:1091](/Users/mayijie/Projects/Code/010_DocTalk/backend/app/services/document_brief_service.py:1091)。同时 map/reduce LLM 调用没有 usage accounting，最终只按 chat answer usage reconcile，见 [chat_service.py:1599](/Users/mayijie/Projects/Code/010_DocTalk/backend/app/services/chat_service.py:1599)。
  可证伪: 同一大文档连续问两次“总结全文”，provider map/reduce call count 会重复增加，ledger/UsageRecord 只记录最终 answer 模型 tokens。
  建议: 按 `document_id + chunk ids/version + map_reduce prompt version + model` 持久化 map-reduce result；命中缓存直接复用。未缓存时 either 预扣固定 summary surcharge，或把 map/reduce usage 纳入 UsageRecord/ledger。

- **单个 map 失败会丢掉所有成功结果，并可能继续烧后台 LLM 调用**: `asyncio.gather(...)` 在 [document_brief_service.py:861](/Users/mayijie/Projects/Code/010_DocTalk/backend/app/services/document_brief_service.py:861) 遇到一个异常后进入 fallback [document_brief_service.py:876](/Users/mayijie/Projects/Code/010_DocTalk/backend/app/services/document_brief_service.py:876)，但没有 `return_exceptions=True`、没有显式 cancel pending tasks，也没有 partial salvage。
  可证伪: fake map_step 中第一个 group 立刻 raise，其他 group sleep 后记录日志；`build_summary_context` 返回 fallback 后，其他 task 仍可继续执行。
  建议: 显式创建 tasks；map phase 加 global deadline；异常时 cancel/await pending；成功 group 继续保留，失败 group 用 deterministic fallback map result 补齐，而不是全量退回 representative chunks。

- **引用不再是 exact source passage**: map-reduce retrieval item 用 anchor chunk 的 page/bboxes，但 text 被替换成整组 synthetic summary，见 [document_brief_service.py:989](/Users/mayijie/Projects/Code/010_DocTalk/backend/app/services/document_brief_service.py:989), [document_brief_service.py:993](/Users/mayijie/Projects/Code/010_DocTalk/backend/app/services/document_brief_service.py:993)。citation payload 继续输出 anchor bboxes/context_text，见 [chat_service.py:227](/Users/mayijie/Projects/Code/010_DocTalk/backend/app/services/chat_service.py:227)，前端会直接跳转高亮这些 bboxes，见 [frontend/src/store/index.ts:154](/Users/mayijie/Projects/Code/010_DocTalk/frontend/src/store/index.ts:154)。
  可证伪: 一个 context item 覆盖 pages 1-10，回答引用 page 10 的 section claim，点击 citation 会跳到 anchor page 而非 claim source page。
  建议: summary citation 不应复用单个 anchor bbox。要么拆成 section-level context items，并让每个 `[n]` 对应真实 source chunk；要么 citation payload 标记 `retrieval_modality=summary`、清空 bboxes、显示 source chunk/page range，不做“精确高亮”。

- **covered_sections 是结构性回填，存在假覆盖**: `_llm_map_step` 即使模型漏掉 section，也会用第一块文本兜底摘要，并最终把 `covered_sections` 设为 `group.section_titles`，见 [document_brief_service.py:446](/Users/mayijie/Projects/Code/010_DocTalk/backend/app/services/document_brief_service.py:446), [document_brief_service.py:470](/Users/mayijie/Projects/Code/010_DocTalk/backend/app/services/document_brief_service.py:470)。reduce 再把这些当完整覆盖，见 [document_brief_service.py:554](/Users/mayijie/Projects/Code/010_DocTalk/backend/app/services/document_brief_service.py:554)。
  可证伪: mock map LLM 返回 `{"sections":[]}`，result 仍会报告覆盖所有 target sections。
  建议: 分开记录 `target_sections`、`model_covered_sections`、`fallback_sections`、`missing_sections`；只有模型有效返回或 deterministic fallback 明确填充的 section 才标为 covered，并把 degraded coverage 传给最终 prompt。

**Should-Fix**
- **“封顶”只封了 call count，不封总延迟和 map prompt 体积**: group 上限 18、并发 4 是有的，见 [document_brief_service.py:227](/Users/mayijie/Projects/Code/010_DocTalk/backend/app/services/document_brief_service.py:227), [document_brief_service.py:230](/Users/mayijie/Projects/Code/010_DocTalk/backend/app/services/document_brief_service.py:230)。但 `ensure_all_section_anchors=True` 会把 per-group chunk cap 抬到该组 section 数，见 [document_brief_service.py:637](/Users/mayijie/Projects/Code/010_DocTalk/backend/app/services/document_brief_service.py:637)，总成功延迟最坏约 `ceil(groups/4)*20s + 30s`，没有全局 timeout。
  建议: 加 map phase 总 deadline、per-request input token cap、overflow strategy；否则 18 calls 不等于成本/延迟可控。

- **collection 路径不是完全隔离**: `get_collection_summary_context` 用 `per_doc_budget = max_chunks // doc_count`，单文档 collection 时是 24，不会触发 `max_chunks < 18` skip，见 [document_brief_service.py:1190](/Users/mayijie/Projects/Code/010_DocTalk/backend/app/services/document_brief_service.py:1190), [document_brief_service.py:1023](/Users/mayijie/Projects/Code/010_DocTalk/backend/app/services/document_brief_service.py:1023)。
  建议: collection 调用显式传 `allow_map_reduce=False`，或固定 per-doc budget `<18`，除非产品明确允许 collection summary 触发 map-reduce。

- **denoise 会丢 leading noisy chunks**: 如果文档开头 chunk 的 section title 是 `"1"`、`"+"`、单字母等，且还没有 current section，它会被直接跳过，见 [document_brief_service.py:163](/Users/mayijie/Projects/Code/010_DocTalk/backend/app/services/document_brief_service.py:163)。
  建议: leading noisy chunks 归入 `Front matter` 或并入第一个有效 section；单字母/罗马数字标题不要一刀切丢弃。

**Nit**
- JSON mode 默认 provider 基本可行: DeepSeek 官方文档支持 `response_format={"type":"json_object"}`，但也提示可能偶发 empty content；OpenRouter 也支持 `json_object` 参数。代码现在 empty/invalid JSON 会整批 fallback，见 [document_brief_service.py:363](/Users/mayijie/Projects/Code/010_DocTalk/backend/app/services/document_brief_service.py:363), [document_brief_service.py:103](/Users/mayijie/Projects/Code/010_DocTalk/backend/app/services/document_brief_service.py:103)。
  建议: 对 empty content/JSONDecodeError 做一次短 retry，并打结构化 telemetry。参考: [DeepSeek JSON Output](https://api-docs.deepseek.com/guides/json_mode/), [OpenRouter parameters](https://openrouter.ai/docs/api/reference/parameters)。

- `tool_status` 文案是硬编码英文，见 [chat_service.py:1091](/Users/mayijie/Projects/Code/010_DocTalk/backend/app/services/chat_service.py:1091)。11 locales 产品面建议发 message code，由前端本地化。

**验证**
我在 `backend/` 跑了 `SKIP_INTEGRATION=1 python3 -m pytest -q`：`405 passed, 7 skipped, 15 warnings in 5.14s`。未使用 `git`。

**可否合并 main**
否。当前不能合并 main。核心理由是成本/缓存/计费不闭环、partial failure 处理不安全、citation 精确性被 synthetic summary 破坏，以及 coverage 指标会假阳性。
tokens used
185,040
**Must-Fix**
- **成本/缓存没有闭环**: 大单文档 summary 先读 persisted brief，但只在 `max_chunks < 18` 时复用；大文档会绕过 persisted 并每次重新跑 map-reduce。见 [document_brief_service.py:1046](/Users/mayijie/Projects/Code/010_DocTalk/backend/app/services/document_brief_service.py:1046), [document_brief_service.py:1091](/Users/mayijie/Projects/Code/010_DocTalk/backend/app/services/document_brief_service.py:1091)。同时 map/reduce LLM 调用没有 usage accounting，最终只按 chat answer usage reconcile，见 [chat_service.py:1599](/Users/mayijie/Projects/Code/010_DocTalk/backend/app/services/chat_service.py:1599)。
  可证伪: 同一大文档连续问两次“总结全文”，provider map/reduce call count 会重复增加，ledger/UsageRecord 只记录最终 answer 模型 tokens。
  建议: 按 `document_id + chunk ids/version + map_reduce prompt version + model` 持久化 map-reduce result；命中缓存直接复用。未缓存时 either 预扣固定 summary surcharge，或把 map/reduce usage 纳入 UsageRecord/ledger。

- **单个 map 失败会丢掉所有成功结果，并可能继续烧后台 LLM 调用**: `asyncio.gather(...)` 在 [document_brief_service.py:861](/Users/mayijie/Projects/Code/010_DocTalk/backend/app/services/document_brief_service.py:861) 遇到一个异常后进入 fallback [document_brief_service.py:876](/Users/mayijie/Projects/Code/010_DocTalk/backend/app/services/document_brief_service.py:876)，但没有 `return_exceptions=True`、没有显式 cancel pending tasks，也没有 partial salvage。
  可证伪: fake map_step 中第一个 group 立刻 raise，其他 group sleep 后记录日志；`build_summary_context` 返回 fallback 后，其他 task 仍可继续执行。
  建议: 显式创建 tasks；map phase 加 global deadline；异常时 cancel/await pending；成功 group 继续保留，失败 group 用 deterministic fallback map result 补齐，而不是全量退回 representative chunks。

- **引用不再是 exact source passage**: map-reduce retrieval item 用 anchor chunk 的 page/bboxes，但 text 被替换成整组 synthetic summary，见 [document_brief_service.py:989](/Users/mayijie/Projects/Code/010_DocTalk/backend/app/services/document_brief_service.py:989), [document_brief_service.py:993](/Users/mayijie/Projects/Code/010_DocTalk/backend/app/services/document_brief_service.py:993)。citation payload 继续输出 anchor bboxes/context_text，见 [chat_service.py:227](/Users/mayijie/Projects/Code/010_DocTalk/backend/app/services/chat_service.py:227)，前端会直接跳转高亮这些 bboxes，见 [frontend/src/store/index.ts:154](/Users/mayijie/Projects/Code/010_DocTalk/frontend/src/store/index.ts:154)。
  可证伪: 一个 context item 覆盖 pages 1-10，回答引用 page 10 的 section claim，点击 citation 会跳到 anchor page 而非 claim source page。
  建议: summary citation 不应复用单个 anchor bbox。要么拆成 section-level context items，并让每个 `[n]` 对应真实 source chunk；要么 citation payload 标记 `retrieval_modality=summary`、清空 bboxes、显示 source chunk/page range，不做“精确高亮”。

- **covered_sections 是结构性回填，存在假覆盖**: `_llm_map_step` 即使模型漏掉 section，也会用第一块文本兜底摘要，并最终把 `covered_sections` 设为 `group.section_titles`，见 [document_brief_service.py:446](/Users/mayijie/Projects/Code/010_DocTalk/backend/app/services/document_brief_service.py:446), [document_brief_service.py:470](/Users/mayijie/Projects/Code/010_DocTalk/backend/app/services/document_brief_service.py:470)。reduce 再把这些当完整覆盖，见 [document_brief_service.py:554](/Users/mayijie/Projects/Code/010_DocTalk/backend/app/services/document_brief_service.py:554)。
  可证伪: mock map LLM 返回 `{"sections":[]}`，result 仍会报告覆盖所有 target sections。
  建议: 分开记录 `target_sections`、`model_covered_sections`、`fallback_sections`、`missing_sections`；只有模型有效返回或 deterministic fallback 明确填充的 section 才标为 covered，并把 degraded coverage 传给最终 prompt。

**Should-Fix**
- **“封顶”只封了 call count，不封总延迟和 map prompt 体积**: group 上限 18、并发 4 是有的，见 [document_brief_service.py:227](/Users/mayijie/Projects/Code/010_DocTalk/backend/app/services/document_brief_service.py:227), [document_brief_service.py:230](/Users/mayijie/Projects/Code/010_DocTalk/backend/app/services/document_brief_service.py:230)。但 `ensure_all_section_anchors=True` 会把 per-group chunk cap 抬到该组 section 数，见 [document_brief_service.py:637](/Users/mayijie/Projects/Code/010_DocTalk/backend/app/services/document_brief_service.py:637)，总成功延迟最坏约 `ceil(groups/4)*20s + 30s`，没有全局 timeout。
  建议: 加 map phase 总 deadline、per-request input token cap、overflow strategy；否则 18 calls 不等于成本/延迟可控。

- **collection 路径不是完全隔离**: `get_collection_summary_context` 用 `per_doc_budget = max_chunks // doc_count`，单文档 collection 时是 24，不会触发 `max_chunks < 18` skip，见 [document_brief_service.py:1190](/Users/mayijie/Projects/Code/010_DocTalk/backend/app/services/document_brief_service.py:1190), [document_brief_service.py:1023](/Users/mayijie/Projects/Code/010_DocTalk/backend/app/services/document_brief_service.py:1023)。
  建议: collection 调用显式传 `allow_map_reduce=False`，或固定 per-doc budget `<18`，除非产品明确允许 collection summary 触发 map-reduce。

- **denoise 会丢 leading noisy chunks**: 如果文档开头 chunk 的 section title 是 `"1"`、`"+"`、单字母等，且还没有 current section，它会被直接跳过，见 [document_brief_service.py:163](/Users/mayijie/Projects/Code/010_DocTalk/backend/app/services/document_brief_service.py:163)。
  建议: leading noisy chunks 归入 `Front matter` 或并入第一个有效 section；单字母/罗马数字标题不要一刀切丢弃。

**Nit**
- JSON mode 默认 provider 基本可行: DeepSeek 官方文档支持 `response_format={"type":"json_object"}`，但也提示可能偶发 empty content；OpenRouter 也支持 `json_object` 参数。代码现在 empty/invalid JSON 会整批 fallback，见 [document_brief_service.py:363](/Users/mayijie/Projects/Code/010_DocTalk/backend/app/services/document_brief_service.py:363), [document_brief_service.py:103](/Users/mayijie/Projects/Code/010_DocTalk/backend/app/services/document_brief_service.py:103)。
  建议: 对 empty content/JSONDecodeError 做一次短 retry，并打结构化 telemetry。参考: [DeepSeek JSON Output](https://api-docs.deepseek.com/guides/json_mode/), [OpenRouter parameters](https://openrouter.ai/docs/api/reference/parameters)。

- `tool_status` 文案是硬编码英文，见 [chat_service.py:1091](/Users/mayijie/Projects/Code/010_DocTalk/backend/app/services/chat_service.py:1091)。11 locales 产品面建议发 message code，由前端本地化。

**验证**
我在 `backend/` 跑了 `SKIP_INTEGRATION=1 python3 -m pytest -q`：`405 passed, 7 skipped, 15 warnings in 5.14s`。未使用 `git`。

**可否合并 main**
否。当前不能合并 main。核心理由是成本/缓存/计费不闭环、partial failure 处理不安全、citation 精确性被 synthetic summary 破坏，以及 coverage 指标会假阳性。
