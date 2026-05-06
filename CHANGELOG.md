# Changelog

All notable DocTalk product changes are tracked here.

This project follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
and [Semantic Versioning](https://semver.org/). While DocTalk is still pre-1.0,
releases use `0.minor.patch` semantics such as `0.2.0` and `0.2.1`.

## [Unreleased]

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
