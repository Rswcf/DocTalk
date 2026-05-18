# Editorial Landing Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the DocTalk landing page (homepage) in a disciplined editorial-grid visual language ("Monocle-crisp"), on a reusable editorial design foundation.

**Architecture:** A new scoped CSS layer (`editorial.css`, every rule under `.dt-editorial`) defines editorial design tokens and utility/component classes. Two web fonts (Newsreader serif, IBM Plex Mono) are added via `next/font`. The landing render path of `HomePageClient` and its section components are rebuilt to compose the editorial utilities; the whole landing is wrapped in `.dt-editorial` so nothing leaks into the functional app UI. Light only.

**Tech Stack:** Next.js 14 (App Router), Tailwind CSS, plain CSS, `next/font/google`.

**Spec:** `docs/superpowers/specs/2026-05-19-editorial-landing-design.md`

**Conventions:**
- Editorial CSS rules MUST every one be scoped under `.dt-editorial`.
- Keep existing i18n keys — components keep calling `t()` / `tOr()` with current keys; no fabricated metrics/copy.
- No glassmorphism / gradient / glow / dot-grid. Light only — no `dark:` variants in editorial components; editorial tokens are fixed light values.
- Verification per task: `cd frontend && npm run build` passes (check no `next dev` is running first).
- This is presentational — no logic/tests. The landing components keep their existing behavior (links, the showcase player, FAQ accordion, animated counters).

---

## Branch setup

```bash
cd /Users/mayijie/Projects/Code/010_DocTalk
git checkout -b editorial-landing
```

---

## Task 1: Editorial foundation — fonts + `editorial.css`

**Files:**
- Create: `frontend/src/app/editorial.css`
- Modify: `frontend/src/app/layout.tsx`

- [ ] **Step 1: Create `frontend/src/app/editorial.css`** with exactly:

```css
/* Editorial design layer — "Monocle-crisp". Every rule is scoped under
   .dt-editorial so it never affects the functional app UI. Light only. */
.dt-editorial {
  --ed-paper: #faf9f6;
  --ed-paper-2: #f1efe8;
  --ed-ink: #1c1b19;
  --ed-ink-2: #46443d;
  --ed-ink-3: #86837a;
  --ed-signal: #9a3b32;
  --ed-signal-deep: #7e2f28;
  --ed-rule: #d8d5cc;

  background: var(--ed-paper);
  color: var(--ed-ink-2);
  font-family: var(--font-inter), system-ui, sans-serif;
  -webkit-font-smoothing: antialiased;
}

.dt-editorial .ed-shell {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 40px;
}
@media (max-width: 640px) {
  .dt-editorial .ed-shell { padding: 0 20px; }
}

.dt-editorial .ed-rule {
  border: 0;
  border-top: 1px solid var(--ed-rule);
  margin: 0;
}

.dt-editorial .ed-section { padding: 88px 0; }
@media (max-width: 640px) {
  .dt-editorial .ed-section { padding: 56px 0; }
}

.dt-editorial .ed-display {
  font-family: var(--font-newsreader), Georgia, serif;
  font-weight: 400;
  font-size: clamp(40px, 6vw, 68px);
  line-height: 1.05;
  letter-spacing: -0.02em;
  color: var(--ed-ink);
}

.dt-editorial .ed-h2 {
  font-family: var(--font-newsreader), Georgia, serif;
  font-weight: 400;
  font-size: clamp(28px, 3.5vw, 40px);
  line-height: 1.1;
  letter-spacing: -0.015em;
  color: var(--ed-ink);
}

.dt-editorial .ed-h3 {
  font-family: var(--font-newsreader), Georgia, serif;
  font-weight: 500;
  font-size: 21px;
  line-height: 1.25;
  color: var(--ed-ink);
}

.dt-editorial .ed-lede {
  font-size: 18px;
  line-height: 1.6;
  color: var(--ed-ink-2);
}

.dt-editorial .ed-body {
  font-size: 15.5px;
  line-height: 1.65;
  color: var(--ed-ink-2);
}

.dt-editorial .ed-label {
  font-family: var(--font-plex-mono), ui-monospace, monospace;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.13em;
  color: var(--ed-ink-3);
}

.dt-editorial .ed-label-num { color: var(--ed-signal); }

.dt-editorial .ed-caption {
  font-family: var(--font-plex-mono), ui-monospace, monospace;
  font-size: 10.5px;
  letter-spacing: 0.04em;
  color: var(--ed-ink-3);
}

.dt-editorial .ed-num {
  font-family: var(--font-newsreader), Georgia, serif;
  font-weight: 400;
  font-size: clamp(32px, 4vw, 52px);
  line-height: 1;
  color: var(--ed-ink);
}

.dt-editorial .ed-cta {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: var(--ed-signal);
  color: #ffffff;
  font-family: var(--font-inter), sans-serif;
  font-size: 14px;
  font-weight: 500;
  padding: 13px 22px;
  border-radius: 3px;
  transition: background-color 150ms ease;
}
.dt-editorial .ed-cta:hover { background: var(--ed-signal-deep); }

.dt-editorial .ed-link {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--ed-ink);
  font-weight: 500;
  font-size: 14px;
  text-decoration: underline;
  text-underline-offset: 4px;
  text-decoration-color: var(--ed-rule);
  transition: text-decoration-color 150ms ease, color 150ms ease;
}
.dt-editorial .ed-link:hover {
  color: var(--ed-signal);
  text-decoration-color: var(--ed-signal);
}

.dt-editorial .ed-figure {
  border: 1px solid var(--ed-rule);
  background: var(--ed-paper-2);
}

.dt-editorial a.ed-inline {
  color: var(--ed-signal);
  text-decoration: underline;
  text-underline-offset: 2px;
}

.dt-editorial *:focus-visible {
  outline: 2px solid var(--ed-signal);
  outline-offset: 2px;
}
```

- [ ] **Step 2: Add the editorial fonts and CSS import in `frontend/src/app/layout.tsx`.**

Read `layout.tsx`. It already imports fonts via `next/font/google` (Inter, Sora) and `./globals.css`. Add Newsreader + IBM Plex Mono following the same pattern:

```ts
import { Newsreader, IBM_Plex_Mono } from "next/font/google";

const newsreader = Newsreader({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-newsreader",
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-plex-mono",
  display: "swap",
});
```

Add `./editorial.css` to the imports (immediately after the existing `./globals.css` import).

Append `${newsreader.variable} ${plexMono.variable}` to the existing `className` on the `<html>` element (which already has the Inter/Sora variables).

- [ ] **Step 3: Verify build.** No `next dev` running; `cd frontend && npm run build` → passes.

- [ ] **Step 4: Commit.**
```bash
git add frontend/src/app/editorial.css frontend/src/app/layout.tsx
git commit -m "feat(editorial): add editorial design foundation — fonts + scoped CSS

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Editorial header & footer

**Files:**
- Create: `frontend/src/components/landing/EditorialHeader.tsx`
- Create: `frontend/src/components/landing/EditorialFooter.tsx`

These are landing-only; the existing `PublicHeader`/`Footer` keep serving other pages.

- [ ] **Step 1: Build `EditorialHeader.tsx`** — a `"use client"` component, a sticky masthead:
  - Root `<header>`: sticky top-0, `background: var(--ed-paper)`, a `border-bottom: 1px solid var(--ed-rule)` (use an inline editorial style or an `ed-` class — add a `.ed-header` rule to `editorial.css` if needed, scoped under `.dt-editorial`).
  - Left: `DocTalk` wordmark (Newsreader, ~20px, `--ed-ink`) + a mono descriptor label (`ed-label`, e.g. "Document Intelligence").
  - Right: nav links (Features / Pricing / Security — `ed-label` style or small Inter links) and a primary `ed-cta` "Sign in" linking to `/auth`.
  - No theme toggle, no locale selector clutter — keep it spare.
  - Height ~64px, contents in an `ed-shell`.
  - Use `next/link` for nav.

- [ ] **Step 2: Build `EditorialFooter.tsx`** — a `"use client"` editorial colophon:
  - Root `<footer>` with a top `ed-rule`, `background: var(--ed-paper)`, padding generous.
  - A multi-column layout inside `ed-shell`: column 1 = `DocTalk` wordmark + a one-line mono tagline; further columns = grouped links (Product / Company / Legal) as small Inter links; final fine-print row = mono `© 2026 DocTalk` + Terms/Privacy links.
  - Reuse real footer links from the existing `Footer.tsx` (read it for the real link set/labels) — do not invent links.

- [ ] **Step 3: Verify build** — `cd frontend && npm run build` passes (the components are not yet rendered anywhere; this confirms they compile).

- [ ] **Step 4: Commit.**
```bash
git add frontend/src/components/landing/EditorialHeader.tsx frontend/src/components/landing/EditorialFooter.tsx
git commit -m "feat(editorial): editorial masthead header and colophon footer

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Editorial Hero

**Files:**
- Rewrite: `frontend/src/components/landing/HeroSection.tsx`

- [ ] **Step 1: Rebuild `HeroSection.tsx`** as an editorial hero:
  - An `ed-section` inside `ed-shell`. Asymmetric layout: a wide text column (~7/12) and a figure column (~5/12) on desktop (`md:grid md:grid-cols-12`), stacked on mobile.
  - Top of the text column: a mono `ed-label` eyebrow with a signal number (e.g. `01 — Document intelligence`).
  - Headline: an `<h1 className="ed-display">` using the existing hero title i18n key (`t('landing.title')` or current key — read the file for the actual key).
  - Standfirst: a `<p className="ed-lede">` from the existing description key.
  - CTAs: a primary `ed-cta` ("Try the demo" → `/demo`) and a secondary `ed-link` ("Sign in" → `#auth` or `/auth`) — keep the existing `trackEvent` calls.
  - A mono metrics row: three or four `ed-label` items with `ed-num`-styled figures (reuse real numbers; e.g. `11 Languages`, `5 Formats`, `01 Cited answers`).
  - Figure column: the product visual as an `ed-figure` plate (reuse `HeroArtifact` or the showcase still) with an `ed-caption` below it (`Fig. 01 — The reading workspace`).
  - Remove `dt-workbench-canvas`, `dt-stitch-primary`, `bg-white/*`, `var(--workbench-*)`, `rounded-full` — replace entirely with editorial classes.
  - Keep `ScrollReveal` wrapping if desired (it is mode-agnostic).

- [ ] **Step 2: Verify build** — passes.
- [ ] **Step 3: Commit** — `git add frontend/src/components/landing/HeroSection.tsx && git commit -m "feat(editorial): editorial hero section\n\nCo-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"`

---

## Task 4: Editorial Feature set

**Files:**
- Rewrite: `frontend/src/components/landing/FeatureGrid.tsx`

- [ ] **Step 1: Rebuild `FeatureGrid.tsx`** as an editorial feature set:
  - An `ed-section` in `ed-shell`. A section header: mono `ed-label` (`Features`) + an `ed-h2`.
  - The six features become numbered editorial entries (keep the existing `tiles` data + i18n title/desc keys). Each entry: a mono `01 —` / `02 —` … label (number in signal red via `ed-label-num`), an `ed-h3` title, an `ed-body` paragraph, and the existing small inline mock visual reframed inside a compact `ed-figure`.
  - Lay them in an asymmetric editorial grid (e.g. a 12-col grid; entries take varying spans — a simple, calm rhythm such as two columns of three, separated by `ed-rule` hairlines, is acceptable). Hairline `ed-rule` between rows.
  - Keep the bespoke `Visual*` mock components but restyle their canvas to editorial neutrals (`--ed-paper-2` background, `--ed-rule` borders) — no `dark:` variants, no blue; the citation accent uses `--ed-signal`.

- [ ] **Step 2: Verify build** — passes.
- [ ] **Step 3: Commit** — `git add frontend/src/components/landing/FeatureGrid.tsx && git commit -m "feat(editorial): editorial feature set\n\nCo-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"`

---

## Task 5: Editorial How-it-works + Metrics

**Files:**
- Rewrite: `frontend/src/components/landing/HowItWorks.tsx`
- Rewrite: `frontend/src/components/landing/SocialProof.tsx`

- [ ] **Step 1: Rebuild `HowItWorks.tsx`** — an `ed-section` in `ed-shell`: a mono `ed-label` + `ed-h2` header, then 3 steps in a 3-col grid. Each step: a large `ed-num` numeral (`01`/`02`/`03`), an `ed-h3` title, an `ed-body` line. Hairline `ed-rule` framing; a thin dashed or solid rule connecting steps on desktop is optional. Keep the existing i18n step keys.

- [ ] **Step 2: Rebuild `SocialProof.tsx`** — keep the `AnimatedCounter` component and `metrics` array and all logic. Replace the returned section: an `ed-section` in `ed-shell`, framed top and bottom with `ed-rule` hairlines; the 4 metrics in a row, each an `ed-num` figure with a mono `ed-label` beneath. No colored band — editorial figures on paper. Numbers in `--ed-ink`.

- [ ] **Step 3: Verify build** — passes.
- [ ] **Step 4: Commit** — `git add frontend/src/components/landing/HowItWorks.tsx frontend/src/components/landing/SocialProof.tsx && git commit -m "feat(editorial): editorial how-it-works and metrics\n\nCo-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"`

---

## Task 6: Editorial Security + FAQ + Final CTA

**Files:**
- Rewrite: `frontend/src/components/landing/SecuritySection.tsx`
- Rewrite: `frontend/src/components/landing/FAQ.tsx`
- Rewrite: `frontend/src/components/landing/FinalCTA.tsx`

- [ ] **Step 1: Rebuild `SecuritySection.tsx`** — an `ed-section` in `ed-shell`: mono `ed-label` + `ed-h2` header; the 4 real privacy points (keep the existing `cards` data + i18n keys) as an editorial two-column points list, each a mono number + `ed-h3` + `ed-body`, separated by `ed-rule` hairlines. Keep the lucide icons but small and inked (`--ed-ink-3`), or drop them for a purely typographic treatment.

- [ ] **Step 2: Rebuild `FAQ.tsx`** — an `ed-section` in `ed-shell` (`max-width` narrower for reading, ~760px): mono `ed-label` + `ed-h2`; the FAQ items as a hairline-ruled `<details>` list — each `<summary>` an `ed-h3`-ish line with a mono question number and a `+`/`−` or chevron; answer in `ed-body`. Keep existing FAQ i18n keys and accordion behavior.

- [ ] **Step 3: Rebuild `FinalCTA.tsx`** — an `ed-section` in `ed-shell`, centered or left-set editorial closing: a large `ed-display`/`ed-h2` line + an `ed-lede` + a primary `ed-cta`. Keep existing CTA links + `trackEvent`. Remove `bg-accent`, `rounded-lg` heavy treatments — use `ed-cta`.

- [ ] **Step 4: Verify build** — passes.
- [ ] **Step 5: Commit** — `git add frontend/src/components/landing/SecuritySection.tsx frontend/src/components/landing/FAQ.tsx frontend/src/components/landing/FinalCTA.tsx && git commit -m "feat(editorial): editorial security, FAQ, and closing CTA\n\nCo-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"`

---

## Task 7: Assemble the editorial landing in HomePageClient

**Files:**
- Modify: `frontend/src/app/HomePageClient.tsx`

- [ ] **Step 1: Rewrite the landing render path** (`LandingPageContent`, the unauthenticated/loading view — NOT the authenticated dashboard path, which stays untouched):
  - Wrap the whole landing in a root `<div className="dt-editorial">` (this applies the editorial scope + opaque paper background so the global theme/`dt-stitch-root` transparency does not affect it).
  - Render, in order: `<EditorialHeader />`, `<HeroSection />`, `<FeatureGrid />`, `<HowItWorks />`, `<SocialProof />`, `<SecuritySection />`, `<FAQ />`, `<FinalCTA />`, `<EditorialFooter />`.
  - Drop the old `dt-stitch-theme` wrapper, the inline "Explore" link grid, the `glow-accent`/`dt-stitch-card` showcase frame, and the old `Header`/`Footer` from the landing path (replaced by the editorial header/footer). The `ShowcasePlayer` may be kept as the hero figure if Task 3 used it; otherwise omit it.
  - Keep the authenticated dashboard render path of `HomePageClient` exactly as-is.

- [ ] **Step 2: Verify build** — `cd frontend && npm run build` passes.

- [ ] **Step 3: Confirm no editorial-scope leakage** — `cd frontend && grep -rn "dt-editorial" src/` should show it only on the landing root and in `editorial.css`. The functional app UI must not reference it.

- [ ] **Step 4: Commit.**
```bash
git add frontend/src/app/HomePageClient.tsx
git commit -m "feat(editorial): assemble editorial landing page

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: Final verification

- [ ] **Step 1:** `cd frontend && npm run build` passes.
- [ ] **Step 2:** Dev server browser walkthrough of `/`:
  - Editorial layout renders — paper background, Newsreader serif headlines, IBM Plex Mono labels/captions, hairline rules, brick-red signal used sparingly (numbers, CTA, links). No glass / gradient / glow / dot-grid.
  - The landing renders light even if the global theme is set to dark.
  - `/auth` and a functional app page (e.g. `/tools/word-counter` or the reader) are visually unchanged — the editorial scope did not leak.
- [ ] **Step 3:** Stop the dev server.

---

## Self-review notes

- **Spec coverage:** foundation/tokens/fonts → Task 1; header & footer → Task 2; hero → Task 3; feature set → Task 4; how-it-works + metrics → Task 5; security + FAQ + final CTA → Task 6; `.dt-editorial` scope + assembly → Task 7; light-only + leakage + verification → Tasks 7–8.
- **No placeholders:** Task 1 (the foundation contract) is byte-exact. Component tasks are build specs — precise layout, the editorial utility classes to compose, the existing i18n keys and real data to keep — appropriate for a design-implementation task where exact JSX is a matter of editorial judgment within a fixed token system; the two-stage review plus the Task 8 visual check are the safety net.
- **Consistency:** every component task composes only the `ed-*` classes defined in Task 1's `editorial.css`; no class is referenced that Task 1 does not define (header may add one `.ed-header` rule, called out in Task 2).
