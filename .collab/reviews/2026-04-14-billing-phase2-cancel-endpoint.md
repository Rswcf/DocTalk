# Phase 2 review request — /api/billing/cancel + tests

## Changes

1. `backend/app/models/tables.py` — appended `PlanTransition` ORM model
2. `backend/app/schemas/billing.py` — added `CancelSubscriptionResponse`
3. `backend/app/api/billing.py`:
   - Added constants `_CANCELLABLE_SUBSCRIPTION_STATUSES`, `_PENDING_SENTINEL`, `_STRIPE_SUB_ID_PREFIX`
   - Added helpers `_audit_plan_transition`, `_iso`
   - **Added endpoint `POST /api/billing/cancel`** implementing the D→E→A→F→C→B state machine from plan §5.1
   - **change-plan trialing fix (R1 §6)**: `_list_customer_subscriptions` + filter by `_ACTIVE_SUBSCRIPTION_STATUSES = {active, trialing}` replaces the old `status="active"` limit=1 lookup
4. `backend/tests/test_billing_cancel.py` — 16 new tests covering:
   - Branch D / E / A(active,trialing,past_due,canceled-sync,incomplete-409) / F / C(single,multi,zero,StripeError) / B(normal,race)
   - Fail-closed on Stripe retrieve/list error (→ 502)
   - 503 when `STRIPE_SECRET_KEY` unset

## Test results

`pytest tests/test_billing_cancel.py tests/test_billing_logic.py -q` → **20 passed**.
`ruff check` clean.

## Deviations from plan

1. **Removed `async with db.begin_nested():`** wrappers around row-lock +
   mutation + audit blocks. SQLAlchemy's implicit transaction on the
   async session already provides the necessary tx boundary; existing
   `_recover_pending_subscription` and other handlers use the same
   plain-SELECT-FOR-UPDATE-then-commit pattern. Simpler code, simpler
   mocking in tests.

2. **Audit row for Branch A (scheduled_cancel)** records
   `from_plan = to_plan = current_plan` with `cancel_at_period_end=true`
   in metadata, rather than `to_plan = "free"`. Rationale: plan is not
   actually demoted yet — the webhook `customer.subscription.deleted`
   will flip it at period end. Recording the intent with metadata
   preserves audit semantics without pretending a transition occurred.

## Open question

- Race between Branch B and `subscription.deleted` webhook arriving
  concurrently (for a user whose Stripe sub was canceled at Stripe UI
  while this endpoint was racing): both paths set plan=free and null
  sub_id. Safe because both writes are idempotent. Should I add a
  comment noting this? (Non-blocking)

## What's NOT in this phase
- No `billing_state` field on profile yet (Phase 3)
- No frontend changes (Phase 4)
- No webhook / change-plan / admin audit writes (deferred per plan §4.1)

## Request

Review `backend/app/api/billing.py` lines touching:
- L72-85 (new constants block)
- L311-333 (change-plan trialing fix)
- L414-663 (new `_audit_plan_transition`, `_iso`, `cancel_subscription`)

Plus `backend/tests/test_billing_cancel.py` coverage completeness.

Output: `.collab/reviews/2026-04-14-billing-phase2-cancel-endpoint-response.md`
APPROVED or BLOCKING. Under 400 words.
