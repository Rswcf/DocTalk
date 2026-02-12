from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db_session
from app.models.tables import Chunk

chunks_router = APIRouter(prefix="/api", tags=["chunks"])


@chunks_router.get("/chunks/{chunk_id}")
async def get_chunk_detail(chunk_id: uuid.UUID, db: AsyncSession = Depends(get_db_session)):
    row = await db.execute(select(Chunk).where(Chunk.id == chunk_id))
    ch: Chunk | None = row.scalar_one_or_none()
    if not ch:
        raise HTTPException(status_code=404, detail="Chunk not found")
    return {
        "chunk_id": str(ch.id),
        "page_start": ch.page_start,
        "bboxes": ch.bboxes,
        "text": ch.text,
        "section_title": ch.section_title,
    }
