# Authenticated Locale UI Run - 2026-05-10

Scope: authenticated browser smoke for app pages across all 11 supported interface locales. This run extends the earlier public locale smoke (`/`, `/pricing`, `/demo`) into gated product surfaces.

## Environment

- Backend: host FastAPI at `http://127.0.0.1:8000`.
- Frontend: Next.js dev server at `http://localhost:3000`.
- Infra: local Docker Compose Postgres, Redis, Qdrant, and MinIO.
- Browser driver: Playwright Chromium.
- Viewports: desktop `1440x900`, mobile `390x844`.

## Test Data

- Fixture script: `.collab/scripts/qa_authenticated_locale_fixture.py`.
- Browser script: `.collab/scripts/qa_authenticated_locale_ui_smoke.js`.
- Fixture output: `.collab/tasks/qa-authenticated-locale-fixture-2026-05-10.json`.
- Browser evidence: `.collab/tasks/qa-authenticated-locale-ui-2026-05-10.json`.
- Cleanup output: `.collab/tasks/qa-authenticated-locale-fixture-cleanup-2026-05-10.json`.
- User: synthetic Pro QA user, so `/document-diff` is not blocked by plan gating.

Cleanup verified `users=0`, `documents=0`, `sessions=0`, `collections=0`, and `shared_sessions=0`.

## Commands

```bash
cd backend && python3 -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
cd frontend && npm run dev -- --hostname 0.0.0.0 --port 3000

python3 .collab/scripts/qa_authenticated_locale_fixture.py create \
  --plan pro \
  --json-out .collab/tasks/qa-authenticated-locale-fixture-2026-05-10.json

node .collab/scripts/qa_authenticated_locale_ui_smoke.js \
  --base-url http://localhost:3000 \
  --fixture .collab/tasks/qa-authenticated-locale-fixture-2026-05-10.json \
  --json-out .collab/tasks/qa-authenticated-locale-ui-2026-05-10.json

python3 .collab/scripts/qa_authenticated_locale_fixture.py cleanup \
  --user-id 55ac840d-be72-4a83-9fd7-474f2bb46901 \
  --json-out .collab/tasks/qa-authenticated-locale-fixture-cleanup-2026-05-10.json
```

## Result

Final result after `diff.pageTitle` locale fix: **pass with i18n warnings**.

| Check | Result |
|---|---|
| Locale matrix | Pass: 11 locales x 4 routes x 2 viewports = 88/88 checks |
| Routes | Pass: `/profile`, `/billing`, `/collections`, `/document-diff` |
| Authenticated access | Pass: all routes loaded with Auth.js session cookie |
| `lang` / `dir` | Pass: all locales set expected `document.documentElement.lang`; Arabic set `dir=rtl` |
| Core visible text | Pass: route-specific text from locale JSON appeared on each page |
| H1 | Pass: each page had at least one visible H1 |
| Layout | Pass: no document-level horizontal overflow and no clipped non-scrollable interactive controls |
| Console errors | Pass: 0 errors after wrapping the test locale localStorage initializer |
| Fixture cleanup | Pass: synthetic user removed |

Screenshots:

- `.collab/tasks/screenshots/2026-05-10/auth-locale-zh-desktop-billing.png`
- `.collab/tasks/screenshots/2026-05-10/auth-locale-ar-mobile-profile.png`
- `.collab/tasks/screenshots/2026-05-10/auth-locale-hi-mobile-document-diff.png`

## Fix

`/document-diff` used `tOr("diff.pageTitle", "Document diff")` for the sr-only H1 added in the previous browser app workflow fix. This run exposed that the key was not present in locale JSON.

Fixed by adding `diff.pageTitle` to all 11 locale files:

- `frontend/src/i18n/locales/en.json`
- `frontend/src/i18n/locales/zh.json`
- `frontend/src/i18n/locales/ja.json`
- `frontend/src/i18n/locales/ko.json`
- `frontend/src/i18n/locales/es.json`
- `frontend/src/i18n/locales/de.json`
- `frontend/src/i18n/locales/fr.json`
- `frontend/src/i18n/locales/pt.json`
- `frontend/src/i18n/locales/it.json`
- `frontend/src/i18n/locales/ar.json`
- `frontend/src/i18n/locales/hi.json`

The final rerun passed and no longer reported `diff.pageTitle`.

## Follow-Up I18n Gap

The run still captured 28 pre-existing `tOr` fallback warning keys on authenticated app pages, mostly Profile/Billing/Collections hero and empty-state copy. These did not block page usability or locale switching, but they mean parts of the authenticated app still fall back to English/fallback text.

Bug note: `.collab/tasks/bug-2026-05-10-authenticated-app-i18n-fallbacks.md`.

Follow-up: fixed and retested on 2026-05-11 in `.collab/tasks/qa-run-2026-05-11-authenticated-locale-i18n-cleanup.md`; final evidence `.collab/tasks/qa-authenticated-locale-ui-after-i18n-quality-fix-2026-05-11.json` passed 88/88 with empty `missing_i18n_warning_keys` and `untranslated_core_keys`.
