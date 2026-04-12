Implemented per `.collab/plans/citation-accuracy-fix.md`, with all requested functional changes applied.

**Changed files**
1. `backend/app/services/retrieval_service.py:69`
Added `page_end` in `search()` result payload; same in `search_multi()` at `backend/app/services/retrieval_service.py:127`.

2. `backend/app/services/chat_service.py:56`
Added module-level `_is_valid_bbox(bb: dict) -> bool` (checks `x,y,w,h` are numeric).

3. `backend/app/services/chat_service.py:67`
Updated `_ChunkInfo` field order to include `page_end` immediately after `page_start`.

4. `backend/app/services/chat_service.py:105`
Replaced citation bbox/page logic in `RefParserFSM.feed()`:
- removed page-start-only bbox filter
- kept all valid bboxes
- sorted by `(page, y, x)`
- selected best page by bbox frequency (tie => lower page)
- set citation `page = best_page`
- set citation `page_end = chunk.page_end`
- set citation `bboxes = all_bbs`
- preserved existing citation fields (`ref_index`, `chunk_id`, `text_snippet`, `offset`, `document_id`, `document_filename`)

5. `backend/app/services/chat_service.py:333`
Added `page_end=int(item.get("page_end", item["page"]))` when building `chunk_map` in `chat_stream()`.

6. `backend/app/services/chat_service.py:666`
Added `page_end=ch.page_end` in `continue_stream()` chunk_map reconstruction.

7. `frontend/src/types/index.ts:16`
Added `pageEnd?: number` to `Citation`.

8. `frontend/src/lib/sse.ts:9`
Added `page_end?: number` to `CitationPayload`; mapped to `Citation.pageEnd` at `frontend/src/lib/sse.ts:69`.

9. `frontend/src/lib/api.ts:85`
In `getMessages()` citation mapping, added:
- `pageEnd`
- `documentId`
- `documentFilename`

**Intentionally unchanged**
- `frontend/src/store/index.ts`: current `navigateToCitation` logic already matches plan (`bb.page ?? citation.page`) and passes all bboxes through.

**Validation**
- Python syntax check passed:
`PYTHONPYCACHEPREFIX=/tmp/pycache python3 -m py_compile backend/app/services/retrieval_service.py backend/app/services/chat_service.py`
- No tests were added or run (per your instruction).