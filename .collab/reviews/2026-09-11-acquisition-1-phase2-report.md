# Acquisition 1 — phase 2 structured-data report

Date: 2026-09-11. Implementation and in-session adversarial review: Codex.
Read first: `.collab/plans/2026-09-03-backlog-decision.md` §9.22 and §9.24.

## Result

All 22 requested paths now mount the same thin per-page `*JsonLd` resolver from their English and localized routes. Each resolver uses `getServerT(locale)` and the keys already rendered by its page. `MarketingPageJsonLd` serializes the resolved inputs; it does not infer FAQ key conventions. All 242 prerendered URLs (22 paths × 11 languages) passed DOM verification, including **770 exact FAQ question/answer pairs** and **33 exact HowTo steps**.

Both required gates passed: production build, including type/lint checks and 425 static pages; unit tests, **68 passed, 0 failed**. No git command, commit, deployment, backend edit, version bump, visible copy/layout change, or translation edit was performed.

## Source corrections to §9.24

The current source differs from the survey in three material details:

1. Citations already renders `featuresCitations.howTitle`, `howSubtitle`, and `howStep<n>Title` / `howStep<n>Desc`. All eight keys exist in **every one of the 11 locale files**. Its HowTo can therefore be rebuilt in all 11 languages, with no invented keys or English-only restriction.
2. The actual FAQ conventions are **8** pages using `faq<n>Question` / `faq<n>Answer`, **5** using `faq.q<n>` / `faq.a<n>`, **2** using `faq<n>Q` / `faq<n>A`, and **7** with no FAQ. Citations and multi-format use the Q/A spelling. Phase 1's `.faq.q<n>.question` / `.answer` convention remains covered by its unchanged resolver tests.
3. The 22-page set contains the features hub plus five feature details: citations, free-demo, multi-format, multilingual, and performance-modes. The six existing SoftwareApplication blocks are on those **five details plus `/pricing`**. `/features/layout-translation` has no corresponding rich EN schema and is outside this set; both its routes remain unchanged.

Also, `/tools` has an existing CollectionPage block in addition to BreadcrumbList. Its new resolver preserves CollectionPage, resolving its name/description from the rendered hero keys and localizing its URLs.

## Per-page FAQ conventions and descriptions

`n` runs from 1 through the listed count, in rendered order. Counts are identical in all 11 languages. Title, description, and breadcrumb labels also use each page's rendered keys. The description column is the Article description; for the six SoftwareApplication pages it is also the application description.

| Path | FAQ question / answer keys | Count | Description key | Additional blocks beyond Article/BreadcrumbList |
| --- | --- | ---: | --- | --- |
| `/alternatives` | None | 0 | `altsHub.subtitle` | None |
| `/alternatives/askyourpdf` | `altsAskyourpdf.faq<n>Question` / `faq<n>Answer` | 5 | `altsAskyourpdf.heroDescription` | FAQPage |
| `/alternatives/chatpdf` | `altsChatpdf.faq<n>Question` / `faq<n>Answer` | 5 | `altsChatpdf.heroDescription` | FAQPage |
| `/alternatives/humata` | `altsHumata.faq<n>Question` / `faq<n>Answer` | 5 | `altsHumata.heroDescription` | FAQPage |
| `/alternatives/notebooklm` | `altsNotebooklm.faq<n>Question` / `faq<n>Answer` | 5 | `altsNotebooklm.heroDescription` | FAQPage |
| `/alternatives/pdf-ai` | `altsPdfai.faq<n>Question` / `faq<n>Answer` | 5 | `altsPdfai.heroDescription` | FAQPage |
| `/compare` | None | 0 | `compareHub.heroDescription` | None |
| `/compare/askyourpdf` | `compareAskyourpdf.faq<n>Question` / `faq<n>Answer` | 4 | `compareAskyourpdf.heroDescription` | FAQPage |
| `/compare/chatpdf` | `compareChatpdf.faq.q<n>` / `faq.a<n>` | 5 | `compareChatpdf.heroDescription` | FAQPage |
| `/compare/humata` | `compareHumata.faq<n>Question` / `faq<n>Answer` | 4 | `compareHumata.heroDescription` | FAQPage |
| `/compare/notebooklm` | `compareNotebooklm.faq.q<n>` / `faq.a<n>` | 5 | `compareNotebooklm.heroDescription` | FAQPage |
| `/compare/pdf-ai` | `comparePdfai.faq<n>Question` / `faq<n>Answer` | 4 | `comparePdfai.heroDescription` | FAQPage |
| `/features` | None | 0 | `featuresHub.heroSubtitle` | None |
| `/features/citations` | `featuresCitations.faq<n>Q` / `faq<n>A` | 5 | `featuresCitations.heroSubtitle` | FAQPage, SoftwareApplication, HowTo |
| `/features/free-demo` | `featuresDemo.faq.q<n>` / `faq.a<n>` | 5 | `featuresDemo.hero.subtitle` | FAQPage, SoftwareApplication |
| `/features/multi-format` | `featuresMultiFormat.faq<n>Q` / `faq<n>A` | 5 | `featuresMultiFormat.heroSubtitle` | FAQPage, SoftwareApplication |
| `/features/multilingual` | `featuresMultilingual.faq.q<n>` / `faq.a<n>` | 4 | `featuresMultilingual.hero.subtitle` | FAQPage, SoftwareApplication |
| `/features/performance-modes` | `featuresPerformance.faq.q<n>` / `faq.a<n>` | 4 | `featuresPerformance.hero.subtitle` | FAQPage, SoftwareApplication |
| `/demo` | None | 0 | `demo.subtitle` | None |
| `/pricing` | None | 0 | `pricing.description` | SoftwareApplication |
| `/tools` | None | 0 | `toolsHub.heroLede` | CollectionPage |
| `/trust` | None | 0 | `trust.hero.lede` | None |

Every schema translation key was checked directly against each locale's JSON in a unit test that intercepts the real resolver calls. No emitted copy depends on `getServerT`'s English fallback. No new i18n key was required.

## Shared component and new block handling

`frontend/src/components/marketing/MarketingPageJsonLd.tsx` retains its Article, FAQPage, and BreadcrumbList behavior and adds optional typed `softwareApplication` and `howTo` inputs. Serialization still uses `JsonLdScript`. Site paths pass through `absoluteUrl(localizedHrefIfAvailable(locale, path))`; assets remain unprefixed. BreadcrumbList has **no `inLanguage`**. Article, FAQPage, SoftwareApplication, HowTo, and the tools CollectionPage carry the locale.

SoftwareApplication keeps `DocTalk`, `ProductivityApplication`, `Web`, localized application URLs, and numeric USD pricing. Descriptions now equal the existing rendered hero description in each locale. The application URLs preserve their original destinations: `/demo` for free-demo, `/pricing` for pricing, and `/` for the other four feature pages.

- Four feature pages retain the three Offer prices (0, 9.99, 19.99). The old hardcoded offer descriptions and names are omitted; no English credit/mode prose is copied.
- Free-demo retains its zero-price Offer. Its old hardcoded “Free Demo” name and English usage description are omitted.
- Pricing retains AggregateOffer with USD lowPrice 0, highPrice 19.99, offerCount 3, and all three individual prices. Offer names and descriptions come from the rendered `pricing.<free|plus|pro>.name` and `.summary` keys.
- The old English `featureList` arrays on citations and multi-format are omitted. They are optional and were not copied into other languages.
- Missing application input emits no SoftwareApplication. Absent/empty application description emits no description property, and this behavior is tested.

Citations HowTo uses the rendered section title/subtitle and exactly the three rendered step titles/descriptions. The old English summary and step prose are removed; its unrendered fixed `totalTime: PT1M` estimate is omitted. A missing name, empty step list, or any unresolved/empty step name/text suppresses the **whole** HowTo, never a partial block. All current locale inputs resolve, so every citations route emits it. Tests cover both complete localized steps and omission for incomplete inputs.

## Two defects resolved

### Pricing: fabricated FAQ removed

Removed the entire old FAQPage and its three hardcoded questions:

- “How do DocTalk credits work?”
- “Which plans include all AI modes?”
- “Can I try DocTalk before paying?”

Neither the English route nor any locale route emits FAQPage. No FAQ section was added. BreadcrumbList and SoftwareApplication remain. The built DOM verifier proves zero FAQ controls/panels and zero FAQPage blocks on all 11 pricing URLs.

### Citations: question rebuilt from the rendered key

The old “Does citation highlighting work with DOCX and PPTX?” string is removed. The English rendered key `featuresCitations.faq3Q` is **“Does it work with DOCX and PPTX?”**. This is a wording mismatch, not a reason to remove the rendered third FAQ: the resolver preserves all five rendered questions and resolves all five corresponding answers from `faq<n>A`.

The built output has exactly five FAQs in every language. All 55 citations FAQ pairs match the visible accordion text exactly, and the old unrendered question is absent from the emitted FAQPage.

## Built-output acceptance verification

Reproducible verifier: `frontend/scripts/verify-marketing-jsonld-phase2.py`.

```text
cd frontend
npm run build
python3 scripts/verify-marketing-jsonld-phase2.py
```

The verifier reads **only prerendered HTML**, from `.next/server/app/<path>.html` and `.next/server/app/<locale>/<path>.html`. It does not derive expected FAQ text from source or translation JSON.

It parses JSON-LD script contents separately, then obtains rendered question text from `button[id^="ed-faq-btn-"] .ed-h3` and rendered answers from the paired `div[id^="ed-faq-panel-"] p`. It checks the ARIA control/panel association and compares the resulting ordered question/answer tuples with FAQPage using exact string equality, without whitespace normalization. Text extraction excludes script, style, and template contents; JSON-LD and React hydration data cannot satisfy a visible-content check. Answers in the existing collapsed accordion panels are included as rendered accordion content.

For all 242 URLs it also verifies intended block types without duplicates, language attributes, the Article headline/description against the hero, page/asset URLs, and BreadcrumbList labels/URLs against the rendered `.ed-crumb` nodes. SoftwareApplication descriptions match rendered hero text; pricing offer names/descriptions match rendered headings/paragraphs. On citations, all three HowTo steps match the rendered step headings/body paragraphs in order, and its name/description match the section heading/paragraph. Tools CollectionPage matches the rendered hero and locale URL.

Locales checked: **en, zh, ja, ko, es, de, fr, pt, it, ar, hi**. This exceeds the requested English plus two other locales.

```text
PASS /alternatives: 11 locales, 0 FAQ pairs per locale
PASS /alternatives/askyourpdf: 11 locales, 5 FAQ pairs per locale
PASS /alternatives/chatpdf: 11 locales, 5 FAQ pairs per locale
PASS /alternatives/humata: 11 locales, 5 FAQ pairs per locale
PASS /alternatives/notebooklm: 11 locales, 5 FAQ pairs per locale
PASS /alternatives/pdf-ai: 11 locales, 5 FAQ pairs per locale
PASS /compare: 11 locales, 0 FAQ pairs per locale
PASS /compare/askyourpdf: 11 locales, 4 FAQ pairs per locale
PASS /compare/chatpdf: 11 locales, 5 FAQ pairs per locale
PASS /compare/humata: 11 locales, 4 FAQ pairs per locale
PASS /compare/notebooklm: 11 locales, 5 FAQ pairs per locale
PASS /compare/pdf-ai: 11 locales, 4 FAQ pairs per locale
PASS /features: 11 locales, 0 FAQ pairs per locale
PASS /features/citations: 11 locales, 5 FAQ pairs per locale
PASS /features/free-demo: 11 locales, 5 FAQ pairs per locale
PASS /features/multi-format: 11 locales, 5 FAQ pairs per locale
PASS /features/multilingual: 11 locales, 4 FAQ pairs per locale
PASS /features/performance-modes: 11 locales, 4 FAQ pairs per locale
PASS /demo: 11 locales, 0 FAQ pairs per locale
PASS /pricing: 11 locales, 0 FAQ pairs per locale
PASS /tools: 11 locales, 0 FAQ pairs per locale
PASS /trust: 11 locales, 0 FAQ pairs per locale
PASS: 242 prerendered URLs; 770 exact FAQ pairs; 33 exact HowTo steps; no FAQPage on pricing.
```

## Tests, adversarial review, and scope evidence

Extended `frontend/tests/marketing-jsonld.test.cjs` in its existing Node test / TypeScript transpilation style. The file now has 38 tests; the whole frontend unit suite has 68. New coverage exercises all 22 route pairs in all 11 languages, all phase 2 key spellings, localized or absent application descriptions, localized pricing offers, complete/incomplete HowTo input, both defect regressions, direct locale-key availability, and breadcrumbs without `inLanguage`. Existing phase 1 coverage still passes.

The generic-factory regression test now uses the untouched `/features/layout-translation` locale route, since Humata deliberately gains an override in phase 2. Built Japanese and German layout-translation output was also checked to remain Article-only.

The in-session adversarial pass checked scope leakage, stale English prose in schema, incorrect FAQ counts/conventions, schema matching its own script text, duplicate Article blocks, missing translation fallback, HowTo step drift, pricing's phantom FAQ, breadcrumb language/property domains, localized URL destinations, and static rendering. No unresolved finding remained.

A pre-edit SHA-256 inventory and saved route originals prove:

- Exactly **46 pre-existing frontend files** changed: 44 scoped route wrappers, the shared schema component, and the existing unit-test file. Added 22 thin resolvers and one standalone built-output verifier.
- All 22 EN metadata blocks and visible Content/Client mounts remain byte-identical. Each locale wrapper differs only by the resolver import and `JsonLd` override.
- All visible Content/Client files, all locale JSON, all use-case routes/resolvers (including lawyers), both layout-translation routes, `marketingLocalePage.tsx`, backend files, `version.json`, package files, and checked build/type configuration files retain their baseline hashes.
- EN routes remain static (`○`); locale routes remain SSG (`●`). No factory or translation-resolver behavior was changed.

## Gates

Both commands ran in `/Users/mayijie/Projects/Code/010_DocTalk/frontend` and exited **0**.

```text
$ npm run build
> doctalk-frontend@0.30.0 build
> next build
Next.js 14.2.35
✓ Compiled successfully
Linting and checking validity of types ...
✓ Generating static pages (425/425)
Finalizing page optimization ...
Collecting build traces ...
```

Non-failing notices: Sentry client-config deprecation, the edge-runtime static-generation notice, and missing local `RESEND_API_KEY` disabling the email magic-link provider.

```text
$ npm run test:unit
1..68
# tests 68
# suites 0
# pass 68
# fail 0
# cancelled 0
# skipped 0
# todo 0
```

Full local logs:

- `/private/tmp/doctalk-acquisition1-phase2-build.log`
- `/private/tmp/doctalk-acquisition1-phase2-unit.log`
- `/private/tmp/doctalk-acquisition1-phase2-html.log`

## Anything not done

No requested implementation, gate, or built-output verification remains incomplete. No new translation keys were needed. Review was performed in-session; a separate Claude cross-review was not run. Upload → chat → citation browser testing was not run because visible UI and application behavior were not changed; verification targets the requested marketing markup in the production build. Production deployment and search-engine ingestion were not performed or tested.
