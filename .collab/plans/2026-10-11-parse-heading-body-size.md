# Parse v5: a page-level body size for the heading size rule

**Date** 2026-10-11 · **Problem owner** owner (50-PDF private corpus, heading share 41–80% on broker research) · **Designer** Claude (Fable) · **Implementer** Opus · **Review** Codex adversarial (> 30 lines of logic) · **Status** implemented on `claude/sharp-feynman-4vqkq2` (§11; corpus record `.collab/reviews/2026-10-11-parse-heading-body-size-corpus.md`); v4 (`fix/parse-heading-detection`, caps/numbered rules, `PARSE_PIPELINE_VERSION = 4`) is not on origin yet — this design is written against `main` (v3) and keeps the size predicate separable so it merges on top of v4 and bumps to **5**.

Prototype (session scratchpad, not committed; the synthetic generators are merged into `.collab/scripts/parse_heading_synth.py`): `scratchpad/fable/parse_service_v5.py` next to the untouched copy `parse_service_v3.py`; `eval.py` (variants + truth P/R), `edge_cases.py` (13 synthetic PageInfo cases), `stress.py` (timing), `make_synth2.py` (S8–S10b), `run_tests.py` (runs `backend/tests/test_parse_service.py` against the prototype: 29/29 pass). Scratchpad root: `/tmp/claude-0/-home-user-DocTalk/8245ddd5-6f1a-53f6-8438-e7d37e11ef71/scratchpad/`.

## 0. Decision in one paragraph

Keep the rule "a line is a heading when its size exceeds 1.25 × the body size", but compute the body size **per page from running text** instead of once per document from every line. Running text = on-axis lines that sit in a *paragraph run* (a same-size neighbour in the same column within one line height) and span ≥ 20 % of the page; chart labels, axis ticks, legend entries and table cells never qualify, so they can no longer drag the reference under the body. The page reference is the largest size class holding ≥ 30 % of the page's running-text characters (so 18 pt slide bullets beat 14 pt sub-bullets and 12 pt body beats 9 pt footnotes); a page with < 200 running-text characters inherits the document reference (the page reference held by ≥ 25 % of pages); and every reference is **floored at v3's document line median**, which makes the new size rule a pure precision change — it can only remove v3 headings, never add one (measured: 0 paragraph-character regressions on 33 public PDFs + 11 synthetic + 3 seed). In front of the size comparison stand two guards: a line in a run of ≥ 4 same-size lines is never a heading by size (headings may wrap to 3 lines), and a line whose digits/currency signs outnumber its letters is not a title. The line's size for this rule is the char-weighted dominant span size (a 6 pt superscript no longer drags a 14 pt heading to 11 pt); persisted element metadata keeps `font_size` unchanged. `chunk_document` and `extract_elements` consume one shared `_prepare_blocks()` list with `is_heading` already set.

Result on the owner's own document (`chicagofed_forecasting_economic_effects_ai.pdf`, 225 pp, 12 pt body, 9.18 pt line median): heading share 66.8 % → 0.5 % from the size rule (6.6 % with today's caps rule, which v4 tightens); paragraph characters 142,630 → 400,664. 13 of the 14 reproducing public PDFs fall to ≤ 1.5 % (size rule); the 14th, `cn_guosen_ai_industry_special22`, sits at 5.2 % with 67 remaining size-rule headings that are all section titles or the report's per-page key-point headers. In the eight documents whose added/removed lists were read by hand, every removed line is body text or a label and every kept line a title.

## 1. Problem and root cause

`_is_heading_block` compares `block.font_size` to `median_size * 1.25`, where `median_size` is the median over **lines** of the whole document (`chunk_document` L530–531, `extract_elements` L703–704). Broker research, working papers with many tables, and 10-Q filings have more short small-type lines (chart labels, ticks, legends, cells, footnotes) than body lines, so the median lands under the body: 9.18 pt against a 12 pt body (Forecasting), 7.85 against 10.5 (cn_guosen oil & gas), 5.99 against 10 (GS JD note), 7.00 against 10 (MS 10-Q). Every body line then clears 1.25× and is `continue`d out of chunk text in `chunk_document` (never embedded, retrieved, cited or quote-verified) and emitted as a `heading` element in `extract_elements` (becomes the `section_title` prefix of citation snippets, feeds lexical retrieval and the extraction/summary prompts).

The root cause is a single global reference drawn from a population dominated by non-body lines. Any one-number-per-document estimator inherits a version of it:

- **Char-weighted median** (owner's first attempt; prototype variant `charmed`): the appendix problem. When 7.5 pt disclosure text out-masses the 10 pt body the reference becomes 7.5 and every 10 pt line is 1.33×: `gs_commodities_energy_to_metals_2026` 31.9 % → 31.9 %, `gs_global_strategy_bear_market_anatomy` 30.5 % → 30.5 %, `gs_equity_research_jd_2019` 63.3 % → 17.3 %, `cn_guosen_ai_industry_special22` 48.4 % → 43.9 %, `ms_research_ai_rate_of_change` 42.6 % → 37.0 % (S2 synthetic: unchanged at 11.0 %). It also **regresses** every slide deck and the JPM chart deck, because the reference drops to the sub-bullet or footnote size: `slides_ms_4q25` 12.2 % → 33.6 % (−3,669 paragraph chars), `slides_ms_2q26` 16.1 % → 28.0 % (−1,424), `slides_asml` 21.4 % → 26.6 % (−703), `jpm_guide_to_markets` 8.6 % → 12.1 % (−3,346) — the owner's "UBS gets worse" generalised.
- **Char-weighted over lines ≥ 40 chars**: same two failure classes (the appendix lines are long; slide bullets are long), as the owner found.

Two body sizes in one document (main text + appendix/sidebar) cannot be represented by one number. The reference has to be local. Per-page is the right granularity: the two body sizes live on different pages in every case in both corpora; a page that mixes them (sidebar) is handled by the "largest substantial class" rule in §4.2.

## 2. Directions evaluated

Prototype variants, all measured with the harness logic (paragraph characters = paragraph *elements*, not chunk text). "Size rule only" switches the caps rule off in old and new alike so the size rule's own precision/recall against the synthetic truth lists is visible; the caps rule (v4's business) is what keeps `2025E`, `FY24`, `EV/EBITDA`, `AMD`, `TSMC` as headings in the "full" rows.

### 2.1 Synthetic truth (size rule only; P/R = heading-line precision/recall against `*.truth.json`)

| Case | v3 share | Direction 1: continuity guard + v3 median | Direction 2: per-page reference, no guard | **v5 (2 + 1 + shape + dominant size)** |
|---|---:|---:|---:|---:|
| S1 chart-heavy broker (10 pt body, 6.5 pt tables) | 28.4 % (P 11 %) | 2.8 % (+9,738 chars) | 1.0 % | **1.0 %**, P 100 % / R 56 % (+9,986 chars) |
| S2 two body sizes (10 pt + 7.6 pt appendix) | 10.9 % (P 6 %) | 0.2 % (+6,103) | 0.0 % | **0.0 %**, P 100 % / R 0 %¹ (+6,191) |
| S3 12 pt paper, 9 pt tables/footnotes | 34.9 % (P 7 %) | 0.4 % (+20,853) | 0.0 % | **0.0 %**, P 100 % / R 5 %¹ (+21,115) |
| S4 normal paper (control) | 0.1 % | 0.1 % | 0.1 % | **0.1 %**, unchanged |
| S5 CJK broker (10.5 pt body, 6.5 pt labels) | 30.0 % (P 4 %) | 1.8 % | 0.6 % | **0.6 %**, P 100 % / R 100 % (+4,680) |
| S6 slides (28/18/14 pt) | 6.2 % (P 100 %) | 6.2 % | 6.2 % | **6.2 %**, P 100 % / R 100 % |
| S7 3-line wrapped heading + callout + bullets | 66.6 % (P 17 %) | 11.0 % | 4.6 % | **4.6 %**, P 100 % / R 75 %² (+1,239) |
| S8 chart-only deck (12 pt titles, 9 pt legends, 7 pt footnotes) | 7.4 % (P 100 %) | 7.4 % | 7.4 % (**37.4 % without the floor**, −1,944 chars) | **7.4 %**, P 100 % / R 100 % |
| S9 10 pt main + 7 pt appendix with 10 pt headings | 11.6 % (P 12 %) | 0.3 % (+7,388) | 0.3 % | **0.3 %**, P 100 % / R 100 % (+7,388) |
| S10a / S10b OCR-style size jitter ±0.4 / ±1.2 pt | 1.5 / 1.4 % | unchanged | unchanged | **unchanged**, P 100 % / R 100 % |
| seeds (attention, alphabet, court) | 0.1 / 0.3 / 0.0 % | unchanged | unchanged | **unchanged** |

¹ S2's headings are 12 pt on 10 pt and 9 pt on 7.6 pt (1.18–1.2×), S3's are 14 pt on 12 pt (1.17×), S4's 12 pt on 10 pt: all below 1.25× and outside the size rule by construction. v3 "found" them only because its reference was wrong. v4's numbered rule covers `1 Section heading`, `1.1 Data …`, `2.1 Section title`; the unnumbered `References`, `Disclosure appendix`, `China Musings: theme 1` and S1's bold 11 pt `Power is the binding constraint` need a weight signal (§10). ² S7's `Key risks` is 12 pt on 10 pt (same class).

Direction 1 alone recovers most body text but leaves every 1–3-line paragraph at the wrong reference as a heading (S1 98 vs 90 headings, S7 15 vs 11, and 1.5–3 pp higher share on the public corpus: chicagofed 13.5 %, cn_* 19–26 %, ms_research 12.1 %). Direction 2 alone carries the result; direction 1 adds a 0.5–3 pp safety margin on real documents (`control_ms_10q` 1.5 → 0.9 %, `fed_feds_ai_coder` 1.5 → 0.9 %, `in_plcapital` 7.0 → 3.8 %, `slides_digital_core_reit` 15.8 → 14.3 %) and costs nothing. Direction 3 (shape) is reduced to one digit guard: width-relative-to-column and word counts do not separate a wrapped heading from a short paragraph and do not work for CJK; the run structure already encodes "paragraph".

### 2.2 Public proxy corpus (33 PDFs, `scratchpad/corpus_public/MANIFEST.md`), heading share v3 → variant

| Document (class) | v3 | char-weighted | continuity only | per-page, no guard | **v5 full** | **v5 size rule only** |
|---|---:|---:|---:|---:|---:|---:|
| chicagofed_forecasting (3; the owner's doc) | 66.8 % | 6.3 % | 13.5 % | 6.7 % | **6.6 %** | **0.5 %** |
| cn_guosen_oil_gas_monthly (2) | 81.2 % | 10.4 % | 23.4 % | 10.4 % | **10.4 %** | **0.6 %** |
| cn_galaxy_futures (2) | 75.2 % | 16.0 % | 19.0 % | 16.1 % | **16.1 %** | **0.6 %** |
| cn_sinolink_copper (2) | 67.3 % | 14.5 % | 19.8 % | 14.5 % | **14.5 %** | **0.0 %** |
| cn_guosen_ai_industry (2) | 48.4 % | 43.9 % | 26.4 % | 25.3 % | **25.3 %** | **5.2 %** |
| gs_equity_research_jd (1, two body sizes) | 63.3 % | 17.3 % | 8.3 % | 2.1 % | **2.1 %** | **1.1 %** |
| gs_commodities_energy_to_metals (1, two body sizes) | 31.9 % | 31.9 % | 2.6 % | 1.3 % | **1.3 %** | **1.2 %** |
| gs_global_strategy_bear_market (1, two body sizes) | 30.5 % | 30.5 % | 5.7 % | 1.3 % | **1.3 %** | **1.1 %** |
| ms_research_ai_rate_of_change (1) | 42.6 % | 37.0 % | 12.1 % | 2.0 % | **2.0 %** | **1.2 %** |
| fed_feds_ai_coder_employment (3) | 60.5 % | 0.8 % | 9.0 % | 1.5 % | **0.9 %** | **0.3 %** |
| control_ms_10q_q2_2026 (5) | 46.8 % | 1.9 % | 3.2 % | 1.5 % | **0.9 %** | **0.4 %** |
| slides_ms_4q25_strategic_update (4) | 12.2 % | 33.6 % ↑ | 12.1 % | 10.4 % | **10.3 %** | **10.0 %** |
| slides_asml_q2_2026 (4) | 21.4 % | 26.6 % ↑ | 7.9 % | 4.5 % | **4.5 %** | **3.4 %** |
| jpm_guide_to_markets (1, chart deck) | 8.6 % | 12.1 % ↑ | 8.6 % | 8.5 % | **8.4 %** | **7.0 %** |
| controls: equinix 10-K, 2 arXiv, ubs_cio_aug | 0.3 / 0.4 / 0.4 / 1.6 % | same | same | same | **same** | **same** |
| PDFs whose paragraph characters fell | — | **4** | 0 | 0 | **0** | **0** |

The remaining share in the "full" column is the current caps rule on chart text (`cn_guosen_ai_industry`: `AI`, `GPU`, `FY26Q3`; chicagofed: ~1,950 all-caps table cells); v4 owns that. Hand-read lists (`scratchpad/fable/diffs_size/*.md`): chicagofed keeps `1. Introduction … 5. Discussion, References, Appendix, A.–D., Table 21: …` and removes body sentences and the author list; `cn_guosen_oil_gas` keeps exactly its 14 real headings (`核心观点`, `1、9 月回顾…`, `风险提示`, `免责声明`); `gs_global_strategy_not_in_bubble_yet` keeps the title, deck sub-title and the disclosure-appendix headings; `edison_games_workshop` keeps its 15 section titles; `ms_research_ai_rate_of_change` keeps `Key Takeaways`, `Exhibit 45: …`, regional headings. Lines v5 still calls headings that a human would not: 2–3-line standfirsts set larger than body (`Alberto Ramos explores what developments / in Venezuela could mean …`), slide big-number callouts with a word (`$540 million`, `3.5 Years`) — all already headings in v3 (§8).

### 2.3 Why not 1.15× (measured, not adopted for v5)

With a correct reference the factor could drop. `size_only_f115` recovers the unnumbered 12-on-10 headings of the attention paper (`Abstract, Introduction, Model Architecture, Results, References`: 1 → 14 headings) and S2/S4 recall goes 0 → 100 %, but it also adds body text on five documents (`jpm` −3,104 paragraph chars, `control_equinix_10k` −1,321, `control_ms_10q` 48 → 224 headings, `bis_wp1367` −596, `arxiv_2508` −350) and the 3-line copyright notice of the attention paper. The owner's acceptance rule forbids that trade without a weight signal. v5 keeps 1.25; §10 lists 1.15 + bold as the follow-up.

## 3. Definitions (the spec)

All geometry is in unrotated page points as `BlockInfo.bbox` already is; `vertical` = the page's dominant line angle (from `_dominant_line_angle`, the same call `clean_text_blocks` makes) is 90° or 270°. "Along" is the reading direction (x, or y when `vertical`); "across" is the other axis. Page extent along = `band_w` (`band_h` when vertical) from `_band_dims`.

| Term | Definition |
|---|---|
| **rule size** `rule_size` | `BlockInfo.dominant_size` when > 0, else `font_size`. `dominant_size` (new, §4.1) = the span size class holding the most characters on the line (ties → larger). |
| **same size class** | `abs(a − b) ≤ max(0.35, 0.08 × max(a, b))`. 8 % is wide against the 25 % heading factor and tight against a 9 pt caption beside 10 pt body (10 %). |
| **neighbour** (A above B) | same size class; across-extents overlap by ≥ 30 % of the narrower line (same column); `B.lo − A.hi ≤ 1.0 × max(h_A, h_B)` (next line starts within one line height; single and 1.5 leading and paragraph spacing pass; Word "Double" spacing (2.3× pitch) does not (review r1 F5: such body classifies as in v3)); `B.lo ≥ A.lo + 0.5 × h_A` (B is below A, not a cell beside it). Off-axis lines (`CleanBlock.off_axis`) never take part. |
| **run**, `run_len` | connected component of the neighbour relation on one page; `run_len` = its line count (1 = isolated). |
| **running text** (reference candidates) | on-axis lines with `run_len ≥ 2` whose along-extent ≥ 0.20 × page extent along. Excludes cells, ticks, legend entries, source lines (short), and isolated lines of any size (a heading, a pull quote of one line, a big number). |
| **page reference** | cluster running-text characters by size class (1-D clustering with the same tolerance); if the page has < 200 running-text characters → none; else the **largest** cluster holding ≥ 30 % of those characters (fallback: the heaviest cluster). |
| **document reference** | largest page-reference class held by ≥ 25 % of the pages that have one (fallback: heaviest); if no page has one → char-weighted median of all running text; if none → median of every line's rule size (v3's value); if no lines → 12.0. |
| **reference for page p** | `max(document line median, page reference of p or document reference)`. The floor is v3's own reference, so `size > 1.25 × reference` is at least as strict as v3 everywhere. |
| **heading by size** | `run_len ≤ 3` and `rule_size > 1.25 × reference` and (letters ≥ 2 and letters > count of digits and `$€£¥%‰`). |

Thresholds and the measured sensitivity: factor **1.25** (§2.3); wrap limit **3** (S7's 3-line title; `full_wrap5` identical on every corpus); gap **1.0** line height; overlap **0.30**; line extent **0.20** of the page; min page chars **200**; substantial share **0.30** (`0.20` loses one S10b heading because jittered body sizes split into two clusters and the larger wins; `0.40` identical to 0.30 on every corpus); page share **0.25**; size tolerance **8 % / 0.35 pt**.

## 4. Implementation

### 4.1 Extraction (`_extract_line_blocks`)

Add `BlockInfo.dominant_size: float = 0.0`. While summing span sizes, also accumulate `size → len(span text.strip())`; `dominant_size = max(size_chars.items(), key=(chars, size))[0]` or 0.0 when no span has text. `font_size` (plain span mean) is unchanged and remains what `extract_elements` writes to `metadata_json["font_size"]` — nothing persisted changes. Measured on 30,039 lines of six real PDFs: 1.85 % of lines differ by > 8 %, 491 of 555 upward (superscripts/footnote markers lowering the mean: `Forecasting the Economic Effects of AI∗` reads 17.5 → 20.7 pt). Non-PDF extractors (`parse_worker` L486–514, DOCX/PPTX/XLSX/TXT) never set it → `rule_size = font_size` as today. Also add `CleanBlock.rule_size: float = 0.0`, `run_len: int = 1`, `is_heading: bool = False`; `clean_text_blocks` fills `rule_size` from the BlockInfo.

### 4.2 Shared preparation (`_prepare_blocks`)

```python
def _prepare_blocks(self, pages: Sequence[PageInfo]) -> List[CleanBlock]:
    """Clean, order, annotate and classify every line once; chunk_document and
    extract_elements both consume this list, so a line is a heading in one iff
    it is a heading in the other."""
    header_texts, footer_texts = self._detect_header_footer_texts(pages)
    document_angle = self._document_line_angle(pages)
    per_page: List[Tuple[PageInfo, bool, List[CleanBlock]]] = []
    for p in pages:
        cleaned = self.clean_text_blocks(p.blocks, p.width_pt, p.height_pt, header_texts=…, footer_texts=…, rotation=p.rotation, fallback_angle=document_angle)
        if not cleaned: continue
        for cb in cleaned:
            if cb.rule_size <= 0: cb.rule_size = cb.font_size      # CleanBlocks built elsewhere (tests)
        band_w, band_h = self._band_dims(p.width_pt, p.height_pt, p.rotation)
        vertical = int(self._dominant_line_angle(p.blocks, band_w, band_h, document_angle)) % 180 == 90
        self._annotate_runs(cleaned, vertical=vertical)                # sets run_len
        per_page.append((p, vertical, self._order_blocks_for_reading(cleaned, p.width_pt, p.height_pt)))
    refs = self._reference_sizes(per_page)                            # {page_number: reference}
    out = []
    for p, _v, ordered in per_page:
        for cb in ordered:
            cb.is_heading = self._is_heading_block(cb, refs[p.page_number])
            out.append(cb)
    return out
```

`chunk_document` and `extract_elements` drop their own clean/order/median loops and iterate this list (`if cb.is_heading:` / `is_heading = block.is_heading`); `page_dims` is built from `pages` as before. The `statistics.median` import stays (document line median).

### 4.3 Helpers

- `_annotate_runs(blocks: List[CleanBlock], vertical: bool = False) -> None` — sort indices by (along-lo, across-lo); sweep with an *active* list of earlier lines still within reach (`lo − j.hi ≤ 1.0 × max line height on the page`; cap the list at 400 entries); for each active candidate apply the neighbour predicate and union-find; `run_len` = component size. Skip off-axis lines on both sides. Cost O(n log n + n·k), k = lines within one line height (cells of one table row). Measured: 224 pages × 500 lines (112k lines) 3.4 s; a 3,000-cell table page 0.23 s; 5,000 lines in one band 0.78 s; the 225-page Forecasting paper 1.4 ms/page inside `extract_elements` — negligible against the 600 s task limit.
- `_running_text_weights(blocks, vertical, band_w, band_h) -> dict[size, chars]`, `_page_reference(weights) -> Optional[float]`, `_cluster_sizes(weights) -> List[(representative, weight)]`, `_weighted_median(weights, default)`, `_reference_sizes(per_page) -> dict[int, float]` exactly as in §3 (prototype code is the reference implementation).
- `_is_heading_by_size(block: CleanBlock, reference_size: float) -> bool` — the size predicate with its two guards (§3, last row). Kept as its own method so v4's caps/numbered predicates sit beside it untouched.
- `_is_heading_block(block: CleanBlock, reference_size: float) -> bool` — second parameter renamed from `median_size`; same early exits as today in the same order: empty / > 220 chars → False; `off_axis` or arXiv id → False (v3); ends with a sentence delimiter and > 45 chars → False; no letter/CJK → False; **then `_is_heading_by_size`**; then v4's caps rule and numbered rule unchanged. The continuity guard gates only the size rule (a same-size bold caps heading often sits inside its paragraph's run; v4 may *choose* to read `run_len` for the numbered rule, where numbered list items are the classic false positive — measure with the harness before doing so).

### 4.4 What does not change

`clean_text_blocks` signature and the v3 margin rules; `_order_blocks_for_reading`; chunk assembly, overlap, micro-chunk merging; element metadata (`font_size`, `section_title`, `parent_reading_order`); the dispatch contract; the non-PDF path (its unit-box bboxes never qualify as running text, so it lands on the line-median fallback = v3 behaviour, verified).

## 5. Edge cases (each verified in `edge_cases.py` against the prototype)

| Case | Outcome |
|---|---|
| Two-column page | columns never overlap across, so runs stay per column; a full-width heading overlaps both and is its own run of 1; reference from both columns' running text. |
| CJK (no spaces) | no word counts anywhere; running text qualifies by geometric extent (a 31-char 10.5 pt line is 54 % of the page); S5 and `cn_*` 0.0–5.2 %. |
| Slides | wrapped 18 pt bullets form runs at 18 and 14 pt sub-bullets at 14; both ≥ 30 % → reference 18 → only the 28 pt title. Alternating one-line bullets form no runs → document fallback → line median (v3), which S6 shows is right (char-weighted is not). |
| OCR'd PDFs | sizes within 8 % still form runs; beyond that (S10b, ±1.2 pt) runs break, the reference falls back to the line median and classification equals v3 (OCR output is mostly body lines, so that median is the body). |
| Tables and chart labels | short → never running text; smaller than the reference → never headings; the floor keeps 9 pt legend entries on a 7 pt-footnote chart page out (S8, JPM: without the floor 168 / 59 legend entries became headings). |
| Superscripts lowering the mean | `dominant_size` restores the line to its paragraph's class (and a 14 pt heading with a footnote marker is detected again). |
| Pull quotes / standfirsts larger than body | ≥ 4 lines → guarded as body; 2–3 lines → heading (residual, §8). A 12 pt quote on a 10 pt page is 1.2× → body regardless. |
| One-line bullets | consecutive same-size bullets are neighbours (a run), so a list is body; a 12 pt list on a 10 pt page is 1.2× → body; a 13 pt one-line list of ≤ 3 items → headings (residual). |
| Single-page documents | page reference from that page; no runs → line median. |
| Pages with only charts | < 200 running-text chars → document reference (floored) → chart labels stay body; a 2-line 10 pt comment on such a page stays body (reference 10). |
| Rotated pages | bboxes are unrotated; `vertical` follows the page's dominant angle, so runs are measured along the actual reading direction. |
| Vertical writing (tategaki) | columns are runs along x; the larger column is the heading; `vertical_writing` lines keep the v3 "always body, never a stamp" rule. |
| Two body sizes (main + appendix) | S9: main 10 pt body kept, 10 pt headings on 7 pt appendix pages detected (page reference 7 → 8.75 threshold) — the case neither v3 nor a char-weighted median can express. |
| Number callouts at display size | `+12%`, `2026E`, `Q3 2025`, `P` rejected by the size rule; `U.S.`, `Exhibit 12: Capex`, `1. Introduction` eligible; `US$ 4.2bn` (4 letters vs 3 figures) still passes — residual. |
| Non-PDF extractor path | 18 pt synthetic title + 12 pt body per page → line-median fallback → identical to v3. |

## 6. Test plan (`backend/tests/test_parse_service.py`, synthetic `PageInfo` unless noted)

Build pages with a helper `body_lines(page, x, y0, n, size, width)` (n stacked lines at 1.25× leading). "Fails on v3" = would fail against today's code.

| Test | Input | Expected | v3 |
|---|---|---|---|
| `test_chart_heavy_page_body_is_not_a_heading` | 14 pt heading, 8 × 10 pt body lines, 72 × 6.5 pt cells (line median 6.5) | headings == {heading}; all body sentences in chunk text | fails (body → headings) |
| `test_two_body_sizes_keep_main_body_and_find_appendix_headings` | 2 pages 14 pt heading + 20 × 10 pt lines; 3 pages 10 pt heading + 60 × 7 pt lines | 5 headings exactly; `section_title` of appendix chunks is the appendix heading | fails |
| `test_chart_page_short_comment_uses_document_reference` | page 1 body at 10 pt; page 2 180 cells at 6.5 pt + a 2-line 10 pt comment | comment lines are paragraphs | fails |
| `test_slides_wrapped_bullets_are_body` | 3 slides: 28 pt title, 2-line 18 pt bullets, 14 pt sub-bullets | only titles are headings | passes (regression guard) |
| `test_superscript_does_not_hide_a_heading` | `BlockInfo(font_size=11.0, dominant_size=14.0)` over 10 pt body | heading | fails |
| `test_extract_line_blocks_records_dominant_size` | PyMuPDF-style line dict with spans 14 pt ×"Results" and 8 pt ×"1" | `dominant_size == 14.0`, `font_size == 11.0` | fails (field missing) |
| `test_wrapped_heading_up_to_three_lines` | three 18 pt lines, then four 14 pt standfirst lines, then 10 pt body | three heading lines; standfirst and body are paragraphs | fails (standfirst → headings) |
| `test_one_line_bullets_are_body` | 16 pt heading, 10 pt body, three 12 pt one-line bullets | only the heading | passes |
| `test_non_pdf_extractor_path_keeps_section_titles` | unit-box blocks as `parse_worker` builds them, titles on pages 1 and 3 | both titles are headings | passes |
| `test_vertical_writing_runs_follow_the_reading_axis` | 12 tategaki 10 pt columns + one 14 pt column (`direction=(0,1)`, `vertical_writing=True`) | the 14 pt column is the heading | passes |
| `test_cjk_broker_page` | 14 pt CJK heading, 10 × 10.5 pt CJK lines, 40 × 6.5 pt labels | only the heading | fails |
| `test_size_rule_rejects_number_callouts` | `_is_heading_by_size` on 28 pt `CleanBlock`s: `+12%`, `Q3 2025`, `2026E`, `P` → False; `U.S.`, `Exhibit 12: Capex`, `1. Introduction` → True | as listed | fails (method missing) |
| `test_annotate_runs` | 5-line paragraph, isolated heading, two columns, a 2-cell row, a line 2 line-heights below | `run_len` 5 / 1 / per column / 1 each / 1 | fails |
| `test_reference_floor_keeps_chart_legends_body` | S8-shaped page: 12 pt title, 9 pt legend entries, 3 × 7 pt footnote lines; document of 3 such pages | legend entries are paragraphs, titles are headings | passes (guards the floor) |
| `test_chunk_document_and_extract_elements_agree` | any page above | heading set from elements == lines absent from chunk text and present as `section_title` | passes |
| `test_seed_pdfs_headings_do_not_regress` (reads `backend/seed_data/*.pdf`) | per seed: title (`Attention Is All You Need`) is a heading; a known body sentence from each seed is a paragraph; heading count equals the pinned v3/v4 count | as listed | passes |
| existing 29 tests | — | unchanged (verified: 29/29 against the prototype) | — |

## 7. Measurement acceptance (what the owner re-runs on the private 50-PDF corpus)

`cd /home/user/DocTalk && $PY .collab/scripts/parse_heading_corpus.py --old-ref <v4 commit> --new-path backend/app/services/parse_service.py --pdf-dir <private corpus> --pdf-dir backend/seed_data --pdf-dir <scratchpad>/corpus_public --pdf-dir <scratchpad>/corpus_synth --out-md … --diff-dir …`

Pass criteria:
1. **Paragraph characters rise or hold on every PDF** (the harness footer: "paragraph characters fell in 0"). The floor makes this true by construction for the size rule; the only legitimate exception is a heading that `dominant_size` newly exposes (a title with a footnote marker), which must appear in the added list as a real heading.
2. The nine documents the owner named (79.9 % Data center … 40.9 % Alibaba) and `Forecasting the Economic Effects of AI` all land ≤ 10 % with the caps rule as v4 ships it and ≤ 3 % with the size rule alone — or, above 3 %, every remaining size-rule heading is a title on inspection (public analogue: 13/14 reproducing PDFs ≤ 1.5 % size-only, `cn_guosen_ai_industry` 5.2 % with all 67 remaining headings titles; ≤ 25.3 % with today's caps rule).
3. No-regression set (slides, 10-K, arXiv, UBS CIO, JPM guide, seeds): heading count and share within ±1 heading of v4; `gs_us_power_surge_datacenters` (10 pt body exactly at v3's 10.00 threshold) must show its body as paragraphs.
4. Read the `--diff-dir` lists for at least five documents: every *removed* heading is body text or a label; every *kept* heading is a title, caption or standfirst; no numbered section heading disappears.
5. Timing: `extract_elements` ≤ 10 ms/page on the slowest document (public max 5.5 ms/page).

Public corpus result of the prototype (final run; the owner's table should read like this):

| Document | Class | Pages | Size rule only: headings | share | paragraph chars (Δ) | With caps rule: share |
|---|:-:|---:|---:|---:|---:|---:|
| edison_games_workshop_2026.pdf | 1 | 7 | 161 → 15 | 36.2% → 1.5% | 16,162 → 24,977 (+8,815) | 36.9% → 2.2% |
| gs_commodities_energy_to_metals_2026.pdf | 1 | 12 | 159 → 11 | 31.9% → 1.2% | 25,518 → 37,016 (+11,498) | 31.9% → 1.3% |
| gs_equity_research_jd_2019_dfcfw.pdf | 1 | 16 | 439 → 20 | 62.2% → 1.1% | 23,292 → 61,027 (+37,735) | 63.3% → 2.1% |
| gs_global_strategy_bear_market_anatomy.pdf | 1 | 20 | 248 → 20 | 30.3% → 1.1% | 38,895 → 55,193 (+16,298) | 30.5% → 1.3% |
| gs_global_strategy_not_in_bubble_yet.pdf | 1 | 29 | 421 → 13 | 47.3% → 0.6% | 35,170 → 66,318 (+31,148) | 47.5% → 0.8% |
| gs_strategy_long_term_returns_10y.pdf | 1 | 31 | 452 → 17 | 44.3% → 0.8% | 39,658 → 70,610 (+30,952) | 44.6% → 1.1% |
| gs_tom_genai_too_much_spend.pdf | 1 | 31 | 91 → 46 | 3.0% → 1.2% | 135,468 → 138,075 (+2,607) | 3.3% → 1.4% |
| gs_us_power_surge_datacenters.pdf | 1 | 35 | 86 → 32 | 3.1% → 1.5% | 82,346 → 83,760 (+1,414) | 3.5% → 1.8% |
| in_plcapital_tcs_q2fy27.pdf | 1 | 10 | 52 → 21 | 5.8% → 1.5% | 27,926 → 29,176 (+1,250) | 8.0% → 3.8% |
| ing_monthly_economic_update_may2026.pdf | 1 | 35 | 87 → 29 | 6.2% → 1.3% | 57,208 → 60,211 (+3,003) | 6.6% → 1.7% |
| jpm_guide_to_markets_us.pdf | 1 | 71 | 342 → 333 | 7.1% → 7.0% | 88,932 → 89,088 (+156) | 8.6% → 8.4% |
| ms_research_ai_rate_of_change.pdf | 1 | 60 | 1123 → 51 | 41.8% → 1.2% | 94,084 → 159,805 (+65,721) | 42.6% → 2.0% |
| ms_research_bridging_datacenter_financing_gap.pdf | 1 | 39 | 133 → 56 | 3.0% → 1.6% | 126,236 → 127,959 (+1,723) | 3.1% → 1.9% |
| ubs_cio_house_view_aug2026.pdf | 1 | 28 | 58 → 58 | 1.2% → 1.2% | 80,822 → 80,822 (+0) | 1.6% → 1.6% |
| cn_donghai_oil_price_cycles_review.pdf | 2 | 27 | 72 → 34 | 8.5% → 1.2% | 32,846 → 35,464 (+2,618) | 21.9% → 14.6% |
| cn_galaxy_futures_macro_commodities.pdf | 2 | 17 | 277 → 10 | 70.1% → 0.6% | 4,643 → 15,429 (+10,786) | 75.2% → 16.1% |
| cn_guosen_ai_industry_special22.pdf | 2 | 38 | 262 → 67 | 37.3% → 5.2% | 18,515 → 27,992 (+9,477) | 48.4% → 25.3% |
| cn_guosen_oil_gas_monthly_sep2026.pdf | 2 | 27 | 397 → 14 | 77.2% → 0.6% | 6,346 → 27,622 (+21,276) | 81.2% → 10.4% |
| cn_sinolink_nonferrous_copper_weekly.pdf | 2 | 16 | 245 → 2 | 64.9% → 0.0% | 6,447 → 18,338 (+11,891) | 67.3% → 14.5% |
| cn_swsc_dram_memory_ai.pdf | 2 | 31 | 34 → 22 | 1.2% → 1.0% | 38,785 → 38,855 (+70) | 22.7% → 22.5% |
| bis_wp1325_ai_adoption_european_firms.pdf | 3 | 36 | 29 → 21 | 0.8% → 0.6% | 66,486 → 66,603 (+117) | 0.8% → 0.6% |
| bis_wp1367_ai_investment_race.pdf | 3 | 56 | 20 → 15 | 0.2% → 0.2% | 122,967 → 122,978 (+11) | 0.4% → 0.4% |
| chicagofed_forecasting_economic_effects_ai.pdf | 3 | 225 | 3830 → 46 | 60.7% → 0.5% | 168,666 → 427,030 (+258,364) | 66.8% → 6.6% |
| fed_feds_ai_coder_employment.pdf | 3 | 57 | 881 → 17 | 60.5% → 0.3% | 43,446 → 109,504 (+66,058) | 60.5% → 0.9% |
| fed_feds_cyclical_frictions_productivity.pdf | 3 | 117 | 117 → 28 | 1.2% → 0.4% | 181,767 → 183,158 (+1,391) | 2.2% → 1.5% |
| slides_asml_q2_2026_investor.pdf | 4 | 18 | 76 → 20 | 20.4% → 3.4% | 10,662 → 12,941 (+2,279) | 21.4% → 4.5% |
| slides_digital_core_reit_jun2026.pdf | 4 | 39 | 351 → 243 | 19.8% → 11.8% | 33,612 → 36,976 (+3,364) | 22.5% → 14.3% |
| slides_ms_2q26_fixed_income_investor.pdf | 4 | 11 | 31 → 16 | 15.3% → 3.4% | 10,095 → 11,515 (+1,420) | 16.1% → 4.1% |
| slides_ms_4q25_strategic_update.pdf | 4 | 21 | 99 → 80 | 11.9% → 10.0% | 15,078 → 15,405 (+327) | 12.2% → 10.3% |
| control_arxiv_1706_03762_attention.pdf | 5 | 15 | 1 → 1 | 0.1% → 0.1% | 38,366 → 38,366 (+0) | 0.4% → 0.4% |
| control_arxiv_2508_02992_memory_specialization.pdf | 5 | 9 | 2 → 2 | 0.2% → 0.2% | 43,983 → 43,983 (+0) | 0.4% → 0.4% |
| control_equinix_10k_fy2025.pdf | 5 | 231 | 10 → 10 | 0.0% → 0.0% | 796,670 → 796,670 (+0) | 0.3% → 0.3% |
| control_ms_10q_q2_2026.pdf | 5 | 79 | 3277 → 48 | 46.4% → 0.4% | 168,005 → 312,280 (+144,275) | 46.8% → 0.9% |

33 PDFs; paragraph-character regressions (size rule only): 0

Classes: 1 sell-side/bank research, 2 CN broker (券商研报), 3 econ/policy working paper, 4 investor slides, 5 control. "Size rule only" runs old and new with the caps rule off, so its v3 shares are slightly below the manifest's (which include caps-rule headings); "With caps rule" is the complete classifier as it stands on `main` today. Every share drop is body text returned to paragraphs; the lists under `scratchpad/fable/diffs_size/` show which lines moved.

## 8. Risks and residual failure modes

1. **Headings under 1.25× are invisible to the size rule** (12 pt on 10 pt, 14 pt on 12 pt, bold-only sub-heads). v3 caught some only through its broken reference; v5 loses those accidental catches in the broken documents and gains nothing elsewhere. v4's numbered rule covers numbered ones; `References`, `Key risks`, `Disclosure appendix`, bold 11 pt sub-heads need a weight signal (§10). Measured recall on synthetic truth: S2 0 %, S3 5 %, S4 7 %, S1 56 % — identical to what v3 scores on correctly-measured documents.
2. **2–3-line standfirsts, deck sub-titles and pull quotes set larger than body** become headings (cover blurbs in `ms_research_ai_rate_of_change`, `gs_tom_*`). Also true in v3; they are title-like, one per page, and their text is usually repeated in the body.
3. **Big-number callouts with a word** (`$540 million`, `3.5 Years`, `US$ 4.2bn`) pass the digit guard (as in v3).
4. **A page whose running text is dominated (≥ 30 %) by text larger than the body** (a long 12 pt box on a 10 pt page) raises that page's reference, so its 14 pt headings need > 15 pt. Appears on no corpus page; would only lose headings, never body.
5. **Pages inheriting the document reference** when 25 %+ of referenced pages have a larger body (long 12 pt executive summary in a 10 pt report): sparse pages' 14 pt headings missed. Loses headings only.
6. **OCR noise > 8 %**: no runs → v3 classification on that document (no guard, line-median reference).
7. **Headings wrapping to ≥ 4 lines** are body unless the whole run is ≤ 160 characters and ≥ 1.5× max(page body, both medians). Not rare: the BIS working-paper cover wraps its 22pt title to 4 lines (review r2 R2-2, r3 R3-2); agenda slides and the MS 10-Q p52 header stack are exempt the same way (as in v3). A 4-line display text over 160 characters is body.
8. The floor means v5 **cannot** detect a heading on a page whose body is smaller than the document's median line unless the heading also clears 1.25 × that median: appendix headings in documents whose line median already sits on the main body. Loses low-value headings only; the alternative (no floor) adds chart legends as headings (S8 7.4 → 37.4 %, JPM −775 chars).
9. `chunk_document` still sets `section_title` from the *last* line of a wrapped heading (`the HBM transition`); unchanged behaviour, see §10.

## 9. Rollout and version bump

- `PARSE_PIPELINE_VERSION = 5` (v4 = 4). Extend the constant's comment: "v5 = page-level body size from paragraph runs, floored at the document line median; continuity and digit guards on the size rule; dominant span size".
- Demo documents re-parse themselves: `demo_seed.refresh_stale_demo_parses()` (startup + 30-min beat) claims `ready` demo rows with `parse_version IS NULL OR < PARSE_PIPELINE_VERSION`, re-checks the stored object, flips to `parsing` with `parse_requested_locale = NULL` in one conditional UPDATE, commits, then `.delay()`s — in place, same id (`demo_seed.py` L267–335, read, not redesigned). Nothing to add.
- User documents are not re-parsed automatically. Backfill the affected ones with `scripts/find_low_quality_docs.py` (skips `parse_version >= 5`; `--force` not needed) or, better targeted, a one-off query of documents whose heading-element characters exceed 30 % of element text; re-parse goes through the existing reparse path (download first, vectors then rows, never a terminal status for a transient error). Saved quotes keep their snapshots (`source_chunk_id` ON DELETE SET NULL).
- Element metadata is unchanged, so no migration. Chunk boundaries change for re-parsed documents (more body text), which is the point.
- Docs to update in the same commit: `.claude/rules/backend.md` Parse Worker (a v5 bullet after the parse-v3 margin bullet), `AGENTS.md` mirror, `docs/ARCHITECTURE.md §10` entry; this plan's §7 table gets the private-corpus numbers.
- Codex adversarial review before merge (CLAUDE.md: > 30 lines of logic). Suggested review focus: the floor invariant (size rule never adds a v3 heading except via `dominant_size`), the sweep's pruning bound, and the non-PDF path equivalence.

## 10. Follow-ups the owner can choose (not in v5)

1. **Weight signal**: record `BlockInfo.bold: bool` from PyMuPDF span flags (bit 4) / font name containing "Bold" for the dominant span, and add a rule "bold, `run_len ≤ 3`, ≥ 1.0× reference, ≤ 90 chars, no trailing sentence delimiter → heading". This is the only way to the bold 11 pt sub-heads and `References`-class titles; measure it with the same harness.
2. **Factor 1.15** paired with (1) and v4's numbered rule, re-measured on the private corpus (§2.3 numbers).
3. **Join consecutive heading lines** into one `section_title` in `chunk_document` (and one `heading` element span) so a wrapped title is cited as `Why the memory upcycle has further to run: pricing, capacity discipline and the HBM transition`.
4. Let v4's numbered rule read `run_len` (numbered list items are runs).
5. Strip closing quotes/brackets before the "ends with a sentence delimiter" test so a quoted pull quote (`…doubles.”`) is rejected like an unquoted one.

## 11. Implementation notes (Opus, 2026-10-11)

Implemented as specified, with the measurement knobs dropped. Deviations, each re-measured on all 47 PDFs:

1. **Floor = the exact v3 reference**: the median of `font_size` (span mean) over every cleaned line, not the median
   of `rule_size` the prototype used. The invariant then reads exactly: the size rule adds a heading over v3 only
   where `dominant_size` exceeds a span mean that a smaller span (superscript, footnote marker, trailing
   whitespace span) pulled down. Against the prototype this changes one PDF: `fed_feds_cyclical_frictions_productivity`
   keeps the five title-page headings v3 had (the paper title, its second line and three author names; the
   prototype's higher `rule_size` median raised the floor above them). The other 46 PDFs are identical apart
   from item 2.
2. **Bare-address guard** in `_is_heading_by_size`: a line that is only a URL or e-mail address is never a heading
   by size. Found during implementation: `www.plindia.com` (9pt beside an 8pt whitespace span, span mean 8.52pt)
   became a heading on a 5pt disclosure page once `dominant_size` read it as 9pt.
3. `max_h` (the sweep's pruning bound) is taken over on-axis lines only, so a rotated label cannot widen it; it
   bounds the per-pair gap test from above, so pruning never drops a neighbour.
4. Tests: 19 in `TestHeadingSizeUsesPageBodySize` (§6 plus `test_page_body_size_is_the_largest_substantial_size`,
   `test_vertical_page_runs_stack_along_x`, `test_dominant_size_does_not_reach_element_metadata` and a fake-bold
   duplicate line in `test_annotate_runs`), added so that every ingredient of the rule fails a test when removed.
   `test_demo_seed_storage.py` now reads `PARSE_PIPELINE_VERSION` instead of a literal 3.
5. Docs: `.claude/rules/backend.md` Parse Worker bullet, `docs/ARCHITECTURE.md` step 3. `AGENTS.md` does not mirror
   the path-scoped rules; no CHANGELOG entry (the v3 margin fix has none either; release notes are written at
   release).

Open until v4 lands: this branch is based on `main` (v3). Merging v4 needs `PARSE_PIPELINE_VERSION = 5` kept, v4's
caps/numbered predicates placed after `_is_heading_by_size` in `_is_heading_block`, and the corpus re-run with
`--old-ref <v4 commit>`.

## 12. Review round 1 (2026-10-11)

Fresh-context review (`.collab/reviews/2026-10-11-parse-heading-body-size-review-r1.md`), response with evidence in
`…-review-r1-response.md`. Changes to the spec above:

- **Floors (§3 "reference for page p")**: no longer `max(document line median, …)`. A line must clear 1.25× its page
  body (own or inherited) AND 1.25× the document median line in at least one unit — span mean or dominant size.
- **Running text (§3)**: a run of ≤ 3 lines counts only when the page has another run of its size.
- **Document reference (§3)**: share measured over ALL pages; with no class at ≥ 25% of pages, pages without their own
  body size use the floors only. The char-weighted fallback over running text is removed.
- **Shape guard (§3 last row)**: CJK/kana/hangul count 2 letters, combining marks 1; extractor titles
  (`BlockInfo.extractor_title`, set by `parse_worker`) skip the shape guards.
- **Sweep (§4.3)**: one sweep per chain of same-size sizes; overlap tested first.
- Corpus after the round: 47 PDFs, paragraph characters fell in 0; the targets unchanged (chicagofed 66.8% → 6.6%).

## 13. Review round 2 (2026-10-11)

Fresh-context review (`.collab/reviews/2026-10-11-parse-heading-body-size-review-r2.md`), response in
`…-review-r2-response.md`. Changes to the spec:

- **Running text**: a run counts only with ≥ 2 lines spanning 20% of the page (R2-1: a chart subtitle plus its top
  axis tick made "runs" that partnered each other and set JPM p18/p29's body to the subtitle size).
- **Second look (R2-3)**: a page still without a body size re-reads its runs, and a lone 2–3-line run counts if its
  size is another page's body size (a broker exhibit page's one comment paragraph).
- **Display exemption (R2-2)**: the continuity guard does not apply at ≥ 2× max(page body, both medians).
- **Floor (R2-4)**: the dominant size is compared with the larger of the two medians.
- **Accepted loss (R2-1(b), constructed only)**: an IR slide whose 2×2 tiles each have a 2-line title larger than
  the tile text — the four short title runs partner each other, hold ≥ 30% of the running text and become the page
  body, so the tile titles are not headings (v3 found them through its floor). Distinguishing "four titles over four
  paragraphs" from "four short paragraphs" needs layout pairing; candidate W (round 1) added body headings on 3 real
  PDFs instead. No corpus PDF has the shape at ≥ 1.25×.
- **Not done (R2-7)**: computing `_prepare_blocks` once for both worker calls. Dense table pages cost ~2.5× v3
  (137–184 ms against 57–68 ms per 3,300-line page); embedding such documents dominates either way.
- Corpus: 47 PDFs, paragraph characters fell in 0; chicagofed 66.8% → 6.3%.

## 14. Review round 3 (2026-10-11)

Fresh-context review (`.collab/reviews/2026-10-11-parse-heading-body-size-review-r3.md`), response in
`…-review-r3-response.md`. Changes to the spec:

- **Second look (R3-1, R3-3)**: a lone short run admitted only because its size is another page's body size must not be
  over 1.25× the page's smallest run (a wrapped exhibit or slide title over the page's text stays a title, whatever page
  uses its size as body); the document body size comes from first-look sizes only; a second-look size below the
  document body size is ignored (a 7pt source note under an exhibit).
- **Display exemption (R3-2, R3-5)**: replaces round 2's 2× rule. A run of ≥ 4 lines is exempt from the continuity
  guard when the whole run is ≤ 160 characters and ≥ 1.5× max(page body, both medians). Independent of where the median
  line falls between 1.5× and 2× (BIS WP 1367 transplant), and a long paragraph at 2× a tiny page body stays body.
- `_reference_sizes(per_page, sources)` reports where each page's size came from (own / second / document / floor);
  the harness's `inherited` label reads it.
- Residuals recorded (equal to v3 or by design): R3-4 (fix A can raise a page's body size above a 1.4× heading;
  labelled `body`), agenda bullets on a chart-deck slide are headings (as in v3).
- Corpus: 47 PDFs, paragraph characters fell in 0; the round's changes over a9e8245d restore 21 v3 headings (agenda
  rows, the 10-Q p52 stack, a vertical cover label) and drop one (`fed_feds_ai_coder` p57 `All Industries`).
