# BUG-2026-05-11-URL-SHORT-CHUNK-RAG-NO-CITATION

Status: **fixed and retested locally**

## Summary

Live RAG over an imported short URL document failed to retrieve any context. `https://example.com/` imported successfully, reached `ready`, and had indexed chunks, but chat returned the generic fallback:

```text
I can only answer questions about the provided document(s). Would you like to ask about its content?
```

No citation events were emitted.

## Severity

P1 for URL/TXT/short-document chat trust.

Short web pages are a normal user input. A ready URL document with indexed text should answer and cite its own content, even when the whole page is shorter than the normal long-document chunk floor.

## Evidence

Failing runs:

- `.collab/tasks/qa-live-chat-rag-local-url-deepseek-2026-05-11.json`
- `.collab/tasks/qa-live-chat-rag-local-url-deepseek-keep-2026-05-11.json`

Observed in the kept failing fixture:

- Document: `Example Domain`
- Status: `ready`
- `file_type: url`
- `chunks_total: 1`
- `chunks_indexed: 1`
- Chunk text: `This domain is for use in documentation examples...`
- Chat answer chars: `100`
- Citations: `0`

## Root Cause

`retrieval_service.search()` and `lexical_search()` filtered out chunks shorter than `_MIN_CHUNK_TEXT_LEN = 200`. The imported URL had a legitimate short chunk below that floor, so retrieval returned no fragments and chat received `(none)` as document context.

## Fix

`backend/app/services/retrieval_service.py` now keeps the normal 200-character floor first, but if every candidate is filtered out it backfills short but non-empty chunks with a smaller 20-character floor. Lexical search uses the same fallback when the initial long-floor query returns no rows.

This preserves the anti-noise behavior for ordinary long documents while making short URL/TXT/MD-style documents answerable.

## Regression Coverage

Added tests in `backend/tests/test_retrieval_service_lexical.py`:

- `test_lexical_search_backfills_short_document_chunks_when_long_floor_empty`
- `test_semantic_search_backfills_short_chunks_when_all_hits_filtered`

Commands:

```bash
cd backend && python3 -m pytest tests/test_retrieval_service_lexical.py tests/test_search_api.py -v
cd backend && python3 -m ruff check app/services/retrieval_service.py tests/test_retrieval_service_lexical.py tests/test_search_api.py
python3 .collab/scripts/qa_live_chat_rag_matrix.py \
  --api-base http://127.0.0.1:8000 \
  --source url \
  --url https://example.com/ \
  --message 'According to this document, what is Example Domain used for? Cite the source.' \
  --mode quick \
  --locale en \
  --timeout 180 \
  --poll-interval 2 \
  --expect-term example \
  --json-out .collab/tasks/qa-live-chat-rag-local-url-deepseek-after-short-chunk-fix-2026-05-11.json
```

Results:

- Retrieval/search tests: `13 passed`
- Ruff: pass
- URL live RAG retest: pass, quality score `1.0`, answer chars `164`, citations `3`, verifier score `1.0`

