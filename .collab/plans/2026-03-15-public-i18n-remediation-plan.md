# 2026-03-15 Public i18n Remediation Plan

## Goal

Fix the real regression the user reported without papering over the broader architectural debt.

This pass will make the homepage and shared public shell honor the selected locale, make blog UI chrome locale-aware, and add a regression check so the same class of bug is harder to reintroduce.

## Non-Goals

- Full translation of all public SEO landing pages and long-form content
- Locale-prefixed routing / `hreflang` / multilingual SEO architecture
- Rewriting English blog article bodies into every supported language

## Plan

### Phase 1. Centralize new shared-shell strings into locale resources

- Add new translation keys to `frontend/src/i18n/locales/en.json` for:
  - homepage "Explore by workflow" section intro, card titles / descriptions, and footer links
  - public header nav labels and sign-in CTA
  - footer body copy, section headings, and shared link labels
  - blog UI chrome:
    - category labels
    - blog index hero copy
    - "start with" / "continue from" panels
    - empty states
    - "back to blog", TOC labels, related-articles label, author CTA label
- Mirror the same keys into every supported locale JSON file:
  - `zh`, `es`, `ja`, `de`, `fr`, `ko`, `pt`, `it`, `ar`, `hi`
  - This pass will provide **actual translated values**, not English placeholders.
  - Translation quality target:
    - accurate product / navigation language
    - natural CTA wording
    - terminology consistency with existing locale files
  - If any phrase cannot be localized cleanly, prefer a simple direct translation over leaving English in place.

### Phase 2. Replace hardcoded shared UI with locale-aware rendering

- Update `frontend/src/app/HomePageClient.tsx`
  - Build `explorePaths` from `t(...)`
  - Replace section intro / footer link literals with `t(...)`
- Update `frontend/src/components/PublicHeader.tsx`
  - Build nav labels inside the component using `t(...)`
  - Localize the sign-in CTA
- Update `frontend/src/components/Footer.tsx`
  - Move shared link labels and description to locale keys
  - Keep href structure unchanged

### Phase 3. Make blog chrome locale-aware without pretending the article bodies are localized

- Update `frontend/src/app/blog/BlogIndexClient.tsx`
  - Localize category labels, hero copy, empty state, and interlink block
  - Use the active locale for date formatting instead of hardcoded `en-US`
- Update `frontend/src/app/blog/category/[category]/CategoryClient.tsx`
  - Localize category chips, panel copy, empty state, and CTA labels
  - Use locale-aware date formatting
- Update `frontend/src/app/blog/[slug]/BlogPostClient.tsx`
  - Localize back link, TOC labels, related-articles heading, category labels, and author CTA / box copy
  - Keep article Markdown content untouched
  - This phase is not required to fix the user-reported homepage regression, but it belongs in the same batch because the surrounding public chrome already participates in locale selection and the date-format bug is correctness-related, not cosmetic.

### Phase 4. Add a small regression check

- Add a lightweight Node validation script under `frontend/scripts/`
- The script should:
  - verify every non-English locale file contains all keys present in `en.json`
  - fail if locale-insensitive date formatting such as `toLocaleDateString('en-US'` is reintroduced in the audited public blog UI files
- Explicit limitation:
  - this check is intentionally narrow
  - it is a guard for locale coverage and the specific date-format regression class
  - it is **not** a comprehensive detector for every possible future hardcoded string in all components
- Run the script as part of manual validation for this pass

### Phase 5. Validate comprehensively

- Run:
  - `cd frontend && npm run lint`
  - `cd frontend && npm run build`
  - `node frontend/scripts/<new-check>.js`
- Add browser-level smoke validation:
  - start the frontend
  - verify the homepage block renders in at least one non-English locale
  - verify header / footer labels switch with locale
  - verify blog dates render in the active locale instead of always `en-US`

## Decision Notes

- I am intentionally **not** translating the full `/features`, `/use-cases`, `/compare`, and `/alternatives` page bodies in this pass.
- Reason:
  - those pages are structurally English-first today
  - translating only a few inserted SEO widgets would produce mixed-language pages and hide the bigger debt
  - the user-reported bug can be fully fixed without that distortion

## Exit Criteria

- The homepage block shown in the screenshot is translated when the locale changes.
- Public header and footer no longer show English-only shared shell copy on non-English locales.
- Blog UI chrome and blog dates follow the active locale.
- Locale files stay in sync and the new regression script passes.
- Frontend lint and build pass.
