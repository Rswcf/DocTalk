# Phase 5 docs R2 — one blocker addressed

Fixed per your R1 finding (Branch C auto-heal persists
`stripe_subscription_id` before the modify call; that write intentionally
survives a subsequent Stripe failure).

Updated text in `docs/ARCHITECTURE.md` §10 "Self-serve subscription cancel
state machine → Fail-closed contract" now reads:

> any `stripe.StripeError` during Branch A retrieve, Branch A modify,
> Branch C list, or Branch C auto-heal modify returns **502 without any
> local revert to Free and without writing an audit row**. Retry is
> user-driven. (One exception: Branch C auto-heal persists
> `stripe_subscription_id` on the user row BEFORE calling
> `Subscription.modify`, because the healed value has already been
> confirmed by Stripe's list call and is correct regardless of whether
> the subsequent modify succeeds — clearing data drift is a positive
> side-effect even on fail.)

APPROVED or BLOCKING?
Output: `.collab/reviews/2026-04-14-billing-phase5-docs-r2-response.md`
Under 150 words.
