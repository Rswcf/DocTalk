## BUG-2026-05-10-SEARCH-ZERO-AFTER-READY: Exact search can return 0 results after PDF is ready

Severity: P2, possibly P1 if reproduced through chat/citation UI

Status: **fixed locally and regression-tested on 2026-05-10; pending review/deploy**

Area: Backend retrieval / document search

Environment:
- Local backend `http://127.0.0.1:8000`
- Version `0.17.1 beta`
- Docker infra running: Postgres, Redis, Qdrant, MinIO
- Existing Celery worker reused

Test data:
- `test_inputs/semiconductor.pdf`
- Query: `semiconductor`

Repro:
1. Create a temporary authenticated QA user.
2. Upload `test_inputs/semiconductor.pdf` to `POST /api/documents/upload`.
3. Poll `GET /api/documents/{document_id}` until `status=ready`.
4. Confirm the document reports `page_count=2`, `chunks_total=9`, `chunks_indexed=9`.
5. Call `POST /api/documents/{document_id}/search` with `{"query":"semiconductor","top_k":1}`.

Expected:
- Search returns at least one relevant chunk because the document visibly contains the exact term `semiconductor`.

Actual:
- In two matrix runs, search returned 200 with `results=[]`.
- The second run retried 4 times after ready and still returned 0 results.
- A standalone golden-path rerun and a later debug matrix run returned 1 result, so the failure is intermittent.

Evidence:
- `.collab/tasks/qa-upload-parse-matrix-2026-05-10-first-run-failure.json`
- `.collab/tasks/qa-upload-parse-matrix-2026-05-10.json`
- Passing comparison: `.collab/tasks/qa-backend-golden-path-rerun-2026-05-10.json`
- Passing comparison: `.collab/tasks/qa-upload-parse-matrix-debug-keep-2026-05-10.json`

Impact:
- Users may see no search result for an exact term immediately after a document is ready.
- If the same retrieval behavior leaks into chat or citation routing, answer grounding can be incomplete or appear unreliable.

Likely root cause:
- `RetrievalService.search` is vector-only and over-fetches only `top_k * 3`. If Qdrant returns only micro-chunks or misses the relevant chunk for a low `top_k`, the backend filters those out and returns an empty result without lexical fallback.
- The intermittent nature suggests vector ranking or Qdrant freshness/order can vary even after `chunks_indexed` reaches the expected count.

Fix recommendation:
- Add a lexical fallback or larger backfill path when semantic search returns fewer than `top_k` usable chunks, especially for exact-term queries.
- Consider increasing the Qdrant over-fetch floor beyond `top_k * 3`.
- Add an integration/regression test that uploads `semiconductor.pdf`, waits for ready, then asserts exact-term search returns at least one result.

Retest:
- Rerun `.collab/scripts/qa_upload_parse_matrix.py`.
- Rerun `.collab/scripts/qa_backend_golden_path.py`.
- Add repeated runs to catch flakiness, not just a single pass.

Fix implemented:
- `backend/app/api/search.py` now backfills direct document search with `retrieval_service.lexical_search` when semantic search returns fewer than `top_k` results.
- `backend/app/services/retrieval_service.py` now uses a minimum Qdrant fetch limit of 24 points for single-document and multi-document semantic retrieval, reducing the chance that short/micro chunks consume the whole candidate set.
- `backend/tests/test_search_api.py` adds unit coverage for deduping and lexical backfill merge behavior.

Retest evidence:
- `.collab/tasks/qa-run-2026-05-10-search-ready-regression.md`
- `.collab/tasks/qa-upload-parse-matrix-after-search-fallback-2026-05-10.json`
- `.collab/tasks/qa-search-ready-regression-after-fallback-2026-05-10.json`

Retest result:
- `cd backend && python3 -m pytest tests/test_search_api.py tests/test_retrieval_service_lexical.py -v`: 11 passed.
- `cd backend && python3 -m ruff check app/ tests/`: passed.
- Upload/parse matrix after fallback: 12/12 passed; `semiconductor.pdf` exact search returned 1 result on the first attempt.
- Repeated regression: 8 uploads x 5 exact searches each = 40 searches; zero empty result searches.
