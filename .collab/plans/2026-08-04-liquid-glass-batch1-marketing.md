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
