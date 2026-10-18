# Historical credit settlement compatibility

The May 2026 ledger can contain committed final charges with `reconciled_at=NULL`.
Migration `20260802_0035` introduced that marker without backfilling existing rows.
Automatic cash refunds must distinguish these rows from unresolved modern predebits.
This compatibility path preserves every original ledger value and the user's balance.
It certifies historical free consumption so an old Free user can later make a newly
enrolled first purchase under the existing automatic-refund policy. It does not
retrospectively enroll or refund old paid purchases. It never fabricates an invoice,
a payment-time baseline or enrollment. POLICY and POLICY_START_AT retain their
prospective meaning.

Migration `20261019_0050` follows `20261018_0049` and only creates an empty audit
table. It does not backfill a settlement marker. Downgrade drops this table only
when empty; any audit row, including a revoked row, prohibits downgrade.

## Trust boundary and positive proof

The protocol trusts production database server-generated `created_at`, source history,
and ordinary database integrity. It does not assume an administrator fabricated old
row timestamps. It does not infer settlement from time, inactivity, matching usage
amounts, or an assistant message. Such evidence alone cannot identify a ledger row.

The supported generation is deliberately finite: 2026-05-06 00:00 UTC through
2026-05-12 00:00 UTC, exclusive of the latter boundary. Dates only constrain which
historical writer proof may be applied. A date never exempts a row by itself.

The audited writers provide these additional positive facts:

- `de722b1a:backend/app/services/credit_service.py:38-43` fixes ordinary predebits at
  quick=5 and balanced=15. Its parent has the same values. Source-history search
  for `MODE_ESTIMATED_COST` identifies its introduction in `79557a5d` and the
  removal of thorough mode in `de722b1a`. The selected modes did not change.
- `de722b1a:backend/app/services/chat_service.py:416-419,833-836` creates chat/mode
  rows through those estimates. `43e9593b:backend/app/services/chat_service.py:742-747`
  also doubles DOCUMENT_SUMMARY estimates. The possible initial pending amounts
  are therefore **5 or 10 for quick, 15 or 30 for balanced**. Continuations use the
  ordinary estimate (`43e9593b`, lines 1300-1303).
- `de722b1a:backend/app/services/credit_service.py:177-208` changes the same row to
  `delta=-actual_cost` during reconciliation. Its balance adjustment and ledger
  update are in one transaction. Thus a committed historical chat/mode delta
  outside its complete initial-amount set proves that reconciliation committed.
  Equal-estimate rows remain unproven and require manual review.
- `5ac4d833:backend/app/api/extractions.py:205-228` creates extraction/document_job
  rows at 25 credits and stores the exact ledger UUID in job metadata.
  `5ac4d833:backend/app/services/extraction_service.py:480-500,544-575` commits
  reconciliation, usage, succeeded status, final job cost and ExtractionResult
  together. The proof requires the exact reverse metadata link, same user,
  succeeded job, completion time, matching final cost, result with that job ID,
  pre_debited=25, and a final delta different from -25. It never guesses a job.
- The only ledger-delta writers in this historical generation are debit creation
  and those reconciliation functions. `20260210_0013` rescales rows that already
  existed in February; it cannot change rows first created in May. Failed
  predebit refunds delete the row rather than changing its delta. The May
  `43e9593b` extraction change affects retrieval rather than billing. Modern
  writers cannot satisfy the historical generation boundary with honest database
  timestamps. A modern unresolved amount remains blocked even if it is -9.

## Explicit manifest and separate audit

`legacy_credit_settlements` stores exact ledger UUID, user UUID, normalized full
ledger snapshot, SHA-256 fingerprint, protocol, proof, historical source anchors,
manifest digest, reviewer and attestation timestamp. It never updates a ledger row.
The public repository contains no production user IDs or ledger IDs.

`backend/scripts/legacy_credit_settlements.py` reports only explicitly supplied
ledger IDs for one user. Report mode uses a database READ ONLY transaction.
It rejects the entire report if any row lacks positive proof.

1. Keep automatic refund enablement and provider creation disabled.
2. Produce the report with `--user-id UUID --ledger-id UUID` (repeat ledger IDs).
3. Save the JSON outside the repository with restricted file permissions.
4. Review every row, source anchor, snapshot and proof.
5. Set `DOCTALK_LEGACY_SETTLEMENT_ADMIN=1` for the single apply invocation.
6. Apply with `--apply /private/path/reviewed.json --reviewed-by OPERATOR`.
7. Compare all original ledger fields, balance and debit version before and after.
8. Keep rollout disabled until independent review and regression gates pass.

Apply revalidates the complete canonical manifest against fresh database facts.
Unknown protocol/source/proof, changed snapshots, other users, duplicate IDs,
active jobs/documents/refunds, deletion or reservation conflicts cause failure.
The caller rolls the entire transaction back on any error. Reapplying the exact
manifest is idempotent. An overlapping different manifest is rejected.
The administrative environment switch is an operational safeguard; database
credentials remain the actual write authority.

## Runtime and concurrency

Every eligibility pass requires an exact current ledger fingerprint and snapshot
match, same user and protocol, supported proof and non-revoked attestation.
A changed row loses eligibility. Unknown NULL rows still return inflight_predebit.
Additional positive funding still returns complex_funding. Other refund guards,
provider ownership, enrollment and debit-version checks retain their behavior.

Apply locks explicit ledger rows in stable UUID order, then the user using the
same user-lock contract as refunds. This matches reconciliation's ledger-to-user
order. Refund flags must remain off during maintenance; old workers must drain
before rollout. Lock or deadlock failure rolls back and requires a fresh report.

All seven conditional predebit DELETE paths and worker/recovery discovery use
`unresolved_predebit()`: NULL marker AND no attestation for that exact UUID.
Even a revoked or fingerprint-mismatched attestation blocks returning the debit
again. Both reconciliation functions reject attested IDs rather than reapplying
a cost difference. This protection does not authorize modern pending rows.

A ledger NO ACTION foreign key provides a database backstop when a DELETE began
with an older statement snapshot and cannot see the new attestation. Row locking
alone does not refresh such a snapshot. An attestation also has a user CASCADE
foreign key. A single user deletion cascades both the ledger and its compatibility
proof; the NO ACTION check runs at statement end. Normal account deletion retains
its existing behavior. An audit-bearing migration cannot be downgraded.

## Verification boundaries

Use an isolated local scratch PostgreSQL database and the fake payment provider.
Check positive historical proof, every possible initial estimate, modern/unknown
NULLs, wrong owner, hash/proof changes, mixed known/unknown rows, idempotent apply,
reconciliation/refund protection, stale DELETE snapshots and user deletion.
No test or rollout validation authorizes another real charge or cash refund.


For staged production observation, keep provider creates disabled and use an explicit
live user list in the verified provider account. `AUTO_REFUND_ENABLED=true` also
permits future enrollment and request creation; request creation is not read-only.
An old Free user without a new enrolled payment has zero eligible invoices. This
is expected, not evidence that the compatibility path has completed a live cash
refund. See [OPS_AUTO_REFUNDS.md](OPS_AUTO_REFUNDS.md) for rollout and stop gates.
