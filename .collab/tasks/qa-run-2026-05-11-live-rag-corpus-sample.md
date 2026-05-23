# QA Run - Private Live RAG Corpus Sample - 2026-05-11

Scope: run representative `test_inputs/` documents through local authenticated upload, parse, session creation, live DeepSeek SSE chat, citation events, chunk fetch, message persistence, and cleanup.

## Environment

| Item | Value |
|---|---|
| Backend | `http://127.0.0.1:8000`, temporary uvicorn process |
| Frontend | Not required for this API quality run |
| Corpus | 5 representative PDFs from `test_inputs/` |
| Harnesses | `.collab/scripts/qa_live_rag_corpus_sample.py`, `.collab/scripts/qa_live_chat_rag_matrix.py` |

The DeepSeek API key was provided by the user and used only as a process environment variable for the temporary local backend. It was not written to repo files or QA artifacts.

## Cases

| Case | File | Result After Fix | Answer Chars | Citations | Verifier |
|---|---|---:|---:|---:|---|
| `semiconductor-small-en` | `test_inputs/semiconductor.pdf` | Pass | `1076` | `6` | Warn, score `0.32` |
| `pan-zh-market` | `test_inputs/盘中解读.pdf` | Pass | `407` | `10` | Pass, score `1.0` |
| `memory-mania-en` | `test_inputs/Memory Mania_ How a Once-in-Four-Decades Shortage Is Fueling a Memory Boom.pdf` | Pass | `3253` | `21` | Warn, score `0.0` |
| `ssrn-long-academic` | `test_inputs/ssrn-3247865.pdf` | Pass | `342` | `2` | Warn, score `0.44` |
| `gs-funds-cjk-one-page` | `test_inputs/GS 资金流.PDF` | Pass | `1100` | `8` | Warn, score `0.0` |

Final aggregate:

- Evidence: `.collab/tasks/qa-live-rag-corpus-sample-after-harness-fix-2026-05-11.json`
- Result: `LIVE_RAG_CORPUS_SAMPLE PASS: 5/5`

## Findings

### Fixed Product Bug

The initial corpus sample found a real routing bug on `ssrn-long-academic`: the prompt "What is the central argument or subject of this academic paper? Answer concisely and cite the source." was incorrectly routed to the Legal / Academic Evidence Table tool and returned no citations.

Bug report:

- `.collab/tasks/bug-2026-05-11-academic-summary-misroutes-to-evidence-table.md`

Fix:

- `backend/app/services/action_planner.py` now requires explicit deliverable intent before routing evidence/legal/academic language to `EXTRACT_DELIVERABLE`.
- `backend/tests/test_action_planner.py` covers the ordinary academic-paper question and the explicit evidence-table deliverable.

Retest:

- `.collab/tasks/qa-live-rag-corpus-sample-ssrn-retake-after-planner-fix-2026-05-11.json`
- Result: pass, answer chars `326`, citations `2`

### Fixed Harness Issue

The first full retest after the planner fix produced a valid SSRN answer with citations and verifier score `1.0`, but the harness still failed because it expected the literal word `paper`. The answer used "document" and correctly identified the subject as quantitative trading strategies.

Harness fix:

- `.collab/scripts/qa_live_rag_corpus_sample.py` now expects `trading` for `ssrn-long-academic`.

### Quality Warnings

The harness-level functional gates passed for all five cases, but the built-in verifier still flagged citation/claim quality warnings in four cases:

- `semiconductor-small-en`: uncited claim units, low overlap, numeric mismatch.
- `memory-mania-en`: uncited claim units, low overlap, numeric mismatch.
- `ssrn-long-academic`: numeric mismatch.
- `gs-funds-cjk-one-page`: uncited claim units, low overlap, numeric mismatch.

These are not stream/citation plumbing failures, but they are meaningful RAG-quality signals. They should drive later prompt/retrieval/evaluator tuning before claiming full factual-quality completion.

## Cleanup

Each harness-created QA user and owned document was deleted by `.collab/scripts/qa_live_chat_rag_matrix.py`.

## Remaining Gaps

- This is representative sampling, not the full 50-file corpus with multiple prompt families per document.
- Browser citation-jump UX for URL/text documents still needs live LLM coverage.
- Real diff-result browser UX still needs execution.
