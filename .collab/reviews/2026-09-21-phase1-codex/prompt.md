# Adversarial review — DocTalk Phase 1 (Apple design direction), frontend only

You are reviewing, not implementing. Do NOT edit any file under frontend/.
Write your findings to `.collab/reviews/2026-09-21-phase1-codex/findings.md`.

## Where things are
- Working tree: this directory (a git worktree). You cannot run git.
- The full diff under review: `.collab/reviews/2026-09-21-phase1-codex/phase1.diff`
  (origin/main..HEAD, frontend/src only). Commit list: `commits.txt` beside it.
- The approved plan: `.collab/plans/2026-09-20-apple-design-direction.md`
  (§5 target system, §7 Phase 1, §9 "what could make this worse", and the
  "Phase 1 execution notes" section).
- Project rules: `CLAUDE.md`, `.claude/rules/frontend.md`.
Read the changed files themselves, not only the diff — context matters.

## What this change set does
Moves the public marketing surface toward Apple's compositional grammar while
keeping the warm-paper/terracotta identity: light+dark tokens, a product frame
replacing the landing illustration, /pricing reordered so prices are on the
first screen, content-layer glass removed, ScrollReveal removed, a consent
banner that adapts to the marketing surface, 60 new translations.

## Attack these specifically — they are where I think bugs would hide
1. `components/CookieConsentBanner.tsx` — surface detection via
   `document.querySelector('#page-content .dt-editorial')`, called both in the
   reveal effect and inside a rAF-coalesced MutationObserver. Race conditions?
   Stale surface after client-side navigation between app and marketing routes?
   Does the inner `.dt-editorial` wrapper inherit anything harmful from
   editorial.css (position, the ::before grain, `> *` z-index, background)?
   Is the app-surface branch truly unchanged?
2. `components/marketing/EdPageHero.tsx` — is `variant="default"` byte-for-byte
   the old behaviour? 44 routes depend on it.
3. `app/pricing/PricingPageContent.tsx` + `PricingJsonLd.tsx` — are every
   `upgrade_click` analytics event and `billingHref()` target preserved? The
   structured data now uses `pricing.heroLine`; is there any locale or route
   where the JSON-LD description and the visible hero could diverge? Is the
   `<meta description>` genuinely unchanged?
4. `app/editorial.css` — the `!important` pair (`globals.css` `.dt-stitch-root >
   .min-h-screen` and its `.dt-stitch-root > .dt-editorial` counter-rule) must be
   intact and still win. Any specificity collision between `.ed-cta`,
   `.ed-cta-quiet`, `.ed-link`, and Tailwind utilities (editorial.css is imported
   after globals.css)? Dark tokens: any `--ed-*` consumer left reading a light
   value inside `.dark .dt-editorial`? The frame's "paper island" uses its own
   `--pg-*` vars — correct in both themes?
5. `components/landing/ProductFrame.tsx` — the page text claims to be verbatim
   from `backend/seed_data/alphabet-earnings.pdf` page 1. Check the claim is
   plausible and that nothing in the answer or caption asserts more than the
   source supports. Accessibility: the visual is `aria-hidden`, with an sr-only
   description and a visible figcaption — adequate? `dir="ltr" lang="en"` on the
   English page inside RTL — correct?
6. ScrollReveal removal (6 landing components + `components/Footer.tsx`) — is
   the DOM structurally identical? Any lost React `key`, any grid item changed?
7. i18n — `src/i18n/locales/*.json`: keys must be FLAT dotted (a nested key breaks
   `next build`). Each `landing.frame.quoteFinder` must use that locale's
   existing `quoteFinder.title`. No translation may claim word-for-word quotes
   (the product guarantees that only for `page_text` results).
8. Deletions — Remotion showcase cluster, HeroCollage, SocialProof,
   ScrollReveal: any surviving import, dynamic import, or string reference?

## Also check, generally
SSR/hydration mismatches, anything that would fail `npm run build` (I ran it
green), accessibility regressions, and anything contradicting the plan's
own rules (one filled `--ed-signal` action per view; nothing below 12px;
no glass in the content layer).

## Output format for findings.md
For each finding: severity (BLOCKER / MAJOR / MINOR / NIT), file:line, what is
wrong, a concrete failure scenario, and the fix. Separate real defects from
taste. If you verify something is fine, say so briefly — I want to know what
you checked, not only what you found. End with a one-line verdict:
SHIP / SHIP-WITH-FIXES / DO-NOT-SHIP.
