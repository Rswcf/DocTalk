from __future__ import annotations

import asyncio
import uuid
from typing import List

from qdrant_client.models import FieldCondition, Filter, MatchAny, MatchValue
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.tables import Chunk
from app.services.embedding_service import embedding_service

# Minimum text length for a chunk to be useful in retrieval.
# Shorter chunks are typically form fields, metadata footers, or page numbers
# that pollute search results for vague queries.
_MIN_CHUNK_TEXT_LEN = 200


class RetrievalService:
    """Vector search over chunks using Qdrant, returning DB-backed details."""

    async def search(self, query: str, document_id: uuid.UUID, top_k: int, db: AsyncSession):
        # 1) Embed query — run sync call off the event loop
        qvec = (await asyncio.to_thread(embedding_service.embed_texts, [query]))[0]

        # 2) Qdrant search — over-fetch to compensate for micro-chunk filtering
        client = embedding_service.get_qdrant_client()
        flt = Filter(must=[FieldCondition(key="document_id", match=MatchValue(value=str(document_id)))])
        fetch_limit = int(top_k or 5) * 3
        res = await asyncio.to_thread(
            client.query_points,
            collection_name=settings.QDRANT_COLLECTION,
            query=qvec,
            limit=fetch_limit,
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
            # Skip micro-chunks (form fields, metadata footers, page numbers)
            if len((ch.text or "").strip()) < _MIN_CHUNK_TEXT_LEN:
                continue
            results.append(
                {
                    "chunk_id": ch.id,
                    "text": ch.text,
                    "page": ch.page_start,
                    "page_end": ch.page_end,
                    "bboxes": ch.bboxes,
                    "score": scores.get(ch.id, 0.0),
                    "section_title": ch.section_title,
                }
            )

        return results[: int(top_k or 5)]

    async def search_multi(
        self, query: str, document_ids: List[uuid.UUID], top_k: int, db: AsyncSession
    ):
        """Search across multiple documents for cross-document Q&A."""
        if not document_ids:
            return []

        qvec = (await asyncio.to_thread(embedding_service.embed_texts, [query]))[0]

        client = embedding_service.get_qdrant_client()
        doc_id_strs = [str(did) for did in document_ids]
        flt = Filter(must=[FieldCondition(key="document_id", match=MatchAny(any=doc_id_strs))])
        fetch_limit = int(top_k or 8) * 3
        res = await asyncio.to_thread(
            client.query_points,
            collection_name=settings.QDRANT_COLLECTION,
            query=qvec,
            limit=fetch_limit,
            query_filter=flt,
        )

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
        chunks.sort(key=lambda c: scores.get(c.id, 0.0), reverse=True)

        results = []
        for ch in chunks:
            if len((ch.text or "").strip()) < _MIN_CHUNK_TEXT_LEN:
                continue
            results.append(
                {
                    "chunk_id": ch.id,
                    "document_id": ch.document_id,
                    "text": ch.text,
                    "page": ch.page_start,
                    "page_end": ch.page_end,
                    "bboxes": ch.bboxes,
                    "score": scores.get(ch.id, 0.0),
                    "section_title": ch.section_title,
                }
            )

        return results[: int(top_k or 8)]


# Singleton service
retrieval_service = RetrievalService()
