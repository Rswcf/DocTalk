# Phase 3 review request — UserProfileResponse.billing_state

## Changes

1. `backend/app/schemas/users.py` — added `BillingStateResponse`; extended
   `UserProfileResponse` with `billing_state: BillingStateResponse`
2. `backend/app/api/billing.py` — added `compute_billing_state(user)`
   + helper `_billing_state_from_stripe_sub(plan, sub)`. Uses Redis
   cache `user:billing_state:{user_id}` with 60s TTL. Falls back
   gracefully on `stripe.StripeError`.
3. `backend/app/api/users.py` — `get_profile` now calls
   `compute_billing_state(user)` and includes result in the response.
4. `backend/tests/test_billing_state.py` — **11 new tests** covering:
   - Fast paths: free-no-stripe, pending sentinel, malformed sub_id
   - Cache hit short-circuit
   - Stripe sub projection (active, cancel_at_period_end=True,
     canceled status)
   - Branch C mirroring (single / multi / zero cancellable subs)
   - Stripe error degraded response (endpoint does not 500)

## Test results

`pytest tests/test_billing_state.py tests/test_billing_cancel.py tests/test_billing_logic.py -q`
→ **33 passed**.
`ruff` clean.

## Key design choices

1. **Cache key separate from `user:profile:{id}`**. `compute_billing_state`
   writes its own key. Cancel endpoint (Phase 2) already invalidates it.

2. **Degraded response on Stripe error**: profile returns `status="none"`
   + `can_cancel` based on plan alone, NOT cached (so next call retries).
   The cancel endpoint itself still fail-closes (502) if user clicks;
   this is "optimistic UI, strict backend".

3. **`can_cancel` strictly narrower than plan check**: also false when
   `cancel_at_period_end=true` (avoid double-click after schedule),
   when multi-sub drift, when malformed sub_id, when pending checkout.
   Frontend can trust this flag.

4. **`interval`**: only `"month"` / `"year"` / None. Doesn't leak Stripe's
   raw `daily` / `weekly` values because those aren't in our SKU.

## Notes for reviewer

- Phase 4 (frontend) will consume this field.
- Redis unavailability is already handled by `cache.cache_get` returning
  None → we fall through to Stripe call. No new Redis guard needed.
- No DB migration in this phase (field is computed, not stored).

## Request

Review:
- `backend/app/api/billing.py` lines adding `compute_billing_state` +
  `_billing_state_from_stripe_sub` (~120 lines)
- `backend/app/schemas/users.py` `BillingStateResponse` definition
- `backend/app/api/users.py` 3-line integration into `get_profile`
- `backend/tests/test_billing_state.py` coverage

Output: `.collab/reviews/2026-04-14-billing-phase3-billing-state-response.md`
APPROVED or BLOCKING. Under 400 words.
