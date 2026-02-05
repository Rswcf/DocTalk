from __future__ import annotations

import asyncio
import json
import uuid
from typing import AsyncGenerator, Dict

from fastapi import APIRouter, Depends, status
from fastapi.responses import JSONResponse, StreamingResponse
from sqlalchemy import asc, select, func, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db_session
from app.models.tables import ChatSession, Message
from app.schemas.chat import (
    ChatMessageResponse,
    ChatRequest,
    SessionMessagesResponse,
    SessionResponse,
    SessionListResponse,
    SessionListItem,
)
from app.services.chat_service import chat_service


chat_router = APIRouter(tags=["chat"])


@chat_router.post("/documents/{document_id}/sessions", status_code=status.HTTP_201_CREATED)
async def create_session(document_id: uuid.UUID, db: AsyncSession = Depends(get_db_session)):
    sess = ChatSession(document_id=document_id)
    db.add(sess)
    await db.commit()
    await db.refresh(sess)  # 获取 server_default 的 created_at
    return SessionResponse(
        session_id=sess.id,
        document_id=sess.document_id,
        title=sess.title,
        created_at=sess.created_at,
    )


@chat_router.get("/sessions/{session_id}/messages", response_model=SessionMessagesResponse)
async def get_session_messages(session_id: uuid.UUID, db: AsyncSession = Depends(get_db_session)):
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
async def chat_stream(session_id: uuid.UUID, body: ChatRequest, db: AsyncSession = Depends(get_db_session)):
    async def event_generator() -> AsyncGenerator[str, None]:
        async for ev in chat_service.chat_stream(session_id, body.message, db, model=body.model):
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
async def list_sessions(document_id: uuid.UUID, db: AsyncSession = Depends(get_db_session)):
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
async def delete_session(session_id: uuid.UUID, db: AsyncSession = Depends(get_db_session)):
    sess = await db.get(ChatSession, session_id)
    if not sess:
        return JSONResponse(status_code=404, content={"detail": "Session not found"})
    await db.delete(sess)
    await db.commit()
    return None  # 204
