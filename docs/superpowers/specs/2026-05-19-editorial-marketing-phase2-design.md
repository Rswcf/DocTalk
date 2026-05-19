# Editorial Marketing Surface (Phase 2) — Design Spec

**Date:** 2026-05-19
**Status:** Approved — design language inherited from the approved Phase 1 spec (`2026-05-19-editorial-landing-design.md`); the user delegated continuous execution and asked not to be re-consulted on settled direction.
**Topic:** Re-skin the remaining public marketing pages into the editorial (`.dt-editorial`) design layer built in Phase 1, via a shared editorial marketing component kit.

## Context & scope

Phase 1 rebuilt the landing page (`/`) in a scoped editorial design layer (`frontend/src/app/editorial.css`, all rules under `.dt-editorial`; Newsreader + IBM Plex Mono; warm-paper palette; light-only). Phase 2 applies that same layer to the rest of the public marketing surface.

**In scope (per the Phase 1 spec's named Phase 2 list):**

- `use-cases/` — hub + 10 vertical pages (compliance, consultants, finance, healthcare, hr-contracts, lawyers, real-estate, students, teachers)
- `compare/` — hub + 5 competitor pages (askyourpdf, chatpdf, humata, notebooklm, pdf-ai)
- `alternatives/` — hub + 5 competitor pages (same five)
- `features/` — hub + 5 pages (citations, free-demo, multi-format, multilingual, performance-modes)
- `tools/` — hub + 2 interactive tools (word-counter, reading-time)
- `pricing/`
- `trust/`
- `demo/` (the demo index page only — `DemoPageClient`)

**Out of scope:** the functional app UI, `/auth`, app chrome, admin, the document reader, `demo/[sample]` redirect; legal/content pages not in the Phase 1 list (`about`, `contact`, `imprint`, `privacy`, `terms`, `blog`, `document-diff`) stay on the zinc/blue app UI for now. Dark mode for the marketing surface (light-only, unchanged). Backend, routing, the `page.tsx` server wrappers (metadata + JSON-LD), and i18n keys (existing keys reused; any genuinely new copy added to all 11 locales via `tOr`).

## Current state

Every marketing page is a server `page.tsx` (metadata + JSON-LD — untouched) plus a `"use client"` `*Client.tsx` that renders the actual UI. The clients today use `<Header variant="minimal" />` + `<Footer />`, hardcoded zinc/blue Tailwind, lucide icons, and `useLocale().t()`. Total ≈ 12k LOC of client code. The interactive `tools/*` widgets (`word-counter`, `reading-time`) contain functional logic that must be preserved exactly — only their page chrome is re-skinned.

The pages cluster into families with near-identical anatomy:

- **use-cases**: breadcrumb → icon hero → challenge prose → feature grid → doc-type grid → real-world prose → security grid → 3-step row → FAQ → CTA banner.
- **compare**: breadcrumb → hero → comparison table → prose/verdict → FAQ → CTA banner.
- **alternatives**: breadcrumb → hero → ranked alternative entries → FAQ → CTA banner.
- **features**: breadcrumb → hero → how-it-works steps → layered explainer grids → CTA banner.
- **hubs** (`use-cases`, `compare`, `alternatives`, `features`, `tools`): hero → card index of children → CTA.

This repetition is the design opportunity: a shared editorial marketing kit, then thin per-page composition.

## Design direction

Inherited verbatim from Phase 1 — no new visual decisions. The editorial layer (`.dt-editorial`, `editorial.css`) is reused as-is: warm ecru paper, terracotta `--ed-signal`, ochre, hairline rules, Newsreader headlines, IBM Plex Mono labels, mixed-voice display headline, print-craft grain, light-only. The existing utility classes (`ed-shell ed-rule ed-section ed-h2 ed-h3 ed-lede ed-body ed-label ed-label-num ed-caption ed-num ed-cta ed-link ed-figure ed-halftone ed-crosshair`) are the vocabulary. New CSS is added to `editorial.css` only where a genuinely new repeated pattern needs it (still scoped under `.dt-editorial`).

Inner marketing pages differ from the landing in one structural way: they need a **breadcrumb** and they are **not** the landing, so they get a slightly more compact masthead. They keep the same paper background, the same `EditorialFooter`, and the same scoping.

## Architecture — shared editorial marketing kit

A new directory `frontend/src/components/marketing/` holds the editorial marketing kit. Every component renders only `.dt-editorial`-scoped markup and is composed by the per-page clients. The kit:

- **`MarketingShell`** — wraps a page: emits the `dt-editorial` root div, an `EditorialMarketingHeader` (a compact inner-page masthead with optional breadcrumb), `<main>`, and `EditorialFooter` (reused from Phase 1). Props: `breadcrumb` (array of `{label, href?}`), `children`.
- **`EditorialMarketingHeader`** — new; the compact inner-page masthead. Same paper/hairline treatment as `EditorialHeader`, omits the landing dateline, renders the breadcrumb row beneath the masthead bar as a hairline-ruled mono trail.
- **`EdPageHero`** — editorial page hero: mono eyebrow label, `ed-h2`-scale (or larger) Newsreader headline, `ed-lede` standfirst, optional CTA row, optional small figure/crosshair motif.
- **`EdSection`** — a titled editorial section: optional mono section label with signal number, optional `ed-h2` heading, hairline top rule, `ed-section` padding. Wraps arbitrary children in `ed-shell`.
- **`EdProse`** — editorial long-form prose block (the "challenge"/"why" narrative sections): `ed-body` paragraphs, editorial inline links, comfortable measure.
- **`EdFeatureList`** — numbered editorial entry list (`01 — Title`): mono number, `ed-h3` title, `ed-body` text; hairline rules between entries; optional small icon. Asymmetric grid.
- **`EdCardGrid`** — uniform editorial card grid for doc-type/security/hub-index cards: hairline-bordered cards on `--ed-paper-2`, mono label or `ed-h3` title + `ed-body` detail. Equal-height (`auto-rows-fr` + `h-full`).
- **`EdStepRow`** — the 3-step "how it works" row: large Newsreader `ed-num` numerals, hairline-ruled, `ed-h3` + `ed-body`.
- **`EdComparisonTable`** — editorial re-skin of `ComparisonTable`: hairline-ruled table, mono header row, signal-colored DocTalk column, mono check/dash glyphs instead of colored pills.
- **`EdFaqList`** — hairline-ruled Q&A accordion (`<details>`-based or controlled), mono question numbers — the same component already used on the landing FAQ; promote/generalize the landing `FAQ` into the kit if shapes match.
- **`EdCtaBanner`** — editorial closing CTA: a `--ed-paper-2` panel with a Newsreader line, optional standfirst, a solid `ed-cta` button + optional `ed-link` secondary.

Per-page clients become thin: they keep their `useLocale()`/`t()` data assembly and JSON-LD untouched, and replace the JSX body with kit composition. Family-uniform pages (10 use-cases, 5 compare, 5 alternatives) become near-mechanical conversions once the kit exists.

## Implementation strategy

Phase 2 is large (~28 pages). It is executed as a sequence of self-contained plans, each producing a working, building, testable slice:

1. **Plan A — kit + use-cases family** (this plan): build `components/marketing/` kit + `EditorialMarketingHeader`, add any needed CSS to `editorial.css`, then convert the 10 use-cases pages + the use-cases hub. Proves the kit on the most uniform family.
2. **Plan B — compare + alternatives** (10 pages + 2 hubs), incl. `EdComparisonTable`.
3. **Plan C — features + tools** (7 pages + 2 hubs); tools keep their functional widgets, chrome re-skinned.
4. **Plan D — pricing + trust + demo index.**

Each plan is written and executed in turn; this spec covers all of Phase 2, the plans cover the slices.

## Files

- Create: `frontend/src/components/marketing/*` (the kit, one file per component).
- Possibly modify: `frontend/src/app/editorial.css` (add scoped CSS for new repeated patterns).
- Modify: every in-scope `*Client.tsx` (re-skin to kit composition).
- Untouched: every `page.tsx` server wrapper, `editorial.css` Phase 1 rules, the landing components, the app UI.

## Verification

- `cd frontend && npm run build` passes after every plan.
- Browser walkthrough of converted pages: editorial layout — paper background, Newsreader headlines, mono labels, hairline rules, signal-red used sparingly; no glass/gradient/glow; breadcrumb present.
- The functional app UI, `/auth`, and the document reader are visually unchanged (no `.dt-editorial` scope leakage).
- Converted pages render light regardless of the global theme.
- `tools/*` interactive widgets still compute correctly.
- Loading/error states still render meaningful content (Soft-404 rule).

## Risks

- **Scope** — ~28 pages. Mitigated by the shared kit (built first, once) and by chunking into per-family plans, each independently shippable.
- **Family drift** — pages within a family are similar but not identical (varying section counts/copy). Mitigated by a kit of composable primitives rather than one rigid page template.
- **Tools widgets** — `word-counter`/`reading-time` carry real logic. Mitigated by re-skinning only chrome and keeping widget internals byte-identical where possible; verified by exercising the tool.
- **Scope leakage** — editorial CSS must not reach the app UI. Mitigated by strict `.dt-editorial` scoping and a verification step per plan.
- **i18n** — existing keys are reused; the conversion is structural, not copy. Any new key goes to all 11 locales via `tOr` fallback.
