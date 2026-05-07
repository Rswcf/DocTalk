# Changelog

All notable DocTalk product changes are tracked here.

This project follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
and [Semantic Versioning](https://semver.org/). While DocTalk is still pre-1.0,
releases use `0.minor.patch` semantics such as `0.2.0` and `0.2.1`.

## [Unreleased]

## [0.7.0] - 2026-05-07

### Added
- Pro-only Document Diff workflow for semantic comparison between two ready
  user-owned documents. The report groups added, removed, and modified changes
  and attaches old/new citation chips that jump back to the source documents.
- Global `/document-diff` workspace and Collection-level Compare tab so users can
  run version comparisons from the dashboard or inside a document workspace.
- `document_diff` document job type, FastAPI run/list/get/export endpoints,
  and a Celery worker task with credit pre-debit and actual-cost reconcile.

## [0.6.0] - 2026-05-07

### Added
- Reusable Question Templates for the document workbench. Users can create
  saved checklists, run them against a single document on Plus+, and export the
  cited answer matrix as Markdown or CSV.
- Pro-only Collection template runs that apply the same checklist across every
  ready document in a collection and render the answers as a cited matrix.
- `question_templates` table, `batch_template` document job type, FastAPI
  template/run/export endpoints, and a Celery worker task for queued template
  execution with credit pre-debit/reconciliation.

## [0.5.0] - 2026-05-07

### Added
- Per-answer deep link sharing from assistant message actions. Shared answer
  URLs reuse the existing session share token and append a stable message
  anchor so recipients land directly on the cited answer.
- Public shared-session pages now expose safe message anchors and highlight the
  targeted answer via the URL fragment.

### Security
- Public share responses continue to redact private citation internals such as
  bbox coordinates, chunk ids, document ids, and confidence scores.

## [0.4.0] - 2026-05-07

### Added
- Table Extraction in the document workbench with `Tables` preview, on-demand
  table scanning, PDF `find_tables()` support, markdown-table fallback for
  converted/non-PDF documents, and Plus+ CSV export.
- `document_tables` table and `table_scan` document job type for reusable
  table extraction workflows.
- FastAPI table scan/list/export endpoints and Celery table worker task.

## [0.3.0] - 2026-05-07

### Added
- Structured Extraction workspace on the document reader with `Chat / Extract`
  switching, three cited templates, async job status, citation jumps, and
  Markdown/CSV export.
- `document_jobs` and `extraction_results` tables as the shared async job
  foundation for document-workbench features.
- FastAPI extraction endpoints and a Celery `default`-queue worker task for
  queued extraction jobs with pre-debit/reconcile credit accounting.
- Execution ledger for the document-workbench delivery sequence.
- Self-serve cancellation feedback capture with optional refund-review request tracking.
- 7-day fair-use refund review copy on Pricing and Billing surfaces.

### Changed
- Version metadata bumped to `0.3.0 beta`; versioning tests now derive the
  expected patch dry-run from `version.json`.
- Current documentation now reflects DeepSeek V4 Flash/Pro as the live chat modes and Stripe live billing in production.

## [0.2.0] - 2026-03-15

### Added
- Centralized product version source in `version.json`.
- Runtime release metadata exposure for frontend and backend.
- Version bump and consistency-check scripts for release workflow.
