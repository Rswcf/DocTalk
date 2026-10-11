# Parse v5 heading size rule — response to review round 3

Review: `2026-10-11-parse-heading-body-size-review-r3.md` (fresh-context Claude standing in for Codex; verdict
SHIP-WITH-FIXES, 2 MAJOR, 5 MINOR) of `a9e8245d`. The reviewer's repro scripts (`scratchpad/review3/`, loading the
working tree) were re-run after the change; corpus effects re-measured against `a9e8245d` and `main`.

| # | Sev | Status | Change | Evidence |
|---|---|---|---|---|
| R3-1 | MAJOR | Fixed (reviewer's F1) | On the second look, a lone short run admitted only through another page's body size must not be over 1.25× the page's smallest run; the document body size is computed from first-look sizes only. | e1 deck 2 → 14, e2 cascade 17 → 32, e4 note 1 → 13 (= the code before the second look existed). 0 corpus change from this part. Tests `test_second_look_skips_a_title_over_the_pages_text`, `test_document_body_size_comes_from_first_look_sizes` (the latter checked against a hand-written mutant that counts second-look sizes in the document body size: it fails only that test; the first version of the test had a 135-character comment, under the 200-character minimum, and passed against the mutant — lengthened). |
| R3-2 | MAJOR | Fixed (B3, simplified) | The display exemption is now one rule: a run of ≥ 4 lines is exempt when the whole run is ≤ 160 characters and ≥ 1.5× max(page body, both medians). Round 2's unconditional 2× clause is removed: dropping it changes nothing on the 47 PDFs and is what R3-5 needed. `CleanBlock.run_chars` added. | BIS WP 1367 transplant: title back. Corpus vs `a9e8245d`: +21 v3 headings (ASML p2 and REIT p4 agenda rows, the 10-Q p52 header stack, a vertical Chinese cover label). Test `test_display_exemption_thresholds` (1.5 / 1.49×, 160 / 161 characters, median base). |
| R3-3 | MINOR | Fixed (reviewer's F2) | A second-look size below the document body size is ignored. Trade named by the reviewer: `fed_feds_ai_coder` p57 `All Industries` (a v3 heading restored in round 2) is lost again. Taken because the source-note shape is in nearly every broker note, the owner's target class. | e3 19 → 4. Test `test_second_look_does_not_lower_a_page_below_the_document_body`. |
| R3-4 | MINOR | Accepted, recorded | Fix A can raise a page's body size above a 1.4× heading (labelled `body`). Plan §14. | `a1`: v3 1, v5 0 with an intro page. |
| R3-5 | MINOR | Fixed | Follows from removing the unconditional 2× clause (R3-2): a long paragraph is never exempt. Agenda bullets on a chart-deck slide are headings, as in v3. | `b1(a)` 13 → 8 (= round 2). |
| R3-6 | MINOR | Fixed | Mutations added for the display factor (1.2, 1.6), the character cap (120, unlimited), the display base (page body only), F1, F2 and the second look on every page; stale patterns updated. | `parse_heading_mutations.py`: 57 mutations, all killed; 3 accepted survivors unchanged. |
| R3-7 | MINOR | Fixed | The corpus record names the five numbered sub-sections of `cn_guosen_oil_gas` lost at 1.15× (by design; v4's numbered rule). | Corpus record, `body-short`. |

Also: `_reference_sizes(per_page, sources)` reports each page's provenance (own / second / document / floor), so the
harness's `inherited` label now follows the parser exactly instead of re-deriving it.

Corpus vs `main`: 47 PDFs, paragraph characters fell in 0; chicagofed 66.8% → 6.3%; 583 removals to read (run-large 99,
body-short 210, inherited 249, guard 25). Full unit suite 1192 passed, 138 skipped; `test_parse_service.py` 76 tests;
ruff clean.

Still open: F8 (version order with v4 — owner), R2-7 (`_prepare_blocks` computed twice — not done), the accepted
residuals F2(b), F3(a), F5, R2-1(b), R3-4.
