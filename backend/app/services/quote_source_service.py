"""Verification-source selector with honest trust labels (B2, plan §8.1/§9).

A quote card can only claim "verified against page text" (`kind="page_text"`)
when the ENTIRE cited chunk's page range has real `Page.content` (B1's
forward-only PDF persistence, or the pre-existing non-PDF path). If even one
page in range is missing content — a legacy document parsed before B1, a page
row that never persisted — the substrate is dishonest to claim page-text
verification for, so this falls back to the cited chunk's own text plus any
caller-provided neighbour chunks (`kind="extracted_text"`). The downstream
trust-label copy is derived 1:1 from `kind`: "verified against page text" vs
"verified against extracted text" — never silently upgraded.

FIX-2 (Codex r1 BLOCKER #2 — page attribution from the verified slice):
`.text` remains a single concatenated string for backward compatibility (and
any debugging/display use), but `.segments` is what verification actually
runs against — ONE entry per page for page_text kind, ONE entry per chunk
(cited chunk first, then each neighbor) for extracted_text kind. Segments are
NEVER concatenated together for verification: a match is only ever located
within a single segment, so the caller can attribute the resulting card to
that segment's own real page range and bboxes — never a majority-vote guess
over an entire multi-page span, and never a match straddling an artificial
join between two unrelated chunks.

Pure selection logic plus exactly one Page query; no LLM, no verification
(that's `quote_verification_service.verify_quote`, called by the caller once
per segment).
"""
from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from typing import Any, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.tables import Chunk, Page


def _valid_bbox(bb: Any) -> bool:
    return isinstance(bb, dict) and all(isinstance(bb.get(k), (int, float)) for k in ("x", "y", "w", "h"))


@dataclass(frozen=True)
class QuoteSourceSegment:
    """One independently-verifiable unit of source text.

    page_text kind: a single page's raw content (chunk_id=None, bboxes=[] —
    bboxes live on chunks, not pages; the caller filters the CITED chunk's
    own bboxes to this segment's page).
    extracted_text kind: a single chunk's (the cited chunk, or one neighbor)
    own text and its own bboxes.
    """
    text: str
    page_start: int
    page_end: int
    chunk_id: Optional[uuid.UUID] = None
    bboxes: list[dict] = field(default_factory=list)


@dataclass(frozen=True)
class QuoteSource:
    text: str  # concatenated view — backward-compat/display only, NOT used for verification
    kind: str  # "page_text" | "extracted_text"
    page_start: int
    page_end: int
    segments: list[QuoteSourceSegment] = field(default_factory=list)


def _document_order_key(chunk: Chunk) -> tuple[int, int]:
    return (chunk.page_start, getattr(chunk, "chunk_index", 0) or 0)


async def build_quote_source(
    db: AsyncSession,
    document_id: uuid.UUID,
    chunk: Chunk,
    neighbor_chunks: list[Chunk],
) -> QuoteSource:
    page_start = chunk.page_start
    page_end = chunk.page_end

    result = await db.execute(
        select(Page)
        .where(Page.document_id == document_id)
        .where(Page.page_number >= page_start)
        .where(Page.page_number <= page_end)
        .order_by(Page.page_number)
    )
    # Sort explicitly rather than relying solely on the query's ORDER BY —
    # cheap, and keeps concatenation order correct regardless of driver/test-
    # double behavior.
    pages = sorted(result.scalars().all(), key=lambda p: p.page_number)
    expected_page_count = page_end - page_start + 1
    all_pages_have_content = (
        len(pages) == expected_page_count
        and all((p.content or "").strip() for p in pages)
    )

    if all_pages_have_content:
        text = "\n".join(p.content for p in pages)
        segments = [
            QuoteSourceSegment(text=p.content, page_start=p.page_number, page_end=p.page_number)
            for p in pages
        ]
        return QuoteSource(
            text=text, kind="page_text", page_start=page_start, page_end=page_end, segments=segments,
        )

    # Fallback: cited chunk ± neighbours, deduped by chunk id, ordered
    # (cited chunk first, then neighbors in document order) — kept as
    # SEPARATE segments so verification never spans an artificial join
    # between two chunks that may not be textually contiguous.
    by_id: dict[uuid.UUID, Chunk] = {}
    for c in (chunk, *neighbor_chunks):
        by_id.setdefault(c.id, c)
    others = sorted((c for c in by_id.values() if c.id != chunk.id), key=_document_order_key)
    ordered = [chunk, *others]
    text = "\n\n".join((c.text or "") for c in ordered)
    segments = [
        QuoteSourceSegment(
            text=c.text or "",
            page_start=c.page_start,
            page_end=c.page_end,
            chunk_id=c.id,
            bboxes=[bb for bb in (c.bboxes or []) if _valid_bbox(bb)],
        )
        for c in ordered
    ]
    return QuoteSource(
        text=text, kind="extracted_text", page_start=page_start, page_end=page_end, segments=segments,
    )
