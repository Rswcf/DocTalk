# QA Run - Private Live RAG And Real Citation Jump - 2026-05-11

Scope: close the previously blocked local private RAG gap using a temporary DeepSeek API key supplied by the user. The key was used only as a process environment variable for the local backend and was not written to repo files or QA artifacts.

## Environment

| Item | Value |
|---|---|
| Backend | `http://127.0.0.1:8000`, temporary uvicorn process |
| Frontend | `http://localhost:3000`, temporary Next.js dev server |
| Corpus | `test_inputs/semiconductor.pdf`, `https://example.com/` |
| Harnesses | `.collab/scripts/qa_live_chat_rag_matrix.py`, `.collab/scripts/qa_browser_live_rag_citation_ux.js` |

## API Results

| Flow | Result | Evidence |
|---|---|---|
| Private PDF upload -> ready -> session -> live SSE chat -> citations -> messages API | Pass | `.collab/tasks/qa-live-chat-rag-local-upload-deepseek-2026-05-11.json` |
| URL import -> ready -> session -> live SSE chat -> citations -> messages API | Fail before fix | `.collab/tasks/qa-live-chat-rag-local-url-deepseek-2026-05-11.json` |
| URL import retest after short-chunk retrieval fix | Pass | `.collab/tasks/qa-live-chat-rag-local-url-deepseek-after-short-chunk-fix-2026-05-11.json` |

PDF upload live RAG:

- Parse reached `ready` after about `3.014s`.
- Chat elapsed `4.048s`.
- Answer chars: `818`.
- Citations: `6`.
- Harness quality score: `1.0`.
- Built-in RAG verifier returned `warn` with reasons `uncited_claim_units`, `low_claim_source_overlap`, and `numeric_claim_source_mismatch`; this is a quality signal to monitor, not a harness failure.

URL live RAG after fix:

- URL reached `ready` after about `2.026s`.
- Chat elapsed `2.247s`.
- Answer chars: `164`.
- Citations: `3`.
- Harness quality score: `1.0`.
- Built-in RAG verifier returned `pass`, score `1.0`.

## Browser Citation Jump

Real LLM-generated PDF citation jump passed on desktop and mobile:

- Evidence: `.collab/tasks/qa-browser-live-rag-citation-ux-2026-05-11.json`
- Desktop: `2` assistant citations, `138` visible PDF overlays after click, `0` console errors, no horizontal overflow.
- Mobile: `2` assistant citations, `138` visible PDF overlays after click, `0` console errors, no horizontal overflow.
- Screenshots:
  - `.collab/tasks/screenshots/2026-05-11/live-rag-citation-desktop.png`
  - `.collab/tasks/screenshots/2026-05-11/live-rag-citation-mobile.png`

## Cleanup

Kept browser fixtures were cleaned up:

- `.collab/tasks/qa-live-chat-rag-local-upload-deepseek-keep-cleanup-2026-05-11.json`
- `.collab/tasks/qa-live-chat-rag-local-url-deepseek-keep-cleanup-2026-05-11.json`

Both cleanup reports returned `users=0`, `documents=0`.

## Remaining Gaps

- This covers one representative PDF and one short URL. Broader private full-corpus RAG quality should still be run now that an LLM key is available.
- PDF answer passed the harness but the built-in verifier warned on claim/citation quality. Future prompt/retrieval tuning should track this.
- Browser live citation jump was tested on PDF. Browser live citation jump for text/URL viewer still needs coverage.

