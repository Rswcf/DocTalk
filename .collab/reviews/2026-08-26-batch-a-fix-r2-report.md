# Batch A findings 1 + 4 fix report — R2

Date: 2026-08-26  
Working branch supplied by owner: `fix/growth-batch-a`, starting HEAD `298088f`  
Scope: close Codex R1 findings 1 and 4 plus the owner's added ingestion page-cost cap

## Outcome

Implemented both owner decisions. No Git command was run and the changes are left in the working tree for Claude to commit.

## Finding 1 — one Free Domain Mode session

- Added migration `20260826_0041_add_feature_trial_usages.py`; its `down_revision` is the actual current-head revision value `20260826_0040`.
- Added `feature_trial_usages` with unique `(user_id, feature, slot_index)` ownership. `owning_session_id` and `owning_job_id` both use `ON DELETE SET NULL`, never cascade. Deleting the user still cascades the account-owned usage row for privacy/account erasure.
- Free claims serialize with `SELECT users.id ... FOR UPDATE`; the unique slot constraint is defense in depth. The reservation is flushed while the lock is held.
  - Chat commits the claim before streaming begins.
  - Extraction creates a UUID-keyed provisional job, claims against that job, then commits job + reservation + credit debit + event together.
- Existing session ownership is checked before available slots. Therefore every later Domain Mode message in the same session is allowed, even when `_sync_session_domain_mode()` has since written `sessions.domain_mode = NULL`.
- `FREE_DOMAIN_MODE_TRIALS > 1` allocates the first unoccupied slot; existing owners remain authorized if the configured cap later changes.
- Chat and direct extraction share the same `feature='domain_mode'` slot pool.

### Failed-attempt policy

A reservation is permanent once committed. Downstream LLM, extraction-worker, or queue failure does not release it; otherwise failure manipulation becomes another reset path. A surviving owning chat session can still retry without spending another slot. Pre-commit extraction failures (including insufficient credits) roll back the provisional job and claim together because the attempt was never accepted.

Real-Postgres tests were added for concurrent fresh-session claims, clear-mode retry, same-session multi-message use, session deletion, document deletion (covering both cascaded sessions and jobs), shared chat/extraction allowance, retained failed-job reservations, and caps above one. Fast unit tests cover allocation, existing-owner reuse, exhaustion, and the model's `SET NULL` FK declarations.

## Finding 4 — URL byte caps and ingestion page-cost bounds

- URL fetch now takes a required caller-selected `max_pdf_bytes`; `documents.py` supplies the authenticated plan's 50/100/200 MB cap.
- HTML retains a separately named and documented `MAX_HTML_CONTENT_SIZE = 10 MB` defensive response-body cap.
- A URL PDF that exceeds its plan cap maps to the existing actionable `FILE_TOO_LARGE` taxonomy with `max_mb` and `plan`, rather than a generic fetch failure.
- Added header/stream and endpoint propagation tests covering a 50 MB response under Plus's 100 MB cap (the requested 10–100 MB band) and a 150 MB response under Pro's 200 MB cap (the requested 100–200 MB band).

### Enforced page caps

- Added `FREE_MAX_PAGES=750`, `PLUS_MAX_PAGES=1500`, and `PRO_MAX_PAGES=3000`.
- Direct uploads count pages after magic/ZIP validation but before MinIO or `documents` insertion:
  - PDF: page tree only via PyMuPDF; no render/text/OCR.
  - DOCX/PPTX/XLSX/TXT/MD: the same deterministic extractor used by the worker, so the preflight logical count matches the eventual `documents.page_count` definition.
- URL PDFs count the PDF page tree before persistence. HTML imports count the stored Markdown through the worker's `url` extractor, not the fetcher's intermediate article-section count.
- Over-cap ingestion returns `DOCUMENT_PAGE_LIMIT_EXCEEDED` with `page_count`, `max_pages`, and `plan`. Frontend error copy is actionable, provides a next-plan CTA for Free/Plus, and tells Pro users to split the document.
- The error strings were added as flat dotted keys in all 11 locales. All locale JSON files parse and the keys were programmatically checked as top-level strings.
- Rejection occurs before object upload or `Document` construction. It therefore cannot consume a Free-plan document slot; endpoint tests assert neither document creation nor storage is called.

### Existing production documents

**No document that exists in production today can be rejected by this change.** The supplied production census says the largest existing document is 696 pages, below the lowest new cap (Free 750). More fundamentally, enforcement runs only on new direct-upload and URL-ingest requests before a document row is created; there is no migration scan, backfill rejection, or reparse gate against existing rows. Thus every existing document remains usable, including the 696-page document.

### Dead knobs

Deleted `MAX_PDF_PAGES` and `MAX_PDF_SIZE_MB` from `Settings` and `.env.example`. They had no readers and keeping them would falsely imply a second enforcement layer. The per-plan file/page settings are now the only ingestion sources of truth and are actively read at both entry points.

## Documentation updated

- `.claude/rules/backend.md` and `.claude/rules/frontend.md`
- `docs/ARCHITECTURE.md` and `docs/ARCHITECTURE.zh.md`
- Active blog copy that still claimed a 500-page global maximum
- `.env.example`

## Verification

Passed:

- `cd frontend && npm run build`
- `cd frontend && npm run test:unit` — 5 passed
- `cd backend && python3 -m ruff check app/ tests/`
- `cd backend && python3 -m pytest -q` — 839 passed, 38 skipped
- Focused new/affected backend tests — 89 passed after the final URL-HTML count alignment
- All 11 locale JSON files parse; new keys are flat strings
- `python3 -m alembic upgrade 20260826_0041 --sql` — generated valid PostgreSQL DDL, including both owner `ON DELETE SET NULL` clauses and the exact `20260826_0040 -> 20260826_0041` chain

Environment-blocked (attempted, not counted as passed):

- `cd backend && SKIP_INTEGRATION= python3 -m pytest -m integration -q`
  - 35 tests errored in the session fixture before any test body ran because the managed sandbox denied the TCP connection to local Postgres (`PermissionError: [Errno 1] Operation not permitted`, `::1:5432`).
  - `docker compose ps` was also denied at the Docker socket. This is an execution-environment restriction, not a test assertion failure.
  - The newly added concurrency/deletion/FK integration tests therefore still need one run in Claude's Docker-enabled environment before commit/merge.

## Invariants explicitly untouched

- Credit debit/reconciliation/refund settlement logic
- Verified Quote pipeline
- Demo counter/session contract
