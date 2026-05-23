# QA Run - Document Diff Live LLM - 2026-05-11

Scope: execute a real document-diff LLM job without relying on Celery worker environment. The harness creates two controlled ready text documents in the local DB, creates a queued `document_diff` job with credit predebit metadata, calls `run_document_diff_job_sync()`, validates persisted artifacts, usage accounting, and credit reconciliation, then cleans up all QA rows.

## Environment

| Item | Value |
|---|---|
| Harness | `.collab/scripts/qa_document_diff_live_llm.py` |
| Raw JSON | `.collab/tasks/qa-document-diff-live-llm-2026-05-11.json` |
| LLM model | `deepseek-v4-pro` |
| Corpus | Controlled old/new refund-policy text fixtures inserted directly into local DB |

## Command

```bash
DEEPSEEK_API_KEY=... python3 .collab/scripts/qa_document_diff_live_llm.py \
  --json-out .collab/tasks/qa-document-diff-live-llm-2026-05-11.json
```

The key was supplied only as a temporary process environment variable and was not written to repo files or artifacts.

## Result

Status: **pass**. 8/8 checks passed.

| Check | Result |
|---|---|
| Job moved to `succeeded` | Pass |
| `ExtractionResult` persisted | Pass |
| Summary present | Pass |
| Changes present | Pass |
| Citations present | Pass |
| Markdown rendered | Pass |
| Usage record written | Pass |
| Predebit ledger reconciled to actual cost | Pass |

Observed output:

- Job cost: `3` credits.
- Usage: `285` prompt tokens, `283` completion tokens, `568` total tokens.
- Citations: `2`.
- Ledger reconciled from 60-credit predebit to actual `-3`; user balance ended at `997`.
- Cleanup returned `users=0`, `documents=0`, `jobs=0`, `usage_records=0`, `ledger_rows=0`.

Rendered markdown correctly identified:

- Refund review window changed from 7 to 14 days.
- Credit threshold changed from 100 to 500.
- Support email changed.
- Enterprise manager approval was added.

## Remaining Gap

This validates the real synchronous job execution path and accounting. Browser UX for a real diff result screen/export still needs coverage through the application UI.

