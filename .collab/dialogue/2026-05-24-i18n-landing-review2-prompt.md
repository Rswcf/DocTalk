# Round 2 — confirm consensus on landing fixes

You reviewed the localized landing and gave SHIP-AFTER-MUSTFIX
(`.collab/reviews/2026-05-24-i18n-landing-codex-review.md`). Fixes applied. Verify
each, check the new code, give a final verdict. Adversarial; no git. Diff:
`.collab/reviews/2026-05-24-i18n-landing-diff.patch`. Read the files.

## How each finding was addressed
- **[Must #1] English root reciprocity** → `frontend/src/app/page.tsx`: metadata now
  `localized: true` (emits hreflang alternates for the locale homes) + server-renders
  `<MarketingLocaleLinks path="/" />` (crawlable locale anchors in initial HTML).
  HomePageClient/auth routing untouched. Verified: index.html has hreflang(30:
  en/de/es/fr/ja/ko/pt/x-default) + sr-only `<a href="/de">`… links + canonical.
- **[Must #2] hardcoded English in landing sections** → moved to translation keys
  under the seeded `landing.*` namespace, translated in all 6 URL locales (deferred
  4 get English): `landing.features.eyebrow` (FeatureGrid), `landing.faq.eyebrow`
  (FAQ), `landing.finalCta.eyebrow` (FinalCTA), `landing.security.eyebrow` +
  `landing.security.itemEyebrow` (SecuritySection), `landing.heroCollage.caption`
  (HeroCollage — added useLocale), `landing.masthead.tagline` (EditorialHeaderBase
  dateline, with text-transform:uppercase). Verified: /de.html has 0 of the old
  English strings; shows Funktionen/Datenschutz/Loslegen/Dokumentenintelligenz/
  "Lesen mit Zitaten".
- **[Should #3] selector active state** → `EdLanguageSelector`:
  `activeLocale = urlLocale !== 'en' ? urlLocale : locale` (URL locale on prefixed
  pages, provider locale on root — fixes the homepage highlight).
- **[Nit #4] provider en guard** → `LocaleProvider` only seeds a non-en locale, so a
  scoped seed can never clobber the full bundled English fallback.

Build: `next build` PASSES (275 pages). tsc + eslint clean.

## Scrutinize
1. Any REMAINING hardcoded English visible on a locale landing (`/de`, `/ja`, `/pt`)
   that I missed — eyebrows, captions, aria-labels, alt text, button text in the 8
   landing sections + HeroArtifact + the masthead? (I only fixed the ones you flagged
   + scanned ed-label; double-check.)
2. `app/page.tsx` MarketingLocaleLinks + `localized:true` — correct on the English
   root without breaking the dual-purpose auth routing? Any duplicate/again hreflang?
3. The new translation keys — present + sane in all 6 URL locales (no raw keys / wrong
   namespace)? The masthead uppercase via text-transform OK for CJK (no-op) + Latin?
4. EdLanguageSelector active-locale change — any case now wrong (prefixed marketing
   pages under the ROOT provider vs landing under the seeded provider)?
5. Anything else that blocks shipping the #1 page in 6 locales.

## Output
Append "## Round 2" to `.collab/reviews/2026-05-24-i18n-landing-codex-review.md`:
per-finding CONFIRMED/NOT-ADDRESSED, any NEW issues tagged, final verdict
SHIP / SHIP-AFTER-MUSTFIX / NEEDS-REWORK.
