# Acquisition 1 — locale structured data, phase 1

Date: 2026-09-10. Implementation and in-session adversarial review: Codex.
Design authority: `2026-09-03-backlog-decision.md` §9.22 (read first), §9.6 and §9.18; reference: unchanged `LawyersJsonLd`.

## Result and scope

The eight requested use-case detail pages now emit Article + FAQPage + BreadcrumbList in English and all ten URL locales. The `/use-cases` hub emits Article + BreadcrumbList, with no FAQPage. This upgrades 90 locale URLs; the complete EN/locale set is 99 URLs.

Both routes for each path mount the same page-specific `*JsonLd` component. English metadata is unchanged. The locale factory accepts an optional `JsonLd` component that replaces its generic Article output; callers without that option retain the original behavior. This avoids duplicate Articles and keeps phase 2 outside this change.

No git command was run. Read-only inspection of `.git/HEAD` and loose refs confirmed that the existing checkout is `growth/acquisition-1`, with both its ref and `main` at `9f7dc7acf0b108c6638a864ec885846f11bfd1e2`. No commit or deployment was performed.

## Shared component API

`frontend/src/components/marketing/MarketingPageJsonLd.tsx` is a synchronous server-side component taking:

```ts
{
  locale: string;
  path: string; // unprefixed page path
  title: string; // already resolved
  description: string; // already resolved
  faqItems?: { question: string; answer: string }[];
  breadcrumbs?: { label: string; path?: string }[];
  datePublished?: string; // defaults to 2026-02-18
}
```

Article uses the required title and description. FAQPage and BreadcrumbList are independently omitted when their arrays are absent or empty. A breadcrumb without a path has no `item` URL. All blocks carry `inLanguage: locale`; all site URLs go through `absoluteUrl(localizedHrefIfAvailable(locale, path))`. Assets and paths without localized routes stay unprefixed. Serialization uses the existing `JsonLdScript` component.

The helper performs no translation lookup or FAQ-key inference. Each page-specific component calls `getServerT(locale)` and passes resolved copy. Existing EN publication dates are retained and shared with the locale counterpart: February 18 for finance, students and HR; March 18 for compliance, consultants, healthcare, real-estate and teachers. The hub uses the February 18 default already used by its localized Article.

## Per-page keys

All breadcrumb labels use exactly the keys used by the visible breadcrumb; the hub's current label uses `footer.links.useCases`.

| Path | FAQ question / answer convention | Count | Article title / description keys |
| --- | --- | --- | --- |
| `/use-cases/compliance` | `useCasesCompliance.faq<n>Q` / `faq<n>A` | 5 | `useCasesCompliance.heroTitle` / `heroLede` |
| `/use-cases/consultants` | `useCasesConsultants.faq.q<n>.question` / `.answer` | 5 | `useCasesConsultants.heroTitle` / `heroDescription` |
| `/use-cases/finance` | `useCasesFinance.faq.q<n>.question` / `.answer` | EN 6; other locales 5 | `useCasesFinance.heroTitle` / `heroDescription` |
| `/use-cases/healthcare` | `useCasesHealthcare.faq.q<n>.question` / `.answer` | 5 | `useCasesHealthcare.heroTitle` / `heroDescription` |
| `/use-cases/hr-contracts` | `useCasesHr.faq.q<n>` / `.a<n>` | 4 | `useCasesHr.hero.title` / `hero.subtitle` |
| `/use-cases/real-estate` | `useCasesRealEstate.faq<n>Q` / `faq<n>A` | 5 | `useCasesRealEstate.heroTitle` / `heroLede` |
| `/use-cases/students` | `useCasesStudents.faq.q<n>` / `.a<n>` | 5 | `useCasesStudents.hero.title` / `hero.subtitle` |
| `/use-cases/teachers` | `useCasesTeachers.faq.q<n>.question` / `.answer` | 5 | `useCasesTeachers.heroTitle` / `heroDescription` |
| `/use-cases` | None | 0 | `useCasesHub.heroTitle` / `heroDescription` |

Source correction to the supplied convention inventory: compliance and real-estate use the additional `faq<n>Q` / `faq<n>A` spelling. No phase 1 page uses `faq<n>Question` / `faq<n>Answer`. That requested convention is tested by passing explicitly resolved `compareHumata` FAQ strings into the new helper and comparing them with the existing, untouched `HumataContent` FAQ props. Humata's routes were not wired into the helper or edited.

No i18n keys were added or modified. Every schema copy key exists directly in each applicable locale JSON; no fallback to English is needed.

## Finance drift resolution

The old English schema question, “Can AI summarize financial statement footnotes from 10-K filings?”, is removed. Schema now uses `useCasesFinance.faq.q6.question`, yielding the visible “Can DocTalk summarize financial statement footnotes from 10-K filings?”, and its paired answer key.

The visible `FinanceContent` includes q6 only when `locale === 'en'`. The schema preserves that condition and the visible order (q1–q5, then q6 in English). Thus schema types are identical across routes, while finance has six EN FAQ entries and five in each other language. Adding a sixth locale entry would describe content absent from the page and violate the markup-only constraint.

All eight old hardcoded FAQ arrays and inline schema blocks were removed. Page-specific schema titles, descriptions, questions, answers and breadcrumb labels now come from translation keys. The remaining fixed values are schema structure, brand identity, paths and publication dates; existing English metadata copy was preserved.

## Verification and adversarial review

Added `frontend/tests/marketing-jsonld.test.cjs` following the existing Node test + TypeScript transpilation style: 14 tests exercising real route functions, translation loading, URL helpers and JSON-LD serialization. Unrelated presentation boundaries are stubbed for prop inspection; the real `EdFaqList` is also rendered with both visible and schema-derived items.

Coverage includes:

- All nine paths across all 11 languages: identical schema types, no duplicate Article, locale-correct URLs and `inLanguage`, titles/descriptions matching hero props, breadcrumb text/URLs matching visible props, and exact FAQ questions and answers matching `t()` output.
- The three requested key conventions plus the additional Q/A spelling found at source.
- Finance's corrected question and EN-only sixth FAQ; the hub's missing FAQ; omitted/empty optional arrays; unavailable localized paths and unprefixed asset URLs.
- The factory's unchanged generic Article default on the real Humata locale route, and preserved metadata/invalid-locale handling with an override.

An additional inspection parsed the actual production HTML generated by Next for all 99 URLs. All 430 FAQ question/answer pairs exactly matched the visible DOM. Schema types, `inLanguage`, Article headlines and page URLs also matched. Built `/ja/compare/humata` still emits only the generic Article.

The adversarial pass checked duplicate scripts, locale fallback, finance's conditional content, breadcrumb destinations, untranslated copy, date parity, preservation of static rendering, and scope leakage. A before/after SHA-256 inventory found exactly 19 changed pre-existing frontend files (18 route wrappers plus the factory), with 11 new frontend files (the shared component, nine page-specific schema components and the test file). Visible Content files, all locale JSON, lawyers, phase 2 source files, backend files, version files and package files retain their original hashes. English metadata blocks also compare unchanged. No unresolved implementation finding remained.

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

The affected EN routes remain static (`○`); their locale routes remain SSG (`●`). Non-failing build notices: Sentry client-config deprecation, an edge-runtime static-generation notice, and absent local `RESEND_API_KEY` disabling the email magic-link provider.

```text
$ npm run test:unit
1..44
# tests 44
# pass 44
# fail 0
# cancelled 0
# skipped 0
# todo 0
```

Full local gate logs: `/private/tmp/doctalk-acquisition1-build.log` and `/private/tmp/doctalk-acquisition1-unit.log`.

## Limits

No backend work, migration, version bump, visible copy/layout change, or new translation key was needed. No requested implementation or gate remains blocked. Review was performed in-session; a separate Claude cross-review was not run. Browser upload → chat → citation testing was not run because this batch changes only marketing structured data; the production HTML inspection covers the changed output. Search-engine ingestion and production deployment were not tested or performed.
