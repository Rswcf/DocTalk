# International SEO — Locale Subdirectory URLs (Spec)

**Date:** 2026-05-24
**Owner:** Claude (→ Codex adversarial review before merge)
**Strategy context:** Acquisition is the binding constraint (≈1 signup/day, WAU=5). Audit found the site is indexed but cannot rank against high-authority domains for English commercial terms. The biggest *untapped, buildable* lever: 11 locales of fully-translated content are **invisible to search engines** because all languages serve from one URL with client-side-only translation. This spec makes the translated content indexable via locale-subdirectory URLs.

This spec implements the architecture already decided in `.collab/plans/seo-deep-international.md` §2 (Option A: subdirectory `/xx/`, SSR/SSG mandatory, hreflang to distinct URLs).

---

## Scope (locked with user 2026-05-24)

- **Locales:** 6 high-value — `ja, es, ko, de, fr, pt`. English stays the default. (`zh/ar/hi` deferred: Baidu/.site friction + smaller markets; content already exists so adding them later is config-only.)
- **Pages:** the full editorial marketing surface —
  `/` (landing), `use-cases/*` (9), `compare/*` (5), `alternatives/*` (5), `features/*` (5), `tools/*` (2), `pricing`, `trust`, `demo` (landing variant).
- **Excluded:** blog (English Markdown, not in locale JSON — separate effort), zinc/blue legal pages (`about/contact/imprint/privacy/terms`), the authenticated app (`/d/`, `/collections`, `/profile`, `/billing`, chat) — behind auth, robots-disallowed, no SEO need.

## Goals / Non-goals

**Goals**
1. Each of the 6 locales gets a unique, crawlable URL per marketing page (`/de/use-cases/lawyers`).
2. The **initial server HTML is in the target language** (SSG) so Googlebot/Baidu/Naver see translated content without running JS.
3. Correct `hreflang` (all 7 variants + `x-default`) and self-canonical per locale URL.
4. Locale-aware sitemap; crawlable locale switcher (real `<a>` links).
5. **Zero change to existing English URLs** (no redirects → no ranking loss) and **zero change to the authenticated app**.

**Non-goals (this round)**
- Native (non-translated) per-market content; Naver Blog / Baidu Webmaster registration (manual, Phase C).
- Localizing blog posts.
- Moving English under `/en/`.

---

## URL strategy

- English: root, unchanged — `/use-cases/lawyers`.
- Other locales: prefix — `/de/use-cases/lawyers`, `/ja/pricing`, etc.
- Rationale: "default-locale-no-prefix" preserves all existing English URLs and rankings; no 301s.

## Rendering architecture

**Core change: marketing page *content* moves from client-context translation to server-side build-time translation.**

1. **Server translation util** — `frontend/src/i18n/server.ts` (server-only):
   `getServerT(locale)` dynamically imports the locale JSON and returns `{ t, tOr }` mirroring the client API (same `applyParams`, same en-fallback for missing keys). Loaded at build time under SSG.

2. **Shared server content components** — for each marketing route, the current `XClient.tsx` (`"use client"`, `useLocale()`) becomes `XContent.tsx` (server component, `getServerT(locale)`), taking `{ locale }` as a prop. Behaviorally identical for English; now also renders any locale on the server.

3. **Route tree** — add `app/[locale]/…` mirroring the marketing routes for the 6 locales:
   - `app/[locale]/layout.tsx` → `generateStaticParams()` returns the 6 locales; validates locale (`notFound()` otherwise).
   - Each `app/[locale]/<route>/page.tsx` resolves metadata (locale + hreflang) and renders `<XContent locale={params.locale} />` plus the JSON-LD (localized where present).
   - The existing root pages render `<XContent locale="en" />`. One content component, two thin page wrappers (root + `[locale]`).

4. **Locale-aware shell** — `MarketingShell` / `EditorialMarketingHeader` currently pull nav labels + the switcher from `useLocale()` context. They must accept `locale` (+ resolved header strings) as props from the server content component:
   - Nav/CTA hrefs become locale-prefixed.
   - The **locale switcher emits real `<a href="/de/…">`** computed by swapping the prefix on the current path (this is what makes all variants discoverable).

5. **Internal-link localization** — a helper `localizedHref(locale, path)` prefixes non-en locales. All `<Link>`/`href` inside marketing content use it, so a German page links to German pages (no drop to English mid-journey).

6. **Untouched** — root `app/layout.tsx`, `LocaleProvider` (still drives the authenticated app's client-side locale), and all app routes.

## hreflang / canonical

Extend `buildMarketingMetadata` to take `locale` + locale-agnostic `path` and emit:
- `alternates.canonical` = the current locale's absolute URL.
- `alternates.languages` = `{ en: <root>, ja: /ja…, es: /es…, ko, de, fr, pt, 'x-default': <root> }` (only locales that actually have URLs).
- `openGraph.locale` already mapped via `OG_LOCALE_MAP`.

## Sitemap

Rewrite `sitemap.ts`: for every in-scope marketing route emit the en URL **and** the 6 locale URLs, each with `alternates.languages` (Next `MetadataRoute.Sitemap` supports xhtml:link). Blog/legal stay en-only.

## robots

No change needed, but **verify** locale prefixes are not caught by `Disallow: /d/` (they are not — `/de/` ≠ `/d/`) and `/xx/demo` is allowed.

---

## Known architectural tradeoff: `<html lang>` stays `en` at SSR

In App Router only the **root** layout renders `<html>`. Setting `lang="de"` at SSR for a nested `[locale]` route would require the root layout to read the URL (via `headers()`/params), which forces **dynamic rendering** for the whole tree — the exact regression CLAUDE.md forbids (kills static/CDN + SEO). 

**Decision:** keep `<html lang="en">` in static SSR; on locale routes set `document.documentElement.lang`/`dir` client-side (as today). The dominant Google geo signals are **content language + hreflang** (per `seo-deep-international.md` §8: "Google now relies entirely on hreflang"), both of which we get right server-side. `html lang` is a minor signal. Accepting this preserves static rendering (the big SEO + cost win). Revisit only if we later adopt middleware-rewrite i18n.

(Note: `ar` RTL is **out of scope** this round, so no RTL-at-SSR concern.)

---

## Phasing

- **Phase A — prove the pipeline (one route family, all 6 locales):**
  landing (`/`) + `use-cases/lawyers`. Build the server util, route tree, locale-aware shell, hreflang, sitemap entries, switcher links. **Gate:** `next build` green; view-source of `/de` and `/de/use-cases/lawyers` shows German in initial HTML + correct hreflang/canonical; sitemap lists locale URLs; switcher links resolve; Lighthouse SEO/perf not regressed; English URLs byte-stable. Deploy, confirm indexing over following days.
- **Phase B — roll out** remaining marketing routes (use-cases ×8, compare ×5, alternatives ×5, features ×5, tools ×2, pricing, trust, demo).
- **Phase C — manual (founder):** submit per-locale sitemaps in GSC + Bing; later Baidu/Naver per the deep plan.

## Testing / verification

- `cd frontend && npm run build` (MUST pass — locale JSON nested-key + SSG bugs only surface in full build).
- View-source assertions (Phase A gate above), scripted where possible.
- hreflang reciprocity check (each variant lists all others).
- Existing English routes diff = no change (no redirect, same HTML).
- Per CLAUDE.md: i18n touches all locales; large refactor (>30 lines logic) → **Claude→Codex adversarial review until consensus** before merge; deploy backend-first N/A (frontend-only) but follow `/deploy` (stable, verify Vercel Ready).

## Risks

| Risk | Mitigation |
|---|---|
| Large refactor (shell + every content page + links) | Phase A proves the full pattern on one family before scaling; Codex review |
| Build cost: 6×~28 ≈ 170 extra SSG pages each importing a 400KB JSON | Per-locale dynamic import (one JSON per route render); monitor build time/mem |
| Internal links leak to English | `localizedHref` helper used everywhere; Phase A gate checks in-locale navigation |
| Kit component secretly uses `useLocale()` (would render en inside a de page) | Audit kit during Phase A; pass strings/locale as props |
| html lang=en mismatch (see tradeoff) | Accepted; content+hreflang are the load-bearing signals |

## Definition of done (Phase A)

Translated HTML served at `/{ja,es,ko,de,fr,pt}/` and `/{…}/use-cases/lawyers`, with reciprocal hreflang, locale sitemap entries, crawlable switcher, green build, unchanged English — reviewed by Codex and deployed to `stable`.
