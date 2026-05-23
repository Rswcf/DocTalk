# Stripe Signed Webhook QA Run - 2026-05-10

Scope: signed Stripe webhook handling for billing state, credit grants, subscription lifecycle, idempotency, and pending checkout cleanup.

## Environment

- Backend: local FastAPI at `http://127.0.0.1:8000`.
- Stripe key guard: script refuses to run unless `STRIPE_SECRET_KEY` starts with `sk_test_`.
- Webhook secret: real local `STRIPE_WEBHOOK_SECRET`.
- Harness: `.collab/scripts/qa_stripe_webhook_matrix.py`.
- Raw evidence: `.collab/tasks/qa-stripe-webhook-matrix-2026-05-10.json`.

## Test Data

- 3 synthetic local QA users:
  - credit-pack checkout user
  - subscription lifecycle user
  - expired pending checkout user
- 2 Stripe test customers.
- 1 Stripe test subscription using the configured Plus monthly price.

Cleanup canceled the Stripe test subscription, deleted both Stripe test customers, and deleted all local QA users.

## Commands

```bash
python3 .collab/scripts/qa_stripe_webhook_matrix.py \
  --api-base http://127.0.0.1:8000 \
  --json-out .collab/tasks/qa-stripe-webhook-matrix-2026-05-10.json
```

## Result

Final result: **pass**.

`STRIPE_WEBHOOK PASS: 8/8 checks`.

| Check | Result | Evidence |
|---|---:|---|
| Invalid webhook signature rejected | Pass | POST `/api/billing/webhook` with bad HMAC returned 401 |
| Credit-pack `checkout.session.completed` grants once | Pass | First signed event added 777 credits; duplicate event did not change balance again; ledger ref `stripe_payment` matched the payment intent |
| Subscription `checkout.session.completed` sets plan and ids | Pass | User moved from pending to Plus with Stripe `cus_*` and `sub_*`; product event recorded |
| `invoice.payment_succeeded` grants monthly allowance once | Pass | Plus allowance ledger delta 3000; duplicate invoice event did not double-grant |
| `customer.subscription.updated` upgrade syncs plan and supplement once | Pass | User moved Plus -> Pro; plan-change supplement ledger written once; duplicate update did not double-grant |
| `invoice.payment_failed` is acknowledged without state mutation | Pass | Event returned 200 and preserved plan/credit balance |
| `customer.subscription.deleted` demotes to Free | Pass | User plan became `free` and `stripe_subscription_id` cleared |
| `checkout.session.expired` clears stale pending | Pass | Pending sentinel cleared for a customer with no active subscription |

Cleanup:

- Canceled `sub_1TVekp7L0c9GeI9IPc9vSsFW`.
- Deleted `cus_UUe2bGJHNkdOcH`.
- Deleted `cus_UUe2iQYRwQ9ehg`.
- Local cleanup verified all 3 QA users no longer exist.

## Notes

This run validates the signed webhook endpoint itself, not just direct handler calls. Payloads are HMAC-signed with the configured webhook secret in the same `t=...,v1=...` header format Stripe sends.

## Remaining Gaps

- This is a controlled signed-webhook matrix, not a live Stripe CLI replay from hosted Checkout.
- Hosted Checkout and hosted Billing Portal still need browser click-through coverage.
- Additional payment-failure business behavior may be needed later; the current implementation acknowledges and logs `invoice.payment_failed` without changing account state.
