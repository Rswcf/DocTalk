# Billing Corner-Case Audit Review (Verification)

Reviewed files:
- `backend/app/api/billing.py`
- `backend/app/api/users.py`
- `backend/app/services/credit_service.py`
- `backend/app/models/tables.py`
- `backend/app/core/config.py`
- `frontend/src/app/billing/page.tsx`
- `frontend/src/components/PricingTable.tsx`
- `frontend/src/lib/api.ts`
- `frontend/src/lib/useUserProfile.ts`

## High Priority Findings

### H1. Double-click race on `/subscribe`
- Verdict: **AGREE**
- Reasoning: Guard is a non-atomic in-memory check (`if user.stripe_subscription_id`) at `backend/app/api/billing.py:131`, followed by Stripe checkout creation at `backend/app/api/billing.py:150-158`, with no row lock/transactional guard.
- Fix correction: Don’t hold a DB lock across Stripe network calls. Prefer short DB transaction to set a `subscription_checkout_in_progress` token (or equivalent), commit, then call Stripe with idempotency key.
- Missed corner case: Same race also duplicates Stripe Customer creation path (`backend/app/api/billing.py:142-147`) and can produce multiple checkout sessions from retries.

### H2. Upgrade supplement `ref_id` blocks legitimate re-upgrades
- Verdict: **AGREE**
- Reasoning: `ref_id = f"{old_plan}_to_{body.plan}"` is reused forever (`backend/app/api/billing.py:250`), and duplicate check uses this exact ref (`backend/app/api/billing.py:251-257`).
- Fix correction: Timestamp-only ref IDs are unsafe for concurrency. Use a cycle-scoped deterministic key (e.g., subscription ID + current period start + transition) and enforce DB uniqueness.
- Missed corner case: There is no unique constraint on ledger idempotency columns (`backend/app/models/tables.py:267-270`), so concurrent requests can still double-credit even with same `ref_id`.

### H3. `/change-plan` modifies Stripe before DB commit
- Verdict: **AGREE**
- Reasoning: Stripe is modified first (`backend/app/api/billing.py:234-240`), DB writes happen after (`backend/app/api/billing.py:245-269`). DB failure can desync local state from Stripe.
- Fix correction: Webhook reconciliation is necessary but insufficient unless webhook also handles supplements idempotently and status-safe.
- Missed corner case: Current webhook handler receives only `event.data.object` (`backend/app/api/billing.py:590-596`), so previous state needed for robust upgrade detection is lost.

### H4. `checkout.session.completed` defaults to `plan="pro"` on Stripe failure
- Verdict: **AGREE**
- Reasoning: Default `plan = "pro"` (`backend/app/api/billing.py:303`), broad exception swallows retrieval errors (`backend/app/api/billing.py:314-315`), then commits plan anyway (`backend/app/api/billing.py:318,326`).
- Fix correction: Return 5xx for transient Stripe failures; for permanent malformed data, dead-letter/log and avoid wrong plan assignment.
- Missed corner case: `except Exception` is too broad; non-Stripe logic errors also silently map users to Pro.

### H5. Frontend concurrent subscribe buttons not cross-disabled
- Verdict: **AGREE**
- Reasoning: Plus and Pro buttons disable independently (`frontend/src/app/billing/page.tsx:320,381` with checks at `frontend/src/app/billing/page.tsx:323,384`), so one can still be clicked while the other is submitting.
- Fix correction: Gate all billing CTAs on `submitting !== null` and add early return in handlers when submitting.
- Missed corner case: Manage and change-plan flows can also overlap because submit-state values are action-specific (`frontend/src/app/billing/page.tsx:188`, `frontend/src/app/billing/page.tsx:143,170`).

### H6. Confirmation dialogs missing keyboard/ARIA/focus behavior
- Verdict: **AGREE**
- Reasoning: Modal markup has no `role="dialog"`, no `aria-modal`, no Escape/backdrop handlers, and no focus trap (`frontend/src/app/billing/page.tsx:456-544`).
- Fix correction: Use a proven dialog primitive (Radix/Headless UI) instead of custom wiring.
- Missed corner case: Background content remains interactable via keyboard focus traversal.

### H7. `subscription.updated` ignores subscription status
- Verdict: **PARTIALLY AGREE**
- Reasoning: Handler syncs plan from price ID (`backend/app/api/billing.py:523-531`) with no status gate; only `cancel_at_period_end` is checked (`backend/app/api/billing.py:517-519`).
- Fix correction: Introduce explicit entitlement policy by status; don’t conflate plan metadata with access state. Avoid unconditional free downgrade on `past_due` unless business-approved.
- Missed corner case: Out-of-order `updated` events after `deleted` can re-set paid plan because status/subscription identity checks are weak.

### H8. `invoice.payment_failed` only logs
- Verdict: **PARTIALLY AGREE**
- Reasoning: Handler only logs and returns (`backend/app/api/billing.py:545-556`), so no user-visible state change.
- Fix correction: Add a `payment_past_due`/`billing_state` field and UI banner; keep entitlement changes policy-driven.
- Missed corner case: No structured state means support/admin cannot query delinquent users without Stripe lookups.

## Medium Priority Findings

### M1. `subscription.deleted` resets `monthly_credits_granted_at` for already-free users
- Verdict: **DISAGREE**
- Reasoning: While reset is unconditional (`backend/app/api/billing.py:504`), monthly grant path has a 30-day ledger idempotency check (`backend/app/services/credit_service.py:228-236`) before granting. This prevents the claimed immediate extra grant.
- Fix correction: Guard is still reasonable hygiene, but impact is overestimated.
- Missed corner case: Reset can still cause unnecessary rechecks and marker churn on next chat request.

### M2. `/subscribe` can create duplicate Stripe Customers
- Verdict: **AGREE**
- Reasoning: Null-check then create (`backend/app/api/billing.py:142-145`) is race-prone; commit after creation (`backend/app/api/billing.py:147`) does not serialize requests.
- Fix correction: Use the same atomic gate as H1 and Stripe idempotency key for customer create.
- Missed corner case: Orphan Stripe customers complicate portal/accounting and manual reconciliation.

### M3. Portal-initiated upgrades don’t get supplement
- Verdict: **AGREE**
- Reasoning: Webhook update handler only syncs plan/subscription (`backend/app/api/billing.py:528-535`); no supplement path exists.
- Fix correction: Add idempotent supplement logic in webhook, but first pass full event (including previous attributes) to detect true upgrades safely.
- Missed corner case: Without order-safe idempotency, retries/out-of-order events can double-supplement.

### M4. Supplement doesn’t account for annual interval
- Verdict: **PARTIALLY AGREE**
- Reasoning: Supplement uses monthly plan deltas (`backend/app/api/billing.py:248`) regardless billing interval.
- Fix correction: If this is intentional beta policy, document it and align UX copy; otherwise prorate by remaining period.
- Missed corner case: Annual plans interact badly with invoice-based monthly grants (see L12).

### M5. `delete_me` swallows Stripe cancellation failure
- Verdict: **AGREE**
- Reasoning: Bare swallow at `backend/app/api/users.py:341-342` can delete local user while leaving active Stripe billing.
- Fix correction: Log + security event + async retry queue/manual ops workflow.
- Missed corner case: If user row is deleted first, later automated reconciliation by user ID becomes harder.

### M6. `ensure_monthly_credits` TOCTOU race
- Verdict: **AGREE**
- Reasoning: Check-then-credit pattern (`backend/app/services/credit_service.py:228-236` then `backend/app/services/credit_service.py:258-267`) is non-atomic across concurrent requests.
- Fix correction: Use cycle-specific idempotency key + DB uniqueness constraint; row lock alone can become hot-path contention.
- Missed corner case: Race also exists cross-process with webhook invoice grant path (not just concurrent chats).

### M7. `checkout.session.completed` doesn’t dedupe duplicate subscriptions
- Verdict: **AGREE**
- Reasoning: Webhook unconditionally sets `stripe_subscription_id` (`backend/app/api/billing.py:319-321`) without comparing existing active sub.
- Fix correction: If different sub already linked, verify statuses and cancel/flag duplicate deterministically.
- Missed corner case: Wrong cancellation policy can cancel the valid subscription if events arrive out of order.

### M8. No `refetchProfile()` after `?success=true`
- Verdict: **AGREE**
- Reasoning: Success effect only sets message + `triggerCreditsRefresh()` (`frontend/src/app/billing/page.tsx:41-45`), while profile hook caches up to 60s (`frontend/src/lib/useUserProfile.ts:8`).
- Fix correction: Call `refetchProfile()` in success flow.
- Missed corner case: If URL param remains (L1), repeated mounts repeatedly trigger the same stale behavior.

### M9. Profile loading/error states ignored on billing page
- Verdict: **AGREE**
- Reasoning: Hook returns `loading/error` (`frontend/src/lib/useUserProfile.ts:15-18`) but page only uses `{ profile, refetch }` (`frontend/src/app/billing/page.tsx:32`), then defaults to free plan behavior (`frontend/src/app/billing/page.tsx:122,396`).
- Fix correction: Render profile skeleton/error before plan-conditional CTAs.
- Missed corner case: Temporary profile fetch failures can expose wrong actions (e.g., subscribe instead of manage).

### M10. Button label inconsistency
- Verdict: **AGREE**
- Reasoning: Mixed constructions: `"Upgrade Plus"` (`frontend/src/app/billing/page.tsx:323,384`) vs `"Upgrade to Pro"` (`frontend/src/app/billing/page.tsx:376`).
- Fix correction: Centralize CTA strings in i18n keys; avoid string concatenation for localization grammar.
- Missed corner case: Non-English locales may need reordered tokens and inflection.

### M11. Cross-interval blocking broken when prices unconfigured
- Verdict: **PARTIALLY AGREE**
- Reasoning: Empty price settings in config (`backend/app/core/config.py:114-117`) make `_interval_from_price_id` return `None` (`backend/app/api/billing.py:74-81`), causing mismatch block (`backend/app/api/billing.py:225-226`).
- Fix correction: Do not “skip interval check” silently; surface misconfiguration explicitly and fail with clear 5xx/4xx.
- Missed corner case: `_plan_from_price_id` also uses empty-string sets (`backend/app/api/billing.py:53-55`), which can mis-detect `""` as Plus.

## Low Priority Findings

### L1. `?success` params not cleaned
- Verdict: **AGREE**
- Reasoning: Params are read (`frontend/src/app/billing/page.tsx:42-47`) but never removed.
- Fix correction: After handling, `router.replace('/billing', { scroll: false })`.
- Missed corner case: Browser refresh/back repeatedly replays success/cancel banners.

### L2. `handlePurchase` resets loading on redirect path
- Verdict: **PARTIALLY AGREE**
- Reasoning: `setLoading(null)` runs unconditionally after setting `window.location.href` (`frontend/src/app/billing/page.tsx:86,93`).
- Fix correction: `return` immediately after redirect.
- Missed corner case: Similar UX pattern exists in other redirect flows if future refactors add shared finally blocks.

### L3. PricingTable CTA has no disabled/loading state
- Verdict: **AGREE**
- Reasoning: CTA button in table has no submitting prop/disabled wiring (`frontend/src/components/PricingTable.tsx:70-75`).
- Fix correction: Pass global billing submitting state down and disable/aria-busy accordingly.
- Missed corner case: Rapid clicks can fire duplicate subscribe/change actions.

### L4. 401 shows generic message, no login redirect
- Verdict: **AGREE**
- Reasoning: API helper throws raw HTTP error (`frontend/src/lib/api.ts:8-10`), handlers catch and show generic billing error (`frontend/src/app/billing/page.tsx:101-103,192-194`).
- Fix correction: Intercept 401 in client API layer and redirect to auth/sign-in.
- Missed corner case: Expired session can look like product failure instead of auth failure.

### L5. Two-tab race shows raw English backend error
- Verdict: **AGREE**
- Reasoning: Error parser extracts backend `detail` and returns it directly (`frontend/src/app/billing/page.tsx:113-116`).
- Fix correction: Map known backend error codes/messages to localized keys.
- Missed corner case: Raw detail exposure can leak internal wording/policies.

### L6. PricingTable accessibility labels hardcoded English
- Verdict: **AGREE**
- Reasoning: Hardcoded labels in icon aria and sr-only text (`frontend/src/components/PricingTable.tsx:41-48`), plus table aria-label (`frontend/src/components/PricingTable.tsx:121`).
- Fix correction: Localize ARIA strings through i18n.
- Missed corner case: Screen-reader experience diverges from visible locale.

### L7. Subscription success URL missing `?success`
- Verdict: **AGREE**
- Reasoning: Subscribe checkout uses plain `/billing` for success/cancel (`backend/app/api/billing.py:154-155`), unlike one-time checkout (`backend/app/api/billing.py:114-115`).
- Fix correction: Include `?success=1` / `?canceled=1`.
- Missed corner case: M8 fix won’t trigger for subscription checkout unless this is fixed.

### L8. Price formatting uses hardcoded `$`
- Verdict: **AGREE**
- Reasoning: Hardcoded currency symbols and strings in UI (`frontend/src/app/billing/page.tsx:282,343,439`).
- Fix correction: Use `Intl.NumberFormat(locale, { style: 'currency', currency: 'USD' })`.
- Missed corner case: `/mo` is also hardcoded and not fully localized (`frontend/src/app/billing/page.tsx:285-286,346`).

### L9. `/portal` endpoint lacks Stripe try/except
- Verdict: **AGREE**
- Reasoning: Stripe portal session create is unguarded (`backend/app/api/billing.py:169-173`).
- Fix correction: Catch `stripe.StripeError`, return controlled 502, log with user ID.
- Missed corner case: Same defensive handling is also needed in `/subscribe` checkout session creation.

### L10. `past_due` blocked from `/change-plan` with unclear message
- Verdict: **AGREE**
- Reasoning: Non-active/trialing statuses are blocked (`backend/app/api/billing.py:216-217`) with generic text.
- Fix correction: Return actionable message (e.g., “update payment method in portal first”).
- Missed corner case: Allowing downgrades during `past_due` may reduce risk exposure and support burden.

### L11. Modals don’t prevent background scroll
- Verdict: **AGREE**
- Reasoning: Modal overlay exists (`frontend/src/app/billing/page.tsx:457,502`), but no body scroll lock or `inert` handling.
- Fix correction: Apply `document.body.style.overflow = 'hidden'` (or library equivalent) while open.
- Missed corner case: iOS Safari especially prone to background scroll bleed-through.

### L12. Monthly credits and invoice credits could overlap
- Verdict: **AGREE**
- Reasoning: Monthly grant is in chat path (`backend/app/services/credit_service.py:211-267`), and invoice webhook also grants `reason="monthly_allowance"` (`backend/app/api/billing.py:470-477`). Independent flows can overlap under concurrency and annual billing cadence.
- Fix correction: Single source of truth for paid-plan allowance grants; e.g., invoice/webhook only for paid plans, `ensure_monthly_credits` for free plans only.
- Missed corner case: For annual subscriptions, invoice grants yearly while `ensure_monthly_credits` can still grant monthly, yielding extra credits around renewal windows.

## Review of Proposed Phase Plan

### Prioritization
- Mostly correct, but I would move **M6** and **M7** into Phase 1 because they are direct money/integrity risks.
- **H8** can remain policy-level unless you’re ready to ship billing-state UX now.

### Ordering dependencies
1. Implement idempotency foundation first:
- DB uniqueness strategy for ledger idempotency keys (`credit_ledger`), then apply H2/M3/M6/M7 logic on top.
2. Resolve subscription creation races together:
- H1 + M2 in one change set (same row-level guard/idempotency strategy).
3. Fix webhook semantics before supplement-in-webhook:
- H7 status/identity gating should land before M3 supplement logic.
4. Fix success URL before success refetch UX:
- L7 should precede/ship with M8.

### Changes that can introduce new bugs
- Long-lived `SELECT ... FOR UPDATE` around Stripe API calls can create lock contention/timeouts.
- Timestamp-based `ref_id` can create duplicate supplements under concurrent retries.
- Blanket 500 retry strategy for webhook failures can cause retry storms for permanent bad payloads.
- Aggressive status downgrades (`past_due -> free`) can remove access prematurely.
- Naive duplicate-sub cancellation can cancel the wrong subscription on out-of-order webhook events.

### Simpler alternatives
1. Stripe idempotency keys for checkout/customer creation (user+plan+billing scoped).
2. DB unique constraint for ledger idempotency (`user_id`, `ref_type`, `ref_id`) and deterministic cycle keys.
3. Restrict `ensure_monthly_credits` to free users; paid users rely on invoice/webhook grants.
4. Use a headless dialog component for all modal accessibility/scroll/focus requirements.
5. Add typed backend error codes; map to localized frontend messages instead of parsing raw strings.
