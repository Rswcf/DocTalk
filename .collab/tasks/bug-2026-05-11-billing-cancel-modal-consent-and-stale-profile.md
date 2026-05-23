# BUG-2026-05-11-BILLING-CANCEL-MODAL-CONSENT-AND-STALE-PROFILE

Status: **fixed locally and retested**

## Summary

Authenticated browser testing of `/billing` found two cancellation UX failures:

- On mobile, the analytics consent banner could intercept clicks on the cancel-confirmation modal buttons.
- After a successful admin-managed cancellation, the API/profile returned Free but the page could keep rendering the stale Plus current-plan panel.

## Impact

- Feature affected: self-serve cancellation from `/billing`.
- User-visible symptoms:
  - first-time mobile users could be blocked from pressing `Back` or `Confirm cancellation` until dismissing the consent banner
  - after successful cancellation, users could see a contradictory success message and an old paid current-plan panel
- Severity: P1/P2 billing UX. Cancellation must remain clearly self-serve and state-consistent.

## Repro

1. Start local backend/frontend.
2. Create an authenticated `plus` user with no Stripe customer/subscription ids, so Billing shows `Admin-assigned` and `Return to Free plan`.
3. Use a fresh browser context with no `doctalk_analytics_consent` localStorage key.
4. Open `/billing`, click `Return to Free plan`.
5. On mobile `390x844`, click `Back`.
6. Reopen the modal, choose `Answers or citations were not good enough`, enter feedback, check `Request a refund review`, and click `Confirm cancellation`.

Expected:

- Consent UI never blocks modal controls.
- Back closes the modal without calling `/api/billing/cancel`.
- Confirm sends the reason/feedback/refund payload, closes the modal, shows refund-review success copy, and the current-plan panel disappears after the user is Free.

Actual before fix:

- Consent banner intercepted the mobile modal button click.
- Desktop cancellation could return `plan=free` from the profile API while the page still rendered `Your current plan Plus Plan`.

## Root Cause

- `CookieConsentBanner` stayed visible while blocking dialogs were open. Lowering z-index alone was insufficient on mobile because the banner still occupied the modal button hit area.
- `useUserProfile().refetch()` used the existing module-level `inflightRequest`, so a forced refresh after cancellation could await a stale profile request that started before the mutation. Older requests could then overwrite the fresh profile state.

## Fix

Changed files:

- `frontend/src/components/CookieConsentBanner.tsx`
- `frontend/src/lib/useUserProfile.ts`

Implementation:

- Consent banner now hides while any `[role="dialog"][aria-modal="true"]` is present, and its baseline z-index is below modal overlays.
- Forced profile refresh now starts a new request, tracks request sequence, and ignores stale older responses.

## Retest

Passing evidence:

- `.collab/tasks/qa-browser-billing-cancel-ux-after-profile-consent-fix-2026-05-11.json`
- `.collab/tasks/qa-run-2026-05-11-browser-billing-cancel-ux.md`

Retest assertions passed on desktop `1440x900` and mobile `390x844`:

- initial profile: `plan=plus`, `billing_state.managed_by=admin`, `can_cancel=true`
- `Back` closed the modal and made `0` cancel requests
- confirm payload: `reason=answer_quality`, feedback captured, `refund_requested=true`
- cancel API returned `200`, `status=immediate_revert`, `refund_requested=true`
- final profile: `plan=free`, `billing_state.managed_by=none`
- success copy included refund-review confirmation
- no horizontal overflow before modal, in modal, or after cancellation
- console errors: `0`
