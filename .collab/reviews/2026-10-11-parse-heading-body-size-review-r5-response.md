# Parse v5 heading size rule — response to review round 5

Review: `2026-10-11-parse-heading-body-size-review-r5.md` (fresh-context Claude standing in for Codex; confirmation round;
verdict SHIP-WITH-FIXES, no MAJOR) of `45d41dc9`. It confirmed every round-4 finding closed or recorded, the corpus record
reproducing exactly, and no exception or floor break on 600 random documents.

| # | Sev | Status | Change | Evidence |
|---|---|---|---|---|
| R5-1 | MINOR | Fixed (candidate M) | The second look also admits a size that holds ≥ 1,000 first-look running characters (`REF_SECOND_LOOK_MIN_CHARS`), so a one-page flash note's body size covers its exhibit pages; a cover standfirst (~250) still does not. Trade taken: ASML p7's three KPI callouts (v3 headings that J had brought back) are paragraphs again — body text on the target class weighs more than three callouts on a slide. | Corpus vs `45d41dc9`: only those 3 lines. Test `test_flash_note_with_one_text_page_keeps_exhibit_comments_body`. |
| R5-2 | MINOR | Recorded | Plan §15 residuals: in ≤ 4-page documents a cover standfirst's size can be the document body size (worse than v3, pre-existing since round 1, labelled `inherited`). | — |
| R5-3 | MINOR | Recorded | Plan §15 residuals: slides whose body is one ≤ 160-character bullet list (H) — constructed only. | — |
| R5-4 | MINOR | Fixed | Tests: a 4-line 60-character CJK display title stays four headings (K's lower side), two text pages at 9.98 / 10.0pt count as one body size (J on classes), the display base includes the dominant-size median. Mutations added for each and for M; the same-class clause is listed as an accepted (relabel-only) survivor. | `parse_heading_mutations.py`: 67 mutations, all killed; 4 accepted. |
| R5-5 | NIT | Fixed | Rules bullet says v3 (`main`); the Codex prompt no longer lists `_weighted_median`; plan §15 says "all pages with text", gives the heaviest-class fallback, M, and K's 80-CJK-character display bound; the harness's `body-short` uses H's definition of short. | — |

Corpus vs `main`: 47 PDFs, paragraph characters fell in 0; chicagofed 66.8% → 6.3%; 798 removals to read. Full unit
suite 1199 passed, 138 skipped; `test_parse_service.py` 83 tests; ruff clean.

For the owner's private-corpus run (from the review): compare against `main` AND `cae9ff53`, and read the `inherited`
removals on slides and short notes — R5-1/R5-3(b)-type shapes equal v3 and are invisible against `main` alone.

Open: F8 (version order with v4 — owner); R2-7 (not done); the residuals in plan §15.
