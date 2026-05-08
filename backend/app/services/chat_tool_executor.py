from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Any

import sqlalchemy as sa
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.tables import (
    CreditLedger,
    Document,
    DocumentJob,
    DocumentTable,
    ProductEvent,
    User,
)
from app.services import credit_service
from app.services.action_planner import ActionPlan, ChatAction
from app.services.doc_service import can_access_document
from app.services.extraction_service import (
    EXTRACTION_JOB_TYPE,
    EXTRACTION_PREDEBIT_CREDITS,
    FREE_MONTHLY_EXTRACTION_LIMIT,
    get_template,
)
from app.services.table_service import TABLE_SCAN_JOB_TYPE


@dataclass
class ChatArtifact:
    artifact_type: str
    status: str
    title: str
    summary: str
    job_id: str | None = None
    preview: Any | None = None
    download_urls: list[dict[str, str]] = field(default_factory=list)
    citations: list[dict[str, Any]] = field(default_factory=list)
    warning: str | None = None
    required_plan: str | None = None

    def to_payload(self) -> dict[str, Any]:
        payload = {
            "artifact_type": self.artifact_type,
            "status": self.status,
            "job_id": self.job_id,
            "title": self.title,
            "summary": self.summary,
            "preview": self.preview,
            "download_urls": self.download_urls,
            "citations": self.citations,
        }
        if self.warning:
            payload["warning"] = self.warning
        if self.required_plan:
            payload["required_plan"] = self.required_plan
        return payload


@dataclass
class ToolExecution:
    message: str
    artifact: ChatArtifact | None = None
    done_event_extra: dict[str, Any] = field(default_factory=dict)


def _as_utc(dt):
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def _is_zh(text: str) -> bool:
    return any("\u3400" <= ch <= "\u9fff" for ch in text or "")


def _copy(plan: ActionPlan, *, en: str, zh: str) -> str:
    status = plan.user_visible_status or ""
    return zh if _is_zh(status) else en


async def _verify_document(document_id: uuid.UUID, user: User, db: AsyncSession) -> Document | None:
    doc = await db.get(Document, document_id)
    if not doc or not can_access_document(doc, user):
        return None
    return doc


async def _enforce_free_extraction_limit(user: User, db: AsyncSession) -> bool:
    if (user.plan or "free").lower() != "free":
        return True
    window_start = _as_utc(user.monthly_credits_granted_at)
    if window_start is None:
        window_start = datetime.now(timezone.utc) - timedelta(days=30)
    used = await db.scalar(
        select(func.count())
        .select_from(DocumentJob)
        .where(DocumentJob.user_id == user.id)
        .where(DocumentJob.job_type == EXTRACTION_JOB_TYPE)
        .where(DocumentJob.status.in_(["queued", "running", "succeeded"]))
        .where(DocumentJob.created_at >= window_start)
    )
    return int(used or 0) < FREE_MONTHLY_EXTRACTION_LIMIT


async def _queue_extraction(
    *,
    user: User,
    db: AsyncSession,
    doc: Document,
    plan: ActionPlan,
    locale: str | None,
    domain_mode: str | None,
) -> ToolExecution:
    template_key = plan.template_key or "executive_summary"
    try:
        template = get_template(template_key)
    except ValueError:
        template = get_template("executive_summary")

    if not await _enforce_free_extraction_limit(user, db):
        return ToolExecution(
            message=_copy(
                plan,
                en="You have used the free structured extraction allowance. Upgrade to continue creating cited deliverables.",
                zh="你已经用完免费结构化提取额度。升级后可以继续生成带引用的交付物。",
            ),
            artifact=ChatArtifact(
                artifact_type="extraction",
                status="failed",
                title=template.title,
                summary="Structured extraction limit reached.",
                required_plan="plus",
            ),
        )

    job = DocumentJob(
        user_id=user.id,
        document_id=doc.id,
        job_type=EXTRACTION_JOB_TYPE,
        status="queued",
        input_scope={
            "template_key": template.key,
            "locale": locale,
            "domain_mode": domain_mode,
            "source": "chat",
        },
    )
    db.add(job)
    await db.flush()
    ledger_id = await credit_service.debit_credits(
        db,
        user_id=user.id,
        cost=EXTRACTION_PREDEBIT_CREDITS,
        reason="extraction",
        ref_type="document_job",
        ref_id=str(job.id),
    )
    if ledger_id is None:
        await db.rollback()
        balance = await credit_service.get_user_credits(db, user.id)
        return ToolExecution(
            message=_copy(
                plan,
                en=f"This extraction needs {EXTRACTION_PREDEBIT_CREDITS} credits, but your balance is {balance}.",
                zh=f"这次提取需要 {EXTRACTION_PREDEBIT_CREDITS} 额度，但你当前余额是 {balance}。",
            ),
            artifact=ChatArtifact(
                artifact_type="extraction",
                status="failed",
                title=template.title,
                summary="Insufficient credits.",
            ),
        )

    job.metadata_json = {
        "predebit_ledger_id": str(ledger_id),
        "pre_debited": EXTRACTION_PREDEBIT_CREDITS,
        "source": "chat_tool",
    }
    db.add(
        ProductEvent(
            user_id=user.id,
            event_name="extraction_created",
            source="chat",
            reason=template.key,
            plan=(user.plan or "free").lower(),
            metadata_json={"document_id": str(doc.id), "job_id": str(job.id), "template_key": template.key},
        )
    )
    await db.commit()
    await db.refresh(job)

    try:
        from app.workers.extraction_worker import run_extraction_job

        run_extraction_job.delay(str(job.id))
    except Exception as exc:
        job.status = "failed"
        job.error_code = "EXTRACTION_QUEUE_FAILED"
        job.error_message = "Failed to queue extraction"
        result = await db.execute(sa.delete(CreditLedger).where(CreditLedger.id == ledger_id))
        if result.rowcount and result.rowcount > 0:
            await db.execute(
                sa.update(User)
                .where(User.id == user.id)
                .values(credits_balance=User.credits_balance + EXTRACTION_PREDEBIT_CREDITS)
            )
        await db.commit()
        return ToolExecution(
            message=_copy(
                plan,
                en="I could not queue that extraction. Please try again.",
                zh="我暂时无法启动这次提取，请稍后再试。",
            ),
            artifact=ChatArtifact(
                artifact_type="extraction",
                status="failed",
                job_id=str(job.id),
                title=template.title,
                summary="Failed to queue extraction.",
                warning=str(exc),
            ),
        )

    artifact = ChatArtifact(
        artifact_type="extraction",
        status="queued",
        job_id=str(job.id),
        title=template.title,
        summary=plan.user_visible_status or template.description,
        download_urls=[
            {"label": "Markdown", "format": "md", "url": f"/api/extractions/{job.id}/export?format=md"},
            {"label": "CSV", "format": "csv", "url": f"/api/extractions/{job.id}/export?format=csv"},
        ],
    )
    return ToolExecution(
        message=_copy(
            plan,
            en=f"I started {template.title}. I will keep the result here with citations when it is ready.",
            zh=f"我已开始生成 {template.title}。完成后结果会在这里显示，并保留引用。",
        ),
        artifact=artifact,
    )


def _table_preview(tables: list[DocumentTable], *, max_tables: int = 3) -> list[dict[str, Any]]:
    preview: list[dict[str, Any]] = []
    for table in tables[:max_tables]:
        rows = (table.cells or {}).get("rows")
        preview.append(
            {
                "table_id": str(table.id),
                "page": int(table.page or 1),
                "table_index": int(table.table_index or 0),
                "rows": rows[:4] if isinstance(rows, list) else [],
                "confidence": float(table.confidence or 0),
                "method": table.method,
            }
        )
    return preview


async def _existing_tables(db: AsyncSession, document_id: uuid.UUID) -> list[DocumentTable]:
    rows = await db.execute(
        select(DocumentTable)
        .where(DocumentTable.document_id == document_id)
        .order_by(DocumentTable.page, DocumentTable.table_index)
    )
    return list(rows.scalars())


async def _queue_table_scan(
    *,
    user: User,
    db: AsyncSession,
    doc: Document,
    export_requested: bool,
    plan: ActionPlan,
) -> ToolExecution:
    tables = await _existing_tables(db, doc.id)
    if tables:
        artifact_type = "table_export" if export_requested else "table_scan"
        plan_name = (user.plan or "free").lower()
        download_urls = []
        required_plan = None
        warning = None
        if export_requested:
            if plan_name in {"plus", "pro"}:
                download_urls.append(
                    {"label": "Download CSV", "format": "csv", "url": f"/api/documents/{doc.id}/tables/export"}
                )
            else:
                required_plan = "plus"
                warning = "CSV export requires Plus."
        return ToolExecution(
            message=_copy(
                plan,
                en=f"I found {len(tables)} existing table extraction result(s) for this document.",
                zh=f"我找到了这份文档已有的 {len(tables)} 个表格提取结果。",
            ),
            artifact=ChatArtifact(
                artifact_type=artifact_type,
                status="succeeded",
                title="Tables",
                summary=f"{len(tables)} table(s) detected.",
                preview=_table_preview(tables),
                download_urls=download_urls,
                warning=warning,
                required_plan=required_plan,
            ),
        )

    existing = await db.scalar(
        select(DocumentJob)
        .where(DocumentJob.user_id == user.id)
        .where(DocumentJob.document_id == doc.id)
        .where(DocumentJob.job_type == TABLE_SCAN_JOB_TYPE)
        .where(DocumentJob.status.in_(["queued", "running"]))
        .order_by(DocumentJob.created_at.desc())
    )
    if existing:
        job = existing
    else:
        job = DocumentJob(
            user_id=user.id,
            document_id=doc.id,
            job_type=TABLE_SCAN_JOB_TYPE,
            status="queued",
            input_scope={"document_id": str(doc.id), "source": "chat", "export_requested": export_requested},
            cost_credits=0,
        )
        db.add(job)
        await db.flush()
        db.add(
            ProductEvent(
                user_id=user.id,
                event_name="table_scan_created",
                source="chat",
                reason="table_export" if export_requested else "tables",
                plan=(user.plan or "free").lower(),
                metadata_json={"document_id": str(doc.id), "job_id": str(job.id)},
            )
        )
        await db.commit()
        await db.refresh(job)
        try:
            from app.workers.table_worker import run_table_scan_job

            run_table_scan_job.delay(str(job.id))
        except Exception as exc:
            job.status = "failed"
            job.error_code = "TABLE_SCAN_QUEUE_FAILED"
            job.error_message = "Failed to queue table scan"
            await db.commit()
            return ToolExecution(
                message=_copy(
                    plan,
                    en="I could not start the table scan. Please try again.",
                    zh="我暂时无法启动表格扫描，请稍后再试。",
                ),
                artifact=ChatArtifact(
                    artifact_type="table_export" if export_requested else "table_scan",
                    status="failed",
                    job_id=str(job.id),
                    title="Tables",
                    summary="Failed to queue table scan.",
                    warning=str(exc),
                ),
            )

    plan_name = (user.plan or "free").lower()
    export_urls = []
    required_plan = None
    if export_requested:
        if plan_name in {"plus", "pro"}:
            export_urls.append({"label": "Download CSV", "format": "csv", "url": f"/api/documents/{doc.id}/tables/export"})
        else:
            required_plan = "plus"

    artifact = ChatArtifact(
        artifact_type="table_export" if export_requested else "table_scan",
        status=job.status,
        job_id=str(job.id),
        title="Tables",
        summary=plan.user_visible_status or "Scanning document tables.",
        download_urls=export_urls,
        required_plan=required_plan,
        warning="CSV export requires Plus." if required_plan else None,
    )
    return ToolExecution(
        message=_copy(
            plan,
            en="I started scanning the document tables. The result will update here when the scan finishes.",
            zh="我已开始扫描文档表格。完成后结果会在这里更新。",
        ),
        artifact=artifact,
    )


class ChatToolExecutor:
    async def execute(
        self,
        plan: ActionPlan,
        *,
        user: User | None,
        db: AsyncSession,
        document_id: uuid.UUID | None,
        collection_doc_ids: list[uuid.UUID],
        locale: str | None,
        domain_mode: str | None,
    ) -> ToolExecution:
        if user is None:
            return ToolExecution(
                message="Please sign in to create exports, structured extractions, templates, or document comparisons.",
                artifact=None,
            )

        if plan.action in {ChatAction.CREATE_QUESTION_TEMPLATE, ChatAction.RUN_QUESTION_TEMPLATE}:
            return ToolExecution(
                message=plan.user_visible_status
                or "Send the checklist questions in chat, one per line, and I can turn them into a reusable template.",
                artifact=None,
            )

        if plan.action == ChatAction.COMPARE_DOCUMENTS:
            if len(plan.document_ids) >= 2:
                return ToolExecution(
                    message="Document comparison from chat is ready to route, but I need the selected old/new document ids confirmed before spending Pro credits.",
                    artifact=None,
                )
            if collection_doc_ids:
                count = len(collection_doc_ids)
                return ToolExecution(
                    message=f"I found {count} document(s) in this collection. Tell me which two versions to compare, for example: compare A.pdf with B.pdf.",
                    artifact=None,
                )
            return ToolExecution(
                message=plan.user_visible_status
                or "Please upload or choose the old version and the new version before I run a cited comparison.",
                artifact=None,
            )

        if document_id is None:
            return ToolExecution(
                message="This action needs a single active document. Open a document and ask again.",
                artifact=None,
            )
        doc = await _verify_document(document_id, user, db)
        if not doc:
            return ToolExecution(
                message="I could not access that document.",
                artifact=None,
            )
        if doc.status != "ready":
            return ToolExecution(
                message="The document is still processing. Try again when it is ready.",
                artifact=None,
            )

        if plan.action == ChatAction.EXTRACT_DELIVERABLE:
            return await _queue_extraction(
                user=user,
                db=db,
                doc=doc,
                plan=plan,
                locale=locale,
                domain_mode=domain_mode,
            )
        if plan.action in {ChatAction.SCAN_TABLES, ChatAction.EXPORT_TABLES}:
            return await _queue_table_scan(
                user=user,
                db=db,
                doc=doc,
                export_requested=plan.action == ChatAction.EXPORT_TABLES,
                plan=plan,
            )

        return ToolExecution(
            message="I can answer that directly in chat.",
            artifact=None,
        )


chat_tool_executor = ChatToolExecutor()
