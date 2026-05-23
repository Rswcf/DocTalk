# BUG-2026-05-11-AUTH-PROVIDER-UI-MISMATCH

Status: fixed locally and retested.

## Summary

`/auth` rendered Microsoft OAuth and email magic-link controls even when Auth.js did not expose those providers from `/api/auth/providers`.

In the local QA environment, `/api/auth/providers` returned only `google`, but the browser UI still showed:

- `Continue with Microsoft`
- email textbox
- `Continue with Email`

This creates dead-end sign-in options when preview/local/production provider configuration is incomplete.

## Evidence

Initial failing run:

- `.collab/tasks/qa-auth-provider-availability-ux-2026-05-11.json`

Observed on desktop and mobile:

```json
{
  "provider_ids": ["google"],
  "controls": {
    "google": true,
    "microsoft": true,
    "emailInput": true,
    "emailButton": true
  }
}
```

## Fix

- `frontend/src/lib/auth.ts` now only registers Google when both Google env vars are present.
- `frontend/src/components/AuthFormContent.tsx` fetches the active Auth.js provider list and only renders controls for providers actually enabled by `/api/auth/providers`.
- If no providers are available, the form shows a clear unavailable state instead of dead controls.

## Retest

Retest passed:

- `.collab/tasks/qa-auth-provider-availability-ux-after-provider-fix-2026-05-11.json`

Desktop and mobile both reported:

```json
{
  "provider_ids": ["google"],
  "controls": {
    "google": true,
    "microsoft": false,
    "emailInput": false,
    "emailButton": false
  }
}
```

All assertions passed, with no horizontal overflow and 0 console errors.
