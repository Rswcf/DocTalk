REQUEST_CHANGES

## Must-fix findings

1. `CustomInstructionsModal` now uses `errorCopy()`, but the API helper still throws raw `Error`, so taxonomy codes are lost on this surface.
- Evidence:
[api.ts](/Users/mayijie/Projects/Code/010_DocTalk/frontend/src/lib/api.ts:259) throws `new Error(...)` in `updateDocumentInstructions` instead of `ApiError`.
[CustomInstructionsModal.tsx](/Users/mayijie/Projects/Code/010_DocTalk/frontend/src/components/CustomInstructionsModal.tsx:81) and [CustomInstructionsModal.tsx](/Users/mayijie/Projects/Code/010_DocTalk/frontend/src/components/CustomInstructionsModal.tsx:98) pass caught errors to `errorCopy()`.
[errorCopy.ts](/Users/mayijie/Projects/Code/010_DocTalk/frontend/src/lib/errorCopy.ts:36) only reads `code/status/detail`, so raw `Error.message` paths fall to `NETWORK` copy.
- Required diff:
Change `updateDocumentInstructions()` to parse error JSON and throw `ApiError` (same pattern as `handle()` / `exportSession()`), so `CUSTOM_INSTRUCTIONS_REQUIRE_PRO` and `INSTRUCTIONS_TOO_LONG` map correctly.

2. Billing back-compat is only partially preserved; the current regex does not match structured `detail` objects.
- Evidence:
[BillingPageClient.tsx](/Users/mayijie/Projects/Code/010_DocTalk/frontend/src/app/billing/BillingPageClient.tsx:163) uses `"detail"\s*:\s*"([^"]+)"`, which only matches string `detail`, not `{"detail":{"error":"...","message":"..."}}`.
`ApiError.message` is correctly preserved as raw JSON in [api.ts](/Users/mayijie/Projects/Code/010_DocTalk/frontend/src/lib/api.ts:31), but object-shaped `detail` still bypasses this regex and falls to generic billing error.
- Required diff:
In `getBillingErrorMessage`, first handle `ApiError.detail` object (`detail.message` / `detail.error`) before regex fallback; keep regex for legacy string-detail payloads.

3. Test parity still misses parts of the committed plan coverage.
- Evidence:
No tests for SSE `MODE_NOT_ALLOWED` / `PERSIST_FAILED`, no 404 masking equality test, and no search/chunks 429 tests in [test_error_taxonomy.py](/Users/mayijie/Projects/Code/010_DocTalk/backend/tests/test_error_taxonomy.py).
- Required diff:
Add targeted tests in `backend/tests/test_error_taxonomy.py` for:
`MODE_NOT_ALLOWED` SSE emission path, existing-vs-unauthorized 404 body equality, `search.py` 429, `chunks.py` 429.

## Checklist outcome

1. Aggregate diff vs plan (§2/§5): no inventory row remains as raw-string `HTTPException` in the migrated files (`documents/chat/collections/export/sharing/search/chunks/users`).
2. Security invariants: held.
- SSRF reason collapse is enforced at [documents.py](/Users/mayijie/Projects/Code/010_DocTalk/backend/app/api/documents.py:308) and [documents.py](/Users/mayijie/Projects/Code/010_DocTalk/backend/app/api/documents.py:352); no `reason` field on wire.
- Unknown `ValueError` routes to 500 `SERVER_ERROR` in upload/ingest/export fallthrough paths; `VERY_SECRET_DETAIL` non-leak assertion exists at [test_error_taxonomy.py](/Users/mayijie/Projects/Code/010_DocTalk/backend/tests/test_error_taxonomy.py:854).
- 404 masking is consistent across existence/auth branches in requested routers.
- `ExportError` no longer leaks `str(e)` (see [export.py](/Users/mayijie/Projects/Code/010_DocTalk/backend/app/api/export.py:157)).
3. Back-compat:
- `ApiError.message` contract is preserved.
- `useChatStream` still retains `Rate limit exceeded` fallback and backend still emits that literal.
- Billing regex object-shape compatibility is the open gap (finding #2).
4. SSE pre-stream path: held in both `chatStream` and `continueStream`; non-JSON fallback keeps `code='http_error'`.
5. Worker bridge: held.
- Idempotency test exists at [test_parse_worker_bridge.py](/Users/mayijie/Projects/Code/010_DocTalk/backend/tests/test_parse_worker_bridge.py:58).
- `doc.status = "error"` appears only in helper.
- `_set_timeout_error` uses `_set_doc_error`.
6. Frontend consumer surface checks requested in prompt: all pass as written (including zero `window.alert(` and inline modal error).
7. i18n coverage script result: `Missing keys in en.json: none`.
8. Scope creep in Phase 5 (`ChatPanel` share-success alert -> inline assistant message): **ACCEPT** (non-breaking UX change), but it is out-of-plan and should be explicitly called out in PR description.
