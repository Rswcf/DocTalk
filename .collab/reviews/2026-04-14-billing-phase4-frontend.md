# Phase 4 review request — Frontend cancel CTA + current plan panel

## Changes

1. `frontend/src/types/index.ts` — added `BillingState` interface;
   `UserProfile.billing_state: BillingState`
2. `frontend/src/lib/api.ts` — added `cancelSubscription()` +
   `CancelSubscriptionResult` type
3. `frontend/src/i18n/locales/en.json` + `de.json` — 28 new
   `billing.currentPlan.*` / `billing.cancel.*` keys each (other 9
   locales fall back via `tOr`)
4. `frontend/src/app/billing/BillingPageClient.tsx`:
   - Added `confirmCancel` state + `handleCancel` handler + updated
     Esc-handler + body-overflow effect to cover the new modal
   - Added **Current Plan panel** above the Plus/Pro cards (visible
     only for paid users), showing plan + managed_by badge + renewal /
     scheduled-cancel status line + Cancel button + optional Stripe
     Portal link
   - Added **ConfirmCancel modal** with BGB §312k-compliant copy;
     variant for Stripe-managed vs admin-managed users
   - **Error surfacing fix (R1 §6)**: `handleManage` / `handleCancel`
     now pass backend `detail` through instead of swallowing to
     generic `billing.error`

## Test results

`npm run build` → clean. Only pre-existing (unrelated) lint
warnings. `/billing` route still in static bundle (3.93 kB → TBD).

## Deviation from plan

**Not** the full 3-card (Free + Plus + Pro) layout promised in plan
§6.1. Chose a **Current Plan panel + keep existing 2-card Plus/Pro**
design:

- The core business requirement — a BGB §312k-compliant, visible
  cancel CTA that works for both Stripe-managed and admin-promoted
  users — is met
- The 3-card rewrite is visually disruptive and adds QA surface not
  required for the fix
- Plus/Pro cards still contain Upgrade / Downgrade-to-Plus /
  Manage-Stripe affordances (unchanged)

Plan §6.1 assumes the panel is rendered via 3-card but doesn't
require it — the constraint is semantic (cancel is visible and one
click). Open to Codex pushback if this is judged insufficient.

## Manual QA checklist (must pass before deploy)

- [ ] Admin-promoted Pro user (the one that surfaced this bug) sees
  the Current Plan panel with "Return to Free plan" button
- [ ] Stripe-managed Plus user sees "Cancel subscription" (red outline)
  + "Manage billing in Stripe →" link
- [ ] After cancel click → modal → confirm → scheduled_cancel response
  → success banner shows with period_end date
- [ ] After cancel, page refreshes profile → Current Plan panel now
  shows "Your subscription will end on …" amber banner + Cancel
  button hidden (cancel_at_period_end=true → can_cancel=false)
- [ ] DE locale: modal title = "Abonnement kündigen", body copy in DE

## Request

APPROVED or BLOCKING with line-referenced issues. Under 400 words.

Review touch-points:
- `frontend/src/app/billing/BillingPageClient.tsx` diff scope:
  - L75-100 (Esc + overflow effects)
  - L238-276 (handleCancel + handleManage error fix)
  - L308-370 (Current Plan panel)
  - L800-860 (Cancel modal)
- `frontend/src/lib/api.ts` cancelSubscription function
- `frontend/src/types/index.ts` BillingState interface
- i18n parity (en + de coverage)

Output: `.collab/reviews/2026-04-14-billing-phase4-frontend-response.md`
