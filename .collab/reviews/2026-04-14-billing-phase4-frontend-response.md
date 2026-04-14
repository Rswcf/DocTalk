APPROVED

Blocking findings: none in reviewed scope.

Validated touch-points
- `frontend/src/types/index.ts` (`BillingState` + `UserProfile.billing_state`) matches backend schema shape and enum domain (`managed_by`, `status`, `cancel_at_period_end`, `period_end`, `can_cancel`).
- `frontend/src/lib/api.ts` `cancelSubscription()` contract aligns with backend response (`status: scheduled_cancel|immediate_revert`, `effective_at`, `message`) and uses existing error path via `handle()`.
- `frontend/src/app/billing/BillingPageClient.tsx` L75-100: Esc close + body overflow lock correctly includes `confirmCancel`.
- `frontend/src/app/billing/BillingPageClient.tsx` L238-276: `handleManage`/`handleCancel` now surface backend error content instead of forcing generic `billing.error`.
- `frontend/src/app/billing/BillingPageClient.tsx` L333-397: Current Plan panel is conditionally shown for paid users, displays management source, scheduled-cancel/renewal state, and exposes cancel CTA with Stripe/admin variants.
- `frontend/src/app/billing/BillingPageClient.tsx` L769-824: Confirm-cancel modal copy and branching are correct for Stripe-managed vs admin-managed users.
- i18n parity check: `en.json` and `de.json` have identical `billing.currentPlan.*` + `billing.cancel.*` keysets.

Residual risk / QA focus (non-blocking)
- `frontend/src/app/billing/BillingPageClient.tsx` L496-503 and L557-564: existing card-level `Manage` buttons remain visible for current paid plan regardless of `managed_by`; admin-managed users may still hit an error path there, although the new Current Plan panel provides the correct cancel CTA.
- Date rendering uses browser `toLocaleDateString()` without passing app locale; verify formatting in DE when browser locale differs.
