# Locale UI Smoke Run - 2026-05-10

Scope: browser smoke coverage for all 11 supported interface locales on representative public routes, with desktop and mobile viewports.

## Environment

- Frontend: Next.js dev server at `http://localhost:3000`.
- Backend: host FastAPI at `http://localhost:8000` for `/demo` API data.
- Browser driver: Playwright Chromium.
- Viewports: desktop `1440x900`, mobile `390x844`.

## Coverage

- Locales: `en`, `zh`, `es`, `ja`, `de`, `fr`, `ko`, `pt`, `it`, `ar`, `hi`.
- Routes: `/`, `/pricing`, `/demo`.
- Checks per locale/route/viewport:
  - route returns 2xx/3xx
  - `document.documentElement.lang` matches the selected locale
  - `document.documentElement.dir` is `rtl` only for Arabic and `ltr` otherwise
  - at least one visible H1 exists
  - no document-level horizontal overflow
  - no browser console errors or page errors

Total checks: **66**.

## Commands

```bash
node .collab/scripts/qa_locale_ui_smoke.js \
  --base-url http://localhost:3000 \
  --json-out .collab/tasks/qa-locale-ui-smoke-2026-05-10.json

node .collab/scripts/qa_locale_ui_smoke.js \
  --base-url http://localhost:3000 \
  --json-out .collab/tasks/qa-locale-ui-smoke-after-csp-fix-2026-05-10.json
```

## Result

Final result after fix: **pass**, 66/66 checks.

Raw evidence:

- Initial failing run: `.collab/tasks/qa-locale-ui-smoke-2026-05-10.json`
- Passing rerun: `.collab/tasks/qa-locale-ui-smoke-after-csp-fix-2026-05-10.json`

Representative screenshots:

- `.collab/tasks/screenshots/2026-05-10/locale-en-desktop-home.png`
- `.collab/tasks/screenshots/2026-05-10/locale-zh-mobile-home.png`
- `.collab/tasks/screenshots/2026-05-10/locale-ar-mobile-home.png`

## Finding And Fix

Initial run failed on the homepage for every locale because the Remotion landing player attempted to load a silent `data:audio/mp3` media resource while CSP enforced `media-src 'none'`.

Fix:

- `frontend/next.config.mjs` now allows `media-src 'self' data:` in both enforcing and report-only CSP directives.

Rerun result:

- Homepage console errors dropped to 0 across all 11 locales and both viewports.
- `/pricing` and `/demo` also passed across all locales and viewports.

## Remaining Gaps

- This is public-page smoke coverage, not full authenticated app localization.
- Reader, billing, profile, collections, document-diff, chat errors, and real RAG answer language still need locale-specific browser runs.
- Missing-translation warnings remain visible in dev logs for fallback-backed keys; the browser smoke treats console errors as failures, not warnings.
