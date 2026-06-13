# Quote Finder M1 substrate - Codex adversarial review

Date: 2026-06-13
Reviewer: Codex
Scope: design-of-record `.collab/plans/2026-06-12-quote-finder-evidence-board.md` sections 8-9, prior r1-r3 reviews, and the requested changed files. I did not run git. I ran focused Python probes against the implementation; I did not run the full test suite.

## Verdict: BLOCK

The exact/raw display principle is directionally right, and `partial_ratio_alignment(proposed, source)` uses `dest_start`/`dest_end` in the correct source-side direction. But the current fuzzy tier can auto-accept a quote that contains invented prefix/suffix text, and the normalized tier can accept a match whose endpoints fall inside a single raw code point's expansion. Those are trust-contract failures for a verifier substrate.

## Findings

1. BLOCK: Fuzzy auto-accept can verify only a substring of a longer hallucinated proposed quote.

   Files: `backend/app/services/quote_verification_service.py:105`, `backend/app/services/quote_verification_service.py:114-121`

   `rapidfuzz.fuzz.partial_ratio_alignment(pq_fnorm, src_fnorm)` is a partial alignment. If the LLM proposes `SOURCE + invented unsupported clause`, RapidFuzz can return score `100.0` over only the source substring. The length-ratio guard does not stop this because `LEN_RATIO_LO=0.6` allows the displayed source slice to be much shorter than the proposed quote.

   Probe:

   ```text
   source = "The method was robust across cohorts and improved recall for long academic documents."
   proposed = source + " This invented downstream claim is not in the paper."
   verify_quote(proposed, source)
   => status='aligned', score=100.0, display_text=source
   ```

   A second probe with an invented safety claim also returned `aligned` at `99.64`. The display text is still a source slice, not the LLM text, but the verifier has promoted an altered quote to verified by silently trimming unsupported text. That is not a safe "LLM proposes, verifier disposes" gate.

   Required change: after alignment, require proposed-side coverage before auto-accept. At minimum reject/flag when `align.src_start != 0` or `align.src_end != len(pq_fnorm)`, except for trivial surrounding whitespace/punctuation. Also compute the final score against the entire normalized proposed quote and the selected normalized source window, not only RapidFuzz's partial score. Add regression tests for hallucinated prefix, hallucinated suffix, and `proposed > source` cases.

2. BLOCK: Normalized matching can start or end inside one raw code point's multi-character fold.

   Files: `backend/app/services/text_normalizer.py:116-132`, `backend/app/services/quote_verification_service.py:89-97`

   The offset map records only `norm_index -> raw_index`. It does not record whether a normalized index is at a raw-code-point boundary. As a result, `.find()` can match part of a single raw character's expansion, and `raw_span()` widens that partial match to the full raw character while returning `status='normalized'`.

   Probes:

   ```text
   verify_quote("wait..", "wait… really")
   => status='normalized', display_text='wait…'

   verify_quote("A株式", "A㍿B")
   => status='normalized', display_text='A㍿'
   ```

   The displayed text is verbatim source, but the proposed normalized text did not correspond to a complete raw substring. This also affects ligatures and any NFKC expansion where the match endpoint lands inside the expansion.

   Required change: track normalized expansion boundaries, or derive `raw_to_norm_start/end`, and reject normalized matches unless `norm_start` and `norm_end` align with raw-code-point boundaries. Add tests for ellipsis, ligature, square CJK compatibility characters, and casefold expansions such as `ß`.

3. REVISE: `flagged` returns displayable text even though it explicitly failed an auto-accept guard.

   File: `backend/app/services/quote_verification_service.py:123-127`

   `flagged` is used for low quality, too short, bad length ratio, or below-auto fuzzy candidates, but the result still carries `display_text`, `raw_start`, and `raw_end`. A naive caller that renders every non-`dropped` result would show unverified fuzzy text.

   Required change: either return `display_text=None` for `flagged`, or rename it to a non-renderable candidate field and enforce in API/UI tests that only `exact`, `normalized`, and `aligned` are shown as quote cards. If a later confirmation UI shows flagged candidates, the label must be explicitly unverified.

4. REVISE: The sentence fix covers ASCII periods, but CJK/no-space punctuation is still mutated by split and rejoin.

   Files: `backend/app/services/parse_service.py:765-781`, `backend/app/services/parse_service.py:893-918`

   The new ASCII-period rule handles the tested `U.S.`, `e.g.`, decimals, filenames, and URL-like cases. I did not find a decimal-at-EOS regression: `3.14.` round-trips. ASCII ellipsis with a following space also round-trips.

   The missed corruption case is punctuation that remains always-split and then gets rejoined with inferred spaces:

   ```text
   "第一句。第二句。" -> "第一句。 第二句。"
   "Why?Because it matters." -> "Why? Because it matters."
   ```

   For DocTalk's CJK locales, that means a quote spanning a CJK sentence boundary can still display text that was not in the extracted source string. Note: the docstring mentions ASCII `;`, but current `SENTENCE_DELIMS` does not include ASCII semicolon; fullwidth `；` is still in scope.

   Required change: preserve original separator whitespace through sentence units, or update `_join_text_units()` so it does not synthesize ASCII spaces after CJK sentence punctuation before CJK text. Add round-trip tests for Chinese/Japanese sentence boundaries and no-space `?`/`!` inputs if those are expected to preserve source fidelity.

5. REVISE: The known hard-hyphen trust gap remains untested and unfixed for the M1 substrate.

   File: `backend/app/services/parse_service.py:855-860`

   This was already in the ratified design-of-record: a line ending in `-` followed by an alphanumeric next line always drops the hyphen. That repairs discretionary line-break hyphenation but corrupts real compounds such as `cost-\neffective` into `costeffective`. Because `verify_quote()` displays chunk text when chunk fallback is the unit boundary, this can still ship a mutated quote.

   Required change: do not mark M1 substrate complete until hard-hyphen joins are either offset-mapped back to source text or conservatively preserve ambiguous hyphens. Add tests for discretionary hyphens and real hard-hyphenated compounds.

## Additional Notes

- `normalize(..., fuzzy=True)` does not actually strip precomposed European accents because it does not decompose before removing `Mn`; `é` and `e\u0301` still differ, and Turkish `İ` casefolds to `i` plus a combining dot. That is mostly a recall false negative, not a false-verification bug, but the comments/tests overstate the behavior.
- Exact and normalized tiers use `.find()` and return the first occurrence. That is acceptable only if the caller passes a sufficiently narrow cited chunk/page window. If the endpoint passes chunk plus neighbours or multi-page text, the service should return ambiguity/all matches or accept source-location constraints.
- `raw_span()` has no bounds validation and returns `(0, 0)` for degenerate spans. Internal callers currently pass valid spans, but tests should pin that contract if this helper remains public.

## Required Changes Before Ship

1. Add proposed-coverage/full-window validation to fuzzy auto-accept in `quote_verification_service.py:105-121`.
2. Add normalized expansion-boundary validation before returning `normalized` in `text_normalizer.py:116-132` and `quote_verification_service.py:89-97`.
3. Make `flagged` non-renderable by default or enforce a caller contract that flagged candidates never appear as verified quote cards.
4. Fix CJK/no-space punctuation round-trip corruption in the split/rejoin path.
5. Close the hard-hyphen gap from the design-of-record before calling M1 a trust substrate.
