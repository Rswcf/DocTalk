# Billing: no path to downgrade to Free — R1 prompt for Codex

**Context**: DocTalk billing page (`/billing`) shown to a user whose
`plan = "pro"`. The user was promoted to Pro **directly via backend
admin action**, never through Stripe Checkout — so they have **no
`stripe_customer_id` and no `stripe_subscription_id`**.

The billing page renders two cards only — **Plus** (with button
"Downgrade to Plus") and **Pro** (with button "Manage"). There is no
Free card, no "Cancel subscription", no "Return to Free" CTA anywhere.

## What we observe in the code

### Backend `backend/app/api/billing.py` — endpoint `POST /change-plan` (L298-400)
- Requires active Stripe subscription (either `user.stripe_subscription_id`
  or an active sub discoverable via `user.stripe_customer_id`).
- Explicit guard: `if user.plan == "free": raise 400 "Free users must use /subscribe"`.
- **No code path that sets `user.plan = "free"`** through this endpoint.
- Subscription cancellation itself goes through Stripe (via
  `POST /portal`, which returns a `billing_portal.Session` URL).
- The webhook handler for `customer.subscription.deleted` presumably
  sets plan back to free — please verify, we did not confirm.

### Frontend `frontend/src/app/billing/BillingPageClient.tsx` (~662 L)
- When `currentPlan !== "free"`, only Plus + Pro cards are rendered.
- "Manage" button calls `createPortalSession()` → redirects to Stripe
  Billing Portal. Cancellation happens *outside the app*.
- `confirmDowngrade` modal exists but is plumbed only for Plus↔Pro
  transitions, not for → Free.
- No UI affordance for "cancel subscription" or "return to Free".
- `PricingTable` component has an `isDowngrade` flag but also only
  plumbs Plus/Pro tiers.

### The three user classes in production today

| Class | Current path to Free | Status |
|---|---|---|
| Paid user who signed up via Stripe | "Manage" → Stripe Portal → Cancel → Stripe webhook at period end sets plan=free | Works, but UX is indirect |
| Admin-promoted user (no Stripe customer) | None. "Manage" 502s because `stripe_customer_id` is None. | **Broken** |
| Plus↔Pro switch | confirmDowngrade modal | Works |

## Questions for Codex (be adversarial — tell us if Claude is wrong)

1. **Is the admin-promoted-user case actually broken** as described, or
   does some code path we missed handle it? If broken, how severe
   (rare edge case vs. real production issue)?

2. **Is the Stripe-Portal-only cancel flow good enough for normal paid
   users**, or should the app expose an explicit in-app "Cancel
   subscription" CTA?
   - SaaS norms: do reputable SaaS (Linear / Notion / Vercel) expose
     cancel inside their own UI, or defer to Stripe Portal?
   - EU consumer law (§312g BGB widerruf for B2C digital contracts)
     may require a "prominent cancel button" — does current UX satisfy
     this, or is it borderline?

3. **If we add a path to Free, what should happen to**:
   - Prorated credit (user paid for 30 days of Plus on day 5 and now
     cancels — should they keep remaining credits until period end?)
   - Outstanding invoice items
   - Customer support expectations (refund if cancelled within 14
     days per EU Widerrufsrecht?)

4. **Architecture options** — which is right?
   - **A**: New `POST /billing/revert-to-free` endpoint. No Stripe call
     (used only for admin-promoted or Stripe-less users). Frontend
     shows it only when `plan != "free"` AND `stripe_subscription_id
     is None`.
   - **B**: Rework "Manage" into a dual CTA — primary = Stripe Portal
     (for Stripe users), secondary = direct revert (for non-Stripe
     users), disambiguated via presence of `stripe_subscription_id`.
   - **C**: Always render a Free card with "Downgrade to Free" button
     which internally routes to Portal (Stripe users) or
     `/revert-to-free` (non-Stripe users).
   - Any option we missed?

5. **Security / abuse vectors** — any risk in exposing a direct
   plan=free setter? e.g., race conditions with pending invoices,
   could a user game credits by upgrade → consume → revert?

6. **Other oversights** in the billing surface we should patch at the
   same time? (Look broadly — e.g., subscription status mismatch,
   double-debit, admin-promoted user's credit allocation correctness,
   webhook idempotency gaps.)

## Ground rules

- No code yet; this is R1 analysis.
- Be opinionated. Disagree with Claude's three-option framing if you
  think a fourth is better.
- Keep reply under ~500 words unless the bug surface demands more.
- Write output to
  `.collab/dialogue/2026-04-14-billing-downgrade-to-free-codex-r1-response.md`
  (Codex can't git; Claude will commit the exchange afterwards).

## Relevant files

- `backend/app/api/billing.py` (change-plan + portal + webhook)
- `frontend/src/app/billing/BillingPageClient.tsx`
- `frontend/src/components/PricingTable.tsx`
- `backend/app/models/user.py` (for plan / stripe_* columns)
