# Acquisition phase 2 — adversarial review

Branch `growth/acquisition-1`, HEAD `b9c4bfd`. Review `git diff 9625e4d..b9c4bfd`; phase 1 (`5497d6b`)
is already live and SHIPped by you. Design authority: `.collab/plans/2026-09-03-backlog-decision.md`
**§9.22 and §9.24**. **Frontend only, markup only.**

## Severity bar

**BLOCK only for:** markup that misrepresents the page to a search engine (claims content not on the
page, wrong language, wrong URL/canonical), a build/runtime break, or a visible copy/layout change.
Everything else is a note. **If sound, say SHIP plainly.**

## What this does

Completes the item: the remaining 22 pages (`alternatives/*`, `compare/*`, `features/*`, `/demo`,
`/pricing`, `/tools`, `/trust`) get locale-aware JSON-LD on both the EN and locale routes.
`MarketingPageJsonLd` gained `SoftwareApplication` and `HowTo`. Schema is rebuilt from each page's own
translation keys; three key conventions are in play.

**Two defects fixed rather than ported** (both were live on English pages):
- `/pricing` emitted a FAQPage claiming three questions that appear nowhere on it — hardcoded in
  `page.tsx`, absent from `en.json`, no FAQ section rendered. **Deleted.**
- `/features/citations` claimed one FAQ question that is not rendered. Removed by rebuilding.

## Attack these

1. **Any page claiming content it does not render, in any locale.** This is the acceptance property.
   I checked 66 FAQ/HowTo strings across en/ja/de on 8 pages from the built HTML with script blocks
   stripped and found 0 mismatches — cover the pages and locales I did not, and the Article
   `headline` / `SoftwareApplication.description` fields I deliberately did not treat as
   visibility-bound. Say so if you think they should be.
2. **`HowTo` on `/features/citations` is now emitted in non-English locales.** No new i18n keys were
   added, so it must be resolving from existing rendered keys. Verify the emitted steps are the
   translated steps the page actually shows — an English step on a Japanese page is a BLOCK.
3. **`SoftwareApplication`**: its `description` was English prose in the old EN-only markup. Confirm
   it is now localised or absent, never English-on-non-English. Check `offers`/pricing values are
   consistent with what `/pricing` renders — stale prices in markup are a misrepresentation.
4. **`/tools` now emits a `CollectionPage`, which was NOT in the spec.** I judged it well-formed and
   appropriate (localised name/description/url/inLanguage/isPartOf, no item list — which the type does
   not require). Challenge that: is the type right for this page, and does anything it asserts fail to
   match the page?
5. **`/pricing` deletion correctness:** confirm no FAQPage remains on either route, that
   BreadcrumbList and SoftwareApplication survive, and that nothing else regressed on a money page.
6. **Duplication / regression:** no page emitting two Article blocks or both the new component and the
   factory's generic Article; `marketingLocalePage` unchanged for anything out of scope; phase 1
   pages and `/use-cases/lawyers` untouched; no rendered copy or layout changed anywhere.

## Out of scope

- Phase 1 pages (live, already SHIPped by you) and `/use-cases/lawyers`.
- The pre-existing i18n gap where `useCasesFinance.faq.q6.*` exists only in `en`.
- Backend, sessions, caps — nothing outside marketing JSON-LD.

## Gates Claude ran

| Gate | Result |
|---|---|
| `npm run build` | compiles |
| `npm run test:unit` | 68 passed (+24) |
| built-output check (en/ja/de × 8 pages) | 66 emitted strings, 0 mismatches |
| i18n | no new keys; parity holds |

Do not run git. Write `.collab/dialogue/2026-09-11-acquisition-1-phase2-codex-r1.md`: verdict, then
findings with `file:line`, the concrete failing sequence, and a suggested fix.
