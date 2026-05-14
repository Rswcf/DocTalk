# QA Completion Audit: Admin Analytics + Feedback

Date: 2026-05-14

## Completed

- Added `user_feedback` persistence with additive Alembic migration.
- Added `/api/feedback` with optional auth, IP/user rate limiting, structured choices, optional text, and a matching `ProductEvent`.
- Added `/api/admin/user-activity` for composite active users, active trend, signup cohort funnel, retention, paid-intent reasons, conversion blockers, and feedback summaries.
- Added admin UI panels for live user activity, retention, paid-intent blockers, and feedback.
- Added feedback modal entry points in public and app headers.
- Added `feedback.*` and `common.menu` translation keys across all 11 locale files to avoid runtime fallback noise.
- Fixed verified public copy drift from 3 modes to 2 modes and made frontend version fallback use `frontend/package.json`.
- Wrote growth/paid-intent analysis in `.collab/plans/2026-05-14-admin-analytics-feedback-growth-analysis.md`.

## Verification

- `cd backend && python3 -m pytest tests/test_feedback_api.py tests/test_admin_user_activity.py tests/test_admin_rag_quality.py -v` passed.
- `cd backend && python3 -m ruff check app/ tests/` passed.
- `cd backend && python3 -m pytest tests/test_parse_service.py -v` passed.
- `cd frontend && npm run build` passed.
- `cd frontend && npm run build` passed again after i18n cleanup.
- `cd frontend && npm run version:check` passed.
- `cd backend && SKIP_INTEGRATION=0 DATABASE_URL='postgresql+asyncpg://doctalk:doctalk@localhost:5432/doctalk_test' AUTH_SECRET='test-auth-secret' ADAPTER_SECRET='test-adapter-secret' TESTING=1 python3 -m pytest -m integration -v` passed.
- Backend local API smoke on `http://127.0.0.1:8000` passed: `GET /health`, anonymous `POST /api/feedback`, and admin-authenticated `GET /api/admin/user-activity?period=day&days=7`.
- Frontend local dev server on `http://127.0.0.1:3002` passed: `POST /api/proxy/api/feedback` returned `received`, `HEAD /admin` returned `200 OK`, and homepage HTML includes `Send feedback`, `Beta v0.17.1`, and `2 AI performance modes`.

## Not Run

- In-app Browser click/screenshot check: the Browser plugin was present, but the required Node REPL control tool was not exposed after tool discovery. HTTP smoke checks were used instead.

## External Action Needed

- Apply the Alembic migration before relying on production feedback/admin analytics.
- Production active-user trend and paid-conversion diagnosis still require production admin access/read-only DB data after deploy.
- If Vercel has `NEXT_PUBLIC_APP_VERSION` pinned to an old value, update/remove that env var; code fallback is now aligned with `frontend/package.json`.
