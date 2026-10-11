# Heading detection (parse v4) — Codex review record

Date: 2026-10-11. Branch: `fix/parse-heading-detection` (base `fix/arxiv-margin-stamp-section-title`
95802930, parse v3, since merged into `main` as 427501d6; this branch merges cleanly into `main` 572c6e1a). Reviewer: Codex `gpt-5.5`, adversarial, read-only instructions,
4 rounds. Final verdict: **SHIP**.

## Problem

`ParseService._is_heading_block` turned table cells and formula tokens into section titles and
missed real LaTeX headings. On the demo seed "Attention Is All You Need" the v3 chunk titles were
`)V`, `O(1)`, `GNMT + RL [38]`, `100K`, `300K`, `WSJ 23 F1` and `<EOS>`; `1 Introduction` (12pt on a
9.96pt median, ratio 1.2) never became a heading. A heading line becomes the chunk's
`section_title` (the citation snippet prefix, `chat_service.py:277`, `documents.py:620`) and is
REMOVED from the chunk text, so a false heading costs both the prefix and retrievable content.

Causes: the all-caps rule fired on any line whose letters are all capitals (1-letter tokens, table
header cells, and Chinese lines with a Latin acronym, because `str.isupper()` ignores caseless
letters); the size rule (> 1.25 × median) is the only other route, and LaTeX section headings sit
at 1.2×.

## Commits

| Commit | Content |
|---|---|
| a4a2a9fd | Parse v4: caps headings need 4 capitals and no table row; numbered headings at ≥1.1× median, a separate number line joined to its title; `PARSE_PIPELINE_VERSION` 3 → 4 |
| 6aa52212 | r1 fixes |
| 25bd0650 | r2 fixes + every letter of a caps heading must be a capital |
| 0679cba4 | r3 fixes |
| 271ed6b7 | r4 nit: `_in_table_row` returns `False`, not `None` (behaviour unchanged) |

## Rounds

**r1 — SHIP-WITH-FIXES** (a4a2a9fd). Fixes in 6aa52212.
- SHOULD-FIX: chart cells at 9pt pull the median below a 10pt body, so numbered body list items
  pass 1.1× and leave the chunk text. Fix: a numbered line that continues a same-size paragraph or
  list (`_continues_run`) is not a heading.
- SHOULD-FIX: joining `1` + `Revenue Outlook` before the row check hid the table cells, so a
  numbered table row became a heading. Fix: the joined line must pass the numbered context check
  against the original page lines; a lone narrow other-half neighbour counts as a cell.
- SHOULD-FIX: the row check scanned the whole page per candidate (10,000 caps cells: ~21s).
  Fix: per-page `_PageRows` index, bisect on line tops, stop at 2 neighbours.
- NIT: numbered headings in caseless scripts (`1 はじめに`) were missed. Fix: the title may start with
  a caseless letter (≥2 letters, ≥3 for cased titles).

**r2 — SHIP-WITH-FIXES** (6aa52212). r1 findings verified fixed. Fixes in 25bd0650.
- SHOULD-FIX: the run guard also rejected a heading directly above its subheading (`2 Methods` /
  `2.1 Data`). Fix: section numbers of different depth are not a run (reverted in r3); a split pair
  checks the already-joined line above it (kept).
- SHOULD-FIX: a short body line in the opposite column (`therefore.`) counted as a table cell and
  rejected a two-column heading. Fix: the lone narrow cell must share the line's font size.
- SHOULD-FIX: the scan window used the page's tallest line, so one 1,600pt line made every lookup
  quadratic (1,600,002 `_shares_row` calls on 2,001 lines). Fix: the window is 3× the candidate's
  own height and taller lines are not row neighbours (19,942 calls).
- Declined, with corpus evidence: a numbered line followed by an unnumbered line of the same size
  and column stays content. It is also the shape of a wrapped list item, and reading a list item as
  a heading deletes body text. The guard vetoes 5 numbered lines in the 53-PDF corpus; 4 are already
  headings by the size rule, 1 is a wrapped Chinese body line.
- Found while re-measuring (not a Codex finding): 203 Chinese body lines were still caps headings
  (v3: 440). Fix: every letter of a caps heading must be a capital.

**r3 — SHIP-WITH-FIXES** (25bd0650). r2 fixes verified. Fixes in 0679cba4.
- SHOULD-FIX: the r2 different-depth exemption let a nested body list (`1 Parent item` over
  `1.1 Child item`, body size under a depressed median) leave the chunk text. Fix: the exemption is
  removed. r2's tight same-size `2 Methods` / `2.1 Data` pair is content again by design: all 20
  adjacent different-depth heading pairs in the corpus differ in size or sit 14.8–17pt apart, so
  the run test (gap ≤ one font size) never fires on them.
- SHOULD-FIX: with the r2 size condition, a value cell set smaller than its numbered label
  (`1 | Revenue Outlook | $100m`, 12pt / 10pt) no longer counted. Fix: a narrow cell counts when it
  holds a figure (a digit and ≤4 letters) at any size, or shares the label's size. Accepted cost: a
  two-column heading beside an opposite-column tail with a figure (`in 2019.`) is rejected.
- NIT: `SEÇÃO Nº 2` was missed (`str.islower()` is true for `º`). Fix: ordinal indicators and
  modifier letters are ignored by the caps rule.
- Corpus output identical to 25bd0650 for all 53 PDFs.

**r4 — SHIP** (0679cba4). No findings. Codex accepted both trade-offs (tight same-size
heading/subheading pairs stay content; a heading beside a figure-bearing opposite-column tail is
rejected) and re-ran its probes: nested list kept as text, spaced subheadings detected, smaller
`$100m` cell rejected, `therefore.` tail allowed, `SEÇÃO Nº 2` detected, CJK acronym line kept.
One non-blocking nit (an unreachable `return False`, which also made `_in_table_row` return `None`)
is fixed in 271ed6b7.

## Evidence

- Corpus: the 3 seed PDFs plus 50 local PDFs (`test_inputs/`, 49 with a text layer), old (v3) vs
  new parser, measured with `extract_elements` (paragraph characters exclude chunk overlap).
  Headings 15,946 (v3) → 10,866 (r1 fixes) → 10,664 (r2 fixes). Paragraph characters rise or hold in
  48 of 49 documents; ssrn-3247865 drops 4,120 because its 183 numbered subsections are now
  headings. Corpus runtime, one run each (extract, elements, chunks): v3 21.3s, v4 23.9s.
- Attention seed titles: v3 `None | Attention Is All You Need | )V | O(1) | GNMT + RL [38] | 100K |
  300K | WSJ 23 F1 | <EOS>` → v4 `None | Attention Is All You Need | 1 Introduction | 2 Background |
  3 Model Architecture | 4 Why Self-Attention | 5 Training | 6 Results | 7 Conclusion`. Alphabet seed:
  `Q4 2025` / `APAC` titles gone. Court filing seed: unchanged.
- Read one by one: all 200 headings v4 adds (attention 7, ssrn 183, 9 numbered Chinese headings,
  1 China Musings heading that gains its number); all 248 distinct caps lines the table-row check
  rejects (536 occurrences: tickers, table headers, chart labels, disclosure rows); all 204 lines
  the every-letter rule removes (about 190 body text, bylines, dates, disclosure text; about 10 chart
  or figure titles; 2 real "(1)"/"(2)" subsection headings in one Chinese document, caught in v3 only
  because they contain "MEMS").
- Tests at 271ed6b7: `test_parse_service.py` 50 passed (21 new in `TestHeadingDetection`); unit suite
  1,166 passed / 138 skipped; integration suite (local Docker, `SKIP_INTEGRATION=0`) 138 passed; ruff
  clean. Every r2 and r3 test that encodes a Codex probe failed before its fix; the r3 spaced-subheading
  test is a guard and passed throughout.

## Owner decisions (2026-10-11)

- Citation snippets drop the `section_title` prefix — separate branch (spawned task).
- The 1.25× size rule (40–80% of text classified as headings in 9 broker reports whose chart and
  table lines pull the median below the body size) gets a separate follow-up design.

## Still missed

Unnumbered headings at 1.2× (`Abstract`, `References`), bold body-size subsections
(`3.1 Encoder and Decoder Stacks`), "(1)"-style and right-to-left numbering, a numbered heading that
wraps onto a second line of the same size, and a heading set directly above a same-size subheading
with no section spacing (both read as list items; see r3).
