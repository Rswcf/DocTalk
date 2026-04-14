# Billing R1 (Codex) — downgrade-to-free

## 1) Is admin-promoted user broken?
Yes, broken.
- `POST /api/billing/portal` hard-fails when `stripe_customer_id` is missing (`400 No Stripe customer for user`).
- `POST /api/billing/change-plan` requires an active Stripe subscription and has no path to `plan="free"`.
- Billing UI for non-free users exposes only Plus/Pro actions, no Free action.

So a `plan="pro"` user with no Stripe linkage has no self-serve path back to Free. This is a real production issue if admin promotions are used operationally (support, grants, migrations), not just a theoretical edge case.

One correction: code suggests this should surface as 400, not 502; if you observe 502, there is likely an additional runtime/proxy failure.

## 2) Is Stripe-Portal-only cancel “good enough”?
Operationally: acceptable.
Product/legal UX: weak.

Most mature SaaS expose cancellation from in-app billing settings (Notion, Linear, Vercel docs all show billing/settings cancellation flows), even if backend mechanics are Stripe-mediated.

For Germany/EU, the cancellation-button duty is mainly §312k BGB (not §312g). §312k requires a clearly labeled, easily accessible cancel flow on the website. A generic “Manage” CTA that punts users to Stripe is at least borderline for compliance posture.

## 3) If adding path to Free, what about proration/invoices/refunds?
- Stripe users: prefer `cancel_at_period_end=true` by default. Keep paid entitlements until period end; no new paid-cycle allowance after end.
- Credits: do not claw back already granted/paid credits; that creates support disputes.
- Outstanding invoice items/prorations: let Stripe finalize via normal final invoice behavior; do not silently discard.
- 14-day withdrawal/refund: define explicit policy + support playbook. Right of withdrawal exists in principle, but for digital services/content can be curtailed when performance starts with explicit consumer consent/acknowledgment.

## 4) Architecture choice
I recommend **Option D** (better than A/B/C):
- Add one backend cancel endpoint (`/billing/cancel` or `/billing/downgrade-to-free`) as a state machine.
- Backend decides branch:
  - Stripe-managed account: schedule cancel (or return portal deep link to cancellation flow).
  - Stripe-less account: immediate local revert to free.
- Frontend always renders a Free card / explicit “Cancel or downgrade to Free” CTA.
- Extend profile payload with billing capability state (`managed_by`, `can_cancel`, `period_end`, `cancel_at_period_end`) so UI doesn’t infer from hidden Stripe IDs.

## 5) Security / abuse risks
- Require row lock + idempotency key on downgrade/cancel endpoints.
- Block local free-revert when any active/past_due Stripe sub exists.
- Never mint credits on downgrade paths.
- Audit-log every plan transition source (`stripe_webhook`, `portal`, `admin`, `self_serve`).

## 6) Other oversights to patch now
- `UserProfileResponse` omits Stripe/billing-state metadata, forcing blind UI decisions.
- Profile “Manage” action swallows errors (no user feedback).
- `change-plan` recovery lookup uses `status="active"` only; can miss `trialing` subscriptions.

## Sources
- Stripe cancel + portal behavior: https://docs.stripe.com/billing/subscriptions/cancel , https://docs.stripe.com/billing/subscriptions/customer-portal , https://docs.stripe.com/billing/subscriptions/canceling
- SaaS examples: https://www.notion.com/help/upgrade-or-downgrade-your-plan , https://linear.app/docs/billing-and-plans , https://vercel.com/docs/plans/pro
- German/EU legal texts: https://www.gesetze-im-internet.de/bgb/__312k.html , https://www.gesetze-im-internet.de/bgb/__312g.html , https://europa.eu/youreurope/citizens/consumers/shopping/returns/indexamp_en.htm
