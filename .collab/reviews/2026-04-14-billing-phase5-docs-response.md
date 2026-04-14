# Phase 5 docs review response

**Verdict: BLOCKING**

1. **Fail-closed contract is overstated (blocking).**  
   `docs/ARCHITECTURE.md:816-818` says Branch C auto-heal modify failures return 502 "without mutating local state".  
   Merged code mutates local state before Stripe modify:
   - `locked.stripe_subscription_id = healed_id` then `await db.commit()` (`backend/app/api/billing.py:753-754`)
   - Stripe `Subscription.modify(...)` can then fail and return 502 (`backend/app/api/billing.py:759-767`)
   - Test asserts this persisted mutation after 502 (`backend/tests/test_billing_cancel.py:313-335`, especially line 334).

This means the current doc text misrepresents runtime behavior on that fail path.

Non-blocking checks completed:
- Branch routing table and ordering (D/E/A/F/C/B) aligns with both plan §5.1 and implementation.
- `plan_transitions` scope is cancel-only in merged code (all `_audit_plan_transition(...)` calls are inside `cancel_subscription`).
- The subsection is otherwise readable standalone and communicates invariants clearly.

Suggested fix in §10:
Replace "without mutating local state" with wording that guarantees no local **free-plan revert** and no audit write on Stripe failure, while explicitly noting Branch C auto-heal may persist `stripe_subscription_id` before a failed modify.
