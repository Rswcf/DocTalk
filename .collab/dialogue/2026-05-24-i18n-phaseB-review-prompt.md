# Adversarial review — International SEO Phase B (localize the marketing surface)

Adversarial review. Be skeptical; hunt correctness/SEO bugs across a high-volume
mechanical rollout. Claude implemented; find what's wrong. You cannot run git.

## Context
Phase A (already shipped, Codex-approved) localized ONE page (`use-cases/lawyers`)
to 6 locale subdirectory URLs (ja/es/ko/de/fr/pt), English unprefixed at root,
server-rendered translated HTML. Pattern + spec:
`.collab/plans/2026-05-24-international-seo-locale-urls-spec.md` and
`.collab/reviews/2026-05-24-i18n-locale-urls-codex-review.md`.

Phase B (THIS change) rolls that pattern to the rest of the **pure (no-hook)**
marketing surface. Full diff: `.collab/reviews/2026-05-24-i18n-phaseB-diff.patch`
(infra-only subset: `.collab/reviews/2026-05-24-i18n-phaseB-infra-diff.patch`).
Read the actual files.

## What changed
- **Scaling infra (NEW):**
  - `frontend/src/lib/marketingLocalePage.tsx` — `createMarketingLocalePage()`
    factory used by every `app/[locale]/<route>/page.tsx` (locale metadata +
    hreflang + generic JSON-LD + content; locale validated via isUrlLocale).
  - `frontend/src/components/marketing/MarketingArticleJsonLd.tsx` — generic
    localized Article JSON-LD (headline/desc from the page's hero translation keys).
- **Converted 28 page client components → server `XContent`** (same transform as
  Phase A's LawyersContent): `use client` dropped; `useLocale()` → `await
  getServerT(locale)` + `getChromeStrings(locale)` + `localizedHrefIfAvailable`;
  `<MarketingShell chrome={chrome}>`; internal hrefs wrapped; `<MarketingLocaleLinks>`
  added. Routes: use-cases (8 detail + hub), compare (5 + hub), alternatives
  (5 + hub), features (5 + hub), tools hub, trust.
- Root English `page.tsx` for each: import XContent, render `<XContent locale="en">`,
  add `localized: true` (existing inline English JSON-LD kept unchanged).
- `app/[locale]/<route>/page.tsx` created for each via the factory.
- `LOCALIZED_PATHS` updated (verified: matches the set of `[locale]` route dirs exactly, 30 each).
- **Deferred** (interactive — pass event handlers or use client hooks; need a
  client-island pass later): landing (`/`), `pricing`, `demo`,
  `tools/word-counter`, `tools/reading-time`. `pricing` was attempted then
  reverted to client (it passes onClick handlers → can't be a server component).

Build status: `next build` PASSES (263 static pages, ~180 locale marketing pages).
Spot-checks: de/ja pages have translated content + chrome + hreflang(30 incl
sr-only links) + self canonical + 6 crawlable locale links; English pages
byte-clean (no locale leakage). tsc + eslint clean.

## Scrutinize specifically
1. **Conversion correctness at scale** — was the transform applied uniformly?
   Spot-check several converted `XContent.tsx` (e.g. compare/chatpdf,
   alternatives/pdf-ai, features/multilingual, use-cases hub): is `chrome={chrome}`
   actually injected (the script only patched a multiline `<MarketingShell\n`)?
   Any page where the MarketingShell tag form differs and chrome/locale-links got
   skipped? Any internal href left unwrapped, or an EXTERNAL/`#`/mailto href
   wrongly wrapped?
2. **No client-only code left in a server component** — usePageTitle/useRouter/
   useSearchParams/useState/event handlers. (I caught trust's usePageTitle +
   pricing's handlers; are there others — e.g. a hub or detail page passing an
   onClick, or importing a client hook indirectly?)
3. **The factory + MarketingArticleJsonLd** — metadata correctness, hreflang via
   buildMarketingMetadata, JSON-LD matches visible content, `datePublished`
   default acceptable? Any title/desc key that doesn't exist (silent en fallback
   / raw-key title)? I had to hand-fix several non-`heroTitle` keys
   (students/hr/free-demo/multilingual/performance/alternatives hub/trust) — verify
   each `app/[locale]/<route>/page.tsx` titleKey/descKey resolves to a real key.
4. **hreflang/canonical/sitemap** still reciprocal across the now-large set; sitemap
   emits all the new locale URLs.
5. **English regression** — root pages should be unchanged except added hreflang +
   the (already-accepted) JSON-LD-from-keys pattern. Any page whose visible English
   output changed?
6. **Deferred set rationale** — agree landing/pricing/demo/tools need the
   client-island approach, or is any safely convertible?
7. Known carryover (not a Phase B regression): the Phase A `tOr` English-fallback
   keys (lawyers citation sentences + `footer.tagline`) are still untranslated in
   the 6 locales → those specific fragments render English on locale pages. Flag
   if you think they block.

## Output
Write findings to `.collab/reviews/2026-05-24-i18n-phaseB-codex-review.md` —
numbered, tagged [Must-fix]/[Should-fix]/[Nit]/[Question] with file:line, plus a
final verdict SHIP / SHIP-AFTER-MUSTFIX / NEEDS-REWORK.
