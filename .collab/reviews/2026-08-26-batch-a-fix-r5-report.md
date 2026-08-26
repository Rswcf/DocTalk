# Batch A R4 findings — R5 fix report

Date: 2026-08-26  
Input revision: `f899277` on `fix/growth-batch-a`  
R4 verdict addressed: **BLOCK**  
Git commands invoked: **none**

## Outcome

Both accepted findings are implemented.

- **F1 (BLOCKER): closed in code and covered by new real-Postgres schedules.**
  Structured extraction now uses a durable per-job claim token, bounded claim
  attempts, a 45-minute lease, and a dedicated session advisory lock for the
  complete task. A claim-commit acknowledgement loss is resolved in a fresh
  session. A different delivery cannot enter a live `running` claim, and it
  cannot reclaim a hard-dead worker before lease expiry.
- **F2 (LOW): closed in all named living documentation.** The PDF rule now
  describes PDFs requiring an open password, and the frontend/architecture
  docs now show the actual direct multipart upload flow, JWT acquisition,
  `status=parsing`, and HTTP 202 response without weakening JWT injection on
  proxied paths.

## F1 implementation

### Durable claim and serialization

Migration `20260826_0042` (literal `down_revision = "20260826_0041"`) adds to
`document_jobs`:

- `worker_claim_token`
- `worker_claim_attempts`
- `worker_lease_expires_at`
- a partial extraction-lease index

The migration initializes existing queued/running extraction rows so they are
recoverable after rollout. Alembic reports the single head as
`20260826_0042`.

`run_extraction_job_sync()` now follows the parse-worker house pattern:

1. Acquire session advisory lock namespace 948 on the job id and hold it for
   the complete claim + model + settlement path. Unlock failure invalidates
   the connection rather than returning a session lock to the pool.
2. Lock the `DocumentJob` row and claim queued work, or reclaim `running` only
   after the durable lease expires.
3. Commit a unique private live-claim token, attempt count, and 45-minute
   deadline. If COMMIT acknowledgement is ambiguous, open a fresh session and
   match that token; if the transaction did not land, the fresh session retries
   the same tokenized claim.
4. Re-open a work session and require both `status=running` and the exact live
   token before model delivery or settlement.

The 45-minute lease is strictly longer than Redis
`visibility_timeout=2400` seconds. The new beat cadence is also 45 minutes,
strictly longer than visibility timeout as required.

### Watchdog and bounded recovery

Celery beat task `requeue_stale_running_extractions` and startup recovery call
the same age-gated logic. It scans only expired queued/running extraction
leases, acquires the same advisory lock, and spends at most one recovery
attempt.

The watchdog stages a queued dispatch token rather than reusing the live
worker token. The recovery worker atomically exchanges that public dispatch
token for a new private live token. This closes the adversarial race where a
duplicate recovery message could otherwise reuse a dead worker's token before
lease expiry. A tokenized recovery that briefly loses the advisory-lock race
raises into Celery autoretry; an ordinary untokenized duplicate safely no-ops.

Publication occurs only after the durable staged-claim commit. An ambiguous
publication is safe: if the message landed, only the exact staged token can
claim it; if it did not, the lease expires. A second expired claim is terminal.

### Atomic terminal give-up

Recovery exhaustion uses the fresh-session settlement resolver. The one
transaction performs:

1. `DELETE credit_ledger ... WHERE reconciled_at IS NULL RETURNING id`
2. exact predebit balance restoration only if that conditional delete wins
3. `DocumentJob.status = failed`, code
   `EXTRACTION_RECOVERY_EXHAUSTED`, completed timestamp, and lease/token clear
4. eligible job-owned Domain Mode trial deletion, guarded by terminal failed
   state and absence of `ExtractionResult`
5. one commit

If the ledger was already reconciled or removed, the resolver rolls back and
does not overwrite a successful result/job.

### Failure-window tests

`tests/test_extraction_billing_failure_windows_integration.py` now covers:

- final success COMMIT landed / acknowledgement lost (existing schedule,
  retained after the claim refactor)
- **claim COMMIT landed / acknowledgement lost**: asserts a fresh resolution
  session, one claim attempt, succeeded job, exact `-9` balance, reconciled
  `-9` ledger, one usage/result, and retained trial
- **worker dies after claim / late-ack redelivery**: first asserts the exact
  stranded intermediate state (`running`, balance `-25`, unreconciled `-25`
  ledger, no result/usage, trial retained); asserts the 40-minute broker
  redelivery cannot enter before the 45-minute lease; after expiry it reclaims
  exactly once and ends at succeeded / exact `-9` / reconciled ledger / result
  delivered / trial retained
- **second claim expires**: watchdog dispatches nothing and atomically produces
  failed job / exact full balance restoration / ledger absent / result absent /
  usage absent / trial released

Non-integration tests also assert both lease and beat cadence exceed visibility
timeout, recovery lock-busy retry behavior, ordinary duplicate no-op behavior,
empty-watchdog behavior, and token forwarding.

## F2 documentation corrections

- `.claude/rules/backend.md`: replaced “encrypted PDFs” with
  “password-locked PDFs (PDFs requiring an open password)” and explicitly
  records that owner-password encryption with an empty open password is
  readable/accepted.
- `.claude/rules/frontend.md`: records the exact exception to proxy routing:
  `GET /api/upload-token` followed by a direct multipart POST to
  `${NEXT_PUBLIC_API_BASE}/api/documents/upload`; preserves mandatory JWT
  injection for every proxied request including SSE.
- `docs/ARCHITECTURE.md` and `docs/ARCHITECTURE.zh.md`: corrected the topology,
  component role, upload sequence, step 1 narrative, and dual-JWT explanation.
  Both diagrams now show direct upload, document creation at `status=parsing`,
  and HTTP 202 rather than proxy multipart / `status=uploading` / HTTP 201.
- Both architecture mirrors also document migration `20260826_0042` and the
  claim/lease/watchdog settlement contract.

Repository search found no remaining named false phrases (`status=uploading`,
upload HTTP 201, multipart through `/api/proxy/documents/upload`, “all backend
requests” through the proxy, or the encrypted-PDF fail-closed claim) in the
affected living docs.

## Verification

Passed:

- `cd frontend && npm run build` — PASS (425 static pages generated)
- `cd frontend && npm run test:unit` — PASS (12/12)
- `cd backend && python3 -m ruff check app/ tests/` using the repository Python
  3.12 venv on `PATH` — PASS
- `cd backend && python3 -m pytest -q` using the repository Python 3.12 venv on
  `PATH` — PASS: **876 passed, 45 skipped**
- focused extraction unit/API/worker tests — PASS: **24 passed**
- `python3 -m alembic heads` — PASS: one head, `20260826_0042`
- `python3 -m alembic upgrade head --sql` — PASS through 0042; the emitted SQL
  confirms the literal 0041→0042 edge and partial lease index
- integration collection — PASS: 42 integration tests collected, including all
  four extraction failure-window tests

Environment-blocked:

- `cd backend && SKIP_INTEGRATION= python3 -m pytest -m integration -q` cannot
  execute in this Codex sandbox. The focused extraction integration invocation
  reached the session provisioner but every test setup was denied opening
  `::1:5432` with `PermissionError: [Errno 1] Operation not permitted`.
  `docker compose ps` independently confirmed the sandbox also denies access
  to `~/.docker/run/docker.sock`. This is an environment restriction, not a
  test assertion failure. No Alembic downgrade was invoked.

The live-Postgres integration suite therefore remains the one required rerun
outside this sandbox before merge acceptance.
