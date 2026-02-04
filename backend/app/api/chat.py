from __future__ import annotations

import asyncio
import json
import uuid
from typing import AsyncGenerator, Dict

from fastapi import APIRouter, Depends, status
from fastapi.responses import JSONResponse, StreamingResponse
from sqlalchemy import asc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db_session
from app.models.tables import ChatSession, Message
from app.schemas.chat import ChatMessageResponse, ChatRequest, SessionMessagesResponse, SessionResponse
from app.services.chat_service import chat_service


chat_router = APIRouter(tags=["chat"])


@chat_router.post("/documents/{document_id}/sessions", status_code=status.HTTP_201_CREATED)
async def create_session(document_id: uuid.UUID, db: AsyncSession = Depends(get_db_session)):
    sess = ChatSession(document_id=document_id)
    db.add(sess)
    await db.commit()
    return SessionResponse(session_id=sess.id, document_id=sess.document_id)


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
        async for ev in chat_service.chat_stream(session_id, body.message, db):
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

