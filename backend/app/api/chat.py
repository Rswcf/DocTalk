from __future__ import annotations

import json
import uuid
from typing import AsyncGenerator, Optional

from fastapi import APIRouter, Depends, Request, status
from fastapi.responses import JSONResponse, StreamingResponse
from sqlalchemy import asc, desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.deps import get_current_user_optional, get_db_session
from app.core.rate_limit import demo_chat_limiter
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
DEMO_MAX_SESSIONS_PER_DOC = 50

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
    user: Optional[User] = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db_session),
):
    # Verify document access
    doc = await verify_document_access(document_id, user, db)
    if not doc:
        return JSONResponse(status_code=404, content={"detail": "Document not found"})

    # Limit anonymous users to a small number of sessions on demo documents
    if user is None and doc.demo_slug:
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
    return SessionResponse(
        session_id=sess.id,
        document_id=sess.document_id,
        title=sess.title,
        created_at=sess.created_at,
    )


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
            return JSONResponse(
                status_code=429,
                content={"detail": "Rate limit exceeded", "retry_after": 60},
                headers={"Retry-After": "60"},
            )

    # Enforce message limit for anonymous users on demo documents
    if user is None and session.document and session.document.demo_slug:
        msg_count = await db.execute(
            select(func.count(Message.id))
            .where(Message.session_id == session_id, Message.role == "user")
        )
        if msg_count.scalar() >= DEMO_MESSAGE_LIMIT:
            return JSONResponse(
                status_code=429,
                content={"detail": "Demo message limit reached", "limit": DEMO_MESSAGE_LIMIT},
            )

    # If authenticated, ensure sufficient credits before opening stream
    if user is not None:
        from app.services.credit_service import ensure_monthly_credits
        await ensure_monthly_credits(db, user)
        await db.commit()
        balance = await credit_service.get_user_credits(db, user.id)
        if balance < credit_service.MIN_CREDITS_FOR_CHAT:
            return JSONResponse(
                status_code=402,
                content={
                    "detail": "Insufficient credits",
                    "required": credit_service.MIN_CREDITS_FOR_CHAT,
                    "balance": balance,
                },
            )

    async def event_generator() -> AsyncGenerator[str, None]:
        async for ev in chat_service.chat_stream(
            session_id, body.message, db, model=body.model, user=user, locale=body.locale
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
