from __future__ import annotations

import csv
import io
import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Sequence

from app.models.tables import (
    Document,
    DocumentJob,
    ExtractionResult,
    UsageRecord,
    collection_documents,
)
from app.services.credit_service import calculate_cost
from app.services.extraction_service import (
    EXTRACTION_MODE,
    EXTRACTION_MODEL,
    ExtractionTemplate,
    _call_llm,
    _citation_from_chunk,
    _reconcile_sync,
    _refs,
    _refund_predebit_sync,
    _str,
    retrieve_extraction_chunks,
)

logger = logging.getLogger(__name__)

BATCH_TEMPLATE_JOB_TYPE = "batch_template"
QUESTION_TEMPLATE_RESULT_KEY = "question_template"
QUESTION_TEMPLATE_PREDEBIT_PER_CELL = 15
MAX_TEMPLATE_QUESTIONS = 20
MAX_TEMPLATE_DOCS = 25


def normalize_questions(questions: Sequence[Any]) -> list[str]:
    normalized: list[str] = []
    for item in questions:
        question = str(item or "").strip()
        if not question:
            continue
        question = " ".join(question.split())
        if question not in normalized:
            normalized.append(question[:500])
        if len(normalized) >= MAX_TEMPLATE_QUESTIONS:
            break
    return normalized


def estimated_template_cost(question_count: int, document_count: int) -> int:
    return max(QUESTION_TEMPLATE_PREDEBIT_PER_CELL, question_count * document_count * QUESTION_TEMPLATE_PREDEBIT_PER_CELL)


def _question_extraction_template(question: str) -> ExtractionTemplate:
    return ExtractionTemplate(
        key=QUESTION_TEMPLATE_RESULT_KEY,
        title="Question Template Answer",
        description=question,
        query_prompts=(question,),
        json_contract='{"answer": string, "source_refs": [number]}',
    )


def _normalize_answer(raw: dict[str, Any], max_ref: int) -> dict[str, Any]:
    return {
        "answer": _str(raw.get("answer")),
        "source_refs": _refs(raw.get("source_refs"), max_ref),
    }


def render_question_template_markdown(data: dict[str, Any]) -> str:
    template = data.get("template") if isinstance(data.get("template"), dict) else {}
    answers = data.get("answers") if isinstance(data.get("answers"), list) else []
    lines = [f"# {template.get('name') or 'Question Template'}", ""]
    current_doc = None
    for answer in answers:
        if not isinstance(answer, dict):
            continue
        doc_name = answer.get("document_filename") or "Document"
        if doc_name != current_doc:
            current_doc = doc_name
            lines.extend(["", f"## {doc_name}", ""])
        lines.append(f"### Q{int(answer.get('question_index') or 0) + 1}: {answer.get('question') or ''}")
        lines.append("")
        lines.append(str(answer.get("answer") or ""))
        refs = answer.get("source_refs") if isinstance(answer.get("source_refs"), list) else []
        if refs:
            lines.append("")
            lines.append("Sources: " + " ".join(f"[{ref}]" for ref in refs))
        lines.append("")
    return "\n".join(lines).strip() + "\n"


def render_question_template_csv(data: dict[str, Any]) -> str:
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(["document", "question", "answer", "sources"])
    answers = data.get("answers") if isinstance(data.get("answers"), list) else []
    for answer in answers:
        if not isinstance(answer, dict):
            continue
        writer.writerow([
            answer.get("document_filename") or "",
            answer.get("question") or "",
            answer.get("answer") or "",
            " ".join(map(str, answer.get("source_refs") or [])),
        ])
    return buf.getvalue()


def run_batch_template_job_sync(job_id: str) -> None:
    from sqlalchemy import select

    from app.models.sync_database import SyncSessionLocal

    job_uuid = uuid.UUID(job_id)
    with SyncSessionLocal() as db:
        job = db.get(DocumentJob, job_uuid)
        if not job:
            logger.warning("Question template job %s not found", job_id)
            return
        if job.status not in ("queued", "running"):
            return

        job.status = "running"
        job.updated_at = datetime.now(timezone.utc)
        db.add(job)
        db.commit()

        scope = job.input_scope or {}
        metadata = job.metadata_json or {}
        pre_debited = int(metadata.get("pre_debited") or 0)
        ledger_raw = metadata.get("predebit_ledger_id")
        ledger_id = uuid.UUID(str(ledger_raw)) if ledger_raw else None

        try:
            questions = normalize_questions(scope.get("questions") or [])
            if not questions:
                raise ValueError("QUESTION_TEMPLATE_EMPTY")

            raw_document_ids = scope.get("document_ids") or []
            document_ids = [uuid.UUID(str(item)) for item in raw_document_ids][:MAX_TEMPLATE_DOCS]
            if not document_ids and job.collection_id:
                rows = db.execute(
                    select(collection_documents.c.document_id)
                    .where(collection_documents.c.collection_id == job.collection_id)
                    .limit(MAX_TEMPLATE_DOCS)
                )
                document_ids = [row[0] for row in rows.all()]
            if not document_ids and job.document_id:
                document_ids = [job.document_id]
            if not document_ids:
                raise ValueError("NO_DOCUMENTS")

            docs = list(db.execute(select(Document).where(Document.id.in_(document_ids))).scalars())
            docs_by_id = {doc.id: doc for doc in docs}
            ordered_docs = [docs_by_id[doc_id] for doc_id in document_ids if doc_id in docs_by_id]
            if not ordered_docs:
                raise ValueError("NO_DOCUMENTS")
            not_ready = [doc.filename for doc in ordered_docs if doc.status != "ready"]
            if not_ready:
                raise ValueError("DOCUMENT_NOT_READY")

            locale = scope.get("locale")
            answers: list[dict[str, Any]] = []
            all_citations: list[dict[str, Any]] = []
            prompt_tokens = 0
            completion_tokens = 0
            for doc in ordered_docs:
                for question_index, question in enumerate(questions):
                    template = _question_extraction_template(question)
                    chunks = retrieve_extraction_chunks(db, doc.id, template, max_chunks=8)
                    if not chunks:
                        answers.append({
                            "document_id": str(doc.id),
                            "document_filename": doc.filename,
                            "question_index": question_index,
                            "question": question,
                            "answer": "",
                            "source_refs": [],
                            "citations": [],
                        })
                        continue
                    raw, p_tokens, c_tokens = _call_llm(template, chunks, locale, None)
                    prompt_tokens += p_tokens
                    completion_tokens += c_tokens
                    normalized = _normalize_answer(raw, len(chunks))
                    citations = [
                        _citation_from_chunk(ref, chunks[ref - 1][0], chunks[ref - 1][1])
                        for ref in normalized["source_refs"]
                        if 1 <= ref <= len(chunks)
                    ]
                    for citation in citations:
                        citation["document_filename"] = doc.filename
                    all_citations.extend(citations)
                    answers.append({
                        "document_id": str(doc.id),
                        "document_filename": doc.filename,
                        "question_index": question_index,
                        "question": question,
                        "answer": normalized["answer"],
                        "source_refs": normalized["source_refs"],
                        "citations": citations,
                    })

            structured = {
                "template": {
                    "id": scope.get("template_id"),
                    "name": scope.get("template_name") or "Question Template",
                    "questions": questions,
                },
                "documents": [{"id": str(doc.id), "filename": doc.filename} for doc in ordered_docs],
                "answers": answers,
            }
            rendered = render_question_template_markdown(structured)
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
                    template_key=QUESTION_TEMPLATE_RESULT_KEY,
                    structured_json=structured,
                    rendered_markdown=rendered,
                    citations=all_citations,
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
                    logger.exception("Failed to refund question template job %s", job_id)
            code = str(exc) if str(exc).isupper() else "BATCH_TEMPLATE_FAILED"
            job.status = "failed"
            job.error_code = code[:64]
            job.error_message = "Question template run failed"
            job.completed_at = datetime.now(timezone.utc)
            job.updated_at = job.completed_at
            db.add(job)
            db.commit()
            logger.exception("Question template job %s failed: %s", job_id, exc)
