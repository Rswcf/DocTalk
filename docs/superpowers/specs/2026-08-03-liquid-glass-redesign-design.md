# DocTalk Liquid Glass Redesign — Design Spec

**Date:** 2026-08-03
**Status:** APPROVED direction, pending spec review → writing-plans
**Owner decisions (2026-08-03):** site-wide Apple-style Liquid Glass across BOTH the functional app surface AND the marketing/editorial layer (overturns the 2026-05-20 two-surface lock); **marketing goes first**; naked pages (admin/auth/shared/Footer) get folded into the theme system in the same program; palette = **Counterpoint**; type = **Fraunces + IBM Plex Sans + IBM Plex Mono**.

Reference recipe: KPMG Whismm "Project Ocean v5" dashboard. Visual reference: the published marketing preview (Counterpoint) + the app direction study.

---

## 1. Goal & principles

Give the whole product one Apple-style glass **material language**, with **hue** still dividing the two surfaces (warm marketing / cool app). Non-negotiables:

- **Glass is chrome, not content.** Frosted material applies to navigation, cards, controls, overlays — NEVER to reading prose. Body copy keeps a solid ground. This is the single discipline that keeps it from reading as a gimmick.
- **De-AI the palette.** Leave the cream + terracotta + lone-accent template. Counterpoint = paper-grey ground + warm rust primary + prussian-slate structure (second colour) + olive reserved for verified/positive.
- **Every glass rule ships its fallback.** `prefers-reduced-transparency: reduce` → solid; `@media print` → solid; `prefers-reduced-motion` respected. No exceptions — this is required by Apple HIG and was entirely absent before.
- ** Occhio to performance.** No `backdrop-filter` on: SSE-streaming chat answer cards, the PdfViewer scroll container / page layers, Recharts/admin chart panels, or any frequently-reflowing list. Blur is for header, sidebar, composer, toolbars, modals/drawers, pills, and static marketing cards only.

## 2. Token system

### 2.1 Type (global, `frontend/src/app/layout.tsx` + `globals.css`)
Fonts load via `next/font/google` (build-time self-hosted, CSP-safe) — same mechanism as today.
- `Newsreader` → **`Fraunces`** (variable; opsz + soft axes) → `--font-fraunces`, drives editorial headlines (`--dt-serif` Latin).
- `Inter` → **`IBM Plex Sans`** → `--font-plex-sans`, the body/UI workhorse (`--dt-body`).
- `IBM Plex Mono` → **kept** (`--font-plex-mono`, labels/code/data).
- `Sora` (logo) → **kept** for the wordmark to preserve brand continuity (revisit only if it clashes with Fraunces).
- **Per-script `:lang()` stacks** (`globals.css:17-45`): swap the Latin base from Inter→IBM Plex Sans; CJK/Arabic/Devanagari keep the existing system-font fallback chain (Plex Sans Latin doesn't ship those scripts via `next/font/google`; system stacks already cover them). Non-Latin headlines already fall back from `--dt-serif` to the body face — unchanged.

### 2.2 Marketing palette — Counterpoint (`editorial.css` `:root`, scoped under `.dt-editorial`)
| token | old (AI cream) | new (Counterpoint) |
|---|---|---|
| `--ed-paper` | `#f3eee1` | `#eae8e3` |
| `--ed-paper-2` | `#e9e1cf` | `#e4e2db` |
| `--ed-ink` | `#1c1b19` | `#20211e` |
| `--ed-ink-2` | `#48443b` | `#5b5a52` |
| `--ed-ink-3` | `#6e6860` | `#8a897f` |
| `--ed-signal` | `#b0472f` | `#a04b34` (deeper, less orange) |
| `--ed-signal-deep` | `#8f3a26` | `#843c28` |
| `--ed-ochre` | `#c08a3e` | **replaced by** `--ed-slate: #1f3a4d` + `--ed-slate-2: #2f556b` (structure: links, secondary CTA, quote rule) |
| — | — | `--ed-olive: #3f6a34` (verified/positive ONLY) |
| `--ed-rule` | `#d3c9b3` | `rgba(32,33,30,.12)` |

Semantics: rust = action (primary CTA, brand mark, feature eyebrows); slate = structure (links, secondary CTA, quote borders, nav hover); olive = verified state only. Two accents, not one.

### 2.3 Glass material tokens (both surfaces, Ocean v5 recipe)
Marketing (`editorial.css`, warm):
```
--ed-glass: rgba(250,249,246,.55);  --ed-glass-strong: rgba(251,250,247,.85);
--ed-glass-blur: blur(22px) saturate(150%);  --ed-glass-line: rgba(32,33,30,.12);
--ed-glass-hi: inset 0 1px 0 rgba(255,255,255,.82);  --ed-glass-shadow: 0 18px 44px -18px rgba(30,25,20,.32);
--ed-radius: 22px;
```
App (`globals.css`, cool): re-point the SURVIVING unused glass tokens (`--workbench-panel` rgba(255,255,255,.76)/dark .74, `--workbench-panel-strong`, `--reader-panel`, etc. — recoverable via `git show 0b7404a^`) instead of the current hardcoded `#ffffff`/`#18181b`; same blur/line/hi/shadow structure with cool zinc + blue `#1D4ED8` accent.

## 3. Ambient canvas layer
Glass over a flat neutral reads flat — a canvas is a prerequisite, not polish.
- Marketing: `MarketingShell` gains a document-height `.ambient` — **restrained, asymmetric** static radial-gradients (warm rust + a touch of cool slate, low alpha), NOT an even glow. `prefers-reduced-transparency`/print → `display:none`. Static gradients (not `filter:blur`) for zero scroll repaint.
- App: restore a canvas on `body`/`.dt-workbench-canvas` (the dot-grid `::before` + radial `::after` deleted in `0b7404a` — bring back a cool version). `body` is currently flat `#fafafa`.

## 4. Component inventory

### 4.1 Marketing kit (`components/marketing/*`, `components/landing/*`) — Batch 1
Glass (chrome): `EditorialMarketingHeader` (sticky glass bar), `EdCard`/`EdCardGrid`, `EdCtaBanner`, `EdFaqList` + `EdComparisonTable` panel containers, `EdLanguageSelector` popover, hero cards. **Solid (content): `EdProse`, article body, `EdSection` text blocks.** Verified/quote demo objects use olive badge + slate rule.

### 4.2 App `.dt-*` (`globals.css` + reader/chat/dashboard/collections/profile/billing) — Batch 2
Re-point `.dt-glass-panel`, `.dt-shell-header`, `.dt-workbench-pill`, `.dt-command-bar`, `.dt-reader-pane`, `.dt-composer`, `.dt-answer-card`(SOLID — SSE streams), toolbars at surviving glass tokens + restore `backdrop-filter` where perf allows. Overlays (currently three inconsistent treatments) unify onto one tokenized glass recipe.

### 4.3 Naked pages folded in
- Batch 1: `shared/[token]` (public share page — no tokens today; adopt MarketingShell + warm glass; it's a public brand-facing surface).
- Batch 2: `admin` (no `dt-stitch-theme` today), `auth` (opaque, hardcoded shadow), `Footer.tsx` (plain `bg-white`) → app theme + cool glass tokens.

## 5. Cascade traps (app, Batch 2 only — editorial is trap-free)
1. `.dt-*` rules sit AFTER `@tailwind utilities`; equal specificity → later wins. `.dt-shell-header{z-index:80}` silently overrides JSX `z-30`. Do not assume utilities win.
2. `.dt-stitch-theme` + `.dt-shell-header` set `isolation:isolate`; `.dt-stitch-theme > *` forces `z-index:1`. Each isolated ancestor is a backdrop root — a blurred descendant samples only what's painted inside it. Header blur will sample nothing unless reworked. Resolve BOTH before adding `backdrop-filter`.

## 6. Accessibility & performance (both batches)
- Every glass rule: paired `prefers-reduced-transparency: reduce` solid fallback + `@media print` solid. Add a global helper/audit so none is missed.
- `motion-reduce:` coverage already good (51 uses) — extend to new hover/reveal.
- `:focus-visible` rings preserved/added on all interactive glass.
- Perf red-lines from §1 enforced; verify PdfViewer scroll + chat streaming stay smooth.

## 7. Batching (each = its own SDD + Codex round + deploy)

**Batch 0 (foundation, folded into Batch 1's start):** type migration (layout.tsx + per-script stacks) + glass-token definitions (editorial warm + app cool) + a11y-fallback scaffolding. Site-wide but non-visual-breaking (fonts improve, tokens unused until consumed).

**Batch 1 — Marketing first (deploy as a visible new marketing version):** Counterpoint palette migration in `editorial.css` + marketing-kit glassing (§4.1) + marketing ambient + `shared/[token]` fold-in. `.dt-editorial`-scoped, trap-free. Verify: all editorial pages (landing, use-cases×N, compare/alternatives×N, features×N, pricing, trust, demo, tools) + 11-locale intact + reduced-transparency fallback + Lighthouse/CLS.

**Batch 2 — App surface:** app cool-glass token re-point (§4.2) + app ambient canvas + cascade-trap resolution (§5) + admin/auth/Footer fold-in. Perf red-lines enforced (§1). Verify: reader/chat/dashboard golden path both themes, PDF scroll smooth, SSE streaming smooth, admin charts unjanked.

## 8. Out of scope / follow-ups
- IBM Plex Sans Arabic/Devanagari as real webfonts (vs system fallback) — measure first, add only if the system fallback looks off.
- Dark-mode glass for the app surface (marketing is light-only by identity) — the surviving tokens already carry dark values; verify contrast per §2.3.
- `shared/[token]` SEO fixes (noindex → indexable, UTM) — related but a separate growth item; flag, don't bundle unless trivial.

## 9. Testing contract (per batch)
`cd frontend && npm run build` clean (never while dev runs); `npx tsc --noEmit` + `npx next lint --quiet` clean; i18n key-set parity ×11; browser golden path in BOTH themes where applicable; reduced-transparency toggle verified; palette rule (zero gray-*/indigo-*/violet-*/purple-* in app scope, editorial stays scoped); Codex adversarial round to consensus before deploy.
