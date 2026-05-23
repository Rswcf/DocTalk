# Authenticated Locale I18n Cleanup Run - 2026-05-11

Scope: retest authenticated app pages across all 11 supported interface locales after closing the Profile, Billing, Collections, and Document Diff translation gaps found in the 2026-05-10 authenticated locale smoke.

## Environment

- Backend: host FastAPI at `http://127.0.0.1:8000`.
- Frontend: Next.js dev server at `http://localhost:3000`.
- Infra: local Docker Compose Postgres, Redis, Qdrant, and MinIO.
- Browser driver: Playwright Chromium.
- Viewports: desktop `1440x900`, mobile `390x844`.

## Test Data

- Fixture script: `.collab/scripts/qa_authenticated_locale_fixture.py`.
- Browser script: `.collab/scripts/qa_authenticated_locale_ui_smoke.js`.
- Fixture output: `.collab/tasks/qa-authenticated-locale-fixture-2026-05-11.json`.
- Final browser evidence: `.collab/tasks/qa-authenticated-locale-ui-after-i18n-quality-fix-2026-05-11.json`.
- Cleanup output: `.collab/tasks/qa-authenticated-locale-fixture-cleanup-2026-05-11.json`.
- User: synthetic Pro QA user from the fixture report, so `/document-diff` was not plan-gated.

Cleanup verified zero residual rows for the synthetic user: `users=0`, `documents=0`, `sessions=0`, `collections=0`, and `shared_sessions=0`.

## Commands

```bash
python3 .collab/scripts/qa_authenticated_locale_fixture.py create \
  --plan pro \
  --json-out .collab/tasks/qa-authenticated-locale-fixture-2026-05-11.json

node .collab/scripts/qa_authenticated_locale_ui_smoke.js \
  --base-url http://localhost:3000 \
  --fixture .collab/tasks/qa-authenticated-locale-fixture-2026-05-11.json \
  --json-out .collab/tasks/qa-authenticated-locale-ui-after-i18n-quality-fix-2026-05-11.json

python3 .collab/scripts/qa_authenticated_locale_fixture.py cleanup \
  --user-id 13f06aae-0aa1-44c5-9364-7715bd3a6cab \
  --json-out .collab/tasks/qa-authenticated-locale-fixture-cleanup-2026-05-11.json
```

## Result

Final result: **pass**.

| Check | Result |
|---|---|
| Locale matrix | Pass: 11 locales x 4 routes x 2 viewports = 88/88 checks |
| Routes | Pass: `/profile`, `/billing`, `/collections`, `/document-diff` |
| `lang` / `dir` | Pass: all locales set expected `document.documentElement.lang`; Arabic set `dir=rtl` |
| Core visible text | Pass: route-specific text from locale JSON appeared on each page |
| Missing fallback warnings | Pass: `missing_i18n_warning_keys={}` |
| Core untranslated keys | Pass: `untranslated_core_keys={}` |
| Layout | Pass: no document-level horizontal overflow and no clipped non-scrollable interactive controls |
| Browser console | Pass: 0 blocking console errors in the final run |
| Fixture cleanup | Pass: zero residual rows for the QA user |

## Fix

Added authenticated-app translation keys across all 11 locale JSON files for:

- Profile overview and notification copy.
- Billing overview, plan selector, refund policy, cancellation reason, and confirmation copy.
- Collections stats, library, empty state, selection, session, and workspace copy.
- Document Diff setup/result visible copy in the locales that still used English strings.

The cleanup also localized visible core labels that the smoke script treats as user-facing untranslated copy, including `collections.emptyTitle`, `collections.title` for French, `profile.tabs.credits` for German, and localized `profile.plan.pro` labels where the raw English value was visible.

## Notes

- `.collab/tasks/qa-authenticated-locale-ui-after-i18n-fix-rerun-2026-05-11.json` passed 88/88 after the missing-key fix but still warned about English core strings. The final quality retest above cleared both warning maps.
- The first browser rerun after the initial locale update had a single transient `/profile` desktop timeout during dev-server compilation; the immediate rerun passed 88/88 and had no missing-key warnings.

## Verification

```bash
node --check .collab/scripts/qa_authenticated_locale_ui_smoke.js
python3 -m py_compile .collab/scripts/qa_authenticated_locale_fixture.py
jq empty frontend/src/i18n/locales/*.json \
  .collab/tasks/qa-authenticated-locale-fixture-2026-05-11.json \
  .collab/tasks/qa-authenticated-locale-ui-after-i18n-quality-fix-2026-05-11.json \
  .collab/tasks/qa-authenticated-locale-fixture-cleanup-2026-05-11.json
cd frontend && npm run build
git diff --check
```

All commands passed. `npm run build` emitted only the existing Sentry client-config deprecation warning and the expected local `RESEND_API_KEY` warning.
