from __future__ import annotations

import asyncio
import re
import uuid
from typing import Iterable, List

import sqlalchemy as sa
from qdrant_client.models import FieldCondition, Filter, MatchAny, MatchValue
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.tables import Chunk, DocumentTable
from app.services.embedding_service import embedding_service
from app.services.rag_evaluator_service import extract_query_terms

# Minimum text length for a chunk to be useful in retrieval.
# Shorter chunks are typically form fields, metadata footers, or page numbers
# that pollute search results for vague queries.
_MIN_CHUNK_TEXT_LEN = 200
_MIN_TABLE_CHUNK_TEXT_LEN = 20
_TABLE_ROW_LIMIT = 12
_GENERIC_TABLE_QUERY_RE = re.compile(
    r"\b(table|tables|spreadsheet|csv|excel|row|rows|column|columns|cell|cells)\b"
    r"|(表格|数据表|电子表格|行|列|单元格)",
    flags=re.IGNORECASE,
)
_GENERIC_TABLE_TERMS = {
    "table",
    "tables",
    "spreadsheet",
    "csv",
    "excel",
    "row",
    "rows",
    "column",
    "columns",
    "cell",
    "cells",
}


def _escape_like(term: str) -> str:
    return (
        term.replace("\\", "\\\\")
        .replace("%", "\\%")
        .replace("_", "\\_")
    )


def _lexical_score(text: str, terms: tuple[str, ...]) -> float:
    if not terms:
        return 0.0
    lowered = text.lower()
    matches = sum(1 for term in terms if term.lower() in lowered)
    return min(0.99, 0.48 + (matches / max(len(terms), 1)) * 0.45)


def _chunk_payload(ch: Chunk, *, score: float, include_document_id: bool = False) -> dict:
    payload = {
        "chunk_id": ch.id,
        "text": ch.text,
        "page": ch.page_start,
        "page_end": ch.page_end,
        "bboxes": ch.bboxes,
        "score": score,
        "section_title": ch.section_title,
    }
    if include_document_id:
        payload["document_id"] = ch.document_id
    return payload


def _coerce_table_rows(table: DocumentTable) -> list[list[str]]:
    rows = (table.cells or {}).get("rows")
    if not isinstance(rows, list):
        return []
    normalized: list[list[str]] = []
    for row in rows:
        if not isinstance(row, list):
            continue
        cells = [str(cell or "").strip() for cell in row]
        if any(cells):
            normalized.append(cells)
    return normalized


def _format_table_rows(rows: list[list[str]]) -> str:
    if not rows:
        return ""
    width = max(len(row) for row in rows)
    padded = [row + [""] * (width - len(row)) for row in rows]
    lines = ["| " + " | ".join(_sanitize_table_cell(cell) for cell in row) + " |" for row in padded]
    if len(lines) >= 2:
        lines.insert(1, "| " + " | ".join(["---"] * width) + " |")
    return "\n".join(lines)


def _sanitize_table_cell(value: str) -> str:
    text = re.sub(r"\s+", " ", str(value or "").replace("\x00", " ")).strip()
    return (
        text.replace("|", "\\|")
        .replace("[", "［")
        .replace("]", "］")
    )


def _select_relevant_table_rows(rows: list[list[str]], terms: tuple[str, ...]) -> list[list[str]]:
    if len(rows) <= _TABLE_ROW_LIMIT:
        return rows
    header = rows[0]
    lowered_terms = tuple(term.lower() for term in terms if term)
    if not lowered_terms:
        return rows[:_TABLE_ROW_LIMIT]
    matches = [
        row
        for row in rows[1:]
        if any(term in " ".join(row).lower() for term in lowered_terms)
    ]
    if not matches:
        return rows[:_TABLE_ROW_LIMIT]
    return [header, *matches[: _TABLE_ROW_LIMIT - 1]]


def _representative_chunk_for_table(table: DocumentTable, chunks: Iterable[Chunk]) -> Chunk | None:
    for chunk in chunks:
        if chunk.document_id == table.document_id and int(chunk.page_start or 0) <= table.page <= int(chunk.page_end or 0):
            return chunk
    return None


def _table_score(rows: list[list[str]], terms: tuple[str, ...], *, generic_table_query: bool) -> float:
    if not rows:
        return 0.0
    text = " ".join(" ".join(row) for row in rows).lower()
    if not terms:
        return 0.64 if generic_table_query else 0.0
    matched = sum(1 for term in terms if term.lower() in text)
    if matched == 0:
        only_generic_terms = all(term.lower() in _GENERIC_TABLE_TERMS for term in terms)
        return 0.64 if generic_table_query and only_generic_terms else 0.0
    return min(0.98, 0.58 + (matched / max(len(terms), 1)) * 0.38)


def _table_payloads_from_tables(
    query: str,
    tables: Iterable[DocumentTable],
    chunks: Iterable[Chunk],
    *,
    top_k: int,
    include_document_id: bool = False,
) -> list[dict]:
    terms = extract_query_terms(query).lexical_terms
    generic_table_query = bool(_GENERIC_TABLE_QUERY_RE.search(query or ""))
    chunk_list = list(chunks)
    ranked: list[tuple[float, DocumentTable, list[list[str]], Chunk]] = []
    for table in tables:
        rows = _coerce_table_rows(table)
        score = _table_score(rows, terms, generic_table_query=generic_table_query)
        if score <= 0:
            continue
        representative = _representative_chunk_for_table(table, chunk_list)
        if representative is None:
            continue
        ranked.append((score, table, _select_relevant_table_rows(rows, terms), representative))

    ranked.sort(key=lambda item: (item[0], -int(item[1].page or 0), -int(item[1].table_index or 0)), reverse=True)
    payloads: list[dict] = []
    for score, table, rows, chunk in ranked[: int(top_k or 4)]:
        table_label = f"Table p.{table.page} #{int(table.table_index or 0) + 1}"
        payload = {
            "chunk_id": chunk.id,
            "table_id": str(table.id),
            "text": (
                f"{table_label} ({table.method}, confidence {float(table.confidence or 0):.2f})\n"
                + _format_table_rows(rows)
            ),
            "page": int(table.page or chunk.page_start or 1),
            "page_end": int(table.page or chunk.page_end or chunk.page_start or 1),
            "bboxes": [],
            "score": score,
            "section_title": table_label,
            "retrieval_modality": "table",
        }
        if include_document_id:
            payload["document_id"] = table.document_id
        payloads.append(payload)
    return payloads


def table_evidence_text(table: DocumentTable) -> str:
    rows = _coerce_table_rows(table)
    table_label = f"Table p.{table.page} #{int(table.table_index or 0) + 1}"
    return (
        f"{table_label} ({table.method}, confidence {float(table.confidence or 0):.2f})\n"
        + _format_table_rows(rows[:_TABLE_ROW_LIMIT])
    )


def _term_match_condition(term: str):
    escaped = _escape_like(term)
    pattern = f"%{escaped}%"
    return sa.or_(
        Chunk.text.ilike(pattern, escape="\\"),
        Chunk.section_title.ilike(pattern, escape="\\"),
    )


def _lexical_query_parts(query: str):
    evidence_terms = extract_query_terms(query)
    terms = evidence_terms.lexical_terms
    exact = {term.lower() for term in evidence_terms.exact_terms}
    conditions = []
    score_expr = sa.literal(0.0)
    for term in terms[:8]:
        condition = _term_match_condition(term)
        conditions.append(condition)
        weight = 3.0 if term.lower() in exact else 1.0
        score_expr = score_expr + sa.case((condition, weight), else_=0.0)
    return terms, conditions, score_expr


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
            results.append(_chunk_payload(ch, score=scores.get(ch.id, 0.0)))

        return results[: int(top_k or 5)]

    async def lexical_search(
        self,
        query: str,
        document_id: uuid.UUID,
        top_k: int,
        db: AsyncSession,
        *,
        min_text_len: int = _MIN_CHUNK_TEXT_LEN,
    ):
        """Term-based fallback search for exact names, numbers, clauses, and page/source queries."""
        terms, conditions, score_expr = _lexical_query_parts(query)
        if not terms or not conditions:
            return []

        rows = await db.execute(
            select(Chunk)
            .where(Chunk.document_id == document_id)
            .where(sa.func.length(sa.func.trim(Chunk.text)) >= int(min_text_len))
            .where(sa.or_(*conditions))
            .order_by(score_expr.desc(), Chunk.page_start, Chunk.chunk_index)
            .limit(max(int(top_k or 8) * 4, 64))
        )
        chunks: List[Chunk] = list(rows.scalars())
        ranked = sorted(
            chunks,
            key=lambda ch: (
                _lexical_score(" ".join([ch.section_title or "", ch.text or ""]), terms),
                -int(ch.page_start or 0),
            ),
            reverse=True,
        )
        return [
            _chunk_payload(
                ch,
                score=_lexical_score(" ".join([ch.section_title or "", ch.text or ""]), terms),
            )
            for ch in ranked[: int(top_k or 8)]
        ]

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
            results.append(_chunk_payload(ch, score=scores.get(ch.id, 0.0), include_document_id=True))

        return results[: int(top_k or 8)]

    async def lexical_search_multi(
        self,
        query: str,
        document_ids: List[uuid.UUID],
        top_k: int,
        db: AsyncSession,
        *,
        min_text_len: int = _MIN_CHUNK_TEXT_LEN,
    ):
        """Term-based fallback search across a collection."""
        if not document_ids:
            return []
        terms, conditions, score_expr = _lexical_query_parts(query)
        if not terms or not conditions:
            return []

        rows = await db.execute(
            select(Chunk)
            .where(Chunk.document_id.in_(document_ids))
            .where(sa.func.length(sa.func.trim(Chunk.text)) >= int(min_text_len))
            .where(sa.or_(*conditions))
            .order_by(score_expr.desc(), Chunk.document_id, Chunk.page_start, Chunk.chunk_index)
            .limit(max(int(top_k or 8) * 4, 96))
        )
        chunks: List[Chunk] = list(rows.scalars())
        ranked = sorted(
            chunks,
            key=lambda ch: (
                _lexical_score(" ".join([ch.section_title or "", ch.text or ""]), terms),
                -int(ch.page_start or 0),
            ),
            reverse=True,
        )
        return [
            _chunk_payload(
                ch,
                score=_lexical_score(" ".join([ch.section_title or "", ch.text or ""]), terms),
                include_document_id=True,
            )
            for ch in ranked[: int(top_k or 8)]
        ]

    async def table_search(self, query: str, document_id: uuid.UUID, top_k: int, db: AsyncSession):
        """Return structured table evidence for table/numeric questions when tables were scanned."""
        table_rows = await db.execute(
            select(DocumentTable)
            .where(DocumentTable.document_id == document_id)
            .order_by(DocumentTable.page, DocumentTable.table_index)
        )
        tables: List[DocumentTable] = list(table_rows.scalars())
        if not tables:
            return []

        min_page = min(int(table.page or 1) for table in tables)
        max_page = max(int(table.page or 1) for table in tables)
        chunk_rows = await db.execute(
            select(Chunk)
            .where(Chunk.document_id == document_id)
            .where(Chunk.page_start <= max_page)
            .where(Chunk.page_end >= min_page)
            .order_by(Chunk.page_start, Chunk.chunk_index)
        )
        chunks: List[Chunk] = list(chunk_rows.scalars())
        return _table_payloads_from_tables(query, tables, chunks, top_k=top_k)

    async def table_search_multi(
        self, query: str, document_ids: List[uuid.UUID], top_k: int, db: AsyncSession
    ):
        """Return structured table evidence across a collection when tables were scanned."""
        if not document_ids:
            return []
        table_rows = await db.execute(
            select(DocumentTable)
            .where(DocumentTable.document_id.in_(document_ids))
            .order_by(DocumentTable.document_id, DocumentTable.page, DocumentTable.table_index)
        )
        tables: List[DocumentTable] = list(table_rows.scalars())
        if not tables:
            return []

        page_conditions = [
            sa.and_(
                Chunk.document_id == table.document_id,
                Chunk.page_start <= int(table.page or 1),
                Chunk.page_end >= int(table.page or 1),
            )
            for table in tables
        ]
        chunk_rows = await db.execute(
            select(Chunk)
            .where(sa.or_(*page_conditions))
            .order_by(Chunk.document_id, Chunk.page_start, Chunk.chunk_index)
        )
        chunks: List[Chunk] = list(chunk_rows.scalars())
        return _table_payloads_from_tables(
            query,
            tables,
            chunks,
            top_k=top_k,
            include_document_id=True,
        )


# Singleton service
retrieval_service = RetrievalService()
