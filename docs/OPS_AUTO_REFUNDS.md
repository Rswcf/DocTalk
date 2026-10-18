# Automatic refund operations

The ops CLI is read-only. It cannot refund, cancel, confirm, repair, or change a database row. It does not load `.env`. Run it only inside an existing secure administrator shell/container with least-privilege database access. `DOCTALK_REFUND_OPS_ADMIN=1` is an acknowledgement, not authentication; secure-shell and database permissions remain the access boundary. Never put database URLs or Stripe credentials in command arguments or logs.

```bash
cd backend
DOCTALK_REFUND_OPS_ADMIN=1 python scripts/refund_ops.py \
  --mode live --account acct_1SyVqV1GbwdIYDoz --limit 50
```

The process inherits `DATABASE_URL` and `STRIPE_SECRET_KEY` from the secure operator environment. Test environments must explicitly select `--mode test` and their exact Sandbox account. The tool checks the credential prefix and performs a bounded Stripe Account GET to verify the expected account before reading the queue. It never retrieves customer records or performs provider mutations. A matching account is an identity check, not proof of payment or refund delivery.

The database connection enforces read-only transactions and a five-second statement timeout. Output includes an aggregate status summary and at most 100 queue entries. Shared server-side ops rules determine attention and reservation integrity. Customer names, email, customer IDs, raw provider objects, evidence JSON, signatures, credentials and URLs must not be output. Exceptions print their type only. A failed identity or read-only check exits nonzero.

## Operator actions

- `review`: record a human review. This is not an automatic refusal of statutory rights.
- `cash_unknown` or `manual_unknown`: inspect the original operation and exact provider account through a separately authorized audit. Do not create a second refund after a timeout. Preserve the original idempotency identity.
- `cash_pending`: the provider has not confirmed completion. Do not promise money has arrived.
- `repair_required`: verify the current provider state first. This status alone does not prove cash success. Rights repair must use reviewed, separately authorized tooling; this CLI has no repair mode.
- `cash_reversed`: the provider confirmed failure after success. Assign a named owner and backup. Never blindly refund again, restore credits, or revive the subscription.
- `completed`: reconcile provider current success, original-subscription cancellation and exactly one credit adjustment. Historical success can later reverse.

Reservation age and stale work are diagnostic signals, not a customer settlement promise. A reservation belongs to a user; do not sum it once per operation. Shared ops helpers must check integrity against the active operation and report orphaned or inconsistent reservations. A bounded queue can be truncated; aggregate counts must not be presented as its sampled row count.

## Release and response gates

Before enabling creates, assign a named primary/backup operator, an approved response time, an access-controlled queue and an approved monitoring channel. Existing logging/Sentry integration does not authorize customer messages. Do not add email or chat sends from this CLI.

Disable new requests/provider creates first during an incident. Keep reads and accepted-operation reconciliation available. Retain financial audit and add-only migrations. Do not downgrade schema or restore an old dump over later business writes. A rollback build must still recover accepted operations.

Production financial testing is separate from the no-funds release checks. Inform the user before a real charge or cash refund. A Stripe refund object marked succeeded is not independent evidence that the customer received funds.

## Admin view and monitoring

Authenticated administrators can use `GET /api/admin/refund-operations?limit=50` (limit 1–100) for the shared read-only queue. It uses the existing administrator authorization and private/no-store response policy. `GET /api/admin/ops-health` also exposes the aggregate refund health through the shared helper. Ordinary users must continue to use only their own billing request APIs; never grant admin access to inspect their refund.

`recover_refund_operations` runs every **60 seconds** to reconcile accepted operations. The separate `check_refund_operations` monitor runs every **300 seconds** and reports aggregate diagnostics through existing logs/Sentry. The monitor does not refund, cancel, repair or send customer messages. A healthy monitor does not prove the recovery worker executed or cash arrived. Approve the internal alert recipients and response ownership before enablement.

Production release follows `20261018_0048` (future enrollment and refund audit),
`20261018_0049` (durable provider identity), then `20261019_0050` (empty legacy
settlement audit table). No migration backfills an old purchase or ledger marker.
0050 can downgrade only while its table is empty; any audit row prevents removal.
Include the full chain in fresh-backup, migration and compatible-rollback gates.
Refuse to reconcile an operation under a different provider mode/account.

## Legacy maintenance and staged enablement

[LEGACY-CREDIT-SETTLEMENT.md](LEGACY-CREDIT-SETTLEMENT.md) defines the exact historical
writer proofs. This path supports an old Free user's future newly enrolled first
purchase. It does not refund old paid purchases or create missing invoice/baseline
facts. The original enrollment policy and start time keep their meaning.

The legacy CLI report is a database READ ONLY transaction for explicitly supplied
user/ledger IDs. Its reviewed-manifest apply is a separate database write, not a
read-only audit. It appends attestations without changing ledger values, balances
or settlement timestamps. Apply revalidates fresh facts and requires
`DOCTALK_LEGACY_SETTLEMENT_ADMIN=1`; database permissions remain the write boundary.
Keep both refund flags false, drain old workers, review the exact manifest outside
the repository, apply once, and compare original financial fields before rollout.
Do not apply a manifest merely to force a user into automatic eligibility.

Deploy the backend first with flags off and an empty live list. Verify actual code,
schema, provider identity, region and recovery/monitor execution before releasing
the frontend. Start with explicit UUIDs in `AUTO_REFUND_LIVE_USER_IDS` within one
verified live account; never use `*` for the observation stage.
`AUTO_REFUND_ENABLED=true` allows future enrollment, eligibility and request
creation. With `AUTO_REFUND_PROVIDER_CREATES_ENABLED=false`, confirmation and new
provider cash creation remain blocked. Request creation still writes an operation;
use the separate read-only report for a no-write observation.

An old Free user who has not made a new enrolled payment has zero eligible invoices.
This is expected and proves neither failure nor live legacy-path refund success.
Expand the explicit cohort only after independent review, regression and runtime
checks pass with no unresolved identity, cash or reservation anomalies. Inform the
user before any new real charge/refund; do not repeat the completed canary or create
orders to manufacture coverage. Open provider creates only for the intended cohort
with response ownership and approved financial scope. During an incident disable
both flags and clear the list, redeploy and verify the effective runtime, while
preserving provider identity and accepted-operation reconciliation.
