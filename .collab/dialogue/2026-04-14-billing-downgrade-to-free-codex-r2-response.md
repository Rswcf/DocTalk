BLOCKING

1. Profile endpoint mismatch in plan
- Plan says extend `GET /api/users/me` (`.collab/plans/billing-cancel-statemachine.md:95-111`), but billing UI reads `/api/users/profile` (`frontend/src/lib/api.ts:138-141`) and schema there is `UserProfileResponse` (`backend/app/schemas/users.py:21-34`).
- If implemented as written, frontend never gets `billing_state`.

2. `pending` subscription sentinel is not handled in cancel design
- Branch A uses “`stripe_subscription_id` present” (`.../billing-cancel-statemachine.md:86`), but code uses `"pending"` as an in-flight sentinel (`backend/app/api/billing.py:217,242`).
- Cancel on `pending` must be explicit 409 (or wait-and-retry), not Stripe modify.

3. Drift/Stripe lookup must fail closed, not revert locally
- Branch B/C logic (`.../billing-cancel-statemachine.md:87-89`) does not specify Stripe API failure behavior.
- If Stripe lookup errors/timeouts and code falls through to local revert, you can desync entitlements for actually-paid users. Require fail-closed: return 502/409 unless Stripe confirms “no cancellable sub”.

4. Audit-table scope overpromises current phase plan
- Plan claims unified audit across webhook/change-plan/admin/cancel (`.../billing-cancel-statemachine.md:41-42`), but Phase 3 only mentions new cancel endpoint + trialing fix (`...:225-231`).
- Either reduce scope to “cancel-path audit now” or add explicit writes in webhook + `change-plan` in same implementation plan.

Non-blocking but important

- `can_cancel = plan != free` (`.../billing-cancel-statemachine.md:117`) is too broad. Set false for known-invalid states (e.g., `pending`, unresolved drift) to avoid intentional 409 UX.
- Keep Stripe Portal entry point. Replacing with only downgrade buttons (`...:127-140`) removes payment-method/invoice self-service.

Phase ordering

- Recommend: Phase 1 (migration) → Phase 2 (cancel endpoint + tests + trialing fix) → Phase 3 (`billing_state`) → Phase 4 (frontend) → Phase 5 (docs).
- Reason: today’s production bug is backend cancel path for admin-promoted users; that should land before profile-shape enhancement.

Open questions (§10)

1. Branch C auto-heal?
- Pick: **Yes, conditionally**. If exactly one cancellable sub is found, auto-heal `stripe_subscription_id` then proceed; if 0 or >1, return 409. Log reconciliation event.

2. Expose credits in `billing_state`?
- Pick: **No**. Use existing `credits_balance` in profile; avoid duplicated source.

3. Add `/billing/reactivate` now?
- Pick: **Defer**. Keep Stripe Portal “Manage billing” for reactivation in this iteration.

4. Migration naming?
- Pick: **`20260414_0021_*`**. This matches dominant repo pattern (`backend/alembic/versions/*`).

5. Backfill historical admin transitions?
- Pick: **From-now-forward only**. Historical rows are low-confidence and not needed for correctness.
