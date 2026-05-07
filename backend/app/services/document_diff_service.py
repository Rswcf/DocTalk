from __future__ import annotations

import csv
import io
import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Iterable, Sequence

import sqlalchemy as sa
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
from app.services.extraction_service import (
    _apply_provider_options,
    _citation_from_chunk,
    _get_llm_client,
    _json_from_text,
    _retrieve_by_query,
)

logger = logging.getLogger(__name__)

DOCUMENT_DIFF_JOB_TYPE = "document_diff"
DOCUMENT_DIFF_RESULT_KEY = "document_diff"
DOCUMENT_DIFF_MODE = "balanced"
DOCUMENT_DIFF_MODEL = settings.MODE_MODELS.get(DOCUMENT_DIFF_MODE, settings.LLM_MODEL)
DOCUMENT_DIFF_PREDEBIT_CREDITS = 60
MAX_DIFF_CHUNKS_PER_DOC = 8
MAX_DIFF_CONTEXT_CHARS_PER_CHUNK = 1200
MAX_DIFF_CHANGES = 24

DIFF_QUERIES = (
    "material changes obligations rights restrictions payment deadlines liability termination",
    "key terms clauses sections findings recommendations risks assumptions limitations",
    "executive summary important details dates amounts names policy requirements",
)


def _refs(value: Any, max_ref: int) -> list[int]:
    if not isinstance(value, list):
        return []
    refs: list[int] = []
    for item in value:
        try:
            ref = int(item)
        except (TypeError, ValueError):
            continue
        if 1 <= ref <= max_ref and ref not in refs:
            refs.append(ref)
    return refs


def _str(value: Any, fallback: str = "") -> str:
    text = str(value).strip() if value is not None else fallback
    return text[:4000]


def _markdown_cell(value: Any) -> str:
    return str(value or "").replace("|", "\\|").replace("\n", " ").strip()


def _side_refs(prefix: str, refs: Iterable[int]) -> str:
    labels = [f"[{prefix}{ref}]" for ref in refs]
    return " ".join(labels)


def retrieve_diff_chunks(
    db: Session,
    document_id: uuid.UUID,
    *,
    max_chunks: int = MAX_DIFF_CHUNKS_PER_DOC,
) -> list[tuple[Chunk, float]]:
    seen: set[uuid.UUID] = set()
    selected: list[tuple[Chunk, float]] = []
    per_query = max(3, max_chunks // len(DIFF_QUERIES) + 1)
    for query in DIFF_QUERIES:
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


def _context_text(label: str, chunks: Sequence[tuple[Chunk, float]]) -> str:
    parts: list[str] = []
    for idx, (chunk, _score) in enumerate(chunks, start=1):
        text = (chunk.text or "").strip().replace("\x00", "")
        if len(text) > MAX_DIFF_CONTEXT_CHARS_PER_CHUNK:
            text = text[:MAX_DIFF_CONTEXT_CHARS_PER_CHUNK] + "..."
        section = f" | section: {chunk.section_title}" if chunk.section_title else ""
        parts.append(f"[{label}{idx}] page {chunk.page_start}{section}\n{text}")
    return "\n\n".join(parts)


def _system_prompt() -> str:
    return (
        "You are DocTalk's semantic document comparison engine. Compare the OLD and NEW document fragments. "
        "Find only material semantic differences supported by the fragments. Do not invent changes. "
        "Use old_refs with OLD fragment numbers and new_refs with NEW fragment numbers. "
        "For added items, old_refs can be empty. For removed items, new_refs can be empty. "
        "Respond only with valid JSON matching this contract:\n"
        '{"summary": string, "changes": [{"kind": "added"|"removed"|"modified", '
        '"title": string, "detail": string, "old_refs": [number], "new_refs": [number]}]}'
    )


def _user_prompt(
    old_doc: Document,
    new_doc: Document,
    old_chunks: Sequence[tuple[Chunk, float]],
    new_chunks: Sequence[tuple[Chunk, float]],
    locale: str | None,
) -> str:
    language_rule = f"Use the user's interface language if clear from this locale: {locale}." if locale else "Use the document language."
    return (
        f"{language_rule}\n\n"
        f"OLD document: {old_doc.filename}\n"
        f"NEW document: {new_doc.filename}\n\n"
        "OLD fragments:\n"
        f"{_context_text('O', old_chunks)}\n\n"
        "NEW fragments:\n"
        f"{_context_text('N', new_chunks)}"
    )


def _call_diff_llm(
    old_doc: Document,
    new_doc: Document,
    old_chunks: Sequence[tuple[Chunk, float]],
    new_chunks: Sequence[tuple[Chunk, float]],
    locale: str | None,
) -> tuple[dict[str, Any], int, int]:
    client = _get_llm_client(DOCUMENT_DIFF_MODEL)
    messages = [
        {"role": "system", "content": _system_prompt()},
        {"role": "user", "content": _user_prompt(old_doc, new_doc, old_chunks, new_chunks, locale)},
    ]
    kwargs: dict[str, Any] = {
        "model": DOCUMENT_DIFF_MODEL,
        "messages": messages,
        "temperature": 0.1,
        "max_tokens": 2200,
    }
    _apply_provider_options(kwargs, DOCUMENT_DIFF_MODEL)
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
                "content": f"Required contract:\n{_system_prompt()}\n\nOutput:\n{content}",
            },
        ]
        repair_kwargs: dict[str, Any] = {
            "model": DOCUMENT_DIFF_MODEL,
            "messages": repair_messages,
            "temperature": 0,
            "max_tokens": 2200,
        }
        _apply_provider_options(repair_kwargs, DOCUMENT_DIFF_MODEL)
        repaired = client.chat.completions.create(**repair_kwargs)
        repaired_content = repaired.choices[0].message.content or ""
        repair_usage = getattr(repaired, "usage", None)
        prompt_tokens += int(getattr(repair_usage, "prompt_tokens", 0) or 0)
        completion_tokens += int(getattr(repair_usage, "completion_tokens", 0) or 0)
        return _json_from_text(repaired_content), prompt_tokens, completion_tokens


def normalize_diff_result(
    raw: dict[str, Any],
    *,
    old_doc: Document,
    new_doc: Document,
    old_ref_count: int,
    new_ref_count: int,
) -> dict[str, Any]:
    changes = raw.get("changes") if isinstance(raw.get("changes"), list) else []
    normalized_changes: list[dict[str, Any]] = []
    for item in changes[:MAX_DIFF_CHANGES]:
        if not isinstance(item, dict):
            continue
        kind = str(item.get("kind") or "").strip().lower()
        if kind not in {"added", "removed", "modified"}:
            kind = "modified"
        old_refs = _refs(item.get("old_refs"), old_ref_count)
        new_refs = _refs(item.get("new_refs"), new_ref_count)
        if kind == "added" and not new_refs and new_ref_count:
            new_refs = [1]
        if kind == "removed" and not old_refs and old_ref_count:
            old_refs = [1]
        if kind == "modified":
            if not old_refs and old_ref_count:
                old_refs = [1]
            if not new_refs and new_ref_count:
                new_refs = [1]
        normalized_changes.append(
            {
                "kind": kind,
                "title": _str(item.get("title"), "Document change")[:180],
                "detail": _str(item.get("detail")),
                "old_refs": old_refs,
                "new_refs": new_refs,
            }
        )

    return {
        "old_document": {"id": str(old_doc.id), "filename": old_doc.filename},
        "new_document": {"id": str(new_doc.id), "filename": new_doc.filename},
        "summary": _str(raw.get("summary"), "No material differences were found in the retrieved fragments."),
        "changes": normalized_changes,
    }


def render_document_diff_markdown(data: dict[str, Any]) -> str:
    old_doc = data.get("old_document") if isinstance(data.get("old_document"), dict) else {}
    new_doc = data.get("new_document") if isinstance(data.get("new_document"), dict) else {}
    changes = data.get("changes") if isinstance(data.get("changes"), list) else []
    lines = [
        "# Document Diff",
        "",
        f"**Old:** {old_doc.get('filename', 'Old document')}",
        f"**New:** {new_doc.get('filename', 'New document')}",
        "",
        "## Summary",
        str(data.get("summary") or "").strip(),
    ]
    for kind, title in (("added", "Added"), ("removed", "Removed"), ("modified", "Modified")):
        group = [item for item in changes if isinstance(item, dict) and item.get("kind") == kind]
        if not group:
            continue
        lines.extend(["", f"## {title}"])
        for item in group:
            old_refs = _side_refs("O", item.get("old_refs") or [])
            new_refs = _side_refs("N", item.get("new_refs") or [])
            refs = " ".join(part for part in (old_refs, new_refs) if part)
            detail = str(item.get("detail") or "").strip()
            lines.append(f"- **{item.get('title', 'Change')}**: {detail} {refs}".rstrip())
    return "\n".join(lines).strip() + "\n"


def render_document_diff_csv(data: dict[str, Any]) -> str:
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(["kind", "title", "detail", "old_refs", "new_refs"])
    changes = data.get("changes") if isinstance(data.get("changes"), list) else []
    for item in changes:
        if not isinstance(item, dict):
            continue
        writer.writerow(
            [
                item.get("kind", ""),
                item.get("title", ""),
                item.get("detail", ""),
                " ".join(f"O{ref}" for ref in item.get("old_refs") or []),
                " ".join(f"N{ref}" for ref in item.get("new_refs") or []),
            ]
        )
    return buf.getvalue()


def _iter_refs(data: dict[str, Any], side: str) -> Iterable[int]:
    key = "old_refs" if side == "old" else "new_refs"
    changes = data.get("changes") if isinstance(data.get("changes"), list) else []
    for item in changes:
        if not isinstance(item, dict):
            continue
        for ref in item.get(key) or []:
            try:
                yield int(ref)
            except (TypeError, ValueError):
                continue


def _diff_citation(side: str, ref: int, chunk: Chunk, score: float, filename: str) -> dict[str, Any]:
    citation = _citation_from_chunk(ref, chunk, score)
    citation["side"] = side
    citation["label"] = f"{'O' if side == 'old' else 'N'}{ref}"
    citation["document_filename"] = filename
    return citation


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


def run_document_diff_job_sync(job_id: str) -> None:
    from app.models.sync_database import SyncSessionLocal

    job_uuid = uuid.UUID(job_id)
    with SyncSessionLocal() as db:
        job = db.get(DocumentJob, job_uuid)
        if not job:
            logger.warning("Document diff job %s not found", job_id)
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
            scope = job.input_scope or {}
            old_doc_id = uuid.UUID(str(scope.get("old_document_id")))
            new_doc_id = uuid.UUID(str(scope.get("new_document_id")))
            old_doc = db.get(Document, old_doc_id)
            new_doc = db.get(Document, new_doc_id)
            if not old_doc or not new_doc or old_doc.status != "ready" or new_doc.status != "ready":
                raise ValueError("DOCUMENT_NOT_READY")
            if old_doc.user_id != job.user_id or new_doc.user_id != job.user_id:
                raise ValueError("DOCUMENT_ACCESS_DENIED")

            old_chunks = retrieve_diff_chunks(db, old_doc.id)
            new_chunks = retrieve_diff_chunks(db, new_doc.id)
            if not old_chunks or not new_chunks:
                raise ValueError("NO_RETRIEVABLE_CHUNKS")

            raw, prompt_tokens, completion_tokens = _call_diff_llm(
                old_doc,
                new_doc,
                old_chunks,
                new_chunks,
                scope.get("locale"),
            )
            structured = normalize_diff_result(
                raw,
                old_doc=old_doc,
                new_doc=new_doc,
                old_ref_count=len(old_chunks),
                new_ref_count=len(new_chunks),
            )
            rendered = render_document_diff_markdown(structured)
            old_refs = sorted({ref for ref in _iter_refs(structured, "old") if 1 <= ref <= len(old_chunks)})
            new_refs = sorted({ref for ref in _iter_refs(structured, "new") if 1 <= ref <= len(new_chunks)})
            citations = [
                _diff_citation("old", ref, old_chunks[ref - 1][0], old_chunks[ref - 1][1], old_doc.filename)
                for ref in old_refs
            ]
            citations.extend(
                _diff_citation("new", ref, new_chunks[ref - 1][0], new_chunks[ref - 1][1], new_doc.filename)
                for ref in new_refs
            )
            actual_cost = calculate_cost(
                prompt_tokens,
                completion_tokens,
                DOCUMENT_DIFF_MODEL,
                mode=DOCUMENT_DIFF_MODE,
            )
            if ledger_id and pre_debited > 0:
                _reconcile_sync(db, job.user_id, ledger_id, pre_debited, actual_cost)
            db.add(
                UsageRecord(
                    user_id=job.user_id,
                    message_id=None,
                    model=DOCUMENT_DIFF_MODEL,
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
                    template_key=DOCUMENT_DIFF_RESULT_KEY,
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
                    logger.exception("Failed to refund document diff job %s", job_id)
            code = str(exc) if str(exc).isupper() else "DOCUMENT_DIFF_FAILED"
            job.status = "failed"
            job.error_code = code[:64]
            job.error_message = "Document comparison failed"
            job.completed_at = datetime.now(timezone.utc)
            job.updated_at = job.completed_at
            db.add(job)
            db.commit()
            logger.exception("Document diff job %s failed: %s", job_id, exc)
