> **This is a fresh-context Claude review standing in for the Codex adversarial review. It is not a Codex review.** Codex CLI and OpenAI credentials were unavailable in this cloud session. The owner should still run the real Codex pass locally (`2026-10-11-parse-heading-body-size-codex-prompt.md`, as round 2).

# Parse v5 heading size rule: adversarial review, round 2

**Date** 2026-10-11 · **Branch** `claude/sharp-feynman-4vqkq2` @ `bc51e07b` (round 1 reviewed `780c2131`; base `main` `d46fc222`) · **Reviewer** Claude, fresh context. I did not design or write the change or the round-1 fixes.

## Method

I loaded three copies of `parse_service.py` side by side:
- `main` (v3)
- `780c2131` (r1)
- the working tree (v5)

I ran them on:
- synthetic `PageInfo` lists;
- PDFs built with PyMuPDF;
- the 33 public PDFs, the 11 synthetic PDFs and the 3 seeds, a sweep of 47 documents (v3, r1 and v5).

Mutations ran against a scratch copy of `backend/`, never the repo.

The scripts are in `scratchpad/review2/`. Each finding below spells out the essential input inline.

**Baseline**
- `tests/test_parse_service.py`: 63/63 pass.
- `test_demo_seed_storage.py` + `test_parse_worker_batching.py`: 53 pass / 5 skipped.
- `test_parse_worker_bridge.py` + `test_url_extractor.py`: 36 pass.
- `ruff`: clean on the three changed files.

## Verdict: SHIP-WITH-FIXES

The round-1 fixes work for the cases that were reported:
- F1: slide and cover titles are back.
- F2(a): the chart book is back below 25 % text pages.
- F3(b): the double-spaced document is back.
- F4: CJK titles are back.
- F7: the non-PDF path is back.

The floor gate keeps the size rule from turning body text into headings beyond v3, with one exception I could only construct (R2-4). No crash or timeout path was found.

Two MAJOR findings remain. In both, a real title that v3 found is lost in a public corpus PDF, and the harness label marks the line as "expected", so the acceptance reading skipped it:
- **R2-1**: same-size short runs validate each other as "running text". Seen in JPM *Guide to the Markets* and in a constructed IR tile slide.
- **R2-2**: the 4-line run guard drops a 4-line display title. Seen on the BIS WP 1325 cover. This contradicts plan §8 risk 7.

R2-2 has a one-line fix that I measured as clean. R2-1 has a measured partial fix plus a design question.

## Round-1 findings re-run on `bc51e07b`

| r1 | Status | Evidence (repro re-run against the working tree) |
|---|---|---|
| F1 wrapped title sets its own page reference | **CLOSED** for the reported shapes. A residual remains: see R2-1. | `f_slide_title_clean`: v3 6 / r1 0 / v5 6. `f_slide_title`: 15 / 0 / 15. `f_wrapped_title_sets_ref`: 7 / 5 / 7. |
| F2(a) one text page sets the chart book's body | **CLOSED** below 25 % text pages, by design at or above 25 % (see "Checked"). | `f_docref_one_page`: 21 / 1 / 21. |
| F2(b) short note + long 7 pt appendix | **OPEN**, same as v3 (as the response says). The F1 fix widens it: see R2-3. | — |
| F3(b) small whitespace spans turn body into headings | **CLOSED** | `f_ws_spans_double`: v3 3 headings / 7 chunks, r1 63 / 0, v5 3 / 7. |
| F3(a) footnote-marked body line added | **OPEN**, a residual the response accepts. A second path in the opposite direction: R2-4. | `f_dominant_add`: v5 still adds `the period1 and we expect a further rise next quarter`, which is absent from v5 chunk text. |
| F4 CJK digit guard | **CLOSED** | `f_cjk_digits2`: all four titles kept (`3、2026年展望`, `2025Q3业绩点评`, `2026年3月期決算`, `2026년 전망`). The cn_swsc cover title is back (r1→v5 +1). |
| F5 double spacing forms no runs | **OPEN by decision.** The claims in the plan and rules are corrected. | `f_double_spacing` at 2.3×: 72 / 72 / 72, the same as v3. |
| F6 cost | **PARTLY CLOSED.** See R2-7. | 3,301-line page with a 72 pt watermark: r1 859 ms → v5 148 ms/page (v3 60). |
| F7 non-PDF path | **CLOSED** | See "Checked": 400 random extractor documents give identical headings in v3 and v5. |
| F8 version number vs v4 | **OPEN**, the owner's call. | `PARSE_PIPELINE_VERSION = 5`. v4 is still not merged. |
| F9 mutation survivors | **CLOSED with caveats.** See R2-5. One harness mutation was never applied. | — |
| F10 the metric cannot see heading loss | **PARTLY CLOSED.** The labels exist, but `run` and `body` hide real title losses (R2-1, R2-2), and only `inherited` and `guard` were read. | — |

What changed between r1 and v5 on the 47 PDFs (r1 → v5):
- `fed_feds_ai_coder`: +4 / −1
- `slides_asml`: +7
- `slides_ms_4q25`: +11
- `cn_swsc`: +1

Every line that moved was a v3 heading. No v3 → v5 addition exists outside the 11 REIT tile titles that the corpus record lists.

---

## Findings

### R2-1 · MAJOR · Short runs of the same size validate each other, so a page body can be set by subtitles or tile titles (the F1 residual)
`backend/app/services/parse_service.py`:
- `:925-928`: overlap is measured against the *narrower* line, so a 3 %-wide tick label joins a wide line's run.
- `:985-993`: a run of ≤ 3 lines counts as running text when *any* other run of its size exists on the page.

The F1 fix treats a lone short run as a title and a partnered one as body. Two geometries break that assumption.

**(a) Public corpus, `jpm_guide_to_markets_us` p18 and p29.** Each page has two charts, laid out as:
- an 11.79 pt chart title (`Nonfarm payroll gains`, `Civilian unemployment rate and annual wage growth`);
- below it, a one-line 9.59 pt subtitle (42 % of the page width);
- below that, the axis's top tick (`1,000`, `16%`, 8.85 pt).

The mechanism:
1. 9.59 and 8.85 pt are within the 8 % tolerance, and the tick sits within one line height under the subtitle, so each subtitle becomes a "run of 2".
2. The two subtitles then partner each other. Running chars are `{9.59: 135, 8.04: 122}`, so the page reference is 9.59.
3. The chart titles would need > 11.98 pt and are lost.

v3 finds them through its floor (8.04 pt, threshold 10.05). p29 is the same, with `Retail gasoline prices` 11.16 pt over a 9.07 pt subtitle and a `$5.25` tick.

The cost:
- 4 chart titles are lost in JPM (871 → 865 overall).
- The first paragraphs of p18 lose `Civilian unemployment rate and annual wage growth` as their `section_title`.
- JPM is on the plan's own no-regression list (§7.3, "within ±1 heading").
- The harness labels these lines `body` ("the expected reason"), so they were never read.

**(b) Constructed, `g_tiles2.py`.** An IR deck of 4 slides at 960×540. Each slide has:
- a 28 pt one-line title;
- 2×2 tiles, each with a 2-line 16 pt tile title (`Data center leasing hit a record` / `in the second quarter of 2026`) over 2 lines of 12 pt tile text;
- ten short 8 pt footnotes.

Result:
- The four 2-line tile titles partner each other and hold 37 % of running text, so the page reference is 16.0.
- v3 finds 36 headings (floor 12, so 16 > 15); r1 and v5 find 4.
- All 32 tile-title lines are lost, and each tile's text is cited under the slide title.

**Fix candidate A (measured; partial).** In `_running_text_chars`, drop runs with fewer than 2 lines that pass the extent filter *before* the partner check. One wide line plus short labels is not a paragraph.

Results on the 47 PDFs:
- **jpm**: +4 (the four chart titles, v3 had them).
- **chicagofed**: −20 (`Table 21: … (2030)` … `Table 43: …`, 12 pt captions in a 12 pt-body document; the design already treats body-size captions as non-headings elsewhere in the same document as `inherited`).
- **control_ms_10q**: −4 (page-header lines `Notes to Consolidated Financial Statements` / `(Unaudited)` on p46 and p73).
- Paragraph characters below v3 in 0 PDFs; 63/63 tests pass.

Fix A does not repair (b). Tiles need a design choice, such as the reviewer's candidate W, which added body headings on 3 PDFs in round 1.

**Required:** apply A (or something equivalent) and either fix (b) or record it in plan §8. Also extend the harness reading rule (see R2-6).

### R2-2 · MAJOR · The 4-line run guard drops display titles that wrap to 4 lines; plan §8 risk 7's claim is contradicted by the corpus
`parse_service.py:1064-1065`. Plan `:245`: "Rare (paper titles wrap to ≤ 3 in both corpora)".

**Input (public corpus, `bis_wp1325_ai_adoption_european_firms` p1).** The BIS working-paper cover sets the title in a column 41 % of the page wide, at 21.96 pt:

```
AI adoption, productivity
and employment:
evidence from European
firms
```

The four lines are one run (`run_len = 4`). The page reference is 9.96 (from the by-line and JEL runs), so the title is 2.2× the page body. The floor is 10.91.

Output:
- v3: all four lines are headings.
- v5: all four are paragraphs.
- Paragraph `section_title` on p1 changes from {`Monetary and Economic Department`, `firms`} to {`BIS Working Papers`, `Monetary and Economic Department`}.
- The harness labels the lines `run`, which is not in the reading list.

Every BIS WP whose title runs over about 75 characters has this cover layout.

A second instance, `control_ms_10q` p52:
- The 12 pt page header (`Notes to Consolidated Financial Statements`, `(Unaudited)`) and the note heading (`6. Derivative` … `Activities`) stack into one run of 5, at 1.75× the page body.
- `Derivative` and `Activities` stop being headings while `Instruments`, `and`, `Hedging` (same line, laid out as separate words) stay headings.

**Fix candidate B (measured, clean).** Only guard runs that are not far larger than the page:

```python
rule_size = self._rule_size(block)
if block.run_len > self.HEADING_MAX_WRAP_LINES and rule_size < 2.0 * max(reference_size, *floors):
    return False
```

On the 47 PDFs the **only** change is that the four BIS title lines return. Paragraph characters below v3: 0 PDFs. Tests: 63/63.

The 1.4× 4-line standfirst in `test_wrapped_heading_up_to_three_lines` and S7 is still guarded. B does not cover the 10-Q stack (1.75×). Lowering the bar to 1.5× would also restore TOC/agenda rows on the ASML p2 and REIT p4 slides and KPI tiles on ASML p7, so 2.0 is the measured choice.

Also correct risk 7 in the plan.

### R2-3 · MINOR · The F1 fix strips the body size from a page whose only paragraph is one 2–3-line run, which re-breaks a target-class page that r1 fixed
`parse_service.py:990-993`, `:1035-1037`.

**Input (`g_single_run_body.py`, real PDF built with PyMuPDF).** A broker note of 10 pages:
- 2 pages of 40 × 10 pt body lines with a 16 pt title.
- 4 exhibit pages, each with a 12 pt `Exhibit k: DRAM contract prices`, 25×6 cells at 6.5 pt, and **one 3-line 10 pt comment** (≈ 240 characters).
- 4 pages of 80 × 7 pt disclosures.

The comment is a lone run of 3, so it no longer counts. The exhibit page has no body size of its own. The 7 pt class holds 4/10 pages, so the document body is 7 and the exhibit page inherits it.

Output:

| | v3 | r1 | v5 |
|---|---:|---:|---:|
| Headings | 98 | 2 | **18** |

On every exhibit page, the three comment lines are headings again, and `DRAM contract prices rose for a fourth straight quarter …` is absent from v5 chunk text.

This is the same as v3, so it is not a regression by the scale in the brief. But it is the target class (short broker notes with long disclosure appendices), and r1 had returned this text to chunks.

**Fix candidate E (measured).** After the first pass, re-run `_running_text_chars` for pages without a body size. On that pass, a lone short run counts when its size is another page's body size. Wrapped titles are larger than any page's body, so they still do not count.

Results:
- **47 PDFs**: one change, `fed_feds_ai_coder` p57 `All Industries` returns (a v3 heading).
- **`g_single_run_body`**: 18 → 2 headings.
- **r1 repros**: still 6/6, 7/7 and 21/21.
- **Tests**: 63/63.

### R2-4 · MINOR · The "either unit" floor gate admits body that v3 kept when the rule-size floor sits below the span-mean floor
`parse_service.py:1069-1071`. `.claude/rules/backend.md:46` says: "the size rule never adds a heading v1–v4 lacked except where a pulled-down span mean hid it".

Fix D assumed that dominant ≥ mean. When most lines carry a *larger* span with few characters, the mean exceeds the dominant, and `rule_floor < font_floor`. A larger trailing space after small cell text, or a large legend-marker glyph, does this.

**Input (`g_rule_floor_low.py`, real PDF, constructed).**
- Page 1: 30 × 10 pt body lines.
- Pages 2–7: 50×6 table cells, each `"12.3"` at 7 pt followed by a `" "` span at 12 pt (span mean 9.5, dominant 7), plus a 9 pt `Source: Company filings, FactSet, Bloomberg and our estimates`.

Floors are (9.5, 7.0). The table pages have no body size and the document has none (1/7 text pages).

Output:
- v3: the source lines are body (9 ≤ 11.9).
- v5: 9 > 8.75 in rule units, so six `Source:` lines become headings and leave chunk text.
- Paragraph characters fall by 366.

No corpus PDF has `rule_floor < font_floor` (three have it the other way round), so this is constructed only.

**Fix C (measured, 0 corpus change):** `rule_size <= max(rule_floor, font_floor) * F`. It is identical wherever `rule_floor ≥ font_floor`, so the 47 PDFs are unchanged. It removes the 6 additions and passes 63/63 tests.

### R2-5 · MINOR · The mutation evidence overstates coverage, and new survivors exist
`.collab/scripts/parse_heading_mutations.py:44`, `:67-68`. Corpus record `:192-193`. Response F9.

The `running text run>=1` pattern still contains the `b.off_axis or` that round 1 removed. The script prints `!!` and `continue`s without counting it, so `survivors: []` and "all 40 killed" are true of 39. Notably, this skipped mutation is the reviewer's own r1 survivor (`_running_text_chars` without `run_len < 2`). With the pattern updated it *is* killed (by `test_small_whitespace_spans_do_not_turn_body_into_headings`), so the coverage claim holds, but the harness should fail on a missing pattern.

These mutations of the round-1 code survive all 63 tests (`mutate_r2.py`):
- a lone **3**-line run counts (`run_len < 3`);
- the `extractor_title` exemption is moved ahead of the size checks (DOCX/MD titles become headings even when every page has one, which differs from v3);
- the size chain is anchored at the group's first size instead of its last, which splits drifting OCR sizes;
- run overlap is measured against the wider line, which breaks short last lines of paragraphs;
- kana or CJK extension-A weights are dropped;
- the doc-ref fallback is `floors[0]` instead of 0;
- reach is taken over all lines (cost only, an equivalent mutant).

### R2-6 · MINOR · The acceptance reading rule skips the labels where R2-1 and R2-2 hide
`.collab/scripts/parse_heading_corpus.py:21`, `:98-106`, `:227`. `.claude/rules/backend.md:46` ("read every removed heading it labels `inherited` or `guard`").

`body` assumes the page reference is right, and `run` assumes a 4-line run is a paragraph. Both assumptions fail above.

Two cheap additions would have caught every instance in this review:
1. Read `body` removals on pages whose reference class comes only from runs of ≤ 3 lines. On the 47 PDFs that is 15 pages and about 230 lines, and it includes JPM p18/p29.
2. Read `run` removals whose size is ≥ 1.5× the page reference. That is 35 lines: the BIS title, the 10-Q stack, and agenda, TOC and KPI rows.

### R2-7 · MINOR · Cost is still 2–3× v3 on dense table pages, and `_prepare_blocks` runs twice
`parse_service.py:556`, `:709`. `parse_worker.py:696`, `:724`.

`f_cost_final.py` / `cost2.py` give these per-page times for `extract_elements + chunk_document`:

| Page | v3 | v5 |
|---|---:|---:|
| 750-line table | 10 ms | 24 ms |
| 3,300-line 4 pt table | 48 ms | 143 ms |
| Same + 72 pt watermark | 60–92 ms | 148–182 ms |
| Same + one cell at every size of a 4 → 72 pt chain (one size group spanning the page) | 65 ms | 163 ms |

PyMuPDF extraction adds about 50 ms per page.

For a 3,000-page (Pro cap) dense-table document, these two calls take 430–550 s in v5 against 145–275 s in v3. With extraction (about 150 s), v5 exceeds the 540 s soft limit where v3 would not. Embedding that many pages of cells dominates either way, so this is not a realistic new timeout path. Still, a one-entry cache keyed on the `pages` object would halve the v5 cost.

The partner check in `_running_text_chars` is bounded (runs × size classes). 2,000 two-line runs over 60 classes take 43 ms.

---

## Claims checked and holding

- **Size chains (F6 response).** If `a ≤ c ≤ b` and `|a−b| ≤ max(0.35, 0.08b)`, every consecutive pair between them passes `_same_size`, because `a ≥ 0.92b ≥ 0.92c`. So every same-size pair lands in one chain. Checked on 3,000 random size sets with 0 splits. On 1,500 random pages, `_annotate_runs` equals a brute-force all-pairs neighbour relation exactly (`prop_runs.py`).
- **The floor gate never drops a v3 heading.** Its font-unit clause is v3's predicate. Additions over v3 are only (i) `dominant_size` lines on pages whose reference is ≤ their body / 1.25 (F3(a), REIT tile titles), and (ii) R2-4.
- **`extractor_title`.** It is set only in `parse_worker._extracted_pages_to_page_infos`; no PDF path (`extract_pages`, `extract_pages_ocr`, `_extract_line_blocks`) sets it. 400 random extractor documents give identical headings in v3 and v5 (`g_nonpdf_fuzz.py`). Those documents mix titles such as `Q3 2025`, `+12%`, `www.example.com` and 230-character strings, with `width_pt` of None, 1.0 or 612. Unit boxes are never running text, and floors equal v3's median.
- **CJK and combining-mark weighting.** It added no callout on the CN corpus (r1 → v5 there is only the swsc cover title). The guard now treats CJK callouts the way it treats Latin ones of the same meaning:
  - `营收+35%` and `9月13日` pass, as `Revenue +35%` and `Sep 13` do;
  - `2026年`, `1503.10亿元` and `2026年9月` are still rejected.
  - These are v3 headings anyway.
- **F2 below 25 %.** When text pages are under 25 % (notes with long appendices, decks with few text slides), sparse pages take the appendix size or the floors only, which equals v3 classification apart from the guards and the dominant path.
  - At 25 % the result is by design but discontinuous: a chart book with 4 of 20 text pages keeps its 15 chart titles, and with 5 of 20 it keeps none (12 pt chart titles at the 12 pt document body; `g_docref_share.py`).
  - Expect section titles to shift when a chart book gains one text page.
- **Run grouping.** `run_id`, the removal of the early `len(on_axis) < 2` return, and the off-axis handling all behave as intended.
- **Margin rules and predicate order.** These are unchanged from round 1.
- **No new exception path.** A `/Rotate 90` page still classifies like an upright one (`f_rotate.py`).

## Not reproduced

- **Infinite or NaN span sizes.** `_same_size(inf, x)` is True for every finite x, and NaN disturbs the size sort. Either could merge or split chains: a cost issue, not correctness, since the pair test re-checks the size. I could not make PyMuPDF emit such a span; crafted `Tf`/`Tm` content produced no span at all.
- **OCR span sizes, real tategaki PDFs, and the owner's private 50-PDF corpus**, as in round 1.
- **A corpus instance of R2-1(b) at ≥ 1.25×.** The REIT tile labels sit at body size, so dropping them is by design.

## Required before merge

1. **R2-2**: apply fix B (or an equivalent) and correct plan §8 risk 7.
2. **R2-1**: apply fix A (or an equivalent) and either resolve the tile case or record it as an accepted loss in plan §8. Add the R2-6 reading rule to the harness and to the rules bullet, then re-run the corpus.
3. **F8**: decide the version sequencing with v4 before deploy.

**Recommended:**
- R2-4 fix C, which has no corpus effect and makes the rules-bullet claim true.
- R2-3 fix E.
- The mutation harness should fail on a missing pattern, and the R2-5 survivors need tests: a lone 3-line title, a paragraph with a short last line, drifting sizes 10.0 → 10.7 → 11.5, and an extractor document with a title on every page.
- Compute `_prepare_blocks` once (R2-7).
