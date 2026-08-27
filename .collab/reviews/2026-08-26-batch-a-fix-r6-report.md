# Batch A R6 fix report — predebited producer lease recovery

Date: 2026-08-26  
Starting revision supplied by requester: `eb5977e` on `fix/growth-batch-a`  
R5 finding accepted: `.collab/dialogue/2026-08-26-batch-a-codex-r5.md`  
Implementation status: **R5 producer-boundary blocker repaired; real-Postgres execution must be rerun outside this sandbox**

Per the request, no Git command was invoked and no Alembic downgrade was run.

## Result

The accepted-initial-message-loss hole is closed for all four predebited
`DocumentJob` producers:

- direct structured extraction;
- chat-native structured extraction;
- question-template runs; and
- document diffs.

Every producer now calls one `create_predebited_document_job()` helper. The
helper creates only recovery-registered job types, initializes the 45-minute
lease, flushes the job, performs the credit debit, and stores the ledger id and
predebit amount. The caller then commits the job, entitlement claim (where
applicable), debit, metadata, and product event together. A future paid job type
cannot use the helper until it has an explicit recovery policy.

## Implementation

### Shared producer transaction

Added `backend/app/services/predebited_job_service.py` with:

- the single 2,700-second lease constant;
- the bounded two-attempt policy;
- recovery policies for `extraction`, `batch_template`, and `document_diff`;
- `create_predebited_document_job()`, including the initial lease and canonical
  `predebit_ledger_id` / `pre_debited` metadata.

The four named producer files use this helper. Synchronous publication-failure
terminal updates also clear token/lease state.

### One lease protocol for all covered workers

Question-template and document-diff workers now enter through the same
advisory-lock/token runner as extraction:

1. advisory lock namespace 948 is held for the complete claim, model work, and
   settlement;
2. an initial delivery atomically claims `queued -> running` with a private
   token and refreshed lease;
3. a watchdog delivery carries a staged dispatch token which the worker
   atomically exchanges for a private live token;
4. success reconciles the existing ledger row, writes the result/job state,
   and clears token/lease in one commit;
5. failure and recovery exhaustion call the existing
   `_settle_extraction_predebit_after_failure_sync()` terminal resolver.

No watchdog-specific refund implementation was added. The terminal decision
remains the existing single conditional ledger
`DELETE ... WHERE reconciled_at IS NULL RETURNING id`; only its winner restores
the balance, marks the job failed, and releases an eligible undelivered
job-owned extraction trial in the same transaction. The resolver now also has
a ledger-by-`document_job` reference fallback for a malformed future producer
that omitted recovery metadata.

### Structurally complete watchdog

`requeue_stale_running_extractions` retains its deployed task name but now
sweeps every active predebited `DocumentJob`:

- discovery is correlated to an unreconciled `credit_ledger` row with
  `ref_type='document_job'`;
- there is no `job_type='extraction'` predicate;
- there is no `worker_lease_expires_at IS NOT NULL` predicate;
- an explicit expired lease is eligible;
- a NULL queued lease is eligible only after `created_at + 45 minutes`;
- a NULL running lease is eligible only after `updated_at + 45 minutes`.

Known types receive their correct tokenized Celery dispatch. If a future
producer bypasses the registered helper and has no dispatcher, the ledger-driven
watchdog still sees it and, after the full lease window, calls the same terminal
resolver with `DOCUMENT_JOB_RECOVERY_UNSUPPORTED` rather than leaving money
stranded.

### Migration 0043

Added `backend/alembic/versions/20260826_0043_expand_predebited_job_leases.py`:

- literal `down_revision = "20260826_0042"`;
- backfills every queued/running job with an unreconciled `document_job` ledger
  row, using `created_at + 45 minutes` for queued work and
  `updated_at + 45 minutes` for running work;
- adds `now() + interval '45 minutes'` as a server default;
- retains 0042's extraction-only partial index and adds a broader active-job
  lease index alongside it, preserving the beta add-only migration rule.

The column intentionally remains nullable: NULL is the terminal/no-active-lease
state and is explicitly written on success/failure. The server default plus
producer helper provide insertion defense, while the NULL-safe watchdog is the
independent recovery brace.

`alembic heads` reports one head: `20260826_0043`.

## Why a just-queued job cannot race recovery

The broker visibility timeout remains 2,400 seconds. The database lease remains
2,700 seconds, and the beat cadence remains 2,700 seconds. The longest newly
covered worker hard limit is 720 seconds. Therefore Redis redelivery gets its
normal first opportunity, while neither an explicit lease nor the NULL-age
fallback can make a new queued job eligible before the 45-minute boundary.

At that boundary, the shared advisory lock serializes a worker that is actually
claiming with the watchdog. If the worker wins, the watchdog skips. If the
watchdog wins, it stores a dispatch token before publication; a late original
delivery cannot claim a queued row bearing that token, and only the matching
recovery delivery can exchange it for a private live token. A running worker
holds the same advisory lock for its entire execution. This preserves the R5
visibility-timeout relationship without an early-reclaim window.

## Tests added/extended

`backend/tests/test_predebited_job_producer_recovery_integration.py` covers:

- chat-native 25-credit accepted-message loss, including an intentionally NULL
  lease, exact queued predebit state, exact terminal refund/balance/job/result/
  ledger/trial state, and proof that a fresh queued job is unchanged;
- a two-question/one-document question-template accepted-message loss (exact
  30-credit predebit), with the same exact terminal assertions.

The tests simulate accepted-but-lost initial and recovery publications by
letting `.delay()` return successfully without executing the task, then exhaust
the bounded leases through the real watchdog/settlement path.

Unit coverage additionally proves:

- all three registered job types always receive a future lease from the shared
  creation helper;
- an unregistered paid job type is rejected before debit;
- direct, chat-native, question-template, and document-diff producers all
  create leased jobs;
- compiled PostgreSQL watchdog SQL is ledger-driven, job-type agnostic,
  NULL-lease safe, and contains no lease `IS NOT NULL` gate.

## Verification

Passed:

- `cd frontend && npm run build`
- `cd frontend && npm run test:unit` — 12 passed
- `cd backend && ../.venv312/bin/python -m ruff check app/ tests/`
- `cd backend && ../.venv312/bin/python -m pytest -q` — 882 passed, 47 skipped
- focused producer/worker/service unit suite — 54 passed
- `cd backend && ../.venv312/bin/python -m pytest -m integration --collect-only -q`
  — 44 integration tests collected, including both new cases
- `cd backend && ../.venv312/bin/python -m alembic heads` — one head,
  `20260826_0043`

Blocked by the execution environment:

- A targeted safe integration run of the new recovery tests plus the existing
  extraction failure-window tests was attempted with `SKIP_INTEGRATION=`. The
  autouse scratch-database fixture failed before any test or migration ran:
  opening `::1:5432` raised `PermissionError: [Errno 1] Operation not
  permitted`. This workspace's network sandbox denies the localhost socket.
- The exact full integration command was not run after that deterministic
  setup failure. It also selects `tests/test_migrations.py`, whose body invokes
  `alembic downgrade base`; the task explicitly says never to run an Alembic
  downgrade. No downgrade was executed.

Required follow-up outside the restricted sandbox: run the two new integration
tests (or the integration suite with the migration downgrade test excluded) on
the dedicated local `doctalk_test` database, then obtain the normal adversarial
R6 review before commit/deploy.
