# Phase 2 Review — `/api/billing/cancel`

**Verdict: APPROVED**

## Findings
No blocking defects found in the requested scope:
- `backend/app/api/billing.py:72-85` constants are coherent (`trialing` included in active/cancellable sets; sentinel/prefix guards are explicit).
- `backend/app/api/billing.py:311-333` change-plan recovery now correctly includes `trialing` subscriptions and preserves previous behavior when no recoverable sub exists.
- `backend/app/api/billing.py:414-677` cancel state machine implements D→E→A→F→C→B with correct fail-closed Stripe handling (`502` on retrieve/list errors, `503` when Stripe key missing), lock-before-mutate in local-demotion branches, and audit row writes before commit.
- `backend/tests/test_billing_cancel.py` covers all planned branches and key races listed in the request.

## Residual Risks (Non-blocking)
1. Stripe `modify` failure paths are not directly unit-tested in Branch A and Branch C (`backend/app/api/billing.py:489-497`, `610-617`). Retrieve/list failures are covered; adding these two tests would close the remaining negative-path gap.
2. Your Branch B vs `customer.subscription.deleted` concurrency note is correct: both paths are idempotent (`plan=free`, `stripe_subscription_id=None`). Adding a one-line code comment near Branch B lock/recheck (`backend/app/api/billing.py:646-653`) would improve maintainability but is not required for correctness.

## Verification
Ran:
- `python3 -m pytest tests/test_billing_cancel.py tests/test_billing_logic.py -q`
- Result: `20 passed`.
