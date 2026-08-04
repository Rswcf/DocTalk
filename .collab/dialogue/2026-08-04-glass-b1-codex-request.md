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
