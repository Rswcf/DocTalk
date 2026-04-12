# 2026-03-15 Public i18n Review Findings

## Scope

Reviewed the public marketing shell and the SEO-oriented public-page changes added in the recent crawlability / interlinking pass, with emphasis on the homepage section shown in the screenshot and adjacent shared UI.

## Findings

### 1. Homepage "Explore by workflow" block bypasses i18n completely

- File: `frontend/src/app/HomePageClient.tsx`
- Severity: High
- Problem:
  - The `explorePaths` dataset and the section intro / footer links are hardcoded English strings.
  - This section sits on the homepage, which already participates in the locale switcher and already localizes the hero, showcase, FAQ, CTA, and footer-adjacent UI.
- User impact:
  - On non-English locales, the homepage becomes mixed-language.
  - The reported screenshot is a valid regression.

### 2. Public header and footer regressions bypass the translation layer

- Files:
  - `frontend/src/components/PublicHeader.tsx`
  - `frontend/src/components/Footer.tsx`
- Severity: High
- Problem:
  - Public nav labels, sign-in CTA, footer section labels, footer body copy, and many footer link labels are hardcoded English.
  - These are shared across public routes and are visible immediately after locale changes.
- User impact:
  - Every public page can show English navigation / footer content even when the user has selected another language.
  - This is a broad shell-level regression, not a one-off copy issue.

### 3. Blog UI chrome is locale-insensitive even when page content remains English

- Files:
  - `frontend/src/app/blog/BlogIndexClient.tsx`
  - `frontend/src/app/blog/category/[category]/CategoryClient.tsx`
  - `frontend/src/app/blog/[slug]/BlogPostClient.tsx`
- Severity: Medium
- Problem:
  - Category labels, empty-state text, related-navigation blocks, back links, TOC headings, and author CTA labels are hardcoded English.
  - Blog dates are formatted with `toLocaleDateString('en-US', ...)`, ignoring the selected locale.
- User impact:
  - Even if blog article bodies intentionally stay English, the surrounding chrome still feels broken for non-English users.
  - Date formatting is objectively wrong for locale-aware UI.

### 4. Public SEO hub pages are structurally English-only, but this should not be "half-fixed" in this pass

- Files:
  - `frontend/src/app/features/FeaturesHubClient.tsx`
  - `frontend/src/app/use-cases/UseCasesHubClient.tsx`
  - `frontend/src/app/compare/CompareHubClient.tsx`
  - `frontend/src/app/alternatives/AlternativesHubClient.tsx`
  - various public content detail pages under `frontend/src/app/features/*` and `frontend/src/app/use-cases/*`
- Severity: Medium, but strategic
- Problem:
  - Many full public SEO pages are entirely English, including page hero copy and CTA sections.
  - Some of the newly added interlink widgets inside these pages are also English-only.
- Recommendation:
  - Do **not** blindly translate isolated snippets on pages whose full body remains English. That creates mixed-language pages and masks the larger architecture gap.
  - Treat broad public-content localization as a separate project tied to locale-aware routing and SEO strategy.

### 5. No regression guard currently protects shared public i18n coverage

- Severity: Medium
- Problem:
  - Locale JSON completeness is currently good, but nothing prevents future shared-shell regressions from reintroducing hardcoded English in the same critical surfaces.
- Recommendation:
  - Add a lightweight automated check that asserts locale key coverage and catches locale-insensitive date formatting in the audited public UI files.

## Validation Snapshot Before Fixes

- `cd frontend && npm run lint`
  - Passes with pre-existing warnings unrelated to this review:
    - `src/app/collections/[collectionId]/page.tsx`
    - `src/components/Profile/ProfileInfoSection.tsx`
- `cd frontend && npm run build`
  - Passes
- Locale JSON completeness check vs `en.json`
  - All locale files currently contain the same key set as `en.json`

## Execution Boundary for This Pass

Immediate fix:

- Localize the homepage regression.
- Localize shared public shell text in `PublicHeader` and `Footer`.
- Localize blog UI chrome and make blog date formatting locale-aware.
- Add an automated regression check for locale coverage / locale-sensitive formatting.

Defer to a separate initiative:

- Translating every public SEO hub / detail page body.
- Locale-prefixed URLs and true multilingual SEO.
