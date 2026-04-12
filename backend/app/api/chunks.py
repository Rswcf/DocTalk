from __future__ import annotations

import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user_optional, get_db_session
from app.core.rate_limit import anon_read_limiter, get_client_ip
from app.models.tables import Chunk, Document, User
from app.services.doc_service import can_access_document

chunks_router = APIRouter(prefix="/api", tags=["chunks"])


@chunks_router.get("/chunks/{chunk_id}")
async def get_chunk_detail(
    chunk_id: uuid.UUID,
    request: Request,
    user: Optional[User] = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db_session),
):
    if user is None:
        client_ip = get_client_ip(request)
        if not await anon_read_limiter.is_allowed(client_ip):
            raise HTTPException(
                status_code=429,
                detail={"message": "Too many requests", "retry_after": 60},
                headers={"Retry-After": "60"},
            )
    row = await db.execute(select(Chunk).where(Chunk.id == chunk_id))
    ch: Chunk | None = row.scalar_one_or_none()
    if not ch:
        raise HTTPException(status_code=404, detail="Chunk not found")

    doc_row = await db.execute(select(Document).where(Document.id == ch.document_id))
    doc: Document | None = doc_row.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Chunk not found")

    if not can_access_document(doc, user):
        raise HTTPException(status_code=404, detail="Chunk not found")

    return {
        "chunk_id": str(ch.id),
        "page_start": ch.page_start,
        "bboxes": ch.bboxes,
        "text": ch.text,
        "section_title": ch.section_title,
    }
