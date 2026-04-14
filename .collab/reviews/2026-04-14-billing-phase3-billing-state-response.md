APPROVED

## Findings
No blocking issues found in the requested Phase 3 scope:
- `backend/app/api/billing.py` (`compute_billing_state`, `_billing_state_from_stripe_sub`)
- `backend/app/schemas/users.py` (`BillingStateResponse`, `UserProfileResponse.billing_state`)
- `backend/app/api/users.py` (`get_profile` integration)
- `backend/tests/test_billing_state.py` (11 new tests)

Behavior and contract checks are coherent:
- `can_cancel` is intentionally narrower than plan-level entitlement and aligns with cancel endpoint guardrails (pending, malformed `sub_id`, multi-sub ambiguity, already `cancel_at_period_end`).
- Stripe failure path degrades profile safely (non-500), and degraded states are not cached.
- Status/interval projection matches schema literals and avoids leaking unsupported interval values.
- Cache hit short-circuit and Stripe projection branches are covered by tests; regression bundle passes (`33 passed`).

## Residual Risk (Non-blocking)
- `billing_state` cache invalidation currently appears in cancel flows, but not in every subscription mutation path (e.g., successful checkout/webhook reconciliation and some plan-change paths). This can produce up to 60s stale `billing_state` after mutations. Given the short TTL and your “optimistic UI, strict backend” model, this is acceptable for this phase, but worth tightening before frontend dependency grows.
