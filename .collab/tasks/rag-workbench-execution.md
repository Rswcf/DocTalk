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
| M2 | 0.9.0 beta | Hierarchical document brief | Shipped | `42c40da` | Full gate and production health/version passed |
| M3 | 0.10.0 beta | Retrieval evaluator and corrective RAG | Shipped | `30e7c05` | Full gate and production health/version passed |
| M4 | 0.11.0 beta | Parser integrity fixes | Shipped | `7436c2a` | Full gate and production health/version passed |
| M5 | 0.12.0 beta | Table-aware RAG | Shipped | `ac4ee84` | Full gate and production health/version passed |
| M6 | 0.13.0 beta | Query planner, multi-hop, compare | Ready for release | Pending | Full gate passed |
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

## M2 Checklist

- [x] Add `document_briefs` migration and SQLAlchemy model.
- [x] Generate hierarchical briefs from representative chunks on the Celery `default` queue.
- [x] Mirror brief summary/questions into legacy `documents.summary` and `documents.suggested_questions`.
- [x] Make summary routing prefer persisted brief coverage before fallback representative selection.
- [x] Add document brief API with document access masking and citation hydration.
- [x] Add document-reader `Brief` workspace with cited summary, outline, key points, facts, and questions.
- [x] Add i18n keys across all 11 locales.
- [x] Add targeted backend tests for generation, failure isolation, routing context, worker dispatch, and API hydration.
- [x] Run full release verification gate.
- [x] Commit, push `main`, merge/push `stable`, tag, deploy, and verify production.

## M2 Verification Log

- 2026-05-07: `cd backend && python3 -m ruff check app/models app/services/summary_service.py app/services/document_brief_service.py app/workers/parse_worker.py app/workers/brief_worker.py app/api/documents.py app/schemas/document.py tests/test_document_brief_generation.py tests/test_document_brief_service.py tests/test_parse_worker_bridge.py tests/test_document_briefs_api.py` passed.
- 2026-05-07: `cd backend && python3 -m pytest tests/test_document_brief_generation.py tests/test_document_brief_service.py tests/test_parse_worker_bridge.py tests/test_document_briefs_api.py -v` passed with 19 passed.
- 2026-05-07: Adversarial review fixed three issues before release: invalid LLM refs no longer invent fallback citations, stale reparse chunks cannot be committed after a slow brief generation call, and ready-but-empty brief polling is bounded.
- 2026-05-07: `python3 scripts/check_version_consistency.py` passed for `0.9.0 beta`.
- 2026-05-07: `cd frontend && npm run build` passed after the version bump.
- 2026-05-07: `cd backend && python3 -m ruff check app/ tests/` passed.
- 2026-05-07: `cd backend && python3 -m pytest tests/ -m 'not integration' -v` passed with 233 passed, 3 skipped, 4 deselected.
- 2026-05-07: `cd backend && python3 -m pytest -m integration -v` ran; 4 integration tests skipped by local environment configuration.
- 2026-05-07: `cd backend && python3 -m alembic heads && python3 -m alembic upgrade head` passed with `20260507_0026 (head)`.
- 2026-05-07: Browser smoke passed for desktop and mobile on local production Next server with mocked APIs: Brief tab renders, citation click jumps/highlights source text, and no horizontal overflow was detected.

## M2 Release Log

- Commit: `42c40da` (`feat(brief): add hierarchical document briefs`)
- Pushed: `origin/main`, `origin/stable`
- Tag: `v0.9.0-beta`
- Railway deployment: `b11bcfca-d44c-4221-a3d0-86f8c82fb41b` (`SUCCESS`)
- Production `/health`: `{"status":"ok","release":{"version":"0.9.0","stage":"beta","build":null}}`
- Production `/version`: `{"version":"0.9.0","stage":"beta","build":null}`

## M3 Checklist

- [x] Add retrieval evaluator for empty/weak evidence, exact-term misses, low vector scores, and exhaustive undercoverage.
- [x] Add scoped lexical fallback for single-document and collection retrieval.
- [x] Add corrective retrieval wrapper that merges vector and lexical evidence without duplicate chunks.
- [x] Route ordinary non-summary chat through corrective retrieval while preserving summary brief context routing.
- [x] Inject retrieval quality guidance into non-summary chat prompts.
- [x] Add targeted evaluator, corrective retrieval, chat prompt, refund, and summary-isolation tests.
- [x] Run full release verification gate.
- [x] Commit, push `main`, merge/push `stable`, tag, deploy, and verify production.

## M3 Verification Log

- 2026-05-07: `cd backend && python3 -m ruff check app/services/rag_evaluator_service.py app/services/corrective_retrieval_service.py app/services/retrieval_service.py app/services/chat_service.py tests/test_rag_evaluator_service.py tests/test_corrective_retrieval_service.py tests/test_chat_corrective_retrieval.py tests/test_chat_setup_refunds.py tests/test_chat_summary_routing.py` passed.
- 2026-05-07: `cd backend && python3 -m pytest tests/test_rag_evaluator_service.py tests/test_corrective_retrieval_service.py tests/test_chat_corrective_retrieval.py tests/test_chat_setup_refunds.py tests/test_chat_summary_routing.py -v` passed with 16 passed.
- 2026-05-07: Adversarial review found lexical fallback SQL pre-limit could miss late exact hits and raw missing query terms were echoed into the system prompt; fixed weighted SQL ordering before limit, removed raw term echo, and added regression tests.
- 2026-05-07: `python3 scripts/check_version_consistency.py` passed for `0.10.0 beta`.
- 2026-05-07: `cd frontend && npm run build` passed.
- 2026-05-07: `cd backend && python3 -m ruff check app/ tests/` passed.
- 2026-05-07: `cd backend && python3 -m pytest tests/test_parse_service.py -v` passed with 7 passed.
- 2026-05-07: `cd backend && python3 -m pytest tests/ -m 'not integration' -v` passed with 246 passed, 3 skipped, 4 deselected.
- 2026-05-07: `cd backend && python3 -m pytest -m integration -v` ran; 4 integration tests skipped by local environment configuration.
- 2026-05-07: `cd backend && python3 -m alembic heads && python3 -m alembic upgrade head` passed with `20260507_0026 (head)`.

## M3 Release Log

- Commit: `30e7c05` (`feat(rag): add corrective retrieval evaluator`)
- Pushed: `origin/main`, `origin/stable`
- Tag: `v0.10.0-beta`
- Railway deployment: `385509f1-7a2e-4b52-8881-16e2313a8a80` (`SUCCESS`)
- Production `/health`: `{"status":"ok","release":{"version":"0.10.0","stage":"beta","build":null}}`
- Production `/version`: `{"version":"0.10.0","stage":"beta","build":null}`

## M4 Checklist

- [x] Improve parser reading order for simple two-column PDF layouts before chunking.
- [x] Preserve English word boundaries when joining text blocks and sentences.
- [x] Keep concise documents searchable when all generated chunks are below the micro-chunk threshold.
- [x] Add parser integrity regression tests for two-column ordering and block joining.
- [x] Run full release verification gate.
- [x] Commit, push `main`, merge/push `stable`, tag, deploy, and verify production.

## M4 Verification Log

- 2026-05-07: `cd backend && python3 -m ruff check app/services/parse_service.py tests/test_parse_service.py` passed.
- 2026-05-07: `cd backend && python3 -m pytest tests/test_parse_service.py -v` passed with 9 passed.
- 2026-05-07: Adversarial review found mid-page full-width blocks could be
  moved to the page tail and normal-font Title Case body lines could be dropped
  as headings; fixed segmented two-column ordering, constrained fallback
  heading detection to uppercase labels, and expanded parser integrity tests to
  13 passed.
- 2026-05-07: Follow-up adversarial review found overlapping column blocks
  whose `y0` fell inside a full-width block could be dropped; fixed the band cut
  to advance from the full-width block top and added a regression row.
- 2026-05-07: Final adversarial review found no release blockers.
- 2026-05-07: `python3 scripts/check_version_consistency.py` passed for `0.11.0 beta`.
- 2026-05-07: `cd frontend && npm run build` passed.
- 2026-05-07: `cd backend && python3 -m ruff check app/ tests/` passed.
- 2026-05-07: `cd backend && python3 -m pytest tests/test_parse_service.py -v` passed with 13 passed.
- 2026-05-07: `cd backend && python3 -m pytest tests/ -m 'not integration' -v` passed with 252 passed, 3 skipped, 4 deselected.
- 2026-05-07: `cd backend && python3 -m pytest -m integration -v` ran; 4 integration tests skipped by local environment configuration.
- 2026-05-07: `cd backend && python3 -m alembic heads && python3 -m alembic upgrade head` passed with `20260507_0026 (head)`.

## M4 Release Log

- Commit: `7436c2a` (`fix(parse): improve parser reading order integrity`)
- Pushed: `origin/main`, `origin/stable`
- Tag: `v0.11.0-beta`
- Railway deployment: `3fec3586-5e42-4786-a8ec-738549a9198c` (`SUCCESS`)
- Production `/health`: `{"status":"ok","release":{"version":"0.11.0","stage":"beta","build":null}}`
- Production `/version`: `{"version":"0.11.0","stage":"beta","build":null}`

## M5 Checklist

- [x] Add scanned-table evidence retrieval for table/numeric questions.
- [x] Merge table evidence into corrective retrieval before ordinary vector/lexical fragments.
- [x] Lower lexical chunk-length filtering for table queries so short table rows remain eligible.
- [x] Expand router coverage for finance-style metric questions without misrouting plain page-number lookups.
- [x] Add table-specific retrieval guidance for numeric precision.
- [x] Add targeted tests for table evidence, table-first correction, router edge cases, and prompt guidance.
- [x] Run full release verification gate.
- [x] Commit, push `main`, merge/push `stable`, tag, deploy, and verify production.

## M5 Verification Log

- 2026-05-07: `cd backend && python3 -m ruff check app/services/retrieval_service.py app/services/corrective_retrieval_service.py app/services/rag_evaluator_service.py app/services/query_router.py app/services/chat_service.py tests/test_retrieval_service_lexical.py tests/test_corrective_retrieval_service.py tests/test_query_router.py tests/test_rag_evaluator_service.py tests/test_chat_corrective_retrieval.py` passed.
- 2026-05-07: `cd backend && python3 -m pytest tests/test_retrieval_service_lexical.py tests/test_corrective_retrieval_service.py tests/test_query_router.py tests/test_rag_evaluator_service.py tests/test_chat_corrective_retrieval.py -v` passed with 40 passed.
- 2026-05-07: Adversarial review found no release blockers after fixes for durable table citations, same-page representative chunks, markdown-safe table cells, and bounded collection table chunk lookup.
- 2026-05-07: `python3 scripts/check_version_consistency.py` passed for `0.12.0 beta`.
- 2026-05-07: `cd frontend && npm run build` passed with only existing Sentry, metadata, edge-runtime, and unset `RESEND_API_KEY` warnings.
- 2026-05-07: `cd backend && python3 -m ruff check app/ tests/` passed.
- 2026-05-07: `cd backend && python3 -m pytest tests/test_parse_service.py -v` passed with 13 passed.
- 2026-05-07: `cd backend && python3 -m pytest tests/ -m 'not integration' -v` passed with 264 passed, 3 skipped, 4 deselected.
- 2026-05-07: `cd backend && python3 -m pytest -m integration -v` ran; 4 integration tests skipped by local environment configuration.
- 2026-05-07: `cd backend && python3 -m alembic heads && python3 -m alembic upgrade head` passed with `20260507_0026 (head)`.

## M5 Release Log

- Commit: `ac4ee84` (`feat(rag): add table-aware retrieval`)
- Pushed: `origin/main`, `origin/stable`
- Tag: `v0.12.0-beta`
- Railway deployment: `6249f1bb-9f1c-4d7c-8fc9-711d92f9fdd6` (`SUCCESS`)
- Production `/health`: `{"status":"ok","release":{"version":"0.12.0","stage":"beta","build":null}}`
- Production `/version`: `{"version":"0.12.0","stage":"beta","build":null}`

## M6 Checklist

- [x] Add deterministic query planner for comparison, multi-hop, exhaustive, and multi-entity metric questions.
- [x] Add planned single-document corrective retrieval that supplements ordinary vector search with controlled subquery evidence.
- [x] Add collection comparison retrieval with balanced per-document evidence coverage.
- [x] Add query-plan prompt contract without echoing raw planned queries into the system prompt.
- [x] Add targeted tests for planner decisions, planned retrieval, balanced comparison coverage, and prompt safety.
- [x] Run full release verification gate.
- [ ] Commit, push `main`, merge/push `stable`, tag, deploy, and verify production.

## M6 Verification Log

- 2026-05-07: `cd backend && python3 -m ruff check app/services/query_planner_service.py app/services/corrective_retrieval_service.py app/services/chat_service.py tests/test_query_planner_service.py tests/test_corrective_retrieval_service.py tests/test_chat_corrective_retrieval.py` passed.
- 2026-05-07: `cd backend && python3 -m pytest tests/test_query_planner_service.py tests/test_corrective_retrieval_service.py tests/test_chat_corrective_retrieval.py -v` passed with 16 passed.
- 2026-05-07: Adversarial review found two collection-comparison release blockers before release: balanced comparison could drop the last compared document under the result cap, and balanced extras could starve table evidence in table/numeric collection comparisons. Fixed by preserving required per-document coverage first, merging table evidence before balanced extras, and adding 8-document regression coverage. Follow-up adversarial review found no release blockers.
- 2026-05-07: `python3 scripts/check_version_consistency.py` passed for `0.13.0 beta`.
- 2026-05-07: `cd frontend && npm run build` passed with only existing Sentry, metadata, edge-runtime, and unset `RESEND_API_KEY` warnings.
- 2026-05-07: `cd backend && python3 -m ruff check app/ tests/` passed.
- 2026-05-07: `cd backend && python3 -m pytest tests/test_parse_service.py -v` passed with 13 passed.
- 2026-05-07: `cd backend && python3 -m pytest tests/ -m 'not integration' -v` passed with 272 passed, 3 skipped, 4 deselected.
- 2026-05-07: `cd backend && python3 -m pytest -m integration -v` ran; 4 integration tests skipped by local environment configuration.
- 2026-05-07: `cd backend && python3 -m alembic heads && python3 -m alembic upgrade head` passed with `20260507_0026 (head)`.
