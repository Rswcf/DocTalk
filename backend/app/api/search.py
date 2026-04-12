from __future__ import annotations

import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user_optional, get_db_session
from app.core.rate_limit import anon_read_limiter, get_client_ip
from app.models.tables import Document, User
from app.schemas.search import SearchRequest, SearchResponse, SearchResultItem
from app.services.doc_service import can_access_document
from app.services.retrieval_service import retrieval_service

search_router = APIRouter(prefix="/api/documents", tags=["search"])


@search_router.post("/{document_id}/search", response_model=SearchResponse)
async def search_document(
    document_id: uuid.UUID,
    body: SearchRequest,
    request: Request,
    user: Optional[User] = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db_session),
):
    # Anonymous traffic goes through the shared anon_read_limiter so demo
    # docs cannot be scraped by a single IP. Logged-in users bypass.
    if user is None:
        client_ip = get_client_ip(request)
        if not await anon_read_limiter.is_allowed(client_ip):
            raise HTTPException(
                status_code=429,
                detail={"message": "Too many requests", "retry_after": 60},
                headers={"Retry-After": "60"},
            )
    doc = await db.get(Document, document_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    if not can_access_document(doc, user):
        raise HTTPException(status_code=404, detail="Document not found")
    results = await retrieval_service.search(body.query, document_id, body.top_k, db)
    return SearchResponse(results=[SearchResultItem(**r) for r in results])
