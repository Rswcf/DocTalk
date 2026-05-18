# Theme Removal Phase 2 — Design Spec

**Date:** 2026-05-18
**Status:** Approved (autonomy grant — user delegated S2–S5 completion)
**Topic:** Complete the removal of the workbench/stitch AI-flavored theme system by de-glassing all remaining `dt-*` CSS rule families in `globals.css`.

## Program context

This completes the site-wide theme-removal program begun by S1. S1 cleaned the
global `body` background, neutralized `dt-stitch-root`/`dt-stitch-theme`
*backgrounds*, and standardized the accent on indigo. A full inventory then
showed the remaining AI flavor is concentrated entirely in `globals.css` as
~30 `dt-*` CSS rule families, all needing the **same transformation**. Because
the work is one coherent CSS job — not four independent surface redesigns — the
originally-planned sub-projects S2 (landing), S3 (chrome), S4 (workspace/chat),
and S5 (admin) are collapsed into this single Phase 2.

Branch: new branch `theme-removal-phase2`, cut from `s1-foundation`.

## Problem

~30 `dt-*` class families in `frontend/src/app/globals.css` carry "AI flavor":
`backdrop-filter: blur()` glassmorphism, multi-layer `radial-gradient` /
`linear-gradient` color washes, dot-grid `::before` pseudo-elements, blurred
`::after` glow layers, oversized multi-layer `box-shadow` (22–90px), a
violet→blue gradient accent bar, semi-transparent `rgba` panel backgrounds, and
blue-tinted borders. The `dt-stitch-theme` class also still remaps page interior
colors to the workbench palette. Three utility classes (`glow-accent`,
`dot-pattern`, `text-gradient-accent`) add a glow halo, a dot-grid, and a
gradient-text effect.

## Core principle — preserve structure, replace decoration

Every `dt-*` class **keeps its name and all structural properties** (layout,
`position`, `border-radius`, `padding`, sizing, `z-index`, `transition`). Only
the **decorative AI-flavor properties** are replaced with clean equivalents.
Because structure is untouched, page layouts cannot break — only the visual
finish changes. The `.tsx` files keep their class names; nearly all changes are
in `globals.css`.

## The clean-treatment system

All replacements use plain zinc + indigo values (per `.claude/rules/frontend.md`
and the `/auth` redesign reference). Borders/surfaces use literal zinc hex or
the existing clean `--border` / `--surface-*` / `--foreground` tokens — **not**
the blue-tinted `--workbench-*` tokens.

| Old (AI-flavor) | Clean replacement |
|---|---|
| `backdrop-filter: blur(Npx)` | removed entirely |
| Glass panel/card background (linear-gradient wash or `--workbench-panel` translucent rgba) | solid `#ffffff` light / `#18181b` (zinc-900) dark |
| Page-level `radial-gradient`/`linear-gradient` background washes | flat `#fafafa` light / `#09090b` dark (or `transparent` where the parent already paints) |
| Dot-grid `::before` pseudo-elements | rule deleted |
| Blurred `::after` glow layers | rule deleted |
| Oversized `box-shadow` (Y ≥ 18px, multi-layer, inset highlights) | small soft shadow: `0 1px 2px rgba(24,24,27,0.05)` for flat cards, `0 8px 24px -10px rgba(24,24,27,0.12)` for genuinely elevated/floating surfaces; dark mode uses `rgba(0,0,0,0.4–0.55)`. No `inset` highlight lines. |
| Semi-transparent `rgba(255,255,255,0.7–0.9)` pill/chip/button backgrounds | solid `#ffffff` / `#f4f4f5` light, `#27272a` / `#18181b` dark |
| Blue-tinted `--workbench-border` | `#e4e4e7` (zinc-200) light / `#27272a` (zinc-800) dark — or `var(--border)` |
| `dt-answer-card::before` violet→blue gradient bar | solid `#4f46e5` indigo |
| `dt-shell-header` translucent + backdrop-blur | solid `#ffffff` / `#09090b` with a 1px bottom hairline border |

Text-color tokens `--workbench-ink` (near-black/near-white) and
`--workbench-muted` (slate) are acceptably neutral and may stay referenced.

## Scope — `globals.css` rule groups

### Group A — Glass panels & cards (de-glass to solid)

`dt-glass-panel`, `dt-stitch-card`, `dt-command-bar`, `dt-empty-workbench`,
`dt-reader-pane`, `dt-answer-card` (+ its `::before` bar), `dt-user-bubble`,
`dt-admin-panel` (+ its `.recharts-*` sibling selector), `dt-kpi-card`,
`dt-composer` (+ `:focus-within`). Each → solid surface, 1px hairline border,
small soft shadow, no `backdrop-filter`, no gradient wash. `dt-composer:focus-within`
keeps an indigo focus treatment but as a simple `border-color` + 2px ring, not a
26px glow.

### Group B — Background washes (flatten)

`dt-workbench-canvas` (+ `::before` dot-grid, `::after` glow, dark variants,
`> *`), `dt-reading-workspace` (+ `::before` dot-grid, dark variant),
`dt-admin-workbench` (+ dark variant), `dt-reader-pane-document` (+ dark),
`dt-chat-shell` (+ dark). Each → flat solid background; delete all dot-grid
`::before` and glow `::after` pseudo-elements. `dt-document-stage` and
`dt-composer-shell` use short functional fade gradients — keep those (they are
scroll/paper fades, not decorative washes) but verify they read cleanly.

### Group C — Pills, buttons, chips, headers, toggles

`dt-workbench-pill`, `dt-workbench-button` (+ `:hover`, dark), `dt-shell-header`
(+ dark), `dt-suggested-question` (+ states), `dt-source-chip` (+ states),
`dt-sources-strip`, `dt-citation-card` (+ states), `dt-view-toggle`. Each →
solid background, hairline border, modest or no shadow, no `backdrop-filter`,
no translucency. Hover states keep the `translateY(-1px)` lift if present (a
subtle, non-AI interaction) but lose the oversized shadow growth.
`dt-stitch-primary` is already a clean solid button — only trim its `box-shadow`
from `0 16px 42px` to a modest `0 1px 2px`.

### Group D — `dt-stitch-theme` remaps & utilities

- Neutralize the `dt-stitch-theme` interior color-remap rules (`text-zinc-*` →
  `--workbench-ink/muted`, `bg-white/zinc` → translucent rgba, `border-zinc-*` →
  `--workbench-border`, the `[class*="bg-white/"]` etc. `html:not(.dark)` rules,
  and the `dt-stitch-theme h1,h2,h3` font/letter-spacing override). After this,
  `dt-stitch-theme` retains only `position/isolation/overflow-x` (layout) and
  the harmless `> *` / `> .dt-shell-header` z-index rules; pages render with
  their own plain Tailwind zinc classes.
- `glow-accent` — delete the CSS rule (and remove the one class usage in
  `HomePageClient.tsx`).
- `dot-pattern` — delete the CSS rule (and remove the one usage in `FinalCTA.tsx`).
- `text-gradient-accent` — delete the CSS rule (it is already dead — no callsites).

### Group E — Component-level inline AI-flavor (the only `.tsx` edits)

- `HomePageClient.tsx` — remove the `glow-accent` class usage (Group D deletes
  its CSS).
- `landing/FinalCTA.tsx` — remove the `dot-pattern` class usage.
- `landing/SocialProof.tsx` line 78 — replace the inline
  `bg-gradient-to-r from-blue-600 to-violet-600 dark:from-blue-400 dark:to-violet-400 bg-clip-text text-transparent`
  gradient-text on the metric counters with a solid `text-zinc-900 dark:text-zinc-50`.
- `landing/HeroArtifact.tsx` line 18 — replace the inline
  `bg-[linear-gradient(16deg,…)]` overlay with a clean solid/transparent treatment.
- The `dt-workbench-canvas` class on `HeroSection.tsx`, `dt-reader-pane-document`,
  etc. stay in the JSX — Group B flattens their CSS, so no `.tsx` edit needed.

## Out of scope

- Removing `dt-*` class names from `.tsx` files (except the `glow-accent` /
  `dot-pattern` usages in Group E, whose CSS is deleted). Inert/cleaned classes
  may remain in markup.
- The `--workbench-*` token definitions in `:root` — left defined; cleaned rules
  simply stop depending on the blue-tinted ones. A later cleanup may delete
  now-unused tokens, but that is not required here.
- Citation highlight animations (`citationTextFocus`, `citationOverlayFocus`,
  `citation-overlay::before`) — those are transient functional focus cues, not
  ambient AI decoration. Untouched.
- Any logic, routing, or backend change.

## Carry-forward already noted

`.dark .glow-accent` and `.text-gradient-accent`'s stale comment/cross-family
gradient were flagged in the S1 review — both are resolved here (Group D
deletes those rules outright).

## Verification

- `cd frontend && npm run build` passes.
- Browser visual spot-check (light + dark) across one surface per group:
  - Landing `/` — flat backgrounds, solid cards, no glow/dot-grid/gradient text.
  - A chat/reader view (`/d/<id>` if reachable, else inspect components) —
    answer card, source chips, composer are solid, no glass.
  - `/admin` — panels/KPI cards solid, workbench background flat.
  - Public pages (`/pricing`, `/tools/word-counter`) — interiors render with
    plain zinc colors, no translucency.
  - App header — solid, hairline bottom border, no blur.
- No `backdrop-filter`, decorative `radial-gradient` wash, or dot-grid
  `::before` remains in `globals.css` (`grep` check).
- No page renders visibly broken (structure preserved by design).

## Risks

- **Volume** — ~30 rule families change in one file. Mitigated by the
  structure-preserving principle (only decoration changes) and by chunked tasks
  (A–E) each independently buildable and reviewable.
- **Sticky-header legibility** — `dt-shell-header` loses its backdrop-blur; a
  solid background is used instead so content scrolling under it stays legible.
- **`dt-stitch-theme` remap removal** — pages that were visually tuned against
  the remapped workbench colors now show plain zinc. This is the intended clean
  state; the inventory confirmed page interiors already use standard zinc
  Tailwind classes underneath the remap.
