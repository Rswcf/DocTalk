---
id: A-04-C07-01
matrix: A
agent: claude
cell_id: A-04-C07
row_key: billing_api
column_key: idempotency_replay
finding_key: plan_fallback_to_pro_default
severity: P1
confidence: high
status: bug
files:
  - "backend/app/api/billing.py:877"
  - "backend/app/api/billing.py:53"
  - "backend/app/api/billing.py:1014"
exploit_preconditions:
  - "env-var drift: Stripe price configured at Stripe + frontend, but STRIPE_PRICE_PLUS_* env missing on backend at webhook time"
  - "user completes a Plus subscription checkout"
---

## Observation
`_handle_checkout_session_subscription_completed` in `billing.py:876-887` defaults `plan = "pro"` when `_plan_from_price_id` returns `None`. `_plan_from_price_id` (`billing.py:53-61`) compares against `settings.STRIPE_PRICE_PLUS_*` / `STRIPE_PRICE_PRO_*` env vars — if any of those is unset or stale at webhook-handling time, a user paying for Plus (or any unknown price) is granted Pro plan silently.

Same pattern repeated in `_handle_invoice_payment_succeeded` (`billing.py:1014`): `plan = user.plan or "pro"`. If `user.plan` was never set (fresh webhook race) the fallback awards Pro credit allowance instead of Plus.

## Impact
Billing correctness failure: user pays $9.99/mo for Plus but receives Pro plan (9K credits/mo instead of 3K). Conversely, if `STRIPE_PRICE_PRO_*` is the one missing, a Pro subscriber gets downgraded to Pro anyway (no-op) — but a Plus subscriber gets upgraded to Pro (revenue loss + feature access they didn't pay for). Since webhook arrives before UI refresh, the mismatch persists until an admin fixes it.

## Repro / Evidence
1. Deploy backend with `STRIPE_PRICE_PLUS_MONTHLY` unset.
2. Complete a Plus/monthly checkout via Stripe (dashboard-created price).
3. Webhook fires; `_plan_from_price_id("price_1234")` returns None.
4. User row written with `plan="pro"` + Pro credit allowance.

## Suggested Fix
Replace silent default with hard failure:

```python
detected = _plan_from_price_id(sub_price_id)
if not detected:
    logger.error("Unknown Stripe price_id %s on webhook for user %s", sub_price_id, user.id)
    raise HTTPException(500, "Unknown subscription price")
plan = detected
```

Raising 5xx makes Stripe retry the webhook (giving operator time to fix env). Alternative: explicit allow-list check at app startup comparing `STRIPE_PRICE_*` env vars against Stripe's live price list and refusing to start if drift detected.
