from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class DocumentCreate(BaseModel):
    id: uuid.UUID
    filename: str
    file_size: int
    storage_key: str
    status: str = "parsing"


class DocumentResponse(BaseModel):
    id: uuid.UUID
    filename: str
    status: str
    page_count: Optional[int] = None
    pages_parsed: int
    chunks_total: int
    chunks_indexed: int
    created_at: datetime
    is_demo: bool = False
    error_msg: Optional[str] = None

    class Config:
        from_attributes = True


class DocumentFileUrlResponse(BaseModel):
    url: str
    expires_in: int


class DocumentBrief(BaseModel):
    id: str
    filename: str
    status: str
    created_at: Optional[str] = None
