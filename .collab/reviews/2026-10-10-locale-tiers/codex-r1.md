# Codex r1 — locale index tiers + Humata facts (2026-10-10)

Reviewer: `codex exec -m gpt-5.5`, read-only. Commits 59991895, 3def39df. Final section only.

SHIP-WITH-FIXES

1. [frontend/src/lib/seo.ts](frontend/src/lib/seo.ts:123) — should-fix — tier-2 noindex subpages still emit a hreflang cluster to indexable siblings. Build output for `/it/pricing` has the correct `<meta name="robots" content="noindex, follow"/>` and self canonical, but also `<link rel="alternate"...>` entries. Those siblings intentionally do not list `/it/pricing` back, so the noindex page’s hreflang annotations are non-reciprocal. Exact fix: when `localized && !isIndexableLocalePath(pageLocale, path)`, emit only `{ canonical: canonicalPath }`, no `alternates.languages`. Update `sitemap-routes.test.cjs` to assert no page metadata languages for tier-2 subpages.

2. [frontend/src/components/marketing/MarketingLocaleLinks.tsx](frontend/src/components/marketing/MarketingLocaleLinks.tsx:20) — should-fix — the hidden crawler-facing locale nav still loops `MARKETING_LOCALES` and renders `/it/...`, `/ar/...`, `/hi/...` anchors with `hrefLang`. This bypasses the new index-tier helpers. Exact fix: keep the real language selector untouched, but change this hidden SEO component to render `['en', ...indexableLocalesFor(path)]` for subpages, or remove `hrefLang` from non-indexable links.

3. `en/de/es/ko/pt compareHumata.heroDescription` and `compareHumata.metaDescription` — blocker — these still say DocTalk is at a “more affordable/lower price” than Humata. Ground truth now says DocTalk Plus and Humata Expert both start at `$9.99/month`, so this contradicts the “no cheaper at entry price” requirement. Lines: `en.json:1863-1864`, `de.json:1856-1857`, `es.json:1856-1857`, `ko.json:1856-1857`, `pt.json:762-763`. Exact fix: replace that phrase with “per-question credit pricing” / “more predictable question-based pricing” in all five locales.

4. es.json (line 1917) — nit — Spanish price strings lost no-break spaces in two changed compareHumata keys (whoHumata3 and the first FAQ answer): the amount and the dollar sign are now separated by a normal space. Exact fix: use a no-break space there, matching compareHumata.verdictParagraph1. (Reworded by Claude: the original line tripped a gitleaks generic-api-key false positive.)

Verification: `node --test tests/sitemap-routes.test.cjs` passed 10/10, `npm run build` passed, and all 11 locale JSON files parse. The current tests would catch reverting only sitemap or only metadata helper logic, but not findings 1 or 2.

## Claude's resolution

1. Fixed: tier-2 pages emit no `alternates.languages` (seo.ts); test asserts it.
2. Fixed: `MarketingLocaleLinks` renders `['en', ...indexableLocalesFor(path)]`; render test added.
3. Fixed, wider than reported: the "more affordable" phrase was in 9 locales (en ja ko es de pt it ar hi), not 5; both heroDescription and metaDescription changed (deliberate meta-key edit, factual). Also zh/fr `verdictParagraph2` said "more affordable pricing" -> now "predictable per-question pricing". pt `compareHumata.ctaDescription` was untranslated English -> translated.
4. Fixed: es no-break spaces restored in the two keys that had them on main.

Scope note for the owner: the brief was "numbers only, no title changes". No titles changed, but comparative claims that rested on the old $14.99 price ("Yes, DocTalk is cheaper", "more value per dollar", the Student-plan bullet) had to be reworded, because equal entry prices made them false.
