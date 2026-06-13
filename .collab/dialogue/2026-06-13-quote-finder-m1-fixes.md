# Quote Finder M1 substrate — review response (2026-06-13)

**Reviewer:** Codex (`.collab/reviews/2026-06-13-quote-finder-m1-codex.md`, verdict BLOCK)
**Author response:** Claude (Opus 4.8). All 5 findings independently reproduced before acting; 4 fixed with TDD, 1 (REVISE) is a reasoned scope decision.

## Findings 1–4: ACCEPTED + FIXED (TDD, all reproduced first)

| # | Sev | Reproduced | Fix | Tests |
|---|---|---|---|---|
| 1 | BLOCK | `verify_quote(SOURCE+" invented", SOURCE)` → `aligned` 100.0 (trimmed invention) | Fuzzy tier now requires **proposed-side coverage ≥0.95** (`align.src_end-src_start`/`len(pq)`); partial-substring matches → `flagged`, not `aligned` | `TestFullCoverage` (3) |
| 2 | BLOCK | `verify_quote("wait..","wait… really")` → `normalized` | Added `span_on_raw_boundaries()` to text_normalizer; normalized tier rejects matches not aligned to whole raw code points, scanning later occurrences | `TestNormalizedBoundary` (3) |
| 3 | REVISE | `flagged` carried `display_text` (naive caller could render unverified) | Added `QuoteVerification.verified` property (True only for exact/normalized/aligned); hard caller contract | `TestVerifiedFlag` (3) |
| 4 | REVISE | `第一句。第二句。`→`第一句。 第二句。`; `Why?Because`→`Why? Because` | ASCII boundary rule extended to `?`/`!` (followed-by-ws/EOS); `_join_text_units` adds `_is_cjk_context()` — never synthesize a space adjacent to CJK ideograph/kana/punctuation | `test_parse_sentence_fidelity` +4 |

Result: 493 passed / 0 new failures (6 pre-existing unrelated: summary-routing/RetainPDF/OCR-langs). ruff clean. New-test count this round: +10 verifier/normalizer, +4 fidelity.

## Finding 5 (hard-hyphen, REVISE): pushback with reasoning — resolution is the page-text path, NOT a chunk heuristic

Reproduced and ACCEPTED that the limitation is real: `_extract_line_blocks` (parse_service.py:855) drops a trailing `-` before an alnum next line, so `cost-\neffective`→`costeffective` (a real compound corrupted) as well as the intended discretionary `experi-\nment`→`experiment`.

**Why not a chunk-level conservative heuristic:** discretionary breaks and real compounds BOTH break before a lowercase letter (`experi-\nment` and `cost-\neffective`), so no lowercase/uppercase signal separates them without a dictionary. A "conservative" keep-the-hyphen flips the error onto discretionary hyphenation. Either default ships *some* corrupted chunk text.

**The principled fix is already in the design-of-record (§8.1):** verify against **raw page text** (`page.get_text("text")`, hyphens preserved), with chunk-text only as a labelled fallback ("verified against extracted text" vs "verified against page text"). That requires forward-only PDF `Page.content` persistence in `parse_worker` — which has a **non-obvious downstream effect**: `documents.py:691 get_document_text_content` "Prefers Page.content over chunk reconstruction" and is described as the non-PDF viewer path; populating it for PDFs changes that endpoint's behaviour and interacts with TextViewer snippet highlighting. That is a separate, reviewable change, not a safe unilateral M1 quick-fix.

**Resolution:** finding 5 is the explicit **M1→M2 boundary item**: (a) page-text persistence + (b) verifier consumes page text when present + (c) honest trust labels for chunk-fallback docs. Tracked in plan §9; the chunk-text verifier shipped now is correct and source-agnostic, and carries the honest "extracted text" label per §8.1. No doomed heuristic, no half-shipped risky persistence.

## Minor notes from review (acknowledged)
- Fuzzy `Mn`-strip doesn't decompose precomposed accents first (recall false-negative only, not a false-verification) — left as-is; comment is accurate (we strip standalone Mn, mainly Arabic tashkeel).
- `.find()` returns first occurrence: acceptable under the documented caller contract (pass a narrow cited chunk ± neighbours); M2 caller owns source-location narrowing.
- `raw_span((0,0))` degenerate contract is covered by `TestRawSpanProjection` + boundary guard.
