# Billing System Corner Case Audit Report (Refined)

**Date**: 2026-02-13
**Auditors**: 4 specialized agents + Codex cross-review
**Scope**: All billing endpoints, Stripe webhooks, credit system, frontend UX

---

## HIGH Priority — Must Fix

### H1. Double-click race on `/subscribe` — no atomic guard
**File**: `backend/app/api/billing.py` (subscribe endpoint)
**Issue**: `/subscribe` checks `user.stripe_subscription_id` in Python memory, then calls Stripe API, then commits. Two rapid requests both see `stripe_subscription_id = None`, both pass the guard, both create Checkout Sessions → user can complete two subscriptions.
**Codex**: AGREE. Don't hold `FOR UPDATE` across Stripe network calls — creates lock contention. Use short DB transaction to set a placeholder (e.g., `subscription_checkout_pending`), commit, then call Stripe with idempotency key.
**Fix**:
1. Set `user.stripe_subscription_id = "pending"` + `db.commit()` before Stripe call
2. Pass Stripe idempotency key scoped to `user_id + plan + billing`
3. On Stripe success: update to real checkout URL; on failure: reset to None
4. Also fixes M2 (duplicate customer creation) via same row guard

### H2. Upgrade supplement `ref_id` blocks legitimate re-upgrades
**File**: `backend/app/api/billing.py:250`
**Issue**: `ref_id = f"{old_plan}_to_{body.plan}"` is lifetime-unique per user. Re-upgrades get NO supplement.
**Codex**: AGREE. Timestamp-only ref_id is unsafe for concurrency. Use cycle-scoped deterministic key. Also: no unique constraint on ledger idempotency columns exists.
**Fix**:
1. Change `ref_id` to `f"plan_change_{subscription_id}_{current_period_start}"` (deterministic per billing cycle)
2. Add DB unique constraint on `(user_id, ref_type, ref_id)` to prevent concurrent double-credit
3. Alembic migration for the constraint

### H3. `/change-plan` modifies Stripe BEFORE DB commit
**File**: `backend/app/api/billing.py:234-269`
**Issue**: If `db.commit()` fails after Stripe modify, state desyncs and supplement credits are lost.
**Codex**: AGREE. Webhook reconciliation is necessary but insufficient unless webhook also handles supplements and uses `previous_attributes` from event data.
**Fix**:
1. Accept current order (Stripe first, then DB) — this is standard Stripe integration pattern
2. Ensure `subscription.updated` webhook can reconcile both plan AND supplements
3. Log DB commit failures with security event for manual reconciliation

### H4. `checkout.session.completed` defaults to `plan="pro"` on Stripe API failure
**File**: `backend/app/api/billing.py:304-315`
**Issue**: `except Exception` swallows all errors and defaults to "pro". Non-Stripe logic errors also silently map users to Pro.
**Codex**: AGREE. Narrow the exception handling.
**Fix**:
1. Return HTTP 500 for transient Stripe API failures → Stripe retries
2. Narrow `except` to `stripe.StripeError` only
3. For non-Stripe exceptions, re-raise (don't swallow)

### H5. Frontend: concurrent subscribe buttons not cross-disabled
**File**: `frontend/src/app/billing/page.tsx`
**Issue**: Buttons disable independently. User can fire Plus + Pro simultaneously.
**Codex**: AGREE. Manage and change-plan flows can also overlap.
**Fix**: Gate ALL billing CTAs on `submitting !== null`. Add early return in all handlers when `submitting` is set.

### H6. Confirmation dialogs lack Escape key, click-outside, ARIA, focus trap
**File**: `frontend/src/app/billing/page.tsx:456-544`
**Codex**: AGREE. Use a proven dialog primitive (Radix/Headless UI) instead of custom wiring. Background content is interactable via keyboard.
**Fix**: Replace custom modal `div` with a headless dialog component that handles Escape, click-outside, focus trap, body scroll lock, and ARIA attributes.

### H7. `subscription.updated` webhook doesn't filter by subscription status
**File**: `backend/app/api/billing.py:510-542`
**Issue**: Syncs plan regardless of status. `past_due`/`unpaid` still gets paid plan.
**Codex**: PARTIALLY AGREE. Don't unconditionally downgrade to free on `past_due` — that's too aggressive. Out-of-order `updated` after `deleted` can also re-set paid plan.
**Fix**:
1. Only sync plan for `active` / `trialing` statuses
2. For `past_due`: skip plan change (keep current — Stripe handles dunning)
3. For `canceled` / `unpaid` / `incomplete_expired`: set to `free`
4. Check subscription ID matches `user.stripe_subscription_id` to prevent stale event processing

### H8. `invoice.payment_failed` only logs — no user notification
**File**: `backend/app/api/billing.py:545-556`
**Codex**: PARTIALLY AGREE. Policy decision — acceptable for beta.
**Fix**: Beta: no change (Stripe sends dunning emails). Post-beta: add `payment_past_due` flag + UI warning banner.
**Status**: DEFER to post-beta

---

## MEDIUM Priority — Should Fix

### M1. `subscription.deleted` resets `monthly_credits_granted_at` for already-free users
**File**: `backend/app/api/billing.py:504`
**Codex**: DISAGREE on impact — `ensure_monthly_credits` has 30-day ledger idempotency check (`credit_service.py:228-236`). Reset causes unnecessary marker churn but NOT actual double-grant.
**Fix**: Still add guard for hygiene: skip reset if `user.plan == "free"` and `user.stripe_subscription_id is None`. Low effort, prevents churn.

### M2. `/subscribe` can create duplicate Stripe Customers
**Codex**: AGREE. Same atomic gate as H1 + Stripe idempotency key.
**Fix**: Merged into H1 fix.

### M3. Portal-initiated upgrades don't get credit supplement
**File**: `backend/app/api/billing.py:510-542`
**Codex**: AGREE. Need `previous_attributes` from Stripe event to detect upgrade direction safely.
**Fix**:
1. In `_handle_subscription_updated`, compare `event.data.previous_attributes` price vs new price
2. If upgrade detected, grant supplement with cycle-scoped idempotent `ref_id` (same pattern as H2)
**Dependency**: Must fix H7 (status gating) before adding supplement logic here.

### M4. Supplement doesn't account for annual billing interval
**Codex**: PARTIALLY AGREE. Document as beta simplification.
**Fix**: Add code comment documenting this. No code change for beta.
**Status**: DEFER

### M5. `delete_me` silently swallows Stripe cancellation failure
**File**: `backend/app/api/users.py:341`
**Codex**: AGREE. Log + security event + consider async retry.
**Fix**: Replace bare `except: pass` with `except Exception as e: log_security_event("stripe_cancel_failed", ...)`. Still proceed with deletion.

### M6. `ensure_monthly_credits` TOCTOU race
**File**: `backend/app/services/credit_service.py:211-267`
**Codex**: AGREE. Row lock can be hot-path contention. Use cycle-specific idempotency key + DB uniqueness.
**Fix**:
1. Use `ref_id = f"monthly_{year}_{month}"` for deterministic cycle key
2. Add unique constraint `(user_id, ref_type, ref_id)` on `credit_ledger` (same migration as H2)
3. Restrict `ensure_monthly_credits` to FREE users only — paid users get credits via `invoice.payment_succeeded`
**Codex insight**: This also fixes L12 (monthly + invoice overlap for paid users).

### M7. `checkout.session.completed` doesn't deduplicate subscriptions
**File**: `backend/app/api/billing.py:280-334`
**Codex**: AGREE. But naive cancellation can cancel wrong subscription on out-of-order events.
**Fix**: If `user.stripe_subscription_id` is set AND differs from incoming, compare `created` timestamps. Cancel the newer one (which is the duplicate from the race). Log for admin review.

### M8. No `refetchProfile()` after `?success=true`
**Codex**: AGREE. Must fix L7 first (subscription success URL missing `?success` param).
**Fix**:
1. Fix L7: add `?success=1` to subscription success URL in `billing.py`
2. Add `refetchProfile()` in the `?success` useEffect
3. Clean up URL params after handling (L1)
**Dependency**: L7 must ship with M8.

### M9. Profile loading/error states ignored
**Codex**: AGREE. Temporary profile failures expose wrong actions.
**Fix**: Destructure `loading`/`error` from `useUserProfile()`. Show skeleton while loading. Show error + retry button if fetch fails.

### M10. Button label inconsistency
**Codex**: AGREE. Non-English locales need reordered tokens — string concatenation breaks i18n.
**Fix**: Create full-sentence i18n keys: `billing.upgradeTo` = "Upgrade to {plan}" (with interpolation), `billing.downgradeTo` = "Downgrade to {plan}". Allows proper grammar per locale.

### M11. Cross-interval blocking broken when prices unconfigured
**Codex**: PARTIALLY AGREE. Don't skip silently — surface misconfiguration.
**Fix**: If `_interval_from_price_id` returns None for current subscription, skip interval check with warning log. If `_plan_from_price_id` returns None, log error — don't let empty-string price IDs match.

---

## LOW Priority — Nice to Have

| ID | Issue | Codex | Fix |
|---|---|---|---|
| L1 | `?success` params not cleaned after read | AGREE | `router.replace('/billing')` after handling |
| L2 | `handlePurchase` resets loading on redirect | AGREE | `return` after `window.location.href` |
| L3 | PricingTable CTA no disabled state | AGREE | Pass `submitting` state down |
| L4 | 401 shows generic error, no login redirect | AGREE | Intercept 401 in API layer → redirect to auth |
| L5 | Two-tab race shows raw English error | AGREE | Map known backend errors to i18n keys |
| L6 | PricingTable a11y labels hardcoded English | AGREE | Use `t()` for ARIA strings |
| L7 | Subscription success URL missing `?success` | AGREE | Add `?success=1` (blocks M8) |
| L8 | Hardcoded `$` in prices | AGREE | Use `Intl.NumberFormat` (also `/mo` not localized) |
| L9 | `/portal` no try/except | AGREE | Catch `stripe.StripeError` → 502 |
| L10 | `past_due` blocked with unclear error | AGREE | Return actionable message; allow downgrades |
| L11 | Modals don't lock background scroll | AGREE | `body.style.overflow = 'hidden'` (iOS Safari too) |
| L12 | Monthly + invoice credits overlap | AGREE | Fixed by M6 (restrict ensure_monthly to free users) |

---

## Refined Fix Plan

### Phase 1: Money/Integrity Fixes
**Scope**: H1, H2, H4, H5, H7, M2, M6, M7

**Backend** (`billing.py` + `credit_service.py` + migration):
1. **H1+M2**: Atomic subscribe guard — set `stripe_subscription_id = "pending"` + Stripe idempotency key
2. **H2**: Fix supplement `ref_id` to cycle-scoped `f"plan_change_{sub_id}_{period_start}"`
3. **H4**: Narrow `except` to `stripe.StripeError`, return 500 for transient failures
4. **H7**: Add status filtering in `subscription.updated` handler — only `active`/`trialing` sync plan
5. **M6**: Restrict `ensure_monthly_credits` to free users; use `ref_id=f"monthly_{year}_{month}"`; also fixes L12
6. **M7**: Deduplicate subscriptions in `checkout.session.completed` by comparing creation timestamps
7. **Migration**: Add unique constraint on `(user_id, ref_type, ref_id)` in `credit_ledger`

**Frontend** (`billing/page.tsx`):
1. **H5**: Gate all CTAs on `submitting !== null`

**Ordering**: Migration (unique constraint) → H2/M6 (need constraint) → H1+M2 → H4 → H7 → M7 → H5

### Phase 2: UX + Reconciliation Fixes
**Scope**: H3, H6, M1, M3, M5, M8, M9, M10, L1, L7

**Backend**:
1. **H3**: Accept Stripe-first pattern; ensure webhook reconciles both plan + supplement (requires M3)
2. **M3**: Add upgrade supplement logic to `subscription.updated` using `previous_attributes`
3. **M5**: Log + security event on `delete_me` Stripe cancel failure
4. **M1**: Guard `subscription.deleted` — skip reset if already free

**Frontend**:
1. **H6**: Replace custom modals with headless dialog component (also fixes L11)
2. **L7+M8**: Add `?success=1` to subscription success URL + `refetchProfile()` + clean params (L1)
3. **M9**: Handle profile loading/error states — show skeleton/error UI
4. **M10**: Create interpolated i18n keys for upgrade/downgrade CTA labels

**Ordering**: H7 (from Phase 1) → M3 → H3 | L7 → M8+L1 | H6 includes L11

### Phase 3: Polish
**Scope**: L2-L6, L8-L10, M4, M11, H8

Address as time permits. M4 (annual supplement) and H8 (payment failed UX) deferred to post-beta.

---

## Key Corrections from Codex Review

1. **Don't hold `FOR UPDATE` across Stripe calls** — use short placeholder transaction instead
2. **Timestamp ref_id is concurrency-unsafe** — use deterministic cycle-scoped keys + DB unique constraint
3. **M1 impact overestimated** — ledger has 30-day idempotency check; reset is hygiene, not money loss
4. **M6+M7 should be Phase 1** — direct money/integrity risks, not just "medium"
5. **L7 blocks M8** — subscription success URL must include `?success` before frontend refetch fix works
6. **H7 must precede M3** — status gating before supplement logic in webhooks
7. **Restrict `ensure_monthly_credits` to free users** — simplest fix for L12 overlap + M6 race
8. **Use Stripe idempotency keys** for checkout/customer creation instead of complex locking
