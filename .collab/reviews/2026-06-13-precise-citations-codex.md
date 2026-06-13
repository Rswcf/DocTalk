# Codex Review — Precise Citation Highlighting

Date: 2026-06-13
Reviewer: Codex
Verdict: BLOCK

## Findings

1. **Wrong-sentence focus can pass the current gates for numeric/date claims.**
   `backend/app/services/citation_focus_service.py:19` and `backend/app/services/citation_focus_service.py:26`-`33` extract all short/common Latin tokens and numbers into the same unweighted set, then `backend/app/services/citation_focus_service.py:59`-`69` picks by raw set overlap. That means a sentence sharing the generic predicate words can dominate even when the key number/date contradicts the claim.

   Focused probe:

   ```text
   Published-year contradiction => The report was published in 2023.
   Revenue-number contradiction => Revenue rose to 8 percent.
   ```

   Probe inputs:

   ```python
   focus_sentence(
       "The report was published in 2023. The company generated 2024 revenue from subscriptions.",
       "The report was published in 2024",
   )
   focus_sentence(
       "Revenue rose to 8 percent. Margin was 12 percent.",
       "Revenue rose to 12 percent",
   )
   ```

   Both should return `None`; a wrong narrow highlight is worse than the old chunk highlight. Required change: filter low-signal stopwords/short tokens and add a hard numeric/date consistency gate, for example: if the claim contains numeric tokens, the focused candidate must contain those exact numeric tokens or the function must return `None`. Add regression tests for contradicted year, percent, currency, and page-like numbers.

2. **`recent_claim` leaks the previous claim into the next citation and can make the second citation focus the first sentence.**
   The plan says the rolling claim buffer should reset on sentence end, but `backend/app/services/chat_service.py:980`-`982` defines a plain rolling 200-character window and `backend/app/services/chat_service.py:999`-`1010` appends every emitted character without tracking sentence/list boundaries. This is not only noisy; it produces a wrong focus on common multi-sentence answers.

   Focused probe:

   ```text
   answer = "Revenue rose to 8 percent[1]. Margin fell[2]."
   focus snippets = ["Revenue rose to 8 percent.", "Revenue rose to 8 percent."]
   ```

   The second citation should focus `Margin fell sharply.` or return `None`; it must not reuse the prior sentence. Required change: make the claim buffer represent the current claim segment, not the last 200 characters. Reset or trim after sentence/newline/list boundaries while preserving adjacent citations like `[1][2]` for the same claim. Add a regression test for two consecutive factual sentences citing the same multi-sentence chunk.

3. **The frontend dims/suppresses the reliable fallback before proving the focus sentence matched the PDF text layer.**
   `frontend/src/components/PdfViewer/PageWithHighlights.tsx:81`, `:85`, `:124`, and `:195` make `highlightFocus` authoritative immediately: bbox text marking is suppressed and chunk rectangles are dimmed to `0.35`. If the focus sentence is not found in the PDF text layer (line-level text items with extra text, hyphenation, ligatures, normalization differences, or scanned pages), the user gets only a faint context overlay. For converted `allDummy` documents, the dummy bbox is not rendered at all, and `frontend/src/store/index.ts:168` overwrites the original chunk snippet with the focus snippet, so there is no fallback to the old snippet match if the focus string fails.

   Required change: preserve the old full-strength chunk highlight unless/until a focus text-layer match is known to have rendered. At minimum, do not dim the bbox overlay or suppress bbox-based marking solely because `highlightFocus` exists. Also keep the original chunk `textSnippet` available separately from `focusSnippet`, so converted-PDF/TextViewer paths can try focus first and fall back to the old snippet.

## Notes

- Private message reload preserves `focus_snippet`: `backend/app/api/chat.py:274`-`281` returns raw `m.citations`, and `frontend/src/lib/api.ts:70`-`85` maps both snake_case and camelCase.
- Existing citations with no `focus_snippet` still follow the old normal-PDF path: `highlightFocus` is null, bbox text marking is not suppressed, and converted dummy-bbox PDFs use `highlightSnippet`.
- Summary citations are excluded from focus generation via `is_summary`, but table citations are not. Given table evidence often does not map cleanly to a sentence in the PDF text layer, consider excluding `retrieval_modality == "table"` from `focus_sentence` until there are table-specific tests.
- CJK behavior is mixed but mostly safe: Chinese/Japanese Han text can focus; Korean Hangul returns `None` because `_CJK_RE` only covers Han characters, so it falls back to chunk highlighting rather than guessing.

## Verification

Passed:

```bash
python3 -m pytest tests/test_citation_focus_service.py tests/test_citation_focus_wiring.py -q
python3 -m ruff check app/services/citation_focus_service.py tests/test_citation_focus_service.py tests/test_citation_focus_wiring.py
npm run build
```

Adversarial probes failed the safety property as shown above.
