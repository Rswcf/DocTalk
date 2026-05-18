# Editorial Landing Page — Design Spec

**Date:** 2026-05-19
**Status:** Approved (design) — user delegated continuous execution
**Topic:** Redesign the DocTalk landing page (homepage) in a disciplined editorial-grid visual language ("Monocle-crisp" direction), establishing an editorial design foundation reusable by the rest of the public marketing surface.

## Context & scope

The user asked for the public marketing surface in an editorial / Monocle-Apartamento-Études aesthetic. The marketing surface is ~35 pages — too large for one spec. This spec covers **Phase 1**: the **landing page (homepage)** plus the shared **editorial foundation** (design tokens, fonts, scoped CSS) and the **editorial header & footer**. The remaining marketing pages (`use-cases/*`, `tools/*`, `pricing`, `trust`, `features/*`, `compare/*`, `alternatives/*`, `demo`) are **Phase 2** — they reuse this foundation and are out of scope here.

The functional app UI (PDF reader, chat, dashboard, upload, admin), `/auth`, and all earlier work are **untouched**.

## Design direction — "Monocle-crisp" editorial grid

A disciplined editorial-grid language: asymmetric multi-column grids, hairline rules as structure, monospace section labels with numbers, large serif headlines, generous whitespace. Not a literal collage. Professional and usable, with strong editorial character.

### Palette (light only — see decision below)

| Token | Value | Use |
|---|---|---|
| `--ed-paper` | `#faf9f6` | page background |
| `--ed-paper-2` | `#f1efe8` | alternate section background / inset figures |
| `--ed-ink` | `#1c1b19` | primary text, headlines |
| `--ed-ink-2` | `#46443d` | body / secondary text |
| `--ed-ink-3` | `#86837a` | captions, muted labels |
| `--ed-signal` | `#9a3b32` | brick-red signal — section numbers, primary CTA, links, key emphasis (used sparingly) |
| `--ed-signal-deep` | `#7e2f28` | signal hover/active |
| `--ed-rule` | `#d8d5cc` | hairline rules, borders |

### Typography

- **Headlines** — Newsreader (serif), added via `next/font/google`, exposed as `--font-newsreader`. Weights 400/500/600, optical sizing on.
- **Body** — Inter (already in the project, `--font-inter`).
- **Labels / captions / numerals** — IBM Plex Mono, added via `next/font/google`, exposed as `--font-plex-mono`.

Type scale:
- Hero display (`h1`): Newsreader, `clamp(40px, 6vw, 68px)`, weight 400, line-height 1.05, letter-spacing −0.02em.
- Section heading (`h2`): Newsreader, `clamp(28px, 3.5vw, 40px)`, weight 400–500, line-height 1.1.
- Sub-heading (`h3`): Newsreader 20–22px weight 500, or Inter 17px semibold for tight contexts.
- Standfirst / lede: Inter 17–19px, line-height 1.6, `--ed-ink-2`.
- Body: Inter 15–16px, line-height 1.65, `--ed-ink-2`.
- Eyebrow / label / caption: IBM Plex Mono 10.5–11px, uppercase, letter-spacing 0.13em, `--ed-ink-3` (numbers in `--ed-signal`).
- Display numerals (metrics, step numbers): Newsreader, large (32–56px), `--ed-ink`.

### Grid & motifs

- Editorial grid: `max-width` 1200px, generous side margins, a 12-column reference grid used **asymmetrically** (e.g. hero text 7 cols / figure 5 cols; feature entries alternate column spans).
- Hairline rules (`1px solid var(--ed-rule)`) separate major sections and structure feature lists.
- Monospace section labels with signal-red numbers: `01 — Cited answers`.
- Figures (product screenshots/mockups) are treated as plates: framed with a hairline, captioned with a mono `Fig. 01 — …` line.
- Primary CTA: solid `--ed-signal` button, white text, crisp 3px radius, Inter medium — not a pill. Secondary CTA: an underlined editorial text-link with a trailing arrow, or a hairline-bordered button.
- No glassmorphism, no gradients, no glow, no dot-grid — consistent with the project's de-AI-flavor goal; editorial character replaces it.

### Light-only decision

The editorial/print aesthetic is fundamentally a "paper" aesthetic. The marketing surface renders **light only**. The editorial landing root sets an opaque `--ed-paper` background and does not respond to the global `dark` class; the theme toggle is absent from the editorial header. The functional app UI keeps its existing light/dark support.

## Implementation architecture

- **New file `frontend/src/app/editorial.css`** — editorial design tokens + utility/component classes, every rule scoped under a `.dt-editorial` ancestor so nothing leaks into the app UI. Imported globally in `app/layout.tsx`.
- **Fonts** — add Newsreader and IBM Plex Mono via `next/font/google` in `app/layout.tsx`, following the existing `next/font` pattern (Inter, Sora); expose `--font-newsreader`, `--font-plex-mono` CSS variables on `<html>`.
- **`.dt-editorial` scope** — the landing page root carries `dt-editorial`; it sets an opaque paper background so it is unaffected by the global theme and by `dt-stitch-root`'s transparency rule.
- The landing page and its components are rewritten/restyled into the editorial language; the editorial header and footer are landing-specific (the existing `PublicHeader`/`Footer` keep serving other pages until Phase 2).

## Landing page — section structure (editorial layout)

Each current section is re-laid-out in the editorial grid; **real DocTalk copy and real data are kept** (11 languages, real features — no fabricated metrics).

1. **Masthead header** — sticky, paper background, hairline bottom rule. `DocTalk` wordmark + a mono descriptor; nav links in a thin rule row; a solid signal-red "Sign in" / "Try the demo" CTA. No theme toggle.
2. **Hero** — asymmetric: a large Newsreader headline + Inter standfirst on the wide column; a mono metrics row (`01 Cited answers · 11 Languages · 5 Formats`); the product screenshot as a hairline-framed figure with a `Fig. 01` caption.
3. **Feature set** — replaces the uniform card grid: numbered editorial entries (`01 — Cited answers`, `02 — Every format`, …) in an asymmetric grid, each a mono label + Newsreader sub-heading + Inter text + a small figure; hairline rules between entries.
4. **How it works** — three steps with large Newsreader numerals, hairline-ruled.
5. **Metrics** — a hairline-framed row of figures with mono labels (replaces any colored band).
6. **Security & privacy** — an editorial two-column points list with hairline rules; the four real privacy guarantees.
7. **FAQ** — a hairline-ruled Q&A list (`<details>` accordion), mono question numbers.
8. **Final CTA** — an editorial closing: a strong Newsreader line + a solid signal-red button.
9. **Footer** — an editorial colophon: mono, multi-column, fine print, real links.

## Files (Phase 1)

- Create: `frontend/src/app/editorial.css`
- Modify: `frontend/src/app/layout.tsx` (fonts + editorial.css import)
- Modify: `frontend/src/app/HomePageClient.tsx` (landing render path → editorial, wrapped in `.dt-editorial`)
- Modify/rewrite: `frontend/src/components/landing/{HeroSection,FeatureGrid,HowItWorks,SocialProof,SecuritySection,FAQ,FinalCTA}.tsx`
- New or restyled editorial header & footer components for the landing page.
- The product-figure visual (`HeroArtifact` / showcase) is reframed as an editorial plate.

## Out of scope

- All other marketing pages (Phase 2).
- The functional app UI, `/auth`, app chrome, admin — untouched.
- Dark mode for the marketing surface (deliberately light-only).
- Backend, routing, i18n key changes (existing keys reused; new copy uses `tOr` fallbacks; any new key added to all 11 locales).

## Verification

- `cd frontend && npm run build` passes.
- Browser walkthrough of `/` (the landing page): editorial layout renders — paper background, Newsreader headlines, mono labels, hairline rules, signal-red used sparingly; no glass/gradient/glow.
- The functional app UI and `/auth` are visually unchanged (the editorial scope did not leak).
- The landing renders light regardless of the global theme setting.

## Risks

- **Scope** — a full editorial landing is a large rewrite of ~8 components plus header/footer. Mitigated by the editorial foundation (tokens + scoped CSS) being built first, then components built on it; chunked tasks in the plan.
- **Font payload** — two new web fonts (Newsreader, IBM Plex Mono). Acceptable for a marketing surface where editorial type is the point; loaded via `next/font` (self-hosted, optimized).
- **Scope leakage** — editorial CSS must not affect the app UI. Mitigated by strict `.dt-editorial` scoping on every rule and a verification step.
- **Theme interaction** — the landing must stay light under a global dark setting; mitigated by an opaque paper background on the `.dt-editorial` root.
