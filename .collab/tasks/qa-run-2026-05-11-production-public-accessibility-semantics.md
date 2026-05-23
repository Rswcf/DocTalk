# QA Run - Production Public Accessibility/Semantics - 2026-05-11

## Scope

Production public page accessibility and semantic UX audit for DocTalk.

- Base URL: `https://www.doctalk.site`
- Inventory: `.collab/tasks/qa-route-inventory-2026-05-10.json`
- Harness: `.collab/scripts/qa_production_public_accessibility_semantics.js`
- Evidence: `.collab/tasks/qa-production-public-accessibility-semantics-2026-05-11.json`
- Route scope: public, non-gated, non-auth, non-dynamic concrete routes
- Viewports: desktop `1366x900`, mobile `390x844`

## Command

```bash
node --check .collab/scripts/qa_production_public_accessibility_semantics.js
node .collab/scripts/qa_production_public_accessibility_semantics.js \
  --json-out .collab/tasks/qa-production-public-accessibility-semantics-2026-05-11.json
```

## Assertions

For each rendered route and viewport, the harness checks:

- HTTP status is `2xx` or `3xx`
- `<html lang>` is present
- At least one visible `main` / `[role="main"]` exists
- Exactly one visible `h1` exists
- Visible links, buttons, form controls, and button/link-role elements have an accessible name
- Visible `input`, `select`, and `textarea` controls are labelled
- Visible informative images have `alt`
- Visible `target="_blank"` links include both `noopener` and `noreferrer`
- Duplicate DOM ids are absent
- Heading-order skips are recorded for review
- Browser console errors are recorded, but not used as a pass/fail condition because the known production CSP drift is tracked separately

## Harness Correction

The first production run reported unnamed controls on `/contact`, but the page already had proper `<label for="contact-name">`, `<label for="contact-email">`, and `<label for="contact-message">` labels. This was a harness false positive.

The harness was corrected so `accessibleName()` accounts for associated form labels via `el.labels`, explicit `label[for]`, and wrapping `<label>` before falling back to `alt`, `title`, `placeholder`, or visible text. No product code change was needed for the `/contact` labels.

## Result

Final result: **pass**.

- Total viewport-route checks: `130`
- Passed: `130`
- Failed: `0`
- Routes with failures: `0`
- Public routes covered: `65`
- Unnamed interactive elements: `0`
- Unlabelled controls: `0`
- Missing image alt attributes: `0`
- Unsafe `target="_blank"` links: `0`
- Duplicate ids: `0`
- Heading-order advisory viewport-routes: `2`
- Console-error viewport-routes recorded: `2`

Advisory details:

- `/use-cases/healthcare` has a heading-order skip from `h1` to `h3` on both desktop and mobile: `AI Document Analysis for Healthcare Professionals -> Important: Not HIPAA-Certified`. This is recorded for semantic polish, but it did not fail the current route because all hard accessibility gates passed.
- `/` emitted the known production CSP `media-src 'none'` console violations for the inline audio asset on both desktop and mobile. This is already tracked by `.collab/tasks/bug-2026-05-10-production-csp-media-src-none.md` and remains a deploy/retest item for the existing CSP fix.

## Local Heading-Order Fix

The `/use-cases/healthcare` heading-order advisory was fixed locally:

- Code: `frontend/src/app/use-cases/healthcare/HealthcareClient.tsx`
- Change: the "Important: Not HIPAA-Certified" notice heading changed from `h3` to `h2` while keeping the existing visual classes.
- Build: `cd frontend && npm run build` passed.
- Local evidence: `.collab/tasks/qa-local-public-accessibility-semantics-after-healthcare-heading-fix-2026-05-11.json`

Local production-server retest result:

- Total viewport-route checks: `130`
- Passed: `130`
- Failed: `0`
- Heading-order advisory viewport-routes: `0`
- Unnamed interactive elements: `0`
- Unlabelled controls: `0`
- Missing image alt attributes: `0`
- Unsafe `target="_blank"` links: `0`
- Duplicate ids: `0`

The local retest recorded Auth.js/session console errors on all local routes because the local `next start` environment was not configured as a complete auth/backend production environment. Those console errors were recorded but did not affect the semantic hard gates and are separate from the production home-page CSP drift.

Remaining production gap:

- Deploy the frontend and rerun this production accessibility/semantics audit to confirm the healthcare heading-order advisory is gone from `https://www.doctalk.site`.

## Raw Output

```text
Production:
PRODUCTION_PUBLIC_ACCESSIBILITY_SEMANTICS PASS: 130/130 viewport-route checks passed
Local after healthcare heading fix:
PRODUCTION_PUBLIC_ACCESSIBILITY_SEMANTICS PASS: 130/130 viewport-route checks passed
```
