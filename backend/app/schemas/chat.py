from __future__ import annotations

import uuid
from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel


class ChatRequest(BaseModel):
    message: str
    mode: Optional[str] = None  # Performance mode: "quick"/"balanced"/"thorough"
    model: Optional[str] = None  # OpenRouter model ID override (deprecated, use mode)
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
