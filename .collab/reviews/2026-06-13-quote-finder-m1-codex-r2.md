# Quote Finder M1 substrate - Codex round 2 review

Date: 2026-06-13
Reviewer: Codex
Scope: working-tree fixes for `.collab/reviews/2026-06-13-quote-finder-m1-codex.md` plus Claude response `.collab/dialogue/2026-06-13-quote-finder-m1-fixes.md`. I did not run git.

## Verdict: CONSENSUS

M1 substrate ships. Findings 1-4 are fixed for the trust-contract failures identified in round 1. Finding 5 is a real remaining parse-fidelity gap, but I agree with the M1->M2 scope decision: a chunk-level hard-hyphen heuristic cannot distinguish discretionary breaks from real compounds, and the principled fix is to verify against persisted PDF page text with an honest fallback label.

No blocking findings remain for the substrate.

## Verification

1. Fuzzy trim invention fixed.

   Code: `backend/app/services/quote_verification_service.py:39`, `:137-142`.

   The fuzzy tier now computes proposed-side coverage from `align.src_end - align.src_start` over `len(pq_fnorm)` and requires `coverage >= MIN_COVERAGE` before `aligned`.

   Probe:

   ```text
   verify_quote(SOURCE + " invented clause", SOURCE)
   => status='flagged', reason='coverage', score=100.0, verified=False
   ```

   This no longer reaches `aligned`; the displayed slice is the source substring, but it is explicitly unverified.

2. Normalized partial-expansion matches fixed.

   Code: `backend/app/services/text_normalizer.py:123-138`, `backend/app/services/quote_verification_service.py:103-112`.

   `span_on_raw_boundaries()` rejects normalized matches that start/end inside one raw code point's expansion, and the normalized tier scans later occurrences instead of accepting the first partial match.

   Probes:

   ```text
   verify_quote("wait..", "wait… really")
   => status='flagged', verified=False, not normalized

   verify_quote("A株式", "A㍿B")
   => status='flagged', verified=False, not normalized

   verify_quote("wait..", "wait… really ｗａｉｔ.. later")
   => status='normalized', display_text='ｗａｉｔ..'

   verify_quote("A株式", "A㍿B Ａ株式C")
   => status='normalized', display_text='Ａ株式'
   ```

3. `verified` contract added.

   Code: `backend/app/services/quote_verification_service.py:42-59`.

   Probes:

   ```text
   flagged => verified=False
   dropped => verified=False
   ```

   `flagged` still carries a source slice for a possible confirmation UI, but the hard caller contract is now explicit: quote cards render only when `verified` is true.

4. Sentence split/rejoin fidelity fixed for the round-1 cases.

   Code: `backend/app/services/parse_service.py:766-794`, `:906-930`.

   Probes:

   ```text
   "第一句。第二句。" => same round-trip
   "これは一文目。これは二文目。" => same round-trip
   "Why?Because it matters." => same round-trip
   "Really? Yes! Done." => splits into 3 units and rejoins unchanged
   ```

   The ASCII `?!` no-space case no longer gets split, and `_join_text_units()` suppresses synthesized spaces adjacent to CJK ideographs/kana/punctuation.

5. Hard-hyphen reasoning accepted as M1->M2.

   Code still demonstrates the ambiguity in `backend/app/services/parse_service.py:826-835` and `:868-875`:

   ```text
   cost-\neffective => costeffective
   experi-\nment => experiment
   ```

   Both cases have the same local signal: trailing `-` followed by an alphanumeric/lowercase continuation. A chunk-local "preserve" heuristic fixes `cost-\neffective` only by breaking discretionary `experi-\nment`; a chunk-local "drop" heuristic does the reverse. Without a dictionary or raw-page anchor, the parser cannot make this deterministic with the verifier's trust standard.

   I agree this should not block M1 substrate because the right fix is broader and already documented: persist PDF `Page.content`, verify against page text when present, fall back to chunk text only with an honest "verified against extracted text" label. That change is not a local verifier patch: `backend/app/api/documents.py:697-712` already prefers `Page.content`, while `backend/app/workers/parse_worker.py:215-239` only populates it for non-PDF documents today. Populating it for PDFs changes the text-content endpoint and TextViewer behavior, so it needs its own review.

   M2 must carry the explicit acceptance condition: PDF page-text persistence + verifier source selection (`page text` when present, chunk fallback otherwise) + trust labels.

## Commands Run

```text
PYTHONPATH=backend python3 - <<'PY' ... focused probes ...
cd backend && python3 -m pytest tests/test_quote_verification_service.py tests/test_text_normalizer.py tests/test_parse_sentence_fidelity.py -q
cd backend && python3 -m ruff check app/services/quote_verification_service.py app/services/text_normalizer.py app/services/parse_service.py tests/test_quote_verification_service.py tests/test_text_normalizer.py tests/test_parse_sentence_fidelity.py
rg -n "rapidfuzz" backend frontend . -S -g '*requirements*.txt' -g 'pyproject.toml'
```

Results:

```text
50 passed, 5 warnings
ruff clean on touched service/test files
backend/requirements.txt includes rapidfuzz==3.13.0
```

I did not run the full backend suite or frontend build for this focused consensus pass.
