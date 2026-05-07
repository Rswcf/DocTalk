# DocTalk Document Workbench Execution Ledger

This ledger is the control surface for the document-workbench buildout. Each
feature must complete the same loop before the next one starts: implement,
test, document, version, commit, push `main`, merge/push `stable`, deploy
backend changes from `stable`, and record the outcome here.

## Execution Rules

- Never stage unrelated dirty worktree files.
- Every feature owns a version bump and changelog entry.
- Backend changes require Railway deploy from `stable` and `/health` +
  `/version` verification.
- Code/test/build failures are not blockers; they are work items to fix.
- External outages, missing secrets, or remote Git/deploy unavailability are the
  only valid reasons to pause.

## Feature Queue

| Order | Version | Feature | Status | Commit | Main Push | Stable Push | Deploy |
|---|---:|---|---|---|---|---|---|
| M1 | 0.3.0 | Structured Extraction | Deployed | `5ac4d83` | Done | Done | Railway `0.3.0 beta` |
| M2 | 0.4.0 | Table Extraction | Deployed | `a945117` | Done | Done | Railway `0.4.0 beta` |
| M3 | 0.5.0 | Deep Link Answer Share | Deployed | `3e6cd9f` | Done | Done | Railway `0.5.0 beta` |
| M4 | 0.6.0 | Question Templates | Deployed | `5906545` | Done | Done | Railway `0.6.0 beta` |
| M5 | 0.7.0 | Document Diff | Deployed | `7a326b8` | Done | Done | Railway `0.7.0 beta` |

## Current Cycle: M1 Structured Extraction

- Started: 2026-05-07
- Branch: `main`
- Commit: `5ac4d83`
- Tag: `v0.3.0-beta`
- Push: `origin main` and `origin stable` complete
- Deploy: Railway deploy accepted; production `/health` and `/version` return `0.3.0 beta`
- Scope: version hygiene, document job foundation, extraction results,
  extraction worker/API, document-reader Extract workspace, tests and docs.
- Required verification:
  - `python3 scripts/check_version_consistency.py`
  - `cd frontend && npm run build`
  - `cd backend && python3 -m ruff check app/ tests/`
  - `cd backend && python3 -m pytest tests/test_parse_service.py -v`
  - M1 extraction-specific tests

### M1 Verification Log

- `python3 scripts/check_version_consistency.py` — PASS (`0.3.0 beta`)
- `cd frontend && npm run build` — PASS
- `cd backend && python3 -m ruff check app/ tests/` — PASS
- `cd backend && python3 -m pytest tests/test_parse_service.py tests/test_extractions_api.py tests/test_extraction_service.py tests/test_smoke.py tests/test_versioning.py -v` — PASS (`23 passed, 1 skipped`; integration lifecycle skipped by default)
- `cd backend && python3 -m pytest tests/test_error_taxonomy.py tests/test_billing_cancel.py tests/test_credit_reconcile.py -v` — PASS (`67 passed`)
- `cd backend && python3 -m alembic heads` — PASS (`20260507_0023`)
- `cd backend && python3 -m alembic upgrade head` — PASS against local `localhost/doctalk`
- `cd backend && python3 -m alembic check` — FAIL due pre-existing model/schema drift on older indexes and nullable timestamps, not from `document_jobs` / `extraction_results`
- Browser smoke: local `/demo/alphabet-earnings` renders anonymous chat path and does not expose Extract to logged-out users; full logged-in upload → extract → citation → export requires auth/worker/LLM environment and remains a production smoke item after deploy.

## Current Cycle: M2 Table Extraction

- Started: 2026-05-07
- Branch: `main`
- Commit: `a945117`
- Tag: `v0.4.0-beta`
- Push: `origin main` and `origin stable` complete
- Deploy: Railway deploy accepted; production `/health` and `/version` return `0.4.0 beta`
- Scope: version hygiene, `document_tables`, `table_scan` jobs, table scan/list/export API,
  Celery table worker, Extract workspace Tables view, tests and docs.
- Required verification:
  - `python3 scripts/check_version_consistency.py`
  - `cd frontend && npm run build`
  - `cd backend && python3 -m ruff check app/ tests/`
  - `cd backend && python3 -m pytest tests/test_parse_service.py -v`
  - M2 table-specific tests

### M2 Verification Log

- `python3 scripts/check_version_consistency.py` — PASS (`0.4.0 beta`)
- `cd frontend && npm run build` — PASS
- `cd backend && python3 -m ruff check app/ tests/` — PASS
- `cd backend && python3 -m pytest tests/test_parse_service.py tests/test_table_service.py tests/test_tables_api.py tests/test_extraction_service.py tests/test_extractions_api.py tests/test_smoke.py tests/test_versioning.py -v` — PASS (`30 passed, 1 skipped`; integration lifecycle skipped by default)
- `cd backend && python3 -m alembic heads` — PASS (`20260507_0024`)
- `cd backend && python3 -m alembic upgrade head` — PASS against local `localhost/doctalk`
- `railway up --detach` from `stable` — PASS
- `curl https://backend-production-a62e.up.railway.app/health` — PASS (`0.4.0 beta`)
- `curl https://backend-production-a62e.up.railway.app/version` — PASS (`0.4.0 beta`)

## Current Cycle: M3 Deep Link Answer Share

- Started: 2026-05-07
- Branch: `main`
- Commit: `3e6cd9f`
- Tag: `v0.5.0-beta`
- Push: `origin main` and `origin stable` complete
- Deploy: Railway deploy accepted; production `/health` and `/version` return `0.5.0 beta`
- Scope: version hygiene, safe message share anchors, per-answer share action,
  public share anchor scrolling/highlight, redaction tests, docs and i18n.
- Required verification:
  - `python3 scripts/check_version_consistency.py`
  - `cd frontend && npm run build`
  - `cd backend && python3 -m ruff check app/ tests/`
  - `cd backend && python3 -m pytest tests/test_parse_service.py -v`
  - M3 sharing-specific tests

### M3 Verification Log

- `python3 scripts/check_version_consistency.py` — PASS (`0.5.0 beta`)
- `cd frontend && npm run build` — PASS
- `cd backend && python3 -m ruff check app/ tests/` — PASS
- `cd backend && python3 -m pytest tests/test_parse_service.py tests/test_sharing_api.py tests/test_share_anchor_service.py tests/test_smoke.py tests/test_versioning.py -v` — PASS (`18 passed, 1 skipped`)
- `cd backend && python3 -m pytest tests/test_error_taxonomy.py tests/test_extractions_api.py tests/test_extraction_service.py tests/test_tables_api.py tests/test_table_service.py -v` — PASS (`62 passed`)
- `cd backend && python3 -m alembic heads` — PASS (`20260507_0024`)
- Browser smoke: production Next server on `127.0.0.1:3100` with a mock shared-session backend rendered `/shared/{token}#msg-1234567890ab4def`; target answer was highlighted, non-target answer was not, and the page showed only safe citation snippets/page/filename. Local Auth.js logged `UntrustedHost` for `localhost:3100` session polling during this smoke, but the shared page render and anchor behavior were unaffected.
- `railway up --detach` from `stable` — PASS
- `curl https://backend-production-a62e.up.railway.app/health` — PASS (`0.5.0 beta`)
- `curl https://backend-production-a62e.up.railway.app/version` — PASS (`0.5.0 beta`)

## Current Cycle: M4 Question Templates

- Started: 2026-05-07
- Branch: `main`
- Commit: `5906545`
- Tag: `v0.6.0-beta`
- Push: `origin main` and `origin stable` complete
- Deploy: Railway deploy accepted; production `/health` and `/version` return `0.6.0 beta`
- Scope: version hygiene, `question_templates`, `batch_template` jobs,
  question-template worker/API, document-reader Templates tab, Collection
  Templates workspace, cited answer matrix, Markdown/CSV export, tests, i18n
  and docs.
- Required verification:
  - `python3 scripts/check_version_consistency.py`
  - `cd frontend && npm run build`
  - `cd backend && python3 -m ruff check app/ tests/`
  - `cd backend && python3 -m pytest tests/test_parse_service.py -v`
  - M4 question-template-specific tests

### M4 Verification Log

- `python3 scripts/check_version_consistency.py` — PASS (`0.6.0 beta`)
- `cd frontend && npm run build` — PASS
- `cd backend && python3 -m ruff check app/ tests/` — PASS
- `cd backend && python3 -m pytest tests/test_parse_service.py tests/test_question_templates_api.py tests/test_question_template_service.py -v` — PASS (`17 passed`)
- `cd backend && python3 -m pytest tests/test_extractions_api.py tests/test_extraction_service.py tests/test_tables_api.py tests/test_table_service.py tests/test_sharing_api.py tests/test_share_anchor_service.py tests/test_smoke.py tests/test_versioning.py -v` — PASS (`27 passed, 1 skipped`)
- `cd backend && python3 -m pytest tests/test_error_taxonomy.py tests/test_billing_cancel.py tests/test_credit_reconcile.py -v` — PASS (`67 passed`)
- `cd backend && python3 -m alembic heads` — PASS (`20260507_0025`)
- `cd backend && python3 -m alembic upgrade head` — PASS against local `localhost/doctalk`
- Browser smoke: local production Next server on `127.0.0.1:3100` with mocked
  authenticated API responses rendered `/d/mock-doc`, navigated
  `Extract → Templates`, displayed a saved template and cited answer matrix,
  and passed desktop/mobile screenshots. A mobile overflow issue and a
  split-pane desktop layout squeeze were found and fixed before this PASS.
- `railway up --detach` from `stable` — PASS
- `curl https://backend-production-a62e.up.railway.app/health` — PASS (`0.6.0 beta`)
- `curl https://backend-production-a62e.up.railway.app/version` — PASS (`0.6.0 beta`)

## Current Cycle: M5 Document Diff

- Started: 2026-05-07
- Branch: `main`
- Commit: `7a326b8`
- Tag: `v0.7.0-beta`
- Push: `origin main` and `origin stable` complete
- Deploy: Railway deploy accepted; production `/health` and `/version` return `0.7.0 beta`
- Scope: version hygiene, Pro-only `document_diff` jobs, semantic diff
  worker/API, global Compare workspace, Collection Compare tab, old/new
  citation jumps, Markdown/CSV export, tests, i18n and docs.
- Required verification:
  - `python3 scripts/check_version_consistency.py`
  - `cd frontend && npm run build`
  - `cd backend && python3 -m ruff check app/ tests/`
  - `cd backend && python3 -m pytest tests/test_parse_service.py -v`
  - M5 document-diff-specific tests

### M5 Verification Log

- `python3 scripts/check_version_consistency.py` — PASS (`0.7.0 beta`)
- `cd frontend && npm run build` — PASS
- `cd backend && python3 -m ruff check app/ tests/` — PASS
- `cd backend && python3 -m pytest tests/test_parse_service.py tests/test_document_diffs_api.py tests/test_document_diff_service.py -v` — PASS (`16 passed`)
- `cd backend && python3 -m pytest tests/test_extractions_api.py tests/test_extraction_service.py tests/test_tables_api.py tests/test_table_service.py tests/test_question_templates_api.py tests/test_question_template_service.py tests/test_sharing_api.py tests/test_share_anchor_service.py tests/test_smoke.py tests/test_versioning.py -v` — PASS (`37 passed, 1 skipped`)
- `cd backend && python3 -m pytest tests/test_error_taxonomy.py tests/test_billing_cancel.py tests/test_credit_reconcile.py -v` — PASS (`67 passed`)
- `cd backend && python3 -m alembic heads` — PASS (`20260507_0025`)
- `cd backend && python3 -m alembic upgrade head` — PASS against local `localhost/doctalk`
- Browser smoke: local production Next server on `127.0.0.1:3100` with mocked
  authenticated API responses rendered `/document-diff`, loaded two ready
  documents plus a completed diff run, displayed added/modified changes and
  old/new citation chips, preserved the public `/compare` marketing page, and
  passed desktop/mobile screenshots with no mobile horizontal overflow.
- `railway up --detach` from `stable` — PASS
- `curl https://backend-production-a62e.up.railway.app/health` — PASS (`0.7.0 beta`)
- `curl https://backend-production-a62e.up.railway.app/version` — PASS (`0.7.0 beta`)
