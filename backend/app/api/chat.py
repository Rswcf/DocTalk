from __future__ import annotations

import json
import uuid
from datetime import datetime, timedelta, timezone
from typing import AsyncGenerator, Optional

from fastapi import APIRouter, Depends, Request, status
from fastapi.responses import JSONResponse, StreamingResponse
from sqlalchemy import asc, delete, desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.deps import get_current_user_optional, get_db_session
from app.core.rate_limit import demo_chat_limiter, demo_message_tracker
from app.core.security_log import log_security_event
from app.models.tables import ChatSession, Document, Message, User
from app.schemas.chat import (
    ChatMessageResponse,
    ChatRequest,
    SessionListItem,
    SessionListResponse,
    SessionMessagesResponse,
    SessionResponse,
)
from app.services import credit_service
from app.services.chat_service import chat_service

DEMO_MESSAGE_LIMIT = 5
DEMO_MAX_SESSIONS_PER_DOC = 500
DEMO_SESSION_TTL_HOURS = 24

chat_router = APIRouter(tags=["chat"])


async def verify_session_access(
    session_id: uuid.UUID,
    user: Optional[User],
    db: AsyncSession,
) -> Optional[ChatSession]:
    """Verify user has access to the session. Returns session if authorized, None otherwise."""
    result = await db.execute(
        select(ChatSession)
        .options(selectinload(ChatSession.document))
        .where(ChatSession.id == session_id)
    )
    session = result.scalar_one_or_none()
    if not session:
        return None

    # If document has an owner, verify the user matches
    if session.document and session.document.user_id:
        if not user or session.document.user_id != user.id:
            return None

    return session


async def verify_document_access(
    document_id: uuid.UUID,
    user: Optional[User],
    db: AsyncSession,
) -> Optional[Document]:
    """Verify user has access to the document. Returns document if authorized, None otherwise."""
    doc = await db.get(Document, document_id)
    if not doc:
        return None

    # If document has an owner, verify the user matches
    if doc.user_id:
        if not user or doc.user_id != user.id:
            return None

    return doc


@chat_router.post("/documents/{document_id}/sessions", status_code=status.HTTP_201_CREATED)
async def create_session(
    document_id: uuid.UUID,
    request: Request,
    user: Optional[User] = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db_session),
):
    # Verify document access
    doc = await verify_document_access(document_id, user, db)
    if not doc:
        return JSONResponse(status_code=404, content={"detail": "Document not found"})

    # Limit anonymous users on demo documents; garbage-collect stale sessions first
    if user is None and doc.demo_slug:
        # Clean up demo sessions older than TTL (cascade deletes messages)
        cutoff = datetime.now(timezone.utc) - timedelta(hours=DEMO_SESSION_TTL_HOURS)
        await db.execute(
            delete(ChatSession)
            .where(ChatSession.document_id == document_id)
            .where(ChatSession.created_at < cutoff)
        )

        session_count = await db.execute(
            select(func.count(ChatSession.id))
            .where(ChatSession.document_id == document_id)
        )
        if session_count.scalar() >= DEMO_MAX_SESSIONS_PER_DOC:
            return JSONResponse(
                status_code=429,
                content={"detail": "Demo session limit reached", "limit": DEMO_MAX_SESSIONS_PER_DOC},
            )

    sess = ChatSession(document_id=document_id)
    db.add(sess)
    await db.commit()
    await db.refresh(sess)

    response = SessionResponse(
        session_id=sess.id,
        document_id=sess.document_id,
        title=sess.title,
        created_at=sess.created_at,
    )

    # For anonymous demo sessions, include used message count so frontend
    # can display the correct remaining count across page refreshes and
    # across different demo documents (limit is global per IP).
    if user is None and doc.demo_slug:
        client_ip = request.client.host if request.client else "unknown"
        used = demo_message_tracker.get_count(client_ip)
        return JSONResponse(
            status_code=201,
            content={**response.model_dump(mode="json"), "demo_messages_used": used},
        )

    return response


@chat_router.get("/sessions/{session_id}/messages", response_model=SessionMessagesResponse)
async def get_session_messages(
    session_id: uuid.UUID,
    user: Optional[User] = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db_session),
):
    # Verify session access
    session = await verify_session_access(session_id, user, db)
    if not session:
        return JSONResponse(status_code=404, content={"detail": "Session not found"})

    rows = await db.execute(
        select(Message).where(Message.session_id == session_id).order_by(asc(Message.created_at))
    )
    items = []
    for m in rows.scalars():
        items.append(
            ChatMessageResponse(
                role=m.role,
                content=m.content,
                citations=m.citations,
                created_at=m.created_at,
            )
        )
    return SessionMessagesResponse(messages=items)


@chat_router.post("/sessions/{session_id}/chat")
async def chat_stream(
    session_id: uuid.UUID,
    body: ChatRequest,
    request: Request,
    user: Optional[User] = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db_session),
):
    # Verify session access
    session = await verify_session_access(session_id, user, db)
    if not session:
        return JSONResponse(status_code=404, content={"detail": "Session not found"})

    # Block chat if document is not fully processed
    if session.document and session.document.status != "ready":
        return JSONResponse(
            status_code=409,
            content={"detail": "Document is still being processed", "status": session.document.status},
        )

    # Rate limit anonymous users
    if user is None:
        client_ip = request.client.host if request.client else "unknown"
        if not demo_chat_limiter.is_allowed(client_ip):
            log_security_event("demo_rate_limit", ip=client_ip, session_id=session_id)
            return JSONResponse(
                status_code=429,
                content={"detail": "Rate limit exceeded", "retry_after": 60},
                headers={"Retry-After": "60"},
            )

    # Enforce message limit for anonymous users on demo documents
    # Uses in-memory IP tracker (global across ALL demo docs) to survive
    # session recreation (hard refresh) and document switching.
    if user is None and session.document and session.document.demo_slug:
        if demo_message_tracker.get_count(client_ip) >= DEMO_MESSAGE_LIMIT:
            log_security_event("demo_message_limit", ip=client_ip, document_id=session.document_id)
            return JSONResponse(
                status_code=429,
                content={"detail": "Demo message limit reached", "limit": DEMO_MESSAGE_LIMIT},
            )
        demo_message_tracker.increment(client_ip)

    # If authenticated, ensure sufficient credits before opening stream
    if user is not None:
        from app.services.credit_service import ensure_monthly_credits
        await ensure_monthly_credits(db, user)
        await db.commit()
        # Use mode-specific estimated cost for pre-check (actual pre-debit happens in chat_service)
        effective_mode = body.mode or "balanced"
        estimated_cost = credit_service.get_estimated_cost(effective_mode)
        balance = await credit_service.get_user_credits(db, user.id)
        if balance < estimated_cost:
            return JSONResponse(
                status_code=402,
                content={
                    "detail": "Insufficient credits",
                    "required": estimated_cost,
                    "balance": balance,
                },
            )

    async def event_generator() -> AsyncGenerator[str, None]:
        async for ev in chat_service.chat_stream(
            session_id, body.message, db, model=body.model, user=user, locale=body.locale, mode=body.mode
        ):
            # Format per SSE: event: <type>\ndata: {json}\n\n
            line = f"event: {ev['event']}\n"
            payload = json.dumps(ev.get("data", {}), ensure_ascii=False)
            data_line = f"data: {payload}\n\n"
            yield line + data_line

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )


@chat_router.get("/documents/{document_id}/sessions", response_model=SessionListResponse)
async def list_sessions(
    document_id: uuid.UUID,
    user: Optional[User] = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db_session),
):
    # Verify document access
    doc = await verify_document_access(document_id, user, db)
    if not doc:
        return JSONResponse(status_code=404, content={"detail": "Document not found"})

    # Anonymous users on demo documents must never see previous sessions
    # (sessions have no user_id — returning all would leak other users' conversations)
    if doc.demo_slug and user is None:
        return SessionListResponse(sessions=[])

    last_activity = func.coalesce(
        func.max(Message.created_at), ChatSession.created_at
    ).label("last_activity_at")

    stmt = (
        select(
            ChatSession.id,
            ChatSession.title,
            ChatSession.created_at,
            func.count(Message.id).label("message_count"),
            last_activity,
        )
        .outerjoin(Message, Message.session_id == ChatSession.id)
        .where(ChatSession.document_id == document_id)
        .group_by(ChatSession.id, ChatSession.title, ChatSession.created_at)
        .order_by(desc(last_activity))
        .limit(10)
    )
    result = await db.execute(stmt)
    rows = result.all()
    sessions = [
        SessionListItem(
            session_id=row.id,
            title=row.title,
            message_count=row.message_count,
            created_at=row.created_at,
            last_activity_at=row.last_activity_at,
        )
        for row in rows
    ]
    return SessionListResponse(sessions=sessions)


@chat_router.delete("/sessions/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_session(
    session_id: uuid.UUID,
    user: Optional[User] = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db_session),
):
    # Verify session access
    session = await verify_session_access(session_id, user, db)
    if not session:
        return JSONResponse(status_code=404, content={"detail": "Session not found"})

    await db.delete(session)
    await db.commit()
    return None  # 204
