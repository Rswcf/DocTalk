"""Reusable question template APIs for document and collection workflows."""
from __future__ import annotations

import re
import uuid
from typing import Any, Literal
from urllib.parse import quote

import sqlalchemy as sa
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import Response, StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.deps import get_db_session, require_auth
from app.models.tables import (
    Collection,
    CreditLedger,
    Document,
    DocumentJob,
    ProductEvent,
    QuestionTemplate,
    User,
)
from app.services import credit_service
from app.services.doc_service import can_access_document
from app.services.question_template_service import (
    BATCH_TEMPLATE_JOB_TYPE,
    MAX_TEMPLATE_DOCS,
    MAX_TEMPLATE_QUESTIONS,
    estimated_template_cost,
    normalize_questions,
    render_question_template_csv,
)

router = APIRouter(prefix="/api", tags=["question-templates"])


class QuestionTemplatePayload(BaseModel):
    id: str
    name: str
    description: str | None
    questions: list[str]
    created_at: str
    updated_at: str


class UpsertQuestionTemplateRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=160)
    description: str | None = Field(None, max_length=2000)
    questions: list[str] = Field(..., min_length=1, max_length=MAX_TEMPLATE_QUESTIONS)


class RunQuestionTemplateRequest(BaseModel):
    template_id: uuid.UUID
    locale: str | None = Field(None, max_length=16)


class ExtractionResultPayload(BaseModel):
    template_key: str
    structured_json: dict[str, Any]
    rendered_markdown: str
    citations: list[dict[str, Any]]
    created_at: str


class QuestionTemplateRunResponse(BaseModel):
    id: str
    document_id: str | None
    collection_id: str | None
    job_type: str
    status: str
    input_scope: dict[str, Any]
    cost_credits: int
    error_code: str | None
    error_message: str | None
    created_at: str
    updated_at: str
    completed_at: str | None
    result: ExtractionResultPayload | None = None


def _content_disposition(filename: str) -> str:
    clean = re.sub(r"[\r\n\t]", " ", filename)
    ascii_fallback = clean.encode("ascii", "replace").decode("ascii")
    ascii_fallback = re.sub(r'[?"\\]', "_", ascii_fallback)
    if not ascii_fallback.strip("_. "):
        ascii_fallback = "question-template"
    return f"attachment; filename=\"{ascii_fallback}\"; filename*=UTF-8''{quote(clean, safe='')}"


def _template_response(template: QuestionTemplate) -> QuestionTemplatePayload:
    return QuestionTemplatePayload(
        id=str(template.id),
        name=template.name,
        description=template.description,
        questions=normalize_questions(template.questions or []),
        created_at=template.created_at.isoformat(),
        updated_at=template.updated_at.isoformat(),
    )


def _run_response(job: DocumentJob) -> QuestionTemplateRunResponse:
    result = None
    if job.extraction_result:
        er = job.extraction_result
        result = ExtractionResultPayload(
            template_key=er.template_key,
            structured_json=er.structured_json or {},
            rendered_markdown=er.rendered_markdown or "",
            citations=er.citations or [],
            created_at=er.created_at.isoformat(),
        )
    return QuestionTemplateRunResponse(
        id=str(job.id),
        document_id=str(job.document_id) if job.document_id else None,
        collection_id=str(job.collection_id) if job.collection_id else None,
        job_type=job.job_type,
        status=job.status,
        input_scope=job.input_scope or {},
        cost_credits=int(job.cost_credits or 0),
        error_code=job.error_code,
        error_message=job.error_message,
        created_at=job.created_at.isoformat(),
        updated_at=job.updated_at.isoformat(),
        completed_at=job.completed_at.isoformat() if job.completed_at else None,
        result=result,
    )


def _require_plan(user: User, allowed: set[str], required_plan: str) -> None:
    plan = (user.plan or "free").lower()
    if plan in allowed:
        return
    raise HTTPException(
        status_code=403,
        detail={
            "error": "PLAN_REQUIRED",
            "message": f"Question templates require {required_plan.title()}",
            "required_plan": required_plan,
        },
    )


def _clean_description(value: str | None) -> str | None:
    if value is None:
        return None
    text = value.strip()
    return text or None


async def _get_owned_template(template_id: uuid.UUID, user: User, db: AsyncSession) -> QuestionTemplate:
    template = await db.get(QuestionTemplate, template_id)
    if not template or template.user_id != user.id:
        raise HTTPException(
            status_code=404,
            detail={"error": "QUESTION_TEMPLATE_NOT_FOUND", "message": "Question template not found"},
        )
    return template


async def _verify_document(
    document_id: uuid.UUID,
    user: User,
    db: AsyncSession,
    *,
    require_ready: bool = False,
) -> Document:
    doc = await db.get(Document, document_id)
    if not doc or not can_access_document(doc, user):
        raise HTTPException(
            status_code=404,
            detail={"error": "DOCUMENT_NOT_FOUND", "message": "Document not found"},
        )
    if require_ready and doc.status != "ready":
        raise HTTPException(
            status_code=409,
            detail={"error": "DOCUMENT_NOT_READY", "message": "Document is not ready"},
        )
    return doc


async def _verify_collection(
    collection_id: uuid.UUID,
    user: User,
    db: AsyncSession,
    *,
    require_ready: bool = False,
) -> Collection:
    row = await db.execute(
        select(Collection)
        .options(selectinload(Collection.documents))
        .where(Collection.id == collection_id)
        .where(Collection.user_id == user.id)
    )
    collection = row.scalar_one_or_none()
    if not collection:
        raise HTTPException(
            status_code=404,
            detail={"error": "COLLECTION_NOT_FOUND", "message": "Collection not found"},
        )
    if not require_ready:
        return collection
    if not collection.documents:
        raise HTTPException(
            status_code=400,
            detail={"error": "COLLECTION_EMPTY", "message": "Collection has no documents"},
        )
    if len(collection.documents) > MAX_TEMPLATE_DOCS:
        raise HTTPException(
            status_code=400,
            detail={
                "error": "QUESTION_TEMPLATE_TOO_MANY_DOCUMENTS",
                "message": f"Template runs support up to {MAX_TEMPLATE_DOCS} documents",
                "limit": MAX_TEMPLATE_DOCS,
            },
        )
    not_ready = [doc.filename for doc in collection.documents if doc.status != "ready"]
    if not_ready:
        raise HTTPException(
            status_code=409,
            detail={"error": "DOCUMENT_NOT_READY", "message": "All collection documents must be ready"},
        )
    return collection


async def _create_run(
    *,
    user: User,
    db: AsyncSession,
    template: QuestionTemplate,
    document_ids: list[uuid.UUID],
    locale: str | None,
    document_id: uuid.UUID | None = None,
    collection_id: uuid.UUID | None = None,
) -> DocumentJob:
    questions = normalize_questions(template.questions or [])
    if not questions:
        raise HTTPException(
            status_code=400,
            detail={"error": "QUESTION_TEMPLATE_EMPTY", "message": "Question template has no questions"},
        )

    predebit = estimated_template_cost(len(questions), len(document_ids))
    job = DocumentJob(
        user_id=user.id,
        document_id=document_id,
        collection_id=collection_id,
        job_type=BATCH_TEMPLATE_JOB_TYPE,
        status="queued",
        input_scope={
            "template_id": str(template.id),
            "template_name": template.name,
            "questions": questions,
            "document_ids": [str(doc_id) for doc_id in document_ids],
            "locale": locale,
        },
        cost_credits=0,
    )
    db.add(job)
    await db.flush()

    ledger_id = await credit_service.debit_credits(
        db,
        user_id=user.id,
        cost=predebit,
        reason="question_template",
        ref_type="document_job",
        ref_id=str(job.id),
    )
    if ledger_id is None:
        await db.rollback()
        balance = await credit_service.get_user_credits(db, user.id)
        raise HTTPException(
            status_code=402,
            detail={
                "error": "INSUFFICIENT_CREDITS",
                "message": "Insufficient credits to run question template",
                "required": predebit,
                "balance": balance,
            },
        )

    job.metadata_json = {
        "predebit_ledger_id": str(ledger_id),
        "pre_debited": predebit,
    }
    db.add(
        ProductEvent(
            user_id=user.id,
            event_name="question_template_run_created",
            source="collection_reader" if collection_id else "document_reader",
            reason="batch_template" if collection_id else "question_template",
            plan=(user.plan or "free").lower(),
            metadata_json={
                "job_id": str(job.id),
                "template_id": str(template.id),
                "question_count": len(questions),
                "document_count": len(document_ids),
            },
        )
    )
    await db.commit()
    await db.refresh(job)

    try:
        _enqueue_batch_template_job(str(job.id))
    except Exception as exc:
        job.status = "failed"
        job.error_code = "QUESTION_TEMPLATE_QUEUE_FAILED"
        job.error_message = "Failed to queue question template run"
        result = await db.execute(sa.delete(CreditLedger).where(CreditLedger.id == ledger_id))
        if result.rowcount and result.rowcount > 0:
            await db.execute(
                sa.update(User)
                .where(User.id == user.id)
                .values(credits_balance=User.credits_balance + predebit)
            )
        await db.commit()
        raise HTTPException(
            status_code=500,
            detail={"error": "QUESTION_TEMPLATE_QUEUE_FAILED", "message": "Failed to queue question template run"},
        ) from exc

    return job


def _enqueue_batch_template_job(job_id: str) -> None:
    from app.workers.question_template_worker import run_batch_template_job

    run_batch_template_job.delay(job_id)


@router.get("/question-templates", response_model=list[QuestionTemplatePayload])
async def list_question_templates(
    user: User = Depends(require_auth),
    db: AsyncSession = Depends(get_db_session),
):
    rows = await db.execute(
        select(QuestionTemplate)
        .where(QuestionTemplate.user_id == user.id)
        .order_by(QuestionTemplate.updated_at.desc())
    )
    return [_template_response(template) for template in rows.scalars()]


@router.post("/question-templates", response_model=QuestionTemplatePayload, status_code=status.HTTP_201_CREATED)
async def create_question_template(
    body: UpsertQuestionTemplateRequest,
    user: User = Depends(require_auth),
    db: AsyncSession = Depends(get_db_session),
):
    questions = normalize_questions(body.questions)
    if not questions:
        raise HTTPException(
            status_code=400,
            detail={"error": "QUESTION_TEMPLATE_EMPTY", "message": "Question template must include at least one question"},
        )
    template = QuestionTemplate(
        user_id=user.id,
        name=body.name.strip(),
        description=_clean_description(body.description),
        questions=questions,
    )
    db.add(template)
    await db.commit()
    await db.refresh(template)
    return _template_response(template)


@router.patch("/question-templates/{template_id}", response_model=QuestionTemplatePayload)
async def update_question_template(
    template_id: uuid.UUID,
    body: UpsertQuestionTemplateRequest,
    user: User = Depends(require_auth),
    db: AsyncSession = Depends(get_db_session),
):
    template = await _get_owned_template(template_id, user, db)
    questions = normalize_questions(body.questions)
    if not questions:
        raise HTTPException(
            status_code=400,
            detail={"error": "QUESTION_TEMPLATE_EMPTY", "message": "Question template must include at least one question"},
        )
    template.name = body.name.strip()
    template.description = _clean_description(body.description)
    template.questions = questions
    db.add(template)
    await db.commit()
    await db.refresh(template)
    return _template_response(template)


@router.delete("/question-templates/{template_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_question_template(
    template_id: uuid.UUID,
    user: User = Depends(require_auth),
    db: AsyncSession = Depends(get_db_session),
):
    template = await _get_owned_template(template_id, user, db)
    await db.delete(template)
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post(
    "/documents/{document_id}/question-template-runs",
    response_model=QuestionTemplateRunResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
async def run_document_question_template(
    document_id: uuid.UUID,
    body: RunQuestionTemplateRequest,
    user: User = Depends(require_auth),
    db: AsyncSession = Depends(get_db_session),
):
    _require_plan(user, {"plus", "pro"}, "plus")
    doc = await _verify_document(document_id, user, db, require_ready=True)
    template = await _get_owned_template(body.template_id, user, db)
    job = await _create_run(
        user=user,
        db=db,
        template=template,
        document_ids=[doc.id],
        document_id=doc.id,
        locale=body.locale,
    )
    return _run_response(job)


@router.get("/documents/{document_id}/question-template-runs", response_model=list[QuestionTemplateRunResponse])
async def list_document_question_template_runs(
    document_id: uuid.UUID,
    user: User = Depends(require_auth),
    db: AsyncSession = Depends(get_db_session),
):
    doc = await _verify_document(document_id, user, db)
    rows = await db.execute(
        select(DocumentJob)
        .options(selectinload(DocumentJob.extraction_result))
        .where(DocumentJob.user_id == user.id)
        .where(DocumentJob.document_id == doc.id)
        .where(DocumentJob.job_type == BATCH_TEMPLATE_JOB_TYPE)
        .order_by(DocumentJob.created_at.desc())
        .limit(20)
    )
    return [_run_response(job) for job in rows.scalars()]


@router.post(
    "/collections/{collection_id}/question-template-runs",
    response_model=QuestionTemplateRunResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
async def run_collection_question_template(
    collection_id: uuid.UUID,
    body: RunQuestionTemplateRequest,
    user: User = Depends(require_auth),
    db: AsyncSession = Depends(get_db_session),
):
    _require_plan(user, {"pro"}, "pro")
    collection = await _verify_collection(collection_id, user, db, require_ready=True)
    template = await _get_owned_template(body.template_id, user, db)
    ordered_docs = sorted(collection.documents, key=lambda doc: doc.filename.lower())
    job = await _create_run(
        user=user,
        db=db,
        template=template,
        document_ids=[doc.id for doc in ordered_docs],
        collection_id=collection.id,
        locale=body.locale,
    )
    return _run_response(job)


@router.get("/collections/{collection_id}/question-template-runs", response_model=list[QuestionTemplateRunResponse])
async def list_collection_question_template_runs(
    collection_id: uuid.UUID,
    user: User = Depends(require_auth),
    db: AsyncSession = Depends(get_db_session),
):
    collection = await _verify_collection(collection_id, user, db)
    rows = await db.execute(
        select(DocumentJob)
        .options(selectinload(DocumentJob.extraction_result))
        .where(DocumentJob.user_id == user.id)
        .where(DocumentJob.collection_id == collection.id)
        .where(DocumentJob.job_type == BATCH_TEMPLATE_JOB_TYPE)
        .order_by(DocumentJob.created_at.desc())
        .limit(20)
    )
    return [_run_response(job) for job in rows.scalars()]


@router.get("/question-template-runs/{job_id}", response_model=QuestionTemplateRunResponse)
async def get_question_template_run(
    job_id: uuid.UUID,
    user: User = Depends(require_auth),
    db: AsyncSession = Depends(get_db_session),
):
    row = await db.execute(
        select(DocumentJob)
        .options(selectinload(DocumentJob.extraction_result))
        .where(DocumentJob.id == job_id)
        .where(DocumentJob.user_id == user.id)
        .where(DocumentJob.job_type == BATCH_TEMPLATE_JOB_TYPE)
    )
    job = row.scalar_one_or_none()
    if not job:
        raise HTTPException(
            status_code=404,
            detail={"error": "QUESTION_TEMPLATE_RUN_NOT_FOUND", "message": "Question template run not found"},
        )
    return _run_response(job)


@router.get("/question-template-runs/{job_id}/export")
async def export_question_template_run(
    job_id: uuid.UUID,
    format: Literal["md", "csv"] = Query("md"),
    user: User = Depends(require_auth),
    db: AsyncSession = Depends(get_db_session),
):
    row = await db.execute(
        select(DocumentJob)
        .options(selectinload(DocumentJob.extraction_result))
        .where(DocumentJob.id == job_id)
        .where(DocumentJob.user_id == user.id)
        .where(DocumentJob.job_type == BATCH_TEMPLATE_JOB_TYPE)
    )
    job = row.scalar_one_or_none()
    if not job or not job.extraction_result:
        raise HTTPException(
            status_code=404,
            detail={"error": "QUESTION_TEMPLATE_RUN_NOT_FOUND", "message": "Question template run not found"},
        )
    result = job.extraction_result
    stem = f"question-template-{str(job.id)[:8]}"
    if format == "csv":
        content = render_question_template_csv(result.structured_json or {})
        return StreamingResponse(
            iter([content.encode("utf-8-sig")]),
            media_type="text/csv; charset=utf-8",
            headers={"Content-Disposition": _content_disposition(f"{stem}.csv")},
        )
    return StreamingResponse(
        iter([(result.rendered_markdown or "").encode("utf-8")]),
        media_type="text/markdown; charset=utf-8",
        headers={"Content-Disposition": _content_disposition(f"{stem}.md")},
    )
