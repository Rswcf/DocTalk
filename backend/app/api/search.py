from __future__ import annotations

import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user_optional, get_db_session
from app.models.tables import Document, User
from app.schemas.search import SearchRequest, SearchResponse, SearchResultItem
from app.services.retrieval_service import retrieval_service

search_router = APIRouter(prefix="/documents", tags=["search"])


@search_router.post("/{document_id}/search", response_model=SearchResponse)
async def search_document(
    document_id: uuid.UUID,
    body: SearchRequest,
    user: Optional[User] = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db_session),
):
    doc = await db.get(Document, document_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    if doc.user_id and (not user or doc.user_id != user.id):
        raise HTTPException(status_code=404, detail="Document not found")
    results = await retrieval_service.search(body.query, document_id, body.top_k, db)
    return SearchResponse(results=[SearchResultItem(**r) for r in results])
