"""Session export API — PDF, DOCX, Markdown."""
from __future__ import annotations

import logging
import re
from typing import Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.chat import verify_session_access
from app.core.deps import get_db_session, require_auth
from app.models.tables import Message, User
from app.services.export_service import (
    ExportError,
    render_docx,
    render_markdown,
    render_pdf,
)

logger = logging.getLogger(__name__)
router = APIRouter(tags=["export"])


def _sanitize_filename(name: str) -> str:
    return re.sub(r"[^\w\s\-.]", "", name)[:100] or "export"


@router.get("/api/sessions/{session_id}/export")
async def export_session(
    session_id: UUID,
    format: Literal["pdf", "docx", "md"] = Query("md"),
    user: User = Depends(require_auth),
    db: AsyncSession = Depends(get_db_session),
):
    # Verify session access
    session = await verify_session_access(session_id, user, db)
    if not session:
        raise HTTPException(404, "Session not found")

    # Plan gating for PDF/DOCX
    if format in ("pdf", "docx"):
        if user.plan not in ("plus", "pro"):
            raise HTTPException(403, "PDF/DOCX export requires Plus or Pro plan")

    # Load messages
    rows = await db.execute(
        select(Message)
        .where(Message.session_id == session_id)
        .order_by(Message.created_at)
    )
    messages = list(rows.scalars())

    title = session.title or "DocTalk Conversation"
    doc_name = "document"
    if session.document:
        doc_name = session.document.filename or doc_name

    safe_title = _sanitize_filename(title)

    try:
        if format == "md":
            content = render_markdown(title, doc_name, messages)
            return StreamingResponse(
                iter([content.encode("utf-8")]),
                media_type="text/markdown; charset=utf-8",
                headers={"Content-Disposition": f'attachment; filename="{safe_title}.md"'},
            )
        elif format == "docx":
            buf = render_docx(title, doc_name, messages)
            return StreamingResponse(
                buf,
                media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                headers={"Content-Disposition": f'attachment; filename="{safe_title}.docx"'},
            )
        elif format == "pdf":
            buf = render_pdf(title, doc_name, messages)
            return StreamingResponse(
                buf,
                media_type="application/pdf",
                headers={"Content-Disposition": f'attachment; filename="{safe_title}.pdf"'},
            )
    except ValueError as e:
        # Expected user-facing validation (e.g., message count limit, post-
        # sanitization any remaining invalid chars). Log without stack to
        # keep Railway log volume bounded.
        logger.info(
            "Export validation failed session=%s format=%s: %s",
            session_id, format, e,
        )
        raise HTTPException(400, str(e))
    except ExportError as e:
        # Unexpected renderer failure — keep stack for diagnosis.
        logger.error(
            "Export renderer failed session=%s format=%s: %s",
            session_id, format, e, exc_info=True,
        )
        raise HTTPException(500, str(e))
