# Round 2 — confirm consensus on International SEO Phase B fixes

You reviewed Phase B and gave **SHIP-AFTER-MUSTFIX**
(`.collab/reviews/2026-05-24-i18n-phaseB-codex-review.md`). Claude applied fixes.
Verify each, check the changed code for fresh bugs, give a final verdict. Be
adversarial. You cannot run git. Updated diff:
`.collab/reviews/2026-05-24-i18n-phaseB-diff.patch`. Read the actual files.

## How each finding was addressed
- **[Must #1] descKey → non-existent keys.** Fixed the 6 flagged pages to the real
  hero lede/subtitle keys (toolsHub.heroLede, featuresHub.heroSubtitle,
  featuresMultiFormat.heroSubtitle, featuresCitations.heroSubtitle,
  useCasesRealEstate.heroLede, useCasesCompliance.heroLede). I ALSO validated all
  30 `app/[locale]/*/page.tsx` title/desc keys against `en.json` — all resolve now.
  Verify in the diff + a couple of `app/[locale]/.../page.tsx` files. (Verified:
  `/de/features/citations` meta description is real German, no raw-key leak.)
- **[Must #2] hard-coded English body prose.** Stripped the flourish/source clauses
  (the "Resources like <ext>…" pattern and trailing "It uses a RAG-based approach…"
  in compare pages) from all 14 affected `*Content.tsx`, keeping the translated
  sentences and the legitimate competitor-name links (chatpdf.com, humata.ai, …)
  whose anchor text is a proper noun followed by a `{t(...)}` description. Lawyers
  unified the same way (its Phase A tOr flourish removed). Verify no English prose
  islands remain and that I didn't drop translated content. (Verified: SEC EDGAR /
  "RAG-based approach" English gone on de pages; competitor links kept.)
- **[Must #3] hub detail links unprefixed.** Wrapped the template-literal hrefs
  (href={`/use-cases/${slug}`} etc.) with `href()` in all 4 hubs. (Verified:
  `/de/use-cases` links to `/de/use-cases/students`, no unprefixed leak.)

## Deliberately deferred (please confirm acceptable, not blocking)
- **[Should #4]** EdComparisonTable "Feature" header + EdInlineCell "Partial"/yes/no
  labels still come from `useLocale()` → English in initial SSR HTML, then
  self-correct after hydration (LocaleProvider.detectLocale is URL-aware since
  Phase A). Minor table chrome; planned as a follow-up (add label props).
- **[Q #5]** generic Article JSON-LD on hubs/tools/trust kept lean (not
  CollectionPage/WebPage).
- Carryover: Phase A `tOr` English-fallback keys (footer.tagline) still untranslated
  in the 6 locales.

## Scrutinize specifically
1. The flourish-removal regex — did it leave any malformed JSX (empty `<p>`, broken
   `<EdProse>`/`<a>`), or accidentally remove a TRANSLATED sentence or an internal
   `<Link>`? Check compare/humata, compare/notebooklm, compare/pdf-ai,
   use-cases/finance, use-cases/hr-contracts, lawyers.
2. The hub href() wrapping — correct for both the JSX-attr form (use-cases) and the
   object-property form (compare/alternatives/features)? Any other dynamic href
   (e.g. EdRelatedLinks, EdChoiceList) still unprefixed on a localized page?
3. Any OTHER `app/[locale]` page whose titleKey/descKey is wrong (I fixed 6 + claim
   all 30 validated — spot-check a few).
4. `next build` passes (263 static pages). Any remaining English-at-SSR body prose
   on a locale page besides the accepted #4/footer.tagline carryover?

## Output
Append a "## Round 2" section to
`.collab/reviews/2026-05-24-i18n-phaseB-codex-review.md`: per-finding
CONFIRMED/NOT-ADDRESSED, any NEW issues tagged [Must-fix]/[Should-fix]/[Nit], and a
final verdict SHIP / SHIP-AFTER-MUSTFIX / NEEDS-REWORK.
