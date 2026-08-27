# Batch A R7 fix report — predebited DocumentJob lifecycle closure

Input revision: `6d7d15f` (`fix/growth-batch-a`)  
Implementation date: 2026-08-27  
R6 finding: accepted  
Git usage: none

## Outcome

R6's document/collection deletion blocker is fixed in code, and the rest of
the unreconciled `ref_type="document_job"` class was enumerated in this report
instead of being handled one vector at a time.

The minimum safe shipping subset is now present:

1. normal document and collection deletion settles every active predebit before
   its parent CASCADE;
2. deletion and workers share advisory-lock namespace 948 and deletion rechecks
   after acquiring the lock;
3. historical/out-of-band job deletion is recovered from the orphan ledger;
4. failed/cancelled, undelivered terminal jobs with unreconciled ledgers are
   swept even though they are outside the active-lease query;
5. an orphan extraction refund may release exactly its matching NULL-owner
   Domain Mode slot; and
6. architecture tests prevent an unregistered producer/dispatcher from
   silently recreating the class.

No second refund implementation was added. All new paths delegate to
`_settle_extraction_predebit_after_failure_sync()`, whose only settlement
decision remains `_refund_predebit_sync()`'s atomic conditional
`DELETE ... WHERE reconciled_at IS NULL RETURNING id`.

I cannot give an unconditional executable-consensus verdict from this sandbox:
all tests that require local PostgreSQL fail in fixture setup because loopback
socket access to `::1:5432` is denied with `PermissionError`. The new four-case
real-Postgres suite is committed as code but must be run in Claude's/local CI
environment before shipping. No database mutation or Alembic downgrade ran in
this sandbox.

## Part 1 — R6 blocker fix

### Parent deletion protocol

`DocService.delete_document()` and `DELETE /api/collections/{id}` now select the
parent `FOR UPDATE` before doing lifecycle work. That parent lock provides the
PostgreSQL FK serialization point: a producer that already inserted a child
finishes first and becomes visible to deletion; a producer that attempts its
child insert after the lock waits and then loses its FK insert after the parent
delete, rolling back job, trial claim, and debit together.

`settle_active_predebited_jobs_before_parent_delete()` then:

- discovers queued/running jobs under the parent only when a matching
  unreconciled document-job ledger exists;
- acquires `pg_advisory_xact_lock(948, hashtext(job_id))`, the exact namespace
  and key used by all covered workers;
- re-reads status and ledger state after the lock wait, so a worker that claimed
  between discovery and deletion may finish first without being refunded;
- invokes the existing terminal resolver with a deletion-specific failure code;
- releases an eligible extraction trial in the same refund transaction; and
- lets the parent CASCADE run only after all candidates have settled.

If terminal settlement raises, parent deletion raises and its transaction rolls
back. The recovery anchor therefore remains rather than failing open into the
R6 state.

### Historical orphan repair and NULL-owner trial self-healing

The existing terminal resolver now accepts the case where the job is already
gone. It derives user, amount, and reason only from the still-unreconciled
canonical ledger, applies the same conditional refund, and commits no invented
job state.

The existing beat/startup watchdog now performs two bounded (500-row) defensive
sweeps before active lease recovery:

- failed/cancelled jobs with no `ExtractionResult` and an unreconciled ledger;
- unreconciled document-job ledgers for which no `DocumentJob` exists.

Both take the same per-job advisory lock. For an orphan extraction refund, the
trial release matches a NULL-owner `FeatureTrialUsage` by user, feature, and the
ledger row's `created_at`. Job trial and predebit rows use PostgreSQL's
transaction-scoped `now()`, so this restores the lost association while
preserving unrelated NULL-owner chat slots and successful consumed trials.
A reconciled ledger never enters this path.

## Part 2 — complete class enumeration

Current predebits are 25 credits for direct/chat-native extraction, 60 credits
for document diff, and 15 credits per question-document template cell (maximum
20 × 25 × 15 = 7,500).

| # | Vector and concrete schedule | Credits at risk | Predates Batch A? | Disposition |
|---|---|---:|---|---|
| 1 | **Normal document deletion.** A direct extraction, direct document-template run, or diff anchored to its new document commits its debit; the user deletes that document before settlement; `ON DELETE CASCADE` removes the job while the string ledger survives. | 25; 15–300 for a one-document template; 60 | **Yes.** `doc_service.py` never referenced `DocumentJob` before this batch and the FK was already CASCADE. | **Fixed here.** Parent `FOR UPDATE` + namespace-948 lock + post-lock recheck + existing terminal resolver before delete. |
| 2 | **Normal collection deletion.** A collection template/diff commits, then its collection is deleted before settlement. | 60 or 15–7,500 | **Yes.** Same pre-existing CASCADE/service gap. | **Fixed here.** Same protocol in `api/collections.py`. |
| 3 | **Worker claim versus parent deletion.** Deletion discovers a queued job; a worker takes namespace 948 and changes it to running before deletion can cascade. Without shared locking, deletion could erase the row during model work/final commit. | Any: 25 / 60 / up to 7,500 | **Yes.** Deletion previously did not participate in the worker lock. | **Fixed here.** Worker may finish while deletion waits; deletion rechecks the unreconciled predicate after acquiring the lock. A won success is retained/charged; a won failure is not double-refunded. |
| 4 | **Producer versus parent deletion.** A producer verifies the parent while deletion begins, or inserts its FK child just before/after deletion's initial read. | Any | **Yes.** Producers and deletion previously had no shared parent serialization point. | **Fixed here for FK-owned parents.** Parent `FOR UPDATE` serializes the child FK insert. Input-only dependencies are covered separately in rows 8–9. |
| 5 | **Direct job deletion or direct document/collection SQL/ORM deletion.** An admin console, maintenance script, test helper, or future endpoint bypasses the lifecycle service and deletes a job or cascading parent. The ledger has no FK and remains. | Any | **Yes.** This is structural and includes already-stranded R6 rows. | **Fixed defensively here.** Ledger-driven orphan sweep takes namespace 948 and calls the same resolver. Repository audit found no current production admin/script job-delete path; QA cleanup paths generally call `doc_service`. The backstop covers future/out-of-band bypasses. |
| 6 | **User/account deletion CASCADE.** Auth adapter or `/me` deletes `users`; `DocumentJob`, `CreditLedger`, and `FeatureTrialUsage` all cascade in the same transaction (documents themselves use SET NULL). | No balance remains for a live account; no orphan ledger survives. | **Yes.** | **No change; already safe for this class.** A worker may waste in-flight compute, but there is no surviving charged balance or unreconciled ledger. `/me` document cleanup now also uses the fixed document path before final account deletion. |
| 7 | **Document reparse.** Reparse retains the `documents` row/job anchor and deletes/rebuilds only Qdrant vectors, pages, chunks, briefs, and elements. A structured worker may observe `status='parsing'` and fail/refund, or run after the document is ready. | Temporarily any applicable amount | **Yes.** | **No anchor-loss fix needed.** The job and ledger remain discoverable; ordinary worker failure or lease recovery settles them. Semantic coordination between reparse and structured work is a possible UX follow-up, not a money-stranding vector. |
| 8 | **Input-only document deletion/replacement.** A diff's old document and a collection template's member documents are stored in `input_scope`; the job FK is the new document and/or collection. Deleting an input-only document therefore does not cascade the job. | 60 or up to 7,500, temporarily | **Yes.** | **No durability fix needed.** The live job anchor remains. The worker either uses its already-loaded inputs or detects missing/not-ready documents and invokes terminal settlement. “Replace/import translated document” creates a new document and does not remove the original job anchor. Defer eager semantic cancellation to a workbench UX batch. |
| 9 | **Collection-document association removal.** A member is removed from `collection_documents` while a collection template/diff is queued/running. The association CASCADE affects only the junction row; `DocumentJob` does not reference it. | 60 or up to 7,500, temporarily | **Yes.** | **No anchor-loss fix needed.** `input_scope` is a committed snapshot and the document/collection anchors remain. Defer policy on whether an in-flight snapshot should honor later membership changes; it is not settlement hardening. |
| 10 | **Broker flush/loss beyond the initial accepted-message ambiguity.** A queued message disappears later, an unacked late-ack task is lost, or Redis loses all task state. | Any until recovery | The outage modes predate Batch A; generalized leases/watchdog are Batch A work. | **Already fixed by R5/R6 structure.** Database lease/attempt/token state is authoritative. Beat/startup republishes after the 45-minute lease and terminally refunds after the bounded attempts. |
| 11 | **Celery result-backend loss.** The task executes but Celery cannot retain an `AsyncResult`. | None from result-backend loss itself | **Yes.** | **No change; not a dependency.** Product result, job state, usage, and reconciliation are committed atomically in PostgreSQL; no settlement decision reads the Celery result backend. |
| 12 | **Supported job type has no registered worker/dispatcher.** A message is accepted but workers report “unregistered task,” or code adds a recovery policy without a dispatcher/import. | Any until lease exhaustion | Deployment/config risk predates; three-type registry is Batch A. | **Fixed/guarded here.** Current policy keys exactly equal dispatcher keys and all three worker modules are in `celery_app.conf.include`; a unit architecture test enforces both. Deployment skew still ages into terminal refund because the message never claims the DB job. |
| 13 | **Celery retries exhausted, including tokenized lock-busy retries.** A recovery delivery uses its one Celery retry while another holder owns the advisory lock, or a worker process hard-dies after claim. | Any until the next lease sweep | **Yes;** generalized lease recovery is Batch A. | **Already safe.** The staged token/lease remains in PostgreSQL after message loss. The next expiry either stages the remaining bounded attempt or terminally refunds. Ordinary execution exceptions settle immediately; resolver failure leaves the active anchor for another sweep. |
| 14 | **Failed/cancelled terminal job with no result but unreconciled ledger.** Historical/manual code commits terminal status without winning/committing its refund; the active-only lease query ignores it forever. | Any | **Plausibly yes** for legacy/manual states; current failure paths are atomic. | **Fixed here.** A new terminal-undelivered ledger sweep reuses the resolver and eligible trial release under namespace 948. |
| 15 | **Contradictory succeeded job with unreconciled ledger.** Manual corruption or a non-atomic future producer marks success/delivers a result without stamping the ledger. | Any | Not reachable through current atomic success transactions; corruption class is pre-existing structurally. | **Deferred deliberately.** Automatic refund could make delivered work free; automatic reconcile lacks trustworthy actual cost. Fail closed and require an audited repair tool/manual evidence. |
| 16 | **Producer bypasses the helper or uses noncanonical/multiple ledger refs.** A future/raw producer creates `ref_type='document_job'` with a ref not equal to its job UUID, or creates multiple unreconciled ledgers for one job. A crafted ref that coincides with another live UUID can evade orphan matching; duplicates lack a database uniqueness constraint. | Arbitrary; current product maxima are 25 / 60 / 7,500 | Structural possibility predates; R5 called out the code-convention boundary. No current caller does this. | **Cheap part fixed here:** AST test makes `debit_credits(... ref_type='document_job')` exclusive to `create_predebited_document_job()`, and unknown canonical types terminally refund. **Schema enforcement deferred** because it needs a new migration beyond required head `0043` and legacy-data validation. Recommend a partial unique index plus a durable FK/tombstone design in the hardening batch. |
| 17 | **Recovery infrastructure is absent indefinitely.** Broker loss combines with disabled Celery beat and no API restart/startup recovery, or the database remains unavailable across every retry. | Any for outage duration | **Yes; operational.** | **Deferred to dedicated hardening/operations.** Code cannot settle while PostgreSQL is unreachable. Add alerts for oldest unreconciled document-job ledger, beat liveness, orphan count, and `*.unresolved`; provide a dry-run/audited repair command. Parent deletion itself fails closed if settlement is unavailable. |
| 18 | **Ledger itself is manually deleted without refund.** Balance remains debited but no unreconciled ledger exists, so neither marker protocol nor orphan sweep has a safe settlement fact. | Any | Structural/manual corruption possibility predates. | **Deferred deliberately.** Outside the requested “unreconciled ledger” class and unsafe to infer automatically from mutable job metadata. Database permissions/audit and a manual repair workflow are the right controls. |

## Is a dedicated hardening batch still warranted?

**Yes, but it need not block the growth changes after the real-Postgres gate
passes.** The minimum safe subset for shipping is the parent-lock/advisory-lock
deletion protocol, orphan and terminal-undelivered sweeps, trial correlation,
and producer/dispatcher guard tests implemented here. Those close every current
valid producer schedule that can otherwise strand a live user's credits.

A follow-up hardening batch should address defense against invalid/manual data,
not another current one-off vector:

- add a database-enforced one-ledger-per-document-job constraint after checking
  legacy duplicates;
- decide between FK RESTRICT/soft-delete/tombstone ownership so the recovery
  anchor cannot disappear independently of settlement;
- add an audited repair command for contradictory succeeded rows and malformed
  refs;
- add operational metrics/alerts for unreconciled age, terminal/orphan sweep
  counts, watchdog/beat liveness, and unresolved resolver failures; and
- decide product semantics for reparse, input-document deletion, and collection
  membership changes while work is running.

## Tests added

`backend/tests/test_predebited_job_deletion_integration.py` contains the four
required real-Postgres cases:

- delete document with active predebit and Domain Mode trial;
- delete collection with active predebit;
- worker advisory-lock claim versus deletion, with exactly-once refund; and
- historical parent CASCADE followed by orphan-ledger refund and safe
  NULL-owner slot release (including preservation of an unrelated NULL row).

Additional unit/architecture coverage proves:

- orphan and terminal-undelivered queries start from unreconciled ledgers and
  exclude delivered success;
- orphan trial release includes the shared ledger transaction timestamp;
- policy keys equal dispatcher keys and all worker modules are registered; and
- only the shared creation helper may produce a document-job predebit.

## Verification

| Command | Result |
|---|---|
| `cd frontend && npm run build` | **PASS** — optimized Next.js build completed; 425 static pages generated. |
| `cd frontend && npm run test:unit` | **PASS** — 12/12. |
| `cd backend && python3 -m ruff check app/ tests/` | **PASS** (run with repository Python 3.12 venv). |
| `cd backend && SKIP_INTEGRATION=1 python3 -m pytest -q` | **PASS** — 887 passed, 51 skipped, 14 pre-existing warnings. This is the executable unit/non-integration substitute because this sandbox denies local sockets. |
| `cd backend && SKIP_INTEGRATION= python3 -m pytest -m integration -q` | **ENVIRONMENT BLOCKED** — 48 setup errors, 890 deselected; every error originates in scratch-DB provisioning at `::1:5432` with `PermissionError: [Errno 1] Operation not permitted`. No test body ran. |
| `cd backend && SKIP_INTEGRATION= python3 -m pytest tests/test_predebited_job_deletion_integration.py -q` | **ENVIRONMENT BLOCKED** — all 4 required tests fail in the same fixture setup before any test body/database mutation. |
| `cd backend && python3 -m alembic heads` | **PASS** — sole head is `20260826_0043`. |

The requested unskipped full `SKIP_INTEGRATION= python3 -m pytest -q` cannot
complete for the same socket reason; running its integration subset established
the blocker without pretending the gate passed. No Alembic downgrade was
invoked or reached.

## Files changed

- `backend/app/services/predebited_job_service.py`
- `backend/app/services/doc_service.py`
- `backend/app/api/collections.py`
- `backend/app/services/extraction_service.py`
- `backend/app/services/domain_mode_access.py`
- `backend/app/workers/extraction_worker.py`
- `backend/app/models/tables.py`
- `backend/tests/test_predebited_job_deletion_integration.py`
- `backend/tests/test_predebited_job_service.py`
- `backend/tests/test_extraction_worker.py`
- `backend/tests/test_domain_mode_access.py`
- `backend/tests/test_deletion_retry.py`
- `.claude/rules/backend.md`
- `docs/ARCHITECTURE.md`
- `docs/ARCHITECTURE.zh.md`

