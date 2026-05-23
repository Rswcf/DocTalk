# QA Run - 2026-05-11 - Retrieval Prompt Matrix

## Scope

No-LLM retrieval and citation-candidate quality coverage for representative `test_inputs` PDFs. This slice verifies:

- authenticated upload
- parse to `ready`
- indexed chunk availability
- document search for user-style prompt families
- returned citation-candidate shape: `chunk_id`, `page`, snippet text, and bbox payloads
- cleanup of synthetic QA data

This complements live RAG answer-quality runs. It does not judge final generated answers because the local backend process did not have a usable DeepSeek key configured for this slice.

## Environment

| Item | Value |
|---|---|
| Backend | Local FastAPI on `http://127.0.0.1:8000` |
| Worker/infra | Existing local Redis/Celery, Postgres, Qdrant, MinIO |
| Account | Synthetic Pro QA user |
| Corpus | 5 representative PDFs from `test_inputs/` |
| External LLM | Not used for the passing retrieval matrix |
| Evidence | `.collab/tasks/qa-retrieval-prompt-matrix-2026-05-11.json` |

## Harnesses

- `.collab/scripts/qa_retrieval_prompt_matrix.py`
- `.collab/scripts/qa_live_rag_multi_prompt_matrix.py`

The second harness was added for future live multi-prompt answer-quality runs. A one-prompt probe reached upload/parse/session but was blocked by backend `LLM_ERROR` because the local backend process had no configured DeepSeek key:

- `.collab/tasks/qa-live-rag-multi-prompt-blocked-no-env-2026-05-11.json`

No key was written to repo files or artifacts.

## Result

Pass: `5/5` cases, `15/15` retrieval queries.

```json
{
  "result": "pass",
  "summary": {
    "cases_total": 5,
    "queries_total": 15,
    "queries_passed": 15,
    "queries_failed": 0
  },
  "cleanup_counts": {
    "users": 0,
    "documents": 0
  }
}
```

## Cases

| Case | File | Pages | Chunks | Query Coverage | Result |
|---|---:|---:|---:|---|---|
| `semiconductor-small-en` | `test_inputs/semiconductor.pdf` | 2 | 12 | topic, DeepSeek/semiconductor specific term, negative home-address query | Pass |
| `pan-zh-market` | `test_inputs/盘中解读.pdf` | 12 | 13 | Chinese market/investment terms, Chinese summary terms, negative home-address query | Pass |
| `memory-mania-en` | `test_inputs/Memory Mania_ How a Once-in-Four-Decades Shortage Is Fueling a Memory Boom.pdf` | 35 | 48 | memory thesis, shortage/timeframe, supply-demand | Pass |
| `ssrn-long-academic` | `test_inputs/ssrn-3247865.pdf` | 361 | 581 | academic subject, trading-strategy method, negative home-address query | Pass |
| `ai-nuclear-energy` | `test_inputs/AI for nuclear energy Powering an intelligent, resilient future - Microsoft Industry Blogs.pdf` | 1 | 16 | AI/nuclear topic, operations use case, safety/reliability | Pass |

## Assertions

For each query:

- `/api/documents/{document_id}/search` returned HTTP 200.
- Positive queries returned one or more results.
- Combined result snippets contained expected evidence terms.
- Result shape was suitable for citation use: string `chunk_id`, integer `page`, string `text`, bbox payload present when available.
- Negative/unanswerable queries were allowed to return semantically adjacent chunks because vector retrieval is not the answer policy layer; those are flagged as inputs for live answer-grounding tests, not retrieval failures.

## Observations

- The long SSRN academic PDF parsed to 361 pages and 581 indexed chunks, then returned relevant trading/strategy chunks for both academic-subject queries.
- CJK search over `盘中解读.pdf` returned Chinese snippets with expected market terms.
- The AI/nuclear PDF is a one-page converted/web-style PDF with mixed English/Chinese text; retrieval still returned relevant snippets for nuclear operations and reliability queries.
- Negative queries such as home-address prompts produce retrieval candidates instead of zero results. The final chat layer must still state that the document does not provide the requested private/impossible fact; this remains a live LLM quality requirement.

## Cleanup

The harness deleted the synthetic Pro user and all owned documents:

```json
{
  "users": 0,
  "documents": 0
}
```

## Validation

Commands run:

- `python3 -m py_compile .collab/scripts/qa_retrieval_prompt_matrix.py .collab/scripts/qa_live_rag_multi_prompt_matrix.py`
- `python3 .collab/scripts/qa_retrieval_prompt_matrix.py --json-out .collab/tasks/qa-retrieval-prompt-matrix-2026-05-11.json`
- `jq empty .collab/tasks/qa-retrieval-prompt-matrix-2026-05-11.json .collab/tasks/qa-live-rag-multi-prompt-blocked-no-env-2026-05-11.json`
- `cd backend && python3 -m ruff check app/ tests/ ../.collab/scripts/qa_retrieval_prompt_matrix.py ../.collab/scripts/qa_live_rag_multi_prompt_matrix.py`
- `cd backend && python3 -m pytest tests/test_parse_service.py -v`
- `git diff --check`

## Remaining Gap

This improves evidence for retrieval and citation-candidate quality over representative `test_inputs` documents, but it is not a substitute for full-corpus multi-prompt live answer scoring. Completion still requires live LLM answer-quality evaluation for summary, specific fact, numerical/table, negative/unanswerable, multilingual, and adversarial prompt families.
