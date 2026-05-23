# Production Auth Provider Availability UX - 2026-05-11

Scope: verify the production `/auth` page only shows controls for providers enabled by production Auth.js.

## Environment

- Frontend: `https://www.doctalk.site`
- Provider source of truth: `GET /api/auth/providers`
- Browser driver: Playwright Chromium
- Viewports: desktop `1440x900`, mobile `390x844`
- Harness: `.collab/scripts/qa_auth_provider_availability_ux.js`

## Command

```bash
node .collab/scripts/qa_auth_provider_availability_ux.js \
  --base-url https://www.doctalk.site \
  --json-out .collab/tasks/qa-production-auth-provider-availability-ux-2026-05-11.json
```

## Result

Final result: **pass**.

Production provider ids:

```json
["google", "microsoft-entra-id", "resend"]
```

| Check | Desktop | Mobile |
|---|---:|---:|
| `/api/auth/providers` status | 200 | 200 |
| `/auth?callbackUrl=/document-diff` status | 200 | 200 |
| Google control matches provider | Pass | Pass |
| Microsoft control matches provider | Pass | Pass |
| Email input/control matches provider | Pass | Pass |
| No horizontal overflow | Pass | Pass |
| Console errors | 0 | 0 |

Evidence: `.collab/tasks/qa-production-auth-provider-availability-ux-2026-05-11.json`

## Remaining Gap

This verifies production provider discovery and UI consistency. It does not execute real OAuth callbacks or delivered email magic-link login because those require safe external accounts and inbox/callback handling.
