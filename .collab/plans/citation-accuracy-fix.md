# Plan: Citation Page Accuracy Fix (v2 — Codex-reviewed)

## Problem

When a user clicks a citation `[n]` in the chat, the PDF viewer navigates to the **wrong page**. The highlight appears on the chunk's first page (`page_start`), but the actual relevant content may be on a later page within that multi-page chunk.

**Example**: A chunk spans pages 3–5. The LLM uses information from page 5 in its answer. Clicking `[1]` navigates to page 3 and highlights irrelevant text there.

## Root Cause Analysis

Three bugs in the pipeline combine to produce wrong-page citations:

### Bug 1: `retrieval_service.py:69` — Only returns `page_start`
```python
"page": ch.page_start,   # Always first page, ignores page_end
```
The Chunk DB model has both `page_start` and `page_end`, but retrieval only passes `page_start` to chat_service.

### Bug 2: `chat_service.py:104-108` — Filters bboxes to `page_start` only
```python
page_bbs = [
    bb for bb in (chunk.bboxes or [])
    if isinstance(bb, dict)
    and bb.get("page", chunk.page_start) == chunk.page_start
]
```
Each bbox in `chunk.bboxes` already has a `page` field from parse_service. This filter discards ALL bboxes from pages 2+ of a multi-page chunk. The fallback on line 110-111 (`if not page_bbs: use all`) only triggers when filtering returns zero results.

### Bug 3: `chat_service.py:117` — Citation event hardcodes `page_start`
```python
"page": chunk.page_start,
```
Even if we kept all bboxes, the frontend would still navigate to `page_start`.

### Data flow (current, broken):
```
parse_service.py → Chunk(page_start=3, page_end=5, bboxes=[{page:3,...}, {page:4,...}, {page:5,...}])
    ↓
retrieval_service.py → {"page": 3, "bboxes": [{page:3}, {page:4}, {page:5}]}
    ↓
chat_service.py chunk_map → _ChunkInfo(page_start=3, bboxes=[{page:3}, {page:4}, {page:5}])
    ↓
RefParserFSM.feed() → filters to page_start → citation_data = {"page": 3, "bboxes": [{page:3}]}
    ↓
Frontend navigateToCitation → currentPage=3, highlights=[{page:3 bboxes}]
```

## Solution: Multi-Page Citation with All-Page Highlights

### Strategy Overview (revised per Codex review)

**Core idea**: Pass ALL bboxes (from all pages in chunk) end-to-end through the pipeline. The backend selects a "best page" for initial navigation (with hardened heuristic). The frontend keeps **all** bboxes in the highlights array — `PdfViewer.tsx:383` already groups highlights by page via `highlightsByPage`, so multi-page highlights render naturally when the user scrolls.

**Key difference from v1**: Do NOT hard-filter highlights to one page in the frontend store. Pass all bboxes through; only use `citation.page` for initial scroll target.

### Phase 1: Backend — Pass all bboxes + page_end (2 files)

#### 1a. `backend/app/services/retrieval_service.py`
Add `page_end` to search results in both `search()` and `search_multi()`:
```python
results.append({
    "chunk_id": ch.id,
    "text": ch.text,
    "page": ch.page_start,
    "page_end": ch.page_end,     # NEW
    "bboxes": ch.bboxes,
    "score": scores.get(ch.id, 0.0),
    "section_title": ch.section_title,
})
```

#### 1b. `backend/app/services/chat_service.py`

**`_ChunkInfo` dataclass** — add `page_end`:
```python
@dataclass
class _ChunkInfo:
    id: uuid.UUID
    page_start: int
    page_end: int           # NEW
    bboxes: list
    text: str
    section_title: str = ""
    document_id: Optional[uuid.UUID] = None
    document_filename: str = ""
```

**chunk_map construction** (~line 307) — store `page_end`:
```python
chunk_map[idx] = _ChunkInfo(
    id=item["chunk_id"],
    page_start=int(item["page"]),
    page_end=int(item.get("page_end", item["page"])),  # NEW
    bboxes=item.get("bboxes") or [],
    ...
)
```

**RefParserFSM.feed()** (lines 103-118) — Remove page filtering. Send ALL bboxes. Hardened page selection:
```python
if inner.isdigit() and (int(inner) in self.chunk_map):
    ref_num = int(inner)
    chunk = self.chunk_map[ref_num]

    # Keep ALL bboxes from all pages (don't filter to page_start)
    all_bbs = [
        bb for bb in (chunk.bboxes or [])
        if isinstance(bb, dict) and _is_valid_bbox(bb)
    ]
    if not all_bbs:
        all_bbs = list(chunk.bboxes or [])
    all_bbs.sort(key=lambda b: (b.get("page", chunk.page_start), b.get("y", 0), b.get("x", 0)))

    # Smart page selection: page with most bboxes, tie-break: lower page
    page_counts: dict[int, int] = {}
    for bb in all_bbs:
        p = int(bb.get("page", chunk.page_start))
        page_counts[p] = page_counts.get(p, 0) + 1
    best_page = min(
        page_counts,
        key=lambda p: (-page_counts[p], p)  # most bboxes first, then lower page
    ) if page_counts else chunk.page_start

    citation_data: Dict[str, Any] = {
        "ref_index": ref_num,
        "chunk_id": str(chunk.id),
        "page": best_page,              # CHANGED: smart page selection
        "page_end": chunk.page_end,     # NEW
        "bboxes": all_bbs,              # CHANGED: all pages' bboxes
        "text_snippet": ((f"{chunk.section_title}: " if chunk.section_title else "") + (chunk.text or ""))[:100],
        "offset": self.char_offset,
    }
```

**Helper function** (module level):
```python
def _is_valid_bbox(bb: dict) -> bool:
    """Check if bbox dict has valid coordinate fields."""
    return all(
        isinstance(bb.get(k), (int, float))
        for k in ("x", "y", "w", "h")
    )
```

**continue_stream chunk_map reconstruction** (~line 639) — same `page_end`:
```python
chunk_map[ref_num] = _ChunkInfo(
    id=ch.id,
    page_start=ch.page_start,
    page_end=ch.page_end,       # NEW
    bboxes=ch.bboxes or [],
    ...
)
```

### Phase 2: Frontend — Smart page navigation (4 files)

#### 2a. `frontend/src/types/index.ts`
Add `pageEnd` to Citation:
```typescript
export interface Citation {
  refIndex: number;
  chunkId: string;
  page: number;       // Best page (smart-selected by backend)
  pageEnd?: number;   // Last page of chunk
  bboxes: NormalizedBBox[];
  textSnippet: string;
  offset: number;
  documentId?: string;
  documentFilename?: string;
}
```

#### 2b. `frontend/src/store/index.ts` — `navigateToCitation`
Pass ALL bboxes through (don't filter). `PdfViewer.tsx:383` `highlightsByPage` already groups by `bb.page`:
```typescript
navigateToCitation: (citation: Citation) => {
    // Keep ALL bboxes — PdfViewer.highlightsByPage groups them by page.
    // This way, highlights on adjacent pages are visible when user scrolls.
    const bboxes = (citation.bboxes || []).map((bb: NormalizedBBox) => ({
      ...bb,
      page: bb.page ?? citation.page,
    }));
    set((state) => ({
      currentPage: citation.page,   // Navigate to backend-selected best page
      highlights: bboxes,           // ALL bboxes from all pages
      highlightSnippet: citation.textSnippet || null,
      scrollNonce: state.scrollNonce + 1,
    }));
},
```

#### 2c. `frontend/src/lib/sse.ts` — Map `page_end` → `pageEnd`
In the citation event mapping (~line 64):
```typescript
const c: Citation = {
  refIndex: p.ref_index,
  chunkId: p.chunk_id,
  page: p.page,
  pageEnd: typeof (p as any).page_end === 'number' ? (p as any).page_end : undefined,  // NEW
  bboxes: p.bboxes || [],
  textSnippet: p.text_snippet || '',
  offset: p.offset ?? 0,
  documentId: typeof p.document_id === 'string' ? p.document_id : undefined,
  documentFilename: typeof p.document_filename === 'string' ? p.document_filename : undefined,
};
```

Also update `CitationPayload` type to include `page_end`:
```typescript
type CitationPayload = {
  ref_index: number;
  chunk_id: string;
  page: number;
  page_end?: number;    // NEW
  bboxes: { x: number; y: number; w: number; h: number; page?: number }[];
  text_snippet: string;
  offset: number;
};
```

#### 2d. `frontend/src/lib/api.ts` — Map `page_end` in `getMessages()`
In the `getMessages()` citation mapping (~line 81), add missing fields:
```typescript
m.citations.map((c: any) => ({
  refIndex: c.ref_index,
  chunkId: c.chunk_id,
  page: c.page,
  pageEnd: typeof c.page_end === 'number' ? c.page_end : undefined,  // NEW
  bboxes: c.bboxes || [],
  textSnippet: c.text_snippet,
  offset: c.offset,
  documentId: typeof c.document_id === 'string' ? c.document_id : undefined,       // NEW (was missing)
  documentFilename: typeof c.document_filename === 'string' ? c.document_filename : undefined, // NEW (was missing)
}))
```

## Files Changed (Summary)

| File | Change |
|---|---|
| `backend/app/services/retrieval_service.py` | Add `page_end` to both `search()` and `search_multi()` |
| `backend/app/services/chat_service.py` | `_ChunkInfo.page_end`, remove bbox page filtering, hardened page selection with int coercion + tie-break, `_is_valid_bbox()` helper |
| `frontend/src/types/index.ts` | `pageEnd?: number` in Citation |
| `frontend/src/store/index.ts` | Keep all bboxes in highlights (no filtering) |
| `frontend/src/lib/sse.ts` | `page_end` in CitationPayload type + map to `pageEnd` |
| `frontend/src/lib/api.ts` | Add `pageEnd`, `documentId`, `documentFilename` to `getMessages()` citation mapping |

## No Migration Needed

- Chunk table already has `page_start` and `page_end` columns
- Chunk bboxes JSONB already contains per-bbox `page` field (set by `_normalize_bbox(pg, ...)`)
- Citation JSONB in Message table is schemaless — adding `page_end` is backward-compatible
- No Alembic migration required

## Edge Cases

1. **Single-page chunks**: `page_start == page_end`. Smart page selection picks the only page. No behavioral change.
2. **Chunks with no bboxes**: Fallback to `page_start` (same as current). `highlightSnippet` text matching still works.
3. **Non-PDF documents** (DOCX/PPTX/URL): These use `ExtractedPage` which doesn't have physical bbox coordinates. The parse_worker creates synthetic bboxes via `(0,0,1,1)` in point space, then `_normalize_bbox` normalizes them. In the frontend, `isDummyBbox()` detects these and falls back to text-snippet matching. This behavior is **unchanged** by our fix.
4. **All bboxes on page_start**: Smart selection picks `page_start` (same as current). No regression.
5. **Historic citations in DB**: Old citations lack `page_end`. Frontend treats missing `pageEnd` as undefined → no crash. `page` field behavior unchanged for old data.
6. **Continue endpoint**: `continue_stream` reconstructs chunk_map from DB Chunk records → automatically gets correct `page_end`.
7. **Multi-page highlights visibility**: Because we pass ALL bboxes to the frontend store, `PdfViewer.tsx:383` `highlightsByPage` groups them by page. When the user scrolls from the navigated page to adjacent pages, they see the highlights there too.
8. **Tie-breaking**: If pages 3 and 4 both have equal bbox counts, the lower page (3) wins. This is deterministic and correct — earlier pages typically contain the "header" info that the LLM leads with.

## Verification

1. **Multi-page chunk test**: Find/create a document where a chunk spans 2+ pages. Ask a question about info from the later page. Click citation → should navigate to the page with the most content, highlights visible on all pages.
2. **Single-page chunk test**: Normal chunk. Click citation → same behavior as before.
3. **Converted PDF test**: Upload DOCX → converted PDF. Click citation → text-snippet highlighting still works.
4. **Collection Q&A test**: Cross-document citations should still work (`documentId` now properly mapped in `api.ts` too).
5. **Continue generating test**: After continuation, click new citations → correct page.
6. **History reload test**: Reload page → load old messages with `getMessages()` → click citation from history → correct page (tests `api.ts` mapping).

## Codex Review Feedback (addressed)

| Feedback | Resolution |
|---|---|
| Content-density heuristic is weak proxy | True, but strictly better than always-page_start. Tie-break: lower page. Future: LLM page-level citations |
| Don't hard-filter to one page in store | ✅ Pass ALL bboxes through. PdfViewer.highlightsByPage handles grouping |
| Missed `api.ts` mapping for `getMessages()` | ✅ Added Phase 2d: map `pageEnd`, `documentId`, `documentFilename` |
| Coerce bbox page to int, deterministic tie-break | ✅ `int(bb.get("page", ...))` + `min(..., key=(-count, page))` |
| Dummy bbox assumption incorrect for non-PDF | Clarified: `_normalize_bbox` normalizes `(0,0,1,1)` point-space → tiny boxes. Frontend `isDummyBbox` still works as-is |

## Future Enhancement (Not in this PR)

**LLM page-level citation**: Annotate chunk context with page numbers (`[1] (pp.3-5) text...`) and ask LLM to cite `[1, p.4]`. Parse extended format in RefParserFSM. This would provide exact page accuracy when the LLM cooperates, with fallback to content-density heuristic. Deferred to a separate PR to keep this fix minimal and safe.
