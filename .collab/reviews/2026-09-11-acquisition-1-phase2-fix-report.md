# Phase 2 ItemList restoration — 2026-09-11

**PASS.** Restored ItemList on the five alternatives detail pages, in English and all 10 localized routes. Frontend schema markup and its verification only; no display JSX, copy, layout, translations, backend, version, other page, or `marketingLocalePage` changes. No git command, commit, or deployment was run.

Starting branch: `growth/acquisition-1`; HEAD: `b9c4bfd64878aede8b6acac1516ec1847044f440`. Read and SHA-1-verified repository objects with Python, without invoking git: all 636 tracked frontend files matched that revision before editing. Built this unchanged baseline before applying the fix, then rebuilt the final source. Branch and HEAD remain unchanged.

## Changes by file and line

- `frontend/src/components/marketing/MarketingPageJsonLd.tsx:20` adds optional `itemListItems` with `{ position, name, url }` entries. At `:112`, a nonempty array emits one ItemList with ListItem children; absent and empty arrays emit no block. Positions and resolved URLs pass through unchanged. ItemList has no `inLanguage`; existing schema branches are unchanged.
- Each resolver now owns its original alternatives array at line 9 and passes it through the shared component. Original product names, order, positions, and external URLs are preserved, including each page's existing ChatPDF hostname spelling. Only DocTalk's entry resolves to the locale homepage, matching the rendered DocTalk header link: `https://www.doctalk.site/`, `/ja`, `/de`, etc. No new translations or locale route edits were needed: EN and locale wrappers already use the same resolver.

| Resolver | Array location | Shared prop location |
| --- | --- | --- |
| `frontend/src/app/alternatives/chatpdf/ChatpdfAltsJsonLd.tsx` | `:9` | `:32` |
| `frontend/src/app/alternatives/askyourpdf/AskyourpdfAltsJsonLd.tsx` | `:9` | `:32` |
| `frontend/src/app/alternatives/humata/HumataAltsJsonLd.tsx` | `:9` | `:30` |
| `frontend/src/app/alternatives/notebooklm/NotebooklmAltsJsonLd.tsx` | `:9` | `:31` |
| `frontend/src/app/alternatives/pdf-ai/PdfAiAltsJsonLd.tsx` | `:9` | `:32` |

Removed unused arrays immediately before the page function, now at line 20 in each wrapper:

- `frontend/src/app/alternatives/chatpdf/page.tsx:20`
- `frontend/src/app/alternatives/askyourpdf/page.tsx:20`
- `frontend/src/app/alternatives/humata/page.tsx:20`
- `frontend/src/app/alternatives/notebooklm/page.tsx:20`
- `frontend/src/app/alternatives/pdf-ai/page.tsx:20`

Verification changes:

- `frontend/tests/marketing-jsonld.test.cjs:118` and `:287`: extend the vocabulary assertion to forbid `inLanguage` on both ItemList and BreadcrumbList. `:196` tests empty/absent ItemList omission; `:210` checks exact serialization of supplied positions, names, and URLs; `:278` expects ItemList only on the five alternatives detail routes across all 11 languages.
- `frontend/scripts/verify-marketing-jsonld-phase2.py:111`: update expected built schema types. `:122` enforces both vocabulary exclusions. `:141` checks ItemList count, fields, sequential positions, names against rendered page text and ranked H2 headings, order, and DocTalk's rendered homepage destination. The existing DOM parser excludes script, style, and template content from text comparisons.

## Built-output verification

Read actual final HTML from `frontend/.next/server/app/alternatives/<slug>.html` and `frontend/.next/server/app/<locale>/alternatives/<slug>.html`. Checked **all 11 locales**: en, zh, ja, ko, es, de, fr, pt, it, ar, hi. Every URL below emits exactly one **Article + FAQPage + BreadcrumbList + ItemList**, in that order:

| Detail page | EN | ja | de | All locales | Items per locale |
| --- | --- | --- | --- | --- | --- |
| `/alternatives/chatpdf` | PASS | PASS | PASS | 11/11 | 7 |
| `/alternatives/askyourpdf` | PASS | PASS | PASS | 11/11 | 7 |
| `/alternatives/humata` | PASS | PASS | PASS | 11/11 | 5 |
| `/alternatives/notebooklm` | PASS | PASS | PASS | 11/11 | 6 |
| `/alternatives/pdf-ai` | PASS | PASS | PASS | 11/11 | 7 |

All **352 ListItem entries on 55 URLs** match rendered product names and ranked heading order, with script/style/template content excluded. Emitted positions, names, and external URLs also match the original pre-fix arrays; DocTalk matches the rendered localized homepage link. No ItemList or BreadcrumbList carries `inLanguage` on any of the 242 phase-2 URLs.

For the other **17 phase-2 pages × 11 locales = 187 URLs**, compared the complete parsed JSON-LD payloads, including order and every property, against the freshly built, hash-verified `b9c4bfd` baseline. All are identical:

| Unchanged routes | Unchanged schema blocks |
| --- | --- |
| `/alternatives`, `/compare`, `/features`, `/demo`, `/trust` | Article + BreadcrumbList |
| `/compare/askyourpdf`, `/compare/chatpdf`, `/compare/humata`, `/compare/notebooklm`, `/compare/pdf-ai` | Article + FAQPage + BreadcrumbList |
| `/features/free-demo`, `/features/multi-format`, `/features/multilingual`, `/features/performance-modes` | Article + FAQPage + BreadcrumbList + SoftwareApplication |
| `/features/citations` | Article + FAQPage + BreadcrumbList + SoftwareApplication + HowTo |
| `/pricing` | Article + BreadcrumbList + SoftwareApplication |
| `/tools` | Article + BreadcrumbList + CollectionPage |

The five alternatives pages' preexisting Article/FAQPage/BreadcrumbList payloads are also identical to baseline in every locale. All **242 phase-2 URLs** retain identical rendered text after excluding scripts/styles/templates. The remaining **174 built HTML files** retain identical parsed JSON-LD too; **416 HTML files** were compared in total. The phase-2 verifier additionally passes all **770 exact FAQ pairs** and **33 exact HowTo steps**.

Focused adversarial checks covered missing/duplicate blocks, empty lists, unsupported vocabulary, changed product facts/order, accidental external URL localization, script self-matches, and changes to unrelated schemas. No findings remain. AST comparison confirms all five wrapper imports, metadata, and display JSX are unchanged, and every preexisting shared schema branch is unchanged. A final hash comparison across 1,843 tracked files found changes only in the 13 frontend files listed above; this requested report is the only added repository artifact.

## Gates and output

Both requested commands ran from `/Users/mayijie/Projects/Code/010_DocTalk/frontend` and exited **0**.

`npm run build`:

```text
> doctalk-frontend@0.30.0 build
> next build
▲ Next.js 14.2.35
✓ Compiled successfully
Linting and checking validity of types ...
Collecting page data ...
✓ Generating static pages (425/425)
Finalizing page optimization ...
Collecting build traces ...
```

The build printed the same existing Sentry config deprecation, edge-runtime static-generation notice, and missing local `RESEND_API_KEY` notice as the baseline build. No build, lint, or type errors.

`npm run test:unit`:

```text
1..69
# tests 69
# suites 0
# pass 69
# fail 0
# cancelled 0
# skipped 0
# todo 0
```

`python3 scripts/verify-marketing-jsonld-phase2.py` exited **0**:

```text
PASS: 242 prerendered URLs; 770 exact FAQ pairs; 33 exact HowTo steps; no FAQPage on pricing.
```

Full local evidence is retained under `/private/tmp/doctalk-itemlist-fix/`: `build.log`, `unit.log`, `phase2-html.log`, `built-audit.log`, `source-audit.log`, `scope-audit.log`, `built-baseline.json`, `source-baseline.json`, `changes.patch`, and the independent `audit-built.py` / `audit-source.cjs` checks. Baseline build output: `/private/tmp/doctalk-itemlist-baseline-build.log`.
