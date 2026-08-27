# Batch A adversarial review — Codex R5 (closing round)

Revision under review: `eb5977e` (`fix/growth-batch-a`)  
Review date: 2026-08-26  
Verdict: **BLOCK**

R4 #1 is closed for the exact post-claim acknowledgement-loss / hard-dead-worker
schedule that it reported, and R4 #2 is closed. The tokenized lease, advisory
lock, settlement marker, and trial-release transaction compose correctly once a
job is inside that protocol.

The rollout is nevertheless incomplete at the initial producer boundary. A
chat-triggered structured extraction can still commit a 25-credit predebit with
no recovery lease. If its initially accepted task is lost before any worker
claims it, both beat and startup recovery exclude the job forever. The two
adjacent predebited `DocumentJob` producers touched by the durable-settlement
round have the same accepted-message-loss exposure and are excluded by job type.
That is a real money-loss class, so the severity-honest verdict is BLOCK.

Per the request, I did not invoke Git.

## Finding

1. **[BLOCKER — accepted initial task loss can still permanently strand 25, 60, or up to 7,500 credits because lease recovery is only wired to one producer]**

   Files: `backend/app/api/extractions.py:202-215`,
   `backend/app/services/chat_tool_executor.py:142-202`,
   `backend/app/api/question_templates.py:253-315`,
   `backend/app/api/document_diffs.py:175-237`,
   `backend/app/workers/extraction_worker.py:45-54`, and
   `backend/app/models/tables.py:673-680`.

   The direct extraction endpoint initializes
   `worker_lease_expires_at = now + 45 minutes` before committing its queued
   job. The chat-native extraction producer creates the same
   `job_type="extraction"` without that field, commits the job and 25-credit
   predebit, and then publishes the task. The model column is nullable and has
   no server default, so that lease remains NULL until a worker actually
   claims the job. The watchdog selects only rows where
   `worker_lease_expires_at IS NOT NULL`; startup calls the same watchdog.

   A concrete unrecoverable schedule is therefore:

   1. `_queue_extraction()` commits the queued chat extraction and its
      unreconciled `-25` ledger row.
   2. `run_extraction_job.delay()` returns successfully, so the synchronous
      publication-failure refund branch does not run.
   3. Redis loses the message before a worker claims it (for example, the
      broker-flush failure explicitly included in the repository's watchdog
      threat model).
   4. The job remains `queued` with a NULL token and NULL lease. No late-ack
      redelivery exists because no worker reserved the message, and every beat
      or startup sweep filters the row out.
   5. There is no cancel/retry endpoint that conditionally refunds this job.
      The result is never delivered, the ledger remains unreconciled, and the
      user's balance remains 25 credits lower permanently.

   This is not confined to the chat producer. Question-template runs commit a
   predebit of `questions * documents * 15` (up to 20 * 25 * 15 = 7,500
   credits), and document comparisons commit 60 credits, before their initial
   publish. Both constructors also leave the lease NULL, and their
   `batch_template` / `document_diff` job types are excluded by the extraction
   watchdog even if the field were populated. These files were brought into
   this chain when R3's durable settlement was extended to the adjacent
   extraction-style workers, so leaving their delivery durability outside the
   new recovery contract is an internal fix-chain inconsistency rather than a
   harmless unrelated nit.

   **Required fix:** initialize a recoverable deadline for the chat extraction
   producer before its first commit. Give every predebited queued worker touched
   by this chain either the same token/advisory-lock/lease/watchdog protocol or
   an equivalent bounded recovery contract; merely populating the current
   field for `batch_template` and `document_diff` is insufficient because the
   watchdog filters on `job_type="extraction"` and those workers do not enforce
   its token ownership. Add an accepted-but-never-executed initial-publication
   test for each covered producer, with exact ledger, balance, job, result, and
   (where applicable) trial assertions. A `.delay()` exception test does not
   cover this schedule.

## R4 re-audit

1. **R4 #1 — closed for its reported schedule; closed only partially as a
   batch-wide delivery guarantee.** For direct API extractions, the first
   queued row now has a lease. The claim uses a private token, resolves an
   ambiguous commit in a fresh session, and increments a bounded attempt
   counter. The per-job session advisory lock is held across claim, model work,
   and final settlement. A second delivery cannot enter a live claim, and an
   expired claim receives at most one further live attempt before terminal
   settlement. The remaining initial-delivery hole is Finding 1, not a failure
   of the running-claim algorithm itself.

2. **R4 #2 — closed.** The backend rule accurately distinguishes PDFs that
   require an open password from readable owner-password encryption. The
   frontend rule and both architecture mirrors accurately show
   `/api/upload-token`, direct authenticated multipart upload, `status=parsing`,
   and HTTP 202 while preserving JWT injection for proxied calls. I found none
   of the named stale operational claims.

## Lease and settlement answers

- **Two workers cannot both deliver or settle a protocol-covered extraction.**
  Advisory-lock namespace 948 serializes the entire job. The row token is a
  second durable ownership check, and a watchdog dispatch token is exchanged
  for a private live token before execution.
- **The watchdog cannot reclaim a genuinely running normal extraction.** The
  45-minute lease exceeds Redis's 2,400-second visibility timeout and the
  extraction task's 420-second hard limit. More importantly, the watchdog
  takes the same advisory lock and skips while the live worker holds it. The
  45-minute beat cadence can delay recovery by another cadence, but it does not
  create an early-reclaim race.
- **Terminal recovery cannot double-refund or refund an atomically delivered
  result.** Reconcile locks and stamps `reconciled_at`; refund ownership is one
  `DELETE ... WHERE reconciled_at IS NULL RETURNING`. Balance restoration,
  failed state, lease/token clearing, and eligible trial release share the
  winning transaction. A committed success has a reconciled row plus succeeded
  job/result in the same commit and makes the delete lose.
- **Trial release is idempotent and serialized with a fresh claim.** Both use
  the user-row lock, and release is a conditional delete additionally gated on
  a terminal extraction job and absence of `ExtractionResult`. A repeated
  release returns no row; a fresh claim cannot double-spend the slot.

## Fix-chain and scope audit

- The Plus-to-Pro route, Pro credit-pack route, server-side active-subscription
  guard, and durable Checkout-attempt/idempotency flow remain intact. I found no
  duplicate-subscription or paid-to-lower-tier path.
- `feature_trial_usages` remains the sole Domain Mode entitlement source. Chat
  owner reuse, owner deletion semantics, extraction failure release, and paid
  bypass remain consistent across implementation, rules, and architecture.
- URL import remains flat-capped at 10 MB with bounded raw and gzip/deflate
  output; Brotli/Zstd/stacked encodings fail closed. Direct upload remains
  50/100/200 MB, and 750/1,500/3,000-page preflight remains before storage and
  document insertion. No page-cap regression or old Content-Type/magic budget
  selector reappeared.
- Migration `0042` is add-only and matches the ORM/index definition. The new
  startup/beat recovery and stronger backend rule are in scope for R4 #1. I
  found no unrelated weakening of the MinIO async, API proxy, i18n, Quote
  Finder, demo-accounting, or subscription invariants. The one rule/architecture
  overstatement is consequential: their extraction-delivery recovery wording
  reads as universal while Finding 1's producers remain outside it.

## Verification performed

- Relied on the supplied green results: linear `0040 -> 0041 -> 0042`, one
  Alembic head, Ruff, 876 passed / 45 skipped, 42 integration tests, Next build,
  and 12 frontend unit tests.
- `cd backend && ../.venv312/bin/python -m pytest
  tests/test_extraction_service.py tests/test_extraction_worker.py
  tests/test_extractions_api.py tests/test_chat_tool_executor.py
  tests/test_question_template_service.py tests/test_question_templates_api.py
  tests/test_document_diff_service.py tests/test_document_diffs_api.py
  tests/test_domain_mode_access.py -q` — **53 passed**.
- Traced every predebited `DocumentJob` producer and every lease-field reader.
  An AST check confirms that only `api/extractions.py` passes
  `worker_lease_expires_at` to its `DocumentJob` constructor; the chat
  extraction, batch-template, and document-diff constructors do not. Existing
  tests cover synchronous `.delay()` failure and post-claim death/commit
  ambiguity, but not accepted initial publication followed by message loss.

## Consensus

**Batch A has not reached consensus.** R4's two named findings are repaired in
their direct paths and the core lease/refund/trial protocol is sound, but the
remaining producer gap can still charge users without delivering or recovering
their work. That is within the request's explicit BLOCK class.
