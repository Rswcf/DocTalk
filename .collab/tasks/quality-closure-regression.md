# DocTalk Quality Closure Regression Ledger

## Objective

Run a broad quality closure pass after the chat-native document intelligence
sequence. Do not add new product features. Find regressions, missing test
coverage, operational gaps, and fragile edge cases in existing flows; fix only
defects or test/observability gaps needed to make the current product reliable.

## Scope

### In Scope

- Release/version hygiene: `main`/`stable`, version files, changelogs, docs,
  migrations, deployment health.
- Backend correctness: parsing, document elements, retrieval, table scan/export,
  action planning, chat tool execution, artifacts, credits, billing gates,
  auth/ownership, sharing, cancellation, URL ingestion, storage, migrations.
- Frontend correctness: reader page, chat input, prompt chips, artifact cards,
  citation jump, PDF/text viewers, upload/import, billing/profile/auth surfaces,
  SEO/static route build behavior.
- Browser golden paths: document load, ordinary chat, summary routing, table
  export request, citation click, upload page, mobile viewport sanity.
- Failure behavior: missing keys, unavailable Azure, unavailable LLM key,
  failed jobs, quota/plan gates, malformed inputs, old documents without
  `document_elements`.
- Quality loop: create reproducible evidence, add regression tests when a bug is
  found, and record residual risks.

### Out of Scope

- New primary UI surfaces.
- Team, SSO, public API, new pricing packages, or new integrations.
- Large rewrites of RAG, parser, or billing. Only targeted fixes are allowed.

## Exit Criteria

- Clean worktree before release commit except intended QA/fix files.
- Version consistency check passes.
- Frontend lint/build pass or documented existing lint command limitation is
  fixed.
- Backend ruff passes.
- Backend parse tests and full non-integration suite pass.
- Migration upgrade path passes locally; integration migration test runs if local
  Docker/Postgres is available.
- Browser golden paths pass on current localhost desktop page and mobile viewport
  where tooling allows.
- Any discovered P0/P1/P2 defects are fixed with regression tests.
- Ledger records commands, results, fixes, and remaining risks.

## Test Matrix

### A. Release and Operational Hygiene

- [x] `git status --short --branch`
- [x] `python3 scripts/check_version_consistency.py`
- [x] Confirm Alembic single head.
- [x] `cd backend && python3 -m alembic upgrade head`
- [x] Verify `backend/entrypoint.sh` still runs migrations before server start.
- [x] Confirm `/version` and `/health` locally/prod after deploy if backend
  changes.
- [ ] Confirm `main` and `stable` are aligned after release.

### B. Backend Automated Regression

- [x] `cd backend && python3 -m ruff check app/ tests/`
- [x] `cd backend && python3 -m pytest tests/test_parse_service.py -v`
- [x] Focused document intelligence suite:
  - [x] `test_action_planner.py`
  - [x] `test_chat_tool_executor.py`
  - [x] `test_document_element_service.py`
  - [x] `test_element_aware_workflows.py`
  - [x] `test_document_intelligence.py`
  - [x] `test_retrieval_service_lexical.py`
  - [x] `test_extraction_service.py`
  - [x] `test_document_diff_service.py`
  - [x] `test_table_service.py`
  - [x] `test_chat_setup_refunds.py`
- [x] Full backend non-integration suite:
  - [x] `cd backend && python3 -m pytest -m 'not integration' -q`
- [x] Integration migration suite if Docker/Postgres is available:
  - [x] `cd backend && SKIP_INTEGRATION=0 python3 -m pytest tests/test_migrations.py -v -m integration`

### C. Frontend Automated Regression

- [x] `cd frontend && npm run lint`
- [x] `cd frontend && npm run build`
- [x] Inspect static/dynamic route output for accidental SEO regression on
  public pages.
- [x] Confirm reader route remains dynamic and public marketing routes remain
  static/SSG where expected.

### D. Browser Golden Paths

- [x] Current localhost reader loads without visible `Brief` / `Extract` tabs.
- [x] Header controls render without overlap.
- [x] PDF viewer renders or shows a readable loading/failure state.
- [x] Chat input is reachable and enabled.
- [x] Prompt chips send chat messages instead of navigating to hidden workspaces.
- [x] Ordinary local question returns streamed answer or readable LLM/config
  error without hanging.
- [x] Summary request routes through chat and does not create a separate
  workspace.
- [x] Table export request creates an artifact or gated readable message.
- [ ] Citation click scrolls/highlights in viewer when citations exist.
- [x] Mobile viewport: input bar, artifacts, citations, and PDF pane do not
  overlap or hide critical controls.
- [x] Upload page: file picker area and URL import show clear states and no
  stale generic errors on initial load.

### E. Edge Cases and Failure Modes

- [x] Old ready document with no `document_elements` falls back to chunks.
- [x] Table exists but no same-page chunk still returns table evidence with a
  safe chunk anchor.
- [x] Azure missing/unconfigured falls back to PyMuPDF without 500.
- [x] LLM key missing returns readable SSE error and refunds pre-debit.
- [x] Tool job failure returns failed artifact payload and does not leak
  internal stack traces.
- [x] Free user CSV/export gates use consistent CTA and do not expose unusable
  download URLs.
- [x] Cross-user document/job/template/diff access is rejected.
- [x] Shared answer public API does not expose bbox/chunk/document internals.
- [ ] URL import failures are actionable and do not leave dead loading states.

### F. Quality Loop Additions

- [x] Add targeted tests for any discovered defect.
- [x] Prefer deterministic fixtures over external network calls.
- [x] Record command outputs and defects in this ledger.
- [x] Keep fixes small and compatible with existing contracts.

## Execution Log

### 2026-05-09

- Started quality closure pass from `main` at `5dae4ec`.
- Browser context: user has `http://localhost:3000/d/c235ef93-c6e9-4ce4-ac8f-f119041a9609` open.
- Current objective: run complete QA pass, fix defects, then release only if
  code changes are made.
- Baseline verification before fixes:
  - `python3 scripts/check_version_consistency.py` passed: `0.17.0 beta`.
  - `cd backend && python3 -m ruff check app/ tests/` passed.
  - `cd backend && python3 -m pytest tests/test_parse_service.py -v` passed: 14 tests.
  - Focused document intelligence suite passed initially: 40 tests.
  - Full backend non-integration suite passed initially: 309 passed, 3 skipped.
  - `cd frontend && npm run build` passed; public marketing routes remained static/SSG and `/d/[documentId]` remained dynamic.
  - Alembic single head `20260509_0029`; `alembic upgrade head` passed.
  - Migration integration test passed against a temporary local Postgres DB.
- Browser defects found and fixed:
  - Missing i18n keys for chat-native suggested prompts produced console warnings. Added 11-locale keys and `frontend/scripts/check-chat-prompt-i18n.js`; wired it into `npm run lint`.
  - SSE `error` events were followed by synthetic `truncated`/`done` handling, causing a readable LLM error to show as a continuable empty response. Fixed terminal SSE error handling and replaced the optimistic blank assistant message with the error copy.
  - LLM unavailable copy was too vague (`The AI didn't respond`). Updated user-safe backend/frontend copy to explain temporary AI-provider unavailability and added a regression assertion in `test_chat_setup_refunds.py`.
  - Demo limit panel used fallback-only copy. Added 11-locale keys and extended the i18n check.
  - Landing proof strip used fallback-only copy and emitted homepage i18n warnings. Added 11-locale keys and extended the i18n check.
  - Remotion player emitted a homepage console warning. Added `acknowledgeRemotionLicense`.
  - Empty/suggested-question state showed the scroll-to-bottom button on mobile, overlapping prompts. Restricted the floating scroll control to message threads.
  - `twitter-image.tsx` re-exported `runtime`, causing a Next.js build warning. Switched to a literal `export const runtime = 'edge'`.
- Browser evidence:
  - In-app browser reader reload: no visible `Brief` / `Extract` tabs, prompt chips present, no i18n warnings.
  - Anonymous ordinary chat with missing local `DEEPSEEK_API_KEY`: readable provider-unavailable message, no HTTP 500, no `Continue generating`.
  - Anonymous table-export intent: readable sign-in gating message, no HTTP 500, no unusable download URL.
  - Homepage initial load: upload surface visible, no generic error, no console warnings after fixes.
  - Mobile screenshots captured with Playwright Chrome channel:
    - `/tmp/doctalk-home-mobile.png`
    - `/tmp/doctalk-reader-mobile-fixed.png`
- Final verification after fixes:
  - `python3 scripts/check_version_consistency.py` passed.
  - `cd backend && python3 -m ruff check app/ tests/` passed.
  - Focused suite with chat setup refunds passed: 48 tests.
  - `cd backend && python3 -m pytest tests/test_parse_service.py -v` passed: 14 tests.
  - `cd backend && python3 -m pytest -m 'not integration' -q` passed: 309 passed, 3 skipped, 4 deselected.
  - `cd backend && python3 -m alembic heads && python3 -m alembic upgrade head` passed.
  - `DATABASE_URL=...doctalk_migration_test SKIP_INTEGRATION=0 python3 -m pytest tests/test_migrations.py -v -m integration` passed: 1 test.
  - `cd frontend && npm run lint` passed, including chat/home/demo i18n key check.
  - `cd frontend && npm run build` passed. Remaining build notes are existing environment/deprecation notes: Sentry filename deprecation, missing local `RESEND_API_KEY`, and edge-runtime static-generation limitation for image routes.

## Residual Risks

- Citation click was not revalidated in browser because local `DEEPSEEK_API_KEY`
  is intentionally absent, so no fresh cited answer can be generated locally.
  Existing citation parsing/jump behavior remains covered by backend/frontend
  code paths and prior browser checks, but a live provider key is needed for
  full end-to-end citation replay.
- URL import failure behavior was not re-tested deeply in this pass because the
  request focused on no new features and the browser smoke check only verified
  a clean initial upload/home state. It remains a recommended next focused QA
  target.
