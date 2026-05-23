# Stripe Test-Mode Billing QA Run - 2026-05-10

Scope: real Stripe test-mode coverage for billing actions that were previously only API-gated or UI-smoked without creating Stripe sessions/subscriptions.

## Environment

- Backend: local FastAPI at `http://127.0.0.1:8000`.
- Stripe key guard: script refuses to run unless `STRIPE_SECRET_KEY` starts with `sk_test_`.
- Harness: `.collab/scripts/qa_stripe_testmode_matrix.py`.
- Raw first run: `.collab/tasks/qa-stripe-testmode-matrix-2026-05-10.json`.
- Raw retest: `.collab/tasks/qa-stripe-testmode-matrix-after-period-fix-2026-05-10.json`.

## Test Data

- Synthetic QA user.
- Stripe test customer created by DocTalk `/api/billing/subscribe`.
- Stripe test card from `tok_visa`.
- Stripe test subscription created directly for the DocTalk test customer with the configured Plus monthly price.

All local QA user state was deleted. Stripe cleanup canceled the test subscription and deleted the test customer in both runs.

## Commands

```bash
python3 .collab/scripts/qa_stripe_testmode_matrix.py \
  --api-base http://127.0.0.1:8000 \
  --json-out .collab/tasks/qa-stripe-testmode-matrix-2026-05-10.json

cd backend && python3 -m ruff check app/ tests/
cd backend && python3 -m pytest tests/test_billing_cancel.py tests/test_billing_state.py -v

python3 .collab/scripts/qa_stripe_testmode_matrix.py \
  --api-base http://127.0.0.1:8000 \
  --json-out .collab/tasks/qa-stripe-testmode-matrix-after-period-fix-2026-05-10.json
```

## Result

Final result after fix: **pass**.

| Check | First Run | Retest |
|---|---:|---:|
| Credit pack checkout creates Stripe test checkout URL | Pass | Pass |
| Subscription checkout creates Stripe test checkout URL, customer, and local `pending` sentinel | Pass | Pass |
| Duplicate subscribe while pending is rejected | Pass | Pass |
| Profile surfaces pending subscription state | Pass | Pass |
| Profile surfaces active Stripe subscription state | Pass | Pass |
| Billing portal creates Stripe test portal URL | Pass | Pass |
| Change plan Plus -> Pro updates Stripe and local plan | Pass | Pass |
| Change plan to same plan is rejected | Pass | Pass |
| Cancel active Stripe subscription schedules period-end cancellation | Fail | Pass |
| Profile surfaces scheduled cancel state | Pass with null period | Pass |

Retest summary:

- `STRIPE_TESTMODE PASS: 10/10 checks`.
- Cleanup canceled `sub_1TVeee7L0c9GeI9I9YDWaygx`.
- Cleanup deleted `cus_UUdwXnupNMKdeU`.
- Cleanup verified local QA user no longer exists.

## Finding And Fix

The first run found `BUG-2026-05-10-STRIPE-PERIOD-END-NULL`: Stripe cancellation returned 200 but `effective_at` and profile `billing_state.period_end` were null.

Fix:

- `backend/app/api/billing.py` now reads subscription period end from `subscription.current_period_end` or, when absent, `subscription.items.data[0].current_period_end`.
- Unit tests cover Branch A cancel, Branch C auto-heal cancel, and billing state projection for item-level period fields.

Retest evidence:

```json
{
  "status": "scheduled_cancel",
  "effective_at": "2026-06-10T21:12:52+00:00",
  "refund_requested": true
}
```

Profile billing state after retest:

```json
{
  "managed_by": "stripe",
  "can_cancel": false,
  "interval": "month",
  "period_end": "2026-06-10T21:12:52+00:00",
  "cancel_at_period_end": true,
  "status": "active"
}
```

## Remaining Gaps

- This validates Stripe test-mode backend actions, not a browser click-through to hosted Checkout/Portal.
- Webhook processing for checkout completion, subscription updated/deleted, invoice paid, and payment failures still needs an end-to-end Stripe CLI or signed webhook run.
- Production live Stripe is intentionally not exercised by this QA run.
