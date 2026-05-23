# Browser Auth/Admin UX Run - 2026-05-10

Scope: browser validation of authentication pages and admin dashboard access control. This run verifies unauthenticated auth surfaces, non-admin denial behavior, admin dashboard loading, admin API aggregation through the frontend proxy, and desktop/mobile layout.

## Environment

- Backend: host FastAPI at `http://127.0.0.1:8000`.
- Frontend: Next.js dev server at `http://localhost:3000`.
- Infra: local Docker Compose Postgres, Redis, Qdrant, and MinIO.
- Browser driver: Playwright Chromium.
- Viewports: desktop `1440x900`, mobile `390x844`.

## Test Data

- Fixture script: `.collab/scripts/qa_browser_auth_admin_fixture.py`.
- Browser script: `.collab/scripts/qa_browser_auth_admin_ux.js`.
- Fixture output: `.collab/tasks/qa-browser-auth-admin-fixture-2026-05-10.json`.
- Raw browser evidence: `.collab/tasks/qa-browser-auth-admin-ux-2026-05-10.json`.
- Cleanup output: `.collab/tasks/qa-browser-auth-admin-fixture-cleanup-2026-05-10.json`.
- Admin user: existing local admin account from `ADMIN_EMAILS`; fixture did not delete it.
- Regular user: synthetic Free QA user; cleanup verified `users=0`, `documents=0`, `sessions=0`, and `shared_sessions=0`.

## Commands

```bash
cd backend && python3 -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
cd frontend && npm run dev -- --hostname 0.0.0.0 --port 3000

python3 .collab/scripts/qa_browser_auth_admin_fixture.py create \
  --api-base http://127.0.0.1:8000 \
  --json-out .collab/tasks/qa-browser-auth-admin-fixture-2026-05-10.json

node .collab/scripts/qa_browser_auth_admin_ux.js \
  --base-url http://localhost:3000 \
  --fixture .collab/tasks/qa-browser-auth-admin-fixture-2026-05-10.json \
  --json-out .collab/tasks/qa-browser-auth-admin-ux-2026-05-10.json

python3 .collab/scripts/qa_browser_auth_admin_fixture.py cleanup \
  --regular-user-id cd54ddfa-57fe-439a-874d-45740e77b18a \
  --admin-user-id 1521ed82-c1f9-4dfc-8465-2a4a8746ab83 \
  --json-out .collab/tasks/qa-browser-auth-admin-fixture-cleanup-2026-05-10.json
```

## Result

Final result: **pass**.

| Check | Result |
|---|---|
| `/auth?callbackUrl=/document-diff` desktop/mobile | Pass: 200, H1, Google/Microsoft/email controls visible, no overflow or clipped interactive controls |
| `/auth/error?error=AccessDenied` desktop/mobile | Pass: 200, expected access-denied copy, H1, no overflow |
| `/auth/verify-request` desktop/mobile | Pass: 200, expected check-email copy, H1, no overflow |
| Anonymous `/admin` | Pass: redirected to `/auth?callbackUrl=/admin` on desktop and mobile |
| Non-admin `/api/admin/overview` | Pass: frontend proxy returned 403 |
| Non-admin `/admin` | Pass: redirected to `/` on desktop and mobile |
| Admin `/admin` | Pass: dashboard loaded on desktop and mobile |
| Admin API aggregation | Pass: overview, trends, breakdowns, billing health, funnel, RAG quality, recent users, and top users all returned 200 through `/api/proxy` |
| Admin controls | Pass: `Verify Stripe` visible; `Sort by` select changed to documents |
| Layout | Pass: no document-level horizontal overflow and no clipped interactive controls on desktop/mobile |
| Console | Pass: 0 unexpected console errors. Non-admin 403 resource logs are expected denial evidence. |
| Cleanup | Pass: synthetic regular user removed; preexisting local admin user left untouched |

Screenshots:

- `.collab/tasks/screenshots/2026-05-10/auth-page-desktop.png`
- `.collab/tasks/screenshots/2026-05-10/auth-page-mobile.png`
- `.collab/tasks/screenshots/2026-05-10/admin-desktop.png`
- `.collab/tasks/screenshots/2026-05-10/admin-mobile.png`

## Notes

- This run does not execute real Google/Microsoft OAuth callbacks or real email magic-link delivery. Local `RESEND_API_KEY` is absent and OAuth provider credentials are environment-dependent.
- This run does not execute remote Stripe verification or checkout/portal flows; it verifies the admin dashboard billing-health surface and local admin API access.
- During development, the Next dev server had to be restarted after `npm run build`; otherwise stale dev chunks were served as HTML. The final passing run used a fresh dev server.
