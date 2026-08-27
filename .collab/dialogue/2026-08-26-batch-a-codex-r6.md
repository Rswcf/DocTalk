# Batch A adversarial review — Codex R6

Revision under review: `6d7d15f` (`fix/growth-batch-a`)  
Review date: 2026-08-26  
Verdict: **BLOCK**

R5's exact accepted-initial-message-loss blocker is closed. All four current
predebited producers create their job, canonical ledger metadata, debit, and
initial lease through one helper in the caller's transaction; all three job
types run through the same advisory-lock/token protocol; and the ledger-driven,
NULL-safe watchdog can recover a lost initial publication.

The batch is still not shippable. A different lifecycle edge can remove the
`DocumentJob` which now anchors all of that recovery while leaving its
unreconciled ledger and debited balance behind. User-triggered document or
collection deletion therefore permanently strands 25, 60, or up to 7,500
credits and can also strand a job-owned Free Domain Mode slot. This meets the
request's explicit money-loss BLOCK bar.

Per the request, I did not invoke Git.

## Findings

1. **[BLOCKER — deleting a source document or collection can permanently orphan an active predebit after the recovery anchor cascades away]**

   Files: `backend/app/models/tables.py:566-575`, `:869-879`, `:896-906`;
   `backend/app/services/doc_service.py:119-178`;
   `backend/app/api/collections.py:206-217`;
   `backend/app/workers/extraction_worker.py:24-53`;
   `backend/app/services/extraction_service.py:674-730`, `:1057-1079`.

   `DocumentJob.document_id` and `DocumentJob.collection_id` both use
   `ON DELETE CASCADE`. The normal document and collection deletion endpoints
   hard-delete those parent rows without checking, cancelling, or settling
   queued/running predebited jobs. In contrast, `CreditLedger.ref_id` is only a
   string, has no FK to `document_jobs`, and the ledger's user FK does not fire
   while the account remains present. `FeatureTrialUsage.owning_job_id` uses
   `ON DELETE SET NULL`.

   A concrete permanent-loss schedule is:

   1. Any of the four producers commits a queued job and an unreconciled
      `ref_type="document_job"` debit. This is 25 credits for direct/chat-native
      extraction, 60 for a document diff, or up to 7,500 for a question-template
      run.
   2. Before terminal settlement, the user deletes the referenced document.
      A collection-scoped template/diff has the same outcome if the user deletes
      its collection. Neither deletion path takes advisory-lock namespace 948
      or performs an active-job check.
   3. PostgreSQL cascades the `DocumentJob` away. The unreconciled ledger row
      remains, the user's balance remains reduced, and a direct Domain Mode
      extraction's trial pointer becomes NULL.
   4. A queued task now no-ops because its job is missing. A running worker can
      also lose this race: deletion does not participate in its advisory lock;
      its eventual result/ledger commit cannot succeed once the job FK target is
      gone.
   5. The broadened watchdog still cannot repair this state. Its query starts
      from `DocumentJob` and asks whether a matching ledger exists, so it cannot
      discover a ledger whose job was deleted. The shared terminal resolver
      also loads the job first and raises `"job ... not found"` before its
      ledger-reference fallback. There is no cancel/retry/orphan-ledger sweep.

   This is not the intentional anti-reset rule for deleting a trial owner. That
   rule may keep an entitlement consumed, but it cannot justify retaining a
   monetary predebit after both the work and its recovery record were destroyed.

   **Required fix:** make parent deletion participate in the predebited-job
   lifecycle. One safe shape is to lock the parent row, reject deletion with 409
   while an active unreconciled job exists, and make every producer's FK insert
   serialize with that lock. Another is to conditionally refund/cancel every
   affected job (and release only eligible undelivered extraction trials) in the
   deletion transaction before deleting the parent. Do not add a blind refund;
   retain the existing conditional ledger-delete settlement decision. Cover
   queued and running document deletion, collection deletion, and a concurrent
   producer-vs-delete schedule in real Postgres, with exact job/result/ledger/
   balance/trial assertions.

2. **[LOW — the generalized recovery contract is ahead of its proof and living-document mirrors]**

   Files: `backend/tests/test_predebited_job_producer_recovery_integration.py:122-323`,
   `backend/tests/test_extraction_worker.py:56-73`,
   `docs/ARCHITECTURE.zh.md:1044`, `docs/ARCHITECTURE.md:715-716`, and
   `backend/app/services/extraction_service.py:51-58`.

   The new real-Postgres accepted-publication-loss file covers chat-native
   extraction and question templates, but not direct extraction or document
   diff, despite R5 asking for the schedule at every covered producer. Unit
   tests prove that all four producers receive a lease, and the execution path
   is genuinely shared, so this is missing regression proof rather than evidence
   that those two paths are broken. The age predicate itself is tested mainly by
   compiled SQL plus one fresh chat-native job assertion; there is no durable
   matrix for just-before/at/after expiry, running-lock-held, or long queue delay.

   The Chinese architecture mirror still describes migration `0042` and
   extraction jobs only, omitting `0043`, the three-type helper, ledger-driven
   discovery, and NULL fallback. The English ERD still labels the claim token and
   attempt count as extraction-only. The shared runner's comment still says the
   worker hard limit is seven minutes even though the newly covered template
   worker's limit is twelve. These are non-functional but should be cleaned up
   with the blocker fix.

## R5 blocker re-audit

**Closed for the reported schedule, not closed merely in appearance.**

- Repository-wide call tracing found exactly one active creator of a
  `ref_type="document_job"` debit: `create_predebited_document_job()`. Direct
  extraction, chat-native extraction, question-template runs, and document
  diffs all call it. Other `DocumentJob` constructors (tables and layout
  translation) have zero credit predebits and cannot satisfy the watchdog's
  ledger predicate.
- The helper rejects a new job type until `RECOVERY_POLICIES` has an entry,
  initializes the lease before the producer commit, and stores canonical
  `predebit_ledger_id`/`pre_debited` metadata. Migration `0043` backfills active
  predebits and adds the matching server default.
- The watchdog no longer filters by job type or requires a non-NULL lease. A
  malformed producer using the canonical ledger reference is visible; a known
  type is dispatched correctly, while an unknown type is conditionally refunded
  after the full age window rather than left charged forever.
- Question-template and document-diff workers now use
  `run_leased_predebited_document_job_sync()`, so token exchange, ambiguous-claim
  resolution, advisory-lock ownership, bounded recovery, reconcile, and terminal
  refund are not extraction-only implementations.

The helper remains a code convention rather than a database prohibition: a
future producer could bypass it and choose a non-canonical ledger reference.
The server default and unknown-type terminal path are strong defense for a
producer that at least uses `ref_type="document_job"`; an AST/architecture test
that makes that reference exclusive to the helper would prevent another silent
bypass. The current tree has no such bypass.

## Is the broadened sweep too aggressive?

**Not against a legitimately executing current worker.** The candidate SELECT
is only a prefilter. Before staging or terminalizing, recovery takes the same
session advisory lock held across each registered worker's claim, model work,
and final settlement, then re-reads the row. An expired timestamp or a quiet
`updated_at` cannot reclaim a worker that still owns that lock. I independently
forced an expired candidate with the advisory lock busy; the watchdog returned
zero without entering the staging function.

The timing boundaries are also safe for the concrete current tasks:

- lease = 2,700 seconds; Redis visibility = 2,400 seconds;
- hard limits are 420 seconds (extraction), 720 seconds (question template), and
  600 seconds (document diff), all far below the lease;
- declared retry backoffs are 30 or 60 seconds, also far below the lease;
- OCR/layout translation and table work do not carry a `document_job` credit
  predebit and therefore are excluded by the unreconciled-ledger predicate;
- the NULL `created_at`/`updated_at` fallback is relevant only to legacy or
  malformed rows. Current producers and migration `0043` supply a non-NULL
  lease, and a worker claim refreshes it.

There is one availability tradeoff to track. A task that remains legitimately
*queued but never starts* during a severe default-queue backlog has no advisory
lock. Watchdog publication spends the bounded attempt before the recovery
message starts. With the present 45-minute lease and cadence, a never-started
fresh job can be terminally failed and fully refunded after roughly 135–180
minutes; a worker that hard-died after claim can reach terminal recovery roughly
90–135 minutes later. This does not charge for or duplicate work, and it is
preferable to an unbounded predebit during an outage, but it should be treated as
an explicit queue-SLA choice. If eventual execution through multi-hour backlog
is required, attempts need a worker-start signal or a longer absolute queue
deadline. It is not an early-reclaim defect for the current running/backoff/OCR
examples.

## Fix-chain audit

- R3's settlement marker remains intact: synchronous reconciles lock and stamp
  the ledger, refunds condition on `reconciled_at IS NULL`, and final-commit
  ambiguity uses a fresh resolver. Recovery exhaustion reuses that resolver.
- Domain Mode still has one durable entitlement source; claim/release locking,
  same-session chat reuse, and delivered-result gating are unchanged. Finding 1
  is a parent-deletion bypass around that terminal path.
- The plan-aware subscription routes, active-subscription server guard, durable
  Checkout attempts/idempotency keys, flat 10 MB URL cap, bounded decompression,
  password/page preflight, and 50/100/200 MB plus 750/1,500/3,000-page limits
  remain consistent with R5's re-audit. I found no revived paid-feature leak,
  duplicate Checkout path, cap bypass, or successful-result refund race.
- Migration `0041 -> 0042 -> 0043`, ORM defaults/indexes, and the English
  durable-settlement narrative agree. The Chinese/ERD/comment lag is Finding 2.

## Verification performed

- `cd backend && ../.venv312/bin/python -m pytest
  tests/test_predebited_job_service.py tests/test_extraction_worker.py
  tests/test_extraction_service.py tests/test_question_template_service.py
  tests/test_document_diff_service.py tests/test_chat_tool_executor.py
  tests/test_extractions_api.py tests/test_question_templates_api.py
  tests/test_document_diffs_api.py -q` — **54 passed**.
- Runtime inspection confirmed lease 2,700 seconds, visibility 2,400 seconds,
  recovery policies for all three job types, and all registered hard limits
  below the lease.
- A focused watchdog probe confirmed an expired candidate is skipped without
  staging while the shared advisory lock is held.
- Model/FK introspection confirmed `DocumentJob.document_id` and
  `.collection_id` are `CASCADE`, `CreditLedger.ref_id` has no FK, and
  `FeatureTrialUsage.owning_job_id` is `SET NULL`. A resolver probe confirmed a
  missing job raises before ledger fallback.
- I attempted the two focused real-Postgres recovery files with
  `SKIP_INTEGRATION=`. The scratch fixture was blocked before tests by this
  sandbox's localhost-socket denial (`::1:5432`, `PermissionError`); no database
  mutation ran. I therefore rely on Claude's supplied **44 passed** integration
  result for executable Postgres coverage.

## Consensus

**Batch A has not reached consensus.** R5's producer-boundary finding is
substantively repaired, and the broadened sweep does not steal current live
work. The parent-deletion schedule still removes the only recoverable job anchor
while retaining the user's unreconciled charge, so Batch A remains BLOCKED.
