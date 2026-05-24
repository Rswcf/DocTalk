"""Offline before/after retrieval-quality eval on the REAL failure docs.

Faithful: uses production Postgres chunks (real text/page/section), and the actual
selector code (old `_select_representative_chunks` vs new section-spanning
`select_chunks_for_summary`). No re-embedding needed for the structural metrics:
  - B5 section coverage  (old vs new distinct sections covered for whole-doc summary)
  - B2 dynamic-k         (retrieval breadth cap: old 12 vs new)
  - B4 page recall       (does a "page N" query now fetch page-N chunks?)
Semantic recall@k (B1 RRF ordering) needs Qdrant vectors (internal-only) — noted, not run here.
"""
import asyncio
import os
from types import SimpleNamespace

import asyncpg

import app.services.document_brief_service as dbs
from app.services.corrective_retrieval_service import _dynamic_k, _plan_limit
from app.services.query_router import QueryIntent, query_router

# (doc_id, label, a real "page N" query page for B4)
TARGETS = [
    ("d9698615-4079-4d93-ac3d-42405c1972ff", "PAY 492p Chirurgie (paying user)", 350),
    ("a52896b7-a607-4b58-a2c6-ee0dab6bcb1b", "U26 462p bio textbook", 200),
    ("52490faf-4dee-44a6-aa2e-fc9041f60a87", "U37 398p VW AR21 (public)", 120),
    ("e69b4135-e949-4a26-945a-8a3667a1d76e", "U47 443p thesis", 150),
]


def distinct_sections(chunks):
    return {(c.section_title or "").strip() for c in chunks if (c.section_title or "").strip()}


async def load_chunks(con, doc_id):
    rows = await con.fetch(
        "select id, chunk_index, section_title, page_start, page_end, left(text,400) text "
        "from chunks where document_id=$1 order by chunk_index", doc_id)
    return [SimpleNamespace(id=r["id"], chunk_index=r["chunk_index"],
                            section_title=r["section_title"], page_start=r["page_start"],
                            page_end=r["page_end"], text=r["text"]) for r in rows]


async def main():
    con = await asyncpg.connect(os.environ["DB"])
    planner = dbs.SectionMapReducePlanner()
    print("=" * 90)
    print("RETRIEVAL QUALITY — BEFORE (old) vs AFTER (new), real production chunks")
    print("=" * 90)
    for doc_id, label, page_q in TARGETS:
        pc = await con.fetchval("select page_count from documents where id=$1", doc_id)
        chunks = await load_chunks(con, doc_id)
        total_sections = len(distinct_sections(chunks))

        # --- B2 dynamic-k (retrieval breadth cap) ---
        old_k = max(8, 12)  # legacy _plan_limit floor
        new_k = _dynamic_k(8, page_count=pc)

        # --- B5 whole-doc summary coverage ---
        old_sel = dbs._select_representative_chunks(chunks, max_chunks=18)
        new_sel = await planner.select_chunks_for_summary(chunks, max_chunks=18)
        old_cov = distinct_sections(old_sel)
        new_cov = distinct_sections(new_sel)

        # --- B4 page lookup recall for a real "page N" query ---
        route = query_router.route(f"what is on page {page_q} of the document")
        routed_page = route.primary_intent == QueryIntent.PAGE_LOOKUP and route.page_ref == page_q
        page_chunks = [c for c in chunks if (c.page_start or 0) <= page_q <= (c.page_end or 0)]

        print(f"\n### {label}  (pages={pc}, chunks={len(chunks)}, sections={total_sections})")
        print(f"  B2 retrieval-k cap:        OLD={old_k}   NEW={new_k}   (Δ +{new_k-old_k})")
        print(f"  B5 summary section cover:  OLD={len(old_cov)}/{total_sections} sections   "
              f"NEW={len(new_cov)}/{total_sections} sections   (chunks: old={len(old_sel)} new={len(new_sel)})")
        gained = sorted(new_cov - old_cov)
        print(f"     sections NEW adds that OLD missed: {len(gained)}  e.g. {gained[:3]}")
        print(f"  B4 'page {page_q}' lookup:     OLD=semantic(no page route)→0 page-{page_q} chunks   "
              f"NEW: routed={routed_page}, fetches {len(page_chunks)} page-{page_q} chunks")
    await con.close()


if __name__ == "__main__":
    asyncio.run(main())
