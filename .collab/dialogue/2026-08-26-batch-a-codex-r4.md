# Batch A adversarial review — Codex R4

Revision under review: `f899277` (`fix/growth-batch-a`)  
Review date: 2026-08-26  
Verdict: **BLOCK**

R3 F1's credit-minting schedule is closed, and R3 F2's attacker-selectable URL
budget is closed. I did not find a way to reconcile and refund the same
extraction ledger, a decompression path with unbounded output, a paid-feature
leak, a duplicate subscription path, or a page-cap rejection of the supplied
production population.

There is nevertheless one distinct money-loss blocker in the same extraction
worker. Its initial `queued -> running` commit is outside the protected
settlement block. An acknowledgement loss or late-ack worker death at that
commit strands the predebit without a result, and the retry/redelivery
deliberately no-ops on `running`. This is not a relitigation of the R3 minting
finding; it is the opposite failure mode: the user is charged and receives
nothing.

Per the request, I did not invoke Git.

## Findings

1. **[BLOCKER — 25 credits and the Free Domain Mode slot can be permanently stranded after the job-claim commit]**

   Files: `backend/app/services/extraction_service.py:614-647`,
   `backend/app/workers/extraction_worker.py:12-23`,
   `backend/app/workers/celery_app.py:34-42`.

   `run_extraction_job_sync()` commits the conditional `queued -> running`
   claim at line 637, before `ledger_id`, `pre_debited`, and `user_id` are
   loaded and before the `try` whose exception handler invokes the fresh-session
   resolver. The entry guard at lines 618-619 returns for every state other
   than `queued`.

   A concrete failure schedule is therefore still unsafe:

   1. The API has already committed the queued job, its 25-credit predebit, and
      (for a direct Free Domain Mode extraction) its trial claim.
   2. The worker's claim commit changes the job to `running`, but the database
      commit acknowledgement is lost. Equivalently, because Celery uses
      `task_acks_late=True`, the worker can die immediately after that commit.
   3. The commit exception is outside the settlement `try`, so Celery's
      `autoretry_for=(Exception,)` schedules a retry. A worker-death redelivery
      reaches the same state after the visibility timeout.
   4. The next invocation reads `running` and returns successfully at lines
      618-619. It neither performs the extraction nor conditionally refunds the
      unreconciled ledger.
   5. No stale-running `DocumentJob` watchdog or retry/cancel API repairs this
      state. The job remains `running`, the ledger remains unreconciled, the
      user remains down 25 credits, and a job-owned Domain Mode slot remains
      unusable. Deleting the owner cannot restore the slot by design.

   The new acknowledgement-loss integration test starts its fault injection at
   the *second* worker commit, so it correctly proves the final success
   settlement but does not cover this first commit.

   **Required fix:** make the claim phase recoverable without allowing two
   workers to deliver/settle the same job. One sound shape is a per-job lease or
   advisory lock plus stale-running recovery: an ambiguous claim commit is
   resolved in a fresh session, and an unacknowledged hard-dead worker can be
   reclaimed only after a bounded lease. A terminal recovery that gives up
   must use the existing conditional ledger delete and commit refund, failed
   job state, and eligible trial release atomically. Add both “claim commit
   landed, acknowledgement lost” and “worker dies after claim, late-ack task is
   redelivered” tests with exact balance/ledger/job/trial assertions.

2. **[LOW — the named living documentation still contains false operational claims]**

   Files: `.claude/rules/backend.md:21`, `.claude/rules/frontend.md:13`,
   `docs/ARCHITECTURE.md:109-115`, `docs/ARCHITECTURE.md:142`, and the mirrored
   `docs/ARCHITECTURE.zh.md:109-115,142`; implementation:
   `backend/app/services/document_limits.py:39-46`,
   `frontend/src/lib/api.ts:120-136`.

   Two statements need correction:

   - The backend rule says **encrypted PDFs** fail closed. The implementation
     rejects PDFs only when PyMuPDF reports `needs_pass`. An owner-password
     encrypted PDF with an empty user/open password is intentionally readable
     and accepted; a non-empty open password is rejected. The accurate phrase
     is “password-locked PDFs” or “PDFs requiring an open password.” A focused
     AES-256 probe reproduced both outcomes.
   - The frontend rule says **all** frontend-to-backend requests use
     `/api/proxy/*`, and both architecture documents show multipart upload
     through that proxy. `uploadDocument()` explicitly obtains an
     `/api/upload-token` and posts the multipart body directly to
     `NEXT_PUBLIC_API_BASE` to avoid Vercel's body limit. The diagram also says
     `status=uploading` and HTTP 201, while the current path creates
     `status=parsing` and returns 202. This is operationally important: obeying
     the rule literally would regress 50/100/200 MB uploads.

   The newly edited 10 MB URL, 50/100/200 MB direct-upload, and
   750/1,500/3,000-page statements themselves are accurate. The four affected
   user-facing keys are present and consistent across all 11 locale files.

## R3 findings re-audit

1. **R3 F1 — closed for the reported successful-result refund/mint race.**
   `_reconcile_sync()` locks the ledger with `SELECT ... FOR UPDATE` and always
   stamps `reconciled_at`, including equal actual/predebit cost.
   `_refund_predebit_sync()` uses one conditional
   `DELETE ... WHERE reconciled_at IS NULL RETURNING id`; every refund site in
   the extraction worker and queue-publication paths found by repository search
   uses the same condition. The final success `db.commit()` is inside the
   protected `try`; every exception from it rolls back locally and calls
   `_settle_extraction_predebit_after_failure_sync()`, which creates a fresh
   `SyncSessionLocal`. A reconciled row produces a no-op and no job overwrite.
   Resolver failure only logs `*.unresolved`; it never falls through to another
   refund. If the conditional delete wins, balance restoration, failed job
   state, and eligible job-owned trial deletion share the resolver's one
   transaction and commit. SQL failure rolls them all back. Finding 1 above is
   an earlier claim-transition durability gap, not a surviving reconcile/refund
   race.

2. **R3 F2 — closed.** The authenticated plan no longer influences the URL
   reader; `ingest_url()` calls `fetch_and_extract_url(url)` with its flat 10 MB
   default. PDF magic is consulted only after the bounded read, so it cannot
   select a larger budget. Redirect responses are not iterated, and every final
   response is read independently. `Content-Length` is only an early rejection;
   missing, false, and chunked lengths still reach byte counting.

   The final reader uses `iter_raw()`, counts both yielded raw bytes and
   HTTPX's downloaded-byte counter, and checks them before decoding/appending
   the crossing chunk. Gzip/deflate output is emitted through
   `decompress(..., max_length)` with at most the remaining budget plus one
   rejection byte. Brotli, Zstandard, and stacked encodings are rejected before
   body iteration. Incomplete and concatenated compressed streams also fail
   closed. An unknown-length transport may necessarily consume one bounded
   HTTPX network chunk (64 KiB in the pinned HTTPX/httpcore versions) beyond the
   logical threshold before it can know the body is oversized, but that chunk
   is not decoded, appended, returned, or allowed to grow without bound. The
   accepted decoded payload never exceeds 10 MB.

## Batch-wide regression sweep

- **Domain Mode:** claims still serialize on the user row, existing session
  owners get unlimited follow-ups, owner deletion cannot resurrect a slot, and
  the direct extraction release is gated by terminal failed/cancelled state,
  absence of an `ExtractionResult`, and the same transaction as the winning
  refund. Chat-owned claims intentionally survive downstream failures because
  their session remains reusable. I found no second entitlement source or
  ungated backend entry point.
- **Checkout and plan routing:** all direct subscription creation funnels
  through `startCheckout`; known Free users create Checkout, Plus-to-Pro actions
  go to the confirmed change-plan path, and Pro credit exhaustion goes to
  credit packs. The server's active-subscription guard and durable
  `checkout_attempts`/Stripe idempotency keys remain in place. I found no
  double-subscription or paid-to-lower-tier path.
- **File-size and page limits:** direct upload remains 50/100/200 MB; URL import
  is flat 10 MB. Direct upload and both URL branches page-count before MinIO and
  `documents` insertion. Non-PDF preflight uses the same deterministic extractor
  as parsing, while PDF uses its page tree. Reparse does not apply the new
  ingress cap. Given the supplied production maximum of 696 pages and that all
  164 users are Free, every current document is below the 750-page Free cap;
  the cap cannot retroactively reject an existing row.
- **User-facing limits:** homepage, multi-format, error, pricing, and active
  format-article copy inspected all distinguish direct-upload plan caps from
  the flat URL cap and use 750/1,500/3,000 pages. No surviving global 500-page
  or unqualified global 50 MB claim was found on the affected active surfaces.

## Verification performed

- Relied on Claude's supplied single Alembic head, Ruff, 871-test backend,
  39-test integration, Next build, and 12-test frontend results.
- `cd backend && ../.venv312/bin/python -m pytest
  tests/test_extraction_service.py tests/test_url_extractor.py
  tests/test_document_limits.py tests/test_domain_mode_access.py
  tests/test_extractions_api.py tests/test_billing_logic.py -q` — **63 passed**.
- `cd frontend && npm run test:unit` — **12 passed**.
- Inspected HTTPX 0.28.1/httpcore 1.0.9 raw iteration: HTTPX's byte chunker does
  not eagerly content-decode `iter_raw()`, and httpcore bounds HTTP/1.1 socket
  reads at 65,536 bytes.
- Generated owner-only and open-password AES-256 PDFs and ran the real
  `count_document_pages()` to verify the documentation distinction above.
- Repository-wide traces covered every extraction ledger delete/reconcile
  call, worker/queue transaction boundary, Domain Mode owner/release query,
  checkout caller, page-limit enforcement site, URL-reader caller, and affected
  locale key.
