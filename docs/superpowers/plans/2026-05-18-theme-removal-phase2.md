# Theme Removal Phase 2 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** De-glass all ~30 remaining `dt-*` CSS rule families in `globals.css` and remove the last component-level AI-flavor gradients, completing the workbench/stitch theme removal.

**Architecture:** A structure-preserving CSS transformation — every `dt-*` class keeps its name and layout properties; only decorative AI-flavor properties (`backdrop-filter`, gradient washes, dot-grid/glow pseudo-elements, oversized shadows, translucency, blue-tinted borders) are replaced with clean zinc+indigo equivalents. Almost all changes are in `frontend/src/app/globals.css`; four `.tsx` files get small edits.

**Tech Stack:** Next.js 14, Tailwind CSS, plain CSS.

**Spec:** `docs/superpowers/specs/2026-05-18-theme-removal-phase2-design.md` — see it for the full clean-treatment system table.

**Note on testing:** Presentational CSS — no unit tests. Per-task verification is `cd frontend && npm run build`; final verification is a browser visual check.

---

## Branch setup

Current branch: `s1-foundation`. Phase 2 builds on it.

- [ ] `cd /Users/mayijie/Projects/Code/010_DocTalk && git checkout -b theme-removal-phase2`

---

## Clean-treatment system (applies to every rule below)

- Remove every `backdrop-filter`.
- Glass/translucent panel & card backgrounds → solid `#ffffff` (light) / `#18181b` (dark).
- Page-level gradient/wash backgrounds → flat `#fafafa` (light) / `#09090b` (dark), or `transparent` if a parent paints the canvas.
- Delete dot-grid `::before` and blurred `::after` pseudo-element rules.
- Oversized/multi-layer `box-shadow` → `0 1px 2px rgba(24,24,27,0.05)` (flat card) or `0 8px 24px -10px rgba(24,24,27,0.12)` (elevated); dark mode `rgba(0,0,0,0.4)`–`rgba(0,0,0,0.55)`. No `inset` highlight lines.
- Blue-tinted `--workbench-border` → `#e4e4e7` (light) / `#27272a` (dark).
- Translucent pill/chip/button backgrounds → solid `#ffffff` or `#f4f4f5` (light) / `#27272a` or `#18181b` (dark).
- Keep all structural properties: `position`, `border-radius`, `padding`, sizing, `z-index`, `transition`, layout. Keep subtle `translateY(-1px)` hovers.
- Keep `--workbench-ink` / `--workbench-muted` text-color references (already neutral).

---

## Task 1: De-glass `globals.css`

**Files:** Modify `frontend/src/app/globals.css`.

Rewrite each rule family below per the clean-treatment system. The controller will supply the exact current CSS of every rule in the implementer dispatch.

- [ ] **Step 1 — Group A: glass panels & cards.** Rewrite to solid surface + hairline border + small shadow, no `backdrop-filter`, no gradient wash:
  `.dt-glass-panel`, `.dt-stitch-card`, `.dt-command-bar`, `.dt-empty-workbench`, `.dt-reader-pane`, `.dt-answer-card` (+ `::before`), `.dt-user-bubble`, `.dt-admin-panel` (+ its `.recharts-*` sibling selector), `.dt-kpi-card`, `.dt-composer` (+ `:focus-within`) — and all their `.dark` variants. The `.dt-answer-card::before` violet→blue gradient bar → solid `#4f46e5`. `.dt-composer:focus-within` → `border-color: #4f46e5` + `box-shadow: 0 0 0 2px rgba(79,70,229,0.4)`, no 26px glow.

- [ ] **Step 2 — Group B: background washes.** Flatten to solid background; delete dot-grid `::before` and glow `::after`:
  `.dt-workbench-canvas` (+ `::before`, `::after`, `.dark` variants, `> *`), `.dt-reading-workspace` (+ `::before`, `.dark`), `.dt-admin-workbench` (+ `.dark`), `.dt-reader-pane-document` (+ `.dark`), `.dt-chat-shell` (+ `.dark`). Keep `.dt-document-stage` and `.dt-composer-shell` (short functional fade gradients — leave as-is).

- [ ] **Step 3 — Group C: pills, buttons, chips, headers, toggles.** Solid background, hairline border, modest/no shadow, no `backdrop-filter`, no translucency:
  `.dt-workbench-pill`, `.dt-workbench-button` (+ `:hover`, `.dark`, `.dark:hover`), `.dt-shell-header` (+ `.dark`) → solid `#ffffff`/`#09090b` + 1px bottom hairline, `.dt-suggested-question` (+ states), `.dt-source-chip` (+ states), `.dt-sources-strip` (+ `.dark`), `.dt-citation-card` (+ states), `.dt-view-toggle`. `.dt-stitch-primary` — keep the solid fill, only change `box-shadow` to `0 1px 2px rgba(24,24,27,0.05)` (light) / `0 1px 2px rgba(0,0,0,0.4)` (dark) and drop the `inset` highlight.

- [ ] **Step 4 — Group D: `dt-stitch-theme` remaps & dead utilities.** Delete the `dt-stitch-theme` interior color-remap rule blocks (`text-zinc-*`, `bg-white/zinc-*`, `border-zinc-*`, the `html:not(.dark) .dt-stitch-theme [class*=…]` blocks, and the `.dt-stitch-theme h1,h2,h3,.font-serif` font/letter-spacing override). Keep `.dt-stitch-theme` base (`position/isolation/overflow-x/color`), `.dt-stitch-theme > *`, `.dt-stitch-theme > .dt-shell-header`. Delete the `.glow-accent` (+ `.dark`), `.dot-pattern` (+ `.dark`), and `.text-gradient-accent` (+ `.dark`) rule blocks entirely.

- [ ] **Step 5 — Verify build.** Check no dev server runs (`pgrep -fl "next dev"`); then `cd frontend && npm run build` — must pass.

- [ ] **Step 6 — Verify removals.** `cd frontend && grep -nE "backdrop-filter|dt-workbench-canvas::before|dt-reading-workspace::before|text-gradient-accent|\.glow-accent|\.dot-pattern" src/app/globals.css` — expected: no matches.

- [ ] **Step 7 — Commit.**
```bash
git add frontend/src/app/globals.css
git commit -m "feat(theme): de-glass all dt-* component CSS

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Remove component-level inline AI-flavor

**Files:** Modify `frontend/src/app/HomePageClient.tsx`, `frontend/src/components/landing/FinalCTA.tsx`, `frontend/src/components/landing/SocialProof.tsx`, `frontend/src/components/landing/HeroArtifact.tsx`.

- [ ] **Step 1** — `HomePageClient.tsx`: remove the `glow-accent` class from the showcase glow element (its CSS was deleted in Task 1; remove the now-dead class and, if the element existed only to hold the glow, the empty element too).
- [ ] **Step 2** — `landing/FinalCTA.tsx`: remove the `dot-pattern` class from the background overlay element (CSS deleted in Task 1; remove the dead class and the overlay element if it only carried the pattern).
- [ ] **Step 3** — `landing/SocialProof.tsx`: replace the metric-counter inline gradient classes `bg-gradient-to-r from-blue-600 to-violet-600 dark:from-blue-400 dark:to-violet-400 bg-clip-text text-transparent` with solid `text-zinc-900 dark:text-zinc-50`.
- [ ] **Step 4** — `landing/HeroArtifact.tsx`: replace the inline `bg-[linear-gradient(16deg,…)]` overlay class with a clean treatment (solid `bg-white dark:bg-zinc-900`, or remove the overlay element if purely decorative).
- [ ] **Step 5** — Verify build: `cd frontend && npm run build` passes.
- [ ] **Step 6** — Commit:
```bash
git add frontend/src/app/HomePageClient.tsx frontend/src/components/landing/FinalCTA.tsx frontend/src/components/landing/SocialProof.tsx frontend/src/components/landing/HeroArtifact.tsx
git commit -m "feat(theme): remove component-level inline AI-flavor gradients

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Final verification

**Files:** none.

- [ ] **Step 1** — `cd frontend && npm run build` passes.
- [ ] **Step 2** — Browser visual check (light + dark), dev server running:
  - `/` landing — flat backgrounds, solid cards, no glow/dot-grid/gradient text.
  - `/auth` — still the intended minimal card.
  - `/pricing` and `/tools/word-counter` — interiors plain zinc, no translucency.
  - `/admin` (if reachable) — panels/KPI cards solid, flat workbench background.
  - App header — solid with a hairline bottom border, no blur.
  - No surface renders visibly broken.
- [ ] **Step 3** — Stop the dev server.

---

## Self-review notes

- **Spec coverage:** Group A → Task 1 Step 1; Group B → Step 2; Group C → Step 3; Group D → Step 4; Group E → Task 2; verification → Task 3.
- **No placeholders:** the implementer dispatch supplies the exact current CSS of every rule; the clean-treatment system gives the deterministic transformation.
- **Structure preservation** is the consistency guarantee — no rule loses its layout properties, so no consumer `.tsx` breaks.
