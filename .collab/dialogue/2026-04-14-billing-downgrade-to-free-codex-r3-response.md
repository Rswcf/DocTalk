BLOCKING

1. Branch A uses an invalid ID-shape guard that can bypass real Stripe subscriptions.
- `.collab/plans/billing-cancel-statemachine.md:92` requires `stripe_subscription_id` to be "present AND valid UUID-shape".
- Stripe subscription IDs are not UUIDs (they are `sub_...` strings). With the current branch table (`:90-94`), a non-`pending` `stripe_subscription_id` that is valid in Stripe but not UUID-shaped can miss Branch A, and Branch C/B do not cleanly cover that precondition set.
- This creates ambiguous or incorrect routing in the cancel state machine, including potential unintended local-path behavior.

Required fix:
- Change Branch A precondition to use Stripe-compatible subscription ID semantics (e.g., non-empty non-`pending`, optionally `sub_` pattern), not UUID-shape.
- Add explicit malformed-ID handling branch (fail-closed `409`/`502`, no local revert) so every precondition state is total and deterministic.
