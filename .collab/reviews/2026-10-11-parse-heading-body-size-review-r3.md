> **This is a fresh-context Claude review standing in for the Codex adversarial review. It is not a Codex review.** Codex CLI and OpenAI credentials were unavailable in this cloud session. The owner should still run the real Codex pass locally (`2026-10-11-parse-heading-body-size-codex-prompt.md`, as round 3).

# Parse v5 heading size rule: adversarial review, round 3

**Date** 2026-10-11 · **Branch** `claude/sharp-feynman-4vqkq2` @ `a9e8245d` (round 2 reviewed `bc51e07b`; base `main` `d46fc222`) · **Reviewer** Claude, fresh context. I did not design or write the change or either round of fixes.

## Method

Three copies of `parse_service.py` were loaded side by side:
- `main` (v3);
- `bc51e07b` (r2, the code round 2 reviewed);
- the working tree, identical to `a9e8245d` (v5).

They ran on synthetic `PageInfo` lists, on PDFs built with PyMuPDF, and on the 47-PDF corpus (33 public, 11 synthetic, 3 seeds). Mutations and candidate fixes ran against a copy of `backend/` in the scratchpad, never the repo. The scripts are in `scratchpad/review3/`. Each finding spells out its input inline.

**Baseline**
- `tests/test_parse_service.py`: 71/71 pass.
- `parse_heading_mutations.py` (run on the scratch copy): 50 mutations killed, 3 accepted survivors, no stale pattern. This matches the record.
- The harness (`--old-ref main`) reproduces the corpus record exactly: 47 PDFs, paragraph characters fell in 0, 601 lines to read.
- The r2 → v5 sweep matches the response line for line:
  - JPM +4
  - BIS WP 1325 +4
  - `fed_feds_ai_coder` +1
  - chicagofed −20
  - 10-Q −4
  - nothing else
- No v3 → v5 addition exists outside the 11 REIT tile titles.
- Cost is unchanged by round 2. Each figure is `extract_elements` + `chunk_document`:

  | Document | v3 | r2 | v5 |
  |---|---:|---:|---:|
  | chicagofed | 0.37 s | 0.57 s | 0.56 s |
  | 10-Q | 0.32 s | 0.57 s | 0.57 s |
  | JPM | 0.22 s | 0.34 s | 0.32 s |

## Verdict: SHIP-WITH-FIXES

Round 2's fixes do what the response says on the corpus. Two of them rest on assumptions that real documents break:

- **Fix E (second look)** assumes that "titles are larger than any page's body" (`parse_service.py:1034-1035`). The corpus contradicts this:
  - The page body sizes of ASML span 8–16 pt.
  - MS 2Q26 spans 7–14 pt.
  - The REIT deck spans 8–14 pt.
  - `ms_research_bridging` has 7, 9 and 14 pt.

  When one page's body is set at the size of a wrapped title elsewhere, the second look turns that title into its own page's body size. This is round 1's F1 failure, coming back through a new path. The second-look size then feeds the document body size and spreads to other pages. See R3-1.
- **Fix B (2× display exemption)** clears the BIS WP 1325 cover title by 0.14 pt. It does so only because that paper's median line is 10.91 pt. BIS WP 1367 uses the same template, but its median line is 11.96 pt, so the same 4-line title is lost there. R2-2 is closed for one paper, not for the class. See R3-2.

Both MAJOR findings are constructed, but one is grounded in a real corpus document. Each has a measured fix:
- R3-1: zero corpus change, 71/71 tests.
- R3-2: restores only v3 headings.

No BLOCKER was found. Round 2 introduced no crash and no cost regression. Every body → heading change I could produce equals v3's own classification.

---

## Round-1 and round-2 findings re-run on `a9e8245d`

Counts are headings, v3 / r2 / v5, from the reviewers' scripts copied into `review3/prior/`.

| Finding | Status | Evidence |
|---|---|---|
| r1 F1 wrapped title sets its own page body | **CLOSED** for the reported shapes, **REGRESSED** through a new path (R3-1) | `f_slide_title_clean` 6/6/6. `f_slide_title` 15/15/15. `f_wrapped_title_sets_ref` 7/7/7. |
| r1 F2(a) one text page sets a chart book's body | **CLOSED** below 25 %. The second look can recreate it through the document body size (R3-1, e2). | `f_docref_one_page` 21/21/21 |
| r1 F2(b) short note + long 7 pt appendix | **OPEN**, v3 behaviour (accepted) | `f_dominant_add` v3 32 / v5 3 |
| r1 F3(a) footnote-marked body line added | **OPEN**, residual (accepted) | `the period1 and we expect…` is in v3's chunk text and absent from v5's |
| r1 F3(b) | **CLOSED** | `f_ws_spans_double` 3 headings / 7 chunks in v3 and v5 |
| r1 F4 CJK digit guard | **CLOSED** | `f_cjk_digits2`: 4/4 titles |
| r1 F5 Word "Double" spacing | **OPEN** by decision | 2.3× leading: 72/72/72 |
| r1 F6 cost | **PARTLY CLOSED**; round 2 changed nothing | Timings above |
| r1 F7 non-PDF path | **CLOSED** | Re-run through `parse_worker._extracted_pages_to_page_infos`: 2/2/2. The r1 script itself builds blocks without `extractor_title` and is stale. |
| r1 F8 version vs v4 | **OPEN** (owner) | `PARSE_PIPELINE_VERSION = 5` |
| r1 F9 / r2 R2-5 mutation coverage | **CLOSED**; new unpinned knobs (R3-6) | 50 killed, 3 accepted. The accepted reasons are true (see "Checked"). |
| r1 F10 / r2 R2-6 metric blind to heading loss | **PARTLY CLOSED** | `body-short` and `inherited` catch R3-1's losses. `body` hides R3-4's. |
| R2-1(a) JPM chart titles | **CLOSED** | JPM r2 865 → v5 869; the remaining 2 are `guard` callouts |
| R2-1(b) IR tile titles | **OPEN**, accepted loss | `g_tiles2` 36 / 4 / 4 |
| R2-2 4-line display title | **PARTLY OPEN** (R3-2) | BIS 1325 back. The same title on the BIS 1367 cover is lost. |
| R2-3 lone exhibit comment | **CLOSED**, with side effects (R3-1, R3-3) | `g_single_run_body` 98 / 18 / 2 |
| R2-4 rule floor below font floor | **CLOSED** | `g_rule_floor_low` 7 / 7 / 7 |
| R2-7 `_prepare_blocks` runs twice | **OPEN** (not done) | — |

---

## Findings

### R3-1 · MAJOR · The second look makes a wrapped title its own page's body whenever another page's body has the title's size, and the result spreads through the document body size

`backend/app/services/parse_service.py`:
- `:1000-1003`: a lone short run counts when `any(self._same_size(run_size[rid], size) for size in body_sizes)`, whatever its role on the page.
- `:1045-1051`: the second look.
- `:1053-1058`: the document body size is taken over all page sizes, including second-look ones.
- `:1032-1035`: the docstring's premise.

Also `.claude/rules/backend.md:46` and plan `:316`.

Fix E counts a lone 2–3-line run on a page without a body size whenever its size is *some* page's body size. A wrapped title (a slide action title, a 2-line exhibit title) passes that test as soon as any one page uses its size for running text. Examples of such pages: a key-message slide, a cover standfirst, a KPI-tile slide. ASML p7 already takes 15.96 pt this way on the second look (its 8 pt footnote unlocks the 200-character minimum). Nothing changes on that page, only because its 16 pt lines are guarded as a 7-line run anyway.

**(a) IR deck (`e1_deck_title_size_body.py`), 960×540.**

The deck:
- **Slide 1** is a key-message slide: four 28 pt lines, about 50 characters each (`Our strategy is simple: build where customers need` …).
- **Slides 2–3** each have a one-line 28 pt title and six 18 pt bullets.
- **Slides 4–9** each have a 2-line 28 pt action title (`Data center demand remains the largest driver` / `of our 2026 revenue and margin outlook`) and three one-line 18 pt bullets. This is r1's F1 slide.

The mechanism:
1. The first-pass body sizes are {28, 18}.
2. On slides 4–9, the second look counts the title (83 characters at 28 pt) and the bullets (159 characters at 18 pt).
3. The title class holds 34 %, so the page body becomes 28 pt.

| | v3 | r2 | v5 |
|---|---:|---:|---:|
| Headings | 17 | 14 | **2** |

- All 12 title lines on slides 4–9 are lost.
- Their chunks' `section_title` becomes `Operating highlights, part 2` (the previous bullet slide).
- Without the key-message slide, v5 = r2 = v3.

**(b) Cascade (`e2_deck_cascade.py`).** Add three chart slides to (a). Each has a one-line 28 pt title (`Revenue by region`) over five 10 pt axis labels.

- After the second look, 28 pt is the body size of 10 of 12 pages, so it becomes the **document** body size.
- The chart slides inherit 28 pt and lose their one-line titles too.
- Headings: v3 35, r2 32, **v5 17**. 15 title lines are lost.

**(c) Research note (`e4_note_standfirst_exhibit_titles.py`), 612×792.**

The note:
- **p1** is the cover: a 26 pt title; a 4-line 14 pt standfirst of about 66 characters per line, at 18 pt pitch; five lines of 9 pt summary.
- **p2–4** are 9 pt body pages.
- **p5–10** are exhibit pages, R2-3's own target shape. Each has a 2-line 14 pt exhibit title (`Exhibit k: Enterprise AI adoption rose in every region we survey,` / `led by financials and software, while industrials still lag behind`), 25×6 cells at 6.5 pt, and a 3-line 9 pt comment.

The cover's body is 14 pt, so on each exhibit page the title run counts beside the comment and holds 33 %.

| | v3 | r2 | v5 |
|---|---:|---:|---:|
| Headings | 204 | 13 | **1** |

- All 12 exhibit-title lines are lost.
- Every exhibit chunk is cited under the cover title `AI rate of change`.
- With a normal 30-line cover (standfirst under 30 %), v5 = r2.

The harness labels these losses `body-short` (or `inherited` for the cascade), so the reading rule would surface them. No public corpus PDF has the shape. The owner's private broker corpus (cover standfirsts, exhibit pages) is where to look.

**Fix F1 (measured).** Two changes:
1. On the second look, skip a lone short run that was admitted only through `body_sizes` when its size exceeds `HEADING_SIZE_FACTOR` × the smallest run size on the page. It is a title over that text.
2. Compute the document body size from first-pass page sizes only.

Results:

| Repro or test set | v5 | With F1 |
|---|---:|---:|
| e1 | 2 | 14 (= r2) |
| e2 | 17 | 32 (= r2) |
| e4 | 1 | 13 (= r2) |
| `g_single_run_body` (R2-3) | 2 | 2 |
| `f_slide_title_clean` | 6 | 6 |
| `f_docref_one_page` | 21 | 21 |
| `g_tiles2` | 4 | 4 |
| 47 corpus PDFs | — | 0 changes |
| `test_parse_service.py` | 71/71 | 71/71 |

The code is in `scratchpad/review3/ps_fixF1.py`. The mutation "document body size from first-pass sizes only" currently survives every test (R3-6), so add a test of the e1 or e4 shape with the fix.

### R3-2 · MAJOR · The 2× display exemption depends on the document's median line; it restores the BIS WP 1325 cover title by 0.14 pt and loses the same title in BIS WP 1367

`parse_service.py:1090-1094` (`rule_size < HEADING_DISPLAY_FACTOR * max(reference_size, font_floor, rule_floor)`). Plan `:245` (risk 7, "fixed by the 2× exemption"), `:318`. `.claude/rules/backend.md:46`.

The exemption's base includes both document medians:
- **WP 1325:** its median is 10.91 pt and its p1 body is 9.96 pt, so the threshold is 21.82 pt and the 21.96 pt title clears it by 0.6 %.
- **WP 1367**, the other BIS working paper in the corpus and the same cover template: its median line is **11.96 pt** (12 pt body, fewer tables), so its threshold is 23.91 pt.

**Input (`b2_bis_long_title.py`).** The cached pages of `bis_wp1367_ai_investment_race`, with the p1 title `The AI investment race` replaced by WP 1325's four 21.96 pt title lines. The bboxes are unchanged: (317, 341, 564, 379), (317, 370, 493, 408), (317, 400, 560, 437), (317, 429, 371, 466).

**Output.** The p1 page body is 10.4 pt, so the title is 2.11× its page.
- v3: all four title lines are headings.
- v5: none of them is. The harness labels them `run-large`.

Round 2 itself says "every BIS WP whose title runs over about 75 characters has this cover layout". For papers whose median line sits on their 12 pt body, the exemption never fires.

The 2× ratio is also not a robust separator on its own. On the other side of the threshold, `fed_feds_ai_coder` p46 has a body paragraph at **1.92×** its 5.68 pt page body (`mates. This shows that software developers…`). Only the 7.66 pt median keeps it at 1.43× and guarded. So simply dropping the medians from the base (variant B2: 0 corpus change, 71/71, restores the transplant) trades one margin for the other.

**Fix candidate B3 (measured).** Also exempt a run when it is short and at ≥ 1.5× its base:
- Short means ≤ 160 characters across the whole run; a display title is short and a paragraph is not.
- The base is `max(page body, both medians)`.
- This needs a `run_chars` count from `_annotate_runs`.

Results:
- **The transplant:** the title is back.
- **Corpus changes**, all of them v3 headings, with no addition beyond v3:
  - 10-Q p52 header stack (`Notes to Consolidated Financial Statements`, `(Unaudited)`, `Derivative`, `Activities`): r2's second instance, currently in plan §8 as accepted;
  - ASML p2 agenda rows: 4;
  - REIT p4 agenda rows: 5;
  - the 8 stacked characters of the `cn_donghai` vertical cover label.
- 71/71 tests pass.
- Code: `ps_fixB3.py`.

Whether agenda rows should be headings is the owner's call. Otherwise, record in plan §8 that the BIS fix holds only for papers whose median line is below 10.98 pt.

### R3-3 · MINOR · The second look can lower an exhibit page below the document body size via its source note, re-heading the comment (v3 behaviour, r2 had fixed it)

`parse_service.py:1000-1003`, `:1047-1051`.

The second look counts *any* lone short run at a body size. That includes a 3-line 7 pt "Source: … Note: …" block, because 7 pt is the disclosure appendix's body size in nearly every broker note.

**Input (`e3_source_note_lowers_ref.py`), 612×792.**
- **p1–4:** 10 pt body pages (the document body is 10 pt, 4 of 12 pages).
- **p5–9:** exhibit pages. Each has a 12 pt exhibit title and a 2-line 10 pt comment whose second line is `pre-bought capacity.`, so Fix A drops that run. Each also has 25×6 cells and a 3-line 7 pt source note of about 100 characters per line.
- **p10–12:** 7 pt disclosures.

Output:
- **Exhibit page body:** r2 10 pt (inherited); v5 7 pt.
- **Headings:** v3 179, r2 4, v5 19. The comment lines `DRAM contract prices rose … as hyperscalers` / `pre-bought capacity.` are headings again and absent from chunk text, as in v3.
- **Paragraph characters:** r2 37,210, v5 36,540.
- **With a 2-line note** (197 characters, under 200): v5 = r2.

This is not a regression against v3 (`--old-ref main` reports +12,920 characters). It reverses r2's fix on the target class, and the harness cannot see it unless it runs with `--old-ref bc51e07b`.

Variant F2 adds one rule to F1: a second look may not lower a page below the inherited document body size.
- It fixes e3 (19 → 4).
- It loses the one corpus gain of Fix E, `fed_feds_ai_coder` p57 `All Industries`.

That is a trade for the owner.

### R3-4 · MINOR · Fix A can *raise* a page's body size, and the harness labels the lost heading `body` (not read)

`parse_service.py:995`; harness `.collab/scripts/parse_heading_corpus.py:118-122`.

Dropping runs with one wide line can remove the page's real body class, so a larger minority class becomes the page body.

**Input (`a1_one_wide_line_runs.py`).**
- **p1–3:** 10 pt body.
- **p4:**
  - a 4-line 12 pt intro (about 53 characters per line, 15 pt pitch, 214 characters);
  - the 14 pt heading `Why the upcycle has further to run`;
  - six 10 pt bullets, each a wide first line plus a short second line (`of HBM.`), spaced more than a line height apart.

Output:
- **p4 body:** r2 10 pt (running text {12: 214, 10: 558}, so the intro is 27.7 %). v5 12 pt (the bullets no longer count).
- **The heading** is 1.4× the real body: r2 and v3 keep it, v5 loses it.
- **The harness** labels it `body`, which is not in the reading list.

Without the intro, the page inherits the 10 pt document body and nothing changes. Widely spaced 2-line bullets are uncommon in notes and common on slides.

### R3-5 · MINOR · The display exemption re-heads body paragraphs on small-print pages (v3 behaviour, r2 had fixed it)

`parse_service.py:1090-1094`.

**Input (`b1_display_exempt_body.py`).**

(a) A note whose medians are 4.5 pt (six pages of 4.5 pt model tables). Its last page has a 5-line 10 pt conclusion (`We reiterate our Buy rating: …`) over 40 lines of 5 pt disclosures:
- The page body is 5.0 pt, so the paragraph is exactly 2× its base and exempt.
- v3 and v5: five headings, absent from chunk text. r2: body.

(b) A chart-heavy deck (medians 9 pt). An agenda slide's five 18 pt bullets (< 200 characters, no page body) are exempt: v3 and v5 headings, r2 body.

Not a v3 regression. The corpus has no instance at ≥ 2× (closest: `fed_feds_ai_coder` p46 at 1.43× the base). B3's character limit does not cover this direction, because the paragraph is 470 characters and B3 does not change the 2× clause. If this matters, require the 2× clause to be short too.

### R3-6 · MINOR · Round-2 behaviour that no test pins

These mutations of `a9e8245d` survive all 71 tests (`review3/mutate_r3.py`):
- the document body size computed from first-pass page sizes only (the R3-1 cascade);
- the display base reduced to `reference_size` alone;
- the display base reduced to the medians alone. Under this mutant, a 4-line 18 pt bullet run on a slide whose own body is 18 pt would be exempt wherever the medians are ≤ 9;
- display `<` changed to `<=`;
- display factor 1.6. Per r2, 1.5 already restores agenda rows and KPI tiles;
- the second look run on **every** page, including pages that have a body size;
- the second look ignoring same-size partners.

Factor 3.0, factor 1.2, every Fix A/C/E removal and the r2 survivors are killed. Add tests for:
- a slide whose 4-line 18 pt bullet run equals its page body, with low medians (pins the base);
- the e1 or e4 shape (pins the second look);
- a page with its own body size unaffected by `body_sizes`.

### R3-7 · MINOR · Corpus record: the `body-short` reading is incomplete

`.collab/reviews/2026-10-11-parse-heading-body-size-corpus.md:156`.

The `body-short` list in `cn_guosen_oil_gas_monthly_sep2026` includes five numbered section headings:
- `3.1 原油价格与价差` (p13)
- `3.3 原油需求：美国炼厂开工率大幅提升` (p15)
- `3.7 成品油需求` (p21)
- `3.10 美国天然气库存` and `3.11 煤层气` (p24)

They are 12 pt over a 10.45 pt page body (1.15×), so this is the accepted loss of body-size titles. The record describes this group as "TOC rows and price commentary". It should say "numbered sub-sections at 1.15×, left to v4's numbered rule", as it already does for `inherited`.

On the same pages, CJK body lines containing an uppercase token (`截至9 月30 日收盘，WTI 原油期货…`) are still headings under the unchanged caps rule. `str.isupper()` ignores uncased CJK. That rule is v4's to tighten. Note it for v4.

---

## Checked and holding

- **Fix C cannot drop a v3 heading.** The font-size clause `block.font_size <= font_floor * 1.25` (`:1098`) is v3's predicate and is unchanged. Fix C only tightens the dominant-size clause, and the display exemption only relaxes the run guard. Corpus: 0 change r2 → v5 attributable to C.
- **Floor invariant.** No v3 → v5 addition exists on 47 PDFs beyond the 11 REIT tile titles. Every body → heading change I could construct (R3-3, R3-5, and F3(a) through the dominant path) is either v3's own classification or the accepted dominant-path residual.
- **Fix A dead-code claim.** `b.run_id < 0` excludes exactly the off-axis lines. Isolated on-axis lines enter `runs` with one line and are dropped by `len(lines) >= 2` (`:995`).
- **Mutation script accepted list.** Each reason is true:
  - *Extractor title first:* it differs only when titled blocks are at least as many as non-empty body blocks (median 15 or 18 pt), i.e. a title on every page.
  - *Reach over every line:* the cap evicts the oldest active entries first, and the lines between a true neighbour and the current line are the same under either reach, so this is equivalent for same-size groups.
  - *Doc-ref fallback = span-mean floor:* it differs exactly when `font_size > 1.25 × font_floor ≥ rule_size`, a dominant span below the mean.
- **Harness labels.**
  - `run-large`: the corpus instances are body paragraphs on small-reference pages (10-Q, `in_plcapital` p10, `fed_feds_ai_coder` p46), agenda/KPI rows, and the 10-Q p52 stack, as recorded.
  - `body-short` and `inherited`: they catch R3-1 (e1: 12 `body-short`; e2: 12 + 3 `inherited`; e4: 30 `body-short`).
  - The one gap is R3-4 (`body`).
- **Cost.** The second look is one extra `_running_text_chars` pass on pages without a body size. Round 2 adds no measurable time (timings above).

## Not reproduced

- **A corpus instance of R3-1.** The precondition exists in three of four public decks (body sizes up to 16 pt), but no wrapped title of that size sits on a page without a body size there.
- **Worst-case cost of the second look.** It is runs × `body_sizes` per page. It would matter only with hundreds of distinct page sizes and hundreds of unpartnered two-line wide runs per page. I could not build a realistic page with both.
- OCR span sizes, real tategaki PDFs, the private 50-PDF corpus (as in rounds 1–2).

## Required before merge

1. **R3-1**: apply F1 or an equivalent (second-look runs must not be a title over the page's other text; document body size from first-pass sizes), and add a test of the e1 or e4 shape.
2. **R3-2**: either make the display exemption independent of the median line (B3, or another short-run criterion, then re-measure), or record in plan §8 that BIS covers keep a 4-line title only when the paper's median line is < 10.98 pt (WP 1367's is 11.96 pt).
3. **F8**: version sequencing with v4 (still open).

**Recommended:**
- R3-6 tests.
- R3-3: decide on F2's trade.
- R3-4: add a reading label for `body` removals on pages that lost a running-text class to the ≥ 2-wide-lines filter.
- R3-7: record wording.
- Re-run the harness once with `--old-ref bc51e07b` to see what round 2 changed against round 1's output. `--old-ref main` cannot show R3-3 or R3-5.
