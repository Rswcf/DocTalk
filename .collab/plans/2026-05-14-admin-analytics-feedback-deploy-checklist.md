# Deploy Checklist: Admin Analytics + Feedback

Date: 2026-05-14

## Include In This Change

- `.collab/plans/2026-05-14-admin-analytics-feedback-goal.md`
- `.collab/plans/2026-05-14-admin-analytics-feedback-growth-analysis.md`
- `.collab/plans/2026-05-14-admin-analytics-feedback-deploy-checklist.md`
- `.collab/tasks/qa-admin-analytics-feedback-2026-05-14.md`
- `backend/alembic/versions/20260514_0030_add_user_feedback.py`
- `backend/app/api/admin.py`
- `backend/app/api/feedback.py`
- `backend/app/main.py`
- `backend/app/models/tables.py`
- `backend/app/schemas/admin.py`
- `backend/app/schemas/feedback.py`
- `backend/tests/test_admin_user_activity.py`
- `backend/tests/test_feedback_api.py`
- `frontend/src/app/admin/AdminPageClient.tsx`
- `frontend/src/components/AdminUserActivityCharts.tsx`
- `frontend/src/components/AppHeaderShell.tsx`
- `frontend/src/components/FeedbackButton.tsx`
- `frontend/src/components/PublicHeader.tsx`
- `frontend/src/components/landing/SocialProof.tsx`
- `frontend/src/i18n/locales/ar.json`
- `frontend/src/i18n/locales/de.json`
- `frontend/src/i18n/locales/en.json`
- `frontend/src/i18n/locales/es.json`
- `frontend/src/i18n/locales/fr.json`
- `frontend/src/i18n/locales/hi.json`
- `frontend/src/i18n/locales/it.json`
- `frontend/src/i18n/locales/ja.json`
- `frontend/src/i18n/locales/ko.json`
- `frontend/src/i18n/locales/pt.json`
- `frontend/src/i18n/locales/zh.json`
- `frontend/src/lib/api.ts`
- `frontend/src/lib/version.ts`

## Do Not Include Without Separate Review

The worktree also contains unrelated table extraction, QA harness, and prior bug/task artifacts. Do not bulk-add `.collab/`, `test_inputs/`, or table extraction files unless those are part of a separate batch.

## Required Before Production

1. Run the new Alembic migration against the target backend database.
2. Confirm production `ADMIN_EMAILS` contains `yijie.ma94@gmail.com`.
3. Confirm frontend production `NEXT_PUBLIC_API_BASE` points to Railway, not localhost.
4. Remove or update Vercel `NEXT_PUBLIC_APP_VERSION` if it is pinned to an older value; the code fallback now reads `frontend/package.json`.
5. After deploy, open `/admin` as an admin and verify the active-user, funnel, retention, blockers, and feedback panels render with production data.

## Manual Production QA

1. Log in with `yijie.ma94@gmail.com`.
2. Open `https://www.doctalk.site/admin`; verify it does not redirect or show `403`.
3. Check the summary cards for DAU, WAU, MAU, signups, activated users, uploads, chats, and paid users.
4. Change the activity window to 7, 30, and 90 days; verify charts refresh without errors.
5. Use manual refresh and one auto-refresh interval; verify the "Last refreshed" timestamp updates.
6. Check the signup-to-activation funnel for plausible stage counts and conversion rates.
7. Check retention cohorts; if production data is sparse, verify empty/low-data states are readable.
8. Check paid-intent blockers for paywall, limit, billing, upgrade, and checkout events.
9. Submit one feedback item from the public header and one from the logged-in app header.
10. Return to `/admin`; verify feedback totals, type/area/severity breakdowns, and recent feedback update.
11. Confirm regular non-admin users cannot access `/admin`.
12. Run one upload -> chat -> citation jump golden path to make sure the new header feedback button did not disrupt core UX.

## Verification Already Completed Locally

- Backend unit/regression tests, ruff, parse-service tests, integration tests.
- Frontend production build and version check.
- Backend local API smoke: health, feedback submit, admin user activity.
- Frontend local smoke: feedback proxy, `/admin` reachability, public header/version/mode-copy HTML.
