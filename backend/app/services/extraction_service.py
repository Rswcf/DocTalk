from __future__ import annotations

import csv
import io
import json
import logging
import re
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Iterable, Sequence

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
from app.services.credit_service import calculate_cost
from app.services.document_element_service import get_element_aware_chunks
from app.services.embedding_service import embedding_service

logger = logging.getLogger(__name__)

EXTRACTION_JOB_TYPE = "extraction"
EXTRACTION_MODE = "balanced"
EXTRACTION_MODEL = settings.MODE_MODELS.get(EXTRACTION_MODE, settings.LLM_MODEL)
EXTRACTION_PREDEBIT_CREDITS = 25
FREE_MONTHLY_EXTRACTION_LIMIT = 2
MAX_CONTEXT_CHUNKS = 10
MAX_CONTEXT_CHARS_PER_CHUNK = 1400


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
        return OpenAI(api_key=settings.DEEPSEEK_API_KEY, base_url=settings.DEEPSEEK_BASE_URL)
    if not settings.OPENROUTER_API_KEY:
        raise RuntimeError("OPENROUTER_API_KEY is not configured")
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
        raise ValueError("Extraction response must be a JSON object")
    return data


def _valid_bbox(bb: dict[str, Any]) -> bool:
    return all(isinstance(bb.get(k), (int, float)) for k in ("x", "y", "w", "h"))


def _citation_from_chunk(ref_num: int, chunk: Chunk, score: float = 0.0) -> dict[str, Any]:
    bboxes = [
        bb for bb in (chunk.bboxes or [])
        if isinstance(bb, dict) and _valid_bbox(bb)
    ]
    bboxes.sort(
        key=lambda bb: (
            int(bb.get("page", chunk.page_start)) if isinstance(bb.get("page", chunk.page_start), (int, float)) else chunk.page_start,
            bb.get("y", 0),
            bb.get("x", 0),
        )
    )
    page_counts: dict[int, int] = {}
    for bb in bboxes:
        raw_page = bb.get("page", chunk.page_start)
        page = int(raw_page) if isinstance(raw_page, (int, float)) else chunk.page_start
        page_counts[page] = page_counts.get(page, 0) + 1
    best_page = min(page_counts, key=lambda p: (-page_counts[p], p)) if page_counts else chunk.page_start
    snippet = ((f"{chunk.section_title}: " if chunk.section_title else "") + (chunk.text or ""))[:140]
    return {
        "ref_index": ref_num,
        "chunk_id": str(chunk.id),
        "page": best_page,
        "page_end": chunk.page_end,
        "bboxes": bboxes,
        "text_snippet": snippet,
        "offset": 0,
        "confidence_score": round(float(score or 0.0), 3),
        "context_text": (chunk.text or "")[:300],
        "document_id": str(chunk.document_id),
    }


def _retrieve_by_query(db: Session, document_id: uuid.UUID, query: str, top_k: int) -> list[tuple[Chunk, float]]:
    try:
        qvec = embedding_service.embed_texts([query])[0]
        client = embedding_service.get_qdrant_client()
        response = client.query_points(
            collection_name=settings.QDRANT_COLLECTION,
            query=qvec,
            limit=max(top_k * 3, top_k),
            query_filter=Filter(must=[FieldCondition(key="document_id", match=MatchValue(value=str(document_id)))]),
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
        return [(ch, scores.get(ch.id, 0.0)) for ch in chunks if len((ch.text or "").strip()) >= 80][:top_k]
    except Exception as exc:
        logger.warning("Extraction vector retrieval failed, falling back to first chunks: %s", exc)
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
    for chunk, score in get_element_aware_chunks(db, document_id, max_chunks=element_budget):
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
        "You are DocTalk's structured extraction engine. Extract only facts supported by the provided document fragments. "
        "Every extracted item must include source_refs using the bracket numbers of the fragments that support it. "
        "Do not invent facts. Respond only with valid JSON matching this contract:\n"
        f"{template.json_contract}\n"
        f"{domain}"
    )


def _user_prompt(template: ExtractionTemplate, chunks: Sequence[tuple[Chunk, float]], locale: str | None) -> str:
    language_rule = f"Use the user's interface language if clear from this locale: {locale}." if locale else "Use the document language."
    return (
        f"Template: {template.title}\n"
        f"Goal: {template.description}\n"
        f"{language_rule}\n\n"
        "Document fragments:\n"
        f"{_context_text(chunks)}"
    )


def _call_llm(template: ExtractionTemplate, chunks: Sequence[tuple[Chunk, float]], locale: str | None, domain_mode: str | None) -> tuple[dict[str, Any], int, int]:
    client = _get_llm_client(EXTRACTION_MODEL)
    messages = [
        {"role": "system", "content": _system_prompt(template, domain_mode)},
        {"role": "user", "content": _user_prompt(template, chunks, locale)},
    ]
    kwargs: dict[str, Any] = {
        "model": EXTRACTION_MODEL,
        "messages": messages,
        "temperature": 0.1,
        "max_tokens": 1800,
    }
    _apply_provider_options(kwargs, EXTRACTION_MODEL)
    response = client.chat.completions.create(**kwargs)
    content = response.choices[0].message.content or ""
    usage = getattr(response, "usage", None)
    prompt_tokens = int(getattr(usage, "prompt_tokens", 0) or 0)
    completion_tokens = int(getattr(usage, "completion_tokens", 0) or 0)
    try:
        return _json_from_text(content), prompt_tokens, completion_tokens
    except Exception:
        repair_messages = [
            {
                "role": "system",
                "content": "Repair the following model output into valid JSON only. Do not add commentary.",
            },
            {
                "role": "user",
                "content": f"Required contract:\n{template.json_contract}\n\nOutput:\n{content}",
            },
        ]
        repair_kwargs: dict[str, Any] = {
            "model": EXTRACTION_MODEL,
            "messages": repair_messages,
            "temperature": 0,
            "max_tokens": 1800,
        }
        _apply_provider_options(repair_kwargs, EXTRACTION_MODEL)
        repaired = client.chat.completions.create(**repair_kwargs)
        repaired_content = repaired.choices[0].message.content or ""
        repair_usage = getattr(repaired, "usage", None)
        prompt_tokens += int(getattr(repair_usage, "prompt_tokens", 0) or 0)
        completion_tokens += int(getattr(repair_usage, "completion_tokens", 0) or 0)
        return _json_from_text(repaired_content), prompt_tokens, completion_tokens


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


def normalize_result(template_key: str, raw: dict[str, Any], max_ref: int) -> dict[str, Any]:
    if template_key == "executive_summary":
        key_points = raw.get("key_points") if isinstance(raw.get("key_points"), list) else []
        risks = raw.get("risks_or_open_questions") if isinstance(raw.get("risks_or_open_questions"), list) else []
        return {
            "title": _str(raw.get("title"), "Executive Summary")[:200],
            "summary": _str(raw.get("summary")),
            "key_points": [
                {"text": _str(item.get("text") if isinstance(item, dict) else item), "source_refs": _refs(item.get("source_refs") if isinstance(item, dict) else [], max_ref)}
                for item in key_points[:8]
            ],
            "risks_or_open_questions": [
                {"text": _str(item.get("text") if isinstance(item, dict) else item), "source_refs": _refs(item.get("source_refs") if isinstance(item, dict) else [], max_ref)}
                for item in risks[:5]
            ],
        }
    if template_key == "key_facts":
        facts = raw.get("facts") if isinstance(raw.get("facts"), list) else []
        return {
            "facts": [
                {
                    "label": _str(item.get("label") if isinstance(item, dict) else "Fact")[:160],
                    "value": _str(item.get("value") if isinstance(item, dict) else item)[:240],
                    "context": _str(item.get("context") if isinstance(item, dict) else ""),
                    "source_refs": _refs(item.get("source_refs") if isinstance(item, dict) else [], max_ref),
                }
                for item in facts[:30]
            ]
        }
    if template_key == "evidence_table":
        items = raw.get("items") if isinstance(raw.get("items"), list) else []
        return {
            "items": [
                {
                    "topic": _str(item.get("topic") if isinstance(item, dict) else "Evidence")[:160],
                    "finding": _str(item.get("finding") if isinstance(item, dict) else item),
                    "evidence": _str(item.get("evidence") if isinstance(item, dict) else ""),
                    "source_refs": _refs(item.get("source_refs") if isinstance(item, dict) else [], max_ref),
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
            lines.append(f"- {item.get('text', '')} {_cite(item.get('source_refs', []))}".rstrip())
        risks = data.get("risks_or_open_questions", [])
        if risks:
            lines.extend(["", "## Risks / Open Questions"])
            for item in risks:
                lines.append(f"- {item.get('text', '')} {_cite(item.get('source_refs', []))}".rstrip())
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
            writer.writerow(["key_point", item.get("text", ""), " ".join(map(str, item.get("source_refs", [])))])
        for item in data.get("risks_or_open_questions", []):
            writer.writerow(["risk_or_open_question", item.get("text", ""), " ".join(map(str, item.get("source_refs", [])))])
    elif template_key == "key_facts":
        writer.writerow(["label", "value", "context", "sources"])
        for item in data.get("facts", []):
            writer.writerow([item.get("label", ""), item.get("value", ""), item.get("context", ""), " ".join(map(str, item.get("source_refs", [])))])
    else:
        writer.writerow(["topic", "finding", "evidence", "sources"])
        for item in data.get("items", []):
            writer.writerow([item.get("topic", ""), item.get("finding", ""), item.get("evidence", ""), " ".join(map(str, item.get("source_refs", [])))])
    return buf.getvalue()


def _refund_predebit_sync(db: Session, user_id: uuid.UUID, pre_debited: int, ledger_id: uuid.UUID) -> None:
    result = db.execute(sa.delete(CreditLedger).where(CreditLedger.id == ledger_id))
    if result.rowcount and result.rowcount > 0:
        db.execute(
            sa.update(User)
            .where(User.id == user_id)
            .values(credits_balance=User.credits_balance + pre_debited)
        )


def _reconcile_sync(
    db: Session,
    user_id: uuid.UUID,
    ledger_id: uuid.UUID,
    pre_debited: int,
    actual_cost: int,
) -> None:
    diff = pre_debited - actual_cost
    if diff:
        db.execute(
            sa.update(User)
            .where(User.id == user_id)
            .values(credits_balance=User.credits_balance + diff)
        )
    db.execute(
        sa.update(CreditLedger)
        .where(CreditLedger.id == ledger_id)
        .values(delta=-actual_cost, balance_after=CreditLedger.balance_after + diff)
    )


def run_extraction_job_sync(job_id: str) -> None:
    from app.models.sync_database import SyncSessionLocal

    job_uuid = uuid.UUID(job_id)
    with SyncSessionLocal() as db:
        job = db.get(DocumentJob, job_uuid)
        if not job:
            logger.warning("Extraction job %s not found", job_id)
            return
        if job.status not in ("queued", "running"):
            return

        job.status = "running"
        job.updated_at = datetime.now(timezone.utc)
        db.add(job)
        db.commit()

        pre_debited = int((job.metadata_json or {}).get("pre_debited") or 0)
        ledger_raw = (job.metadata_json or {}).get("predebit_ledger_id")
        ledger_id = uuid.UUID(str(ledger_raw)) if ledger_raw else None

        try:
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

            raw, prompt_tokens, completion_tokens = _call_llm(template, chunks, locale, domain_mode)
            structured = normalize_result(template.key, raw, len(chunks))
            rendered = render_markdown(template, structured)
            refs = sorted({ref for ref in _walk_refs(structured) if 1 <= ref <= len(chunks)})
            citations = [
                _citation_from_chunk(ref, chunks[ref - 1][0], chunks[ref - 1][1])
                for ref in refs
            ]
            actual_cost = calculate_cost(prompt_tokens, completion_tokens, EXTRACTION_MODEL, mode=EXTRACTION_MODE)
            if ledger_id and pre_debited > 0:
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
            db.rollback()
            job = db.get(DocumentJob, job_uuid)
            if not job:
                return
            if ledger_id and pre_debited > 0:
                try:
                    _refund_predebit_sync(db, job.user_id, pre_debited, ledger_id)
                except Exception:
                    logger.exception("Failed to refund extraction job %s", job_id)
            code = str(exc) if str(exc).isupper() else "EXTRACTION_FAILED"
            job.status = "failed"
            job.error_code = code[:64]
            job.error_message = "Structured extraction failed"
            job.completed_at = datetime.now(timezone.utc)
            job.updated_at = job.completed_at
            db.add(job)
            db.commit()
            logger.exception("Extraction job %s failed: %s", job_id, exc)
