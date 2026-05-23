# BUG-2026-05-10-STRIPE-PERIOD-END-NULL

Status: **fixed and retested locally**

## Summary

Stripe test-mode cancellation succeeded, but DocTalk returned `effective_at: null` from `/api/billing/cancel` and exposed `billing_state.period_end: null` from `/api/users/profile` for an active Stripe subscription scheduled to cancel at period end.

## Severity

P2 billing UX / trust issue.

Users could successfully schedule cancellation but would not see the date their paid access ends. This weakens billing transparency and makes the cancel confirmation ambiguous.

## Environment

- Backend: local FastAPI at `http://127.0.0.1:8000`.
- Stripe key: `sk_test_*`.
- Harness: `.collab/scripts/qa_stripe_testmode_matrix.py`.
- Failing evidence: `.collab/tasks/qa-stripe-testmode-matrix-2026-05-10.json`.
- Passing retest: `.collab/tasks/qa-stripe-testmode-matrix-after-period-fix-2026-05-10.json`.

## Reproduction

1. Create a synthetic QA user.
2. Create a Stripe test customer through `/api/billing/subscribe`.
3. Attach a Stripe test card and create an active Plus monthly test subscription.
4. Set the local user to `plan=plus` with `stripe_subscription_id=sub_*`.
5. Upgrade through `/api/billing/change-plan` to Pro monthly.
6. Call `/api/billing/cancel` with a valid cancellation body.
7. Fetch `/api/users/profile`.

## Observed Before Fix

`/api/billing/cancel` returned 200:

```json
{
  "status": "scheduled_cancel",
  "effective_at": null,
  "message": "Subscription will end at the current period end.",
  "refund_requested": true
}
```

`/api/users/profile` returned:

```json
{
  "billing_state": {
    "managed_by": "stripe",
    "can_cancel": false,
    "interval": "month",
    "period_end": null,
    "cancel_at_period_end": true,
    "status": "active"
  }
}
```

## Root Cause

The billing API read `current_period_end` only from the Stripe subscription object. In the tested Stripe API shape, `current_period_end` was present on the first subscription item instead:

```text
subscription.current_period_end = None
subscription.items.data[0].current_period_end = 1781125861
```

## Fix

`backend/app/api/billing.py` now uses `_subscription_period_end(sub)` to read:

1. `sub.current_period_end` when available.
2. `sub.items.data[0].current_period_end` as a fallback.

The helper is used for:

- `/api/billing/cancel` Branch A active/trialing/past_due subscriptions.
- `/api/billing/cancel` Branch C auto-healed subscriptions.
- `compute_billing_state()` projection for profile/billing UI.

## Regression Coverage

Added tests:

- `backend/tests/test_billing_cancel.py::test_branch_a_active_uses_item_period_end_when_top_level_missing`
- `backend/tests/test_billing_cancel.py::test_branch_c_auto_heal_uses_item_period_end_when_top_level_missing`
- `backend/tests/test_billing_state.py::test_active_sub_projects_item_period_end_when_top_level_missing`

Commands:

```bash
cd backend && python3 -m ruff check app/ tests/
cd backend && python3 -m pytest tests/test_billing_cancel.py tests/test_billing_state.py -v
python3 .collab/scripts/qa_stripe_testmode_matrix.py \
  --api-base http://127.0.0.1:8000 \
  --json-out .collab/tasks/qa-stripe-testmode-matrix-after-period-fix-2026-05-10.json
```

Results:

- Backend ruff: pass.
- Billing cancel/state unit tests: 32 passed.
- Stripe test-mode matrix after fix: 10/10 passed.

Retest returned:

```json
{
  "status": "scheduled_cancel",
  "effective_at": "2026-06-10T21:12:52+00:00",
  "refund_requested": true
}
```

Profile retest returned:

```json
{
  "billing_state": {
    "period_end": "2026-06-10T21:12:52+00:00",
    "cancel_at_period_end": true,
    "can_cancel": false
  }
}
```
