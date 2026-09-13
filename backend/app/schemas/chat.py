from __future__ import annotations

import uuid
from datetime import datetime
from typing import List, Literal, Optional

from pydantic import BaseModel, Field


class ChatRequest(BaseModel):
    message: str
    regenerate_of: Optional[uuid.UUID] = None
    expected_response_version: Optional[uuid.UUID] = None
    retry_latest_question: bool = False
    retry_after: Optional[uuid.UUID] = None
    mode: Optional[Literal["quick", "balanced", "thorough"]] = None
    domain_mode: Optional[Literal["legal", "academic"]] = None
    locale: Optional[str] = None  # Frontend locale code (en/zh/es/fr/de)


class ContinueRequest(BaseModel):
    message_id: Optional[uuid.UUID] = None  # If absent, use most recent assistant message
    expected_response_version: Optional[uuid.UUID] = None
    mode: Optional[Literal["quick", "balanced", "thorough"]] = None
    locale: Optional[str] = None


class ChatMessageResponse(BaseModel):
    id: uuid.UUID
    share_anchor: str
    role: str
    content: str
    citations: Optional[List[dict]] = None
    metadata_json: dict = Field(default_factory=dict)
    created_at: datetime
    response_version: Optional[uuid.UUID] = None

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
    demo_messages_used: Optional[int] = None


class SessionListItem(BaseModel):
    session_id: uuid.UUID
    title: Optional[str] = None
    message_count: int
    domain_mode: Optional[str] = None
    created_at: datetime
    last_activity_at: datetime


class SessionListResponse(BaseModel):
    sessions: List[SessionListItem]
