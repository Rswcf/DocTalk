"""Session sharing API — create, view, revoke shareable links."""
from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.chat import verify_session_access
from app.core.config import settings
from app.core.deps import get_db_session, require_auth
from app.core.rate_limit import get_client_ip, shared_view_limiter
from app.core.security_log import log_security_event
from app.models.tables import ChatSession, Document, Message, SharedSession, User

router = APIRouter(tags=["sharing"])


class ShareResponse(BaseModel):
    share_token: str
    url: str
    expires_at: str | None = None


class SharedSessionView(BaseModel):
    session_title: str
    document_name: str
    created_at: str
    messages: list[dict]


@router.post("/api/sessions/{session_id}/share", response_model=ShareResponse)
async def create_share(
    session_id: UUID,
    user: User = Depends(require_auth),
    db: AsyncSession = Depends(get_db_session),
):
    # Verify session access
    session = await verify_session_access(session_id, user, db)
    if not session:
        raise HTTPException(404, "Session not found")

    # Check existing share
    existing = await db.execute(
        select(SharedSession).where(
            SharedSession.session_id == session_id,
            SharedSession.user_id == user.id,
        )
    )
    share = existing.scalar_one_or_none()
    if share:
        return ShareResponse(
            share_token=str(share.share_token),
            url=f"{settings.FRONTEND_URL}/shared/{share.share_token}",
            expires_at=share.expires_at.isoformat() if share.expires_at else None,
        )

    # Free plan limit: 3 active shares
    if user.plan not in ("plus", "pro"):
        count_result = await db.execute(
            select(func.count())
            .select_from(SharedSession)
            .where(
                SharedSession.user_id == user.id,
                (SharedSession.expires_at.is_(None))
                | (SharedSession.expires_at > datetime.now(timezone.utc)),
            )
        )
        active_count = count_result.scalar() or 0
        if active_count >= 3:
            raise HTTPException(
                403,
                "Free plan limited to 3 active share links. Upgrade to Plus for unlimited.",
            )

    # Create share
    share = SharedSession(session_id=session_id, user_id=user.id)
    db.add(share)
    await db.commit()
    await db.refresh(share)

    return ShareResponse(
        share_token=str(share.share_token),
        url=f"{settings.FRONTEND_URL}/shared/{share.share_token}",
    )


@router.delete("/api/sessions/{session_id}/share", status_code=204)
async def revoke_share(
    session_id: UUID,
    user: User = Depends(require_auth),
    db: AsyncSession = Depends(get_db_session),
):
    result = await db.execute(
        select(SharedSession).where(
            SharedSession.session_id == session_id,
            SharedSession.user_id == user.id,
        )
    )
    share = result.scalar_one_or_none()
    if not share:
        raise HTTPException(404, "Share not found")

    await db.delete(share)
    await db.commit()


@router.get("/api/shared/{share_token}", response_model=SharedSessionView)
async def view_shared(
    share_token: UUID,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
):
    # Rate limit anonymous public endpoint: 60 req/min per IP. Prevents
    # share-token enumeration and traffic amplification on public URLs.
    client_ip = get_client_ip(request)
    if not await shared_view_limiter.is_allowed(client_ip):
        log_security_event("shared_view_rate_limit", ip=client_ip)
        raise HTTPException(
            status_code=429,
            detail={"message": "Too many requests", "retry_after": 60},
            headers={"Retry-After": "60"},
        )

    result = await db.execute(
        select(SharedSession).where(SharedSession.share_token == share_token)
    )
    share = result.scalar_one_or_none()
    if not share:
        raise HTTPException(404, "Shared session not found")

    # Check expiry
    if share.expires_at and share.expires_at < datetime.now(timezone.utc):
        raise HTTPException(410, "Share link has expired")

    # Load session
    session_result = await db.execute(
        select(ChatSession).where(ChatSession.id == share.session_id)
    )
    session = session_result.scalar_one_or_none()
    if not session:
        raise HTTPException(404, "Session no longer exists")

    # Load messages
    rows = await db.execute(
        select(Message)
        .where(Message.session_id == share.session_id)
        .order_by(Message.created_at)
    )
    messages = list(rows.scalars())

    # Build safe response — exclude bboxes, documentId, chunkId, confidence
    safe_messages = []
    for msg in messages:
        safe_msg: dict = {"role": msg.role, "content": msg.content}
        if msg.citations:
            safe_citations = []
            for c in msg.citations:
                if not isinstance(c, dict):
                    continue
                safe_citations.append(
                    {
                        "text_snippet": c.get("text_snippet", ""),
                        "page": c.get("page"),
                        "document_filename": c.get("document_filename", ""),
                    }
                )
            safe_msg["citations"] = safe_citations
        safe_messages.append(safe_msg)

    doc_name = "document"
    if session.document_id:
        doc_result = await db.execute(
            select(Document.filename).where(Document.id == session.document_id)
        )
        row = doc_result.first()
        if row:
            doc_name = row[0] or doc_name

    return SharedSessionView(
        session_title=session.title or "Untitled Conversation",
        document_name=doc_name,
        created_at=session.created_at.isoformat(),
        messages=safe_messages,
    )
