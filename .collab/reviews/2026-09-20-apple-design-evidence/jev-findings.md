# Jev (TypeSafe System One) audit — above-the-fold grammar of all 40 public marketing routes
Run 2026-09-20. 40 requests, ~52k input tokens, cost ≈ $0.002.
Client: frontend/scripts/seo/jev_client.py (the one already built for the SEO harness).
Scripts: scratchpad/{extract_fold.py, jev_fold_audit.py, report_fold.py}
Full table: scratchpad/evidence/jev-fold-report.txt · raw: scratchpad/jev-fold-answers.json

## Method
Code fetched each route's PRODUCTION HTML, stripped nav/header/footer/script, and extracted the real
h1, eyebrow, first two paragraphs, section headings and the calls-to-action appearing before the third
h2. Jev judged only that extracted state — it never saw an opinion of mine. Four questions per route,
identical wording for every route so the numbers are comparable:
- `headline_apple_grammar` (Score 0-4) — distance from Apple's one-short-declarative-claim headline.
- `competing_actions` (Noul) — several next steps of similar weight near the top. High = bad.
- `prose_before_product` (Noul) — dense explanatory paragraphs before any demonstration. High = bad.
- `acquisition_weight` (Score 0-4) — how much the page matters to winning a paying customer.
Ranking policy (defect weighting, phase order) is plain Python in report_fold.py, NOT Jev — so it can
be retuned without re-running inference.

## Findings
1. **37 of 40 routes lead with explanatory prose before showing or inviting the product.**
   This is the most systemic defect on the marketing surface, and it is structural: it comes from the
   shared `EdPageHero` + `EdProse` kit, not from individual page authoring. Median prose score 0.67.
2. **Headline grammar averages 0.76 / 4.** 33 of 40 routes score below 2 — i.e. the headline is a
   keyword phrase or a long compound sentence, not a claim. The SEO page families are the worst:
   every `/compare/*` and `/alternatives/*` headline is a title, not a claim ("DocTalk vs ChatPDF:
   Full Comparison (2026)", "7 Best ChatPDF Alternatives in 2026").
3. **The landing page is the healthiest page they own** — defect 0.28, headline grammar 2.8/4, the
   best score on the site. This is important: the owner's dissatisfaction is very unlikely to be
   about the landing hero in isolation. The 38 SEO-driven pages behind it, built from the same kit,
   are where the surface actually falls apart.
4. **`/pricing` is the single highest-priority page**: highest commercial weight (4.0/4) combined with
   a long compound headline (1.1/4), competing actions (0.89) and prose-first structure (0.67).
5. **7 routes present competing top-of-page actions**: /pricing 0.89, /alternatives 0.86, /compare
   0.82, /features 0.78, /tools 0.74, /use-cases 0.56, /features/layout-translation 0.56.
   The index/hub pages are the offenders — they are link farms with no dominant step.

## Honest limits of this pass
- Jev judged TEXT STRUCTURE extracted from HTML. It did not judge colour, type, spacing, material or
  any rendered pixel — no claim here rests on Jev having seen the design.
- The authenticated surfaces (dashboard, document reader) are NOT in this table; they are behind auth
  and have no comparable extractable "fold". They were reviewed by direct observation instead
  (see visual-observations.md), and that difference in rigour should be stated in the plan.
- `acquisition_weight` is Jev's read of a page's commercial role from its own copy, not measured
  funnel data. Real funnel data exists in the admin analytics and would beat it.
