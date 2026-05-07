# Changelog

All notable DocTalk product changes are tracked here.

This project follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
and [Semantic Versioning](https://semver.org/). While DocTalk is still pre-1.0,
releases use `0.minor.patch` semantics such as `0.2.0` and `0.2.1`.

## [Unreleased]

## [0.13.0] - 2026-05-07

### Added
- Added a deterministic query planner for comparison, multi-hop, exhaustive,
  and multi-entity metric questions. Planned retrieval now adds controlled
  subquery evidence instead of relying on one ordinary top-k search.
- Added balanced per-document evidence coverage for collection comparison
  questions so one strongly matching document does not crowd out the other
  documents being compared.
- Added a query-plan prompt contract that tells the model how to synthesize
  multi-hop/comparison evidence without echoing raw planned queries into the
  system prompt.
- Added regression tests for direct vs planned routing, entity/metric
  decomposition, collection comparison coverage, planned corrective retrieval,
  and prompt-injection-safe query-plan guidance.

### Changed
- Table and numeric questions now always attempt table/lexical evidence
  alongside vector retrieval, preserving short-row recall for finance-style
  questions even when vector search appears superficially sufficient.

## [0.12.0] - 2026-05-07

### Added
- Added table-aware retrieval for table and numeric chat questions. When a
  document already has scanned `document_tables`, matching table rows are
  formatted as cited evidence and merged ahead of ordinary vector/lexical
  fragments.
- Added table-specific retrieval guidance so numeric answers preserve row
  labels, units, periods, and currencies exactly.
- Added regression tests for structured table evidence ranking, generic table
  requests, specific-term filtering, table-first corrective retrieval, financial
  metric routing, and table prompt guidance.

### Changed
- Table/numeric questions now use a lower lexical chunk-length threshold so
  short parsed table rows are not filtered out before answer generation.
- Query routing now recognizes more finance-style metric questions such as
  margins, target prices, market cap, EBITDA, cash flow, and currency/percent
  values without treating plain page-number lookups as table questions.

## [0.11.0] - 2026-05-07

### Changed
- Improved parser reading order for simple two-column PDF pages so left-column
  body text is chunked before right-column text instead of interleaving rows.
- Tightened chunk assembly so English block boundaries preserve word spacing
  while CJK adjacency and punctuation remain compact.
- Preserved short documents during micro-chunk filtering instead of filtering
  an entire concise document down to zero searchable chunks.

### Added
- Added parser integrity regression tests for two-column reading order and
  mid-page full-width blocks, Title Case body-line retention, English sentence
  boundary joining, concise documents, and CJK punctuation joins.

## [0.10.0] - 2026-05-07

### Added
- Added a retrieval quality evaluator for chat that scores ordinary RAG results
  before generation, tracking empty evidence, weak exact-term coverage,
  exhaustive-scan undercoverage, low vector scores, matched terms, and missing
  terms.
- Added corrective retrieval for local Q&A, table/numeric questions, citation
  lookup, existence checks, and exhaustive scans. The corrective path keeps the
  initial vector results, runs a scoped lexical fallback over document chunks,
  de-duplicates by chunk, and passes an evidence-quality note into the prompt.
- Added lexical fallback retrieval for single-document and collection sessions
  using escaped `ILIKE` matching over chunk text and section titles, with
  deterministic scoring for exact identifiers, numbers, and CJK bigrams.
- Added regression tests for evaluator decisions, corrective retrieval merging,
  chat prompt quality notes, and summary routing isolation.

### Changed
- Ordinary non-summary chat now routes through the corrective retrieval wrapper
  instead of calling vector search directly. Whole-document and collection
  summaries still use the persisted/representative brief context path.

## [0.9.0] - 2026-05-07

### Added
- Added persisted hierarchical Document Briefs generated after parsing. Briefs
  store a concise summary, outline, key points, facts/figures, suggested
  questions, generation metadata, and representative chunk coverage.
- Added a `document_briefs` table plus a Celery `default`-queue brief worker so
  parse completion no longer performs best-effort LLM summary generation inside
  the parse task.
- Added `GET /api/documents/{document_id}/brief`, with access checks matching
  the document endpoint and citation hydration from chunk/page/bbox metadata.
- Added a document-reader `Brief` workspace available beside Chat and Extract,
  including cited outline, key points, facts, questions, status states, and
  citation chips that jump to the original page highlight.
- Added regression tests for brief normalization, persisted legacy summary
  mirroring, failure isolation, persisted-coverage retrieval, parse-worker
  dispatch, and brief API authorization/citation hydration.

### Changed
- Legacy `documents.summary` and `documents.suggested_questions` are now derived
  from the structured brief payload for compatibility with existing chat
  suggested-question UI.
- Whole-document summary routing now prefers persisted brief coverage before it
  falls back to on-demand representative chunk selection.

## [0.8.0] - 2026-05-07

### Added
- Added a multi-label-ready query router for document chat. Whole-document
  summary requests such as "summarize this document" and "请总结这篇文档的要点"
  now route to a representative document-summary context path instead of
  ordinary semantic top-8 retrieval, with golden coverage across all 11
  supported locales.
- Added representative summary context selection that samples ordered chunks
  across the beginning, middle, section changes, and tail of a document while
  skipping tiny sidebar/footer chunks.
- Added collection-summary routing to sample representative coverage from each
  document instead of summarizing collections from semantic top-k hits.
- Added RAG routing regression tests covering multilingual summary prompts,
  table/numeric queries, existence checks, collection comparison candidates,
  and the chat integration path.
- Added a RAG workbench execution ledger for the staged router, brief,
  corrective retrieval, parser, table, planner, and verifier rollout.

### Changed
- Whole-document summary prompts now use summary-specific system instructions
  that prevent the model from calling a ready document "incomplete" just
  because the provided context is representative excerpts.
- Summary chat requests pre-debit a larger credit estimate to reduce
  post-stream undercharge exposure from broader representative contexts.

## [0.7.3] - 2026-05-07

### Changed
- Made the public mobile header expose `Sign Up Free` as the primary action,
  with Demo as the secondary path, to restore a clear registration entry point.

### Added
- Added anonymous, rate-limited auth-funnel telemetry for landing CTA clicks,
  auth modal opens, OAuth provider clicks, and email magic-link outcomes without
  storing email addresses or client IPs.

## [0.7.2] - 2026-05-07

### Fixed
- Added separate server-side and browser-facing MinIO endpoints so production
  uploads can use Railway private networking while presigned document URLs
  remain reachable from the browser.
- Upload and URL ingestion now return structured `STORAGE_UNAVAILABLE` errors
  when object storage cannot accept a file instead of leaking an internal 500.

## [0.7.1] - 2026-05-07

### Fixed
- Prevented async SQLAlchemy lazy-loading while serializing queued extraction,
  question-template, and document-diff job responses. This fixes production
  `HTTP 500` errors after users start an async document-workbench job.

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
