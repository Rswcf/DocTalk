# Batch A R2 findings — R3 fix report

Date: 2026-08-26  
Branch supplied by requester: `fix/growth-batch-a`  
Reviewed starting HEAD supplied by requester: `76efcc1`  
Scope: accepted R2 findings F1–F5  
Implementation verdict: **all five findings fixed**  
Verification verdict: **build, frontend unit, Ruff, and full non-integration backend suites pass; real-infrastructure execution is sandbox-blocked**

Per instruction, no Git commands were run.

## F1 — URL resource cap is byte-classified, never header-classified

- Moved the upload magic/OOXML validation into shared
  `backend/app/services/file_validation.py`; direct uploads and URL fetches now
  use the same `%PDF-` contract.
- `_fetch_with_safe_redirects()` no longer uses `Content-Type` to select a cap.
  It streams under the larger authenticated plan PDF cap while collecting the
  bounded magic prefix, then immediately applies the independent 10 MB cap to
  every non-PDF body. Actual received bytes are always counted; `Content-Length`
  is only an additional early size check after byte classification.
- `fetch_and_extract_url()` also selects the PDF pipeline from shared magic-byte
  validation, so a PDF served as `application/octet-stream` remains a PDF.
- Redirect responses never choose or raise a cap. Every final response after a
  redirect is independently sniffed under the original caller-supplied caps.
- Tests cover HTML labelled PDF, PDF labelled octet-stream, correctly labelled
  PDF, and correctly labelled HTML across final and post-redirect responses,
  with both `Content-Length` and chunked bodies.

## F2 — undelivered failed extraction releases the Free trial slot

- Added async and sync release helpers in `domain_mode_access.py`. Release is a
  conditional `DELETE ... RETURNING` eligible only when:
  - the owner is the specified user's extraction job;
  - the job is terminally `failed` / `cancelled` / `canceled`; and
  - no `extraction_results` row exists.
- Release locks the same user row as claim. Claim+release therefore serialize,
  the unique slot constraint remains defense in depth, a repeated release is a
  no-op, and a released slot can be claimed only once.
- Queue failure and terminal worker failure invoke release only after a credit
  ledger delete actually causes a refund, before the same transaction commits.
  No refund means no release. Success never calls release and is also rejected
  by the eligibility query.
- Closed the ambiguous broker-publication window: the endpoint's
  `queued -> failed` transition and the worker's `queued -> running` transition
  are competing conditional updates. If the worker already claimed the job,
  the endpoint preserves that result path and performs no refund/release. This
  prevents a late publication error from freeing a slot that later delivers a
  result.
- Updated service/model docstrings, architecture docs, and the frontend rule to
  describe the new policy.
- Added coverage for failure release + retry, success retention, idempotent
  release, concurrent release+claim, synchronous queue failure, and ambiguous
  publication where the worker wins.

## F3 — Pro limit errors never point toward Plus

- `FILE_TOO_LARGE` now uses one shared `fileTooLargeCopy()` for the local upload
  precheck and backend error mapping:
  - Free -> Plus;
  - Plus -> Pro;
  - Pro -> explanatory compress/split copy with no CTA.
- Upgrade CTAs now carry their actual target plan. Dashboard upload/URL and
  collection click handlers use that value instead of recomputing a plan from
  the current tier.
- Audited the same cap shape in `errorCopy.ts`. Document-count and page-count
  paths were already top-tier-aware; collection and per-collection document
  caps now are too. Gates that still have fixed Plus/Pro CTAs are emitted only
  below their required tier; Pro credit exhaustion remains the separately
  adjudicated credit-pack path.
- Added frontend unit coverage for Free -> Plus, Plus -> Pro, and Pro -> no CTA
  on both local precheck and backend `FILE_TOO_LARGE`, plus Pro collection caps.

## F4 — unsupported PDFs fail before persistence

- `count_document_pages()` rejects `pdf.needs_pass` as
  `PDF_PASSWORD_PROTECTED`; direct upload and URL import expose that clear
  taxonomy and localized frontend copy.
- Both ingress paths still perform this preflight before object storage and the
  `documents` insert. Tests assert that encrypted PDFs call neither persistence
  path.
- **Undetermined page-count policy: reject / fail closed.** A malformed PDF or
  any PDF whose page tree cannot be opened/count determined returns
  `INVALID_FILE_CONTENT` before persistence. Zero-page PDFs are also rejected.
- No migration was needed.

## F5 — retired global-limit copy removed

- Updated `landing.faq.a2`, `landing.faq.a6`,
  `featuresMultiFormat.faq5A`, and the legacy `upload.tooLarge` copy in all 11
  locales. All keys remain flat dotted JSON keys.
- Updated homepage and multi-format JSON-LD, the landing fallback, DOCX/PPTX/
  XLSX articles, the PowerPoint long-document paragraph, and
  `docs/VOICE_AND_TONE.md`.
- Active upload copy now states the per-document contract:
  - Free: **50 MB / 750 pages**
  - Plus: **100 MB / 1,500 pages**
  - Pro: **200 MB / 3,000 pages**
- A final repository sweep found no retired DocTalk `500 pages` assertion.
  Remaining `500 pages` strings describe Humata competitor pricing. Remaining
  standalone `50 MB` strings are explicitly Free-plan labels/examples or the
  separate all-plan layout-translation cap; per-plan upload references state
  all three tiers.

## Verification

The host's default Homebrew `python3` is 3.14 without pytest. Backend commands
were run with `/opt/homebrew/opt/python@3.12/bin` first on `PATH`, preserving the
requested `python3 -m ...` invocation.

- `cd frontend && npm run build` — **PASS** (425 static pages generated; only
  existing Sentry/edge-runtime/environment warnings).
- `cd frontend && npm run test:unit` — **PASS**, 12/12.
- `cd backend && python3 -m ruff check app/ tests/` — **PASS**.
- `cd backend && python3 -m pytest -q` — **PASS**, 863 passed, 41 integration
  tests skipped by the repository's default `SKIP_INTEGRATION` guard.
- Targeted changed-area backend suite — **PASS**, 112 passed before the final
  ambiguous-publication test; `test_extractions_api.py` then passed 12/12.
- All 11 locale JSON files parse with `jq`; required new keys are present as
  flat dotted keys in every locale.
- The release statement compiles with SQLAlchemy's PostgreSQL dialect and
  contains the terminal-job, no-result, and `RETURNING` predicates.
- `cd backend && SKIP_INTEGRATION= python3 -m pytest -m integration -q` —
  **EXECUTED, ENVIRONMENT BLOCKED**. The managed workspace denies loopback
  socket access (`PermissionError: [Errno 1] Operation not permitted` while
  connecting to `::1:5432`) before the scratch `doctalk_test` database fixture
  can provision. The fallback attempt to inspect/use Compose was also denied at
  the Docker Unix socket. Result: 38 setup errors, 865 deselected; no test body
  ran. No Alembic downgrade occurred.

## Handoff

Run the integration command once in the ordinary local development shell with
Docker/Postgres access. The newly added real-Postgres cases are in
`backend/tests/test_domain_mode_access_integration.py` and specifically prove
release+retry, success retention, idempotency, and release+claim serialization.
