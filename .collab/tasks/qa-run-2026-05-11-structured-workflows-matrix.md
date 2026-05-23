# QA Run - Structured Workflows API Matrix - 2026-05-11

Scope: verify the API contract for structured extraction templates/jobs/exports, document table scan/list/export, and reusable question-template CRUD/runs/exports.

## Environment

| Item | Value |
|---|---|
| Harness | `.collab/scripts/qa_structured_workflows_matrix.py` |
| API | In-process FastAPI ASGI app via `httpx.ASGITransport` |
| Data | Synthetic ready Markdown documents with Markdown tables, plus synthetic not-ready documents |
| Accounts | Synthetic Pro owner, Plus user, Free user, and second Pro user |
| Workers | Celery enqueue hooks patched to no-op; selected jobs completed deterministically in DB |
| External services | No external LLM, no browser, no frontend server |
| Corpus | Did not mutate `test_inputs/`; synthetic docs were created and deleted in DB |
| Evidence | `.collab/tasks/qa-structured-workflows-matrix-2026-05-11.json` |

## Result

Pass: `40/40` checks.

Summary:

```json
{
  "total": 40,
  "passed": 40,
  "failed": [],
  "cleanup_ok": true
}
```

## Coverage

Structured extraction:

- Public template list includes `executive_summary`, `key_facts`, and `evidence_table`.
- Unsupported template returns `UNSUPPORTED_EXTRACTION_TEMPLATE`.
- Not-ready document returns `DOCUMENT_NOT_READY`.
- Free monthly extraction limit returns `EXTRACTION_LIMIT_REACHED`.
- Pro owner can create a queued extraction job, list it, fetch completed deterministic result, and export Markdown/CSV.
- Other user cannot get/export the owner's extraction job.

Table workflows:

- Not-ready document scan returns `DOCUMENT_NOT_READY`.
- Ready document scan creates a queued job and duplicate scan returns the existing job.
- Synchronous table scan detects the Markdown table.
- Owner can fetch scan job, list detected tables, export one table as CSV, and export all document tables.
- Other user receives 404 on job/list/export boundaries.
- Free user receives plan-required response for table export.

Question templates:

- Create normalizes question text; empty questions are rejected.
- Owner list/update/delete paths pass; other-user list is empty and update/delete boundaries return 404.
- Free document run requires Plus; Plus collection run requires Pro; not-ready document run returns 409.
- Pro owner can create a document run, fetch/list completed deterministic result, and export Markdown/CSV.
- Other user cannot fetch the owner's run.

## Cleanup

The harness deleted all synthetic users and documents. Independent DB counts returned:

```json
{
  "users": 0,
  "documents": 0,
  "product_events": 0,
  "qa_structured_users": 0,
  "qa_structured_documents": 0
}
```

## Validation

Passed during this slice:

- `python3 -m py_compile .collab/scripts/qa_structured_workflows_matrix.py`
- `cd backend && python3 -m ruff check app/ tests/ ../.collab/scripts/qa_structured_workflows_matrix.py`
- `python3 .collab/scripts/qa_structured_workflows_matrix.py --json-out .collab/tasks/qa-structured-workflows-matrix-2026-05-11.json`
- `cd backend && python3 -m pytest tests/test_extractions_api.py tests/test_tables_api.py tests/test_question_templates_api.py tests/test_table_service.py tests/test_extraction_service.py tests/test_question_template_service.py -v` (`30 passed, 6 warnings`)
- `jq '.result, .summary, .cleanup, [.checks[] | select(.result!="pass")]' .collab/tasks/qa-structured-workflows-matrix-2026-05-11.json`

## Remaining Gap

This closes API-contract coverage for these structured workflows. It does not verify live LLM answer quality for extraction/question-template outputs, nor the browser UX of `ExtractionPanel` and `QuestionTemplatesPanel`; those need separate live/backend-worker and browser interaction slices.
