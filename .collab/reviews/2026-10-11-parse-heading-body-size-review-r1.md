> **This is a fresh-context Claude review standing in for the Codex adversarial review, not a Codex review.** Codex CLI / OpenAI credentials were unavailable in this cloud session. The owner should still run the real Codex pass (`2026-10-11-parse-heading-body-size-codex-prompt.md`) locally.

# Parse v5 heading size rule: adversarial review, round 1

**Date** 2026-10-11 · **Branch** `claude/sharp-feynman-4vqkq2` @ `780c2131` (base `main` `d46fc222`) · **Reviewer** Claude (fresh context, did not design or write the change)

**Method.** I loaded `main`'s and the branch's `parse_service.py` side by side and compared `extract_elements` / `chunk_document` on synthetic `PageInfo` pages, on PDFs built with PyMuPDF, and on the 33-PDF public proxy corpus, the 11 synthetic PDFs and the 3 seeds. Every finding below has an input and the wrong output it produces. I also ran mutations against `tests/test_parse_service.py` and timed v3 against v5. The repro scripts are in the session scratchpad (`scratchpad/review/f_*.py`, `common.py` loads both versions). The essential input of each repro is written out inline, so the owner can rebuild it without the scratchpad. Baseline: `tests/test_parse_service.py` 48/48 pass, `test_demo_seed_storage.py` + `test_parse_worker_batching.py` 53 pass / 5 skipped, ruff clean.

**Verdict: SHIP-WITH-FIXES.** The core idea works: a page-level body size from paragraph runs, floored at v3's median. On the target class it recovers the body text, and the floor invariant holds exactly for lines where `dominant_size == font_size`. But four MAJOR findings show realistic documents that v3 classified correctly and v5 gets wrong:

- slide titles lost (F1)
- chart titles lost (F2)
- a `dominant_size` path that turns body into headings (F3)
- CJK titles lost (F4)

The corpus acceptance metric ("paragraph characters rise or hold") reports every one of these as an improvement (F10). F3 and F4 have small fixes; F3's fix is validated below. F1 and F2 need a short design round and a corpus re-run before merge.

---

## Findings

### F1 · MAJOR · A wrapped heading is "running text", so it can set its own page's reference and stop being a heading
`backend/app/services/parse_service.py:944` (`_running_text_chars`: `run_len < 2` is the only run filter), `:961-962` (`_page_reference`: largest class with ≥30 %).

The design lets a heading wrap to 3 lines (`HEADING_MAX_WRAP_LINES`), but a 2–3-line heading is also a run of ≥ 2. When the heading spans ≥ 20 % of the page, it counts as running text. On a sparse page (a slide, a cover, a section divider) a wrapped title then holds ≥ 30 % of the running characters. Because it is the *largest* substantial class, it becomes the page's reference, and a line can never exceed 1.25 × its own size.

**Input** (`f_slide_title_clean.py`): a real PDF, 3 slides at 960×540. Each has a 2-line 28 pt action title, `insert_text((60,80), "Data center demand remains the largest driver")` / `((60,114), "of our 2026 revenue and margin outlook")`. Below it are three one-line 18 pt bullets (`"• Signed leases up 18% year on year across all markets"` etc. at y = 180/204/228). There is nothing else on the slide.

**Output:**
- v3: 6 headings (the title lines). The bullets are body, which is exactly right.
- v5: **0 headings**. Every chunk's `section_title` is `None` (v3: the slide titles).
- Page reference = 28 pt (title 83 chars vs bullets 159 chars → 34 %).
- The harness reports this as `+258` paragraph characters, an improvement.

A cover page shows the same failure (`f_wrapped_title_sets_ref.py`). The cover has a 2-line 20 pt title, "AI, data centres and the coming surge in" / "US power demand: our 2030 base-case view", over a 2-line 10 pt standfirst. Page reference = 20, the document title is lost, and the first chunk's `section_title` goes from the title to `None`.

The plan's §5 "Slides" row only covers 1-line titles. Wrapped "action titles" over 3–4 short bullets are standard in IR and strategy decks.

**Fix direction (needs measurement).** A size class whose runs are all ≤ `HEADING_MAX_WRAP_LINES` lines, and which clears 1.25 × the next substantial class below it, should not be eligible as the page body. I prototyped exactly that (`parse_service_v5_fixW.py`):
- It restores both cases and passes 48/48 tests.
- But it **adds** body headings on 3 corpus PDFs (`gs_equity_research_jd` p11 ×7, `fed_feds_ai_coder` p50 ×4, `cn_guosen_ai_industry` p9 ×1).

So this is a design question, not a one-line patch.

### F2 · MAJOR · The document reference is chosen among pages that *have* a reference, however few they are, and every other page inherits it
`parse_service.py:1003-1004` (`common = … >= REF_DOC_PAGE_SHARE * len(known)`), `:1007`.

The 25 % share is measured over `known` (pages with ≥ 200 running-text characters), not over the pages that will inherit the value. One text page can therefore set the reference for every chart page, in both directions.

**(a) Larger than the page's body: headings lost** (`f_docref_one_page.py`). The input is a real PDF, landscape:
- Page 1: a 20 pt title plus 14 lines of 12 pt intro text.
- Pages 2–21 (chart pages): one 12 pt chart title `"S&P 500 earnings growth and margins, chart N"`, ten 8 pt legend entries, thirty 7 pt ticks and a one-line 7 pt source.

The output:
- v3: 21 headings (intro title + 20 chart titles). Legends and ticks are body, which is correct (floor 7, threshold 8.75).
- v5: **1 heading**. All 20 chart titles are lost, because 1 of 1 referenced pages says 12 pt and 12 ≤ 15.
- The harness reports `+891` paragraph characters.

Chart books ("Guide to the Markets"-style chart packs, monthly chart decks) have exactly this shape: a few text pages and many chart pages.

The corpus has a real instance on `slides_asml_q2_2026_investor` p1. Its cover headline "ASML reports €9.3 billion total net sales and €2.9 billion net income in Q2 2026" (16 pt, a v3 heading) is lost: the page has < 200 running characters and inherits the deck's 16 pt doc reference.

**(b) Smaller than the page's body: body stays a heading.** The brief calls this "not acceptable" (`f_dominant_add.py`). The input is a short note plus a long disclosure appendix:
- Page 1: 30 lines of 10 pt body.
- Page 2: an exhibit page with 120 cells at 6.5 pt and a 2-line 10 pt comment.
- Pages 3–7: 80 lines of 7 pt disclosure text each.

The 10 pt class holds 1 of 6 referenced pages (< 25 %), so `doc_ref` = 7 pt, and page 2 inherits 7 pt against its own 10 pt body. Its comment lines remain headings, as in v3 (no regression in itself, but not fixed). It also enables an addition; see F3(a). Broker notes of 2–3 pages with 4–6-page disclosure appendices (MS, GS) are this shape.

**Fix direction.** Candidate N (`parse_service_v5_fixN.py`) measures the 25 % over *all* pages and falls back to the floor (v3) when no class reaches it:
- It restores (a) and passes 48/48 tests.
- On the corpus it changes only two decks. It restores the ASML cover headline, but also brings back 6 ASML p12 table labels and 11 MS 4Q25 p9 tile labels that v3 had.
- It does not fix (b). That needs page locality, for example inheriting from the nearest referenced page within the same run of similar pages.

Either way, the plan's risk 5 ("loses headings only") understates the scope: the loss is not bounded by any page share.

### F3 · MAJOR · `dominant_size` adds headings well beyond "superscript-lowered titles", because the floor is in span-mean units and the reference is in dominant units
`parse_service.py:986` (floor = median of `font_size`), `:1235` (`dominant` ignores whitespace-only spans), `:1013` (`_rule_size(block) <= reference_size * HEADING_SIZE_FACTOR`). Docs: `.claude/rules/backend.md:46` ("sole exception: `dominant_size` restoring a superscript-lowered heading").

**Mechanism.** Any line whose span mean is pulled down has `rule_size` > `font_size`. That covers an inline footnote marker inside body text, and a whitespace span set smaller than the text. Such a line is added whenever the page's reference falls to the floor or to a low inherited `doc_ref`.

**(a) Single body line removed from chunks** (`f_dominant_add.py`, the F2(b) document). Page 2's second comment line is built as PyMuPDF reports a 10 pt line with a 6 pt marker in the middle: `font_size = (10+6+10)/3 = 8.67`, `dominant_size = 10`.
- v3: 8.67 ≤ 8.75, so the line is a paragraph.
- v5: 10 > 8.75, so the line is a heading.
- `"the period1 and we expect a further rise next quarter"` is present in v3 chunk text and **absent from v5 chunk text**. The document-level paragraph characters still rise (+1,257), which hides it.

**(b) Whole document lost** (`f_ws_spans_double.py`). Constructed, and **not observed** in the 33-PDF corpus, where whitespace spans of another size occur on ≤ 1.7 % of lines. The input is a real PDF, 3 pages, Liberation Serif 12 pt at 27.6 pt leading (Word "Double", so no runs form; see F5). Each word is followed by a separate 4 pt space run, giving a line mean of 8 pt and a dominant of 12 pt.
- v3: floor 8, so the body is body (3 headings, 7 chunks).
- v5: there is no running text, so the reference is the floor, 8. 12 > 10, so **every body line is a heading**: 63 headings, 0 paragraph characters, **0 chunks**.

**Validated fix D** (`parse_service_v5_fixD.py`, 4 lines): compare each measure with its own median. A line is a heading by size only if it also satisfies `font_size > 1.25 × median(font_size)` **or** `rule_size > 1.25 × median(rule_size)`.
- It restores (b) completely: 3 headings, 7 chunks.
- It passes 48/48 tests.
- It gives **identical headings on all 47 corpus PDFs**, including keeping the 11 REIT tile titles and the `fed_feds_cyclical` title-page lines that §11 deviation 1 was about.
- (a) remains: there the rule-size median is also ~7. That is F2(b).

Also correct the rules bullet: the exception is not limited to headings.

### F4 · MAJOR · The digit guard drops CJK / Japanese / Korean (and Devanagari) titles that v3 found: one CJK character is a word
`parse_service.py:1018-1021` (`letters = isalpha() count`, `figures < letters`).

A hanzi, kana or hangul syllable counts as one "letter" but carries a word, so titles containing a year or a stock code fail `figures < letters`. The caps rule rescues only titles with an uppercase Latin letter. CJK is uncased, so `"2025Q3业绩点评"` survives via `Q` but the others do not.

**Input** (`f_cjk_digits2.py`): a clean page, not a broken one.
- 14 pt `核心观点`, then 10 lines of 10.5 pt CJK body.
- A 14 pt section title, then 10 more body lines.

v3 finds both titles (14 > 13.1). v5 drops the second title for:
- `3、2026年展望` (3 letters vs 5 figures)
- `2026年3月期決算` (Japanese "FY3/2026 results", 5 vs 5)
- `2026년 전망` (3 vs 4)

The chunks after it carry the **previous** section's title (`核心观点`), so citations are mislabelled. Paragraph characters rise by +8 to +10.

The public corpus has real cases (`guard_scan.py`):
- `cn_swsc_dram_memory_ai` p1 loses its cover title `长鑫科技（688825） 电子` (6 vs 6). "公司名（6位代码）" is the title format of every Chinese single-stock report: `宁德时代（300750）` is 4 vs 6 and `比亚迪(002594)` is 3 vs 6.
- `cn_donghai_oil_price_cycles_review` loses its subtitle `——资产配置周报（2026/09/07-2026/09/11）`.

Devanagari is undercounted too: `isalpha()` is False for matras and virama, so `वर्ष २०२६-२७` is 3 vs 6. The plan's §5 claims "CJK: no word counts anywhere". This guard is effectively one.

**Fix.** Weight CJK, kana and hangul characters ×2 (or count them as words), and count combining marks (`unicodedata.category(ch)[0] == "M"`) as letters. With ×2: `2026年展望` is 6 vs 4 (kept), `长鑫科技（688825）` 8 vs 6 (kept), `1503.10亿元` 4 vs 6 (still rejected). Add these strings to `test_size_rule_rejects_number_callouts_and_addresses`.

### F5 · MINOR · Double-spaced text never forms runs, so v5 is identical to v3 for it (the plan says double leading passes)
`parse_service.py:899` (gap measured bbox-bottom → next bbox-top against `1.0 × line height`); plan §3, "neighbour" row: "single, 1.5 and double leading … all pass".

Word's "Double" spacing is 2 × 1.15 × size. With Times New Roman metrics the PyMuPDF bbox is 1.107 × size, so the gap is 14.3 pt against a 13.3 pt limit, and nothing links.

**Input** (`f_double_spacing.py`): a real PDF in Liberation Serif. 3 pages of 22 × 12 pt body lines with a 16 pt heading, plus 3 table pages of 360 × 8 pt cells (floor 8).

| Leading | v5 result |
|---|---|
| 1.15× / 1.5× / 2.0× | 0 of 66 body lines are headings |
| **2.3× (Word "Double")** | **66 of 66 body lines are headings**, identical to v3 |

LaTeX `setspace` `\doublespacing` at 12 pt (24.2 pt pitch, bbox = 1.0 × size in the corpus' LaTeX PDFs) sits 0.2 pt over the limit. Double-spaced manuscripts, theses, legal briefs and FEDS-style drafts with tables keep the v3 failure.

This is not a regression. But the claim is wrong, `RUN_GAP_LINE_HEIGHTS` is unpinned by tests (mutations to 0.3 and 3.0 both survive), and it enables F3(b).

**Fix direction.** Test the baseline pitch (`B.lo − A.lo ≤ ~2.6 × size`) instead of the bbox gap, then re-measure.

### F6 · MINOR · Cost on dense table pages is 6–17× v3. With a horizontal watermark, a Free-cap document can exceed the soft time limit
`parse_service.py:880` (`max_h` over all on-axis lines widens every line's reach), `:912` (cap 400), `:548` + `:701` (`_prepare_blocks` runs twice per parse).

**Input** (`f_cost_final.py`): real PDFs, A4 landscape. The table is `extract_elements + chunk_document`, the two calls the worker makes.

| Page | Lines/page | v3 | v5 |
|---|---:|---:|---:|
| 10-K-like table, 50 × 15, 8 pt | 750 | 11 ms | 66 ms (×6) |
| Dense table, 110 × 30, 4 pt | 3,300 | 51 ms | 415 ms (×8) |
| Same + horizontal 72 pt "CONFIDENTIAL DRAFT" (on-axis, so `max_h` ≈ 90 pt and the active list runs at its 400 cap) | 3,301 | 52 ms | **886 ms** (×17) |

Against `soft_time_limit=540`, these calls alone allow ~1,300 dense pages (below the Pro cap of 3,000) or ~600 watermarked pages (below the **Free** cap of 750). v3 handled > 3,000 pages, and each timeout burns 3 × 540 s of worker time. The corpus record knew the 0.44 s/page figure but did not set it against the page caps. Real corpus documents stay ≤ ~10 ms/page.

**Cheap fixes:**
1. Compute `_prepare_blocks` once and pass it to both calls (halves the cost).
2. Keep one active list per size class. A line only neighbours its own class, so a 72 pt line cannot widen the 4 pt lines' window.

### F7 · MINOR · The non-PDF extractor path does not classify exactly as before
`parse_service.py:1016-1021`, applied to `parse_worker.py` L486-514 blocks.

The digit and address guards also apply to Markdown, DOCX, PPTX and XLSX section titles.

**Input** (`f_nonpdf.py`): `text_extractor.extract_text(..., "md")` on 3 pages of preamble, then `## v2.0.0 (2024-05-01)` and `## Release 2024.10.11`, wrapped exactly as the worker does it (18 pt unit-box title + 12 pt body).
- v3: both titles are headings.
- v5: neither is. In each, `letters` < 2 or `figures ≥ letters`.

Changelogs and release notes are typical Markdown uploads. Either exempt blocks whose `direction`/bbox mark them as extractor blocks, or note the behaviour change; the brief's "must classify exactly as before" is false today.

### F8 · MINOR · Rollout: the version number assumes v4 merges before v5 ships
`parse_service.py:27`; plan §11 ("Merging v4 needs `PARSE_PIPELINE_VERSION = 5` kept").

If this branch deploys first, documents get stamped 5. v4's caps and numbered rules would then arrive under the same 5. `refresh_stale_demo_parses` (`parse_version < VERSION`) and `find_low_quality_docs.py` (`at_current` skip) would never re-parse those documents for v4.

Either ship v4 and v5 together, or bump to 6 when v4 lands. Two smaller rollout notes:
- All three seeds produce identical output under v5. The bump still re-parses the demo documents, rebuilding vectors and setting `source_chunk_id` to NULL on any saved demo quotes, for no content change.
- The suggested backfill selects every `parse_version < 5` document, including non-PDF ones (`find_low_quality_docs.py` L53-54).

The demo refresh code itself is untouched and still correct; the updated test reads the constant.

### F9 · MINOR · Test gaps: these mutations survive all 48 tests (`mutate.py`)
Each mutation below leaves all 48 tests passing:
- `_running_text_chars` without `run_len < 2`. Isolated lines, including one-line headings, count as body.
- `_running_text_chars` without the `off_axis` exclusion.
- `_same_size` tolerance → exact equality. No test has OCR-style jitter.
- `RUN_GAP_LINE_HEIGHTS` 0.3 or 3.0.
- `RUN_MIN_OVERLAP` 0.
- The pooled weighted-median fallback replaced by the floor.
- The floor computed over `rule_size` instead of `font_size` (§11 deviation 1).
- `dominant_size` counting whitespace-only spans (the plindia mechanism; only its URL symptom is tested).
- The dominant tie-break reversed.
- `figures < letters` → `<=`.
- The neighbour test using `font_size` instead of `rule_size`.

Missing cases: everything in F1–F5 and F7. The ingredients the corpus record lists (continuity guard, floor, digit and address guards, extent filter, largest-substantial choice, doc-ref choice, same-row check, vertical axis, active cap) are pinned; I confirmed a subset.

### F10 · MINOR · The acceptance metric cannot see heading loss
Corpus record L30; plan §7 criterion 1; `.claude/rules/backend.md:46` ("paragraph-element characters must rise or hold on every PDF").

F1, F2(a) and F4 all lose real titles and **raise** paragraph characters. F3(a) loses a body line inside a document whose total rises. The "+added / −removed" columns are the right signal, but "−removed" is read as good by default.

Add two checks to the harness:
1. A per-line check: no line that is a paragraph in old and a heading in new, except reviewed titles.
2. A list of removed headings whose size exceeds 1.25 × the *largest* running-text class on their page. These are titles lost for a reason other than "under 1.25× body".

Re-run the corpus with both.

---

## Claims checked and holding

- **Floor invariant (claim 1)** holds exactly for lines with `rule_size == font_size`. The floor equals v3's `median(font_size)` over the same cleaned multiset, and the size rule is `> 1.25 × max(floor, …)`. Additions come only via `dominant_size` (F3). Removals come via reference ≥ floor and the guards (F1, F2, F4).
- **chunk/elements agreement (claim 2).** `_prepare_blocks` is deterministic and builds fresh `CleanBlock`s per call. `BlockInfo`/`PageInfo` are not mutated, and nothing changes `pages` between the two worker calls (`parse_worker.py` L688, L716). No divergence path was found.
- **Sweep (claim 3).** The `max_h` pruning is sound: `lo − jhi > max_h ≥ max(h_i, h_j)` stays true for every later line. The 400 cap can drop a true neighbour only if > 400 lines start within one line pitch between them; nothing realistic does that. The cost side is F6.
- **`/Rotate 90` page (claim 3).** It classifies identically to the upright page (`f_rotate.py`: PyMuPDF bboxes are unrotated, `dir=(0,-1)`, `vertical=True`).
- **Margin rules (claim 6).** Off-axis lines are excluded from runs, `max_h` and running text, and are still never headings. Predicate order in `_is_heading_block` is unchanged. Because the size and caps rules are OR-combined, v4's numbered rule can go after the size rule; any v4 *negative* guard must precede both.
- **No new exception path found.** `_cluster_sizes` could divide by zero only on empty-text running lines, which the PDF path cannot produce. `references[...]` always has the key, and NaN sizes do not raise.
- **Metadata and saved quotes.** Persisted `font_size` is unchanged (tested). Saved-quote snapshots are untouched.

## Not reproduced

- OCR output (Tesseract is not installed here). I could not check whether PyMuPDF's OCR spans vary in size within a line; if they do, `dominant_size` could promote OCR lines (F3 mechanism).
- Real tategaki (`wmode=1`) PDFs. Only the synthetic `direction=(0,1)` case was run. If PyMuPDF reports `dir=(1,0)` for wmode-1 lines, those pages get no runs and fall back to v3.
- The owner's private 50-PDF corpus.

## Required before merge

1. **F3:** apply fix D and correct the rules-bullet wording.
2. **F4:** CJK ×2 weighting plus combining marks, with tests.
3. **F1, F2:** decide the reference-eligibility and inheritance rules (candidates W and N above, both with measured trade-offs). Re-run the corpus with the F10 per-line checks.
4. **F8:** settle the version-number sequencing with v4.

Recommended: F6 (compute once, per-class active lists), F5, F7, and the F9 tests.
