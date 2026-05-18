# S1 · Foundation — Design Spec

**Date:** 2026-05-18
**Status:** Approved (design), pending spec review
**Topic:** Remove the global "AI-flavored" background and the harmful global theme-override layer, establishing a clean flat foundation for the rest of the DocTalk visual redesign.

## Program context

This is **sub-project S1 of 5** in a site-wide effort to remove the half-built
`workbench`/`stitch` theme system from the DocTalk frontend:

- **S1 · Foundation** ← this spec
- S2 · Landing & public pages
- S3 · App chrome (headers, selectors)
- S4 · Document workspace + chat/citations
- S5 · Admin

The `dt-stitch-theme` / `dt-stitch-root` / `dt-workbench-*` / `dt-landing-*` /
`--workbench-*` system carries the "AI flavor" the user wants gone (gradient
washes, dot-grid texture, glassmorphism). It touches 14+ page files. S1 fixes
the **global foundation** that every page sits on; S2–S5 redesign each surface.

A related, already-complete piece is the `/auth` login-page redesign (branch
`auth-page-redesign`, spec `2026-05-18-auth-page-redesign-design.md`). That work
is correct at the code level but its rendered result is contaminated by the
global layer S1 removes — so S1 also finalizes `/auth` visually, with no further
auth-page code change.

## Problem

Two committed mechanisms inject AI-flavored visuals into **every** page:

1. **The global `body`** (`frontend/src/app/globals.css`): `body { background }`
   carries two blue `radial-gradient` glows; `body::before` and `body::after`
   paint dot-grid / texture overlays (fixed, full-viewport).
2. **The `dt-stitch-root` wrapper** (`frontend/src/app/layout.tsx` wraps all
   page children in `<div id="page-content" className="dt-stitch-root">`). Its
   CSS in `globals.css` includes `.dt-stitch-root > main.min-h-screen {
   background: transparent !important }`, which forces every page's `<main>`
   background transparent so the glowing/dotted `body` shows through everywhere.
   It also overrides headings (`font-family` + `letter-spacing !important`),
   re-themes `bg-white` cards into translucent glass, and recolors borders.

Additionally `dt-stitch-theme` (applied on 14 pages' `<main>`) carries its own
gradient background + `::before` dot-grid + `::after` texture.

The repo also has a large batch of **uncommitted "first-version" UI changes**
in the working tree — a discarded earlier redesign attempt.

## Decisions (locked during brainstorming)

| Topic | Decision |
|---|---|
| Approach | "B" — clean the global background **and** neutralize the theme background layer; leave component classes for S2–S5. |
| First-version disposal | Discard the tracked UI first-version uncommitted changes via `git restore`. Keep untracked `.collab/` (QA scripts/reviews), `.gitignore`, and `docs/superpowers/`. |
| Token strategy | No new custom token layer. New/clean work uses plain Tailwind `zinc-*` / `indigo-*` (consistent with `.claude/rules/frontend.md` and the `/auth` redesign). `--workbench-*` vars stay defined — removed per-sub-project in S2–S5. |
| Accent color | Standardize on indigo `#4f46e5`. `--accent` and its family in `:root` move from blue `#1D4ED8` to indigo, aligning with `frontend.md`, the Stitch theme, and the `/auth` redesign. |
| Page-transparency architecture | **Keep** `.dt-stitch-root > main { background: transparent }` — with a clean `body`, this is the mechanism that gives every page the clean flat canvas for free. |
| Component classes | `dt-workbench-*`, `dt-landing-*`, `dt-sources-*`, `dt-citation-*`, `dt-evidence-*` and the `dt-stitch-theme` **color-remap** rules are NOT touched by S1 — they belong to S2–S5. |
| Branch | New branch `s1-foundation`, cut from `auth-page-redesign` (so the new `/auth` page is included). |

## Scope

S1 modifies **only** `frontend/src/app/globals.css`, plus the `git restore`
discard step. It does not touch `layout.tsx` (the `dt-stitch-root` div stays;
only its CSS is neutralized) or any component file.

### Step 1 — Discard the first-version uncommitted UI changes

`git restore` these tracked, working-tree-modified files back to their committed
state:

- `frontend/src/app/HomePageClient.tsx`
- `frontend/src/app/globals.css`
- `frontend/src/components/Chat/ChatPanel.tsx`
- `frontend/src/components/Chat/SourcesStrip.tsx`
- `frontend/src/components/PdfViewer/PageWithHighlights.tsx`
- `frontend/src/components/PdfViewer/PdfToolbar.tsx`
- `frontend/src/components/PdfViewer/PdfViewer.tsx`
- `frontend/src/components/landing/FeatureGrid.tsx`
- `frontend/src/components/landing/SecuritySection.tsx`
- `frontend/src/components/landing/SocialProof.tsx`
- `frontend/src/i18n/locales/{ar,de,en,es,fr,hi,it,ja,ko,pt,zh}.json` (11 files)
- `frontend/src/store/index.ts`

**Do NOT** restore or remove: `.gitignore`, anything under `docs/superpowers/`,
or any untracked file (the `.collab/` QA scripts and review docs stay). Do NOT
run `git clean`.

`globals.css` is restored first, then edited in Steps 2–4. After the restore,
`globals.css` is the committed version (~1065 lines) and still contains all the
AI-flavor rules below.

### Step 2 — Clean the global `body` (`globals.css`)

- In the `body { background: … }` rule, remove the two blue `radial-gradient`
  glow layers; the background becomes a flat solid neutral.
- Delete the `body::before` rule (dot-grid overlay).
- Delete the `body::after` rule (texture overlay).
- Result: `body` renders a flat solid background — light `#fafafa` (Tailwind
  `zinc-50`), dark `#09090b` (`zinc-950`) — with no gradient, glow, or texture.
- The `body > * { position: relative; z-index: 1 }` rule, which existed to layer
  content above `::before`/`::after`, can be removed once those pseudo-elements
  are gone (it is harmless if left, but removing it is cleaner).

### Step 3 — Neutralize `dt-stitch-root` (`globals.css`)

- **Keep** the `.dt-stitch-root` base rule as-is — `min-height: 100%` and
  `color: var(--workbench-ink)`. `--workbench-ink` is a plain near-black/
  near-white text color (not AI-flavored), and it already handles light/dark;
  removing it risks a dark-mode text regression for no benefit.
- **Keep** `.dt-stitch-root > main { background: transparent }` (and the sibling
  `> div` / `> main[bg-white]` selectors that force the page canvas transparent).
- **Remove** the heading override `.dt-stitch-root h1, h2, h3, .font-serif {
  font-family … ; letter-spacing: 0 !important }` — pages own their heading
  typography.
- **Remove** the glass-card override blocks
  `.dt-stitch-root :is(section,article,aside,footer)[class*="bg-white"]…` and
  `.dt-stitch-root [class*="rounded-xl|lg|2xl"][class*="bg-white"]…` (light and
  dark) — `bg-white` cards render as solid white, not translucent glass.
- **Remove** the border-recolor block `.dt-stitch-root [class*="border-zinc-…"]
  { border-color: var(--workbench-border) }` — borders keep their Tailwind value.
- Net result: `dt-stitch-root` becomes a near-inert wrapper that only sets
  `min-height` and keeps page `<main>` backgrounds transparent.

### Step 4 — Neutralize the `dt-stitch-theme` background (`globals.css`)

- Remove the gradient layers from `.dt-stitch-theme { background: … }` and
  `.dark .dt-stitch-theme { background: … }` — background becomes flat or
  transparent.
- Delete `.dt-stitch-theme::before` (dot-grid) and `.dt-stitch-theme::after`
  (texture) rules, including their `.dark` variants.
- **Leave** the `dt-stitch-theme` color-remap rules (`text-zinc-*`, `bg-white`,
  `border-zinc-*` remaps) untouched — those are page-interior concerns for
  S2–S5.

### Step 5 — Standardize the accent color (`globals.css`)

- In `:root`, change `--accent` from `#1D4ED8` to indigo `#4f46e5`, and update
  the related `--accent-hover` and `--accent-light` to the matching indigo
  shades (`--accent-hover` ≈ indigo-700 `#4338ca`; `--accent-light` ≈ indigo-100
  `#e0e7ff`). `--accent-foreground` stays `#ffffff`.
- Update the dark-mode `--accent*` values if a dark `:root` / `.dark` block
  defines them, to the matching indigo shades.

## Out of scope (handled by S2–S5)

- `dt-workbench-*`, `dt-landing-*`, `dt-sources-*`, `dt-citation-*`,
  `dt-evidence-*` component classes and their glass/gradient styling.
- The `dt-stitch-theme` color-remap rules.
- Removal of the `--workbench-*` variables (removed per-surface in S2–S5).
- Removing the `dt-stitch-root` div from `layout.tsx` or the `dt-stitch-theme`
  class from the 14 pages (done per-surface in S2–S5).
- Any component-file or page-file change.

## Auth-page finalization

No `/auth` code change is needed. Once Step 3 removes `dt-stitch-root`'s heading
override, glass-card override, and border recolor, and Step 2 cleans the `body`,
the already-redesigned `/auth` page renders as intended: heading keeps its
`tracking-tight`, the card is solid white with its hairline border and soft
shadow, and the page background is flat. S1 verification explicitly checks
`/auth`.

## Expected transitional state

After S1, every page has a **clean flat background** with no glow/dot-grid.
Page *interiors* still contain old `dt-workbench-*` / `dt-landing-*` glass
components until their sub-project (S2–S5). A page that is "clean background +
older glassy interior cards" is the expected, intended mid-migration state.

## Verification

- `cd frontend && npm run build` passes.
- Dev-server visual spot-check, light and dark mode:
  - `/` (home), `/auth`, and one tool page (e.g. `/tools/word-counter`): the
    page background is a flat solid neutral — **no** blue glow, **no** dot-grid,
    **no** texture.
  - `/auth`: renders as the intended minimal centered card (solid white card,
    hairline border, soft shadow, `tracking-tight` heading) on the flat
    background.
  - No page renders visibly "broken" — interior components still display
    (older styling is acceptable; only the background must be clean).
- Confirm the auth page's i18n still resolves (keys are pre-existing or
  `tOr`-guarded; restoring the locale files does not break it).

## Risks

- **Locale restore vs auth keys** — restoring the 11 locale files could remove
  first-version key additions. Mitigated: every auth key in use is either a
  long-standing committed key (`auth.signIn`, `auth.freeCredits`,
  `auth.continueWith*`) or `tOr`-guarded with an English fallback, so the auth
  page cannot break — at worst a non-English locale shows an English fallback
  string. Verified during S1 verification.
- **Pages relying on the glassy background** — some of the 14 `dt-stitch-theme`
  pages may have been visually tuned assuming the dotted/glowing canvas.
  After S1 they get a flat canvas; interiors are unchanged. This is the intended
  transitional state and is addressed when each page's sub-project runs.
- **`globals.css` line numbers** — the implementation plan must locate rules by
  selector, not line number, since the file is edited right after `git restore`.
