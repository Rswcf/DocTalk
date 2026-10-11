# Parse v5 heading size rule — response to review round 4

Review: `2026-10-11-parse-heading-body-size-review-r4.md` (fresh-context Claude standing in for Codex; verdict
SHIP-WITH-FIXES, 1 MAJOR, 6 MINOR) of `cae9ff53`. The reviewer's candidate patches were applied, tests written for each,
and the corpus re-measured against `cae9ff53` and `main`.

| # | Sev | Status | Change | Evidence |
|---|---|---|---|---|
| R4-1 | MAJOR | Fixed (candidate H) | A run of ≤ 160 characters is "short" like a ≤ 3-line run: it counts as running text only with a partner run of its size. A 4-line title can no longer be its own page's body size. | 0 corpus change. Test `test_four_line_slide_title_is_not_the_page_body` (5 slides, 4-line 28pt title over four one-line points); mutation "H" killed by it. |
| R4-2 | MINOR | Recorded | Short broker notes whose document body is the 7pt appendix keep v3 behaviour on exhibit pages with a ≥ 2-line source note or a one-line comment. Plan §15 residuals. | — |
| R4-3 | MINOR | Fixed (candidate J, clustered) | The second look admits only sizes that are the first-look body size of ≥ 2 pages (size classes, not raw floats). | Corpus vs `cae9ff53`: +3 v3 KPI callouts on ASML p7, nothing else. Test `test_one_page_standfirst_size_is_not_a_body_size_for_the_second_look`. Two earlier tests rebuilt so their body size spans 2 pages (otherwise J made them vacuous: the mutation run caught it). |
| R4-4 | MINOR | Fixed (candidate K) | `run_chars` counts CJK, kana and hangul twice (the same weight as the shape guard). | 0 corpus change. Test `test_display_cap_counts_cjk_twice` (chart pages added so the median line is 6.5pt; without them the test passed without K). |
| R4-5 | MINOR | Fixed | Test `test_display_cap_counts_the_whole_run`; mutations "run_chars = longest line" and the first-look-document-body mutant (as a block replacement) added to the script. | 62 mutations, all killed; 3 accepted survivors unchanged. |
| R4-6 | MINOR | Fixed | Harness label `run-short` (a run removal whose whole run is ≤ 160 characters) joins the reading list; the second-look comparison with the document body size accepts the same size class, not only `>=` on raw floats. | 255 `run-short` removals on the corpus, read: table labels, short sentences, formula fragments, address lines. |
| R4-7 | MINOR | Fixed | Plan §15 is the final spec; §3 and §5 are marked superseded / prototype outcomes. Docstring says "v1-v4 behaviour". | — |

Corpus vs `main`: 47 PDFs, paragraph characters fell in 0; chicagofed 66.8% → 6.3%; 799 removals to read (run-short 255,
run-large 60, body-short 210, inherited 249, guard 25). Full unit suite 1196 passed, 138 skipped; `test_parse_service.py`
80 tests; ruff clean.

Open: F8 (version order with v4 — owner), R2-7 (not done), and the residuals listed in plan §15.
