# QA Run - 2026-05-10 - Ready Search Regression

Scope: retest `BUG-2026-05-10-SEARCH-ZERO-AFTER-READY` after adding lexical fallback to the document search API and increasing Qdrant over-fetch for semantic retrieval.

## Code Change Under Test

| File | Change |
|---|---|
| `backend/app/api/search.py` | If semantic search returns fewer than `top_k` results, call `retrieval_service.lexical_search` and merge results by `chunk_id`. |
| `backend/app/services/retrieval_service.py` | Raise Qdrant fetch floor to `24` points for single-document and multi-document semantic retrieval. |
| `backend/tests/test_search_api.py` | Add merge/backfill unit coverage. |

## Commands Run

```bash
cd backend && python3 -m pytest tests/test_search_api.py tests/test_retrieval_service_lexical.py -v
cd backend && python3 -m ruff check app/ tests/
python3 .collab/scripts/qa_upload_parse_matrix.py \
  --timeout 300 \
  --poll-interval 3 \
  --json-out .collab/tasks/qa-upload-parse-matrix-after-search-fallback-2026-05-10.json
python3 .collab/scripts/qa_search_ready_regression.py \
  --iterations 8 \
  --searches-per-doc 5 \
  --json-out .collab/tasks/qa-search-ready-regression-after-fallback-2026-05-10.json
```

## Results

| Check | Result |
|---|---|
| Search merge + lexical service tests | Pass: 11 tests |
| Backend ruff | Pass |
| Upload/parse matrix after fallback | Pass: 12 cases |
| `semiconductor.pdf` exact search in matrix | Pass on first attempt, result_count=1 |
| Repeated ready/search regression | Pass: 8 uploads, 40 searches, 0 zero-result searches |
| Cleanup | QA user/docs deleted; cleanup counts `users=0`, `documents=0` |

## Retest Verdict

`BUG-2026-05-10-SEARCH-ZERO-AFTER-READY` is **fixed locally and regression-tested**. It still needs normal code review/deploy before considering the production risk closed.

Warnings observed:
- `urllib3` LibreSSL warning from local Python.
- Qdrant client/server minor version mismatch warning: client `1.16.1`, server `1.14.1`.
