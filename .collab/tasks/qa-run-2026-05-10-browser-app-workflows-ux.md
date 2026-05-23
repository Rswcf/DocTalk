# Browser App Workflows UX Run - 2026-05-10

Scope: authenticated browser smoke for non-reader app workflows: Profile, Billing, Collections, collection Document Diff, and standalone Document Diff. The run verifies real page navigation, authenticated API proxy access, core UI controls, desktop/mobile layout, console errors, and fixture cleanup.

## Environment

- Backend: host FastAPI at `http://127.0.0.1:8000`.
- Frontend: Next.js dev server at `http://localhost:3000`.
- Worker: local Celery worker for `default,parse`.
- Infra: local Docker Compose Postgres, Redis, Qdrant, and MinIO.
- Browser driver: Playwright Chromium.
- Viewports: desktop `1440x900`, mobile `390x844`.

## Test Data

- Fixture script: `.collab/scripts/qa_browser_app_workflows_fixture.py`.
- Browser script: `.collab/scripts/qa_browser_app_workflows_ux.js`.
- Fixture output: `.collab/tasks/qa-browser-app-workflows-fixture-2026-05-10.json`.
- Raw browser evidence: `.collab/tasks/qa-browser-app-workflows-ux-2026-05-10.json`.
- Cleanup output: `.collab/tasks/qa-browser-app-workflows-fixture-cleanup-2026-05-10.json`.
- User: synthetic Pro QA user with 20,000 credits.
- Documents from `test_inputs/`: `semiconductor.pdf` and `charting_library_license_agreement.pdf`.

The fixture cleanup verified `users=0`, `documents=0`, `collections=0`, and `sessions=0`.

## Commands

```bash
cd backend && python3 -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
cd backend && OBJC_DISABLE_INITIALIZE_FORK_SAFETY=YES python3 -m celery -A app.workers.celery_app worker --loglevel=info -Q default,parse
cd frontend && npm run dev -- --hostname 0.0.0.0 --port 3000

python3 .collab/scripts/qa_browser_app_workflows_fixture.py create \
  --api-base http://127.0.0.1:8000 \
  --json-out .collab/tasks/qa-browser-app-workflows-fixture-2026-05-10.json

node .collab/scripts/qa_browser_app_workflows_ux.js \
  --fixture .collab/tasks/qa-browser-app-workflows-fixture-2026-05-10.json \
  --base-url http://localhost:3000 \
  --json-out .collab/tasks/qa-browser-app-workflows-ux-2026-05-10.json

python3 .collab/scripts/qa_browser_app_workflows_fixture.py cleanup \
  --user-id 6612a92c-7420-467f-9cd1-7390f6236847 \
  --json-out .collab/tasks/qa-browser-app-workflows-fixture-cleanup-2026-05-10.json
```

## Result

Final result: **pass**.

| Check | Result |
|---|---|
| Auth/session/profile API | Pass: browser session 200, profile proxy 200 |
| Profile desktop tabs | Pass: Profile, Credits, Usage, Account, Notifications tabs navigated with no document overflow or clipped controls |
| Profile data export | Pass: `Download My Data` triggered `/api/users/me/export` through the proxy with 200 JSON attachment header |
| Profile delete guard | Pass: delete dialog opened and destructive button stayed disabled before email confirmation |
| Billing desktop | Pass: page 200, Plus/Pro cards rendered, annual/monthly toggle updated `aria-pressed`, credit top-ups rendered |
| Collections desktop | Pass: created a collection from browser modal, selected 2 ready docs, landed on collection workspace |
| Collections add-docs empty state | Pass: when all ready docs were already in the collection, add-docs modal showed no available docs |
| Collection Document Diff | Pass: Compare tab opened, old/new selectors each had 2 ready docs, Compare button enabled |
| Standalone Document Diff | Pass: selectors had 2 ready docs and Compare button was enabled |
| Mobile Profile/Billing | Pass: routes 200, no document-level horizontal overflow |
| Mobile Collection Compare | Pass: collection workspace opened, Documents toggle and Compare tab worked, no overflow |
| Mobile standalone Document Diff | Pass: selectors ready, Compare enabled, no overflow |
| Console errors | Pass: 0 desktop, 0 mobile |
| Cleanup | Pass: fixture user/docs/collections/sessions all removed |

Screenshots:

- `.collab/tasks/screenshots/2026-05-10/app-profile-desktop-account.png`
- `.collab/tasks/screenshots/2026-05-10/app-billing-desktop.png`
- `.collab/tasks/screenshots/2026-05-10/app-collections-desktop-diff.png`
- `.collab/tasks/screenshots/2026-05-10/app-mobile-diff.png`

## Findings And Fixes

1. `/document-diff` had no page-level H1 in the app shell.
   - Fixed in `frontend/src/app/document-diff/page.tsx` with an `sr-only` H1 using `tOr("diff.pageTitle", "Document diff")`.
   - The passing browser run observed the H1 on desktop and mobile.

2. The Profile account export button is labeled `Download My Data`, not `Export`.
   - The test script now clicks the real UI copy and validates the proxy response status plus attachment header.
   - Playwright could not re-read the blob body after the frontend consumed it, so this smoke treats status/header as the browser-level export signal. API-level export content and rate-limit behavior are covered by the account privacy matrix.

3. Mobile Profile tabs intentionally use a horizontally scrollable tablist.
   - The script now checks document-level overflow for this page instead of treating a partially offscreen tab inside the scrollable tablist as a UI failure.

## Remaining Gaps

- This run did not click Compare to start a real Document Diff job because that depends on live LLM execution and should be scored separately.
- Billing checkout/portal/change/cancel buttons were not clicked; this run only verifies visible plan/top-up UI and billing-period controls.
- Sharing, admin, OAuth/email auth, and authenticated 11-locale app workflows still need browser coverage.
