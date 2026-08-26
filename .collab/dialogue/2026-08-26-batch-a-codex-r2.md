# Batch A adversarial review — Codex R2

Commit under review: `76efcc1` (`fix/growth-batch-a`)  
Review date: 2026-08-26  
Verdict: **REVISE**

The R1 blockers around concurrent/resettable chat trials, paid-subscriber Checkout routing, and
attempt-scoped Stripe recovery are substantially fixed. The batch is not shippable yet: URL response
classification still lets an attacker-controlled `Content-Type` choose between the 10 MB defensive cap
and the 50/100/200 MB PDF cap, and a terminal failed extraction can permanently consume the only Free
Domain Mode slot without any way to reuse its owner. I also found one top-tier billing regression and
two lower-severity ingestion/copy defects.

Per the request, I did not run Git.

## Findings

1. **[HIGH — resource cap bypass / paid URL regression] The URL cap is selected from the untrusted `Content-Type`; there is no content sniffing.**

   Files: `backend/app/services/extractors/url_extractor.py:164-178`,
   `backend/app/services/extractors/url_extractor.py:368-380`,
   `.claude/rules/backend.md:21`.

   `_fetch_with_safe_redirects()` calls a response a PDF solely when the final server header contains
   `application/pdf`. That has two symmetric failures:

   - An HTML or arbitrary binary response labelled `application/pdf` receives the caller's plan cap,
     so a Pro URL import can download 200 MB into memory. It is only rejected later when PyMuPDF tries
     to open it. The claimed independent 10 MB HTML defense is therefore not intact against a hostile
     or simply wrong response header.
   - A real PDF served as `application/octet-stream`, `text/plain`, or another common generic type is
     still capped at 10 MB and then parsed as HTML. Paid URL-PDF headroom remains unreachable for those
     responses.

   Redirect handling itself is sound: redirect bodies are not iterated, and every target is revalidated
   and re-resolved before the final response is read. The bug is classification of that final body. The
   new tests only call `_read_response_bytes_limited()` with a caller-selected number or assert endpoint
   argument propagation; neither test proves that the correct number is selected for mislabeled bytes.

   **Concrete fix:** peek a small bounded prefix from the streamed final body and classify PDF bytes by
   magic (`%PDF-`, consistently with direct-upload validation), not by the header alone. Apply the
   plan-derived cap only to bytes that pass PDF sniffing and the 10 MB cap to every other body. Preserve
   already-read prefix bytes in the final payload. Add final-response and post-redirect tests for (a)
   HTML labelled PDF, (b) PDF labelled octet-stream, (c) correctly labelled PDF, and (d) correctly
   labelled HTML, testing both `Content-Length` and chunked bodies.

2. **[MEDIUM — permanently unusable trial] A failed extraction can burn the only Domain Mode slot, and unlike chat there is no same-owner retry path.**

   Files: `backend/app/services/domain_mode_access.py:47-52`,
   `backend/app/api/extractions.py:262-284`,
   `backend/app/workers/extraction_worker.py:12-21`,
   `backend/app/services/extraction_service.py:585-603`,
   `backend/tests/test_domain_mode_access_integration.py:225-243`.

   Permanent reservation is coherent for chat: a failed stream leaves the session alive, and the
   existing-owner path authorizes a retry in that same session without another slot. A chat slot is not
   made unusable merely because the first stream failed.

   Extraction is different. The claim is committed before `.delay()`. If dispatch raises, the endpoint
   refunds the predebit and marks the job `failed`, but retains the usage row. Worker failures similarly
   end in a failed job and a refund. There is no API to retry that same `owning_job_id`; a new POST creates
   a new UUID and is denied because the old slot remains occupied. The Celery `autoretry_for` declaration
   does not repair this final state because `run_extraction_job_sync()` catches every exception and does
   not re-raise it. The integration test named `test_failed_committed_extraction_does_not_release_reservation`
   explicitly asserts the permanent lockout rather than merely documenting it.

   This is worse than the stated anti-reset policy for an infrastructure/provider failure: the user gets
   neither a Domain Mode result nor another usable owner. It is especially poor for a one-slot free trial.

   **Concrete fix:** keep reservations permanent but make their owners usable. Add an idempotent retry for
   a failed owning extraction job (same job id, same trial row, fresh credit predebit), or have reliable
   dispatch/watchdog recovery continue the same queued job. At minimum, a synchronous queue-publication
   failure that returns 500 and refunds all credits should remove the provisional usage in the same
   failure transaction. Make Celery retry semantics real by re-raising retryable worker exceptions, with
   terminal state/refund only on the final attempt. Add queue-failure, worker-failure, and same-owner retry
   integration tests. Also add the currently missing direct chat-stream-failure test proving that retrying
   the surviving session remains allowed and still uses one row.

3. **[MEDIUM — top-tier downgrade funnel] A Pro user who exceeds 200 MB is shown “Upgrade” and routed toward Plus.**

   Files: `frontend/src/lib/errorCopy.ts:95-111`,
   `frontend/src/lib/errorCopy.ts:145-151`,
   `frontend/src/components/dashboard/DashboardPageClient.tsx:138-140`,
   `frontend/src/components/dashboard/DashboardPageClient.tsx:255-264`,
   `frontend/src/components/dashboard/DashboardPageClient.tsx:488-496`,
   `frontend/src/components/dashboard/DashboardPageClient.tsx:532-540`.

   `DOCUMENT_PAGE_LIMIT_EXCEEDED` correctly uses `targetPlanOrNone()` and gives Pro users split-document
   guidance with no upgrade CTA. `FILE_TOO_LARGE` still uses `targetPlan()`, whose fallback for a Pro
   detail is Plus. The dashboard's client precheck independently computes `uploadUpgradePlan` as Plus
   for every plan other than Plus, including Pro. Consequently a Pro user choosing a >200 MB file sees
   an Upgrade CTA; clicking it navigates to a Plus billing intent, where the billing page can offer a
   confirmed downgrade.

   The exact R1 finding 2 is closed — the plan-aware action no longer calls `/subscribe` for a known paid
   user — but this adjacent A4 path still gives the top tier a materially wrong action.

   **Concrete fix:** make `FILE_TOO_LARGE` use the same top-tier-aware decision as the page/document cap.
   For Pro, render compress/split guidance and no upgrade CTA. Make the dashboard precheck return no
   target for Pro and derive click behavior from the CTA's actual plan instead of recomputing
   `uploadUpgradePlan`. Add Free→Plus, Plus→Pro, and Pro→no-upgrade tests for both client precheck and
   backend-error copy.

4. **[LOW — invalid document persistence] Password-protected PDFs can pass page preflight, then fail only after storage and document insertion.**

   Files: `backend/app/services/document_limits.py:30-45`,
   `backend/app/api/documents.py:299-328`,
   `backend/app/api/documents.py:482-512`,
   `backend/app/workers/parse_worker.py:477-490`.

   PyMuPDF exposes the page tree of an encrypted PDF without authenticating it. In a focused probe, the
   document reported `needs_pass=1`, `page_count=1`, and `count_document_pages(...)=1`; the worker's
   `ParseService.extract_pages()` then raised `ValueError: document closed or encrypted`. Thus the count
   itself is not understated, but preflight treats an unsupported encrypted file as usable and persists
   an object plus a document row that will fail parsing and occupy a document slot.

   Truly malformed PDFs for which PyMuPDF cannot determine a page tree are handled correctly: both direct
   upload and URL-PDF paths return `INVALID_FILE_CONTENT` before storage. URL and direct uploads are fully
   buffered before counting, so “streaming PDF”/linearized layout does not create a separate counter; the
   immutable buffered bytes are what both preflight and the worker receive.

   **Concrete fix:** in the PDF counter, reject `pdf.needs_pass` before returning `page_count` (with either
   the existing invalid-content taxonomy or a specific password-protected-PDF error). Add direct-upload
   and URL-import tests proving encrypted files never call storage or add a document row, plus a malformed
   PDF test for the existing fail-closed path.

5. **[LOW — R1 copy fix is incomplete] Active product surfaces still advertise the retired global 500-page/50 MB limits.**

   Files: `frontend/src/i18n/locales/en.json:397`, `:405`, `:1365` (corresponding keys in the other
   10 locales), `frontend/src/components/landing/FAQ.tsx:7-15`,
   `frontend/src/app/page.tsx:81-87` and `:113-118`,
   `frontend/src/app/features/multi-format/page.tsx:108-114`,
   `frontend/content/blog/chat-with-docx-ai.md:57`,
   `frontend/content/blog/chat-with-powerpoint-ai.md:66`,
   `frontend/content/blog/chat-with-excel-spreadsheet-ai.md:74`,
   `docs/VOICE_AND_TONE.md:104`.

   The R1-listed size values on the homepage and architecture tables are now 50/100/200 MB, but those same
   homepage strings say all plans stop at 500 pages. `landing.faq.a6` independently repeats 500 pages, as
   does multi-format FAQ copy. The implemented cap is now 750/1,500/3,000. Several live format articles
   and the voice guide still say “Files up to 50 MB” with no Free-plan qualifier. This leaves R1 finding 5
   closed only on its originally enumerated lines, not across the active surface, and the new page-cap
   commit made the 500-page statement newly contradictory.

   **Concrete fix:** update `landing.faq.a2`, `landing.faq.a6`, and
   `featuresMultiFormat.faq5A` in all 11 locales; update their hardcoded fallback/JSON-LD sources; and make
   active format articles and the voice guide explicitly plan-specific. Use 750/1,500/3,000 pages and
   50/100/200 MB. Historical `.collab`, `docs/research`, and superseded plan snapshots can remain when
   clearly historical.

## R1 findings 1–5 re-audit

1. **R1 #1 — partially closed.** The new table fixes count-then-act races, mutable-mode resets, deletion
   resets, same-session follow-ups, and cross chat/extraction accounting. The remaining failed-extraction
   owner problem is finding 2 above.
2. **R1 #2 — closed for every cited direct CTA.** Outside `/billing`, all callers now use the shared
   plan-aware action; known Free users use Checkout, Plus→Pro goes through billing/change-plan, and Pro
   insufficient-credit intent goes to credit packs. The billing sticky CTA calls `handlePlanAction()`.
   Finding 3 above is an adjacent top-tier A4 bug, not the original second-subscription failure.
3. **R1 #3 — closed.** `checkout_attempts` supplies an attempt UUID, stable Stripe idempotency keys,
   attempt-owned `started_at`, persisted Session id/URL/status, explicit stale-Session expiry, completion
   adoption, and webhook correlation. Recovery no longer uses `User.updated_at`, and the requested
   ambiguous-create/lost-response/stale-open/two-tab cases have tests.
4. **R1 #4 — not fully closed.** The plan cap reaches the fetcher, but an untrusted header chooses whether
   it is used; see finding 1.
5. **R1 #5 — partially closed.** The exact size values and architecture/rule statements cited in R1 were
   corrected. Active global 500-page and unqualified 50 MB copy remains; see finding 5.

## Requested transaction, deletion, page-cap, and configuration checks

- **Chat lock/commit:** `domain_mode_access.py:71-73` takes the user-row `FOR UPDATE`; a new or existing
  session claim calls `db.commit()` at `:90-92` or `:117-119`. The reservation is durable and the lock is
  released only by that commit, before `StreamingResponse` is returned.
- **Extraction lock/commit:** the helper only flushes. `debit_credits()` explicitly leaves commit to its
  caller (`credit_service.py:71-75`), and `create_extraction()` commits job + usage + debit + event at
  `extractions.py:227-262`. Insufficient credit and access denial roll back. No intervening commit releases
  the user lock early.
- **NULL owner behavior:** both owner FKs are `ON DELETE SET NULL`; both partial unique indexes exclude
  NULL. Owner deletion therefore cannot collide. The usage row and unique `(user_id, feature, slot_index)`
  remain, and the occupied-slot query includes the row regardless of owner NULL, so deletion cannot
  resurrect/reuse a slot. Only explicit usage-row deletion (or account deletion via the user FK cascade)
  frees it.
- **Cleared `sessions.domain_mode`:** safe. Existing ownership is selected from `feature_trial_usages` by
  user, feature, and session id; it never consults the mutable session display field.
- **Page-cap ordering:** direct upload counts at `documents.py:302-304`, enforces at `:310`, and only then
  enters `create_document()` at `:322`. URL PDF counts/enforces at `:482-490`, then uploads at `:496` and
  adds the row at `:500-512`. URL HTML counts/enforces at `:524-530`, then uploads at `:548` and adds the
  row at `:552-564`. An over-page rejection cannot consume a document slot or leave a storage object;
  the endpoint tests assert both. A later database failure after an accepted storage upload can still
  orphan an object in the pre-existing lifecycle, but that is not a page-limit rejection.
- **Dead Railway variables:** safe. `Settings.model_config` uses `extra="ignore"` at
  `backend/app/core/config.py:214`; a focused process with both retired environment variables set imported
  settings successfully, exposed neither old attribute, and retained the new defaults. Repository search
  found no active runtime/entrypoint/settings-validation reader. `.env.example` contains only the six new
  per-plan byte/page settings. Old names remain only in historical review/plan artifacts.
- **Rule edits:** the frontend Domain Mode rule accurately describes the implemented entitlement source,
  SET NULL behavior, same-session follow-ups, and permanent-failure policy. The backend ingress rule is
  accurate about page-count ordering but aspirational about the independent HTML cap until finding 1 is
  fixed. I found no new violation of the MinIO `to_thread`, HTTPException, credit settlement, demo, quote,
  API-proxy, palette, or i18n key-shape rules.

## Verification performed

- `cd backend && python3 -m pytest tests/test_domain_mode_access.py tests/test_url_extractor.py tests/test_document_limits.py tests/test_billing_logic.py -q` — **20 passed**.
- Started Python with production's still-set `MAX_PDF_PAGES` and `MAX_PDF_SIZE_MB`; settings import passed,
  both attributes were absent, and new per-plan defaults loaded.
- Generated a password-protected one-page PDF in memory: preflight returned one page while worker extraction
  failed as encrypted, confirming finding 4.
- Repository-wide traces for trial ownership, transaction boundaries, Checkout call sites, old/new limit
  names, URL response limits, page-count persistence ordering, and active 500-page/50 MB copy.
- I relied on Claude's supplied green full backend, integration, frontend build, and frontend unit results
  and did not duplicate those broad suites.
