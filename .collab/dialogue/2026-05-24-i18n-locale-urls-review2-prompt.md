# Round 2 — confirm consensus on International SEO Phase A fixes

You previously reviewed this change and gave **SHIP-AFTER-MUSTFIX**
(`.collab/reviews/2026-05-24-i18n-locale-urls-codex-review.md`). Claude has now
applied fixes. Verify each was addressed correctly, check the NEW code for fresh
bugs, and give a final verdict. Be adversarial; don't rubber-stamp.

Updated full diff: `.collab/reviews/2026-05-24-i18n-locale-urls-diff.patch`.
Read the actual files in the repo.

## How each finding was addressed

- **[Must #1] crawlable switcher** → NEW `frontend/src/components/marketing/MarketingLocaleLinks.tsx`,
  a *server* component rendering sr-only `<a href hreflang>` for en+6 in the
  initial HTML; `LawyersContent` renders it. (The interactive dropdown stays as
  UX.) Verified: the 7 anchors are present in the prerendered `/de/...html`.
- **[Must #2] English chrome at SSR** → NEW `frontend/src/i18n/chrome.ts`
  `getChromeStrings(locale)` resolves the (already-translated) nav/footer keys
  server-side; threaded as optional `chrome` prop through `MarketingShell` →
  `EditorialMarketingHeader`/`EditorialHeaderBase`/`EditorialFooter`/
  `EdLanguageSelector`, each falling back to `useLocale()` when `chrome` is
  absent (so not-yet-migrated pages are unchanged). Verified: `/de` HTML shows
  German nav/footer ("Anmelden/Produkt/Ressourcen/Anwendungsfälle"); EN HTML
  stays English-only.
- **[Should #3]** hardcoded English citation sentences → `tOr` keys with English
  fallback in `LawyersContent` (6-locale translation batched to Phase B).
- **[Should #4]** `frontend/src/i18n/LocaleProvider.tsx` `detectLocale()` now
  treats a URL locale prefix as explicit intent (overrides stored/browser), so
  `<html lang>`/chrome sync with the server-rendered locale.
- **[Should #5]** English JSON-LD change accepted + documented in spec (now
  matches visible content).
- **[Nit #6]** `normalizePath()` in `routing.ts` strips query/hash + trailing
  slash in `isLocalizedPath`/`localizedHrefIfAvailable`/`splitLocaleFromPath`.
- **[Q #7]** spec updated: Phase A is the lawyers slice; landing → Phase B.

## Also introduced (review this — it's new since round 1)

- `frontend/src/i18n/locales-meta.ts` (NEW, framework-neutral) holds
  `Locale`/`LocaleInfo`/`LOCALES`; `i18n/index.ts` now re-exports them. This
  fixed a prerender crash (server component importing a runtime value from a
  "use client" module). Check the re-export keeps all existing
  `import { LOCALES, Locale } from '...i18n'` consumers working and there's no
  client/server boundary leak.

## Scrutinize specifically
1. The `chrome` prop threading — any path where a localized page renders English
   chrome, or a non-localized/old page breaks because `chrome` is undefined?
2. `getChromeStrings` keys — do they all exist in the locale JSONs (no silent
   English fallback on de/es/ja/ko/fr/pt)? Any key mismatch vs what the client
   chrome used before?
3. `MarketingLocaleLinks` correctness (sr-only a11y, hreflang values, en href).
4. `detectLocale` URL-priority change — any regression for the authenticated app
   at root, or hydration mismatch (server renders en, client may switch to de)?
5. `locales-meta` extraction — any remaining server import of LOCALES from the
   client `index`? Type-only vs value imports correct?
6. Anything that still violates "English output unchanged except hreflang +
   accepted JSON-LD".

Build status: `next build` PASSES; tsc + eslint clean; HTML spot-checks pass.

## Output
Append to `.collab/reviews/2026-05-24-i18n-locale-urls-codex-review.md` a
"## Round 2" section: per-finding CONFIRMED/NOT-ADDRESSED, any NEW issues tagged
[Must-fix]/[Should-fix]/[Nit], and a final verdict SHIP / SHIP-AFTER-MUSTFIX /
NEEDS-REWORK. You cannot run git.
