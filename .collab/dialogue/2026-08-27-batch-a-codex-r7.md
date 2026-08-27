# Batch A adversarial review — Codex R7 consensus

Revision under review: `79f1262` (`fix/growth-batch-a`)  
Review date: 2026-08-27  
Verdict: **SHIP**

## 1. R6 blocker

**Closed.** Document and collection deletion lock the parent row, discover each
active canonical predebit, take advisory namespace 948 in deterministic job-ID
order, and re-read status plus the unreconciled-ledger predicate after any wait.
They then use the existing conditional-ledger-delete resolver before allowing
the parent CASCADE. The worker-claim-versus-delete integration case proves the
important real-Postgres schedule: deletion waits for the worker lock, the
worker's terminal settlement wins exactly once, deletion rechecks, and the
parent is then removed without a second refund.

The orphan-ledger and terminal-undelivered sweeps also close the recovery gaps.
Both run through the beat/startup watchdog, take the same job advisory lock, and
delegate to the same settlement resolver. Orphan extraction recovery releases
only the NULL-owner trial correlated by user, feature, and the ledger/job shared
transaction timestamp. The now-executed 48-test integration suite includes all
four new deletion/recovery cases and removes R7's sole executable-evidence
reservation.

## 2. Deletion protocol / lock ordering

It introduces **no new correctness failure**, but it does introduce a deliberate
availability tradeoff: a delete can block while a live worker owns the job lock.
That wait is bounded in normal operation by the current worker hard limits
(420/720/600 seconds for extraction/template/diff), although an unhealthy lock
holder can make the request exceed an HTTP timeout. A timed-out/failed request
that is cancelled before commit rolls back the outer transaction and releases
its parent/advisory locks; a proxy-visible timeout may instead leave the server
request running to completion. Neither outcome creates a permanent lock cycle
or an unrecoverable parent.

There is no lock-order deadlock with the current workers:

- deletion acquires parent `FOR UPDATE` and then advisory 948;
- a worker acquires advisory 948, performs its short job-row claim, and later
  settles ledger -> user -> job without requesting a conflicting parent row
  lock; its document/collection reads are ordinary non-locking reads; and
- deletion waits outside its resolver until the worker releases advisory 948,
  then its fresh resolver uses the same ledger -> user -> job settlement order.

The parent lock also serializes producers safely: every valid producer flushes
the FK-owned `DocumentJob` before it debits/locks the user. Thus a producer
either obtains the parent's FK key-share first and commits before deletion sees
and settles the job, or waits behind deletion and its FK insert rolls back after
the parent disappears. There is no parent/user lock inversion.

If settlement itself raises, deletion fails closed and rolls back, retaining the
parent as the recovery anchor. If settlement commits but a later outer-delete
step fails, the parent may remain with the job already failed/refunded; that is
safe and a later delete remains possible. A lock-wait timeout/409 policy would
improve delete UX, but it is not a money-loss, feature-leak, double-charge, or
successful-work-destruction blocker.

## 3. Enumeration

I stand by all 18 dispositions.

- Rows 1–5 are closed by the parent/advisory protocol plus orphan recovery and
  are now backed by executed PostgreSQL tests. Row 14 is closed by the terminal-
  undelivered predicate and the same atomic resolver; its predicate/result
  exclusion is unit-covered rather than a separate integration case.
- Row 6 remains safe because user deletion cascades job, ledger, and trial rows
  together; no live account balance or orphan ledger survives.
- Rows 7–9 retain the job/ledger anchor: reparse removes derived document data,
  input-only deletion does not target the job FK, and membership removal deletes
  only the junction row. Their deferred semantics are UX policy, not stranded
  settlement.
- Rows 10 and 13 remain safe through authoritative leases, tokens, bounded
  attempts, startup/beat recovery, and terminal refund; the executed producer-
  recovery and worker-failure-window integration tests exercise those database
  transitions. Row 11 remains safe because no settlement path reads Celery's
  result backend. Row 12 remains guarded by registry/include and exclusive-
  producer architecture tests.
- Rows 15–18 remain deliberately deferred. The executed tests do not change
  their invalid/manual-data or infrastructure-outage classification, and an
  automatic repair would still risk refunding delivered work or inferring money
  movement without a trustworthy ledger fact.

The 48 integration passes, 935-pass full backend run, sole Alembic head
`20260826_0043`, clean ruff result, successful frontend build, and 12/12 frontend
unit tests satisfy the previously missing gate. I also reran the focused
non-integration lifecycle set here: **29 passed**, with focused ruff clean.

## 4. Consensus

**SHIP. Batch A has reached consensus under the stated verdict bar.**

The dedicated hardening batch remains scoped to:

1. add a database-enforced one-ledger-per-document-job constraint after legacy
   duplicate validation;
2. choose FK `RESTRICT`, soft deletion, or a durable tombstone so a recovery
   anchor cannot disappear independently of settlement;
3. add an audited repair command for contradictory succeeded rows and malformed
   references;
4. add metrics/alerts for oldest unreconciled age, terminal/orphan sweep counts,
   beat/watchdog liveness, and `*.unresolved` failures; and
5. decide product semantics for reparse, input-document deletion, and collection
   membership changes during active work.

Separately, the hardening/operations pass should define bounded delete-lock UX
(for example, lock timeout plus retryable 409) so a healthy long-running job is
reported explicitly instead of presenting as a hung request.
