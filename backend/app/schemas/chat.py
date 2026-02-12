from __future__ import annotations

import uuid
from datetime import datetime
from typing import List, Literal, Optional

from pydantic import BaseModel


class ChatRequest(BaseModel):
    message: str
    mode: Optional[Literal["quick", "balanced", "thorough"]] = None
    locale: Optional[str] = None  # Frontend locale code (en/zh/es/fr/de)


class ChatMessageResponse(BaseModel):
    role: str
    content: str
    citations: Optional[List[dict]] = None
    created_at: datetime

    class Config:
        from_attributes = True


class SessionResponse(BaseModel):
    session_id: uuid.UUID
    document_id: uuid.UUID
    title: Optional[str] = None
    created_at: datetime


class SessionCreateResponse(SessionResponse):
    demo_messages_used: Optional[int] = None


class SessionMessagesResponse(BaseModel):
    messages: List[ChatMessageResponse]


class SessionListItem(BaseModel):
    session_id: uuid.UUID
    title: Optional[str] = None
    message_count: int
    created_at: datetime
    last_activity_at: datetime


class SessionListResponse(BaseModel):
    sessions: List[SessionListItem]
