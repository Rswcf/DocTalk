# Adversarial review — International SEO: localized landing page (the #1 page)

Adversarial review. The landing is DocTalk's most important page + this touches
the core LocaleProvider used app-wide — be thorough. You cannot run git. Diff:
`.collab/reviews/2026-05-24-i18n-landing-diff.patch`. Read the actual files.

## Context
Final piece of the i18n rollout (Phase A/B + pricing already shipped, 6 locales).
This localizes the landing `/` for the 6 URL locales (ja/es/ko/de/fr/pt) WITHOUT
refactoring the 8 client section components, by wrapping the existing client
`LandingPageContent` in a server-seeded `LocaleProvider` on locale routes. The
English root `app/page.tsx` (HomePageClient → LandingPageContent, dual-purpose
auth-routed) is intentionally UNTOUCHED.

## Changes
- `frontend/src/i18n/LocaleProvider.tsx`: added optional `initialLocale` /
  `initialMessages`. When provided: starts in that locale, seeds
  `loadedTranslations[locale]=initialMessages`, and SKIPS the client
  detect effect. Unseeded behavior unchanged (start en, detect). `resolve()`
  still falls back to full bundled `en` for any missing key.
- `frontend/src/i18n/server.ts`: `getScopedMessages(locale, prefixes)` — loads the
  locale JSON and returns only keys under the given namespace prefixes (~17KB for
  the landing vs 400KB full), en-fallback per key.
- `frontend/src/app/[locale]/page.tsx` (NEW): server landing. Validates locale,
  resolves scoped messages for the landing tree's namespaces (landing/hero/chat/
  footer/privacy/terms/public/auth/header/common), renders
  `<LocaleProvider initialLocale initialMessages><LandingPageContent/></LocaleProvider>`
  + localized WebSite/Organization JSON-LD + MarketingLocaleLinks + hreflang metadata.
- `frontend/src/components/marketing/EdLanguageSelector.tsx`: now renders ALL 11
  locales — served (en+URL_LOCALES, on localized paths) as crawlable `<a>`, the 4
  deferred (zh/it/ar/hi) as client `setLocale` toggles. (Previously localized mode
  dropped the 4 — this avoids a homepage switcher regression.)
- `frontend/src/i18n/routing.ts`: `'/'` added to LOCALIZED_PATHS.

Build: `next build` PASSES (275 static pages). Verified: `/de` `/ja` `/pt` landings
SSR translated content (de: Dokument/Antwort/hochladen), hreflang 30, canonical
`/de`, crawlable locale links, 0 English leak; English root index.html unchanged
(English). tsc + eslint clean.

## Scrutinize specifically
1. **LocaleProvider seeding** — does the nested seeded provider on `/de` cause any
   hydration mismatch vs the outer root provider? The root provider (layout) still
   mounts + detects; the landing tree uses the inner seeded provider. Is the inner
   provider's initial state identical server vs client (no flicker/mismatch)? Any
   risk to the unseeded default path (the whole rest of the app)?
2. **Scoped messages completeness** — could the landing tree reference a key OUTSIDE
   the seeded namespaces, rendering English on a locale landing? (AuthModal is in the
   root layout, outside — intended.) Is the en-fallback in `resolve()` correct so a
   missed key degrades to English, not a raw key?
3. **EdLanguageSelector** — on `/de`, clicking a deferred locale (zh) calls setLocale
   on the SEEDED provider → it lazy-loads zh full + re-renders client-side while URL
   stays `/de`. Acceptable edge case, or a bug? On the English root `/` (now a
   localized path), does the selector still behave (en+6 as `<a>`, 4 as toggle)? Any
   regression to the English homepage?
4. **`'/'` in LOCALIZED_PATHS** — side effects on header/footer `localizedHrefIfAvailable('/')`
   across ALL marketing pages (logo/home links). On English pages it must stay `/`;
   on `/de` pages the logo should go to `/de`. Verify no `/en` leakage.
5. **Metadata/JSON-LD** — canonical `/de`, hreflang reciprocal incl pt; WebSite
   JSON-LD url uses the locale home. headline `\n`-strip for the title correct?
6. Payload: 17KB scoped messages in the landing hydration acceptable for the #1 page?

## Output
Write findings to `.collab/reviews/2026-05-24-i18n-landing-codex-review.md` —
numbered, tagged [Must-fix]/[Should-fix]/[Nit]/[Question] with file:line, final
verdict SHIP / SHIP-AFTER-MUSTFIX / NEEDS-REWORK.
