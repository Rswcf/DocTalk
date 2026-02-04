from __future__ import annotations

import uuid
from typing import List, Optional

from qdrant_client.models import Filter, FieldCondition, MatchValue
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.tables import Chunk
from app.services.embedding_service import embedding_service


class RetrievalService:
    """Vector search over chunks using Qdrant, returning DB-backed details."""

    async def search(self, query: str, document_id: uuid.UUID, top_k: int, db: AsyncSession):
        # 1) Embed query
        qvec = embedding_service.embed_texts([query])[0]

        # 2) Qdrant search with document_id filter
        client = embedding_service.get_qdrant_client()
        flt = Filter(must=[FieldCondition(key="document_id", match=MatchValue(value=str(document_id)))])
        res = client.query_points(
            collection_name=settings.QDRANT_COLLECTION,
            query=qvec,
            limit=int(top_k or 5),
            query_filter=flt,
        )

        # 3) Load chunk details by returned ids
        ids: List[uuid.UUID] = []
        scores: dict[uuid.UUID, float] = {}
        for p in res.points:
            try:
                cid = uuid.UUID(str(p.id))
            except Exception:
                continue
            ids.append(cid)
            scores[cid] = float(p.score or 0.0)

        if not ids:
            return []

        rows = await db.execute(select(Chunk).where(Chunk.id.in_(ids)))
        chunks: List[Chunk] = list(rows.scalars())

        # Preserve search order based on scores
        chunks.sort(key=lambda c: scores.get(c.id, 0.0), reverse=True)

        results = []
        for ch in chunks:
            results.append(
                {
                    "chunk_id": ch.id,
                    "text": ch.text,
                    "page": ch.page_start,
                    "bboxes": ch.bboxes,
                    "score": scores.get(ch.id, 0.0),
                    "section_title": ch.section_title,
                }
            )

        return results


# Singleton service
retrieval_service = RetrievalService()

