**Summary**
The plan correctly identifies the current root cause and will improve behavior, but I do **not** recommend merging as-is. The proposed “most bboxes page” heuristic is a weak proxy for relevance and the plan misses a couple of integration points.

**Strengths**
- Root-cause analysis is accurate: citations are forced to `page_start` in retrieval + FSM + citation payload (`backend/app/services/retrieval_service.py:69`, `backend/app/services/chat_service.py:104`, `backend/app/services/chat_service.py:117`).
- Per-bbox page data is indeed populated in parsing: `chunk_document()` calls `_normalize_bbox(pg, ...)` and `_normalize_bbox` always returns `"page": page` (`backend/app/services/parse_service.py:307`, `backend/app/services/parse_service.py:523`).
- `continue_stream` chunk-map reconstruction was considered (`backend/app/services/chat_service.py:614`).

**Risks**
- `High`: The content-density heuristic can still pick the wrong page frequently. Bbox count is effectively sentence count, not citation relevance (`backend/app/services/parse_service.py:263`, `backend/app/services/parse_service.py:307`; proposed logic `.collab/plans/citation-accuracy-fix.md:116`).
- `Medium`: Filtering highlights to only the selected page removes fallback visibility when heuristic is wrong (`.collab/plans/citation-accuracy-fix.md:176`). Current viewer already supports multi-page highlight grouping (`frontend/src/components/PdfViewer/PdfViewer.tsx:383`).
- `Medium`: Missed mapping path for persisted/history messages. `page_end` is planned for SSE mapping, but `getMessages()` also maps citations and currently drops extra fields (`frontend/src/lib/api.ts:81`).
- `Medium`: Plan’s dummy-bbox assumption appears incorrect for current non-PDF pipeline. Non-PDF uses `(0,0,1,1)` in point space then normalizes by page dims, producing tiny boxes, not literal dummy `(0,0,1,1)` (`backend/app/workers/parse_worker.py:161`, `backend/app/workers/parse_worker.py:168`, `backend/app/services/parse_service.py:514`, `frontend/src/components/PdfViewer/PageWithHighlights.tsx:17`).
- `Low`: Proposed `_is_valid_bbox` validates coordinates only; page typing/sorting robustness is not covered (possible issues with legacy malformed bbox `page` values) (`.collab/plans/citation-accuracy-fix.md:114`, `.collab/plans/citation-accuracy-fix.md:136`).

**Suggestions**
1. Keep all bboxes end-to-end, but do **not** hard-filter to one page in store; only use selected page for initial navigation.
2. Map `page_end -> pageEnd` in both `frontend/src/lib/sse.ts` and `frontend/src/lib/api.ts`.
3. Harden backend page selection:
   - Coerce/validate bbox `page` as int.
   - Deduplicate identical bboxes per page before counting.
   - Define deterministic tie-breaker (explicitly).
4. Add targeted tests for `RefParserFSM.feed()` page selection, multi-page chunks, no-bbox chunks, and malformed bbox payloads.

**Recommendation**
**Reject (revise before implementation).** The direction is good, but current heuristic + missed integration points make accuracy and robustness too uncertain.