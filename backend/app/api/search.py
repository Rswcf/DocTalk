from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db_session
from app.schemas.search import SearchRequest, SearchResponse, SearchResultItem
from app.services.retrieval_service import retrieval_service


search_router = APIRouter(prefix="/documents", tags=["search"])


@search_router.post("/{document_id}/search", response_model=SearchResponse)
async def search_document(document_id: uuid.UUID, body: SearchRequest, db: AsyncSession = Depends(get_db_session)):
    results = await retrieval_service.search(body.query, document_id, body.top_k, db)
    return SearchResponse(results=[SearchResultItem(**r) for r in results])

