"""Generate persisted hierarchical document briefs after parsing.

Runs in Celery worker context with synchronous DB and OpenAI-compatible clients.
This is best-effort product metadata generation: failures are persisted on the
brief row when possible, but never change the document's parse status.
"""
from __future__ import annotations

import json
import re
import uuid
from datetime import datetime, timezone
from typing import Any, Optional, Sequence

from celery.utils.log import get_task_logger
from openai import OpenAI
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.sync_database import SyncSessionLocal
from app.models.tables import Chunk, Document, DocumentBrief
from app.services.document_brief_service import _select_representative_chunks

logger = get_task_logger(__name__)

BRIEF_PROMPT_VERSION = "document_brief_v1"
BRIEF_SCHEMA_VERSION = 1
BRIEF_MODEL = settings.MODE_MODELS.get("quick", settings.LLM_MODEL)
BRIEF_MAX_CHUNKS = 24
BRIEF_MAX_CHARS_PER_CHUNK = 1000

BRIEF_PROMPT = """You are building a structured document brief for a professional document workspace.

Use only the numbered document excerpts. Every outline item, key point, and fact must cite one or more excerpt numbers from the provided context.

Return valid JSON only:
{{
  "summary": "One concise paragraph explaining what the document is and why it matters.",
  "outline": [
    {{"title": "Section or theme", "level": 1, "summary": "What this section/theme covers.", "source_refs": [1]}}
  ],
  "key_points": [
    {{"text": "Important takeaway stated as a complete sentence.", "source_refs": [1, 2]}}
  ],
  "facts": [
    {{"label": "Metric, date, party, clause, or finding", "value": "Exact value or short answer", "context": "Why it matters.", "source_refs": [3]}}
  ],
  "questions": [
    "A useful question a reader may ask next?"
  ]
}}

Caps:
- summary: 1 paragraph.
- outline: 4 to 8 items.
- key_points: 5 to 10 items.
- facts: up to 12 items.
- questions: exactly 5 concise questions.

Document excerpts:
---
{chunks_text}
---
"""


def _is_deepseek_official_model(model: str) -> bool:
    return model in settings.DEEPSEEK_OFFICIAL_MODELS


def _get_llm_client(model: str) -> OpenAI | None:
    if _is_deepseek_official_model(model):
        if not settings.DEEPSEEK_API_KEY:
            return None
        return OpenAI(api_key=settings.DEEPSEEK_API_KEY, base_url=settings.DEEPSEEK_BASE_URL)
    if not settings.OPENROUTER_API_KEY:
        return None
    return OpenAI(api_key=settings.OPENROUTER_API_KEY, base_url=settings.OPENROUTER_BASE_URL)


def _apply_provider_options(kwargs: dict[str, Any], model: str) -> None:
    if _is_deepseek_official_model(model):
        kwargs["extra_body"] = {"thinking": {"type": "disabled"}}


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
        raise ValueError("Brief response must be a JSON object")
    return data


def _str(value: Any, fallback: str = "", *, limit: int = 4000) -> str:
    text = str(value).strip() if value is not None else fallback
    return text[:limit]


def _source_ref_from_chunk(chunk: Chunk) -> dict[str, Any]:
    return {
        "chunk_id": str(chunk.id),
        "chunk_index": int(chunk.chunk_index),
        "page": int(chunk.page_start),
        "page_end": int(chunk.page_end),
    }


def _ref_number(value: Any) -> int | None:
    if isinstance(value, dict):
        for key in ("ref", "ref_index", "source_ref", "source"):
            if key in value:
                return _ref_number(value.get(key))
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _normalize_refs(value: Any, ref_lookup: dict[int, dict[str, Any]]) -> list[dict[str, Any]]:
    if not ref_lookup:
        return []
    values = value if isinstance(value, list) else []
    refs: list[dict[str, Any]] = []
    seen: set[str] = set()
    for raw in values:
        ref_num = _ref_number(raw)
        if ref_num is None or ref_num not in ref_lookup:
            continue
        ref = ref_lookup[ref_num]
        key = ref["chunk_id"]
        if key in seen:
            continue
        seen.add(key)
        refs.append(dict(ref))
    if refs:
        return refs[:4]
    return []


def _page_ranges(chunks: Sequence[Chunk]) -> list[list[int]]:
    ranges: list[list[int]] = []
    for chunk in chunks:
        start = int(chunk.page_start)
        end = int(chunk.page_end)
        if not ranges or start > ranges[-1][1] + 1:
            ranges.append([start, end])
        else:
            ranges[-1][1] = max(ranges[-1][1], end)
    return ranges


def _normalize_outline(raw_items: Any, ref_lookup: dict[int, dict[str, Any]]) -> list[dict[str, Any]]:
    items = raw_items if isinstance(raw_items, list) else []
    normalized: list[dict[str, Any]] = []
    for item in items[:8]:
        if not isinstance(item, dict):
            continue
        try:
            level = int(item.get("level") or 1)
        except (TypeError, ValueError):
            level = 1
        source_refs = _normalize_refs(item.get("source_refs"), ref_lookup)
        if not source_refs:
            continue
        normalized.append(
            {
                "title": _str(item.get("title"), "Section", limit=180),
                "level": min(3, max(1, level)),
                "summary": _str(item.get("summary"), limit=800),
                "source_refs": source_refs,
            }
        )
    return normalized


def normalize_document_brief(
    raw: dict[str, Any],
    selected_chunks: Sequence[Chunk],
    *,
    chunks_total: int,
    pages_total: int | None,
) -> dict[str, Any]:
    ref_lookup = {
        idx: _source_ref_from_chunk(chunk)
        for idx, chunk in enumerate(selected_chunks, start=1)
    }

    key_points_raw = raw.get("key_points") if isinstance(raw.get("key_points"), list) else []
    facts_raw = raw.get("facts") if isinstance(raw.get("facts"), list) else []
    questions_raw = raw.get("questions") if isinstance(raw.get("questions"), list) else []

    key_points: list[dict[str, Any]] = []
    for item in key_points_raw[:10]:
        source_refs = _normalize_refs(item.get("source_refs") if isinstance(item, dict) else [], ref_lookup)
        if not source_refs:
            continue
        key_points.append(
            {
                "text": _str(item.get("text") if isinstance(item, dict) else item, limit=900),
                "source_refs": source_refs,
            }
        )

    facts: list[dict[str, Any]] = []
    for item in facts_raw[:12]:
        source_refs = _normalize_refs(item.get("source_refs") if isinstance(item, dict) else [], ref_lookup)
        if not source_refs:
            continue
        facts.append(
            {
                "label": _str(item.get("label") if isinstance(item, dict) else "Fact", limit=160),
                "value": _str(item.get("value") if isinstance(item, dict) else item, limit=260),
                "context": _str(item.get("context") if isinstance(item, dict) else "", limit=700),
                "source_refs": source_refs,
            }
        )

    return {
        "summary": _str(raw.get("summary"), limit=2400),
        "outline": _normalize_outline(raw.get("outline"), ref_lookup),
        "key_points": key_points,
        "facts": facts,
        "questions": [_str(q, limit=220) for q in questions_raw[:5] if _str(q, limit=220)],
        "coverage": {
            "status": "representative",
            "strategy": "representative_chunks_v1",
            "chunks_total": int(chunks_total),
            "pages_total": int(pages_total) if pages_total else None,
            "selected_chunk_ids": [str(chunk.id) for chunk in selected_chunks],
            "selected_chunk_indices": [int(chunk.chunk_index) for chunk in selected_chunks],
            "selected_page_ranges": _page_ranges(selected_chunks),
        },
    }


def _build_chunks_text(chunks: Sequence[Chunk]) -> str:
    parts: list[str] = []
    for ref, chunk in enumerate(chunks, start=1):
        section = f" | {chunk.section_title}" if chunk.section_title else ""
        page = f"p.{chunk.page_start}" if chunk.page_start == chunk.page_end else f"p.{chunk.page_start}-{chunk.page_end}"
        text = (chunk.text or "").strip()[:BRIEF_MAX_CHARS_PER_CHUNK]
        parts.append(f"[{ref}] {page}{section}\n{text}")
    return "\n\n".join(parts)


def _get_existing_brief(db: Session, document_id: uuid.UUID) -> DocumentBrief | None:
    return db.execute(
        select(DocumentBrief).where(DocumentBrief.document_id == document_id)
    ).scalar_one_or_none()


def _apply_payload_to_doc_and_brief(
    doc: Document,
    brief: DocumentBrief,
    payload: dict[str, Any],
    *,
    model: str,
) -> None:
    brief.schema_version = BRIEF_SCHEMA_VERSION
    brief.prompt_version = BRIEF_PROMPT_VERSION
    brief.model = model
    brief.summary = payload.get("summary") or None
    brief.outline = payload.get("outline") or []
    brief.key_points = payload.get("key_points") or []
    brief.facts = payload.get("facts") or []
    brief.questions = payload.get("questions") or []
    brief.coverage = payload.get("coverage") or {}
    brief.error_code = None
    brief.error_message = None
    brief.generated_at = datetime.now(timezone.utc)

    doc.summary = brief.summary
    doc.suggested_questions = brief.questions


def _persist_brief_error(
    db: Session,
    doc: Document,
    *,
    code: str,
    message: str,
    model: str,
) -> None:
    brief = _get_existing_brief(db, doc.id)
    if brief is None:
        brief = DocumentBrief(
            document_id=doc.id,
            outline=[],
            key_points=[],
            facts=[],
            questions=[],
            coverage={},
        )
    brief.schema_version = BRIEF_SCHEMA_VERSION
    brief.prompt_version = BRIEF_PROMPT_VERSION
    brief.model = model
    brief.error_code = code
    brief.error_message = message[:2000]
    brief.generated_at = datetime.now(timezone.utc)
    db.add(brief)
    db.commit()


def _selected_chunks_still_current(
    db: Session,
    doc: Document,
    selected_chunks: Sequence[Chunk],
) -> bool:
    selected_ids = [chunk.id for chunk in selected_chunks]
    if not selected_ids:
        return False
    rows = db.execute(
        select(Chunk.id)
        .where(Chunk.document_id == doc.id)
        .where(Chunk.id.in_(selected_ids))
    )
    current_ids = {chunk_id for chunk_id in rows.scalars()}
    return current_ids == set(selected_ids)


def generate_document_brief_sync(document_id: str) -> None:
    """Load representative chunks, call the LLM, and persist a structured brief."""
    with SyncSessionLocal() as db:
        doc: Optional[Document] = db.get(Document, uuid.UUID(document_id))
        if not doc:
            logger.warning("Document %s not found for brief generation", document_id)
            return

        client = _get_llm_client(BRIEF_MODEL)
        if client is None:
            logger.warning("No LLM API key configured, recording brief generation failure")
            _persist_brief_error(
                db,
                doc,
                code="BRIEF_LLM_UNAVAILABLE",
                message="No LLM API key configured for document brief generation",
                model=BRIEF_MODEL,
            )
            return

        chunks = list(
            db.execute(
                select(Chunk)
                .where(Chunk.document_id == doc.id)
                .order_by(Chunk.chunk_index)
            ).scalars()
        )
        if not chunks:
            logger.warning("No chunks found for document %s, skipping brief generation", document_id)
            _persist_brief_error(
                db,
                doc,
                code="BRIEF_NO_CHUNKS",
                message="No chunks found for document brief generation",
                model=BRIEF_MODEL,
            )
            return

        selected_chunks = _select_representative_chunks(chunks, max_chunks=BRIEF_MAX_CHUNKS)
        if not selected_chunks:
            logger.warning("No representative chunks selected for document %s", document_id)
            _persist_brief_error(
                db,
                doc,
                code="BRIEF_NO_REPRESENTATIVE_CHUNKS",
                message="No representative chunks selected for document brief generation",
                model=BRIEF_MODEL,
            )
            return

        prompt = BRIEF_PROMPT.format(chunks_text=_build_chunks_text(selected_chunks))

        try:
            kwargs: dict[str, Any] = {
                "model": BRIEF_MODEL,
                "messages": [{"role": "user", "content": prompt}],
                "temperature": 0.2,
                "max_tokens": 2200,
            }
            _apply_provider_options(kwargs, BRIEF_MODEL)
            response = client.chat.completions.create(**kwargs)
            raw = _json_from_text(response.choices[0].message.content or "")
            payload = normalize_document_brief(
                raw,
                selected_chunks,
                chunks_total=len(chunks),
                pages_total=doc.page_count,
            )

            db.refresh(doc)
            if doc.status != "ready" or not _selected_chunks_still_current(db, doc, selected_chunks):
                logger.warning("Document %s changed during brief generation; discarding stale brief", document_id)
                return

            brief = _get_existing_brief(db, doc.id)
            if brief is None:
                brief = DocumentBrief(document_id=doc.id)
            _apply_payload_to_doc_and_brief(doc, brief, payload, model=BRIEF_MODEL)
            db.add(brief)
            db.add(doc)
            db.commit()
            logger.info(
                "Document brief generated for %s: %d outline items, %d key points, %d facts",
                document_id,
                len(brief.outline),
                len(brief.key_points),
                len(brief.facts),
            )
        except json.JSONDecodeError as exc:
            logger.warning("Failed to parse document brief JSON for %s: %s", document_id, exc)
            _persist_brief_error(db, doc, code="BRIEF_JSON_INVALID", message=str(exc), model=BRIEF_MODEL)
        except Exception as exc:
            logger.exception("Document brief generation failed for %s: %s", document_id, exc)
            _persist_brief_error(db, doc, code="BRIEF_GENERATION_FAILED", message=str(exc), model=BRIEF_MODEL)


def generate_summary_sync(document_id: str) -> None:
    """Compatibility wrapper for the old parse-worker call site."""
    generate_document_brief_sync(document_id)
