# Phase 2a review — findings (Fable 5.1, standing in for Codex)

*Saved verbatim by Claude from Fable's reply; the harness refused the subagent's own file write.*

**Verdict: SHIP-WITH-FIXES** — 0 BLOCKER, 1 MAJOR, 4 MINOR, 4 NIT.

Scope: `bf1e55e` (SEO-key split) and `6163e9a` (landing headline in eight locales), judged against the current tree (`989c70c`, v0.32.0 release commit; the Night work in between touched no metadata code). Review only; nothing under `frontend/` was edited. Every finding was verified against the code, not the diff summary.

The MAJOR changes no live page today; it is a coverage gap in the invariant this phase claims to establish. It does not block the push to `stable`, but the fix is ~50 mechanical lines that can be proved neutral by re-running `extract_meta.py`, and the v0.32.0 CHANGELOG line is false without it — land it before the push, or qualify the CHANGELOG line if the push goes first.

## MAJOR

### M1. `/use-cases/lawyers` is still coupled: its ten locale titles follow the hero, and the guard cannot see it

- `frontend/src/app/[locale]/use-cases/lawyers/page.tsx:16-17` — `title: t('useCasesLawyers.heroTitle')`, `description: t('useCasesLawyers.heroDescription')`; `:23-24` repeats both for Open Graph.
- No `useCasesLawyers.metaTitle` / `useCasesLawyers.metaDescription` exists in any of the 11 locale files (grep count 0 in all). `migrate_meta.py` derived keys only from `createMarketingLocalePage` call sites; this page predates the helper (Phase A, hand-written).
- `frontend/tests/seo-meta-keys.test.cjs:28` builds `helperCallers` by string-matching `createMarketingLocalePage`; `:31` asserts exactly 32; the loop at `:32` checks only those. A hand-rolled `generateMetadata` is invisible to the guard, so the test named "every localized marketing page…" covers 32 of 33 non-landing routes (`LOCALIZED_PATHS`, `i18n/routing.ts:31-66`, has 34 entries including `/`).
- The page also renders `useCasesLawyers.heroTitle` visibly (`use-cases/lawyers/LawyersContent.tsx:96-97`) and in JSON-LD (`LawyersJsonLd.tsx:24-25`) — those are by design; the metadata use is the bug.

**Failure scenario.** Phase 2b rewrites the lawyers hero (one of the four persona pages Q8 kept). The `<title>`, meta description, `og:*` and `twitter:*` of `/{zh,ja,ko,es,de,fr,pt,it,ar,hi}/use-cases/lawyers` silently change; unit tests stay green. Exactly the failure the split exists to prevent, on the page most likely to be rewritten first.

**Three artefacts overstate coverage:** `.claude/rules/frontend.md:45` ("Rewrite a headline freely now"); the `bf1e55e` message ("66 dedicated keys … for 32 routes" — there are 33); `CHANGELOG.md:27-30` (v0.32.0: "Translated marketing pages take their search title and description from dedicated keys, so a visible headline can change without moving the search title").

**Fix.** (a) Convert the page to `createMarketingLocalePage({ Content: LawyersContent, JsonLd: LawyersJsonLd, path: '/use-cases/lawyers', metaTitleKey: 'useCasesLawyers.metaTitle', metaDescKey: 'useCasesLawyers.metaDescription', keywords: [...] })` — identical output, since the helper makes the same `buildMarketingMetadata` call. (b) Seed the two keys in all 11 locales from each locale's current `useCasesLawyers.heroTitle` / `heroDescription` (same copy rule as the migration). (c) In the guard, replace the hard-coded 32 with a structural assertion: every `app/[locale]/**/page.tsx` other than `[locale]/page.tsx` must contain `createMarketingLocalePage`, i.e. `helperCallers.length === localePages.length - 1`. (d) Re-run `extract_meta.py`; the diff against `meta_after.tsv` must stay empty. (e) Correct the rule line and the CHANGELOG count/claim.

## MINOR

### m1. `marketing-jsonld.test.cjs` pins `metadata.title` to the hero key on two pages — a test that enforces the coupling the split removed

- `frontend/tests/marketing-jsonld.test.cjs:273` — `assert.equal(metadata.title, t('featuresLayoutTranslation.heroTitle'))`
- `frontend/tests/marketing-jsonld.test.cjs:293` — `assert.equal(metadata.title, t('useCasesFinance.heroTitle'))`

Both pass only because the seeded `metaTitle` values are byte-identical to the hero values. The first 2b rewrite of either hero (or a deliberate edit of either `metaTitle`) fails them, and the "obvious" repair — re-point `metaTitleKey` at the hero key — is the regression. The `bf1e55e` message cites this file only for the `Article.headline === EdPageHero.title` assertion; these pins were not disclosed. Loud rather than silent, hence MINOR.

**Fix.** Compare against `t('featuresLayoutTranslation.metaTitle')` / `t('useCasesFinance.metaTitle')`.

### m2. Guard test 3 is evadable by any non-literal key; test 1 does not tie a key to its page

- `seo-meta-keys.test.cjs:64` — `/['"][A-Za-z0-9]+\.meta(Title|Description)['"]/` matches only a single/double-quoted literal with the namespace inline. It misses `` t(`pricing.metaTitle`) `` (backticks), `` t(`${ns}.metaTitle`) ``, and `t(ns + '.metaTitle')`. A component can render a search title through any of these and stay green.
- `seo-meta-keys.test.cjs:38` — accepts any `*.metaTitle`; `metaTitleKey: 'useCasesFinance.metaTitle'` pasted into `[locale]/pricing/page.tsx` passes, and two pages share one search title.
- False positives: none today (the only quoted mentions in `src` are in allow-listed files; the `HeroSection.tsx:20-25` comment uses backticks).

**Fix.** Match `` ['"`] `` on both sides plus the bare suffix `` /['"`]\.meta(Title|Description)['"`]/ `` and `/\$\{[^}]*\}\.meta(Title|Description)/`; assert every `metaTitleKey` / `metaDescKey` value is used by exactly one page.

### m3. `landing.metaTitle` carries the hero's `\n` in all 11 locales; only one of the two metadata paths collapses it

- All 11 `landing.metaTitle` values contain a line break (seeded verbatim from the two-line h1; no other `*.metaTitle` / `*.metaDescription` does).
- `frontend/src/app/[locale]/page.tsx:23` collapses `\s*\n\s*` to a space; the helper path (`lib/marketingLocalePage.tsx:59`) does not. Copying the landing's seed pattern into a helper namespace ships a raw newline inside `<title>`.
- Visible today in the build (pre-existing, so behaviour-neutral, but now frozen into a dedicated SEO key): ja `<title>` = "あらゆるPDFと 瞬時にチャット | DocTalk" (a space inside Japanese — the h1 "stray space" fixed in this release is still in the `<title>`); de/pt `<title>` = "Jede Antwort zitiert die genaue Seite. | DocTalk" / "Cada resposta cita a página exata. | DocTalk" (trailing period before the separator, no document/PDF keyword).

**Fix.** Not in this release (it would break the "unchanged" proof). In 2b, deliberately rewrite `landing.metaTitle` per locale as a single-line SEO title — exactly the edit the split makes safe — and add a test that no `*.metaTitle` contains `\n`.

### m4. Landing search titles now differ in message across the 11 locales, and the difference is frozen

English `/` hardcodes "DocTalk — AI Document Chat with Cited Answers" (`app/page.tsx:8`); de/pt `<title>` carry the headline claim; the other eight carry the older "chat with any PDF in seconds" wording. Before 2a this drift was a side effect of the coupling; after it, it is the deliberate content of ten dedicated keys. Behaviour-neutral by construction — but 2b should decide the landing search title once and set all ten `landing.metaTitle` keys from that decision rather than inherit the accident.

## NIT

- **n1.** `seo-meta-keys.test.cjs:31` hard-codes `32`; a page deleted and another added nets to zero. Covered by M1(c).
- **n2.** `[locale]/page.tsx:14,39` — `getScopedMessages` seeds the `landing.` prefix, so `landing.metaTitle` / `landing.metaDescription` now ride in the client hydration payload (two strings). Harmless.
- **n3.** `en.landing.metaTitle` / `en.landing.metaDescription` are fallback-only: English `/` never reads them. Worth a one-line note in the helper docblock so nobody "fixes" the English title by editing them.
- **n4.** `extract_meta.py` captures `title`, `description`, `og:title`, `og:description` but not `twitter:title` / `twitter:description`, which the CHANGELOG's "Open Graph text is unchanged" claim implicitly covers. Derivation verified below; extend the script's `pats` so the proof is self-contained.

## Checked and found sound

**Attack 1 — behaviour-neutral.**
- Static proof independent of any build: for all 66 hero→meta pairs × 11 locales, `t(metaKey)` at `bf1e55e` equals `t(heroKey)` at `bf1e55e~1` under the server resolution rule (locale → en → key name): 0 mismatches. The keys added to each locale are exactly the 66-key mapping, so every locale had every hero key.
- Build proof: `meta_before.tsv` and `meta_after.tsv` are byte-identical (`cmp`). Re-running `extract_meta.py` against the worktree's current `.next` (BUILD_ID 20:12, 416 HTML pages) reproduces `meta_after.tsv` byte-for-byte. That build postdates `6163e9a` and predates `14b8889` (test comment + review doc) and `989c70c` (version files + CHANGELOG); neither touched `frontend/src`. I did not run `npm run build` because a `next start` process is serving from that `.next`.
- Other metadata surfaces: `twitter:*` derive from the same `titleText` / `description` in `lib/seo.ts:141-147`, and neither the helper, the landing nor the lawyers page passes a `twitter` override — spot-checked in built HTML for all 11 landing pages (`twitter:title` == `<title>`). `alternates.canonical` / hreflang are built from `path` + locale (`seo.ts:31-40,117-120`), not keys. `opengraph-image.tsx` / `twitter-image.tsx` are static edge images with no i18n. `keywords` are literals. JSON-LD reads hero keys, unchanged by the split.
- Dynamic routes: `[locale]/layout.tsx:14-18` sets `dynamicParams = false` + `generateStaticParams`, so every localized page is prerendered; the snapshot holds 34 × 10 = 340 localized rows plus 76 others, zero `<none>` cells.
- `phase2a.diff` equals `git diff db96b92 6163e9a` byte-for-byte; `db96b92` differs from the v0.31.0 tag only in a plan document, so the "before" snapshot is the production baseline.

**Attack 2 — other consumers.** Every reader of `*.heroTitle` / `*.heroDescription` outside the locale JSONs is a Content component (visible hero / breadcrumb), a JsonLd component, or a tools client — visible-by-design — except the lawyers page (M1). `landing.headline` is read only by `HeroSection.tsx:83`; `landing.description` by `HeroSection.tsx:221` (lede) and `HomeJsonLd.tsx:27` (WebSite / Organization / SoftwareApplication / HowTo description) — the same by-design "schema follows the visible page" rule the 32 helper pages follow, and today both descriptions are identical. `sitemap.ts` reads no keys. Nothing added after `6163e9a` (Night: `CitationField`, `citationFieldContent.ts`, the `HeroSection` rewrite, `landing-night.test.cjs`) reads a hero key for metadata or references any `*.meta*` key; the only `metaTitle` / `metaDescription` mentions in `src` outside locale JSONs are `[locale]/page.tsx:23-24` and two comments.

**Attack 3 — English.** All 54 non-`[locale]` marketing `page.tsx` files (about, alternatives ×6, blog, compare ×6, contact, demo ×2, features ×8, imprint, root `page.tsx`, pricing, privacy, terms, tools ×3, trust, use-cases ×10) export a literal `export const metadata`; none imports `i18n/server` or calls `t(`. The seven `page.tsx` files that import i18n (`auth/*`, `collections/[collectionId]`, `document-diff`, `shared/[token]`) are app/share surfaces with no hero keys. Enumerated, not sampled.

**Attack 4 — guard.** Green on the current tree (3/3); full unit suite 177/177 at HEAD. Holes are M1 (structural) and m2 (lexical); false-positive surface empty today.

**Attack 5 — locale JSON integrity.** `git diff --numstat bf1e55e~1 bf1e55e` is `66 / 0` for every one of the 11 files: pure insertions, no reformatting of untouched lines. At HEAD each file parses with a duplicate-key-rejecting hook, contains no nested value, has exactly one `"key":` line per parsed key, and ends in `}\n`. `6163e9a` changed exactly one line per file in eight files.

**Attack 6 — other.** The `6163e9a` end-to-end claim holds: the built h1 for zh/ja/ko/es/fr/it/ar/hi shows the new headline while the same build's `<title>` keeps the old wording. `HeroSection.tsx:83-86` splits on `\n` and joins with `''` for zh/ja on narrow screens, so the eight two-line values render correctly on phones. Version bump consistent at 0.32.0 across `version.json`, `frontend/package.json`, `package-lock.json`. Worktree clean apart from untracked `.claude/launch.json`.

## The eight headline translations (English: "Every answer cites the exact page.")

None is inaccurate; all eight carry the citation claim, keep one line break, and end with a full stop where the script uses one. The discriminating check is consistency with each locale's own page copy (`landing.description`, `landing.feature.citations.desc`), which sits directly under the h1.

| Locale | Text | Verdict |
|---|---|---|
| es | Cada respuesta cita / la página exacta. | Exact mirror. Keep. |
| fr | Chaque réponse cite / la page exacte. | Exact mirror. Keep. |
| it | Ogni risposta cita / la pagina esatta. | Exact mirror. Keep. |
| ko | 모든 답변이 / 정확한 페이지를 인용합니다. | Correct; formal-polite `-합니다` matches the ko page. Keep. |
| zh | 每个回答 / 都标出原文所在页。 | Idiomatic; "标出原文所在页" is more concrete than a literal "引用" and matches the zh citations copy. Keep. |
| ja | すべての回答が、 / 正確なページを引用。 | Correct, headline-style noun ending. "正確なページ" is a literal collocation; "出典ページを正確に引用。" or "該当ページを引用。" would read more naturally, but "正確な" keeps the "exact" claim. Optional, not a defect. |
| ar | كل إجابة تستشهد / بالصفحة الدقيقة. | Grammatical ("استشهد بـ" = cite). "الصفحة الدقيقة" is the literal "precise page"; the same page's citations copy says "الصفحة المحددة", though `landing.description` also uses "الدقيقة". **I would change it** to "كل إجابة تستشهد / بالصفحة المحددة." and align `landing.description` in 2b — or keep both as "الدقيقة"; the mismatch, not the word, is the issue. |
| hi | हर जवाब / सटीक पृष्ठ का हवाला देता है। | Natural and accurate ("हवाला देना" = cite; "सटीक पृष्ठ" matches the hi description). Register: the headline says "जवाब" (everyday), the rest of the hi page says "उत्तर" twice. **I would change it** to "हर उत्तर / सटीक पृष्ठ का हवाला देता है।" for consistency; "जवाब" is not wrong. |

Line-break placement is sensible in all eight; the hi first line is short (two words) but the alternative split would separate "का" from "हवाला देता है".

**SHIP-WITH-FIXES** — land M1 (lawyers page + structural guard) before the `stable` push, or ship as-is and qualify the v0.32.0 CHANGELOG line; m1/m2 with it or in the 2b branch; m3/m4 are 2b decisions.

---

## Resolution (Claude, 2026-09-21, before the v0.32.0 production push)

- **M1** — `app/[locale]/use-cases/lawyers/page.tsx` now goes through `createMarketingLocalePage` with
  `useCasesLawyers.metaTitle` / `metaDescription`, seeded in all 11 locales from each locale's current hero values
  (inserted after their hero keys, as the migration did). The guard is structural: every `[locale]` page except the
  landing must use the helper (proved sensitive: the old lawyers page has no helper call), each page owns its own
  keys, and the count assertion is gone. **Neutrality proof:** a fresh build's `extract_meta.py` output
  (`meta_after_m1.tsv`, 1,664 lines, 44 of them for `/use-cases/lawyers`) is byte-identical to `meta_after.tsv`
  and `meta_before.tsv`. The CHANGELOG line is now true as written; `rules/frontend.md` updated.
- **m1** — `marketing-jsonld.test.cjs` compares `metadata.title` with the pages' `metaTitle` keys.
- **m2** — the "never rendered" guard matches quoted, backticked and template-built keys (`${ns}.metaTitle`) after
  stripping comments; a planted `` t(`pricing.metaTitle`) `` probe in a component was caught, then removed.
- **m3, m4** — deferred to Phase 2b by design (they change search titles; this release must not).
- 178/178 unit tests, lint, tsc, build.

## Resolution 2 (Claude, 2026-09-22) — m3, m4, n3, n4

- **m3/m4** — the owner chose option B (`.collab/reviews/2026-09-21-v0.32-seo-impact.md`): every `landing.metaTitle`
  is stored on one line; de/pt carry the eight-locale "chat with any PDF in seconds" message in their own February
  translations; `en` (fallback-only) holds the English source of that message. Build metadata vs v0.32.0: exactly 9
  lines differ (`title`/`og:title`/`twitter:title` of `/ja`, `/de`, `/pt`). New guard in `seo-meta-keys.test.cjs`:
  no `*.metaTitle` / `*.metaDescription` contains a line break, in any locale.
- **n3** — the fallback-only note is in `lib/marketingLocalePage.tsx` and `app/[locale]/page.tsx` (`72034cb`).
- **n4** — `extract_meta.py` extracts `twitter:title` / `twitter:description` (`72034cb`); v0.31.0 vs v0.32.0 over all
  six fields was an empty diff.
