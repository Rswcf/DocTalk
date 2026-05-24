# Codex Review — International SEO Landing

Final verdict: SHIP-AFTER-MUSTFIX

1. [Must-fix] `frontend/src/app/page.tsx:5` / `frontend/src/lib/seo.ts:120` — the English root still has no page-head reciprocal hreflang for the new localized home URLs. The new `/[locale]` page calls `buildMarketingMetadata(... localized: true)`, so `/de` emits alternates, but the canonical English `/` metadata remains unlocalized and `buildMarketingMetadata` only emits `alternates.languages` when `localized` is true. Adding `/` to `LOCALIZED_PATHS` does make the sitemap reciprocal, but the page metadata itself is not, and the root HTML still has no static `MarketingLocaleLinks` because the language-selector anchors are only mounted after opening the client portal. For the #1 page, add `localized: true, locale: 'en'` to `app/page.tsx` metadata and server-render `MarketingLocaleLinks path="/"` on the root page while keeping `HomePageClient`/auth routing untouched.

2. [Must-fix] `frontend/src/components/landing/FeatureGrid.tsx:198`, `frontend/src/components/landing/SecuritySection.tsx:22`, `frontend/src/components/landing/FinalCTA.tsx:18`, `frontend/src/components/landing/HeroCollage.tsx:339` — localized landings still render visible hard-coded English. Examples include `Features`, `Privacy & Security`, `Get Started`, and `Fig. 01 — Reading with citations`; `SecuritySection.tsx:48` also repeats `Privacy`, and `EditorialHeaderBase.tsx:112` / `EditorialHeaderBase.tsx:118` keep the landing masthead dateline in English. The seeded provider only helps strings that go through `t()`/`tOr()`, so these bypass the new localized message payload and contradict the claimed zero English leak on `/de`, `/ja`, etc. Move these to existing/new seeded prefixes, or explicitly classify decorative visual microcopy and remove it from visible/localizable text.

3. [Should-fix] `frontend/src/components/marketing/EdLanguageSelector.tsx:33` / `frontend/src/components/marketing/EdLanguageSelector.tsx:37` — the active selector state is now wrong on `/` and after deferred-locale toggles. Because `/` is now in `LOCALIZED_PATHS`, the English root is treated as localized and `activeLocale` becomes the URL locale (`en`) even when the unseeded root provider has detected `zh`, `de`, etc. On `/de`, clicking a deferred locale such as `zh` calls the seeded provider’s `setLocale`, lazy-loads full Chinese, and re-renders the landing in Chinese while the selector still displays/selects `DE`. Keep crawlable `<a>` links for served locales, but derive the visible/selected active locale from provider state when the content has been client-switched, especially for the unprefixed root and deferred locales.

4. [Nit] `frontend/src/i18n/LocaleProvider.tsx:76` — the seeded-provider API would clobber the bundled English fallback if someone later passes `initialLocale="en"` with scoped `initialMessages`. Current `/[locale]` usage cannot hit this because `isUrlLocale()` excludes `en`, but the comment promises missing keys fall back to the full bundled English. Guard the `en` case or merge scoped English over the full bundle before this API is reused for the root.

Checked notes:

- I do not see a current hydration mismatch from the nested provider on `/de`: the inner provider receives identical `initialLocale`/`initialMessages` on server and client, skips detection, and the outer root provider’s URL-prefix detection converges to the same locale after mount.
- Scoped message coverage for the active `LandingPageContent` tree is otherwise complete; the `t()`/`tOr()` keys are under the seeded prefixes. `HeroArtifact`/`ShowcasePlayer` reference extra namespaces but are not imported by the landing tree.
- Static JSON checks showed 0 missing scoped keys across `de`, `ja`, `pt`, `es`, `ko`, and `fr`. The serialized scoped payload is about 16.9-19.8 KB per locale versus roughly 366-448 KB for full locale JSON.
- Localized `/de` canonical and WebSite JSON-LD URL construction look correct from source, and the `landing.headline` newline strip in metadata is fine.
- I did not run git and did not rerun the full build; this review is based on the patch, current source files, and static key/payload checks.

## Round 2

Final verdict: SHIP-AFTER-MUSTFIX

1. [Must #1] CONFIRMED — `frontend/src/app/page.tsx:6` now calls `buildMarketingMetadata(... localized: true)` and `frontend/src/app/page.tsx:175` server-renders `MarketingLocaleLinks path="/"` outside `HomePageClient`. That preserves the dual-purpose auth/session router while giving the English root reciprocal hreflang discovery. Source inspection shows the root canonical remains `/`, `buildMarketingMetadata` defaults `locale` to `en`, and the language alternates map `en`/`x-default` to `/` plus the six URL locales to `/<locale>`. I do not see a duplicate hreflang path in the implementation; the extra `MarketingLocaleLinks` anchors are crawlable body links, not head alternates.

2. [Must #2] NOT-ADDRESSED — the originally flagged section eyebrows/masthead tagline are translated, and the six URL locales have sane values for the new `landing.*` keys. However localized landings still contain visible hardcoded English inside active landing sections:
   - `frontend/src/components/landing/FeatureGrid.tsx:42`, `frontend/src/components/landing/FeatureGrid.tsx:93`, `frontend/src/components/landing/FeatureGrid.tsx:95`, `frontend/src/components/landing/FeatureGrid.tsx:102`, `frontend/src/components/landing/FeatureGrid.tsx:128`, `frontend/src/components/landing/FeatureGrid.tsx:159` render `cite`, `Flash`, `fast`, `deeper`, `No signup`, and `No training` on `/de`, `/ja`, `/pt`. These are inside `aria-hidden` visual plates, so they are not an accessibility-label leak, but they are still visible human-facing localized-page text.
   - `frontend/src/components/landing/HeroCollage.tsx:342` localizes only the caption body and still prefixes every locale with `Fig. 01`.
   - `frontend/src/components/marketing/EditorialHeaderBase.tsx:75`, `frontend/src/components/marketing/EditorialHeaderBase.tsx:128`, `frontend/src/components/marketing/EditorialHeaderBase.tsx:172`, and `frontend/src/components/marketing/EditorialHeaderBase.tsx:197` keep English masthead/menu aria labels (`DocTalk home`, `Editorial navigation`, `Open menu`/`Close menu`, `Editorial mobile navigation`). These are not visible, but they fail the requested aria-label check.
   Fix by translating these visual/a11y strings, or replace decorative visual text with non-linguistic bars/chips and explicitly keep it language-neutral.

3. [Should #3] PARTIALLY ADDRESSED — the new `activeLocale = urlLocale !== 'en' ? urlLocale : locale` fixes the homepage/root highlight case. It still leaves prefixed localized pages wrong after a deferred-locale client switch: on `/de`, choosing `zh`/`it`/`ar`/`hi` calls `setLocale(...)`, but `activeLocale` remains `de` because the URL prefix wins unconditionally. On the seeded landing provider this can re-render content in the deferred locale while the selector still displays/selects `DE`. This is not an SEO blocker, but it is still the unresolved half of the original selector finding.

4. [Nit #4] CONFIRMED — `frontend/src/i18n/LocaleProvider.tsx:79` now only seeds scoped messages for non-`en`, preserving the full bundled English fallback.

5. [New should] `frontend/src/app/layout.tsx:78` / `frontend/src/app/layout.tsx:91` — localized initial HTML still has `<html lang="en">` and the global skip link text `Skip to content`. The client provider mutates `document.documentElement.lang` after hydration, but crawlers and no-JS/screen-reader initial HTML still see English language metadata around translated `/de`/`/ja` content. I would not block this specific landing fix on it, but it should be tracked for the localized SEO/a11y rollout.

Verification notes:

- Static locale check: all seven new keys are present in `de`, `es`, `fr`, `ja`, `ko`, and `pt`; no raw old English values among those six URL locales.
- `npm run lint` passed (`next lint` plus `scripts/check-chat-prompt-i18n.js`).
- `npx tsc --noEmit --pretty false` passed.
- `npm run build` could not be completed in this sandbox because `next/font` could not resolve `fonts.googleapis.com` (`ENOTFOUND`) for Inter/Sora/Newsreader/IBM Plex Mono. I did not treat that as an app regression, but I could not independently verify the rendered production HTML from a fresh build here.
- No git commands were run.
