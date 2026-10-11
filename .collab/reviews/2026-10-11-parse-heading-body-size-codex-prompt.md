# Adversarial review request — parse v5 heading size rule

Run from the repo root (prompt via stdin; Codex cannot run git, so the diff is named by commit):

```bash
cat .collab/reviews/2026-10-11-parse-heading-body-size-codex-prompt.md | \
  codex exec -m gpt-5.5 --sandbox workspace-write -C /Users/mayijie/Projects/Code/010_DocTalk
```

---

You are an adversarial reviewer for the DocTalk repo. Do not modify any source file. Write your review to
`.collab/reviews/2026-10-11-parse-heading-body-size-codex-r1.md` (later rounds: r2, r3 …). Be concrete: every finding
needs a file:line, a realistic input that triggers it, and the wrong output it produces. Severity: BLOCKER (wrong
data shipped to users or a crash/timeout in the parse worker), MAJOR (a realistic document class regresses), MINOR
(edge case or maintainability). End with a verdict: SHIP, SHIP-WITH-FIXES, or BLOCK.

## What changed

Branch `claude/sharp-feynman-4vqkq2`, commit `780c2131` on top of `main` (`d46fc222`). Read:

- `.collab/plans/2026-10-11-parse-heading-body-size.md` — the design (Fable) and §11 implementation notes.
- `backend/app/services/parse_service.py` — `BlockInfo.dominant_size`, `CleanBlock.rule_size/run_len/is_heading`,
  `_prepare_blocks`, `_same_size`, `_rule_size`, `_annotate_runs`, `_cluster_sizes`, `_running_text_chars`,
  `_page_reference`, `_weighted_median`, `_reference_sizes`, `_is_heading_by_size`, `_is_heading_block`,
  `_extract_line_blocks`, `_BARE_ADDRESS_RE`; `chunk_document` and `extract_elements` now consume `_prepare_blocks`.
- `backend/tests/test_parse_service.py` — class `TestHeadingSizeUsesPageBodySize`.
- `.collab/reviews/2026-10-11-parse-heading-body-size-corpus.md` — before/after over 47 PDFs.
- Rules: `CLAUDE.md`, `.claude/rules/backend.md` (Parse Worker section, including the new v5 bullet).

## The problem being fixed

`_is_heading_block` treated any line with `font_size > median_size * 1.25` as a heading, with `median_size` the
median over every line of the document. Chart labels and table cells pulled that median under the body size in
broker research, so body lines became headings: removed from chunk text (never embedded, retrieved, cited or
quote-verified) and used as the `section_title` prefix of citation snippets. 41–80% of the text of nine research
notes in the owner's corpus.

## Claims to attack

1. **Floor invariant**: because every page reference is `max(document line median, page/document reference)`, the
   size rule can only drop a heading v3 found, never add one — except where `dominant_size` exceeds a span mean that
   a smaller span pulled down. Find an input where v5 adds a non-title heading, or where paragraph characters fall.
2. **chunk_document and extract_elements agree** line for line (one shared `_prepare_blocks`). Any path where they
   can diverge (mutation of shared objects, ordering, a page skipped in one)?
3. **Run detection** (`_annotate_runs`): neighbour predicate, the stacking-order sweep, the pruning bound
   (`max_h` over on-axis lines), the 400-entry active cap, union-find. Can pruning or the cap drop a true neighbour
   and turn a paragraph line into a "heading" (run_len ≤ 3)? Can a table column form a run and become "running text"
   that sets a wrong page reference? Vertical pages (stacking along x) and rotated pages (`/Rotate 90`).
4. **Reference choice**: largest size class with ≥30% of running-text characters; document reference = largest
   page reference shared by ≥25% of pages; fallback to the char-weighted median of running text, then the floor.
   Construct documents where this picks a size LARGER than the body (losing real headings is acceptable but should
   be bounded) or SMALLER than the body (body becomes headings — not acceptable).
5. **Guards**: run_len > 3 → never a heading by size (wrapped headings up to 3 lines); digits/currency ≥ letters or
   < 2 letters → not a title; bare URL / e-mail → not a title. CJK (no spaces), Arabic/Hindi text, OCR output
   (size jitter), the non-PDF extractor path in `backend/app/workers/parse_worker.py` (~L486–514: unit-box bboxes,
   18pt title + 12pt body block per page) — must classify exactly as before.
6. **Interaction with the v3 margin rules** (off-axis lines dropped in the outer band, off-axis never headings,
   arXiv guard, `wmode=1` vertical writing kept) and the existing all-caps rule, which is unchanged (the owner's v4
   branch tightens it and adds a numbered rule; v5 must compose with it — check the predicate order in
   `_is_heading_block`).
7. **Cost** inside the Celery parse task (`time_limit=600`, `soft_time_limit=540`): worst-case per page and per
   document. The corpus record has timings; find a realistic page that is pathological.
8. **Rollout**: `PARSE_PIPELINE_VERSION = 5`; demo documents re-parse in place through
   `demo_seed.refresh_stale_demo_parses` (do not redesign it, but check nothing in this change breaks it); persisted
   element metadata (`font_size`) unchanged; saved quotes snapshot their trust fields.
9. **Tests**: do the new tests pin the behaviour (each ingredient removed → a test fails, per the corpus record's
   mutation list)? Missing cases?

You may run `cd backend && <python3.12 venv with requirements-dev.txt> -m pytest tests/test_parse_service.py -q` (the
shell's `python3` is 3.14 without pytest) and build synthetic `PageInfo` pages or
PDFs with PyMuPDF (`fitz`) to prove a finding. `.collab/scripts/parse_heading_synth.py` generates the synthetic corpus;
`.collab/scripts/parse_heading_corpus.py --old-ref main` compares old and new on any folder of PDFs.
