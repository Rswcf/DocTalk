# DocTalk Batch B implementation report

Date: 2026-09-03  
Branch supplied by owner: `fix/growth-batch-b`  
Scope: B1, B2, B3, B4 from `.collab/plans/2026-09-03-backlog-decision.md`, including §7 and the task's known corrections.

## Result

All four Batch B items are implemented. The required non-integration gates pass: backend has 901 passing tests, Ruff is clean, the Next.js production build succeeds, and all 17 frontend unit tests pass. The Docker integration suite and authenticated browser golden path were not run in this sandbox; details are under Verification.

## B1 — document brief in the empty chat pane

### What changed

- `frontend/src/app/d/[documentId]/DocumentReaderPageClient.tsx:88` consumes `useDocumentBrief` only for a ready, non-demo document by passing `undefined` otherwise; `:482` passes the brief and polling state to `ChatPanel`.
- `frontend/src/lib/useDocumentBrief.ts:19` accepts an optional document ID, clears stale brief state on document changes, exposes polling state, and widens the bounded `empty` polling window to 20 attempts at `:64` and `:87` (80 seconds at the existing four-second interval).
- `frontend/src/lib/documentBriefEmptyState.ts:1` contains the directly tested empty-pane predicate; `:14` truncates the summary to 60 whitespace-delimited words.
- `frontend/src/components/Chat/ChatPanel.tsx:520` resolves questions as `suggestedQuestions ?? documentBrief?.questions ?? []`; `:522` enables the existing empty workbench for zero messages plus questions, summary, or active brief polling. The card renders the summary, a two-line polling skeleton, up to three key points, and the existing question buttons at `:548-588`.
- A failed brief contributes neither copy nor a special error panel. `DocumentBriefPanel` and its removed Brief tab were not mounted again.

### Pinned risks

- Risk 7: respected. The reader imports only `useDocumentBrief`; there is no `DocumentBriefPanel` import or mount.
- Risk 8: no nested localization structure was introduced. Existing translated empty-state labels are reused.
- Risk 9: the new UI stays on zinc/blue tokens and uses targeted transitions only.

### Regression coverage

- `frontend/tests/batch-b.test.cjs:25` proves that zero questions plus a summary satisfies the render predicate, a non-empty chat suppresses it, summary truncation stops at 60 words, the reader passes the brief, and the reader does not reference `DocumentBriefPanel`.

## B2 — parse recovery, honest copy, and document-slot rules

### Backend slot accounting and concurrency

- `backend/app/services/document_limits.py:33` centralizes the plan document ceiling. `:41` implements the exact two counts: live slots exclude both `deleting` and `error`; failed rows count only `error`. `:65` applies Rule A and the independent Rule B ceiling, including `reason: "failed_documents"` and `Delete failed documents to continue`.
- The unlocked early pre-check remains before the upload byte stream at `backend/app/api/documents.py:218-238`; URL ingestion uses the same helper at `:363-381`; layout translation request pre-checks use it at `backend/app/api/layout_translations.py:158-167`.
- `backend/app/services/doc_service.py:61-130` is the shared authoritative insert path for direct uploads and both URL-import forms. It writes the object first, locks the user's row with `FOR UPDATE` only immediately before the final count/insert at `:101-105`, and keeps the winning `documents` INSERT in that transaction. A losing race rolls back and deletes the already-written object with `await asyncio.to_thread(storage_service.delete_file, storage_key)` at `:109-119` before returning 403.
- URL PDF and HTML imports enter that same authoritative path at `backend/app/api/documents.py:462-479` and `:516-533`; `source_url` remains persisted by `backend/app/services/doc_service.py:128`.
- The delayed automatic layout-translation library import applies the same per-user lock, live/error counts, rejection cleanup, and no-insert result at `backend/app/services/layout_translation_service.py:516-559`.
- Rule C is enforced in `backend/app/api/documents.py:858-939`: after the existing owner/status pre-check, it locks the user at `:889`, refreshes the document at `:890`, returns the established 409 when another claim is already processing at `:891-901`, and checks live capacity only for an `error` row at `:902-914`. A refusal rolls back before the conditional update, so the row stays `error`.
- The reparse claim remains the existing conditional `UPDATE ... WHERE status IN ('ready','error')` at `backend/app/api/documents.py:925-931`, followed by commit, row-count validation, and only then worker dispatch at `:932-943`.

### Error taxonomy and UI recovery

- `backend/app/workers/parse_worker.py:32-47` now enumerates all 15 terminal worker codes, including the previously omitted `QDRANT_CLEANUP_FAILED`. The existing `ERR_CODE:` writer at `:51-64`, fresh-session terminal writer at `:133-156`, final-attempt timeout gate at `:159-175`, stale-task terminal-status gate at `:320-329`, and final autoretry gate at `:843-862` were preserved.
- `frontend/src/lib/errorCopy.ts:95-119` defines the complete three-class taxonomy. Every code has dedicated title/body handling at `:288-362`; `DOCUMENT_LIMIT_REACHED` handles the failed-row reason without an upgrade CTA at `:179-189`.
- Flat `errors.<CODE>.title/body` keys for all 15 codes, `errors.DOCUMENT_LIMIT_REACHED.bodyFailedDocuments`, and retry copy were added to all 11 locale files under `frontend/src/i18n/locales/`. Representative English entries begin at `en.json:2332`; the other locale failed-row keys are at `ar/de/es/fr/hi/it/ja/ko/pt.json:2649` and `zh.json:2688`.
- `backend/app/schemas/document.py:92` and `backend/app/api/documents.py:150` expose `error_msg` in the document-list response so the dashboard can suppress Retry for `DOWNLOAD_FAILED`. `frontend/src/lib/api.ts:109` accepts it.
- `frontend/src/lib/api.ts:490` adds the client reparse helper over `POST /api/documents/{id}/reparse` with the existing structured error handler.
- `frontend/src/components/dashboard/DashboardPageClient.tsx:236-275` extracts the existing two-second status polling into a reusable per-document poll. Dashboard Retry treats 202 and `DOCUMENT_PROCESSING` 409 as processing and starts that poll at `:416-443`; rows expose Retry for terminal codes except `DOWNLOAD_FAILED` at `:677-719`.
- `frontend/src/lib/useDocumentLoader.ts:31-52` exposes the parsed error code and a reload key. The key is in the loader effect dependencies at `:179`, so reader Retry re-arms polling after both 202 and the contract-valid 409.
- `frontend/src/app/d/[documentId]/DocumentReaderPageClient.tsx:430-464` implements reparse/delete actions. The error state at `:539-582` offers Retry for infrastructure and content faults, a secondary Delete for content faults, and Delete without Retry for `DOWNLOAD_FAILED`.

### Pinned risks

- Risk 1: respected. The conditional update, 409 processing contract, commit-before-dispatch ordering, stale-task gate, and final-attempt-only terminalization remain intact. Both frontend surfaces interpret 409 as in-flight processing.
- Risk 2: respected server-side. Rules A, B, and C share the same plan ceiling. Error rows do not consume a live slot, failed rows have an independent bounded ceiling, and an error-to-processing retry must reclaim a live slot.
- Risk 3: respected. The authoritative async upload path deletes the object with the specified `asyncio.to_thread(...)` call before raising its rejection.
- Risk 4: respected. Early checks are unlocked; the user row is locked only after storage upload and immediately around the authoritative count plus insert. URL imports and automatic translation imports participate in the same per-user lock convention.
- Risk 5: respected. Reader success and 409 paths both call `reloadDocument()`, whose reload key restarts the polling effect.
- Risk 8: all 11 locales contain flat dotted keys. The completeness unit test parses every JSON file.
- Risk 9: new controls use zinc/blue app styling, with red reserved for destructive/error actions; no forbidden color family or `transition-all` was added.

### Regression coverage

- `backend/tests/test_document_slots.py:18` verifies `error` is excluded from the live-slot SQL and counted separately.
- `backend/tests/test_error_taxonomy.py:181` verifies an upload at the failed-row ceiling receives 403 plus `reason: "failed_documents"` even without a live-slot rejection.
- `backend/tests/test_document_slots.py:42` verifies a full live set refuses retry and leaves the document in `error`.
- `backend/tests/test_document_slots.py:64` verifies the conditional claim and commit-before-dispatch order; `:98` verifies a losing retry observes processing and receives 409.
- `backend/tests/test_document_slots.py:123` verifies an authoritative race rejection deletes the object and performs no insert/commit.
- `backend/tests/test_layout_translation_service.py:36` verifies the async translation-import failed-row ceiling deletes the newly stored object and creates no document.
- `backend/tests/test_document_slots_integration.py:15` is the real-Postgres concurrency proof: with one slot remaining, two simultaneous reparses of different failed documents yield exactly one `parsing` row and one 403-preserved `error` row. It is integration-marked and was not executed in this sandbox.
- `frontend/tests/errorCopy.test.cjs:81` derives the worker-code set from `parse_worker.py`, requires exact equality with the frontend taxonomy, verifies no code falls through to the generic connection message, and checks every title/body key in all 11 locales.

## Terminal parse-code classification

All codes below are in `_WORKER_ERROR_CODES` and are written to a terminal document state through `_set_doc_error` directly, through `_fail_doc_fresh_session`, or through the final-attempt timeout/general-exception paths. Earlier Celery autoretry attempts still leave the document non-terminal.

| Code | Class | User action and rationale |
|---|---|---|
| `QDRANT_CLEANUP_FAILED` | Retryable infrastructure | Search-index cleanup failed; retry can succeed after the service recovers. This is one of the two codes omitted from the original §2.2 count. |
| `VECTORIZE_FAILED` | Retryable infrastructure | Extraction succeeded but indexing failed; retry. |
| `OCR_FAILED` | Retryable infrastructure | OCR execution failed; retry, with a text-layer upload as an alternative. |
| `PERSIST_PAGES_FAILED` | Retryable infrastructure | Database persistence failed; retry. |
| `PERSIST_ELEMENTS_FAILED` | Retryable infrastructure | Database persistence failed; retry. |
| `PERSIST_CHUNKS_FAILED` | Retryable infrastructure | Database persistence failed; retry. |
| `CHUNKING_FAILED` | Retryable infrastructure | Passage preparation failed after extraction; retry. |
| `PARSE_TIMEOUT` | Retryable infrastructure | The final attempt exceeded the worker limit; retry or use a smaller document. |
| `PARSE_FAILED` | Retryable infrastructure | Unexpected terminal parser failure; retry. |
| `PDF_PARSE_FAILED` | Content fault | Likely damaged/unsupported PDF structure; explain the file problem, allow Retry, and offer Delete. |
| `NO_CHUNKS` | Content fault | No searchable text was produced; explain, allow Retry, and offer Delete. |
| `OCR_DISABLED` | Content fault | Scanned content requires OCR that is currently unavailable; allow Retry because OCR availability/settings can change, and offer Delete. This is the second code omitted from the original §2.2 count. |
| `OCR_INSUFFICIENT_TEXT` | Content fault | Scan quality/content produced too little text; allow Retry and offer Delete. |
| `EXTRACTION_FAILED` | Content fault | The source could not be extracted; allow Retry and offer Delete/re-upload guidance. |
| `DOWNLOAD_FAILED` | Unrecoverable | The stored object is gone; show Delete/re-upload guidance and no Retry. |

Totals: 9 retryable-infrastructure, 5 content-fault, 1 unrecoverable; 15 terminal codes covered with no generic-copy fallthrough.

## B3 — Retry on failed chat bubbles

### What changed

- `frontend/src/components/Chat/MessageBubble.tsx:353-362` exposes a localized Retry button for a failed, non-streaming assistant bubble when `onRegenerate` is available.
- `frontend/src/components/Chat/ChatPanel.tsx:614` supplies the existing `handleRegenerateLast` callback only to the last assistant message, including its error state. The existing `regenerateLastResponse` path remains the implementation.
- `frontend/src/i18n/locales/en.json:42` and the corresponding flat `chat.retry` key in all other 10 locale files provide the label.
- `.collab/plans/2026-08-27-demo-counter-release-batch.md:1-2` now carries the required two-line supersession notice: only the Retry UI shipped, and a failed demo answer still consumes a question.

### Pinned risks

- Risk 6: respected. `useChatStream.ts` and all demo-counter mutations were left untouched; the button only exposes the existing regenerate callback and therefore preserves its accounting and re-anchoring behavior.
- Risks 8 and 9: `chat.retry` is flat and present in all 11 locales; the action uses the existing app/error palette and a targeted color transition.

### Regression coverage

- `frontend/tests/batch-b.test.cjs:48` verifies the error bubble is gated to the assistant error state and invokes the existing `onRegenerate` callback with the `chat.retry` label.

## B4 — A5-lite upgrade nudge

### What changed

- `frontend/src/components/dashboard/DashboardPageClient.tsx:143-151` changes eligibility to authenticated Free users with at least one ready document and at least three total messages.
- The seven-day re-show and fourteen-day dismiss windows remain at `frontend/src/components/dashboard/DashboardPageClient.tsx:42-43` and are applied at `:154-166`.
- The lifetime maximum-impression constant and eligibility check were removed. The impression count remains telemetry only at `frontend/src/components/dashboard/DashboardPageClient.tsx:172-188`.
- The CTA still starts checkout directly at `frontend/src/components/dashboard/DashboardPageClient.tsx:454-478`.
- English copy at `frontend/src/i18n/locales/en.json:2639` is exactly “Pro answers without the monthly cap”; localized equivalents replace the overclaim in all other locale files.

### Pinned risks

- Risk 8: the copy change was made in all 11 flat locale files and uses `tOr` at the component call site.
- Risk 9: the existing zinc/blue nudge surface and targeted transitions are preserved.
- The copy does not claim unlimited answers; the 3,000-credit Plus monthly bound remains accurately represented.

### Regression coverage

- `frontend/tests/batch-b.test.cjs:58` verifies the one-document/three-message predicate, absence of `DASHBOARD_NUDGE_MAX_IMPRESSIONS`, and corrected English claim.

## Verification

### Required gates

1. Backend tests

```text
$ cd /Users/mayijie/Projects/Code/010_DocTalk/backend && /usr/bin/python3 -m pytest -q
...
901 passed, 52 skipped, 15 warnings in 4.85s
sys:1: DeprecationWarning: builtin type swigvarlink has no __module__ attribute
```

Exit code: 0. The 15 warnings are existing FastAPI/Pydantic deprecations, the local Python 3.9 LibreSSL warning, and SWIG type deprecations.

2. Backend lint

```text
$ cd /Users/mayijie/Projects/Code/010_DocTalk/backend && python3.12 -m ruff check app/ tests/
All checks passed!
```

Exit code: 0.

3. Frontend production build

```text
$ cd /Users/mayijie/Projects/Code/010_DocTalk/frontend && npm run build
> doctalk-frontend@0.28.1 build
> next build
...
✓ Compiled successfully
  Linting and checking validity of types ...
  Collecting page data ...
...
✓ Generating static pages (425/425)
  Finalizing page optimization ...
  Collecting build traces ...
```

Exit code: 0. Non-failing build notices: the existing Sentry client-config deprecation, Edge runtime disabling static generation for one page, and `RESEND_API_KEY not set — email magic link provider disabled` in the local build environment.

4. Frontend unit tests

```text
$ cd /Users/mayijie/Projects/Code/010_DocTalk/frontend && npm run test:unit
> doctalk-frontend@0.28.1 test:unit
> node --test tests/*.test.cjs
...
1..17
# tests 17
# suites 0
# pass 17
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 231.942041
```

Exit code: 0.

### Not run

- Dedicated Docker integration command: not run. The task states Docker integration is unavailable in this sandbox. The integration-marked concurrency proof exists at `backend/tests/test_document_slots_integration.py:15`; it was included among the default suite's 52 skips and must be run independently with PostgreSQL/Docker.
- Browser golden path (`upload → chat → citation jump`): not run because the authenticated frontend/backend/data-service stack required by that path was not available in the sandbox. The production build and Batch B source/unit regressions passed, but they are not represented here as a substitute for that browser check.
- Deployment, Git operations, version bump, and commits: not performed. They are outside this implementation request, and the task explicitly says not to run Git.

