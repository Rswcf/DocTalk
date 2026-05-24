# Adversarial review request — International SEO Phase A (locale subdirectory URLs)

You are doing an **adversarial code review**. Be skeptical, hunt for correctness
bugs, SEO mistakes, and edge cases. Do NOT rubber-stamp. Claude implemented this;
your job is to find what's wrong.

## Context

DocTalk (Next.js 14 App Router, frontend). Goal: make the already-translated 11
locales indexable by search engines. Today every page serves at ONE URL with
client-side-only translation, so 10 languages are invisible to crawlers.

Phase A (this change) implements locale-subdirectory URLs for the **lawyers**
use-case page as a pipeline proof. Design spec:
`.collab/plans/2026-05-24-international-seo-locale-urls-spec.md` (read it first).

Decisions already made (in scope — don't relitigate, but DO check they're
implemented correctly):
- English stays unprefixed at root; 6 locales (ja/es/ko/de/fr/pt) get `/xx/` prefix.
- Translated content is **server-rendered** (SSG) via `getServerT(locale)`.
- `<html lang>` deliberately stays `en` at SSR (documented tradeoff — App Router
  only root layout renders `<html>`; reading locale there would force dynamic
  rendering). Content language + hreflang are the load-bearing signals.

## Files changed (read them in repo; diff at
`.collab/reviews/2026-05-24-i18n-locale-urls-diff.patch`)
- `frontend/src/i18n/routing.ts` (NEW) — URL_LOCALES, localizedHref,
  localizedHrefIfAvailable, splitLocaleFromPath, LOCALIZED_PATHS, isLocalizedPath
- `frontend/src/i18n/server.ts` (NEW) — getServerT
- `frontend/src/lib/seo.ts` — buildMarketingMetadata hreflang/canonical
- `frontend/src/app/[locale]/layout.tsx` (NEW) — generateStaticParams, dynamicParams=false
- `frontend/src/app/[locale]/use-cases/lawyers/page.tsx` (NEW)
- `frontend/src/app/use-cases/lawyers/{page.tsx, LawyersContent.tsx (was LawyersClient), LawyersJsonLd.tsx}`
- `frontend/src/components/marketing/{EditorialHeaderBase.tsx, EdLanguageSelector.tsx}`
- `frontend/src/components/landing/EditorialFooter.tsx`
- `frontend/src/app/sitemap.ts`

Build status: `next build` PASSES; 6 locale pages SSG'd with German content in
initial HTML; hreflang reciprocal in page + sitemap; canonical self-referential;
no `/de/features`-style dead links; English page content unchanged. tsc+eslint clean.

## Please scrutinize specifically

1. **Routing correctness**: `splitLocaleFromPath` regex `^/([a-z]{2})(/.*)?$` —
   any real route that could be misparsed as a locale? Trailing-slash / query /
   hash handling? `localizedHrefIfAvailable` exact-match on LOCALIZED_PATHS — any
   path normalization gaps (e.g. `/use-cases/lawyers/` vs `/use-cases/lawyers`)?
2. **hreflang/canonical**: reciprocity correct? Is `x-default`→en right? Will
   Google accept Next's `hrefLang` casing? Any missing self-reference?
3. **`[locale]` segment interaction**: does `dynamicParams=false` +
   `generateStaticParams` correctly 404 unknown locales WITHOUT shadowing any
   existing root route? Does a bare `/de` (no page yet) behave acceptably?
4. **Server/client boundary**: LawyersContent is a server component passing
   lucide icon refs into server kit components, strings into client islands
   (EdFaqList, MarketingShell). Any serialization or hydration-mismatch hazard?
   The chrome (header/footer/selector) is client + uses usePathname — correct
   during SSG?
5. **The html lang=en tradeoff** — do you agree it's acceptable, or is there a
   static-rendering-preserving way to set lang per locale you'd insist on?
6. **EdLanguageSelector**: anchors with `role="option"` + onClick setLocale before
   navigation — a11y / double-action concerns? Deferred locales (zh/it/ar/hi)
   dropped from the menu on localized pages — acceptable?
7. **Regression risk** to the existing English marketing pages + landing (they
   share the edited chrome). Anything that changes English output beyond the
   added hreflang tags?
8. Anything in `getServerT` (en-fallback, missing-key behavior, build-time cost).

## Output

Write your findings to `.collab/reviews/2026-05-24-i18n-locale-urls-codex-review.md`
as a numbered list, each tagged **[Must-fix] / [Should-fix] / [Nit] / [Question]**
with file:line and concrete reasoning. End with an overall verdict:
SHIP / SHIP-AFTER-MUSTFIX / NEEDS-REWORK. You cannot run git; just read files.
