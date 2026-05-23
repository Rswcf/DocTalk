# BUG-2026-05-11: Cookie consent blocks mobile Collection Templates tab

Severity: P1
Area: Frontend / Collections / Consent banner
Status: Fixed locally and retested

## Environment

- Local frontend: `http://127.0.0.1:3000`
- Local backend: `http://127.0.0.1:8000`
- Browser: Playwright Chromium mobile `390x844`
- Account: synthetic authenticated Pro user
- Route: `/collections/{collection_id}`

## Repro

1. Start with a browser profile that has no `doctalk_analytics_consent` value.
2. Open `/collections/{collection_id}` on a mobile viewport.
3. Try to tap the `Templates` tab/button.

## Expected

The `Templates` control is clickable, and the user can open the question-template workspace.

## Actual

The first-visit cookie consent banner sits over the mobile collection workspace controls and intercepts the click.

## Evidence

- Initial browser structured-workflows UX run failed on mobile with the consent banner intercepting the `Templates` click.
- Passing retest: `.collab/tasks/qa-browser-structured-workflows-ux-after-consent-fix-2026-05-11.json`
- QA run: `.collab/tasks/qa-run-2026-05-11-browser-structured-workflows-ux.md`

## Impact

First-time mobile users can be blocked from the Collection `Templates` workflow until they notice and dismiss the banner. This is especially harmful for Pro users trying to run reusable questions across documents.

## Root Cause

The workspace consent-banner top offset was tuned for the document reader. The collection detail page has a taller mobile header/control stack, so the banner overlapped the collection tab row.

## Fix

Updated `frontend/src/components/CookieConsentBanner.tsx`:

- Detect collection workspace routes with `pathname?.startsWith('/collections')`.
- Use `top-[calc(env(safe-area-inset-top,0px)+9.5rem)]` on mobile collection workspace pages.
- Keep the previous `4.75rem` workspace offset for other workspace routes and `sm:` desktop behavior.
- Preserve the existing rule that hides the banner while modal dialogs are open.

## Retest

Browser structured-workflows UX retest passed on desktop and mobile:

- Collection `Templates` tab opened.
- Template create/update and run result rendering passed.
- Markdown/CSV exports validated.
- Citation popup link validated.
- 0 console errors.
- No horizontal overflow.
