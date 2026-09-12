from __future__ import annotations

import csv
import io
import json
import logging
import re
import uuid
from contextlib import contextmanager
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any, Callable, Iterable, Iterator, Sequence

import sqlalchemy as sa
from openai import OpenAI
from qdrant_client.models import FieldCondition, Filter, MatchValue
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.tables import (
    Chunk,
    CreditLedger,
    Document,
    DocumentJob,
    ExtractionResult,
    UsageRecord,
    User,
)
from app.services.citation_location import citation_location
from app.services.credit_service import calculate_cost
from app.services.document_element_service import get_element_aware_chunks
from app.services.domain_mode_access import (
    release_failed_extraction_trial_sync,
    release_orphaned_extraction_trial_sync,
)
from app.services.embedding_service import embedding_service
from app.services.predebited_job_service import (
    PREDEBITED_JOB_LEASE_SECONDS,
    PREDEBITED_JOB_LOCK_NAMESPACE,
    PREDEBITED_JOB_MAX_CLAIM_ATTEMPTS,
    RECOVERY_POLICIES,
)

logger = logging.getLogger(__name__)

EXTRACTION_JOB_TYPE = "extraction"
EXTRACTION_MODE = "balanced"
EXTRACTION_MODEL = settings.MODE_MODELS.get(EXTRACTION_MODE, settings.LLM_MODEL)
EXTRACTION_PREDEBIT_CREDITS = 25
FREE_MONTHLY_EXTRACTION_LIMIT = 2
MAX_CONTEXT_CHUNKS = 10
MAX_CONTEXT_CHARS_PER_CHUNK = 1400

# Covered worker hard limits are 7 minutes (extraction), 12 minutes (question
# templates), and 10 minutes (document diffs); Redis redelivers an unacknowledged
# task after 40 minutes. A claim must remain exclusive beyond that broker
# window, otherwise the original and redelivered tasks could both deliver or
# settle. One expired claim may be recovered; a second expiration is terminally
# refunded instead of leaving the predebit standing forever.
EXTRACTION_LEASE_SECONDS = PREDEBITED_JOB_LEASE_SECONDS
EXTRACTION_MAX_CLAIM_ATTEMPTS = PREDEBITED_JOB_MAX_CLAIM_ATTEMPTS
EXTRACTION_LOCK_NAMESPACE = PREDEBITED_JOB_LOCK_NAMESPACE


@dataclass(frozen=True)
class ExtractionTemplate:
    key: str
    title: str
    description: str
    query_prompts: tuple[str, ...]
    json_contract: str


TEMPLATES: dict[str, ExtractionTemplate] = {
    "executive_summary": ExtractionTemplate(
        key="executive_summary",
        title="Executive Summary",
        description="A concise cited brief for business and research readers.",
        query_prompts=(
            "main thesis key findings conclusion recommendations",
            "important risks assumptions limitations",
            "executive summary key points",
        ),
        json_contract=(
            '{"title": string, "summary": string, '
            '"key_points": [{"text": string, "source_refs": [number]}], '
            '"risks_or_open_questions": [{"text": string, "source_refs": [number]}]}'
        ),
    ),
    "key_facts": ExtractionTemplate(
        key="key_facts",
        title="Key Facts & Figures",
        description="Numbers, dates, amounts, metrics, and factual claims in table form.",
        query_prompts=(
            "revenue costs percentages dates dollar amounts statistics metrics",
            "key facts figures numeric findings tables",
            "important dates deadlines amounts",
        ),
        json_contract=(
            '{"facts": [{"label": string, "value": string, '
            '"context": string, "source_refs": [number]}]}'
        ),
    ),
    "evidence_table": ExtractionTemplate(
        key="evidence_table",
        title="Legal / Academic Evidence Table",
        description="Claims, clauses, findings, or evidence with exact source references.",
        query_prompts=(
            "legal obligations restrictions clauses rights liabilities",
            "academic method sample findings evidence limitations",
            "claims evidence source passages",
        ),
        json_contract=(
            '{"items": [{"topic": string, "finding": string, '
            '"evidence": string, "source_refs": [number]}]}'
        ),
    ),
}


def list_templates() -> list[dict[str, str]]:
    return [
        {"key": t.key, "title": t.title, "description": t.description}
        for t in TEMPLATES.values()
    ]


def get_template(template_key: str) -> ExtractionTemplate:
    try:
        return TEMPLATES[template_key]
    except KeyError as exc:
        raise ValueError("UNSUPPORTED_EXTRACTION_TEMPLATE") from exc


def _is_deepseek_official_model(model: str) -> bool:
    return model in settings.DEEPSEEK_OFFICIAL_MODELS


def _get_llm_client(model: str) -> OpenAI:
    if _is_deepseek_official_model(model):
        if not settings.DEEPSEEK_API_KEY:
            raise RuntimeError("DEEPSEEK_API_KEY is not configured")
        return OpenAI(
            api_key=settings.DEEPSEEK_API_KEY, base_url=settings.DEEPSEEK_BASE_URL
        )
    if not settings.OPENROUTER_API_KEY:
        raise RuntimeError("OPENROUTER_API_KEY is not configured")
    return OpenAI(
        api_key=settings.OPENROUTER_API_KEY, base_url=settings.OPENROUTER_BASE_URL
    )


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
        raise ValueError("Extraction response must be a JSON object")
    return data


def _valid_bbox(bb: dict[str, Any]) -> bool:
    return all(isinstance(bb.get(k), (int, float)) for k in ("x", "y", "w", "h"))


def _citation_from_chunk(
    ref_num: int, chunk: Chunk, score: float = 0.0
) -> dict[str, Any]:
    snippet = (
        (f"{chunk.section_title}: " if chunk.section_title else "") + (chunk.text or "")
    )[:140]
    return {
        "ref_index": ref_num,
        "chunk_id": str(chunk.id),
        **citation_location(chunk.page_start, chunk.page_end, chunk.bboxes),
        "text_snippet": snippet,
        "offset": 0,
        "confidence_score": round(float(score or 0.0), 3),
        "context_text": (chunk.text or "")[:300],
        "document_id": str(chunk.document_id),
    }


def _retrieve_by_query(
    db: Session, document_id: uuid.UUID, query: str, top_k: int
) -> list[tuple[Chunk, float]]:
    try:
        qvec = embedding_service.embed_texts([query])[0]
        client = embedding_service.get_qdrant_client()
        response = client.query_points(
            collection_name=settings.QDRANT_COLLECTION,
            query=qvec,
            limit=max(top_k * 3, top_k),
            query_filter=Filter(
                must=[
                    FieldCondition(
                        key="document_id", match=MatchValue(value=str(document_id))
                    )
                ]
            ),
        )
        scores: dict[uuid.UUID, float] = {}
        ids: list[uuid.UUID] = []
        for point in response.points:
            try:
                cid = uuid.UUID(str(point.id))
            except Exception:
                continue
            ids.append(cid)
            scores[cid] = float(point.score or 0.0)
        if not ids:
            return []
        rows = db.execute(select(Chunk).where(Chunk.id.in_(ids)))
        chunks = list(rows.scalars())
        chunks.sort(key=lambda ch: scores.get(ch.id, 0.0), reverse=True)
        return [
            (ch, scores.get(ch.id, 0.0))
            for ch in chunks
            if len((ch.text or "").strip()) >= 80
        ][:top_k]
    except Exception as exc:
        logger.warning(
            "Extraction vector retrieval failed, falling back to first chunks: %s", exc
        )
        return []


def retrieve_extraction_chunks(
    db: Session,
    document_id: uuid.UUID,
    template: ExtractionTemplate,
    *,
    max_chunks: int = MAX_CONTEXT_CHUNKS,
) -> list[tuple[Chunk, float]]:
    seen: set[uuid.UUID] = set()
    selected: list[tuple[Chunk, float]] = []
    element_budget = max(2, max_chunks // 2)
    for chunk, score in get_element_aware_chunks(
        db, document_id, max_chunks=element_budget
    ):
        if chunk.id in seen:
            continue
        seen.add(chunk.id)
        selected.append((chunk, score))
        if len(selected) >= max_chunks:
            return selected

    per_query = max(3, max_chunks // max(1, len(template.query_prompts)) + 1)
    for query in template.query_prompts:
        for chunk, score in _retrieve_by_query(db, document_id, query, per_query):
            if chunk.id in seen:
                continue
            seen.add(chunk.id)
            selected.append((chunk, score))
            if len(selected) >= max_chunks:
                return selected

    if selected:
        return selected[:max_chunks]

    rows = db.execute(
        select(Chunk)
        .where(Chunk.document_id == document_id)
        .order_by(Chunk.chunk_index)
        .limit(max_chunks)
    )
    return [(chunk, 0.0) for chunk in rows.scalars()]


def _context_text(chunks: Sequence[tuple[Chunk, float]]) -> str:
    parts: list[str] = []
    for idx, (chunk, _score) in enumerate(chunks, start=1):
        text = (chunk.text or "").strip().replace("\x00", "")
        if len(text) > MAX_CONTEXT_CHARS_PER_CHUNK:
            text = text[:MAX_CONTEXT_CHARS_PER_CHUNK] + "..."
        section = f" | section: {chunk.section_title}" if chunk.section_title else ""
        parts.append(f"[{idx}] page {chunk.page_start}{section}\n{text}")
    return "\n\n".join(parts)


def _system_prompt(template: ExtractionTemplate, domain_mode: str | None) -> str:
    domain = f"\nDomain mode: {domain_mode}." if domain_mode else ""
    return (
        "You are DocTalk's structured extraction engine. Extract only facts supported by the provided document excerpts. "
        "Every extracted item must include source_refs using the bracket numbers of the excerpts that support it. "
        "Do not invent facts. Respond only with valid JSON matching this contract:\n"
        f"{template.json_contract}\n"
        f"{domain}"
    )


def _user_prompt(
    template: ExtractionTemplate,
    chunks: Sequence[tuple[Chunk, float]],
    locale: str | None,
) -> str:
    language_rule = (
        f"Use the user's interface language if clear from this locale: {locale}."
        if locale
        else "Use the document language."
    )
    return (
        f"Template: {template.title}\n"
        f"Goal: {template.description}\n"
        f"{language_rule}\n\n"
        "Document excerpts:\n"
        f"{_context_text(chunks)}"
    )


def _call_llm(
    template: ExtractionTemplate,
    chunks: Sequence[tuple[Chunk, float]],
    locale: str | None,
    domain_mode: str | None,
) -> tuple[dict[str, Any], int, int]:
    client = _get_llm_client(EXTRACTION_MODEL)
    messages = [
        {"role": "system", "content": _system_prompt(template, domain_mode)},
        {"role": "user", "content": _user_prompt(template, chunks, locale)},
    ]
    # Keep the entire object within a bounded response. A repair that only sees
    # a truncated object can invent the missing facts; regenerate from the same
    # source excerpts instead, once, with a smaller result.
    prompt_tokens = completion_tokens = 0
    for attempt in range(2):
        bound = (
            "Return at most 12 facts or evidence items, 6 key points and 3 risks. "
            "Keep each field concise (at most 40 words), and the summary under 160 words."
            if attempt == 0 else
            "The previous response was incomplete or invalid. Generate a fresh, complete JSON object "
            "from the document excerpts above. Return at most 6 facts or evidence items, "
            "4 key points and 2 risks; keep fields under 25 words and the summary under 100 words."
        )
        kwargs: dict[str, Any] = {
            "model": EXTRACTION_MODEL,
            "messages": [*messages, {"role": "user", "content": bound}],
            "temperature": 0.1 if attempt == 0 else 0,
            "max_tokens": 4096,
        }
        _apply_provider_options(kwargs, EXTRACTION_MODEL)
        if _is_deepseek_official_model(EXTRACTION_MODEL):
            kwargs["response_format"] = {"type": "json_object"}
        response = client.chat.completions.create(**kwargs)
        choice = response.choices[0]
        content = choice.message.content or ""
        finish_reason = getattr(choice, "finish_reason", None)
        usage = getattr(response, "usage", None)
        prompt_tokens += int(getattr(usage, "prompt_tokens", 0) or 0)
        completion_tokens += int(getattr(usage, "completion_tokens", 0) or 0)
        logger.info(
            "extraction.output template=%s attempt=%d finish_reason=%s chars=%d",
            template.key, attempt + 1, finish_reason, len(content),
        )
        try:
            if finish_reason == "length":
                raise ValueError("Extraction output exceeded the response limit")
            return _json_from_text(content), prompt_tokens, completion_tokens
        except (ValueError, TypeError):
            if attempt == 1:
                raise
    raise RuntimeError("Extraction produced no complete result")


def _refs(value: Any, max_ref: int) -> list[int]:
    if not isinstance(value, list):
        return [1] if max_ref >= 1 else []
    refs: list[int] = []
    for item in value:
        try:
            ref = int(item)
        except (TypeError, ValueError):
            continue
        if 1 <= ref <= max_ref and ref not in refs:
            refs.append(ref)
    return refs or ([1] if max_ref >= 1 else [])


def _str(value: Any, fallback: str = "") -> str:
    text = str(value).strip() if value is not None else fallback
    return text[:4000]


def normalize_result(
    template_key: str, raw: dict[str, Any], max_ref: int
) -> dict[str, Any]:
    if template_key == "executive_summary":
        key_points = (
            raw.get("key_points") if isinstance(raw.get("key_points"), list) else []
        )
        risks = (
            raw.get("risks_or_open_questions")
            if isinstance(raw.get("risks_or_open_questions"), list)
            else []
        )
        return {
            "title": _str(raw.get("title"), "Executive Summary")[:200],
            "summary": _str(raw.get("summary")),
            "key_points": [
                {
                    "text": _str(item.get("text") if isinstance(item, dict) else item),
                    "source_refs": _refs(
                        item.get("source_refs") if isinstance(item, dict) else [],
                        max_ref,
                    ),
                }
                for item in key_points[:8]
            ],
            "risks_or_open_questions": [
                {
                    "text": _str(item.get("text") if isinstance(item, dict) else item),
                    "source_refs": _refs(
                        item.get("source_refs") if isinstance(item, dict) else [],
                        max_ref,
                    ),
                }
                for item in risks[:5]
            ],
        }
    if template_key == "key_facts":
        facts = raw.get("facts") if isinstance(raw.get("facts"), list) else []
        return {
            "facts": [
                {
                    "label": _str(
                        item.get("label") if isinstance(item, dict) else "Fact"
                    )[:160],
                    "value": _str(
                        item.get("value") if isinstance(item, dict) else item
                    )[:240],
                    "context": _str(
                        item.get("context") if isinstance(item, dict) else ""
                    ),
                    "source_refs": _refs(
                        item.get("source_refs") if isinstance(item, dict) else [],
                        max_ref,
                    ),
                }
                for item in facts[:30]
            ]
        }
    if template_key == "evidence_table":
        items = raw.get("items") if isinstance(raw.get("items"), list) else []
        return {
            "items": [
                {
                    "topic": _str(
                        item.get("topic") if isinstance(item, dict) else "Evidence"
                    )[:160],
                    "finding": _str(
                        item.get("finding") if isinstance(item, dict) else item
                    ),
                    "evidence": _str(
                        item.get("evidence") if isinstance(item, dict) else ""
                    ),
                    "source_refs": _refs(
                        item.get("source_refs") if isinstance(item, dict) else [],
                        max_ref,
                    ),
                }
                for item in items[:24]
            ]
        }
    raise ValueError("UNSUPPORTED_EXTRACTION_TEMPLATE")


def _walk_refs(value: Any) -> Iterable[int]:
    if isinstance(value, dict):
        refs = value.get("source_refs")
        if isinstance(refs, list):
            for ref in refs:
                try:
                    yield int(ref)
                except (TypeError, ValueError):
                    continue
        for child in value.values():
            yield from _walk_refs(child)
    elif isinstance(value, list):
        for child in value:
            yield from _walk_refs(child)


def _cite(refs: list[int]) -> str:
    return " ".join(f"[{ref}]" for ref in refs)


def render_markdown(template: ExtractionTemplate, data: dict[str, Any]) -> str:
    lines = [f"# {template.title}", ""]
    if template.key == "executive_summary":
        title = data.get("title") or template.title
        summary = data.get("summary") or ""
        lines = [f"# {title}", "", summary, "", "## Key Points"]
        for item in data.get("key_points", []):
            lines.append(
                f"- {item.get('text', '')} {_cite(item.get('source_refs', []))}".rstrip()
            )
        risks = data.get("risks_or_open_questions", [])
        if risks:
            lines.extend(["", "## Risks / Open Questions"])
            for item in risks:
                lines.append(
                    f"- {item.get('text', '')} {_cite(item.get('source_refs', []))}".rstrip()
                )
    elif template.key == "key_facts":
        lines.extend(["| Fact | Value | Context | Sources |", "|---|---|---|---|"])
        for item in data.get("facts", []):
            row = [
                _markdown_cell(item.get("label", "")),
                _markdown_cell(item.get("value", "")),
                _markdown_cell(item.get("context", "")),
                _cite(item.get("source_refs", [])),
            ]
            lines.append("| " + " | ".join(row) + " |")
    elif template.key == "evidence_table":
        lines.extend(["| Topic | Finding | Evidence | Sources |", "|---|---|---|---|"])
        for item in data.get("items", []):
            row = [
                _markdown_cell(item.get("topic", "")),
                _markdown_cell(item.get("finding", "")),
                _markdown_cell(item.get("evidence", "")),
                _cite(item.get("source_refs", [])),
            ]
            lines.append("| " + " | ".join(row) + " |")
    return "\n".join(lines).strip() + "\n"


def _markdown_cell(value: Any) -> str:
    return str(value or "").replace("|", "\\|").replace("\n", " ").strip()


def render_csv(template_key: str, data: dict[str, Any]) -> str:
    buf = io.StringIO()
    writer = csv.writer(buf)
    if template_key == "executive_summary":
        writer.writerow(["section", "text", "sources"])
        if data.get("summary"):
            writer.writerow(["summary", data.get("summary"), ""])
        for item in data.get("key_points", []):
            writer.writerow(
                [
                    "key_point",
                    item.get("text", ""),
                    " ".join(map(str, item.get("source_refs", []))),
                ]
            )
        for item in data.get("risks_or_open_questions", []):
            writer.writerow(
                [
                    "risk_or_open_question",
                    item.get("text", ""),
                    " ".join(map(str, item.get("source_refs", []))),
                ]
            )
    elif template_key == "key_facts":
        writer.writerow(["label", "value", "context", "sources"])
        for item in data.get("facts", []):
            writer.writerow(
                [
                    item.get("label", ""),
                    item.get("value", ""),
                    item.get("context", ""),
                    " ".join(map(str, item.get("source_refs", []))),
                ]
            )
    else:
        writer.writerow(["topic", "finding", "evidence", "sources"])
        for item in data.get("items", []):
            writer.writerow(
                [
                    item.get("topic", ""),
                    item.get("finding", ""),
                    item.get("evidence", ""),
                    " ".join(map(str, item.get("source_refs", []))),
                ]
            )
    return buf.getvalue()


def _refund_predebit_sync(
    db: Session, user_id: uuid.UUID, pre_debited: int, ledger_id: uuid.UUID
) -> bool:
    """Atomically refund an extraction predebit only while it is unsettled."""
    result = db.execute(
        sa.delete(CreditLedger)
        .where(CreditLedger.id == ledger_id)
        .where(CreditLedger.reconciled_at.is_(None))
        .returning(CreditLedger.id)
    )
    refunded = result.scalar_one_or_none() is not None
    if refunded:
        db.execute(
            sa.update(User)
            .where(User.id == user_id)
            .values(credits_balance=User.credits_balance + pre_debited)
        )
    else:
        logger.info(
            "extraction_billing.already_settled user=%s ledger=%s: "
            "refund skipped because the ledger was reconciled or already removed",
            user_id,
            ledger_id,
        )
    return refunded


def _reconcile_sync(
    db: Session,
    user_id: uuid.UUID,
    ledger_id: uuid.UUID,
    pre_debited: int,
    actual_cost: int,
) -> None:
    locked_ledger = db.scalar(
        sa.select(CreditLedger).where(CreditLedger.id == ledger_id).with_for_update()
    )
    if locked_ledger is None:
        raise RuntimeError(
            f"Predebit ledger {ledger_id} not found during extraction credit reconciliation"
        )

    diff = pre_debited - actual_cost
    if diff:
        updated_user_id = db.scalar(
            sa.update(User)
            .where(User.id == user_id)
            .values(credits_balance=User.credits_balance + diff)
            .returning(User.id)
        )
        if updated_user_id is None:
            raise RuntimeError(
                f"User {user_id} not found during extraction credit reconciliation"
            )
    db.execute(
        sa.update(CreditLedger)
        .where(CreditLedger.id == ledger_id)
        .values(
            delta=-actual_cost,
            balance_after=CreditLedger.balance_after + diff,
            reconciled_at=sa.func.now(),
        )
    )


def _settle_extraction_predebit_after_failure_sync(
    *,
    job_id: uuid.UUID | str,
    user_id: uuid.UUID | None = None,
    pre_debited: int | None = None,
    ledger_id: uuid.UUID | None = None,
    error_code: str,
    error_message: str,
    release_trial: bool,
) -> bool:
    """Resolve an extraction-style worker failure in a fresh transaction.

    The conditional ledger delete is the only settlement decision. If the
    success transaction already reconciled the row, this resolver is a no-op
    and deliberately leaves the succeeded job untouched. If the delete wins,
    the balance refund, surviving failed-job state, and optional Domain Mode
    trial release commit atomically. A historical missing job is recovered
    from its canonical orphan ledger without inventing a second refund path.
    """
    from app.models.sync_database import SyncSessionLocal

    with SyncSessionLocal() as settle_db:
        job_id_text = str(job_id)
        try:
            job_uuid = uuid.UUID(job_id_text)
        except (TypeError, ValueError):
            job_uuid = None
        job_snapshot = settle_db.get(DocumentJob, job_uuid) if job_uuid else None
        orphaned_ledger_reason: str | None = None
        orphaned_ledger_created_at: datetime | None = None

        if job_snapshot is None:
            # Historical parent/direct deletes can already have removed the
            # job anchor while leaving its string-referenced ledger. Resolve
            # from that canonical row so the same conditional DELETE remains
            # the sole settlement decision; never infer a refund from metadata
            # alone after the ledger itself is gone or reconciled.
            orphaned_ledger = settle_db.scalar(
                sa.select(CreditLedger)
                .where(
                    CreditLedger.ref_type == "document_job",
                    CreditLedger.ref_id == job_id_text,
                    CreditLedger.reconciled_at.is_(None),
                    *(
                        (CreditLedger.id == ledger_id,)
                        if ledger_id is not None
                        else ()
                    ),
                    *(
                        (CreditLedger.user_id == user_id,)
                        if user_id is not None
                        else ()
                    ),
                )
                .order_by(CreditLedger.created_at.desc())
                .limit(1)
            )
            if orphaned_ledger is None:
                settle_db.rollback()
                return False
            resolved_ledger_id = orphaned_ledger.id
            resolved_pre_debited = max(0, -int(orphaned_ledger.delta))
            resolved_user_id = orphaned_ledger.user_id
            orphaned_ledger_reason = orphaned_ledger.reason
            orphaned_ledger_created_at = orphaned_ledger.created_at
        else:
            metadata = job_snapshot.metadata_json or {}
            metadata_pre_debited = int(metadata.get("pre_debited") or 0)
            ledger_raw = metadata.get("predebit_ledger_id")
            resolved_pre_debited = (
                int(pre_debited)
                if pre_debited is not None
                else metadata_pre_debited
            )
            resolved_ledger_id = (
                ledger_id
                if ledger_id is not None
                else (uuid.UUID(str(ledger_raw)) if ledger_raw else None)
            )
            resolved_user_id = user_id or job_snapshot.user_id
            if resolved_ledger_id is None or resolved_pre_debited <= 0:
                fallback_ledger = settle_db.scalar(
                    sa.select(CreditLedger)
                    .where(
                        CreditLedger.user_id == resolved_user_id,
                        CreditLedger.ref_type == "document_job",
                        CreditLedger.ref_id == job_id_text,
                        CreditLedger.reconciled_at.is_(None),
                    )
                    .order_by(CreditLedger.created_at.desc())
                    .limit(1)
                )
                if fallback_ledger is not None:
                    resolved_ledger_id = fallback_ledger.id
                    resolved_pre_debited = max(0, -int(fallback_ledger.delta))
        if resolved_pre_debited <= 0 or resolved_ledger_id is None:
            raise RuntimeError(
                f"Extraction job {job_id} has no recoverable predebit metadata"
            )

        refunded = _refund_predebit_sync(
            settle_db,
            resolved_user_id,
            resolved_pre_debited,
            resolved_ledger_id,
        )
        if not refunded:
            settle_db.rollback()
            return False

        if job_snapshot is None:
            if (
                release_trial
                and orphaned_ledger_reason == "extraction"
                and orphaned_ledger_created_at is not None
            ):
                release_orphaned_extraction_trial_sync(
                    settle_db,
                    user_id=resolved_user_id,
                    ledger_created_at=orphaned_ledger_created_at,
                )
            settle_db.commit()
            return True

        failed_job = settle_db.scalar(
            sa.select(DocumentJob).where(DocumentJob.id == job_uuid).with_for_update()
        )
        if failed_job is None:
            raise RuntimeError(
                f"Extraction job {job_id} not found during failure settlement"
            )

        completed_at = datetime.now(timezone.utc)
        failed_job.status = "failed"
        failed_job.error_code = error_code[:64]
        failed_job.error_message = error_message
        failed_job.completed_at = completed_at
        failed_job.updated_at = completed_at
        failed_job.worker_claim_token = None
        failed_job.worker_lease_expires_at = None
        settle_db.add(failed_job)
        settle_db.flush()

        if release_trial:
            release_failed_extraction_trial_sync(
                settle_db,
                user_id=resolved_user_id,
                owning_job_id=job_uuid,
            )

        settle_db.commit()
        return True


@contextmanager
def extraction_job_advisory_lock(job_id: str) -> Iterator[bool]:
    """Hold the house-pattern session advisory lock for one extraction run."""
    from app.models import sync_database

    lock_conn = sync_database.sync_engine.connect().execution_options(
        isolation_level="AUTOCOMMIT"
    )
    got_lock = False
    try:
        got_lock = bool(
            lock_conn.execute(
                sa.text("SELECT pg_try_advisory_lock(:ns, hashtext(:key))"),
                {"ns": EXTRACTION_LOCK_NAMESPACE, "key": job_id},
            ).scalar()
        )
        yield got_lock
    finally:
        try:
            if got_lock:
                lock_conn.execute(
                    sa.text("SELECT pg_advisory_unlock(:ns, hashtext(:key))"),
                    {"ns": EXTRACTION_LOCK_NAMESPACE, "key": job_id},
                )
        except Exception:
            # A failed unlock must not return a session-level lock to the
            # connection pool. Terminating the connection releases the lock.
            logger.warning(
                "Extraction advisory unlock failed for %s; invalidating connection",
                job_id,
            )
            try:
                lock_conn.invalidate()
            except Exception:
                pass
        finally:
            try:
                lock_conn.close()
            except Exception:
                pass


def _claim_extraction_job_sync(
    job_id: uuid.UUID,
    *,
    expected_claim_token: uuid.UUID | None = None,
    expected_job_type: str = EXTRACTION_JOB_TYPE,
) -> uuid.UUID | None:
    """Claim one queued/stale predebited job and resolve ambiguous commits.

    ``expected_claim_token`` authorizes a watchdog-staged queued delivery. The
    worker atomically exchanges it for a private live token, so a duplicate of
    that recovery message cannot take over a hard-dead ``running`` worker
    before the new lease expires. The caller must hold the per-job advisory
    lock while invoking this function.
    """
    from app.models.sync_database import SyncSessionLocal

    claim_token = uuid.uuid4()
    commit_error: Exception | None = None

    # The second session is both the commit-ack resolver and, when the first
    # transaction did not land, a fresh retry of the same tokenized claim.
    for _resolution_attempt in range(2):
        terminalize = False
        with SyncSessionLocal() as claim_db:
            job = claim_db.scalar(
                sa.select(DocumentJob).where(DocumentJob.id == job_id).with_for_update()
            )
            if job is None:
                logger.warning("Extraction job %s not found", job_id)
                return None
            if (
                job.job_type != expected_job_type
                or job.job_type not in RECOVERY_POLICIES
            ):
                logger.warning(
                    "Predebited job claim skipped for %s: job_type=%s expected=%s",
                    job_id,
                    job.job_type,
                    expected_job_type,
                )
                return None
            if job.status not in {"queued", "running"}:
                return None

            now = datetime.now(timezone.utc)
            lease_expires_at = job.worker_lease_expires_at
            fallback_anchor = (
                job.created_at if job.status == "queued" else job.updated_at
            )
            if lease_expires_at is None and fallback_anchor is not None:
                lease_expires_at = fallback_anchor + timedelta(
                    seconds=EXTRACTION_LEASE_SECONDS
                )
            lease_expired = lease_expires_at is not None and lease_expires_at <= now

            # Only this invocation's private live token may resolve its own
            # ambiguous commit. A watchdog token is stored while QUEUED and is
            # deliberately replaced below before execution begins.
            if job.status == "running" and job.worker_claim_token == claim_token:
                if lease_expired:
                    job.worker_lease_expires_at = now + timedelta(
                        seconds=EXTRACTION_LEASE_SECONDS
                    )
                    job.updated_at = now
                    claim_db.add(job)
                    try:
                        claim_db.commit()
                        return claim_token
                    except Exception as exc:
                        commit_error = exc
                        try:
                            claim_db.rollback()
                        except Exception:
                            pass
                        continue
                return claim_token

            attempts = int(job.worker_claim_attempts or 0)
            if expected_claim_token is not None:
                if (
                    job.status != "queued"
                    or job.worker_claim_token != expected_claim_token
                    or attempts <= 0
                ):
                    return None
                # The watchdog already spent this attempt when it staged the
                # delivery. Exchange its public dispatch token for a private
                # live token without incrementing the bounded counter again.
            else:
                if job.status == "queued" and job.worker_claim_token is not None:
                    return None
                if job.status == "running" and not lease_expired:
                    return None
                if attempts >= EXTRACTION_MAX_CLAIM_ATTEMPTS:
                    terminalize = True

            if not terminalize:
                job.status = "running"
                job.worker_claim_token = claim_token
                if expected_claim_token is None:
                    job.worker_claim_attempts = attempts + 1
                job.worker_lease_expires_at = now + timedelta(
                    seconds=EXTRACTION_LEASE_SECONDS
                )
                job.updated_at = now
                claim_db.add(job)
                try:
                    claim_db.commit()
                    return claim_token
                except Exception as exc:
                    commit_error = exc
                    try:
                        claim_db.rollback()
                    except Exception:
                        pass
                    continue

        if terminalize:
            policy = RECOVERY_POLICIES[expected_job_type]
            _settle_extraction_predebit_after_failure_sync(
                job_id=job_id,
                error_code=policy.error_code,
                error_message=policy.error_message,
                release_trial=policy.release_trial,
            )
            return None

    if commit_error is not None:
        raise commit_error
    return None


def stage_stale_extraction_recovery_sync(job_id: uuid.UUID) -> uuid.UUID | None:
    """Spend one expired attempt and stage a tokenized predebited delivery.

    The caller must hold the per-job advisory lock. The staged token is not a
    live-worker token: ``_claim_extraction_job_sync`` exchanges it atomically
    when the published message starts. Commit acknowledgement ambiguity is
    resolved in a fresh session by matching the queued token.
    """
    from app.models.sync_database import SyncSessionLocal

    dispatch_token = uuid.uuid4()
    commit_error: Exception | None = None
    with SyncSessionLocal() as policy_db:
        policy_snapshot = policy_db.get(DocumentJob, job_id)
    if policy_snapshot is None:
        return None
    job_type = policy_snapshot.job_type
    if job_type not in RECOVERY_POLICIES:
        if policy_snapshot.status not in {"queued", "running"}:
            return None
        now = datetime.now(timezone.utc)
        fallback_anchor = (
            policy_snapshot.created_at
            if policy_snapshot.status == "queued"
            else policy_snapshot.updated_at
        )
        lease_expires_at = policy_snapshot.worker_lease_expires_at
        if lease_expires_at is None and fallback_anchor is not None:
            lease_expires_at = fallback_anchor + timedelta(
                seconds=EXTRACTION_LEASE_SECONDS
            )
        if lease_expires_at is None or lease_expires_at > now:
            return None
        # The ledger-driven watchdog intentionally sees even a future producer
        # that bypassed the registered creation helper. With no safe dispatcher
        # to retry it, use the one existing conditional-delete terminal path
        # after the full lease window instead of stranding the charge forever.
        _settle_extraction_predebit_after_failure_sync(
            job_id=job_id,
            error_code="DOCUMENT_JOB_RECOVERY_UNSUPPORTED",
            error_message="Predebited document job has no recovery dispatcher",
            release_trial=False,
        )
        return None

    for _resolution_attempt in range(2):
        terminalize = False
        with SyncSessionLocal() as recovery_db:
            job = recovery_db.scalar(
                sa.select(DocumentJob).where(DocumentJob.id == job_id).with_for_update()
            )
            if job is None or job.job_type not in RECOVERY_POLICIES:
                return None
            if job.status not in {"queued", "running"}:
                return None

            # Fresh-session resolution of a staged claim whose COMMIT landed
            # but whose acknowledgement was lost.
            if job.status == "queued" and job.worker_claim_token == dispatch_token:
                return dispatch_token

            now = datetime.now(timezone.utc)
            lease_expires_at = job.worker_lease_expires_at
            fallback_anchor = (
                job.created_at if job.status == "queued" else job.updated_at
            )
            if lease_expires_at is None and fallback_anchor is not None:
                lease_expires_at = fallback_anchor + timedelta(
                    seconds=EXTRACTION_LEASE_SECONDS
                )
            if lease_expires_at is None or lease_expires_at > now:
                return None

            attempts = int(job.worker_claim_attempts or 0)
            if attempts >= EXTRACTION_MAX_CLAIM_ATTEMPTS:
                terminalize = True
            else:
                job.status = "queued"
                job.worker_claim_token = dispatch_token
                job.worker_claim_attempts = attempts + 1
                job.worker_lease_expires_at = now + timedelta(
                    seconds=EXTRACTION_LEASE_SECONDS
                )
                job.updated_at = now
                recovery_db.add(job)
                try:
                    recovery_db.commit()
                    return dispatch_token
                except Exception as exc:
                    commit_error = exc
                    try:
                        recovery_db.rollback()
                    except Exception:
                        pass
                    continue

        if terminalize:
            policy = RECOVERY_POLICIES[job.job_type]
            _settle_extraction_predebit_after_failure_sync(
                job_id=job_id,
                error_code=policy.error_code,
                error_message=policy.error_message,
                release_trial=policy.release_trial,
            )
            return None

    if commit_error is not None:
        raise commit_error
    return None


def _run_claimed_extraction_job_sync(
    job_id: uuid.UUID,
    claim_token: uuid.UUID,
) -> None:
    from app.models.sync_database import SyncSessionLocal

    try:
        with SyncSessionLocal() as db:
            job = db.get(DocumentJob, job_id)
            if not job:
                logger.warning("Extraction job %s disappeared after claim", job_id)
                return
            if job.status != "running" or job.worker_claim_token != claim_token:
                logger.info(
                    "Extraction execution skipped for %s: claim is no longer current",
                    job_id,
                )
                return

            pre_debited = int((job.metadata_json or {}).get("pre_debited") or 0)
            ledger_raw = (job.metadata_json or {}).get("predebit_ledger_id")
            if pre_debited <= 0 or not ledger_raw:
                raise RuntimeError("EXTRACTION_PREDEBIT_METADATA_MISSING")
            ledger_id = uuid.UUID(str(ledger_raw))

            doc = db.get(Document, job.document_id) if job.document_id else None
            if not doc or doc.status != "ready":
                raise ValueError("DOCUMENT_NOT_READY")
            template_key = str((job.input_scope or {}).get("template_key") or "")
            template = get_template(template_key)
            locale = (job.input_scope or {}).get("locale")
            domain_mode = (job.input_scope or {}).get("domain_mode")
            chunks = retrieve_extraction_chunks(db, doc.id, template)
            if not chunks:
                raise ValueError("NO_RETRIEVABLE_CHUNKS")

            raw, prompt_tokens, completion_tokens = _call_llm(
                template, chunks, locale, domain_mode
            )
            structured = normalize_result(template.key, raw, len(chunks))
            rendered = render_markdown(template, structured)
            refs = sorted(
                {ref for ref in _walk_refs(structured) if 1 <= ref <= len(chunks)}
            )
            citations = [
                _citation_from_chunk(ref, chunks[ref - 1][0], chunks[ref - 1][1])
                for ref in refs
            ]
            actual_cost = calculate_cost(
                prompt_tokens, completion_tokens, EXTRACTION_MODEL, mode=EXTRACTION_MODE
            )
            _reconcile_sync(db, job.user_id, ledger_id, pre_debited, actual_cost)
            db.add(
                UsageRecord(
                    user_id=job.user_id,
                    message_id=None,
                    model=EXTRACTION_MODEL,
                    prompt_tokens=prompt_tokens,
                    completion_tokens=completion_tokens,
                    total_tokens=prompt_tokens + completion_tokens,
                    cost_credits=actual_cost,
                )
            )
            job.cost_credits = actual_cost
            job.status = "succeeded"
            job.error_code = None
            job.error_message = None
            job.completed_at = datetime.now(timezone.utc)
            job.updated_at = job.completed_at
            job.worker_claim_token = None
            job.worker_lease_expires_at = None
            db.add(job)
            db.add(
                ExtractionResult(
                    job_id=job.id,
                    template_key=template.key,
                    structured_json=structured,
                    rendered_markdown=rendered,
                    citations=citations,
                )
            )
            db.commit()
    except Exception as exc:
        code = str(exc) if str(exc).isupper() else "EXTRACTION_FAILED"
        try:
            _settle_extraction_predebit_after_failure_sync(
                job_id=job_id,
                error_code=code,
                error_message="Structured extraction failed",
                release_trial=True,
            )
        except Exception:
            logger.error(
                "extraction_billing.unresolved job=%s: settlement resolver "
                "failed; predebit left standing for manual review",
                job_id,
                exc_info=True,
            )
        logger.exception("Extraction job %s failed: %s", job_id, exc)


def run_extraction_job_sync(
    job_id: str,
    expected_claim_token: str | None = None,
) -> None:
    """Serialize, lease, and execute one structured extraction delivery."""
    run_leased_predebited_document_job_sync(
        job_id,
        expected_claim_token=expected_claim_token,
        expected_job_type=EXTRACTION_JOB_TYPE,
        execute_claimed=_run_claimed_extraction_job_sync,
    )


def run_leased_predebited_document_job_sync(
    job_id: str,
    *,
    expected_claim_token: str | None,
    expected_job_type: str,
    execute_claimed: Callable[[uuid.UUID, uuid.UUID], None],
) -> None:
    """Run any registered predebited job under the shared lease protocol."""
    job_uuid = uuid.UUID(job_id)
    expected_token_uuid: uuid.UUID | None = None
    if expected_claim_token is not None:
        try:
            expected_token_uuid = uuid.UUID(expected_claim_token)
        except ValueError:
            logger.warning(
                "Predebited job %s received an invalid recovery claim token",
                job_id,
            )
            return

    with extraction_job_advisory_lock(job_id) as got_lock:
        if not got_lock:
            logger.info(
                "Predebited job skipped for %s: another task holds the job lock",
                job_id,
            )
            # A watchdog has already spent a bounded claim before publishing
            # this tokenized delivery. If a stale original message briefly
            # holds the lock and no-ops, ACKing this delivery as well would
            # leave the newly claimed lease with no worker. Raise so Celery's
            # configured autoretry gives the tokenized recovery another turn.
            if expected_token_uuid is not None:
                raise RuntimeError("EXTRACTION_JOB_LOCK_BUSY")
            return
        claim_token = _claim_extraction_job_sync(
            job_uuid,
            expected_claim_token=expected_token_uuid,
            expected_job_type=expected_job_type,
        )
        if claim_token is None:
            return
        execute_claimed(job_uuid, claim_token)
