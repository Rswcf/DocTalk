from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


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
    summary: Optional[str] = None
    suggested_questions: Optional[list[str]] = None
    custom_instructions: Optional[str] = None
    file_type: Optional[str] = "pdf"
    source_url: Optional[str] = None
    has_converted_pdf: bool = False

    class Config:
        from_attributes = True


class DocumentFileUrlResponse(BaseModel):
    url: str
    expires_in: int


class DocumentBriefSourceRef(BaseModel):
    chunk_id: str
    chunk_index: int
    page: int
    page_end: Optional[int] = None
    bboxes: list[dict] = Field(default_factory=list)
    text_snippet: str = ""


class DocumentBriefOutlineItem(BaseModel):
    title: str
    level: int = 1
    summary: str = ""
    source_refs: list[DocumentBriefSourceRef] = Field(default_factory=list)


class DocumentBriefKeyPoint(BaseModel):
    text: str
    source_refs: list[DocumentBriefSourceRef] = Field(default_factory=list)


class DocumentBriefFact(BaseModel):
    label: str
    value: str
    context: str = ""
    source_refs: list[DocumentBriefSourceRef] = Field(default_factory=list)


class DocumentHierarchicalBriefResponse(BaseModel):
    status: str
    updated_at: Optional[datetime] = None
    generated_at: Optional[datetime] = None
    summary: Optional[str] = None
    outline: list[DocumentBriefOutlineItem] = Field(default_factory=list)
    key_points: list[DocumentBriefKeyPoint] = Field(default_factory=list)
    facts: list[DocumentBriefFact] = Field(default_factory=list)
    questions: list[str] = Field(default_factory=list)
    coverage: dict = Field(default_factory=dict)
    error_code: Optional[str] = None
    error_message: Optional[str] = None


class DocumentBrief(BaseModel):
    id: str
    filename: str
    status: str
    created_at: Optional[str] = None


class DemoDocumentResponse(BaseModel):
    slug: Optional[str] = None
    document_id: str
    filename: str
    status: str


class DocumentIngestResponse(BaseModel):
    document_id: str
    status: str
    filename: str


class DocumentTextPage(BaseModel):
    page_number: int
    text: str
    section_title: Optional[str] = None


class DocumentTextContentResponse(BaseModel):
    file_type: str
    pages: list[DocumentTextPage]
    title: Optional[str] = None
    source_url: Optional[str] = None
    domain: Optional[str] = None
