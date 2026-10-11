# Parse v5 heading size rule — response to review round 2

Review: `2026-10-11-parse-heading-body-size-review-r2.md` (fresh-context Claude standing in for Codex; verdict
SHIP-WITH-FIXES, 2 MAJOR, 5 MINOR) of `bc51e07b`. Every finding was re-run from the reviewer's scripts against the
working tree before and after the change; the candidate fixes' corpus effects were re-measured and matched the review's
numbers line for line. Corpus after the round: `2026-10-11-parse-heading-body-size-corpus.md`.

| # | Sev | Status | Change | Evidence |
|---|---|---|---|---|
| R2-1 (a) | MAJOR | Fixed | Fix A: a run counts toward a page's body size only with ≥ 2 lines that span 20% of the page. | JPM p18/p29: the four chart titles return (871 v3 → 869 v5; the other two are `guard` callouts). Also removes 20 body-size table captions in chicagofed and the 10-Q's repeated page header on 2 pages (both `inherited`, read). Test `test_chart_subtitle_over_an_axis_tick_is_not_a_paragraph`. |
| R2-1 (b) | MAJOR | Accepted loss, recorded | IR tile slides whose 2-line tile titles partner each other: plan §13 and the rules bullet record it. Constructed only; the round-1 alternative (W) added body headings on 3 real PDFs. | `g_tiles2`: v3 36, v5 4. |
| R2-2 | MAJOR | Fixed | Fix B: `HEADING_DISPLAY_FACTOR = 2.0`; the 4-line guard does not apply at ≥ 2× max(page body, both medians). Plan §8 risk 7 corrected (the 10-Q p52 1.75× stack stays guarded). | BIS WP 1325 cover title back (4 lines); no other corpus change. Test `test_four_line_display_title_is_not_a_paragraph`. |
| R2-3 | MINOR | Fixed | Fix E: a page still without a body size gets a second look in which a lone 2–3-line run counts if its size is another page's body size. | `g_single_run_body`: v3 98, r2 18, now 2 headings; the comment is back in chunk text. Corpus: `fed_feds_ai_coder` p57 `All Industries` returns (a v3 heading). Test `test_lone_comment_on_an_exhibit_page_uses_other_pages_body_size`. |
| R2-4 | MINOR | Fixed | Fix C: the dominant size is compared with the larger of the two medians. | `g_rule_floor_low`: 7 = v3 (was 13). 0 corpus change. Test `test_dominant_size_is_held_to_the_larger_median`. |
| R2-5 | MINOR | Fixed | Mutation script fails on a stale pattern and lists accepted survivors with reasons; patterns updated; new mutations for fixes A/B/C/E and the reviewer's survivors. The `run_len < 2` filter in `_running_text_chars` is now dead after fix A and was replaced by the off-axis test it stood for. | 50 mutations killed; accepted: reach over every line (cost only), doc-ref fallback = span-mean floor (differs only for drop-cap lines), extractor title ahead of the size tests (would change only the pre-existing every-page-title loss, a separate task). Tests: 3-line slide title, drifting sizes 10.0 → 10.7 → 11.5, short last line, kana / extension-A / compatibility ideographs (written as `\u` escapes: the editor had NFC-normalized U+F900 to U+8C48, so the first version of that test tested nothing). |
| R2-6 | MINOR | Fixed | Harness labels `run-large` (run removal at ≥ 1.5× its page body) and `body-short` (page body from 2–3-line runs only); both join the reading list in the harness and the rules bullet. | 601 to read on the corpus (118 + 212 + 246 + 25), read: see the corpus record. |
| R2-7 | MINOR | Not done | Computing `_prepare_blocks` once needs the worker to carry the list across its separately committed element and chunk stages; dense table pages stay ~2.5× v3. Recorded in plan §13. | — |

Round-1 items still open: F2(b) and F3(a) (v3 behaviour on a 1-page note with a long appendix whose exhibit comment
has fewer than 200 characters), F5 (Word "Double" spacing, v3 behaviour), F8 (version order with v4 — owner's call).

Full unit suite: 1187 passed, 138 skipped; ruff clean; `tests/test_parse_service.py` 71 tests.
