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
| M1 | 0.3.0 | Structured Extraction | In progress | Pending | Pending | Pending | Pending |
| M2 | 0.4.0 | Table Extraction | Pending | Pending | Pending | Pending | Pending |
| M3 | 0.5.0 | Deep Link Answer Share | Pending | Pending | Pending | Pending | Pending |
| M4 | 0.6.0 | Question Templates | Pending | Pending | Pending | Pending | Pending |
| M5 | 0.7.0 | Document Diff | Pending | Pending | Pending | Pending | Pending |

## Current Cycle: M1 Structured Extraction

- Started: 2026-05-07
- Branch: `main`
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
