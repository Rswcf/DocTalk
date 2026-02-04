from __future__ import annotations

import uuid
from typing import List, Optional

from pydantic import BaseModel, Field


class SearchRequest(BaseModel):
    query: str
    top_k: int = Field(default=5, ge=1, le=50)


class SearchResultItem(BaseModel):
    chunk_id: uuid.UUID
    text: str
    page: int
    bboxes: list
    score: float
    section_title: Optional[str] = None


class SearchResponse(BaseModel):
    results: List[SearchResultItem]

