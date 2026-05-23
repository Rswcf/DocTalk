# QA Run - Public Mobile Pages UX Sweep - 2026-05-10

## Scope

Run a broad mobile browser sweep over public, non-gated concrete routes from the route inventory. This expands coverage beyond the earlier focused locale smoke and checks SEO/blog/feature/use-case/compare/alternative/tool/auth/demo listing pages on a 390x844 viewport.

Dynamic demo redirect routes (`/demo/[sample]`) were excluded from this public-content sweep because they redirect into the reader and create demo sessions; those paths are covered by reader/demo workflow tests.

## Environment

- Frontend: `http://localhost:3000`
- Backend: `http://127.0.0.1:8000`
- Viewport: `390x844`, mobile Chromium
- Script: `.collab/scripts/qa_public_mobile_pages_ux.js`
- Initial result JSON: `.collab/tasks/qa-public-mobile-pages-ux-2026-05-10.json`
- Final result JSON: `.collab/tasks/qa-public-mobile-pages-ux-after-blog-fix-2026-05-10.json`

## Checks

- HTTP status is 2xx/3xx.
- Exactly one visible H1.
- Page has substantive text, with a lower threshold for the intentionally short `/auth/error`.
- No horizontal document overflow.
- No clipped visible interactive controls.
- No browser console errors or page errors.
- Records small tap-target candidates as a warning metric.

## Findings

Initial run: **fail**, 46/76 routes.

- Blog article pages emitted React hydration mismatch warnings for markdown heading `id` props.
- `/contact` honeypot input was a test false positive because it is `aria-hidden` and `tabIndex=-1`.
- Dynamic demo redirect routes created reader sessions and hit local demo session rate limiting when repeated.

Fixes:

- Fixed blog heading IDs in `frontend/src/app/blog/[slug]/BlogPostClient.tsx`.
- Hardened the QA script to ignore intentionally hidden/offscreen controls.
- Scoped public mobile sweep away from demo redirect routes.

Final run: **pass**, 68/68 routes.

Final summary:

- overflow: 0 routes
- H1 issues: 0 routes
- console-error routes: 0
- clipped-interactive routes: 0
- small-tap-target warning routes: 67

## Follow-Up

The small tap-target warning is broad because many footer and inline text links render below 28px high on mobile. It did not block this run because they are conventional text links, but it is worth a separate accessibility/design-system pass if mobile tap ergonomics becomes a priority.

