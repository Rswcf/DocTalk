# Table Extraction Refactor QA Closure

Date: 2026-05-11

## Objective

Refactor the table extraction feature so complex/low-quality parser output can be rebuilt by an LLM-backed workflow, then run comprehensive targeted tests.

## Delivered changes

- Added `table_reconstruct` as a first-class async document job.
- Added LLM table reconstruction using parser draft rows, page text, and optional PDF word-box context.
- Added JSON parsing/repair, source-number grounding checks, confidence adjustment, and rejection of mostly ungrounded numeric output.
- Updated reconstructed `DocumentTable` rows, method, confidence, metadata, warnings, and synchronized `DocumentElement` table text for downstream use.
- Added a paid-plan API endpoint: `POST /api/document-tables/{table_id}/reconstruct`.
- Extended table job polling to include reconstruction jobs.
- Added frontend `AI rebuild` action, job status copy, parser quality warnings, AI rebuilt warnings, and warning display.
- Extended frontend table types/API helpers for reconstruction metadata and warnings.

## Prompt-to-artifact checklist

| Requirement | Evidence |
|---|---|
| Preserve existing table scan/export behavior | Existing scan/export API paths unchanged; table tests still pass. |
| Add model-based table rebuilding instead of blind parser-only extraction | `backend/app/services/table_service.py` adds `reconstruct_document_table_with_outcome` and `run_table_reconstruction_job_sync`. |
| Avoid ungrounded LLM table hallucination | `normalize_reconstructed_table_payload` checks reconstructed numeric tokens against source context and rejects mostly ungrounded output. |
| Support async production workflow | `backend/app/workers/table_worker.py` adds `run_table_reconstruction_job`. |
| Expose backend API | `backend/app/api/tables.py` adds `POST /document-tables/{table_id}/reconstruct`. |
| Make the UX explicit and reviewable | `frontend/src/components/Extraction/ExtractionPanel.tsx` adds `AI rebuild`, parser warnings, AI rebuilt warnings, and table warnings. |
| Keep CSV export compatible | Existing export endpoints continue reading `DocumentTable.cells.rows`; reconstructed rows use the same shape. |
| Add targeted tests | `backend/tests/test_table_service.py` and `backend/tests/test_tables_api.py` cover normalization, grounding rejection, service update, API plan gate, queueing, metadata serialization, and polling. |

## Validation evidence

- `cd backend && python3 -m py_compile app/services/table_service.py app/api/tables.py app/workers/table_worker.py`
- `cd backend && python3 -m pytest tests/test_table_service.py tests/test_tables_api.py -q`
  - Result: `17 passed`
- `cd backend && python3 -m ruff check app/services/table_service.py app/api/tables.py app/workers/table_worker.py tests/test_table_service.py tests/test_tables_api.py`
  - Result: pass
- `cd backend && python3 -m ruff check app/ tests/`
  - Result: pass
- `cd backend && python3 -m pytest tests/test_parse_service.py -v`
  - Result: `14 passed`
- `cd frontend && npm run build`
  - Result: pass

## Known gaps

Closed in follow-up runtime QA:

- `.collab/tasks/table-extraction-runtime-gap-closure-2026-05-11.md`
- `.collab/tasks/qa-live-table-reconstruction-financial-pdf-2026-05-11.json`
- `.collab/tasks/qa-browser-table-ai-rebuild-ux-2026-05-11-pass.json`
- Docker integration suite with `SKIP_INTEGRATION=0`: `4 passed`
