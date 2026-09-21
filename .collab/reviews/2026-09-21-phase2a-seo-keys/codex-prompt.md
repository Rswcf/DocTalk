# Adversarial review — DocTalk Phase 2a: dedicated SEO keys for translated marketing pages

Review only. Do NOT edit files under frontend/. Codex cannot run git: the change is two commits on branch
`claude/frontend-design-review-c26fcb` -- `bf1e55e` (the SEO-key split) and `6163e9a` (landing headline
fixed in eight locales, which depends on it). Their combined diff is in `phase2a.diff` beside this file. Write findings to `.collab/reviews/2026-09-21-phase2a-seo-keys/findings-codex.md`.

## What it claims
The ten translated locales built `<title>` / `<meta description>` from the same i18n keys the page hero
renders (`createMarketingLocalePage({ titleKey, descKey })` pointed at `heroTitle`/`heroDescription`;
`app/[locale]/page.tsx` read `landing.headline`). Phase 2b will rewrite headlines, so metadata is moved onto
66 dedicated keys (`<ns>.metaTitle` / `<ns>.metaDescription`, plus `landing.meta*`), seeded in all 11 locale
JSONs from the values rendered today. The helper params are renamed `metaTitleKey`/`metaDescKey`.
Intended to be behaviour-neutral.

## Evidence supplied (verify, don't trust)
- `meta_before.tsv` / `meta_after.tsv`: every prerendered page's title, meta description, og:title,
  og:description (416 pages, 1,664 lines) from builds before/after; `meta.diff` is empty.
  `extract_meta.py` produced them; `migrate_meta.py` is the migration.
- `frontend/tests/seo-meta-keys.test.cjs`: the regression guard. 164/164 unit tests pass.
- End-to-end proof, from `6163e9a`: the landing h1 was changed in 8 locales, the build's rendered h1s
  show the new text, and a fresh metadata extraction is still byte-identical to `meta_after.tsv`.
  Check that claim holds, and review those 8 translations for accuracy and register.

## Attack these
1. **Is "behaviour-neutral" actually true?** Server `t()` resolves locale → English → key name
   (`src/i18n/server.ts`). The seeding copies a value only where the locale has the hero key. Is there any
   locale/key where `t(metaKey)` now differs from the old `t(heroKey)`? Does `extract_meta.py` miss any
   metadata surface — dynamic (ƒ) routes that are not prerendered, `twitter:*` tags, the OG image route,
   `alternates`/hreflang, or anything else built from these keys?
2. **Other consumers of the old keys.** Does anything else read the hero keys for metadata, sitemaps,
   JSON-LD, the OG image, or `buildMarketingMetadata`? Is the landing JSON-LD (`app/HomeJsonLd.tsx`) now
   inconsistent with the landing metadata in a way that matters?
3. **English.** The claim is that English pages hardcode metadata in each `page.tsx` and were never
   coupled. Check all of them, not a sample.
4. **The guard test.** Can a future page re-couple metadata and still pass? The third test forbids any
   file outside metadata code from containing a quoted `*.metaTitle` / `*.metaDescription` string — too
   broad (false positives) or too narrow (misses `t(\`${ns}.metaTitle\`)`, or keys built dynamically)?
5. **Locale JSON integrity.** 11 files gained 66 keys each: flat dotted keys only (a nested key breaks
   `next build`), no duplicate keys, ordering or encoding changes beyond the additions, no reformatting of
   untouched lines.
6. **Anything else** that would make shipping this unsafe.

## Output
Per finding: severity (BLOCKER / MAJOR / MINOR / NIT), file:line, the concrete failure scenario, and the
fix. Say briefly what you checked and found sound. End with one line: SHIP / SHIP-WITH-FIXES / DO-NOT-SHIP.
