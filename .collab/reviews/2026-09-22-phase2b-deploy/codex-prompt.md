# Codex adversarial review (post-hoc) — release 57a667a..7478d1d (Fraunces preload + Phase 2b titles)

Worktree: /Users/mayijie/Projects/Code/010_DocTalk/.claude/worktrees/frontend-design-review-c26fcb. The release is
LIVE since 2026-09-22 07:22Z (`stable` = `7478d1d`, frontend-only, no version bump). Fable 5.1 reviewed it as the
stand-in gate (SHIP, 0 must-fix: `.collab/reviews/2026-09-22-phase2b-deploy/findings-fable.md`). This is the
post-hoc Codex pass the project rules require. Read-only git is fine; write findings to
`.collab/reviews/2026-09-22-phase2b-deploy/codex-r1.md`.

## What shipped (`git diff 57a667a..7478d1d`)
- `frontend/src/app/layout.tsx`: `preload: false` on the Fraunces next/font declaration. No page shows Fraunces at
  load since the Night marketing surface. The app's citation popover (italic `var(--dt-serif)`) fetches it on
  first open. Evidence: `.collab/reviews/2026-09-21-v0.32-seo-impact.md`.
- Phase 2b option B (owner's choice): every `landing.metaTitle` is single-line in 11 locales; de/pt titles go back
  to the "chat with any PDF in seconds" message. Build metadata vs v0.32.0 differs in exactly 9 of 2,496 lines.
- Guard tests: `frontend/tests/landing-night.test.cjs` (Fraunces never preloaded) and
  `frontend/tests/seo-meta-keys.test.cjs` (no `*.metaTitle`/`*.metaDescription` contains a line break).
- Docs, lab tools (`frontend/scripts/design-audit/cwvcheck.mjs`, `fontdelay.mjs`), changelog [Unreleased].

## Attack
1. Any reader of Fraunces other than the popover, including CSS `var(--dt-serif)` / `--font-fraunces`, Tailwind
   `font-serif`, OG-image routes, and any `.dt-editorial` root without `dt-night`. What breaks, and where, if one
   exists?
2. Any rendered `<title>`, `og:title` or `twitter:title` that changed beyond `/ja`, `/de` and `/pt`. Any locale
   whose `landing.metaTitle` now disagrees with its `landing.metaDescription` or its `HomeJsonLd`.
3. The tests: can either regex pass while the property it guards is broken?
4. Anything in the deploy decision record (`decision-claude.md`) that is wrong.

For each finding give severity, `file:line`, a failing scenario, and a minimal fix. End with SHIP-CONFIRMED /
FIX-FORWARD / ROLLBACK.
