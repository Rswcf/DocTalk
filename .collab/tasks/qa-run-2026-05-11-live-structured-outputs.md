# QA Run - Live Structured Outputs - 2026-05-11

Scope: add and exercise a live-quality harness for the LLM-backed structured extraction and question-template worker paths.

## Environment

| Item | Value |
|---|---|
| Harness | `.collab/scripts/qa_live_structured_outputs_matrix.py` |
| Data | Synthetic ready Markdown documents with real `Page` and `Chunk` rows |
| Execution path | `run_extraction_job_sync` and `run_batch_template_job_sync` |
| Evidence, plan | `.collab/tasks/qa-live-structured-outputs-plan-2026-05-11.json` |
| Evidence, blocked run | `.collab/tasks/qa-live-structured-outputs-blocked-no-env-2026-05-11.json` |

No LLM provider key was used, echoed, or written by this run. The harness checks the backend's normal provider configuration and classifies missing provider configuration as blocked.

## Commands

```bash
python3 -m py_compile .collab/scripts/qa_live_structured_outputs_matrix.py

python3 .collab/scripts/qa_live_structured_outputs_matrix.py \
  --plan-only \
  --json-out .collab/tasks/qa-live-structured-outputs-plan-2026-05-11.json

python3 .collab/scripts/qa_live_structured_outputs_matrix.py \
  --allow-blocked \
  --json-out .collab/tasks/qa-live-structured-outputs-blocked-no-env-2026-05-11.json
```

## Planned Coverage

The matrix has `5` live-quality cases:

| Case | Kind | Input | Quality Focus |
|---|---|---|---|
| `extraction-executive-summary` | Extraction | Finance memo | cited summary, risks/open questions |
| `extraction-key-facts` | Extraction | Finance memo | numeric facts and source refs |
| `extraction-evidence-table` | Extraction | Product plan | evidence table with cited findings |
| `question-template-document` | Question template | Finance memo | 3 cited answers over one document |
| `question-template-collection` | Question template | Finance + product docs | 2 cited answers across a collection |

Synthetic corpus:

- `qa-live-structured-finance.md`: revenue `42`, retention `94%`, churn `3%`, Q2/Q3 timing, support and renewal risks.
- `qa-live-structured-product.md`: launch readiness, support coverage, rollback checks, escalation channel, and CJK customer feedback text.

## Blocked Execution Result

The real worker path was exercised far enough to create synthetic QA data, create jobs, run the synchronous worker functions, record failed jobs, and clean up. The environment had no configured `DEEPSEEK_API_KEY`, so all LLM-backed cases were correctly classified as blocked rather than product failures:

```json
{
  "status": "blocked",
  "summary": {
    "cases_total": 5,
    "cases_passed": 0,
    "cases_failed": 0,
    "cases_blocked": 5
  },
  "provider_ready": false,
  "required_key": "DEEPSEEK_API_KEY",
  "cleanup": {
    "users": 0,
    "documents": 0,
    "product_events": 0
  }
}
```

Blocked cases:

- 3 extraction jobs failed with `EXTRACTION_FAILED` because `DEEPSEEK_API_KEY` was not configured.
- 2 question-template jobs failed with `BATCH_TEMPLATE_FAILED` for the same environment reason.
- Cleanup verified zero synthetic QA users, documents, and product events.

## Current Status

This closes the missing live structured-output harness and environment-blocked evidence. It does not prove live structured-output quality. Completion still requires rerunning the same harness with normal backend LLM configuration and reviewing the generated structured JSON, rendered Markdown, citations, and credit reconciliation.
