Reading prompt from stdin...
2026-08-04T08:52:53.517889Z ERROR codex_core::session::session: failed to load skill /Users/mayijie/Projects/Code/010_DocTalk/.agents/skills/deploy/SKILL.md: missing YAML frontmatter delimited by ---
2026-08-04T08:52:53.517925Z ERROR codex_core::session::session: failed to load skill /Users/mayijie/Projects/Code/010_DocTalk/.agents/skills/codex-implement/SKILL.md: missing YAML frontmatter delimited by ---
OpenAI Codex v0.144.0
--------
workdir: /Users/mayijie/Projects/Code/010_DocTalk
model: gpt-5.6-sol
provider: openai
approval: never
sandbox: workspace-write [workdir, /tmp, $TMPDIR]
reasoning effort: xhigh
reasoning summaries: none
session id: 019fcbf9-cc11-7a13-b759-498d495a6bb1
--------
user
# Codex adversarial review — Liquid Glass Batch 1 (marketing layer)

Full-batch review before production deploy (v0.28.0). Range `782f8b0..HEAD` (16 commits, frontend-only). This is a pure visual/CSS re-skin batch — no backend, no billing, no auth changes.

```
git log --oneline 782f8b0..HEAD
git diff 782f8b0..HEAD
```

## What shipped (plan: .collab/plans/2026-08-04-liquid-glass-batch1-marketing.md; spec: docs/superpowers/specs/2026-08-03-liquid-glass-redesign-design.md)

Owner-approved program: site-wide Apple-style Liquid Glass, marketing/editorial layer first (this batch), app surface later (Batch 2). Owner explicitly overturned the prior two-surface design lock and rejected the old cream+terracotta palette as AI-flavored.

1. **Type**: Newsreader→Fraunces (variable, opsz+SOFT), Inter→IBM Plex Sans (400-700; NO 800 — .ed-display dropped to 700); Sora wordmark + Plex Mono unchanged; per-script :lang() stacks re-pointed; tailwind display/logo/serif utilities re-pointed (they referenced --font-inter directly).
2. **Counterpoint palette** in editorial.css: paper #eae8e3, rust #a04b34 (action), NEW slate #1f3a4d/#2f556b (structure), NEW olive #3f6a34 (verified/positive ONLY), --ed-ochre REMOVED (12 refs re-pointed per-site semantically, not blind-renamed).
3. **Glass system**: .ed-glass family (base+strong/header/cta/popover) with BOTH fallbacks (prefers-reduced-transparency + print) built into the base; ambient static-gradient canvas (.dt-editorial::after, no filter, hidden in both fallbacks).
4. **Consumers**: sticky marketing header (+ restored its ACTUALLY-BROKEN-SINCE-MAY sticky positioning — .dt-editorial > * tied Tailwind .sticky), language popover (portal, same-element selector), EdCardGrid (+ hover-glass fix ×2 contexts + print), EdCtaBanner, FAQ + comparison panels, HeroCollage plates (+ its own citation motifs recolored olive/slate), shared/[token] folded into MarketingShell (+ citation chip AA contrast fix).
5. **Audits**: T9 fallback audit (effect-based, found+fixed a print-fallback gap), T10 integration verification (12-item, found+fixed the paper-ground killer: globals.css stitch rule `background:transparent!important` blanked --ed-paper on every MarketingShell page except landing — countered from editorial.css at 0,3,0 with !important, globals.css untouched).

## Review gates already passed
Every task had a fresh implementer + independent reviewer (several used live browsers with computed-style/CDP evidence). Criticals found+fixed in-batch: never-sticky header (prod bug since May), hover-cancels-glass specificity, missing reduced-transparency AND print hover fallbacks, hero's own rust citation motifs (law-inverse), citation chip 2.72:1 contrast, paper ground absent on all non-landing pages. tsc/lint/build clean at HEAD; per-fix browser verification with before/after computed values.

## Known-open items (deliberate, do NOT re-flag as defects)
- 6 pages have glassed EdCardGrid near hand-rolled plain .ed-card grids (owner decision pending — pre-authorized scope).
- .ed-label at ink-3 ≈3.12:1 on glass (pre-existing systemic; deferred a11y pass).
- 375px header "Sign In" wrap; shared page has never had i18n; app-surface pages (auth/dashboard/admin/Footer) still old theme — Batch 2.

## Attack surfaces
1. **Cascade/specificity warfare**: the batch adds several deliberately-escalated selectors (sticky restore 0,2,1; hover glass 0,4,1 + same-specificity order-dependent media overrides; paper-ground counter 0,3,0 !important vs app rule !important). Try to construct a state (route × media context × interaction) where the WRONG rule wins — esp. print-while-hover, reduced-transparency + hover, the paper counter on a page whose MarketingShell gains/loses classes.
2. **Scope leakage**: grep for ANY behavioral change reaching the app surface (globals.css untouched? .dt-* rules? fonts are global by design — but did the Plex/Fraunces swap or the tailwind font-utility re-point alter any APP-surface component's rendering in a breaking way, e.g. a weight-800 usage in app components now synthesizing?).
3. **The paper-ground counter**: `.dt-stitch-root > .dt-editorial { background: var(--ed-paper) !important }` — can this hit an app-surface or hybrid page (DocumentDiffPanel surface="app" mode? admin? anything that composes .dt-editorial inside .dt-stitch-root unexpectedly)?
4. **SSR/SEO**: shared/[token] metadata/noindex/fetch byte-identical claim; MarketingShell client-boundary composition unchanged; any editorial route's first-paint HTML regressed (fonts via next/font — check no layout-shift-inducing fallback change)?
5. **Fallback completeness**: T9's effect-based audit claims every translucent surface has both fallbacks — find one it missed (pseudo-elements, ::selection, box-shadow-as-glow, gradient backgrounds with alpha?).
6. **i18n/copy**: batch claims zero copy changes — verify no locale key or user-visible string changed.

Evidence to audit, not repeat: tsc/lint/build clean at HEAD; T10's 12-item report with computed-style/PDF/screenshot evidence at .superpowers/sdd/2026-08-04-liquid-glass-batch1-marketing/task-10-report.md.

Report: severity-ranked findings with file:line, overall verdict CONSENSUS-SHIP / REVISE / BLOCK.

codex
I’ll review the full `782f8b0..HEAD` range as an adversarial code audit, focusing on newly introduced regressions rather than re-reporting the owner-accepted items. I’ll first map the changed files and governing frontend rules, then trace cascade/media-state combinations, scope/SSR/i18n effects, and verify any suspected finding against HEAD before assigning the ship verdict.
  → Read frontend rules, batch plan/spec/report, and map the commit diff
  • Audit CSS cascade, fallbacks, scope leakage, fonts, SSR/SEO, and i18n
  • Validate suspected regressions with targeted static/runtime checks
  • Deliver severity-ranked findings and final verdict
exec
/bin/zsh -lc "wc -l .claude/rules/frontend.md .collab/plans/2026-08-04-liquid-glass-batch1-marketing.md docs/superpowers/specs/2026-08-03-liquid-glass-redesign-design.md .superpowers/sdd/2026-08-04-liquid-glass-batch1-marketing/task-10-report.md && sed -n '1,240p' .claude/rules/frontend.md" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
      44 .claude/rules/frontend.md
    1512 .collab/plans/2026-08-04-liquid-glass-batch1-marketing.md
      97 docs/superpowers/specs/2026-08-03-liquid-glass-redesign-design.md
     399 .superpowers/sdd/2026-08-04-liquid-glass-batch1-marketing/task-10-report.md
    2052 total
---
paths:
  - "frontend/**"
---

# Frontend Conventions

## Architecture
- **All pages are `"use client"`** — client components with server wrapper for metadata
- Pages that fetch API data must render meaningful content in loading AND error states (prevents Google Soft 404)

## API Proxy
- **ALL** frontend→backend calls go through `/api/proxy/*` route, which injects JWT. Including SSE chat stream (`sse.ts`). Missing this = 401 errors
- **JWT double-layer**: Auth.js uses encrypted JWE (unreadable by backend). Proxy creates plain HS256 JWT via `jose`. Backend `deps.py` validates exp/iat/sub
- `allowDangerousEmailAccountLinking: true` enables cross-provider auto-linking by email
- **Proxy maxDuration**: `route.ts` exports `maxDuration = 60` (Vercel Hobby limit). SSE chat 60s timeout, others 30s

## UI Design System
- **Palette (app UI)**: zinc monochrome + blue accent (`#1D4ED8`/`#60A5FA`). Zero `gray-*`/`indigo-*`/`violet-*`/`purple-*` classes (except Google OAuth brand + status colors). Zero `transition-all` (use specific properties)
- **Editorial marketing layer**: the entire public marketing surface (unauthenticated `/`, `use-cases/*`, `compare/*`, `alternatives/*`, `features/*`, `tools/*`, `pricing`, `trust`, `demo`) uses a SEPARATE scoped editorial design system — `frontend/src/app/editorial.css` (every rule under `.dt-editorial`), a warm-paper palette (`--ed-paper`/`--ed-ink`/`--ed-signal` terracotta `#b0472f`/`--ed-ochre`) with Newsreader serif + IBM Plex Mono fonts, **light-only**. It does NOT use the zinc/blue app palette. **Design decision locked 2026-05-20**: the product runs on TWO surface treatments (editorial marketing terracotta+warm-paper vs functional app zinc+blue) sharing one token base (logo, body font Inter, spacing scale, micro-interactions). A blue-accent unification was tried and reverted because the warm-paper terracotta identity is load-bearing. Do not re-propose merging the accents. Marketing pages compose the shared editorial kit in `frontend/src/components/marketing/` (`MarketingShell`, `EditorialMarketingHeader`, `EdPageHero`, `EdSection`, `EdProse`, `EdFeatureList`, `EdCardGrid`, `EdStepRow`, `EdFaqList`, `EdCtaBanner`, `EdComparisonTable`, `EdInlineCell`, `EdRelatedLinks`, `EdCheckList`, `EdChoiceList`) — `MarketingShell` supplies the `.dt-editorial` root, so kit components never add it themselves. Keep editorial styles scoped under `.dt-editorial`; do not let them leak into the functional app UI, and do not apply the zinc/blue rule to editorial components. Pages still on the zinc/blue app palette: `about`, `contact`, `imprint`, `privacy`, `terms`, `blog/*` (document-diff was editorialized in 2026-05; `DocumentDiffPanel` takes `surface="app"|"editorial"` and is the one sanctioned dual-surface component).
- **De-glass leftovers are a bug class**: commit `0b7404a` flattened the CSS but left dark-glass Tailwind utilities in JSX; ~40 invisible-on-white sites were fixed in v0.23.0. When touching app-surface JSX, any `*-white/NN` or bare `text-white`/`hover:text-white` on a light surface needs a light-mode variant (`dark:` keeps the old value). Theme-inverting solids (`bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-900`) are correct as-is.
- **i18n**: Components using `t()` MUST be inside `<LocaleProvider>`. Outside = raw key fallback. Only `en` is statically loaded; other 10 locales lazy-loaded. Localized server pages seed `<LocaleProvider initialLocale initialMessages>` (see `app/[locale]/page.tsx` + `getScopedMessages`) so SSR HTML is translated — a `[locale]` page without seeding ships English first paint (the exact failure the locale-URL program exists to fix).

## Demo Counter & Session Reuse (v0.23.0 — Codex 6-round consensus; do not re-break)
- Contract: `totalUsed = demoMessagesUsed (server count at last restore/create) + (transcript user msgs − demoRestoredUserMsgCount baseline)`. Counters reset ONLY in `useChatSession`'s documentId-keyed effect (NOT `clearDocumentTransientState` — its effect reruns on locale change and wiped the baseline).
- Anonymous demo sessions are reused via `sessionStorage["dt-demo-session:"+docId]` (helper `demoSessionStorage.ts`); pointer cleared only on 404/403; transient adoption failure sets `sessionError` and STOPS (no create fall-through).
- Failed regenerate/continue re-anchors to server truth (`GET messages` → `demo_messages_used`) guarded by sessionId AND `demoAccountingEpoch` (monotonic across `reset()`; bumped at every accounting mutation incl. A→A session switch). Late resolves are dropped, never written.

## Quote Finder UI (M2/M3)
- `QuoteFinderPanel` (reader toolbar entry; anon sees a sign-in CTA instead) + chat `quote_search` artifact + "Try Quote Finder" chip (renders when the SSE `done` event carries `quote_finder_hint`/`quote_finder_topic`; opens the panel with topic prefilled, NEVER auto-submits — searches are billed).
- Trust copy is per-kind and uses the WEAKEST kind present: word-for-word claim only for `page_text` results; `extracted_text` cards carry the amber hyphenation caveat. Do not reintroduce an unconditional verbatim claim.
- Panel resets topic/result/error/loading on every open/retarget with a generation guard (late responses from a prior open are dropped).
- Save button state must not be disabled from a cached count — the cap only blocks genuinely new saves (idempotent re-saves always succeed).

## PDF & Documents
- **react-pdf v9 CJK**: After upgrading react-pdf/pdfjs-dist, MUST re-copy `cmaps/`, `standard_fonts/`, `pdf.worker.min.mjs` to `public/`. Worker loaded from same-origin (not CDN) for CSP compliance
- **bbox coordinates**: Normalized [0,1], top-left origin. Three citation highlight strategies: ① PDF bbox, ② TextViewer text-snippet match, ③ converted PDF fallback to text-snippet when dummy bbox detected. Quote cards reuse the citation jump with chunk-level bboxes and an explicit "highlight location is approximate" label (plan §8.2).

## Subscriptions & Feature Gating
- Free (300/mo) + Plus (3K/mo, $9.99) + Pro (9K/mo, $19.99). Annual = 20% discount
- Visible modes are Flash and Pro. Internal IDs remain `quick` and `balanced`; retired modes such as `thorough` must migrate to Flash.
- Free includes Flash plus a capped number of Pro answers/month. Export: Plus+ (frontend gated). Custom Instructions: Pro (backend gated). Sessions: Free=3/doc (backend gated). Saved quotes: Free=30 active across documents (backend gated; delete frees a slot). Quote searches cost credits like a Pro (balanced) chat message. Domain Mode (legal/academic chat overlay): Plus+ (backend gated at two entry points — `chat.py`'s `chat_stream` and `extractions.py`'s `create_extraction` — both 403 `DOMAIN_MODE_REQUIRES_PLUS`).
- Credit packs: Boost(500/$3.99), Power(2K/$9.99), Ultra(5K/$19.99)
- Cancellation UI must remain self-serve. The cancel form may collect an optional reason, optional feedback, and a refund-review checkbox, but it must not block cancellation on those fields.

2026-08-04T08:53:13.484581Z ERROR codex_models_manager::manager: failed to renew cache TTL: missing field `supports_reasoning_summaries` at line 86 column 5
exec
/bin/zsh -lc "sed -n '521,1040p' .collab/plans/2026-08-04-liquid-glass-batch1-marketing.md && sed -n '1041,1540p' .collab/plans/2026-08-04-liquid-glass-batch1-marketing.md" in /Users/mayijie/Projects/Code/010_DocTalk
exec
/bin/zsh -lc "sed -n '1,520p' .collab/plans/2026-08-04-liquid-glass-batch1-marketing.md" in /Users/mayijie/Projects/Code/010_DocTalk
exec
/bin/zsh -lc "sed -n '1,220p' docs/superpowers/specs/2026-08-03-liquid-glass-redesign-design.md && sed -n '1,450p' .superpowers/sdd/2026-08-04-liquid-glass-batch1-marketing/task-10-report.md" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
# DocTalk Liquid Glass Redesign — Batch 1 (Marketing) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the Counterpoint palette + Apple-style Liquid Glass material to the entire editorial marketing surface (`.dt-editorial`-scoped: landing, use-cases, compare/alternatives, features, tools, pricing, trust, demo, and every other page that already renders through `MarketingShell`) plus the `shared/[token]` public share page, without touching the functional app surface (`globals.css` `.dt-*`, reader/chat/dashboard/admin/auth/Footer — that's Batch 2).

**Architecture:** New CSS custom properties (palette + glass material tokens) land in `editorial.css`'s `.dt-editorial` `:root` block first. A small set of new glass *utility classes* (`.ed-glass`, `.ed-glass--strong`, `.ed-glass--header`, `.ed-glass--cta`, `.ed-glass--popover`) consume those tokens and carry their own `prefers-reduced-transparency`/`@media print` fallbacks — glass is **always** applied via className, never inline `style={{backdropFilter}}`, because the fallback media queries cannot be expressed through React inline styles. Named marketing-kit components (header, language selector, card grid, CTA banner, FAQ, comparison table, hero collage) then opt into those classes one at a time. An ambient gradient layer is added as `.dt-editorial::after` (matching the existing paper-grain `::before` pattern) so glass has something visually interesting to blur. `shared/[token]/page.tsx` is rewired from raw zinc/blue Tailwind onto `MarketingShell` + editorial tokens last, since it depends on the header/footer/glass work being done first.

**Tech Stack:** Next.js 14 App Router, `next/font/google` (Fraunces, IBM Plex Sans, IBM Plex Mono, Sora), plain CSS custom properties in `editorial.css`/`globals.css` (no CSS-in-JS), Tailwind utility classes for layout only.

## Global Constraints

- **Palette migration** (`.dt-editorial` `:root` in `frontend/src/app/editorial.css`), exact hex values from spec §2.2:
  | token | old | new |
  |---|---|---|
  | `--ed-paper` | `#f3eee1` | `#eae8e3` |
  | `--ed-paper-2` | `#e9e1cf` | `#e4e2db` |
  | `--ed-ink` | `#1c1b19` | `#20211e` |
  | `--ed-ink-2` | `#48443b` | `#5b5a52` |
  | `--ed-ink-3` | `#6e6860` | `#8a897f` |
  | `--ed-signal` | `#b0472f` | `#a04b34` |
  | `--ed-signal-deep` | `#8f3a26` | `#843c28` |
  | `--ed-ochre` | `#c08a3e` | **removed** — replaced by `--ed-slate: #1f3a4d` + `--ed-slate-2: #2f556b` |
  | — | — | `--ed-olive: #3f6a34` (new; verified/positive ONLY) |
  | `--ed-rule` | `#d3c9b3` | `rgba(32,33,30,.12)` |

  Semantics (spec §2.2): rust (`--ed-signal`) = action (primary CTA, brand mark, feature eyebrows); slate (`--ed-slate`/`--ed-slate-2`) = structure (links, secondary CTA, quote borders, nav hover, decorative set-dressing); olive (`--ed-olive`) = verified/positive state ONLY — do not use it for anything else.
- **Glass material tokens** (warm, spec §2.3), exact values, added to the same `:root` block:
  ```
  --ed-glass: rgba(250,249,246,.55);  --ed-glass-strong: rgba(251,250,247,.85);
  --ed-glass-blur: blur(22px) saturate(150%);  --ed-glass-line: rgba(32,33,30,.12);
  --ed-glass-hi: inset 0 1px 0 rgba(255,255,255,.82);  --ed-glass-shadow: 0 18px 44px -18px rgba(30,25,20,.32);
  --ed-radius: 22px;
  ```
- **Glass is chrome, not content** (spec §1). `EdProse`, article body, `EdSection` text blocks, and any component that renders actual document/quote text (e.g. `DocumentDiffPanel`'s citation excerpt cards) stay SOLID. Never add `backdrop-filter` to those.
- **Every glass rule ships both fallbacks** (spec §1, §6): `prefers-reduced-transparency: reduce` → solid, `@media print` → solid. Both fallbacks live inside the single `.ed-glass` base rule so every consumer inherits them automatically — do not hand-roll `backdrop-filter` anywhere else in `editorial.css` or component files.
- **Type migration** (spec §2.1): `Newsreader` → `Fraunces` (true variable font, `opsz` + `SOFT` axes, normal+italic styles) → CSS var renamed `--font-fraunces`; `Inter` → `IBM Plex Sans` (static weights 400/500/600/700 — IBM Plex Sans has no 800 weight, so `.ed-display`'s `font-weight: 800` must drop to `700`, the family's heaviest true cut) → CSS var renamed `--font-plex-sans`. `Sora` (wordmark) and `IBM Plex Mono` are unchanged. Per-script `:lang()` stacks in `globals.css` swap every `var(--font-inter)` reference to `var(--font-plex-sans)` but keep the existing CJK/Arabic/Devanagari system-font fallback chains untouched.
- **Ambient canvas** (spec §3): static, asymmetric, low-alpha radial gradients only — `filter: blur` is forbidden for the ambient layer (perf). Hidden under `prefers-reduced-transparency: reduce` and `@media print`.
- **Perf red-lines** (spec §1): no `backdrop-filter` on anything that streams or reflows frequently. Nothing in this batch touches SSE chat, PdfViewer, or admin charts (those are Batch 2/app-scope), so this mostly matters for future-proofing: comparison tables and FAQ panels in this batch are static, not frequently-reflowing, so glass on them is fine.
- **Scope boundary — do NOT touch**: `frontend/src/app/globals.css` `.dt-*` rules, `.dt-workbench-*` tokens, reader/chat/dashboard/collections/profile/billing/admin/auth pages, `frontend/src/components/Footer.tsx` (app footer). Those are Batch 2. `frontend/src/components/landing/EditorialFooter.tsx` (the *marketing* footer) is also left solid in this batch — it is not sticky chrome and spec §4.1's named glass list does not include it.
- **i18n**: no copy/translation-key changes in this batch (palette/font/glass are non-text). If any task turns out to need new copy, it must ship in all 11 locales (en/zh/ja/ko/es/de/fr/pt/it/ar/hi) with flat dotted keys — but no task below requires this.
- **Build hygiene** (CLAUDE.md, project memory): `npm run build` must NEVER run while `npm run dev` is active — it overwrites `.next/` and kills the live dev server's static chunks. Check `lsof -i :3000` or ask before running build.
- **Commits**: one commit per task, message ends with `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.

---

## Task 1: Type migration — Fraunces + IBM Plex Sans

**Files:**
- Modify: `frontend/src/app/layout.tsx`
- Modify: `frontend/src/app/globals.css:1-45`
- Modify: `frontend/src/app/editorial.css:56-63,125-138`
- Modify: `frontend/src/app/demo/DemoPageClient.tsx:238`
- Modify: `frontend/tailwind.config.ts:12-21`

**Interfaces:**
- Produces: CSS custom properties `--font-fraunces`, `--font-plex-sans` (consumed by `--dt-serif`/`--dt-body` in `globals.css`, which every later task relies on for correct typography). `--font-logo` (Sora) and `--font-plex-mono` (IBM Plex Mono) are unchanged.

- [ ] **Step 1: Swap the font imports in `layout.tsx`**

Replace:
```ts
import { Inter, Sora, Newsreader, IBM_Plex_Mono } from 'next/font/google'
```
with:
```ts
import { IBM_Plex_Sans, Sora, Fraunces, IBM_Plex_Mono } from 'next/font/google'
```

- [ ] **Step 2: Replace the `inter` and `newsreader` font consts**

Replace:
```ts
const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' })
```
with:
```ts
const plexSans = IBM_Plex_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-plex-sans',
  display: 'swap',
})
```

Replace:
```ts
const newsreader = Newsreader({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-newsreader',
  display: 'swap',
})
```
with:
```ts
const fraunces = Fraunces({
  subsets: ['latin'],
  style: ['normal', 'italic'],
  axes: ['opsz', 'SOFT'],
  variable: '--font-fraunces',
  display: 'swap',
})
```

Leave the `sora` and `plexMono` consts untouched.

- [ ] **Step 3: Update the `<html className>` variable list**

Replace:
```tsx
<html lang="en" suppressHydrationWarning className={`${inter.variable} ${sora.variable} ${newsreader.variable} ${plexMono.variable}`}>
```
with:
```tsx
<html lang="en" suppressHydrationWarning className={`${plexSans.variable} ${sora.variable} ${fraunces.variable} ${plexMono.variable}`}>
```

- [ ] **Step 4: Update `globals.css`'s font token block and its stale comment**

Replace the comment block (lines 5-15) — the line `Latin keeps the loaded webfonts (Inter / Newsreader / IBM Plex Mono).` — with:
```
   Latin keeps the loaded webfonts (IBM Plex Sans / Fraunces / IBM Plex Mono).
```

Replace:
```css
:root {
  --dt-serif: var(--font-newsreader), Georgia, serif;          /* editorial headlines (Latin serif) */
  --dt-mono:  var(--font-plex-mono), ui-monospace, monospace;  /* editorial/code labels */
  --dt-body:  var(--font-inter), system-ui, sans-serif;        /* body / app UI */
}
```
with:
```css
:root {
  --dt-serif: var(--font-fraunces), Georgia, serif;            /* editorial headlines (Latin serif) */
  --dt-mono:  var(--font-plex-mono), ui-monospace, monospace;  /* editorial/code labels */
  --dt-body:  var(--font-plex-sans), system-ui, sans-serif;    /* body / app UI */
}
```

- [ ] **Step 5: Swap `var(--font-inter)` → `var(--font-plex-sans)` in every `:lang()` block**

In each of the five `html:lang(zh|ja|ko|ar|hi)` blocks, both the `--dt-serif` and `--dt-body` lines start with `var(--font-inter), ` — replace that prefix with `var(--font-plex-sans), ` in all 10 lines (the CJK/Arabic/Devanagari system-font fallback lists after it are unchanged). Example for `zh`:
```css
html:lang(zh) {
  --dt-serif: var(--font-plex-sans), "PingFang SC", "HarmonyOS Sans SC", "Microsoft YaHei", "Noto Sans SC", sans-serif;
  --dt-mono:  var(--font-plex-mono), "PingFang SC", "Microsoft YaHei", "Noto Sans SC", sans-serif;
  --dt-body:  var(--font-plex-sans), "PingFang SC", "HarmonyOS Sans SC", "Microsoft YaHei", "Noto Sans SC", system-ui, sans-serif;
}
```
Apply the same `var(--font-inter)` → `var(--font-plex-sans)` substitution to `ja`, `ko`, `ar`, `hi` (the `--dt-mono` line in each block already uses `var(--font-plex-mono)` and needs no change).

- [ ] **Step 6: Fix `.ed-cta`'s direct font-family reference in `editorial.css`**

Replace:
```css
.dt-editorial .ed-cta {
  ...
  font-family: var(--font-inter), sans-serif;
```
with:
```css
.dt-editorial .ed-cta {
  ...
  font-family: var(--font-plex-sans), sans-serif;
```

- [ ] **Step 7: Drop `.ed-display`'s font-weight from 800 to 700**

IBM Plex Sans ships no 800 weight; requesting `font-weight: 800` against a family whose heaviest loaded face is 700 leaves rendering weight up to browser font-matching/synthesis, which is inconsistent across browsers. Replace:
```css
.dt-editorial .ed-display {
  font-family: var(--dt-body);
  font-weight: 800;
```
with:
```css
.dt-editorial .ed-display {
  font-family: var(--dt-body);
  font-weight: 700;
```

- [ ] **Step 8: Fix the remaining direct `var(--font-inter)` reference in `DemoPageClient.tsx`**

At line 238, replace:
```ts
fontFamily: 'var(--font-inter), sans-serif',
```
with:
```ts
fontFamily: 'var(--font-plex-sans), sans-serif',
```

- [ ] **Step 9: Fix `tailwind.config.ts`'s `display`/`logo`/`serif` fallback chains**

These three Tailwind `fontFamily` entries reference `var(--font-inter)` directly (not through `--dt-body`). Since the `Inter` font object is removed from `layout.tsx` in Step 2, `--font-inter` will no longer be defined anywhere — leaving these as-is makes `font-family: var(--font-logo), var(--font-inter), ...` invalid at computed-value time (an undefined custom property with no `var()` fallback invalidates the whole declaration), which would silently break the `font-logo`/`font-display`/`font-serif` Tailwind utility classes used by the wordmark across `PublicHeader.tsx`, `AppHeaderShell.tsx`, `Footer.tsx`, `auth/*`, `profile/*`, `collections/*`, `billing/*` — i.e. app-surface pages, not just editorial. This must be fixed here even though it's technically Batch-2 surface, because `tailwind.config.ts` is a single shared file and Batch 1 is what removes `--font-inter`. Replace all three occurrences of `var(--font-inter)` with `var(--font-plex-sans)`:
```ts
fontFamily: {
  // --dt-body = IBM Plex Sans for Latin, + curated system CJK/Arabic/Devanagari
  // stacks under :lang() (see globals.css). Latin output is unchanged.
  sans: ['var(--dt-body)'],
  display: ['var(--font-logo)', 'var(--font-plex-sans)', 'system-ui', 'sans-serif'],
  logo: ['var(--font-logo)', 'var(--font-plex-sans)', 'system-ui', 'sans-serif'],
  // Legacy alias: older pages still use `font-serif`, but the
  // Stitch direction is rounded sans display type, not editorial serif.
  serif: ['var(--font-logo)', 'var(--font-plex-sans)', 'system-ui', 'sans-serif'],
},
```

- [ ] **Step 10: Confirm no dev server is running, then typecheck + lint + build**

```bash
lsof -i :3000 || true
cd frontend && npx tsc --noEmit
cd frontend && npx next lint --quiet
cd frontend && npm run build
```
Expected: all three commands exit 0. `npm run build` must not be run if Step 10's `lsof` shows a process bound to :3000 (a live dev server) — stop and ask instead.

- [ ] **Step 11: Manual visual check**

Start `cd frontend && npm run dev`, open `http://localhost:3000/` and `http://localhost:3000/pricing`. Confirm: landing headline renders in Fraunces (a soft, warm serif — not the old Newsreader), body copy renders in IBM Plex Sans (visibly different from Inter — more geometric, taller x-height), the wordmark ("DocTalk" logo text next to the icon) still renders correctly via Sora, and `.ed-display`'s hero headline weight looks solid/bold (not thin) — confirming the 700 fallback reads correctly. Also open `/auth` and confirm the wordmark there still renders (validates the `tailwind.config.ts` fix from Step 9 didn't break `font-logo`).

- [ ] **Step 12: Commit**

```bash
cd /Users/mayijie/Projects/Code/010_DocTalk
git add frontend/src/app/layout.tsx frontend/src/app/globals.css frontend/src/app/editorial.css \
  frontend/src/app/demo/DemoPageClient.tsx frontend/tailwind.config.ts
git commit -m "$(cat <<'EOF'
feat(glass): migrate editorial/UI type to Fraunces + IBM Plex Sans

Newsreader -> Fraunces (variable, opsz+SOFT axes) drives --dt-serif;
Inter -> IBM Plex Sans (static 400-700, no 800 cut so .ed-display drops
to 700) drives --dt-body. Re-points every direct var(--font-inter)
reference (globals.css :lang() stacks, editorial.css .ed-cta, demo page,
tailwind.config.ts font-logo/display/serif) so nothing silently breaks
when the Inter font object is removed. First step of the Liquid Glass
Batch 1 marketing redesign.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Counterpoint palette migration — tokens + all `--ed-ochre` call sites

**Files:**
- Modify: `frontend/src/app/editorial.css:1-19`
- Modify: `frontend/src/app/demo/DemoPageClient.tsx:126`
- Modify: `frontend/src/app/tools/reading-time/ReadingTimeClient.tsx:298`
- Modify: `frontend/src/app/trust/TrustPageContent.tsx:211,277,285`
- Modify: `frontend/src/components/landing/HeroCollage.tsx:32,86,190`
- Modify: `frontend/src/components/Diff/DocumentDiffPanel.tsx:408,455`
- Modify: `frontend/src/components/marketing/EdInlineCell.tsx:55`

**Interfaces:**
- Consumes: nothing from Task 1.
- Produces: CSS custom properties `--ed-slate`, `--ed-slate-2`, `--ed-olive` (consumed by Task 7's `VisualCitations` recolor and available to any later task). `--ed-ochre` no longer exists anywhere in the codebase after this task — grepping for it must return zero hits.

`--ed-ochre` has exactly 11 consumer sites (verified by `grep -rn "ed-ochre" frontend/src`) plus its own definition. Each is re-pointed deliberately per the new rust/slate/olive semantics (spec §2.2), not blindly search-replaced:

| Site | Current use | New token | Why |
|---|---|---|---|
| `DemoPageClient.tsx:126` | error message text color | `--ed-signal-deep` | it's an error state; matches the existing error-text convention used elsewhere (e.g. `DocumentDiffPanel`'s error block) |
| `ReadingTimeClient.tsx:298` | progress-bar fill (decorative data viz) | `--ed-slate-2` | neutral secondary-accent fill, not action/error/verified |
| `TrustPageContent.tsx:211` | disclaimer/caution text | `--ed-signal-deep` | cautionary copy, same bucket as the demo error text |
| `TrustPageContent.tsx:277` | "gap" status label text | `--ed-slate` | a coverage gap is neither an action nor a verified/positive state — informational structure |
| `TrustPageContent.tsx:285` | "gap" status dot (paired with 277) | `--ed-slate` | same status indicator, must match its label |
| `HeroCollage.tsx:32` | decorative background rectangle | `--ed-slate` | pure set-dressing; balances the warm rust elsewhere in the collage with a cool structural tone |
| `HeroCollage.tsx:86` | decorative oversized "§" glyph | `--ed-slate` | pure set-dressing, same rationale as the rectangle |
| `HeroCollage.tsx:190` | "Amber/signal highlight band" behind mock citation text | `--ed-signal` | comment explicitly names it a signal highlight; keeps the citation-emphasis metaphor on the action color |
| `DocumentDiffPanel.tsx:408` | paywall/upsell notice border | `--ed-slate` | an upsell notice is informational, not an error (the true error block below it already uses `--ed-signal`) — slate keeps them visually distinct |
| `DocumentDiffPanel.tsx:455` | pending-run `Clock3` icon | `--ed-slate` | neutral "not yet complete" status (the succeeded state already uses `--ed-signal` — left as-is, out of scope for this token swap) |
| `EdInlineCell.tsx:55` | comparison-table "partial" marker | `--ed-slate` | a partial/in-between state is structural, not positive (`true` stays `--ed-signal`, `false` stays `--ed-ink-3`, both out of scope for this token swap) |

- [ ] **Step 1: Replace the `:root` token block in `editorial.css`**

Replace:
```css
.dt-editorial {
  --ed-paper: #f3eee1;
  --ed-paper-2: #e9e1cf;
  --ed-ink: #1c1b19;
  --ed-ink-2: #48443b;
  --ed-ink-3: #6e6860;
  --ed-signal: #b0472f;
  --ed-signal-deep: #8f3a26;
  --ed-ochre: #c08a3e;
  --ed-rule: #d3c9b3;

  position: relative;
  background: var(--ed-paper);
  color: var(--ed-ink-2);
  font-family: var(--dt-body);
  -webkit-font-smoothing: antialiased;
}
```
with:
```css
.dt-editorial {
  /* Counterpoint palette (2026-08-04 redesign). Two accents, not one:
     rust = action (primary CTA, brand mark, feature eyebrows), slate =
     structure (links, secondary CTA, quote borders, nav hover, decorative
     set-dressing), olive = verified/positive state ONLY. */
  --ed-paper: #eae8e3;
  --ed-paper-2: #e4e2db;
  --ed-ink: #20211e;
  --ed-ink-2: #5b5a52;
  --ed-ink-3: #8a897f;
  --ed-signal: #a04b34;
  --ed-signal-deep: #843c28;
  --ed-slate: #1f3a4d;
  --ed-slate-2: #2f556b;
  --ed-olive: #3f6a34;
  --ed-rule: rgba(32, 33, 30, 0.12);

  /* Glass material tokens (warm, Ocean v5 recipe — spec §2.3). Consumed by
     the .ed-glass utility classes below; never reference these directly
     from a component's inline style (fallbacks require @media, which
     inline styles cannot express). */
  --ed-glass: rgba(250, 249, 246, 0.55);
  --ed-glass-strong: rgba(251, 250, 247, 0.85);
  --ed-glass-blur: blur(22px) saturate(150%);
  --ed-glass-line: rgba(32, 33, 30, 0.12);
  --ed-glass-hi: inset 0 1px 0 rgba(255, 255, 255, 0.82);
  --ed-glass-shadow: 0 18px 44px -18px rgba(30, 25, 20, 0.32);
  --ed-radius: 22px;

  position: relative;
  background: var(--ed-paper);
  color: var(--ed-ink-2);
  font-family: var(--dt-body);
  -webkit-font-smoothing: antialiased;
}
```

- [ ] **Step 2: Re-point `DemoPageClient.tsx:126`**

Replace:
```tsx
<span className="ed-body" style={{ color: 'var(--ed-ochre)' }}>
```
with:
```tsx
<span className="ed-body" style={{ color: 'var(--ed-signal-deep)' }}>
```

- [ ] **Step 3: Re-point `ReadingTimeClient.tsx:298`**

Replace:
```tsx
                          background: 'var(--ed-ochre)',
```
with:
```tsx
                          background: 'var(--ed-slate-2)',
```

- [ ] **Step 4: Re-point `TrustPageContent.tsx:211,277,285`**

At line 211, replace:
```tsx
            color: "var(--ed-ochre)",
          }}
        >
          {t("trust.summary.disclaimer")}
```
with:
```tsx
            color: "var(--ed-signal-deep)",
          }}
        >
          {t("trust.summary.disclaimer")}
```

At line 277 (the gap status label), replace:
```tsx
                    color: "var(--ed-ochre)",
                  }}
                >
                  <span
                    aria-hidden
                    style={{
                      width: "5px",
                      height: "5px",
                      background: "var(--ed-ochre)",
```
with:
```tsx
                    color: "var(--ed-slate)",
                  }}
                >
                  <span
                    aria-hidden
                    style={{
                      width: "5px",
                      height: "5px",
                      background: "var(--ed-slate)",
```

- [ ] **Step 5: Re-point `HeroCollage.tsx:32,86,190`**

At line 32 (background rectangle), replace:
```tsx
            background: "var(--ed-ochre)",
            opacity: 0.18,
          }}
        />

        {/* ── Halftone dot block — bottom-left corner ── */}
```
with:
```tsx
            background: "var(--ed-slate)",
            opacity: 0.18,
          }}
        />

        {/* ── Halftone dot block — bottom-left corner ── */}
```

At line 86 (oversized "§" glyph), replace:
```tsx
            color: "var(--ed-ochre)",
            opacity: 0.12,
```
with:
```tsx
            color: "var(--ed-slate)",
            opacity: 0.12,
```

At line 190 ("Amber/signal highlight band"), replace:
```tsx
                background: "var(--ed-ochre)",
                opacity: 0.18,
                borderRadius: "1px",
              }}
            />
            <div
              style={{
                height: "7px",
                background: "var(--ed-ink-2)",
```
with:
```tsx
                background: "var(--ed-signal)",
                opacity: 0.18,
                borderRadius: "1px",
              }}
            />
            <div
              style={{
                height: "7px",
                background: "var(--ed-ink-2)",
```

- [ ] **Step 6: Re-point `DocumentDiffPanel.tsx:408,455`**

At line 408 (paywall notice border), replace:
```tsx
                border: "1px solid var(--ed-ochre)",
```
with:
```tsx
                border: "1px solid var(--ed-slate)",
```

At line 455 (pending `Clock3` icon), replace:
```tsx
                    <Clock3 size={16} style={{ color: "var(--ed-ochre)" }} aria-hidden="true" />
```
with:
```tsx
                    <Clock3 size={16} style={{ color: "var(--ed-slate)" }} aria-hidden="true" />
```

- [ ] **Step 7: Re-point `EdInlineCell.tsx:55`**

Replace:
```tsx
          color: "var(--ed-ochre)",
        }}
      >
        ~ {t("comparison.partial")}
```
with:
```tsx
          color: "var(--ed-slate)",
        }}
      >
        ~ {t("comparison.partial")}
```

- [ ] **Step 8: Verify zero remaining `--ed-ochre` references**

```bash
grep -rn "ed-ochre" frontend/src
```
Expected: no output.

- [ ] **Step 9: Typecheck + lint + build**

```bash
lsof -i :3000 || true
cd frontend && npx tsc --noEmit
cd frontend && npx next lint --quiet
cd frontend && npm run build
```
Expected: all exit 0.

- [ ] **Step 10: Manual visual check**

`cd frontend && npm run dev`, open `/`, `/demo`, `/trust`, `/tools/reading-time`, `/features/citations` (which renders `EdComparisonTable` → `EdInlineCell`'s "partial" marker), and `/document-diff` (sign in first — it redirects unauthenticated visitors to `/auth`). Confirm: overall paper tone reads slightly cooler/greyer than before (not the old cream), rust CTAs are a touch deeper/less orange, and every former ochre/amber accent (demo error text, reading-time progress bar, trust disclaimer + gap dots, hero collage stripe/glyph, document-diff paywall border) now renders in its new color with no invisible/transparent elements (that would indicate a typo'd token name).


 succeeded in 0ms:
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
# Task 10 — Integration verification report

**Verified at:** HEAD `5077420` (branch `main`), 2026-08-04
**Status:** PASS_WITH_FINDINGS
**Code changes made:** none (verification only; `git status` clean throughout)

**Method.** `:3000` confirmed free, then `npm run dev`. Deterministic checks
(computed styles, geometry, media emulation, overflow math, frame timing) were
driven through the repo's local Playwright 1.59 + headless Chromium, which gives
exact 1440/375 viewports and CDP `Emulation.setEmulatedMedia` for
`prefers-reduced-transparency` — the attached Chrome window could not be resized
past 518x575 CSS px, so it was not usable as the measurement surface. Dev server
and the temporary stub backend were killed afterwards (both ports confirmed
free) and `npm run build` run as the final static gate.

Artifacts (screenshots, sweep JSON, print PDFs) are in the session scratchpad at
`…/9d08fc9c-9067-4808-948d-fc479fdcb547/scratchpad/shots/`.

---

## Findings summary

| # | Severity | New in Batch 1? | Summary |
|---|---|---|---|
| F1 | **High impact** | No — pre-existing | `.dt-stitch-root > .min-h-screen{background:transparent!important}` kills `--ed-paper` on every `MarketingShell` page |
| F2 | Low | **Yes** (Task 6) | FAQ glass panel draws a doubled hairline at its top and bottom edge |
| F3 | Low | No — pre-existing | Sticky header paints mid-page in print output |
| F4 | Info / decision | Pre-authorized (Task 5) | Glassed `EdCardGrid` sits next to plain `.ed-card` grids on 6 pages |
| F5 | Info / documented | No — pre-existing | `.ed-label` at `--ed-ink-3` on glass grounds (~3.12:1) |
| F6 | Info | No — pre-existing | 375px header wraps "Sign In" onto 3 lines |
| F7 | Info / environment | n/a | `/demo` logs a 502 locally (backend not running) |

Counts: **1 high-impact, 2 low, 4 informational.** Exactly one finding (F2) was
introduced by this batch; it is cosmetic.

---

## F1 — `--ed-paper` never reaches the MarketingShell surface (high impact, pre-existing)

The entire marketing surface **except the landing page** renders on the app
surface's near-white `#fafafa` instead of the Counterpoint warm paper
`--ed-paper #eae8e3`.

**Cause.** `frontend/src/app/globals.css:819-826`:

```css
.dt-stitch-root > .min-h-screen,
.dt-stitch-root > main.min-h-screen,
… { background: transparent !important; }
```

`frontend/src/components/marketing/MarketingShell.tsx:23` renders
`<div className="dt-editorial min-h-screen flex flex-col">` as a direct child of
`.dt-stitch-root`, so the `!important` rule beats `.dt-editorial`'s
`background: var(--ed-paper)` (`editorial.css:33`). `LandingPageContent.tsx:26`
uses a bare `<div className="dt-editorial">` with no `min-h-screen`, which is why
the landing page — the one page everyone has been eyeballing all batch — looks
correct and the rest do not.

**Evidence.** Computed `background-color` of the `.dt-editorial` root:
`rgb(234, 232, 227)` on `/`, but `rgba(0, 0, 0, 0)` on `/pricing` and
`/shared/<token>`, falling through to `body` `rgb(250, 250, 250)`. CDP
`CSS.getMatchedStylesForNode` confirms both rules match and the `!important` one
wins. Side-by-side: `finding_paper_ASIS.png` vs `finding_paper_PATCHED.png`
(the latter with a one-line override applied at runtime).

**Not a Batch-1 regression.** Both halves predate the batch: the globals rule is
present at `00c5722~1`, and `MarketingShell` already carried `min-h-screen`
there. Batch 1 changed the *value* of `--ed-paper`, not whether it applies.

**Why it still matters here.** The glass material (`--ed-glass`
`rgba(250,249,246,0.55)`) and the ambient canvas were tuned to sit on the warm
paper. On `#fafafa` the glass is nearly the same colour as its ground, so the
panels read washed-out on every page except the landing — the batch's central
visual effect is largely invisible where most of the marketing traffic lands.
The candidate fix is one line, but it touches a shared app-surface rule, so it
is the controller's call, not mine.

## F2 — FAQ panel doubles its own edge rule (low, introduced by Task 6)

`EdFaqList.tsx:32` wraps the list in `.ed-glass` with `padding: "6px 28px"`,
while every row still draws its own `borderTop` (and the last row a
`borderBottom`) at `EdFaqList.tsx:88-91`. The first row's top hairline therefore
sits 6px inside the panel's own 1px border, and the last row's bottom hairline
6px above it — and because of the 28px horizontal padding the hairline is
*shorter* than the panel edge, so it reads as a stray floating rule rather than
a deliberate divider.

Evidence: `item2_faq_topedge_zoom.png`, `item2_faq_botedge_zoom.png`. Before the
glass wrapper existed, those rules correctly delimited the list; the panel border
now does that job. Candidate fix: suppress `borderTop` on `index === 0` and the
last row's `borderBottom`.

## F3 — sticky header prints mid-page (low, pre-existing)

`EditorialHeaderBase.tsx:63` is `sticky top-0 z-50` and `editorial.css` has no
`@media print` position reset. In print output the masthead paints wherever the
viewport was scrolled to — in `item9_print__features_citations.pdf` page 4 it
lands across the middle of the comparison table, between two rows.

Pre-existing: `sticky top-0 z-50` is present at `00c5722~1`; the batch only
appended glass classes to that same element. Scroll-position dependent (printing
from the top of the page puts it in the right place). Candidate fix:
`@media print { .dt-editorial > header.ed-glass--header { position: static; } }`.

## F4 — glass vs plain card languages on the same page (info, pre-authorized)

Captured for the owner's wrap-up decision as requested. On `/pricing`:

- Glassed `EdCardGrid` credit-guide cards at y≈917 — 22px radius, drop shadow,
  `rgba(250,249,246,0.55)` + `blur(22px) saturate(1.5)`.
- Hand-rolled plan cards at y≈1251 — 0px radius, flat `rgb(228,226,219)`,
  hairline border, no shadow, no backdrop filter.

~330px apart on the same page, so both are visible in one screenful. Evidence:
`item6_pricing_adjacency.png`. Not broken; it is a design-consistency call across
the six pages Task 5 flagged.

## F5 — `.ed-label` contrast on glass grounds (info, documented only, no fix)

Instances on `/features/citations`: 5, all inside the comparison-table glass
panel's header row — `FEATURE`, `CHATPDF`, `ASKYOURPDF`, `HUMATA` at
`rgb(138,137,127)` (`--ed-ink-3`), plus `DOCTALK` at `rgb(160,75,52)`
(`--ed-signal`, unaffected). The same header-row pattern repeats on every
`compare/*` and `alternatives/*` page that renders `EdComparisonTable`, and on
`/pricing`. Pre-existing token-level contrast, unchanged by this batch — logged
for a later accessibility pass as instructed.

---

## Per-item verdicts

**1. Real glyph rendering — PASS.** Computed families on `/`, with all faces
reported `loaded` by `document.fonts`:

| Element | Family | Weight / style |
|---|---|---|
| `h1.ed-display` | IBM Plex Sans | 700 normal, 88px |
| `h1 > em` | Fraunces | 500 **italic** |
| `.ed-h2` / `.ed-h3` | Fraunces | 400 / 500 |
| `.ed-body` | IBM Plex Sans | 400 |
| `.ed-label` / `.ed-caption` | IBM Plex Mono | 400 |

`.ed-display` is solid at **700**, not synthesised — the 800 request was
correctly dropped. Visually confirmed in `item1_headline_glyphs.png` (warm serif
italic against the heavy grotesque).

*Wordmark clarification:* the **editorial** wordmark computes Fraunces 500, not
Sora. This is correct, not a defect — `EditorialHeaderBase.tsx:76` has always
used `font-family: var(--dt-serif)`, and the batch only re-pointed `--dt-serif`
from Newsreader to Fraunces; that line is unchanged in the batch diff. Sora is
still intact for the **app** surface: on `/auth` the wordmark computes
`__Sora_f78264` weight 600, `loaded`, via the still-wired `--font-logo` →
`font-logo` Tailwind chain. Sora simply shows as `unloaded` on marketing pages
because nothing there requests it.

**2. FAQ 28px inset — PASS (intentional), with F2 nit.** The panel's outer edge
sits at x=160, exactly flush with every `.ed-h2` section title on the page
(all measured at 160). The 28px is ordinary internal card padding, putting the
question number at 189 and the question text at 218. That is the correct,
conventional card treatment — not a misalignment. The genuine nit is the doubled
edge rule (F2), which is a different defect from the one the deferral
anticipated. Evidence: `item2_faq_context_1440.png`.

**3. Comparison-table DocTalk column — PASS (acceptable).** The DocTalk column
is solid `rgb(228,226,219)` (`--ed-paper-2`) inside the `rgba(250,249,246,0.55)`
glass panel; sibling cells are fully transparent. Rendered, it reads as
deliberate column emphasis — a conventional comparison-table device — and the
paper-2/glass delta is small enough that it does not fight the panel. Not
jarring; no change recommended. Evidence: `item3_table_panel.png`.

**4. `.ed-label` on glass — documented, no fix.** See F5.

**5. 375px responsive sweep — PASS.** Zero page-level horizontal overflow on all
21 routes (`scrollWidth === clientWidth === 375` everywhere). The comparison
table scrolls *inside* its glass panel exactly as intended: panel width 335,
inner scroller `overflow-x: auto` with `scrollWidth` 600 vs `clientWidth` 325;
driving `scrollLeft = 9999` moved the inner scroller to 155 while `window.scrollX`
stayed 0 and the page never overflowed. Hero plates stay inside the viewport
(right edges 339 and 353 against a 375 viewport); header and cards render sanely.
Evidence: `item5_375_*.png`.

**6. Glass vs plain card grids — captured.** See F4 and
`item6_pricing_adjacency.png`.

**7. Hero plates blur — PASS, proven not assumed.** Both rotated plates are real
glass: `transform` matrices ≈ −2.8° and +2.2°, each with
`backdrop-filter: blur(22px) saturate(1.5)`. To prove they *sample* rather than
merely declare, I injected a hard 6px black/white stripe pattern behind the hero
and shot the same clip twice — `item7_blurtest_ON.png` (stripes completely
dissolved into flat grey under the plates, still crisp outside them) versus
`item7_blurtest_OFF.png` with `backdrop-filter` forced to `none` (stripes show
through razor-sharp). Unambiguous.

**8. `prefers-reduced-transparency: reduce` — PASS.** On `/`, `/features/citations`,
`/pricing` and `/shared/<token>`: every `.ed-glass` element (3, 7, 4 and 1
respectively — header, cards, CTA, popover, FAQ panel, table panel, hero plates)
collapses to a single flat `rgb(228,226,219)` with `backdrop-filter: none`, and
the ambient `::after` computes `display: none`. Hover fallback verified on
`a.ed-card.ed-glass` at `/features/citations`: under `reduce` it goes
`rgb(228,226,219)` → `rgb(234,232,227)` with `border-color rgb(138,137,127)` and
`backdrop-filter: none` — the classic paper hover, no glass-strong. Control run
without the media feature confirms the glass hover path is what `reduce`
replaces. Evidence: `item8_rt_*.png`.

**9. Print — PASS, with F3.** Under emulated print media all glass flattens to
`rgb(228,226,219)`, `backdrop-filter: none`, ambient `display: none`. Real PDFs
render the FAQ panel, comparison table and card grids as flat solid panels —
fully readable, no blur artifacts, no black-box fills. The Task 9 hovered-card
print rule behaves: a card hovered *before* switching to print media prints at
`rgb(228,226,219)` with `border rgba(32,33,30,0.12)`, i.e. the hover state does
not leak into print. The one blemish is the sticky masthead (F3). Evidence:
`item9_print_*.pdf` / `.png`.

**10. Route sweep — PASS.** 21 routes at both 1440 and 375, all HTTP 200 (except
the deliberate bogus-token 404), all rendering substantial content, `.dt-editorial`
present, zero console or page errors anywhere except the two explained below:

`/`, `/use-cases`, `/use-cases/lawyers`, `/compare`, `/compare/chatpdf`,
`/alternatives`, `/alternatives/humata`, `/features`, `/features/citations`,
`/features/multi-format`, `/tools`, `/tools/reading-time`, `/pricing`, `/trust`,
`/demo`, `/document-diff`, `/blog`, `/privacy`, `/ja/pricing`,
`/ja/features/citations`, `/shared/…`.

- **Localized routes — PASS.** `/ja/pricing` (4 glass surfaces) and
  `/ja/features/citations` (7) render SSR-translated Japanese with the glass and
  palette intact. Fonts and translations coexist correctly: `globals.css:27-29`
  re-points `--dt-serif` to Plex Sans for `:lang(ja)`, so Japanese headlines use
  the CJK-capable workhorse instead of falling back through Fraunces, which has
  no CJK coverage. `/de/features/citations` also 200s.
- **`/blog` and `/privacy` — PASS (silent pass-through, as predicted).** Both
  render through `MarketingShell` with 1 glass surface each (the header only) and
  pick up the new palette tokens with no code changes.
- **`/document-diff` — not verifiable anonymously.** It renders the app-surface
  sign-in gate, because `document-diff/page.tsx:21-23` redirects
  `unauthenticated` to `/auth`. The editorial `MarketingShell` body behind that
  gate was not exercised. Not a glass defect; flagging it as a coverage gap that
  needs an authenticated session to close.
- **`/shared/[token]` — PASS, verified with real data.** The bogus-token 404 the
  brief allowed is weak evidence, so I stood up a throwaway stub backend on
  :8899 and ran the dev server against it to render the page properly. Result:
  editorial shell, glass header, Fraunces `h1`, readable citation chips. Crucially
  the **transcript cards stay solid** — 4 `.ed-card` elements, none carrying
  `.ed-glass`, backgrounds `rgb(32,33,30)` (user) and `rgb(228,226,219)`
  (assistant) — so the "glass is chrome, not content" red-line holds. Reduced
  transparency and print both flatten the header correctly; no overflow at 1440
  or 375; no console errors. Evidence: `shared_1440.png`, `shared_375.png`,
  `shared_1440_reduced.png`. Stub and dev server both shut down afterwards.
- **`/demo` 502 (F7).** Two console errors from a 502 on a backend call — the
  local backend was not running. The page still renders meaningful content
  (1454 chars), satisfying the loading/error-state rule. Environmental, not a
  batch defect.

**11. No horizontal scroll — PASS.** `scrollWidth === clientWidth` on all 21
routes at **both** 1440 and 375. No route produced a single overflowing element.

**12. Scroll performance — PASS.** Full-page scripted scroll of the landing page
(5250px): 108 frames, **median 8.3ms, p95 8.4ms, max 10.0ms, zero frames over
50ms**. No repaint storms from the ambient layer — consistent with it being two
static radial gradients rather than a `filter: blur()`, as specced.

**F6 detail — 375px "Sign In" wrap, proven pre-existing.** The header CTA wraps
onto 3 lines at 375px. I attributed it rather than assuming: with glass active
the button measures 76x57 with `lines: 3`; after forcing
`border: 0; border-radius: 0; backdrop-filter: none` on all `.ed-glass`, it
measures **identically** (76x57, 3 lines). `.ed-glass--header` correctly zeroes
the radius and uses a bottom-only border (`border-width: 0 0 1px 0`), so it adds
no horizontal width. Unrelated to this batch.

---

## Final static gate

```
cd frontend && npm run build
✓ Compiled successfully
  Linting and checking validity of types …  (passed)
```

Exit 0, no errors, no new warnings — the only warning is the pre-existing
`@sentry/nextjs` `sentry.client.config.ts` deprecation notice. Dev server killed
and `:3000` confirmed free before the build (per the "never build while dev is
running" rule). `git status` clean — no files were modified by this task.

## Recommendation

Batch 1 is functionally and visually sound: fonts real, glass real and provably
sampling, both fallbacks complete, zero overflow, zero console errors, no perf
cost. Only one cosmetic defect (F2) was introduced by the batch.

Before the Codex adversarial round, the controller should decide on **F1** — it
is pre-existing and therefore not a merge blocker for Batch 1, but it means the
warm-paper ground the whole glass system was designed against is absent on every
marketing page except the landing, so shipping the glass look without resolving
it under-delivers the redesign where it matters most. F2 and F3 are small enough
to fold into either this batch or Batch 2. F4 needs an owner decision, not a fix.

---

# Fix Round (authorized by team-lead after the report above)

F1, F2 and F3 were authorized and fixed in one commit. F4 (glass vs plain card
grids) and F5 (`.ed-label` contrast) remain open by design — F4 is an owner
decision, F5 is deferred to a later accessibility pass.

## F1 — paper ground restored

`globals.css` was left untouched (Batch 2 scope boundary). The app rule is
countered from `editorial.css:39-53`, placed next to the `.dt-editorial` base
rule with a comment naming the globals.css rule and warning against "cleanup":

```css
.dt-stitch-root > .dt-editorial.min-h-screen,
.dt-stitch-root > .dt-editorial {
  background: var(--ed-paper) !important;
}
```

Both selector forms are kept so a future `MarketingShell` class change cannot
silently regress it.

**Computed `.dt-editorial` background, before → after:**

| Route | Before | After |
|---|---|---|
| `/pricing` | `rgba(0, 0, 0, 0)` | `rgb(234, 232, 227)` |
| `/shared/<token>` | `rgba(0, 0, 0, 0)` | `rgb(234, 232, 227)` |
| `/features/citations` | `rgba(0, 0, 0, 0)` | `rgb(234, 232, 227)` |
| `/use-cases` | `rgba(0, 0, 0, 0)` | `rgb(234, 232, 227)` |
| `/blog` | `rgba(0, 0, 0, 0)` | `rgb(234, 232, 227)` |
| `/` (landing, control) | `rgb(234, 232, 227)` | `rgb(234, 232, 227)` — unchanged |

`rgb(234, 232, 227)` is `--ed-paper` `#eae8e3`. The landing page is byte-identical
before and after, as intended.

**App-surface guard — no regression, verified empirically not just by reasoning.**
On `/auth` and `/document-diff` there is no `.dt-editorial` element in the
document at all (`hasEditorial: false`), so the new selector cannot match. The
`.dt-stitch-root`'s only child is `<main class="flex min-h-screen …">`, which
still computes `rgba(0, 0, 0, 0)` — i.e. the original globals.css transparent
reset still governs app-surface elements exactly as before. Confirmed by eye in
`fix_appsurface__auth.png`: unchanged zinc/blue app ground, white card, blue
buttons, no warm paper anywhere.

## F2 — FAQ doubled edge rule removed

`EdFaqList.tsx`: the first row no longer draws a `borderTop` and no row draws a
`borderBottom` — the glass panel's own border closes the list. Rows still divide
each other. The now-unused `isLast` prop was removed from the interface, the
destructuring and the call site.

Computed `border-top-width` / `border-bottom-width` per row after the fix:
`[{0: 0px/0px}, {1: 1px/0px}, {2: 1px/0px}, {3: 1px/0px}, {4: 1px/0px}]` — exactly
one hairline between adjacent rows, none at either panel edge. Visually confirmed
in `fix_f2_faq_top.png` and `fix_f2_faq_bot.png`: only the rounded panel border
at the edges, no stray inset hairline.

## F3 — sticky header no longer prints mid-page

Added to the **existing** `@media print` block in `editorial.css`:

```css
.dt-editorial > header.ed-glass--header { position: static; }
```

Computed `position` on `/features/citations`: `sticky` on screen, `static` in
print. The regenerated PDF (`fix_f3_print.pdf`) shows the comparison table intact
on page 4 — the "Bounding box highlighting (PDF)" row that the masthead
previously painted over is now fully visible, with no header intrusion anywhere
in the document.

## Regression checks after the fixes

- **Reduced transparency still flattens** (`/pricing` under
  `prefers-reduced-transparency: reduce`): all glass `rgb(228, 226, 219)`,
  `backdrop-filter: none`, ambient `display: none` — and the root paper ground
  correctly *stays* `rgb(234, 232, 227)`, since reducing transparency should
  flatten the glass, not remove the page's own background.
- **No horizontal overflow** at 1440px or 375px across `/`, `/pricing`,
  `/features/citations`, `/shared/<token>`, `/compare/chatpdf`,
  `/use-cases/lawyers`.
- **No new console or page errors.** The only errors observed were two Auth.js
  `ClientFetchError`s on `/auth` and `/document-diff`, from the session endpoint
  being unreachable with no local backend — same environmental class as the
  `/demo` 502 (F7), unrelated to these fixes.

## Gates

```
npx tsc --noEmit          → exit 0
npx next lint --quiet     → ✔ No ESLint warnings or errors
npm run build             → exit 0, zero error lines
```

Dev server and stub backend killed and both ports confirmed free before building,
per the "never build while dev is running" rule.

**Commit:** `7987bd3` — `fix(glass): restore editorial paper ground, FAQ panel edge, print header`
**Files:** `frontend/src/app/editorial.css`, `frontend/src/components/marketing/EdFaqList.tsx`

 succeeded in 0ms:
- [ ] **Step 11: Commit**

```bash
cd /Users/mayijie/Projects/Code/010_DocTalk
git add frontend/src/app/editorial.css frontend/src/app/demo/DemoPageClient.tsx \
  frontend/src/app/tools/reading-time/ReadingTimeClient.tsx frontend/src/app/trust/TrustPageContent.tsx \
  frontend/src/components/landing/HeroCollage.tsx frontend/src/components/Diff/DocumentDiffPanel.tsx \
  frontend/src/components/marketing/EdInlineCell.tsx
git commit -m "$(cat <<'EOF'
feat(glass): migrate editorial palette to Counterpoint, retire --ed-ochre

Paper/ink/signal tones move to the Counterpoint values (cooler paper,
deeper rust). --ed-ochre is removed and replaced by two new tokens,
--ed-slate/--ed-slate-2 (structure: links, secondary CTA, quote rules,
decorative set-dressing) and --ed-olive (verified/positive only, not yet
consumed). All 11 former --ed-ochre call sites are re-pointed per the new
semantics rather than blindly renamed. Also lands the warm glass material
tokens (--ed-glass*, --ed-radius) consumed starting in the next task.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Glass utility classes + ambient canvas

**Files:**
- Modify: `frontend/src/app/editorial.css` (append near end of file, after the existing `.ed-card`/`.ed-prose` rules and before the `:focus-visible` rule at line 271)

**Interfaces:**
- Consumes: `--ed-glass*`, `--ed-radius` tokens from Task 2.
- Produces: CSS classes `.ed-glass`, `.ed-glass--strong`, `.ed-glass--header`, `.ed-glass--cta`, `.ed-glass--popover` (consumed by Tasks 4-7). The `.dt-editorial::after` ambient layer (no className needed — applies automatically to every `MarketingShell` page).

This task only adds new, unused-until-consumed CSS — it cannot visually break anything on its own, but Step 3's manual check still verifies the ambient gradient renders since that one IS live immediately (no opt-in required).

- [ ] **Step 1: Add the ambient canvas layer**

Insert after the existing `.dt-editorial > * { position: relative; z-index: 1; }` rule (currently line 32):
```css

/* Ambient canvas — restrained, asymmetric static gradients so glass has
   something to blur. Static gradients only (not filter:blur) for zero
   scroll repaint (spec §3). Sits above the paper-grain ::before, below
   real content (z-index 1, set above). */
.dt-editorial::after {
  content: "";
  position: absolute;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  background:
    radial-gradient(680px 480px at 14% 0%, rgba(160, 75, 52, 0.10), transparent 60%),
    radial-gradient(560px 420px at 92% 38%, rgba(31, 58, 77, 0.07), transparent 65%);
}
@media (prefers-reduced-transparency: reduce) {
  .dt-editorial::after { display: none; }
}
@media print {
  .dt-editorial::after { display: none; }
}
```

- [ ] **Step 2: Add the `.ed-glass` base recipe + modifiers**

Append near the end of the file, immediately before the `.dt-editorial *:focus-visible` rule:
```css

/* ─── Liquid Glass utility classes (spec §2.3, §4.1) ───────────────────
   Glass is chrome, not content: apply only to nav, cards, popovers, CTA
   panels, FAQ/comparison containers, hero art. NEVER to EdProse/article
   body/EdSection text or anything rendering real document/quote text.
   backdrop-filter appears exactly once below (the .ed-glass base) with
   its two required fallbacks directly underneath — do not add
   backdrop-filter anywhere else in this file without both. Source order
   matters: this block is appended AFTER .ed-card so `.ed-card.ed-glass`
   (Task 5) resolves background/border to the glass values. */
.dt-editorial .ed-glass {
  background: var(--ed-glass);
  backdrop-filter: var(--ed-glass-blur);
  -webkit-backdrop-filter: var(--ed-glass-blur);
  border: 1px solid var(--ed-glass-line);
  border-radius: var(--ed-radius);
  box-shadow: var(--ed-glass-hi), var(--ed-glass-shadow);
}
.dt-editorial .ed-glass--strong {
  background: var(--ed-glass-strong);
}
.dt-editorial .ed-glass--header {
  border-radius: 0;
  border-width: 0 0 1px 0;
}
.dt-editorial .ed-glass--cta {
  border-radius: 0;
  border-width: 1px 0 0 0;
}
.dt-editorial .ed-glass--popover {
  box-shadow: var(--ed-glass-hi), 0 14px 36px rgba(40, 33, 24, 0.24);
}
@media (prefers-reduced-transparency: reduce) {
  .dt-editorial .ed-glass {
    background: var(--ed-paper-2);
    backdrop-filter: none;
    -webkit-backdrop-filter: none;
  }
}
@media print {
  .dt-editorial .ed-glass {
    background: var(--ed-paper-2);
    backdrop-filter: none;
    -webkit-backdrop-filter: none;
    box-shadow: none;
    border-color: var(--ed-rule);
  }
}
```

- [ ] **Step 3: Typecheck + lint + build, then manual check**

```bash
lsof -i :3000 || true
cd frontend && npx tsc --noEmit
cd frontend && npx next lint --quiet
cd frontend && npm run build
```
Then `cd frontend && npm run dev`, open `/`. Confirm the ambient gradient is visible as a faint, asymmetric warm/cool wash behind the page (most visible in empty paper areas between sections) — restrained, not an even glow. No new glass surfaces are visible yet (expected — nothing consumes `.ed-glass` until Task 4). In Chrome DevTools, toggle **Rendering → Emulate CSS media feature `prefers-reduced-transparency`** to `reduce` and confirm the ambient gradient disappears.

- [ ] **Step 4: Commit**

```bash
cd /Users/mayijie/Projects/Code/010_DocTalk
git add frontend/src/app/editorial.css
git commit -m "$(cat <<'EOF'
feat(glass): add ambient canvas + .ed-glass utility classes

Adds the marketing ambient layer (.dt-editorial::after, static asymmetric
radial gradients per spec §3) and the .ed-glass/.ed-glass--strong/--header/
--cta/--popover utility classes that later tasks apply to header, cards,
CTA banner, FAQ, comparison table, and hero art. Both the
prefers-reduced-transparency and @media print fallbacks live inside this
one .ed-glass rule so every future consumer inherits them for free.
Nothing consumes these classes yet — this is foundation only.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Header + language selector glassing

**Files:**
- Modify: `frontend/src/components/marketing/EditorialHeaderBase.tsx:62-68`
- Modify: `frontend/src/components/marketing/EdLanguageSelector.tsx:129-145`

**Interfaces:**
- Consumes: `.ed-glass`, `.ed-glass--strong`, `.ed-glass--header`, `.ed-glass--popover` from Task 3.

- [ ] **Step 1: Glass the sticky header bar**

In `EditorialHeaderBase.tsx`, replace:
```tsx
      <header
        className="sticky top-0 z-50 h-16 flex items-center"
        style={{
          background: "var(--ed-paper)",
          borderBottom: "1px solid var(--ed-rule)",
        }}
      >
```
with:
```tsx
      <header
        className="sticky top-0 z-50 h-16 flex items-center ed-glass ed-glass--strong ed-glass--header"
      >
```

- [ ] **Step 2: Glass the language-selector popover**

In `EdLanguageSelector.tsx`, replace:
```tsx
    <div
      ref={menuRef}
      className="dt-editorial"
      style={{
        position: "fixed",
        top: pos.top,
        right: pos.right,
        zIndex: 10000,
        minWidth: "200px",
        maxHeight: pos.maxHeight,
        overflowY: "auto",
        background: "var(--ed-paper)",
        border: "1px solid var(--ed-rule)",
        boxShadow: "0 14px 36px rgba(40, 33, 24, 0.20)",
      }}
    >
```
with:
```tsx
    <div
      ref={menuRef}
      className="dt-editorial ed-glass ed-glass--strong ed-glass--popover"
      style={{
        position: "fixed",
        top: pos.top,
        right: pos.right,
        zIndex: 10000,
        minWidth: "200px",
        maxHeight: pos.maxHeight,
        overflowY: "auto",
      }}
    >
```

Note: this menu is rendered through `createPortal(menu, document.body)` — it sits OUTSIDE the `.dt-editorial` DOM subtree from `MarketingShell`, which is why it already carries its own `className="dt-editorial"` (needed so `var(--ed-*)` tokens resolve). Adding `.ed-glass` alongside works the same way since `.dt-editorial .ed-glass` matches this element's own `.dt-editorial` class as the ancestor-or-self is not required — actually verify this: the selector is `.dt-editorial .ed-glass` (descendant combinator), which requires an ANCESTOR with `.dt-editorial`, not the same element. Since this div has `.dt-editorial` and `.ed-glass` on the SAME element, the descendant-combinator selector will NOT match. Fix this by keeping `.dt-editorial` on this div (for token resolution) exactly as it already deliberately is, but confirm in Step 3 below that the glass actually renders — if it does not, the fix is to wrap an extra `<div className="dt-editorial">` around it, or (simpler) change the two new utility rules added in Task 3 to also accept the same-element case. Resolve this concretely now: change the Task 3 selectors for the three classes used here from `.dt-editorial .ed-glass` etc. to `.dt-editorial .ed-glass, .dt-editorial.ed-glass` (and the `--strong`/`--popover`/fallback variants likewise) so both the descendant case (real DOM inside `MarketingShell`) and the same-element portal case both match.

- [ ] **Step 2b: Widen the Task 3 selectors to cover the same-element case**

Back in `editorial.css`, update every selector added in Task 3 Step 2 that starts with `.dt-editorial .ed-glass` to also match `.dt-editorial.ed-glass` (no space) so `EdLanguageSelector`'s portal div — which carries both classes on one element — is covered. Replace:
```css
.dt-editorial .ed-glass {
```
with:
```css
.dt-editorial .ed-glass,
.dt-editorial.ed-glass {
```
Do the same for `.ed-glass--strong`, `.ed-glass--header`, `.ed-glass--cta`, `.ed-glass--popover`, and both `@media` fallback blocks' `.dt-editorial .ed-glass` selector — every one of the 7 selector groups added in Task 3 gets the same `,\n.dt-editorial.ed-glass...` sibling added for its own class suffix.

- [ ] **Step 3: Typecheck + lint + build, then manual check**

```bash
lsof -i :3000 || true
cd frontend && npx tsc --noEmit
cd frontend && npx next lint --quiet
cd frontend && npm run build
```
Then `cd frontend && npm run dev`, open `/pricing` (a page with enough content to scroll), scroll down and confirm the sticky header shows a frosted-glass blur of the content passing beneath it, with a hairline bottom border (not a full box border) and no visible top/left/right border. Click the language selector (globe icon) and confirm the popover menu also renders with a visible frosted-glass blur of whatever is behind it, not the old flat paper background. Toggle **prefers-reduced-transparency: reduce** in DevTools Rendering tab and confirm both the header and popover fall back to a flat `--ed-paper-2` background with no blur.

- [ ] **Step 4: Commit**

```bash
cd /Users/mayijie/Projects/Code/010_DocTalk
git add frontend/src/components/marketing/EditorialHeaderBase.tsx \
  frontend/src/components/marketing/EdLanguageSelector.tsx frontend/src/app/editorial.css
git commit -m "$(cat <<'EOF'
feat(glass): apply glass chrome to sticky header + language popover

Header and language-selector popover are the first real .ed-glass
consumers. Widens the Task 3 utility selectors to also match
.dt-editorial.ed-glass (no descendant space) since the language-selector
portal renders both classes on the same element, outside the normal
MarketingShell DOM subtree.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: EdCardGrid + EdCtaBanner glassing

**Files:**
- Modify: `frontend/src/components/marketing/EdCardGrid.tsx:49-66`
- Modify: `frontend/src/components/marketing/EdCtaBanner.tsx:22-28`

**Interfaces:**
- Consumes: `.ed-glass`, `.ed-glass--cta` from Task 3.

Scope note: `.ed-card` (the shared CSS class) is used by 25+ files across the whole editorial surface, including `DocumentDiffPanel.tsx`'s citation-excerpt article cards which render actual diff/quote text — content, not chrome. This task does **not** modify the shared `.ed-card` rule. Instead it adds `.ed-glass` as a *second* className only on the cards rendered by `EdCardGrid` (the component spec §4.1 names explicitly), relying on `.ed-glass`'s later source position in `editorial.css` to win the background/border tie against `.ed-card`. Every other `.ed-card` consumer (blog, pricing, use-cases body cards, tools, `DocumentDiffPanel`) is untouched and stays solid.

- [ ] **Step 1: Glass the EdCardGrid cards**

In `EdCardGrid.tsx`, replace:
```tsx
        return item.href ? (
          <Link
            key={`card-${index}`}
            href={item.href}
            className="ed-card h-full"
            style={{ display: "flex", flexDirection: "column" }}
          >
            {inner}
          </Link>
        ) : (
          <div
            key={`card-${index}`}
            className="ed-card h-full"
            style={{ display: "flex", flexDirection: "column" }}
          >
            {inner}
          </div>
        );
```
with:
```tsx
        return item.href ? (
          <Link
            key={`card-${index}`}
            href={item.href}
            className="ed-card ed-glass h-full"
            style={{ display: "flex", flexDirection: "column" }}
          >
            {inner}
          </Link>
        ) : (
          <div
            key={`card-${index}`}
            className="ed-card ed-glass h-full"
            style={{ display: "flex", flexDirection: "column" }}
          >
            {inner}
          </div>
        );
```

- [ ] **Step 2: Glass the CTA banner section**

In `EdCtaBanner.tsx`, replace:
```tsx
    <section
      className="ed-section"
      style={{
        background: "var(--ed-paper-2)",
        borderTop: "1px solid var(--ed-rule)",
      }}
    >
```
with:
```tsx
    <section className="ed-section ed-glass ed-glass--cta">
```

- [ ] **Step 3: Typecheck + lint + build, then manual check**

```bash
lsof -i :3000 || true
cd frontend && npx tsc --noEmit
cd frontend && npx next lint --quiet
cd frontend && npm run build
```
Then `cd frontend && npm run dev`, open `/features/citations` (renders `EdCardGrid` in the "use cases" section) and confirm the three cards show a frosted glass background with a soft shadow and rounded corners, distinct from any plain `.ed-card` elsewhere on the same page (e.g. compare that against `/blog`'s post cards, which must still look flat/solid, unchanged). Scroll to the bottom CTA banner on the same page and confirm it also renders as a full-width glass band with a hairline top border only. Confirm `/document-diff`'s citation-excerpt cards (inside `DocumentDiffPanel`, after running a comparison) are still flat/solid — they must NOT have picked up glass.

- [ ] **Step 4: Commit**

```bash
cd /Users/mayijie/Projects/Code/010_DocTalk
git add frontend/src/components/marketing/EdCardGrid.tsx frontend/src/components/marketing/EdCtaBanner.tsx
git commit -m "$(cat <<'EOF'
feat(glass): glass EdCardGrid cards + EdCtaBanner

Adds .ed-glass as a second class alongside the existing .ed-card so only
EdCardGrid's cards (not the 20+ other .ed-card consumers, several of
which render real content like DocumentDiffPanel's citation excerpts)
pick up the glass treatment. EdCtaBanner's full-width section switches
from a flat --ed-paper-2 band to a glass band with a single top hairline.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: EdFaqList + EdComparisonTable glassing

**Files:**
- Modify: `frontend/src/components/marketing/EdFaqList.tsx:28-49`
- Modify: `frontend/src/components/marketing/EdComparisonTable.tsx:106-115`

**Interfaces:**
- Consumes: `.ed-glass` from Task 3.

- [ ] **Step 1: Wrap the FAQ list in a glass panel**

In `EdFaqList.tsx`, replace:
```tsx
  return (
    <div>
      {items.map((item, index) => {
```
with:
```tsx
  return (
    <div className="ed-glass" style={{ padding: "6px 28px" }}>
      {items.map((item, index) => {
```

- [ ] **Step 2: Wrap the comparison table in a glass panel**

In `EdComparisonTable.tsx`, replace:
```tsx
  return (
    <div style={{ overflowX: "auto" }}>
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          minWidth: competitorCount > 1 ? "600px" : "480px",
          border: "1px solid var(--ed-rule)",
        }}
      >
```
with:
```tsx
  return (
    <div className="ed-glass" style={{ padding: "4px", overflow: "hidden" }}>
      <div style={{ overflowX: "auto" }}>
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            minWidth: competitorCount > 1 ? "600px" : "480px",
          }}
        >
```
This removes the table's own `border` (the glass wrapper now supplies the outer boundary) and adds an inner `overflowX: auto` div so horizontal scrolling on narrow viewports still works while the outer glass div clips the table's square corners to the rounded glass radius via `overflow: hidden`. Because the `<table>` and its closing tags are now nested one level deeper, every subsequent line inside the existing `return (...)` block (the `</thead>`, `<tbody>`, and both closing `</table>`/`</div>` tags) needs one extra level of indentation and one extra closing `</div>` before the final `);`. Concretely, the end of the function's `return` changes from:
```tsx
      </table>
    </div>
  );
}
```
to:
```tsx
        </table>
      </div>
    </div>
  );
}
```
Re-indent every line between the `<table` open tag and the `</table>` close tag (the `<thead>`/`<tbody>` block) by two extra spaces to match — this is a pure whitespace change with no logic difference; run `npx prettier --write` on the file afterward if the project has Prettier configured, otherwise indent by hand and let `next lint` catch anything missed.

- [ ] **Step 3: Check for Prettier config, apply if present**

```bash
cd frontend && test -f .prettierrc -o -f .prettierrc.json -o -f prettier.config.js && npx prettier --write src/components/marketing/EdComparisonTable.tsx || echo "no prettier config found, indentation was hand-edited in step 2"
```

- [ ] **Step 4: Typecheck + lint + build, then manual check**

```bash
lsof -i :3000 || true
cd frontend && npx tsc --noEmit
cd frontend && npx next lint --quiet
cd frontend && npm run build
```
Then `cd frontend && npm run dev`, open `/features/citations` (has both an FAQ and a comparison table) and confirm: the FAQ accordion sits inside a single glass card spanning all questions (not per-row glass), opening/closing questions still animates correctly and the measured-height accordion logic (`EdFaqList`'s `ResizeObserver`) still works since only the outer wrapper changed. Confirm the comparison table sits inside a glass card with visibly rounded corners clipping the table's top corners, and that on a narrow/mobile viewport (DevTools device toolbar, e.g. 375px) the table still scrolls horizontally inside the glass card without the glass card itself overflowing the viewport (no horizontal page scroll).

- [ ] **Step 5: Commit**

```bash
cd /Users/mayijie/Projects/Code/010_DocTalk
git add frontend/src/components/marketing/EdFaqList.tsx frontend/src/components/marketing/EdComparisonTable.tsx
git commit -m "$(cat <<'EOF'
feat(glass): glass FAQ list and comparison table panel containers

Both wrap their existing content in a single .ed-glass panel rather than
glassing individual rows/cells. The comparison table's outer border moves
from the <table> element itself to the new glass wrapper (overflow:hidden
clips the table's square corners to the rounded glass radius), with the
horizontal-scroll behavior preserved via a nested div.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: HeroCollage glassing + verified-quote olive/slate recolor

**Files:**
- Modify: `frontend/src/components/landing/HeroCollage.tsx:1-9,108-124,320-334`
- Modify: `frontend/src/components/landing/FeatureGrid.tsx:17-49`

**Interfaces:**
- Consumes: `.ed-glass` from Task 3; `--ed-olive`, `--ed-slate` from Task 2.

Scope note on "verified/quote demo objects use olive badge + slate rule" (spec §4.1): there is no single dedicated "verified quote" component in the marketing kit. The one concrete match is `FeatureGrid.tsx`'s `VisualCitations` mockup (the landing page's citation-chip illustration) — it already depicts a numbered citation *badge* and a highlighted-line *rule* border, i.e. exactly the badge/rule pairing the spec names. This task applies olive to the badge and slate to the rule there; it does not touch `EdInlineCell`'s unrelated true/false checkmarks or `DocumentDiffPanel`'s "succeeded" `CheckCircle2` icon (both currently `--ed-signal` and technically also "verified" states) — recoloring those is a reasonable follow-up but out of scope for this batch since neither was named in spec §4.1 and both currently render correctly with the new rust hex.

- [ ] **Step 1: Update HeroCollage's stale "no glassmorphism" file comment**

Replace:
```tsx
/**
 * HeroCollage — Art-directed editorial collage for the DocTalk landing hero.
 * Pure HTML/CSS/SVG, warm editorial palette only. No external images.
 * No glassmorphism, no gradient mesh, no UI mock. Aria-hidden decorative.
 */
```
with:
```tsx
/**
 * HeroCollage — Art-directed editorial collage for the DocTalk landing hero.
 * Pure HTML/CSS/SVG, warm editorial palette only. No external images, no
 * gradient mesh, no UI mock. Aria-hidden decorative. The two stacked
 * document plates use .ed-glass (spec §4.1 "hero cards") — this is the
 * one deliberate glassmorphism use in this file.
 */
```

- [ ] **Step 2: Glass the primary document plate**

Replace:
```tsx
        <div
          style={{
            position: "absolute",
            top: "14%",
            left: "8%",
            right: "6%",
            background: "var(--ed-paper)",
            border: "1px solid var(--ed-rule)",
            borderRadius: "2px",
            padding: "22px 20px 18px",
            transform: "rotate(-2.8deg)",
            boxShadow:
              "0 4px 18px 0 rgba(28,27,25,0.10), 0 1px 3px 0 rgba(28,27,25,0.07)",
          }}
        >
```
with:
```tsx
        <div
          className="ed-glass"
          style={{
            position: "absolute",
            top: "14%",
            left: "8%",
            right: "6%",
            padding: "22px 20px 18px",
            transform: "rotate(-2.8deg)",
          }}
        >
```

- [ ] **Step 3: Glass the second stacked plate**

Replace:
```tsx
        <div
          style={{
            position: "absolute",
            top: "12%",
            left: "14%",
            right: "2%",
            height: "60%",
            background: "var(--ed-paper-2)",
            border: "1px solid var(--ed-rule)",
            borderRadius: "2px",
            transform: "rotate(2.2deg)",
            zIndex: -1,
          }}
        />
```
with:
```tsx
        <div
          className="ed-glass"
          style={{
            position: "absolute",
            top: "12%",
            left: "14%",
            right: "2%",
            height: "60%",
            transform: "rotate(2.2deg)",
            zIndex: -1,
          }}
        />
```

- [ ] **Step 4: Recolor the citation badge to olive and the highlight rule to slate in `FeatureGrid.tsx`**

In the `VisualCitations` component, replace the citation-band rule:
```tsx
            <div className="h-1.5 w-full bg-[var(--ed-signal)]/20 border-l-2 border-[var(--ed-signal)]" />
```
with:
```tsx
            <div className="h-1.5 w-full bg-[var(--ed-signal)]/20 border-l-2 border-[var(--ed-slate)]" />
```

Replace the numbered citation badge:
```tsx
            <span className="mr-1 inline-flex items-center justify-center bg-[var(--ed-signal)] px-1 py-0.5 text-[8px] font-bold leading-none text-white">
              1
            </span>
```
with:
```tsx
            <span className="mr-1 inline-flex items-center justify-center bg-[var(--ed-olive)] px-1 py-0.5 text-[8px] font-bold leading-none text-white">
              1
            </span>
```

Leave the "p. 4 · ln 3" page-locator chip's `border-[var(--ed-signal)]/40`/`text-[var(--ed-signal)]` unchanged — it's a locator label, not the badge/rule pair.

- [ ] **Step 5: Typecheck + lint + build, then manual check**

```bash
lsof -i :3000 || true
cd frontend && npx tsc --noEmit
cd frontend && npx next lint --quiet
cd frontend && npm run build
```
Then `cd frontend && npm run dev`, open `/`. Confirm the hero's rotated document-plate collage now shows a visible frosted-glass blur (of the ambient gradient/background behind it) on both the front and the peeking second plate, still readable (the mock text-line bars and citation badge inside remain legible against the translucent background). Confirm the small "By the numbers"-adjacent feature tile showing the citation mockup (`VisualCitations`, in the features grid) now shows the small numbered badge in olive/green and the highlighted line's left border in slate/navy instead of both being rust.

- [ ] **Step 6: Commit**

```bash
cd /Users/mayijie/Projects/Code/010_DocTalk
git add frontend/src/components/landing/HeroCollage.tsx frontend/src/components/landing/FeatureGrid.tsx
git commit -m "$(cat <<'EOF'
feat(glass): glass hero collage document plates, olive/slate citation badge

HeroCollage's two rotated document-plate mockups (spec §4.1 "hero cards")
switch from flat paper to .ed-glass. FeatureGrid's VisualCitations mockup
gets the "verified badge + slate rule" treatment from spec §4.1 — the
numbered citation badge moves to --ed-olive (verified/positive), the
highlighted-line border moves to --ed-slate (structure).

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: `shared/[token]` fold-in

**Files:**
- Modify: `frontend/src/app/shared/[token]/page.tsx`

**Interfaces:**
- Consumes: `MarketingShell` (from `frontend/src/components/marketing/MarketingShell.tsx`), editorial CSS classes/tokens from Tasks 1-3.

`SharedPage` is an `async` Server Component (it calls `fetchShared` server-side in `generateMetadata` and the page body, and reads `headers()`) — `MarketingShell` is a `"use client"` component. This is fine: Server Components can render Client Components as children, they just cannot themselves be imported *into* a Client Component tree the other way around. No conversion to a client component is needed.

Per the "glass is chrome, not content" rule, this page's actual content — the shared chat transcript (user/assistant messages, citation snippets) — stays SOLID. It inherits glass automatically for its header/footer/ambient (via `MarketingShell`, already glassed by Tasks 3-4); no new glass surface is added on this page itself.

- [ ] **Step 1: Rewrite the page to use MarketingShell + editorial classes**

Replace the entire file body from the `SharedPage` function's `return` statement onward — i.e. replace:
```tsx
export default async function SharedPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const data = await fetchShared(token);
  if (!data) notFound();

  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 mb-1">{data.session_title}</h1>
        <p className="text-sm text-zinc-500 mb-6">Document: {data.document_name}</p>

        <div className="space-y-4">
          {data.messages.map((msg: SharedMessage, i: number) => (
            <div
              key={msg.id || i}
              id={msg.id}
              className={`scroll-mt-6 rounded-2xl transition-[background-color,box-shadow] target:bg-blue-50 target:ring-2 target:ring-blue-300 target:ring-offset-4 target:ring-offset-white dark:target:bg-blue-950/30 dark:target:ring-blue-700 dark:target:ring-offset-zinc-950 ${
                msg.role === 'user' ? 'flex justify-end' : ''
              }`}
            >
              <div className={`max-w-[85%] rounded-xl px-4 py-3 ${
                msg.role === 'user'
                  ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                  : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100'
              }`}>
                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                {msg.citations && msg.citations.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {msg.citations.map((c, j: number) => (
                      <div key={j} className="text-xs text-zinc-500 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-700 rounded px-2 py-1">
                        p. {c.page}{c.document_filename ? ` — ${c.document_filename}` : ''}: &ldquo;{c.text_snippet}&rdquo;
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-12 text-center border-t border-zinc-200 dark:border-zinc-800 pt-6">
          <p className="text-sm text-zinc-500 mb-3">Powered by DocTalk</p>
          <a
            href="https://www.doctalk.site"
            className="inline-block px-6 py-2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
          >
            Try DocTalk Free
          </a>
        </div>
      </div>
    </div>
  );
}
```
with:
```tsx
export default async function SharedPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const data = await fetchShared(token);
  if (!data) notFound();

  return (
    <MarketingShell>
      <div className="ed-shell" style={{ maxWidth: '760px', paddingTop: '48px', paddingBottom: '64px' }}>
        <h1 className="ed-h1">{data.session_title}</h1>
        <p className="ed-caption" style={{ marginTop: '8px', marginBottom: '32px' }}>
          Document: {data.document_name}
        </p>

        <div className="flex flex-col" style={{ gap: '16px' }}>
          {data.messages.map((msg: SharedMessage, i: number) => (
            <div
              key={msg.id || i}
              id={msg.id}
              className={`scroll-mt-6 target:bg-[var(--ed-paper-2)] ${msg.role === 'user' ? 'flex justify-end' : ''}`}
              style={{ transition: 'background-color 300ms ease' }}
            >
              <div
                className="ed-card"
                style={{
                  maxWidth: '85%',
                  ...(msg.role === 'user'
                    ? { background: 'var(--ed-ink)', color: '#ffffff', border: '1px solid var(--ed-ink)' }
                    : {}),
                }}
              >
                <p className="ed-body" style={msg.role === 'user' ? { color: '#ffffff' } : undefined}>
                  {msg.content}
                </p>
                {msg.citations && msg.citations.length > 0 && (
                  <div className="flex flex-col" style={{ marginTop: '10px', gap: '6px' }}>
                    {msg.citations.map((c, j: number) => (
                      <div
                        key={j}
                        className="ed-caption"
                        style={{
                          border: '1px solid var(--ed-rule)',
                          background: 'var(--ed-paper-2)',
                          padding: '4px 8px',
                          borderRadius: '3px',
                        }}
                      >
                        p. {c.page}{c.document_filename ? ` — ${c.document_filename}` : ''}: &ldquo;{c.text_snippet}&rdquo;
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: '48px', textAlign: 'center', borderTop: '1px solid var(--ed-rule)', paddingTop: '24px' }}>
          <p className="ed-caption" style={{ marginBottom: '12px' }}>Powered by DocTalk</p>
          <a href="https://www.doctalk.site" className="ed-cta">
            Try DocTalk Free
          </a>
        </div>
      </div>
    </MarketingShell>
  );
}
```

- [ ] **Step 2: Add the MarketingShell import**

Add near the top of the file, alongside the existing imports:
```tsx
import MarketingShell from '../../../components/marketing/MarketingShell';
```
Verify the relative path: `frontend/src/app/shared/[token]/page.tsx` is 3 directories below `frontend/src/app/`, and `MarketingShell` lives at `frontend/src/components/marketing/MarketingShell.tsx` — from `app/shared/[token]/`, that's `../../../components/marketing/MarketingShell`. Double-check this resolves by running the typecheck in Step 3 (a wrong relative path fails immediately with a clear "module not found" error).

- [ ] **Step 3: Typecheck + lint + build**

```bash
lsof -i :3000 || true
cd frontend && npx tsc --noEmit
cd frontend && npx next lint --quiet
cd frontend && npm run build
```
Expected: all exit 0.

- [ ] **Step 4: Manual check with a real shared link**

This page requires a real `token` that exists in the backend's `shared_sessions` (or equivalent) table — a raw `/shared/nonexistent-token` visit correctly 404s via `notFound()`, which does not exercise the new styling. Generate a real share link: sign in at `http://localhost:3000/auth`, open any document chat, use the existing "Share" UI action to create a shared-conversation link (check `frontend/src/components/` for the share button if not immediately visible in the chat toolbar), then visit that link. Confirm: the page now renders inside the editorial header/footer chrome (with the glass sticky header from Task 4), the title/document-name use Fraunces/IBM Plex Sans and the Counterpoint palette, user messages render as solid dark ink-colored bubbles (right-aligned) and assistant messages as solid card bubbles (left-aligned) — both solid, no glass — and the citation snippet chips are readable. Confirm the page still 404s correctly for `http://localhost:3000/shared/does-not-exist`.

- [ ] **Step 5: Commit**

```bash
cd /Users/mayijie/Projects/Code/010_DocTalk
git add frontend/src/app/shared/\[token\]/page.tsx
git commit -m "$(cat <<'EOF'
feat(glass): fold shared/[token] into MarketingShell + editorial tokens

The public share page previously rendered completely unthemed raw
zinc/blue Tailwind (spec §4.3's "naked page" list). It now renders inside
MarketingShell, picking up the glass header/footer and Counterpoint
palette for free. The actual conversation transcript (user/assistant
bubbles, citation snippets) stays solid per "glass is chrome, not
content" — no new glass surface is added on this page itself.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: Glass fallback audit

**Files:**
- No modifications expected — this is a verification pass. If the audit finds a gap, fix it in `frontend/src/app/editorial.css` and note the fix in the commit message.

**Interfaces:**
- Consumes: the complete `editorial.css` state after Tasks 1-8.

- [ ] **Step 1: Run the mechanical audit — every `backdrop-filter` must have a paired fallback**

```bash
cd frontend
echo "=== all backdrop-filter declarations in editorial.css ==="
grep -n "backdrop-filter" src/app/editorial.css
echo ""
echo "=== non-'none' backdrop-filter count (should be exactly 1: the .ed-glass base) ==="
grep -c "backdrop-filter: blur\|backdrop-filter: var" src/app/editorial.css
echo ""
echo "=== 'none' backdrop-filter count (should be exactly 2: one inside prefers-reduced-transparency, one inside @media print) ==="
grep -c "backdrop-filter: none" src/app/editorial.css
echo ""
echo "=== confirm both fallback media queries exist and wrap .ed-glass ==="
grep -B2 "backdrop-filter: none" src/app/editorial.css
```
Expected: the non-`none` count is exactly 1 (the `.ed-glass` base rule added in Task 3), the `none` count is exactly 2, and the `-B2` context for each `none` occurrence shows it's inside a `@media (prefers-reduced-transparency: reduce)` block and a `@media print` block respectively, both targeting `.dt-editorial .ed-glass, .dt-editorial.ed-glass`. If any count is off, or a fallback block is missing/incomplete, fix `editorial.css` directly before proceeding — do not leave an unaudited `backdrop-filter`.

- [ ] **Step 2: Confirm no component file adds `backdrop-filter` via inline style**

```bash
cd frontend
grep -rn "backdropFilter" src/components/marketing src/components/landing src/app/shared src/app/demo src/app/trust "src/app/tools/reading-time" src/components/Diff
```
Expected: no output. If any hit appears, it means a glass surface was added via inline `style={{backdropFilter}}` instead of the `.ed-glass` className — this bypasses the reduced-transparency/print fallbacks entirely and must be converted to use the class instead.

- [ ] **Step 3: Confirm every glass consumer is inside `.dt-editorial`**

```bash
cd frontend
grep -rln "ed-glass" src/components/marketing src/components/landing src/app/shared
```
For each file listed, confirm (by inspection, since this is structural not greppable) that the `.ed-glass`-bearing element is either (a) a descendant of a `MarketingShell`-rendered `.dt-editorial` root, or (b) — like `EdLanguageSelector`'s portal — itself carries `.dt-editorial` directly. Any `.ed-glass` usage outside both cases would silently resolve to no styling at all (the CSS variables it depends on wouldn't exist), which is a correctness bug, not just a missed-fallback bug.

- [ ] **Step 4: Verify the palette rule (no stray gray-*/indigo-*/violet-*/purple-* introduced)**

```bash
cd frontend
grep -rn "gray-\|indigo-\|violet-\|purple-" src/components/marketing src/components/landing/HeroCollage.tsx src/components/landing/FeatureGrid.tsx src/app/shared
```
Expected: no output (this repo-wide rule from `.claude/rules/frontend.md` predates this batch and nothing in Tasks 1-8 should have introduced a violation).

- [ ] **Step 5: Commit (only if Step 1 required a fix; otherwise this task produces no diff and can be marked complete without a commit)**

```bash
cd /Users/mayijie/Projects/Code/010_DocTalk
git status
```
If `editorial.css` shows changes from an audit fix:
```bash
git add frontend/src/app/editorial.css
git commit -m "$(cat <<'EOF'
fix(glass): close a gap found in the glass fallback audit

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOF
)"
```
If `git status` shows no changes, skip the commit — the audit passed clean.

---

## Task 10: Integration verification

**Files:** none (verification only).

- [ ] **Step 1: Full clean build**

```bash
lsof -i :3000 || true
cd frontend && npx tsc --noEmit
cd frontend && npx next lint --quiet
cd frontend && npm run build
```
Expected: all exit 0, zero warnings introduced.

- [ ] **Step 2: Route sweep — every editorial page renders without error**

`cd frontend && npm run dev`, then load each of the following in a browser and confirm no console errors, no broken layout, no missing content (per `.claude/rules/frontend.md`'s "loading and error states" rule, each should render meaningful content, not a blank screen):
- `/` (landing — hero collage glass, ambient, header glass)
- `/use-cases` and one child, e.g. `/use-cases/lawyers`
- `/compare` and one child, e.g. `/compare/chatpdf`
- `/alternatives` and one child
- `/features` and `/features/citations` (glass card grid, CTA, FAQ, comparison table) and `/features/multi-format`
- `/tools` and `/tools/reading-time`
- `/pricing`
- `/trust`
- `/demo`
- `/document-diff` (discovered during context-gathering to already be `MarketingShell`-wrapped via `surface="editorial"` — not in the original route list but genuinely in scope; see report below)
- `/shared/<a-real-token>` (from Task 8's manual check)
- Spot-check two pages that are `MarketingShell`-wrapped but were not in the original scoping list and receive the palette-token changes "for free" without code changes: `/blog` and `/privacy` — confirm they still render correctly with the new Counterpoint colors (they don't use `--ed-ochre` or any glass class, so this should be a silent, correct pass-through).

- [ ] **Step 3: Locale variant spot-check**

Open `/de/features/citations`, `/ja/pricing`, and `/es/trust` (or whichever localized routes exist per `frontend/src/i18n/routing.ts`'s `MARKETING_LOCALES`) and confirm the glass/palette/font changes render identically to their English counterparts — this batch changed no translation keys, so this is purely a rendering-parity check, not a translation-content check.

- [ ] **Step 4: Reduced-transparency fallback, full sweep**

In Chrome DevTools → Rendering tab → "Emulate CSS media feature prefers-reduced-transparency" → `reduce`. Re-visit `/`, `/features/citations`, and `/shared/<token>`. Confirm every glass surface (header, language popover, card grid, CTA banner, FAQ panel, comparison table, hero collage plates) falls back to a flat `--ed-paper-2` background with no blur, and the ambient gradient is hidden. Reset the emulation to `no-preference` afterward.

- [ ] **Step 5: Print fallback spot-check**

On `/features/citations`, open the browser's print preview (Cmd+P). Confirm the header/cards/FAQ/comparison table render as flat solid panels (no blur artifacts, which can render as solid black/garbage in some print engines if not disabled).

- [ ] **Step 6: No horizontal scroll**

At 375px viewport width (DevTools device toolbar, e.g. "iPhone SE"), visit `/`, `/features/citations`, and `/shared/<token>`. Confirm `document.documentElement.scrollWidth <= document.documentElement.clientWidth` (no horizontal page scrollbar) — pay particular attention to the comparison table (Task 6, which restructured its scroll container) and the hero collage (Task 7).

- [ ] **Step 7: Lighthouse / CLS spot-check**

```bash
cd frontend && npm run build && npm run start &
sleep 5
npx lighthouse http://localhost:3000/ --only-categories=performance --chrome-flags="--headless" --output=json --output-path=/tmp/lh-landing.json
```
(Stop the `npm run start` background process afterward.) Compare the `cumulative-layout-shift` and `largest-contentful-paint` audit scores against pre-batch numbers if available (check `.collab/reviews/` for a prior Lighthouse baseline); flag to the team if CLS regresses materially — the ambient `::after` layer and glass classes are structural/static (no layout-affecting JS), so a regression here would indicate something unexpected rather than an accepted cost of this batch.

- [ ] **Step 8: Final report — no commit for this task (verification only)**

Summarize the sweep results (pass/fail per step 2-7) back to whoever requested this batch. If any step failed, do not consider Batch 1 done — file the failure as a new task instead of patching ad hoc, per the project's "run these after any non-trivial change" verification contract in `CLAUDE.md`.

- [ ] **Step 9: Hand off for Codex adversarial review**

Per `CLAUDE.md`'s "Codex collaboration" section, this batch (security-non-sensitive but > 30 lines of logic across 10 commits) should go through a Claude → Codex adversarial review round before merging to `stable`/deploying, following the existing `.collab/{plans,reviews,dialogue}/` pattern. This plan does not execute that round itself — flag it as the next step after all 10 tasks are checked off.

---

## Self-review notes (spec coverage check)

- §1 (glass is chrome not content, fallbacks, perf red-lines): covered by the Global Constraints, Task 3's fallback scaffolding, Task 9's audit, and explicit content-stays-solid calls in Tasks 5 (DocumentDiffPanel excluded), 8 (shared transcript stays solid).
- §2.1 (type): Task 1.
- §2.2 (palette): Task 2.
- §2.3 (glass tokens, both surfaces): warm/editorial tokens in Task 2 + Task 3; app/cool tokens explicitly deferred to Batch 2 (see report below — this is the one place this plan intentionally does less than spec §7's literal Batch-0 description).
- §3 (ambient): Task 3 Step 1.
- §4.1 (marketing kit inventory): header/popover (Task 4), card grid/CTA (Task 5), FAQ/comparison (Task 6), hero cards (Task 7), verified/quote badge+rule (Task 7). `EditorialFooter` deliberately left solid (not named in spec, not sticky chrome) — documented in Global Constraints.
- §4.3 Batch 1 (`shared/[token]`): Task 8.
- §5 (cascade traps): explicitly out of scope — spec says "app, Batch 2 only — editorial is trap-free," verified true during research (no `isolation: isolate` or z-index override rules exist in `editorial.css`).
- §6 (a11y/perf both batches): fallback audit (Task 9), perf red-line reasoning in Global Constraints (nothing in this batch touches the forbidden surfaces).
- §7 Batch 1 verify list (all editorial pages + locales + reduced-transparency + Lighthouse/CLS): Task 10.
- §9 (testing contract): every task's typecheck/lint/build steps; i18n parity explicitly not needed (no copy changes, documented in Global Constraints); Codex round flagged in Task 10 Step 9.

No placeholder steps remain — every step above contains real, copy-pasteable code or an exact shell command.

---

## Report back to team-lead (spec ambiguities resolved during planning)

1. **`document-diff` route is in scope, despite not being named in the original brief's verification list.** `frontend/src/app/document-diff/page.tsx` wraps `DocumentDiffPanel` in `MarketingShell` with `surface="editorial"`, and `DocumentDiffPanel.tsx` directly consumes `--ed-ochre` at two sites. `.claude/rules/frontend.md`'s "Pages still on the zinc/blue app palette" list is stale on this point (a fresh read of the file mid-session showed it now says document-diff *was* editorialized in 2026-05, contradicting the CLAUDE.md snapshot pasted at the start of this task — I trusted the fresher/more detailed read plus direct code inspection). Resolution: `--ed-ochre` re-pointing at the two `DocumentDiffPanel.tsx` sites is in Task 2; `/document-diff` is in Task 10's route sweep. The rest of `DocumentDiffPanel` (its citation-excerpt content cards) explicitly stays solid — it's real content, not chrome.

2. **The true editorial (`MarketingShell`-wrapped) surface is broader than both the CLAUDE.md-documented list and the task brief's verification route list.** Direct inspection found `blog/*`, `pricing`, and `privacy` (at minimum) already render through `MarketingShell`, despite `.claude/rules/frontend.md` listing them as "still zinc/blue app palette." This didn't change this plan's task scope (palette token *values* propagate to these pages automatically with zero code changes, since none of them reference `--ed-ochre` or need new glass), but it means the actual blast radius of the Task 2 palette-value swap is larger than the named verification list. I added a spot-check of `/blog` and `/privacy` to Task 10 Step 2 to cover this, and flag it here in case the team wants a fuller audit of which pages are actually editorial-themed before Batch 2.

3. **`.ed-card` is shared by 25+ files across the whole editorial surface, including at least one CONTENT usage** (`DocumentDiffPanel`'s citation-excerpt `<article>` cards, which render real diff/quote text). Reclassing the shared `.ed-card` CSS rule to glass would have glassed that content, violating "glass is chrome not content," and would have silently touched many pages outside this batch's reviewed scope (blog posts, pricing cards, use-case cards, tool result cards). Resolution: Task 5 adds `.ed-glass` as a *second* className only on `EdCardGrid`'s own cards (the component spec §4.1 names explicitly), leaving the shared `.ed-card` rule and every other consumer untouched.

4. **"Hero cards" (spec §4.1) resolved to `HeroCollage`'s two rotated document-plate mockups** — the only literal card-shaped elements in the landing hero. `EdPageHero`'s small icon box and `FeatureGrid`'s per-tile `.ed-figure` plates were deliberately left solid since spec doesn't name them and I wanted to keep the glass blast radius matching the explicit inventory rather than over-applying by analogy.

5. **"Verified/quote demo objects use olive badge + slate rule" (spec §4.1) has no single dedicated component to anchor to.** Resolved to `FeatureGrid.tsx`'s `VisualCitations` mockup (Task 7) — it's the only marketing-kit element that literally renders a citation badge + highlighted-line rule. Two other places currently use `--ed-signal` for an arguably-verified state (`EdInlineCell`'s `true` checkmark, `DocumentDiffPanel`'s "succeeded" `CheckCircle2`) but weren't named in spec and are left as follow-up candidates, not required changes.

6. **Spec §7's "Batch 0 foundation... glass-token definitions (editorial warm + app cool)" is only partially covered here.** This plan defines and consumes the *warm/editorial* glass tokens (Task 2/3) but does **not** touch `globals.css`'s `--workbench-*` tokens (the "app cool" half), because the task brief explicitly scoped `globals.css` `.dt-*` as Batch 2 out-of-scope. I resolved this conflict in favor of the task brief (narrower, more specific instruction) over the spec's literal Batch-0 bundling — flagging it here so Batch 2's plan knows the cool glass tokens are still fully unstarted, not partially done.

7. **`EdLanguageSelector`'s popover needed a CSS selector widening not anticipated by a naive reading of spec §2.3's `.dt-editorial .ed-glass` shape**, because that component's portal renders `.dt-editorial` and `.ed-glass` on the *same* element (outside the normal `MarketingShell` DOM subtree), which a plain descendant-combinator selector wouldn't match. Task 4 Step 2b widens every Task-3 selector to also match the same-element case. This is a real CSS mechanics issue I caught during planning, not a design ambiguity, but it changes the shape of `editorial.css`'s selectors from what a literal reading of spec §2.3 implies, so flagging it.

8. **IBM Plex Sans has no 800 weight; `.ed-display` currently requests `font-weight: 800`.** Not mentioned in spec (spec just says "Inter → IBM Plex Sans," no weight discussion). Resolved by dropping to 700 (the family's heaviest true cut) rather than relying on browser font-weight-matching/synthesis behavior, which is inconsistent across browsers. This is in Task 1.

9. **`tailwind.config.ts`'s `display`/`logo`/`serif` fontFamily fallback chains reference `var(--font-inter)` directly**, independent of `--dt-body`. Since Task 1 removes the `Inter` font object entirely, leaving these unfixed would make the `font-logo`/`font-display`/`font-serif` Tailwind utilities invalid site-wide (app surface included — they're used on the wordmark in `PublicHeader`, `AppHeaderShell`, `Footer`, `auth/*`, `profile/*`, `collections/*`, `billing/*`). This is a shared-config fix required by the font migration regardless of batch boundaries; Task 1 Step 9 covers it, scoped to only the `var(--font-inter)` → `var(--font-plex-sans)` substitution (no other app-surface change).

**Plan file:** `.collab/plans/2026-08-04-liquid-glass-batch1-marketing.md`
**Task count:** 10 tasks (Task 1: type migration; Task 2: palette + ochre re-pointing; Task 3: glass utilities + ambient; Task 4: header/popover glass; Task 5: card grid/CTA glass; Task 6: FAQ/comparison glass; Task 7: hero collage glass + verified badge recolor; Task 8: shared/[token] fold-in; Task 9: fallback audit; Task 10: integration verification).

exec
/bin/zsh -lc 'git log --oneline 782f8b0..HEAD && git diff --stat 782f8b0..HEAD && git diff --name-status 782f8b0..HEAD' in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
b2bdf50 docs(review): glass Batch 1 Codex request
7987bd3 fix(glass): restore editorial paper ground, FAQ panel edge, print header
5077420 fix(glass): close a gap found in the glass fallback audit
cbe1e1c fix(glass): raise shared-page citation chip text to AA contrast
d0a761c feat(glass): fold shared/[token] into MarketingShell + editorial tokens
5fa78a8 fix(glass): recolor HeroCollage's remaining citation motifs to olive/slate
6976621 feat(glass): glass hero collage document plates, olive/slate citation badge
6c1be17 feat(glass): glass FAQ list and comparison table panel containers
0060e58 fix(glass): reduced-transparency fallback for EdCardGrid hover
3b6b060 fix(glass): keep EdCardGrid hover glass-consistent
ef1a53a feat(glass): glass EdCardGrid cards + EdCtaBanner
1a1aa69 fix(glass): restore sticky positioning on the glassed header
a8d08ac feat(glass): apply glass chrome to sticky header + language popover
00c5722 feat(glass): add ambient canvas + .ed-glass utility classes
a225ef7 docs(landing): fix two stale color comments after Counterpoint migration
016abfe feat(glass): migrate editorial palette to Counterpoint, retire --ed-ochre
fdf3e72 feat(glass): migrate editorial/UI type to Fraunces + IBM Plex Sans
 .../dialogue/2026-08-04-glass-b1-codex-request.md  |  38 +++++
 frontend/src/app/demo/DemoPageClient.tsx           |   4 +-
 frontend/src/app/editorial.css                     | 165 +++++++++++++++++++--
 frontend/src/app/globals.css                       |  26 ++--
 frontend/src/app/layout.tsx                        |  18 ++-
 frontend/src/app/shared/[token]/page.tsx           |  61 +++++---
 .../app/tools/reading-time/ReadingTimeClient.tsx   |   2 +-
 frontend/src/app/trust/TrustPageContent.tsx        |   6 +-
 frontend/src/components/Diff/DocumentDiffPanel.tsx |   4 +-
 frontend/src/components/landing/FeatureGrid.tsx    |   4 +-
 frontend/src/components/landing/HeroCollage.tsx    |  34 ++---
 frontend/src/components/marketing/EdCardGrid.tsx   |   4 +-
 .../src/components/marketing/EdComparisonTable.tsx | 121 +++++++--------
 frontend/src/components/marketing/EdCtaBanner.tsx  |   8 +-
 frontend/src/components/marketing/EdFaqList.tsx    |  12 +-
 frontend/src/components/marketing/EdInlineCell.tsx |   2 +-
 .../components/marketing/EdLanguageSelector.tsx    |   5 +-
 .../components/marketing/EditorialHeaderBase.tsx   |   6 +-
 frontend/tailwind.config.ts                        |   8 +-
 19 files changed, 357 insertions(+), 171 deletions(-)
A	.collab/dialogue/2026-08-04-glass-b1-codex-request.md
M	frontend/src/app/demo/DemoPageClient.tsx
M	frontend/src/app/editorial.css
M	frontend/src/app/globals.css
M	frontend/src/app/layout.tsx
M	frontend/src/app/shared/[token]/page.tsx
M	frontend/src/app/tools/reading-time/ReadingTimeClient.tsx
M	frontend/src/app/trust/TrustPageContent.tsx
M	frontend/src/components/Diff/DocumentDiffPanel.tsx
M	frontend/src/components/landing/FeatureGrid.tsx
M	frontend/src/components/landing/HeroCollage.tsx
M	frontend/src/components/marketing/EdCardGrid.tsx
M	frontend/src/components/marketing/EdComparisonTable.tsx
M	frontend/src/components/marketing/EdCtaBanner.tsx
M	frontend/src/components/marketing/EdFaqList.tsx
M	frontend/src/components/marketing/EdInlineCell.tsx
M	frontend/src/components/marketing/EdLanguageSelector.tsx
M	frontend/src/components/marketing/EditorialHeaderBase.tsx
M	frontend/tailwind.config.ts

2026-08-04T08:53:25.202545Z ERROR codex_models_manager::manager: failed to renew cache TTL: missing field `supports_reasoning_summaries` at line 86 column 5
codex
The change map confirms the batch is not literally limited to `editorial.css`: global font plumbing changed in `layout.tsx`, `globals.css`, and Tailwind config, while the remaining edits are marketing/shared-surface consumers. I’m treating those global type changes as the main scope-leak risk and separately checking the escalated selectors against actual DOM compositions, including the dual-surface diff component.
exec
/bin/zsh -lc 'git diff --unified=60 782f8b0..HEAD -- frontend/src/app/globals.css frontend/src/app/layout.tsx frontend/tailwind.config.ts' in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
diff --git a/frontend/src/app/globals.css b/frontend/src/app/globals.css
index 04a135c..0e174f8 100644
--- a/frontend/src/app/globals.css
+++ b/frontend/src/app/globals.css
@@ -1,104 +1,104 @@
 @tailwind base;
 @tailwind components;
 @tailwind utilities;
 
 /* ──────────────────────────────────────────────────────────────────────
    Per-script typography (system fonts, zero download), selected by `lang`.
-   Latin keeps the loaded webfonts (Inter / Newsreader / IBM Plex Mono).
+   Latin keeps the loaded webfonts (IBM Plex Sans / Fraunces / IBM Plex Mono).
    CJK / Arabic / Devanagari fall to curated SYSTEM stacks — CJK webfonts
    are multi-MB and inappropriate for a perf-sensitive marketing surface.
    Plan B: non-Latin headlines use a high-quality SANS (modern, legible at
    large sizes) rather than the generic `serif` lottery; non-Latin "mono"
    labels fall back to a proportional sans (CJK/Arabic monospace reads poorly).
    Consumed via var(--dt-serif|--dt-mono|--dt-body) in editorial.css, inline
    styles, and Tailwind's `sans`. :lang() works because LocaleProvider sets
    <html lang>. ────────────────────────────────────────────────────────── */
 :root {
-  --dt-serif: var(--font-newsreader), Georgia, serif;          /* editorial headlines (Latin serif) */
+  --dt-serif: var(--font-fraunces), Georgia, serif;            /* editorial headlines (Latin serif) */
   --dt-mono:  var(--font-plex-mono), ui-monospace, monospace;  /* editorial/code labels */
-  --dt-body:  var(--font-inter), system-ui, sans-serif;        /* body / app UI */
+  --dt-body:  var(--font-plex-sans), system-ui, sans-serif;    /* body / app UI */
 }
 html:lang(zh) {
-  --dt-serif: var(--font-inter), "PingFang SC", "HarmonyOS Sans SC", "Microsoft YaHei", "Noto Sans SC", sans-serif;
+  --dt-serif: var(--font-plex-sans), "PingFang SC", "HarmonyOS Sans SC", "Microsoft YaHei", "Noto Sans SC", sans-serif;
   --dt-mono:  var(--font-plex-mono), "PingFang SC", "Microsoft YaHei", "Noto Sans SC", sans-serif;
-  --dt-body:  var(--font-inter), "PingFang SC", "HarmonyOS Sans SC", "Microsoft YaHei", "Noto Sans SC", system-ui, sans-serif;
+  --dt-body:  var(--font-plex-sans), "PingFang SC", "HarmonyOS Sans SC", "Microsoft YaHei", "Noto Sans SC", system-ui, sans-serif;
 }
 html:lang(ja) {
-  --dt-serif: var(--font-inter), "Hiragino Sans", "Hiragino Kaku Gothic ProN", "Yu Gothic", "Meiryo", "Noto Sans JP", sans-serif;
+  --dt-serif: var(--font-plex-sans), "Hiragino Sans", "Hiragino Kaku Gothic ProN", "Yu Gothic", "Meiryo", "Noto Sans JP", sans-serif;
   --dt-mono:  var(--font-plex-mono), "Hiragino Sans", "Yu Gothic", "Noto Sans JP", sans-serif;
-  --dt-body:  var(--font-inter), "Hiragino Sans", "Hiragino Kaku Gothic ProN", "Yu Gothic", "Meiryo", "Noto Sans JP", system-ui, sans-serif;
+  --dt-body:  var(--font-plex-sans), "Hiragino Sans", "Hiragino Kaku Gothic ProN", "Yu Gothic", "Meiryo", "Noto Sans JP", system-ui, sans-serif;
 }
 html:lang(ko) {
-  --dt-serif: var(--font-inter), "Apple SD Gothic Neo", "Malgun Gothic", "Noto Sans KR", sans-serif;
+  --dt-serif: var(--font-plex-sans), "Apple SD Gothic Neo", "Malgun Gothic", "Noto Sans KR", sans-serif;
   --dt-mono:  var(--font-plex-mono), "Apple SD Gothic Neo", "Malgun Gothic", "Noto Sans KR", sans-serif;
-  --dt-body:  var(--font-inter), "Apple SD Gothic Neo", "Malgun Gothic", "Noto Sans KR", system-ui, sans-serif;
+  --dt-body:  var(--font-plex-sans), "Apple SD Gothic Neo", "Malgun Gothic", "Noto Sans KR", system-ui, sans-serif;
 }
 html:lang(ar) {
-  --dt-serif: var(--font-inter), "SF Arabic", "Geeza Pro", "Segoe UI", "Noto Naskh Arabic", "Tahoma", sans-serif;
+  --dt-serif: var(--font-plex-sans), "SF Arabic", "Geeza Pro", "Segoe UI", "Noto Naskh Arabic", "Tahoma", sans-serif;
   --dt-mono:  var(--font-plex-mono), "SF Arabic", "Geeza Pro", "Noto Naskh Arabic", "Tahoma", sans-serif;
-  --dt-body:  var(--font-inter), "SF Arabic", "Geeza Pro", "Segoe UI", "Noto Naskh Arabic", "Tahoma", system-ui, sans-serif;
+  --dt-body:  var(--font-plex-sans), "SF Arabic", "Geeza Pro", "Segoe UI", "Noto Naskh Arabic", "Tahoma", system-ui, sans-serif;
 }
 html:lang(hi) {
-  --dt-serif: var(--font-inter), "Kohinoor Devanagari", "Noto Sans Devanagari", "Nirmala UI", "Mangal", sans-serif;
+  --dt-serif: var(--font-plex-sans), "Kohinoor Devanagari", "Noto Sans Devanagari", "Nirmala UI", "Mangal", sans-serif;
   --dt-mono:  var(--font-plex-mono), "Kohinoor Devanagari", "Noto Sans Devanagari", "Nirmala UI", "Mangal", sans-serif;
-  --dt-body:  var(--font-inter), "Kohinoor Devanagari", "Noto Sans Devanagari", "Nirmala UI", "Mangal", system-ui, sans-serif;
+  --dt-body:  var(--font-plex-sans), "Kohinoor Devanagari", "Noto Sans Devanagari", "Nirmala UI", "Mangal", system-ui, sans-serif;
 }
 
 :root {
   --background: #ffffff;
   --page-background: #f6f8fc;
   --foreground: #09090b;
   --border: #e4e4e7;
   /* Surface elevation tokens. Use these instead of ad-hoc
      bg-white/bg-zinc-100 so dark mode can lift surfaces properly. */
   --surface-1: #ffffff;
   --surface-2: #f4f4f5;
   --surface-3: #e4e4e7;
   /* Citation evidence markers */
   --highlight-base: rgba(183, 121, 31, 0.10);
   --highlight-strong: rgba(245, 158, 11, 0.22);
   --highlight-line: rgba(183, 121, 31, 0.74);
   --highlight-glow: rgba(245, 158, 11, 0.22);
   /* Accent — blue. A single flat focus/accent color (not a
      gradient). Standardized 2026-05-18; blue avoids the AI indigo/violet look. */
   --accent: #1D4ED8;
   --accent-hover: #1E40AF;
   --accent-light: #DBEAFE;
   --accent-foreground: #ffffff;
   --workbench-bg: #f6f8fc;
   --workbench-canvas: #eef3fb;
   --workbench-panel: rgba(255, 255, 255, 0.76);
   --workbench-panel-solid: #ffffff;
   --workbench-panel-strong: rgba(255, 255, 255, 0.94);
   --workbench-border: #e4e4e7;
   --workbench-border-strong: rgba(67, 91, 126, 0.34);
   --workbench-grid: rgba(43, 69, 104, 0.14);
   --workbench-ink: #111827;
   --workbench-muted: #64748b;
   --workbench-glow-cyan: rgba(14, 165, 233, 0.16);
   --workbench-command: rgba(255, 255, 255, 0.88);
   --workbench-command-shadow: 0 22px 70px rgba(31, 55, 88, 0.16);
   --reader-bg: #f4f1ea;
   --reader-panel: rgba(255, 255, 255, 0.9);
   --reader-panel-solid: #ffffff;
   --reader-panel-muted: #faf8f3;
   --reader-border: #ded8ce;
   --reader-border-strong: #cfc6b8;
   --reader-ink: #1f2933;
   --reader-muted: #716b63;
   --reader-evidence: #b7791f;
   --reader-evidence-soft: #fff4d6;
   --reader-evidence-border: #f3d38c;
 }
 
 .dark {
   --background: #09090b;
   --page-background: #070707;
   --foreground: #fafafa;
   --border: rgba(255, 255, 255, 0.14);
   /* Dark mode surfaces lift progressively from the page canvas (vs.
      inverting the light ramp). Designed-for-dark: closer values reduce
      harsh contrast against pure black. */
   --surface-1: #18181b;
   --surface-2: #27272a;
   --surface-3: #3f3f46;
diff --git a/frontend/src/app/layout.tsx b/frontend/src/app/layout.tsx
index 53e4c1c..35ab72f 100644
--- a/frontend/src/app/layout.tsx
+++ b/frontend/src/app/layout.tsx
@@ -1,110 +1,116 @@
 import type { Metadata } from 'next'
-import { Inter, Sora, Newsreader, IBM_Plex_Mono } from 'next/font/google'
+import { IBM_Plex_Sans, Sora, Fraunces, IBM_Plex_Mono } from 'next/font/google'
 import './globals.css'
 import './editorial.css'
 import ErrorBoundary from '../components/ErrorBoundary'
 import { ThemeProvider } from './ThemeProvider'
 import LocaleProvider from '../i18n/LocaleProvider'
 import { Providers } from '../components/Providers'
 import { Suspense } from 'react'
 import { AuthModal } from '../components/AuthModal'
 import { AnalyticsWrapper } from '../components/AnalyticsWrapper'
 import { CookieConsentBanner } from '../components/CookieConsentBanner'
 
-const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' })
+const plexSans = IBM_Plex_Sans({
+  subsets: ['latin'],
+  weight: ['400', '500', '600', '700'],
+  variable: '--font-plex-sans',
+  display: 'swap',
+})
 const sora = Sora({
   subsets: ['latin'],
   variable: '--font-logo',
   weight: ['500', '600', '700'],
   display: 'swap',
 })
 
-const newsreader = Newsreader({
+const fraunces = Fraunces({
   subsets: ['latin'],
-  weight: ['400', '500', '600'],
-  variable: '--font-newsreader',
+  style: ['normal', 'italic'],
+  axes: ['opsz', 'SOFT'],
+  variable: '--font-fraunces',
   display: 'swap',
 })
 
 const plexMono = IBM_Plex_Mono({
   subsets: ['latin'],
   weight: ['400', '500'],
   variable: '--font-plex-mono',
   display: 'swap',
 })
 
 export const metadata: Metadata = {
   metadataBase: new URL('https://www.doctalk.site'),
   title: {
     default: 'DocTalk — AI Document Chat with Cited Answers',
     template: '%s | DocTalk',
   },
   description: 'Upload any document and chat with AI. Get instant answers with source citations that highlight in your document. Supports PDF, DOCX, PPTX, XLSX, and more.',
   alternates: {
     canonical: '/',
   },
   openGraph: {
     title: 'DocTalk — AI Document Chat',
     description: 'Chat with your documents. AI answers with page-level citations.',
     type: 'website',
     url: 'https://www.doctalk.site',
     siteName: 'DocTalk',
     locale: 'en_US',
   },
   twitter: {
     card: 'summary_large_image',
     title: 'DocTalk — AI Document Chat',
     description: 'Chat with your documents. AI answers with page-level citations.',
   },
   icons: {
     icon: [{ url: '/icon.svg', type: 'image/svg+xml', sizes: 'any' }],
     apple: [{ url: '/logo-icon.png', type: 'image/png', sizes: '512x512' }],
   },
 }
 
 export default function RootLayout({
   children,
 }: {
   children: React.ReactNode
 }) {
   // <html lang> starts at "en" at SSR time so every page can prerender
   // statically and hit Vercel's CDN. LocaleProvider mutates
   // document.documentElement.lang on mount via client-side detection
   // (localStorage + navigator.language). The earlier `await cookies()`
   // here — together with the removed middleware.ts locale cookie —
   // was the direct cause of `Cache-Control: private, no-store` on every
   // SEO page and is the single biggest unlock for organic traffic.
   return (
-    <html lang="en" suppressHydrationWarning className={`${inter.variable} ${sora.variable} ${newsreader.variable} ${plexMono.variable}`}>
+    <html lang="en" suppressHydrationWarning className={`${plexSans.variable} ${sora.variable} ${fraunces.variable} ${plexMono.variable}`}>
       <head>
         <meta name="google-site-verification" content="168G1TYJfQ7MNp4sNdF-7gC2wDWKGeds618LyLdkCUM" />
         <meta name="msvalidate.01" content="50E7D296303C85BC31C1BE98539EA393" />
         <meta name="theme-color" content="#ffffff" media="(prefers-color-scheme: light)" />
         <meta name="theme-color" content="#09090b" media="(prefers-color-scheme: dark)" />
       </head>
       <body className="font-sans antialiased">
         {/* i18n: skip link is server-rendered, locale-specific version requires server-side i18n */}
         <a
           href="#page-content"
           className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-zinc-900 focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-white dark:focus:bg-zinc-100 dark:focus:text-zinc-900"
         >
           Skip to content
         </a>
         <ThemeProvider>
           <Providers>
             <LocaleProvider>
               <ErrorBoundary>
                 <div id="page-content" className="dt-stitch-root">{children}</div>
                 <Suspense fallback={null}>
                   <AuthModal />
                 </Suspense>
                 <CookieConsentBanner />
               </ErrorBoundary>
             </LocaleProvider>
           </Providers>
         </ThemeProvider>
         <AnalyticsWrapper />
       </body>
     </html>
   )
 }
diff --git a/frontend/tailwind.config.ts b/frontend/tailwind.config.ts
index ac1918d..661cc25 100644
--- a/frontend/tailwind.config.ts
+++ b/frontend/tailwind.config.ts
@@ -1,80 +1,80 @@
 import type { Config } from 'tailwindcss'
 
 const config: Config = {
   darkMode: 'class',
   content: [
     './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
     './src/components/**/*.{js,ts,jsx,tsx,mdx}',
     './src/app/**/*.{js,ts,jsx,tsx,mdx}',
   ],
   theme: {
     extend: {
       fontFamily: {
-        // --dt-body = Inter for Latin, + curated system CJK/Arabic/Devanagari
+        // --dt-body = IBM Plex Sans for Latin, + curated system CJK/Arabic/Devanagari
         // stacks under :lang() (see globals.css). Latin output is unchanged.
         sans: ['var(--dt-body)'],
-        display: ['var(--font-logo)', 'var(--font-inter)', 'system-ui', 'sans-serif'],
-        logo: ['var(--font-logo)', 'var(--font-inter)', 'system-ui', 'sans-serif'],
+        display: ['var(--font-logo)', 'var(--font-plex-sans)', 'system-ui', 'sans-serif'],
+        logo: ['var(--font-logo)', 'var(--font-plex-sans)', 'system-ui', 'sans-serif'],
         // Legacy alias: older pages still use `font-serif`, but the
         // Stitch direction is rounded sans display type, not editorial serif.
-        serif: ['var(--font-logo)', 'var(--font-inter)', 'system-ui', 'sans-serif'],
+        serif: ['var(--font-logo)', 'var(--font-plex-sans)', 'system-ui', 'sans-serif'],
       },
       colors: {
         accent: {
           DEFAULT: 'var(--accent)',
           hover: 'var(--accent-hover)',
           light: 'var(--accent-light)',
           foreground: 'var(--accent-foreground)',
         },
         surface: {
           1: 'var(--surface-1)',
           2: 'var(--surface-2)',
           3: 'var(--surface-3)',
         },
       },
       keyframes: {
         'fade-in': {
           '0%': { opacity: '0' },
           '100%': { opacity: '1' },
         },
         'slide-up': {
           '0%': { opacity: '0', transform: 'translateY(8px)' },
           '100%': { opacity: '1', transform: 'translateY(0)' },
         },
         'reveal-up': {
           '0%': { opacity: '0', transform: 'translateY(24px)' },
           '100%': { opacity: '1', transform: 'translateY(0)' },
         },
       },
       animation: {
         'fade-in': 'fade-in 150ms ease-out',
         'slide-up': 'slide-up 200ms ease-out',
         'reveal-up': 'reveal-up 600ms ease-out both',
       },
       typography: {
         DEFAULT: {
           css: {
             '--tw-prose-body': '#09090b',
             '--tw-prose-headings': '#09090b',
             '--tw-prose-bold': '#09090b',
             'code::before': { content: 'none' },
             'code::after': { content: 'none' },
             code: {
               backgroundColor: 'rgb(0 0 0 / 0.06)',
               borderRadius: '0.375rem',
               padding: '0.125rem 0.375rem',
               fontWeight: '500',
               fontSize: '0.875em',
             },
           },
         },
         invert: {
           css: {
             '--tw-prose-invert-body': '#fafafa',
             '--tw-prose-invert-headings': '#fafafa',
             '--tw-prose-invert-bold': '#fafafa',
             code: {
               backgroundColor: 'rgb(255 255 255 / 0.12)',
             },
           },
         },

exec
/bin/zsh -lc "git diff --unified=50 782f8b0..HEAD -- frontend/src/app/shared/'[token]'/page.tsx frontend/src/components/marketing/EdComparisonTable.tsx frontend/src/components/marketing/EdFaqList.tsx frontend/src/components/marketing/EdCardGrid.tsx frontend/src/components/marketing/EdCtaBanner.tsx" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
diff --git a/frontend/src/app/shared/[token]/page.tsx b/frontend/src/app/shared/[token]/page.tsx
index ded7867..0cbaf55 100644
--- a/frontend/src/app/shared/[token]/page.tsx
+++ b/frontend/src/app/shared/[token]/page.tsx
@@ -1,121 +1,136 @@
 import { createHmac } from 'node:crypto';
 import { notFound } from 'next/navigation';
 import { headers } from 'next/headers';
 import type { Metadata } from 'next';
+import MarketingShell from '../../../components/marketing/MarketingShell';
 
 const BACKEND_URL = process.env.BACKEND_INTERNAL_URL || process.env.NEXT_PUBLIC_API_BASE || '';
 // C1: ADAPTER_SECRET signs the X-Proxy-IP claim. Must match the backend's
 // settings.ADAPTER_SECRET. NOT AUTH_SECRET — AUTH_SECRET stays inside Auth.js.
 const ADAPTER_SECRET = process.env.ADAPTER_SECRET;
 
 interface SharedCitation {
   text_snippet: string;
   page: number;
   document_filename: string;
 }
 
 interface SharedMessage {
   id: string;
   role: string;
   content: string;
   citations?: SharedCitation[];
 }
 
 async function fetchShared(token: string) {
   const headersList = await headers();
   const xff = headersList.get('x-forwarded-for') || '';
   const clientIp = xff.split(',')[0]?.trim() || headersList.get('x-real-ip') || '';
 
   const backendHeaders: Record<string, string> = {};
   // C1: triple-header HMAC contract. Backend rate-limits /api/shared/{token}
   // per real visitor; this proves the IP claim came from our SSR origin and
   // not a direct attacker who can set arbitrary headers. Same trust model as
   // /api/proxy. Per-request timestamp + 60s skew window blocks replay.
   if (clientIp && ADAPTER_SECRET) {
     const ts = Math.floor(Date.now() / 1000).toString();
     const sig = createHmac('sha256', ADAPTER_SECRET)
       .update(`${clientIp}:${ts}`)
       .digest('hex');
     backendHeaders['X-Proxy-IP'] = clientIp;
     backendHeaders['X-Proxy-IP-Ts'] = ts;
     backendHeaders['X-Proxy-IP-Sig'] = sig;
   }
 
   try {
     const res = await fetch(`${BACKEND_URL}/api/shared/${token}`, {
       headers: backendHeaders,
       cache: 'no-store',
     });
     if (!res.ok) return null;
     return res.json();
   } catch {
     return null;
   }
 }
 
 export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
   const { token } = await params;
   const data = await fetchShared(token);
   if (!data) return { title: 'Not Found' };
   const preview = data.messages?.find((m: SharedMessage) => m.role === 'assistant')?.content?.slice(0, 150) || '';
   return {
     title: data.session_title,
     description: preview,
     robots: { index: false, follow: false },
     openGraph: { title: data.session_title, description: preview },
   };
 }
 
 export default async function SharedPage({ params }: { params: Promise<{ token: string }> }) {
   const { token } = await params;
   const data = await fetchShared(token);
   if (!data) notFound();
 
   return (
-    <div className="min-h-screen bg-white dark:bg-zinc-950">
-      <div className="max-w-3xl mx-auto px-4 py-8">
-        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 mb-1">{data.session_title}</h1>
-        <p className="text-sm text-zinc-500 mb-6">Document: {data.document_name}</p>
+    <MarketingShell>
+      <div className="ed-shell" style={{ maxWidth: '760px', paddingTop: '48px', paddingBottom: '64px' }}>
+        <h1 className="ed-h1">{data.session_title}</h1>
+        <p className="ed-caption" style={{ marginTop: '8px', marginBottom: '32px' }}>
+          Document: {data.document_name}
+        </p>
 
-        <div className="space-y-4">
+        <div className="flex flex-col" style={{ gap: '16px' }}>
           {data.messages.map((msg: SharedMessage, i: number) => (
             <div
               key={msg.id || i}
               id={msg.id}
-              className={`scroll-mt-6 rounded-2xl transition-[background-color,box-shadow] target:bg-blue-50 target:ring-2 target:ring-blue-300 target:ring-offset-4 target:ring-offset-white dark:target:bg-blue-950/30 dark:target:ring-blue-700 dark:target:ring-offset-zinc-950 ${
-                msg.role === 'user' ? 'flex justify-end' : ''
-              }`}
+              className={`scroll-mt-6 target:bg-[var(--ed-paper-2)] ${msg.role === 'user' ? 'flex justify-end' : ''}`}
+              style={{ transition: 'background-color 300ms ease' }}
             >
-              <div className={`max-w-[85%] rounded-xl px-4 py-3 ${
-                msg.role === 'user'
-                  ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
-                  : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100'
-              }`}>
-                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
+              <div
+                className="ed-card"
+                style={{
+                  maxWidth: '85%',
+                  ...(msg.role === 'user'
+                    ? { background: 'var(--ed-ink)', color: '#ffffff', border: '1px solid var(--ed-ink)' }
+                    : {}),
+                }}
+              >
+                <p className="ed-body" style={msg.role === 'user' ? { color: '#ffffff' } : undefined}>
+                  {msg.content}
+                </p>
                 {msg.citations && msg.citations.length > 0 && (
-                  <div className="mt-2 space-y-1">
+                  <div className="flex flex-col" style={{ marginTop: '10px', gap: '6px' }}>
                     {msg.citations.map((c, j: number) => (
-                      <div key={j} className="text-xs text-zinc-500 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-700 rounded px-2 py-1">
+                      <div
+                        key={j}
+                        className="ed-caption"
+                        style={{
+                          border: '1px solid var(--ed-rule)',
+                          background: 'var(--ed-paper-2)',
+                          padding: '4px 8px',
+                          borderRadius: '3px',
+                          color: 'var(--ed-ink-2)',
+                        }}
+                      >
                         p. {c.page}{c.document_filename ? ` — ${c.document_filename}` : ''}: &ldquo;{c.text_snippet}&rdquo;
                       </div>
                     ))}
                   </div>
                 )}
               </div>
             </div>
           ))}
         </div>
 
-        <div className="mt-12 text-center border-t border-zinc-200 dark:border-zinc-800 pt-6">
-          <p className="text-sm text-zinc-500 mb-3">Powered by DocTalk</p>
-          <a
-            href="https://www.doctalk.site"
-            className="inline-block px-6 py-2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
-          >
+        <div style={{ marginTop: '48px', textAlign: 'center', borderTop: '1px solid var(--ed-rule)', paddingTop: '24px' }}>
+          <p className="ed-caption" style={{ marginBottom: '12px' }}>Powered by DocTalk</p>
+          <a href="https://www.doctalk.site" className="ed-cta">
             Try DocTalk Free
           </a>
         </div>
       </div>
-    </div>
+    </MarketingShell>
   );
 }
diff --git a/frontend/src/components/marketing/EdCardGrid.tsx b/frontend/src/components/marketing/EdCardGrid.tsx
index afa6e55..97295d0 100644
--- a/frontend/src/components/marketing/EdCardGrid.tsx
+++ b/frontend/src/components/marketing/EdCardGrid.tsx
@@ -3,68 +3,68 @@ import Link from "next/link";
 interface CardItem {
   label?: string;
   title: string;
   body?: string;
   icon?: React.ComponentType<{ className?: string }>;
   href?: string;
 }
 
 interface EdCardGridProps {
   items: CardItem[];
   columns?: 2 | 3;
 }
 
 export default function EdCardGrid({ items, columns = 3 }: EdCardGridProps) {
   const colClass = columns === 2 ? "sm:grid-cols-2" : "sm:grid-cols-3";
 
   return (
     <div
       className={`grid grid-cols-1 ${colClass}`}
       style={{ gap: "16px", gridAutoRows: "1fr" }}
     >
       {items.map((item, index) => {
         const Icon = item.icon;
         const inner = (
           <>
             {Icon && (
               <div
                 style={{ marginBottom: "10px", color: "var(--ed-ink-3)" }}
               >
                 <Icon className="w-4 h-4" />
               </div>
             )}
             {item.label && (
               <div className="ed-label" style={{ marginBottom: "8px" }}>
                 {item.label}
               </div>
             )}
             <h3 className="ed-h3">{item.title}</h3>
             {item.body && (
               <p className="ed-body" style={{ marginTop: "8px" }}>
                 {item.body}
               </p>
             )}
           </>
         );
 
         return item.href ? (
           <Link
             key={`card-${index}`}
             href={item.href}
-            className="ed-card h-full"
+            className="ed-card ed-glass h-full"
             style={{ display: "flex", flexDirection: "column" }}
           >
             {inner}
           </Link>
         ) : (
           <div
             key={`card-${index}`}
-            className="ed-card h-full"
+            className="ed-card ed-glass h-full"
             style={{ display: "flex", flexDirection: "column" }}
           >
             {inner}
           </div>
         );
       })}
     </div>
   );
 }
diff --git a/frontend/src/components/marketing/EdComparisonTable.tsx b/frontend/src/components/marketing/EdComparisonTable.tsx
index 13cfa23..7b44a5e 100644
--- a/frontend/src/components/marketing/EdComparisonTable.tsx
+++ b/frontend/src/components/marketing/EdComparisonTable.tsx
@@ -57,125 +57,126 @@ interface MultiCompetitorProps {
  *
  * Styling (hairline border, DocTalk-column emphasis, scope attributes) is
  * identical across both shapes — extending to N cols preserves the editorial
  * look of the 3-col version.
  */
 export type EdComparisonTableProps = SingleCompetitorProps | MultiCompetitorProps;
 
 function isMulti(
   props: EdComparisonTableProps
 ): props is MultiCompetitorProps {
   return Array.isArray((props as MultiCompetitorProps).competitors);
 }
 
 export default function EdComparisonTable(props: EdComparisonTableProps) {
   const { t } = useLocale();
   const featureHeader = props.featureLabel ?? t("billing.comparison.feature");
 
   // Normalize to multi-competitor shape internally.
   const competitorHeaders: string[] = isMulti(props)
     ? props.competitors
     : [props.competitorName];
 
   const rows: MultiCompetitorFeature[] = isMulti(props)
     ? props.features
     : props.features.map((feature) => ({
         name: feature.name,
         doctalk: feature.doctalk,
         competitors: [feature.competitor],
       }));
 
   const competitorCount = competitorHeaders.length;
   // Match legacy single-competitor layout exactly: 40 / 30 / 30.
   // For N>1 competitors, give 40% to feature column and split the rest evenly
   // between DocTalk + each competitor (so a 3-competitor table is 40 / 15 / 15 / 15 / 15).
   const featureColWidth = "40%";
   const dataColWidth = competitorCount === 1
     ? "30%"
     : `${60 / (competitorCount + 1)}%`;
 
   const headStyle: React.CSSProperties = {
     padding: "14px 18px",
     textAlign: "center",
     width: dataColWidth,
   };
   const cellStyle: React.CSSProperties = {
     padding: "13px 18px",
     textAlign: "center",
   };
 
   return (
-    <div style={{ overflowX: "auto" }}>
-      <table
-        style={{
-          width: "100%",
-          borderCollapse: "collapse",
-          minWidth: competitorCount > 1 ? "600px" : "480px",
-          border: "1px solid var(--ed-rule)",
-        }}
-      >
-        <thead>
-          <tr style={{ borderBottom: "1px solid var(--ed-rule)" }}>
-            <th
-              scope="col"
-              className="ed-label"
-              style={{
-                width: featureColWidth,
-                padding: "14px 18px",
-                textAlign: "left",
-              }}
-            >
-              {featureHeader}
-            </th>
-            <th
-              scope="col"
-              className="ed-label"
-              style={{
-                ...headStyle,
-                background: "var(--ed-paper-2)",
-                color: "var(--ed-signal)",
-              }}
-            >
-              DocTalk
-            </th>
-            {competitorHeaders.map((name, i) => (
-              <th key={`${name}-${i}`} scope="col" className="ed-label" style={headStyle}>
-                {name}
-              </th>
-            ))}
-          </tr>
-        </thead>
-        <tbody>
-          {rows.map((feature, i) => (
-            <tr key={i} style={{ borderTop: "1px solid var(--ed-rule)" }}>
+    <div className="ed-glass" style={{ padding: "4px", overflow: "hidden" }}>
+      <div style={{ overflowX: "auto" }}>
+        <table
+          style={{
+            width: "100%",
+            borderCollapse: "collapse",
+            minWidth: competitorCount > 1 ? "600px" : "480px",
+          }}
+        >
+          <thead>
+            <tr style={{ borderBottom: "1px solid var(--ed-rule)" }}>
               <th
-                scope="row"
-                className="ed-body"
+                scope="col"
+                className="ed-label"
                 style={{
-                  padding: "13px 18px",
-                  fontWeight: 500,
-                  color: "var(--ed-ink)",
+                  width: featureColWidth,
+                  padding: "14px 18px",
                   textAlign: "left",
                 }}
               >
-                {feature.name}
+                {featureHeader}
               </th>
-              <td
+              <th
+                scope="col"
+                className="ed-label"
                 style={{
-                  ...cellStyle,
+                  ...headStyle,
                   background: "var(--ed-paper-2)",
+                  color: "var(--ed-signal)",
                 }}
               >
-                <EdInlineCell value={feature.doctalk} />
-              </td>
-              {feature.competitors.map((value, j) => (
-                <td key={j} style={cellStyle}>
-                  <EdInlineCell value={value} />
-                </td>
+                DocTalk
+              </th>
+              {competitorHeaders.map((name, i) => (
+                <th key={`${name}-${i}`} scope="col" className="ed-label" style={headStyle}>
+                  {name}
+                </th>
               ))}
             </tr>
-          ))}
-        </tbody>
-      </table>
+          </thead>
+          <tbody>
+            {rows.map((feature, i) => (
+              <tr key={i} style={{ borderTop: "1px solid var(--ed-rule)" }}>
+                <th
+                  scope="row"
+                  className="ed-body"
+                  style={{
+                    padding: "13px 18px",
+                    fontWeight: 500,
+                    color: "var(--ed-ink)",
+                    textAlign: "left",
+                  }}
+                >
+                  {feature.name}
+                </th>
+                <td
+                  style={{
+                    ...cellStyle,
+                    background: "var(--ed-paper-2)",
+                  }}
+                >
+                  <EdInlineCell value={feature.doctalk} />
+                </td>
+                {feature.competitors.map((value, j) => (
+                  <td key={j} style={cellStyle}>
+                    <EdInlineCell value={value} />
+                  </td>
+                ))}
+              </tr>
+            ))}
+          </tbody>
+        </table>
+      </div>
     </div>
   );
 }
diff --git a/frontend/src/components/marketing/EdCtaBanner.tsx b/frontend/src/components/marketing/EdCtaBanner.tsx
index 584f547..7a46a9f 100644
--- a/frontend/src/components/marketing/EdCtaBanner.tsx
+++ b/frontend/src/components/marketing/EdCtaBanner.tsx
@@ -1,72 +1,66 @@
 import Link from "next/link";
 
 interface CtaLink {
   label: string;
   href: string;
 }
 
 interface EdCtaBannerProps {
   title?: string;
   description?: string;
   primary: CtaLink;
   secondary?: CtaLink;
 }
 
 export default function EdCtaBanner({
   title,
   description,
   primary,
   secondary,
 }: EdCtaBannerProps) {
   return (
-    <section
-      className="ed-section"
-      style={{
-        background: "var(--ed-paper-2)",
-        borderTop: "1px solid var(--ed-rule)",
-      }}
-    >
+    <section className="ed-section ed-glass ed-glass--cta">
       <div className="ed-shell">
         <div
           style={{
             textAlign: "center",
             margin: "0 auto",
             maxWidth: "640px",
           }}
         >
           {title && <h2 className="ed-h2">{title}</h2>}
 
           {description && (
             <p
               className="ed-lede"
               style={title ? { marginTop: "14px" } : undefined}
             >
               {description}
             </p>
           )}
 
           <div
             style={{
               marginTop: "26px",
               display: "flex",
               gap: "16px",
               flexWrap: "wrap",
               justifyContent: "center",
               alignItems: "center",
             }}
           >
             <Link href={primary.href} className="ed-cta">
               {primary.label}
             </Link>
 
             {secondary && (
               <Link href={secondary.href} className="ed-link">
                 {secondary.label} <span aria-hidden="true">→</span>
               </Link>
             )}
           </div>
         </div>
       </div>
     </section>
   );
 }
diff --git a/frontend/src/components/marketing/EdFaqList.tsx b/frontend/src/components/marketing/EdFaqList.tsx
index 9b25a8e..513beea 100644
--- a/frontend/src/components/marketing/EdFaqList.tsx
+++ b/frontend/src/components/marketing/EdFaqList.tsx
@@ -1,145 +1,145 @@
 "use client";
 
 import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
 
 // SSR-safe layout effect — useLayoutEffect warns under server rendering, so
 // we fall back to useEffect when `window` isn't available. This keeps the
 // first painted frame in sync with the measured scrollHeight on the client
 // (no collapsed→expanded jump) while remaining safe for any SSR boundary.
 const useIsomorphicLayoutEffect =
   typeof window !== "undefined" ? useLayoutEffect : useEffect;
 
 interface FaqItem {
   question: string;
   answer: string;
 }
 
 interface EdFaqListProps {
   items: FaqItem[];
 }
 
 export default function EdFaqList({ items }: EdFaqListProps) {
   const [openIndex, setOpenIndex] = useState<number | null>(null);
 
   const toggle = (idx: number) => {
     setOpenIndex(openIndex === idx ? null : idx);
   };
 
   return (
-    <div>
+    <div className="ed-glass" style={{ padding: "6px 28px" }}>
       {items.map((item, index) => {
         const isOpen = openIndex === index;
         const questionNum = `Q${index + 1}`;
 
         return (
           <FaqRow
             key={`faq-${index}`}
             index={index}
             questionNum={questionNum}
             question={item.question}
             answer={item.answer}
             isOpen={isOpen}
-            isLast={index === items.length - 1}
             onToggle={() => toggle(index)}
           />
         );
       })}
     </div>
   );
 }
 
 interface FaqRowProps {
   index: number;
   questionNum: string;
   question: string;
   answer: string;
   isOpen: boolean;
-  isLast: boolean;
   onToggle: () => void;
 }
 
 function FaqRow({
   index,
   questionNum,
   question,
   answer,
   isOpen,
-  isLast,
   onToggle,
 }: FaqRowProps) {
   const contentRef = useRef<HTMLDivElement>(null);
   const [height, setHeight] = useState(0);
 
   useIsomorphicLayoutEffect(() => {
     const el = contentRef.current;
     if (!el || !isOpen) return;
     setHeight(el.scrollHeight);
     const ro = new ResizeObserver(() => setHeight(el.scrollHeight));
     ro.observe(el);
     return () => ro.disconnect();
   }, [isOpen]);
 
   const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
   useEffect(() => {
     const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
     setPrefersReducedMotion(mq.matches);
     const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
     mq.addEventListener("change", handler);
     return () => mq.removeEventListener("change", handler);
   }, []);
 
   return (
     <div
       style={{
-        borderTop: "1px solid var(--ed-rule)",
-        borderBottom: isLast ? "1px solid var(--ed-rule)" : undefined,
+        // Rows divide each other, but the glass panel's own border already
+        // closes the list — drawing an edge rule here too puts a second,
+        // shorter hairline 6px inside the panel edge (the wrapper's vertical
+        // padding), which reads as a stray line rather than a divider.
+        borderTop: index === 0 ? undefined : "1px solid var(--ed-rule)",
       }}
     >
       <button
         type="button"
         id={`ed-faq-btn-${index}`}
         onClick={onToggle}
         aria-expanded={isOpen}
         aria-controls={`ed-faq-panel-${index}`}
         style={{
           display: "flex",
           justifyContent: "space-between",
           alignItems: "flex-start",
           gap: "24px",
           textAlign: "left",
           width: "100%",
           padding: "20px 0",
           cursor: "pointer",
           background: "transparent",
           border: "none",
         }}
       >
         {/* Left: number + question */}
         <span
           style={{
             display: "flex",
             alignItems: "baseline",
             gap: "16px",
             flex: 1,
           }}
         >
           <span
             className="ed-caption"
             aria-hidden="true"
             style={{ color: "var(--ed-signal)", flexShrink: 0 }}
           >
             {questionNum}
           </span>
           <span className="ed-h3">{question}</span>
         </span>
 
         {/* Right: +/− indicator */}
         <span
           className="ed-caption"
           aria-hidden="true"
           style={{
             flexShrink: 0,
             fontSize: "16px",
             letterSpacing: 0,
             color: "var(--ed-ink-3)",
             marginTop: "2px",

exec
/bin/zsh -lc 'git diff --unified=50 782f8b0..HEAD -- frontend/src/components/landing/HeroCollage.tsx frontend/src/components/landing/FeatureGrid.tsx frontend/src/components/marketing/EdLanguageSelector.tsx frontend/src/components/marketing/EditorialHeaderBase.tsx frontend/src/components/Diff/DocumentDiffPanel.tsx frontend/src/app/demo/DemoPageClient.tsx frontend/src/app/tools/reading-time/ReadingTimeClient.tsx frontend/src/app/trust/TrustPageContent.tsx frontend/src/components/marketing/EdInlineCell.tsx' in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
diff --git a/frontend/src/app/demo/DemoPageClient.tsx b/frontend/src/app/demo/DemoPageClient.tsx
index c7be17b..6754f59 100644
--- a/frontend/src/app/demo/DemoPageClient.tsx
+++ b/frontend/src/app/demo/DemoPageClient.tsx
@@ -76,101 +76,101 @@ export default function DemoPageClient() {
       ]}
     >
       <EdPageHero
         eyebrow={tOr('demo.eyebrow', 'Public demo')}
         title={t('demo.title')}
         lede={t('demo.subtitle')}
         meta={
           <div className="flex gap-4 flex-wrap">
             <span className="inline-flex items-center gap-2">
               <FileCheck2
                 aria-hidden="true"
                 size={14}
                 style={{ color: 'var(--ed-ink-3)' }}
               />
               <span className="ed-caption">{t('demo.freeMessages')}</span>
             </span>
             <span className="inline-flex items-center gap-2">
               <Quote
                 aria-hidden="true"
                 size={14}
                 style={{ color: 'var(--ed-ink-3)' }}
               />
               <span className="ed-caption">
                 {tOr('demo.citationPromise', 'Click citations to inspect the source')}
               </span>
             </span>
           </div>
         }
       />
 
       <EdSection title={tOr('demo.flow.title', 'What you will test')}>
         <EdStepRow
           steps={[
             { title: tOr('demo.flow.step1', 'Open a prepared document'), body: '' },
             { title: tOr('demo.flow.step2', 'Ask the suggested question'), body: '' },
             { title: tOr('demo.flow.step3', 'Jump from answer to source'), body: '' },
           ]}
         />
       </EdSection>
 
       <EdSection alt label={tOr('demo.samplesLabel', 'Sample documents')}>
         {error && (
           <div
             style={{
               border: '1px solid var(--ed-rule)',
               padding: '14px 16px',
               marginBottom: '24px',
             }}
           >
             <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
-              <span className="ed-body" style={{ color: 'var(--ed-ochre)' }}>
+              <span className="ed-body" style={{ color: 'var(--ed-signal-deep)' }}>
                 {tOr('demo.loadError', 'Demo documents could not be loaded.')}
               </span>
               <button
                 type="button"
                 onClick={fetchDocs}
                 className="ed-caption inline-flex items-center justify-center shrink-0"
                 style={{
                   border: '1px solid var(--ed-rule)',
                   background: 'var(--ed-paper)',
                   color: 'var(--ed-ink)',
                   padding: '7px 14px',
                 }}
               >
                 {tOr('common.retry', 'Retry')}
               </button>
             </div>
           </div>
         )}
 
         <div className="grid grid-cols-1 lg:grid-cols-3" style={{ gap: '16px' }}>
           {Object.entries(SAMPLE_CONFIG).map(([slug, config]) => {
             const doc = docsBySlug.get(slug);
             const Icon = config.icon;
             const isReady = Boolean(doc && doc.status === 'ready');
             const isPending = loading || Boolean(doc && doc.status !== 'ready');
             const suggestedQuestion = t(config.questionKey);
             const cardContent = (
               <>
                 <div className="flex items-center justify-between">
                   <span className="ed-caption uppercase">
                     {tOr(`demo.sample.${slug}.badge`, config.badge)}
                   </span>
                   <span className="ed-caption">
                     {tOr(`demo.sample.${slug}.pages`, config.pages)}
                   </span>
                 </div>
 
                 <div
                   className="flex items-center justify-between gap-3"
                   style={{ marginTop: '18px' }}
                 >
                   <div
                     style={{
                       width: '44px',
                       height: '44px',
                       border: '1px solid var(--ed-rule)',
                       background: 'var(--ed-paper-2)',
                       display: 'flex',
                       alignItems: 'center',
                       justifyContent: 'center',
@@ -188,91 +188,91 @@ export default function DemoPageClient() {
                     >
                       <Loader2 aria-hidden="true" size={12} className="animate-spin" />
                       {loading ? tOr('common.loading', 'Loading') : t('demo.processing')}
                     </span>
                   )}
                 </div>
 
                 <h3 className="ed-h3" style={{ marginTop: '16px' }}>
                   {t(config.titleKey)}
                 </h3>
                 <p className="ed-body" style={{ marginTop: '8px' }}>
                   {t(config.descKey)}
                 </p>
 
                 <div
                   style={{
                     marginTop: '18px',
                     border: '1px solid var(--ed-rule)',
                     background: 'var(--ed-paper)',
                     padding: '12px 14px',
                   }}
                 >
                   <p className="ed-caption uppercase">
                     {tOr('demo.suggestedQuestion', 'Suggested question')}
                   </p>
                   <p
                     className="ed-body"
                     style={{
                       marginTop: '8px',
                       fontFamily: 'var(--dt-serif)',
                       fontStyle: 'italic',
                     }}
                   >
                     &ldquo;{suggestedQuestion}&rdquo;
                   </p>
                 </div>
 
                 <div
                   className="flex items-center justify-between gap-3"
                   style={{
                     marginTop: 'auto',
                     paddingTop: '18px',
                   }}
                 >
                   <span className="ed-caption">
                     {isReady ? tOr('demo.ready', 'Ready to open') : tOr('demo.preparing', 'Preparing sample')}
                   </span>
                   <span
                     className="inline-flex items-center gap-1.5"
                     style={{
-                      fontFamily: 'var(--font-inter), sans-serif',
+                      fontFamily: 'var(--font-plex-sans), sans-serif',
                       fontSize: '14px',
                       fontWeight: 500,
                       color: 'var(--ed-ink)',
                     }}
                   >
                     {tOr('demo.openSample', 'Open sample')}
                     <ArrowRight aria-hidden="true" size={15} />
                   </span>
                 </div>
               </>
             );
 
             return isReady && doc ? (
               <Link
                 key={slug}
                 href={`/d/${doc.document_id}?question=${encodeURIComponent(suggestedQuestion)}`}
                 className="ed-card flex flex-col h-full"
                 style={{ minHeight: '390px' }}
               >
                 {cardContent}
               </Link>
             ) : (
               <div
                 key={slug}
                 className="ed-card flex flex-col h-full"
                 style={{ minHeight: '390px', opacity: 0.7 }}
               >
                 {cardContent}
               </div>
             );
           })}
         </div>
 
         <p className="ed-caption" style={{ marginTop: '32px' }}>
           {t('demo.hint')}
         </p>
       </EdSection>
     </MarketingShell>
   );
 }
diff --git a/frontend/src/app/tools/reading-time/ReadingTimeClient.tsx b/frontend/src/app/tools/reading-time/ReadingTimeClient.tsx
index e181a2f..bae67b6 100644
--- a/frontend/src/app/tools/reading-time/ReadingTimeClient.tsx
+++ b/frontend/src/app/tools/reading-time/ReadingTimeClient.tsx
@@ -248,101 +248,101 @@ export default function ReadingTimeClient() {
                     <div
                       className="flex-1 overflow-hidden"
                       style={{ height: '6px', background: 'var(--ed-rule)', borderRadius: '3px' }}
                     >
                       <div
                         style={{
                           height: '100%',
                           borderRadius: '3px',
                           background: 'var(--ed-signal)',
                           transition: 'width 300ms',
                           width: wordCount > 0
                             ? `${Math.min(100, (row.wpm / 350) * 100)}%`
                             : '0%',
                         }}
                       />
                     </div>
                     <span
                       className="ed-body tabular-nums text-right"
                       style={{ marginTop: 0, fontWeight: 600, color: 'var(--ed-ink)', minWidth: '5rem' }}
                     >
                       {wordCount > 0 ? formatDuration(row.minutes, t) : '--'}
                     </span>
                   </div>
                 </div>
               ))}
             </div>
           </div>
 
           {/* Speaking Time */}
           <div style={panelStyle}>
             <div className="flex items-center" style={{ gap: '8px', marginBottom: '16px' }}>
               <Mic aria-hidden="true" className="w-4 h-4" style={{ color: 'var(--ed-ink-3)' }} />
               <h2 className="ed-h3">{t('toolReadingTime.speakingTimeHeading')}</h2>
             </div>
             <div className="flex flex-col" style={{ gap: '16px' }}>
               {speakingSpeeds.map((row) => (
                 <div key={row.label}>
                   <div className="flex items-center justify-between" style={{ marginBottom: '4px', gap: '12px' }}>
                     <span className="ed-caption">{row.label}</span>
                     <span className="ed-caption tabular-nums">{t('toolReadingTime.wpmValue', { wpm: row.wpm })}</span>
                   </div>
                   <div className="flex items-center" style={{ gap: '12px' }}>
                     <div
                       className="flex-1 overflow-hidden"
                       style={{ height: '6px', background: 'var(--ed-rule)', borderRadius: '3px' }}
                     >
                       <div
                         style={{
                           height: '100%',
                           borderRadius: '3px',
-                          background: 'var(--ed-ochre)',
+                          background: 'var(--ed-slate-2)',
                           transition: 'width 300ms',
                           width: wordCount > 0
                             ? `${Math.min(100, (row.wpm / 180) * 100)}%`
                             : '0%',
                         }}
                       />
                     </div>
                     <span
                       className="ed-body tabular-nums text-right"
                       style={{ marginTop: 0, fontWeight: 600, color: 'var(--ed-ink)', minWidth: '5rem' }}
                     >
                       {wordCount > 0 ? formatSeconds(row.minutes, t) : '--'}
                     </span>
                   </div>
                 </div>
               ))}
             </div>
           </div>
         </div>
 
         {/* Comparison Reference Table */}
         <div style={{ ...panelStyle, marginTop: '24px' }}>
           <h2 className="ed-h3" style={{ marginBottom: '16px' }}>
             {t('toolReadingTime.referenceHeading')}
           </h2>
           <div className="overflow-x-auto">
             <table style={{ width: '100%', borderCollapse: 'collapse' }}>
               <thead>
                 <tr style={{ borderBottom: '1px solid var(--ed-rule)' }}>
                   <th className="ed-label" style={{ textAlign: 'left', padding: '8px' }}>
                     {t('toolReadingTime.colDocumentType')}
                   </th>
                   <th className="ed-label" style={{ textAlign: 'right', padding: '8px' }}>
                     {t('toolReadingTime.colTypicalWords')}
                   </th>
                   <th className="ed-label" style={{ textAlign: 'right', padding: '8px' }}>
                     {t('toolReadingTime.colReadingTime')}
                   </th>
                   <th className="ed-label" style={{ textAlign: 'right', padding: '8px' }}>
                     {t('toolReadingTime.colSpeakingTime')}
                   </th>
                 </tr>
               </thead>
               <tbody>
                 {referenceTable.map((row) => {
                   const Icon = row.icon;
                   return (
                     <tr key={row.type} style={{ borderBottom: '1px solid var(--ed-rule)' }}>
                       <td className="ed-body" style={{ marginTop: 0, padding: '10px 8px' }}>
                         <Icon aria-hidden="true" size={14} className="mr-2 inline-block" style={{ color: 'var(--ed-ink-3)' }} />
diff --git a/frontend/src/app/trust/TrustPageContent.tsx b/frontend/src/app/trust/TrustPageContent.tsx
index 9003614..cb139cc 100644
--- a/frontend/src/app/trust/TrustPageContent.tsx
+++ b/frontend/src/app/trust/TrustPageContent.tsx
@@ -161,149 +161,149 @@ export default async function TrustPageContent({ locale }: { locale: string }) {
     <MarketingShell
       chrome={chrome}
       breadcrumb={[
         { label: t("useCasesHub.breadcrumb.home"), href: href("/") },
         { label: t("trust.breadcrumb.current") },
       ]}
     >
       <EdPageHero
         eyebrow={t("trust.hero.eyebrow")}
         title={t("trust.hero.title")}
         lede={t("trust.hero.lede")}
         meta={
           <div className="flex gap-4 flex-wrap items-center">
             <Link href={href("/privacy")} className="ed-cta">
               {t("trust.hero.privacyCta")}
             </Link>
             <Link href={href("/contact")} className="ed-link">
               {t("trust.hero.reportCta")} <span aria-hidden="true">→</span>
             </Link>
           </div>
         }
       />
 
       <EdSection alt label={t("trust.summary.label")}>
         <div
           className="grid grid-cols-1 sm:grid-cols-3"
           style={{ gap: "16px" }}
         >
           {trustStats.map((stat) => (
             <div
               key={stat.label}
               style={{
                 border: "1px solid var(--ed-rule)",
                 background: "var(--ed-paper-2)",
                 padding: "16px",
               }}
             >
               <div className="ed-h3">{stat.value}</div>
               <p className="ed-caption" style={{ marginTop: "6px" }}>
                 {stat.label}
               </p>
             </div>
           ))}
         </div>
         <p
           className="ed-caption"
           style={{
             marginTop: "20px",
             padding: "12px 14px",
             border: "1px solid var(--ed-rule)",
-            color: "var(--ed-ochre)",
+            color: "var(--ed-signal-deep)",
           }}
         >
           {t("trust.summary.disclaimer")}
         </p>
       </EdSection>
 
       <EdSection num="01" title={t("trust.encryption.heading")}>
         <div
           className="grid grid-cols-1 md:grid-cols-3"
           style={{ gap: "16px", gridAutoRows: "1fr" }}
         >
           {encryptionControls.map((c) => (
             <ControlCard key={c.title} {...c} />
           ))}
         </div>
       </EdSection>
 
       <EdSection alt num="02" title={t("trust.ingest.heading")}>
         <div
           className="grid grid-cols-1 md:grid-cols-3"
           style={{ gap: "16px", gridAutoRows: "1fr" }}
         >
           {ingestControls.map((c) => (
             <ControlCard key={c.title} {...c} />
           ))}
         </div>
       </EdSection>
 
       <EdSection num="03" title={t("trust.dataRights.heading")}>
         <div
           className="grid grid-cols-1 md:grid-cols-3"
           style={{ gap: "16px", gridAutoRows: "1fr" }}
         >
           {dataRightsControls.map((c) => (
             <ControlCard key={c.title} {...c} />
           ))}
         </div>
       </EdSection>
 
       <EdSection alt num="04" title={t("trust.gaps.heading")}>
         <div>
           {gaps.map((g, i) => (
             <div
               key={g.name}
               className="flex flex-col md:flex-row"
               style={{
                 padding: "18px 0",
                 borderTop: "1px solid var(--ed-rule)",
                 borderBottom:
                   i === gaps.length - 1 ? "1px solid var(--ed-rule)" : undefined,
                 gap: "12px",
               }}
             >
               <div className="md:w-64 shrink-0">
                 <div className="ed-body" style={{ fontWeight: 600 }}>
                   {g.name}
                 </div>
                 <div
                   className="ed-caption"
                   style={{
                     marginTop: "6px",
                     display: "inline-flex",
                     alignItems: "center",
                     gap: "6px",
                     textTransform: "uppercase",
-                    color: "var(--ed-ochre)",
+                    color: "var(--ed-slate)",
                   }}
                 >
                   <span
                     aria-hidden
                     style={{
                       width: "5px",
                       height: "5px",
-                      background: "var(--ed-ochre)",
+                      background: "var(--ed-slate)",
                     }}
                   />
                   {g.status}
                 </div>
               </div>
               <p className="ed-body" style={{ flex: 1 }}>
                 {g.note}
               </p>
             </div>
           ))}
         </div>
       </EdSection>
 
       <EdCtaBanner
         title={t("trust.cta.title")}
         description={t("trust.cta.description")}
         primary={{ label: t("trust.cta.primary"), href: href("/contact") }}
         secondary={{ label: t("trust.cta.secondary"), href: href("/privacy") }}
       />
     
       <MarketingLocaleLinks path="/trust" label={chrome.language} />
     </MarketingShell>
   );
 }
diff --git a/frontend/src/components/Diff/DocumentDiffPanel.tsx b/frontend/src/components/Diff/DocumentDiffPanel.tsx
index a95eaaf..42bbefc 100644
--- a/frontend/src/components/Diff/DocumentDiffPanel.tsx
+++ b/frontend/src/components/Diff/DocumentDiffPanel.tsx
@@ -358,148 +358,148 @@ export default function DocumentDiffPanel({
                   {readyDocs.map((doc) => (
                     <option key={doc.id} value={doc.id}>{doc.filename}</option>
                   ))}
                 </select>
               </label>
               <label className="min-w-0">
                 <span className="ed-label" style={{ display: "block", marginBottom: "6px" }}>
                   {tOr("diff.newDocument", "New document")}
                 </span>
                 <select
                   value={newDocumentId}
                   onChange={(event) => setNewDocumentId(event.target.value)}
                   className="h-10 w-full"
                   style={edInputStyle}
                 >
                   {readyDocs.map((doc) => (
                     <option key={doc.id} value={doc.id}>{doc.filename}</option>
                   ))}
                 </select>
               </label>
               <button
                 type="button"
                 onClick={() => void runCompare()}
                 disabled={isWorking || readyDocs.length < 2 || oldDocumentId === newDocumentId}
                 className="ed-cta self-end disabled:cursor-not-allowed disabled:opacity-50"
               >
                 {isWorking ? <Clock3 size={15} aria-hidden="true" /> : <Play size={15} aria-hidden="true" />}
                 {isWorking ? tOr("diff.running", "Comparing...") : tOr("diff.run", "Compare")}
               </button>
             </div>
           </div>
           {readyDocs.length < 2 && (
             <p
               className="ed-caption"
               style={{
                 marginTop: "16px",
                 border: "1px dashed var(--ed-rule)",
                 background: "var(--ed-paper)",
                 borderRadius: "3px",
                 padding: "10px 14px",
               }}
             >
               {tOr("diff.needTwoDocs", "Upload or add at least two ready documents to compare.")}
             </p>
           )}
           {paywall && (
             <div
               className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
               style={{
                 marginTop: "16px",
-                border: "1px solid var(--ed-ochre)",
+                border: "1px solid var(--ed-slate)",
                 background: "var(--ed-paper)",
                 borderRadius: "3px",
                 padding: "12px 14px",
               }}
             >
               <span className="ed-body" style={{ marginTop: 0 }}>
                 {paywall.code === "INSUFFICIENT_CREDITS"
                   ? tOr("diff.paywallCredits", "You need more credits to compare these documents.")
                   : tOr("diff.paywallPlan", "Document Diff is a Pro workflow.")}
               </span>
               <Link
                 href={billingHref({ plan: "pro", source: collectionId ? "collection_reader" : "compare_page", reason: "document_diff" })}
                 className="ed-cta"
               >
                 {tOr("credits.upgradeToPro", "Upgrade to Pro")}
               </Link>
             </div>
           )}
           {error && (
             <div
               className="flex gap-2"
               style={{
                 marginTop: "16px",
                 border: "1px solid var(--ed-signal)",
                 background: "var(--ed-paper)",
                 borderRadius: "3px",
                 padding: "10px 14px",
               }}
             >
               <AlertTriangle size={16} className="mt-0.5 shrink-0" style={{ color: "var(--ed-signal)" }} aria-hidden="true" />
               <span className="ed-body" style={{ marginTop: 0, color: "var(--ed-signal-deep)" }}>{error}</span>
             </div>
           )}
         </section>
 
         {activeRun ? (
           <section style={{ ...edPanelStyle, padding: 0 }}>
             <div
               className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
               style={{ borderBottom: "1px solid var(--ed-rule)", padding: "16px 20px" }}
             >
               <div className="min-w-0">
                 <div className="flex items-center gap-2">
                   {activeRun.status === "succeeded" ? (
                     <CheckCircle2 size={16} style={{ color: "var(--ed-signal)" }} aria-hidden="true" />
                   ) : (
-                    <Clock3 size={16} style={{ color: "var(--ed-ochre)" }} aria-hidden="true" />
+                    <Clock3 size={16} style={{ color: "var(--ed-slate)" }} aria-hidden="true" />
                   )}
                   <h3 className="ed-h3 truncate" style={{ marginTop: 0 }}>
                     {oldName || tOr("diff.oldDocument", "Old document")} → {newName || tOr("diff.newDocument", "New document")}
                   </h3>
                 </div>
                 <p className="ed-caption" style={{ marginTop: "6px" }}>
                   {activeRun.status === "succeeded"
                     ? tOr("diff.completed", "Completed")
                     : tOr("diff.status", "Status: {status}", { status: activeRun.status })}
                 </p>
               </div>
               {activeRun.result && (
                 <div className="flex gap-2">
                   <button type="button" onClick={() => void handleExport("md")} className="inline-flex h-9 items-center gap-2" style={edExportBtnStyle}>
                     <Download size={14} aria-hidden="true" />
                     MD
                   </button>
                   <button type="button" onClick={() => void handleExport("csv")} className="inline-flex h-9 items-center gap-2" style={edExportBtnStyle}>
                     <Download size={14} aria-hidden="true" />
                     CSV
                   </button>
                 </div>
               )}
             </div>
 
             {activeRun.status === "failed" ? (
               <p className="ed-body" style={{ padding: "16px 20px", marginTop: 0, color: "var(--ed-signal-deep)" }}>
                 {activeRun.error_message || tOr("diff.failed", "Document comparison failed.")}
               </p>
             ) : activeRun.result ? (
               <div className="flex flex-col" style={{ gap: "20px", padding: "20px" }}>
                 <div
                   style={{
                     border: "1px solid var(--ed-rule)",
                     background: "var(--ed-paper)",
                     borderRadius: "3px",
                     padding: "16px",
                   }}
                 >
                   <p className="ed-label">{tOr("diff.summary", "Summary")}</p>
                   <p className="ed-body" style={{ marginTop: "10px" }}>{asString(result.summary)}</p>
                 </div>
                 {(["added", "removed", "modified"] as const).map((kind) => {
                   const items = groupChanges(changes, kind);
                   if (!items.length) return null;
                   const label = kind === "added"
                     ? tOr("diff.added", "Added")
                     : kind === "removed"
                       ? tOr("diff.removed", "Removed")
                       : tOr("diff.modified", "Modified");
diff --git a/frontend/src/components/landing/FeatureGrid.tsx b/frontend/src/components/landing/FeatureGrid.tsx
index 2477ca3..b19eafc 100644
--- a/frontend/src/components/landing/FeatureGrid.tsx
+++ b/frontend/src/components/landing/FeatureGrid.tsx
@@ -1,90 +1,90 @@
 "use client";
 
 import React from 'react';
 import { useLocale } from '../../i18n';
 import ScrollReveal from './ScrollReveal';
 
 /* ---------- Bespoke per-feature visuals — editorial neutrals ---------- */
 /* All backgrounds → var(--ed-paper-2), borders → var(--ed-rule),
    text → --ed-ink / --ed-ink-3, any accent → var(--ed-signal).
    No dark: variants, no gradients, no zinc-*, no blue-*.
    Decorative — aria-hidden at root. */
 
 // Shared canvas: paper-2 background, rule border, compact 112px tall.
 const canvas =
   'relative h-28 w-full overflow-hidden border border-[var(--ed-rule)] bg-[var(--ed-paper-2)]';
 
 function VisualCitations() {
   const { t } = useLocale();
   return (
     <div aria-hidden="true" className={canvas}>
       <div className="absolute inset-0 flex items-center justify-center gap-3 px-4">
         {/* Mock document page with a highlighted line */}
         <div className="relative h-20 w-28 border border-[var(--ed-rule)] bg-[var(--ed-paper)] px-2 py-1.5">
           <div className="mb-1.5 font-mono text-[7px] uppercase tracking-wider text-[var(--ed-ink-3)]">
             report.pdf · p. 4
           </div>
           <div className="space-y-1">
             <div className="h-1 w-full bg-[var(--ed-rule)]" />
-            <div className="h-1.5 w-full bg-[var(--ed-signal)]/20 border-l-2 border-[var(--ed-signal)]" />
+            <div className="h-1.5 w-full bg-[var(--ed-signal)]/20 border-l-2 border-[var(--ed-slate)]" />
             <div className="h-1 w-4/5 bg-[var(--ed-rule)]" />
             <div className="h-1 w-3/4 bg-[var(--ed-rule)]" />
           </div>
         </div>
         {/* Page badge + citation chip */}
         <div className="flex flex-col items-start gap-1.5">
           <div className="border border-[var(--ed-signal)]/40 bg-[var(--ed-paper)] px-1.5 py-0.5 font-mono text-[9px] font-semibold text-[var(--ed-signal)]">
             p. 4 · ln 3
           </div>
           <div className="inline-flex items-center border border-[var(--ed-rule)] bg-[var(--ed-paper)] px-1.5 py-1 font-mono text-[9px] text-[var(--ed-ink-2)]">
-            <span className="mr-1 inline-flex items-center justify-center bg-[var(--ed-signal)] px-1 py-0.5 text-[8px] font-bold leading-none text-white">
+            <span className="mr-1 inline-flex items-center justify-center bg-[var(--ed-olive)] px-1 py-0.5 text-[8px] font-bold leading-none text-white">
               1
             </span>
             {t('landing.plate.cite')}
           </div>
         </div>
       </div>
     </div>
   );
 }
 
 function VisualFormats() {
   const chips = ['PDF', 'DOCX', 'PPTX', 'XLSX', 'TXT', 'MD', 'URL'];
   return (
     <div aria-hidden="true" className={canvas}>
       <div className="absolute inset-0 flex items-center justify-center">
         <div className="flex max-w-[220px] flex-wrap items-center justify-center gap-1.5 px-3">
           {chips.map((c) => (
             <span
               key={c}
               className="border border-[var(--ed-rule)] bg-[var(--ed-paper)] px-2 py-1 font-mono text-[10px] font-semibold text-[var(--ed-ink-2)]"
             >
               {c}
             </span>
           ))}
         </div>
       </div>
     </div>
   );
 }
 
 function VisualLanguages() {
   const langs = ['EN', '中文', '日本語', 'ES', 'DE', 'FR', '한국어', 'PT', 'IT', 'العربية', 'हिन्दी'];
   return (
     <div aria-hidden="true" className={canvas}>
       <div className="absolute inset-0 flex items-center justify-center px-3">
         <div className="flex max-w-[220px] flex-wrap items-center justify-center gap-x-2.5 gap-y-1.5">
           {langs.map((l) => (
             <span key={l} className="text-[11px] font-semibold text-[var(--ed-ink-3)]">
               {l}
             </span>
           ))}
         </div>
       </div>
     </div>
   );
 }
 
 function VisualModes() {
   const { t } = useLocale();
   return (
diff --git a/frontend/src/components/landing/HeroCollage.tsx b/frontend/src/components/landing/HeroCollage.tsx
index 43a250b..7c1a1db 100644
--- a/frontend/src/components/landing/HeroCollage.tsx
+++ b/frontend/src/components/landing/HeroCollage.tsx
@@ -1,346 +1,342 @@
 "use client";
 
 import { useLocale } from '../../i18n';
 
 /**
  * HeroCollage — Art-directed editorial collage for the DocTalk landing hero.
- * Pure HTML/CSS/SVG, warm editorial palette only. No external images.
- * No glassmorphism, no gradient mesh, no UI mock. Aria-hidden decorative.
+ * Pure HTML/CSS/SVG, warm editorial palette only. No external images, no
+ * gradient mesh, no UI mock. Aria-hidden decorative. The two stacked
+ * document plates use .ed-glass (spec §4.1 "hero cards") — this is the
+ * one deliberate glassmorphism use in this file.
  */
 export default function HeroCollage() {
   const { t } = useLocale();
   return (
     <figure aria-hidden="true" style={{ position: "relative" }}>
       {/* ─── Outer container — roughly 4:5 aspect ─── */}
       <div
         style={{
           position: "relative",
           width: "100%",
           aspectRatio: "4 / 5",
           maxWidth: "460px",
           overflow: "visible",
         }}
       >
-        {/* ── Background ochre rectangle — large vertical stripe ── */}
+        {/* ── Background slate rectangle — large vertical stripe ── */}
         <div
           style={{
             position: "absolute",
             top: "6%",
             right: "0",
             width: "58%",
             height: "82%",
-            background: "var(--ed-ochre)",
+            background: "var(--ed-slate)",
             opacity: 0.18,
           }}
         />
 
         {/* ── Halftone dot block — bottom-left corner ── */}
         <div
           className="ed-halftone"
           style={{
             position: "absolute",
             bottom: "4%",
             left: "0",
             width: "36%",
             height: "28%",
             borderRadius: "1px",
           }}
         />
 
         {/* ── Thin geometric square outline — top-left ── */}
         <div
           style={{
             position: "absolute",
             top: "2%",
             left: "4%",
             width: "80px",
             height: "80px",
             border: "1px solid var(--ed-rule)",
           }}
         />
 
         {/* ── Signal shape — soft terracotta accent, low opacity ── */}
         <div
           style={{
             position: "absolute",
             top: "28%",
             left: "2%",
             width: "48px",
             height: "110px",
             background: "var(--ed-signal)",
             opacity: 0.12,
           }}
         />
 
         {/* ── Oversized italic serif glyph (graphic element, behind plate) ── */}
         <div
           style={{
             position: "absolute",
             top: "8%",
             right: "6%",
             fontFamily: "var(--dt-serif)",
             fontStyle: "italic",
             fontWeight: 400,
             fontSize: "clamp(120px, 18vw, 180px)",
             lineHeight: 1,
-            color: "var(--ed-ochre)",
+            color: "var(--ed-slate)",
             opacity: 0.12,
             userSelect: "none",
             pointerEvents: "none",
             letterSpacing: "-0.05em",
           }}
         >
           §
         </div>
 
         {/* ── Registration crosshair — top-right area ── */}
         <div
           className="ed-crosshair"
           style={{ position: "absolute", top: "10%", right: "8%" }}
         />
 
         {/* ── Registration crosshair — bottom-left ── */}
         <div
           className="ed-crosshair"
           style={{ position: "absolute", bottom: "10%", left: "28%" }}
         />
 
         {/* ── PRIMARY DOCUMENT PLATE ── */}
         {/* Rotated ~-3deg, offset slightly left-of-centre */}
         <div
+          className="ed-glass"
           style={{
             position: "absolute",
             top: "14%",
             left: "8%",
             right: "6%",
-            background: "var(--ed-paper)",
-            border: "1px solid var(--ed-rule)",
-            borderRadius: "2px",
             padding: "22px 20px 18px",
             transform: "rotate(-2.8deg)",
-            boxShadow:
-              "0 4px 18px 0 rgba(28,27,25,0.10), 0 1px 3px 0 rgba(28,27,25,0.07)",
           }}
         >
           {/* Document header row */}
           <div
             style={{
               display: "flex",
               alignItems: "center",
               justifyContent: "space-between",
               marginBottom: "14px",
             }}
           >
             <span
               className="ed-caption"
               style={{ letterSpacing: "0.06em" }}
             >
               report.pdf &middot; p.&thinsp;4
             </span>
             {/* Small page indicator */}
             <span
               className="ed-caption"
               style={{
                 background: "var(--ed-paper-2)",
                 border: "1px solid var(--ed-rule)",
                 padding: "1px 5px",
                 borderRadius: "1px",
               }}
             >
               04
             </span>
           </div>
 
           {/* Text lines — thin rule bars */}
           {/* Line 1 — plain */}
           <div
             style={{
               height: "7px",
               background: "var(--ed-rule)",
               borderRadius: "1px",
               marginBottom: "8px",
               opacity: 0.7,
               width: "92%",
             }}
           />
           {/* Line 2 — plain */}
           <div
             style={{
               height: "7px",
               background: "var(--ed-rule)",
               borderRadius: "1px",
               marginBottom: "8px",
               opacity: 0.55,
               width: "78%",
             }}
           />
 
           {/* Line 3 — HIGHLIGHTED (citation band) */}
           <div
             style={{
               position: "relative",
               marginBottom: "8px",
             }}
           >
-            {/* Amber/signal highlight band */}
+            {/* Slate highlight band — quote-highlight rule (structure) */}
             <div
               style={{
                 position: "absolute",
                 inset: "-2px -4px",
-                background: "var(--ed-ochre)",
+                background: "var(--ed-slate)",
                 opacity: 0.18,
                 borderRadius: "1px",
               }}
             />
             <div
               style={{
                 height: "7px",
                 background: "var(--ed-ink-2)",
                 borderRadius: "1px",
                 opacity: 0.55,
                 width: "88%",
                 position: "relative",
               }}
             />
-            {/* Terracotta margin citation marker */}
+            {/* Olive margin citation marker — verified badge */}
             <div
               style={{
                 position: "absolute",
                 right: "-14px",
                 top: "50%",
                 transform: "translateY(-50%)",
                 width: "18px",
                 height: "18px",
-                background: "var(--ed-signal)",
+                background: "var(--ed-olive)",
                 borderRadius: "50%",
                 display: "flex",
                 alignItems: "center",
                 justifyContent: "center",
               }}
             >
               <span
                 style={{
                   fontFamily: "var(--dt-mono)",
                   fontSize: "8px",
                   fontWeight: 700,
                   color: "#fff",
                   lineHeight: 1,
                 }}
               >
                 3
               </span>
             </div>
           </div>
 
           {/* Line 4 — plain */}
           <div
             style={{
               height: "7px",
               background: "var(--ed-rule)",
               borderRadius: "1px",
               marginBottom: "8px",
               opacity: 0.5,
               width: "65%",
             }}
           />
           {/* Line 5 — plain */}
           <div
             style={{
               height: "7px",
               background: "var(--ed-rule)",
               borderRadius: "1px",
               marginBottom: "16px",
               opacity: 0.45,
               width: "83%",
             }}
           />
 
           {/* Thin internal rule */}
           <hr
             style={{
               border: 0,
               borderTop: "1px solid var(--ed-rule)",
               marginBottom: "12px",
             }}
           />
 
           {/* Citation annotation row */}
           <div style={{ display: "flex", alignItems: "flex-start", gap: "8px" }}>
-            {/* Badge */}
+            {/* Badge — verified citation, olive */}
             <span
               style={{
                 display: "inline-flex",
                 alignItems: "center",
                 justifyContent: "center",
                 width: "16px",
                 height: "16px",
-                background: "var(--ed-signal)",
+                background: "var(--ed-olive)",
                 borderRadius: "50%",
                 flexShrink: 0,
                 marginTop: "1px",
               }}
             >
               <span
                 style={{
                   fontFamily: "var(--dt-mono)",
                   fontSize: "7px",
                   fontWeight: 700,
                   color: "#fff",
                   lineHeight: 1,
                 }}
               >
                 3
               </span>
             </span>
             {/* Annotation text lines */}
             <div style={{ flex: 1 }}>
               <div
                 style={{
                   height: "6px",
                   background: "var(--ed-rule)",
                   borderRadius: "1px",
                   marginBottom: "5px",
                   opacity: 0.65,
                   width: "90%",
                 }}
               />
               <div
                 style={{
                   height: "6px",
                   background: "var(--ed-rule)",
                   borderRadius: "1px",
                   opacity: 0.45,
                   width: "60%",
                 }}
               />
             </div>
           </div>
         </div>
 
         {/* ── Second document plate — stacked behind, peeking ── */}
         <div
+          className="ed-glass"
           style={{
             position: "absolute",
             top: "12%",
             left: "14%",
             right: "2%",
             height: "60%",
-            background: "var(--ed-paper-2)",
-            border: "1px solid var(--ed-rule)",
-            borderRadius: "2px",
             transform: "rotate(2.2deg)",
             zIndex: -1,
           }}
         />
       </div>
 
       {/* ─── Caption below the collage ─── */}
       <figcaption
         className="ed-caption"
         style={{ marginTop: "12px", display: "block" }}
       >
         Fig.&thinsp;01 — {t('landing.heroCollage.caption')}
       </figcaption>
     </figure>
   );
 }
diff --git a/frontend/src/components/marketing/EdInlineCell.tsx b/frontend/src/components/marketing/EdInlineCell.tsx
index 59c7014..321fd23 100644
--- a/frontend/src/components/marketing/EdInlineCell.tsx
+++ b/frontend/src/components/marketing/EdInlineCell.tsx
@@ -5,64 +5,64 @@ import { useLocale } from "../../i18n";
 
 interface EdInlineCellProps {
   value: string | boolean;
 }
 
 const MONO_FONT = "var(--dt-mono)";
 
 export default function EdInlineCell({ value }: EdInlineCellProps) {
   const { t } = useLocale();
 
   if (value === true) {
     return (
       <span
         role="img"
         aria-label={t("common.yes")}
         style={{
           fontFamily: MONO_FONT,
           fontSize: "18px",
           color: "var(--ed-signal)",
         }}
       >
         ✓
       </span>
     );
   }
 
   if (value === false) {
     return (
       <span
         role="img"
         aria-label={t("common.no")}
         style={{
           fontFamily: MONO_FONT,
           fontSize: "18px",
           color: "var(--ed-ink-3)",
         }}
       >
         –
       </span>
     );
   }
 
   if (value === "partial" || value === "Partial") {
     return (
       <span
         role="img"
         aria-label={t("comparison.partial")}
         style={{
           fontFamily: MONO_FONT,
           fontSize: "15.5px",
-          color: "var(--ed-ochre)",
+          color: "var(--ed-slate)",
         }}
       >
         ~ {t("comparison.partial")}
       </span>
     );
   }
 
   return (
     <span className="ed-body" style={{ color: "var(--ed-ink-2)" }}>
       {value}
     </span>
   );
 }
diff --git a/frontend/src/components/marketing/EdLanguageSelector.tsx b/frontend/src/components/marketing/EdLanguageSelector.tsx
index ad70004..25c9cbe 100644
--- a/frontend/src/components/marketing/EdLanguageSelector.tsx
+++ b/frontend/src/components/marketing/EdLanguageSelector.tsx
@@ -82,112 +82,109 @@ export default function EdLanguageSelector({ languageLabel }: { languageLabel?:
       window.removeEventListener("resize", updatePos);
       window.removeEventListener("scroll", updatePos, true);
     };
   }, [open, updatePos]);
 
   const current = LOCALES.find((l) => l.code === activeLocale);
   const label = languageLabel ?? tOr("header.language", "Language");
 
   // Always offer all locales. On a localized path, every marketing locale
   // renders as a real <a> link; on non-localized paths, the selector falls back
   // to the client-side app locale toggle.
   const options = LOCALES;
   const isServed = (code: string) =>
     localized && (MARKETING_LOCALES as readonly string[]).includes(code);
 
   const optionStyle = (selected: boolean): React.CSSProperties => ({
     fontFamily: "var(--dt-body)",
     fontSize: "13px",
     textAlign: "left",
     color: selected ? "var(--ed-signal)" : "var(--ed-ink)",
     background: "transparent",
     border: "none",
     padding: "8px 10px",
     cursor: "pointer",
     textDecoration: "none",
     width: "100%",
   });
   const onEnter = (e: React.MouseEvent<HTMLElement>) => {
     e.currentTarget.style.background = "var(--ed-paper-2)";
   };
   const onLeave = (e: React.MouseEvent<HTMLElement>) => {
     e.currentTarget.style.background = "transparent";
   };
 
   const codeBadge = (code: string) => (
     <span
       style={{
         fontFamily: "var(--dt-mono)",
         fontSize: "10.5px",
         letterSpacing: "0.06em",
         color: "var(--ed-ink-3)",
       }}
     >
       {code.toUpperCase()}
     </span>
   );
 
   const menu = (
     <div
       ref={menuRef}
-      className="dt-editorial"
+      className="dt-editorial ed-glass ed-glass--strong ed-glass--popover"
       style={{
         position: "fixed",
         top: pos.top,
         right: pos.right,
         zIndex: 10000,
         minWidth: "200px",
         maxHeight: pos.maxHeight,
         overflowY: "auto",
-        background: "var(--ed-paper)",
-        border: "1px solid var(--ed-rule)",
-        boxShadow: "0 14px 36px rgba(40, 33, 24, 0.20)",
       }}
     >
       <ul role="listbox" aria-label={label} style={{ margin: 0, padding: "6px", listStyle: "none" }}>
         {options.map((l) => {
           const selected = l.code === activeLocale;
           const inner = (
             <>
               <span aria-hidden="true" style={{ width: "14px", display: "inline-flex" }}>
                 {selected ? <Check size={13} /> : null}
               </span>
               <span style={{ flex: 1 }}>{l.label}</span>
               {codeBadge(l.code)}
             </>
           );
           return (
             <li key={l.code} role="none">
               {isServed(l.code) ? (
                 <a
                   role="option"
                   aria-selected={selected}
                   href={localizedHref(l.code, agnosticPath)}
                   hrefLang={l.code}
                   onClick={() => {
                     setLocale(l.code);
                     setOpen(false);
                   }}
                   className="flex items-center gap-2"
                   style={optionStyle(selected)}
                   onMouseEnter={onEnter}
                   onMouseLeave={onLeave}
                 >
                   {inner}
                 </a>
               ) : (
                 <button
                   type="button"
                   role="option"
                   aria-selected={selected}
                   onClick={() => {
                     setLocale(l.code);
                     setOpen(false);
                   }}
                   className="flex items-center gap-2"
                   style={optionStyle(selected)}
                   onMouseEnter={onEnter}
                   onMouseLeave={onLeave}
                 >
                   {inner}
                 </button>
               )}
diff --git a/frontend/src/components/marketing/EditorialHeaderBase.tsx b/frontend/src/components/marketing/EditorialHeaderBase.tsx
index 5a4c93e..63182b2 100644
--- a/frontend/src/components/marketing/EditorialHeaderBase.tsx
+++ b/frontend/src/components/marketing/EditorialHeaderBase.tsx
@@ -13,105 +13,101 @@ import type { ChromeStrings } from "../../i18n/chrome";
 export interface Crumb {
   label: string;
   href?: string;
 }
 
 export interface EditorialHeaderBaseProps {
   /** When true, render the two-line mono dateline block (landing variant). */
   showDateline?: boolean;
   /** Breadcrumb row rendered below the masthead (inner-page variant). */
   breadcrumb?: Crumb[];
   /** Server-resolved strings for localized pages; falls back to `useLocale()`. */
   chrome?: ChromeStrings;
 }
 
 /**
  * Shared editorial masthead used by both:
  * - landing-page `EditorialHeader` (passes `showDateline`)
  * - inner-page `EditorialMarketingHeader` (passes `breadcrumb`)
  *
  * Carries the sticky bar (logo + wordmark + nav links + sign-in CTA),
  * the mobile hamburger button, and the mobile nav panel.
  */
 export default function EditorialHeaderBase({
   showDateline = false,
   breadcrumb,
   chrome,
 }: EditorialHeaderBaseProps) {
   const { t, tOr } = useLocale();
   const [mobileOpen, setMobileOpen] = useState(false);
   // Derive the URL locale from the path so nav links stay in-language on
   // localized pages (`/de/...`). Targets not yet localized fall back to English.
   const { locale: urlLocale } = splitLocaleFromPath(usePathname() || "/");
   const navHref = (path: string) => localizedHrefIfAvailable(urlLocale, path);
   // Prefer server-resolved chrome strings (correct language in initial HTML on
   // localized pages); otherwise the client-locale text.
   const labels = {
     features: chrome?.navFeatures ?? t("public.nav.features"),
     pricing: chrome?.navPricing ?? t("footer.pricing"),
     trust: chrome?.navTrust ?? tOr("footer.links.trust", "Security"),
     signIn: chrome?.signIn ?? t("auth.signIn"),
   };
   const NAV_LINKS = [
     { href: navHref("/features"), label: labels.features },
     { href: navHref("/pricing"), label: labels.pricing },
     { href: navHref("/trust"), label: labels.trust },
   ];
 
   return (
     <>
       <header
-        className="sticky top-0 z-50 h-16 flex items-center"
-        style={{
-          background: "var(--ed-paper)",
-          borderBottom: "1px solid var(--ed-rule)",
-        }}
+        className="sticky top-0 z-50 h-16 flex items-center ed-glass ed-glass--strong ed-glass--header"
       >
         <div className="ed-shell w-full">
           <div className="flex items-center justify-between h-16">
             {/* Left — logo + wordmark (+ optional dateline) */}
             <Link
               href={navHref("/")}
               className="flex items-center gap-3 shrink-0"
               aria-label={t('header.aria.home')}
             >
               <DocTalkLogo size={24} />
               <span
                 style={{
                   fontFamily: "var(--dt-serif)",
                   fontSize: "19px",
                   fontWeight: 500,
                   color: "var(--ed-ink)",
                   lineHeight: 1,
                 }}
               >
                 DocTalk
               </span>
               {showDateline && (
                 <>
                   {/* Thin vertical hairline separator */}
                   <span
                     aria-hidden="true"
                     style={{
                       display: "inline-block",
                       width: "1px",
                       height: "28px",
                       background: "var(--ed-rule)",
                       marginLeft: "4px",
                       marginRight: "8px",
                     }}
                   />
                   {/* Editorial dateline block — two mono lines */}
                   <span
                     className="hidden sm:flex"
                     style={{ flexDirection: "column", gap: "2px" }}
                   >
                     <span
                       className="ed-caption"
                       style={{ letterSpacing: "0.10em" }}
                     >
                       STUDIO N&ordm;&thinsp;01
                     </span>
                     <span
                       className="ed-caption"
                       style={{ letterSpacing: "0.08em", textTransform: "uppercase" }}
                     >

exec
/bin/zsh -lc 'git status --short && git diff --check 782f8b0..HEAD && git diff --unified=80 782f8b0..HEAD -- frontend/src/app/editorial.css' in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
?? .collab/reviews/2026-08-04-glass-b1-codex-r1.md
diff --git a/frontend/src/app/editorial.css b/frontend/src/app/editorial.css
index 5a0ad30..101a60f 100644
--- a/frontend/src/app/editorial.css
+++ b/frontend/src/app/editorial.css
@@ -1,274 +1,417 @@
 /* Editorial design layer — "Monocle-crisp". Every rule is scoped under
    .dt-editorial so it never affects the functional app UI. Light only. */
 .dt-editorial {
-  --ed-paper: #f3eee1;
-  --ed-paper-2: #e9e1cf;
-  --ed-ink: #1c1b19;
-  --ed-ink-2: #48443b;
-  --ed-ink-3: #6e6860;
-  --ed-signal: #b0472f;
-  --ed-signal-deep: #8f3a26;
-  --ed-ochre: #c08a3e;
-  --ed-rule: #d3c9b3;
+  /* Counterpoint palette (2026-08-04 redesign). Two accents, not one:
+     rust = action (primary CTA, brand mark, feature eyebrows), slate =
+     structure (links, secondary CTA, quote borders, nav hover, decorative
+     set-dressing), olive = verified/positive state ONLY. */
+  --ed-paper: #eae8e3;
+  --ed-paper-2: #e4e2db;
+  --ed-ink: #20211e;
+  --ed-ink-2: #5b5a52;
+  --ed-ink-3: #8a897f;
+  --ed-signal: #a04b34;
+  --ed-signal-deep: #843c28;
+  --ed-slate: #1f3a4d;
+  --ed-slate-2: #2f556b;
+  --ed-olive: #3f6a34;
+  --ed-rule: rgba(32, 33, 30, 0.12);
+
+  /* Glass material tokens (warm, Ocean v5 recipe — spec §2.3). Consumed by
+     the .ed-glass utility classes below; never reference these directly
+     from a component's inline style (fallbacks require @media, which
+     inline styles cannot express). */
+  --ed-glass: rgba(250, 249, 246, 0.55);
+  --ed-glass-strong: rgba(251, 250, 247, 0.85);
+  --ed-glass-blur: blur(22px) saturate(150%);
+  --ed-glass-line: rgba(32, 33, 30, 0.12);
+  --ed-glass-hi: inset 0 1px 0 rgba(255, 255, 255, 0.82);
+  --ed-glass-shadow: 0 18px 44px -18px rgba(30, 25, 20, 0.32);
+  --ed-radius: 22px;
 
   position: relative;
   background: var(--ed-paper);
   color: var(--ed-ink-2);
   font-family: var(--dt-body);
   -webkit-font-smoothing: antialiased;
 }
 
+/* Counter the app-surface reset at globals.css:819-826:
+     `.dt-stitch-root > .min-h-screen { background: transparent !important }`
+   MarketingShell's root is `.dt-editorial min-h-screen flex flex-col` and a
+   direct child of `.dt-stitch-root`, so that (0,2,0) !important rule beat the
+   paper background above and every MarketingShell page — i.e. the whole
+   marketing surface except the landing page, whose root has no `min-h-screen`
+   — rendered on the app's near-white body instead of --ed-paper. The glass
+   material is tuned to sit on paper, so without this it reads washed out.
+   (0,3,0) + !important wins outright regardless of file order; the second
+   selector keeps it working if MarketingShell ever drops `min-h-screen`.
+   Do NOT "clean this up" as a redundant duplicate of line 33 — it is not.
+   Remove it only together with the globals.css rule it counters. */
+.dt-stitch-root > .dt-editorial.min-h-screen,
+.dt-stitch-root > .dt-editorial {
+  background: var(--ed-paper) !important;
+}
+
 /* Print-craft paper grain — faint and intentional (a press texture,
    not an AI glow). Sits below content. */
 .dt-editorial::before {
   content: "";
   position: absolute;
   inset: 0;
   z-index: 0;
   pointer-events: none;
   opacity: 0.5;
   background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='g'><feTurbulence type='fractalNoise' baseFrequency='0.82' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0.1  0 0 0 0 0.09  0 0 0 0 0.07  0 0 0 0.035 0'/></filter><rect width='100%25' height='100%25' filter='url(%23g)'/></svg>");
 }
 .dt-editorial > * { position: relative; z-index: 1; }
 
+/* Ambient canvas — restrained, asymmetric static gradients so glass has
+   something to blur. Static gradients only (not filter:blur) for zero
+   scroll repaint (spec §3). Sits above the paper-grain ::before, below
+   real content (z-index 1, set above). */
+.dt-editorial::after {
+  content: "";
+  position: absolute;
+  inset: 0;
+  z-index: 0;
+  pointer-events: none;
+  background:
+    radial-gradient(680px 480px at 14% 0%, rgba(160, 75, 52, 0.10), transparent 60%),
+    radial-gradient(560px 420px at 92% 38%, rgba(31, 58, 77, 0.07), transparent 65%);
+}
+@media (prefers-reduced-transparency: reduce) {
+  .dt-editorial::after { display: none; }
+}
+@media print {
+  .dt-editorial::after { display: none; }
+}
+
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
 
 /* Hero display headline — heavy grotesque with italic-serif emphasis
    words (wrap emphasis in <em>). A mixed-voice editorial headline. */
 .dt-editorial .ed-display {
   font-family: var(--dt-body);
-  font-weight: 800;
+  font-weight: 700;
   font-size: clamp(46px, 7.4vw, 88px);
   line-height: 1.0;
   letter-spacing: -0.035em;
   color: var(--ed-ink);
 }
 .dt-editorial .ed-display em {
   font-family: var(--dt-serif);
   font-weight: 500;
   font-style: italic;
   letter-spacing: -0.01em;
 }
 
 .dt-editorial .ed-h2 {
   font-family: var(--dt-serif);
   font-weight: 400;
   font-size: clamp(28px, 3.5vw, 40px);
   line-height: 1.1;
   letter-spacing: -0.015em;
   color: var(--ed-ink);
 }
 
 .dt-editorial .ed-h3 {
   font-family: var(--dt-serif);
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
   font-family: var(--dt-mono);
   font-size: 11px;
   text-transform: uppercase;
   letter-spacing: 0.13em;
   color: var(--ed-ink-3);
 }
 
 .dt-editorial .ed-label-num { color: var(--ed-signal); }
 
 .dt-editorial .ed-caption {
   font-family: var(--dt-mono);
   font-size: 10.5px;
   letter-spacing: 0.04em;
   color: var(--ed-ink-3);
 }
 
 .dt-editorial .ed-num {
   font-family: var(--dt-serif);
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
-  font-family: var(--font-inter), sans-serif;
+  font-family: var(--font-plex-sans), sans-serif;
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
 
 /* Halftone dot block — a collage / print-craft element.
    Uses a hardcoded lighter tone so that bumping --ed-ink-3 to meet
    WCAG AA on text labels does not darken this decorative texture. */
 .dt-editorial .ed-halftone {
   background-image: radial-gradient(#8b857a 1.1px, transparent 1.2px);
   background-size: 9px 9px;
   opacity: 0.5;
 }
 
 /* Registration crosshair — small print-craft mark.
    Pinned to the lighter pre-I11 tone for the same reason as .ed-halftone. */
 .dt-editorial .ed-crosshair {
   position: relative;
   width: 14px;
   height: 14px;
 }
 .dt-editorial .ed-crosshair::before,
 .dt-editorial .ed-crosshair::after {
   content: "";
   position: absolute;
   background: #8b857a;
 }
 .dt-editorial .ed-crosshair::before { left: 50%; top: 0; width: 1px; height: 100%; transform: translateX(-50%); }
 .dt-editorial .ed-crosshair::after { top: 50%; left: 0; height: 1px; width: 100%; transform: translateY(-50%); }
 
 /* Inner-page hero headline — quieter than the landing .ed-display. */
 .dt-editorial .ed-h1 {
   font-family: var(--dt-serif);
   font-weight: 500;
   font-size: clamp(34px, 4.6vw, 56px);
   line-height: 1.08;
   letter-spacing: -0.02em;
   color: var(--ed-ink);
 }
 
 /* Hairline-bordered editorial card on the inset paper tone. */
 .dt-editorial .ed-card {
   border: 1px solid var(--ed-rule);
   background: var(--ed-paper-2);
   padding: 22px;
 }
 
 /* Breadcrumb trail link. */
 .dt-editorial .ed-crumb {
   font-family: var(--dt-mono);
   font-size: 10.5px;
   letter-spacing: 0.06em;
   text-transform: uppercase;
   color: var(--ed-ink-3);
   text-decoration: none;
   transition: color 150ms ease;
 }
 .dt-editorial a.ed-crumb:hover { color: var(--ed-signal); }
 
 .dt-editorial .ed-prose { max-width: 660px; }
 .dt-editorial .ed-prose p {
   font-size: 15.5px;
   line-height: 1.7;
   color: var(--ed-ink-2);
   margin: 0 0 18px;
 }
 .dt-editorial .ed-prose p:last-child { margin-bottom: 0; }
 .dt-editorial .ed-prose a {
   color: var(--ed-signal);
   text-decoration: underline;
   text-underline-offset: 2px;
 }
 
 /* Clickable editorial cards (anchor cards) get hover feedback;
    non-interactive .ed-card divs are unaffected. */
 .dt-editorial a.ed-card {
   transition: border-color 150ms ease, background-color 150ms ease;
 }
 .dt-editorial a.ed-card:hover {
   border-color: var(--ed-ink-3);
   background: var(--ed-paper);
 }
+.dt-editorial a.ed-card.ed-glass:hover {
+  background: var(--ed-glass-strong);
+  border-color: rgba(31, 58, 77, 0.28);
+}
 
 /* Bulleted lists inside editorial prose. */
 .dt-editorial .ed-prose ul {
   list-style: none;
   margin: 0 0 18px;
   padding: 0;
 }
 .dt-editorial .ed-prose ul li {
   position: relative;
   padding-left: 20px;
   font-size: 15.5px;
   line-height: 1.7;
   color: var(--ed-ink-2);
   margin-bottom: 8px;
 }
 .dt-editorial .ed-prose ul li::before {
   content: "";
   position: absolute;
   left: 2px;
   top: 11px;
   width: 5px;
   height: 5px;
   background: var(--ed-signal);
 }
 .dt-editorial .ed-prose ul li:last-child { margin-bottom: 0; }
 
+/* ─── Liquid Glass utility classes (spec §2.3, §4.1) ───────────────────
+   Glass is chrome, not content: apply only to nav, cards, popovers, CTA
+   panels, FAQ/comparison containers, hero art. NEVER to EdProse/article
+   body/EdSection text or anything rendering real document/quote text.
+   backdrop-filter appears exactly once below (the .ed-glass base) with
+   its two required fallbacks directly underneath — do not add
+   backdrop-filter anywhere else in this file without both. Source order
+   matters: this block is appended AFTER .ed-card so `.ed-card.ed-glass`
+   (Task 5) resolves background/border to the glass values. */
+.dt-editorial .ed-glass,
+.dt-editorial.ed-glass {
+  background: var(--ed-glass);
+  backdrop-filter: var(--ed-glass-blur);
+  -webkit-backdrop-filter: var(--ed-glass-blur);
+  border: 1px solid var(--ed-glass-line);
+  border-radius: var(--ed-radius);
+  box-shadow: var(--ed-glass-hi), var(--ed-glass-shadow);
+}
+.dt-editorial .ed-glass--strong,
+.dt-editorial.ed-glass--strong {
+  background: var(--ed-glass-strong);
+}
+.dt-editorial .ed-glass--header,
+.dt-editorial.ed-glass--header {
+  border-radius: 0;
+  border-width: 0 0 1px 0;
+}
+/* The May-19 `.dt-editorial > *` rule (line 50) is (0,1,0) specificity —
+   identical to Tailwind's `.sticky`/`.z-50` utilities — so it silently wins
+   the position/z-index tie and flattens the masthead to `position: relative`.
+   This selector is (0,2,1), so it wins outright regardless of source order,
+   without touching the May-19 rule (still needed for every other direct
+   child's stacking against the ambient ::before/::after layers). z-index 50
+   matches the header's own `z-50` Tailwind class. */
+.dt-editorial > header.ed-glass--header {
+  position: sticky;
+  top: 0;
+  z-index: 50;
+}
+.dt-editorial .ed-glass--cta,
+.dt-editorial.ed-glass--cta {
+  border-radius: 0;
+  border-width: 1px 0 0 0;
+}
+.dt-editorial .ed-glass--popover,
+.dt-editorial.ed-glass--popover {
+  box-shadow: var(--ed-glass-hi), 0 14px 36px rgba(40, 33, 24, 0.24);
+}
+@media (prefers-reduced-transparency: reduce) {
+  .dt-editorial .ed-glass,
+  .dt-editorial.ed-glass {
+    background: var(--ed-paper-2);
+    backdrop-filter: none;
+    -webkit-backdrop-filter: none;
+  }
+  .dt-editorial a.ed-card.ed-glass:hover {
+    background: var(--ed-paper);
+    border-color: var(--ed-ink-3);
+  }
+}
+@media print {
+  .dt-editorial .ed-glass,
+  .dt-editorial.ed-glass {
+    background: var(--ed-paper-2);
+    backdrop-filter: none;
+    -webkit-backdrop-filter: none;
+    box-shadow: none;
+    border-color: var(--ed-rule);
+  }
+  .dt-editorial a.ed-card.ed-glass:hover {
+    background: var(--ed-paper-2);
+    border-color: var(--ed-rule);
+    box-shadow: none;
+  }
+  /* A sticky masthead prints at its stuck offset, so a page printed while
+     scrolled paints the header across the middle of the content (it landed
+     inside the comparison table during Task 10's print check). Static in
+     print puts it back at the top of the first page. */
+  .dt-editorial > header.ed-glass--header {
+    position: static;
+  }
+}
+
 .dt-editorial *:focus-visible {
   outline: 2px solid var(--ed-signal);
   outline-offset: 2px;
 }

2026-08-04T08:53:38.943513Z ERROR codex_models_manager::manager: failed to renew cache TTL: missing field `supports_reasoning_summaries` at line 86 column 5
exec
/bin/zsh -lc "rg -n --glob '*.{tsx,ts,jsx,js,css}' '(ed-glass|backdrop-filter|backdropFilter|rgba\\(|hsla\\(|#[0-9a-fA-F]{8}\\b|linear-gradient|radial-gradient|box-shadow|boxShadow)' frontend/src/app/editorial.css frontend/src/components/marketing frontend/src/components/landing frontend/src/app/shared frontend/src/app/demo frontend/src/app/trust frontend/src/app/tools/reading-time frontend/src/components/Diff" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
frontend/src/app/editorial.css:18:  --ed-rule: rgba(32, 33, 30, 0.12);
frontend/src/app/editorial.css:21:     the .ed-glass utility classes below; never reference these directly
frontend/src/app/editorial.css:24:  --ed-glass: rgba(250, 249, 246, 0.55);
frontend/src/app/editorial.css:25:  --ed-glass-strong: rgba(251, 250, 247, 0.85);
frontend/src/app/editorial.css:26:  --ed-glass-blur: blur(22px) saturate(150%);
frontend/src/app/editorial.css:27:  --ed-glass-line: rgba(32, 33, 30, 0.12);
frontend/src/app/editorial.css:28:  --ed-glass-hi: inset 0 1px 0 rgba(255, 255, 255, 0.82);
frontend/src/app/editorial.css:29:  --ed-glass-shadow: 0 18px 44px -18px rgba(30, 25, 20, 0.32);
frontend/src/app/editorial.css:80:    radial-gradient(680px 480px at 14% 0%, rgba(160, 75, 52, 0.10), transparent 60%),
frontend/src/app/editorial.css:81:    radial-gradient(560px 420px at 92% 38%, rgba(31, 58, 77, 0.07), transparent 65%);
frontend/src/app/editorial.css:228:  background-image: radial-gradient(#8b857a 1.1px, transparent 1.2px);
frontend/src/app/editorial.css:301:.dt-editorial a.ed-card.ed-glass:hover {
frontend/src/app/editorial.css:302:  background: var(--ed-glass-strong);
frontend/src/app/editorial.css:303:  border-color: rgba(31, 58, 77, 0.28);
frontend/src/app/editorial.css:335:   backdrop-filter appears exactly once below (the .ed-glass base) with
frontend/src/app/editorial.css:337:   backdrop-filter anywhere else in this file without both. Source order
frontend/src/app/editorial.css:338:   matters: this block is appended AFTER .ed-card so `.ed-card.ed-glass`
frontend/src/app/editorial.css:340:.dt-editorial .ed-glass,
frontend/src/app/editorial.css:341:.dt-editorial.ed-glass {
frontend/src/app/editorial.css:342:  background: var(--ed-glass);
frontend/src/app/editorial.css:343:  backdrop-filter: var(--ed-glass-blur);
frontend/src/app/editorial.css:344:  -webkit-backdrop-filter: var(--ed-glass-blur);
frontend/src/app/editorial.css:345:  border: 1px solid var(--ed-glass-line);
frontend/src/app/editorial.css:347:  box-shadow: var(--ed-glass-hi), var(--ed-glass-shadow);
frontend/src/app/editorial.css:349:.dt-editorial .ed-glass--strong,
frontend/src/app/editorial.css:350:.dt-editorial.ed-glass--strong {
frontend/src/app/editorial.css:351:  background: var(--ed-glass-strong);
frontend/src/app/editorial.css:353:.dt-editorial .ed-glass--header,
frontend/src/app/editorial.css:354:.dt-editorial.ed-glass--header {
frontend/src/app/editorial.css:365:.dt-editorial > header.ed-glass--header {
frontend/src/app/editorial.css:370:.dt-editorial .ed-glass--cta,
frontend/src/app/editorial.css:371:.dt-editorial.ed-glass--cta {
frontend/src/app/editorial.css:375:.dt-editorial .ed-glass--popover,
frontend/src/app/editorial.css:376:.dt-editorial.ed-glass--popover {
frontend/src/app/editorial.css:377:  box-shadow: var(--ed-glass-hi), 0 14px 36px rgba(40, 33, 24, 0.24);
frontend/src/app/editorial.css:380:  .dt-editorial .ed-glass,
frontend/src/app/editorial.css:381:  .dt-editorial.ed-glass {
frontend/src/app/editorial.css:383:    backdrop-filter: none;
frontend/src/app/editorial.css:384:    -webkit-backdrop-filter: none;
frontend/src/app/editorial.css:386:  .dt-editorial a.ed-card.ed-glass:hover {
frontend/src/app/editorial.css:392:  .dt-editorial .ed-glass,
frontend/src/app/editorial.css:393:  .dt-editorial.ed-glass {
frontend/src/app/editorial.css:395:    backdrop-filter: none;
frontend/src/app/editorial.css:396:    -webkit-backdrop-filter: none;
frontend/src/app/editorial.css:397:    box-shadow: none;
frontend/src/app/editorial.css:400:  .dt-editorial a.ed-card.ed-glass:hover {
frontend/src/app/editorial.css:403:    box-shadow: none;
frontend/src/app/editorial.css:409:  .dt-editorial > header.ed-glass--header {
frontend/src/components/landing/HeroCollage.tsx:9: * document plates use .ed-glass (spec §4.1 "hero cards") — this is the
frontend/src/components/landing/HeroCollage.tsx:113:          className="ed-glass"
frontend/src/components/landing/HeroCollage.tsx:320:          className="ed-glass"
frontend/src/components/marketing/EdFaqList.tsx:29:    <div className="ed-glass" style={{ padding: "6px 28px" }}>
frontend/src/components/marketing/EdCtaBanner.tsx:22:    <section className="ed-section ed-glass ed-glass--cta">
frontend/src/components/marketing/EdCardGrid.tsx:53:            className="ed-card ed-glass h-full"
frontend/src/components/marketing/EdCardGrid.tsx:61:            className="ed-card ed-glass h-full"
frontend/src/components/marketing/EditorialHeaderBase.tsx:63:        className="sticky top-0 z-50 h-16 flex items-center ed-glass ed-glass--strong ed-glass--header"
frontend/src/components/landing/ProductShowcase.tsx:464:            boxShadow: isDark
frontend/src/components/landing/ProductShowcase.tsx:465:              ? "0 1px 3px rgba(0,0,0,0.4)"
frontend/src/components/landing/ProductShowcase.tsx:466:              : "0 1px 3px rgba(0,0,0,0.1)",
frontend/src/components/marketing/EdLanguageSelector.tsx:132:      className="dt-editorial ed-glass ed-glass--strong ed-glass--popover"
frontend/src/components/marketing/EdComparisonTable.tsx:107:    <div className="ed-glass" style={{ padding: "4px", overflow: "hidden" }}>
frontend/src/components/landing/showcaseData.ts:87:    highlightBg: "rgba(251, 191, 36, 0.30)", // amber-400 @ 30%
frontend/src/components/landing/showcaseData.ts:105:    highlightBg: "rgba(251, 191, 36, 0.30)",

exec
/bin/zsh -lc "rg -n --glob '*.{tsx,ts,jsx,js,css}' '(dt-editorial|MarketingShell|DocumentDiffPanel)' frontend/src/app frontend/src/components | head -n 500" in /Users/mayijie/Projects/Code/010_DocTalk
exec
/bin/zsh -lc "rg -n --glob '"'!**/*.md'"' --glob '"'!**/*.json'"' --glob '"'!**/*.lock'"' '(font-(extrabold|black)|fontWeight:\\s*[\"'\\'']?(800|900)|font-weight:\\s*(800|900))' frontend/src frontend/tailwind.config.ts" in /Users/mayijie/Projects/Code/010_DocTalk
exec
/bin/zsh -lc "git diff --unified=120 782f8b0..HEAD -- frontend/src/app/layout.tsx frontend/tailwind.config.ts && sed -n '1,180p' frontend/src/app/layout.tsx && sed -n '1,150p' frontend/tailwind.config.ts" in /Users/mayijie/Projects/Code/010_DocTalk
 exited 1 in 0ms:
 succeeded in 0ms:
diff --git a/frontend/src/app/layout.tsx b/frontend/src/app/layout.tsx
index 53e4c1c..35ab72f 100644
--- a/frontend/src/app/layout.tsx
+++ b/frontend/src/app/layout.tsx
@@ -1,110 +1,116 @@
 import type { Metadata } from 'next'
-import { Inter, Sora, Newsreader, IBM_Plex_Mono } from 'next/font/google'
+import { IBM_Plex_Sans, Sora, Fraunces, IBM_Plex_Mono } from 'next/font/google'
 import './globals.css'
 import './editorial.css'
 import ErrorBoundary from '../components/ErrorBoundary'
 import { ThemeProvider } from './ThemeProvider'
 import LocaleProvider from '../i18n/LocaleProvider'
 import { Providers } from '../components/Providers'
 import { Suspense } from 'react'
 import { AuthModal } from '../components/AuthModal'
 import { AnalyticsWrapper } from '../components/AnalyticsWrapper'
 import { CookieConsentBanner } from '../components/CookieConsentBanner'
 
-const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' })
+const plexSans = IBM_Plex_Sans({
+  subsets: ['latin'],
+  weight: ['400', '500', '600', '700'],
+  variable: '--font-plex-sans',
+  display: 'swap',
+})
 const sora = Sora({
   subsets: ['latin'],
   variable: '--font-logo',
   weight: ['500', '600', '700'],
   display: 'swap',
 })
 
-const newsreader = Newsreader({
+const fraunces = Fraunces({
   subsets: ['latin'],
-  weight: ['400', '500', '600'],
-  variable: '--font-newsreader',
+  style: ['normal', 'italic'],
+  axes: ['opsz', 'SOFT'],
+  variable: '--font-fraunces',
   display: 'swap',
 })
 
 const plexMono = IBM_Plex_Mono({
   subsets: ['latin'],
   weight: ['400', '500'],
   variable: '--font-plex-mono',
   display: 'swap',
 })
 
 export const metadata: Metadata = {
   metadataBase: new URL('https://www.doctalk.site'),
   title: {
     default: 'DocTalk — AI Document Chat with Cited Answers',
     template: '%s | DocTalk',
   },
   description: 'Upload any document and chat with AI. Get instant answers with source citations that highlight in your document. Supports PDF, DOCX, PPTX, XLSX, and more.',
   alternates: {
     canonical: '/',
   },
   openGraph: {
     title: 'DocTalk — AI Document Chat',
     description: 'Chat with your documents. AI answers with page-level citations.',
     type: 'website',
     url: 'https://www.doctalk.site',
     siteName: 'DocTalk',
     locale: 'en_US',
   },
   twitter: {
     card: 'summary_large_image',
     title: 'DocTalk — AI Document Chat',
     description: 'Chat with your documents. AI answers with page-level citations.',
   },
   icons: {
     icon: [{ url: '/icon.svg', type: 'image/svg+xml', sizes: 'any' }],
     apple: [{ url: '/logo-icon.png', type: 'image/png', sizes: '512x512' }],
   },
 }
 
 export default function RootLayout({
   children,
 }: {
   children: React.ReactNode
 }) {
   // <html lang> starts at "en" at SSR time so every page can prerender
   // statically and hit Vercel's CDN. LocaleProvider mutates
   // document.documentElement.lang on mount via client-side detection
   // (localStorage + navigator.language). The earlier `await cookies()`
   // here — together with the removed middleware.ts locale cookie —
   // was the direct cause of `Cache-Control: private, no-store` on every
   // SEO page and is the single biggest unlock for organic traffic.
   return (
-    <html lang="en" suppressHydrationWarning className={`${inter.variable} ${sora.variable} ${newsreader.variable} ${plexMono.variable}`}>
+    <html lang="en" suppressHydrationWarning className={`${plexSans.variable} ${sora.variable} ${fraunces.variable} ${plexMono.variable}`}>
       <head>
         <meta name="google-site-verification" content="168G1TYJfQ7MNp4sNdF-7gC2wDWKGeds618LyLdkCUM" />
         <meta name="msvalidate.01" content="50E7D296303C85BC31C1BE98539EA393" />
         <meta name="theme-color" content="#ffffff" media="(prefers-color-scheme: light)" />
         <meta name="theme-color" content="#09090b" media="(prefers-color-scheme: dark)" />
       </head>
       <body className="font-sans antialiased">
         {/* i18n: skip link is server-rendered, locale-specific version requires server-side i18n */}
         <a
           href="#page-content"
           className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-zinc-900 focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-white dark:focus:bg-zinc-100 dark:focus:text-zinc-900"
         >
           Skip to content
         </a>
         <ThemeProvider>
           <Providers>
             <LocaleProvider>
               <ErrorBoundary>
                 <div id="page-content" className="dt-stitch-root">{children}</div>
                 <Suspense fallback={null}>
                   <AuthModal />
                 </Suspense>
                 <CookieConsentBanner />
               </ErrorBoundary>
             </LocaleProvider>
           </Providers>
         </ThemeProvider>
         <AnalyticsWrapper />
       </body>
     </html>
   )
 }
diff --git a/frontend/tailwind.config.ts b/frontend/tailwind.config.ts
index ac1918d..661cc25 100644
--- a/frontend/tailwind.config.ts
+++ b/frontend/tailwind.config.ts
@@ -1,88 +1,88 @@
 import type { Config } from 'tailwindcss'
 
 const config: Config = {
   darkMode: 'class',
   content: [
     './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
     './src/components/**/*.{js,ts,jsx,tsx,mdx}',
     './src/app/**/*.{js,ts,jsx,tsx,mdx}',
   ],
   theme: {
     extend: {
       fontFamily: {
-        // --dt-body = Inter for Latin, + curated system CJK/Arabic/Devanagari
+        // --dt-body = IBM Plex Sans for Latin, + curated system CJK/Arabic/Devanagari
         // stacks under :lang() (see globals.css). Latin output is unchanged.
         sans: ['var(--dt-body)'],
-        display: ['var(--font-logo)', 'var(--font-inter)', 'system-ui', 'sans-serif'],
-        logo: ['var(--font-logo)', 'var(--font-inter)', 'system-ui', 'sans-serif'],
+        display: ['var(--font-logo)', 'var(--font-plex-sans)', 'system-ui', 'sans-serif'],
+        logo: ['var(--font-logo)', 'var(--font-plex-sans)', 'system-ui', 'sans-serif'],
         // Legacy alias: older pages still use `font-serif`, but the
         // Stitch direction is rounded sans display type, not editorial serif.
-        serif: ['var(--font-logo)', 'var(--font-inter)', 'system-ui', 'sans-serif'],
+        serif: ['var(--font-logo)', 'var(--font-plex-sans)', 'system-ui', 'sans-serif'],
       },
       colors: {
         accent: {
           DEFAULT: 'var(--accent)',
           hover: 'var(--accent-hover)',
           light: 'var(--accent-light)',
           foreground: 'var(--accent-foreground)',
         },
         surface: {
           1: 'var(--surface-1)',
           2: 'var(--surface-2)',
           3: 'var(--surface-3)',
         },
       },
       keyframes: {
         'fade-in': {
           '0%': { opacity: '0' },
           '100%': { opacity: '1' },
         },
         'slide-up': {
           '0%': { opacity: '0', transform: 'translateY(8px)' },
           '100%': { opacity: '1', transform: 'translateY(0)' },
         },
         'reveal-up': {
           '0%': { opacity: '0', transform: 'translateY(24px)' },
           '100%': { opacity: '1', transform: 'translateY(0)' },
         },
       },
       animation: {
         'fade-in': 'fade-in 150ms ease-out',
         'slide-up': 'slide-up 200ms ease-out',
         'reveal-up': 'reveal-up 600ms ease-out both',
       },
       typography: {
         DEFAULT: {
           css: {
             '--tw-prose-body': '#09090b',
             '--tw-prose-headings': '#09090b',
             '--tw-prose-bold': '#09090b',
             'code::before': { content: 'none' },
             'code::after': { content: 'none' },
             code: {
               backgroundColor: 'rgb(0 0 0 / 0.06)',
               borderRadius: '0.375rem',
               padding: '0.125rem 0.375rem',
               fontWeight: '500',
               fontSize: '0.875em',
             },
           },
         },
         invert: {
           css: {
             '--tw-prose-invert-body': '#fafafa',
             '--tw-prose-invert-headings': '#fafafa',
             '--tw-prose-invert-bold': '#fafafa',
             code: {
               backgroundColor: 'rgb(255 255 255 / 0.12)',
             },
           },
         },
       },
     },
   },
   plugins: [
     require('@tailwindcss/typography'),
   ],
 }
 export default config
import type { Metadata } from 'next'
import { IBM_Plex_Sans, Sora, Fraunces, IBM_Plex_Mono } from 'next/font/google'
import './globals.css'
import './editorial.css'
import ErrorBoundary from '../components/ErrorBoundary'
import { ThemeProvider } from './ThemeProvider'
import LocaleProvider from '../i18n/LocaleProvider'
import { Providers } from '../components/Providers'
import { Suspense } from 'react'
import { AuthModal } from '../components/AuthModal'
import { AnalyticsWrapper } from '../components/AnalyticsWrapper'
import { CookieConsentBanner } from '../components/CookieConsentBanner'

const plexSans = IBM_Plex_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-plex-sans',
  display: 'swap',
})
const sora = Sora({
  subsets: ['latin'],
  variable: '--font-logo',
  weight: ['500', '600', '700'],
  display: 'swap',
})

const fraunces = Fraunces({
  subsets: ['latin'],
  style: ['normal', 'italic'],
  axes: ['opsz', 'SOFT'],
  variable: '--font-fraunces',
  display: 'swap',
})

const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-plex-mono',
  display: 'swap',
})

export const metadata: Metadata = {
  metadataBase: new URL('https://www.doctalk.site'),
  title: {
    default: 'DocTalk — AI Document Chat with Cited Answers',
    template: '%s | DocTalk',
  },
  description: 'Upload any document and chat with AI. Get instant answers with source citations that highlight in your document. Supports PDF, DOCX, PPTX, XLSX, and more.',
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: 'DocTalk — AI Document Chat',
    description: 'Chat with your documents. AI answers with page-level citations.',
    type: 'website',
    url: 'https://www.doctalk.site',
    siteName: 'DocTalk',
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'DocTalk — AI Document Chat',
    description: 'Chat with your documents. AI answers with page-level citations.',
  },
  icons: {
    icon: [{ url: '/icon.svg', type: 'image/svg+xml', sizes: 'any' }],
    apple: [{ url: '/logo-icon.png', type: 'image/png', sizes: '512x512' }],
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // <html lang> starts at "en" at SSR time so every page can prerender
  // statically and hit Vercel's CDN. LocaleProvider mutates
  // document.documentElement.lang on mount via client-side detection
  // (localStorage + navigator.language). The earlier `await cookies()`
  // here — together with the removed middleware.ts locale cookie —
  // was the direct cause of `Cache-Control: private, no-store` on every
  // SEO page and is the single biggest unlock for organic traffic.
  return (
    <html lang="en" suppressHydrationWarning className={`${plexSans.variable} ${sora.variable} ${fraunces.variable} ${plexMono.variable}`}>
      <head>
        <meta name="google-site-verification" content="168G1TYJfQ7MNp4sNdF-7gC2wDWKGeds618LyLdkCUM" />
        <meta name="msvalidate.01" content="50E7D296303C85BC31C1BE98539EA393" />
        <meta name="theme-color" content="#ffffff" media="(prefers-color-scheme: light)" />
        <meta name="theme-color" content="#09090b" media="(prefers-color-scheme: dark)" />
      </head>
      <body className="font-sans antialiased">
        {/* i18n: skip link is server-rendered, locale-specific version requires server-side i18n */}
        <a
          href="#page-content"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-zinc-900 focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-white dark:focus:bg-zinc-100 dark:focus:text-zinc-900"
        >
          Skip to content
        </a>
        <ThemeProvider>
          <Providers>
            <LocaleProvider>
              <ErrorBoundary>
                <div id="page-content" className="dt-stitch-root">{children}</div>
                <Suspense fallback={null}>
                  <AuthModal />
                </Suspense>
                <CookieConsentBanner />
              </ErrorBoundary>
            </LocaleProvider>
          </Providers>
        </ThemeProvider>
        <AnalyticsWrapper />
      </body>
    </html>
  )
}
import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        // --dt-body = IBM Plex Sans for Latin, + curated system CJK/Arabic/Devanagari
        // stacks under :lang() (see globals.css). Latin output is unchanged.
        sans: ['var(--dt-body)'],
        display: ['var(--font-logo)', 'var(--font-plex-sans)', 'system-ui', 'sans-serif'],
        logo: ['var(--font-logo)', 'var(--font-plex-sans)', 'system-ui', 'sans-serif'],
        // Legacy alias: older pages still use `font-serif`, but the
        // Stitch direction is rounded sans display type, not editorial serif.
        serif: ['var(--font-logo)', 'var(--font-plex-sans)', 'system-ui', 'sans-serif'],
      },
      colors: {
        accent: {
          DEFAULT: 'var(--accent)',
          hover: 'var(--accent-hover)',
          light: 'var(--accent-light)',
          foreground: 'var(--accent-foreground)',
        },
        surface: {
          1: 'var(--surface-1)',
          2: 'var(--surface-2)',
          3: 'var(--surface-3)',
        },
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'slide-up': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'reveal-up': {
          '0%': { opacity: '0', transform: 'translateY(24px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 150ms ease-out',
        'slide-up': 'slide-up 200ms ease-out',
        'reveal-up': 'reveal-up 600ms ease-out both',
      },
      typography: {
        DEFAULT: {
          css: {
            '--tw-prose-body': '#09090b',
            '--tw-prose-headings': '#09090b',
            '--tw-prose-bold': '#09090b',
            'code::before': { content: 'none' },
            'code::after': { content: 'none' },
            code: {
              backgroundColor: 'rgb(0 0 0 / 0.06)',
              borderRadius: '0.375rem',
              padding: '0.125rem 0.375rem',
              fontWeight: '500',
              fontSize: '0.875em',
            },
          },
        },
        invert: {
          css: {
            '--tw-prose-invert-body': '#fafafa',
            '--tw-prose-invert-headings': '#fafafa',
            '--tw-prose-invert-bold': '#fafafa',
            code: {
              backgroundColor: 'rgb(255 255 255 / 0.12)',
            },
          },
        },
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
}
export default config

 succeeded in 0ms:
frontend/src/components/Diff/DocumentDiffPanel.tsx:42:interface DocumentDiffPanelProps {
frontend/src/components/Diff/DocumentDiffPanel.tsx:157:export default function DocumentDiffPanel({
frontend/src/components/Diff/DocumentDiffPanel.tsx:163:}: DocumentDiffPanelProps) {
frontend/src/app/imprint/ImprintPageClient.tsx:6:import MarketingShell from '../../components/marketing/MarketingShell';
frontend/src/app/imprint/ImprintPageClient.tsx:37:    <MarketingShell
frontend/src/app/imprint/ImprintPageClient.tsx:188:    </MarketingShell>
frontend/src/app/compare/humata/HumataContent.tsx:8:import MarketingShell from '../../../components/marketing/MarketingShell';
frontend/src/app/compare/humata/HumataContent.tsx:55:    <MarketingShell
frontend/src/app/compare/humata/HumataContent.tsx:209:    </MarketingShell>
frontend/src/app/pricing/PricingPageContent.tsx:8:import MarketingShell from '../../components/marketing/MarketingShell';
frontend/src/app/pricing/PricingPageContent.tsx:184:    <MarketingShell
frontend/src/app/pricing/PricingPageContent.tsx:374:    </MarketingShell>
frontend/src/app/compare/pdf-ai/PdfaiContent.tsx:8:import MarketingShell from '../../../components/marketing/MarketingShell';
frontend/src/app/compare/pdf-ai/PdfaiContent.tsx:55:    <MarketingShell
frontend/src/app/compare/pdf-ai/PdfaiContent.tsx:203:    </MarketingShell>
frontend/src/app/privacy/PrivacyPageClient.tsx:5:import MarketingShell from '../../components/marketing/MarketingShell';
frontend/src/app/privacy/PrivacyPageClient.tsx:15:    <MarketingShell
frontend/src/app/privacy/PrivacyPageClient.tsx:92:    </MarketingShell>
frontend/src/app/shared/[token]/page.tsx:5:import MarketingShell from '../../../components/marketing/MarketingShell';
frontend/src/app/shared/[token]/page.tsx:76:    <MarketingShell>
frontend/src/app/shared/[token]/page.tsx:134:    </MarketingShell>
frontend/src/app/use-cases/finance/FinanceContent.tsx:14:import MarketingShell from '../../../components/marketing/MarketingShell';
frontend/src/app/use-cases/finance/FinanceContent.tsx:90:    <MarketingShell
frontend/src/app/use-cases/finance/FinanceContent.tsx:241:    </MarketingShell>
frontend/src/app/contact/ContactPageClient.tsx:6:import MarketingShell from '../../components/marketing/MarketingShell';
frontend/src/app/contact/ContactPageClient.tsx:72:    <MarketingShell
frontend/src/app/contact/ContactPageClient.tsx:236:    </MarketingShell>
frontend/src/app/compare/chatpdf/ChatpdfContent.tsx:8:import MarketingShell from '../../../components/marketing/MarketingShell';
frontend/src/app/compare/chatpdf/ChatpdfContent.tsx:59:    <MarketingShell
frontend/src/app/compare/chatpdf/ChatpdfContent.tsx:216:    </MarketingShell>
frontend/src/app/editorial.css:2:   .dt-editorial so it never affects the functional app UI. Light only. */
frontend/src/app/editorial.css:3:.dt-editorial {
frontend/src/app/editorial.css:41:   MarketingShell's root is `.dt-editorial min-h-screen flex flex-col` and a
frontend/src/app/editorial.css:43:   paper background above and every MarketingShell page — i.e. the whole
frontend/src/app/editorial.css:48:   selector keeps it working if MarketingShell ever drops `min-h-screen`.
frontend/src/app/editorial.css:51:.dt-stitch-root > .dt-editorial.min-h-screen,
frontend/src/app/editorial.css:52:.dt-stitch-root > .dt-editorial {
frontend/src/app/editorial.css:58:.dt-editorial::before {
frontend/src/app/editorial.css:67:.dt-editorial > * { position: relative; z-index: 1; }
frontend/src/app/editorial.css:73:.dt-editorial::after {
frontend/src/app/editorial.css:84:  .dt-editorial::after { display: none; }
frontend/src/app/editorial.css:87:  .dt-editorial::after { display: none; }
frontend/src/app/editorial.css:90:.dt-editorial .ed-shell {
frontend/src/app/editorial.css:96:  .dt-editorial .ed-shell { padding: 0 20px; }
frontend/src/app/editorial.css:99:.dt-editorial .ed-rule {
frontend/src/app/editorial.css:105:.dt-editorial .ed-section { padding: 88px 0; }
frontend/src/app/editorial.css:107:  .dt-editorial .ed-section { padding: 56px 0; }
frontend/src/app/editorial.css:112:.dt-editorial .ed-display {
frontend/src/app/editorial.css:120:.dt-editorial .ed-display em {
frontend/src/app/editorial.css:127:.dt-editorial .ed-h2 {
frontend/src/app/editorial.css:136:.dt-editorial .ed-h3 {
frontend/src/app/editorial.css:144:.dt-editorial .ed-lede {
frontend/src/app/editorial.css:150:.dt-editorial .ed-body {
frontend/src/app/editorial.css:156:.dt-editorial .ed-label {
frontend/src/app/editorial.css:164:.dt-editorial .ed-label-num { color: var(--ed-signal); }
frontend/src/app/editorial.css:166:.dt-editorial .ed-caption {
frontend/src/app/editorial.css:173:.dt-editorial .ed-num {
frontend/src/app/editorial.css:181:.dt-editorial .ed-cta {
frontend/src/app/editorial.css:194:.dt-editorial .ed-cta:hover { background: var(--ed-signal-deep); }
frontend/src/app/editorial.css:196:.dt-editorial .ed-link {
frontend/src/app/editorial.css:208:.dt-editorial .ed-link:hover {
frontend/src/app/editorial.css:213:.dt-editorial .ed-figure {
frontend/src/app/editorial.css:218:.dt-editorial a.ed-inline {
frontend/src/app/editorial.css:227:.dt-editorial .ed-halftone {
frontend/src/app/editorial.css:235:.dt-editorial .ed-crosshair {
frontend/src/app/editorial.css:240:.dt-editorial .ed-crosshair::before,
frontend/src/app/editorial.css:241:.dt-editorial .ed-crosshair::after {
frontend/src/app/editorial.css:246:.dt-editorial .ed-crosshair::before { left: 50%; top: 0; width: 1px; height: 100%; transform: translateX(-50%); }
frontend/src/app/editorial.css:247:.dt-editorial .ed-crosshair::after { top: 50%; left: 0; height: 1px; width: 100%; transform: translateY(-50%); }
frontend/src/app/editorial.css:250:.dt-editorial .ed-h1 {
frontend/src/app/editorial.css:260:.dt-editorial .ed-card {
frontend/src/app/editorial.css:267:.dt-editorial .ed-crumb {
frontend/src/app/editorial.css:276:.dt-editorial a.ed-crumb:hover { color: var(--ed-signal); }
frontend/src/app/editorial.css:278:.dt-editorial .ed-prose { max-width: 660px; }
frontend/src/app/editorial.css:279:.dt-editorial .ed-prose p {
frontend/src/app/editorial.css:285:.dt-editorial .ed-prose p:last-child { margin-bottom: 0; }
frontend/src/app/editorial.css:286:.dt-editorial .ed-prose a {
frontend/src/app/editorial.css:294:.dt-editorial a.ed-card {
frontend/src/app/editorial.css:297:.dt-editorial a.ed-card:hover {
frontend/src/app/editorial.css:301:.dt-editorial a.ed-card.ed-glass:hover {
frontend/src/app/editorial.css:307:.dt-editorial .ed-prose ul {
frontend/src/app/editorial.css:312:.dt-editorial .ed-prose ul li {
frontend/src/app/editorial.css:320:.dt-editorial .ed-prose ul li::before {
frontend/src/app/editorial.css:329:.dt-editorial .ed-prose ul li:last-child { margin-bottom: 0; }
frontend/src/app/editorial.css:340:.dt-editorial .ed-glass,
frontend/src/app/editorial.css:341:.dt-editorial.ed-glass {
frontend/src/app/editorial.css:349:.dt-editorial .ed-glass--strong,
frontend/src/app/editorial.css:350:.dt-editorial.ed-glass--strong {
frontend/src/app/editorial.css:353:.dt-editorial .ed-glass--header,
frontend/src/app/editorial.css:354:.dt-editorial.ed-glass--header {
frontend/src/app/editorial.css:358:/* The May-19 `.dt-editorial > *` rule (line 50) is (0,1,0) specificity —
frontend/src/app/editorial.css:365:.dt-editorial > header.ed-glass--header {
frontend/src/app/editorial.css:370:.dt-editorial .ed-glass--cta,
frontend/src/app/editorial.css:371:.dt-editorial.ed-glass--cta {
frontend/src/app/editorial.css:375:.dt-editorial .ed-glass--popover,
frontend/src/app/editorial.css:376:.dt-editorial.ed-glass--popover {
frontend/src/app/editorial.css:380:  .dt-editorial .ed-glass,
frontend/src/app/editorial.css:381:  .dt-editorial.ed-glass {
frontend/src/app/editorial.css:386:  .dt-editorial a.ed-card.ed-glass:hover {
frontend/src/app/editorial.css:392:  .dt-editorial .ed-glass,
frontend/src/app/editorial.css:393:  .dt-editorial.ed-glass {
frontend/src/app/editorial.css:400:  .dt-editorial a.ed-card.ed-glass:hover {
frontend/src/app/editorial.css:409:  .dt-editorial > header.ed-glass--header {
frontend/src/app/editorial.css:414:.dt-editorial *:focus-visible {
frontend/src/app/compare/CompareHubContent.tsx:7:import MarketingShell from '../../components/marketing/MarketingShell';
frontend/src/app/compare/CompareHubContent.tsx:48:    <MarketingShell
frontend/src/app/compare/CompareHubContent.tsx:92:    </MarketingShell>
frontend/src/app/use-cases/hr-contracts/HrContractsContent.tsx:18:import MarketingShell from '../../../components/marketing/MarketingShell';
frontend/src/app/use-cases/hr-contracts/HrContractsContent.tsx:89:    <MarketingShell
frontend/src/app/use-cases/hr-contracts/HrContractsContent.tsx:183:    </MarketingShell>
frontend/src/app/tools/word-counter/WordCounterClient.tsx:7:import MarketingShell from '../../../components/marketing/MarketingShell';
frontend/src/app/tools/word-counter/WordCounterClient.tsx:132:    <MarketingShell
frontend/src/app/tools/word-counter/WordCounterClient.tsx:362:    </MarketingShell>
frontend/src/app/terms/TermsPageClient.tsx:5:import MarketingShell from '../../components/marketing/MarketingShell';
frontend/src/app/terms/TermsPageClient.tsx:30:    <MarketingShell
frontend/src/app/terms/TermsPageClient.tsx:58:    </MarketingShell>
frontend/src/app/collections/[collectionId]/page.tsx:12:import DocumentDiffPanel from '../../../components/Diff/DocumentDiffPanel';
frontend/src/app/collections/[collectionId]/page.tsx:424:            <DocumentDiffPanel
frontend/src/components/landing/LandingPageContent.tsx:16: * design system (`.dt-editorial`) — warm-paper palette, Newsreader serif,
frontend/src/components/landing/LandingPageContent.tsx:26:    <div className="dt-editorial">
frontend/src/app/tools/ToolsHubContent.tsx:8:import MarketingShell from '../../components/marketing/MarketingShell';
frontend/src/app/tools/ToolsHubContent.tsx:45:    <MarketingShell
frontend/src/app/tools/ToolsHubContent.tsx:97:    </MarketingShell>
frontend/src/components/marketing/EdLanguageSelector.tsx:132:      className="dt-editorial ed-glass ed-glass--strong ed-glass--popover"
frontend/src/app/compare/notebooklm/NotebooklmContent.tsx:8:import MarketingShell from '../../../components/marketing/MarketingShell';
frontend/src/app/compare/notebooklm/NotebooklmContent.tsx:59:    <MarketingShell
frontend/src/app/compare/notebooklm/NotebooklmContent.tsx:212:    </MarketingShell>
frontend/src/app/tools/reading-time/ReadingTimeClient.tsx:18:import MarketingShell from '../../../components/marketing/MarketingShell';
frontend/src/app/tools/reading-time/ReadingTimeClient.tsx:135:    <MarketingShell
frontend/src/app/tools/reading-time/ReadingTimeClient.tsx:410:    </MarketingShell>
frontend/src/app/use-cases/consultants/ConsultantsContent.tsx:22:import MarketingShell from '../../../components/marketing/MarketingShell';
frontend/src/app/use-cases/consultants/ConsultantsContent.tsx:119:    <MarketingShell
frontend/src/app/use-cases/consultants/ConsultantsContent.tsx:227:    </MarketingShell>
frontend/src/app/trust/TrustPageContent.tsx:15:import MarketingShell from "../../components/marketing/MarketingShell";
frontend/src/app/trust/TrustPageContent.tsx:161:    <MarketingShell
frontend/src/app/trust/TrustPageContent.tsx:307:    </MarketingShell>
frontend/src/components/marketing/EditorialMarketingHeader.tsx:7:// Re-export Crumb so existing consumers (`MarketingShell`) keep working.
frontend/src/components/marketing/MarketingShell.tsx:8:export default function MarketingShell({
frontend/src/components/marketing/MarketingShell.tsx:23:    <div className="dt-editorial min-h-screen flex flex-col">
frontend/src/app/demo/DemoPageClient.tsx:10:import MarketingShell from '../../components/marketing/MarketingShell';
frontend/src/app/demo/DemoPageClient.tsx:72:    <MarketingShell
frontend/src/app/demo/DemoPageClient.tsx:276:    </MarketingShell>
frontend/src/app/features/free-demo/FreeDemoContent.tsx:13:import MarketingShell from '../../../components/marketing/MarketingShell';
frontend/src/app/features/free-demo/FreeDemoContent.tsx:123:    <MarketingShell
frontend/src/app/features/free-demo/FreeDemoContent.tsx:248:    </MarketingShell>
frontend/src/app/compare/askyourpdf/AskyourpdfContent.tsx:8:import MarketingShell from '../../../components/marketing/MarketingShell';
frontend/src/app/compare/askyourpdf/AskyourpdfContent.tsx:55:    <MarketingShell
frontend/src/app/compare/askyourpdf/AskyourpdfContent.tsx:209:    </MarketingShell>
frontend/src/app/features/performance-modes/PerformanceModesContent.tsx:11:import MarketingShell from '../../../components/marketing/MarketingShell';
frontend/src/app/features/performance-modes/PerformanceModesContent.tsx:77:    <MarketingShell
frontend/src/app/features/performance-modes/PerformanceModesContent.tsx:183:    </MarketingShell>
frontend/src/app/features/multi-format/MultiFormatContent.tsx:18:import MarketingShell from '../../../components/marketing/MarketingShell';
frontend/src/app/features/multi-format/MultiFormatContent.tsx:132:    <MarketingShell
frontend/src/app/features/multi-format/MultiFormatContent.tsx:270:    </MarketingShell>
frontend/src/app/use-cases/UseCasesHubContent.tsx:20:import MarketingShell from '../../components/marketing/MarketingShell';
frontend/src/app/use-cases/UseCasesHubContent.tsx:41:    <MarketingShell
frontend/src/app/use-cases/UseCasesHubContent.tsx:112:    </MarketingShell>
frontend/src/app/use-cases/students/StudentsContent.tsx:18:import MarketingShell from '../../../components/marketing/MarketingShell';
frontend/src/app/use-cases/students/StudentsContent.tsx:112:    <MarketingShell
frontend/src/app/use-cases/students/StudentsContent.tsx:214:    </MarketingShell>
frontend/src/app/alternatives/humata/HumataAltsContent.tsx:8:import MarketingShell from '../../../components/marketing/MarketingShell';
frontend/src/app/alternatives/humata/HumataAltsContent.tsx:55:    <MarketingShell
frontend/src/app/alternatives/humata/HumataAltsContent.tsx:176:    </MarketingShell>
frontend/src/app/use-cases/healthcare/HealthcareContent.tsx:21:import MarketingShell from '../../../components/marketing/MarketingShell';
frontend/src/app/use-cases/healthcare/HealthcareContent.tsx:111:    <MarketingShell
frontend/src/app/use-cases/healthcare/HealthcareContent.tsx:241:    </MarketingShell>
frontend/src/app/alternatives/notebooklm/NotebooklmAltsContent.tsx:8:import MarketingShell from '../../../components/marketing/MarketingShell';
frontend/src/app/alternatives/notebooklm/NotebooklmAltsContent.tsx:56:    <MarketingShell
frontend/src/app/alternatives/notebooklm/NotebooklmAltsContent.tsx:185:    </MarketingShell>
frontend/src/app/features/FeaturesHubContent.tsx:15:import MarketingShell from '../../components/marketing/MarketingShell';
frontend/src/app/features/FeaturesHubContent.tsx:67:    <MarketingShell
frontend/src/app/features/FeaturesHubContent.tsx:112:    </MarketingShell>
frontend/src/app/features/citations/CitationsContent.tsx:15:import MarketingShell from '../../../components/marketing/MarketingShell';
frontend/src/app/features/citations/CitationsContent.tsx:128:    <MarketingShell
frontend/src/app/features/citations/CitationsContent.tsx:224:    </MarketingShell>
frontend/src/app/document-diff/page.tsx:7:import DocumentDiffPanel from "../../components/Diff/DocumentDiffPanel";
frontend/src/app/document-diff/page.tsx:8:import MarketingShell from "../../components/marketing/MarketingShell";
frontend/src/app/document-diff/page.tsx:27:    <MarketingShell
frontend/src/app/document-diff/page.tsx:44:          <DocumentDiffPanel userPlan={userPlan} surface="editorial" />
frontend/src/app/document-diff/page.tsx:47:    </MarketingShell>
frontend/src/app/alternatives/AlternativesHubContent.tsx:7:import MarketingShell from '../../components/marketing/MarketingShell';
frontend/src/app/alternatives/AlternativesHubContent.tsx:53:    <MarketingShell
frontend/src/app/alternatives/AlternativesHubContent.tsx:95:    </MarketingShell>
frontend/src/app/features/layout-translation/LayoutTranslationPageContent.tsx:6:import MarketingShell from '../../../components/marketing/MarketingShell';
frontend/src/app/features/layout-translation/LayoutTranslationPageContent.tsx:33:    <MarketingShell
frontend/src/app/features/layout-translation/LayoutTranslationPageContent.tsx:97:    </MarketingShell>
frontend/src/app/use-cases/real-estate/RealEstateContent.tsx:22:import MarketingShell from '../../../components/marketing/MarketingShell';
frontend/src/app/use-cases/real-estate/RealEstateContent.tsx:134:    <MarketingShell
frontend/src/app/use-cases/real-estate/RealEstateContent.tsx:248:    </MarketingShell>
frontend/src/app/use-cases/compliance/ComplianceContent.tsx:23:import MarketingShell from '../../../components/marketing/MarketingShell';
frontend/src/app/use-cases/compliance/ComplianceContent.tsx:135:    <MarketingShell
frontend/src/app/use-cases/compliance/ComplianceContent.tsx:260:    </MarketingShell>
frontend/src/app/alternatives/pdf-ai/PdfAiAltsContent.tsx:8:import MarketingShell from '../../../components/marketing/MarketingShell';
frontend/src/app/alternatives/pdf-ai/PdfAiAltsContent.tsx:66:    <MarketingShell
frontend/src/app/alternatives/pdf-ai/PdfAiAltsContent.tsx:239:    </MarketingShell>
frontend/src/app/features/multilingual/MultilingualContent.tsx:7:import MarketingShell from '../../../components/marketing/MarketingShell';
frontend/src/app/features/multilingual/MultilingualContent.tsx:96:    <MarketingShell
frontend/src/app/features/multilingual/MultilingualContent.tsx:248:    </MarketingShell>
frontend/src/app/about/AboutPageClient.tsx:4:import MarketingShell from '../../components/marketing/MarketingShell';
frontend/src/app/about/AboutPageClient.tsx:15:    <MarketingShell
frontend/src/app/about/AboutPageClient.tsx:103:    </MarketingShell>
frontend/src/app/alternatives/chatpdf/ChatpdfAltsContent.tsx:8:import MarketingShell from '../../../components/marketing/MarketingShell';
frontend/src/app/alternatives/chatpdf/ChatpdfAltsContent.tsx:66:    <MarketingShell
frontend/src/app/alternatives/chatpdf/ChatpdfAltsContent.tsx:216:    </MarketingShell>
frontend/src/app/use-cases/lawyers/LawyersContent.tsx:16:import MarketingShell from '../../../components/marketing/MarketingShell';
frontend/src/app/use-cases/lawyers/LawyersContent.tsx:46: * pass into the client islands (EdFaqList, MarketingShell).
frontend/src/app/use-cases/lawyers/LawyersContent.tsx:86:    <MarketingShell
frontend/src/app/use-cases/lawyers/LawyersContent.tsx:186:    </MarketingShell>
frontend/src/app/use-cases/teachers/TeachersContent.tsx:20:import MarketingShell from '../../../components/marketing/MarketingShell';
frontend/src/app/use-cases/teachers/TeachersContent.tsx:125:    <MarketingShell
frontend/src/app/use-cases/teachers/TeachersContent.tsx:235:    </MarketingShell>
frontend/src/app/blog/BlogIndexClient.tsx:8:import MarketingShell from '../../components/marketing/MarketingShell';
frontend/src/app/blog/BlogIndexClient.tsx:49:    <MarketingShell
frontend/src/app/blog/BlogIndexClient.tsx:135:    </MarketingShell>
frontend/src/app/[locale]/demo/page.tsx:9:// the breadcrumb ("Home" crumb), retry/loading copy, and — since MarketingShell
frontend/src/app/alternatives/askyourpdf/AskyourpdfAltsContent.tsx:8:import MarketingShell from '../../../components/marketing/MarketingShell';
frontend/src/app/alternatives/askyourpdf/AskyourpdfAltsContent.tsx:66:    <MarketingShell
frontend/src/app/alternatives/askyourpdf/AskyourpdfAltsContent.tsx:238:    </MarketingShell>
frontend/src/app/blog/[slug]/BlogPostClient.tsx:11:import MarketingShell from '../../../components/marketing/MarketingShell';
frontend/src/app/blog/[slug]/BlogPostClient.tsx:213:    <MarketingShell
frontend/src/app/blog/[slug]/BlogPostClient.tsx:475:    </MarketingShell>
frontend/src/app/blog/category/[category]/CategoryClient.tsx:8:import MarketingShell from '../../../../components/marketing/MarketingShell';
frontend/src/app/blog/category/[category]/CategoryClient.tsx:68:    <MarketingShell
frontend/src/app/blog/category/[category]/CategoryClient.tsx:175:    </MarketingShell>

exec
/bin/zsh -lc "rg -n 'font-(extrabold|black)|fontWeight["'^'"\\n]*(800|900)|font-weight:\\s*(800|900)' frontend/src | sed -n '1,240p'" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
exec
/bin/zsh -lc 'git diff --unified=100 782f8b0..HEAD -- frontend/src/components/marketing/EdComparisonTable.tsx frontend/src/components/marketing/EdFaqList.tsx frontend/src/components/marketing/EdCardGrid.tsx frontend/src/components/marketing/EdCtaBanner.tsx' in /Users/mayijie/Projects/Code/010_DocTalk
exec
/bin/zsh -lc "git diff --unified=120 782f8b0..HEAD -- 'frontend/src/app/shared/[token]/page.tsx'" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
diff --git a/frontend/src/app/shared/[token]/page.tsx b/frontend/src/app/shared/[token]/page.tsx
index ded7867..0cbaf55 100644
--- a/frontend/src/app/shared/[token]/page.tsx
+++ b/frontend/src/app/shared/[token]/page.tsx
@@ -1,121 +1,136 @@
 import { createHmac } from 'node:crypto';
 import { notFound } from 'next/navigation';
 import { headers } from 'next/headers';
 import type { Metadata } from 'next';
+import MarketingShell from '../../../components/marketing/MarketingShell';
 
 const BACKEND_URL = process.env.BACKEND_INTERNAL_URL || process.env.NEXT_PUBLIC_API_BASE || '';
 // C1: ADAPTER_SECRET signs the X-Proxy-IP claim. Must match the backend's
 // settings.ADAPTER_SECRET. NOT AUTH_SECRET — AUTH_SECRET stays inside Auth.js.
 const ADAPTER_SECRET = process.env.ADAPTER_SECRET;
 
 interface SharedCitation {
   text_snippet: string;
   page: number;
   document_filename: string;
 }
 
 interface SharedMessage {
   id: string;
   role: string;
   content: string;
   citations?: SharedCitation[];
 }
 
 async function fetchShared(token: string) {
   const headersList = await headers();
   const xff = headersList.get('x-forwarded-for') || '';
   const clientIp = xff.split(',')[0]?.trim() || headersList.get('x-real-ip') || '';
 
   const backendHeaders: Record<string, string> = {};
   // C1: triple-header HMAC contract. Backend rate-limits /api/shared/{token}
   // per real visitor; this proves the IP claim came from our SSR origin and
   // not a direct attacker who can set arbitrary headers. Same trust model as
   // /api/proxy. Per-request timestamp + 60s skew window blocks replay.
   if (clientIp && ADAPTER_SECRET) {
     const ts = Math.floor(Date.now() / 1000).toString();
     const sig = createHmac('sha256', ADAPTER_SECRET)
       .update(`${clientIp}:${ts}`)
       .digest('hex');
     backendHeaders['X-Proxy-IP'] = clientIp;
     backendHeaders['X-Proxy-IP-Ts'] = ts;
     backendHeaders['X-Proxy-IP-Sig'] = sig;
   }
 
   try {
     const res = await fetch(`${BACKEND_URL}/api/shared/${token}`, {
       headers: backendHeaders,
       cache: 'no-store',
     });
     if (!res.ok) return null;
     return res.json();
   } catch {
     return null;
   }
 }
 
 export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
   const { token } = await params;
   const data = await fetchShared(token);
   if (!data) return { title: 'Not Found' };
   const preview = data.messages?.find((m: SharedMessage) => m.role === 'assistant')?.content?.slice(0, 150) || '';
   return {
     title: data.session_title,
     description: preview,
     robots: { index: false, follow: false },
     openGraph: { title: data.session_title, description: preview },
   };
 }
 
 export default async function SharedPage({ params }: { params: Promise<{ token: string }> }) {
   const { token } = await params;
   const data = await fetchShared(token);
   if (!data) notFound();
 
   return (
-    <div className="min-h-screen bg-white dark:bg-zinc-950">
-      <div className="max-w-3xl mx-auto px-4 py-8">
-        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 mb-1">{data.session_title}</h1>
-        <p className="text-sm text-zinc-500 mb-6">Document: {data.document_name}</p>
+    <MarketingShell>
+      <div className="ed-shell" style={{ maxWidth: '760px', paddingTop: '48px', paddingBottom: '64px' }}>
+        <h1 className="ed-h1">{data.session_title}</h1>
+        <p className="ed-caption" style={{ marginTop: '8px', marginBottom: '32px' }}>
+          Document: {data.document_name}
+        </p>
 
-        <div className="space-y-4">
+        <div className="flex flex-col" style={{ gap: '16px' }}>
           {data.messages.map((msg: SharedMessage, i: number) => (
             <div
               key={msg.id || i}
               id={msg.id}
-              className={`scroll-mt-6 rounded-2xl transition-[background-color,box-shadow] target:bg-blue-50 target:ring-2 target:ring-blue-300 target:ring-offset-4 target:ring-offset-white dark:target:bg-blue-950/30 dark:target:ring-blue-700 dark:target:ring-offset-zinc-950 ${
-                msg.role === 'user' ? 'flex justify-end' : ''
-              }`}
+              className={`scroll-mt-6 target:bg-[var(--ed-paper-2)] ${msg.role === 'user' ? 'flex justify-end' : ''}`}
+              style={{ transition: 'background-color 300ms ease' }}
             >
-              <div className={`max-w-[85%] rounded-xl px-4 py-3 ${
-                msg.role === 'user'
-                  ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
-                  : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100'
-              }`}>
-                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
+              <div
+                className="ed-card"
+                style={{
+                  maxWidth: '85%',
+                  ...(msg.role === 'user'
+                    ? { background: 'var(--ed-ink)', color: '#ffffff', border: '1px solid var(--ed-ink)' }
+                    : {}),
+                }}
+              >
+                <p className="ed-body" style={msg.role === 'user' ? { color: '#ffffff' } : undefined}>
+                  {msg.content}
+                </p>
                 {msg.citations && msg.citations.length > 0 && (
-                  <div className="mt-2 space-y-1">
+                  <div className="flex flex-col" style={{ marginTop: '10px', gap: '6px' }}>
                     {msg.citations.map((c, j: number) => (
-                      <div key={j} className="text-xs text-zinc-500 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-700 rounded px-2 py-1">
+                      <div
+                        key={j}
+                        className="ed-caption"
+                        style={{
+                          border: '1px solid var(--ed-rule)',
+                          background: 'var(--ed-paper-2)',
+                          padding: '4px 8px',
+                          borderRadius: '3px',
+                          color: 'var(--ed-ink-2)',
+                        }}
+                      >
                         p. {c.page}{c.document_filename ? ` — ${c.document_filename}` : ''}: &ldquo;{c.text_snippet}&rdquo;
                       </div>
                     ))}
                   </div>
                 )}
               </div>
             </div>
           ))}
         </div>
 
-        <div className="mt-12 text-center border-t border-zinc-200 dark:border-zinc-800 pt-6">
-          <p className="text-sm text-zinc-500 mb-3">Powered by DocTalk</p>
-          <a
-            href="https://www.doctalk.site"
-            className="inline-block px-6 py-2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
-          >
+        <div style={{ marginTop: '48px', textAlign: 'center', borderTop: '1px solid var(--ed-rule)', paddingTop: '24px' }}>
+          <p className="ed-caption" style={{ marginBottom: '12px' }}>Powered by DocTalk</p>
+          <a href="https://www.doctalk.site" className="ed-cta">
             Try DocTalk Free
           </a>
         </div>
       </div>
-    </div>
+    </MarketingShell>
   );
 }

 succeeded in 0ms:
diff --git a/frontend/src/components/marketing/EdCardGrid.tsx b/frontend/src/components/marketing/EdCardGrid.tsx
index afa6e55..97295d0 100644
--- a/frontend/src/components/marketing/EdCardGrid.tsx
+++ b/frontend/src/components/marketing/EdCardGrid.tsx
@@ -1,70 +1,70 @@
 import Link from "next/link";
 
 interface CardItem {
   label?: string;
   title: string;
   body?: string;
   icon?: React.ComponentType<{ className?: string }>;
   href?: string;
 }
 
 interface EdCardGridProps {
   items: CardItem[];
   columns?: 2 | 3;
 }
 
 export default function EdCardGrid({ items, columns = 3 }: EdCardGridProps) {
   const colClass = columns === 2 ? "sm:grid-cols-2" : "sm:grid-cols-3";
 
   return (
     <div
       className={`grid grid-cols-1 ${colClass}`}
       style={{ gap: "16px", gridAutoRows: "1fr" }}
     >
       {items.map((item, index) => {
         const Icon = item.icon;
         const inner = (
           <>
             {Icon && (
               <div
                 style={{ marginBottom: "10px", color: "var(--ed-ink-3)" }}
               >
                 <Icon className="w-4 h-4" />
               </div>
             )}
             {item.label && (
               <div className="ed-label" style={{ marginBottom: "8px" }}>
                 {item.label}
               </div>
             )}
             <h3 className="ed-h3">{item.title}</h3>
             {item.body && (
               <p className="ed-body" style={{ marginTop: "8px" }}>
                 {item.body}
               </p>
             )}
           </>
         );
 
         return item.href ? (
           <Link
             key={`card-${index}`}
             href={item.href}
-            className="ed-card h-full"
+            className="ed-card ed-glass h-full"
             style={{ display: "flex", flexDirection: "column" }}
           >
             {inner}
           </Link>
         ) : (
           <div
             key={`card-${index}`}
-            className="ed-card h-full"
+            className="ed-card ed-glass h-full"
             style={{ display: "flex", flexDirection: "column" }}
           >
             {inner}
           </div>
         );
       })}
     </div>
   );
 }
diff --git a/frontend/src/components/marketing/EdComparisonTable.tsx b/frontend/src/components/marketing/EdComparisonTable.tsx
index 13cfa23..7b44a5e 100644
--- a/frontend/src/components/marketing/EdComparisonTable.tsx
+++ b/frontend/src/components/marketing/EdComparisonTable.tsx
@@ -7,175 +7,176 @@ import EdInlineCell from "./EdInlineCell";
 type CellValue = string | boolean;
 
 interface SingleCompetitorFeature {
   name: string;
   doctalk: CellValue;
   competitor: CellValue;
 }
 
 interface MultiCompetitorFeature {
   name: string;
   doctalk: CellValue;
   competitors: CellValue[];
 }
 
 /**
  * Single-competitor shape (legacy, used by `compare/*` and `alternatives/*` pages).
  * Pass `features: { name, doctalk, competitor }[]` + `competitorName: string`.
  */
 interface SingleCompetitorProps {
   features: SingleCompetitorFeature[];
   competitorName: string;
   competitors?: never;
   featureLabel?: string;
 }
 
 /**
  * Multi-competitor shape (used when comparing DocTalk against ≥2 tools).
  * Pass `competitors: string[]` (column headers in display order)
  * + `features: { name, doctalk, competitors: CellValue[] }[]` where each
  * row's `competitors` array is aligned to the same order as the top-level
  * `competitors` prop.
  */
 interface MultiCompetitorProps {
   features: MultiCompetitorFeature[];
   competitors: string[];
   competitorName?: never;
   featureLabel?: string;
 }
 
 /**
  * Comparison table for editorial marketing surface.
  *
  * Accepts EITHER:
  * - single-competitor shape: `{ features: [{ name, doctalk, competitor }], competitorName }`
  *   (legacy — kept for backwards compatibility with all `compare/*` and `alternatives/*` callers).
  * - multi-competitor shape: `{ features: [{ name, doctalk, competitors: [...] }], competitors: [...] }`
  *   (use when you need N competitor columns; replaces bespoke inline tables).
  *
  * `featureLabel` optionally overrides the leftmost column header
  * (defaults to `t('billing.comparison.feature')`).
  *
  * Styling (hairline border, DocTalk-column emphasis, scope attributes) is
  * identical across both shapes — extending to N cols preserves the editorial
  * look of the 3-col version.
  */
 export type EdComparisonTableProps = SingleCompetitorProps | MultiCompetitorProps;
 
 function isMulti(
   props: EdComparisonTableProps
 ): props is MultiCompetitorProps {
   return Array.isArray((props as MultiCompetitorProps).competitors);
 }
 
 export default function EdComparisonTable(props: EdComparisonTableProps) {
   const { t } = useLocale();
   const featureHeader = props.featureLabel ?? t("billing.comparison.feature");
 
   // Normalize to multi-competitor shape internally.
   const competitorHeaders: string[] = isMulti(props)
     ? props.competitors
     : [props.competitorName];
 
   const rows: MultiCompetitorFeature[] = isMulti(props)
     ? props.features
     : props.features.map((feature) => ({
         name: feature.name,
         doctalk: feature.doctalk,
         competitors: [feature.competitor],
       }));
 
   const competitorCount = competitorHeaders.length;
   // Match legacy single-competitor layout exactly: 40 / 30 / 30.
   // For N>1 competitors, give 40% to feature column and split the rest evenly
   // between DocTalk + each competitor (so a 3-competitor table is 40 / 15 / 15 / 15 / 15).
   const featureColWidth = "40%";
   const dataColWidth = competitorCount === 1
     ? "30%"
     : `${60 / (competitorCount + 1)}%`;
 
   const headStyle: React.CSSProperties = {
     padding: "14px 18px",
     textAlign: "center",
     width: dataColWidth,
   };
   const cellStyle: React.CSSProperties = {
     padding: "13px 18px",
     textAlign: "center",
   };
 
   return (
-    <div style={{ overflowX: "auto" }}>
-      <table
-        style={{
-          width: "100%",
-          borderCollapse: "collapse",
-          minWidth: competitorCount > 1 ? "600px" : "480px",
-          border: "1px solid var(--ed-rule)",
-        }}
-      >
-        <thead>
-          <tr style={{ borderBottom: "1px solid var(--ed-rule)" }}>
-            <th
-              scope="col"
-              className="ed-label"
-              style={{
-                width: featureColWidth,
-                padding: "14px 18px",
-                textAlign: "left",
-              }}
-            >
-              {featureHeader}
-            </th>
-            <th
-              scope="col"
-              className="ed-label"
-              style={{
-                ...headStyle,
-                background: "var(--ed-paper-2)",
-                color: "var(--ed-signal)",
-              }}
-            >
-              DocTalk
-            </th>
-            {competitorHeaders.map((name, i) => (
-              <th key={`${name}-${i}`} scope="col" className="ed-label" style={headStyle}>
-                {name}
-              </th>
-            ))}
-          </tr>
-        </thead>
-        <tbody>
-          {rows.map((feature, i) => (
-            <tr key={i} style={{ borderTop: "1px solid var(--ed-rule)" }}>
+    <div className="ed-glass" style={{ padding: "4px", overflow: "hidden" }}>
+      <div style={{ overflowX: "auto" }}>
+        <table
+          style={{
+            width: "100%",
+            borderCollapse: "collapse",
+            minWidth: competitorCount > 1 ? "600px" : "480px",
+          }}
+        >
+          <thead>
+            <tr style={{ borderBottom: "1px solid var(--ed-rule)" }}>
               <th
-                scope="row"
-                className="ed-body"
+                scope="col"
+                className="ed-label"
                 style={{
-                  padding: "13px 18px",
-                  fontWeight: 500,
-                  color: "var(--ed-ink)",
+                  width: featureColWidth,
+                  padding: "14px 18px",
                   textAlign: "left",
                 }}
               >
-                {feature.name}
+                {featureHeader}
               </th>
-              <td
+              <th
+                scope="col"
+                className="ed-label"
                 style={{
-                  ...cellStyle,
+                  ...headStyle,
                   background: "var(--ed-paper-2)",
+                  color: "var(--ed-signal)",
                 }}
               >
-                <EdInlineCell value={feature.doctalk} />
-              </td>
-              {feature.competitors.map((value, j) => (
-                <td key={j} style={cellStyle}>
-                  <EdInlineCell value={value} />
-                </td>
+                DocTalk
+              </th>
+              {competitorHeaders.map((name, i) => (
+                <th key={`${name}-${i}`} scope="col" className="ed-label" style={headStyle}>
+                  {name}
+                </th>
               ))}
             </tr>
-          ))}
-        </tbody>
-      </table>
+          </thead>
+          <tbody>
+            {rows.map((feature, i) => (
+              <tr key={i} style={{ borderTop: "1px solid var(--ed-rule)" }}>
+                <th
+                  scope="row"
+                  className="ed-body"
+                  style={{
+                    padding: "13px 18px",
+                    fontWeight: 500,
+                    color: "var(--ed-ink)",
+                    textAlign: "left",
+                  }}
+                >
+                  {feature.name}
+                </th>
+                <td
+                  style={{
+                    ...cellStyle,
+                    background: "var(--ed-paper-2)",
+                  }}
+                >
+                  <EdInlineCell value={feature.doctalk} />
+                </td>
+                {feature.competitors.map((value, j) => (
+                  <td key={j} style={cellStyle}>
+                    <EdInlineCell value={value} />
+                  </td>
+                ))}
+              </tr>
+            ))}
+          </tbody>
+        </table>
+      </div>
     </div>
   );
 }
diff --git a/frontend/src/components/marketing/EdCtaBanner.tsx b/frontend/src/components/marketing/EdCtaBanner.tsx
index 584f547..7a46a9f 100644
--- a/frontend/src/components/marketing/EdCtaBanner.tsx
+++ b/frontend/src/components/marketing/EdCtaBanner.tsx
@@ -1,72 +1,66 @@
 import Link from "next/link";
 
 interface CtaLink {
   label: string;
   href: string;
 }
 
 interface EdCtaBannerProps {
   title?: string;
   description?: string;
   primary: CtaLink;
   secondary?: CtaLink;
 }
 
 export default function EdCtaBanner({
   title,
   description,
   primary,
   secondary,
 }: EdCtaBannerProps) {
   return (
-    <section
-      className="ed-section"
-      style={{
-        background: "var(--ed-paper-2)",
-        borderTop: "1px solid var(--ed-rule)",
-      }}
-    >
+    <section className="ed-section ed-glass ed-glass--cta">
       <div className="ed-shell">
         <div
           style={{
             textAlign: "center",
             margin: "0 auto",
             maxWidth: "640px",
           }}
         >
           {title && <h2 className="ed-h2">{title}</h2>}
 
           {description && (
             <p
               className="ed-lede"
               style={title ? { marginTop: "14px" } : undefined}
             >
               {description}
             </p>
           )}
 
           <div
             style={{
               marginTop: "26px",
               display: "flex",
               gap: "16px",
               flexWrap: "wrap",
               justifyContent: "center",
               alignItems: "center",
             }}
           >
             <Link href={primary.href} className="ed-cta">
               {primary.label}
             </Link>
 
             {secondary && (
               <Link href={secondary.href} className="ed-link">
                 {secondary.label} <span aria-hidden="true">→</span>
               </Link>
             )}
           </div>
         </div>
       </div>
     </section>
   );
 }
diff --git a/frontend/src/components/marketing/EdFaqList.tsx b/frontend/src/components/marketing/EdFaqList.tsx
index 9b25a8e..513beea 100644
--- a/frontend/src/components/marketing/EdFaqList.tsx
+++ b/frontend/src/components/marketing/EdFaqList.tsx
@@ -1,176 +1,176 @@
 "use client";
 
 import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
 
 // SSR-safe layout effect — useLayoutEffect warns under server rendering, so
 // we fall back to useEffect when `window` isn't available. This keeps the
 // first painted frame in sync with the measured scrollHeight on the client
 // (no collapsed→expanded jump) while remaining safe for any SSR boundary.
 const useIsomorphicLayoutEffect =
   typeof window !== "undefined" ? useLayoutEffect : useEffect;
 
 interface FaqItem {
   question: string;
   answer: string;
 }
 
 interface EdFaqListProps {
   items: FaqItem[];
 }
 
 export default function EdFaqList({ items }: EdFaqListProps) {
   const [openIndex, setOpenIndex] = useState<number | null>(null);
 
   const toggle = (idx: number) => {
     setOpenIndex(openIndex === idx ? null : idx);
   };
 
   return (
-    <div>
+    <div className="ed-glass" style={{ padding: "6px 28px" }}>
       {items.map((item, index) => {
         const isOpen = openIndex === index;
         const questionNum = `Q${index + 1}`;
 
         return (
           <FaqRow
             key={`faq-${index}`}
             index={index}
             questionNum={questionNum}
             question={item.question}
             answer={item.answer}
             isOpen={isOpen}
-            isLast={index === items.length - 1}
             onToggle={() => toggle(index)}
           />
         );
       })}
     </div>
   );
 }
 
 interface FaqRowProps {
   index: number;
   questionNum: string;
   question: string;
   answer: string;
   isOpen: boolean;
-  isLast: boolean;
   onToggle: () => void;
 }
 
 function FaqRow({
   index,
   questionNum,
   question,
   answer,
   isOpen,
-  isLast,
   onToggle,
 }: FaqRowProps) {
   const contentRef = useRef<HTMLDivElement>(null);
   const [height, setHeight] = useState(0);
 
   useIsomorphicLayoutEffect(() => {
     const el = contentRef.current;
     if (!el || !isOpen) return;
     setHeight(el.scrollHeight);
     const ro = new ResizeObserver(() => setHeight(el.scrollHeight));
     ro.observe(el);
     return () => ro.disconnect();
   }, [isOpen]);
 
   const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
   useEffect(() => {
     const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
     setPrefersReducedMotion(mq.matches);
     const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
     mq.addEventListener("change", handler);
     return () => mq.removeEventListener("change", handler);
   }, []);
 
   return (
     <div
       style={{
-        borderTop: "1px solid var(--ed-rule)",
-        borderBottom: isLast ? "1px solid var(--ed-rule)" : undefined,
+        // Rows divide each other, but the glass panel's own border already
+        // closes the list — drawing an edge rule here too puts a second,
+        // shorter hairline 6px inside the panel edge (the wrapper's vertical
+        // padding), which reads as a stray line rather than a divider.
+        borderTop: index === 0 ? undefined : "1px solid var(--ed-rule)",
       }}
     >
       <button
         type="button"
         id={`ed-faq-btn-${index}`}
         onClick={onToggle}
         aria-expanded={isOpen}
         aria-controls={`ed-faq-panel-${index}`}
         style={{
           display: "flex",
           justifyContent: "space-between",
           alignItems: "flex-start",
           gap: "24px",
           textAlign: "left",
           width: "100%",
           padding: "20px 0",
           cursor: "pointer",
           background: "transparent",
           border: "none",
         }}
       >
         {/* Left: number + question */}
         <span
           style={{
             display: "flex",
             alignItems: "baseline",
             gap: "16px",
             flex: 1,
           }}
         >
           <span
             className="ed-caption"
             aria-hidden="true"
             style={{ color: "var(--ed-signal)", flexShrink: 0 }}
           >
             {questionNum}
           </span>
           <span className="ed-h3">{question}</span>
         </span>
 
         {/* Right: +/− indicator */}
         <span
           className="ed-caption"
           aria-hidden="true"
           style={{
             flexShrink: 0,
             fontSize: "16px",
             letterSpacing: 0,
             color: "var(--ed-ink-3)",
             marginTop: "2px",
           }}
         >
           {isOpen ? "−" : "+"}
         </span>
       </button>
 
       {/* Answer panel — measured-height accordion */}
       <div
         id={`ed-faq-panel-${index}`}
         role="region"
         aria-labelledby={`ed-faq-btn-${index}`}
         ref={contentRef}
         style={{
           overflow: "hidden",
           maxHeight: isOpen ? `${height}px` : "0px",
           opacity: isOpen ? 1 : 0,
           transition: prefersReducedMotion
             ? "none"
             : "max-height 300ms ease, opacity 300ms ease",
         }}
       >
         <p
           className="ed-body"
           style={{ maxWidth: "660px", paddingBottom: "20px" }}
         >
           {answer}
         </p>
       </div>
     </div>
   );
 }

exec
/bin/zsh -lc 'git diff --unified=60 782f8b0..HEAD -- frontend/src/app/demo/DemoPageClient.tsx frontend/src/app/tools/reading-time/ReadingTimeClient.tsx frontend/src/app/trust/TrustPageContent.tsx frontend/src/components/Diff/DocumentDiffPanel.tsx frontend/src/components/landing/FeatureGrid.tsx frontend/src/components/landing/HeroCollage.tsx frontend/src/components/marketing/EdInlineCell.tsx' in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
diff --git a/frontend/src/app/demo/DemoPageClient.tsx b/frontend/src/app/demo/DemoPageClient.tsx
index c7be17b..6754f59 100644
--- a/frontend/src/app/demo/DemoPageClient.tsx
+++ b/frontend/src/app/demo/DemoPageClient.tsx
@@ -66,213 +66,213 @@ export default function DemoPageClient() {
     fetchDocs();
   }, []);
 
   const docsBySlug = new Map(docs.map((doc) => [doc.slug, doc]));
 
   return (
     <MarketingShell
       breadcrumb={[
         { label: t('useCasesHub.breadcrumb.home'), href: localizedHrefIfAvailable(locale, '/') },
         { label: t('footer.demo') },
       ]}
     >
       <EdPageHero
         eyebrow={tOr('demo.eyebrow', 'Public demo')}
         title={t('demo.title')}
         lede={t('demo.subtitle')}
         meta={
           <div className="flex gap-4 flex-wrap">
             <span className="inline-flex items-center gap-2">
               <FileCheck2
                 aria-hidden="true"
                 size={14}
                 style={{ color: 'var(--ed-ink-3)' }}
               />
               <span className="ed-caption">{t('demo.freeMessages')}</span>
             </span>
             <span className="inline-flex items-center gap-2">
               <Quote
                 aria-hidden="true"
                 size={14}
                 style={{ color: 'var(--ed-ink-3)' }}
               />
               <span className="ed-caption">
                 {tOr('demo.citationPromise', 'Click citations to inspect the source')}
               </span>
             </span>
           </div>
         }
       />
 
       <EdSection title={tOr('demo.flow.title', 'What you will test')}>
         <EdStepRow
           steps={[
             { title: tOr('demo.flow.step1', 'Open a prepared document'), body: '' },
             { title: tOr('demo.flow.step2', 'Ask the suggested question'), body: '' },
             { title: tOr('demo.flow.step3', 'Jump from answer to source'), body: '' },
           ]}
         />
       </EdSection>
 
       <EdSection alt label={tOr('demo.samplesLabel', 'Sample documents')}>
         {error && (
           <div
             style={{
               border: '1px solid var(--ed-rule)',
               padding: '14px 16px',
               marginBottom: '24px',
             }}
           >
             <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
-              <span className="ed-body" style={{ color: 'var(--ed-ochre)' }}>
+              <span className="ed-body" style={{ color: 'var(--ed-signal-deep)' }}>
                 {tOr('demo.loadError', 'Demo documents could not be loaded.')}
               </span>
               <button
                 type="button"
                 onClick={fetchDocs}
                 className="ed-caption inline-flex items-center justify-center shrink-0"
                 style={{
                   border: '1px solid var(--ed-rule)',
                   background: 'var(--ed-paper)',
                   color: 'var(--ed-ink)',
                   padding: '7px 14px',
                 }}
               >
                 {tOr('common.retry', 'Retry')}
               </button>
             </div>
           </div>
         )}
 
         <div className="grid grid-cols-1 lg:grid-cols-3" style={{ gap: '16px' }}>
           {Object.entries(SAMPLE_CONFIG).map(([slug, config]) => {
             const doc = docsBySlug.get(slug);
             const Icon = config.icon;
             const isReady = Boolean(doc && doc.status === 'ready');
             const isPending = loading || Boolean(doc && doc.status !== 'ready');
             const suggestedQuestion = t(config.questionKey);
             const cardContent = (
               <>
                 <div className="flex items-center justify-between">
                   <span className="ed-caption uppercase">
                     {tOr(`demo.sample.${slug}.badge`, config.badge)}
                   </span>
                   <span className="ed-caption">
                     {tOr(`demo.sample.${slug}.pages`, config.pages)}
                   </span>
                 </div>
 
                 <div
                   className="flex items-center justify-between gap-3"
                   style={{ marginTop: '18px' }}
                 >
                   <div
                     style={{
                       width: '44px',
                       height: '44px',
                       border: '1px solid var(--ed-rule)',
                       background: 'var(--ed-paper-2)',
                       display: 'flex',
                       alignItems: 'center',
                       justifyContent: 'center',
                     }}
                   >
                     <Icon
                       aria-hidden="true"
                       size={22}
                       style={{ color: 'var(--ed-ink-2)' }}
                     />
                   </div>
                   {isPending && (
                     <span
                       className="ed-caption inline-flex shrink-0 items-center gap-1.5"
                     >
                       <Loader2 aria-hidden="true" size={12} className="animate-spin" />
                       {loading ? tOr('common.loading', 'Loading') : t('demo.processing')}
                     </span>
                   )}
                 </div>
 
                 <h3 className="ed-h3" style={{ marginTop: '16px' }}>
                   {t(config.titleKey)}
                 </h3>
                 <p className="ed-body" style={{ marginTop: '8px' }}>
                   {t(config.descKey)}
                 </p>
 
                 <div
                   style={{
                     marginTop: '18px',
                     border: '1px solid var(--ed-rule)',
                     background: 'var(--ed-paper)',
                     padding: '12px 14px',
                   }}
                 >
                   <p className="ed-caption uppercase">
                     {tOr('demo.suggestedQuestion', 'Suggested question')}
                   </p>
                   <p
                     className="ed-body"
                     style={{
                       marginTop: '8px',
                       fontFamily: 'var(--dt-serif)',
                       fontStyle: 'italic',
                     }}
                   >
                     &ldquo;{suggestedQuestion}&rdquo;
                   </p>
                 </div>
 
                 <div
                   className="flex items-center justify-between gap-3"
                   style={{
                     marginTop: 'auto',
                     paddingTop: '18px',
                   }}
                 >
                   <span className="ed-caption">
                     {isReady ? tOr('demo.ready', 'Ready to open') : tOr('demo.preparing', 'Preparing sample')}
                   </span>
                   <span
                     className="inline-flex items-center gap-1.5"
                     style={{
-                      fontFamily: 'var(--font-inter), sans-serif',
+                      fontFamily: 'var(--font-plex-sans), sans-serif',
                       fontSize: '14px',
                       fontWeight: 500,
                       color: 'var(--ed-ink)',
                     }}
                   >
                     {tOr('demo.openSample', 'Open sample')}
                     <ArrowRight aria-hidden="true" size={15} />
                   </span>
                 </div>
               </>
             );
 
             return isReady && doc ? (
               <Link
                 key={slug}
                 href={`/d/${doc.document_id}?question=${encodeURIComponent(suggestedQuestion)}`}
                 className="ed-card flex flex-col h-full"
                 style={{ minHeight: '390px' }}
               >
                 {cardContent}
               </Link>
             ) : (
               <div
                 key={slug}
                 className="ed-card flex flex-col h-full"
                 style={{ minHeight: '390px', opacity: 0.7 }}
               >
                 {cardContent}
               </div>
             );
           })}
         </div>
 
         <p className="ed-caption" style={{ marginTop: '32px' }}>
           {t('demo.hint')}
         </p>
       </EdSection>
     </MarketingShell>
   );
 }
diff --git a/frontend/src/app/tools/reading-time/ReadingTimeClient.tsx b/frontend/src/app/tools/reading-time/ReadingTimeClient.tsx
index e181a2f..bae67b6 100644
--- a/frontend/src/app/tools/reading-time/ReadingTimeClient.tsx
+++ b/frontend/src/app/tools/reading-time/ReadingTimeClient.tsx
@@ -238,121 +238,121 @@ export default function ReadingTimeClient() {
               <h2 className="ed-h3">{t('toolReadingTime.readingTimeHeading')}</h2>
             </div>
             <div className="flex flex-col" style={{ gap: '16px' }}>
               {readingSpeeds.map((row) => (
                 <div key={row.label}>
                   <div className="flex items-center justify-between" style={{ marginBottom: '4px', gap: '12px' }}>
                     <span className="ed-caption">{row.label}</span>
                     <span className="ed-caption tabular-nums">{t('toolReadingTime.wpmValue', { wpm: row.wpm })}</span>
                   </div>
                   <div className="flex items-center" style={{ gap: '12px' }}>
                     <div
                       className="flex-1 overflow-hidden"
                       style={{ height: '6px', background: 'var(--ed-rule)', borderRadius: '3px' }}
                     >
                       <div
                         style={{
                           height: '100%',
                           borderRadius: '3px',
                           background: 'var(--ed-signal)',
                           transition: 'width 300ms',
                           width: wordCount > 0
                             ? `${Math.min(100, (row.wpm / 350) * 100)}%`
                             : '0%',
                         }}
                       />
                     </div>
                     <span
                       className="ed-body tabular-nums text-right"
                       style={{ marginTop: 0, fontWeight: 600, color: 'var(--ed-ink)', minWidth: '5rem' }}
                     >
                       {wordCount > 0 ? formatDuration(row.minutes, t) : '--'}
                     </span>
                   </div>
                 </div>
               ))}
             </div>
           </div>
 
           {/* Speaking Time */}
           <div style={panelStyle}>
             <div className="flex items-center" style={{ gap: '8px', marginBottom: '16px' }}>
               <Mic aria-hidden="true" className="w-4 h-4" style={{ color: 'var(--ed-ink-3)' }} />
               <h2 className="ed-h3">{t('toolReadingTime.speakingTimeHeading')}</h2>
             </div>
             <div className="flex flex-col" style={{ gap: '16px' }}>
               {speakingSpeeds.map((row) => (
                 <div key={row.label}>
                   <div className="flex items-center justify-between" style={{ marginBottom: '4px', gap: '12px' }}>
                     <span className="ed-caption">{row.label}</span>
                     <span className="ed-caption tabular-nums">{t('toolReadingTime.wpmValue', { wpm: row.wpm })}</span>
                   </div>
                   <div className="flex items-center" style={{ gap: '12px' }}>
                     <div
                       className="flex-1 overflow-hidden"
                       style={{ height: '6px', background: 'var(--ed-rule)', borderRadius: '3px' }}
                     >
                       <div
                         style={{
                           height: '100%',
                           borderRadius: '3px',
-                          background: 'var(--ed-ochre)',
+                          background: 'var(--ed-slate-2)',
                           transition: 'width 300ms',
                           width: wordCount > 0
                             ? `${Math.min(100, (row.wpm / 180) * 100)}%`
                             : '0%',
                         }}
                       />
                     </div>
                     <span
                       className="ed-body tabular-nums text-right"
                       style={{ marginTop: 0, fontWeight: 600, color: 'var(--ed-ink)', minWidth: '5rem' }}
                     >
                       {wordCount > 0 ? formatSeconds(row.minutes, t) : '--'}
                     </span>
                   </div>
                 </div>
               ))}
             </div>
           </div>
         </div>
 
         {/* Comparison Reference Table */}
         <div style={{ ...panelStyle, marginTop: '24px' }}>
           <h2 className="ed-h3" style={{ marginBottom: '16px' }}>
             {t('toolReadingTime.referenceHeading')}
           </h2>
           <div className="overflow-x-auto">
             <table style={{ width: '100%', borderCollapse: 'collapse' }}>
               <thead>
                 <tr style={{ borderBottom: '1px solid var(--ed-rule)' }}>
                   <th className="ed-label" style={{ textAlign: 'left', padding: '8px' }}>
                     {t('toolReadingTime.colDocumentType')}
                   </th>
                   <th className="ed-label" style={{ textAlign: 'right', padding: '8px' }}>
                     {t('toolReadingTime.colTypicalWords')}
                   </th>
                   <th className="ed-label" style={{ textAlign: 'right', padding: '8px' }}>
                     {t('toolReadingTime.colReadingTime')}
                   </th>
                   <th className="ed-label" style={{ textAlign: 'right', padding: '8px' }}>
                     {t('toolReadingTime.colSpeakingTime')}
                   </th>
                 </tr>
               </thead>
               <tbody>
                 {referenceTable.map((row) => {
                   const Icon = row.icon;
                   return (
                     <tr key={row.type} style={{ borderBottom: '1px solid var(--ed-rule)' }}>
                       <td className="ed-body" style={{ marginTop: 0, padding: '10px 8px' }}>
                         <Icon aria-hidden="true" size={14} className="mr-2 inline-block" style={{ color: 'var(--ed-ink-3)' }} />
                         {row.type}
                       </td>
                       <td className="ed-body tabular-nums" style={{ marginTop: 0, padding: '10px 8px', textAlign: 'right' }}>
                         ~{row.words.toLocaleString()}
                       </td>
                       <td
                         className="ed-body tabular-nums"
                         style={{ marginTop: 0, padding: '10px 8px', textAlign: 'right', fontWeight: 600, color: 'var(--ed-ink)' }}
                       >
                         {formatDuration(row.words / 250, t)}
diff --git a/frontend/src/app/trust/TrustPageContent.tsx b/frontend/src/app/trust/TrustPageContent.tsx
index 9003614..cb139cc 100644
--- a/frontend/src/app/trust/TrustPageContent.tsx
+++ b/frontend/src/app/trust/TrustPageContent.tsx
@@ -151,159 +151,159 @@ export default async function TrustPageContent({ locale }: { locale: string }) {
     },
   ];
 
   const trustStats = [
     { label: t("trust.stats.encryption.label"), value: t("trust.stats.encryption.value") },
     { label: t("trust.stats.transport.label"), value: t("trust.stats.transport.value") },
     { label: t("trust.stats.retention.label"), value: t("trust.stats.retention.value") },
   ];
 
   return (
     <MarketingShell
       chrome={chrome}
       breadcrumb={[
         { label: t("useCasesHub.breadcrumb.home"), href: href("/") },
         { label: t("trust.breadcrumb.current") },
       ]}
     >
       <EdPageHero
         eyebrow={t("trust.hero.eyebrow")}
         title={t("trust.hero.title")}
         lede={t("trust.hero.lede")}
         meta={
           <div className="flex gap-4 flex-wrap items-center">
             <Link href={href("/privacy")} className="ed-cta">
               {t("trust.hero.privacyCta")}
             </Link>
             <Link href={href("/contact")} className="ed-link">
               {t("trust.hero.reportCta")} <span aria-hidden="true">→</span>
             </Link>
           </div>
         }
       />
 
       <EdSection alt label={t("trust.summary.label")}>
         <div
           className="grid grid-cols-1 sm:grid-cols-3"
           style={{ gap: "16px" }}
         >
           {trustStats.map((stat) => (
             <div
               key={stat.label}
               style={{
                 border: "1px solid var(--ed-rule)",
                 background: "var(--ed-paper-2)",
                 padding: "16px",
               }}
             >
               <div className="ed-h3">{stat.value}</div>
               <p className="ed-caption" style={{ marginTop: "6px" }}>
                 {stat.label}
               </p>
             </div>
           ))}
         </div>
         <p
           className="ed-caption"
           style={{
             marginTop: "20px",
             padding: "12px 14px",
             border: "1px solid var(--ed-rule)",
-            color: "var(--ed-ochre)",
+            color: "var(--ed-signal-deep)",
           }}
         >
           {t("trust.summary.disclaimer")}
         </p>
       </EdSection>
 
       <EdSection num="01" title={t("trust.encryption.heading")}>
         <div
           className="grid grid-cols-1 md:grid-cols-3"
           style={{ gap: "16px", gridAutoRows: "1fr" }}
         >
           {encryptionControls.map((c) => (
             <ControlCard key={c.title} {...c} />
           ))}
         </div>
       </EdSection>
 
       <EdSection alt num="02" title={t("trust.ingest.heading")}>
         <div
           className="grid grid-cols-1 md:grid-cols-3"
           style={{ gap: "16px", gridAutoRows: "1fr" }}
         >
           {ingestControls.map((c) => (
             <ControlCard key={c.title} {...c} />
           ))}
         </div>
       </EdSection>
 
       <EdSection num="03" title={t("trust.dataRights.heading")}>
         <div
           className="grid grid-cols-1 md:grid-cols-3"
           style={{ gap: "16px", gridAutoRows: "1fr" }}
         >
           {dataRightsControls.map((c) => (
             <ControlCard key={c.title} {...c} />
           ))}
         </div>
       </EdSection>
 
       <EdSection alt num="04" title={t("trust.gaps.heading")}>
         <div>
           {gaps.map((g, i) => (
             <div
               key={g.name}
               className="flex flex-col md:flex-row"
               style={{
                 padding: "18px 0",
                 borderTop: "1px solid var(--ed-rule)",
                 borderBottom:
                   i === gaps.length - 1 ? "1px solid var(--ed-rule)" : undefined,
                 gap: "12px",
               }}
             >
               <div className="md:w-64 shrink-0">
                 <div className="ed-body" style={{ fontWeight: 600 }}>
                   {g.name}
                 </div>
                 <div
                   className="ed-caption"
                   style={{
                     marginTop: "6px",
                     display: "inline-flex",
                     alignItems: "center",
                     gap: "6px",
                     textTransform: "uppercase",
-                    color: "var(--ed-ochre)",
+                    color: "var(--ed-slate)",
                   }}
                 >
                   <span
                     aria-hidden
                     style={{
                       width: "5px",
                       height: "5px",
-                      background: "var(--ed-ochre)",
+                      background: "var(--ed-slate)",
                     }}
                   />
                   {g.status}
                 </div>
               </div>
               <p className="ed-body" style={{ flex: 1 }}>
                 {g.note}
               </p>
             </div>
           ))}
         </div>
       </EdSection>
 
       <EdCtaBanner
         title={t("trust.cta.title")}
         description={t("trust.cta.description")}
         primary={{ label: t("trust.cta.primary"), href: href("/contact") }}
         secondary={{ label: t("trust.cta.secondary"), href: href("/privacy") }}
       />
     
       <MarketingLocaleLinks path="/trust" label={chrome.language} />
     </MarketingShell>
   );
 }
diff --git a/frontend/src/components/Diff/DocumentDiffPanel.tsx b/frontend/src/components/Diff/DocumentDiffPanel.tsx
index a95eaaf..42bbefc 100644
--- a/frontend/src/components/Diff/DocumentDiffPanel.tsx
+++ b/frontend/src/components/Diff/DocumentDiffPanel.tsx
@@ -348,168 +348,168 @@ export default function DocumentDiffPanel({
               <label className="min-w-0">
                 <span className="ed-label" style={{ display: "block", marginBottom: "6px" }}>
                   {tOr("diff.oldDocument", "Old document")}
                 </span>
                 <select
                   value={oldDocumentId}
                   onChange={(event) => setOldDocumentId(event.target.value)}
                   className="h-10 w-full"
                   style={edInputStyle}
                 >
                   {readyDocs.map((doc) => (
                     <option key={doc.id} value={doc.id}>{doc.filename}</option>
                   ))}
                 </select>
               </label>
               <label className="min-w-0">
                 <span className="ed-label" style={{ display: "block", marginBottom: "6px" }}>
                   {tOr("diff.newDocument", "New document")}
                 </span>
                 <select
                   value={newDocumentId}
                   onChange={(event) => setNewDocumentId(event.target.value)}
                   className="h-10 w-full"
                   style={edInputStyle}
                 >
                   {readyDocs.map((doc) => (
                     <option key={doc.id} value={doc.id}>{doc.filename}</option>
                   ))}
                 </select>
               </label>
               <button
                 type="button"
                 onClick={() => void runCompare()}
                 disabled={isWorking || readyDocs.length < 2 || oldDocumentId === newDocumentId}
                 className="ed-cta self-end disabled:cursor-not-allowed disabled:opacity-50"
               >
                 {isWorking ? <Clock3 size={15} aria-hidden="true" /> : <Play size={15} aria-hidden="true" />}
                 {isWorking ? tOr("diff.running", "Comparing...") : tOr("diff.run", "Compare")}
               </button>
             </div>
           </div>
           {readyDocs.length < 2 && (
             <p
               className="ed-caption"
               style={{
                 marginTop: "16px",
                 border: "1px dashed var(--ed-rule)",
                 background: "var(--ed-paper)",
                 borderRadius: "3px",
                 padding: "10px 14px",
               }}
             >
               {tOr("diff.needTwoDocs", "Upload or add at least two ready documents to compare.")}
             </p>
           )}
           {paywall && (
             <div
               className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
               style={{
                 marginTop: "16px",
-                border: "1px solid var(--ed-ochre)",
+                border: "1px solid var(--ed-slate)",
                 background: "var(--ed-paper)",
                 borderRadius: "3px",
                 padding: "12px 14px",
               }}
             >
               <span className="ed-body" style={{ marginTop: 0 }}>
                 {paywall.code === "INSUFFICIENT_CREDITS"
                   ? tOr("diff.paywallCredits", "You need more credits to compare these documents.")
                   : tOr("diff.paywallPlan", "Document Diff is a Pro workflow.")}
               </span>
               <Link
                 href={billingHref({ plan: "pro", source: collectionId ? "collection_reader" : "compare_page", reason: "document_diff" })}
                 className="ed-cta"
               >
                 {tOr("credits.upgradeToPro", "Upgrade to Pro")}
               </Link>
             </div>
           )}
           {error && (
             <div
               className="flex gap-2"
               style={{
                 marginTop: "16px",
                 border: "1px solid var(--ed-signal)",
                 background: "var(--ed-paper)",
                 borderRadius: "3px",
                 padding: "10px 14px",
               }}
             >
               <AlertTriangle size={16} className="mt-0.5 shrink-0" style={{ color: "var(--ed-signal)" }} aria-hidden="true" />
               <span className="ed-body" style={{ marginTop: 0, color: "var(--ed-signal-deep)" }}>{error}</span>
             </div>
           )}
         </section>
 
         {activeRun ? (
           <section style={{ ...edPanelStyle, padding: 0 }}>
             <div
               className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
               style={{ borderBottom: "1px solid var(--ed-rule)", padding: "16px 20px" }}
             >
               <div className="min-w-0">
                 <div className="flex items-center gap-2">
                   {activeRun.status === "succeeded" ? (
                     <CheckCircle2 size={16} style={{ color: "var(--ed-signal)" }} aria-hidden="true" />
                   ) : (
-                    <Clock3 size={16} style={{ color: "var(--ed-ochre)" }} aria-hidden="true" />
+                    <Clock3 size={16} style={{ color: "var(--ed-slate)" }} aria-hidden="true" />
                   )}
                   <h3 className="ed-h3 truncate" style={{ marginTop: 0 }}>
                     {oldName || tOr("diff.oldDocument", "Old document")} → {newName || tOr("diff.newDocument", "New document")}
                   </h3>
                 </div>
                 <p className="ed-caption" style={{ marginTop: "6px" }}>
                   {activeRun.status === "succeeded"
                     ? tOr("diff.completed", "Completed")
                     : tOr("diff.status", "Status: {status}", { status: activeRun.status })}
                 </p>
               </div>
               {activeRun.result && (
                 <div className="flex gap-2">
                   <button type="button" onClick={() => void handleExport("md")} className="inline-flex h-9 items-center gap-2" style={edExportBtnStyle}>
                     <Download size={14} aria-hidden="true" />
                     MD
                   </button>
                   <button type="button" onClick={() => void handleExport("csv")} className="inline-flex h-9 items-center gap-2" style={edExportBtnStyle}>
                     <Download size={14} aria-hidden="true" />
                     CSV
                   </button>
                 </div>
               )}
             </div>
 
             {activeRun.status === "failed" ? (
               <p className="ed-body" style={{ padding: "16px 20px", marginTop: 0, color: "var(--ed-signal-deep)" }}>
                 {activeRun.error_message || tOr("diff.failed", "Document comparison failed.")}
               </p>
             ) : activeRun.result ? (
               <div className="flex flex-col" style={{ gap: "20px", padding: "20px" }}>
                 <div
                   style={{
                     border: "1px solid var(--ed-rule)",
                     background: "var(--ed-paper)",
                     borderRadius: "3px",
                     padding: "16px",
                   }}
                 >
                   <p className="ed-label">{tOr("diff.summary", "Summary")}</p>
                   <p className="ed-body" style={{ marginTop: "10px" }}>{asString(result.summary)}</p>
                 </div>
                 {(["added", "removed", "modified"] as const).map((kind) => {
                   const items = groupChanges(changes, kind);
                   if (!items.length) return null;
                   const label = kind === "added"
                     ? tOr("diff.added", "Added")
                     : kind === "removed"
                       ? tOr("diff.removed", "Removed")
                       : tOr("diff.modified", "Modified");
                   return (
                     <div key={kind}>
                       <div className="mb-3 flex items-center gap-2">
                         <GitCompare size={15} style={{ color: "var(--ed-ink-3)" }} aria-hidden="true" />
                         <h4 className="ed-h3" style={{ marginTop: 0 }}>{label}</h4>
                         <span
                           className="ed-caption tabular-nums"
                           style={{
                             border: "1px solid var(--ed-rule)",
                             borderRadius: "999px",
diff --git a/frontend/src/components/landing/FeatureGrid.tsx b/frontend/src/components/landing/FeatureGrid.tsx
index 2477ca3..b19eafc 100644
--- a/frontend/src/components/landing/FeatureGrid.tsx
+++ b/frontend/src/components/landing/FeatureGrid.tsx
@@ -1,100 +1,100 @@
 "use client";
 
 import React from 'react';
 import { useLocale } from '../../i18n';
 import ScrollReveal from './ScrollReveal';
 
 /* ---------- Bespoke per-feature visuals — editorial neutrals ---------- */
 /* All backgrounds → var(--ed-paper-2), borders → var(--ed-rule),
    text → --ed-ink / --ed-ink-3, any accent → var(--ed-signal).
    No dark: variants, no gradients, no zinc-*, no blue-*.
    Decorative — aria-hidden at root. */
 
 // Shared canvas: paper-2 background, rule border, compact 112px tall.
 const canvas =
   'relative h-28 w-full overflow-hidden border border-[var(--ed-rule)] bg-[var(--ed-paper-2)]';
 
 function VisualCitations() {
   const { t } = useLocale();
   return (
     <div aria-hidden="true" className={canvas}>
       <div className="absolute inset-0 flex items-center justify-center gap-3 px-4">
         {/* Mock document page with a highlighted line */}
         <div className="relative h-20 w-28 border border-[var(--ed-rule)] bg-[var(--ed-paper)] px-2 py-1.5">
           <div className="mb-1.5 font-mono text-[7px] uppercase tracking-wider text-[var(--ed-ink-3)]">
             report.pdf · p. 4
           </div>
           <div className="space-y-1">
             <div className="h-1 w-full bg-[var(--ed-rule)]" />
-            <div className="h-1.5 w-full bg-[var(--ed-signal)]/20 border-l-2 border-[var(--ed-signal)]" />
+            <div className="h-1.5 w-full bg-[var(--ed-signal)]/20 border-l-2 border-[var(--ed-slate)]" />
             <div className="h-1 w-4/5 bg-[var(--ed-rule)]" />
             <div className="h-1 w-3/4 bg-[var(--ed-rule)]" />
           </div>
         </div>
         {/* Page badge + citation chip */}
         <div className="flex flex-col items-start gap-1.5">
           <div className="border border-[var(--ed-signal)]/40 bg-[var(--ed-paper)] px-1.5 py-0.5 font-mono text-[9px] font-semibold text-[var(--ed-signal)]">
             p. 4 · ln 3
           </div>
           <div className="inline-flex items-center border border-[var(--ed-rule)] bg-[var(--ed-paper)] px-1.5 py-1 font-mono text-[9px] text-[var(--ed-ink-2)]">
-            <span className="mr-1 inline-flex items-center justify-center bg-[var(--ed-signal)] px-1 py-0.5 text-[8px] font-bold leading-none text-white">
+            <span className="mr-1 inline-flex items-center justify-center bg-[var(--ed-olive)] px-1 py-0.5 text-[8px] font-bold leading-none text-white">
               1
             </span>
             {t('landing.plate.cite')}
           </div>
         </div>
       </div>
     </div>
   );
 }
 
 function VisualFormats() {
   const chips = ['PDF', 'DOCX', 'PPTX', 'XLSX', 'TXT', 'MD', 'URL'];
   return (
     <div aria-hidden="true" className={canvas}>
       <div className="absolute inset-0 flex items-center justify-center">
         <div className="flex max-w-[220px] flex-wrap items-center justify-center gap-1.5 px-3">
           {chips.map((c) => (
             <span
               key={c}
               className="border border-[var(--ed-rule)] bg-[var(--ed-paper)] px-2 py-1 font-mono text-[10px] font-semibold text-[var(--ed-ink-2)]"
             >
               {c}
             </span>
           ))}
         </div>
       </div>
     </div>
   );
 }
 
 function VisualLanguages() {
   const langs = ['EN', '中文', '日本語', 'ES', 'DE', 'FR', '한국어', 'PT', 'IT', 'العربية', 'हिन्दी'];
   return (
     <div aria-hidden="true" className={canvas}>
       <div className="absolute inset-0 flex items-center justify-center px-3">
         <div className="flex max-w-[220px] flex-wrap items-center justify-center gap-x-2.5 gap-y-1.5">
           {langs.map((l) => (
             <span key={l} className="text-[11px] font-semibold text-[var(--ed-ink-3)]">
               {l}
             </span>
           ))}
         </div>
       </div>
     </div>
   );
 }
 
 function VisualModes() {
   const { t } = useLocale();
   return (
     <div aria-hidden="true" className={canvas}>
       <div className="absolute inset-0 flex items-center justify-center gap-5">
         <div className="flex flex-col items-center gap-1.5">
           <span className="border border-[var(--ed-rule)] bg-[var(--ed-paper)] px-3 py-1 font-mono text-[11px] text-[var(--ed-ink-2)]">
             Flash
           </span>
           <span className="font-mono text-[9px] text-[var(--ed-ink-3)]">{t('landing.plate.fast')}</span>
         </div>
         <div className="h-8 w-px bg-[var(--ed-rule)]" />
         <div className="flex flex-col items-center gap-1.5">
diff --git a/frontend/src/components/landing/HeroCollage.tsx b/frontend/src/components/landing/HeroCollage.tsx
index 43a250b..7c1a1db 100644
--- a/frontend/src/components/landing/HeroCollage.tsx
+++ b/frontend/src/components/landing/HeroCollage.tsx
@@ -1,346 +1,342 @@
 "use client";
 
 import { useLocale } from '../../i18n';
 
 /**
  * HeroCollage — Art-directed editorial collage for the DocTalk landing hero.
- * Pure HTML/CSS/SVG, warm editorial palette only. No external images.
- * No glassmorphism, no gradient mesh, no UI mock. Aria-hidden decorative.
+ * Pure HTML/CSS/SVG, warm editorial palette only. No external images, no
+ * gradient mesh, no UI mock. Aria-hidden decorative. The two stacked
+ * document plates use .ed-glass (spec §4.1 "hero cards") — this is the
+ * one deliberate glassmorphism use in this file.
  */
 export default function HeroCollage() {
   const { t } = useLocale();
   return (
     <figure aria-hidden="true" style={{ position: "relative" }}>
       {/* ─── Outer container — roughly 4:5 aspect ─── */}
       <div
         style={{
           position: "relative",
           width: "100%",
           aspectRatio: "4 / 5",
           maxWidth: "460px",
           overflow: "visible",
         }}
       >
-        {/* ── Background ochre rectangle — large vertical stripe ── */}
+        {/* ── Background slate rectangle — large vertical stripe ── */}
         <div
           style={{
             position: "absolute",
             top: "6%",
             right: "0",
             width: "58%",
             height: "82%",
-            background: "var(--ed-ochre)",
+            background: "var(--ed-slate)",
             opacity: 0.18,
           }}
         />
 
         {/* ── Halftone dot block — bottom-left corner ── */}
         <div
           className="ed-halftone"
           style={{
             position: "absolute",
             bottom: "4%",
             left: "0",
             width: "36%",
             height: "28%",
             borderRadius: "1px",
           }}
         />
 
         {/* ── Thin geometric square outline — top-left ── */}
         <div
           style={{
             position: "absolute",
             top: "2%",
             left: "4%",
             width: "80px",
             height: "80px",
             border: "1px solid var(--ed-rule)",
           }}
         />
 
         {/* ── Signal shape — soft terracotta accent, low opacity ── */}
         <div
           style={{
             position: "absolute",
             top: "28%",
             left: "2%",
             width: "48px",
             height: "110px",
             background: "var(--ed-signal)",
             opacity: 0.12,
           }}
         />
 
         {/* ── Oversized italic serif glyph (graphic element, behind plate) ── */}
         <div
           style={{
             position: "absolute",
             top: "8%",
             right: "6%",
             fontFamily: "var(--dt-serif)",
             fontStyle: "italic",
             fontWeight: 400,
             fontSize: "clamp(120px, 18vw, 180px)",
             lineHeight: 1,
-            color: "var(--ed-ochre)",
+            color: "var(--ed-slate)",
             opacity: 0.12,
             userSelect: "none",
             pointerEvents: "none",
             letterSpacing: "-0.05em",
           }}
         >
           §
         </div>
 
         {/* ── Registration crosshair — top-right area ── */}
         <div
           className="ed-crosshair"
           style={{ position: "absolute", top: "10%", right: "8%" }}
         />
 
         {/* ── Registration crosshair — bottom-left ── */}
         <div
           className="ed-crosshair"
           style={{ position: "absolute", bottom: "10%", left: "28%" }}
         />
 
         {/* ── PRIMARY DOCUMENT PLATE ── */}
         {/* Rotated ~-3deg, offset slightly left-of-centre */}
         <div
+          className="ed-glass"
           style={{
             position: "absolute",
             top: "14%",
             left: "8%",
             right: "6%",
-            background: "var(--ed-paper)",
-            border: "1px solid var(--ed-rule)",
-            borderRadius: "2px",
             padding: "22px 20px 18px",
             transform: "rotate(-2.8deg)",
-            boxShadow:
-              "0 4px 18px 0 rgba(28,27,25,0.10), 0 1px 3px 0 rgba(28,27,25,0.07)",
           }}
         >
           {/* Document header row */}
           <div
             style={{
               display: "flex",
               alignItems: "center",
               justifyContent: "space-between",
               marginBottom: "14px",
             }}
           >
             <span
               className="ed-caption"
               style={{ letterSpacing: "0.06em" }}
             >
               report.pdf &middot; p.&thinsp;4
             </span>
             {/* Small page indicator */}
             <span
               className="ed-caption"
               style={{
                 background: "var(--ed-paper-2)",
                 border: "1px solid var(--ed-rule)",
                 padding: "1px 5px",
                 borderRadius: "1px",
               }}
             >
               04
             </span>
           </div>
 
           {/* Text lines — thin rule bars */}
           {/* Line 1 — plain */}
           <div
             style={{
               height: "7px",
               background: "var(--ed-rule)",
               borderRadius: "1px",
               marginBottom: "8px",
               opacity: 0.7,
               width: "92%",
             }}
           />
           {/* Line 2 — plain */}
           <div
             style={{
               height: "7px",
               background: "var(--ed-rule)",
               borderRadius: "1px",
               marginBottom: "8px",
               opacity: 0.55,
               width: "78%",
             }}
           />
 
           {/* Line 3 — HIGHLIGHTED (citation band) */}
           <div
             style={{
               position: "relative",
               marginBottom: "8px",
             }}
           >
-            {/* Amber/signal highlight band */}
+            {/* Slate highlight band — quote-highlight rule (structure) */}
             <div
               style={{
                 position: "absolute",
                 inset: "-2px -4px",
-                background: "var(--ed-ochre)",
+                background: "var(--ed-slate)",
                 opacity: 0.18,
                 borderRadius: "1px",
               }}
             />
             <div
               style={{
                 height: "7px",
                 background: "var(--ed-ink-2)",
                 borderRadius: "1px",
                 opacity: 0.55,
                 width: "88%",
                 position: "relative",
               }}
             />
-            {/* Terracotta margin citation marker */}
+            {/* Olive margin citation marker — verified badge */}
             <div
               style={{
                 position: "absolute",
                 right: "-14px",
                 top: "50%",
                 transform: "translateY(-50%)",
                 width: "18px",
                 height: "18px",
-                background: "var(--ed-signal)",
+                background: "var(--ed-olive)",
                 borderRadius: "50%",
                 display: "flex",
                 alignItems: "center",
                 justifyContent: "center",
               }}
             >
               <span
                 style={{
                   fontFamily: "var(--dt-mono)",
                   fontSize: "8px",
                   fontWeight: 700,
                   color: "#fff",
                   lineHeight: 1,
                 }}
               >
                 3
               </span>
             </div>
           </div>
 
           {/* Line 4 — plain */}
           <div
             style={{
               height: "7px",
               background: "var(--ed-rule)",
               borderRadius: "1px",
               marginBottom: "8px",
               opacity: 0.5,
               width: "65%",
             }}
           />
           {/* Line 5 — plain */}
           <div
             style={{
               height: "7px",
               background: "var(--ed-rule)",
               borderRadius: "1px",
               marginBottom: "16px",
               opacity: 0.45,
               width: "83%",
             }}
           />
 
           {/* Thin internal rule */}
           <hr
             style={{
               border: 0,
               borderTop: "1px solid var(--ed-rule)",
               marginBottom: "12px",
             }}
           />
 
           {/* Citation annotation row */}
           <div style={{ display: "flex", alignItems: "flex-start", gap: "8px" }}>
-            {/* Badge */}
+            {/* Badge — verified citation, olive */}
             <span
               style={{
                 display: "inline-flex",
                 alignItems: "center",
                 justifyContent: "center",
                 width: "16px",
                 height: "16px",
-                background: "var(--ed-signal)",
+                background: "var(--ed-olive)",
                 borderRadius: "50%",
                 flexShrink: 0,
                 marginTop: "1px",
               }}
             >
               <span
                 style={{
                   fontFamily: "var(--dt-mono)",
                   fontSize: "7px",
                   fontWeight: 700,
                   color: "#fff",
                   lineHeight: 1,
                 }}
               >
                 3
               </span>
             </span>
             {/* Annotation text lines */}
             <div style={{ flex: 1 }}>
               <div
                 style={{
                   height: "6px",
                   background: "var(--ed-rule)",
                   borderRadius: "1px",
                   marginBottom: "5px",
                   opacity: 0.65,
                   width: "90%",
                 }}
               />
               <div
                 style={{
                   height: "6px",
                   background: "var(--ed-rule)",
                   borderRadius: "1px",
                   opacity: 0.45,
                   width: "60%",
                 }}
               />
             </div>
           </div>
         </div>
 
         {/* ── Second document plate — stacked behind, peeking ── */}
         <div
+          className="ed-glass"
           style={{
             position: "absolute",
             top: "12%",
             left: "14%",
             right: "2%",
             height: "60%",
-            background: "var(--ed-paper-2)",
-            border: "1px solid var(--ed-rule)",
-            borderRadius: "2px",
             transform: "rotate(2.2deg)",
             zIndex: -1,
           }}
         />
       </div>
 
       {/* ─── Caption below the collage ─── */}
       <figcaption
         className="ed-caption"
         style={{ marginTop: "12px", display: "block" }}
       >
         Fig.&thinsp;01 — {t('landing.heroCollage.caption')}
       </figcaption>
     </figure>
   );
 }
diff --git a/frontend/src/components/marketing/EdInlineCell.tsx b/frontend/src/components/marketing/EdInlineCell.tsx
index 59c7014..321fd23 100644
--- a/frontend/src/components/marketing/EdInlineCell.tsx
+++ b/frontend/src/components/marketing/EdInlineCell.tsx
@@ -1,68 +1,68 @@
 "use client";
 
 import React from "react";
 import { useLocale } from "../../i18n";
 
 interface EdInlineCellProps {
   value: string | boolean;
 }
 
 const MONO_FONT = "var(--dt-mono)";
 
 export default function EdInlineCell({ value }: EdInlineCellProps) {
   const { t } = useLocale();
 
   if (value === true) {
     return (
       <span
         role="img"
         aria-label={t("common.yes")}
         style={{
           fontFamily: MONO_FONT,
           fontSize: "18px",
           color: "var(--ed-signal)",
         }}
       >
         ✓
       </span>
     );
   }
 
   if (value === false) {
     return (
       <span
         role="img"
         aria-label={t("common.no")}
         style={{
           fontFamily: MONO_FONT,
           fontSize: "18px",
           color: "var(--ed-ink-3)",
         }}
       >
         –
       </span>
     );
   }
 
   if (value === "partial" || value === "Partial") {
     return (
       <span
         role="img"
         aria-label={t("comparison.partial")}
         style={{
           fontFamily: MONO_FONT,
           fontSize: "15.5px",
-          color: "var(--ed-ochre)",
+          color: "var(--ed-slate)",
         }}
       >
         ~ {t("comparison.partial")}
       </span>
     );
   }
 
   return (
     <span className="ed-body" style={{ color: "var(--ed-ink-2)" }}>
       {value}
     </span>
   );
 }

exec
/bin/zsh -lc "git show 782f8b0:'frontend/src/app/shared/[token]/page.tsx' | shasum -a 256 && git show HEAD:'frontend/src/app/shared/[token]/page.tsx' | shasum -a 256 && rg -n 'export const metadata|generateMetadata|robots|noindex|fetch\\(' 'frontend/src/app/shared/[token]/page.tsx' && sed -n '1,170p' 'frontend/src/app/shared/[token]/page.tsx'" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
9d215079b91a721c2d9a888d410daa74288996199ad5ce53fa1115df5d730d56  -
d3f3589d177d31eb532ee461043032f4fc68758c997d4f35bfb961c3be4548f9  -
46:    const res = await fetch(`${BACKEND_URL}/api/shared/${token}`, {
57:export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
65:    robots: { index: false, follow: false },
import { createHmac } from 'node:crypto';
import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import type { Metadata } from 'next';
import MarketingShell from '../../../components/marketing/MarketingShell';

const BACKEND_URL = process.env.BACKEND_INTERNAL_URL || process.env.NEXT_PUBLIC_API_BASE || '';
// C1: ADAPTER_SECRET signs the X-Proxy-IP claim. Must match the backend's
// settings.ADAPTER_SECRET. NOT AUTH_SECRET — AUTH_SECRET stays inside Auth.js.
const ADAPTER_SECRET = process.env.ADAPTER_SECRET;

interface SharedCitation {
  text_snippet: string;
  page: number;
  document_filename: string;
}

interface SharedMessage {
  id: string;
  role: string;
  content: string;
  citations?: SharedCitation[];
}

async function fetchShared(token: string) {
  const headersList = await headers();
  const xff = headersList.get('x-forwarded-for') || '';
  const clientIp = xff.split(',')[0]?.trim() || headersList.get('x-real-ip') || '';

  const backendHeaders: Record<string, string> = {};
  // C1: triple-header HMAC contract. Backend rate-limits /api/shared/{token}
  // per real visitor; this proves the IP claim came from our SSR origin and
  // not a direct attacker who can set arbitrary headers. Same trust model as
  // /api/proxy. Per-request timestamp + 60s skew window blocks replay.
  if (clientIp && ADAPTER_SECRET) {
    const ts = Math.floor(Date.now() / 1000).toString();
    const sig = createHmac('sha256', ADAPTER_SECRET)
      .update(`${clientIp}:${ts}`)
      .digest('hex');
    backendHeaders['X-Proxy-IP'] = clientIp;
    backendHeaders['X-Proxy-IP-Ts'] = ts;
    backendHeaders['X-Proxy-IP-Sig'] = sig;
  }

  try {
    const res = await fetch(`${BACKEND_URL}/api/shared/${token}`, {
      headers: backendHeaders,
      cache: 'no-store',
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const { token } = await params;
  const data = await fetchShared(token);
  if (!data) return { title: 'Not Found' };
  const preview = data.messages?.find((m: SharedMessage) => m.role === 'assistant')?.content?.slice(0, 150) || '';
  return {
    title: data.session_title,
    description: preview,
    robots: { index: false, follow: false },
    openGraph: { title: data.session_title, description: preview },
  };
}

export default async function SharedPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const data = await fetchShared(token);
  if (!data) notFound();

  return (
    <MarketingShell>
      <div className="ed-shell" style={{ maxWidth: '760px', paddingTop: '48px', paddingBottom: '64px' }}>
        <h1 className="ed-h1">{data.session_title}</h1>
        <p className="ed-caption" style={{ marginTop: '8px', marginBottom: '32px' }}>
          Document: {data.document_name}
        </p>

        <div className="flex flex-col" style={{ gap: '16px' }}>
          {data.messages.map((msg: SharedMessage, i: number) => (
            <div
              key={msg.id || i}
              id={msg.id}
              className={`scroll-mt-6 target:bg-[var(--ed-paper-2)] ${msg.role === 'user' ? 'flex justify-end' : ''}`}
              style={{ transition: 'background-color 300ms ease' }}
            >
              <div
                className="ed-card"
                style={{
                  maxWidth: '85%',
                  ...(msg.role === 'user'
                    ? { background: 'var(--ed-ink)', color: '#ffffff', border: '1px solid var(--ed-ink)' }
                    : {}),
                }}
              >
                <p className="ed-body" style={msg.role === 'user' ? { color: '#ffffff' } : undefined}>
                  {msg.content}
                </p>
                {msg.citations && msg.citations.length > 0 && (
                  <div className="flex flex-col" style={{ marginTop: '10px', gap: '6px' }}>
                    {msg.citations.map((c, j: number) => (
                      <div
                        key={j}
                        className="ed-caption"
                        style={{
                          border: '1px solid var(--ed-rule)',
                          background: 'var(--ed-paper-2)',
                          padding: '4px 8px',
                          borderRadius: '3px',
                          color: 'var(--ed-ink-2)',
                        }}
                      >
                        p. {c.page}{c.document_filename ? ` — ${c.document_filename}` : ''}: &ldquo;{c.text_snippet}&rdquo;
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: '48px', textAlign: 'center', borderTop: '1px solid var(--ed-rule)', paddingTop: '24px' }}>
          <p className="ed-caption" style={{ marginBottom: '12px' }}>Powered by DocTalk</p>
          <a href="https://www.doctalk.site" className="ed-cta">
            Try DocTalk Free
          </a>
        </div>
      </div>
    </MarketingShell>
  );
}

exec
/bin/zsh -lc "sed -n '1,180p' frontend/src/components/marketing/MarketingShell.tsx && sed -n '1,240p' frontend/src/components/marketing/EdFaqList.tsx && nl -ba 'frontend/src/app/shared/[token]/page.tsx' | sed -n '1,170p'" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
"use client";

import EditorialMarketingHeader from "./EditorialMarketingHeader";
import type { Crumb } from "./EditorialMarketingHeader";
import EditorialFooter from "../landing/EditorialFooter";
import type { ChromeStrings } from "../../i18n/chrome";

export default function MarketingShell({
  breadcrumb,
  chrome,
  children,
}: {
  breadcrumb?: Crumb[];
  /**
   * Server-resolved chrome strings for localized pages. When provided, the
   * header/footer render translated nav/footer text in the initial HTML. When
   * omitted (not-yet-migrated pages), the chrome falls back to client `useLocale()`.
   */
  chrome?: ChromeStrings;
  children: React.ReactNode;
}) {
  return (
    <div className="dt-editorial min-h-screen flex flex-col">
      <EditorialMarketingHeader breadcrumb={breadcrumb} chrome={chrome} />
      <main className="flex-1">{children}</main>
      <EditorialFooter chrome={chrome} />
    </div>
  );
}
"use client";

import React, { useEffect, useLayoutEffect, useRef, useState } from "react";

// SSR-safe layout effect — useLayoutEffect warns under server rendering, so
// we fall back to useEffect when `window` isn't available. This keeps the
// first painted frame in sync with the measured scrollHeight on the client
// (no collapsed→expanded jump) while remaining safe for any SSR boundary.
const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

interface FaqItem {
  question: string;
  answer: string;
}

interface EdFaqListProps {
  items: FaqItem[];
}

export default function EdFaqList({ items }: EdFaqListProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const toggle = (idx: number) => {
    setOpenIndex(openIndex === idx ? null : idx);
  };

  return (
    <div className="ed-glass" style={{ padding: "6px 28px" }}>
      {items.map((item, index) => {
        const isOpen = openIndex === index;
        const questionNum = `Q${index + 1}`;

        return (
          <FaqRow
            key={`faq-${index}`}
            index={index}
            questionNum={questionNum}
            question={item.question}
            answer={item.answer}
            isOpen={isOpen}
            onToggle={() => toggle(index)}
          />
        );
      })}
    </div>
  );
}

interface FaqRowProps {
  index: number;
  questionNum: string;
  question: string;
  answer: string;
  isOpen: boolean;
  onToggle: () => void;
}

function FaqRow({
  index,
  questionNum,
  question,
  answer,
  isOpen,
  onToggle,
}: FaqRowProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(0);

  useIsomorphicLayoutEffect(() => {
    const el = contentRef.current;
    if (!el || !isOpen) return;
    setHeight(el.scrollHeight);
    const ro = new ResizeObserver(() => setHeight(el.scrollHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, [isOpen]);

  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mq.matches);
    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  return (
    <div
      style={{
        // Rows divide each other, but the glass panel's own border already
        // closes the list — drawing an edge rule here too puts a second,
        // shorter hairline 6px inside the panel edge (the wrapper's vertical
        // padding), which reads as a stray line rather than a divider.
        borderTop: index === 0 ? undefined : "1px solid var(--ed-rule)",
      }}
    >
      <button
        type="button"
        id={`ed-faq-btn-${index}`}
        onClick={onToggle}
        aria-expanded={isOpen}
        aria-controls={`ed-faq-panel-${index}`}
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: "24px",
          textAlign: "left",
          width: "100%",
          padding: "20px 0",
          cursor: "pointer",
          background: "transparent",
          border: "none",
        }}
      >
        {/* Left: number + question */}
        <span
          style={{
            display: "flex",
            alignItems: "baseline",
            gap: "16px",
            flex: 1,
          }}
        >
          <span
            className="ed-caption"
            aria-hidden="true"
            style={{ color: "var(--ed-signal)", flexShrink: 0 }}
          >
            {questionNum}
          </span>
          <span className="ed-h3">{question}</span>
        </span>

        {/* Right: +/− indicator */}
        <span
          className="ed-caption"
          aria-hidden="true"
          style={{
            flexShrink: 0,
            fontSize: "16px",
            letterSpacing: 0,
            color: "var(--ed-ink-3)",
            marginTop: "2px",
          }}
        >
          {isOpen ? "−" : "+"}
        </span>
      </button>

      {/* Answer panel — measured-height accordion */}
      <div
        id={`ed-faq-panel-${index}`}
        role="region"
        aria-labelledby={`ed-faq-btn-${index}`}
        ref={contentRef}
        style={{
          overflow: "hidden",
          maxHeight: isOpen ? `${height}px` : "0px",
          opacity: isOpen ? 1 : 0,
          transition: prefersReducedMotion
            ? "none"
            : "max-height 300ms ease, opacity 300ms ease",
        }}
      >
        <p
          className="ed-body"
          style={{ maxWidth: "660px", paddingBottom: "20px" }}
        >
          {answer}
        </p>
      </div>
    </div>
  );
}
     1	import { createHmac } from 'node:crypto';
     2	import { notFound } from 'next/navigation';
     3	import { headers } from 'next/headers';
     4	import type { Metadata } from 'next';
     5	import MarketingShell from '../../../components/marketing/MarketingShell';
     6	
     7	const BACKEND_URL = process.env.BACKEND_INTERNAL_URL || process.env.NEXT_PUBLIC_API_BASE || '';
     8	// C1: ADAPTER_SECRET signs the X-Proxy-IP claim. Must match the backend's
     9	// settings.ADAPTER_SECRET. NOT AUTH_SECRET — AUTH_SECRET stays inside Auth.js.
    10	const ADAPTER_SECRET = process.env.ADAPTER_SECRET;
    11	
    12	interface SharedCitation {
    13	  text_snippet: string;
    14	  page: number;
    15	  document_filename: string;
    16	}
    17	
    18	interface SharedMessage {
    19	  id: string;
    20	  role: string;
    21	  content: string;
    22	  citations?: SharedCitation[];
    23	}
    24	
    25	async function fetchShared(token: string) {
    26	  const headersList = await headers();
    27	  const xff = headersList.get('x-forwarded-for') || '';
    28	  const clientIp = xff.split(',')[0]?.trim() || headersList.get('x-real-ip') || '';
    29	
    30	  const backendHeaders: Record<string, string> = {};
    31	  // C1: triple-header HMAC contract. Backend rate-limits /api/shared/{token}
    32	  // per real visitor; this proves the IP claim came from our SSR origin and
    33	  // not a direct attacker who can set arbitrary headers. Same trust model as
    34	  // /api/proxy. Per-request timestamp + 60s skew window blocks replay.
    35	  if (clientIp && ADAPTER_SECRET) {
    36	    const ts = Math.floor(Date.now() / 1000).toString();
    37	    const sig = createHmac('sha256', ADAPTER_SECRET)
    38	      .update(`${clientIp}:${ts}`)
    39	      .digest('hex');
    40	    backendHeaders['X-Proxy-IP'] = clientIp;
    41	    backendHeaders['X-Proxy-IP-Ts'] = ts;
    42	    backendHeaders['X-Proxy-IP-Sig'] = sig;
    43	  }
    44	
    45	  try {
    46	    const res = await fetch(`${BACKEND_URL}/api/shared/${token}`, {
    47	      headers: backendHeaders,
    48	      cache: 'no-store',
    49	    });
    50	    if (!res.ok) return null;
    51	    return res.json();
    52	  } catch {
    53	    return null;
    54	  }
    55	}
    56	
    57	export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
    58	  const { token } = await params;
    59	  const data = await fetchShared(token);
    60	  if (!data) return { title: 'Not Found' };
    61	  const preview = data.messages?.find((m: SharedMessage) => m.role === 'assistant')?.content?.slice(0, 150) || '';
    62	  return {
    63	    title: data.session_title,
    64	    description: preview,
    65	    robots: { index: false, follow: false },
    66	    openGraph: { title: data.session_title, description: preview },
    67	  };
    68	}
    69	
    70	export default async function SharedPage({ params }: { params: Promise<{ token: string }> }) {
    71	  const { token } = await params;
    72	  const data = await fetchShared(token);
    73	  if (!data) notFound();
    74	
    75	  return (
    76	    <MarketingShell>
    77	      <div className="ed-shell" style={{ maxWidth: '760px', paddingTop: '48px', paddingBottom: '64px' }}>
    78	        <h1 className="ed-h1">{data.session_title}</h1>
    79	        <p className="ed-caption" style={{ marginTop: '8px', marginBottom: '32px' }}>
    80	          Document: {data.document_name}
    81	        </p>
    82	
    83	        <div className="flex flex-col" style={{ gap: '16px' }}>
    84	          {data.messages.map((msg: SharedMessage, i: number) => (
    85	            <div
    86	              key={msg.id || i}
    87	              id={msg.id}
    88	              className={`scroll-mt-6 target:bg-[var(--ed-paper-2)] ${msg.role === 'user' ? 'flex justify-end' : ''}`}
    89	              style={{ transition: 'background-color 300ms ease' }}
    90	            >
    91	              <div
    92	                className="ed-card"
    93	                style={{
    94	                  maxWidth: '85%',
    95	                  ...(msg.role === 'user'
    96	                    ? { background: 'var(--ed-ink)', color: '#ffffff', border: '1px solid var(--ed-ink)' }
    97	                    : {}),
    98	                }}
    99	              >
   100	                <p className="ed-body" style={msg.role === 'user' ? { color: '#ffffff' } : undefined}>
   101	                  {msg.content}
   102	                </p>
   103	                {msg.citations && msg.citations.length > 0 && (
   104	                  <div className="flex flex-col" style={{ marginTop: '10px', gap: '6px' }}>
   105	                    {msg.citations.map((c, j: number) => (
   106	                      <div
   107	                        key={j}
   108	                        className="ed-caption"
   109	                        style={{
   110	                          border: '1px solid var(--ed-rule)',
   111	                          background: 'var(--ed-paper-2)',
   112	                          padding: '4px 8px',
   113	                          borderRadius: '3px',
   114	                          color: 'var(--ed-ink-2)',
   115	                        }}
   116	                      >
   117	                        p. {c.page}{c.document_filename ? ` — ${c.document_filename}` : ''}: &ldquo;{c.text_snippet}&rdquo;
   118	                      </div>
   119	                    ))}
   120	                  </div>
   121	                )}
   122	              </div>
   123	            </div>
   124	          ))}
   125	        </div>
   126	
   127	        <div style={{ marginTop: '48px', textAlign: 'center', borderTop: '1px solid var(--ed-rule)', paddingTop: '24px' }}>
   128	          <p className="ed-caption" style={{ marginBottom: '12px' }}>Powered by DocTalk</p>
   129	          <a href="https://www.doctalk.site" className="ed-cta">
   130	            Try DocTalk Free
   131	          </a>
   132	        </div>
   133	      </div>
   134	    </MarketingShell>
   135	  );
   136	}

exec
/bin/zsh -lc "rg -n --glob '*.{tsx,ts,js,jsx}' 'font-(thin|extralight|light|normal|medium|semibold|bold|extrabold|black)|fontWeight' frontend/src/app frontend/src/components | awk 'BEGIN{FS=\":\"} {print "'$0}'"' | sed -n '1,420p'" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
frontend/src/components/ErrorBoundary.tsx:11:        <div className="text-lg font-medium mb-3 dark:text-zinc-100">{t('error.somethingWrong')}</div>
frontend/src/app/not-found.tsx:11:        <h1 className="font-serif text-6xl font-semibold text-zinc-900 dark:text-zinc-100 mb-4">404</h1>
frontend/src/app/not-found.tsx:16:            className="px-6 py-3 bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 rounded-lg hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors font-medium"
frontend/src/app/not-found.tsx:22:            className="px-6 py-3 border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors font-medium"
frontend/src/components/AuthFormContent.tsx:148:    "group flex min-h-12 w-full items-center justify-center gap-3 rounded-md border border-zinc-200 bg-white px-4 py-3 font-medium text-zinc-900 transition-[border-color,background-color] hover:border-zinc-300 hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50 dark:hover:border-zinc-600 dark:hover:bg-zinc-700 dark:focus-visible:ring-offset-zinc-900";
frontend/src/components/AuthFormContent.tsx:224:          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
frontend/src/components/AuthFormContent.tsx:271:            className="min-h-12 w-full rounded-md bg-blue-600 px-4 py-3 font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:bg-blue-500 dark:text-white dark:hover:bg-blue-400 dark:focus-visible:ring-offset-zinc-900"
frontend/src/components/AuthFormContent.tsx:288:        <p className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
frontend/src/app/global-error.tsx:25:          <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-4">Something went wrong</h2>
frontend/src/app/global-error.tsx:29:            className="px-6 py-3 bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 rounded-lg hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors font-medium"
frontend/src/components/ModeSelector.tsx:49:                ? 'bg-white font-semibold text-zinc-950 shadow-[0_3px_12px_rgba(15,23,42,0.16)] dark:bg-zinc-50 dark:text-zinc-950'
frontend/src/app/billing/error.tsx:17:        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">{t("error.title")}</h1>
frontend/src/app/billing/error.tsx:22:          className="mt-5 px-4 py-2 rounded-lg bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors text-sm font-medium focus-visible:ring-2 focus-visible:ring-zinc-400 dark:focus-visible:ring-zinc-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-900"
frontend/src/components/PaywallModal.tsx:130:        <h2 id="paywall-title" className="text-xl font-semibold mb-4 text-zinc-900 dark:text-zinc-100">
frontend/src/components/Extraction/ExtractionPanel.tsx:328:              className="inline-flex h-5 min-w-5 items-center justify-center rounded bg-[var(--reader-evidence-soft)] px-1.5 text-[11px] font-semibold text-[var(--reader-evidence)] ring-1 ring-[var(--reader-evidence-border)] disabled:opacity-50"
frontend/src/components/Extraction/ExtractionPanel.tsx:351:            <h2 className="mt-1 text-sm font-semibold text-[var(--reader-ink)]">
frontend/src/components/Extraction/ExtractionPanel.tsx:361:            className={`inline-flex min-h-8 flex-1 items-center justify-center gap-2 rounded-md px-2 text-xs font-medium transition-colors ${
frontend/src/components/Extraction/ExtractionPanel.tsx:373:            className={`inline-flex min-h-8 flex-1 items-center justify-center gap-2 rounded-md px-2 text-xs font-medium transition-colors ${
frontend/src/components/Extraction/ExtractionPanel.tsx:385:            className={`inline-flex min-h-8 flex-1 items-center justify-center gap-2 rounded-md px-2 text-xs font-medium transition-colors ${
frontend/src/components/Extraction/ExtractionPanel.tsx:443:                        <span className="text-sm font-semibold text-[var(--reader-ink)]">{template.title}</span>
frontend/src/components/Extraction/ExtractionPanel.tsx:458:                  className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
frontend/src/components/Extraction/ExtractionPanel.tsx:466:                  <p className="font-medium">
frontend/src/components/Extraction/ExtractionPanel.tsx:475:                    className="mt-2 inline-flex text-sm font-medium underline"
frontend/src/components/Extraction/ExtractionPanel.tsx:501:                      <h3 className="text-sm font-semibold text-[var(--reader-ink)]">
frontend/src/components/Extraction/ExtractionPanel.tsx:515:                      <button type="button" onClick={() => void handleExport(activeJob, "md")} className="inline-flex items-center gap-1 rounded-md border border-[var(--reader-border)] px-2.5 py-1.5 text-xs font-medium hover:bg-[var(--reader-panel-muted)]">
frontend/src/components/Extraction/ExtractionPanel.tsx:518:                      <button type="button" onClick={() => void handleExport(activeJob, "csv")} className="inline-flex items-center gap-1 rounded-md border border-[var(--reader-border)] px-2.5 py-1.5 text-xs font-medium hover:bg-[var(--reader-panel-muted)]">
frontend/src/components/Extraction/ExtractionPanel.tsx:592:            <h3 className="mt-1 text-sm font-semibold text-[var(--reader-ink)]">
frontend/src/components/Extraction/ExtractionPanel.tsx:600:            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
frontend/src/components/Extraction/ExtractionPanel.tsx:621:            <p className="font-medium">{tOr("tables.exportRequiresPlus", "CSV table export requires Plus.")}</p>
frontend/src/components/Extraction/ExtractionPanel.tsx:624:              className="mt-2 inline-flex text-sm font-medium underline"
frontend/src/components/Extraction/ExtractionPanel.tsx:650:                  <h4 className="text-sm font-semibold text-[var(--reader-ink)]">
frontend/src/components/Extraction/ExtractionPanel.tsx:665:                    className="inline-flex items-center justify-center gap-1 rounded-md border border-[var(--reader-border)] px-2.5 py-1.5 text-xs font-medium hover:bg-[var(--reader-panel-muted)] disabled:opacity-50"
frontend/src/components/Extraction/ExtractionPanel.tsx:674:                    className="inline-flex items-center justify-center gap-1 rounded-md border border-[var(--reader-border)] px-2.5 py-1.5 text-xs font-medium hover:bg-[var(--reader-panel-muted)]"
frontend/src/components/Extraction/ExtractionPanel.tsx:703:                      <tr key={rowIndex} className={rowIndex === 0 ? "font-semibold text-[var(--reader-ink)]" : ""}>
frontend/src/components/Extraction/ExtractionPanel.tsx:752:                <td className="border-b border-[var(--reader-border)] px-2 py-2 font-medium">{asString(item.label)}</td>
frontend/src/components/Extraction/ExtractionPanel.tsx:771:              <h4 className="text-sm font-semibold text-[var(--reader-ink)]">{asString(item.topic) || "Evidence"}</h4>
frontend/src/components/Extraction/ExtractionPanel.tsx:774:            <p className="text-sm font-medium leading-6 text-[var(--reader-ink)]">{asString(item.finding)}</p>
frontend/src/components/PrivacyBadge.tsx:14:        <span className="font-medium">{t('privacy.badge')}</span>
frontend/src/components/AdminCharts.tsx:63:      <h3 className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-3">
frontend/src/components/AdminCharts.tsx:135:      <h3 className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-3">
frontend/src/components/AdminCharts.tsx:188:          <h2 className="text-lg font-semibold dark:text-zinc-100">{tOr('admin.charts.trendsTitle', 'Trends')}</h2>
frontend/src/components/AdminCharts.tsx:222:        <h2 className="text-lg font-semibold mb-4 dark:text-zinc-100">
frontend/src/components/AdminCharts.tsx:241:            <h3 className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-3">
frontend/src/app/billing/BillingPageClient.tsx:489:            <p className="mb-3 text-sm font-medium uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
frontend/src/app/billing/BillingPageClient.tsx:492:            <h1 className="font-serif text-4xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
frontend/src/app/billing/BillingPageClient.tsx:504:            <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
frontend/src/app/billing/BillingPageClient.tsx:512:                  <div className="truncate text-lg font-semibold text-zinc-900 dark:text-zinc-50">
frontend/src/app/billing/BillingPageClient.tsx:515:                  <div className="mt-1 text-[11px] font-medium leading-4 text-zinc-500 dark:text-zinc-400">
frontend/src/app/billing/BillingPageClient.tsx:534:                <h2 className="text-sm font-semibold">
frontend/src/app/billing/BillingPageClient.tsx:547:                  className="inline-flex items-center justify-center rounded-lg bg-zinc-900 px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200 focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-blue-50 dark:focus-visible:ring-offset-blue-950"
frontend/src/app/billing/BillingPageClient.tsx:553:                  className="inline-flex items-center justify-center rounded-lg border border-blue-300 bg-white px-3.5 py-2 text-sm font-medium text-blue-900 transition-colors hover:border-blue-400 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-100 dark:hover:border-blue-700 focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-blue-50 dark:focus-visible:ring-offset-blue-950"
frontend/src/app/billing/BillingPageClient.tsx:571:                <p className="text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1">
frontend/src/app/billing/BillingPageClient.tsx:574:                <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
frontend/src/app/billing/BillingPageClient.tsx:576:                  <span className="ml-2 text-sm font-normal text-zinc-500 dark:text-zinc-400">
frontend/src/app/billing/BillingPageClient.tsx:603:                    className="px-4 py-2 rounded-lg border border-red-300 dark:border-red-700 text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-950/30 disabled:opacity-50 transition-colors text-sm font-medium focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-900"
frontend/src/app/billing/BillingPageClient.tsx:633:            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
frontend/src/app/billing/BillingPageClient.tsx:645:              className={`rounded-md px-4 py-2 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-zinc-400 dark:focus-visible:ring-zinc-500 ${
frontend/src/app/billing/BillingPageClient.tsx:657:              className={`rounded-md px-4 py-2 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-zinc-400 dark:focus-visible:ring-zinc-500 ${
frontend/src/app/billing/BillingPageClient.tsx:712:                    <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">{t("billing.plus.title")}</h2>
frontend/src/app/billing/BillingPageClient.tsx:713:                    <span className="text-xs px-2 py-0.5 rounded-full bg-accent text-accent-foreground font-medium">
frontend/src/app/billing/BillingPageClient.tsx:719:                    <span className="text-3xl font-bold text-zinc-900 dark:text-zinc-50 tabular-nums">
frontend/src/app/billing/BillingPageClient.tsx:726:                      <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 font-medium">
frontend/src/app/billing/BillingPageClient.tsx:744:                        className="w-full px-4 py-2.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-100 hover:bg-zinc-200 dark:hover:bg-zinc-700 disabled:opacity-50 transition-colors font-medium focus-visible:ring-2 focus-visible:ring-zinc-400 dark:focus-visible:ring-zinc-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-900"
frontend/src/app/billing/BillingPageClient.tsx:751:                        className="w-full px-4 py-2.5 rounded-lg bg-zinc-50 dark:bg-zinc-800/60 text-zinc-400 dark:text-zinc-500 cursor-not-allowed font-medium"
frontend/src/app/billing/BillingPageClient.tsx:760:                      className="w-full px-4 py-2.5 rounded-lg bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 disabled:opacity-50 shadow-sm hover:shadow-md transition-colors font-medium focus-visible:ring-2 focus-visible:ring-zinc-400 dark:focus-visible:ring-zinc-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-900"
frontend/src/app/billing/BillingPageClient.tsx:768:                      className="w-full px-4 py-2.5 rounded-lg bg-accent hover:bg-accent-hover text-accent-foreground disabled:opacity-50 shadow-sm hover:shadow-md transition-colors font-medium focus-visible:ring-2 focus-visible:ring-zinc-400 dark:focus-visible:ring-zinc-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-900"
frontend/src/app/billing/BillingPageClient.tsx:786:                  <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50 mb-1">{t("billing.pro.title")}</h2>
frontend/src/app/billing/BillingPageClient.tsx:789:                    <span className="text-3xl font-bold text-zinc-900 dark:text-zinc-50 tabular-nums">
frontend/src/app/billing/BillingPageClient.tsx:796:                      <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 font-medium">
frontend/src/app/billing/BillingPageClient.tsx:814:                        className="w-full px-4 py-2.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-100 hover:bg-zinc-200 dark:hover:bg-zinc-700 disabled:opacity-50 transition-colors font-medium focus-visible:ring-2 focus-visible:ring-zinc-400 dark:focus-visible:ring-zinc-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-900"
frontend/src/app/billing/BillingPageClient.tsx:821:                        className="w-full px-4 py-2.5 rounded-lg bg-zinc-50 dark:bg-zinc-800/60 text-zinc-400 dark:text-zinc-500 cursor-not-allowed font-medium"
frontend/src/app/billing/BillingPageClient.tsx:830:                      className="w-full px-4 py-2.5 rounded-lg bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 disabled:opacity-50 shadow-sm hover:shadow-md transition-colors font-medium focus-visible:ring-2 focus-visible:ring-zinc-400 dark:focus-visible:ring-zinc-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-900"
frontend/src/app/billing/BillingPageClient.tsx:838:                      className="w-full px-4 py-2.5 rounded-lg bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 disabled:opacity-50 shadow-sm hover:shadow-md transition-colors font-medium focus-visible:ring-2 focus-visible:ring-zinc-400 dark:focus-visible:ring-zinc-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-900"
frontend/src/app/billing/BillingPageClient.tsx:849:              <h2 className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-4 uppercase tracking-wide">
frontend/src/app/billing/BillingPageClient.tsx:855:                    <p className="font-semibold">
frontend/src/app/billing/BillingPageClient.tsx:879:        <h2 className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-4 uppercase tracking-wide">
frontend/src/app/billing/BillingPageClient.tsx:915:                <h3 className="text-lg font-medium text-zinc-900 dark:text-zinc-100">
frontend/src/app/billing/BillingPageClient.tsx:918:                <p className="text-3xl font-bold mt-2 text-zinc-900 dark:text-zinc-100">
frontend/src/app/billing/BillingPageClient.tsx:927:                  className="mt-auto inline-flex items-center justify-center gap-2 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200 focus-visible:ring-2 focus-visible:ring-zinc-400 dark:focus-visible:ring-zinc-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-900"
frontend/src/app/billing/BillingPageClient.tsx:951:              <h3 id="confirm-upgrade-title" className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
frontend/src/app/billing/BillingPageClient.tsx:961:              <p className="mt-3 text-sm font-medium text-zinc-900 dark:text-zinc-100 tabular-nums">
frontend/src/app/billing/BillingPageClient.tsx:987:                  className="px-4 py-2.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-100 hover:bg-zinc-200 dark:hover:bg-zinc-700 disabled:opacity-50 transition-colors font-medium"
frontend/src/app/billing/BillingPageClient.tsx:994:                  className="px-4 py-2.5 rounded-lg bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 disabled:opacity-50 transition-colors font-medium"
frontend/src/app/billing/BillingPageClient.tsx:1019:              <h3 id="confirm-downgrade-title" className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
frontend/src/app/billing/BillingPageClient.tsx:1029:              <p className="mt-3 text-sm font-medium text-zinc-900 dark:text-zinc-100 tabular-nums">
frontend/src/app/billing/BillingPageClient.tsx:1055:                  className="px-4 py-2.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-100 hover:bg-zinc-200 dark:hover:bg-zinc-700 disabled:opacity-50 transition-colors font-medium"
frontend/src/app/billing/BillingPageClient.tsx:1062:                  className="px-4 py-2.5 rounded-lg bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 disabled:opacity-50 transition-colors font-medium"
frontend/src/app/billing/BillingPageClient.tsx:1092:                className="text-xl font-semibold text-zinc-900 dark:text-zinc-50 mb-3"
frontend/src/app/billing/BillingPageClient.tsx:1112:                  <p className="mb-2 text-sm font-medium text-zinc-900 dark:text-zinc-100">
frontend/src/app/billing/BillingPageClient.tsx:1140:                  <label htmlFor="cancel-feedback" className="mb-1 block text-sm font-medium text-zinc-900 dark:text-zinc-100">
frontend/src/app/billing/BillingPageClient.tsx:1164:                    <span className="block font-medium">
frontend/src/app/billing/BillingPageClient.tsx:1179:                  className="px-4 py-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-100 hover:bg-zinc-200 dark:hover:bg-zinc-700 disabled:opacity-50 transition-colors text-sm font-medium focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-900"
frontend/src/app/billing/BillingPageClient.tsx:1187:                  className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-400 text-white disabled:opacity-50 shadow-sm transition-colors text-sm font-medium focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-900"
frontend/src/components/Collections/CollectionSidebar.tsx:20:        <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
frontend/src/components/Collections/CollectionSidebar.tsx:50:          className="flex w-full items-center justify-center gap-1 rounded-lg border border-zinc-200 px-3 py-2 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:rounded-lg"
frontend/src/components/AdminUserActivityCharts.tsx:73:      <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{label}</p>
frontend/src/components/AdminUserActivityCharts.tsx:74:      <p className="mt-1 text-2xl font-semibold tabular-nums text-zinc-950 dark:text-zinc-50">
frontend/src/components/AdminUserActivityCharts.tsx:96:        <h3 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">{title}</h3>
frontend/src/components/AdminUserActivityCharts.tsx:125:              className="flex h-full items-center justify-end rounded bg-accent px-2 text-[11px] font-medium text-white"
frontend/src/components/AdminUserActivityCharts.tsx:131:          <div className="w-16 text-right font-medium tabular-nums text-zinc-900 dark:text-zinc-100">
frontend/src/components/AdminUserActivityCharts.tsx:162:              <th className="py-2 pr-3 font-medium">{tOr('admin.activity.cohortCol', 'Cohort')}</th>
frontend/src/components/AdminUserActivityCharts.tsx:163:              <th className="px-3 py-2 text-right font-medium">{tOr('admin.activity.usersCol', 'Users')}</th>
frontend/src/components/AdminUserActivityCharts.tsx:165:                <th key={column.key} className="px-3 py-2 text-right font-medium">{column.label}</th>
frontend/src/components/AdminUserActivityCharts.tsx:226:                <p className="font-medium text-zinc-800 dark:text-zinc-100">{row.label || tOr('admin.activity.paidSignal', 'Paid signal')}</p>
frontend/src/components/AdminUserActivityCharts.tsx:253:        <h2 className="text-lg font-semibold text-[var(--workbench-ink)]">{tOr('admin.activityIntelligence', 'User Activity Intelligence')}</h2>
frontend/src/components/AdminUserActivityCharts.tsx:393:                    <span className="font-medium text-zinc-800 dark:text-zinc-100">{item.type} · {item.area}</span>
frontend/src/components/Collections/SessionList.tsx:21:        <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
frontend/src/components/Collections/SessionList.tsx:56:          className="flex w-full items-center justify-center gap-1 rounded-lg border border-zinc-200 px-3 py-2 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:rounded-lg"
frontend/src/components/Collections/CreateCollectionModal.tsx:99:          <h2 id="create-collection-title" className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
frontend/src/components/Collections/CreateCollectionModal.tsx:109:            <label htmlFor="collection-name" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
frontend/src/components/Collections/CreateCollectionModal.tsx:125:            <label htmlFor="collection-description" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
frontend/src/components/Collections/CreateCollectionModal.tsx:142:                  <div className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
frontend/src/components/Collections/CreateCollectionModal.tsx:156:                      className="text-xs font-medium text-zinc-600 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:rounded-sm"
frontend/src/components/Collections/CreateCollectionModal.tsx:164:                      className="text-xs font-medium text-zinc-600 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:rounded-sm"
frontend/src/components/Collections/CreateCollectionModal.tsx:203:            <p className="font-medium">{createErrorCopy.title}</p>
frontend/src/components/Collections/CreateCollectionModal.tsx:209:                className="mt-2 inline-flex items-center justify-center rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200 focus-visible:ring-2 focus-visible:ring-zinc-400 dark:focus-visible:ring-zinc-500"
frontend/src/components/Collections/CreateCollectionModal.tsx:227:            className="px-4 py-2 text-sm rounded-lg bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 font-medium hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-zinc-400 dark:focus-visible:ring-zinc-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-900"
frontend/src/components/Templates/QuestionTemplatesPanel.tsx:274:              <p className="font-mono text-[11px] font-semibold uppercase text-zinc-500 dark:text-zinc-400">
frontend/src/components/Templates/QuestionTemplatesPanel.tsx:279:              <h2 className="mt-1 text-sm font-semibold text-zinc-950 dark:text-zinc-50">
frontend/src/components/Templates/QuestionTemplatesPanel.tsx:293:              className="inline-flex min-h-9 items-center justify-center gap-2 rounded-lg border border-zinc-200 px-3 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
frontend/src/components/Templates/QuestionTemplatesPanel.tsx:304:              <h3 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
frontend/src/components/Templates/QuestionTemplatesPanel.tsx:307:              <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
frontend/src/components/Templates/QuestionTemplatesPanel.tsx:329:                        <span className="block truncate text-sm font-semibold text-zinc-950 dark:text-zinc-50">{template.name}</span>
frontend/src/components/Templates/QuestionTemplatesPanel.tsx:364:                    <span className="text-xs font-medium text-zinc-600 dark:text-zinc-300">{tOr("templates.name", "Template name")}</span>
frontend/src/components/Templates/QuestionTemplatesPanel.tsx:373:                    <span className="text-xs font-medium text-zinc-600 dark:text-zinc-300">{tOr("templates.description", "Description")}</span>
frontend/src/components/Templates/QuestionTemplatesPanel.tsx:383:                  <span className="text-xs font-medium text-zinc-600 dark:text-zinc-300">{tOr("templates.questions", "Questions")}</span>
frontend/src/components/Templates/QuestionTemplatesPanel.tsx:399:                    className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-zinc-900 px-3 text-sm font-medium text-white shadow-sm transition-colors hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
frontend/src/components/Templates/QuestionTemplatesPanel.tsx:411:                  <h3 className="truncate text-sm font-semibold text-zinc-950 dark:text-zinc-50">
frontend/src/components/Templates/QuestionTemplatesPanel.tsx:424:                  className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-zinc-900 px-3 text-sm font-medium text-white shadow-sm transition-colors hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
frontend/src/components/Templates/QuestionTemplatesPanel.tsx:432:                  <p className="font-medium">
frontend/src/components/Templates/QuestionTemplatesPanel.tsx:439:                    className="mt-2 inline-flex text-sm font-medium underline"
frontend/src/components/Templates/QuestionTemplatesPanel.tsx:465:                      <h3 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
frontend/src/components/Templates/QuestionTemplatesPanel.tsx:479:                      <button type="button" onClick={() => void handleExport(activeRun, "md")} className="inline-flex items-center gap-1 rounded-md border border-zinc-200 px-2.5 py-1.5 text-xs font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800">
frontend/src/components/Templates/QuestionTemplatesPanel.tsx:482:                      <button type="button" onClick={() => void handleExport(activeRun, "csv")} className="inline-flex items-center gap-1 rounded-md border border-zinc-200 px-2.5 py-1.5 text-xs font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800">
frontend/src/components/Templates/QuestionTemplatesPanel.tsx:537:            <th className="border-b border-zinc-200 px-2 py-2 font-medium dark:border-zinc-800">{tOr("templates.document", "Document")}</th>
frontend/src/components/Templates/QuestionTemplatesPanel.tsx:538:            <th className="border-b border-zinc-200 px-2 py-2 font-medium dark:border-zinc-800">{tOr("templates.question", "Question")}</th>
frontend/src/components/Templates/QuestionTemplatesPanel.tsx:539:            <th className="border-b border-zinc-200 px-2 py-2 font-medium dark:border-zinc-800">{tOr("templates.answer", "Answer")}</th>
frontend/src/components/Templates/QuestionTemplatesPanel.tsx:540:            <th className="w-36 border-b border-zinc-200 px-2 py-2 font-medium dark:border-zinc-800">{tOr("templates.sources", "Sources")}</th>
frontend/src/components/Templates/QuestionTemplatesPanel.tsx:554:                <td className="border-b border-zinc-100 px-2 py-3 font-medium text-zinc-900 dark:border-zinc-800 dark:text-zinc-100">
frontend/src/components/Templates/QuestionTemplatesPanel.tsx:570:                          className="inline-flex min-h-6 items-center rounded bg-amber-50 px-1.5 text-[11px] font-semibold text-amber-800 ring-1 ring-amber-200 hover:bg-amber-100 dark:bg-amber-950/30 dark:text-amber-200 dark:ring-amber-900"
frontend/src/components/Diff/DocumentDiffPanel.tsx:534:                                  fontWeight: 600,
frontend/src/components/Diff/DocumentDiffPanel.tsx:541:                                <h5 className="ed-body" style={{ marginTop: 0, fontWeight: 600, color: "var(--ed-ink)" }}>{change.title}</h5>
frontend/src/components/Diff/DocumentDiffPanel.tsx:609:              <p className="font-mono text-[11px] font-semibold uppercase text-zinc-500 dark:text-zinc-400">
frontend/src/components/Diff/DocumentDiffPanel.tsx:612:              <h2 className="mt-1 text-sm font-semibold text-zinc-950 dark:text-zinc-50">
frontend/src/components/Diff/DocumentDiffPanel.tsx:621:                <span className="mb-1 block text-[11px] font-medium text-zinc-500 dark:text-zinc-400">{tOr("diff.oldDocument", "Old document")}</span>
frontend/src/components/Diff/DocumentDiffPanel.tsx:633:                <span className="mb-1 block text-[11px] font-medium text-zinc-500 dark:text-zinc-400">{tOr("diff.newDocument", "New document")}</span>
frontend/src/components/Diff/DocumentDiffPanel.tsx:648:                className="inline-flex h-10 items-center justify-center gap-2 self-end rounded-lg bg-zinc-900 px-4 text-sm font-semibold text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
frontend/src/components/Diff/DocumentDiffPanel.tsx:669:                className="inline-flex items-center justify-center rounded-lg bg-zinc-900 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
frontend/src/components/Diff/DocumentDiffPanel.tsx:693:                  <h3 className="truncate text-sm font-semibold text-zinc-950 dark:text-zinc-50">
frontend/src/components/Diff/DocumentDiffPanel.tsx:708:                    className="inline-flex h-9 items-center gap-2 rounded-lg border border-zinc-200 px-3 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
frontend/src/components/Diff/DocumentDiffPanel.tsx:716:                    className="inline-flex h-9 items-center gap-2 rounded-lg border border-zinc-200 px-3 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
frontend/src/components/Diff/DocumentDiffPanel.tsx:732:                  <p className="text-xs font-semibold uppercase text-zinc-500 dark:text-zinc-400">{tOr("diff.summary", "Summary")}</p>
frontend/src/components/Diff/DocumentDiffPanel.tsx:747:                        <h4 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">{label}</h4>
frontend/src/components/Diff/DocumentDiffPanel.tsx:748:                        <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-500 dark:bg-zinc-800 dark:text-zinc-300">{items.length}</span>
frontend/src/components/Diff/DocumentDiffPanel.tsx:754:                              <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-zinc-100 text-[11px] font-semibold text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
frontend/src/components/Diff/DocumentDiffPanel.tsx:758:                                <h5 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">{change.title}</h5>
frontend/src/components/Diff/DocumentDiffPanel.tsx:769:                                        className="inline-flex items-center gap-1 rounded-md border border-zinc-200 bg-white px-2 py-1 text-[11px] font-medium text-zinc-700 transition-colors hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-800"
frontend/src/components/Diff/DocumentDiffPanel.tsx:784:                                        className="inline-flex items-center gap-1 rounded-md border border-zinc-200 bg-white px-2 py-1 text-[11px] font-medium text-zinc-700 transition-colors hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-800"
frontend/src/components/Diff/DocumentDiffPanel.tsx:810:            <h3 className="mt-3 text-sm font-semibold text-zinc-950 dark:text-zinc-50">
frontend/src/components/DocumentBrief/DocumentBriefPanel.tsx:89:            className="inline-flex h-6 items-center gap-1 rounded-md border border-[var(--reader-evidence-border)] bg-[var(--reader-evidence-soft)] px-2 text-[11px] font-medium text-[var(--reader-evidence)] transition-colors hover:border-[var(--reader-evidence)] focus-visible:ring-2 focus-visible:ring-[var(--reader-evidence)] focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-900"
frontend/src/components/DocumentBrief/DocumentBriefPanel.tsx:163:              <h2 className="text-xl font-semibold leading-tight">
frontend/src/components/DocumentBrief/DocumentBriefPanel.tsx:170:              className="inline-flex h-9 shrink-0 items-center gap-2 rounded-lg border border-[var(--reader-border)] bg-[var(--reader-panel-muted)] px-3 text-sm font-medium text-[var(--reader-ink)] transition-colors hover:border-[var(--reader-border-strong)] focus-visible:ring-2 focus-visible:ring-[var(--reader-evidence)] focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-900"
frontend/src/components/DocumentBrief/DocumentBriefPanel.tsx:203:            <div className="flex items-center gap-2 font-medium">
frontend/src/components/DocumentBrief/DocumentBriefPanel.tsx:211:            <div className="flex items-center gap-2 font-medium">
frontend/src/components/DocumentBrief/DocumentBriefPanel.tsx:219:            <div className="flex items-center gap-2 text-sm font-semibold">
frontend/src/components/DocumentBrief/DocumentBriefPanel.tsx:231:                <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
frontend/src/components/DocumentBrief/DocumentBriefPanel.tsx:245:                        <h3 className="text-sm font-semibold">{item.title}</h3>
frontend/src/components/DocumentBrief/DocumentBriefPanel.tsx:281:                        <div className="text-xs font-medium uppercase text-[var(--reader-muted)]">{item.label}</div>
frontend/src/components/DocumentBrief/DocumentBriefPanel.tsx:282:                        <div className="mt-1 text-sm font-semibold">{item.value}</div>
frontend/src/components/DocumentBrief/DocumentBriefPanel.tsx:325:      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-[var(--reader-ink)]">
frontend/src/components/Collections/CollectionList.tsx:37:                <h3 className="truncate text-lg font-semibold text-zinc-900 dark:text-zinc-100">
frontend/src/components/Collections/CollectionList.tsx:69:                <span className="text-xs font-medium">{tOr('collections.documents', 'Documents')}</span>
frontend/src/components/Collections/CollectionList.tsx:71:              <div className="mt-1 text-xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">
frontend/src/components/Collections/CollectionList.tsx:76:              <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
frontend/src/components/Collections/CollectionList.tsx:79:              <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
frontend/src/components/Collections/CollectionList.tsx:88:            className="mt-auto inline-flex items-center justify-between gap-3 border-t border-zinc-200 pt-4 text-sm font-semibold text-zinc-700 transition-colors group-hover:text-accent dark:border-zinc-800 dark:text-zinc-300 focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:rounded-sm"
frontend/src/components/seo/CTABanner.tsx:21:            <p className="mb-3 font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-400 dark:text-zinc-500">
frontend/src/components/seo/CTABanner.tsx:24:            <h2 className="font-serif text-2xl font-bold tracking-tight sm:text-3xl">
frontend/src/components/seo/CTABanner.tsx:34:              className="group mt-7 inline-flex items-center rounded-lg bg-white px-7 py-3.5 font-medium text-zinc-900 transition-colors hover:bg-zinc-100 dark:bg-zinc-900 dark:text-zinc-50 dark:hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900"
frontend/src/components/seo/CTABanner.tsx:45:              <span className="rounded bg-accent px-1.5 py-0.5 text-[10px] font-bold text-accent-foreground">
frontend/src/components/seo/CTABanner.tsx:64:        <h2 className="mb-4 font-serif text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 sm:text-3xl">
frontend/src/components/seo/CTABanner.tsx:74:          className="group inline-flex items-center rounded-lg bg-zinc-900 px-7 py-3.5 font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 dark:focus-visible:ring-zinc-500 focus-visible:ring-offset-2"
frontend/src/components/seo/FeatureList.tsx:30:          <h3 className="mb-2 text-base font-semibold text-zinc-900 dark:text-zinc-100">
frontend/src/app/d/[documentId]/error.tsx:21:        <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">{t('error.somethingWrong')}</h2>
frontend/src/app/d/[documentId]/error.tsx:29:            className="px-4 py-2 rounded-lg bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 transition-colors text-sm font-medium"
frontend/src/app/d/[documentId]/error.tsx:35:            className="px-4 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors text-sm font-medium"
frontend/src/components/FeedbackButton.tsx:243:                <h2 id="feedback-dialog-title" className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
frontend/src/components/FeedbackButton.tsx:263:                  <span className="text-xs font-medium text-zinc-600 dark:text-zinc-300">
frontend/src/components/FeedbackButton.tsx:279:                    <span className="text-xs font-medium text-zinc-600 dark:text-zinc-300">
frontend/src/components/FeedbackButton.tsx:294:                    <span className="text-xs font-medium text-zinc-600 dark:text-zinc-300">
frontend/src/components/FeedbackButton.tsx:310:                  <legend className="text-xs font-medium text-zinc-600 dark:text-zinc-300">
frontend/src/components/FeedbackButton.tsx:332:                  <span className="text-xs font-medium text-zinc-600 dark:text-zinc-300">
frontend/src/components/FeedbackButton.tsx:361:                  className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 focus-visible:ring-2 focus-visible:ring-zinc-400 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
frontend/src/components/FeedbackButton.tsx:368:                  className="inline-flex items-center gap-2 rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-zinc-400 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-200"
frontend/src/components/seo/FAQSection.tsx:42:        <span className="pr-4 text-[15px] font-medium text-zinc-900 dark:text-zinc-100">
frontend/src/components/LayoutTranslation/LayoutTranslationDrawer.tsx:58:            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--reader-muted)]">
frontend/src/components/LayoutTranslation/LayoutTranslationDrawer.tsx:61:            <h2 className="mt-1 text-lg font-semibold">
frontend/src/components/LayoutTranslation/LayoutTranslationDrawer.tsx:80:            <span className="text-sm font-medium">
frontend/src/components/LayoutTranslation/LayoutTranslationDrawer.tsx:102:              <span className="flex items-center gap-2 text-sm font-medium">
frontend/src/components/LayoutTranslation/LayoutTranslationDrawer.tsx:117:            <div className="flex items-center gap-2 font-medium text-[var(--reader-ink)]">
frontend/src/components/LayoutTranslation/LayoutTranslationDrawer.tsx:130:              <p className="mt-2 font-medium">
frontend/src/components/LayoutTranslation/LayoutTranslationDrawer.tsx:141:            className="inline-flex min-h-10 items-center justify-center rounded-lg border border-[var(--reader-border)] px-4 text-sm font-medium text-[var(--reader-ink)] transition-colors hover:bg-[var(--reader-panel-muted)] focus-visible:ring-2 focus-visible:ring-zinc-400"
frontend/src/components/LayoutTranslation/LayoutTranslationDrawer.tsx:149:            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-zinc-950 px-4 text-sm font-semibold text-white transition-colors hover:bg-zinc-800 focus-visible:ring-2 focus-visible:ring-zinc-400 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-200"
frontend/src/components/admin/ChurnSignalsBars.tsx:28:          <h2 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
frontend/src/components/admin/ChurnSignalsBars.tsx:57:            <p className="mt-1 text-lg font-semibold tabular-nums text-zinc-950 dark:text-zinc-50">
frontend/src/components/admin/RetentionCurves.tsx:28:        <h2 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
frontend/src/components/admin/RetentionCurves.tsx:58:              <p className="mt-1 text-xl font-semibold tabular-nums text-zinc-950 dark:text-zinc-50">
frontend/src/components/admin/RetentionCurves.tsx:72:        <h2 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
frontend/src/components/admin/FeedbackList.tsx:12:        <h2 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
frontend/src/components/admin/FeedbackList.tsx:25:                <span className="rounded bg-zinc-100 px-1.5 py-0.5 font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
frontend/src/components/admin/ChurnTab.tsx:28:            <h2 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
frontend/src/components/admin/ChurnTab.tsx:38:                <span className="text-sm font-medium tabular-nums text-zinc-950 dark:text-zinc-50">
frontend/src/components/admin/ChurnTab.tsx:49:          <h2 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
frontend/src/components/admin/ChurnTab.tsx:63:                <p className="mt-1 text-sm font-medium text-zinc-800 dark:text-zinc-100">
frontend/src/components/admin/ChurnTab.tsx:80:      <p className="mt-1 text-2xl font-semibold tabular-nums text-zinc-950 dark:text-zinc-50">
frontend/src/components/marketing/EditorialHeaderBase.tsx:78:                  fontWeight: 500,
frontend/src/components/seo/ComparisonTable.tsx:33:      <span className="inline-flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-medium text-sm">
frontend/src/components/seo/ComparisonTable.tsx:51:              <th className="w-[40%] bg-zinc-50 px-5 py-4 text-left font-semibold text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
frontend/src/components/seo/ComparisonTable.tsx:54:              <th className="w-[30%] border-x border-accent/15 bg-accent-light px-5 py-4 text-center font-semibold text-zinc-900 dark:text-zinc-100">
frontend/src/components/seo/ComparisonTable.tsx:59:              <th className="w-[30%] bg-zinc-50 px-5 py-4 text-center font-semibold text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
frontend/src/components/seo/ComparisonTable.tsx:74:                <td className="py-3.5 px-5 text-zinc-700 dark:text-zinc-300 font-medium">
frontend/src/components/seo/ArticleMeta.tsx:31:        <span className="font-medium text-zinc-900 dark:text-zinc-100">
frontend/src/components/admin/AdminPanels.tsx:44:    <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${colors[plan] || colors.free}`}>
frontend/src/components/admin/AdminPanels.tsx:52:    <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${
frontend/src/components/admin/AdminPanels.tsx:87:          <h2 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
frontend/src/components/admin/AdminPanels.tsx:95:          className="inline-flex items-center justify-center gap-2 rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
frontend/src/components/admin/AdminPanels.tsx:124:                <th scope="col" className="py-1.5 pr-3 font-medium">{tOr("admin.billingHealth.colPrice", "Price")}</th>
frontend/src/components/admin/AdminPanels.tsx:125:                <th scope="col" className="px-3 py-1.5 font-medium">{tOr("admin.billingHealth.colConfigured", "Configured")}</th>
frontend/src/components/admin/AdminPanels.tsx:126:                <th scope="col" className="px-3 py-1.5 font-medium">{tOr("admin.billingHealth.colMode", "Mode")}</th>
frontend/src/components/admin/AdminPanels.tsx:127:                <th scope="col" className="px-3 py-1.5 font-medium">{tOr("admin.billingHealth.colActive", "Active")}</th>
frontend/src/components/admin/AdminPanels.tsx:128:                <th scope="col" className="py-1.5 pl-3 font-medium">{tOr("admin.billingHealth.colInterval", "Interval")}</th>
frontend/src/components/admin/AdminPanels.tsx:134:                  <th scope="row" className="py-1.5 pr-3 text-left font-medium text-zinc-700 dark:text-zinc-300">
frontend/src/components/admin/AdminPanels.tsx:158:        <h2 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
frontend/src/components/admin/AdminPanels.tsx:171:              <p className="mt-1 text-xl font-semibold tabular-nums text-zinc-950 dark:text-zinc-50">{formatNumber(stage.users)}</p>
frontend/src/components/admin/AdminPanels.tsx:181:          <h3 className="mb-2 text-xs font-medium uppercase text-zinc-500 dark:text-zinc-400">{tOr("admin.funnel.topBillingReasons", "Top Billing Reasons")}</h3>
frontend/src/components/admin/AdminPanels.tsx:188:                      <p className="font-medium text-zinc-800 dark:text-zinc-100">{row.label || tOr("admin.funnel.paidSignal", "Paid signal")}</p>
frontend/src/components/admin/AdminPanels.tsx:221:            <h2 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">{tOr("admin.rag.title", "Answer Citation Quality")}</h2>
frontend/src/components/admin/AdminPanels.tsx:267:      <p className="mt-1 text-lg font-semibold tabular-nums text-zinc-950 dark:text-zinc-50">{value}</p>
frontend/src/components/admin/AdminPanels.tsx:283:      <h3 className="mb-3 text-xs font-medium uppercase text-zinc-500 dark:text-zinc-400">{title}</h3>
frontend/src/components/admin/AdminPanels.tsx:291:                <p className="text-sm font-medium text-zinc-800 dark:text-zinc-100">{item.label}</p>
frontend/src/components/admin/AdminPanels.tsx:319:          <h3 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">{tOr("admin.recentUsers.title", "Recent Users")}</h3>
frontend/src/components/admin/AdminPanels.tsx:335:          <h3 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">{tOr("admin.topUsers.title", "Top Users")}</h3>
frontend/src/components/admin/AdminPanels.tsx:381:                className={`px-4 py-2 font-medium text-zinc-500 dark:text-zinc-400 ${column.align === "right" ? "text-right" : "text-left"}`}
frontend/src/components/CreditsDisplay.tsx:78:      <span className="font-medium">{credits.toLocaleString()}</span>
frontend/src/app/auth/error/page.tsx:34:          <span className="font-logo font-semibold text-2xl text-zinc-900 dark:text-zinc-50">DocTalk</span>
frontend/src/app/auth/error/page.tsx:45:          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50 mb-3">
frontend/src/app/auth/error/page.tsx:54:            className="inline-flex items-center justify-center px-4 py-2.5 rounded-xl bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 font-medium hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors focus-visible:ring-2 focus-visible:ring-zinc-400 dark:focus-visible:ring-zinc-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-900"
frontend/src/app/d/[documentId]/DocumentReaderPageClient.tsx:268:      className="flex min-h-8 items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-zinc-600 transition-colors hover:bg-white/70 disabled:cursor-not-allowed disabled:opacity-50 dark:text-zinc-400 dark:hover:bg-zinc-800 focus-visible:ring-2 focus-visible:ring-blue-500"
frontend/src/app/d/[documentId]/DocumentReaderPageClient.tsx:278:      className="flex min-h-8 items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-zinc-600 transition-colors hover:bg-white/70 dark:text-zinc-400 dark:hover:bg-zinc-800 focus-visible:ring-2 focus-visible:ring-blue-500"
frontend/src/app/d/[documentId]/DocumentReaderPageClient.tsx:300:            <span className="font-medium">{layoutTranslationError.title}: </span>
frontend/src/app/d/[documentId]/DocumentReaderPageClient.tsx:306:                className="ml-2 font-medium underline decoration-amber-500 underline-offset-2 hover:text-amber-700 dark:hover:text-amber-50"
frontend/src/app/d/[documentId]/DocumentReaderPageClient.tsx:328:                  <div className="inline-flex rounded-lg border border-[var(--reader-border)] bg-[var(--reader-panel-muted)] p-0.5 text-xs font-medium">
frontend/src/app/d/[documentId]/DocumentReaderPageClient.tsx:349:                        className="inline-flex min-h-8 items-center gap-1 rounded-md border border-[var(--reader-border)] px-2 font-medium text-[var(--reader-ink)] transition-colors hover:bg-[var(--reader-panel-muted)]"
frontend/src/app/d/[documentId]/DocumentReaderPageClient.tsx:443:        <p className="font-semibold">{sessionErrorCopy.title}</p>
frontend/src/app/d/[documentId]/DocumentReaderPageClient.tsx:449:            className="mt-4 rounded-full bg-zinc-950 px-4 py-2 text-xs font-semibold text-white transition hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-200"
frontend/src/app/d/[documentId]/DocumentReaderPageClient.tsx:489:            <div className="text-lg font-medium mb-3">{error}</div>
frontend/src/app/d/[documentId]/DocumentReaderPageClient.tsx:547:                  className={`flex-1 py-3 text-xs font-medium flex flex-col items-center gap-1 transition-colors ${
frontend/src/app/d/[documentId]/DocumentReaderPageClient.tsx:559:                  className={`flex-1 py-3 text-xs font-medium flex flex-col items-center gap-1 transition-colors ${
frontend/src/app/auth/page.tsx:32:          <span className="font-logo text-lg font-semibold text-zinc-900 dark:text-zinc-50">DocTalk</span>
frontend/src/app/auth/page.tsx:33:          <span className="rounded-full border border-zinc-200 px-2 py-0.5 text-[10px] font-semibold text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
frontend/src/app/auth/page.tsx:38:        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
frontend/src/components/UserMenu.tsx:144:            <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
frontend/src/components/UserMenu.tsx:150:                className={`rounded-md border px-1.5 py-1.5 text-xs font-medium transition-colors ${
frontend/src/components/UserMenu.tsx:161:                className={`rounded-md border px-1.5 py-1.5 text-xs font-medium transition-colors ${
frontend/src/components/UserMenu.tsx:172:                className={`rounded-md border px-1.5 py-1.5 text-xs font-medium transition-colors ${
frontend/src/components/UserMenu.tsx:184:            <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
frontend/src/app/contact/ContactPageClient.tsx:182:                  style={{ color: 'var(--ed-signal)', fontWeight: 500 }}
frontend/src/app/contact/ContactPageClient.tsx:191:                  style={{ color: 'var(--ed-signal)', fontWeight: 500 }}
frontend/src/components/Quotes/QuoteResultCard.tsx:107:        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
frontend/src/components/Quotes/QuoteResultCard.tsx:111:        <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
frontend/src/components/Quotes/QuoteResultCard.tsx:118:              : 'inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800 dark:bg-amber-950/30 dark:text-amber-200'
frontend/src/components/Quotes/QuoteResultCard.tsx:140:            className="inline-flex min-h-8 items-center gap-1.5 rounded-md border border-[var(--reader-evidence-border)] bg-[var(--reader-evidence-soft)] px-2.5 text-xs font-medium text-[var(--reader-evidence)] transition-colors hover:brightness-95 focus-visible:ring-2 focus-visible:ring-blue-500"
frontend/src/components/Quotes/QuoteResultCard.tsx:148:            className="inline-flex min-h-8 items-center gap-1.5 rounded-md border border-[var(--reader-border)] bg-[var(--reader-panel-solid)] px-2.5 text-xs font-medium text-[var(--reader-ink)] transition-colors hover:bg-[var(--reader-panel-muted)] focus-visible:ring-2 focus-visible:ring-blue-500"
frontend/src/components/Quotes/QuoteResultCard.tsx:158:            className={`inline-flex min-h-8 items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed ${
frontend/src/components/Quotes/QuoteCardList.tsx:100:            className="inline-flex min-h-6 items-center gap-1 rounded px-1.5 text-xs font-medium text-[var(--reader-muted)] transition-colors hover:bg-[var(--reader-panel-muted)] hover:text-[var(--reader-ink)] focus-visible:ring-2 focus-visible:ring-blue-500"
frontend/src/app/admin/AdminPageClient.tsx:184:          <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
frontend/src/app/admin/AdminPageClient.tsx:189:            className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
frontend/src/app/admin/AdminPageClient.tsx:207:                  className={`whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition-colors ${
frontend/src/app/pricing/PricingPageContent.tsx:316:                      fontWeight: 500,
frontend/src/app/auth/confirm/page.tsx:70:          <span className="font-logo text-lg font-semibold text-zinc-900 dark:text-zinc-50">DocTalk</span>
frontend/src/app/auth/confirm/page.tsx:74:            <h1 className="mb-2 text-xl font-semibold text-zinc-900 dark:text-zinc-50">
frontend/src/app/auth/confirm/page.tsx:87:              className="w-full rounded-lg bg-blue-700 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 disabled:opacity-60 dark:focus-visible:ring-offset-zinc-900"
frontend/src/app/auth/confirm/page.tsx:96:            <h1 className="mb-2 text-xl font-semibold text-zinc-900 dark:text-zinc-50">
frontend/src/app/auth/confirm/page.tsx:107:              className="inline-block w-full rounded-lg bg-blue-700 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-blue-800"
frontend/src/components/Quotes/SavedQuoteCard.tsx:155:        <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
frontend/src/components/Quotes/SavedQuoteCard.tsx:162:              : 'inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800 dark:bg-amber-950/30 dark:text-amber-200'
frontend/src/components/Quotes/SavedQuoteCard.tsx:200:            className="inline-flex min-h-8 items-center gap-1.5 rounded-md border border-[var(--reader-evidence-border)] bg-[var(--reader-evidence-soft)] px-2.5 text-xs font-medium text-[var(--reader-evidence)] transition-colors hover:brightness-95 focus-visible:ring-2 focus-visible:ring-blue-500"
frontend/src/components/Quotes/SavedQuoteCard.tsx:208:            className="inline-flex min-h-8 items-center gap-1.5 rounded-md border border-[var(--reader-border)] bg-[var(--reader-panel-solid)] px-2.5 text-xs font-medium text-[var(--reader-ink)] transition-colors hover:bg-[var(--reader-panel-muted)] focus-visible:ring-2 focus-visible:ring-blue-500"
frontend/src/components/Quotes/QuoteFinderPanel.tsx:239:            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--reader-muted)]">
frontend/src/components/Quotes/QuoteFinderPanel.tsx:242:            <h2 id="quote-finder-title" className="mt-1 text-lg font-semibold">
frontend/src/components/Quotes/QuoteFinderPanel.tsx:264:            className={`inline-flex min-h-9 items-center gap-1.5 rounded-t-lg border-b-2 px-3 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-blue-500 ${
frontend/src/components/Quotes/QuoteFinderPanel.tsx:280:            className={`inline-flex min-h-9 items-center gap-1.5 rounded-t-lg border-b-2 px-3 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-blue-500 ${
frontend/src/components/Quotes/QuoteFinderPanel.tsx:305:              className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-zinc-950 px-4 text-sm font-semibold text-white transition-colors hover:bg-zinc-800 focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-200"
frontend/src/components/Quotes/BiblioForm.tsx:99:          <h2 id="biblio-form-title" className="text-base font-semibold">
frontend/src/components/Quotes/BiblioForm.tsx:118:              <span className="text-sm font-medium">{tOr('quoteFinder.biblioAuthors', 'Author(s)')}</span>
frontend/src/components/Quotes/BiblioForm.tsx:129:                <span className="text-sm font-medium">{tOr('quoteFinder.biblioYear', 'Year')}</span>
frontend/src/components/Quotes/BiblioForm.tsx:141:                <span className="text-sm font-medium">{tOr('quoteFinder.biblioTitleField', 'Title')}</span>
frontend/src/components/Quotes/BiblioForm.tsx:158:              className="inline-flex min-h-10 items-center justify-center rounded-lg border border-[var(--reader-border)] px-4 text-sm font-medium text-[var(--reader-ink)] transition-colors hover:bg-[var(--reader-panel-muted)] focus-visible:ring-2 focus-visible:ring-blue-500"
frontend/src/components/Quotes/BiblioForm.tsx:165:              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-zinc-950 px-4 text-sm font-semibold text-white transition-colors hover:bg-zinc-800 focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-200"
frontend/src/app/tools/word-counter/WordCounterClient.tsx:255:                    <dd className="ed-body tabular-nums" style={{ fontWeight: 600, color: 'var(--ed-ink)' }}>
frontend/src/app/tools/word-counter/WordCounterClient.tsx:273:                    <dd className="ed-body tabular-nums" style={{ fontWeight: 600, color: 'var(--ed-ink)' }}>
frontend/src/app/tools/word-counter/WordCounterClient.tsx:320:                <p className="ed-body" style={{ marginTop: '4px', fontWeight: 600, color: 'var(--ed-ink)' }}>
frontend/src/components/AuthModal.tsx:134:          <h2 id="auth-modal-title" className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
frontend/src/components/admin/ReasonBucketsDonut.tsx:23:      <h2 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
frontend/src/components/admin/ReasonBucketsDonut.tsx:55:                <span className="shrink-0 text-sm font-medium tabular-nums text-zinc-950 dark:text-zinc-50">
frontend/src/components/admin/RetentionHeatmap.tsx:28:        <h2 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
frontend/src/components/admin/RetentionHeatmap.tsx:39:              <th scope="col" className="w-28 px-2 py-1 text-left font-medium">
frontend/src/components/admin/RetentionHeatmap.tsx:42:              <th scope="col" className="w-16 px-2 py-1 text-right font-medium">
frontend/src/components/admin/RetentionHeatmap.tsx:46:                <th key={offset} scope="col" className="px-2 py-1 text-center font-medium tabular-nums">
frontend/src/components/admin/RetentionHeatmap.tsx:55:                <th scope="row" className="rounded bg-zinc-50 px-2 py-2 text-left font-medium text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
frontend/src/components/admin/RetentionHeatmap.tsx:66:                      className={`h-9 min-w-12 rounded text-center align-middle font-medium tabular-nums ${
frontend/src/components/admin/OverviewTab.tsx:90:        <h2 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
frontend/src/components/admin/OverviewTab.tsx:108:      <p className="mt-1 text-xl font-semibold tabular-nums text-zinc-950 dark:text-zinc-50">{value.toLocaleString()}</p>
frontend/src/components/PdfViewer/PdfToolbar.tsx:97:              className="inline-flex min-h-8 items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium hover:bg-[var(--reader-panel-muted)] focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-40"
frontend/src/components/admin/ActivationTab.tsx:22:        <h2 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
frontend/src/components/admin/ActivationTab.tsx:36:                <p className="mt-1 text-xl font-semibold tabular-nums text-zinc-950 dark:text-zinc-50">
frontend/src/components/admin/RetentionTab.tsx:29:          <h2 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
frontend/src/components/admin/RetentionTab.tsx:37:                <th scope="col" className="px-4 py-2 text-left font-medium">{tOr("admin.retention.week", "Week")}</th>
frontend/src/components/admin/RetentionTab.tsx:38:                <th scope="col" className="px-4 py-2 text-right font-medium">{tOr("admin.retention.new", "New")}</th>
frontend/src/components/admin/RetentionTab.tsx:39:                <th scope="col" className="px-4 py-2 text-right font-medium">{tOr("admin.retention.retained", "Retained")}</th>
frontend/src/components/admin/RetentionTab.tsx:40:                <th scope="col" className="px-4 py-2 text-right font-medium">{tOr("admin.retention.resurrected", "Resurrected")}</th>
frontend/src/components/admin/RetentionTab.tsx:41:                <th scope="col" className="px-4 py-2 text-right font-medium">{tOr("admin.retention.churned", "Churned")}</th>
frontend/src/components/admin/RetentionTab.tsx:66:      <p className="mt-1 text-2xl font-semibold tabular-nums text-zinc-950 dark:text-zinc-50">
frontend/src/components/admin/RetentionTab.tsx:76:      <h2 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">{title}</h2>
frontend/src/components/admin/KPICard.tsx:51:          className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium tabular-nums ${
frontend/src/components/admin/KPICard.tsx:64:        <p className="text-2xl font-semibold tabular-nums text-zinc-950 dark:text-zinc-50">
frontend/src/app/demo/error.tsx:17:        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">{t("error.title")}</h1>
frontend/src/app/demo/error.tsx:22:          className="mt-5 px-4 py-2 rounded-lg bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors text-sm font-medium focus-visible:ring-2 focus-visible:ring-zinc-400 dark:focus-visible:ring-zinc-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-900"
frontend/src/components/spell/CopyButton.tsx:55:      className={`relative inline-flex items-center font-mono font-semibold tracking-wider uppercase rounded-md overflow-hidden transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-950 ${sz} ${
frontend/src/app/blog/[slug]/BlogPostClient.tsx:124:                  fontWeight: isActive ? 500 : 400,
frontend/src/app/blog/[slug]/BlogPostClient.tsx:354:                        fontWeight: 600,
frontend/src/components/spell/FlowButton.tsx:30:    'group relative inline-flex items-center gap-2 rounded-lg font-semibold overflow-hidden isolate transition-colors motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-950 disabled:opacity-60 disabled:cursor-not-allowed';
frontend/src/app/collections/CollectionsPageClient.tsx:109:              <p className="mb-3 text-sm font-medium uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
frontend/src/app/collections/CollectionsPageClient.tsx:112:              <h1 className="font-serif text-4xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
frontend/src/app/collections/CollectionsPageClient.tsx:128:                    <div className={`text-lg font-semibold text-zinc-900 dark:text-zinc-50 ${clamp ? 'truncate' : ''}`}>
frontend/src/app/collections/CollectionsPageClient.tsx:131:                    <div className="mt-1 text-[11px] font-medium leading-4 text-zinc-500 dark:text-zinc-400">
frontend/src/app/collections/CollectionsPageClient.tsx:142:              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
frontend/src/app/collections/CollectionsPageClient.tsx:155:              className="inline-flex items-center justify-center gap-2 rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200 focus-visible:ring-2 focus-visible:ring-zinc-400 dark:focus-visible:ring-zinc-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-900"
frontend/src/app/collections/CollectionsPageClient.tsx:169:                  <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
frontend/src/app/collections/CollectionsPageClient.tsx:182:                      className="inline-flex items-center gap-2 rounded-lg bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200 focus-visible:ring-2 focus-visible:ring-zinc-400 dark:focus-visible:ring-zinc-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-900"
frontend/src/app/collections/CollectionsPageClient.tsx:190:                      className="inline-flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-5 py-2.5 text-sm font-medium text-zinc-700 transition-colors hover:border-zinc-300 hover:text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:border-zinc-700 dark:hover:text-zinc-100 focus-visible:ring-2 focus-visible:ring-zinc-400 dark:focus-visible:ring-zinc-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-900"
frontend/src/app/collections/CollectionsPageClient.tsx:205:                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-zinc-900 text-xs font-semibold text-white dark:bg-zinc-100 dark:text-zinc-950">
frontend/src/app/auth/verify-request/page.tsx:16:          <span className="font-logo font-semibold text-2xl text-zinc-900 dark:text-zinc-50">DocTalk</span>
frontend/src/app/auth/verify-request/page.tsx:27:          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50 mb-3">
frontend/src/components/PricingTable.tsx:70:          className="w-full mt-4 px-4 py-2 rounded-lg text-sm font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 cursor-not-allowed"
frontend/src/components/PricingTable.tsx:82:        className="w-full mt-4 px-4 py-2 rounded-lg text-sm font-medium bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm focus-visible:ring-2 focus-visible:ring-zinc-400 dark:focus-visible:ring-zinc-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-900"
frontend/src/components/PricingTable.tsx:106:                <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
frontend/src/components/PricingTable.tsx:132:              <td className="text-left py-4 px-6 font-medium text-zinc-500 dark:text-zinc-400 w-[34%]">
frontend/src/components/PricingTable.tsx:135:              <th scope="col" className="text-center py-4 px-3 font-medium text-zinc-500 dark:text-zinc-400 w-[22%]">
frontend/src/components/PricingTable.tsx:152:                  <span className="font-semibold text-zinc-900 dark:text-zinc-50">
frontend/src/components/PricingTable.tsx:162:                    : 'font-semibold text-zinc-900 dark:text-zinc-50'
frontend/src/components/PricingTable.tsx:178:                <th scope="row" className="py-3.5 px-6 text-left font-normal text-zinc-700 dark:text-zinc-300">
frontend/src/components/PricingTable.tsx:208:              <th scope="row" className="py-4 px-6 text-left font-normal">
frontend/src/app/opengraph-image.tsx:27:            fontWeight: 700,
frontend/src/app/tools/reading-time/ReadingTimeClient.tsx:200:            <p className="ed-body tabular-nums" style={{ marginTop: 0, fontWeight: 600, color: 'var(--ed-ink)' }}>
frontend/src/app/tools/reading-time/ReadingTimeClient.tsx:222:                  fontWeight: 600,
frontend/src/app/tools/reading-time/ReadingTimeClient.tsx:266:                      style={{ marginTop: 0, fontWeight: 600, color: 'var(--ed-ink)', minWidth: '5rem' }}
frontend/src/app/tools/reading-time/ReadingTimeClient.tsx:308:                      style={{ marginTop: 0, fontWeight: 600, color: 'var(--ed-ink)', minWidth: '5rem' }}
frontend/src/app/tools/reading-time/ReadingTimeClient.tsx:356:                        style={{ marginTop: 0, padding: '10px 8px', textAlign: 'right', fontWeight: 600, color: 'var(--ed-ink)' }}
frontend/src/app/tools/reading-time/ReadingTimeClient.tsx:362:                        style={{ marginTop: 0, padding: '10px 8px', textAlign: 'right', fontWeight: 600, color: 'var(--ed-ink)' }}
frontend/src/app/features/free-demo/FreeDemoContent.tsx:198:                    style={{ padding: '13px 18px', fontWeight: 500, color: 'var(--ed-ink)', textAlign: 'left' }}
frontend/src/components/marketing/EdComparisonTable.tsx:155:                    fontWeight: 500,
frontend/src/app/demo/[sample]/DemoRedirectPageClient.tsx:43:          <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-4">{t('demo.notFound')}</h1>
frontend/src/app/demo/[sample]/DemoRedirectPageClient.tsx:58:      <h1 className="text-sm font-medium text-zinc-600 dark:text-zinc-300">{t('common.loading')}</h1>
frontend/src/components/LanguageSelector.tsx:105:            locale === l.code ? 'font-medium' : ''
frontend/src/app/collections/[collectionId]/page.tsx:251:            <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
frontend/src/app/collections/[collectionId]/page.tsx:254:            <h1 className="truncate text-base font-semibold text-zinc-900 dark:text-zinc-50">
frontend/src/app/collections/[collectionId]/page.tsx:263:                className={`inline-flex min-h-8 items-center gap-1.5 rounded-md px-2.5 font-medium transition-colors ${
frontend/src/app/collections/[collectionId]/page.tsx:275:                className={`inline-flex min-h-8 items-center gap-1.5 rounded-md px-2.5 font-medium transition-colors ${
frontend/src/app/collections/[collectionId]/page.tsx:287:                className={`inline-flex min-h-8 items-center gap-1.5 rounded-md px-2.5 font-medium transition-colors ${
frontend/src/app/collections/[collectionId]/page.tsx:314:          className={`flex flex-1 items-center justify-center gap-2 px-4 py-2.5 text-xs font-medium transition-colors ${
frontend/src/app/collections/[collectionId]/page.tsx:327:          className={`flex flex-1 items-center justify-center gap-2 px-4 py-2.5 text-xs font-medium transition-colors ${
frontend/src/app/collections/[collectionId]/page.tsx:340:          className={`flex flex-1 items-center justify-center gap-2 px-4 py-2.5 text-xs font-medium transition-colors ${
frontend/src/app/collections/[collectionId]/page.tsx:350:          className={`flex flex-1 items-center justify-center gap-2 px-4 py-2.5 text-xs font-medium transition-colors ${
frontend/src/app/collections/[collectionId]/page.tsx:384:            <h2 className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">
frontend/src/app/collections/[collectionId]/page.tsx:464:                <h3 id="add-docs-title" className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
frontend/src/app/collections/[collectionId]/page.tsx:489:                  className="inline-flex items-center gap-1 rounded-md border border-red-300 bg-white px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-100 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-100 dark:hover:bg-red-950/60 focus-visible:ring-2 focus-visible:ring-red-400"
frontend/src/app/collections/[collectionId]/page.tsx:540:                <p className="font-medium">{addDocsErrorCopy.title}</p>
frontend/src/app/collections/[collectionId]/page.tsx:546:                    className="mt-2 inline-flex items-center justify-center rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200 focus-visible:ring-2 focus-visible:ring-zinc-400 dark:focus-visible:ring-zinc-500"
frontend/src/app/trust/TrustPageContent.tsx:266:                <div className="ed-body" style={{ fontWeight: 600 }}>
frontend/src/app/demo/DemoPageClient.tsx:240:                      fontWeight: 500,
frontend/src/components/Chat/ChatPanel.tsx:512:                    <p className="mt-1 text-sm font-medium text-[var(--workbench-ink)]">{t('chat.trySuggested')}</p>
frontend/src/components/Chat/ChatPanel.tsx:514:                  <div className="hidden sm:flex h-9 w-9 items-center justify-center rounded-xl border border-zinc-200 bg-zinc-50 text-zinc-500 dark:border-white/14 dark:bg-white/8 dark:text-white/72 text-xs font-mono font-semibold">
frontend/src/components/Chat/ChatPanel.tsx:597:                  <p className="font-semibold">
frontend/src/components/Chat/ChatPanel.tsx:607:                  className="dt-stitch-primary inline-flex min-h-11 shrink-0 items-center justify-center rounded-full px-4 py-2 font-medium transition-colors focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
frontend/src/components/Chat/ChatPanel.tsx:615:              <span className={demoRemaining <= 2 ? 'text-amber-600 dark:text-amber-400 font-medium' : ''}>
frontend/src/app/collections/[collectionId]/error.tsx:21:        <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">{t('error.somethingWrong')}</h2>
frontend/src/app/collections/[collectionId]/error.tsx:29:            className="px-4 py-2 rounded-lg bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 transition-colors text-sm font-medium"
frontend/src/app/collections/[collectionId]/error.tsx:35:            className="px-4 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors text-sm font-medium"
frontend/src/components/Chat/ChatArtifactCard.tsx:318:            <p className="text-sm font-semibold text-[var(--reader-ink)]">{displayTitle}</p>
frontend/src/components/Chat/ChatArtifactCard.tsx:319:            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${
frontend/src/components/Chat/ChatArtifactCard.tsx:340:                  className="ml-1 font-medium underline decoration-red-400 underline-offset-2 hover:text-red-800 dark:hover:text-red-100"
frontend/src/components/Chat/ChatArtifactCard.tsx:389:                        className="inline-flex min-h-7 items-center gap-1 rounded border border-[var(--reader-border)] bg-[var(--reader-panel-solid)] px-2 text-[11px] font-medium text-[var(--reader-ink)] transition-colors hover:bg-[var(--reader-panel-muted)] disabled:opacity-50"
frontend/src/components/Chat/ChatArtifactCard.tsx:444:              className="inline-flex min-h-9 items-center gap-2 rounded-md bg-zinc-900 px-3 text-sm font-medium text-white transition-colors hover:bg-zinc-800 focus-visible:ring-2 focus-visible:ring-zinc-400 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
frontend/src/components/Chat/ChatArtifactCard.tsx:454:              className="inline-flex min-h-9 items-center gap-2 rounded-md bg-zinc-900 px-3 text-sm font-medium text-white transition-colors hover:bg-zinc-800 focus-visible:ring-2 focus-visible:ring-zinc-400 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
frontend/src/components/Chat/ChatArtifactCard.tsx:464:                className="inline-flex min-h-9 items-center gap-2 rounded-md border border-[var(--reader-border)] bg-[var(--reader-panel-solid)] px-3 text-sm font-medium text-[var(--reader-ink)] transition-colors hover:bg-[var(--reader-panel-muted)] focus-visible:ring-2 focus-visible:ring-zinc-400"
frontend/src/components/Chat/ChatArtifactCard.tsx:475:                className="inline-flex min-h-9 items-center gap-2 rounded-md border border-[var(--reader-border)] bg-[var(--reader-panel-solid)] px-3 text-sm font-medium text-[var(--reader-ink)] transition-colors hover:bg-[var(--reader-panel-muted)] focus-visible:ring-2 focus-visible:ring-zinc-400 disabled:cursor-not-allowed disabled:opacity-50"
frontend/src/components/Chat/ChatArtifactCard.tsx:485:            <span className="text-xs font-medium text-[var(--reader-muted)]">
frontend/src/components/Chat/ChatArtifactCard.tsx:494:              className="inline-flex min-h-8 items-center rounded-md border border-[var(--reader-evidence-border)] bg-[var(--reader-evidence-soft)] px-2 text-xs font-medium text-[var(--reader-evidence)] transition-colors hover:brightness-95"
frontend/src/components/spell/FallbackAvatar.tsx:45:      className={`relative inline-flex select-none items-center justify-center overflow-hidden rounded-full bg-gradient-to-br font-semibold text-white ${grad} ${className}`}
frontend/src/components/spell/ShimmerBadge.tsx:19:      className={`relative inline-flex items-center gap-1.5 overflow-hidden rounded-full py-1 text-[11px] font-mono font-semibold uppercase tracking-[0.14em] text-accent ${
frontend/src/components/ThemeSelector.tsx:124:              isSelected ? 'font-medium' : ''
frontend/src/components/AppHeaderShell.tsx:33:      <Link href="/" className="font-logo font-semibold text-lg sm:text-xl text-[var(--workbench-ink)] hover:text-zinc-950 dark:hover:text-white transition-colors shrink-0 focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:rounded-sm inline-flex items-center gap-1.5 sm:gap-2">
frontend/src/components/AppHeaderShell.tsx:36:        <span className="hidden sm:inline ml-1 -mt-2 px-1.5 py-0.5 text-[10px] font-medium leading-none rounded-full border border-zinc-300 bg-zinc-100 dark:border-white/18 dark:bg-white/8 text-[var(--workbench-muted)] tracking-wide uppercase">Beta</span>
frontend/src/components/Chat/MessageBubble.tsx:74:                className="not-prose dt-source-index align-super mx-0.5 inline-flex h-[1.125rem] min-w-[1.125rem] cursor-pointer select-none items-center justify-center rounded px-1 text-[10px] font-semibold leading-none transition-colors hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--reader-evidence)]"
frontend/src/components/Chat/MessageBubble.tsx:344:                  className="not-prose mt-3 inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-[var(--reader-evidence-border)] bg-[var(--reader-evidence-soft)] px-3 py-1.5 text-sm font-medium text-[var(--reader-evidence)] transition-colors hover:brightness-95 focus-visible:ring-2 focus-visible:ring-[var(--reader-evidence)]"
frontend/src/components/Chat/MessageBubble.tsx:419:            className="mt-2 flex items-center gap-1.5 rounded-lg border border-[var(--reader-evidence-border)] bg-[var(--reader-evidence-soft)] px-3 py-1.5 text-sm font-medium text-[var(--reader-evidence)] transition-colors hover:brightness-95 focus-visible:ring-2 focus-visible:ring-[var(--reader-evidence)]"
frontend/src/components/Profile/SavedQuotesSection.tsx:57:          className="inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline"
frontend/src/components/Profile/SavedQuotesSection.tsx:64:        <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
frontend/src/components/Profile/SavedQuotesSection.tsx:71:              : "inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800 dark:bg-amber-950/30 dark:text-amber-200"
frontend/src/components/Profile/SavedQuotesSection.tsx:92:          className="inline-flex min-h-8 items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-2.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50 focus-visible:ring-2 focus-visible:ring-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
frontend/src/components/Profile/SavedQuotesSection.tsx:184:        <h2 className="mb-1 text-base font-semibold text-zinc-900 dark:text-zinc-100">
frontend/src/components/Chat/CitationCard.tsx:40:      <span className="dt-source-index inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded px-1 text-[10px] font-bold leading-none">{refIndex}</span>
frontend/src/components/Chat/SourcesStrip.tsx:116:              <span className="dt-source-index inline-flex h-4 min-w-4 items-center justify-center rounded px-1 text-[10px] font-bold leading-none">
frontend/src/components/Chat/SourcesStrip.tsx:124:              <span className="truncate font-medium">{displayFilename}</span>
frontend/src/components/Chat/CollectionCitationCard.tsx:31:        className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded text-xs font-medium bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-300 dark:hover:bg-zinc-600 transition-colors focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:rounded"
frontend/src/components/Chat/CollectionCitationCard.tsx:42:            <span className="font-semibold text-zinc-800 dark:text-zinc-200">
frontend/src/components/Profile/AccountActionsSection.tsx:99:        <h3 className="text-lg font-medium mb-2 text-zinc-900 dark:text-zinc-100">
frontend/src/components/Profile/AccountActionsSection.tsx:109:          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-zinc-400 dark:focus-visible:ring-zinc-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-900"
frontend/src/components/Profile/AccountActionsSection.tsx:123:        <h3 className="text-lg font-medium mb-2 text-red-700 dark:text-red-300">

exec
/bin/zsh -lc "rg -n --glob '*.{tsx,ts,js,jsx,css}' --glob '"'!editorial.css'"' --glob '"'!globals.css'"' '(--ed-glass|ed-glass|backdrop-filter|backdropFilter)' frontend/src && rg -n --glob '*.{tsx,ts,js,jsx,css}' '(--ed-ochre|font-inter|font-newsreader)' frontend/src frontend/tailwind.config.ts" in /Users/mayijie/Projects/Code/010_DocTalk
 exited 1 in 0ms:
frontend/src/components/landing/HeroCollage.tsx:9: * document plates use .ed-glass (spec §4.1 "hero cards") — this is the
frontend/src/components/landing/HeroCollage.tsx:113:          className="ed-glass"
frontend/src/components/landing/HeroCollage.tsx:320:          className="ed-glass"
frontend/src/components/marketing/EdFaqList.tsx:29:    <div className="ed-glass" style={{ padding: "6px 28px" }}>
frontend/src/components/marketing/EdCtaBanner.tsx:22:    <section className="ed-section ed-glass ed-glass--cta">
frontend/src/components/marketing/EditorialHeaderBase.tsx:63:        className="sticky top-0 z-50 h-16 flex items-center ed-glass ed-glass--strong ed-glass--header"
frontend/src/components/marketing/EdComparisonTable.tsx:107:    <div className="ed-glass" style={{ padding: "4px", overflow: "hidden" }}>
frontend/src/components/marketing/EdCardGrid.tsx:53:            className="ed-card ed-glass h-full"
frontend/src/components/marketing/EdCardGrid.tsx:61:            className="ed-card ed-glass h-full"
frontend/src/components/marketing/EdLanguageSelector.tsx:132:      className="dt-editorial ed-glass ed-glass--strong ed-glass--popover"

exec
/bin/zsh -lc "git diff --word-diff=porcelain 782f8b0..HEAD -- frontend/src ':"'!frontend/src/app/editorial.css'"' ':"'!frontend/src/app/globals.css'"' | rg -n '"'^[-+](?![-+])'"' --pcre2 | sed -n '1,400p'" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
13:-'var(--ed-ochre)'
14:+'var(--ed-signal-deep)'
31:-'var(--font-inter),
32:+'var(--font-plex-sans),
49:-Inter,
50:+IBM_Plex_Sans,
52:-Newsreader,
53:+Fraunces,
70:-inter
71:+plexSans
73:-Inter({
74:+IBM_Plex_Sans({
79:+weight: ['400', '500', '600', '700'],
82:-'--font-inter',
83:+'--font-plex-sans',
86:-'swap'
87:+'swap',
105:-newsreader
106:+fraunces
108:-Newsreader({
109:+Fraunces({
114:-weight: ['400', '500', '600'],
115:+style: ['normal', 'italic'],
117:+  axes: ['opsz', 'SOFT'],
120:-'--font-newsreader',
121:+'--font-fraunces',
137:-className={`${inter.variable}
138:+className={`${plexSans.variable}
140:-${newsreader.variable}
141:+${fraunces.variable}
161:+import MarketingShell from '../../../components/marketing/MarketingShell';
177:+<MarketingShell>
180:-className="min-h-screen bg-white dark:bg-zinc-950">
182:-      <div className="max-w-3xl mx-auto px-4 py-8">
183:+className="ed-shell" style={{ maxWidth: '760px', paddingTop: '48px', paddingBottom: '64px' }}>
186:-className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 mb-1">{data.session_title}</h1>
187:+className="ed-h1">{data.session_title}</h1>
190:-className="text-sm text-zinc-500 mb-6">Document: {data.document_name}</p>
191:+className="ed-caption" style={{ marginTop: '8px', marginBottom: '32px' }}>
193:+          Document: {data.document_name}
195:+        </p>
200:-className="space-y-4">
201:+className="flex flex-col" style={{ gap: '16px' }}>
212:-rounded-2xl transition-[background-color,box-shadow] target:bg-blue-50 target:ring-2 target:ring-blue-300 target:ring-offset-4 target:ring-offset-white dark:target:bg-blue-950/30 dark:target:ring-blue-700 dark:target:ring-offset-zinc-950 ${
214:-                msg.role
215:+target:bg-[var(--ed-paper-2)] ${msg.role
217:-''
219:-              }`}
220:+''}`}
222:+              style={{ transition: 'background-color 300ms ease' }}
229:-className={`max-w-[85%] rounded-xl px-4 py-3 ${
231:-                msg.role
232:+className="ed-card"
234:+                style={{
236:+                  maxWidth: '85%',
238:+                  ...(msg.role
242:-'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
243:+{ background: 'var(--ed-ink)', color: '#ffffff', border: '1px solid var(--ed-ink)' }
246:-'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100'
248:-              }`}>
249:+{}),
251:+                }}
253:+              >
256:-className="text-sm whitespace-pre-wrap">{msg.content}</p>
257:+className="ed-body" style={msg.role === 'user' ? { color: '#ffffff' } : undefined}>
259:+                  {msg.content}
261:+                </p>
266:-className="mt-2 space-y-1">
267:+className="flex flex-col" style={{ marginTop: '10px', gap: '6px' }}>
276:-className="text-xs text-zinc-500 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-700 rounded px-2 py-1">
277:+className="ed-caption"
279:+                        style={{
281:+                          border: '1px solid var(--ed-rule)',
283:+                          background: 'var(--ed-paper-2)',
285:+                          padding: '4px 8px',
287:+                          borderRadius: '3px',
289:+                          color: 'var(--ed-ink-2)',
291:+                        }}
293:+                      >
309:-className="mt-12 text-center border-t border-zinc-200 dark:border-zinc-800 pt-6">
310:+style={{ marginTop: '48px', textAlign: 'center', borderTop: '1px solid var(--ed-rule)', paddingTop: '24px' }}>
313:-className="text-sm text-zinc-500 mb-3">Powered
314:+className="ed-caption" style={{ marginBottom: '12px' }}>Powered
318:-className="inline-block px-6 py-2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
320:-          >
321:+className="ed-cta">
332:-</div>
333:+</MarketingShell>
351:-'var(--ed-ochre)',
352:+'var(--ed-slate-2)',
372:-"var(--ed-ochre)",
373:+"var(--ed-signal-deep)",
389:-"var(--ed-ochre)",
390:+"var(--ed-slate)",
406:-"var(--ed-ochre)",
407:+"var(--ed-slate)",
427:-var(--ed-ochre)",
428:+var(--ed-slate)",
444:-"var(--ed-ochre)"
445:+"var(--ed-slate)"
466:-border-[var(--ed-signal)]"
467:+border-[var(--ed-slate)]"
484:-bg-[var(--ed-signal)]
485:+bg-[var(--ed-olive)]
506:-images.
508:- * No glassmorphism,
509:+images,
513:+*
515:+The two stacked
517:+ * document plates use .ed-glass (spec §4.1 "hero cards") — this is the
519:+ * one deliberate glassmorphism use in this file.
535:-ochre
536:+slate
553:-"var(--ed-ochre)",
554:+"var(--ed-slate)",
570:-"var(--ed-ochre)",
571:+"var(--ed-slate)",
587:+className="ed-glass"
599:-            background: "var(--ed-paper)",
601:-            border: "1px solid var(--ed-rule)",
603:-            borderRadius: "2px",
609:-            boxShadow:
611:-              "0 4px 18px 0 rgba(28,27,25,0.10), 0 1px 3px 0 rgba(28,27,25,0.07)",
627:-Amber/signal
628:+Slate
630:+— quote-highlight rule (structure)
642:-"var(--ed-ochre)",
643:+"var(--ed-slate)",
659:-Terracotta
660:+Olive
662:+— verified badge
679:-"var(--ed-signal)",
680:+"var(--ed-olive)",
696:+— verified citation, olive
713:-"var(--ed-signal)",
714:+"var(--ed-olive)",
730:+className="ed-glass"
744:-            background: "var(--ed-paper-2)",
746:-            border: "1px solid var(--ed-rule)",
748:-            borderRadius: "2px",
768:+ed-glass
785:+ed-glass
806:+className="ed-glass" style={{ padding: "4px", overflow: "hidden" }}>
808:+      <div
820:-border: "1px solid var(--ed-rule)",
829:-<th
831:-              scope="col"
833:-              className="ed-label"
835:-              style={{
837:-                width: featureColWidth,
839:-                padding: "14px 18px",
841:-                textAlign: "left",
843:-              }}
845:-            >
847:-              {featureHeader}
849:-            </th>
851:-            <th
853:-              scope="col"
855:-              className="ed-label"
857:-              style={{
859:-                ...headStyle,
861:-                background: "var(--ed-paper-2)",
863:-                color: "var(--ed-signal)",
865:-              }}
867:-            >
869:-              DocTalk
871:-            </th>
873:-            {competitorHeaders.map((name, i) => (
875:-              <th key={`${name}-${i}`} scope="col" className="ed-label" style={headStyle}>
877:-                {name}
879:-              </th>
881:-            ))}
883:-          </tr>
885:-        </thead>
887:-        <tbody>
889:-          {rows.map((feature, i) => (
891:-            <tr key={i} style={{ borderTop: "1px solid var(--ed-rule)" }}>
896:-scope="row"
898:-                className="ed-body"
899:+scope="col"
901:+                className="ed-label"
906:+width: featureColWidth,
909:-"13px
910:+"14px
912:-fontWeight: 500,
914:-                  color: "var(--ed-ink)",
923:-{feature.name}
924:+{featureHeader}
929:-<td
930:+<th
932:+                scope="col"
934:+                className="ed-label"
939:-...cellStyle,
940:+...headStyle,
945:+color: "var(--ed-signal)",
952:-<EdInlineCell value={feature.doctalk} />
954:-              </td>
956:-              {feature.competitors.map((value, j)
957:+DocTalk
959:+              </th>
961:+              {competitorHeaders.map((name, i)
965:-<td key={j} style={cellStyle}>
967:-                  <EdInlineCell value={value} />
969:-                </td>
970:+<th key={`${name}-${i}`} scope="col" className="ed-label" style={headStyle}>
972:+                  {name}
974:+                </th>
981:+</thead>
983:+          <tbody>
985:+            {rows.map((feature, i) => (
987:+              <tr key={i} style={{ borderTop: "1px solid var(--ed-rule)" }}>
989:+                <th
991:+                  scope="row"
993:+                  className="ed-body"
995:+                  style={{
997:+                    padding: "13px 18px",
999:+                    fontWeight: 500,
1001:+                    color: "var(--ed-ink)",
1003:+                    textAlign: "left",
1005:+                  }}
1007:+                >
1009:+                  {feature.name}
1011:+                </th>
1013:+                <td
1015:+                  style={{
1017:+                    ...cellStyle,
1019:+                    background: "var(--ed-paper-2)",
1021:+                  }}
1023:+                >
1025:+                  <EdInlineCell value={feature.doctalk} />
1027:+                </td>
1029:+                {feature.competitors.map((value, j) => (
1031:+                  <td key={j} style={cellStyle}>
1033:+                    <EdInlineCell value={value} />
1035:+                  </td>
1037:+                ))}
1039:+              </tr>
1048:+</div>
1068:-className="ed-section"
1070:-      style={{
1072:-        background: "var(--ed-paper-2)",
1074:-        borderTop: "1px solid var(--ed-rule)",
1076:-      }}
1078:-    >
1079:+className="ed-section ed-glass ed-glass--cta">
1099:-<div>
1100:+<div className="ed-glass" style={{ padding: "6px 28px" }}>
1115:-            isLast={index === items.length - 1}
1130:-  isLast: boolean;
1145:-  isLast,
1161:+// Rows divide each other, but the glass panel's own border already
1163:+        // closes the list — drawing an edge rule here too puts a second,
1165:+        // shorter hairline 6px inside the panel edge (the wrapper's vertical
1167:+        // padding), which reads as a stray line rather than a divider.
1170:-"1px solid var(--ed-rule)",
1172:-        borderBottom: isLast
1173:+index === 0
1175:+undefined :
1177:-var(--ed-rule)" : undefined,
1178:+var(--ed-rule)",
1198:-"var(--ed-ochre)",
1199:+"var(--ed-slate)",
1219:-className="dt-editorial"
1220:+className="dt-editorial ed-glass ed-glass--strong ed-glass--popover"
1235:-        background: "var(--ed-paper)",
1237:-        border: "1px solid var(--ed-rule)",
1239:-        boxShadow: "0 14px 36px rgba(40, 33, 24, 0.20)",
1259:-items-center"
1261:-        style={{
1263:-          background: "var(--ed-paper)",
1265:-          borderBottom: "1px solid var(--ed-rule)",
1267:-        }}
1268:+items-center ed-glass ed-glass--strong ed-glass--header"

codex
The cascade combinations I’ve traced so far are internally consistent: normal hover, reduced-transparency+hover, print+hover, and reduced-transparency+print+hover all resolve to the intended later media rule; the header’s direct-child selector also wins the old `position: relative` tie. I did find one separate shared-page rendering regression candidate and am now validating whether it is isolated or symptomatic of other JSX semantics lost during the visual rewrite.
exec
/bin/zsh -lc "rg -n --glob '*.{tsx,ts}' '<EdCardGrid|<EdCtaBanner|<EdFaqList|<EdComparisonTable|<HeroCollage|<EdLanguageSelector|<EditorialHeader' frontend/src | sed -n '1,500p'" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
frontend/src/components/marketing/EditorialHeaderBase.tsx:152:              <EdLanguageSelector languageLabel={chrome?.language} />
frontend/src/components/marketing/EditorialMarketingHeader.tsx:24:  return <EditorialHeaderBase breadcrumb={breadcrumb} chrome={chrome} />;
frontend/src/app/trust/TrustPageContent.tsx:299:      <EdCtaBanner
frontend/src/app/pricing/PricingPageContent.tsx:199:        <EdCardGrid
frontend/src/app/features/free-demo/FreeDemoContent.tsx:141:          <EdCardGrid
frontend/src/app/features/free-demo/FreeDemoContent.tsx:228:        <EdFaqList items={faqItems.map((f) => ({ question: f.q, answer: f.a }))} />
frontend/src/app/features/free-demo/FreeDemoContent.tsx:241:      <EdCtaBanner
frontend/src/app/features/FeaturesHubContent.tsx:80:        <EdCardGrid
frontend/src/app/features/FeaturesHubContent.tsx:106:      <EdCtaBanner
frontend/src/app/tools/ToolsHubContent.tsx:66:        <EdCardGrid
frontend/src/app/tools/ToolsHubContent.tsx:89:      <EdCtaBanner
frontend/src/app/tools/word-counter/WordCounterClient.tsx:329:      <EdCtaBanner
frontend/src/app/use-cases/finance/FinanceContent.tsx:128:        <EdCardGrid
frontend/src/app/use-cases/finance/FinanceContent.tsx:168:              <EdCardGrid columns={2} items={footnoteReviewItems} />
frontend/src/app/use-cases/finance/FinanceContent.tsx:178:            <EdCardGrid columns={3} items={footnotePromptItems} />
frontend/src/app/use-cases/finance/FinanceContent.tsx:230:        <EdFaqList items={faqItems} />
frontend/src/app/use-cases/finance/FinanceContent.tsx:233:      <EdCtaBanner
frontend/src/app/features/citations/CitationsContent.tsx:169:          <EdComparisonTable
frontend/src/app/features/citations/CitationsContent.tsx:190:        <EdCardGrid
frontend/src/app/features/citations/CitationsContent.tsx:202:        <EdFaqList items={faqItems.map((f) => ({ question: f.q, answer: f.a }))} />
frontend/src/app/features/citations/CitationsContent.tsx:216:      <EdCtaBanner
frontend/src/app/alternatives/humata/HumataAltsContent.tsx:154:        <EdFaqList items={faqItems} />
frontend/src/app/alternatives/humata/HumataAltsContent.tsx:169:      <EdCtaBanner
frontend/src/app/features/multi-format/MultiFormatContent.tsx:150:          <EdCardGrid
frontend/src/app/features/multi-format/MultiFormatContent.tsx:249:        <EdFaqList items={faqItems.map((f) => ({ question: f.q, answer: f.a }))} />
frontend/src/app/features/multi-format/MultiFormatContent.tsx:262:      <EdCtaBanner
frontend/src/app/features/multilingual/MultilingualContent.tsx:146:          <EdCardGrid
frontend/src/app/features/multilingual/MultilingualContent.tsx:228:        <EdFaqList items={faqItems.map((f) => ({ question: f.q, answer: f.a }))} />
frontend/src/app/features/multilingual/MultilingualContent.tsx:241:      <EdCtaBanner
frontend/src/app/use-cases/hr-contracts/HrContractsContent.tsx:125:        <EdCardGrid columns={2} items={docTypes} />
frontend/src/app/use-cases/hr-contracts/HrContractsContent.tsx:168:        <EdCardGrid columns={2} items={securityItems} />
frontend/src/app/use-cases/hr-contracts/HrContractsContent.tsx:172:        <EdFaqList items={faqItems} />
frontend/src/app/use-cases/hr-contracts/HrContractsContent.tsx:175:      <EdCtaBanner
frontend/src/app/features/performance-modes/PerformanceModesContent.tsx:162:        <EdFaqList items={faqItems.map((f) => ({ question: f.q, answer: f.a }))} />
frontend/src/app/features/performance-modes/PerformanceModesContent.tsx:175:      <EdCtaBanner
frontend/src/app/alternatives/pdf-ai/PdfAiAltsContent.tsx:81:        <EdComparisonTable features={quickCompare} competitorName="PDF.ai" />
frontend/src/app/alternatives/pdf-ai/PdfAiAltsContent.tsx:213:        <EdFaqList items={faqItems} />
frontend/src/app/alternatives/pdf-ai/PdfAiAltsContent.tsx:232:      <EdCtaBanner
frontend/src/app/features/layout-translation/LayoutTranslationPageContent.tsx:51:        <EdCardGrid
frontend/src/app/features/layout-translation/LayoutTranslationPageContent.tsx:90:      <EdCtaBanner
frontend/src/components/landing/EditorialHeader.tsx:11:  return <EditorialHeaderBase showDateline />;
frontend/src/app/use-cases/consultants/ConsultantsContent.tsx:157:        <EdCardGrid
frontend/src/app/use-cases/consultants/ConsultantsContent.tsx:167:        <EdCardGrid
frontend/src/app/use-cases/consultants/ConsultantsContent.tsx:177:        <EdCardGrid
frontend/src/app/use-cases/consultants/ConsultantsContent.tsx:217:        <EdFaqList items={faqItems} />
frontend/src/app/use-cases/consultants/ConsultantsContent.tsx:220:      <EdCtaBanner
frontend/src/app/tools/reading-time/ReadingTimeClient.tsx:375:      <EdCtaBanner
frontend/src/app/use-cases/lawyers/LawyersContent.tsx:124:        <EdCardGrid
frontend/src/app/use-cases/lawyers/LawyersContent.tsx:162:        <EdCardGrid
frontend/src/app/use-cases/lawyers/LawyersContent.tsx:175:        <EdFaqList items={faqItems} />
frontend/src/app/use-cases/lawyers/LawyersContent.tsx:178:      <EdCtaBanner
frontend/src/app/alternatives/chatpdf/ChatpdfAltsContent.tsx:81:        <EdComparisonTable features={quickCompare} competitorName="ChatPDF" />
frontend/src/app/alternatives/chatpdf/ChatpdfAltsContent.tsx:192:        <EdFaqList items={faqItems} />
frontend/src/app/alternatives/chatpdf/ChatpdfAltsContent.tsx:209:      <EdCtaBanner
frontend/src/app/use-cases/students/StudentsContent.tsx:150:        <EdCardGrid
frontend/src/app/use-cases/students/StudentsContent.tsx:203:        <EdFaqList items={faqItems} />
frontend/src/app/use-cases/students/StudentsContent.tsx:206:      <EdCtaBanner
frontend/src/app/compare/humata/HumataContent.tsx:70:        <EdComparisonTable features={features} competitorName="Humata" />
frontend/src/app/compare/humata/HumataContent.tsx:186:        <EdFaqList items={faqItems} />
frontend/src/app/compare/humata/HumataContent.tsx:202:      <EdCtaBanner
frontend/src/components/landing/HeroSection.tsx:95:            <HeroCollage />
frontend/src/app/use-cases/UseCasesHubContent.tsx:106:      <EdCtaBanner
frontend/src/app/alternatives/notebooklm/NotebooklmAltsContent.tsx:163:        <EdFaqList items={faqItems} />
frontend/src/app/alternatives/notebooklm/NotebooklmAltsContent.tsx:178:      <EdCtaBanner
frontend/src/app/use-cases/real-estate/RealEstateContent.tsx:178:        <EdCardGrid
frontend/src/app/use-cases/real-estate/RealEstateContent.tsx:188:        <EdCardGrid
frontend/src/app/use-cases/real-estate/RealEstateContent.tsx:198:        <EdCardGrid
frontend/src/app/use-cases/real-estate/RealEstateContent.tsx:238:        <EdFaqList items={faqItems} />
frontend/src/app/use-cases/real-estate/RealEstateContent.tsx:241:      <EdCtaBanner
frontend/src/app/use-cases/compliance/ComplianceContent.tsx:179:        <EdCardGrid
frontend/src/app/use-cases/compliance/ComplianceContent.tsx:200:        <EdCardGrid
frontend/src/app/use-cases/compliance/ComplianceContent.tsx:210:        <EdCardGrid
frontend/src/app/use-cases/compliance/ComplianceContent.tsx:250:        <EdFaqList items={faqItems} />
frontend/src/app/use-cases/compliance/ComplianceContent.tsx:253:      <EdCtaBanner
frontend/src/app/use-cases/teachers/TeachersContent.tsx:163:        <EdCardGrid
frontend/src/app/use-cases/teachers/TeachersContent.tsx:173:        <EdCardGrid
frontend/src/app/use-cases/teachers/TeachersContent.tsx:225:        <EdFaqList items={faqItems} />
frontend/src/app/use-cases/teachers/TeachersContent.tsx:228:      <EdCtaBanner
frontend/src/app/compare/askyourpdf/AskyourpdfContent.tsx:70:        <EdComparisonTable features={features} competitorName="AskYourPDF" />
frontend/src/app/compare/askyourpdf/AskyourpdfContent.tsx:186:        <EdFaqList items={faqItems} />
frontend/src/app/compare/askyourpdf/AskyourpdfContent.tsx:202:      <EdCtaBanner
frontend/src/app/about/AboutPageClient.tsx:98:      <EdCtaBanner
frontend/src/app/alternatives/AlternativesHubContent.tsx:63:        <EdCardGrid
frontend/src/app/alternatives/AlternativesHubContent.tsx:89:      <EdCtaBanner
frontend/src/app/compare/pdf-ai/PdfaiContent.tsx:70:        <EdComparisonTable features={features} competitorName="PDF.ai" />
frontend/src/app/compare/pdf-ai/PdfaiContent.tsx:181:        <EdFaqList items={faqItems} />
frontend/src/app/compare/pdf-ai/PdfaiContent.tsx:196:      <EdCtaBanner
frontend/src/app/use-cases/healthcare/HealthcareContent.tsx:155:        <EdCardGrid
frontend/src/app/use-cases/healthcare/HealthcareContent.tsx:165:        <EdCardGrid
frontend/src/app/use-cases/healthcare/HealthcareContent.tsx:231:        <EdFaqList items={faqItems} />
frontend/src/app/use-cases/healthcare/HealthcareContent.tsx:234:      <EdCtaBanner
frontend/src/app/compare/CompareHubContent.tsx:61:        <EdCardGrid
frontend/src/app/compare/CompareHubContent.tsx:86:      <EdCtaBanner
frontend/src/app/compare/notebooklm/NotebooklmContent.tsx:74:        <EdComparisonTable features={features} competitorName="NotebookLM" />
frontend/src/app/compare/notebooklm/NotebooklmContent.tsx:189:        <EdFaqList items={faqItems} />
frontend/src/app/compare/notebooklm/NotebooklmContent.tsx:205:      <EdCtaBanner
frontend/src/components/landing/LandingPageContent.tsx:27:      <EditorialHeader />
frontend/src/app/alternatives/askyourpdf/AskyourpdfAltsContent.tsx:81:        <EdComparisonTable features={quickCompare} competitorName="AskYourPDF" />
frontend/src/app/alternatives/askyourpdf/AskyourpdfAltsContent.tsx:213:        <EdFaqList items={faqItems} />
frontend/src/app/alternatives/askyourpdf/AskyourpdfAltsContent.tsx:231:      <EdCtaBanner
frontend/src/app/compare/chatpdf/ChatpdfContent.tsx:74:        <EdComparisonTable features={features} competitorName="ChatPDF" />
frontend/src/app/compare/chatpdf/ChatpdfContent.tsx:192:        <EdFaqList items={faqItems} />
frontend/src/app/compare/chatpdf/ChatpdfContent.tsx:209:      <EdCtaBanner

exec
/bin/zsh -lc "git diff -U0 782f8b0..HEAD -- frontend/src | sed -n '1,2200p'" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
diff --git a/frontend/src/app/demo/DemoPageClient.tsx b/frontend/src/app/demo/DemoPageClient.tsx
index c7be17b..6754f59 100644
--- a/frontend/src/app/demo/DemoPageClient.tsx
+++ b/frontend/src/app/demo/DemoPageClient.tsx
@@ -126 +126 @@ export default function DemoPageClient() {
-              <span className="ed-body" style={{ color: 'var(--ed-ochre)' }}>
+              <span className="ed-body" style={{ color: 'var(--ed-signal-deep)' }}>
@@ -238 +238 @@ export default function DemoPageClient() {
-                      fontFamily: 'var(--font-inter), sans-serif',
+                      fontFamily: 'var(--font-plex-sans), sans-serif',
diff --git a/frontend/src/app/editorial.css b/frontend/src/app/editorial.css
index 5a0ad30..101a60f 100644
--- a/frontend/src/app/editorial.css
+++ b/frontend/src/app/editorial.css
@@ -4,9 +4,27 @@
-  --ed-paper: #f3eee1;
-  --ed-paper-2: #e9e1cf;
-  --ed-ink: #1c1b19;
-  --ed-ink-2: #48443b;
-  --ed-ink-3: #6e6860;
-  --ed-signal: #b0472f;
-  --ed-signal-deep: #8f3a26;
-  --ed-ochre: #c08a3e;
-  --ed-rule: #d3c9b3;
+  /* Counterpoint palette (2026-08-04 redesign). Two accents, not one:
+     rust = action (primary CTA, brand mark, feature eyebrows), slate =
+     structure (links, secondary CTA, quote borders, nav hover, decorative
+     set-dressing), olive = verified/positive state ONLY. */
+  --ed-paper: #eae8e3;
+  --ed-paper-2: #e4e2db;
+  --ed-ink: #20211e;
+  --ed-ink-2: #5b5a52;
+  --ed-ink-3: #8a897f;
+  --ed-signal: #a04b34;
+  --ed-signal-deep: #843c28;
+  --ed-slate: #1f3a4d;
+  --ed-slate-2: #2f556b;
+  --ed-olive: #3f6a34;
+  --ed-rule: rgba(32, 33, 30, 0.12);
+
+  /* Glass material tokens (warm, Ocean v5 recipe — spec §2.3). Consumed by
+     the .ed-glass utility classes below; never reference these directly
+     from a component's inline style (fallbacks require @media, which
+     inline styles cannot express). */
+  --ed-glass: rgba(250, 249, 246, 0.55);
+  --ed-glass-strong: rgba(251, 250, 247, 0.85);
+  --ed-glass-blur: blur(22px) saturate(150%);
+  --ed-glass-line: rgba(32, 33, 30, 0.12);
+  --ed-glass-hi: inset 0 1px 0 rgba(255, 255, 255, 0.82);
+  --ed-glass-shadow: 0 18px 44px -18px rgba(30, 25, 20, 0.32);
+  --ed-radius: 22px;
@@ -20,0 +39,17 @@
+/* Counter the app-surface reset at globals.css:819-826:
+     `.dt-stitch-root > .min-h-screen { background: transparent !important }`
+   MarketingShell's root is `.dt-editorial min-h-screen flex flex-col` and a
+   direct child of `.dt-stitch-root`, so that (0,2,0) !important rule beat the
+   paper background above and every MarketingShell page — i.e. the whole
+   marketing surface except the landing page, whose root has no `min-h-screen`
+   — rendered on the app's near-white body instead of --ed-paper. The glass
+   material is tuned to sit on paper, so without this it reads washed out.
+   (0,3,0) + !important wins outright regardless of file order; the second
+   selector keeps it working if MarketingShell ever drops `min-h-screen`.
+   Do NOT "clean this up" as a redundant duplicate of line 33 — it is not.
+   Remove it only together with the globals.css rule it counters. */
+.dt-stitch-root > .dt-editorial.min-h-screen,
+.dt-stitch-root > .dt-editorial {
+  background: var(--ed-paper) !important;
+}
+
@@ -33,0 +69,21 @@
+/* Ambient canvas — restrained, asymmetric static gradients so glass has
+   something to blur. Static gradients only (not filter:blur) for zero
+   scroll repaint (spec §3). Sits above the paper-grain ::before, below
+   real content (z-index 1, set above). */
+.dt-editorial::after {
+  content: "";
+  position: absolute;
+  inset: 0;
+  z-index: 0;
+  pointer-events: none;
+  background:
+    radial-gradient(680px 480px at 14% 0%, rgba(160, 75, 52, 0.10), transparent 60%),
+    radial-gradient(560px 420px at 92% 38%, rgba(31, 58, 77, 0.07), transparent 65%);
+}
+@media (prefers-reduced-transparency: reduce) {
+  .dt-editorial::after { display: none; }
+}
+@media print {
+  .dt-editorial::after { display: none; }
+}
+
@@ -58 +114 @@
-  font-weight: 800;
+  font-weight: 700;
@@ -131 +187 @@
-  font-family: var(--font-inter), sans-serif;
+  font-family: var(--font-plex-sans), sans-serif;
@@ -244,0 +301,4 @@
+.dt-editorial a.ed-card.ed-glass:hover {
+  background: var(--ed-glass-strong);
+  border-color: rgba(31, 58, 77, 0.28);
+}
@@ -270,0 +331,83 @@
+/* ─── Liquid Glass utility classes (spec §2.3, §4.1) ───────────────────
+   Glass is chrome, not content: apply only to nav, cards, popovers, CTA
+   panels, FAQ/comparison containers, hero art. NEVER to EdProse/article
+   body/EdSection text or anything rendering real document/quote text.
+   backdrop-filter appears exactly once below (the .ed-glass base) with
+   its two required fallbacks directly underneath — do not add
+   backdrop-filter anywhere else in this file without both. Source order
+   matters: this block is appended AFTER .ed-card so `.ed-card.ed-glass`
+   (Task 5) resolves background/border to the glass values. */
+.dt-editorial .ed-glass,
+.dt-editorial.ed-glass {
+  background: var(--ed-glass);
+  backdrop-filter: var(--ed-glass-blur);
+  -webkit-backdrop-filter: var(--ed-glass-blur);
+  border: 1px solid var(--ed-glass-line);
+  border-radius: var(--ed-radius);
+  box-shadow: var(--ed-glass-hi), var(--ed-glass-shadow);
+}
+.dt-editorial .ed-glass--strong,
+.dt-editorial.ed-glass--strong {
+  background: var(--ed-glass-strong);
+}
+.dt-editorial .ed-glass--header,
+.dt-editorial.ed-glass--header {
+  border-radius: 0;
+  border-width: 0 0 1px 0;
+}
+/* The May-19 `.dt-editorial > *` rule (line 50) is (0,1,0) specificity —
+   identical to Tailwind's `.sticky`/`.z-50` utilities — so it silently wins
+   the position/z-index tie and flattens the masthead to `position: relative`.
+   This selector is (0,2,1), so it wins outright regardless of source order,
+   without touching the May-19 rule (still needed for every other direct
+   child's stacking against the ambient ::before/::after layers). z-index 50
+   matches the header's own `z-50` Tailwind class. */
+.dt-editorial > header.ed-glass--header {
+  position: sticky;
+  top: 0;
+  z-index: 50;
+}
+.dt-editorial .ed-glass--cta,
+.dt-editorial.ed-glass--cta {
+  border-radius: 0;
+  border-width: 1px 0 0 0;
+}
+.dt-editorial .ed-glass--popover,
+.dt-editorial.ed-glass--popover {
+  box-shadow: var(--ed-glass-hi), 0 14px 36px rgba(40, 33, 24, 0.24);
+}
+@media (prefers-reduced-transparency: reduce) {
+  .dt-editorial .ed-glass,
+  .dt-editorial.ed-glass {
+    background: var(--ed-paper-2);
+    backdrop-filter: none;
+    -webkit-backdrop-filter: none;
+  }
+  .dt-editorial a.ed-card.ed-glass:hover {
+    background: var(--ed-paper);
+    border-color: var(--ed-ink-3);
+  }
+}
+@media print {
+  .dt-editorial .ed-glass,
+  .dt-editorial.ed-glass {
+    background: var(--ed-paper-2);
+    backdrop-filter: none;
+    -webkit-backdrop-filter: none;
+    box-shadow: none;
+    border-color: var(--ed-rule);
+  }
+  .dt-editorial a.ed-card.ed-glass:hover {
+    background: var(--ed-paper-2);
+    border-color: var(--ed-rule);
+    box-shadow: none;
+  }
+  /* A sticky masthead prints at its stuck offset, so a page printed while
+     scrolled paints the header across the middle of the content (it landed
+     inside the comparison table during Task 10's print check). Static in
+     print puts it back at the top of the first page. */
+  .dt-editorial > header.ed-glass--header {
+    position: static;
+  }
+}
+
diff --git a/frontend/src/app/globals.css b/frontend/src/app/globals.css
index 04a135c..0e174f8 100644
--- a/frontend/src/app/globals.css
+++ b/frontend/src/app/globals.css
@@ -7 +7 @@
-   Latin keeps the loaded webfonts (Inter / Newsreader / IBM Plex Mono).
+   Latin keeps the loaded webfonts (IBM Plex Sans / Fraunces / IBM Plex Mono).
@@ -17 +17 @@
-  --dt-serif: var(--font-newsreader), Georgia, serif;          /* editorial headlines (Latin serif) */
+  --dt-serif: var(--font-fraunces), Georgia, serif;            /* editorial headlines (Latin serif) */
@@ -19 +19 @@
-  --dt-body:  var(--font-inter), system-ui, sans-serif;        /* body / app UI */
+  --dt-body:  var(--font-plex-sans), system-ui, sans-serif;    /* body / app UI */
@@ -22 +22 @@ html:lang(zh) {
-  --dt-serif: var(--font-inter), "PingFang SC", "HarmonyOS Sans SC", "Microsoft YaHei", "Noto Sans SC", sans-serif;
+  --dt-serif: var(--font-plex-sans), "PingFang SC", "HarmonyOS Sans SC", "Microsoft YaHei", "Noto Sans SC", sans-serif;
@@ -24 +24 @@ html:lang(zh) {
-  --dt-body:  var(--font-inter), "PingFang SC", "HarmonyOS Sans SC", "Microsoft YaHei", "Noto Sans SC", system-ui, sans-serif;
+  --dt-body:  var(--font-plex-sans), "PingFang SC", "HarmonyOS Sans SC", "Microsoft YaHei", "Noto Sans SC", system-ui, sans-serif;
@@ -27 +27 @@ html:lang(ja) {
-  --dt-serif: var(--font-inter), "Hiragino Sans", "Hiragino Kaku Gothic ProN", "Yu Gothic", "Meiryo", "Noto Sans JP", sans-serif;
+  --dt-serif: var(--font-plex-sans), "Hiragino Sans", "Hiragino Kaku Gothic ProN", "Yu Gothic", "Meiryo", "Noto Sans JP", sans-serif;
@@ -29 +29 @@ html:lang(ja) {
-  --dt-body:  var(--font-inter), "Hiragino Sans", "Hiragino Kaku Gothic ProN", "Yu Gothic", "Meiryo", "Noto Sans JP", system-ui, sans-serif;
+  --dt-body:  var(--font-plex-sans), "Hiragino Sans", "Hiragino Kaku Gothic ProN", "Yu Gothic", "Meiryo", "Noto Sans JP", system-ui, sans-serif;
@@ -32 +32 @@ html:lang(ko) {
-  --dt-serif: var(--font-inter), "Apple SD Gothic Neo", "Malgun Gothic", "Noto Sans KR", sans-serif;
+  --dt-serif: var(--font-plex-sans), "Apple SD Gothic Neo", "Malgun Gothic", "Noto Sans KR", sans-serif;
@@ -34 +34 @@ html:lang(ko) {
-  --dt-body:  var(--font-inter), "Apple SD Gothic Neo", "Malgun Gothic", "Noto Sans KR", system-ui, sans-serif;
+  --dt-body:  var(--font-plex-sans), "Apple SD Gothic Neo", "Malgun Gothic", "Noto Sans KR", system-ui, sans-serif;
@@ -37 +37 @@ html:lang(ar) {
-  --dt-serif: var(--font-inter), "SF Arabic", "Geeza Pro", "Segoe UI", "Noto Naskh Arabic", "Tahoma", sans-serif;
+  --dt-serif: var(--font-plex-sans), "SF Arabic", "Geeza Pro", "Segoe UI", "Noto Naskh Arabic", "Tahoma", sans-serif;
@@ -39 +39 @@ html:lang(ar) {
-  --dt-body:  var(--font-inter), "SF Arabic", "Geeza Pro", "Segoe UI", "Noto Naskh Arabic", "Tahoma", system-ui, sans-serif;
+  --dt-body:  var(--font-plex-sans), "SF Arabic", "Geeza Pro", "Segoe UI", "Noto Naskh Arabic", "Tahoma", system-ui, sans-serif;
@@ -42 +42 @@ html:lang(hi) {
-  --dt-serif: var(--font-inter), "Kohinoor Devanagari", "Noto Sans Devanagari", "Nirmala UI", "Mangal", sans-serif;
+  --dt-serif: var(--font-plex-sans), "Kohinoor Devanagari", "Noto Sans Devanagari", "Nirmala UI", "Mangal", sans-serif;
@@ -44 +44 @@ html:lang(hi) {
-  --dt-body:  var(--font-inter), "Kohinoor Devanagari", "Noto Sans Devanagari", "Nirmala UI", "Mangal", system-ui, sans-serif;
+  --dt-body:  var(--font-plex-sans), "Kohinoor Devanagari", "Noto Sans Devanagari", "Nirmala UI", "Mangal", system-ui, sans-serif;
diff --git a/frontend/src/app/layout.tsx b/frontend/src/app/layout.tsx
index 53e4c1c..35ab72f 100644
--- a/frontend/src/app/layout.tsx
+++ b/frontend/src/app/layout.tsx
@@ -2 +2 @@ import type { Metadata } from 'next'
-import { Inter, Sora, Newsreader, IBM_Plex_Mono } from 'next/font/google'
+import { IBM_Plex_Sans, Sora, Fraunces, IBM_Plex_Mono } from 'next/font/google'
@@ -14 +14,6 @@ import { CookieConsentBanner } from '../components/CookieConsentBanner'
-const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' })
+const plexSans = IBM_Plex_Sans({
+  subsets: ['latin'],
+  weight: ['400', '500', '600', '700'],
+  variable: '--font-plex-sans',
+  display: 'swap',
+})
@@ -22 +27 @@ const sora = Sora({
-const newsreader = Newsreader({
+const fraunces = Fraunces({
@@ -24,2 +29,3 @@ const newsreader = Newsreader({
-  weight: ['400', '500', '600'],
-  variable: '--font-newsreader',
+  style: ['normal', 'italic'],
+  axes: ['opsz', 'SOFT'],
+  variable: '--font-fraunces',
@@ -78 +84 @@ export default function RootLayout({
-    <html lang="en" suppressHydrationWarning className={`${inter.variable} ${sora.variable} ${newsreader.variable} ${plexMono.variable}`}>
+    <html lang="en" suppressHydrationWarning className={`${plexSans.variable} ${sora.variable} ${fraunces.variable} ${plexMono.variable}`}>
diff --git a/frontend/src/app/shared/[token]/page.tsx b/frontend/src/app/shared/[token]/page.tsx
index ded7867..0cbaf55 100644
--- a/frontend/src/app/shared/[token]/page.tsx
+++ b/frontend/src/app/shared/[token]/page.tsx
@@ -4,0 +5 @@ import type { Metadata } from 'next';
+import MarketingShell from '../../../components/marketing/MarketingShell';
@@ -75,4 +76,6 @@ export default async function SharedPage({ params }: { params: Promise<{ token:
-    <div className="min-h-screen bg-white dark:bg-zinc-950">
-      <div className="max-w-3xl mx-auto px-4 py-8">
-        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 mb-1">{data.session_title}</h1>
-        <p className="text-sm text-zinc-500 mb-6">Document: {data.document_name}</p>
+    <MarketingShell>
+      <div className="ed-shell" style={{ maxWidth: '760px', paddingTop: '48px', paddingBottom: '64px' }}>
+        <h1 className="ed-h1">{data.session_title}</h1>
+        <p className="ed-caption" style={{ marginTop: '8px', marginBottom: '32px' }}>
+          Document: {data.document_name}
+        </p>
@@ -80 +83 @@ export default async function SharedPage({ params }: { params: Promise<{ token:
-        <div className="space-y-4">
+        <div className="flex flex-col" style={{ gap: '16px' }}>
@@ -85,3 +88,2 @@ export default async function SharedPage({ params }: { params: Promise<{ token:
-              className={`scroll-mt-6 rounded-2xl transition-[background-color,box-shadow] target:bg-blue-50 target:ring-2 target:ring-blue-300 target:ring-offset-4 target:ring-offset-white dark:target:bg-blue-950/30 dark:target:ring-blue-700 dark:target:ring-offset-zinc-950 ${
-                msg.role === 'user' ? 'flex justify-end' : ''
-              }`}
+              className={`scroll-mt-6 target:bg-[var(--ed-paper-2)] ${msg.role === 'user' ? 'flex justify-end' : ''}`}
+              style={{ transition: 'background-color 300ms ease' }}
@@ -89,6 +91,12 @@ export default async function SharedPage({ params }: { params: Promise<{ token:
-              <div className={`max-w-[85%] rounded-xl px-4 py-3 ${
-                msg.role === 'user'
-                  ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
-                  : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100'
-              }`}>
-                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
+              <div
+                className="ed-card"
+                style={{
+                  maxWidth: '85%',
+                  ...(msg.role === 'user'
+                    ? { background: 'var(--ed-ink)', color: '#ffffff', border: '1px solid var(--ed-ink)' }
+                    : {}),
+                }}
+              >
+                <p className="ed-body" style={msg.role === 'user' ? { color: '#ffffff' } : undefined}>
+                  {msg.content}
+                </p>
@@ -96 +104 @@ export default async function SharedPage({ params }: { params: Promise<{ token:
-                  <div className="mt-2 space-y-1">
+                  <div className="flex flex-col" style={{ marginTop: '10px', gap: '6px' }}>
@@ -98 +106,11 @@ export default async function SharedPage({ params }: { params: Promise<{ token:
-                      <div key={j} className="text-xs text-zinc-500 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-700 rounded px-2 py-1">
+                      <div
+                        key={j}
+                        className="ed-caption"
+                        style={{
+                          border: '1px solid var(--ed-rule)',
+                          background: 'var(--ed-paper-2)',
+                          padding: '4px 8px',
+                          borderRadius: '3px',
+                          color: 'var(--ed-ink-2)',
+                        }}
+                      >
@@ -109,6 +127,3 @@ export default async function SharedPage({ params }: { params: Promise<{ token:
-        <div className="mt-12 text-center border-t border-zinc-200 dark:border-zinc-800 pt-6">
-          <p className="text-sm text-zinc-500 mb-3">Powered by DocTalk</p>
-          <a
-            href="https://www.doctalk.site"
-            className="inline-block px-6 py-2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
-          >
+        <div style={{ marginTop: '48px', textAlign: 'center', borderTop: '1px solid var(--ed-rule)', paddingTop: '24px' }}>
+          <p className="ed-caption" style={{ marginBottom: '12px' }}>Powered by DocTalk</p>
+          <a href="https://www.doctalk.site" className="ed-cta">
@@ -119 +134 @@ export default async function SharedPage({ params }: { params: Promise<{ token:
-    </div>
+    </MarketingShell>
diff --git a/frontend/src/app/tools/reading-time/ReadingTimeClient.tsx b/frontend/src/app/tools/reading-time/ReadingTimeClient.tsx
index e181a2f..bae67b6 100644
--- a/frontend/src/app/tools/reading-time/ReadingTimeClient.tsx
+++ b/frontend/src/app/tools/reading-time/ReadingTimeClient.tsx
@@ -298 +298 @@ export default function ReadingTimeClient() {
-                          background: 'var(--ed-ochre)',
+                          background: 'var(--ed-slate-2)',
diff --git a/frontend/src/app/trust/TrustPageContent.tsx b/frontend/src/app/trust/TrustPageContent.tsx
index 9003614..cb139cc 100644
--- a/frontend/src/app/trust/TrustPageContent.tsx
+++ b/frontend/src/app/trust/TrustPageContent.tsx
@@ -211 +211 @@ export default async function TrustPageContent({ locale }: { locale: string }) {
-            color: "var(--ed-ochre)",
+            color: "var(--ed-signal-deep)",
@@ -277 +277 @@ export default async function TrustPageContent({ locale }: { locale: string }) {
-                    color: "var(--ed-ochre)",
+                    color: "var(--ed-slate)",
@@ -285 +285 @@ export default async function TrustPageContent({ locale }: { locale: string }) {
-                      background: "var(--ed-ochre)",
+                      background: "var(--ed-slate)",
diff --git a/frontend/src/components/Diff/DocumentDiffPanel.tsx b/frontend/src/components/Diff/DocumentDiffPanel.tsx
index a95eaaf..42bbefc 100644
--- a/frontend/src/components/Diff/DocumentDiffPanel.tsx
+++ b/frontend/src/components/Diff/DocumentDiffPanel.tsx
@@ -408 +408 @@ export default function DocumentDiffPanel({
-                border: "1px solid var(--ed-ochre)",
+                border: "1px solid var(--ed-slate)",
@@ -455 +455 @@ export default function DocumentDiffPanel({
-                    <Clock3 size={16} style={{ color: "var(--ed-ochre)" }} aria-hidden="true" />
+                    <Clock3 size={16} style={{ color: "var(--ed-slate)" }} aria-hidden="true" />
diff --git a/frontend/src/components/landing/FeatureGrid.tsx b/frontend/src/components/landing/FeatureGrid.tsx
index 2477ca3..b19eafc 100644
--- a/frontend/src/components/landing/FeatureGrid.tsx
+++ b/frontend/src/components/landing/FeatureGrid.tsx
@@ -29 +29 @@ function VisualCitations() {
-            <div className="h-1.5 w-full bg-[var(--ed-signal)]/20 border-l-2 border-[var(--ed-signal)]" />
+            <div className="h-1.5 w-full bg-[var(--ed-signal)]/20 border-l-2 border-[var(--ed-slate)]" />
@@ -40 +40 @@ function VisualCitations() {
-            <span className="mr-1 inline-flex items-center justify-center bg-[var(--ed-signal)] px-1 py-0.5 text-[8px] font-bold leading-none text-white">
+            <span className="mr-1 inline-flex items-center justify-center bg-[var(--ed-olive)] px-1 py-0.5 text-[8px] font-bold leading-none text-white">
diff --git a/frontend/src/components/landing/HeroCollage.tsx b/frontend/src/components/landing/HeroCollage.tsx
index 43a250b..7c1a1db 100644
--- a/frontend/src/components/landing/HeroCollage.tsx
+++ b/frontend/src/components/landing/HeroCollage.tsx
@@ -7,2 +7,4 @@ import { useLocale } from '../../i18n';
- * Pure HTML/CSS/SVG, warm editorial palette only. No external images.
- * No glassmorphism, no gradient mesh, no UI mock. Aria-hidden decorative.
+ * Pure HTML/CSS/SVG, warm editorial palette only. No external images, no
+ * gradient mesh, no UI mock. Aria-hidden decorative. The two stacked
+ * document plates use .ed-glass (spec §4.1 "hero cards") — this is the
+ * one deliberate glassmorphism use in this file.
@@ -24 +26 @@ export default function HeroCollage() {
-        {/* ── Background ochre rectangle — large vertical stripe ── */}
+        {/* ── Background slate rectangle — large vertical stripe ── */}
@@ -32 +34 @@ export default function HeroCollage() {
-            background: "var(--ed-ochre)",
+            background: "var(--ed-slate)",
@@ -86 +88 @@ export default function HeroCollage() {
-            color: "var(--ed-ochre)",
+            color: "var(--ed-slate)",
@@ -110,0 +113 @@ export default function HeroCollage() {
+          className="ed-glass"
@@ -116,3 +118,0 @@ export default function HeroCollage() {
-            background: "var(--ed-paper)",
-            border: "1px solid var(--ed-rule)",
-            borderRadius: "2px",
@@ -121,2 +120,0 @@ export default function HeroCollage() {
-            boxShadow:
-              "0 4px 18px 0 rgba(28,27,25,0.10), 0 1px 3px 0 rgba(28,27,25,0.07)",
@@ -185 +183 @@ export default function HeroCollage() {
-            {/* Amber/signal highlight band */}
+            {/* Slate highlight band — quote-highlight rule (structure) */}
@@ -190 +188 @@ export default function HeroCollage() {
-                background: "var(--ed-ochre)",
+                background: "var(--ed-slate)",
@@ -205 +203 @@ export default function HeroCollage() {
-            {/* Terracotta margin citation marker */}
+            {/* Olive margin citation marker — verified badge */}
@@ -214 +212 @@ export default function HeroCollage() {
-                background: "var(--ed-signal)",
+                background: "var(--ed-olive)",
@@ -269 +267 @@ export default function HeroCollage() {
-            {/* Badge */}
+            {/* Badge — verified citation, olive */}
@@ -277 +275 @@ export default function HeroCollage() {
-                background: "var(--ed-signal)",
+                background: "var(--ed-olive)",
@@ -321,0 +320 @@ export default function HeroCollage() {
+          className="ed-glass"
@@ -328,3 +326,0 @@ export default function HeroCollage() {
-            background: "var(--ed-paper-2)",
-            border: "1px solid var(--ed-rule)",
-            borderRadius: "2px",
diff --git a/frontend/src/components/marketing/EdCardGrid.tsx b/frontend/src/components/marketing/EdCardGrid.tsx
index afa6e55..97295d0 100644
--- a/frontend/src/components/marketing/EdCardGrid.tsx
+++ b/frontend/src/components/marketing/EdCardGrid.tsx
@@ -53 +53 @@ export default function EdCardGrid({ items, columns = 3 }: EdCardGridProps) {
-            className="ed-card h-full"
+            className="ed-card ed-glass h-full"
@@ -61 +61 @@ export default function EdCardGrid({ items, columns = 3 }: EdCardGridProps) {
-            className="ed-card h-full"
+            className="ed-card ed-glass h-full"
diff --git a/frontend/src/components/marketing/EdComparisonTable.tsx b/frontend/src/components/marketing/EdComparisonTable.tsx
index 13cfa23..7b44a5e 100644
--- a/frontend/src/components/marketing/EdComparisonTable.tsx
+++ b/frontend/src/components/marketing/EdComparisonTable.tsx
@@ -107,43 +107,11 @@ export default function EdComparisonTable(props: EdComparisonTableProps) {
-    <div style={{ overflowX: "auto" }}>
-      <table
-        style={{
-          width: "100%",
-          borderCollapse: "collapse",
-          minWidth: competitorCount > 1 ? "600px" : "480px",
-          border: "1px solid var(--ed-rule)",
-        }}
-      >
-        <thead>
-          <tr style={{ borderBottom: "1px solid var(--ed-rule)" }}>
-            <th
-              scope="col"
-              className="ed-label"
-              style={{
-                width: featureColWidth,
-                padding: "14px 18px",
-                textAlign: "left",
-              }}
-            >
-              {featureHeader}
-            </th>
-            <th
-              scope="col"
-              className="ed-label"
-              style={{
-                ...headStyle,
-                background: "var(--ed-paper-2)",
-                color: "var(--ed-signal)",
-              }}
-            >
-              DocTalk
-            </th>
-            {competitorHeaders.map((name, i) => (
-              <th key={`${name}-${i}`} scope="col" className="ed-label" style={headStyle}>
-                {name}
-              </th>
-            ))}
-          </tr>
-        </thead>
-        <tbody>
-          {rows.map((feature, i) => (
-            <tr key={i} style={{ borderTop: "1px solid var(--ed-rule)" }}>
+    <div className="ed-glass" style={{ padding: "4px", overflow: "hidden" }}>
+      <div style={{ overflowX: "auto" }}>
+        <table
+          style={{
+            width: "100%",
+            borderCollapse: "collapse",
+            minWidth: competitorCount > 1 ? "600px" : "480px",
+          }}
+        >
+          <thead>
+            <tr style={{ borderBottom: "1px solid var(--ed-rule)" }}>
@@ -151,2 +119,2 @@ export default function EdComparisonTable(props: EdComparisonTableProps) {
-                scope="row"
-                className="ed-body"
+                scope="col"
+                className="ed-label"
@@ -154,3 +122,2 @@ export default function EdComparisonTable(props: EdComparisonTableProps) {
-                  padding: "13px 18px",
-                  fontWeight: 500,
-                  color: "var(--ed-ink)",
+                  width: featureColWidth,
+                  padding: "14px 18px",
@@ -160 +127 @@ export default function EdComparisonTable(props: EdComparisonTableProps) {
-                {feature.name}
+                {featureHeader}
@@ -162 +129,3 @@ export default function EdComparisonTable(props: EdComparisonTableProps) {
-              <td
+              <th
+                scope="col"
+                className="ed-label"
@@ -164 +133 @@ export default function EdComparisonTable(props: EdComparisonTableProps) {
-                  ...cellStyle,
+                  ...headStyle,
@@ -165,0 +135 @@ export default function EdComparisonTable(props: EdComparisonTableProps) {
+                  color: "var(--ed-signal)",
@@ -168,6 +138,6 @@ export default function EdComparisonTable(props: EdComparisonTableProps) {
-                <EdInlineCell value={feature.doctalk} />
-              </td>
-              {feature.competitors.map((value, j) => (
-                <td key={j} style={cellStyle}>
-                  <EdInlineCell value={value} />
-                </td>
+                DocTalk
+              </th>
+              {competitorHeaders.map((name, i) => (
+                <th key={`${name}-${i}`} scope="col" className="ed-label" style={headStyle}>
+                  {name}
+                </th>
@@ -176,3 +146,34 @@ export default function EdComparisonTable(props: EdComparisonTableProps) {
-          ))}
-        </tbody>
-      </table>
+          </thead>
+          <tbody>
+            {rows.map((feature, i) => (
+              <tr key={i} style={{ borderTop: "1px solid var(--ed-rule)" }}>
+                <th
+                  scope="row"
+                  className="ed-body"
+                  style={{
+                    padding: "13px 18px",
+                    fontWeight: 500,
+                    color: "var(--ed-ink)",
+                    textAlign: "left",
+                  }}
+                >
+                  {feature.name}
+                </th>
+                <td
+                  style={{
+                    ...cellStyle,
+                    background: "var(--ed-paper-2)",
+                  }}
+                >
+                  <EdInlineCell value={feature.doctalk} />
+                </td>
+                {feature.competitors.map((value, j) => (
+                  <td key={j} style={cellStyle}>
+                    <EdInlineCell value={value} />
+                  </td>
+                ))}
+              </tr>
+            ))}
+          </tbody>
+        </table>
+      </div>
diff --git a/frontend/src/components/marketing/EdCtaBanner.tsx b/frontend/src/components/marketing/EdCtaBanner.tsx
index 584f547..7a46a9f 100644
--- a/frontend/src/components/marketing/EdCtaBanner.tsx
+++ b/frontend/src/components/marketing/EdCtaBanner.tsx
@@ -22,7 +22 @@ export default function EdCtaBanner({
-    <section
-      className="ed-section"
-      style={{
-        background: "var(--ed-paper-2)",
-        borderTop: "1px solid var(--ed-rule)",
-      }}
-    >
+    <section className="ed-section ed-glass ed-glass--cta">
diff --git a/frontend/src/components/marketing/EdFaqList.tsx b/frontend/src/components/marketing/EdFaqList.tsx
index 9b25a8e..513beea 100644
--- a/frontend/src/components/marketing/EdFaqList.tsx
+++ b/frontend/src/components/marketing/EdFaqList.tsx
@@ -29 +29 @@ export default function EdFaqList({ items }: EdFaqListProps) {
-    <div>
+    <div className="ed-glass" style={{ padding: "6px 28px" }}>
@@ -42 +41,0 @@ export default function EdFaqList({ items }: EdFaqListProps) {
-            isLast={index === items.length - 1}
@@ -57 +55,0 @@ interface FaqRowProps {
-  isLast: boolean;
@@ -67 +64,0 @@ function FaqRow({
-  isLast,
@@ -94,2 +91,5 @@ function FaqRow({
-        borderTop: "1px solid var(--ed-rule)",
-        borderBottom: isLast ? "1px solid var(--ed-rule)" : undefined,
+        // Rows divide each other, but the glass panel's own border already
+        // closes the list — drawing an edge rule here too puts a second,
+        // shorter hairline 6px inside the panel edge (the wrapper's vertical
+        // padding), which reads as a stray line rather than a divider.
+        borderTop: index === 0 ? undefined : "1px solid var(--ed-rule)",
diff --git a/frontend/src/components/marketing/EdInlineCell.tsx b/frontend/src/components/marketing/EdInlineCell.tsx
index 59c7014..321fd23 100644
--- a/frontend/src/components/marketing/EdInlineCell.tsx
+++ b/frontend/src/components/marketing/EdInlineCell.tsx
@@ -55 +55 @@ export default function EdInlineCell({ value }: EdInlineCellProps) {
-          color: "var(--ed-ochre)",
+          color: "var(--ed-slate)",
diff --git a/frontend/src/components/marketing/EdLanguageSelector.tsx b/frontend/src/components/marketing/EdLanguageSelector.tsx
index ad70004..25c9cbe 100644
--- a/frontend/src/components/marketing/EdLanguageSelector.tsx
+++ b/frontend/src/components/marketing/EdLanguageSelector.tsx
@@ -132 +132 @@ export default function EdLanguageSelector({ languageLabel }: { languageLabel?:
-      className="dt-editorial"
+      className="dt-editorial ed-glass ed-glass--strong ed-glass--popover"
@@ -141,3 +140,0 @@ export default function EdLanguageSelector({ languageLabel }: { languageLabel?:
-        background: "var(--ed-paper)",
-        border: "1px solid var(--ed-rule)",
-        boxShadow: "0 14px 36px rgba(40, 33, 24, 0.20)",
diff --git a/frontend/src/components/marketing/EditorialHeaderBase.tsx b/frontend/src/components/marketing/EditorialHeaderBase.tsx
index 5a4c93e..63182b2 100644
--- a/frontend/src/components/marketing/EditorialHeaderBase.tsx
+++ b/frontend/src/components/marketing/EditorialHeaderBase.tsx
@@ -63,5 +63 @@ export default function EditorialHeaderBase({
-        className="sticky top-0 z-50 h-16 flex items-center"
-        style={{
-          background: "var(--ed-paper)",
-          borderBottom: "1px solid var(--ed-rule)",
-        }}
+        className="sticky top-0 z-50 h-16 flex items-center ed-glass ed-glass--strong ed-glass--header"

exec
/bin/zsh -lc "git diff -U0 782f8b0..HEAD -- frontend/src | rg -n '"'^[+-].*(>[''^<{]*[A-Za-z][''^<{]*<|["'"'\\''][A-Za-z][A-Za-z ]{3,}[\"'\\''])' | sed -n '1,500p'" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
63:+   Do NOT "clean this up" as a redundant duplicate of line 33 — it is not.
201:-  --dt-serif: var(--font-inter), "PingFang SC", "HarmonyOS Sans SC", "Microsoft YaHei", "Noto Sans SC", sans-serif;
202:+  --dt-serif: var(--font-plex-sans), "PingFang SC", "HarmonyOS Sans SC", "Microsoft YaHei", "Noto Sans SC", sans-serif;
204:-  --dt-body:  var(--font-inter), "PingFang SC", "HarmonyOS Sans SC", "Microsoft YaHei", "Noto Sans SC", system-ui, sans-serif;
205:+  --dt-body:  var(--font-plex-sans), "PingFang SC", "HarmonyOS Sans SC", "Microsoft YaHei", "Noto Sans SC", system-ui, sans-serif;
207:-  --dt-serif: var(--font-inter), "Hiragino Sans", "Hiragino Kaku Gothic ProN", "Yu Gothic", "Meiryo", "Noto Sans JP", sans-serif;
208:+  --dt-serif: var(--font-plex-sans), "Hiragino Sans", "Hiragino Kaku Gothic ProN", "Yu Gothic", "Meiryo", "Noto Sans JP", sans-serif;
210:-  --dt-body:  var(--font-inter), "Hiragino Sans", "Hiragino Kaku Gothic ProN", "Yu Gothic", "Meiryo", "Noto Sans JP", system-ui, sans-serif;
211:+  --dt-body:  var(--font-plex-sans), "Hiragino Sans", "Hiragino Kaku Gothic ProN", "Yu Gothic", "Meiryo", "Noto Sans JP", system-ui, sans-serif;
213:-  --dt-serif: var(--font-inter), "Apple SD Gothic Neo", "Malgun Gothic", "Noto Sans KR", sans-serif;
214:+  --dt-serif: var(--font-plex-sans), "Apple SD Gothic Neo", "Malgun Gothic", "Noto Sans KR", sans-serif;
216:-  --dt-body:  var(--font-inter), "Apple SD Gothic Neo", "Malgun Gothic", "Noto Sans KR", system-ui, sans-serif;
217:+  --dt-body:  var(--font-plex-sans), "Apple SD Gothic Neo", "Malgun Gothic", "Noto Sans KR", system-ui, sans-serif;
219:-  --dt-serif: var(--font-inter), "SF Arabic", "Geeza Pro", "Segoe UI", "Noto Naskh Arabic", "Tahoma", sans-serif;
220:+  --dt-serif: var(--font-plex-sans), "SF Arabic", "Geeza Pro", "Segoe UI", "Noto Naskh Arabic", "Tahoma", sans-serif;
222:-  --dt-body:  var(--font-inter), "SF Arabic", "Geeza Pro", "Segoe UI", "Noto Naskh Arabic", "Tahoma", system-ui, sans-serif;
223:+  --dt-body:  var(--font-plex-sans), "SF Arabic", "Geeza Pro", "Segoe UI", "Noto Naskh Arabic", "Tahoma", system-ui, sans-serif;
225:-  --dt-serif: var(--font-inter), "Kohinoor Devanagari", "Noto Sans Devanagari", "Nirmala UI", "Mangal", sans-serif;
226:+  --dt-serif: var(--font-plex-sans), "Kohinoor Devanagari", "Noto Sans Devanagari", "Nirmala UI", "Mangal", sans-serif;
228:-  --dt-body:  var(--font-inter), "Kohinoor Devanagari", "Noto Sans Devanagari", "Nirmala UI", "Mangal", system-ui, sans-serif;
229:+  --dt-body:  var(--font-plex-sans), "Kohinoor Devanagari", "Noto Sans Devanagari", "Nirmala UI", "Mangal", system-ui, sans-serif;
238:-const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' })
240:+  subsets: ['latin'],
243:+  display: 'swap',
251:+  style: ['normal', 'italic'],
252:+  axes: ['opsz', 'SOFT'],
279:-                msg.role === 'user' ? 'flex justify-end' : ''
281:+              className={`scroll-mt-6 target:bg-[var(--ed-paper-2)] ${msg.role === 'user' ? 'flex justify-end' : ''}`}
285:-                msg.role === 'user'
294:+                  ...(msg.role === 'user'
299:+                <p className="ed-body" style={msg.role === 'user' ? { color: '#ffffff' } : undefined}>
320:-          <p className="text-sm text-zinc-500 mb-3">Powered by DocTalk</p>
325:+        <div style={{ marginTop: '48px', textAlign: 'center', borderTop: '1px solid var(--ed-rule)', paddingTop: '24px' }}>
326:+          <p className="ed-caption" style={{ marginBottom: '12px' }}>Powered by DocTalk</p>
359:-                    <Clock3 size={16} style={{ color: "var(--ed-ochre)" }} aria-hidden="true" />
360:+                    <Clock3 size={16} style={{ color: "var(--ed-slate)" }} aria-hidden="true" />
380:+ * document plates use .ed-glass (spec §4.1 "hero cards") — this is the
439:-    <div style={{ overflowX: "auto" }}>
443:-          borderCollapse: "collapse",
456:-                textAlign: "left",
482:+    <div className="ed-glass" style={{ padding: "4px", overflow: "hidden" }}>
483:+      <div style={{ overflowX: "auto" }}>
487:+            borderCollapse: "collapse",
545:+                    textAlign: "left",

exec
/bin/zsh -lc "rg -n 'whitespace-(pre|pre-wrap|pre-line)|whiteSpace' frontend/src/app/shared frontend/src/components/marketing frontend/src/app/editorial.css && git grep -n 'whitespace-pre-wrap' 782f8b0 -- 'frontend/src/app/shared/[token]/page.tsx'" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
frontend/src/components/marketing/EdChoiceList.tsx:40:            style={{ whiteSpace: "nowrap" }}
782f8b0:frontend/src/app/shared/[token]/page.tsx:94:                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>

codex
For the runtime phase I’m using the `playwright-interactive` skill because this review hinges on browser-computed CSS/media behavior and rendered text semantics, not just source inspection. I’ll use it narrowly to reproduce the suspected shared-transcript formatting loss and spot-check the highest-risk glass states; the existing Task 10 screenshots remain supporting evidence rather than a substitute for this independent check.
exec
/bin/zsh -lc "wc -l /Users/mayijie/.codex/skills/playwright-interactive/SKILL.md && sed -n '1,260p' /Users/mayijie/.codex/skills/playwright-interactive/SKILL.md" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
     689 /Users/mayijie/.codex/skills/playwright-interactive/SKILL.md
---
name: "playwright-interactive"
description: "Persistent browser and Electron interaction through `js_repl` for fast iterative UI debugging."
---

# Playwright Interactive Skill

Use a persistent `js_repl` Playwright session to debug local web or Electron apps, keep the same handles alive across iterations, and run functional plus visual QA without restarting the whole toolchain unless the process ownership changed.

## Preconditions

- `js_repl` must be enabled for this skill.
- If `js_repl` is missing, enable it in `~/.codex/config.toml`:

```toml
[features]
js_repl = true
```

- You can also start a new session with `--enable js_repl` (equivalent to `-c features.js_repl=true`).
- After enabling `js_repl`, start a new Codex session so the tool list refreshes.
- For now, run this workflow with sandboxing disabled: start Codex with `--sandbox danger-full-access` (or the equivalent config for `sandbox_mode=danger-full-access`). This is a temporary requirement while `js_repl` + Playwright support inside the sandbox is still being completed.
- Run setup from the same project directory you need to debug.
- Treat `js_repl_reset` as a recovery tool, not routine cleanup. Resetting the kernel destroys your Playwright handles.

## One-time setup

```bash
test -f package.json || npm init -y
npm install playwright
# Web-only, for headed Chromium or mobile emulation:
# npx playwright install chromium
# Electron-only, and only if the target workspace is the app itself:
# npm install --save-dev electron
node -e "import('playwright').then(() => console.log('playwright import ok')).catch((error) => { console.error(error); process.exit(1); })"
```

If you switch to a different workspace later, repeat setup there.

## Core Workflow

1. Write a brief QA inventory before testing:
   - Build the inventory from three sources: the user's requested requirements, the user-visible features or behaviors you actually implemented, and the claims you expect to make in the final response.
   - Anything that appears in any of those three sources must map to at least one QA check before signoff.
   - List the user-visible claims you intend to sign off on.
   - List every meaningful user-facing control, mode switch, or implemented interactive behavior.
   - List the state changes or view changes each control or implemented behavior can cause.
   - Use this as the shared coverage list for both functional QA and visual QA.
   - For each claim or control-state pair, note the intended functional check, the specific state where the visual check must happen, and the evidence you expect to capture.
   - If a requirement is visually central but subjective, convert it into an observable QA check instead of leaving it implicit.
   - Add at least 2 exploratory or off-happy-path scenarios that could expose fragile behavior.
2. Run the bootstrap cell once.
3. Start or confirm any required dev server in a persistent TTY session.
4. Launch the correct runtime and keep reusing the same Playwright handles.
5. After each code change, reload for renderer-only changes or relaunch for main-process/startup changes.
6. Run functional QA with normal user input.
7. Run a separate visual QA pass.
8. Verify viewport fit and capture the screenshots needed to support your claims.
9. Clean up the Playwright session only when the task is actually finished.

## Bootstrap (Run Once)

```javascript
var chromium;
var electronLauncher;
var browser;
var context;
var page;
var mobileContext;
var mobilePage;
var electronApp;
var appWindow;

try {
  ({ chromium, _electron: electronLauncher } = await import("playwright"));
  console.log("Playwright loaded");
} catch (error) {
  throw new Error(
    `Could not load playwright from the current js_repl cwd. Run the setup commands from this workspace first. Original error: ${error}`
  );
}
```

Binding rules:

- Use `var` for the shared top-level Playwright handles because later `js_repl` cells reuse them.
- The setup cells below are intentionally short happy paths. If a handle looks stale, set that binding to `undefined` and rerun the cell instead of adding recovery logic everywhere.
- Prefer one named handle per surface you care about (`page`, `mobilePage`, `appWindow`) over repeatedly rediscovering pages from the context.

Shared web helpers:

```javascript
var resetWebHandles = function () {
  context = undefined;
  page = undefined;
  mobileContext = undefined;
  mobilePage = undefined;
};

var ensureWebBrowser = async function () {
  if (browser && !browser.isConnected()) {
    browser = undefined;
    resetWebHandles();
  }

  browser ??= await chromium.launch({ headless: false });
  return browser;
};

var reloadWebContexts = async function () {
  for (const currentContext of [context, mobileContext]) {
    if (!currentContext) continue;
    for (const p of currentContext.pages()) {
      await p.reload({ waitUntil: "domcontentloaded" });
    }
  }
  console.log("Reloaded existing web tabs");
};
```

## Choose Session Mode

For web apps, use an explicit viewport by default and treat native-window mode as a separate validation pass.

- Use an explicit viewport for routine iteration, breakpoint checks, reproducible screenshots, snapshot diffs, and model-assisted localization. This is the default because it is stable across machines and avoids host window-manager variability.
- When you need deterministic high-DPI behavior, keep the explicit viewport and add `deviceScaleFactor` rather than switching straight to native-window mode.
- Use native-window mode (`viewport: null`) for a separate headed pass when you need to validate launched window size, OS-level DPI behavior, browser chrome interactions, or bugs that may depend on the host display configuration.
- For Electron, assume native-window behavior all the time. Electron launches through Playwright with `noDefaultViewport`, so treat it like a real desktop window and check the as-launched size and layout before resizing anything.
- When signoff depends on both layout breakpoints and real desktop behavior, do both passes: explicit viewport first for deterministic QA, then native-window validation for final environment-specific checks.
- Treat switching modes as a context reset. Do not reuse a viewport-emulated `context` for a native-window pass or vice versa; close the old `page` and `context`, then create a new one for the new mode.

## Start or Reuse Web Session

Desktop and mobile web sessions share the same `browser`, helpers, and QA flow. The main difference is which context and page pair you create.

### Desktop Web Context

Set `TARGET_URL` to the app you are debugging. For local servers, prefer `127.0.0.1` over `localhost`.

```javascript
var TARGET_URL = "http://127.0.0.1:3000";

if (page?.isClosed()) page = undefined;

await ensureWebBrowser();
context ??= await browser.newContext({
  viewport: { width: 1600, height: 900 },
});
page ??= await context.newPage();

await page.goto(TARGET_URL, { waitUntil: "domcontentloaded" });
console.log("Loaded:", await page.title());
```

If `context` or `page` is stale, set `context = page = undefined` and rerun the cell.

### Mobile Web Context

Reuse `TARGET_URL` when it already exists; otherwise set a mobile target directly.

```javascript
var MOBILE_TARGET_URL = typeof TARGET_URL === "string"
  ? TARGET_URL
  : "http://127.0.0.1:3000";

if (mobilePage?.isClosed()) mobilePage = undefined;

await ensureWebBrowser();
mobileContext ??= await browser.newContext({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
});
mobilePage ??= await mobileContext.newPage();

await mobilePage.goto(MOBILE_TARGET_URL, { waitUntil: "domcontentloaded" });
console.log("Loaded mobile:", await mobilePage.title());
```

If `mobileContext` or `mobilePage` is stale, set `mobileContext = mobilePage = undefined` and rerun the cell.

### Native-Window Web Pass

```javascript
var TARGET_URL = "http://127.0.0.1:3000";

await ensureWebBrowser();

await page?.close().catch(() => {});
await context?.close().catch(() => {});
page = undefined;
context = undefined;

browser ??= await chromium.launch({ headless: false });
context = await browser.newContext({ viewport: null });
page = await context.newPage();

await page.goto(TARGET_URL, { waitUntil: "domcontentloaded" });
console.log("Loaded native window:", await page.title());
```

## Start or Reuse Electron Session

Set `ELECTRON_ENTRY` to `.` when the current workspace is the Electron app and `package.json` points `main` to the right entry file. If you need to target a specific main-process file directly, use a path such as `./main.js` instead.

```javascript
var ELECTRON_ENTRY = ".";

if (appWindow?.isClosed()) appWindow = undefined;

if (!appWindow && electronApp) {
  await electronApp.close().catch(() => {});
  electronApp = undefined;
}

electronApp ??= await electronLauncher.launch({
  args: [ELECTRON_ENTRY],
});

appWindow ??= await electronApp.firstWindow();

console.log("Loaded Electron window:", await appWindow.title());
```

If `js_repl` is not already running from the Electron app workspace, pass `cwd` explicitly when launching.

If the app process looks stale, set `electronApp = appWindow = undefined` and rerun the cell.

If you already have an Electron session but need a fresh process after a main-process, preload, or startup change, use the restart cell in the next section instead of rerunning this one.

## Reuse Sessions During Iteration

Keep the same session alive whenever you can.

Web renderer reload:

```javascript
await reloadWebContexts();
```

Electron renderer-only reload:

```javascript
await appWindow.reload({ waitUntil: "domcontentloaded" });
console.log("Reloaded Electron window");
```

Electron restart after main-process, preload, or startup changes:

```javascript
await electronApp.close().catch(() => {});
electronApp = undefined;
appWindow = undefined;

electronApp = await electronLauncher.launch({
  args: [ELECTRON_ENTRY],
});

appWindow = await electronApp.firstWindow();
console.log("Relaunched Electron window:", await appWindow.title());

2026-08-04T08:56:09.680308Z ERROR codex_models_manager::manager: failed to renew cache TTL: missing field `supports_reasoning_summaries` at line 86 column 5
exec
/bin/zsh -lc "sed -n '261,560p' /Users/mayijie/.codex/skills/playwright-interactive/SKILL.md && sed -n '561,760p' /Users/mayijie/.codex/skills/playwright-interactive/SKILL.md" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
```

If your launch requires an explicit `cwd`, include the same `cwd` here.

Default posture:

- Keep each `js_repl` cell short and focused on one interaction burst.
- Reuse the existing top-level bindings (`browser`, `context`, `page`, `electronApp`, `appWindow`) instead of redeclaring them.
- If you need isolation, create a new page or a new context inside the same browser.
- For Electron, use `electronApp.evaluate(...)` only for main-process inspection or purpose-built diagnostics.
- Fix helper mistakes in place; do not reset the REPL unless the kernel is actually broken.

## Checklists

### Session Loop

- Bootstrap `js_repl` once, then keep the same Playwright handles alive across iterations.
- Launch the target runtime from the current workspace.
- Make the code change.
- Reload or relaunch using the correct path for that change.
- Update the shared QA inventory if exploration reveals an additional control, state, or visible claim.
- Re-run functional QA.
- Re-run visual QA.
- Capture final artifacts only after the current state is the one you are evaluating.

### Reload Decision

- Renderer-only change: reload the existing page or Electron window.
- Main-process, preload, or startup change: relaunch Electron.
- New uncertainty about process ownership or startup code: relaunch instead of guessing.

### Functional QA

- Use real user controls for signoff: keyboard, mouse, click, touch, or equivalent Playwright input APIs.
- Verify at least one end-to-end critical flow.
- Confirm the visible result of that flow, not just internal state.
- For realtime or animation-heavy apps, verify behavior under actual interaction timing.
- Work through the shared QA inventory rather than ad hoc spot checks.
- Cover every obvious visible control at least once before signoff, not only the main happy path.
- For reversible controls or stateful toggles in the inventory, test the full cycle: initial state, changed state, and return to the initial state.
- After the scripted checks pass, do a short exploratory pass using normal input for 30-90 seconds instead of following only the intended path.
- If the exploratory pass reveals a new state, control, or claim, add it to the shared QA inventory and cover it before signoff.
- `page.evaluate(...)` and `electronApp.evaluate(...)` may inspect or stage state, but they do not count as signoff input.

### Visual QA

- Treat visual QA as separate from functional QA.
- Use the same shared QA inventory defined before testing and updated during QA; do not start visual coverage from a different implicit list.
- Restate the user-visible claims and verify each one explicitly; do not assume a functional pass proves a visual claim.
- A user-visible claim is not signed off until it has been inspected in the specific state where it is meant to be perceived.
- Inspect the initial viewport before scrolling.
- Confirm that the initial view visibly supports the interface's primary claims; if a core promised element is not clearly perceptible there, treat that as a bug.
- Inspect all required visible regions, not just the main interaction surface.
- Inspect the states and modes already enumerated in the shared QA inventory, including at least one meaningful post-interaction state when the task is interactive.
- If motion or transitions are part of the experience, inspect at least one in-transition state in addition to the settled endpoints.
- If labels, overlays, annotations, guides, or highlights are meant to track changing content, verify that relationship after the relevant state change.
- For dynamic or interaction-dependent visuals, inspect long enough to judge stability, layering, and readability; do not rely on a single screenshot for signoff.
- For interfaces that can become denser after loading or interaction, inspect the densest realistic state you can reach during QA, not only the empty, loading, or collapsed state.
- If the product has a defined minimum supported viewport or window size, run a separate visual QA pass there; otherwise, choose a smaller but still realistic size and inspect it explicitly.
- Distinguish presence from implementation: if an intended affordance is technically there but not clearly perceptible because of weak contrast, occlusion, clipping, or instability, treat that as a visual failure.
- If any required visible region is clipped, cut off, obscured, or pushed outside the viewport in the state you are evaluating, treat that as a bug even if page-level scroll metrics appear acceptable.
- Look for clipping, overflow, distortion, layout imbalance, inconsistent spacing, alignment problems, illegible text, weak contrast, broken layering, and awkward motion states.
- Judge aesthetic quality as well as correctness. The UI should feel intentional, coherent, and visually pleasing for the task.
- Prefer viewport screenshots for signoff. Use full-page captures only as secondary debugging artifacts, and capture a focused screenshot when a region needs closer inspection.
- If motion makes a screenshot ambiguous, wait briefly for the UI to settle, then capture the image you are actually evaluating.
- Before signoff, explicitly ask: what visible part of this interface have I not yet inspected closely?
- Before signoff, explicitly ask: what visible defect would most likely embarrass this result if the user looked closely?

### Signoff

- The functional path passed with normal user input.
- Coverage is explicit against the shared QA inventory: note which requirements, implemented features, controls, states, and claims were exercised, and call out any intentional exclusions.
- The visual QA pass covered the whole relevant interface.
- Each user-visible claim has a matching visual check and reviewed screenshot artifact from the state and viewport or window size where that claim matters.
- The viewport-fit checks passed for the intended initial view and any required minimum supported viewport or window size.
- If the product launches in a window, the as-launched size, placement, and initial layout were checked before any manual resize or repositioning.
- The UI is not just functional; it is visually coherent and not aesthetically weak for the task.
- Functional correctness, viewport fit, and visual quality must each pass on their own; one does not imply the others.
- A short exploratory pass was completed for interactive products, and the response mentions what that pass covered.
- If screenshot review and numeric checks disagreed at any point, the discrepancy was investigated before signoff; visible clipping in screenshots is a failure to resolve, not something metrics can overrule.
- Include a brief negative confirmation of the main defect classes you checked for and did not find.
- Cleanup was executed, or you intentionally kept the session alive for further work.

## Screenshot Examples

If you plan to emit a screenshot through `codex.emitImage(...)`, use the CSS-normalized paths in the next section by default. Those are the canonical examples for screenshots that will be interpreted by the model or used for coordinate-based follow-up actions. Keep raw captures as an exception for fidelity-sensitive debugging only; the raw exception examples appear after the normalization guidance.

### Model-bound screenshots (default)

If you will emit a screenshot with `codex.emitImage(...)` for model interpretation, normalize it to CSS pixels for the exact region you captured before emitting. This keeps returned coordinates aligned with Playwright CSS pixels if the reply is later used for clicking, and it also reduces image payload size and model token cost.

Do not emit raw native-window screenshots by default. Skip normalization only when you explicitly need device-pixel fidelity, such as Retina or DPI artifact debugging, pixel-accurate rendering inspection, or another fidelity-sensitive case where raw pixels matter more than payload size. For local-only inspection that will not be emitted to the model, raw capture is fine.

Do not assume `page.screenshot({ scale: "css" })` is enough in native-window mode (`viewport: null`). In Chromium on macOS Retina displays, headed native-window screenshots can still come back at device-pixel size even when `scale: "css"` is requested. The same caveat applies to Electron windows launched through Playwright because Electron runs with `noDefaultViewport`, and `appWindow.screenshot({ scale: "css" })` may still return device-pixel output.

Use separate normalization paths for web pages and Electron windows:

- Web: prefer `page.screenshot({ scale: "css" })` directly. If native-window Chromium still returns device-pixel output, resize inside the current page with canvas; no scratch page is required.
- Electron: do not use `appWindow.context().newPage()` or `electronApp.context().newPage()` as a scratch page. Electron contexts do not support that path reliably. Capture in the main process with `BrowserWindow.capturePage(...)`, resize with `nativeImage.resize(...)`, and emit those bytes directly.

Shared helpers and conventions:

```javascript
var emitJpeg = async function (bytes) {
  await codex.emitImage({
    bytes,
    mimeType: "image/jpeg",
  });
};

var emitWebJpeg = async function (surface, options = {}) {
  await emitJpeg(await surface.screenshot({
    type: "jpeg",
    quality: 85,
    scale: "css",
    ...options,
  }));
};

var clickCssPoint = async function ({ surface, x, y, clip }) {
  await surface.mouse.click(
    clip ? clip.x + x : x,
    clip ? clip.y + y : y
  );
};

var tapCssPoint = async function ({ page, x, y, clip }) {
  await page.touchscreen.tap(
    clip ? clip.x + x : x,
    clip ? clip.y + y : y
  );
};
```

- Use `page` or `mobilePage` for web, or `appWindow` for Electron, as the `surface`.
- Treat `clip` as CSS pixels from `getBoundingClientRect()` in the renderer.
- Prefer JPEG at `quality: 85` unless lossless fidelity is specifically required.
- For full-image captures, use returned `{ x, y }` directly.
- For clipped captures, add the clip origin back when clicking.

### Web CSS normalization

Preferred web path for explicit-viewport contexts, and often for web in general:

```javascript
await emitWebJpeg(page);
```

Mobile web uses the same path; substitute `mobilePage` for `page`:

```javascript
await emitWebJpeg(mobilePage);
```

If the model returns `{ x, y }`, click it directly:

```javascript
await clickCssPoint({ surface: page, x, y });
```

Mobile web click path:

```javascript
await tapCssPoint({ page: mobilePage, x, y });
```

For web `clip` screenshots or element screenshots in this normal path, `scale: "css"` usually works directly. Add the region origin back when clicking.

- `await emitWebJpeg(page, { clip })`
- `await emitWebJpeg(mobilePage, { clip })`
- `await clickCssPoint({ surface: page, clip, x, y })`
- `await tapCssPoint({ page: mobilePage, clip, x, y })`
- `await clickCssPoint({ surface: page, clip: box, x, y })` after `const box = await locator.boundingBox()`

Web native-window fallback when `scale: "css"` still comes back at device-pixel size:

```javascript
var emitWebScreenshotCssScaled = async function ({ page, clip, quality = 0.85 } = {}) {
  var NodeBuffer = (await import("node:buffer")).Buffer;
  const target = clip
    ? { width: clip.width, height: clip.height }
    : await page.evaluate(() => ({
        width: window.innerWidth,
        height: window.innerHeight,
      }));

  const screenshotBuffer = await page.screenshot({
    type: "png",
    ...(clip ? { clip } : {}),
  });

  const bytes = await page.evaluate(
    async ({ imageBase64, targetWidth, targetHeight, quality }) => {
      const image = new Image();
      image.src = `data:image/png;base64,${imageBase64}`;
      await image.decode();

      const canvas = document.createElement("canvas");
      canvas.width = targetWidth;
      canvas.height = targetHeight;

      const ctx = canvas.getContext("2d");
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(image, 0, 0, targetWidth, targetHeight);

      const blob = await new Promise((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", quality)
      );

      return new Uint8Array(await blob.arrayBuffer());
    },
    {
      imageBase64: NodeBuffer.from(screenshotBuffer).toString("base64"),
      targetWidth: target.width,
      targetHeight: target.height,
      quality,
    }
  );

  await emitJpeg(bytes);
};
```

For a full viewport fallback capture, treat returned `{ x, y }` as direct CSS coordinates:

```javascript
await emitWebScreenshotCssScaled({ page });
await clickCssPoint({ surface: page, x, y });
```

For a clipped fallback capture, add the clip origin back:

```javascript
await emitWebScreenshotCssScaled({ page, clip });
await clickCssPoint({ surface: page, clip, x, y });
```

### Electron CSS normalization

For Electron, normalize in the main process instead of opening a scratch Playwright page. The helper below returns CSS-scaled bytes for the full content area or for a clipped CSS-pixel region. Treat `clip` as content-area CSS pixels, for example values taken from `getBoundingClientRect()` in the renderer.

```javascript
var emitElectronScreenshotCssScaled = async function ({ electronApp, clip, quality = 85 } = {}) {
  const bytes = await electronApp.evaluate(async ({ BrowserWindow }, { clip, quality }) => {
    const win = BrowserWindow.getAllWindows()[0];
    const image = clip ? await win.capturePage(clip) : await win.capturePage();

    const target = clip
      ? { width: clip.width, height: clip.height }
      : (() => {
          const [width, height] = win.getContentSize();
          return { width, height };
        })();

    const resized = image.resize({
      width: target.width,
      height: target.height,
      quality: "best",
    });

    return resized.toJPEG(quality);
  }, { clip, quality });

  await emitJpeg(bytes);
};
```

Full Electron window:

```javascript
await emitElectronScreenshotCssScaled({ electronApp });
await clickCssPoint({ surface: appWindow, x, y });
```

Clipped Electron region using CSS pixels from the renderer:

```javascript
var clip = await appWindow.evaluate(() => {
  const rect = document.getElementById("board").getBoundingClientRect();
  return {
    x: Math.round(rect.x),
    y: Math.round(rect.y),
    width: Math.round(rect.width),
    height: Math.round(rect.height),
  };
});

await emitElectronScreenshotCssScaled({ electronApp, clip });
await clickCssPoint({ surface: appWindow, clip, x, y });
```

### Raw Screenshot Exception Examples

Use these only when raw pixels matter more than CSS-coordinate alignment, such as Retina or DPI artifact debugging, pixel-accurate rendering inspection, or other fidelity-sensitive review.

Web desktop raw emit:

```javascript
await codex.emitImage({
  bytes: await page.screenshot({ type: "jpeg", quality: 85 }),
  mimeType: "image/jpeg",
});
```

Electron raw emit:

```javascript
await codex.emitImage({
  bytes: await appWindow.screenshot({ type: "jpeg", quality: 85 }),
  mimeType: "image/jpeg",
});
```

Mobile raw emit after the mobile web context is already running:

```javascript
await codex.emitImage({
  bytes: await mobilePage.screenshot({ type: "jpeg", quality: 85 }),
  mimeType: "image/jpeg",
});
```

## Viewport Fit Checks (Required)

Do not assume a screenshot is acceptable just because the main widget is visible. Before signoff, explicitly verify that the intended initial view matches the product requirement, using both screenshot review and numeric checks.

- Define the intended initial view before signoff. For scrollable pages, this is the above-the-fold experience. For app-like shells, games, editors, dashboards, or tools, this is the full interactive surface plus the controls and status needed to use it.
- Use screenshots as the primary evidence for fit. Numeric checks support the screenshots; they do not overrule visible clipping.
- Signoff fails if any required visible region is clipped, cut off, obscured, or pushed outside the viewport in the intended initial view, even if page-level scroll metrics appear acceptable.
- Scrolling is acceptable when the product is designed to scroll and the initial view still communicates the core experience and exposes the primary call to action or required starting context.
- For fixed-shell interfaces, scrolling is not an acceptable workaround if it is needed to reach part of the primary interactive surface or essential controls.
- Do not rely on document scroll metrics alone. Fixed-height shells, internal panes, and hidden-overflow containers can clip required UI while page-level scroll checks still look clean.
- Check region bounds, not just document bounds. Verify that each required visible region fits within the viewport in the startup state.
- For Electron or desktop apps, verify both the launched window size and placement and the renderer's initial visible layout before any manual resize or repositioning.
- Passing viewport-fit checks only proves that the intended initial view is visible without unintended clipping or scrolling. It does not prove that the UI is visually correct or aesthetically successful.

Web or renderer check:

```javascript
console.log(await page.evaluate(() => ({
  innerWidth: window.innerWidth,
  innerHeight: window.innerHeight,
  clientWidth: document.documentElement.clientWidth,
  clientHeight: document.documentElement.clientHeight,
  scrollWidth: document.documentElement.scrollWidth,
  scrollHeight: document.documentElement.scrollHeight,
  canScrollX: document.documentElement.scrollWidth > document.documentElement.clientWidth,
  canScrollY: document.documentElement.scrollHeight > document.documentElement.clientHeight,
})));
```

Electron check:

```javascript
console.log(await appWindow.evaluate(() => ({
  innerWidth: window.innerWidth,
  innerHeight: window.innerHeight,
  clientWidth: document.documentElement.clientWidth,
  clientHeight: document.documentElement.clientHeight,
  scrollWidth: document.documentElement.scrollWidth,
  scrollHeight: document.documentElement.scrollHeight,
  canScrollX: document.documentElement.scrollWidth > document.documentElement.clientWidth,
  canScrollY: document.documentElement.scrollHeight > document.documentElement.clientHeight,
})));
```

Augment the numeric check with `getBoundingClientRect()` checks for the required visible regions in your specific UI when clipping is a realistic failure mode; document-level metrics alone are not sufficient for fixed shells.

## Dev Server

For local web debugging, keep the app running in a persistent TTY session. Do not rely on one-shot background commands from a short-lived shell.

Use the project's normal start command, for example:

```bash
npm start
```

Before `page.goto(...)`, verify the chosen port is listening and the app responds.

For Electron debugging, launch the app from `js_repl` through `_electron.launch(...)` so the same session owns the process. If the Electron renderer depends on a separate dev server (for example Vite or Next), keep that server running in a persistent TTY session and then relaunch or reload the Electron app from `js_repl`.

## Cleanup

Only run cleanup when the task is actually finished:

- This cleanup is manual. Exiting Codex, closing the terminal, or losing the `js_repl` session does not implicitly run `electronApp.close()`, `context.close()`, or `browser.close()`.
- For Electron specifically, assume the app may keep running if you leave the session without executing the cleanup cell first.

```javascript
if (electronApp) {
  await electronApp.close().catch(() => {});
}

if (mobileContext) {
  await mobileContext.close().catch(() => {});
}

if (context) {
  await context.close().catch(() => {});
}

if (browser) {
  await browser.close().catch(() => {});
}

browser = undefined;
context = undefined;
page = undefined;
mobileContext = undefined;
mobilePage = undefined;
electronApp = undefined;
appWindow = undefined;

console.log("Playwright session closed");
```

If you plan to exit Codex immediately after debugging, run the cleanup cell first and wait for the `"Playwright session closed"` log before quitting.

## Common Failure Modes

- `Cannot find module 'playwright'`: run the one-time setup in the current workspace and verify the import before using `js_repl`.
- Playwright package is installed but the browser executable is missing: run `npx playwright install chromium`.
- `page.goto: net::ERR_CONNECTION_REFUSED`: make sure the dev server is still running in a persistent TTY session, recheck the port, and prefer `http://127.0.0.1:<port>`.
- `electron.launch` hangs, times out, or exits immediately: verify the local `electron` dependency, confirm the `args` target, and make sure any renderer dev server is already running before launch.
- `Identifier has already been declared`: reuse the existing top-level bindings, choose a new name, or wrap the code in `{ ... }`. Use `js_repl_reset` only when the kernel is genuinely stuck.
- `browserContext.newPage: Protocol error (Target.createTarget): Not supported` while working with Electron: do not use `appWindow.context().newPage()` or `electronApp.context().newPage()` as a scratch page; use the Electron-specific screenshot normalization flow in the model-bound screenshots section.
- `js_repl` timed out or reset: rerun the bootstrap cell and recreate the session with shorter, more focused cells.
- Browser launch or network operations fail immediately: confirm the session was started with `--sandbox danger-full-access` and restart that way if needed.

2026-08-04T08:56:13.331733Z ERROR codex_models_manager::manager: failed to renew cache TTL: missing field `supports_reasoning_summaries` at line 86 column 5
2026-08-04T08:56:16.037447Z ERROR codex_models_manager::manager: failed to renew cache TTL: missing field `supports_reasoning_summaries` at line 86 column 5
exec
/bin/zsh -lc "find frontend/.next -maxdepth 3 -type f \\( -name '*.woff2' -o -name '*.css' \\) 2>/dev/null | sed -n '1,120p'" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
frontend/.next/static/css/feed39887bd94401.css
frontend/.next/static/css/fca6f989a1efe9fc.css
frontend/.next/static/css/e00b5501b527c129.css
frontend/.next/static/css/837a8c7d0cceaf91.css
frontend/.next/static/media/99dcf268bda04fe5-s.woff2
frontend/.next/static/media/b3bf17a9041d9433-s.woff2
frontend/.next/static/media/58f386aa6b1a2a92-s.woff2
frontend/.next/static/media/26d4368bf94c0ec4-s.p.woff2
frontend/.next/static/media/c5f10e9e72d35c52-s.woff2
frontend/.next/static/media/28793f5c5e3d822d-s.woff2
frontend/.next/static/media/e0f4b1ebfdbd83f9-s.p.woff2
frontend/.next/static/media/d29838c109ef09b4-s.woff2
frontend/.next/static/media/26dc4a78f0c7af7f-s.p.woff2
frontend/.next/static/media/92eeb95d069020cc-s.woff2
frontend/.next/static/media/d3ebbfd689654d3a-s.p.woff2
frontend/.next/static/media/d02d66744511ad29-s.woff2
frontend/.next/static/media/c9c3823090ec8b55-s.woff2
frontend/.next/static/media/98e207f02528a563-s.p.woff2
frontend/.next/static/media/7b19b489dc6743ba-s.woff2
frontend/.next/static/media/7ba5fb2a8c88521c-s.woff2
frontend/.next/static/media/ef4d5661765d0e49-s.woff2
frontend/.next/static/media/6abc91adc2ea99a6-s.woff2
frontend/.next/static/media/e40af3453d7c920a-s.woff2
frontend/.next/static/media/011e180705008d6f-s.woff2
frontend/.next/static/media/e8c7e585bb5e69ba-s.woff2
frontend/.next/static/media/7d08bfa01b04d053-s.woff2
frontend/.next/static/media/3dc379dc9b5dec12-s.p.woff2
frontend/.next/static/media/2801417b65625cf5-s.woff2

exec
/bin/zsh -lc "rg -n 'shared_sessions|/api/shared|SharedMessage|create_share|shared/' backend/tests backend/app frontend/src | sed -n '1,260p'" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
backend/tests/test_error_taxonomy.py:1021:    response = await client.get(f"/api/shared/{uuid.uuid4()}")
backend/tests/test_error_taxonomy.py:1031:    response = await client.get(f"/api/shared/{uuid.uuid4()}")
backend/tests/test_sharing_api.py:7:async def test_create_share_requires_auth():
backend/tests/test_sharing_api.py:103:        response = await client.get(f"/api/shared/{share_token}")
backend/app/api/sharing.py:42:async def create_share(
backend/app/api/sharing.py:63:            url=f"{settings.FRONTEND_URL}/shared/{share.share_token}",
backend/app/api/sharing.py:99:        url=f"{settings.FRONTEND_URL}/shared/{share.share_token}",
backend/app/api/sharing.py:123:@router.get("/api/shared/{share_token}", response_model=SharedSessionView)
frontend/src/components/CookieConsentBanner.tsx:60:      || pathname?.startsWith('/shared/')
backend/tests/conftest.py:127:        f"appears to point at a shared/remote database (e.g. Railway) — "
frontend/src/components/Quotes/BiblioForm.tsx:45: * (backend `upsert_user_biblio`), so edits on a shared/demo document never
backend/app/models/tables.py:419:    __tablename__ = "shared_sessions"
backend/app/models/tables.py:442:        sa.UniqueConstraint("session_id", "user_id", name="uq_shared_sessions_session_user"),
backend/app/models/tables.py:443:        sa.Index("idx_shared_sessions_token", "share_token"),
backend/app/models/tables.py:749:    a shared/demo document's metadata).
frontend/src/app/shared/[token]/page.tsx:18:interface SharedMessage {
frontend/src/app/shared/[token]/page.tsx:31:  // C1: triple-header HMAC contract. Backend rate-limits /api/shared/{token}
frontend/src/app/shared/[token]/page.tsx:46:    const res = await fetch(`${BACKEND_URL}/api/shared/${token}`, {
frontend/src/app/shared/[token]/page.tsx:61:  const preview = data.messages?.find((m: SharedMessage) => m.role === 'assistant')?.content?.slice(0, 150) || '';
frontend/src/app/shared/[token]/page.tsx:84:          {data.messages.map((msg: SharedMessage, i: number) => (

exec
/bin/zsh -lc 'lsof -nP -iTCP:3000 -sTCP:LISTEN || true; lsof -nP -iTCP:4010 -sTCP:LISTEN || true; test -d frontend/node_modules/playwright && echo playwright-present || true; test -d frontend/node_modules/@playwright && echo at-playwright-present || true' in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
playwright-present
at-playwright-present

2026-08-04T08:56:30.356443Z ERROR codex_models_manager::manager: failed to renew cache TTL: missing field `supports_reasoning_summaries` at line 86 column 5
exec
/bin/zsh -lc "sed -n '110,175p' backend/app/api/sharing.py && sed -n '1,140p' backend/tests/test_sharing_api.py" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
        select(SharedSession).where(
            SharedSession.session_id == session_id,
            SharedSession.user_id == user.id,
        )
    )
    share = result.scalar_one_or_none()
    if not share:
        raise HTTPException(status_code=404, detail=SHARE_NOT_FOUND_DETAIL)

    await db.delete(share)
    await db.commit()


@router.get("/api/shared/{share_token}", response_model=SharedSessionView)
async def view_shared(
    share_token: UUID,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
):
    # Rate limit anonymous public endpoint: 60 req/min per IP. Prevents
    # share-token enumeration and traffic amplification on public URLs.
    client_ip = get_client_ip(request)
    if not await shared_view_limiter.is_allowed(client_ip):
        log_security_event("shared_view_rate_limit", ip=client_ip)
        raise HTTPException(
            status_code=429,
            detail={
                "error": "RATE_LIMITED",
                "message": "Too many requests",
                "retry_after": 60,
            },
            headers={"Retry-After": "60"},
        )

    result = await db.execute(
        select(SharedSession).where(SharedSession.share_token == share_token)
    )
    share = result.scalar_one_or_none()
    if not share:
        raise HTTPException(status_code=404, detail=SHARE_NOT_FOUND_DETAIL)

    # Check expiry
    if share.expires_at and share.expires_at < datetime.now(timezone.utc):
        raise HTTPException(
            status_code=410,
            detail={"error": "SHARE_EXPIRED", "message": "Share link has expired"},
        )

    # Load session
    session_result = await db.execute(
        select(ChatSession).where(ChatSession.id == share.session_id)
    )
    session = session_result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail=SHARE_NOT_FOUND_DETAIL)

    # Load messages
    rows = await db.execute(
        select(Message)
        .where(Message.session_id == share.session_id)
        .order_by(Message.created_at)
    )
    messages = list(rows.scalars())

    # Build safe response — exclude bboxes, documentId, chunkId, confidence
    safe_messages = []
from __future__ import annotations

import pytest


@pytest.mark.asyncio
async def test_create_share_requires_auth():
    from httpx import ASGITransport, AsyncClient

    from app.main import app

    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        resp = await client.post(
            "/api/sessions/00000000-0000-0000-0000-000000000001/share"
        )
    assert resp.status_code == 401


class _Result:
    def __init__(
        self,
        *,
        scalar_one_or_none: object = None,
        scalars_all: list[object] | None = None,
        first: object = None,
    ) -> None:
        self._scalar_one_or_none = scalar_one_or_none
        self._scalars_all = scalars_all or []
        self._first = first

    def scalar_one_or_none(self):
        return self._scalar_one_or_none

    def scalars(self):
        return iter(self._scalars_all)

    def first(self):
        return self._first


@pytest.mark.asyncio
async def test_shared_view_returns_safe_message_anchor_without_private_citation_fields(monkeypatch):
    import uuid
    from datetime import datetime, timezone
    from types import SimpleNamespace
    from unittest.mock import AsyncMock

    from fastapi import FastAPI
    from httpx import ASGITransport, AsyncClient

    from app.api import sharing as sharing_api
    from app.core import deps as deps_module

    api_app = FastAPI()
    api_app.include_router(sharing_api.router)

    share_token = uuid.uuid4()
    session_id = uuid.uuid4()
    message_id = uuid.UUID("12345678-90ab-4def-8123-456789abcdef")
    now = datetime.now(timezone.utc)
    share = SimpleNamespace(session_id=session_id, expires_at=None)
    session = SimpleNamespace(
        id=session_id,
        title="Shared diligence answer",
        document_id=uuid.uuid4(),
        created_at=now,
    )
    message = SimpleNamespace(
        id=message_id,
        role="assistant",
        content="The payment term is NET-60.",
        citations=[
            {
                "text_snippet": "Payment is due within sixty days.",
                "page": 4,
                "document_filename": "contract.pdf",
                "bboxes": [{"x": 0.1, "y": 0.2, "w": 0.3, "h": 0.1}],
                "chunk_id": "chunk-1",
                "document_id": str(uuid.uuid4()),
                "confidence_score": 0.91,
            }
        ],
    )
    execute = AsyncMock(
        side_effect=[
            _Result(scalar_one_or_none=share),
            _Result(scalar_one_or_none=session),
            _Result(scalars_all=[message]),
            _Result(first=("contract.pdf",)),
        ]
    )
    db = SimpleNamespace(execute=execute)

    async def _get_db():
        yield db

    api_app.dependency_overrides[deps_module.get_db_session] = _get_db
    monkeypatch.setattr(sharing_api.shared_view_limiter, "is_allowed", AsyncMock(return_value=True))

    async with AsyncClient(transport=ASGITransport(app=api_app), base_url="http://test") as client:
        response = await client.get(f"/api/shared/{share_token}")

    assert response.status_code == 200
    body = response.json()
    assert body["messages"][0]["id"] == "msg-1234567890ab4def"
    citation = body["messages"][0]["citations"][0]
    assert citation == {
        "text_snippet": "Payment is due within sixty days.",
        "page": 4,
        "document_filename": "contract.pdf",
    }
    assert "bboxes" not in response.text
    assert "chunk_id" not in response.text
    assert "document_id" not in response.text
    assert "confidence_score" not in response.text


@pytest.mark.asyncio
async def test_revoke_share_requires_auth():
    from httpx import ASGITransport, AsyncClient

    from app.main import app

    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        resp = await client.delete(
            "/api/sessions/00000000-0000-0000-0000-000000000001/share"
        )
    assert resp.status_code == 401

2026-08-04T08:56:34.240462Z ERROR codex_models_manager::manager: failed to renew cache TTL: missing field `supports_reasoning_summaries` at line 86 column 5
exec
/bin/zsh -lc "sed -n '175,250p' backend/app/api/sharing.py && rg -n 'class SharedSessionView|SharedSessionView' backend/app" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
    safe_messages = []
    for msg in messages:
        safe_msg: dict = {
            "id": message_share_anchor(msg.id),
            "role": msg.role,
            "content": msg.content,
        }
        if msg.citations:
            safe_citations = []
            for c in msg.citations:
                if not isinstance(c, dict):
                    continue
                safe_citations.append(
                    {
                        "text_snippet": c.get("text_snippet", ""),
                        "page": c.get("page"),
                        "document_filename": c.get("document_filename", ""),
                    }
                )
            safe_msg["citations"] = safe_citations
        safe_messages.append(safe_msg)

    doc_name = "document"
    if session.document_id:
        doc_result = await db.execute(
            select(Document.filename).where(Document.id == session.document_id)
        )
        row = doc_result.first()
        if row:
            doc_name = row[0] or doc_name

    return SharedSessionView(
        session_title=session.title or "Untitled Conversation",
        document_name=doc_name,
        created_at=session.created_at.isoformat(),
        messages=safe_messages,
    )
backend/app/api/sharing.py:34:class SharedSessionView(BaseModel):
backend/app/api/sharing.py:123:@router.get("/api/shared/{share_token}", response_model=SharedSessionView)
backend/app/api/sharing.py:206:    return SharedSessionView(

2026-08-04T08:56:37.585570Z ERROR codex_models_manager::manager: failed to renew cache TTL: missing field `supports_reasoning_summaries` at line 86 column 5
exec
/bin/zsh -lc "sed -n '1,48p' backend/app/api/sharing.py" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
"""Session sharing API — create, view, revoke shareable links."""
from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.chat import verify_session_access
from app.core.config import settings
from app.core.deps import get_db_session, require_auth
from app.core.rate_limit import get_client_ip, shared_view_limiter
from app.core.security_log import log_security_event
from app.models.tables import ChatSession, Document, Message, SharedSession, User
from app.services.share_anchor_service import message_share_anchor

router = APIRouter(tags=["sharing"])

SHARE_NOT_FOUND_DETAIL = {
    "error": "SHARE_NOT_FOUND",
    "message": "Share not found",
}


class ShareResponse(BaseModel):
    share_token: str
    url: str
    expires_at: str | None = None


class SharedSessionView(BaseModel):
    session_title: str
    document_name: str
    created_at: str
    messages: list[dict]


@router.post("/api/sessions/{session_id}/share", response_model=ShareResponse)
async def create_share(
    session_id: UUID,
    user: User = Depends(require_auth),
    db: AsyncSession = Depends(get_db_session),
):
    # Verify session access
    session = await verify_session_access(session_id, user, db)

2026-08-04T08:56:42.604243Z ERROR codex_models_manager::manager: failed to renew cache TTL: missing field `supports_reasoning_summaries` at line 86 column 5
mcp: node_repl/js_add_node_module_dir started
mcp: node_repl/js_add_node_module_dir (completed)
mcp: node_repl/js started
mcp: node_repl/js (failed)
exec
/bin/zsh -lc "for p in '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' '/Applications/Chromium.app/Contents/MacOS/Chromium' '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'; do if test -x \""'$p"; then echo "$p"; fi; done' in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
/Applications/Google Chrome.app/Contents/MacOS/Google Chrome

mcp: node_repl/js started
mcp: node_repl/js (failed)
codex
The browser-skill runtime is unavailable in this sandbox: local port binding is denied (`EPERM`), and Playwright’s Chrome process aborts under the required sandbox profile. I’m continuing with an equivalent static/computed-cascade audit from the emitted CSS and React markup; the suspected shared-text issue is deterministic HTML/CSS behavior (`white-space: normal`) and does not depend on app state.
exec
/bin/zsh -lc "rg -n --glob '*.{tsx,ts,css}' '(ed-olive|ed-slate|ed-signal-deep)' frontend/src | sed -n '1,360p'" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
frontend/src/components/Diff/DocumentDiffPanel.tsx:408:                border: "1px solid var(--ed-slate)",
frontend/src/components/Diff/DocumentDiffPanel.tsx:439:              <span className="ed-body" style={{ marginTop: 0, color: "var(--ed-signal-deep)" }}>{error}</span>
frontend/src/components/Diff/DocumentDiffPanel.tsx:455:                    <Clock3 size={16} style={{ color: "var(--ed-slate)" }} aria-hidden="true" />
frontend/src/components/Diff/DocumentDiffPanel.tsx:482:              <p className="ed-body" style={{ padding: "16px 20px", marginTop: 0, color: "var(--ed-signal-deep)" }}>
frontend/src/components/marketing/EdInlineCell.tsx:55:          color: "var(--ed-slate)",
frontend/src/components/landing/FeatureGrid.tsx:29:            <div className="h-1.5 w-full bg-[var(--ed-signal)]/20 border-l-2 border-[var(--ed-slate)]" />
frontend/src/components/landing/FeatureGrid.tsx:40:            <span className="mr-1 inline-flex items-center justify-center bg-[var(--ed-olive)] px-1 py-0.5 text-[8px] font-bold leading-none text-white">
frontend/src/components/landing/HeroCollage.tsx:34:            background: "var(--ed-slate)",
frontend/src/components/landing/HeroCollage.tsx:88:            color: "var(--ed-slate)",
frontend/src/components/landing/HeroCollage.tsx:188:                background: "var(--ed-slate)",
frontend/src/components/landing/HeroCollage.tsx:212:                background: "var(--ed-olive)",
frontend/src/components/landing/HeroCollage.tsx:275:                background: "var(--ed-olive)",
frontend/src/app/demo/DemoPageClient.tsx:126:              <span className="ed-body" style={{ color: 'var(--ed-signal-deep)' }}>
frontend/src/app/tools/reading-time/ReadingTimeClient.tsx:298:                          background: 'var(--ed-slate-2)',
frontend/src/app/editorial.css:14:  --ed-signal-deep: #843c28;
frontend/src/app/editorial.css:15:  --ed-slate: #1f3a4d;
frontend/src/app/editorial.css:16:  --ed-slate-2: #2f556b;
frontend/src/app/editorial.css:17:  --ed-olive: #3f6a34;
frontend/src/app/editorial.css:194:.dt-editorial .ed-cta:hover { background: var(--ed-signal-deep); }
frontend/src/app/trust/TrustPageContent.tsx:211:            color: "var(--ed-signal-deep)",
frontend/src/app/trust/TrustPageContent.tsx:277:                    color: "var(--ed-slate)",
frontend/src/app/trust/TrustPageContent.tsx:285:                      background: "var(--ed-slate)",

exec
/bin/zsh -lc "git diff -U2 782f8b0..HEAD -- frontend/src | rg -n -B3 -A3 'ed-ochre' | sed -n '1,320p'" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
5-@@ -124,5 +124,5 @@ export default function DemoPageClient() {
6-           >
7-             <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
8:-              <span className="ed-body" style={{ color: 'var(--ed-ochre)' }}>
9-+              <span className="ed-body" style={{ color: 'var(--ed-signal-deep)' }}>
10-                 {tOr('demo.loadError', 'Demo documents could not be loaded.')}
11-               </span>
--
30--  --ed-ink-3: #6e6860;
31--  --ed-signal: #b0472f;
32--  --ed-signal-deep: #8f3a26;
33:-  --ed-ochre: #c08a3e;
34--  --ed-rule: #d3c9b3;
35-+  /* Counterpoint palette (2026-08-04 redesign). Two accents, not one:
36-+     rust = action (primary CTA, brand mark, feature eyebrows), slate =
--
417-@@ -296,5 +296,5 @@ export default function ReadingTimeClient() {
418-                           height: '100%',
419-                           borderRadius: '3px',
420:-                          background: 'var(--ed-ochre)',
421-+                          background: 'var(--ed-slate-2)',
422-                           transition: 'width 300ms',
423-                           width: wordCount > 0
--
428-@@ -209,5 +209,5 @@ export default async function TrustPageContent({ locale }: { locale: string }) {
429-             padding: "12px 14px",
430-             border: "1px solid var(--ed-rule)",
431:-            color: "var(--ed-ochre)",
432-+            color: "var(--ed-signal-deep)",
433-           }}
434-         >
435-@@ -275,5 +275,5 @@ export default async function TrustPageContent({ locale }: { locale: string }) {
436-                     gap: "6px",
437-                     textTransform: "uppercase",
438:-                    color: "var(--ed-ochre)",
439-+                    color: "var(--ed-slate)",
440-                   }}
441-                 >
442-@@ -283,5 +283,5 @@ export default async function TrustPageContent({ locale }: { locale: string }) {
443-                       width: "5px",
444-                       height: "5px",
445:-                      background: "var(--ed-ochre)",
446-+                      background: "var(--ed-slate)",
447-                     }}
448-                   />
--
453-@@ -406,5 +406,5 @@ export default function DocumentDiffPanel({
454-               style={{
455-                 marginTop: "16px",
456:-                border: "1px solid var(--ed-ochre)",
457-+                border: "1px solid var(--ed-slate)",
458-                 background: "var(--ed-paper)",
459-                 borderRadius: "3px",
460-@@ -453,5 +453,5 @@ export default function DocumentDiffPanel({
461-                     <CheckCircle2 size={16} style={{ color: "var(--ed-signal)" }} aria-hidden="true" />
462-                   ) : (
463:-                    <Clock3 size={16} style={{ color: "var(--ed-ochre)" }} aria-hidden="true" />
464-+                    <Clock3 size={16} style={{ color: "var(--ed-slate)" }} aria-hidden="true" />
465-                   )}
466-                   <h3 className="ed-h3 truncate" style={{ marginTop: 0 }}>
--
507-@@ -30,5 +32,5 @@ export default function HeroCollage() {
508-             width: "58%",
509-             height: "82%",
510:-            background: "var(--ed-ochre)",
511-+            background: "var(--ed-slate)",
512-             opacity: 0.18,
513-           }}
514-@@ -84,5 +86,5 @@ export default function HeroCollage() {
515-             fontSize: "clamp(120px, 18vw, 180px)",
516-             lineHeight: 1,
517:-            color: "var(--ed-ochre)",
518-+            color: "var(--ed-slate)",
519-             opacity: 0.12,
520-             userSelect: "none",
--
545-               style={{
546-                 position: "absolute",
547-                 inset: "-2px -4px",
548:-                background: "var(--ed-ochre)",
549-+                background: "var(--ed-slate)",
550-                 opacity: 0.18,
551-                 borderRadius: "1px",
--
816-@@ -53,5 +53,5 @@ export default function EdInlineCell({ value }: EdInlineCellProps) {
817-           fontFamily: MONO_FONT,
818-           fontSize: "15.5px",
819:-          color: "var(--ed-ochre)",
820-+          color: "var(--ed-slate)",
821-         }}
822-       >

exec
/bin/zsh -lc "git diff --unified=20 782f8b0..HEAD -- frontend/src/components/Diff/DocumentDiffPanel.tsx && sed -n '140,480p' frontend/src/components/Diff/DocumentDiffPanel.tsx" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
diff --git a/frontend/src/components/Diff/DocumentDiffPanel.tsx b/frontend/src/components/Diff/DocumentDiffPanel.tsx
index a95eaaf..42bbefc 100644
--- a/frontend/src/components/Diff/DocumentDiffPanel.tsx
+++ b/frontend/src/components/Diff/DocumentDiffPanel.tsx
@@ -388,41 +388,41 @@ export default function DocumentDiffPanel({
           </div>
           {readyDocs.length < 2 && (
             <p
               className="ed-caption"
               style={{
                 marginTop: "16px",
                 border: "1px dashed var(--ed-rule)",
                 background: "var(--ed-paper)",
                 borderRadius: "3px",
                 padding: "10px 14px",
               }}
             >
               {tOr("diff.needTwoDocs", "Upload or add at least two ready documents to compare.")}
             </p>
           )}
           {paywall && (
             <div
               className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
               style={{
                 marginTop: "16px",
-                border: "1px solid var(--ed-ochre)",
+                border: "1px solid var(--ed-slate)",
                 background: "var(--ed-paper)",
                 borderRadius: "3px",
                 padding: "12px 14px",
               }}
             >
               <span className="ed-body" style={{ marginTop: 0 }}>
                 {paywall.code === "INSUFFICIENT_CREDITS"
                   ? tOr("diff.paywallCredits", "You need more credits to compare these documents.")
                   : tOr("diff.paywallPlan", "Document Diff is a Pro workflow.")}
               </span>
               <Link
                 href={billingHref({ plan: "pro", source: collectionId ? "collection_reader" : "compare_page", reason: "document_diff" })}
                 className="ed-cta"
               >
                 {tOr("credits.upgradeToPro", "Upgrade to Pro")}
               </Link>
             </div>
           )}
           {error && (
             <div
@@ -435,41 +435,41 @@ export default function DocumentDiffPanel({
                 padding: "10px 14px",
               }}
             >
               <AlertTriangle size={16} className="mt-0.5 shrink-0" style={{ color: "var(--ed-signal)" }} aria-hidden="true" />
               <span className="ed-body" style={{ marginTop: 0, color: "var(--ed-signal-deep)" }}>{error}</span>
             </div>
           )}
         </section>
 
         {activeRun ? (
           <section style={{ ...edPanelStyle, padding: 0 }}>
             <div
               className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
               style={{ borderBottom: "1px solid var(--ed-rule)", padding: "16px 20px" }}
             >
               <div className="min-w-0">
                 <div className="flex items-center gap-2">
                   {activeRun.status === "succeeded" ? (
                     <CheckCircle2 size={16} style={{ color: "var(--ed-signal)" }} aria-hidden="true" />
                   ) : (
-                    <Clock3 size={16} style={{ color: "var(--ed-ochre)" }} aria-hidden="true" />
+                    <Clock3 size={16} style={{ color: "var(--ed-slate)" }} aria-hidden="true" />
                   )}
                   <h3 className="ed-h3 truncate" style={{ marginTop: 0 }}>
                     {oldName || tOr("diff.oldDocument", "Old document")} → {newName || tOr("diff.newDocument", "New document")}
                   </h3>
                 </div>
                 <p className="ed-caption" style={{ marginTop: "6px" }}>
                   {activeRun.status === "succeeded"
                     ? tOr("diff.completed", "Completed")
                     : tOr("diff.status", "Status: {status}", { status: activeRun.status })}
                 </p>
               </div>
               {activeRun.result && (
                 <div className="flex gap-2">
                   <button type="button" onClick={() => void handleExport("md")} className="inline-flex h-9 items-center gap-2" style={edExportBtnStyle}>
                     <Download size={14} aria-hidden="true" />
                     MD
                   </button>
                   <button type="button" onClick={() => void handleExport("csv")} className="inline-flex h-9 items-center gap-2" style={edExportBtnStyle}>
                     <Download size={14} aria-hidden="true" />
                     CSV
  padding: "0 12px",
  fontFamily: "var(--dt-mono)",
  fontSize: "11px",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
};

const edRefBtnStyle: React.CSSProperties = {
  border: "1px solid var(--ed-rule)",
  background: "var(--ed-paper)",
  color: "var(--ed-ink-2)",
  borderRadius: "3px",
  padding: "4px 8px",
  fontFamily: "var(--dt-mono)",
  fontSize: "11px",
};

export default function DocumentDiffPanel({
  collectionId,
  documents,
  onCitationClick,
  userPlan,
  surface = "app",
}: DocumentDiffPanelProps) {
  const editorial = surface === "editorial";
  const { tOr, locale } = useLocale();
  const [availableDocs, setAvailableDocs] = useState<DiffDocument[]>(documents || []);
  const [runs, setRuns] = useState<ExtractionJob[]>([]);
  const [oldDocumentId, setOldDocumentId] = useState("");
  const [newDocumentId, setNewDocumentId] = useState("");
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paywall, setPaywall] = useState<{ code: string; requiredPlan: string } | null>(null);

  const readyDocs = useMemo(
    () => availableDocs.filter((doc) => (doc.status || "ready").toLowerCase() === "ready"),
    [availableDocs]
  );

  const refreshRuns = useCallback(async () => {
    const data = await listDocumentDiffRuns(collectionId);
    setRuns(data);
    return data;
  }, [collectionId]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const docsPromise = documents
      ? Promise.resolve(documents)
      : getMyDocuments().then((items: DocumentBrief[]) => items.map((doc) => ({
          id: doc.id,
          filename: doc.filename,
          status: doc.status,
        })));

    Promise.all([docsPromise, refreshRuns()])
      .then(([docs]) => {
        if (cancelled) return;
        setAvailableDocs(docs);
        setLoading(false);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load comparisons");
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [documents, refreshRuns]);

  useEffect(() => {
    if (oldDocumentId && newDocumentId) return;
    if (readyDocs.length < 2) return;
    setOldDocumentId((current) => current || readyDocs[0].id);
    setNewDocumentId((current) => current || readyDocs[1].id);
  }, [newDocumentId, oldDocumentId, readyDocs]);

  useEffect(() => {
    if (!runs.some((run) => run.status === "queued" || run.status === "running")) return;
    const timer = window.setInterval(() => {
      void refreshRuns().catch(() => undefined);
    }, 2500);
    return () => window.clearInterval(timer);
  }, [refreshRuns, runs]);

  const activeRun = runs[0] || null;
  const result = activeRun?.result?.structured_json || {};
  const changes: DiffChange[] = asArray(result.changes).map((item) => ({
    kind: item.kind === "added" || item.kind === "removed" || item.kind === "modified" ? item.kind : "modified",
    title: asString(item.title),
    detail: asString(item.detail),
    old_refs: asNumberArray(item.old_refs),
    new_refs: asNumberArray(item.new_refs),
  }));
  const citations = asArray(activeRun?.result?.citations);
  const citationByLabel = useMemo(() => {
    const map = new Map<string, Record<string, unknown>>();
    for (const citation of citations) {
      const label = typeof citation.label === "string" ? citation.label : "";
      if (label) map.set(label, citation);
    }
    return map;
  }, [citations]);
  const oldName = filenameFromScope(activeRun?.input_scope || {}, "old_document_filename");
  const newName = filenameFromScope(activeRun?.input_scope || {}, "new_document_filename");
  const isWorking = running || activeRun?.status === "queued" || activeRun?.status === "running";

  const handleCitation = useCallback((raw: Record<string, unknown>) => {
    const citation = toCitation(raw);
    if (!citation) return;
    trackEvent("citation_clicked", {
      source: collectionId ? "collection_reader" : "compare_page",
      reason: "document_diff",
      page: citation.page,
      has_bboxes: Boolean(citation.bboxes?.length),
    });
    if (onCitationClick) {
      onCitationClick(citation);
      return;
    }
    if (!citation.documentId) return;
    const params = new URLSearchParams({ page: String(citation.page || 1) });
    if (citation.chunkId) params.set("highlight", citation.chunkId);
    window.open(`/d/${citation.documentId}?${params.toString()}`, "_blank", "noopener,noreferrer");
  }, [collectionId, onCitationClick]);

  const runCompare = useCallback(async () => {
    if (!oldDocumentId || !newDocumentId || oldDocumentId === newDocumentId || running) return;
    setRunning(true);
    setError(null);
    setPaywall(null);
    try {
      const job = await runDocumentDiff({
        oldDocumentId,
        newDocumentId,
        collectionId,
        locale,
      });
      setRuns((prev) => [job, ...prev.filter((item) => item.id !== job.id)]);
      trackEvent("document_diff_created", {
        source: collectionId ? "collection_reader" : "compare_page",
        reason: "document_diff",
        plan: userPlan,
      });
      window.setTimeout(() => {
        void getDocumentDiffRun(job.id)
          .then((updated) => setRuns((prev) => [updated, ...prev.filter((item) => item.id !== updated.id)]))
          .catch(() => undefined);
      }, 1200);
    } catch (err) {
      if (err instanceof ApiError && (err.code === "PLAN_REQUIRED" || err.code === "INSUFFICIENT_CREDITS")) {
        const requiredPlan = typeof err.detail.required_plan === "string" ? err.detail.required_plan : "pro";
        setPaywall({ code: err.code, requiredPlan });
        trackEvent("paywall_opened", {
          source: collectionId ? "collection_reader" : "compare_page",
          reason: err.code === "INSUFFICIENT_CREDITS" ? "credits" : "document_diff",
          plan: requiredPlan,
        });
      } else {
        setError(err instanceof Error ? err.message : "Document comparison failed");
      }
    } finally {
      setRunning(false);
    }
  }, [collectionId, locale, newDocumentId, oldDocumentId, running, userPlan]);

  const handleExport = useCallback(async (format: "md" | "csv") => {
    if (!activeRun?.result) return;
    try {
      const blob = await exportDocumentDiffRun(activeRun.id, format);
      downloadBlob(blob, `document-diff-${activeRun.id.slice(0, 8)}.${format}`);
      trackEvent("document_diff_export_clicked", {
        source: collectionId ? "collection_reader" : "compare_page",
        reason: format,
        plan: userPlan,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed");
    }
  }, [activeRun, collectionId, userPlan]);

  if (loading) {
    if (editorial) {
      return <p className="ed-caption">{tOr("common.loading", "Loading...")}</p>;
    }
    return <div className="p-4 text-sm text-zinc-500 dark:text-zinc-400">{tOr("common.loading", "Loading...")}</div>;
  }

  if (editorial) {
    return (
      <div className="flex flex-col" style={{ gap: "24px" }}>
        {/* Controls */}
        <section style={edPanelStyle}>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0">
              <p className="ed-label">{tOr("diff.kicker", "Semantic document diff")}</p>
              <h2 className="ed-h3" style={{ marginTop: "8px" }}>
                {tOr("diff.title", "Compare two versions with cited changes")}
              </h2>
              <p className="ed-body" style={{ marginTop: "8px", maxWidth: "42rem" }}>
                {tOr("diff.subtitle", "DocTalk identifies added, removed, and modified meaning with old/new citations so reviewers can verify both sides.")}
              </p>
            </div>
            <div className="grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] lg:min-w-[620px]">
              <label className="min-w-0">
                <span className="ed-label" style={{ display: "block", marginBottom: "6px" }}>
                  {tOr("diff.oldDocument", "Old document")}
                </span>
                <select
                  value={oldDocumentId}
                  onChange={(event) => setOldDocumentId(event.target.value)}
                  className="h-10 w-full"
                  style={edInputStyle}
                >
                  {readyDocs.map((doc) => (
                    <option key={doc.id} value={doc.id}>{doc.filename}</option>
                  ))}
                </select>
              </label>
              <label className="min-w-0">
                <span className="ed-label" style={{ display: "block", marginBottom: "6px" }}>
                  {tOr("diff.newDocument", "New document")}
                </span>
                <select
                  value={newDocumentId}
                  onChange={(event) => setNewDocumentId(event.target.value)}
                  className="h-10 w-full"
                  style={edInputStyle}
                >
                  {readyDocs.map((doc) => (
                    <option key={doc.id} value={doc.id}>{doc.filename}</option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                onClick={() => void runCompare()}
                disabled={isWorking || readyDocs.length < 2 || oldDocumentId === newDocumentId}
                className="ed-cta self-end disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isWorking ? <Clock3 size={15} aria-hidden="true" /> : <Play size={15} aria-hidden="true" />}
                {isWorking ? tOr("diff.running", "Comparing...") : tOr("diff.run", "Compare")}
              </button>
            </div>
          </div>
          {readyDocs.length < 2 && (
            <p
              className="ed-caption"
              style={{
                marginTop: "16px",
                border: "1px dashed var(--ed-rule)",
                background: "var(--ed-paper)",
                borderRadius: "3px",
                padding: "10px 14px",
              }}
            >
              {tOr("diff.needTwoDocs", "Upload or add at least two ready documents to compare.")}
            </p>
          )}
          {paywall && (
            <div
              className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
              style={{
                marginTop: "16px",
                border: "1px solid var(--ed-slate)",
                background: "var(--ed-paper)",
                borderRadius: "3px",
                padding: "12px 14px",
              }}
            >
              <span className="ed-body" style={{ marginTop: 0 }}>
                {paywall.code === "INSUFFICIENT_CREDITS"
                  ? tOr("diff.paywallCredits", "You need more credits to compare these documents.")
                  : tOr("diff.paywallPlan", "Document Diff is a Pro workflow.")}
              </span>
              <Link
                href={billingHref({ plan: "pro", source: collectionId ? "collection_reader" : "compare_page", reason: "document_diff" })}
                className="ed-cta"
              >
                {tOr("credits.upgradeToPro", "Upgrade to Pro")}
              </Link>
            </div>
          )}
          {error && (
            <div
              className="flex gap-2"
              style={{
                marginTop: "16px",
                border: "1px solid var(--ed-signal)",
                background: "var(--ed-paper)",
                borderRadius: "3px",
                padding: "10px 14px",
              }}
            >
              <AlertTriangle size={16} className="mt-0.5 shrink-0" style={{ color: "var(--ed-signal)" }} aria-hidden="true" />
              <span className="ed-body" style={{ marginTop: 0, color: "var(--ed-signal-deep)" }}>{error}</span>
            </div>
          )}
        </section>

        {activeRun ? (
          <section style={{ ...edPanelStyle, padding: 0 }}>
            <div
              className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
              style={{ borderBottom: "1px solid var(--ed-rule)", padding: "16px 20px" }}
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  {activeRun.status === "succeeded" ? (
                    <CheckCircle2 size={16} style={{ color: "var(--ed-signal)" }} aria-hidden="true" />
                  ) : (
                    <Clock3 size={16} style={{ color: "var(--ed-slate)" }} aria-hidden="true" />
                  )}
                  <h3 className="ed-h3 truncate" style={{ marginTop: 0 }}>
                    {oldName || tOr("diff.oldDocument", "Old document")} → {newName || tOr("diff.newDocument", "New document")}
                  </h3>
                </div>
                <p className="ed-caption" style={{ marginTop: "6px" }}>
                  {activeRun.status === "succeeded"
                    ? tOr("diff.completed", "Completed")
                    : tOr("diff.status", "Status: {status}", { status: activeRun.status })}
                </p>
              </div>
              {activeRun.result && (
                <div className="flex gap-2">
                  <button type="button" onClick={() => void handleExport("md")} className="inline-flex h-9 items-center gap-2" style={edExportBtnStyle}>
                    <Download size={14} aria-hidden="true" />
                    MD
                  </button>
                  <button type="button" onClick={() => void handleExport("csv")} className="inline-flex h-9 items-center gap-2" style={edExportBtnStyle}>
                    <Download size={14} aria-hidden="true" />
                    CSV
                  </button>
                </div>
              )}
            </div>


exec
/bin/zsh -lc "git diff --numstat 782f8b0..HEAD -- frontend/src/i18n frontend/messages frontend/src/messages frontend/public 2>/dev/null || true; git diff --name-only 782f8b0..HEAD | rg '(locale|i18n|messages|translations|\\.json"'$)'"' || true" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
exec
/bin/zsh -lc "rg -n 'fontWeight: [\"'\\'']?800|fontWeight.*800|font-weight.*800' frontend/node_modules/@tailwindcss/typography/src frontend/node_modules/@tailwindcss/typography 2>/dev/null | sed -n '1,200p'" in /Users/mayijie/Projects/Code/010_DocTalk
exec
/bin/zsh -lc "rg -n --glob '*.{tsx,ts,jsx,js}' '("'^|["'"'\\''"'` ])prose([ -]|["'"'\\''"'`])|prose-'"' frontend/src | sed -n '1,360p'" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
frontend/node_modules/@tailwindcss/typography/src/styles.js:1501:          fontWeight: '800',
frontend/node_modules/@tailwindcss/typography/src/styles.js:1512:          fontWeight: '800',
frontend/node_modules/@tailwindcss/typography/src/styles.js:1501:          fontWeight: '800',
frontend/node_modules/@tailwindcss/typography/src/styles.js:1512:          fontWeight: '800',

 succeeded in 0ms:
frontend/src/components/Chat/MessageBubble.tsx:303:              {/* Sources strip — rendered above the prose so the
frontend/src/components/Chat/MessageBubble.tsx:315:              <div className="prose prose-sm dark:prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 sm:prose-base">
frontend/src/components/TextViewer/TextViewer.tsx:713:    <div className={`prose dark:prose-invert max-w-none prose-zinc ${articleMode ? 'prose-base prose-p:leading-8 prose-li:leading-8 prose-headings:scroll-mt-28' : 'prose-sm'}
frontend/src/components/TextViewer/TextViewer.tsx:714:      prose-table:border-collapse prose-table:w-full prose-table:text-sm
frontend/src/components/TextViewer/TextViewer.tsx:715:      prose-th:border prose-th:border-zinc-300 prose-th:dark:border-zinc-600 prose-th:px-3 prose-th:py-2 prose-th:bg-zinc-50 prose-th:dark:bg-zinc-800 prose-th:text-left prose-th:font-semibold
frontend/src/components/TextViewer/TextViewer.tsx:716:      prose-td:border prose-td:border-zinc-200 prose-td:dark:border-zinc-700 prose-td:px-3 prose-td:py-1.5
frontend/src/components/TextViewer/TextViewer.tsx:717:      prose-tr:even:bg-zinc-50/50 prose-tr:even:dark:bg-zinc-800/30
frontend/src/components/TextViewer/TextViewer.tsx:718:      prose-pre:bg-zinc-100 prose-pre:dark:bg-zinc-800 prose-pre:rounded-lg
frontend/src/components/TextViewer/TextViewer.tsx:719:      prose-code:text-zinc-700 prose-code:dark:text-zinc-300
frontend/src/components/TextViewer/TextViewer.tsx:720:      prose-a:text-zinc-600 prose-a:dark:text-zinc-400 prose-a:underline
frontend/src/components/TextViewer/TextViewer.tsx:721:      prose-headings:text-zinc-900 prose-headings:dark:text-zinc-100
frontend/src/components/TextViewer/TextViewer.tsx:722:      prose-strong:text-zinc-900 prose-strong:dark:text-zinc-100

exec
/bin/zsh -lc "rg -n 'font-weight:(800|900)|font-weight: (800|900)' frontend/.next/static/css/*.css 2>/dev/null | wc -l; rg -o 'font-weight:(800|900)|font-weight: (800|900)' frontend/.next/static/css/*.css 2>/dev/null | sort | uniq -c" in /Users/mayijie/Projects/Code/010_DocTalk
exec
/bin/zsh -lc "rg -n 'font-weight:800|font-weight: 800' frontend/.next/static/css frontend/node_modules/@tailwindcss/typography frontend/node_modules/tailwindcss 2>/dev/null | sed -n '1,240p'" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
       1
   2 frontend/.next/static/css/feed39887bd94401.css:font-weight:800
   1 frontend/.next/static/css/feed39887bd94401.css:font-weight:900

 succeeded in 0ms:
frontend/.next/static/css/feed39887bd94401.css:3:*/*,:after,:before{box-sizing:border-box;border:0 solid #e5e7eb}:after,:before{--tw-content:""}:host,html{line-height:1.5;-webkit-text-size-adjust:100%;-moz-tab-size:4;-o-tab-size:4;tab-size:4;font-family:var(--dt-body);font-feature-settings:normal;font-variation-settings:normal;-webkit-tap-highlight-color:transparent}body{margin:0;line-height:inherit}hr{height:0;color:inherit;border-top-width:1px}abbr:where([title]){-webkit-text-decoration:underline dotted;text-decoration:underline dotted}h1,h2,h3,h4,h5,h6{font-size:inherit;font-weight:inherit}a{color:inherit;text-decoration:inherit}b,strong{font-weight:bolder}code,kbd,pre,samp{font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,Liberation Mono,Courier New,monospace;font-feature-settings:normal;font-variation-settings:normal;font-size:1em}small{font-size:80%}sub,sup{font-size:75%;line-height:0;position:relative;vertical-align:baseline}sub{bottom:-.25em}sup{top:-.5em}table{text-indent:0;border-color:inherit;border-collapse:collapse}button,input,optgroup,select,textarea{font-family:inherit;font-feature-settings:inherit;font-variation-settings:inherit;font-size:100%;font-weight:inherit;line-height:inherit;letter-spacing:inherit;color:inherit;margin:0;padding:0}button,select{text-transform:none}button,input:where([type=button]),input:where([type=reset]),input:where([type=submit]){-webkit-appearance:button;background-color:transparent;background-image:none}:-moz-focusring{outline:auto}:-moz-ui-invalid{box-shadow:none}progress{vertical-align:baseline}::-webkit-inner-spin-button,::-webkit-outer-spin-button{height:auto}[type=search]{-webkit-appearance:textfield;outline-offset:-2px}::-webkit-search-decoration{-webkit-appearance:none}::-webkit-file-upload-button{-webkit-appearance:button;font:inherit}summary{display:list-item}blockquote,dd,dl,figure,h1,h2,h3,h4,h5,h6,hr,p,pre{margin:0}fieldset{margin:0}fieldset,legend{padding:0}menu,ol,ul{list-style:none;margin:0;padding:0}dialog{padding:0}textarea{resize:vertical}input::-moz-placeholder,textarea::-moz-placeholder{opacity:1;color:#9ca3af}input::placeholder,textarea::placeholder{opacity:1;color:#9ca3af}[role=button],button{cursor:pointer}:disabled{cursor:default}audio,canvas,embed,iframe,img,object,svg,video{display:block;vertical-align:middle}img,video{max-width:100%;height:auto}[hidden]:where(:not([hidden=until-found])){display:none}.\!container{width:100%!important}.container{width:100%}@media (min-width:640px){.\!container{max-width:640px!important}.container{max-width:640px}}@media (min-width:768px){.\!container{max-width:768px!important}.container{max-width:768px}}@media (min-width:1024px){.\!container{max-width:1024px!important}.container{max-width:1024px}}@media (min-width:1280px){.\!container{max-width:1280px!important}.container{max-width:1280px}}@media (min-width:1536px){.\!container{max-width:1536px!important}.container{max-width:1536px}}.prose{color:var(--tw-prose-body);max-width:65ch}.prose :where(p):not(:where([class~=not-prose],[class~=not-prose] *)){margin-top:1.25em;margin-bottom:1.25em}.prose :where([class~=lead]):not(:where([class~=not-prose],[class~=not-prose] *)){color:var(--tw-prose-lead);font-size:1.25em;line-height:1.6;margin-top:1.2em;margin-bottom:1.2em}.prose :where(a):not(:where([class~=not-prose],[class~=not-prose] *)){color:var(--tw-prose-links);text-decoration:underline;font-weight:500}.prose :where(strong):not(:where([class~=not-prose],[class~=not-prose] *)){color:var(--tw-prose-bold);font-weight:600}.prose :where(a strong):not(:where([class~=not-prose],[class~=not-prose] *)){color:inherit}.prose :where(blockquote strong):not(:where([class~=not-prose],[class~=not-prose] *)){color:inherit}.prose :where(thead th strong):not(:where([class~=not-prose],[class~=not-prose] *)){color:inherit}.prose :where(ol):not(:where([class~=not-prose],[class~=not-prose] *)){list-style-type:decimal;margin-top:1.25em;margin-bottom:1.25em;padding-inline-start:1.625em}.prose :where(ol[type=A]):not(:where([class~=not-prose],[class~=not-prose] *)){list-style-type:upper-alpha}.prose :where(ol[type=a]):not(:where([class~=not-prose],[class~=not-prose] *)){list-style-type:lower-alpha}.prose :where(ol[type=A s]):not(:where([class~=not-prose],[class~=not-prose] *)){list-style-type:upper-alpha}.prose :where(ol[type=a s]):not(:where([class~=not-prose],[class~=not-prose] *)){list-style-type:lower-alpha}.prose :where(ol[type=I]):not(:where([class~=not-prose],[class~=not-prose] *)){list-style-type:upper-roman}.prose :where(ol[type=i]):not(:where([class~=not-prose],[class~=not-prose] *)){list-style-type:lower-roman}.prose :where(ol[type=I s]):not(:where([class~=not-prose],[class~=not-prose] *)){list-style-type:upper-roman}.prose :where(ol[type=i s]):not(:where([class~=not-prose],[class~=not-prose] *)){list-style-type:lower-roman}.prose :where(ol[type="1"]):not(:where([class~=not-prose],[class~=not-prose] *)){list-style-type:decimal}.prose :where(ul):not(:where([class~=not-prose],[class~=not-prose] *)){list-style-type:disc;margin-top:1.25em;margin-bottom:1.25em;padding-inline-start:1.625em}.prose :where(ol>li):not(:where([class~=not-prose],[class~=not-prose] *))::marker{font-weight:400;color:var(--tw-prose-counters)}.prose :where(ul>li):not(:where([class~=not-prose],[class~=not-prose] *))::marker{color:var(--tw-prose-bullets)}.prose :where(dt):not(:where([class~=not-prose],[class~=not-prose] *)){color:var(--tw-prose-headings);font-weight:600;margin-top:1.25em}.prose :where(hr):not(:where([class~=not-prose],[class~=not-prose] *)){border-color:var(--tw-prose-hr);border-top-width:1px;margin-top:3em;margin-bottom:3em}.prose :where(blockquote):not(:where([class~=not-prose],[class~=not-prose] *)){font-weight:500;font-style:italic;color:var(--tw-prose-quotes);border-inline-start-width:.25rem;border-inline-start-color:var(--tw-prose-quote-borders);quotes:"\201C""\201D""\2018""\2019";margin-top:1.6em;margin-bottom:1.6em;padding-inline-start:1em}.prose :where(blockquote p:first-of-type):not(:where([class~=not-prose],[class~=not-prose] *)):before{content:open-quote}.prose :where(blockquote p:last-of-type):not(:where([class~=not-prose],[class~=not-prose] *)):after{content:close-quote}.prose :where(h1):not(:where([class~=not-prose],[class~=not-prose] *)){color:var(--tw-prose-headings);font-weight:800;font-size:2.25em;margin-top:0;margin-bottom:.8888889em;line-height:1.1111111}.prose :where(h1 strong):not(:where([class~=not-prose],[class~=not-prose] *)){font-weight:900;color:inherit}.prose :where(h2):not(:where([class~=not-prose],[class~=not-prose] *)){color:var(--tw-prose-headings);font-weight:700;font-size:1.5em;margin-top:2em;margin-bottom:1em;line-height:1.3333333}.prose :where(h2 strong):not(:where([class~=not-prose],[class~=not-prose] *)){font-weight:800;color:inherit}.prose :where(h3):not(:where([class~=not-prose],[class~=not-prose] *)){color:var(--tw-prose-headings);font-weight:600;font-size:1.25em;margin-top:1.6em;margin-bottom:.6em;line-height:1.6}.prose :where(h3 strong):not(:where([class~=not-prose],[class~=not-prose] *)){font-weight:700;color:inherit}.prose :where(h4):not(:where([class~=not-prose],[class~=not-prose] *)){color:var(--tw-prose-headings);font-weight:600;margin-top:1.5em;margin-bottom:.5em;line-height:1.5}.prose :where(h4 strong):not(:where([class~=not-prose],[class~=not-prose] *)){font-weight:700;color:inherit}.prose :where(img):not(:where([class~=not-prose],[class~=not-prose] *)){margin-top:2em;margin-bottom:2em}.prose :where(picture):not(:where([class~=not-prose],[class~=not-prose] *)){display:block;margin-top:2em;margin-bottom:2em}.prose :where(video):not(:where([class~=not-prose],[class~=not-prose] *)){margin-top:2em;margin-bottom:2em}.prose :where(kbd):not(:where([class~=not-prose],[class~=not-prose] *)){font-weight:500;font-family:inherit;color:var(--tw-prose-kbd);box-shadow:0 0 0 1px var(--tw-prose-kbd-shadows),0 3px 0 var(--tw-prose-kbd-shadows);font-size:.875em;border-radius:.3125rem;padding-top:.1875em;padding-inline-end:.375em;padding-bottom:.1875em;padding-inline-start:.375em}.prose :where(code):not(:where([class~=not-prose],[class~=not-prose] *)){color:var(--tw-prose-code);font-weight:500;font-size:.875em;background-color:rgba(0,0,0,.06);border-radius:.375rem;padding:.125rem .375rem}.prose :where(code):not(:where([class~=not-prose],[class~=not-prose] *)):before{content:none}.prose :where(code):not(:where([class~=not-prose],[class~=not-prose] *)):after{content:none}.prose :where(a code):not(:where([class~=not-prose],[class~=not-prose] *)){color:inherit}.prose :where(h1 code):not(:where([class~=not-prose],[class~=not-prose] *)){color:inherit}.prose :where(h2 code):not(:where([class~=not-prose],[class~=not-prose] *)){color:inherit;font-size:.875em}.prose :where(h3 code):not(:where([class~=not-prose],[class~=not-prose] *)){color:inherit;font-size:.9em}.prose :where(h4 code):not(:where([class~=not-prose],[class~=not-prose] *)){color:inherit}.prose :where(blockquote code):not(:where([class~=not-prose],[class~=not-prose] *)){color:inherit}.prose :where(thead th code):not(:where([class~=not-prose],[class~=not-prose] *)){color:inherit}.prose :where(pre):not(:where([class~=not-prose],[class~=not-prose] *)){color:var(--tw-prose-pre-code);background-color:var(--tw-prose-pre-bg);overflow-x:auto;font-weight:400;font-size:.875em;line-height:1.7142857;margin-top:1.7142857em;margin-bottom:1.7142857em;border-radius:.375rem;padding-top:.8571429em;padding-inline-end:1.1428571em;padding-bottom:.8571429em;padding-inline-start:1.1428571em}.prose :where(pre code):not(:where([class~=not-prose],[class~=not-prose] *)){background-color:transparent;border-width:0;border-radius:0;padding:0;font-weight:inherit;color:inherit;font-size:inherit;font-family:inherit;line-height:inherit}.prose :where(pre code):not(:where([class~=not-prose],[class~=not-prose] *)):before{content:none}.prose :where(pre code):not(:where([class~=not-prose],[class~=not-prose] *)):after{content:none}.prose :where(table):not(:where([class~=not-prose],[class~=not-prose] *)){width:100%;table-layout:auto;margin-top:2em;margin-bottom:2em;font-size:.875em;line-height:1.7142857}.prose :where(thead):not(:where([class~=not-prose],[class~=not-prose] *)){border-bottom-width:1px;border-bottom-color:var(--tw-prose-th-borders)}.prose :where(thead th):not(:where([class~=not-prose],[class~=not-prose] *)){color:var(--tw-prose-headings);font-weight:600;vertical-align:bottom;padding-inline-end:.5714286em;padding-bottom:.5714286em;padding-inline-start:.5714286em}.prose :where(tbody tr):not(:where([class~=not-prose],[class~=not-prose] *)){border-bottom-width:1px;border-bottom-color:var(--tw-prose-td-borders)}.prose :where(tbody tr:last-child):not(:where([class~=not-prose],[class~=not-prose] *)){border-bottom-width:0}.prose :where(tbody td):not(:where([class~=not-prose],[class~=not-prose] *)){vertical-align:baseline}.prose :where(tfoot):not(:where([class~=not-prose],[class~=not-prose] *)){border-top-width:1px;border-top-color:var(--tw-prose-th-borders)}.prose :where(tfoot td):not(:where([class~=not-prose],[class~=not-prose] *)){vertical-align:top}.prose :where(th,td):not(:where([class~=not-prose],[class~=not-prose] *)){text-align:start}.prose :where(figure>*):not(:where([class~=not-prose],[class~=not-prose] *)){margin-top:0;margin-bottom:0}.prose :where(figcaption):not(:where([class~=not-prose],[class~=not-prose] *)){color:var(--tw-prose-captions);font-size:.875em;line-height:1.4285714;margin-top:.8571429em}.prose{--tw-prose-body:#09090b;--tw-prose-headings:#09090b;--tw-prose-lead:#4b5563;--tw-prose-links:#111827;--tw-prose-bold:#09090b;--tw-prose-counters:#6b7280;--tw-prose-bullets:#d1d5db;--tw-prose-hr:#e5e7eb;--tw-prose-quotes:#111827;--tw-prose-quote-borders:#e5e7eb;--tw-prose-captions:#6b7280;--tw-prose-kbd:#111827;--tw-prose-kbd-shadows:rgba(17,24,39,.1);--tw-prose-code:#111827;--tw-prose-pre-code:#e5e7eb;--tw-prose-pre-bg:#1f2937;--tw-prose-th-borders:#d1d5db;--tw-prose-td-borders:#e5e7eb;--tw-prose-invert-body:#d1d5db;--tw-prose-invert-headings:#fff;--tw-prose-invert-lead:#9ca3af;--tw-prose-invert-links:#fff;--tw-prose-invert-bold:#fff;--tw-prose-invert-counters:#9ca3af;--tw-prose-invert-bullets:#4b5563;--tw-prose-invert-hr:#374151;--tw-prose-invert-quotes:#f3f4f6;--tw-prose-invert-quote-borders:#374151;--tw-prose-invert-captions:#9ca3af;--tw-prose-invert-kbd:#fff;--tw-prose-invert-kbd-shadows:hsla(0,0%,100%,.1);--tw-prose-invert-code:#fff;--tw-prose-invert-pre-code:#d1d5db;--tw-prose-invert-pre-bg:rgba(0,0,0,.5);--tw-prose-invert-th-borders:#4b5563;--tw-prose-invert-td-borders:#374151;font-size:1rem;line-height:1.75}.prose :where(picture>img):not(:where([class~=not-prose],[class~=not-prose] *)){margin-top:0;margin-bottom:0}.prose :where(li):not(:where([class~=not-prose],[class~=not-prose] *)){margin-top:.5em;margin-bottom:.5em}.prose :where(ol>li):not(:where([class~=not-prose],[class~=not-prose] *)){padding-inline-start:.375em}.prose :where(ul>li):not(:where([class~=not-prose],[class~=not-prose] *)){padding-inline-start:.375em}.prose :where(.prose>ul>li p):not(:where([class~=not-prose],[class~=not-prose] *)){margin-top:.75em;margin-bottom:.75em}.prose :where(.prose>ul>li>p:first-child):not(:where([class~=not-prose],[class~=not-prose] *)){margin-top:1.25em}.prose :where(.prose>ul>li>p:last-child):not(:where([class~=not-prose],[class~=not-prose] *)){margin-bottom:1.25em}.prose :where(.prose>ol>li>p:first-child):not(:where([class~=not-prose],[class~=not-prose] *)){margin-top:1.25em}.prose :where(.prose>ol>li>p:last-child):not(:where([class~=not-prose],[class~=not-prose] *)){margin-bottom:1.25em}.prose :where(ul ul,ul ol,ol ul,ol ol):not(:where([class~=not-prose],[class~=not-prose] *)){margin-top:.75em;margin-bottom:.75em}.prose :where(dl):not(:where([class~=not-prose],[class~=not-prose] *)){margin-top:1.25em;margin-bottom:1.25em}.prose :where(dd):not(:where([class~=not-prose],[class~=not-prose] *)){margin-top:.5em;padding-inline-start:1.625em}.prose :where(hr+*):not(:where([class~=not-prose],[class~=not-prose] *)){margin-top:0}.prose :where(h2+*):not(:where([class~=not-prose],[class~=not-prose] *)){margin-top:0}.prose :where(h3+*):not(:where([class~=not-prose],[class~=not-prose] *)){margin-top:0}.prose :where(h4+*):not(:where([class~=not-prose],[class~=not-prose] *)){margin-top:0}.prose :where(thead th:first-child):not(:where([class~=not-prose],[class~=not-prose] *)){padding-inline-start:0}.prose :where(thead th:last-child):not(:where([class~=not-prose],[class~=not-prose] *)){padding-inline-end:0}.prose :where(tbody td,tfoot td):not(:where([class~=not-prose],[class~=not-prose] *)){padding-top:.5714286em;padding-inline-end:.5714286em;padding-bottom:.5714286em;padding-inline-start:.5714286em}.prose :where(tbody td:first-child,tfoot td:first-child):not(:where([class~=not-prose],[class~=not-prose] *)){padding-inline-start:0}.prose :where(tbody td:last-child,tfoot td:last-child):not(:where([class~=not-prose],[class~=not-prose] *)){padding-inline-end:0}.prose :where(figure):not(:where([class~=not-prose],[class~=not-prose] *)){margin-top:2em;margin-bottom:2em}.prose :where(.prose>:first-child):not(:where([class~=not-prose],[class~=not-prose] *)){margin-top:0}.prose :where(.prose>:last-child):not(:where([class~=not-prose],[class~=not-prose] *)){margin-bottom:0}.prose-sm{font-size:.875rem;line-height:1.7142857}.prose-sm :where(p):not(:where([class~=not-prose],[class~=not-prose] *)){margin-top:1.1428571em;margin-bottom:1.1428571em}.prose-sm :where([class~=lead]):not(:where([class~=not-prose],[class~=not-prose] *)){font-size:1.2857143em;line-height:1.5555556;margin-top:.8888889em;margin-bottom:.8888889em}.prose-sm :where(blockquote):not(:where([class~=not-prose],[class~=not-prose] *)){margin-top:1.3333333em;margin-bottom:1.3333333em;padding-inline-start:1.1111111em}.prose-sm :where(h1):not(:where([class~=not-prose],[class~=not-prose] *)){font-size:2.1428571em;margin-top:0;margin-bottom:.8em;line-height:1.2}.prose-sm :where(h2):not(:where([class~=not-prose],[class~=not-prose] *)){font-size:1.4285714em;margin-top:1.6em;margin-bottom:.8em;line-height:1.4}.prose-sm :where(h3):not(:where([class~=not-prose],[class~=not-prose] *)){font-size:1.2857143em;margin-top:1.5555556em;margin-bottom:.4444444em;line-height:1.5555556}.prose-sm :where(h4):not(:where([class~=not-prose],[class~=not-prose] *)){margin-top:1.4285714em;margin-bottom:.5714286em;line-height:1.4285714}.prose-sm :where(img):not(:where([class~=not-prose],[class~=not-prose] *)){margin-top:1.7142857em;margin-bottom:1.7142857em}.prose-sm :where(picture):not(:where([class~=not-prose],[class~=not-prose] *)){margin-top:1.7142857em;margin-bottom:1.7142857em}.prose-sm :where(picture>img):not(:where([class~=not-prose],[class~=not-prose] *)){margin-top:0;margin-bottom:0}.prose-sm :where(video):not(:where([class~=not-prose],[class~=not-prose] *)){margin-top:1.7142857em;margin-bottom:1.7142857em}.prose-sm :where(kbd):not(:where([class~=not-prose],[class~=not-prose] *)){font-size:.8571429em;border-radius:.3125rem;padding-top:.1428571em;padding-inline-end:.3571429em;padding-bottom:.1428571em;padding-inline-start:.3571429em}.prose-sm :where(code):not(:where([class~=not-prose],[class~=not-prose] *)){font-size:.8571429em}.prose-sm :where(h2 code):not(:where([class~=not-prose],[class~=not-prose] *)){font-size:.9em}.prose-sm :where(h3 code):not(:where([class~=not-prose],[class~=not-prose] *)){font-size:.8888889em}.prose-sm :where(pre):not(:where([class~=not-prose],[class~=not-prose] *)){font-size:.8571429em;line-height:1.6666667;margin-top:1.6666667em;margin-bottom:1.6666667em;border-radius:.25rem;padding-top:.6666667em;padding-inline-end:1em;padding-bottom:.6666667em;padding-inline-start:1em}.prose-sm :where(ol):not(:where([class~=not-prose],[class~=not-prose] *)){margin-top:1.1428571em;margin-bottom:1.1428571em;padding-inline-start:1.5714286em}.prose-sm :where(ul):not(:where([class~=not-prose],[class~=not-prose] *)){margin-top:1.1428571em;margin-bottom:1.1428571em;padding-inline-start:1.5714286em}.prose-sm :where(li):not(:where([class~=not-prose],[class~=not-prose] *)){margin-top:.2857143em;margin-bottom:.2857143em}.prose-sm :where(ol>li):not(:where([class~=not-prose],[class~=not-prose] *)){padding-inline-start:.4285714em}.prose-sm :where(ul>li):not(:where([class~=not-prose],[class~=not-prose] *)){padding-inline-start:.4285714em}.prose-sm :where(.prose-sm>ul>li p):not(:where([class~=not-prose],[class~=not-prose] *)){margin-top:.5714286em;margin-bottom:.5714286em}.prose-sm :where(.prose-sm>ul>li>p:first-child):not(:where([class~=not-prose],[class~=not-prose] *)){margin-top:1.1428571em}.prose-sm :where(.prose-sm>ul>li>p:last-child):not(:where([class~=not-prose],[class~=not-prose] *)){margin-bottom:1.1428571em}.prose-sm :where(.prose-sm>ol>li>p:first-child):not(:where([class~=not-prose],[class~=not-prose] *)){margin-top:1.1428571em}.prose-sm :where(.prose-sm>ol>li>p:last-child):not(:where([class~=not-prose],[class~=not-prose] *)){margin-bottom:1.1428571em}.prose-sm :where(ul ul,ul ol,ol ul,ol ol):not(:where([class~=not-prose],[class~=not-prose] *)){margin-top:.5714286em;margin-bottom:.5714286em}.prose-sm :where(dl):not(:where([class~=not-prose],[class~=not-prose] *)){margin-top:1.1428571em;margin-bottom:1.1428571em}.prose-sm :where(dt):not(:where([class~=not-prose],[class~=not-prose] *)){margin-top:1.1428571em}.prose-sm :where(dd):not(:where([class~=not-prose],[class~=not-prose] *)){margin-top:.2857143em;padding-inline-start:1.5714286em}.prose-sm :where(hr):not(:where([class~=not-prose],[class~=not-prose] *)){margin-top:2.8571429em;margin-bottom:2.8571429em}.prose-sm :where(hr+*):not(:where([class~=not-prose],[class~=not-prose] *)){margin-top:0}.prose-sm :where(h2+*):not(:where([class~=not-prose],[class~=not-prose] *)){margin-top:0}.prose-sm :where(h3+*):not(:where([class~=not-prose],[class~=not-prose] *)){margin-top:0}.prose-sm :where(h4+*):not(:where([class~=not-prose],[class~=not-prose] *)){margin-top:0}.prose-sm :where(table):not(:where([class~=not-prose],[class~=not-prose] *)){font-size:.8571429em;line-height:1.5}.prose-sm :where(thead th):not(:where([class~=not-prose],[class~=not-prose] *)){padding-inline-end:1em;padding-bottom:.6666667em;padding-inline-start:1em}.prose-sm :where(thead th:first-child):not(:where([class~=not-prose],[class~=not-prose] *)){padding-inline-start:0}.prose-sm :where(thead th:last-child):not(:where([class~=not-prose],[class~=not-prose] *)){padding-inline-end:0}.prose-sm :where(tbody td,tfoot td):not(:where([class~=not-prose],[class~=not-prose] *)){padding-top:.6666667em;padding-inline-end:1em;padding-bottom:.6666667em;padding-inline-start:1em}.prose-sm :where(tbody td:first-child,tfoot td:first-child):not(:where([class~=not-prose],[class~=not-prose] *)){padding-inline-start:0}.prose-sm :where(tbody td:last-child,tfoot td:last-child):not(:where([class~=not-prose],[class~=not-prose] *)){padding-inline-end:0}.prose-sm :where(figure):not(:where([class~=not-prose],[class~=not-prose] *)){margin-top:1.7142857em;margin-bottom:1.7142857em}.prose-sm :where(figure>*):not(:where([class~=not-prose],[class~=not-prose] *)){margin-top:0;margin-bottom:0}.prose-sm :where(figcaption):not(:where([class~=not-prose],[class~=not-prose] *)){font-size:.8571429em;line-height:1.3333333;margin-top:.6666667em}.prose-sm :where(.prose-sm>:first-child):not(:where([class~=not-prose],[class~=not-prose] *)){margin-top:0}.prose-sm :where(.prose-sm>:last-child):not(:where([class~=not-prose],[class~=not-prose] *)){margin-bottom:0}.prose-base{font-size:1rem;line-height:1.75}.prose-base :where(p):not(:where([class~=not-prose],[class~=not-prose] *)){margin-top:1.25em;margin-bottom:1.25em}.prose-base :where([class~=lead]):not(:where([class~=not-prose],[class~=not-prose] *)){font-size:1.25em;line-height:1.6;margin-top:1.2em;margin-bottom:1.2em}.prose-base :where(blockquote):not(:where([class~=not-prose],[class~=not-prose] *)){margin-top:1.6em;margin-bottom:1.6em;padding-inline-start:1em}.prose-base :where(h1):not(:where([class~=not-prose],[class~=not-prose] *)){font-size:2.25em;margin-top:0;margin-bottom:.8888889em;line-height:1.1111111}.prose-base :where(h2):not(:where([class~=not-prose],[class~=not-prose] *)){font-size:1.5em;margin-top:2em;margin-bottom:1em;line-height:1.3333333}.prose-base :where(h3):not(:where([class~=not-prose],[class~=not-prose] *)){font-size:1.25em;margin-top:1.6em;margin-bottom:.6em;line-height:1.6}.prose-base :where(h4):not(:where([class~=not-prose],[class~=not-prose] *)){margin-top:1.5em;margin-bottom:.5em;line-height:1.5}.prose-base :where(img):not(:where([class~=not-prose],[class~=not-prose] *)){margin-top:2em;margin-bottom:2em}.prose-base :where(picture):not(:where([class~=not-prose],[class~=not-prose] *)){margin-top:2em;margin-bottom:2em}.prose-base :where(picture>img):not(:where([class~=not-prose],[class~=not-prose] *)){margin-top:0;margin-bottom:0}.prose-base :where(video):not(:where([class~=not-prose],[class~=not-prose] *)){margin-top:2em;margin-bottom:2em}.prose-base :where(kbd):not(:where([class~=not-prose],[class~=not-prose] *)){font-size:.875em;border-radius:.3125rem;padding-top:.1875em;padding-inline-end:.375em;padding-bottom:.1875em;padding-inline-start:.375em}.prose-base :where(code):not(:where([class~=not-prose],[class~=not-prose] *)){font-size:.875em}.prose-base :where(h2 code):not(:where([class~=not-prose],[class~=not-prose] *)){font-size:.875em}.prose-base :where(h3 code):not(:where([class~=not-prose],[class~=not-prose] *)){font-size:.9em}.prose-base :where(pre):not(:where([class~=not-prose],[class~=not-prose] *)){font-size:.875em;line-height:1.7142857;margin-top:1.7142857em;margin-bottom:1.7142857em;border-radius:.375rem;padding-top:.8571429em;padding-inline-end:1.1428571em;padding-bottom:.8571429em;padding-inline-start:1.1428571em}.prose-base :where(ol):not(:where([class~=not-prose],[class~=not-prose] *)){margin-top:1.25em;margin-bottom:1.25em;padding-inline-start:1.625em}.prose-base :where(ul):not(:where([class~=not-prose],[class~=not-prose] *)){margin-top:1.25em;margin-bottom:1.25em;padding-inline-start:1.625em}.prose-base :where(li):not(:where([class~=not-prose],[class~=not-prose] *)){margin-top:.5em;margin-bottom:.5em}.prose-base :where(ol>li):not(:where([class~=not-prose],[class~=not-prose] *)){padding-inline-start:.375em}.prose-base :where(ul>li):not(:where([class~=not-prose],[class~=not-prose] *)){padding-inline-start:.375em}.prose-base :where(.prose-base>ul>li p):not(:where([class~=not-prose],[class~=not-prose] *)){margin-top:.75em;margin-bottom:.75em}.prose-base :where(.prose-base>ul>li>p:first-child):not(:where([class~=not-prose],[class~=not-prose] *)){margin-top:1.25em}.prose-base :where(.prose-base>ul>li>p:last-child):not(:where([class~=not-prose],[class~=not-prose] *)){margin-bottom:1.25em}.prose-base :where(.prose-base>ol>li>p:first-child):not(:where([class~=not-prose],[class~=not-prose] *)){margin-top:1.25em}.prose-base :where(.prose-base>ol>li>p:last-child):not(:where([class~=not-prose],[class~=not-prose] *)){margin-bottom:1.25em}.prose-base :where(ul ul,ul ol,ol ul,ol ol):not(:where([class~=not-prose],[class~=not-prose] *)){margin-top:.75em;margin-bottom:.75em}.prose-base :where(dl):not(:where([class~=not-prose],[class~=not-prose] *)){margin-top:1.25em;margin-bottom:1.25em}.prose-base :where(dt):not(:where([class~=not-prose],[class~=not-prose] *)){margin-top:1.25em}.prose-base :where(dd):not(:where([class~=not-prose],[class~=not-prose] *)){margin-top:.5em;padding-inline-start:1.625em}.prose-base :where(hr):not(:where([class~=not-prose],[class~=not-prose] *)){margin-top:3em;margin-bottom:3em}.prose-base :where(hr+*):not(:where([class~=not-prose],[class~=not-prose] *)){margin-top:0}.prose-base :where(h2+*):not(:where([class~=not-prose],[class~=not-prose] *)){margin-top:0}.prose-base :where(h3+*):not(:where([class~=not-prose],[class~=not-prose] *)){margin-top:0}.prose-base :where(h4+*):not(:where([class~=not-prose],[class~=not-prose] *)){margin-top:0}.prose-base :where(table):not(:where([class~=not-prose],[class~=not-prose] *)){font-size:.875em;line-height:1.7142857}.prose-base :where(thead th):not(:where([class~=not-prose],[class~=not-prose] *)){padding-inline-end:.5714286em;padding-bottom:.5714286em;padding-inline-start:.5714286em}.prose-base :where(thead th:first-child):not(:where([class~=not-prose],[class~=not-prose] *)){padding-inline-start:0}.prose-base :where(thead th:last-child):not(:where([class~=not-prose],[class~=not-prose] *)){padding-inline-end:0}.prose-base :where(tbody td,tfoot td):not(:where([class~=not-prose],[class~=not-prose] *)){padding-top:.5714286em;padding-inline-end:.5714286em;padding-bottom:.5714286em;padding-inline-start:.5714286em}.prose-base :where(tbody td:first-child,tfoot td:first-child):not(:where([class~=not-prose],[class~=not-prose] *)){padding-inline-start:0}.prose-base :where(tbody td:last-child,tfoot td:last-child):not(:where([class~=not-prose],[class~=not-prose] *)){padding-inline-end:0}.prose-base :where(figure):not(:where([class~=not-prose],[class~=not-prose] *)){margin-top:2em;margin-bottom:2em}.prose-base :where(figure>*):not(:where([class~=not-prose],[class~=not-prose] *)){margin-top:0;margin-bottom:0}.prose-base :where(figcaption):not(:where([class~=not-prose],[class~=not-prose] *)){font-size:.875em;line-height:1.4285714;margin-top:.8571429em}.prose-base :where(.prose-base>:first-child):not(:where([class~=not-prose],[class~=not-prose] *)){margin-top:0}.prose-base :where(.prose-base>:last-child):not(:where([class~=not-prose],[class~=not-prose] *)){margin-bottom:0}.prose-zinc{--tw-prose-body:#3f3f46;--tw-prose-headings:#18181b;--tw-prose-lead:#52525b;--tw-prose-links:#18181b;--tw-prose-bold:#18181b;--tw-prose-counters:#71717a;--tw-prose-bullets:#d4d4d8;--tw-prose-hr:#e4e4e7;--tw-prose-quotes:#18181b;--tw-prose-quote-borders:#e4e4e7;--tw-prose-captions:#71717a;--tw-prose-kbd:#18181b;--tw-prose-kbd-shadows:rgba(24,24,27,.1);--tw-prose-code:#18181b;--tw-prose-pre-code:#e4e4e7;--tw-prose-pre-bg:#27272a;--tw-prose-th-borders:#d4d4d8;--tw-prose-td-borders:#e4e4e7;--tw-prose-invert-body:#d4d4d8;--tw-prose-invert-headings:#fff;--tw-prose-invert-lead:#a1a1aa;--tw-prose-invert-links:#fff;--tw-prose-invert-bold:#fff;--tw-prose-invert-counters:#a1a1aa;--tw-prose-invert-bullets:#52525b;--tw-prose-invert-hr:#3f3f46;--tw-prose-invert-quotes:#f4f4f5;--tw-prose-invert-quote-borders:#3f3f46;--tw-prose-invert-captions:#a1a1aa;--tw-prose-invert-kbd:#fff;--tw-prose-invert-kbd-shadows:hsla(0,0%,100%,.1);--tw-prose-invert-code:#fff;--tw-prose-invert-pre-code:#d4d4d8;--tw-prose-invert-pre-bg:rgba(0,0,0,.5);--tw-prose-invert-th-borders:#52525b;--tw-prose-invert-td-borders:#3f3f46}.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border-width:0}.pointer-events-none{pointer-events:none}.pointer-events-auto{pointer-events:auto}.\!visible{visibility:visible!important}.visible{visibility:visible}.invisible{visibility:hidden}.collapse{visibility:collapse}.static{position:static}.fixed{position:fixed}.absolute{position:absolute}.relative{position:relative}.sticky{position:sticky}.-inset-\[40\%\]{inset:-40%}.inset-0{inset:0}.-left-0\.5{left:-.125rem}.-left-1{left:-.25rem}.-top-0\.5{top:-.125rem}.-top-1{top:-.25rem}.bottom-2{bottom:.5rem}.bottom-3{bottom:.75rem}.bottom-full{bottom:100%}.left-0{left:0}.left-2{left:.5rem}.left-3{left:.75rem}.left-\[-9999px\]{left:-9999px}.right-0{right:0}.right-3{right:.75rem}.top-0{top:0}.top-1\/2{top:50%}.top-24{top:6rem}.top-\[calc\(env\(safe-area-inset-top\2c 0px\)\+4\.75rem\)\]{top:calc(env(safe-area-inset-top,0px) + 4.75rem)}.top-\[calc\(env\(safe-area-inset-top\2c 0px\)\+9\.5rem\)\]{top:calc(env(safe-area-inset-top,0px) + 9.5rem)}.top-full{top:100%}.isolate{isolation:isolate}.z-10{z-index:10}.z-20{z-index:20}.z-30{z-index:30}.z-40{z-index:40}.z-50{z-index:50}.z-\[10000\]{z-index:10000}.z-\[12000\]{z-index:12000}.z-\[1\]{z-index:1}.z-\[60\]{z-index:60}.m-0{margin:0}.-mx-4{margin-left:-1rem;margin-right:-1rem}.-my-4{margin-top:-1rem;margin-bottom:-1rem}.mx-0\.5{margin-left:.125rem;margin-right:.125rem}.mx-1{margin-left:.25rem;margin-right:.25rem}.mx-4{margin-left:1rem;margin-right:1rem}.mx-auto{margin-left:auto;margin-right:auto}.my-1{margin-top:.25rem;margin-bottom:.25rem}.my-4{margin-top:1rem;margin-bottom:1rem}.my-6{margin-top:1.5rem;margin-bottom:1.5rem}.-mt-2{margin-top:-.5rem}.mb-0{margin-bottom:0}.mb-1{margin-bottom:.25rem}.mb-1\.5{margin-bottom:.375rem}.mb-10{margin-bottom:2.5rem}.mb-12{margin-bottom:3rem}.mb-2{margin-bottom:.5rem}.mb-3{margin-bottom:.75rem}.mb-4{margin-bottom:1rem}.mb-5{margin-bottom:1.25rem}.mb-6{margin-bottom:1.5rem}.mb-8{margin-bottom:2rem}.ml-0\.5{margin-left:.125rem}.ml-1{margin-left:.25rem}.ml-2{margin-left:.5rem}.ml-4{margin-left:1rem}.ml-auto{margin-left:auto}.mr-1{margin-right:.25rem}.mr-2{margin-right:.5rem}.mt-0{margin-top:0}.mt-0\.5{margin-top:.125rem}.mt-1{margin-top:.25rem}.mt-1\.5{margin-top:.375rem}.mt-10{margin-top:2.5rem}.mt-12{margin-top:3rem}.mt-16{margin-top:4rem}.mt-2{margin-top:.5rem}.mt-3{margin-top:.75rem}.mt-4{margin-top:1rem}.mt-5{margin-top:1.25rem}.mt-6{margin-top:1.5rem}.mt-7{margin-top:1.75rem}.mt-8{margin-top:2rem}.mt-auto{margin-top:auto}.line-clamp-2{-webkit-line-clamp:2}.line-clamp-2,.line-clamp-4{overflow:hidden;display:-webkit-box;-webkit-box-orient:vertical}.line-clamp-4{-webkit-line-clamp:4}.block{display:block}.inline-block{display:inline-block}.inline{display:inline}.flex{display:flex}.inline-flex{display:inline-flex}.table{display:table}.grid{display:grid}.hidden{display:none}.aspect-video{aspect-ratio:16/9}.h-0\.5{height:.125rem}.h-1{height:.25rem}.h-1\.5{height:.375rem}.h-10{height:2.5rem}.h-11{height:2.75rem}.h-12{height:3rem}.h-14{height:3.5rem}.h-16{height:4rem}.h-2{height:.5rem}.h-2\.5{height:.625rem}.h-20{height:5rem}.h-24{height:6rem}.h-28{height:7rem}.h-3{height:.75rem}.h-3\.5{height:.875rem}.h-4{height:1rem}.h-40{height:10rem}.h-48{height:12rem}.h-5{height:1.25rem}.h-56{height:14rem}.h-6{height:1.5rem}.h-64{height:16rem}.h-7{height:1.75rem}.h-72{height:18rem}.h-8{height:2rem}.h-9{height:2.25rem}.h-\[1\.125rem\]{height:1.125rem}.h-\[18px\]{height:18px}.h-\[calc\(100\%\+2rem\)\]{height:calc(100% + 2rem)}.h-full{height:100%}.h-px{height:1px}.h-screen{height:100vh}.max-h-0{max-height:0}.max-h-40{max-height:10rem}.max-h-52{max-height:13rem}.max-h-64{max-height:16rem}.max-h-72{max-height:18rem}.max-h-96{max-height:24rem}.max-h-\[80vh\]{max-height:80vh}.max-h-\[85vh\]{max-height:85vh}.max-h-\[min\(92dvh\2c 760px\)\]{max-height:min(92dvh,760px)}.min-h-0{min-height:0}.min-h-10{min-height:2.5rem}.min-h-11{min-height:2.75rem}.min-h-12{min-height:3rem}.min-h-24{min-height:6rem}.min-h-32{min-height:8rem}.min-h-6{min-height:1.5rem}.min-h-7{min-height:1.75rem}.min-h-8{min-height:2rem}.min-h-9{min-height:2.25rem}.min-h-\[132px\]{min-height:132px}.min-h-\[210px\]{min-height:210px}.min-h-\[40px\]{min-height:40px}.min-h-\[60vh\]{min-height:60vh}.min-h-\[calc\(100vh-4rem\)\]{min-height:calc(100vh - 4rem)}.min-h-full{min-height:100%}.min-h-screen{min-height:100vh}.w-1{width:.25rem}.w-1\.5{width:.375rem}.w-1\/2{width:50%}.w-10{width:2.5rem}.w-10\/12{width:83.333333%}.w-11{width:2.75rem}.w-11\/12{width:91.666667%}.w-12{width:3rem}.w-14{width:3.5rem}.w-16{width:4rem}.w-2{width:.5rem}.w-2\.5{width:.625rem}.w-2\/3{width:66.666667%}.w-2\/5{width:40%}.w-20{width:5rem}.w-24{width:6rem}.w-28{width:7rem}.w-3{width:.75rem}.w-3\.5{width:.875rem}.w-3\/4{width:75%}.w-32{width:8rem}.w-36{width:9rem}.w-4{width:1rem}.w-4\/5{width:80%}.w-44{width:11rem}.w-5{width:1.25rem}.w-5\/6{width:83.333333%}.w-56{width:14rem}.w-6{width:1.5rem}.w-7{width:1.75rem}.w-7\/12{width:58.333333%}.w-72{width:18rem}.w-8{width:2rem}.w-9{width:2.25rem}.w-9\/12{width:75%}.w-\[18px\]{width:18px}.w-\[22\%\]{width:22%}.w-\[30\%\]{width:30%}.w-\[34\%\]{width:34%}.w-\[3px\]{width:3px}.w-\[40\%\]{width:40%}.w-full{width:100%}.w-px{width:1px}.min-w-0{min-width:0}.min-w-12{min-width:3rem}.min-w-4{min-width:1rem}.min-w-5{min-width:1.25rem}.min-w-6{min-width:1.5rem}.min-w-8{min-width:2rem}.min-w-\[1\.125rem\]{min-width:1.125rem}.min-w-\[480px\]{min-width:480px}.min-w-\[4rem\]{min-width:4rem}.min-w-\[520px\]{min-width:520px}.min-w-\[620px\]{min-width:620px}.min-w-\[760px\]{min-width:760px}.min-w-full{min-width:100%}.max-w-2xl{max-width:42rem}.max-w-3xl{max-width:48rem}.max-w-40{max-width:10rem}.max-w-4xl{max-width:56rem}.max-w-5xl{max-width:64rem}.max-w-6xl{max-width:72rem}.max-w-\[120px\]{max-width:120px}.max-w-\[140px\]{max-width:140px}.max-w-\[180px\]{max-width:180px}.max-w-\[220px\]{max-width:220px}.max-w-\[22rem\]{max-width:22rem}.max-w-\[440px\]{max-width:440px}.max-w-\[460px\]{max-width:460px}.max-w-\[72px\]{max-width:72px}.max-w-\[760px\]{max-width:760px}.max-w-\[780px\]{max-width:780px}.max-w-\[80\%\]{max-width:80%}.max-w-\[calc\(100vw-2rem\)\]{max-width:calc(100vw - 2rem)}.max-w-full{max-width:100%}.max-w-lg{max-width:32rem}.max-w-md{max-width:28rem}.max-w-none{max-width:none}.max-w-sm{max-width:24rem}.max-w-xl{max-width:36rem}.max-w-xs{max-width:20rem}.flex-1{flex:1 1 0%}.flex-none{flex:none}.flex-shrink-0,.shrink-0{flex-shrink:0}.border-collapse{border-collapse:collapse}.border-separate{border-collapse:separate}.border-spacing-1{--tw-border-spacing-x:0.25rem;--tw-border-spacing-y:0.25rem;border-spacing:var(--tw-border-spacing-x) var(--tw-border-spacing-y)}.-translate-x-6{--tw-translate-x:-1.5rem}.-translate-x-6,.-translate-y-1\/2{transform:translate(var(--tw-translate-x),var(--tw-translate-y)) rotate(var(--tw-rotate)) skewX(var(--tw-skew-x)) skewY(var(--tw-skew-y)) scaleX(var(--tw-scale-x)) scaleY(var(--tw-scale-y))}.-translate-y-1\/2{--tw-translate-y:-50%}.-translate-y-6{--tw-translate-y:-1.5rem}.-translate-y-6,.translate-x-0{transform:translate(var(--tw-translate-x),var(--tw-translate-y)) rotate(var(--tw-rotate)) skewX(var(--tw-skew-x)) skewY(var(--tw-skew-y)) scaleX(var(--tw-scale-x)) scaleY(var(--tw-scale-y))}.translate-x-0{--tw-translate-x:0px}.translate-x-6{--tw-translate-x:1.5rem}.translate-x-6,.translate-y-0{transform:translate(var(--tw-translate-x),var(--tw-translate-y)) rotate(var(--tw-rotate)) skewX(var(--tw-skew-x)) skewY(var(--tw-skew-y)) scaleX(var(--tw-scale-x)) scaleY(var(--tw-scale-y))}.translate-y-0{--tw-translate-y:0px}.translate-y-3{--tw-translate-y:0.75rem}.translate-y-3,.translate-y-6{transform:translate(var(--tw-translate-x),var(--tw-translate-y)) rotate(var(--tw-rotate)) skewX(var(--tw-skew-x)) skewY(var(--tw-skew-y)) scaleX(var(--tw-scale-x)) scaleY(var(--tw-scale-y))}.translate-y-6{--tw-translate-y:1.5rem}.translate-y-\[10px\]{--tw-translate-y:10px}.rotate-180,.translate-y-\[10px\]{transform:translate(var(--tw-translate-x),var(--tw-translate-y)) rotate(var(--tw-rotate)) skewX(var(--tw-skew-x)) skewY(var(--tw-skew-y)) scaleX(var(--tw-scale-x)) scaleY(var(--tw-scale-y))}.rotate-180{--tw-rotate:180deg}.transform{transform:translate(var(--tw-translate-x),var(--tw-translate-y)) rotate(var(--tw-rotate)) skewX(var(--tw-skew-x)) skewY(var(--tw-skew-y)) scaleX(var(--tw-scale-x)) scaleY(var(--tw-scale-y))}.animate-\[slideUp_0\.3s_ease-out\]{animation:slideUp .3s ease-out}@keyframes bounce{0%,to{transform:translateY(-25%);animation-timing-function:cubic-bezier(.8,0,1,1)}50%{transform:none;animation-timing-function:cubic-bezier(0,0,.2,1)}}.animate-bounce{animation:bounce 1s infinite}.animate-fade-in{animation:fade-in .15s ease-out}@keyframes pulse{50%{opacity:.5}}.animate-pulse{animation:pulse 2s cubic-bezier(.4,0,.6,1) infinite}@keyframes slide-up{0%{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}.animate-slide-up{animation:slide-up .2s ease-out}@keyframes spin{to{transform:rotate(1turn)}}.animate-spin{animation:spin 1s linear infinite}.cursor-col-resize{cursor:col-resize}.cursor-default{cursor:default}.cursor-grab{cursor:grab}.cursor-grabbing{cursor:grabbing}.cursor-not-allowed{cursor:not-allowed}.cursor-pointer{cursor:pointer}.select-none{-webkit-user-select:none;-moz-user-select:none;user-select:none}.resize-none{resize:none}.resize-y{resize:vertical}.resize{resize:both}.scroll-mt-28{scroll-margin-top:7rem}.scroll-mt-6{scroll-margin-top:1.5rem}.grid-cols-1{grid-template-columns:repeat(1,minmax(0,1fr))}.grid-cols-2{grid-template-columns:repeat(2,minmax(0,1fr))}.grid-cols-3{grid-template-columns:repeat(3,minmax(0,1fr))}.grid-cols-\[110px_1fr_44px\]{grid-template-columns:110px 1fr 44px}.grid-cols-\[minmax\(120px\2c 180px\)_1fr_auto\]{grid-template-columns:minmax(120px,180px) 1fr auto}.flex-col{flex-direction:column}.flex-col-reverse{flex-direction:column-reverse}.flex-wrap{flex-wrap:wrap}.items-start{align-items:flex-start}.items-end{align-items:flex-end}.items-center{align-items:center}.items-baseline{align-items:baseline}.items-stretch{align-items:stretch}.justify-start{justify-content:flex-start}.justify-end{justify-content:flex-end}.justify-center{justify-content:center}.justify-between{justify-content:space-between}.gap-0{gap:0}.gap-0\.5{gap:.125rem}.gap-1{gap:.25rem}.gap-1\.5{gap:.375rem}.gap-10{gap:2.5rem}.gap-2{gap:.5rem}.gap-2\.5{gap:.625rem}.gap-3{gap:.75rem}.gap-4{gap:1rem}.gap-5{gap:1.25rem}.gap-6{gap:1.5rem}.gap-8{gap:2rem}.gap-\[3px\]{gap:3px}.gap-x-2\.5{-moz-column-gap:.625rem;column-gap:.625rem}.gap-x-3{-moz-column-gap:.75rem;column-gap:.75rem}.gap-x-4{-moz-column-gap:1rem;column-gap:1rem}.gap-x-6{-moz-column-gap:1.5rem;column-gap:1.5rem}.gap-y-1{row-gap:.25rem}.gap-y-1\.5{row-gap:.375rem}.gap-y-2{row-gap:.5rem}.gap-y-2\.5{row-gap:.625rem}.gap-y-3{row-gap:.75rem}.space-y-1>:not([hidden])~:not([hidden]){--tw-space-y-reverse:0;margin-top:calc(.25rem * calc(1 - var(--tw-space-y-reverse)));margin-bottom:calc(.25rem * var(--tw-space-y-reverse))}.space-y-2>:not([hidden])~:not([hidden]){--tw-space-y-reverse:0;margin-top:calc(.5rem * calc(1 - var(--tw-space-y-reverse)));margin-bottom:calc(.5rem * var(--tw-space-y-reverse))}.space-y-3>:not([hidden])~:not([hidden]){--tw-space-y-reverse:0;margin-top:calc(.75rem * calc(1 - var(--tw-space-y-reverse)));margin-bottom:calc(.75rem * var(--tw-space-y-reverse))}.space-y-4>:not([hidden])~:not([hidden]){--tw-space-y-reverse:0;margin-top:calc(1rem * calc(1 - var(--tw-space-y-reverse)));margin-bottom:calc(1rem * var(--tw-space-y-reverse))}.space-y-5>:not([hidden])~:not([hidden]){--tw-space-y-reverse:0;margin-top:calc(1.25rem * calc(1 - var(--tw-space-y-reverse)));margin-bottom:calc(1.25rem * var(--tw-space-y-reverse))}.space-y-6>:not([hidden])~:not([hidden]){--tw-space-y-reverse:0;margin-top:calc(1.5rem * calc(1 - var(--tw-space-y-reverse)));margin-bottom:calc(1.5rem * var(--tw-space-y-reverse))}.divide-y>:not([hidden])~:not([hidden]){--tw-divide-y-reverse:0;border-top-width:calc(1px * calc(1 - var(--tw-divide-y-reverse)));border-bottom-width:calc(1px * var(--tw-divide-y-reverse))}.divide-zinc-100>:not([hidden])~:not([hidden]){--tw-divide-opacity:1;border-color:rgb(244 244 245/var(--tw-divide-opacity,1))}.self-start{align-self:flex-start}.self-end{align-self:flex-end}.overflow-auto{overflow:auto}.overflow-hidden{overflow:hidden}.overflow-x-auto{overflow-x:auto}.overflow-y-auto{overflow-y:auto}.overflow-x-hidden{overflow-x:hidden}.overscroll-contain{overscroll-behavior:contain}.truncate{overflow:hidden;text-overflow:ellipsis}.truncate,.whitespace-nowrap{white-space:nowrap}.whitespace-pre-wrap{white-space:pre-wrap}.break-words{overflow-wrap:break-word}.rounded{border-radius:.25rem}.rounded-2xl{border-radius:1rem}.rounded-\[1\.75rem\]{border-radius:1.75rem}.rounded-\[2rem\]{border-radius:2rem}.rounded-\[3px\]{border-radius:3px}.rounded-\[inherit\]{border-radius:inherit}.rounded-full{border-radius:9999px}.rounded-lg{border-radius:.5rem}.rounded-md{border-radius:.375rem}.rounded-sm{border-radius:.125rem}.rounded-xl{border-radius:.75rem}.rounded-b-xl{border-bottom-right-radius:.75rem}.rounded-b-xl,.rounded-l-xl{border-bottom-left-radius:.75rem}.rounded-l-xl{border-top-left-radius:.75rem}.rounded-r-xl{border-top-right-radius:.75rem;border-bottom-right-radius:.75rem}.rounded-t-lg{border-top-left-radius:.5rem;border-top-right-radius:.5rem}.border{border-width:1px}.border-2{border-width:2px}.border-\[1\.5px\]{border-width:1.5px}.border-\[2\.5px\]{border-width:2.5px}.border-x{border-left-width:1px;border-right-width:1px}.border-x-2{border-left-width:2px;border-right-width:2px}.border-y{border-top-width:1px}.border-b,.border-y{border-bottom-width:1px}.border-b-2{border-bottom-width:2px}.border-l-2{border-left-width:2px}.border-r{border-right-width:1px}.border-t{border-top-width:1px}.border-t-2{border-top-width:2px}.border-dashed{border-style:dashed}.border-none{border-style:none}.border-\[var\(--ed-rule\)\]{border-color:var(--ed-rule)}.border-\[var\(--ed-signal\)\]{border-color:var(--ed-signal)}.border-\[var\(--ed-slate\)\]{border-color:var(--ed-slate)}.border-\[var\(--reader-border\)\]{border-color:var(--reader-border)}.border-\[var\(--reader-evidence\)\]{border-color:var(--reader-evidence)}.border-\[var\(--reader-evidence-border\)\]{border-color:var(--reader-evidence-border)}.border-\[var\(--workbench-border\)\]{border-color:var(--workbench-border)}.border-accent{border-color:var(--accent)}.border-amber-200{--tw-border-opacity:1;border-color:rgb(253 230 138/var(--tw-border-opacity,1))}.border-amber-300{--tw-border-opacity:1;border-color:rgb(252 211 77/var(--tw-border-opacity,1))}.border-amber-300\/40{border-color:rgba(252,211,77,.4)}.border-amber-500{--tw-border-opacity:1;border-color:rgb(245 158 11/var(--tw-border-opacity,1))}.border-blue-200{--tw-border-opacity:1;border-color:rgb(191 219 254/var(--tw-border-opacity,1))}.border-blue-300{--tw-border-opacity:1;border-color:rgb(147 197 253/var(--tw-border-opacity,1))}.border-blue-300\/40{border-color:rgba(147,197,253,.4)}.border-blue-500{--tw-border-opacity:1;border-color:rgb(59 130 246/var(--tw-border-opacity,1))}.border-blue-600{--tw-border-opacity:1;border-color:rgb(37 99 235/var(--tw-border-opacity,1))}.border-blue-700{--tw-border-opacity:1;border-color:rgb(29 78 216/var(--tw-border-opacity,1))}.border-emerald-200{--tw-border-opacity:1;border-color:rgb(167 243 208/var(--tw-border-opacity,1))}.border-emerald-300{--tw-border-opacity:1;border-color:rgb(110 231 183/var(--tw-border-opacity,1))}.border-red-200{--tw-border-opacity:1;border-color:rgb(254 202 202/var(--tw-border-opacity,1))}.border-red-300{--tw-border-opacity:1;border-color:rgb(252 165 165/var(--tw-border-opacity,1))}.border-red-300\/40{border-color:hsla(0,94%,82%,.4)}.border-transparent{border-color:transparent}.border-white\/10{border-color:hsla(0,0%,100%,.1)}.border-zinc-100{--tw-border-opacity:1;border-color:rgb(244 244 245/var(--tw-border-opacity,1))}.border-zinc-200{--tw-border-opacity:1;border-color:rgb(228 228 231/var(--tw-border-opacity,1))}.border-zinc-200\/80{border-color:hsla(240,6%,90%,.8)}.border-zinc-300{--tw-border-opacity:1;border-color:rgb(212 212 216/var(--tw-border-opacity,1))}.border-zinc-300\/90{border-color:hsla(240,5%,84%,.9)}.border-zinc-400{--tw-border-opacity:1;border-color:rgb(161 161 170/var(--tw-border-opacity,1))}.border-zinc-900{--tw-border-opacity:1;border-color:rgb(24 24 27/var(--tw-border-opacity,1))}.border-t-accent{border-top-color:var(--accent)}.bg-\[\#1D4ED8\]{--tw-bg-opacity:1;background-color:rgb(29 78 216/var(--tw-bg-opacity,1))}.bg-\[var\(--ed-olive\)\]{background-color:var(--ed-olive)}.bg-\[var\(--ed-paper\)\]{background-color:var(--ed-paper)}.bg-\[var\(--ed-paper-2\)\]{background-color:var(--ed-paper-2)}.bg-\[var\(--ed-rule\)\]{background-color:var(--ed-rule)}.bg-\[var\(--ed-signal\)\]{background-color:var(--ed-signal)}.bg-\[var\(--page-background\)\]{background-color:var(--page-background)}.bg-\[var\(--reader-border\)\]{background-color:var(--reader-border)}.bg-\[var\(--reader-evidence\)\]{background-color:var(--reader-evidence)}.bg-\[var\(--reader-evidence-soft\)\]{background-color:var(--reader-evidence-soft)}.bg-\[var\(--reader-panel-muted\)\]{background-color:var(--reader-panel-muted)}.bg-\[var\(--reader-panel-solid\)\]{background-color:var(--reader-panel-solid)}.bg-\[var\(--workbench-panel-solid\)\]{background-color:var(--workbench-panel-solid)}.bg-accent{background-color:var(--accent)}.bg-accent-light{background-color:var(--accent-light)}.bg-amber-200{--tw-bg-opacity:1;background-color:rgb(253 230 138/var(--tw-bg-opacity,1))}.bg-amber-300\/30{background-color:rgba(252,211,77,.3)}.bg-amber-400{--tw-bg-opacity:1;background-color:rgb(251 191 36/var(--tw-bg-opacity,1))}.bg-amber-50{--tw-bg-opacity:1;background-color:rgb(255 251 235/var(--tw-bg-opacity,1))}.bg-amber-500{--tw-bg-opacity:1;background-color:rgb(245 158 11/var(--tw-bg-opacity,1))}.bg-amber-500\/10{background-color:rgba(245,158,11,.1)}.bg-black\/40{background-color:rgba(0,0,0,.4)}.bg-black\/50{background-color:rgba(0,0,0,.5)}.bg-blue-50{--tw-bg-opacity:1;background-color:rgb(239 246 255/var(--tw-bg-opacity,1))}.bg-blue-50\/50{background-color:rgba(239,246,255,.5)}.bg-blue-500\/10{background-color:rgba(59,130,246,.1)}.bg-blue-600{--tw-bg-opacity:1;background-color:rgb(37 99 235/var(--tw-bg-opacity,1))}.bg-blue-700{--tw-bg-opacity:1;background-color:rgb(29 78 216/var(--tw-bg-opacity,1))}.bg-current{background-color:currentColor}.bg-emerald-100{--tw-bg-opacity:1;background-color:rgb(209 250 229/var(--tw-bg-opacity,1))}.bg-emerald-50{--tw-bg-opacity:1;background-color:rgb(236 253 245/var(--tw-bg-opacity,1))}.bg-emerald-500{--tw-bg-opacity:1;background-color:rgb(16 185 129/var(--tw-bg-opacity,1))}.bg-emerald-600{--tw-bg-opacity:1;background-color:rgb(5 150 105/var(--tw-bg-opacity,1))}.bg-green-100{--tw-bg-opacity:1;background-color:rgb(220 252 231/var(--tw-bg-opacity,1))}.bg-green-500{--tw-bg-opacity:1;background-color:rgb(34 197 94/var(--tw-bg-opacity,1))}.bg-red-100{--tw-bg-opacity:1;background-color:rgb(254 226 226/var(--tw-bg-opacity,1))}.bg-red-50{--tw-bg-opacity:1;background-color:rgb(254 242 242/var(--tw-bg-opacity,1))}.bg-red-500{--tw-bg-opacity:1;background-color:rgb(239 68 68/var(--tw-bg-opacity,1))}.bg-red-600{--tw-bg-opacity:1;background-color:rgb(220 38 38/var(--tw-bg-opacity,1))}.bg-stone-50\/60{background-color:hsla(60,9%,98%,.6)}.bg-transparent{background-color:transparent}.bg-white{--tw-bg-opacity:1;background-color:rgb(255 255 255/var(--tw-bg-opacity,1))}.bg-white\/20{background-color:hsla(0,0%,100%,.2)}.bg-white\/55{background-color:hsla(0,0%,100%,.55)}.bg-white\/70{background-color:hsla(0,0%,100%,.7)}.bg-white\/80{background-color:hsla(0,0%,100%,.8)}.bg-white\/90{background-color:hsla(0,0%,100%,.9)}.bg-white\/95{background-color:hsla(0,0%,100%,.95)}.bg-white\/\[0\.04\]{background-color:hsla(0,0%,100%,.04)}.bg-yellow-200{--tw-bg-opacity:1;background-color:rgb(254 240 138/var(--tw-bg-opacity,1))}.bg-yellow-500{--tw-bg-opacity:1;background-color:rgb(234 179 8/var(--tw-bg-opacity,1))}.bg-zinc-100{--tw-bg-opacity:1;background-color:rgb(244 244 245/var(--tw-bg-opacity,1))}.bg-zinc-200{--tw-bg-opacity:1;background-color:rgb(228 228 231/var(--tw-bg-opacity,1))}.bg-zinc-200\/95{background-color:hsla(240,6%,90%,.95)}.bg-zinc-300{--tw-bg-opacity:1;background-color:rgb(212 212 216/var(--tw-bg-opacity,1))}.bg-zinc-400{--tw-bg-opacity:1;background-color:rgb(161 161 170/var(--tw-bg-opacity,1))}.bg-zinc-50{--tw-bg-opacity:1;background-color:rgb(250 250 250/var(--tw-bg-opacity,1))}.bg-zinc-50\/50{background-color:hsla(0,0%,98%,.5)}.bg-zinc-50\/90{background-color:hsla(0,0%,98%,.9)}.bg-zinc-500{--tw-bg-opacity:1;background-color:rgb(113 113 122/var(--tw-bg-opacity,1))}.bg-zinc-600{--tw-bg-opacity:1;background-color:rgb(82 82 91/var(--tw-bg-opacity,1))}.bg-zinc-800{--tw-bg-opacity:1;background-color:rgb(39 39 42/var(--tw-bg-opacity,1))}.bg-zinc-900{--tw-bg-opacity:1;background-color:rgb(24 24 27/var(--tw-bg-opacity,1))}.bg-zinc-900\/5{background-color:rgba(24,24,27,.05)}.bg-zinc-950{--tw-bg-opacity:1;background-color:rgb(9 9 11/var(--tw-bg-opacity,1))}.bg-zinc-950\/40{background-color:rgba(9,9,11,.4)}.bg-zinc-950\/75{background-color:rgba(9,9,11,.75)}.bg-gradient-to-br{background-image:linear-gradient(to bottom right,var(--tw-gradient-stops))}.from-amber-700{--tw-gradient-from:#b45309 var(--tw-gradient-from-position);--tw-gradient-to:rgba(180,83,9,0) var(--tw-gradient-to-position);--tw-gradient-stops:var(--tw-gradient-from),var(--tw-gradient-to)}.from-blue-700{--tw-gradient-from:#1d4ed8 var(--tw-gradient-from-position);--tw-gradient-to:rgba(29,78,216,0) var(--tw-gradient-to-position);--tw-gradient-stops:var(--tw-gradient-from),var(--tw-gradient-to)}.from-emerald-700{--tw-gradient-from:#047857 var(--tw-gradient-from-position);--tw-gradient-to:rgba(4,120,87,0) var(--tw-gradient-to-position);--tw-gradient-stops:var(--tw-gradient-from),var(--tw-gradient-to)}.from-orange-900{--tw-gradient-from:#7c2d12 var(--tw-gradient-from-position);--tw-gradient-to:rgba(124,45,18,0) var(--tw-gradient-to-position);--tw-gradient-stops:var(--tw-gradient-from),var(--tw-gradient-to)}.from-rose-900{--tw-gradient-from:#881337 var(--tw-gradient-from-position);--tw-gradient-to:rgba(136,19,55,0) var(--tw-gradient-to-position);--tw-gradient-stops:var(--tw-gradient-from),var(--tw-gradient-to)}.from-sky-900{--tw-gradient-from:#0c4a6e var(--tw-gradient-from-position);--tw-gradient-to:rgba(12,74,110,0) var(--tw-gradient-to-position);--tw-gradient-stops:var(--tw-gradient-from),var(--tw-gradient-to)}.from-teal-800{--tw-gradient-from:#115e59 var(--tw-gradient-from-position);--tw-gradient-to:rgba(17,94,89,0) var(--tw-gradient-to-position);--tw-gradient-stops:var(--tw-gradient-from),var(--tw-gradient-to)}.to-blue-400{--tw-gradient-to:#60a5fa var(--tw-gradient-to-position)}.to-emerald-300{--tw-gradient-to:#6ee7b7 var(--tw-gradient-to-position)}.to-orange-300{--tw-gradient-to:#fdba74 var(--tw-gradient-to-position)}.to-rose-300{--tw-gradient-to:#fda4af var(--tw-gradient-to-position)}.to-sky-300{--tw-gradient-to:#7dd3fc var(--tw-gradient-to-position)}.to-teal-300{--tw-gradient-to:#5eead4 var(--tw-gradient-to-position)}.to-yellow-300{--tw-gradient-to:#fde047 var(--tw-gradient-to-position)}.fill-accent{fill:var(--accent)}.fill-white{fill:#fff}.object-cover{-o-object-fit:cover;object-fit:cover}.p-0{padding:0}.p-0\.5{padding:.125rem}.p-1{padding:.25rem}.p-1\.5{padding:.375rem}.p-10{padding:2.5rem}.p-2{padding:.5rem}.p-3{padding:.75rem}.p-4{padding:1rem}.p-5{padding:1.25rem}.p-6{padding:1.5rem}.p-7{padding:1.75rem}.p-8{padding:2rem}.px-0{padding-left:0;padding-right:0}.px-1{padding-left:.25rem;padding-right:.25rem}.px-1\.5{padding-left:.375rem;padding-right:.375rem}.px-2{padding-left:.5rem;padding-right:.5rem}.px-2\.5{padding-left:.625rem;padding-right:.625rem}.px-3{padding-left:.75rem;padding-right:.75rem}.px-3\.5{padding-left:.875rem;padding-right:.875rem}.px-4{padding-left:1rem;padding-right:1rem}.px-5{padding-left:1.25rem;padding-right:1.25rem}.px-6{padding-left:1.5rem;padding-right:1.5rem}.px-7{padding-left:1.75rem;padding-right:1.75rem}.py-0\.5{padding-top:.125rem;padding-bottom:.125rem}.py-1{padding-top:.25rem;padding-bottom:.25rem}.py-1\.5{padding-top:.375rem;padding-bottom:.375rem}.py-10{padding-top:2.5rem;padding-bottom:2.5rem}.py-12{padding-top:3rem;padding-bottom:3rem}.py-16{padding-top:4rem;padding-bottom:4rem}.py-2{padding-top:.5rem;padding-bottom:.5rem}.py-2\.5{padding-top:.625rem;padding-bottom:.625rem}.py-3{padding-top:.75rem;padding-bottom:.75rem}.py-3\.5{padding-top:.875rem;padding-bottom:.875rem}.py-4{padding-top:1rem;padding-bottom:1rem}.py-5{padding-top:1.25rem;padding-bottom:1.25rem}.py-6{padding-top:1.5rem;padding-bottom:1.5rem}.py-8{padding-top:2rem;padding-bottom:2rem}.pb-10{padding-bottom:2.5rem}.pb-14{padding-bottom:3.5rem}.pb-2{padding-bottom:.5rem}.pb-3{padding-bottom:.75rem}.pb-4{padding-bottom:1rem}.pb-5{padding-bottom:1.25rem}.pb-6{padding-bottom:1.5rem}.pb-8{padding-bottom:2rem}.pl-0{padding-left:0}.pl-3{padding-left:.75rem}.pl-5{padding-left:1.25rem}.pl-8{padding-left:2rem}.pl-9{padding-left:2.25rem}.pr-3{padding-right:.75rem}.pr-4{padding-right:1rem}.pr-6{padding-right:1.5rem}.pr-8{padding-right:2rem}.pt-0\.5{padding-top:.125rem}.pt-1{padding-top:.25rem}.pt-16{padding-top:4rem}.pt-3{padding-top:.75rem}.pt-4{padding-top:1rem}.pt-6{padding-top:1.5rem}.pt-8{padding-top:2rem}.text-left{text-align:left}.text-center{text-align:center}.text-right{text-align:right}.align-top{vertical-align:top}.align-middle{vertical-align:middle}.align-text-bottom{vertical-align:text-bottom}.align-super{vertical-align:super}.font-logo{font-family:var(--font-logo),var(--font-plex-sans),system-ui,sans-serif}.font-mono{font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,Liberation Mono,Courier New,monospace}.font-sans{font-family:var(--dt-body)}.font-serif{font-family:var(--font-logo),var(--font-plex-sans),system-ui,sans-serif}.text-2xl{font-size:1.5rem;line-height:2rem}.text-3xl{font-size:1.875rem;line-height:2.25rem}.text-4xl{font-size:2.25rem;line-height:2.5rem}.text-6xl{font-size:3.75rem;line-height:1}.text-\[10px\]{font-size:10px}.text-\[11px\]{font-size:11px}.text-\[12px\]{font-size:12px}.text-\[13px\]{font-size:13px}.text-\[15px\]{font-size:15px}.text-\[17px\]{font-size:17px}.text-\[7px\]{font-size:7px}.text-\[8px\]{font-size:8px}.text-\[9px\]{font-size:9px}.text-base{font-size:1rem;line-height:1.5rem}.text-lg{font-size:1.125rem;line-height:1.75rem}.text-sm{font-size:.875rem;line-height:1.25rem}.text-xl{font-size:1.25rem;line-height:1.75rem}.text-xs{font-size:.75rem;line-height:1rem}.font-bold{font-weight:700}.font-medium{font-weight:500}.font-normal{font-weight:400}.font-semibold{font-weight:600}.uppercase{text-transform:uppercase}.italic{font-style:italic}.not-italic{font-style:normal}.tabular-nums{--tw-numeric-spacing:tabular-nums;font-variant-numeric:var(--tw-ordinal) var(--tw-slashed-zero) var(--tw-numeric-figure) var(--tw-numeric-spacing) var(--tw-numeric-fraction)}.leading-4{line-height:1rem}.leading-5{line-height:1.25rem}.leading-6{line-height:1.5rem}.leading-7{line-height:1.75rem}.leading-none{line-height:1}.leading-relaxed{line-height:1.625}.leading-snug{line-height:1.375}.leading-tight{line-height:1.25}.tracking-\[0\.08em\]{letter-spacing:.08em}.tracking-\[0\.14em\]{letter-spacing:.14em}.tracking-\[0\.16em\]{letter-spacing:.16em}.tracking-\[0\.18em\]{letter-spacing:.18em}.tracking-normal{letter-spacing:0}.tracking-tight{letter-spacing:-.025em}.tracking-wide{letter-spacing:.025em}.tracking-wider{letter-spacing:.05em}.text-\[\#1D4ED8\]{--tw-text-opacity:1;color:rgb(29 78 216/var(--tw-text-opacity,1))}.text-\[var\(--ed-ink\)\]{color:var(--ed-ink)}.text-\[var\(--ed-ink-2\)\]{color:var(--ed-ink-2)}.text-\[var\(--ed-ink-3\)\]{color:var(--ed-ink-3)}.text-\[var\(--ed-signal\)\]{color:var(--ed-signal)}.text-\[var\(--reader-evidence\)\]{color:var(--reader-evidence)}.text-\[var\(--reader-ink\)\]{color:var(--reader-ink)}.text-\[var\(--reader-muted\)\]{color:var(--reader-muted)}.text-\[var\(--workbench-ink\)\]{color:var(--workbench-ink)}.text-\[var\(--workbench-muted\)\]{color:var(--workbench-muted)}.text-accent{color:var(--accent)}.text-accent-foreground{color:var(--accent-foreground)}.text-amber-600{--tw-text-opacity:1;color:rgb(217 119 6/var(--tw-text-opacity,1))}.text-amber-700{--tw-text-opacity:1;color:rgb(180 83 9/var(--tw-text-opacity,1))}.text-amber-800{--tw-text-opacity:1;color:rgb(146 64 14/var(--tw-text-opacity,1))}.text-amber-900{--tw-text-opacity:1;color:rgb(120 53 15/var(--tw-text-opacity,1))}.text-amber-950{--tw-text-opacity:1;color:rgb(69 26 3/var(--tw-text-opacity,1))}.text-blue-600{--tw-text-opacity:1;color:rgb(37 99 235/var(--tw-text-opacity,1))}.text-blue-700{--tw-text-opacity:1;color:rgb(29 78 216/var(--tw-text-opacity,1))}.text-blue-800{--tw-text-opacity:1;color:rgb(30 64 175/var(--tw-text-opacity,1))}.text-blue-900{--tw-text-opacity:1;color:rgb(30 58 138/var(--tw-text-opacity,1))}.text-blue-950{--tw-text-opacity:1;color:rgb(23 37 84/var(--tw-text-opacity,1))}.text-emerald-600{--tw-text-opacity:1;color:rgb(5 150 105/var(--tw-text-opacity,1))}.text-emerald-700{--tw-text-opacity:1;color:rgb(4 120 87/var(--tw-text-opacity,1))}.text-emerald-800{--tw-text-opacity:1;color:rgb(6 95 70/var(--tw-text-opacity,1))}.text-emerald-900{--tw-text-opacity:1;color:rgb(6 78 59/var(--tw-text-opacity,1))}.text-emerald-950{--tw-text-opacity:1;color:rgb(2 44 34/var(--tw-text-opacity,1))}.text-green-500{--tw-text-opacity:1;color:rgb(34 197 94/var(--tw-text-opacity,1))}.text-green-600{--tw-text-opacity:1;color:rgb(22 163 74/var(--tw-text-opacity,1))}.text-green-700{--tw-text-opacity:1;color:rgb(21 128 61/var(--tw-text-opacity,1))}.text-red-500{--tw-text-opacity:1;color:rgb(239 68 68/var(--tw-text-opacity,1))}.text-red-600{--tw-text-opacity:1;color:rgb(220 38 38/var(--tw-text-opacity,1))}.text-red-700{--tw-text-opacity:1;color:rgb(185 28 28/var(--tw-text-opacity,1))}.text-red-700\/90{color:rgba(185,28,28,.9)}.text-red-800{--tw-text-opacity:1;color:rgb(153 27 27/var(--tw-text-opacity,1))}.text-red-900{--tw-text-opacity:1;color:rgb(127 29 29/var(--tw-text-opacity,1))}.text-red-950{--tw-text-opacity:1;color:rgb(69 10 10/var(--tw-text-opacity,1))}.text-white{--tw-text-opacity:1;color:rgb(255 255 255/var(--tw-text-opacity,1))}.text-yellow-600{--tw-text-opacity:1;color:rgb(202 138 4/var(--tw-text-opacity,1))}.text-zinc-200{--tw-text-opacity:1;color:rgb(228 228 231/var(--tw-text-opacity,1))}.text-zinc-300{--tw-text-opacity:1;color:rgb(212 212 216/var(--tw-text-opacity,1))}.text-zinc-400{--tw-text-opacity:1;color:rgb(161 161 170/var(--tw-text-opacity,1))}.text-zinc-500{--tw-text-opacity:1;color:rgb(113 113 122/var(--tw-text-opacity,1))}.text-zinc-600{--tw-text-opacity:1;color:rgb(82 82 91/var(--tw-text-opacity,1))}.text-zinc-700{--tw-text-opacity:1;color:rgb(63 63 70/var(--tw-text-opacity,1))}.text-zinc-800{--tw-text-opacity:1;color:rgb(39 39 42/var(--tw-text-opacity,1))}.text-zinc-900{--tw-text-opacity:1;color:rgb(24 24 27/var(--tw-text-opacity,1))}.text-zinc-950{--tw-text-opacity:1;color:rgb(9 9 11/var(--tw-text-opacity,1))}.underline{text-decoration-line:underline}.decoration-amber-500{text-decoration-color:#f59e0b}.decoration-red-400{text-decoration-color:#f87171}.underline-offset-2{text-underline-offset:2px}.antialiased{-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale}.opacity-0{opacity:0}.opacity-100{opacity:1}.opacity-50{opacity:.5}.opacity-60{opacity:.6}.opacity-70{opacity:.7}.opacity-75{opacity:.75}.opacity-90{opacity:.9}.mix-blend-multiply{mix-blend-mode:multiply}.mix-blend-screen{mix-blend-mode:screen}.shadow-2xl{--tw-shadow:0 25px 50px -12px rgba(0,0,0,.25);--tw-shadow-colored:0 25px 50px -12px var(--tw-shadow-color);box-shadow:var(--tw-ring-offset-shadow,0 0 #0000),var(--tw-ring-shadow,0 0 #0000),var(--tw-shadow)}.shadow-\[0_1px_3px_0_rgba\(0\2c 0\2c 0\2c 0\.05\)\2c 0_1px_2px_0_rgba\(0\2c 0\2c 0\2c 0\.03\)\]{--tw-shadow:0 1px 3px 0 rgba(0,0,0,.05),0 1px 2px 0 rgba(0,0,0,.03);--tw-shadow-colored:0 1px 3px 0 var(--tw-shadow-color),0 1px 2px 0 var(--tw-shadow-color);box-shadow:var(--tw-ring-offset-shadow,0 0 #0000),var(--tw-ring-shadow,0 0 #0000),var(--tw-shadow)}.shadow-\[0_3px_12px_rgba\(15\2c 23\2c 42\2c 0\.16\)\]{--tw-shadow:0 3px 12px rgba(15,23,42,.16);--tw-shadow-colored:0 3px 12px var(--tw-shadow-color);box-shadow:var(--tw-ring-offset-shadow,0 0 #0000),var(--tw-ring-shadow,0 0 #0000),var(--tw-shadow)}.shadow-\[inset_0_1px_0_rgba\(255\2c 255\2c 255\2c 0\.8\)\2c 0_10px_24px_rgba\(15\2c 23\2c 42\2c 0\.12\)\]{--tw-shadow:inset 0 1px 0 hsla(0,0%,100%,.8),0 10px 24px rgba(15,23,42,.12);--tw-shadow-colored:inset 0 1px 0 var(--tw-shadow-color),0 10px 24px var(--tw-shadow-color);box-shadow:var(--tw-ring-offset-shadow,0 0 #0000),var(--tw-ring-shadow,0 0 #0000),var(--tw-shadow)}.shadow-lg{--tw-shadow:0 10px 15px -3px rgba(0,0,0,.1),0 4px 6px -4px rgba(0,0,0,.1);--tw-shadow-colored:0 10px 15px -3px var(--tw-shadow-color),0 4px 6px -4px var(--tw-shadow-color)}.shadow-lg,.shadow-md{box-shadow:var(--tw-ring-offset-shadow,0 0 #0000),var(--tw-ring-shadow,0 0 #0000),var(--tw-shadow)}.shadow-md{--tw-shadow:0 4px 6px -1px rgba(0,0,0,.1),0 2px 4px -2px rgba(0,0,0,.1);--tw-shadow-colored:0 4px 6px -1px var(--tw-shadow-color),0 2px 4px -2px var(--tw-shadow-color)}.shadow-sm{--tw-shadow:0 1px 2px 0 rgba(0,0,0,.05);--tw-shadow-colored:0 1px 2px 0 var(--tw-shadow-color)}.shadow-sm,.shadow-xl{box-shadow:var(--tw-ring-offset-shadow,0 0 #0000),var(--tw-ring-shadow,0 0 #0000),var(--tw-shadow)}.shadow-xl{--tw-shadow:0 20px 25px -5px rgba(0,0,0,.1),0 8px 10px -6px rgba(0,0,0,.1);--tw-shadow-colored:0 20px 25px -5px var(--tw-shadow-color),0 8px 10px -6px var(--tw-shadow-color)}.shadow-black\/15{--tw-shadow-color:rgba(0,0,0,.15);--tw-shadow:var(--tw-shadow-colored)}.shadow-black\/35{--tw-shadow-color:rgba(0,0,0,.35);--tw-shadow:var(--tw-shadow-colored)}.shadow-red-950\/30{--tw-shadow-color:rgba(69,10,10,.3);--tw-shadow:var(--tw-shadow-colored)}.shadow-slate-900\/10{--tw-shadow-color:rgba(15,23,42,.1);--tw-shadow:var(--tw-shadow-colored)}.outline-none{outline:2px solid transparent;outline-offset:2px}.outline{outline-style:solid}.ring-1{--tw-ring-offset-shadow:var(--tw-ring-inset) 0 0 0 var(--tw-ring-offset-width) var(--tw-ring-offset-color);--tw-ring-shadow:var(--tw-ring-inset) 0 0 0 calc(1px + var(--tw-ring-offset-width)) var(--tw-ring-color);box-shadow:var(--tw-ring-offset-shadow),var(--tw-ring-shadow),var(--tw-shadow,0 0 #0000)}.ring-\[var\(--reader-evidence-border\)\]{--tw-ring-color:var(--reader-evidence-border)}.ring-amber-200{--tw-ring-opacity:1;--tw-ring-color:rgb(253 230 138/var(--tw-ring-opacity,1))}.ring-black\/5{--tw-ring-color:rgba(0,0,0,.05)}.blur{--tw-blur:blur(8px)}.blur,.blur-0{filter:var(--tw-blur) var(--tw-brightness) var(--tw-contrast) var(--tw-grayscale) var(--tw-hue-rotate) var(--tw-invert) var(--tw-saturate) var(--tw-sepia) var(--tw-drop-shadow)}.blur-0{--tw-blur:blur(0)}.blur-\[10px\]{--tw-blur:blur(10px)}.blur-\[10px\],.filter{filter:var(--tw-blur) var(--tw-brightness) var(--tw-contrast) var(--tw-grayscale) var(--tw-hue-rotate) var(--tw-invert) var(--tw-saturate) var(--tw-sepia) var(--tw-drop-shadow)}.backdrop-blur{--tw-backdrop-blur:blur(8px)}.backdrop-blur,.backdrop-blur-2xl{backdrop-filter:var(--tw-backdrop-blur) var(--tw-backdrop-brightness) var(--tw-backdrop-contrast) var(--tw-backdrop-grayscale) var(--tw-backdrop-hue-rotate) var(--tw-backdrop-invert) var(--tw-backdrop-opacity) var(--tw-backdrop-saturate) var(--tw-backdrop-sepia)}.backdrop-blur-2xl{--tw-backdrop-blur:blur(40px)}.backdrop-blur-md{--tw-backdrop-blur:blur(12px)}.backdrop-blur-md,.backdrop-blur-sm{backdrop-filter:var(--tw-backdrop-blur) var(--tw-backdrop-brightness) var(--tw-backdrop-contrast) var(--tw-backdrop-grayscale) var(--tw-backdrop-hue-rotate) var(--tw-backdrop-invert) var(--tw-backdrop-opacity) var(--tw-backdrop-saturate) var(--tw-backdrop-sepia)}.backdrop-blur-sm{--tw-backdrop-blur:blur(4px)}.transition{transition-property:color,background-color,border-color,text-decoration-color,fill,stroke,opacity,box-shadow,transform,filter,backdrop-filter;transition-timing-function:cubic-bezier(.4,0,.2,1);transition-duration:.15s}.transition-\[border-color\2c background-color\]{transition-property:border-color,background-color;transition-timing-function:cubic-bezier(.4,0,.2,1);transition-duration:.15s}.transition-\[border-color\2c box-shadow\2c transform\]{transition-property:border-color,box-shadow,transform;transition-timing-function:cubic-bezier(.4,0,.2,1);transition-duration:.15s}.transition-\[border-color\2c box-shadow\]{transition-property:border-color,box-shadow;transition-timing-function:cubic-bezier(.4,0,.2,1);transition-duration:.15s}.transition-\[box-shadow\2c background-color\]{transition-property:box-shadow,background-color;transition-timing-function:cubic-bezier(.4,0,.2,1);transition-duration:.15s}.transition-\[box-shadow\2c color\2c background-color\]{transition-property:box-shadow,color,background-color;transition-timing-function:cubic-bezier(.4,0,.2,1);transition-duration:.15s}.transition-\[max-height\2c opacity\]{transition-property:max-height,opacity;transition-timing-function:cubic-bezier(.4,0,.2,1);transition-duration:.15s}.transition-\[opacity\2c filter\2c transform\]{transition-property:opacity,filter,transform;transition-timing-function:cubic-bezier(.4,0,.2,1);transition-duration:.15s}.transition-\[opacity\2c transform\]{transition-property:opacity,transform;transition-timing-function:cubic-bezier(.4,0,.2,1);transition-duration:.15s}.transition-\[width\]{transition-property:width;transition-timing-function:cubic-bezier(.4,0,.2,1);transition-duration:.15s}.transition-colors{transition-property:color,background-color,border-color,text-decoration-color,fill,stroke;transition-timing-function:cubic-bezier(.4,0,.2,1);transition-duration:.15s}.transition-opacity{transition-property:opacity;transition-timing-function:cubic-bezier(.4,0,.2,1);transition-duration:.15s}.transition-shadow{transition-property:box-shadow;transition-timing-function:cubic-bezier(.4,0,.2,1);transition-duration:.15s}.transition-transform{transition-property:transform;transition-timing-function:cubic-bezier(.4,0,.2,1);transition-duration:.15s}.duration-200{transition-duration:.2s}.duration-300{transition-duration:.3s}.duration-500{transition-duration:.5s}.duration-700{transition-duration:.7s}.duration-\[600ms\]{transition-duration:.6s}.duration-\[800ms\]{transition-duration:.8s}.ease-in-out{transition-timing-function:cubic-bezier(.4,0,.2,1)}.ease-out{transition-timing-function:cubic-bezier(0,0,.2,1)}.will-change-\[opacity\2c filter\2c transform\]{will-change:opacity,filter,transform}.will-change-transform{will-change:transform}.\[animation-delay\:-0\.15s\]{animation-delay:-.15s}.\[animation-delay\:-0\.3s\]{animation-delay:-.3s}.\[mask-image\:linear-gradient\(to_right\2c transparent\2c \#000_8\%\2c \#000_92\%\2c transparent\)\]{-webkit-mask-image:linear-gradient(90deg,transparent,#000 8%,#000 92%,transparent);mask-image:linear-gradient(90deg,transparent,#000 8%,#000 92%,transparent)}.\[perspective\:1200px\]{perspective:1200px}.\[transform-style\:preserve-3d\]{transform-style:preserve-3d}:root{--dt-serif:var(--font-fraunces),Georgia,serif;--dt-mono:var(--font-plex-mono),ui-monospace,monospace;--dt-body:var(--font-plex-sans),system-ui,sans-serif}html:lang(zh){--dt-serif:var(--font-plex-sans),"PingFang SC","HarmonyOS Sans SC","Microsoft YaHei","Noto Sans SC",sans-serif;--dt-mono:var(--font-plex-mono),"PingFang SC","Microsoft YaHei","Noto Sans SC",sans-serif;--dt-body:var(--font-plex-sans),"PingFang SC","HarmonyOS Sans SC","Microsoft YaHei","Noto Sans SC",system-ui,sans-serif}html:lang(ja){--dt-serif:var(--font-plex-sans),"Hiragino Sans","Hiragino Kaku Gothic ProN","Yu Gothic","Meiryo","Noto Sans JP",sans-serif;--dt-mono:var(--font-plex-mono),"Hiragino Sans","Yu Gothic","Noto Sans JP",sans-serif;--dt-body:var(--font-plex-sans),"Hiragino Sans","Hiragino Kaku Gothic ProN","Yu Gothic","Meiryo","Noto Sans JP",system-ui,sans-serif}html:lang(ko){--dt-serif:var(--font-plex-sans),"Apple SD Gothic Neo","Malgun Gothic","Noto Sans KR",sans-serif;--dt-mono:var(--font-plex-mono),"Apple SD Gothic Neo","Malgun Gothic","Noto Sans KR",sans-serif;--dt-body:var(--font-plex-sans),"Apple SD Gothic Neo","Malgun Gothic","Noto Sans KR",system-ui,sans-serif}html:lang(ar){--dt-serif:var(--font-plex-sans),"SF Arabic","Geeza Pro","Segoe UI","Noto Naskh Arabic","Tahoma",sans-serif;--dt-mono:var(--font-plex-mono),"SF Arabic","Geeza Pro","Noto Naskh Arabic","Tahoma",sans-serif;--dt-body:var(--font-plex-sans),"SF Arabic","Geeza Pro","Segoe UI","Noto Naskh Arabic","Tahoma",system-ui,sans-serif}html:lang(hi){--dt-serif:var(--font-plex-sans),"Kohinoor Devanagari","Noto Sans Devanagari","Nirmala UI","Mangal",sans-serif;--dt-mono:var(--font-plex-mono),"Kohinoor Devanagari","Noto Sans Devanagari","Nirmala UI","Mangal",sans-serif;--dt-body:var(--font-plex-sans),"Kohinoor Devanagari","Noto Sans Devanagari","Nirmala UI","Mangal",system-ui,sans-serif}:root{--background:#fff;--page-background:#f6f8fc;--foreground:#09090b;--border:#e4e4e7;--surface-1:#fff;--surface-2:#f4f4f5;--surface-3:#e4e4e7;--highlight-base:rgba(183,121,31,.1);--highlight-strong:rgba(245,158,11,.22);--highlight-line:rgba(183,121,31,.74);--highlight-glow:rgba(245,158,11,.22);--accent:#1d4ed8;--accent-hover:#1e40af;--accent-light:#dbeafe;--accent-foreground:#fff;--workbench-bg:#f6f8fc;--workbench-canvas:#eef3fb;--workbench-panel:hsla(0,0%,100%,.76);--workbench-panel-solid:#fff;--workbench-panel-strong:hsla(0,0%,100%,.94);--workbench-border:#e4e4e7;--workbench-border-strong:rgba(67,91,126,.34);--workbench-grid:rgba(43,69,104,.14);--workbench-ink:#111827;--workbench-muted:#64748b;--workbench-glow-cyan:rgba(14,165,233,.16);--workbench-command:hsla(0,0%,100%,.88);--workbench-command-shadow:0 22px 70px rgba(31,55,88,.16);--reader-bg:#f4f1ea;--reader-panel:hsla(0,0%,100%,.9);--reader-panel-solid:#fff;--reader-panel-muted:#faf8f3;--reader-border:#ded8ce;--reader-border-strong:#cfc6b8;--reader-ink:#1f2933;--reader-muted:#716b63;--reader-evidence:#b7791f;--reader-evidence-soft:#fff4d6;--reader-evidence-border:#f3d38c}.dark{--background:#09090b;--page-background:#070707;--foreground:#fafafa;--border:hsla(0,0%,100%,.14);--surface-1:#18181b;--surface-2:#27272a;--surface-3:#3f3f46;--highlight-base:rgba(241,184,75,.14);--highlight-strong:rgba(241,184,75,.26);--highlight-line:rgba(241,184,75,.78);--highlight-glow:rgba(241,184,75,.28);--accent:#60a5fa;--accent-hover:#93c5fd;--accent-light:rgba(96,165,250,.12);--accent-foreground:#0b1726;--workbench-bg:#070707;--workbench-canvas:#111214;--workbench-panel:rgba(23,24,27,.74);--workbench-panel-solid:#17181b;--workbench-panel-strong:rgba(25,26,30,.92);--workbench-border:hsla(0,0%,100%,.14);--workbench-border-strong:hsla(0,0%,100%,.26);--workbench-grid:hsla(0,0%,100%,.16);--workbench-ink:#f7f7f8;--workbench-muted:#b8bbc6;--workbench-glow-cyan:rgba(73,186,255,.28);--workbench-command:rgba(23,24,27,.86);--workbench-command-shadow:0 30px 90px rgba(0,0,0,.46);--reader-bg:#151410;--reader-panel:rgba(28,27,24,.92);--reader-panel-solid:#1f1e1a;--reader-panel-muted:#25231f;--reader-border:#3c3830;--reader-border-strong:#575044;--reader-ink:#f3eee4;--reader-muted:#aaa399;--reader-evidence:#f1b84b;--reader-evidence-soft:rgba(241,184,75,.14);--reader-evidence-border:rgba(241,184,75,.34)}.dark h1,.dark h2,.dark h3,.dark h4,.dark h5,.dark h6{font-weight:600}.dark .prose b,.dark .prose strong{font-weight:500}body,html{height:100%;overflow-x:clip}body{color:var(--foreground);background:#fafafa;position:relative}.dark body{background:#09090b}.font-serif,h1,h2,h3{letter-spacing:0}.prose p{margin-top:.75em;margin-bottom:.75em}.prose ol,.prose ul{margin-top:.5em;margin-bottom:.5em}.prose li{margin-top:.25em;margin-bottom:.25em}.textLayer mark.pdf-highlight{background-color:transparent;background-image:linear-gradient(to bottom,transparent 0 60%,var(--highlight-base) 60% calc(100% - 2px),var(--highlight-line) calc(100% - 2px) 100%);box-decoration-break:clone;-webkit-box-decoration-break:clone;color:transparent;border-radius:2px 2px 4px 4px;padding:0 .01em .04em;animation:citationTextFocus 1.45s ease-out}.textLayer mark.pdf-highlight-focus{background-image:none;background-color:var(--highlight-strong);box-shadow:0 0 0 1px var(--highlight-base);border-radius:3px}@keyframes citationTextFocus{0%{background-color:var(--highlight-strong);box-shadow:0 0 0 2px var(--highlight-base),0 8px 18px var(--highlight-glow)}55%{background-color:var(--highlight-base);box-shadow:0 0 0 1px var(--highlight-base),0 4px 12px var(--highlight-glow)}to{background-color:transparent;box-shadow:none}}.citation-overlay{background:linear-gradient(to bottom,transparent 0 calc(100% - 4px),var(--highlight-base) calc(100% - 4px) calc(100% - 2px),var(--highlight-line) calc(100% - 2px) 100%);border-radius:0 0 4px 4px;opacity:.9;pointer-events:none;animation:citationOverlayFocus 1.45s ease-out}.citation-overlay[data-highlight-anchor=true]:before{content:"";position:absolute;left:-10px;top:50%;width:4px;height:min(18px,72%);border-radius:999px;background:var(--highlight-line);box-shadow:0 0 10px var(--highlight-glow);transform:translateY(-50%)}@keyframes citationOverlayFocus{0%{background:linear-gradient(to bottom,var(--highlight-strong) 0 100%);filter:drop-shadow(0 8px 18px var(--highlight-glow))}55%{background:linear-gradient(to bottom,transparent 0 52%,var(--highlight-base) 52% calc(100% - 2px),var(--highlight-line) calc(100% - 2px) 100%);filter:drop-shadow(0 4px 10px var(--highlight-glow))}to{background:linear-gradient(to bottom,transparent 0 calc(100% - 4px),var(--highlight-base) calc(100% - 4px) calc(100% - 2px),var(--highlight-line) calc(100% - 2px) 100%);filter:none}}.shiki-container .shiki,.shiki-container .shiki span{color:var(--shiki-light);background-color:var(--shiki-light-bg);font-style:var(--shiki-light-font-style);font-weight:var(--shiki-light-font-weight);-webkit-text-decoration:var(--shiki-light-text-decoration);text-decoration:var(--shiki-light-text-decoration)}.dark .shiki-container .shiki,.dark .shiki-container .shiki span{color:var(--shiki-dark);background-color:var(--shiki-dark-bg);font-style:var(--shiki-dark-font-style);font-weight:var(--shiki-dark-font-weight);-webkit-text-decoration:var(--shiki-dark-text-decoration);text-decoration:var(--shiki-dark-text-decoration)}@keyframes slideUp{0%{transform:translateY(100%)}to{transform:translateY(0)}}.textLayer mark.pdf-search-match{background-color:rgba(250,204,21,.4);color:transparent;border-radius:2px;padding:1px 0}.doctalk-tour-popover{--driverjs-bg:#fff;--driverjs-color:#18181b;border:1px solid #e4e4e7;border-radius:12px;box-shadow:0 4px 6px -1px rgba(0,0,0,.1)}.dark .doctalk-tour-popover{--driverjs-bg:#18181b;--driverjs-color:#fafafa;border-color:#3f3f46}.doctalk-tour-popover .driver-popover-progress-text{color:#71717a}.doctalk-tour-popover .driver-popover-navigation-btns button{border-radius:8px;font-size:.875rem;padding:.375rem .75rem}.dt-workbench-canvas{position:relative;overflow:hidden;background:transparent}.dt-workbench-canvas>*{position:relative;z-index:1}.dt-glass-panel{border:1px solid #e4e4e7;background:#fff;box-shadow:0 1px 2px rgba(24,24,27,.05)}.dark .dt-glass-panel{border-color:#27272a;background:#18181b;box-shadow:0 1px 2px rgba(0,0,0,.4)}.dt-shell-header{position:relative;z-index:80;isolation:isolate;border-color:#e4e4e7;background:#fff;box-shadow:0 1px 2px rgba(24,24,27,.05)}.dark .dt-shell-header{border-color:#27272a;background:#09090b;box-shadow:0 1px 2px rgba(0,0,0,.4)}.dt-workbench-pill{border:1px solid #e4e4e7;background:#fff;color:var(--workbench-muted)}.dark .dt-workbench-pill{border-color:#27272a;background:#27272a}.dt-workbench-button{border:1px solid #e4e4e7;background:#fff;color:var(--workbench-ink);box-shadow:0 1px 2px rgba(24,24,27,.05);transition:border-color .15s ease,background .15s ease,transform .15s ease}.dt-workbench-button:hover{border-color:#d4d4d8;transform:translateY(-1px);background:#fafafa}.dark .dt-workbench-button{border-color:#27272a;background:#18181b;box-shadow:0 1px 2px rgba(0,0,0,.4)}.dark .dt-workbench-button:hover{border-color:#3f3f46;background:#27272a}.dt-command-bar{border:1px solid #d4d4d8;background:#fff;box-shadow:0 8px 24px -10px rgba(24,24,27,.12)}.dark .dt-command-bar{border-color:#3f3f46;background:#18181b;box-shadow:0 8px 24px -10px rgba(0,0,0,.5)}.dt-reading-workspace{position:relative;background:transparent}.dt-reader-pane{min-width:0;background:#fff;border-color:#e4e4e7;box-shadow:0 8px 24px -10px rgba(24,24,27,.12)}.dark .dt-reader-pane{background:#18181b;border-color:#27272a;box-shadow:0 8px 24px -10px rgba(0,0,0,.5)}.dark .dt-reader-pane-document,.dt-reader-pane-document{background:transparent}.dt-reader-resizer{background:linear-gradient(180deg,transparent,var(--workbench-border),transparent);transition:background .15s ease}.dt-reader-resizer:hover{background:linear-gradient(180deg,transparent,var(--workbench-border-strong),transparent)}.dt-reader-resizer-grip{width:2px;height:40px;border-radius:999px;background:var(--reader-border-strong);box-shadow:4px 0 0 color-mix(in srgb,var(--reader-border-strong) 52%,transparent)}.dt-chat-shell{color:var(--workbench-ink)}.dark .dt-chat-shell,.dt-chat-shell{background:transparent}.dt-chat-scroll{scrollbar-gutter:stable}.dt-empty-workbench{width:min(100%,42rem);border:1px solid #e4e4e7;background:#fff;box-shadow:0 8px 24px -10px rgba(24,24,27,.12)}.dark .dt-empty-workbench{border-color:#27272a;background:#18181b;box-shadow:0 8px 24px -10px rgba(0,0,0,.5)}.dt-suggested-question{border:1px solid #e4e4e7;background:#fff;color:var(--workbench-ink);transition:border-color .15s ease,background .15s ease,transform .15s ease}.dt-suggested-question:hover{border-color:#d4d4d8;background:#fafafa;transform:translateY(-1px)}.dark .dt-suggested-question{border-color:#27272a;background:#18181b}.dark .dt-suggested-question:hover{border-color:#3f3f46;background:#27272a}.dt-answer-card{position:relative;border:1px solid #e4e4e7;border-radius:22px;background:#fff;box-shadow:0 1px 2px rgba(24,24,27,.05);padding:1rem 1.125rem 1.05rem 1.25rem}.dt-answer-card:before{content:"";position:absolute;left:-1px;top:14px;bottom:14px;width:3px;border-radius:999px;background:#1d4ed8;opacity:.82}.dark .dt-answer-card{border-color:#27272a;background:#18181b;box-shadow:0 1px 2px rgba(0,0,0,.4)}.dt-user-bubble{border:1px solid #e4e4e7;background:#fff;color:var(--workbench-ink);box-shadow:0 1px 2px rgba(24,24,27,.05)}.dark .dt-user-bubble{border-color:#27272a;background:#18181b;box-shadow:0 1px 2px rgba(0,0,0,.4)}.dt-sources-strip{border:1px solid #e4e4e7;border-radius:10px;background:#fff;padding:.75rem}.dark .dt-sources-strip{border-color:#27272a;background:#18181b}.dt-sources-label{color:#1d4ed8;letter-spacing:.08em}.dark .dt-sources-label{color:rgba(147,197,253,.82)}.dt-source-chip{border:1px solid #e4e4e7;background:#f4f4f5;color:var(--workbench-ink);transition:border-color .15s ease,background .15s ease,transform .15s ease}.dt-source-chip:hover{border-color:rgba(29,78,216,.32);background:#fff;transform:translateY(-1px)}.dark .dt-source-chip{border-color:#27272a;background:#27272a}.dark .dt-source-chip:hover{border-color:rgba(96,165,250,.5);background:#3f3f46}.dt-source-index{background:#111827;color:#fff}.dark .dt-source-index{background:#f7f7f8;color:#141416}.dt-citation-card{border:1px solid #e4e4e7;background:#fff;color:var(--workbench-ink);box-shadow:0 1px 2px rgba(24,24,27,.05);transition:border-color .15s ease,box-shadow .15s ease,transform .15s ease}.dt-citation-card:hover{border-color:rgba(29,78,216,.3);box-shadow:0 8px 24px -10px rgba(24,24,27,.12);transform:translateY(-1px)}.dark .dt-citation-card{border-color:#27272a;background:#18181b;box-shadow:0 1px 2px rgba(0,0,0,.4)}.dark .dt-citation-card:hover{border-color:rgba(96,165,250,.46);box-shadow:0 8px 24px -10px rgba(0,0,0,.5)}.dt-composer-shell{border-top:1px solid var(--workbench-border);background:linear-gradient(180deg,transparent,rgba(246,248,252,.96))}.dark .dt-composer-shell{background:linear-gradient(180deg,transparent,rgba(7,7,8,.94))}.dt-composer{border:1px solid #d4d4d8;background:#fff;box-shadow:0 1px 2px rgba(24,24,27,.05)}.dt-composer:focus-within{border-color:#1d4ed8;box-shadow:0 0 0 2px rgba(29,78,216,.4)}.dark .dt-composer{border-color:#3f3f46;background:#18181b;box-shadow:0 1px 2px rgba(0,0,0,.4)}.dark .dt-composer:focus-within{border-color:#60a5fa;box-shadow:0 0 0 2px rgba(96,165,250,.4)}.dt-view-toggle{border-bottom:1px solid #e4e4e7;background:#fff}.dark .dt-view-toggle{border-bottom-color:#27272a;background:#09090b}.dt-document-stage{background:linear-gradient(180deg,hsla(0,0%,100%,.5),transparent 8rem),var(--reader-bg)}.dark .dt-document-stage{background:var(--reader-bg)}.dark .dt-admin-workbench,.dt-admin-workbench{background:transparent}.dt-admin-panel,.dt-admin-workbench .recharts-responsive-container+div{border-color:#e4e4e7;background:#fff;box-shadow:0 1px 2px rgba(24,24,27,.05)}.dark .dt-admin-panel,.dark .dt-admin-workbench .recharts-responsive-container+div{border-color:#27272a;background:#18181b;box-shadow:0 1px 2px rgba(0,0,0,.4)}.dt-admin-panel{border-radius:16px}.dt-kpi-card{border:1px solid #e4e4e7;background:#fff;box-shadow:0 1px 2px rgba(24,24,27,.05)}.dark .dt-kpi-card{border-color:#27272a;background:#18181b;box-shadow:0 1px 2px rgba(0,0,0,.4)}.dt-stitch-theme{position:relative;isolation:isolate;overflow-x:clip;color:var(--workbench-ink)}.dt-stitch-theme>*{position:relative;z-index:1}.dt-stitch-theme>.dt-shell-header{z-index:80}.dt-stitch-primary{background:#2563eb;color:#fff;box-shadow:0 1px 2px rgba(24,24,27,.05)}.dt-stitch-primary:hover{background:#1d4ed8;color:#fff}.dark .dt-stitch-primary{background:#3b82f6;color:#fff;box-shadow:0 1px 2px rgba(0,0,0,.4)}.dark .dt-stitch-primary:hover{background:#2563eb;color:#fff}.dt-stitch-card{border:1px solid #e4e4e7;background:#fff;box-shadow:0 1px 2px rgba(24,24,27,.05)}.dark .dt-stitch-card{border-color:#27272a;background:#18181b;box-shadow:0 1px 2px rgba(0,0,0,.4)}.dt-stitch-root{min-height:100%;color:var(--workbench-ink)}.dt-stitch-root>.min-h-screen,.dt-stitch-root>div[class*="dark:bg-zinc-950"],.dt-stitch-root>div[class*=bg-white],.dt-stitch-root>main.min-h-screen,.dt-stitch-root>main[class*="dark:bg-zinc-950"],.dt-stitch-root>main[class*=bg-white]{background:transparent!important}.dark\:prose-invert:is(.dark *){--tw-prose-body:var(--tw-prose-invert-body);--tw-prose-headings:var(--tw-prose-invert-headings);--tw-prose-lead:var(--tw-prose-invert-lead);--tw-prose-links:var(--tw-prose-invert-links);--tw-prose-bold:var(--tw-prose-invert-bold);--tw-prose-counters:var(--tw-prose-invert-counters);--tw-prose-bullets:var(--tw-prose-invert-bullets);--tw-prose-hr:var(--tw-prose-invert-hr);--tw-prose-quotes:var(--tw-prose-invert-quotes);--tw-prose-quote-borders:var(--tw-prose-invert-quote-borders);--tw-prose-captions:var(--tw-prose-invert-captions);--tw-prose-kbd:var(--tw-prose-invert-kbd);--tw-prose-kbd-shadows:var(--tw-prose-invert-kbd-shadows);--tw-prose-code:var(--tw-prose-invert-code);--tw-prose-pre-code:var(--tw-prose-invert-pre-code);--tw-prose-pre-bg:var(--tw-prose-invert-pre-bg);--tw-prose-th-borders:var(--tw-prose-invert-th-borders);--tw-prose-td-borders:var(--tw-prose-invert-td-borders);--tw-prose-invert-body:#fafafa;--tw-prose-invert-headings:#fafafa;--tw-prose-invert-bold:#fafafa}.dark\:prose-invert:is(.dark *) :where(code):not(:where([class~=not-prose],[class~=not-prose] *)){background-color:hsla(0,0%,100%,.12)}@media (min-width:640px){.sm\:prose-base{font-size:1rem;line-height:1.75}.sm\:prose-base :where(p):not(:where([class~=not-prose],[class~=not-prose] *)){margin-top:1.25em;margin-bottom:1.25em}.sm\:prose-base :where([class~=lead]):not(:where([class~=not-prose],[class~=not-prose] *)){font-size:1.25em;line-height:1.6;margin-top:1.2em;margin-bottom:1.2em}.sm\:prose-base :where(blockquote):not(:where([class~=not-prose],[class~=not-prose] *)){margin-top:1.6em;margin-bottom:1.6em;padding-inline-start:1em}.sm\:prose-base :where(h1):not(:where([class~=not-prose],[class~=not-prose] *)){font-size:2.25em;margin-top:0;margin-bottom:.8888889em;line-height:1.1111111}.sm\:prose-base :where(h2):not(:where([class~=not-prose],[class~=not-prose] *)){font-size:1.5em;margin-top:2em;margin-bottom:1em;line-height:1.3333333}.sm\:prose-base :where(h3):not(:where([class~=not-prose],[class~=not-prose] *)){font-size:1.25em;margin-top:1.6em;margin-bottom:.6em;line-height:1.6}.sm\:prose-base :where(h4):not(:where([class~=not-prose],[class~=not-prose] *)){margin-top:1.5em;margin-bottom:.5em;line-height:1.5}.sm\:prose-base :where(img):not(:where([class~=not-prose],[class~=not-prose] *)){margin-top:2em;margin-bottom:2em}.sm\:prose-base :where(picture):not(:where([class~=not-prose],[class~=not-prose] *)){margin-top:2em;margin-bottom:2em}.sm\:prose-base :where(picture>img):not(:where([class~=not-prose],[class~=not-prose] *)){margin-top:0;margin-bottom:0}.sm\:prose-base :where(video):not(:where([class~=not-prose],[class~=not-prose] *)){margin-top:2em;margin-bottom:2em}.sm\:prose-base :where(kbd):not(:where([class~=not-prose],[class~=not-prose] *)){font-size:.875em;border-radius:.3125rem;padding-top:.1875em;padding-inline-end:.375em;padding-bottom:.1875em;padding-inline-start:.375em}.sm\:prose-base :where(code):not(:where([class~=not-prose],[class~=not-prose] *)){font-size:.875em}.sm\:prose-base :where(h2 code):not(:where([class~=not-prose],[class~=not-prose] *)){font-size:.875em}.sm\:prose-base :where(h3 code):not(:where([class~=not-prose],[class~=not-prose] *)){font-size:.9em}.sm\:prose-base :where(pre):not(:where([class~=not-prose],[class~=not-prose] *)){font-size:.875em;line-height:1.7142857;margin-top:1.7142857em;margin-bottom:1.7142857em;border-radius:.375rem;padding-top:.8571429em;padding-inline-end:1.1428571em;padding-bottom:.8571429em;padding-inline-start:1.1428571em}.sm\:prose-base :where(ol):not(:where([class~=not-prose],[class~=not-prose] *)){margin-top:1.25em;margin-bottom:1.25em;padding-inline-start:1.625em}.sm\:prose-base :where(ul):not(:where([class~=not-prose],[class~=not-prose] *)){margin-top:1.25em;margin-bottom:1.25em;padding-inline-start:1.625em}.sm\:prose-base :where(li):not(:where([class~=not-prose],[class~=not-prose] *)){margin-top:.5em;margin-bottom:.5em}.sm\:prose-base :where(ol>li):not(:where([class~=not-prose],[class~=not-prose] *)){padding-inline-start:.375em}.sm\:prose-base :where(ul>li):not(:where([class~=not-prose],[class~=not-prose] *)){padding-inline-start:.375em}.sm\:prose-base :where(.sm\:prose-base>ul>li p):not(:where([class~=not-prose],[class~=not-prose] *)){margin-top:.75em;margin-bottom:.75em}.sm\:prose-base :where(.sm\:prose-base>ul>li>p:first-child):not(:where([class~=not-prose],[class~=not-prose] *)){margin-top:1.25em}.sm\:prose-base :where(.sm\:prose-base>ul>li>p:last-child):not(:where([class~=not-prose],[class~=not-prose] *)){margin-bottom:1.25em}.sm\:prose-base :where(.sm\:prose-base>ol>li>p:first-child):not(:where([class~=not-prose],[class~=not-prose] *)){margin-top:1.25em}.sm\:prose-base :where(.sm\:prose-base>ol>li>p:last-child):not(:where([class~=not-prose],[class~=not-prose] *)){margin-bottom:1.25em}.sm\:prose-base :where(ul ul,ul ol,ol ul,ol ol):not(:where([class~=not-prose],[class~=not-prose] *)){margin-top:.75em;margin-bottom:.75em}.sm\:prose-base :where(dl):not(:where([class~=not-prose],[class~=not-prose] *)){margin-top:1.25em;margin-bottom:1.25em}.sm\:prose-base :where(dt):not(:where([class~=not-prose],[class~=not-prose] *)){margin-top:1.25em}.sm\:prose-base :where(dd):not(:where([class~=not-prose],[class~=not-prose] *)){margin-top:.5em;padding-inline-start:1.625em}.sm\:prose-base :where(hr):not(:where([class~=not-prose],[class~=not-prose] *)){margin-top:3em;margin-bottom:3em}.sm\:prose-base :where(hr+*):not(:where([class~=not-prose],[class~=not-prose] *)){margin-top:0}.sm\:prose-base :where(h2+*):not(:where([class~=not-prose],[class~=not-prose] *)){margin-top:0}.sm\:prose-base :where(h3+*):not(:where([class~=not-prose],[class~=not-prose] *)){margin-top:0}.sm\:prose-base :where(h4+*):not(:where([class~=not-prose],[class~=not-prose] *)){margin-top:0}.sm\:prose-base :where(table):not(:where([class~=not-prose],[class~=not-prose] *)){font-size:.875em;line-height:1.7142857}.sm\:prose-base :where(thead th):not(:where([class~=not-prose],[class~=not-prose] *)){padding-inline-end:.5714286em;padding-bottom:.5714286em;padding-inline-start:.5714286em}.sm\:prose-base :where(thead th:first-child):not(:where([class~=not-prose],[class~=not-prose] *)){padding-inline-start:0}.sm\:prose-base :where(thead th:last-child):not(:where([class~=not-prose],[class~=not-prose] *)){padding-inline-end:0}.sm\:prose-base :where(tbody td,tfoot td):not(:where([class~=not-prose],[class~=not-prose] *)){padding-top:.5714286em;padding-inline-end:.5714286em;padding-bottom:.5714286em;padding-inline-start:.5714286em}.sm\:prose-base :where(tbody td:first-child,tfoot td:first-child):not(:where([class~=not-prose],[class~=not-prose] *)){padding-inline-start:0}.sm\:prose-base :where(tbody td:last-child,tfoot td:last-child):not(:where([class~=not-prose],[class~=not-prose] *)){padding-inline-end:0}.sm\:prose-base :where(figure):not(:where([class~=not-prose],[class~=not-prose] *)){margin-top:2em;margin-bottom:2em}.sm\:prose-base :where(figure>*):not(:where([class~=not-prose],[class~=not-prose] *)){margin-top:0;margin-bottom:0}.sm\:prose-base :where(figcaption):not(:where([class~=not-prose],[class~=not-prose] *)){font-size:.875em;line-height:1.4285714;margin-top:.8571429em}.sm\:prose-base :where(.sm\:prose-base>:first-child):not(:where([class~=not-prose],[class~=not-prose] *)){margin-top:0}.sm\:prose-base :where(.sm\:prose-base>:last-child):not(:where([class~=not-prose],[class~=not-prose] *)){margin-bottom:0}}.placeholder\:text-zinc-400::-moz-placeholder{--tw-text-opacity:1;color:rgb(161 161 170/var(--tw-text-opacity,1))}.placeholder\:text-zinc-400::placeholder{--tw-text-opacity:1;color:rgb(161 161 170/var(--tw-text-opacity,1))}.before\:absolute:before{content:var(--tw-content);position:absolute}.before\:inset-0:before{content:var(--tw-content);inset:0}.before\:-z-10:before{content:var(--tw-content);z-index:-10}.before\:translate-y-full:before{content:var(--tw-content);--tw-translate-y:100%;transform:translate(var(--tw-translate-x),var(--tw-translate-y)) rotate(var(--tw-rotate)) skewX(var(--tw-skew-x)) skewY(var(--tw-skew-y)) scaleX(var(--tw-scale-x)) scaleY(var(--tw-scale-y))}.before\:bg-accent-hover:before{content:var(--tw-content);background-color:var(--accent-hover)}.before\:bg-zinc-900\/\[\.06\]:before{content:var(--tw-content);background-color:rgba(24,24,27,.06)}.before\:transition-transform:before{content:var(--tw-content);transition-property:transform;transition-timing-function:cubic-bezier(.4,0,.2,1);transition-duration:.15s}.before\:duration-\[450ms\]:before{content:var(--tw-content);transition-duration:.45s}.before\:ease-\[cubic-bezier\(\.7\2c 0\2c \.2\2c 1\)\]:before{content:var(--tw-content);transition-timing-function:cubic-bezier(.7,0,.2,1)}.before\:content-\[\'\'\]:before{--tw-content:"";content:var(--tw-content)}.first\:pt-0:first-child{padding-top:0}.last\:border-b-0:last-child{border-bottom-width:0}.target\:bg-\[var\(--ed-paper-2\)\]:target{background-color:var(--ed-paper-2)}.hover\:-translate-y-0\.5:hover{--tw-translate-y:-0.125rem;transform:translate(var(--tw-translate-x),var(--tw-translate-y)) rotate(var(--tw-rotate)) skewX(var(--tw-skew-x)) skewY(var(--tw-skew-y)) scaleX(var(--tw-scale-x)) scaleY(var(--tw-scale-y))}.hover\:border-\[var\(--reader-border-strong\)\]:hover{border-color:var(--reader-border-strong)}.hover\:border-\[var\(--reader-evidence\)\]:hover{border-color:var(--reader-evidence)}.hover\:border-\[var\(--workbench-border-strong\)\]:hover{border-color:var(--workbench-border-strong)}.hover\:border-blue-400:hover{--tw-border-opacity:1;border-color:rgb(96 165 250/var(--tw-border-opacity,1))}.hover\:border-red-200:hover{--tw-border-opacity:1;border-color:rgb(254 202 202/var(--tw-border-opacity,1))}.hover\:border-zinc-300:hover{--tw-border-opacity:1;border-color:rgb(212 212 216/var(--tw-border-opacity,1))}.hover\:bg-\[var\(--reader-panel-muted\)\]:hover{background-color:var(--reader-panel-muted)}.hover\:bg-accent-hover:hover{background-color:var(--accent-hover)}.hover\:bg-amber-100:hover{--tw-bg-opacity:1;background-color:rgb(254 243 199/var(--tw-bg-opacity,1))}.hover\:bg-blue-700:hover{--tw-bg-opacity:1;background-color:rgb(29 78 216/var(--tw-bg-opacity,1))}.hover\:bg-blue-800:hover{--tw-bg-opacity:1;background-color:rgb(30 64 175/var(--tw-bg-opacity,1))}.hover\:bg-red-100:hover{--tw-bg-opacity:1;background-color:rgb(254 226 226/var(--tw-bg-opacity,1))}.hover\:bg-red-50:hover{--tw-bg-opacity:1;background-color:rgb(254 242 242/var(--tw-bg-opacity,1))}.hover\:bg-red-500:hover{--tw-bg-opacity:1;background-color:rgb(239 68 68/var(--tw-bg-opacity,1))}.hover\:bg-red-700:hover{--tw-bg-opacity:1;background-color:rgb(185 28 28/var(--tw-bg-opacity,1))}.hover\:bg-white:hover{--tw-bg-opacity:1;background-color:rgb(255 255 255/var(--tw-bg-opacity,1))}.hover\:bg-white\/50:hover{background-color:hsla(0,0%,100%,.5)}.hover\:bg-white\/70:hover{background-color:hsla(0,0%,100%,.7)}.hover\:bg-zinc-100:hover{--tw-bg-opacity:1;background-color:rgb(244 244 245/var(--tw-bg-opacity,1))}.hover\:bg-zinc-200:hover{--tw-bg-opacity:1;background-color:rgb(228 228 231/var(--tw-bg-opacity,1))}.hover\:bg-zinc-300:hover{--tw-bg-opacity:1;background-color:rgb(212 212 216/var(--tw-bg-opacity,1))}.hover\:bg-zinc-50:hover{--tw-bg-opacity:1;background-color:rgb(250 250 250/var(--tw-bg-opacity,1))}.hover\:bg-zinc-700:hover{--tw-bg-opacity:1;background-color:rgb(63 63 70/var(--tw-bg-opacity,1))}.hover\:bg-zinc-800:hover{--tw-bg-opacity:1;background-color:rgb(39 39 42/var(--tw-bg-opacity,1))}.hover\:text-\[var\(--reader-ink\)\]:hover{color:var(--reader-ink)}.hover\:text-\[var\(--workbench-ink\)\]:hover{color:var(--workbench-ink)}.hover\:text-accent:hover{color:var(--accent)}.hover\:text-amber-700:hover{--tw-text-opacity:1;color:rgb(180 83 9/var(--tw-text-opacity,1))}.hover\:text-red-500:hover{--tw-text-opacity:1;color:rgb(239 68 68/var(--tw-text-opacity,1))}.hover\:text-red-600:hover{--tw-text-opacity:1;color:rgb(220 38 38/var(--tw-text-opacity,1))}.hover\:text-red-700:hover{--tw-text-opacity:1;color:rgb(185 28 28/var(--tw-text-opacity,1))}.hover\:text-red-800:hover{--tw-text-opacity:1;color:rgb(153 27 27/var(--tw-text-opacity,1))}.hover\:text-zinc-600:hover{--tw-text-opacity:1;color:rgb(82 82 91/var(--tw-text-opacity,1))}.hover\:text-zinc-700:hover{--tw-text-opacity:1;color:rgb(63 63 70/var(--tw-text-opacity,1))}.hover\:text-zinc-800:hover{--tw-text-opacity:1;color:rgb(39 39 42/var(--tw-text-opacity,1))}.hover\:text-zinc-900:hover{--tw-text-opacity:1;color:rgb(24 24 27/var(--tw-text-opacity,1))}.hover\:text-zinc-950:hover{--tw-text-opacity:1;color:rgb(9 9 11/var(--tw-text-opacity,1))}.hover\:underline:hover{text-decoration-line:underline}.hover\:opacity-80:hover{opacity:.8}.hover\:shadow-lg:hover{--tw-shadow:0 10px 15px -3px rgba(0,0,0,.1),0 4px 6px -4px rgba(0,0,0,.1);--tw-shadow-colored:0 10px 15px -3px var(--tw-shadow-color),0 4px 6px -4px var(--tw-shadow-color)}.hover\:shadow-lg:hover,.hover\:shadow-md:hover{box-shadow:var(--tw-ring-offset-shadow,0 0 #0000),var(--tw-ring-shadow,0 0 #0000),var(--tw-shadow)}.hover\:shadow-md:hover{--tw-shadow:0 4px 6px -1px rgba(0,0,0,.1),0 2px 4px -2px rgba(0,0,0,.1);--tw-shadow-colored:0 4px 6px -1px var(--tw-shadow-color),0 2px 4px -2px var(--tw-shadow-color)}.hover\:brightness-95:hover{--tw-brightness:brightness(.95);filter:var(--tw-blur) var(--tw-brightness) var(--tw-contrast) var(--tw-grayscale) var(--tw-hue-rotate) var(--tw-invert) var(--tw-saturate) var(--tw-sepia) var(--tw-drop-shadow)}.hover\:\[animation-play-state\:paused\]:hover{animation-play-state:paused}.hover\:before\:translate-y-0:hover:before{content:var(--tw-content);--tw-translate-y:0px;transform:translate(var(--tw-translate-x),var(--tw-translate-y)) rotate(var(--tw-rotate)) skewX(var(--tw-skew-x)) skewY(var(--tw-skew-y)) scaleX(var(--tw-scale-x)) scaleY(var(--tw-scale-y))}.focus\:not-sr-only:focus{position:static;width:auto;height:auto;padding:0;margin:0;overflow:visible;clip:auto;white-space:normal}.focus\:absolute:focus{position:absolute}.focus\:left-4:focus{left:1rem}.focus\:top-4:focus{top:1rem}.focus\:z-50:focus{z-index:50}.focus\:rounded-md:focus{border-radius:.375rem}.focus\:border-zinc-300:focus{--tw-border-opacity:1;border-color:rgb(212 212 216/var(--tw-border-opacity,1))}.focus\:border-zinc-400:focus{--tw-border-opacity:1;border-color:rgb(161 161 170/var(--tw-border-opacity,1))}.focus\:border-zinc-500:focus{--tw-border-opacity:1;border-color:rgb(113 113 122/var(--tw-border-opacity,1))}.focus\:bg-zinc-900:focus{--tw-bg-opacity:1;background-color:rgb(24 24 27/var(--tw-bg-opacity,1))}.focus\:px-4:focus{padding-left:1rem;padding-right:1rem}.focus\:py-2:focus{padding-top:.5rem;padding-bottom:.5rem}.focus\:text-sm:focus{font-size:.875rem;line-height:1.25rem}.focus\:font-medium:focus{font-weight:500}.focus\:text-white:focus{--tw-text-opacity:1;color:rgb(255 255 255/var(--tw-text-opacity,1))}.focus\:outline-none:focus{outline:2px solid transparent;outline-offset:2px}.focus\:ring-2:focus{--tw-ring-offset-shadow:var(--tw-ring-inset) 0 0 0 var(--tw-ring-offset-width) var(--tw-ring-offset-color);--tw-ring-shadow:var(--tw-ring-inset) 0 0 0 calc(2px + var(--tw-ring-offset-width)) var(--tw-ring-color);box-shadow:var(--tw-ring-offset-shadow),var(--tw-ring-shadow),var(--tw-shadow,0 0 #0000)}.focus\:ring-zinc-200:focus{--tw-ring-opacity:1;--tw-ring-color:rgb(228 228 231/var(--tw-ring-opacity,1))}.focus\:ring-zinc-500:focus{--tw-ring-opacity:1;--tw-ring-color:rgb(113 113 122/var(--tw-ring-opacity,1))}.focus-visible\:rounded:focus-visible{border-radius:.25rem}.focus-visible\:rounded-lg:focus-visible{border-radius:.5rem}.focus-visible\:rounded-sm:focus-visible{border-radius:.125rem}.focus-visible\:opacity-100:focus-visible{opacity:1}.focus-visible\:outline-none:focus-visible{outline:2px solid transparent;outline-offset:2px}.focus-visible\:ring-2:focus-visible{--tw-ring-offset-shadow:var(--tw-ring-inset) 0 0 0 var(--tw-ring-offset-width) var(--tw-ring-offset-color);--tw-ring-shadow:var(--tw-ring-inset) 0 0 0 calc(2px + var(--tw-ring-offset-width)) var(--tw-ring-color);box-shadow:var(--tw-ring-offset-shadow),var(--tw-ring-shadow),var(--tw-shadow,0 0 #0000)}.focus-visible\:ring-inset:focus-visible{--tw-ring-inset:inset}.focus-visible\:ring-\[var\(--reader-evidence\)\]:focus-visible{--tw-ring-color:var(--reader-evidence)}.focus-visible\:ring-accent:focus-visible{--tw-ring-color:var(--accent)}.focus-visible\:ring-blue-400:focus-visible{--tw-ring-opacity:1;--tw-ring-color:rgb(96 165 250/var(--tw-ring-opacity,1))}.focus-visible\:ring-blue-500:focus-visible{--tw-ring-opacity:1;--tw-ring-color:rgb(59 130 246/var(--tw-ring-opacity,1))}.focus-visible\:ring-blue-600:focus-visible{--tw-ring-opacity:1;--tw-ring-color:rgb(37 99 235/var(--tw-ring-opacity,1))}.focus-visible\:ring-emerald-400:focus-visible{--tw-ring-opacity:1;--tw-ring-color:rgb(52 211 153/var(--tw-ring-opacity,1))}.focus-visible\:ring-red-400:focus-visible{--tw-ring-opacity:1;--tw-ring-color:rgb(248 113 113/var(--tw-ring-opacity,1))}.focus-visible\:ring-white\/50:focus-visible{--tw-ring-color:hsla(0,0%,100%,.5)}.focus-visible\:ring-zinc-400:focus-visible{--tw-ring-opacity:1;--tw-ring-color:rgb(161 161 170/var(--tw-ring-opacity,1))}.focus-visible\:ring-zinc-500:focus-visible{--tw-ring-opacity:1;--tw-ring-color:rgb(113 113 122/var(--tw-ring-opacity,1))}.focus-visible\:ring-offset-1:focus-visible{--tw-ring-offset-width:1px}.focus-visible\:ring-offset-2:focus-visible{--tw-ring-offset-width:2px}.focus-visible\:ring-offset-blue-50:focus-visible{--tw-ring-offset-color:#eff6ff}.focus-visible\:ring-offset-white:focus-visible{--tw-ring-offset-color:#fff}.focus-visible\:ring-offset-zinc-50:focus-visible{--tw-ring-offset-color:#fafafa}.focus-visible\:ring-offset-zinc-900:focus-visible{--tw-ring-offset-color:#18181b}.focus-visible\:ring-offset-zinc-950:focus-visible{--tw-ring-offset-color:#09090b}.active\:scale-\[0\.97\]:active{--tw-scale-x:0.97;--tw-scale-y:0.97;transform:translate(var(--tw-translate-x),var(--tw-translate-y)) rotate(var(--tw-rotate)) skewX(var(--tw-skew-x)) skewY(var(--tw-skew-y)) scaleX(var(--tw-scale-x)) scaleY(var(--tw-scale-y))}.disabled\:cursor-not-allowed:disabled{cursor:not-allowed}.disabled\:opacity-30:disabled{opacity:.3}.disabled\:opacity-40:disabled{opacity:.4}.disabled\:opacity-50:disabled{opacity:.5}.disabled\:opacity-60:disabled{opacity:.6}.group:focus-within .group-focus-within\:opacity-100{opacity:1}.group:hover .group-hover\:translate-x-0\.5{--tw-translate-x:0.125rem;transform:translate(var(--tw-translate-x),var(--tw-translate-y)) rotate(var(--tw-rotate)) skewX(var(--tw-skew-x)) skewY(var(--tw-skew-y)) scaleX(var(--tw-scale-x)) scaleY(var(--tw-scale-y))}.group:hover .group-hover\:bg-accent-light{background-color:var(--accent-light)}.group:hover .group-hover\:text-\[var\(--reader-evidence\)\]{color:var(--reader-evidence)}.group:hover .group-hover\:text-accent{color:var(--accent)}.group:hover .group-hover\:opacity-100{opacity:1}@keyframes fade-in{0%{opacity:0}to{opacity:1}}.data-\[state\=open\]\:animate-fade-in[data-state=open]{animation:fade-in .15s ease-out}.prose-headings\:scroll-mt-28 :is(:where(h1,h2,h3,h4,h5,h6,th):not(:where([class~=not-prose],[class~=not-prose] *))){scroll-margin-top:7rem}.prose-headings\:text-zinc-900 :is(:where(h1,h2,h3,h4,h5,h6,th):not(:where([class~=not-prose],[class~=not-prose] *))){--tw-text-opacity:1;color:rgb(24 24 27/var(--tw-text-opacity,1))}.prose-p\:leading-8 :is(:where(p):not(:where([class~=not-prose],[class~=not-prose] *))){line-height:2rem}.prose-a\:text-zinc-600 :is(:where(a):not(:where([class~=not-prose],[class~=not-prose] *))){--tw-text-opacity:1;color:rgb(82 82 91/var(--tw-text-opacity,1))}.prose-a\:underline :is(:where(a):not(:where([class~=not-prose],[class~=not-prose] *))){text-decoration-line:underline}.prose-strong\:text-zinc-900 :is(:where(strong):not(:where([class~=not-prose],[class~=not-prose] *))){--tw-text-opacity:1;color:rgb(24 24 27/var(--tw-text-opacity,1))}.prose-code\:text-zinc-700 :is(:where(code):not(:where([class~=not-prose],[class~=not-prose] *))){--tw-text-opacity:1;color:rgb(63 63 70/var(--tw-text-opacity,1))}.prose-pre\:rounded-lg :is(:where(pre):not(:where([class~=not-prose],[class~=not-prose] *))){border-radius:.5rem}.prose-pre\:bg-zinc-100 :is(:where(pre):not(:where([class~=not-prose],[class~=not-prose] *))){--tw-bg-opacity:1;background-color:rgb(244 244 245/var(--tw-bg-opacity,1))}.prose-li\:leading-8 :is(:where(li):not(:where([class~=not-prose],[class~=not-prose] *))){line-height:2rem}.prose-table\:w-full :is(:where(table):not(:where([class~=not-prose],[class~=not-prose] *))){width:100%}.prose-table\:border-collapse :is(:where(table):not(:where([class~=not-prose],[class~=not-prose] *))){border-collapse:collapse}.prose-table\:text-sm :is(:where(table):not(:where([class~=not-prose],[class~=not-prose] *))){font-size:.875rem;line-height:1.25rem}.prose-tr\:even\:bg-zinc-50\/50:nth-child(2n) :is(:where(tr):not(:where([class~=not-prose],[class~=not-prose] *))){background-color:hsla(0,0%,98%,.5)}.prose-th\:border :is(:where(th):not(:where([class~=not-prose],[class~=not-prose] *))){border-width:1px}.prose-th\:border-zinc-300 :is(:where(th):not(:where([class~=not-prose],[class~=not-prose] *))){--tw-border-opacity:1;border-color:rgb(212 212 216/var(--tw-border-opacity,1))}.prose-th\:bg-zinc-50 :is(:where(th):not(:where([class~=not-prose],[class~=not-prose] *))){--tw-bg-opacity:1;background-color:rgb(250 250 250/var(--tw-bg-opacity,1))}.prose-th\:px-3 :is(:where(th):not(:where([class~=not-prose],[class~=not-prose] *))){padding-left:.75rem;padding-right:.75rem}.prose-th\:py-2 :is(:where(th):not(:where([class~=not-prose],[class~=not-prose] *))){padding-top:.5rem;padding-bottom:.5rem}.prose-th\:text-left :is(:where(th):not(:where([class~=not-prose],[class~=not-prose] *))){text-align:left}.prose-th\:font-semibold :is(:where(th):not(:where([class~=not-prose],[class~=not-prose] *))){font-weight:600}.prose-td\:border :is(:where(td):not(:where([class~=not-prose],[class~=not-prose] *))){border-width:1px}.prose-td\:border-zinc-200 :is(:where(td):not(:where([class~=not-prose],[class~=not-prose] *))){--tw-border-opacity:1;border-color:rgb(228 228 231/var(--tw-border-opacity,1))}.prose-td\:px-3 :is(:where(td):not(:where([class~=not-prose],[class~=not-prose] *))){padding-left:.75rem;padding-right:.75rem}.prose-td\:py-1\.5 :is(:where(td):not(:where([class~=not-prose],[class~=not-prose] *))){padding-top:.375rem;padding-bottom:.375rem}@media (prefers-reduced-motion:reduce){.motion-reduce\:inline{display:inline}.motion-reduce\:hidden{display:none}.motion-reduce\:transform-none{transform:none}.motion-reduce\:animate-none{animation:none}.motion-reduce\:opacity-40{opacity:.4}.motion-reduce\:transition-none{transition-property:none}.motion-reduce\:\[animation\:none\!important\]{animation:none!important}.motion-reduce\:before\:hidden:before{content:var(--tw-content);display:none}}.dark\:divide-zinc-800:is(.dark *)>:not([hidden])~:not([hidden]){--tw-divide-opacity:1;border-color:rgb(39 39 42/var(--tw-divide-opacity,1))}.dark\:border-amber-300\/25:is(.dark *){border-color:rgba(252,211,77,.25)}.dark\:border-amber-300\/30:is(.dark *){border-color:rgba(252,211,77,.3)}.dark\:border-amber-900\/50:is(.dark *){border-color:rgba(120,53,15,.5)}.dark\:border-amber-900\/60:is(.dark *){border-color:rgba(120,53,15,.6)}.dark\:border-blue-300\/25:is(.dark *){border-color:rgba(147,197,253,.25)}.dark\:border-blue-400:is(.dark *){--tw-border-opacity:1;border-color:rgb(96 165 250/var(--tw-border-opacity,1))}.dark\:border-blue-800:is(.dark *){--tw-border-opacity:1;border-color:rgb(30 64 175/var(--tw-border-opacity,1))}.dark\:border-blue-900\/50:is(.dark *){border-color:rgba(30,58,138,.5)}.dark\:border-blue-900\/60:is(.dark *){border-color:rgba(30,58,138,.6)}.dark\:border-emerald-900\/60:is(.dark *){border-color:rgba(6,78,59,.6)}.dark\:border-red-300\/25:is(.dark *){border-color:hsla(0,94%,82%,.25)}.dark\:border-red-700:is(.dark *){--tw-border-opacity:1;border-color:rgb(185 28 28/var(--tw-border-opacity,1))}.dark\:border-red-800:is(.dark *){--tw-border-opacity:1;border-color:rgb(153 27 27/var(--tw-border-opacity,1))}.dark\:border-red-900:is(.dark *){--tw-border-opacity:1;border-color:rgb(127 29 29/var(--tw-border-opacity,1))}.dark\:border-red-900\/50:is(.dark *){border-color:rgba(127,29,29,.5)}.dark\:border-red-900\/60:is(.dark *){border-color:rgba(127,29,29,.6)}.dark\:border-white\/10:is(.dark *){border-color:hsla(0,0%,100%,.1)}.dark\:border-white\/40:is(.dark *){border-color:hsla(0,0%,100%,.4)}.dark\:border-zinc-100:is(.dark *){--tw-border-opacity:1;border-color:rgb(244 244 245/var(--tw-border-opacity,1))}.dark\:border-zinc-200:is(.dark *){--tw-border-opacity:1;border-color:rgb(228 228 231/var(--tw-border-opacity,1))}.dark\:border-zinc-600:is(.dark *){--tw-border-opacity:1;border-color:rgb(82 82 91/var(--tw-border-opacity,1))}.dark\:border-zinc-700:is(.dark *){--tw-border-opacity:1;border-color:rgb(63 63 70/var(--tw-border-opacity,1))}.dark\:border-zinc-800:is(.dark *){--tw-border-opacity:1;border-color:rgb(39 39 42/var(--tw-border-opacity,1))}.dark\:border-zinc-800\/50:is(.dark *){border-color:rgba(39,39,42,.5)}.dark\:border-zinc-800\/60:is(.dark *){border-color:rgba(39,39,42,.6)}.dark\:bg-amber-200:is(.dark *){--tw-bg-opacity:1;background-color:rgb(253 230 138/var(--tw-bg-opacity,1))}.dark\:bg-amber-300\/10:is(.dark *){background-color:rgba(252,211,77,.1)}.dark\:bg-amber-500:is(.dark *){--tw-bg-opacity:1;background-color:rgb(245 158 11/var(--tw-bg-opacity,1))}.dark\:bg-amber-700\/60:is(.dark *){background-color:rgba(180,83,9,.6)}.dark\:bg-amber-950\/30:is(.dark *){background-color:rgba(69,26,3,.3)}.dark\:bg-blue-300\/10:is(.dark *){background-color:rgba(147,197,253,.1)}.dark\:bg-blue-400\/10:is(.dark *){background-color:rgba(96,165,250,.1)}.dark\:bg-blue-500:is(.dark *){--tw-bg-opacity:1;background-color:rgb(59 130 246/var(--tw-bg-opacity,1))}.dark\:bg-blue-950\/20:is(.dark *){background-color:rgba(23,37,84,.2)}.dark\:bg-blue-950\/30:is(.dark *){background-color:rgba(23,37,84,.3)}.dark\:bg-blue-950\/40:is(.dark *){background-color:rgba(23,37,84,.4)}.dark\:bg-emerald-400\/10:is(.dark *){background-color:rgba(52,211,153,.1)}.dark\:bg-emerald-900\/30:is(.dark *){background-color:rgba(6,78,59,.3)}.dark\:bg-emerald-950\/30:is(.dark *){background-color:rgba(2,44,34,.3)}.dark\:bg-emerald-950\/40:is(.dark *){background-color:rgba(2,44,34,.4)}.dark\:bg-green-900\/30:is(.dark *){background-color:rgba(20,83,45,.3)}.dark\:bg-red-300\/10:is(.dark *){background-color:hsla(0,94%,82%,.1)}.dark\:bg-red-400\/10:is(.dark *){background-color:hsla(0,91%,71%,.1)}.dark\:bg-red-500:is(.dark *){--tw-bg-opacity:1;background-color:rgb(239 68 68/var(--tw-bg-opacity,1))}.dark\:bg-red-900\/20:is(.dark *){background-color:rgba(127,29,29,.2)}.dark\:bg-red-900\/30:is(.dark *){background-color:rgba(127,29,29,.3)}.dark\:bg-red-950:is(.dark *){--tw-bg-opacity:1;background-color:rgb(69 10 10/var(--tw-bg-opacity,1))}.dark\:bg-red-950\/30:is(.dark *){background-color:rgba(69,10,10,.3)}.dark\:bg-red-950\/40:is(.dark *){background-color:rgba(69,10,10,.4)}.dark\:bg-white:is(.dark *){--tw-bg-opacity:1;background-color:rgb(255 255 255/var(--tw-bg-opacity,1))}.dark\:bg-white\/10:is(.dark *){background-color:hsla(0,0%,100%,.1)}.dark\:bg-white\/45:is(.dark *){background-color:hsla(0,0%,100%,.45)}.dark\:bg-yellow-700\/50:is(.dark *){background-color:rgba(161,98,7,.5)}.dark\:bg-zinc-100:is(.dark *){--tw-bg-opacity:1;background-color:rgb(244 244 245/var(--tw-bg-opacity,1))}.dark\:bg-zinc-200:is(.dark *){--tw-bg-opacity:1;background-color:rgb(228 228 231/var(--tw-bg-opacity,1))}.dark\:bg-zinc-50:is(.dark *){--tw-bg-opacity:1;background-color:rgb(250 250 250/var(--tw-bg-opacity,1))}.dark\:bg-zinc-500:is(.dark *){--tw-bg-opacity:1;background-color:rgb(113 113 122/var(--tw-bg-opacity,1))}.dark\:bg-zinc-700:is(.dark *){--tw-bg-opacity:1;background-color:rgb(63 63 70/var(--tw-bg-opacity,1))}.dark\:bg-zinc-800:is(.dark *){--tw-bg-opacity:1;background-color:rgb(39 39 42/var(--tw-bg-opacity,1))}.dark\:bg-zinc-800\/60:is(.dark *){background-color:rgba(39,39,42,.6)}.dark\:bg-zinc-800\/70:is(.dark *){background-color:rgba(39,39,42,.7)}.dark\:bg-zinc-800\/90:is(.dark *){background-color:rgba(39,39,42,.9)}.dark\:bg-zinc-900:is(.dark *){--tw-bg-opacity:1;background-color:rgb(24 24 27/var(--tw-bg-opacity,1))}.dark\:bg-zinc-900\/30:is(.dark *){background-color:rgba(24,24,27,.3)}.dark\:bg-zinc-900\/50:is(.dark *){background-color:rgba(24,24,27,.5)}.dark\:bg-zinc-900\/95:is(.dark *){background-color:rgba(24,24,27,.95)}.dark\:bg-zinc-950:is(.dark *){--tw-bg-opacity:1;background-color:rgb(9 9 11/var(--tw-bg-opacity,1))}.dark\:bg-zinc-950\/90:is(.dark *){background-color:rgba(9,9,11,.9)}.dark\:bg-zinc-950\/95:is(.dark *){background-color:rgba(9,9,11,.95)}.dark\:fill-zinc-800:is(.dark *){fill:#27272a}.dark\:fill-zinc-950:is(.dark *){fill:#09090b}.dark\:text-amber-100:is(.dark *){--tw-text-opacity:1;color:rgb(254 243 199/var(--tw-text-opacity,1))}.dark\:text-amber-200:is(.dark *){--tw-text-opacity:1;color:rgb(253 230 138/var(--tw-text-opacity,1))}.dark\:text-amber-300:is(.dark *){--tw-text-opacity:1;color:rgb(252 211 77/var(--tw-text-opacity,1))}.dark\:text-amber-400:is(.dark *){--tw-text-opacity:1;color:rgb(251 191 36/var(--tw-text-opacity,1))}.dark\:text-blue-100:is(.dark *){--tw-text-opacity:1;color:rgb(219 234 254/var(--tw-text-opacity,1))}.dark\:text-blue-200:is(.dark *){--tw-text-opacity:1;color:rgb(191 219 254/var(--tw-text-opacity,1))}.dark\:text-blue-300:is(.dark *){--tw-text-opacity:1;color:rgb(147 197 253/var(--tw-text-opacity,1))}.dark\:text-blue-400:is(.dark *){--tw-text-opacity:1;color:rgb(96 165 250/var(--tw-text-opacity,1))}.dark\:text-emerald-100:is(.dark *){--tw-text-opacity:1;color:rgb(209 250 229/var(--tw-text-opacity,1))}.dark\:text-emerald-200:is(.dark *){--tw-text-opacity:1;color:rgb(167 243 208/var(--tw-text-opacity,1))}.dark\:text-emerald-300:is(.dark *){--tw-text-opacity:1;color:rgb(110 231 183/var(--tw-text-opacity,1))}.dark\:text-emerald-400:is(.dark *){--tw-text-opacity:1;color:rgb(52 211 153/var(--tw-text-opacity,1))}.dark\:text-green-400:is(.dark *){--tw-text-opacity:1;color:rgb(74 222 128/var(--tw-text-opacity,1))}.dark\:text-red-100:is(.dark *){--tw-text-opacity:1;color:rgb(254 226 226/var(--tw-text-opacity,1))}.dark\:text-red-200:is(.dark *){--tw-text-opacity:1;color:rgb(254 202 202/var(--tw-text-opacity,1))}.dark\:text-red-300:is(.dark *){--tw-text-opacity:1;color:rgb(252 165 165/var(--tw-text-opacity,1))}.dark\:text-red-400:is(.dark *){--tw-text-opacity:1;color:rgb(248 113 113/var(--tw-text-opacity,1))}.dark\:text-white:is(.dark *){--tw-text-opacity:1;color:rgb(255 255 255/var(--tw-text-opacity,1))}.dark\:text-white\/25:is(.dark *){color:hsla(0,0%,100%,.25)}.dark\:text-zinc-100:is(.dark *){--tw-text-opacity:1;color:rgb(244 244 245/var(--tw-text-opacity,1))}.dark\:text-zinc-200:is(.dark *){--tw-text-opacity:1;color:rgb(228 228 231/var(--tw-text-opacity,1))}.dark\:text-zinc-300:is(.dark *){--tw-text-opacity:1;color:rgb(212 212 216/var(--tw-text-opacity,1))}.dark\:text-zinc-400:is(.dark *){--tw-text-opacity:1;color:rgb(161 161 170/var(--tw-text-opacity,1))}.dark\:text-zinc-50:is(.dark *){--tw-text-opacity:1;color:rgb(250 250 250/var(--tw-text-opacity,1))}.dark\:text-zinc-500:is(.dark *){--tw-text-opacity:1;color:rgb(113 113 122/var(--tw-text-opacity,1))}.dark\:text-zinc-600:is(.dark *){--tw-text-opacity:1;color:rgb(82 82 91/var(--tw-text-opacity,1))}.dark\:text-zinc-700:is(.dark *){--tw-text-opacity:1;color:rgb(63 63 70/var(--tw-text-opacity,1))}.dark\:text-zinc-800:is(.dark *){--tw-text-opacity:1;color:rgb(39 39 42/var(--tw-text-opacity,1))}.dark\:text-zinc-900:is(.dark *){--tw-text-opacity:1;color:rgb(24 24 27/var(--tw-text-opacity,1))}.dark\:text-zinc-950:is(.dark *){--tw-text-opacity:1;color:rgb(9 9 11/var(--tw-text-opacity,1))}.dark\:mix-blend-screen:is(.dark *){mix-blend-mode:screen}.dark\:shadow-\[0_1px_3px_0_rgba\(0\2c 0\2c 0\2c 0\.4\)\]:is(.dark *){--tw-shadow:0 1px 3px 0 rgba(0,0,0,.4);--tw-shadow-colored:0 1px 3px 0 var(--tw-shadow-color);box-shadow:var(--tw-ring-offset-shadow,0 0 #0000),var(--tw-ring-shadow,0 0 #0000),var(--tw-shadow)}.dark\:shadow-\[inset_0_1px_0_rgba\(255\2c 255\2c 255\2c 0\.1\)\2c 0_12px_28px_rgba\(0\2c 0\2c 0\2c 0\.3\)\]:is(.dark *){--tw-shadow:inset 0 1px 0 hsla(0,0%,100%,.1),0 12px 28px rgba(0,0,0,.3);--tw-shadow-colored:inset 0 1px 0 var(--tw-shadow-color),0 12px 28px var(--tw-shadow-color);box-shadow:var(--tw-ring-offset-shadow,0 0 #0000),var(--tw-ring-shadow,0 0 #0000),var(--tw-shadow)}.dark\:shadow-black\/35:is(.dark *){--tw-shadow-color:rgba(0,0,0,.35);--tw-shadow:var(--tw-shadow-colored)}.dark\:shadow-black\/45:is(.dark *){--tw-shadow-color:rgba(0,0,0,.45);--tw-shadow:var(--tw-shadow-colored)}.dark\:ring-amber-900:is(.dark *){--tw-ring-opacity:1;--tw-ring-color:rgb(120 53 15/var(--tw-ring-opacity,1))}.dark\:ring-white\/10:is(.dark *){--tw-ring-color:hsla(0,0%,100%,.1)}.dark\:placeholder\:text-zinc-500:is(.dark *)::-moz-placeholder{--tw-text-opacity:1;color:rgb(113 113 122/var(--tw-text-opacity,1))}.dark\:placeholder\:text-zinc-500:is(.dark *)::placeholder{--tw-text-opacity:1;color:rgb(113 113 122/var(--tw-text-opacity,1))}.dark\:before\:bg-white\/10:is(.dark *):before{content:var(--tw-content);background-color:hsla(0,0%,100%,.1)}.dark\:hover\:border-blue-700:hover:is(.dark *){--tw-border-opacity:1;border-color:rgb(29 78 216/var(--tw-border-opacity,1))}.dark\:hover\:border-red-900\/50:hover:is(.dark *){border-color:rgba(127,29,29,.5)}.dark\:hover\:border-zinc-600:hover:is(.dark *){--tw-border-opacity:1;border-color:rgb(82 82 91/var(--tw-border-opacity,1))}.dark\:hover\:border-zinc-700:hover:is(.dark *){--tw-border-opacity:1;border-color:rgb(63 63 70/var(--tw-border-opacity,1))}.dark\:hover\:bg-amber-900\/40:hover:is(.dark *){background-color:rgba(120,53,15,.4)}.dark\:hover\:bg-blue-400:hover:is(.dark *){--tw-bg-opacity:1;background-color:rgb(96 165 250/var(--tw-bg-opacity,1))}.dark\:hover\:bg-red-400:hover:is(.dark *){--tw-bg-opacity:1;background-color:rgb(248 113 113/var(--tw-bg-opacity,1))}.dark\:hover\:bg-red-950\/30:hover:is(.dark *){background-color:rgba(69,10,10,.3)}.dark\:hover\:bg-red-950\/40:hover:is(.dark *){background-color:rgba(69,10,10,.4)}.dark\:hover\:bg-red-950\/60:hover:is(.dark *){background-color:rgba(69,10,10,.6)}.dark\:hover\:bg-white\/10:hover:is(.dark *){background-color:hsla(0,0%,100%,.1)}.dark\:hover\:bg-zinc-200:hover:is(.dark *){--tw-bg-opacity:1;background-color:rgb(228 228 231/var(--tw-bg-opacity,1))}.dark\:hover\:bg-zinc-600:hover:is(.dark *){--tw-bg-opacity:1;background-color:rgb(82 82 91/var(--tw-bg-opacity,1))}.dark\:hover\:bg-zinc-700:hover:is(.dark *){--tw-bg-opacity:1;background-color:rgb(63 63 70/var(--tw-bg-opacity,1))}.dark\:hover\:bg-zinc-800:hover:is(.dark *){--tw-bg-opacity:1;background-color:rgb(39 39 42/var(--tw-bg-opacity,1))}.dark\:hover\:bg-zinc-800\/40:hover:is(.dark *){background-color:rgba(39,39,42,.4)}.dark\:hover\:bg-zinc-800\/50:hover:is(.dark *){background-color:rgba(39,39,42,.5)}.dark\:hover\:bg-zinc-900:hover:is(.dark *){--tw-bg-opacity:1;background-color:rgb(24 24 27/var(--tw-bg-opacity,1))}.dark\:hover\:text-accent:hover:is(.dark *){color:var(--accent)}.dark\:hover\:text-amber-50:hover:is(.dark *){--tw-text-opacity:1;color:rgb(255 251 235/var(--tw-text-opacity,1))}.dark\:hover\:text-red-100:hover:is(.dark *){--tw-text-opacity:1;color:rgb(254 226 226/var(--tw-text-opacity,1))}.dark\:hover\:text-red-300:hover:is(.dark *){--tw-text-opacity:1;color:rgb(252 165 165/var(--tw-text-opacity,1))}.dark\:hover\:text-red-400:hover:is(.dark *){--tw-text-opacity:1;color:rgb(248 113 113/var(--tw-text-opacity,1))}.dark\:hover\:text-white:hover:is(.dark *){--tw-text-opacity:1;color:rgb(255 255 255/var(--tw-text-opacity,1))}.dark\:hover\:text-zinc-100:hover:is(.dark *){--tw-text-opacity:1;color:rgb(244 244 245/var(--tw-text-opacity,1))}.dark\:hover\:text-zinc-200:hover:is(.dark *){--tw-text-opacity:1;color:rgb(228 228 231/var(--tw-text-opacity,1))}.dark\:hover\:text-zinc-300:hover:is(.dark *){--tw-text-opacity:1;color:rgb(212 212 216/var(--tw-text-opacity,1))}.dark\:hover\:text-zinc-50:hover:is(.dark *){--tw-text-opacity:1;color:rgb(250 250 250/var(--tw-text-opacity,1))}.dark\:focus\:border-zinc-500:focus:is(.dark *){--tw-border-opacity:1;border-color:rgb(113 113 122/var(--tw-border-opacity,1))}.dark\:focus\:border-zinc-600:focus:is(.dark *){--tw-border-opacity:1;border-color:rgb(82 82 91/var(--tw-border-opacity,1))}.dark\:focus\:bg-zinc-100:focus:is(.dark *){--tw-bg-opacity:1;background-color:rgb(244 244 245/var(--tw-bg-opacity,1))}.dark\:focus\:text-zinc-900:focus:is(.dark *){--tw-text-opacity:1;color:rgb(24 24 27/var(--tw-text-opacity,1))}.dark\:focus-visible\:ring-zinc-300:focus-visible:is(.dark *){--tw-ring-opacity:1;--tw-ring-color:rgb(212 212 216/var(--tw-ring-opacity,1))}.dark\:focus-visible\:ring-zinc-500:focus-visible:is(.dark *){--tw-ring-opacity:1;--tw-ring-color:rgb(113 113 122/var(--tw-ring-opacity,1))}.dark\:focus-visible\:ring-offset-blue-950:focus-visible:is(.dark *){--tw-ring-offset-color:#172554}.dark\:focus-visible\:ring-offset-zinc-900:focus-visible:is(.dark *){--tw-ring-offset-color:#18181b}.dark\:focus-visible\:ring-offset-zinc-950:focus-visible:is(.dark *){--tw-ring-offset-color:#09090b}.prose-headings\:dark\:text-zinc-100:is(.dark *) :is(:where(h1,h2,h3,h4,h5,h6,th):not(:where([class~=not-prose],[class~=not-prose] *))){--tw-text-opacity:1;color:rgb(244 244 245/var(--tw-text-opacity,1))}.prose-a\:dark\:text-zinc-400:is(.dark *) :is(:where(a):not(:where([class~=not-prose],[class~=not-prose] *))){--tw-text-opacity:1;color:rgb(161 161 170/var(--tw-text-opacity,1))}.prose-strong\:dark\:text-zinc-100:is(.dark *) :is(:where(strong):not(:where([class~=not-prose],[class~=not-prose] *))){--tw-text-opacity:1;color:rgb(244 244 245/var(--tw-text-opacity,1))}.prose-code\:dark\:text-zinc-300:is(.dark *) :is(:where(code):not(:where([class~=not-prose],[class~=not-prose] *))){--tw-text-opacity:1;color:rgb(212 212 216/var(--tw-text-opacity,1))}.prose-pre\:dark\:bg-zinc-800:is(.dark *) :is(:where(pre):not(:where([class~=not-prose],[class~=not-prose] *))){--tw-bg-opacity:1;background-color:rgb(39 39 42/var(--tw-bg-opacity,1))}.prose-tr\:even\:dark\:bg-zinc-800\/30:is(.dark *):nth-child(2n) :is(:where(tr):not(:where([class~=not-prose],[class~=not-prose] *))){background-color:rgba(39,39,42,.3)}.prose-th\:dark\:border-zinc-600:is(.dark *) :is(:where(th):not(:where([class~=not-prose],[class~=not-prose] *))){--tw-border-opacity:1;border-color:rgb(82 82 91/var(--tw-border-opacity,1))}.prose-th\:dark\:bg-zinc-800:is(.dark *) :is(:where(th):not(:where([class~=not-prose],[class~=not-prose] *))){--tw-bg-opacity:1;background-color:rgb(39 39 42/var(--tw-bg-opacity,1))}.prose-td\:dark\:border-zinc-700:is(.dark *) :is(:where(td):not(:where([class~=not-prose],[class~=not-prose] *))){--tw-border-opacity:1;border-color:rgb(63 63 70/var(--tw-border-opacity,1))}@media (min-width:375px){.min-\[375px\]\:max-w-\[112px\]{max-width:112px}}@media (min-width:640px){.sm\:left-auto{left:auto}.sm\:right-4{right:1rem}.sm\:top-\[calc\(env\(safe-area-inset-top\2c 0px\)\+4\.75rem\)\]{top:calc(env(safe-area-inset-top,0px) + 4.75rem)}.sm\:-mx-5{margin-left:-1.25rem;margin-right:-1.25rem}.sm\:mx-3{margin-right:.75rem}.sm\:ml-3,.sm\:mx-3{margin-left:.75rem}.sm\:block{display:block}.sm\:inline{display:inline}.sm\:flex{display:flex}.sm\:inline-flex{display:inline-flex}.sm\:hidden{display:none}.sm\:h-56{height:14rem}.sm\:h-80{height:20rem}.sm\:w-3{width:.75rem}.sm\:w-44{width:11rem}.sm\:w-\[min\(26rem\2c calc\(100vw-2rem\)\)\]{width:min(26rem,calc(100vw - 2rem))}.sm\:w-\[min\(28rem\2c calc\(100vw-2rem\)\)\]{width:min(28rem,calc(100vw - 2rem))}.sm\:min-w-\[320px\]{min-width:320px}.sm\:max-w-\[200px\]{max-width:200px}.sm\:max-w-\[240px\]{max-width:240px}.sm\:grid-cols-2{grid-template-columns:repeat(2,minmax(0,1fr))}.sm\:grid-cols-3{grid-template-columns:repeat(3,minmax(0,1fr))}.sm\:grid-cols-4{grid-template-columns:repeat(4,minmax(0,1fr))}.sm\:grid-cols-5{grid-template-columns:repeat(5,minmax(0,1fr))}.sm\:grid-cols-\[1fr\2c 1fr\]{grid-template-columns:1fr 1fr}.sm\:grid-cols-\[minmax\(0\2c 1fr\)_minmax\(0\2c 1fr\)_auto\]{grid-template-columns:minmax(0,1fr) minmax(0,1fr) auto}.sm\:grid-cols-\[minmax\(8rem\2c 14rem\)_1fr\]{grid-template-columns:minmax(8rem,14rem) 1fr}.sm\:flex-row{flex-direction:row}.sm\:items-start{align-items:flex-start}.sm\:items-end{align-items:flex-end}.sm\:items-center{align-items:center}.sm\:justify-start{justify-content:flex-start}.sm\:justify-end{justify-content:flex-end}.sm\:justify-between{justify-content:space-between}.sm\:gap-2{gap:.5rem}.sm\:gap-3{gap:.75rem}.sm\:gap-6{gap:1.5rem}.sm\:self-auto{align-self:auto}.sm\:self-start{align-self:flex-start}.sm\:p-10{padding:2.5rem}.sm\:p-12{padding:3rem}.sm\:p-8{padding:2rem}.sm\:px-3{padding-left:.75rem;padding-right:.75rem}.sm\:px-5{padding-left:1.25rem;padding-right:1.25rem}.sm\:px-6{padding-left:1.5rem;padding-right:1.5rem}.sm\:px-7{padding-left:1.75rem;padding-right:1.75rem}.sm\:px-8{padding-left:2rem;padding-right:2rem}.sm\:py-6{padding-top:1.5rem;padding-bottom:1.5rem}.sm\:py-7{padding-top:1.75rem;padding-bottom:1.75rem}.sm\:pb-12{padding-bottom:3rem}.sm\:text-left{text-align:left}.sm\:text-3xl{font-size:1.875rem;line-height:2.25rem}.sm\:text-base{font-size:1rem;line-height:1.5rem}.sm\:text-xl{font-size:1.25rem;line-height:1.75rem}}@media (min-width:768px){.md\:sticky{position:sticky}.md\:top-24{top:6rem}.md\:col-span-1{grid-column:span 1/span 1}.md\:col-span-4{grid-column:span 4/span 4}.md\:col-span-5{grid-column:span 5/span 5}.md\:col-span-7{grid-column:span 7/span 7}.md\:mb-0{margin-bottom:0}.md\:mt-0{margin-top:0}.md\:inline-block{display:inline-block}.md\:flex{display:flex}.md\:grid{display:grid}.md\:hidden{display:none}.md\:w-64{width:16rem}.md\:max-w-\[300px\]{max-width:300px}.md\:grid-cols-12{grid-template-columns:repeat(12,minmax(0,1fr))}.md\:grid-cols-2{grid-template-columns:repeat(2,minmax(0,1fr))}.md\:grid-cols-3{grid-template-columns:repeat(3,minmax(0,1fr))}.md\:grid-cols-4{grid-template-columns:repeat(4,minmax(0,1fr))}.md\:grid-cols-5{grid-template-columns:repeat(5,minmax(0,1fr))}.md\:grid-cols-\[1fr_320px\]{grid-template-columns:1fr 320px}.md\:grid-cols-\[240px_1fr\]{grid-template-columns:240px 1fr}.md\:flex-row{flex-direction:row}.md\:flex-col{flex-direction:column}.md\:items-center{align-items:center}.md\:gap-1{gap:.25rem}.md\:gap-12{gap:3rem}.md\:gap-8{gap:2rem}.md\:border-l{border-left-width:1px}.md\:border-\[var\(--ed-rule\)\]{border-color:var(--ed-rule)}.md\:px-5{padding-left:1.25rem;padding-right:1.25rem}.md\:pl-10{padding-left:2.5rem}.md\:pl-6{padding-left:1.5rem}.md\:pl-8{padding-left:2rem}.md\:pr-10{padding-right:2.5rem}}@media (min-width:1024px){.lg\:col-span-2{grid-column:span 2/span 2}.lg\:block{display:block}.lg\:flex{display:flex}.lg\:grid{display:grid}.lg\:hidden{display:none}.lg\:min-w-\[620px\]{min-width:620px}.lg\:grid-cols-2{grid-template-columns:repeat(2,minmax(0,1fr))}.lg\:grid-cols-3{grid-template-columns:repeat(3,minmax(0,1fr))}.lg\:grid-cols-4{grid-template-columns:repeat(4,minmax(0,1fr))}.lg\:grid-cols-5{grid-template-columns:repeat(5,minmax(0,1fr))}.lg\:grid-cols-6{grid-template-columns:repeat(6,minmax(0,1fr))}.lg\:grid-cols-\[0\.8fr_1\.2fr\]{grid-template-columns:.8fr 1.2fr}.lg\:grid-cols-\[0\.9fr_1\.1fr\]{grid-template-columns:.9fr 1.1fr}.lg\:grid-cols-\[1fr_220px\]{grid-template-columns:1fr 220px}.lg\:grid-cols-\[1fr_420px\]{grid-template-columns:1fr 420px}.lg\:grid-cols-\[1fr_440px\]{grid-template-columns:1fr 440px}.lg\:grid-cols-\[220px_1fr\]{grid-template-columns:220px 1fr}.lg\:flex-row{flex-direction:row}.lg\:items-end{align-items:flex-end}.lg\:items-center{align-items:center}.lg\:justify-between{justify-content:space-between}.lg\:gap-12{gap:3rem}.lg\:border-l{border-left-width:1px}.lg\:border-t-0{border-top-width:0}.lg\:px-7{padding-left:1.75rem;padding-right:1.75rem}.lg\:px-8{padding-left:2rem;padding-right:2rem}}@media (min-width:1280px){.xl\:block{display:block}.xl\:inline{display:inline}.xl\:grid-cols-2{grid-template-columns:repeat(2,minmax(0,1fr))}.xl\:grid-cols-3{grid-template-columns:repeat(3,minmax(0,1fr))}.xl\:grid-cols-\[1\.1fr_0\.9fr\]{grid-template-columns:1.1fr .9fr}.xl\:grid-cols-\[1\.3fr_0\.7fr\]{grid-template-columns:1.3fr .7fr}}.\[\&\>\*\:first-child\]\:mt-0>:first-child{margin-top:0}.\[\&\>\*\:last-child\]\:mb-0>:last-child{margin-bottom:0}.\[\&_pre\]\:\!m-0 pre{margin:0!important}.\[\&_pre\]\:overflow-x-auto pre{overflow-x:auto}.\[\&_pre\]\:\!p-4 pre{padding:1rem!important}

exec
/bin/zsh -lc "nl -ba frontend/src/app/layout.tsx | sed -n '10,42p'; nl -ba frontend/tailwind.config.ts | sed -n '35,82p'; nl -ba frontend/src/components/Chat/MessageBubble.tsx | sed -n '292,328p'; nl -ba frontend/src/components/TextViewer/TextViewer.tsx | sed -n '704,728p'" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
    10	import { AuthModal } from '../components/AuthModal'
    11	import { AnalyticsWrapper } from '../components/AnalyticsWrapper'
    12	import { CookieConsentBanner } from '../components/CookieConsentBanner'
    13	
    14	const plexSans = IBM_Plex_Sans({
    15	  subsets: ['latin'],
    16	  weight: ['400', '500', '600', '700'],
    17	  variable: '--font-plex-sans',
    18	  display: 'swap',
    19	})
    20	const sora = Sora({
    21	  subsets: ['latin'],
    22	  variable: '--font-logo',
    23	  weight: ['500', '600', '700'],
    24	  display: 'swap',
    25	})
    26	
    27	const fraunces = Fraunces({
    28	  subsets: ['latin'],
    29	  style: ['normal', 'italic'],
    30	  axes: ['opsz', 'SOFT'],
    31	  variable: '--font-fraunces',
    32	  display: 'swap',
    33	})
    34	
    35	const plexMono = IBM_Plex_Mono({
    36	  subsets: ['latin'],
    37	  weight: ['400', '500'],
    38	  variable: '--font-plex-mono',
    39	  display: 'swap',
    40	})
    41	
    42	export const metadata: Metadata = {
    35	      keyframes: {
    36	        'fade-in': {
    37	          '0%': { opacity: '0' },
    38	          '100%': { opacity: '1' },
    39	        },
    40	        'slide-up': {
    41	          '0%': { opacity: '0', transform: 'translateY(8px)' },
    42	          '100%': { opacity: '1', transform: 'translateY(0)' },
    43	        },
    44	        'reveal-up': {
    45	          '0%': { opacity: '0', transform: 'translateY(24px)' },
    46	          '100%': { opacity: '1', transform: 'translateY(0)' },
    47	        },
    48	      },
    49	      animation: {
    50	        'fade-in': 'fade-in 150ms ease-out',
    51	        'slide-up': 'slide-up 200ms ease-out',
    52	        'reveal-up': 'reveal-up 600ms ease-out both',
    53	      },
    54	      typography: {
    55	        DEFAULT: {
    56	          css: {
    57	            '--tw-prose-body': '#09090b',
    58	            '--tw-prose-headings': '#09090b',
    59	            '--tw-prose-bold': '#09090b',
    60	            'code::before': { content: 'none' },
    61	            'code::after': { content: 'none' },
    62	            code: {
    63	              backgroundColor: 'rgb(0 0 0 / 0.06)',
    64	              borderRadius: '0.375rem',
    65	              padding: '0.125rem 0.375rem',
    66	              fontWeight: '500',
    67	              fontSize: '0.875em',
    68	            },
    69	          },
    70	        },
    71	        invert: {
    72	          css: {
    73	            '--tw-prose-invert-body': '#fafafa',
    74	            '--tw-prose-invert-headings': '#fafafa',
    75	            '--tw-prose-invert-bold': '#fafafa',
    76	            code: {
    77	              backgroundColor: 'rgb(255 255 255 / 0.12)',
    78	            },
    79	          },
    80	        },
    81	      },
    82	    },
   292	            <div className="flex items-center gap-2 text-[var(--workbench-muted)] text-sm" aria-live="polite">
   293	              <div className="flex gap-1">
   294	                <span className="w-1.5 h-1.5 bg-zinc-400 dark:bg-zinc-500 rounded-full animate-bounce motion-reduce:animate-none [animation-delay:-0.3s]" aria-hidden="true" />
   295	                <span className="w-1.5 h-1.5 bg-zinc-400 dark:bg-zinc-500 rounded-full animate-bounce motion-reduce:animate-none [animation-delay:-0.15s]" aria-hidden="true" />
   296	                <span className="w-1.5 h-1.5 bg-zinc-400 dark:bg-zinc-500 rounded-full animate-bounce motion-reduce:animate-none" aria-hidden="true" />
   297	                <span className="hidden motion-reduce:inline" aria-hidden="true">...</span>
   298	              </div>
   299	              <span>{t('chat.searching')}</span>
   300	            </div>
   301	          ) : (
   302	            <>
   303	              {/* Sources strip — rendered above the prose so the
   304	                  "grounded-in-these-documents" signal is visible before the
   305	                  user reads the answer. During streaming with no citations
   306	                  yet, SourcesStrip itself draws a skeleton so the block
   307	                  doesn't flicker into existence mid-answer. */}
   308	              {isAssistant && (
   309	                <SourcesStrip
   310	                  citations={message.citations ?? []}
   311	                  onCitationClick={onCitationClick}
   312	                  isStreaming={isStreaming}
   313	                />
   314	              )}
   315	              <div className="prose prose-sm dark:prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 sm:prose-base">
   316	                <Suspense fallback={<span className="whitespace-pre-wrap">{markdownText}</span>}>
   317	                  <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
   318	                    {markdownText}
   319	                  </ReactMarkdown>
   320	                </Suspense>
   321	                {isStreaming && isAssistant && message.text && (
   322	                  <span aria-hidden="true" className="inline-block w-2 h-4 bg-zinc-400 dark:bg-white/45 animate-pulse motion-reduce:animate-none rounded-sm ml-0.5 align-text-bottom" />
   323	                )}
   324	              </div>
   325	              {isAssistant && !message.text && message.toolStatus ? (
   326	                <p className="mt-3 text-sm text-[var(--workbench-muted)]">{message.toolStatus}</p>
   327	              ) : null}
   328	              {isAssistant && message.artifacts?.map((artifact, index) => (
   704	  articleMode?: boolean;
   705	}) {
   706	  const markdownFallback = (
   707	    <div className="flex items-center justify-center py-8">
   708	      <Spinner variant="circle" size="md" label="Rendering content" />
   709	    </div>
   710	  );
   711	
   712	  return (
   713	    <div className={`prose dark:prose-invert max-w-none prose-zinc ${articleMode ? 'prose-base prose-p:leading-8 prose-li:leading-8 prose-headings:scroll-mt-28' : 'prose-sm'}
   714	      prose-table:border-collapse prose-table:w-full prose-table:text-sm
   715	      prose-th:border prose-th:border-zinc-300 prose-th:dark:border-zinc-600 prose-th:px-3 prose-th:py-2 prose-th:bg-zinc-50 prose-th:dark:bg-zinc-800 prose-th:text-left prose-th:font-semibold
   716	      prose-td:border prose-td:border-zinc-200 prose-td:dark:border-zinc-700 prose-td:px-3 prose-td:py-1.5
   717	      prose-tr:even:bg-zinc-50/50 prose-tr:even:dark:bg-zinc-800/30
   718	      prose-pre:bg-zinc-100 prose-pre:dark:bg-zinc-800 prose-pre:rounded-lg
   719	      prose-code:text-zinc-700 prose-code:dark:text-zinc-300
   720	      prose-a:text-zinc-600 prose-a:dark:text-zinc-400 prose-a:underline
   721	      prose-headings:text-zinc-900 prose-headings:dark:text-zinc-100
   722	      prose-strong:text-zinc-900 prose-strong:dark:text-zinc-100
   723	    `}>
   724	      {/*
   725	        I25 (Wave-2 Batch I, 2026-05-20): When a citation lands on a markdown
   726	        page we used to render a duplicated amber-preview box above the full
   727	        ReactMarkdown render — the user saw the cited passage twice (raw +
   728	        rendered) and the rendered copy had no visual marker. We replaced

exec
/bin/zsh -lc "nl -ba frontend/node_modules/@tailwindcss/typography/src/styles.js | sed -n '1488,1520p'; rg -o '\\.prose :where\\(h1\\)["'^{]*'"\\{["'^}]*'"\\}|\\.prose :where\\(h1 strong\\)["'^{]*'"\\{["'^}]*'"\\}|\\.prose :where\\(h2 strong\\)["'^{]*'"\\{["'^}]*'"\\}' frontend/.next/static/css/feed39887bd94401.css" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
  1488	          color: 'var(--tw-prose-quotes)',
  1489	          borderInlineStartWidth: '0.25rem',
  1490	          borderInlineStartColor: 'var(--tw-prose-quote-borders)',
  1491	          quotes: '"\\201C""\\201D""\\2018""\\2019"',
  1492	        },
  1493	        'blockquote p:first-of-type::before': {
  1494	          content: 'open-quote',
  1495	        },
  1496	        'blockquote p:last-of-type::after': {
  1497	          content: 'close-quote',
  1498	        },
  1499	        h1: {
  1500	          color: 'var(--tw-prose-headings)',
  1501	          fontWeight: '800',
  1502	        },
  1503	        'h1 strong': {
  1504	          fontWeight: '900',
  1505	          color: 'inherit',
  1506	        },
  1507	        h2: {
  1508	          color: 'var(--tw-prose-headings)',
  1509	          fontWeight: '700',
  1510	        },
  1511	        'h2 strong': {
  1512	          fontWeight: '800',
  1513	          color: 'inherit',
  1514	        },
  1515	        h3: {
  1516	          color: 'var(--tw-prose-headings)',
  1517	          fontWeight: '600',
  1518	        },
  1519	        'h3 strong': {
  1520	          fontWeight: '700',
.prose :where(h1):not(:where([class~=not-prose],[class~=not-prose] *)){color:var(--tw-prose-headings);font-weight:800;font-size:2.25em;margin-top:0;margin-bottom:.8888889em;line-height:1.1111111}
.prose :where(h1 strong):not(:where([class~=not-prose],[class~=not-prose] *)){font-weight:900;color:inherit}
.prose :where(h2 strong):not(:where([class~=not-prose],[class~=not-prose] *)){font-weight:800;color:inherit}

exec
/bin/zsh -lc "nl -ba frontend/src/app/editorial.css | sed -n '35,95p'; nl -ba frontend/src/app/editorial.css | sed -n '286,418p'; nl -ba frontend/src/components/marketing/EdLanguageSelector.tsx | sed -n '122,152p'; nl -ba frontend/src/components/marketing/MarketingShell.tsx | sed -n '15,32p'" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
    35	  font-family: var(--dt-body);
    36	  -webkit-font-smoothing: antialiased;
    37	}
    38	
    39	/* Counter the app-surface reset at globals.css:819-826:
    40	     `.dt-stitch-root > .min-h-screen { background: transparent !important }`
    41	   MarketingShell's root is `.dt-editorial min-h-screen flex flex-col` and a
    42	   direct child of `.dt-stitch-root`, so that (0,2,0) !important rule beat the
    43	   paper background above and every MarketingShell page — i.e. the whole
    44	   marketing surface except the landing page, whose root has no `min-h-screen`
    45	   — rendered on the app's near-white body instead of --ed-paper. The glass
    46	   material is tuned to sit on paper, so without this it reads washed out.
    47	   (0,3,0) + !important wins outright regardless of file order; the second
    48	   selector keeps it working if MarketingShell ever drops `min-h-screen`.
    49	   Do NOT "clean this up" as a redundant duplicate of line 33 — it is not.
    50	   Remove it only together with the globals.css rule it counters. */
    51	.dt-stitch-root > .dt-editorial.min-h-screen,
    52	.dt-stitch-root > .dt-editorial {
    53	  background: var(--ed-paper) !important;
    54	}
    55	
    56	/* Print-craft paper grain — faint and intentional (a press texture,
    57	   not an AI glow). Sits below content. */
    58	.dt-editorial::before {
    59	  content: "";
    60	  position: absolute;
    61	  inset: 0;
    62	  z-index: 0;
    63	  pointer-events: none;
    64	  opacity: 0.5;
    65	  background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='g'><feTurbulence type='fractalNoise' baseFrequency='0.82' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0.1  0 0 0 0 0.09  0 0 0 0 0.07  0 0 0 0.035 0'/></filter><rect width='100%25' height='100%25' filter='url(%23g)'/></svg>");
    66	}
    67	.dt-editorial > * { position: relative; z-index: 1; }
    68	
    69	/* Ambient canvas — restrained, asymmetric static gradients so glass has
    70	   something to blur. Static gradients only (not filter:blur) for zero
    71	   scroll repaint (spec §3). Sits above the paper-grain ::before, below
    72	   real content (z-index 1, set above). */
    73	.dt-editorial::after {
    74	  content: "";
    75	  position: absolute;
    76	  inset: 0;
    77	  z-index: 0;
    78	  pointer-events: none;
    79	  background:
    80	    radial-gradient(680px 480px at 14% 0%, rgba(160, 75, 52, 0.10), transparent 60%),
    81	    radial-gradient(560px 420px at 92% 38%, rgba(31, 58, 77, 0.07), transparent 65%);
    82	}
    83	@media (prefers-reduced-transparency: reduce) {
    84	  .dt-editorial::after { display: none; }
    85	}
    86	@media print {
    87	  .dt-editorial::after { display: none; }
    88	}
    89	
    90	.dt-editorial .ed-shell {
    91	  max-width: 1200px;
    92	  margin: 0 auto;
    93	  padding: 0 40px;
    94	}
    95	@media (max-width: 640px) {
   286	.dt-editorial .ed-prose a {
   287	  color: var(--ed-signal);
   288	  text-decoration: underline;
   289	  text-underline-offset: 2px;
   290	}
   291	
   292	/* Clickable editorial cards (anchor cards) get hover feedback;
   293	   non-interactive .ed-card divs are unaffected. */
   294	.dt-editorial a.ed-card {
   295	  transition: border-color 150ms ease, background-color 150ms ease;
   296	}
   297	.dt-editorial a.ed-card:hover {
   298	  border-color: var(--ed-ink-3);
   299	  background: var(--ed-paper);
   300	}
   301	.dt-editorial a.ed-card.ed-glass:hover {
   302	  background: var(--ed-glass-strong);
   303	  border-color: rgba(31, 58, 77, 0.28);
   304	}
   305	
   306	/* Bulleted lists inside editorial prose. */
   307	.dt-editorial .ed-prose ul {
   308	  list-style: none;
   309	  margin: 0 0 18px;
   310	  padding: 0;
   311	}
   312	.dt-editorial .ed-prose ul li {
   313	  position: relative;
   314	  padding-left: 20px;
   315	  font-size: 15.5px;
   316	  line-height: 1.7;
   317	  color: var(--ed-ink-2);
   318	  margin-bottom: 8px;
   319	}
   320	.dt-editorial .ed-prose ul li::before {
   321	  content: "";
   322	  position: absolute;
   323	  left: 2px;
   324	  top: 11px;
   325	  width: 5px;
   326	  height: 5px;
   327	  background: var(--ed-signal);
   328	}
   329	.dt-editorial .ed-prose ul li:last-child { margin-bottom: 0; }
   330	
   331	/* ─── Liquid Glass utility classes (spec §2.3, §4.1) ───────────────────
   332	   Glass is chrome, not content: apply only to nav, cards, popovers, CTA
   333	   panels, FAQ/comparison containers, hero art. NEVER to EdProse/article
   334	   body/EdSection text or anything rendering real document/quote text.
   335	   backdrop-filter appears exactly once below (the .ed-glass base) with
   336	   its two required fallbacks directly underneath — do not add
   337	   backdrop-filter anywhere else in this file without both. Source order
   338	   matters: this block is appended AFTER .ed-card so `.ed-card.ed-glass`
   339	   (Task 5) resolves background/border to the glass values. */
   340	.dt-editorial .ed-glass,
   341	.dt-editorial.ed-glass {
   342	  background: var(--ed-glass);
   343	  backdrop-filter: var(--ed-glass-blur);
   344	  -webkit-backdrop-filter: var(--ed-glass-blur);
   345	  border: 1px solid var(--ed-glass-line);
   346	  border-radius: var(--ed-radius);
   347	  box-shadow: var(--ed-glass-hi), var(--ed-glass-shadow);
   348	}
   349	.dt-editorial .ed-glass--strong,
   350	.dt-editorial.ed-glass--strong {
   351	  background: var(--ed-glass-strong);
   352	}
   353	.dt-editorial .ed-glass--header,
   354	.dt-editorial.ed-glass--header {
   355	  border-radius: 0;
   356	  border-width: 0 0 1px 0;
   357	}
   358	/* The May-19 `.dt-editorial > *` rule (line 50) is (0,1,0) specificity —
   359	   identical to Tailwind's `.sticky`/`.z-50` utilities — so it silently wins
   360	   the position/z-index tie and flattens the masthead to `position: relative`.
   361	   This selector is (0,2,1), so it wins outright regardless of source order,
   362	   without touching the May-19 rule (still needed for every other direct
   363	   child's stacking against the ambient ::before/::after layers). z-index 50
   364	   matches the header's own `z-50` Tailwind class. */
   365	.dt-editorial > header.ed-glass--header {
   366	  position: sticky;
   367	  top: 0;
   368	  z-index: 50;
   369	}
   370	.dt-editorial .ed-glass--cta,
   371	.dt-editorial.ed-glass--cta {
   372	  border-radius: 0;
   373	  border-width: 1px 0 0 0;
   374	}
   375	.dt-editorial .ed-glass--popover,
   376	.dt-editorial.ed-glass--popover {
   377	  box-shadow: var(--ed-glass-hi), 0 14px 36px rgba(40, 33, 24, 0.24);
   378	}
   379	@media (prefers-reduced-transparency: reduce) {
   380	  .dt-editorial .ed-glass,
   381	  .dt-editorial.ed-glass {
   382	    background: var(--ed-paper-2);
   383	    backdrop-filter: none;
   384	    -webkit-backdrop-filter: none;
   385	  }
   386	  .dt-editorial a.ed-card.ed-glass:hover {
   387	    background: var(--ed-paper);
   388	    border-color: var(--ed-ink-3);
   389	  }
   390	}
   391	@media print {
   392	  .dt-editorial .ed-glass,
   393	  .dt-editorial.ed-glass {
   394	    background: var(--ed-paper-2);
   395	    backdrop-filter: none;
   396	    -webkit-backdrop-filter: none;
   397	    box-shadow: none;
   398	    border-color: var(--ed-rule);
   399	  }
   400	  .dt-editorial a.ed-card.ed-glass:hover {
   401	    background: var(--ed-paper-2);
   402	    border-color: var(--ed-rule);
   403	    box-shadow: none;
   404	  }
   405	  /* A sticky masthead prints at its stuck offset, so a page printed while
   406	     scrolled paints the header across the middle of the content (it landed
   407	     inside the comparison table during Task 10's print check). Static in
   408	     print puts it back at the top of the first page. */
   409	  .dt-editorial > header.ed-glass--header {
   410	    position: static;
   411	  }
   412	}
   413	
   414	.dt-editorial *:focus-visible {
   415	  outline: 2px solid var(--ed-signal);
   416	  outline-offset: 2px;
   417	}
   122	        color: "var(--ed-ink-3)",
   123	      }}
   124	    >
   125	      {code.toUpperCase()}
   126	    </span>
   127	  );
   128	
   129	  const menu = (
   130	    <div
   131	      ref={menuRef}
   132	      className="dt-editorial ed-glass ed-glass--strong ed-glass--popover"
   133	      style={{
   134	        position: "fixed",
   135	        top: pos.top,
   136	        right: pos.right,
   137	        zIndex: 10000,
   138	        minWidth: "200px",
   139	        maxHeight: pos.maxHeight,
   140	        overflowY: "auto",
   141	      }}
   142	    >
   143	      <ul role="listbox" aria-label={label} style={{ margin: 0, padding: "6px", listStyle: "none" }}>
   144	        {options.map((l) => {
   145	          const selected = l.code === activeLocale;
   146	          const inner = (
   147	            <>
   148	              <span aria-hidden="true" style={{ width: "14px", display: "inline-flex" }}>
   149	                {selected ? <Check size={13} /> : null}
   150	              </span>
   151	              <span style={{ flex: 1 }}>{l.label}</span>
   152	              {codeBadge(l.code)}
    15	   * Server-resolved chrome strings for localized pages. When provided, the
    16	   * header/footer render translated nav/footer text in the initial HTML. When
    17	   * omitted (not-yet-migrated pages), the chrome falls back to client `useLocale()`.
    18	   */
    19	  chrome?: ChromeStrings;
    20	  children: React.ReactNode;
    21	}) {
    22	  return (
    23	    <div className="dt-editorial min-h-screen flex flex-col">
    24	      <EditorialMarketingHeader breadcrumb={breadcrumb} chrome={chrome} />
    25	      <main className="flex-1">{children}</main>
    26	      <EditorialFooter chrome={chrome} />
    27	    </div>
    28	  );
    29	}

exec
/bin/zsh -lc "git status --short && git diff --check 782f8b0..HEAD; git log --format='%h %s' 782f8b0..HEAD | wc -l" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
?? .collab/reviews/2026-08-04-glass-b1-codex-r1.md
      17

exec
/bin/zsh -lc 'test "$(rg -c '"'"'^[[:space:]]*backdrop-filter: var'"' frontend/src/app/editorial.css)\" = 1 && echo glass-base-ok; test \""'$(rg -c '"'"'^[[:space:]]*backdrop-filter: none'"' frontend/src/app/editorial.css)\" = 2 && echo glass-fallbacks-ok; "'! rg -n --glob '"'*.{tsx,ts,css}' -- '--ed-ochre|--font-inter|--font-newsreader' frontend/src >/tmp/doctalk-old-token-hits && echo retired-tokens-ok; test "'! -s /tmp/doctalk-old-token-hits || sed -n '"'1,80p' /tmp/doctalk-old-token-hits; git diff --quiet 782f8b0..HEAD -- frontend/src/i18n frontend/messages frontend/src/messages 2>/dev/null && echo locale-files-unchanged; git rev-list --count 782f8b0..HEAD" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
glass-base-ok
glass-fallbacks-ok
retired-tokens-ok
locale-files-unchanged
17

exec
/bin/zsh -lc 'rm /tmp/doctalk-old-token-hits' in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
Completed the range audit and targeted validation. Two newly introduced regressions remain; cascade/fallback, scope, SSR/noindex/fetch, and locale-copy checks otherwise passed.
  ✓ Read frontend rules, batch plan/spec/report, and map the commit diff
  ✓ Audit CSS cascade, fallbacks, scope leakage, fonts, SSR/SEO, and i18n
  ✓ Validate suspected regressions with targeted static/runtime checks
  → Deliver severity-ranked findings and final verdict
Review complete; final verdict is REVISE based on one shared-transcript formatting regression and one app-surface font-weight mismatch.
  ✓ Read frontend rules, batch plan/spec/report, and map the commit diff
  ✓ Audit CSS cascade, fallbacks, scope leakage, fonts, SSR/SEO, and i18n
  ✓ Validate suspected regressions with targeted static/runtime checks
  ✓ Deliver severity-ranked findings and final verdict
codex
## Verdict: REVISE

No blocker or security issue, but two regressions should be fixed before production.

### Medium — Shared conversations lose line breaks

[page.tsx:100](/Users/mayijie/Projects/Code/010_DocTalk/frontend/src/app/shared/[token]/page.tsx:100) replaced `whitespace-pre-wrap` with `.ed-body`, which does not define `white-space`.

Because shared messages render as plain text, HTML now collapses paragraphs, blank lines, and list-like formatting into one paragraph. Restore `whitespace-pre-wrap` or `whiteSpace: "pre-wrap"` on the message `<p>`.

### Low — App prose requests unavailable Plex weights

[layout.tsx:14](/Users/mayijie/Projects/Code/010_DocTalk/frontend/src/app/layout.tsx:14) loads IBM Plex Sans only at 400–700, but [tailwind.config.ts:54](/Users/mayijie/Projects/Code/010_DocTalk/frontend/tailwind.config.ts:54) leaves Typography defaults intact:

- `h1`: 800
- `h1 strong`: 900
- `h2 strong`: 800

These rules reach core app surfaces through [MessageBubble.tsx:315](/Users/mayijie/Projects/Code/010_DocTalk/frontend/src/components/Chat/MessageBubble.tsx:315) and [TextViewer.tsx:713](/Users/mayijie/Projects/Code/010_DocTalk/frontend/src/components/TextViewer/TextViewer.tsx:713). Inter previously supplied those weights; Plex now resolves them to its closest loaded face, flattening heading emphasis. Override the prose weights to ≤700.

Everything else audited clean:

- Hover, reduced-transparency, print, and combined media-state cascade resolves correctly.
- The paper-ground counter cannot affect app surfaces without `.dt-editorial`; `DocumentDiffPanel surface="app"` remains isolated.
- Glass consumers have both required fallbacks; no inline `backdrop-filter` escape was found.
- Shared-page fetch, metadata, and `noindex` logic are unchanged.
- No locale files or user-visible strings changed.
- No remaining `--ed-ochre`, `--font-inter`, or `--font-newsreader` references.

Scope note: Git reports 17 commits in the range, not 16; the extra commit is the Codex-request documentation commit. I made no workspace changes.
tokens used
176,626
## Verdict: REVISE

No blocker or security issue, but two regressions should be fixed before production.

### Medium — Shared conversations lose line breaks

[page.tsx:100](/Users/mayijie/Projects/Code/010_DocTalk/frontend/src/app/shared/[token]/page.tsx:100) replaced `whitespace-pre-wrap` with `.ed-body`, which does not define `white-space`.

Because shared messages render as plain text, HTML now collapses paragraphs, blank lines, and list-like formatting into one paragraph. Restore `whitespace-pre-wrap` or `whiteSpace: "pre-wrap"` on the message `<p>`.

### Low — App prose requests unavailable Plex weights

[layout.tsx:14](/Users/mayijie/Projects/Code/010_DocTalk/frontend/src/app/layout.tsx:14) loads IBM Plex Sans only at 400–700, but [tailwind.config.ts:54](/Users/mayijie/Projects/Code/010_DocTalk/frontend/tailwind.config.ts:54) leaves Typography defaults intact:

- `h1`: 800
- `h1 strong`: 900
- `h2 strong`: 800

These rules reach core app surfaces through [MessageBubble.tsx:315](/Users/mayijie/Projects/Code/010_DocTalk/frontend/src/components/Chat/MessageBubble.tsx:315) and [TextViewer.tsx:713](/Users/mayijie/Projects/Code/010_DocTalk/frontend/src/components/TextViewer/TextViewer.tsx:713). Inter previously supplied those weights; Plex now resolves them to its closest loaded face, flattening heading emphasis. Override the prose weights to ≤700.

Everything else audited clean:

- Hover, reduced-transparency, print, and combined media-state cascade resolves correctly.
- The paper-ground counter cannot affect app surfaces without `.dt-editorial`; `DocumentDiffPanel surface="app"` remains isolated.
- Glass consumers have both required fallbacks; no inline `backdrop-filter` escape was found.
- Shared-page fetch, metadata, and `noindex` logic are unchanged.
- No locale files or user-visible strings changed.
- No remaining `--ed-ochre`, `--font-inter`, or `--font-newsreader` references.

Scope note: Git reports 17 commits in the range, not 16; the extra commit is the Codex-request documentation commit. I made no workspace changes.
