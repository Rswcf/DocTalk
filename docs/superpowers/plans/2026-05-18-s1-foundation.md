# S1 · Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the global AI-flavored background (`body` glows/grain/dot-grid) and neutralize the `dt-stitch-root` / `dt-stitch-theme` background layer, giving every DocTalk page a clean flat canvas.

**Architecture:** Discard the uncommitted "first-version" UI changes, then make a focused set of edits to a single file — `frontend/src/app/globals.css` — that strip background gradients, texture pseudo-elements, the `dt-stitch-root` heading/glass/border overrides, and the `dt-stitch-theme` background, and standardize the `--accent` token on indigo. No component or layout file is touched.

**Tech Stack:** Next.js 14, Tailwind CSS, plain CSS (`globals.css`).

**Spec:** `docs/superpowers/specs/2026-05-18-s1-foundation-design.md`

**Note on testing:** This is a presentational CSS change with no unit-testable logic. Per-task verification is `cd frontend && npm run build` passing; final verification is a browser visual check (Task 3). No automated tests are added.

**Note on line numbers:** Line numbers below are from the committed `globals.css` (~1065 lines) as a locating hint only. Apply every edit by matching the exact `old_string` content — the Edit tool matches by content, so line drift between edits is harmless.

---

## Branch setup (do this first)

The current branch is `auth-page-redesign`. S1 builds on it (so the redesigned `/auth` page is included).

- [ ] Create and switch to the S1 branch:

```bash
cd /Users/mayijie/Projects/Code/010_DocTalk
git checkout -b s1-foundation
```

---

## File structure

| File | Responsibility | Action |
|---|---|---|
| (working tree, 23 tracked files) | Uncommitted "first-version" UI attempt | Discard via `git restore` (Task 1) |
| `frontend/src/app/globals.css` | Global styles, design tokens | Edited (Task 2) |

No `.tsx` file is modified by S1.

---

## Task 1: Discard the first-version uncommitted UI changes

**Files:** 23 tracked working-tree-modified files (restored, not edited).

This task resets the working tree to a clean committed baseline. `git restore`
produces no diff to commit — Task 1 has **no commit**.

- [ ] **Step 1: Confirm the working-tree state**

Run: `cd /Users/mayijie/Projects/Code/010_DocTalk && git status --short`
Expected: a list of `M` files including the 23 below, plus `M .gitignore`, `M docs/superpowers/...`, and untracked `?? .collab/...` entries.

- [ ] **Step 2: Restore the tracked first-version UI files**

Run exactly:

```bash
cd /Users/mayijie/Projects/Code/010_DocTalk
git restore \
  frontend/src/app/HomePageClient.tsx \
  frontend/src/app/globals.css \
  frontend/src/components/Chat/ChatPanel.tsx \
  frontend/src/components/Chat/SourcesStrip.tsx \
  frontend/src/components/PdfViewer/PageWithHighlights.tsx \
  frontend/src/components/PdfViewer/PdfToolbar.tsx \
  frontend/src/components/PdfViewer/PdfViewer.tsx \
  frontend/src/components/landing/FeatureGrid.tsx \
  frontend/src/components/landing/SecuritySection.tsx \
  frontend/src/components/landing/SocialProof.tsx \
  frontend/src/i18n/locales/ar.json \
  frontend/src/i18n/locales/de.json \
  frontend/src/i18n/locales/en.json \
  frontend/src/i18n/locales/es.json \
  frontend/src/i18n/locales/fr.json \
  frontend/src/i18n/locales/hi.json \
  frontend/src/i18n/locales/it.json \
  frontend/src/i18n/locales/ja.json \
  frontend/src/i18n/locales/ko.json \
  frontend/src/i18n/locales/pt.json \
  frontend/src/i18n/locales/zh.json \
  frontend/src/store/index.ts
```

Do **NOT** restore `.gitignore` or anything under `docs/`. Do **NOT** run `git clean` (untracked `.collab/` files must stay).

- [ ] **Step 3: Verify the restore**

Run: `git status --short`
Expected: none of the 23 files above appear as `M` anymore. `M .gitignore`, `M docs/superpowers/...`, and the `?? .collab/...` untracked entries are still present (correct — those are kept).

- [ ] **Step 4: Verify the build still passes**

First confirm no dev server is running (`pgrep -fl "next dev"`); if one is, report it and do not kill it. Then run:
`cd frontend && npm run build`
Expected: build completes with no errors. (The working tree is now at the committed baseline; this confirms that baseline builds.)

---

## Task 2: Clean globals.css — remove the global AI-flavored background layer

**Files:**
- Modify: `frontend/src/app/globals.css`

Apply Edits A–L below, each with the Edit tool using the exact strings. Read the file first.

- [ ] **Step 1: Edit A — light-mode accent → indigo** (`:root`, ~line 20)

Replace:

```css
  /* Accent colors (ink blue — replaced AI-purple indigo 2026-04-13).
     Chosen for trust/authority ("book" feel) and to step out of the
     generic indigo→violet AI gradient that every Next.js template wears. */
  --accent: #1D4ED8;
  --accent-hover: #1E40AF;
  --accent-light: #DBEAFE;
  --accent-foreground: #ffffff;
```

with:

```css
  /* Accent — indigo. A single flat focus/accent color (not an
     indigo→violet gradient). Standardized 2026-05-18 with the Stitch redesign. */
  --accent: #4f46e5;
  --accent-hover: #4338ca;
  --accent-light: #e0e7ff;
  --accent-foreground: #ffffff;
```

- [ ] **Step 2: Edit B — dark-mode accent → indigo** (`.dark`, ~line 70)

Replace:

```css
  /* Accent colors (ink blue dark). blue-400 (#60A5FA) sits well against
     the warm near-black canvas without bouncing the way a pure sky-400
     would. blue-300 (#93C5FD) for hover. */
  --accent: #60A5FA;
  --accent-hover: #93C5FD;
  --accent-light: rgba(96, 165, 250, 0.10);
  --accent-foreground: #0b1726;
```

with:

```css
  /* Accent — indigo (dark). indigo-400 (#818cf8) reads well on the
     near-black canvas; indigo-300 (#a5b4fc) for hover. */
  --accent: #818cf8;
  --accent-hover: #a5b4fc;
  --accent-light: rgba(129, 140, 248, 0.12);
  --accent-foreground: #0b1726;
```

- [ ] **Step 3: Edit C — light `body` background → flat** (~line 120)

Replace:

```css
body {
  color: var(--foreground);
  background:
    radial-gradient(ellipse at 8% 76%, rgba(125, 178, 255, 0.2), transparent 30rem),
    radial-gradient(ellipse at 98% 88%, rgba(184, 206, 255, 0.22), transparent 28rem),
    var(--page-background, var(--background));
  position: relative;
}
```

with:

```css
body {
  color: var(--foreground);
  background: #fafafa;
  position: relative;
}
```

- [ ] **Step 4: Edit D — dark `body` background → flat** (~line 129)

Replace:

```css
.dark body {
  background:
    radial-gradient(ellipse at 6% 76%, rgba(108, 132, 255, 0.28), transparent 30rem),
    radial-gradient(ellipse at 98% 88%, rgba(78, 124, 255, 0.22), transparent 28rem),
    var(--page-background, var(--background));
}
```

with:

```css
.dark body {
  background: #09090b;
}
```

- [ ] **Step 5: Edit E — delete the grain/dot-grid pseudo-elements** (~lines 136–170)

Delete this entire block (replace it with an empty string):

```css
/* Paper grain — 1.5% SVG turbulence noise over the body background.
   Makes marketing pages feel "printed" rather than screen-rendered.
   Applied as a pseudo-element so it sits below all content. Opacity is
   dialed down in dark mode so the grain reads as depth, not dust. */
body::before {
  content: '';
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 0;
  opacity: 0.24;
  mix-blend-mode: multiply;
  background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='240' height='240'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.045 0'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>");
}
.dark body::before {
  opacity: 0.18;
  mix-blend-mode: screen;
  background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='240' height='240'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0.95  0 0 0 0 0.95  0 0 0 0 0.9  0 0 0 0.05 0'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>");
}
body::after {
  content: '';
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 0;
  opacity: 0.28;
  background-image: radial-gradient(circle, var(--workbench-grid) 1px, transparent 1px);
  background-size: 20px 20px;
  mask-image: linear-gradient(to bottom, black, transparent 88%);
}
.dark body::after {
  opacity: 0.52;
}
/* Ensure page content sits above the grain */
body > * { position: relative; z-index: 1; }
```

After deletion, the line `}` closing `.dark body` should be followed by a blank line and then `h1,`. Collapse any resulting double blank line into a single blank line.

- [ ] **Step 6: Edit F — drop the `dt-stitch-theme` background** (~line 862)

Replace:

```css
.dt-stitch-theme {
  position: relative;
  isolation: isolate;
  overflow-x: clip;
  color: var(--workbench-ink);
  background:
    linear-gradient(12deg, transparent 0 49%, rgba(123, 164, 255, 0.14) 60%, rgba(180, 190, 255, 0.14) 67%, transparent 80%),
    radial-gradient(ellipse at 6% 78%, rgba(125, 178, 255, 0.18), transparent 30rem),
    radial-gradient(ellipse at 98% 88%, rgba(197, 210, 255, 0.18), transparent 32rem),
    var(--workbench-bg);
}
```

with:

```css
.dt-stitch-theme {
  position: relative;
  isolation: isolate;
  overflow-x: clip;
  color: var(--workbench-ink);
}
```

- [ ] **Step 7: Edit G — delete the dark `dt-stitch-theme` background and both `::before` dot-grids** (~lines 874–897)

Delete this entire block (replace with an empty string):

```css
.dark .dt-stitch-theme {
  background:
    linear-gradient(12deg, transparent 0 49%, rgba(86, 111, 255, 0.18) 60%, rgba(161, 136, 255, 0.18) 67%, transparent 80%),
    radial-gradient(ellipse at 6% 78%, rgba(98, 123, 255, 0.28), transparent 30rem),
    radial-gradient(ellipse at 98% 88%, rgba(77, 129, 255, 0.24), transparent 32rem),
    #070707;
}

.dt-stitch-theme::before {
  content: "";
  position: absolute;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  background-image: radial-gradient(circle, rgba(43, 69, 104, 0.15) 1px, transparent 1px);
  background-size: 20px 20px;
  mask-image: linear-gradient(to bottom, black, transparent 92%);
  opacity: 0.38;
}

.dark .dt-stitch-theme::before {
  background-image: radial-gradient(circle, rgba(255, 255, 255, 0.18) 1px, transparent 1px);
  opacity: 0.46;
}
```

Collapse any resulting double blank line into a single blank line (the next surviving rule is `.dt-stitch-theme > *`).

- [ ] **Step 8: Edit H — drop `dt-stitch-theme::after` from its light-mode shared rule** (~line 420)

Replace:

```css
.dt-workbench-canvas::after,
.dt-stitch-theme::after {
```

with:

```css
.dt-workbench-canvas::after {
```

(This leaves the `dt-workbench-canvas::after` glow intact — that belongs to a later sub-project — while `dt-stitch-theme::after` no longer matches it.)

- [ ] **Step 9: Edit I — drop `dt-stitch-theme::after` from its dark-mode shared rule** (~line 436)

Replace:

```css
.dark .dt-workbench-canvas::after,
.dark .dt-stitch-theme::after {
```

with:

```css
.dark .dt-workbench-canvas::after {
```

- [ ] **Step 10: Edit J — strip `dt-stitch-root`'s harmful overrides** (~lines 1024–1065, end of file)

Delete this entire block (replace with an empty string). It is the heading override, the light + dark glass-card overrides, and the border-recolor block:

```css
.dt-stitch-root h1,
.dt-stitch-root h2,
.dt-stitch-root h3,
.dt-stitch-root .font-serif {
  font-family: var(--font-logo), var(--font-inter), system-ui, sans-serif;
  letter-spacing: 0 !important;
}

.dt-stitch-root :is(section, article, aside, footer)[class*="bg-white"],
.dt-stitch-root :is(section, article, aside, footer)[class*="bg-zinc-50"],
.dt-stitch-root :is(section, article, aside, footer)[class*="bg-zinc-100"],
.dt-stitch-root [class*="rounded-xl"][class*="bg-white"],
.dt-stitch-root [class*="rounded-lg"][class*="bg-white"],
.dt-stitch-root [class*="rounded-2xl"][class*="bg-white"] {
  border-color: var(--workbench-border);
  background-color: rgba(255, 255, 255, 0.78) !important;
  box-shadow: 0 18px 56px rgba(31, 55, 88, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.84);
}

.dark .dt-stitch-root :is(section, article, aside, footer)[class*="bg-white"],
.dark .dt-stitch-root :is(section, article, aside, footer)[class*="bg-zinc-50"],
.dark .dt-stitch-root :is(section, article, aside, footer)[class*="bg-zinc-100"],
.dark .dt-stitch-root :is(section, article, aside, footer)[class*="dark:bg-zinc-950"],
.dark .dt-stitch-root :is(section, article, aside, footer)[class*="dark:bg-zinc-900"],
.dark .dt-stitch-root [class*="rounded-xl"][class*="bg-white"],
.dark .dt-stitch-root [class*="rounded-lg"][class*="bg-white"],
.dark .dt-stitch-root [class*="rounded-2xl"][class*="bg-white"],
.dark .dt-stitch-root [class*="rounded-xl"][class*="dark:bg-zinc-950"],
.dark .dt-stitch-root [class*="rounded-lg"][class*="dark:bg-zinc-950"],
.dark .dt-stitch-root [class*="rounded-2xl"][class*="dark:bg-zinc-950"] {
  border-color: var(--workbench-border);
  background-color: rgba(255, 255, 255, 0.07) !important;
  box-shadow: 0 18px 56px rgba(0, 0, 0, 0.22), inset 0 1px 0 rgba(255, 255, 255, 0.06);
}

.dt-stitch-root [class*="border-zinc-100"],
.dt-stitch-root [class*="border-zinc-200"],
.dt-stitch-root [class*="border-zinc-300"],
.dt-stitch-root [class*="dark:border-zinc-800"],
.dt-stitch-root [class*="dark:border-zinc-700"] {
  border-color: var(--workbench-border);
}
```

The `.dt-stitch-root` base rule and the `.dt-stitch-root > … { background: transparent !important }` rule directly above this block are **kept** — do not touch them. After this edit the file ends at the closing `}` of the `background: transparent` rule.

- [ ] **Step 11: Verify the build passes**

Confirm no dev server runs (`pgrep -fl "next dev"`). Then run: `cd frontend && npm run build`
Expected: build completes with no errors.

- [ ] **Step 12: Verify the removals are complete**

Run: `cd frontend && grep -n "body::before\|body::after\|dt-stitch-theme::before\|#1D4ED8\|#60A5FA" src/app/globals.css`
Expected: NO matches.
Run: `cd frontend && grep -c "dt-stitch-root" src/app/globals.css`
Expected: a small number (only the kept base rule + the transparent-canvas selectors — roughly 7), NOT the original ~33.

- [ ] **Step 13: Commit**

```bash
git add frontend/src/app/globals.css
git commit -m "feat(s1): remove global AI-flavored background layer

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Final verification

**Files:** none (verification only).

- [ ] **Step 1: Build**

Run: `cd frontend && npm run build`
Expected: passes with no errors.

- [ ] **Step 2: Browser visual check**

Start the dev server (`cd frontend && npm run dev`) and inspect, in both light and dark mode:

1. `http://localhost:3000/` (home) — the page background is a flat solid neutral. **No** blue radial glows, **no** dot-grid, **no** paper-grain texture.
2. `http://localhost:3000/auth` — renders as the intended minimal centered card (solid white card, hairline border, soft shadow, `tracking-tight` heading) on a flat background. Do not click "Continue with Google" (local OAuth is not configured and will bounce to `/auth/error`).
3. `http://localhost:3000/tools/word-counter` — flat clean background; the page does not render visibly "broken" (interior `dt-workbench-*` / `dt-landing-*` components still display with their older styling — that is the expected transitional state).
4. Confirm the auth page text is readable in all cases (i18n keys resolve, or show English fallbacks).

- [ ] **Step 3: Stop the dev server**

Stop the `npm run dev` process started in Step 2.

---

## Self-review notes

- **Spec coverage:** Step 1 discard (spec §Step 1) → Task 1. `body` cleanup (spec §Step 2) → Task 2 Edits C–E. `dt-stitch-root` neutralization (spec §Step 3) → Task 2 Edit J; the base rule + transparent-canvas rule are explicitly kept. `dt-stitch-theme` background neutralization (spec §Step 4) → Task 2 Edits F, G, H, I. Accent standardization (spec §Step 5) → Task 2 Edits A, B. Branch (spec §Decisions) → Branch setup. Verification (spec §Verification) → Task 3.
- **No placeholders:** every edit has exact `old_string` / `new_string` CSS.
- **Consistency:** all edits target one file (`globals.css`); the kept rules (`.dt-stitch-root` base, `.dt-stitch-root > … transparent`, `.dt-stitch-theme > *`, `dt-workbench-canvas::after`) are explicitly preserved and never contradicted by a later edit.
