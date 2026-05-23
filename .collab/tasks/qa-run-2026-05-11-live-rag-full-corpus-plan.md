# QA Run - Live RAG Full-Corpus Plan - 2026-05-11

Scope: extend the private live RAG harness from representative sampling toward a shardable full-corpus answer-quality matrix over every supported PDF in `test_inputs/`.

## Environment

| Item | Value |
|---|---|
| Backend | Not contacted in plan-only mode |
| Frontend | Not required |
| Corpus inventory | `.collab/tasks/qa-corpus-inventory-2026-05-10.json` |
| Harness | `.collab/scripts/qa_live_rag_multi_prompt_matrix.py` |
| Evidence | `.collab/tasks/qa-live-rag-multi-prompt-full-corpus-plan-2026-05-11.json` |
| Shard evidence | `.collab/tasks/qa-live-rag-multi-prompt-full-corpus-plan-shard0-2026-05-11.json` |

No LLM provider key was used, echoed, or written for this plan-only run. Actual answer-quality execution must use the normal local/CI secret path for the backend environment.

## Commands

```bash
python3 -m py_compile .collab/scripts/qa_live_rag_multi_prompt_matrix.py

python3 .collab/scripts/qa_live_rag_multi_prompt_matrix.py \
  --from-inventory \
  --plan-only \
  --json-out .collab/tasks/qa-live-rag-multi-prompt-full-corpus-plan-2026-05-11.json

python3 .collab/scripts/qa_live_rag_multi_prompt_matrix.py \
  --from-inventory \
  --plan-only \
  --start-index 0 \
  --max-cases 5 \
  --json-out .collab/tasks/qa-live-rag-multi-prompt-full-corpus-plan-shard0-2026-05-11.json
```

## Result

Full plan:

- `50` PDF cases selected from `test_inputs/`.
- `239` prompt executions planned.
- `189` prompts require citations.
- `50` negative/unanswerable prompts check refusal to invent unsupported personal-address facts.
- Locale mix: `42` latin-filename cases, `8` CJK-filename cases.
- Plan boundary: `48` Free-sized PDFs, `2` Plus-sized PDFs.
- Page range: `1` to `361` pages.

Prompt families:

| Prompt | Count | Purpose |
|---|---:|---|
| `summary_cited` | 50 | Grounded summary with citations |
| `specific_topic` | 50 | Subject/organization/market extraction with citations |
| `numbers_dates_cited` | 39 | Numeric/date/time-period extraction with citations for multi-page docs |
| `negative_unanswerable` | 50 | Do not invent unsupported private-address facts |
| `cross_language_zh` | 42 | Chinese answer over English/latin-filename documents |
| `cross_language_en` | 8 | English answer over CJK-filename documents |

Shard 0 plan:

- `5` PDF cases.
- `20` prompt executions.
- `15` prompts require citations.

## Execution Command When Backend Is Configured

Run shards instead of one large monolithic run so failures and cleanup are easier to inspect:

```bash
python3 .collab/scripts/qa_live_rag_multi_prompt_matrix.py \
  --from-inventory \
  --start-index 0 \
  --max-cases 5 \
  --json-out .collab/tasks/qa-live-rag-multi-prompt-full-corpus-shard0-2026-05-11.json
```

Repeat with `--start-index 5`, `10`, etc. until all 50 planned cases have executed.

## Current Status

This run closes the planning and shardability gap for full-corpus live RAG, but it does not close the answer-quality gap. Completion still requires running the planned prompts against a backend that already has its normal `DEEPSEEK_API_KEY` configuration, then triaging functional failures and verifier warnings.
