# Production Frontend API Guards - 2026-05-11

Scope: non-destructive production checks for Next.js API routes served by `https://www.doctalk.site`. This complements backend API guard coverage by exercising frontend-owned endpoints and proxy behavior.

## Environment

- Frontend: `https://www.doctalk.site`
- Harness: `.collab/scripts/qa_production_frontend_api_guards.py`

## Command

```bash
python3 .collab/scripts/qa_production_frontend_api_guards.py \
  --json-out .collab/tasks/qa-production-frontend-api-guards-2026-05-11.json
```

## Result

Final result: **pass**.

```json
{
  "total": 16,
  "passed": 16,
  "failed": 0,
  "groups": {
    "auth_public": {"total": 2, "failed": 0},
    "contact_validation": {"total": 4, "failed": 0},
    "csp_report_guard": {"total": 5, "failed": 0},
    "frontend_proxy": {"total": 2, "failed": 0},
    "indexnow_guard": {"total": 2, "failed": 0},
    "upload_token_guard": {"total": 1, "failed": 0}
  }
}
```

Evidence: `.collab/tasks/qa-production-frontend-api-guards-2026-05-11.json`

## Coverage

Auth.js public metadata:

- `GET /api/auth/providers` returned the expected enabled providers: Google, Microsoft Entra ID, and Resend.
- `GET /api/auth/session` returned the expected anonymous empty session shape without token leakage.

Upload token:

- `GET /api/upload-token` returned `401` for anonymous traffic and did not return a token.

IndexNow:

- `POST /api/indexnow` returned `401` without auth.
- `POST /api/indexnow` with an intentionally wrong bearer token returned `401`.
- No authorized request was sent, so no IndexNow submission was made.

Contact form validation:

- Invalid JSON returned `400`.
- Invalid email returned `400` before Resend could be called.
- Short message returned `400` before Resend could be called.
- Honeypot-filled request returned silent `{ "ok": true }`, which exercises the bot sink without sending email.

CSP report endpoint:

- `GET /api/csp-report` returned `405`.
- Unsupported content type returned `415`.
- Invalid JSON returned `400`.
- Oversized payload returned `413`.
- Empty JSON report returned `204` without a normalized report, avoiding a Sentry capture.

Frontend proxy:

- `GET /api/proxy/api/documents/demo` returned ready production demo documents.
- `GET /api/proxy/api/users/me` returned `401` for anonymous traffic.

All checks passed without sensitive marker leakage for secret names, key patterns, DB/Redis URLs, or stack traces.

## Notes

- The first run expected `/api/auth/session` to return a JSON object; production correctly returned JSON `null` for anonymous users. The harness was corrected to accept null-or-object while still rejecting token leakage, then reran 16/16 pass.
- This does not verify successful email delivery, OAuth callback completion, or authorized IndexNow submission; those require safe credentials/operational approval.
