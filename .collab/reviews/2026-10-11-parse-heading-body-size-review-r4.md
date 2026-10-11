> **This is a fresh-context Claude review standing in for the Codex adversarial review. It is not a Codex review.** Codex CLI and OpenAI credentials were unavailable in this cloud session. The owner should still run the real Codex pass locally (`2026-10-11-parse-heading-body-size-codex-prompt.md`, as round 4).

# Parse v5 heading size rule: adversarial review, round 4

**Date** 2026-10-11 · **Branch** `claude/sharp-feynman-4vqkq2` @ `cae9ff53` (round 3 reviewed `a9e8245d`; base `main` `d46fc222`) · **Reviewer** Claude, fresh context. I did not design or write the change or any round of fixes.

## Method

Five copies of `parse_service.py` were loaded side by side:
- `main` (v3);
- `780c2131` (r1), `bc51e07b` (r2) and `a9e8245d` (r3), the code each earlier round reviewed;
- the working tree, identical to `cae9ff53` for `backend/` and `.collab/scripts/` (v5).

They ran on synthetic `PageInfo` lists, on PDFs built with PyMuPDF, and on the 47-PDF corpus (33 public, 11 synthetic, 3 seeds). Mutations and candidate fixes ran against a copy of `backend/` in the scratchpad, never the repo. The scripts are in `scratchpad/review4/`; earlier rounds' repros were copied to `review4/prior/` and run against all five versions. Each finding below spells out its input.

**Baseline**
- `tests/test_parse_service.py`: 76/76 pass. `test_demo_seed_storage.py` + `test_parse_worker_batching.py`: 53 pass, 5 skipped. `ruff`: clean.
- `parse_heading_mutations.py` (on the scratch copy): 57 mutations killed, 3 accepted survivors, `survivors: []; stale patterns: []`.
- The harness with `--old-ref main` reproduces the corpus record exactly: 47 PDFs, 35 changed, paragraph characters fell in 0, 583 removals to read; removed 12,773 = run 10,469 · run-large 99 · body 1,479 · body-short 210 · inherited 249 · floor 0 · guard 25 (242 unmatched); added 11 (the REIT tile titles).
- With `--old-ref a9e8245d`, round 3 changes exactly what the response says: +8 `cn_donghai` (vertical cover label), +5 REIT p4, +4 ASML p2, +4 10-Q p52, −1 `fed_feds_ai_coder` p57 `All Industries`. Every addition is a v3 heading.
- Cost (`extract_elements` + `chunk_document`, per page, v3 → v5): 750-cell table 17 → 29 ms; 3,300-cell 4pt table 60 → 155 ms; the same with a 72pt watermark 64 → 137 ms. Unchanged by round 3.
- 600 random documents (`fuzz_exceptions.py`): no exception, and no v5 heading that v3 lacks on a line whose dominant size equals its span mean.

## Verdict: SHIP-WITH-FIXES

Compared with v3, the change is a large, clean improvement on the target class: chart-heavy research and documents with two body sizes. On 47 PDFs, paragraph characters never fall. The owner's document goes from 66.8 % to 6.3 % heading share. The floor invariant holds structurally (only the dominant-size path can add a heading) and survived 600 random documents. The round-3 display rule cannot turn v3 body into a heading, because every display-exempt line also clears the floors.

What remains:
- **One MAJOR finding (R4-1).** A title that wraps to 4 lines counts as running text, so on a sparse page it becomes its own page's body size. The size rule and the display exemption then both measure it against itself. It is the 4-line form of round 1's F1 and has been present since `780c2131`. It is constructed (no corpus instance), but it is reachable with an ordinary slide layout. The harness labels the loss `run`, which nobody reads. A one-line fix is measured: 0 corpus change, 76/76 tests.
- **Round 3's second-look fixes give back part of round 2's R2-3 gain on R2-3's own shape (R4-2).** This is not worse than v3, but it is undocumented.
- Smaller holes: R4-3 to R4-7.

---

## Prior findings, re-run on `cae9ff53`

Counts are headings for v3 / r3 / v5 unless noted. "= v3" means the current result equals main's.

| Finding | Status | Evidence |
|---|---|---|
| r1 F1 2–3-line title sets its own page body | **CLOSED** for 2–3-line titles. The 4-line form is open: **R4-1**. | `f_slide_title_clean` 6/6/6; `f_slide_title` 15/15/15; `f_wrapped_title_sets_ref` 7/7/7 |
| r1 F2(a) one text page sets a chart book's body | **CLOSED** below 25 % text pages; by design at or above 25 % | `f_docref_one_page` 21/21/21; `g_docref_share` 5/20 text pages: v3 20, v5 5 (by design) |
| r1 F2(b) / F3(a) short note + long 7pt appendix; footnote-marked line | **OPEN**, accepted residual | `f_dominant_add` 32/3/3; `the period1 …` still added (absent from v5 chunk text) |
| r1 F3(b) | **CLOSED** | `f_ws_spans_double` 3/3/3, 7 chunks |
| r1 F4 CJK digit guard | **CLOSED** | `f_cjk_digits2` 4/4 titles |
| r1 F5 Word "Double" spacing | **OPEN** by decision (= v3) | 2.3× leading: 72/72/72 |
| r1 F6 / r2 R2-7 cost, `_prepare_blocks` twice | **PARTLY CLOSED** (unchanged) | Timings above, 2.1–2.6× v3 on dense table pages |
| r1 F7 non-PDF path | **CLOSED** | `f_nonpdf_worker` 2/2/2; `g_nonpdf_fuzz` 0 of 400 differ |
| r1 F8 version number vs v4 | **OPEN** (owner) | `PARSE_PIPELINE_VERSION = 5`; no v4 branch in this clone |
| r1 F9 / R2-5 / R3-6 mutation coverage | **CLOSED** for what is listed. New gaps: **R4-5** | 57 killed, 3 accepted |
| r1 F10 / R2-6 / R3-4 reading rule blind spots | **PARTLY CLOSED** | R4-1's losses are labelled `run` (not read) |
| R2-1(a) JPM chart titles | **CLOSED** | JPM 871 → 869, the 2 are `guard` callouts |
| R2-1(b) IR tile titles | **OPEN**, accepted loss | `g_tiles2` 36/4/4 |
| R2-2 / R3-2 4-line display title | **CLOSED** (BIS 1325 cover back; WP 1367 transplant back) | `b2_bis_long_title` v3 100 / r3 95 / v5 99 (the 1 is `No 1367`, guard). R4-1 is the case where the title is the page body |
| R2-3 lone exhibit comment | **CLOSED for its repro, REGRESSED to v3 behaviour on two variants of the same shape (R4-2)** | `g_single_run_body` 98/2/2; with a 2-line source note 98/2/**18**; with one-line comments 100/2/**8** |
| R2-4 rule floor below font floor | **CLOSED** | `g_rule_floor_low` 7/7/7 |
| R3-1 second look admits a title | **CLOSED** (= r2) | e1 17/2/14, e2 35/17/32, e4 204/1/13. Residual variant: **R4-3** |
| R3-3 source note lowers the exhibit page | **CLOSED** | e3 (3-line note) 179/19/4 |
| R3-4 fix A raises a page body | **OPEN**, accepted | a1 1/0/0 |
| R3-5 long paragraph exempt at 2× | **CLOSED** | b1(a) 93/13/8; b1(b) agenda 252/252/252 (= v3, recorded). Not pinned by a test: **R4-5** |
| R3-7 corpus record wording | **CLOSED** | — |

---

## Findings

### R4-1 · MAJOR · A title that wraps to 4 lines is running text, so on a sparse page it becomes its own page's body size and is lost (worse than v3; present since r1)

`backend/app/services/parse_service.py`:
- `:1014-1021`: the partner / second-look check that keeps a wrapped title out of the page body applies only to runs of ≤ `HEADING_MAX_WRAP_LINES` (3) lines. A run of 4+ lines always counts.
- `:1118-1124`: the display exemption's base `max(reference_size, …)` is then the title's own size, so `rule_size >= 1.5 × base` fails, and `rule_size <= reference_size × 1.25` returns False anyway.

The harness side is `.collab/scripts/parse_heading_corpus.py:108-110`: a 4+-line line at its page's body size is labelled `run`, which is not in `TO_READ`.

Round 1's F1 fix stops a 2–3-line title from setting its own page's body size. Rounds 2–3 added the display exemption so that 4-line titles stay headings. Neither covers a 4-line title that holds ≥ 30 % of its page's running text: it is then the largest substantial class, so it *is* the page body.

**(a) IR deck (`h2c_deck.py`), 960×540.**
- 4 text slides: a 28pt title over 16pt body.
- 4 divider-style slides: a 4-line 28pt title in the left half (`Hyperscale demand` / `keeps our development` / `pipeline fully` / `pre-leased into 2028`, 80 characters) and four one-line 16pt points on the right (`• 92% of 2026 deliveries already signed` …), stacked as one run of 4.

| | v3 | r1 | r2 | r3 | v5 |
|---|---:|---:|---:|---:|---:|
| Headings, 4 points | 20 | 4 | 4 | 4 | **4** |
| Headings, 3 points | 20 | — | 4 | 4 | 20 |

With 4 points, all 16 title lines are lost and the slides' text is cited under the previous slide's title. With 3 points, the points are not a counted run, the slide has under 200 running characters, the title clears the display rule against the document body (16pt), and it is kept. So one bullet more or less flips every title on the slide.

**(b) Research-note cover (`h2b_cover.py`), 612×792.**
- A 4-line 24pt title (`AI, data centres and` / `the coming surge in` / `US power demand: our` / `2030 base-case view`, 78 characters).
- Two 2-line 10pt summary paragraphs.
- Five 10pt body pages.

With summary lines of 35–45 characters, the page body is 24pt and the 4 title lines are lost: v3 9 headings, v5 5. With 50-character lines the title falls under 30 % and is kept.

**What the harness shows.** On the cover, `--old-ref main` labels the 4 lost lines `run` (`pdfs_diffs_main/h2_cover_4line_title_is_page_body.md`). The acceptance reading never sees them.

**Fix candidate H (measured).** In `_running_text_chars`, treat a run whose whole text is ≤ `HEADING_DISPLAY_MAX_CHARS` like a short run: it needs a partner or a body-size admission.

```python
short = lines[0].run_len <= self.HEADING_MAX_WRAP_LINES or lines[0].run_chars <= self.HEADING_DISPLAY_MAX_CHARS
if short and not (...):
```

Results:
- 47 corpus PDFs: **0 changes**.
- 76/76 tests.
- Deck: 4 → 20 headings. Cover: 5 → 9.
- No change on any r1–r3 repro (`check_candidates.py`).

Add a test of shape (a). Also give `run` removals whose run sets its own page's body size a reading label (see R4-6).

### R4-2 · MINOR · Round 3's two R3-1 changes undo R2-3 on R2-3's own shape when an exhibit page has a source note, or when its comment is one line (= v3 and = r2, worse than r3; not recorded)

`parse_service.py`:
- `:1010`, `:1016-1019`: `smallest` is the smallest run on the page, which is usually the source note.
- `:1067-1072`: the document body size is computed from first-look sizes only.

Both repros use R2-3's own broker-note shape:
- 2 text pages at 10pt;
- exhibit pages, each with a 12pt `Exhibit k: DRAM contract prices`, 25×6 cells at 6.5pt, and a 10pt comment;
- 4 pages of 7pt disclosures.

The document body is 7pt, because the text pages are under 25 % of the pages.

**(a) A 2-line 7pt source note under the chart (`h1_comment_over_source_note.py 2 2`).** The note is `Source: Company data, TrendForce, DRAMeXchange, Bloomberg, Morgan Stanley Research estimates. Contract` / `prices are quarterly averages …`. It is wide and sits clear of the table.

On the second look:
1. `smallest` = 7pt (the note).
2. The 3-line 10pt comment is > 1.25 × 7, so it is treated as "a title over that text" and skipped.
3. The note is admitted (7pt is the appendix's body size).
4. The page body becomes 7pt.

Output:

| | v3 | r2 | r3 | v5 |
|---|---:|---:|---:|---:|
| Headings | 98 | 18 | 2 | **18** |

- The comment `DRAM contract prices rose for a fourth straight quarter …` is in r3's chunk text and absent from v5's.
- Paragraph characters: r3 36,492 → v5 35,424.
- The note's length does not matter: a 152-character 2-line note gives the same 18 (the page then has under 200 running characters and falls to the 7pt document body). Only a one-line note or a narrow note (< 20 % of the page width), neither of which is a counted run, avoids it.
- A note touching the 6.5pt table joins the table's run (same size class) and gives 7pt in **every** version, v3 included.

**(b) Exhibit pages whose comment is one line (`h1b_first_look_doc_body.py`).** Three exhibit pages have a 3-line comment, three have a one-line comment. In r3, the three 3-line pages' second-look 10pt voted 10pt into the document body. In v5 only first-look sizes vote, so the document body is 7pt. The one-line-comment pages inherit 7pt, and their comment and exhibit title become headings again.

| | v3 | r2 | r3 | v5 |
|---|---:|---:|---:|---:|
| Headings | 100 | 20 | 2 | **8** |

The comment `… (exhibit 4) as hyperscalers` is absent from v5's chunk text.

**Assessment.** Neither repro is worse than v3, and the exhibit titles come back as a side effect. On size alone, "title over comment" (R3-1, 14 over 9) and "comment over source note" (here, 10 over 7) are the same ratio test, so this is a genuine trade, not a bug with an obvious fix. R3-1 was worse than v3 and this is v3-equal, so the trade was the right call. But the response and plan §14 describe round 3 as "0 corpus change" plus the one named R3-3 trade. Record in plan §14/§8 that short broker notes with long appendices keep v3 behaviour on exhibit pages that carry a ≥ 2-line source note or a one-line comment. The harness cannot show this with `--old-ref main`.

### R4-3 · MINOR · The R3-1 test is vacuous when the wrapped title is the page's only run (worse than v3, narrow)

`parse_service.py:1010`, `:1018`: `smallest` includes the run being tested.

**Input (`h3_title_only_run.py`).** Review r3's e4 note: a cover whose 4-line 14pt standfirst makes 14pt a body size, and 9pt body pages. Each exhibit page has:
- a **3-line** 14pt exhibit title of about 220 characters (`Exhibit k: Enterprise AI adoption rose in every region we survey, led by` / `financials and software, while industrials and the public sector still lag` / `behind, and the gap between leaders and laggards widened again this year`);
- the table;
- a one-line comment.

The title is the only run, so `smallest` is its own size and the run is admitted. Its ≥ 200 characters give the page a 14pt body.

| | v3 | r2 | r3 | v5 |
|---|---:|---:|---:|---:|
| Headings | 151 | 22 | 4 | **4** |

All 18 exhibit-title lines are lost. With a 2-line title (< 200 characters) v5 keeps them.

**Fix candidate J (measured).** Admit on the second look only body sizes that ≥ 2 pages hold (`body_sizes = sorted(s for s, n in pages_per_size.items() if n >= 2)`).
- The repro: 4 → 22.
- 76/76 tests.
- Corpus: +3 on ASML p7 (`€9.3 billion`, `€6.6 billion`, `€2.8 billion`, v3 headings, KPI callouts).
- Every other repro unchanged.

Owner's call. Otherwise record it as a residual.

### R4-4 · MINOR · The 160-character display cap is script-blind: a 4-line CJK paragraph is "display text" (= v3, worse than r3)

`parse_service.py:951-953` (`run_chars` counts code points), `:1120`. The shape guard counts a CJK character as 2 letters (`_letter_weight`, `:1090-1102`). The display cap counts it as 1, so 160 CJK characters is a three-sentence paragraph.

**Input (`h4_cjk_display.py`, synthetic `PageInfo`).**
- A CN-broker-style document: 4 pages of 10.5pt CJK body and 4 chart pages of 6.5pt labels (floors 6.5).
- Its last page has 60 lines of 7pt disclaimer (page body 7) under a 4-line 11pt paragraph of 152 characters (`本报告所载的资料、意见及推测仅反映本公司于发布本报告当日的判断，在不同时期，` …).
- 11 ≥ 1.5 × 7 and 152 ≤ 160, so the paragraph is exempt.

| | v3 | r2 | r3 | v5 |
|---|---:|---:|---:|---:|
| Headings on that page | 4 | 0 | 0 | **4** |

**Fix candidate K (measured).** Count CJK, kana and hangul twice in `run_chars`:

```python
t = blocks[i].text.strip()
chars[roots[i]] += len(t) + sum(1 for ch in t if self._letter_weight(ch) == 2)
```

Results: corpus 0 changes, including the `cn_donghai` vertical cover label (4 characters → 8). 76/76 tests. The repro: 4 → 0.

### R4-5 · MINOR · Round-3 behaviour that no test pins

These mutants of `cae9ff53` pass all 76 tests (`mut/mutations_r4.py`):
- **`run_chars` = the longest line instead of the whole run** (`:953`). This is R3-5's protection, and with it gone the R3-5 shape regresses: on `b1_display_exempt_body` (a), the 5-line, 470-character 10pt conclusion on a 5pt page becomes 5 headings again (v5 0). `test_display_exemption_thresholds` builds `CleanBlock`s with `run_chars` already set, so the summation in `_annotate_runs` is never exercised. Add an end-to-end test of the R3-5 shape.
- **Display base without `rule_floor`** (`:1118`). This is equivalent unless the dominant-size median exceeds the span-mean median (3 corpus PDFs have that).
- `second >= doc_ref` → `>`. Equivalent: it only relabels `second` as `document` with the same value.

Also, the "document body size from first-look sizes only" mutant **is** killed (by `test_document_body_size_comes_from_first_look_sizes`, which I checked with a hand-written mutant), but it is not in `parse_heading_mutations.py`. Add it, so the script keeps guarding it.

### R4-6 · MINOR · Reading rule: `run` hides R4-1, and the `second` source compares raw floats

`.collab/scripts/parse_heading_corpus.py:108-110`. A 4+-line removal whose size is its own page's body size is `run`.

Cheap addition: also read `run` removals whose run is ≤ `HEADING_DISPLAY_MAX_CHARS` and ≥ 1.5 × max(floors). On the 47 PDFs that is 81 lines:
- GS power p2 author block;
- 10-Q p65 note header (`13. Commitments, Guarantees and` / `Contingencies` at 1.2× its page body, by design);
- MS AI rate of change p8 legend;
- ASML p7 KPIs;
- `fed_feds_ai_coder` p31 table labels.

It would have caught both R4-1 repros.

Separately, `parse_service.py:1081` compares a page's second-look size with `doc_ref`, a cluster mean, as raw floats. A same-class size slightly below the mean is "ignored" and replaced by the mean. That is harmless for classification (the same class), but chicagofed p66–79 change their `sources` label from `second` to `document` (their removals are read either way).

### R4-7 · MINOR · Plan and docstring drift

- **Plan §3** (`.collab/plans/…:87-89`) is titled "the spec" but still shows the original rules, which §12–§14 replaced: the `max(document line median, …)` floor, the char-weighted document fallback, and `run_len ≤ 3` without the display exemption.
- **Plan §5** (`:150`) says "Pull quotes / standfirsts … ≥ 4 lines → guarded as body". That is no longer true for runs of ≤ 160 characters at ≥ 1.5×. `:151` (one-line bullets) is likewise incomplete (agenda rows are headings).

  Either mark the superseded rows or rewrite §3/§5 to the shipped rule. The rules bullet, plan §8 risk 7 and §14 do agree with the code.
- **Docstring** `parse_service.py:1050`: "(v4 behaviour)" should be v3 / `main`, which is what every comparison in this work is against.

---

## Checked and holding

- **The display rule cannot add a heading over v3, except through the dominant path.** A display-exempt line has `rule_size ≥ 1.5 × max(reference, both medians) > 1.25 × max(both medians)`, so it always passes the floor gate (`:1125-1129`) through its rule-size clause. It is then a v3 heading whenever its dominant size equals its span mean.
  - Short body-text runs at ≥ 1.5× (numbered short items, stacked table labels, address blocks, CJK lines: R4-4) are therefore v3's own classification. r2/r3's 2× rule had kept some as body.
  - Corpus `exempt` instances: BIS 1325 cover, the `cn_donghai` vertical label, 10-Q p52, ASML p2 and REIT p4 agenda rows, REIT p12 icon glyphs (no letters, never headings). All are titles, agenda rows, or v3 headings.
- **Floor invariant.** It is structural, and `fuzz_exceptions.py` (600 random documents with jittered sizes, rotated pages, off-axis lines, random dominant sizes and extractor titles) found no v5-only heading without a dominant-size gap and no exception.
- **Round-3 code paths.** `min(..., default=0.0)` and `second is not None` are guarded, and `sources` is optional. A directly built `CleanBlock` has `run_chars = 0`; only hand-made test blocks have it, since `_annotate_runs` sets it for every on-axis line.
- **Rules bullet vs code.** Every clause matches: the second-look admission, ignoring second-look sizes below the document body, first-look document body, the display rule's ≤ 160 / ≥ 1.5× / base, and the floors in two units.
- **Corpus record.** Every table row and total reproduces with `--old-ref main`.
- **chunk/elements agreement and cost.** Unchanged since round 3. `run_chars` is O(n).

## Not reproduced

- **A corpus instance of R4-1, R4-3 or R4-4.** `scan_display_selfref.py` lists every short 4+-line run at its own page body size. They are all body text, table columns or KPI numbers. The deck and broker shapes are where the owner's private corpus should be read.
- **Whether real broker notes put a ≥ 2-line, page-width source note clear of the table under an exhibit with a 3-line comment** (R4-2(a)). In my PyMuPDF build, a note within one line height of the 6.5pt table joins the table's run and gives 7pt in every version.
- OCR span sizes, real tategaki PDFs, and the private 50-PDF corpus, as in rounds 1–3.

## Overall (claim 5)

On the target class (chart-heavy research, a main body plus a small-type appendix, the owner's Forecasting paper), v5 is clearly better than v3:
- body text that v3 removed from chunks comes back on every corpus PDF;
- no PDF loses paragraph characters;
- the titles it gives up are body-size titles (by design and recorded), callouts, and the constructed residuals listed above.

It is safe to ship once R4-1 is fixed (or consciously accepted and recorded) and F8 is settled, pending the owner's private-corpus run (read `run-large`, `body-short`, `inherited`, `guard`, plus the R4-6 `run` subset) and the real Codex pass.

## Required before merge

1. **R4-1.** Apply candidate H or an equivalent: a display-shaped run (≤ 160 characters) must not set its own page's body size. Add a test of the 4-line-title-plus-four-points slide, and extend the reading rule (R4-6) so this class of loss is visible.
2. **F8.** Settle the version order with v4 (still `PARSE_PIPELINE_VERSION = 5`, v4 not merged).

**Recommended:**
- **R4-2:** record the trade in plan §14/§8.
- **R4-3:** decide on candidate J (+3 v3 KPI callouts on ASML) or record the residual.
- **R4-4:** candidate K (0 corpus change).
- **R4-5:** a `run_chars` end-to-end test (the R3-5 shape) and the first-look mutant in `parse_heading_mutations.py`.
- **R4-7:** doc drift.
- **R2-7:** compute `_prepare_blocks` once (unchanged).

| # | Sev | Where | Summary |
|---|---|---|---|
| R4-1 | MAJOR | `parse_service.py:1014-1021`, `:1118-1124`; harness `:108-110` | A 4-line title holding ≥ 30 % of a sparse page's running text is that page's body size and is lost (v3 finds it); labelled `run`, not read; candidate H: 0 corpus change |
| R4-2 | MINOR | `parse_service.py:1010`, `:1016-1019`, `:1067-1072` | The smallest-run test and the first-look document body put R2-3's exhibit comment back into headings when a ≥ 2-line source note or a one-line comment is present (= v3, worse than r3); unrecorded |
| R4-3 | MINOR | `parse_service.py:1010`, `:1018` | The R3-1 test is vacuous when a ≥ 200-character wrapped title is the page's only run; titles lost (worse than v3); candidate J |
| R4-4 | MINOR | `parse_service.py:951-953`, `:1120` | The 160-character display cap counts CJK as 1, so a 152-character 4-line CJK paragraph becomes headings (= v3, worse than r3); candidate K: 0 corpus change |
| R4-5 | MINOR | `tests/test_parse_service.py:1291`; `parse_heading_mutations.py` | The `run_chars` summation (R3-5's protection) and the base's rule floor are unpinned; the first-look mutant is not in the script |
| R4-6 | MINOR | harness `:108-110`; `parse_service.py:1081` | The reading rule misses R4-1 (`run`); raw-float compare of second-look size vs `doc_ref` relabels pages |
| R4-7 | MINOR | plan `:87-89`, `:150-151`; `parse_service.py:1050` | Plan §3/§5 describe superseded rules; "(v4 behaviour)" should say v3 |
