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

Pure selection logic plus exactly one Page query; no LLM, no verification
(that's `quote_verification_service.verify_quote`, called by the caller on
the returned `.text`).
"""
from __future__ import annotations

import uuid
from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.tables import Chunk, Page


@dataclass(frozen=True)
class QuoteSource:
    text: str  # the verification corpus — passed to verify_quote(proposed, text)
    kind: str  # "page_text" | "extracted_text"
    page_start: int
    page_end: int


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
        return QuoteSource(text=text, kind="page_text", page_start=page_start, page_end=page_end)

    # Fallback: cited chunk ± neighbours, deduped by chunk id, joined in
    # document order (page_start, then chunk_index) so cross-chunk quotes
    # read as a contiguous excerpt.
    by_id: dict[uuid.UUID, Chunk] = {}
    for c in (chunk, *neighbor_chunks):
        by_id[c.id] = c
    ordered = sorted(by_id.values(), key=_document_order_key)
    text = "\n\n".join((c.text or "") for c in ordered)
    return QuoteSource(text=text, kind="extracted_text", page_start=page_start, page_end=page_end)
