# Acquisition phase 1 — locale structured data — adversarial review

Branch `growth/acquisition-1`, off `main` @ `9f7dc7a`. Review `git diff 9f7dc7a..HEAD`.
Design authority: `.collab/plans/2026-09-03-backlog-decision.md` §9.6, §9.18, **§9.22** (read §9.22 —
it scopes this at source). **Frontend only, markup only.**

## Severity bar

**BLOCK only for:** emitting markup that misrepresents the page to a search engine (wrong language,
claims content that is not on the page, wrong canonical/URL), a build/runtime break, or a visible
change to copy or layout. Everything else is a note. **If sound, say SHIP plainly.**

## What this does

31 of 32 locale pages emit only generic Article while EN twins emit FAQPage/BreadcrumbList — 310 URLs.
Phase 1 adds `MarketingPageJsonLd` (generalising `LawyersJsonLd`, the one page already correct) and
wires the 9 `use-cases/*` pages, EN and locale routes alike.

Schema is **rebuilt from translation keys**, never copied from EN — every EN page hardcoded English
strings in its JSON-LD while rendering from `t()`, so copying would emit English markup on a Japanese
page. Three FAQ key conventions exist, so each page resolves its own.

## Attack these

1. **Does any page now claim content it does not render?** This is the whole point of the batch and
   the one thing that must be airtight, per locale. I verified the JsonLd resolves a subset of the
   Content's keys for all 9 pages; find a locale or a page where the emitted question/answer text
   differs from what the reader sees, or where a count differs (note `/use-cases/finance` renders a
   6th FAQ only for `en` and the schema is meant to mirror that).
2. **Language and URL correctness:** `inLanguage`, `mainEntityOfPage`, breadcrumb `item` URLs and any
   canonical must point at the *current locale's* page. A locale page pointing at the EN URL, or
   `inLanguage` left as `en`, is a BLOCK.
3. **Duplicate or conflicting markup:** does any page now emit two Article blocks, or both the new
   component and the old `MarketingArticleJsonLd` via the factory? Check `marketingLocalePage.tsx`
   for pages in and out of phase 1.
4. **Schema validity:** required properties present, no empty FAQ arrays emitted, no `undefined`
   leaking into JSON, correct nesting for `FAQPage`/`BreadcrumbList`.
5. **Out-of-scope leakage:** phase 1 must not have changed `compare/*`, `alternatives/*`,
   `features/*`, `/demo`, `/pricing`, `/tools`, `/trust`, or `/use-cases/lawyers` (the reference), and
   must not change any rendered copy or layout anywhere.

## Out of scope

- Phase 2 pages (they are deliberately untouched).
- The pre-existing i18n gap where `useCasesFinance.faq.q6.*` exists only in `en` — the page already
  conditions on it; the schema mirroring that is correct behaviour, not a defect to fix here.
- The cap/session work, backend, anything not JSON-LD.

## Gates Claude ran

| Gate | Result |
|---|---|
| `npm run build` | compiles (server components) |
| `npm run test:unit` | 44 passed (+14) |
| anti-drift check | all 9 pages: JsonLd keys ⊆ Content keys |

Do not run git. Write `.collab/dialogue/2026-09-10-acquisition-1-codex-r1.md`: verdict, then findings
with `file:line`, the concrete failing sequence, and a suggested fix.
