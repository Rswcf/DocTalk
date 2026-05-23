# QA Run - Auth Provider Availability UX - 2026-05-11

Scope: verify that `/auth` only exposes sign-in controls for providers actually enabled by Auth.js.

## Environment

| Item | Value |
|---|---|
| Frontend | `http://localhost:3000`, temporary Next.js dev server |
| Backend | Not required for provider-list and auth-page UI checks |
| Provider source of truth | `GET /api/auth/providers` |
| Harness | `.collab/scripts/qa_auth_provider_availability_ux.js` |

Current local provider list:

```json
["google"]
```

## Initial Result

Fail.

Evidence:

- `.collab/tasks/qa-auth-provider-availability-ux-2026-05-11.json`

The page showed unavailable providers:

- Microsoft OAuth button was visible while `microsoft-entra-id` was absent from `/api/auth/providers`.
- Email input and `Continue with Email` were visible while `resend` was absent from `/api/auth/providers`.

Bug:

- `.collab/tasks/bug-2026-05-11-auth-provider-ui-mismatch.md`

## Fix

- `frontend/src/lib/auth.ts` only registers Google when both Google credentials are present.
- `frontend/src/components/AuthFormContent.tsx` reads the active provider list and conditionally renders Google, Microsoft, and email controls.

## Retest

Pass.

Evidence:

- `.collab/tasks/qa-auth-provider-availability-ux-after-provider-fix-2026-05-11.json`

Desktop and mobile assertions:

- Google button visible because `google` is enabled.
- Microsoft button hidden because `microsoft-entra-id` is not enabled.
- Email field and email button hidden because `resend` is not enabled.
- No horizontal overflow.
- Console errors: `0`.

## Validation

Post-fix checks passed:

- `node --check .collab/scripts/qa_auth_provider_availability_ux.js`
- `jq empty` on the failing and passing JSON artifacts
- `cd frontend && npm run build`
- `git diff --check`

## Remaining Gap

This verifies provider-to-UI consistency. It does not complete real OAuth callback or delivered email magic-link testing because those require configured external provider credentials and safe callback accounts.
