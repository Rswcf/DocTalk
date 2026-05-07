# DocTalk RAG Workbench Execution Ledger

Started: 2026-05-07
Owner: Codex

## Guardrails

- Preserve existing unrelated dirty worktree files.
- Implement one phase at a time.
- Add tests before claiming a phase is complete.
- Do not stage broad paths or use `git add .`.
- Push `main`, merge to `stable`, push `stable`, then deploy backend from `stable` when backend code changes.

## Phase Status

| Phase | Version | Scope | Status | Commit | Verification |
| --- | --- | --- | --- | --- | --- |
| M0 | 0.8.0 beta | RAG execution ledger and golden routing tests | Shipped | `f1a5141` | Version check, lint, backend tests, frontend build, production health/version passed |
| M1 | 0.8.0 beta | Query intent router and whole-document summary chat path | Shipped | `f1a5141` | Version check, lint, backend tests, frontend build, production health/version passed |
| M2 | 0.9.0 beta | Hierarchical document brief | Pending | Pending | Pending |
| M3 | 0.10.0 beta | Retrieval evaluator and corrective RAG | Pending | Pending | Pending |
| M4 | 0.11.0 beta | Parser integrity fixes | Pending | Pending | Pending |
| M5 | 0.12.0 beta | Table-aware RAG | Pending | Pending | Pending |
| M6 | 0.13.0 beta | Query planner, multi-hop, compare | Pending | Pending | Pending |
| M7 | 0.14.0 beta | Claim verifier and evaluation dashboard | Pending | Pending | Pending |

## M0 / M1 Checklist

- [x] Add structured query router with multi-label-ready schema.
- [x] Add whole-document summary context selection that does not use semantic top-k.
- [x] Route whole-document summary requests away from ordinary retrieval in chat.
- [x] Add routing golden tests for English, Chinese, Japanese, Spanish, and German summary forms.
- [x] Extend summary routing golden tests to all 11 supported locales.
- [x] Route collection summaries to capped per-document representative context.
- [x] Increase summary pre-debit estimate to reduce route-specific undercharge exposure.
- [x] Add representative context selection tests.
- [x] Add chat integration regression proving summary intent does not call `retrieval_service.search`.
- [x] Run version consistency, backend lint, backend tests, and frontend build.
- [x] Commit and push `main`.
- [x] Merge and push `stable`.
- [x] Deploy Railway from `stable` and verify production `/health` + `/version`.

## M0 / M1 Verification Log

- 2026-05-07: `python3 scripts/check_version_consistency.py` passed.
- 2026-05-07: `cd backend && python3 -m ruff check app/ tests/` passed.
- 2026-05-07: `cd backend && python3 -m pytest tests/test_parse_service.py tests/test_query_router.py tests/test_document_brief_service.py tests/test_chat_summary_routing.py -v` passed with 29 passed.
- 2026-05-07: `cd backend && python3 -m pytest tests/ -m 'not integration' -v` passed with 221 passed, 3 skipped, 4 deselected.
- 2026-05-07: `cd frontend && npm run build` passed.
- 2026-05-07: Adversarial review fixed missing pt/it/ar/hi summary locale routing, collection summary semantic top-k fallback, and summary under-predebit exposure.

## M0 / M1 Release Log

- Commit: `f1a5141` (`feat(rag): route summaries to representative context`)
- Pushed: `origin/main`, `origin/stable`
- Tag: `v0.8.0-beta`
- Railway deployment: `78ae3d2f-ffa1-410c-93a3-6463468f3653` (`SUCCESS`)
- Production `/health`: `{"status":"ok","release":{"version":"0.8.0","stage":"beta","build":null}}`
- Production `/version`: `{"version":"0.8.0","stage":"beta","build":null}`
