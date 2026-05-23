# BUG-2026-05-10-CONSENT-BANNER-BLOCKS-CHAT-SHARE

Status: **fixed locally and retested**

## Summary

On workspace pages, the analytics consent banner could cover the bottom composer action area and intercept clicks on `Share conversation`. This affected first-time users who had not accepted or declined analytics consent.

## Impact

- Feature affected: authenticated document reader ChatPanel sharing.
- User-visible symptom: the share button appears visible and enabled, but clicking it can do nothing because the consent banner sits above it.
- Severity: P2 UX bug. It blocks a core sharing action for first-time users until they notice and dismiss the consent banner.

## Repro

1. Start local backend/frontend.
2. Use a fresh browser context with no `doctalk_analytics_consent` localStorage key.
3. Authenticate as a user with a ready document and at least one chat answer.
4. Open `/d/{documentId}`.
5. Click `Share conversation` in the ChatPanel composer.

Expected: the share URL is copied and the UI displays the copied confirmation.

Actual before fix: the fixed consent banner subtree intercepted the pointer event over the share button.

## Root Cause

`frontend/src/components/CookieConsentBanner.tsx` attempted special positioning for workspace routes, but at the `sm` breakpoint it returned to `sm:bottom-4`. On document reader pages that placed the banner over the bottom composer controls.

## Fix

Workspace routes now position the consent banner below the header:

- `top-[calc(env(safe-area-inset-top,0px)+4.75rem)]`
- `sm:right-4`
- no bottom positioning on workspace routes

Changed file:

- `frontend/src/components/CookieConsentBanner.tsx`

## Retest

Passing evidence:

- `.collab/tasks/qa-browser-chat-share-ux-2026-05-10.json`
- `.collab/tasks/qa-run-2026-05-10-browser-chat-share-ux.md`

The retest clicked answer copy, answer share, and conversation share on desktop and mobile while the consent banner was visible. It also opened the copied answer share URL and verified the public answer anchor target.

## Follow-Up - 2026-05-11

Billing cancel modal testing found the same class of consent-banner interference on mobile modal controls. Workspace top-positioning fixed ChatPanel sharing, but global blocking dialogs still needed a stronger rule.

Additional fix:

- `CookieConsentBanner` now hides while any `[role="dialog"][aria-modal="true"]` is open.
- The banner baseline z-index is below modal overlays.

Additional passing evidence:

- `.collab/tasks/bug-2026-05-11-billing-cancel-modal-consent-and-stale-profile.md`
- `.collab/tasks/qa-run-2026-05-11-browser-billing-cancel-ux.md`
- `.collab/tasks/qa-browser-billing-cancel-ux-after-profile-consent-fix-2026-05-11.json`
