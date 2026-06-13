# Codex Review R2 - Precise Citation Highlighting

Date: 2026-06-13
Reviewer: Codex
Verdict: CONSENSUS

## Findings

None. The three round-1 blockers are fixed in the working tree.

## Verification

### Finding 1 - numeric/date contradiction

Confirmed in `backend/app/services/citation_focus_service.py`:

- `_features()` filters stopwords before scoring (`:42-49`).
- `focus_sentence()` applies a hard numeric/date consistency gate after selecting the best candidate (`:99-105`).

Focused probe results:

```text
published-year contradiction: None expected None => PASS
percent contradiction: None expected None => PASS
matching-number focus: 'Revenue rose to 8 percent.' expected 'Revenue rose to 8 percent.' => PASS
```

### Finding 2 - claim leak between citations

Confirmed in `backend/app/services/citation_focus_service.py` and `backend/app/services/chat_service.py`:

- `current_claim(buffer)` returns the last sentence segment (`citation_focus_service.py:60-66`).
- `RefParserFSM` passes `current_claim(self.recent_claim)` when emitting citation payloads (`chat_service.py:1007-1010`).

Focused FSM probe:

```text
answer = "Revenue rose to 8 percent[1]. Margin fell sharply[1]."
focuses = ['Revenue rose to 8 percent.', 'Margin fell sharply.']
PASS
```

### Finding 3 - frontend fallback remains intact

Confirmed:

- Store keeps the chunk fallback and focus separately: `highlightSnippet: citation.textSnippet`, `highlightFocus: citation.focusSnippet` (`frontend/src/store/index.ts:163-170`).
- `PageWithHighlights` leaves `allDummy` behavior unchanged: dummy bboxes still disable bbox overlay and use `highlightSnippet` for text-layer fallback (`frontend/src/components/PdfViewer/PageWithHighlights.tsx:66-79`).
- Normal PDF bbox text marking still computes from `validHighlights` without a `highlightFocus` suppressor (`PageWithHighlights.tsx:121-132`).
- Bbox overlay still renders whenever `validHighlights.length > 0` and is not dimmed by focus (`PageWithHighlights.tsx:183-200`; `.citation-overlay` opacity remains `0.9` in `frontend/src/app/globals.css:234-244`).
- Focus is additive via an extra `pdf-highlight-focus` class (`PageWithHighlights.tsx:129-130`; `globals.css:207-215`).

Targeted tests:

```text
python3 -m pytest tests/test_citation_focus_service.py tests/test_citation_focus_wiring.py -q
18 passed, 6 warnings in 1.06s
```

Warnings were environment/library warnings only (`urllib3` LibreSSL and SWIG deprecations).

## Verdict

CONSENSUS. The precise citation highlighting fixes preserve the reliable chunk fallback and address the numeric/date and rolling-claim safety issues.
