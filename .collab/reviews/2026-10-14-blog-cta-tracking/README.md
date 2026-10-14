# Blog CTA instrument (2026-10-14)

Source: Fable ruling 2026-10-14, Q2 (`.collab/dialogue/2026-10-14-fable-readout-rulings.md`).
Before this change, blog pages sent no funnel event, so the C-9 event arm
("AI-referred events landing on the three listicles") could only read 0.

## Change (f7b2d57b)

- `frontend/src/lib/blogCta.ts`: `isDemoHref` (`/demo`, `/demo/…`, `/demo?…`, `/demo#…`) and
  `trackBlogDemoClick(source)` → `trackEvent('landing_cta_clicked', { source, reason: 'demo' })`.
- `frontend/src/app/blog/[slug]/BlogPostClient.tsx`: the three `/demo` link sites send it:
  `blog_about` (about box), `blog_cta` (CTA banner), `blog_inline` (Markdown links to `/demo`).
  The Markdown `onClick` comes after `{...props}`, so a renderer prop cannot override it.
- `landing_cta_clicked` is already in `ATTRIBUTED_EVENTS` and in the backend's public events, so
  each click carries first-touch attribution and `path` (`/blog/<slug>` is a safe path).
- `frontend/tests/blog-cta-tracking.test.cjs`: 3 tests.

## Checks

- `npm run test:unit` 363/363, lint, `tsc`, `npm run build` 426/426.
- Codex r1 (gpt-5.5): **SHIP**, no BLOCKER or SHOULD. One NIT, not applied: the source test
  reads each `<Link href="/demo"` tag on one line, so a reformat across lines fails the test
  (it fails loudly, never passes wrongly).

## Reading it

The C-9 event arm counts `landing_cta_clicked` / `auth_*` rows whose `landing_path` is one of the
three listicles and whose channel is AI. Events before the ship time are structurally zero for
blog CTAs; the ship timestamp is in `actions-log.md`.
