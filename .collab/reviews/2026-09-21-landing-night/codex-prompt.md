# Adversarial review — DocTalk "Night": the dark marketing surface and the citation-field hero

Review only. Do NOT edit files under frontend/. Codex cannot run git: the change is on branch
`claude/landing-night` (child of `claude/frontend-design-review-c26fcb`, whose four Phase 2a commits are
reviewed separately with `.collab/reviews/2026-09-21-phase2a-seo-keys/codex-prompt.md`). The Night commits are
`7ee6637` (slice 1: Night ground), `cab3bd8` (slice 2: citation-field hero), `c26a2e8` (slice 3: i18n + rules),
`f095f20` (owner: prototype B's #0a0908 stage and Geist display type), `12a8565` (owner: Night on every marketing
page) and any fix commits after them. Their combined diff (with the Phase 2a base excluded) is `night.diff` beside
this file. Plan: `.collab/plans/2026-09-21-landing-night.md` (read §0 first: three owner amendments). Rules:
`.claude/rules/frontend.md` (UI Design System). A Fable review of slices 1–2 is in `findings-fable.md` if present.
Write findings to `.collab/reviews/2026-09-21-landing-night/findings-codex.md`: a verdict line
(SHIP / SHIP-WITH-FIXES / BLOCK), then findings ranked BLOCKER / MAJOR / MINOR / NIT with file:line, the failure
scenario, and the fix.

## What it claims
- Every marketing page (the landing and all 46 `MarketingShell` routes, 11 locales) renders
  `.dt-editorial.dt-night` in BOTH OS themes. It is the existing editorial dark theme: every
  `.dark .dt-editorial…` selector in `app/editorial.css` carries a `.dt-editorial.dt-night…` twin in the same
  selector list. The ONLY night-only values are one block (stage `--ed-paper` #0a0908, `--ed-paper-2`,
  `--ed-glass`, `--ed-glass-strong`, `--ed-display-family` = Geist) plus weight/tracking retunes for the display
  steps. `tests/landing-night.test.cjs` pins all of that.
- Chrome rendered outside the page root mirrors Night: `CookieConsentBanner` (sibling of `#page-content`) and
  `EdLanguageSelector`'s portalled menu. `AuthModal` (zinc) is a known, accepted mismatch.
- The landing hero is `components/landing/CitationField.tsx`, a canvas port of
  `design-explorations/2026-09-21-citation-field/citation-field.js`: no colour or font literals (tokens and
  computed `font-family` only); the rAF loop stops once the citation is marked (measured: 0 rAF calls in 2.5 s
  after); reduced motion and `?still` draw the final frame; the document text in `citationFieldContent.ts` is
  verbatim page 1 of `backend/seed_data/alphabet-earnings.pdf` (checked against `pdftotext` by a test).
- Geist comes from the `geist` npm package (SIL OFL), imported only by `components/marketing/night.ts`, so app
  routes never preload it. Build-verified after `12a8565`: the prerendered marketing pages (`/`, `/pricing`, `/about`, `/privacy`, `/demo`, `/tools`, `/de`) preload it; app pages (`/auth/error`, `/billing`, `/profile`, `/collections`, `/admin`, the 404) do not.
- A CDP contrast audit of 54 marketing pages in a light OS found zero text below WCAG AA (a planted probe was
  caught). 174 unit tests, lint and `next build` pass; `/` stays static, First Load 208 → 213 kB.

## Attack these
1. **Is every marketing pixel really Night in a light OS?** Look for dark-mode mechanisms the twin rule cannot see:
   Tailwind `dark:` utilities or zinc/white classes inside components rendered on marketing routes (shared
   components outside the page folders: tools widgets, `DocumentDiffPanel` surface="editorial", share-page answer
   rendering, FAQ/accordion, toasts, tooltips, dialogs), inline style colour literals, `globals.css` `.dark …`
   rules, `prefers-color-scheme` media queries, and `error.tsx` / `loading.tsx` / `not-found.tsx` under marketing
   routes that render outside `MarketingShell` (e.g. `app/demo/error.tsx` still uses zinc + `dark:`).
2. **The twin test's parser.** It regex-parses `editorial.css` preludes. Can a `.dark .dt-editorial` rule escape
   it (inside `@media`/`@supports`, `:is()`/`:where()` lists, a selector split across lines, `.dark
   .dt-editorial` written with a descendant combinator variant)? Does the night-only allowlist let anything else
   through?
3. **CitationField lifecycle** (`components/landing/CitationField.tsx`): React StrictMode double-invoking the
   effect in dev; the font promise resolving after unmount; ResizeObserver/IntersectionObserver ordering; the
   settings-ref relayout when `narrow` flips (HeroSection's first render is always `narrow=false`); `visible`
   starting `true`; pointer listeners under `still`; canvas memory (three canvases at DPR ≤ 2 over a 1080×~900
   field); anything that could leave a loop running or a stale frame.
4. **SSR and hydration** (`HeroSection.tsx`): the card is hidden before the citation only under
   `@media (scripting: enabled)`, with a 6 s fallback; its position comes from `onLayout`. Any hydration mismatch,
   layout shift (CLS), or no-JS/slow-JS state that hides content? The h1 is gradient-clipped text
   (`color: transparent` inside an `@supports` that also requires `color-mix`) — safe everywhere, and does it
   still count as the LCP element?
5. **theme-color** (`components/marketing/night.ts`): tags are swapped on mount and restored on unmount. Walk
   client navigations night→night, night→app (signed-in dashboard at `/`), app→night, and back/forward: can a
   cleanup run after the next page's effect and leave the wrong colour?
6. **Geist and fonts**: next/font/local inside a client module; preload scope now that `MarketingShell` imports
   `night.ts` (check built HTML of an app route such as `/billing` or `/d/[id]` if prerendered, and of marketing
   routes); the `var(--font-geist-sans, var(--dt-body))` fallback; the `:lang()` ordering that keeps zh/ja/ko/hi/ar
   at zero tracking (Arabic joining); the canvas reading `getComputedStyle(canvas).fontFamily`.
7. **i18n**: `landing.frame.source` in all 11 locales (accuracy, register, length — it truncates on one line); any
   user-visible string not behind `t`/`tOr`; RTL (`/ar`): the document stays `dir="ltr"`, the card uses physical
   `left` on purpose.
8. **Accessibility**: the canvas wrapper is `aria-hidden`; the card is real text; an sr-only line describes the
   picture. Focus order, heading order (h1 then the sections' h2), reduced motion, 200% zoom, and contrast of
   anything the audit could not see (text over the canvas, hover/focus states, the card's 13 px question).
9. **Rules and docs**: does `.claude/rules/frontend.md` now describe the code exactly? Anything stale left behind
   (e.g. comments that still say "light-only", "Fraunces for every h1", or "landing only")?
