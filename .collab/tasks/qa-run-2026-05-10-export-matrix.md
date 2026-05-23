# QA Run - 2026-05-10 - Session Export Matrix

Scope: execute the session export slice of the long-run `/goal`: Markdown/DOCX/PDF export, paid-plan gates, cross-user and anonymous boundaries, invalid format validation, message-count validation, citation references, and export filename headers.

## Environment

| Item | Result |
|---|---|
| Backend | Existing local `http://127.0.0.1:8000` healthy |
| Docker infra | Postgres, Redis, Qdrant, MinIO running |
| Celery | Existing `default,parse` worker processes running |
| Test file | `test_inputs/semiconductor.pdf` |
| Paid account | Temporary Plus QA user |
| Free account | Temporary Free QA user |
| Other account | Temporary Free QA user |

## Artifacts

| Artifact | Purpose |
|---|---|
| `.collab/scripts/qa_export_matrix.py` | Reusable export workflow, gate, boundary, and validation matrix. |
| `.collab/tasks/qa-export-matrix-2026-05-10.json` | Machine-readable export execution result. |
| `.collab/tasks/bug-2026-05-10-pdf-export-renderer-unavailable-local.md` | Environment/product risk report for local PDF export renderer failure. |

## Command Run

```bash
python3 .collab/scripts/qa_export_matrix.py \
  --api-base http://127.0.0.1:8000 \
  --file test_inputs/semiconductor.pdf \
  --timeout 240 \
  --json-out .collab/tasks/qa-export-matrix-2026-05-10.json
```

## Results

Overall: **Mixed**. 10/11 checks passed. The only failure was paid PDF export in the local host-Python backend environment.

Document setup:

| Document | Ready Time |
|---|---:|
| Plus user document | 3.127s |
| Free user document | 3.077s |

Export checks:

| Case | Expected | Actual | Result |
|---|---|---|---|
| Plus Markdown export | 200 `text/markdown` | 200, 353 bytes | Pass |
| Plus DOCX export | 200 DOCX | 200, 36,865 bytes, ZIP/DOCX header | Pass |
| Plus PDF export | 200 PDF | 500 `EXPORT_RENDERER_FAILED` | Fail |
| Free Markdown export | 200 `text/markdown` | 200, 339 bytes | Pass |
| Free DOCX export | 403 `EXPORT_REQUIRES_PAID_PLAN` | 403 | Pass |
| Free PDF export | 403 `EXPORT_REQUIRES_PAID_PLAN` | 403 | Pass |
| Other user exports owner session | 404 | 404 | Pass |
| Anonymous export | 401 | 401 | Pass |
| Invalid `format=txt` | 422 | 422 | Pass |
| Missing session export | 404 | 404 | Pass |
| 501-message Markdown export | 400 `MESSAGE_LIMIT_EXCEEDED` | 400 | Pass |

Header and content checks:
- Markdown/DOCX responses include both `filename=` and RFC 5987 `filename*=UTF-8''...`.
- CR/LF in the synthetic session title did not appear in `Content-Disposition`.
- Markdown export included Q/A content and references with the expected citation snippet.
- The reusable script now also asserts Markdown export does not expose private citation fields: `document_id`, `bboxes`, `confidence_score`.

PDF export failure diagnosis:
- Local direct `render_pdf(...)` reproduction raises `ExportError: PDF export is not available: weasyprint not installed or system libraries missing`.
- Root import error is missing `libgobject-2.0-0`.
- `backend/Dockerfile` does install WeasyPrint system dependencies (`libpango`, `libpangocairo`, `libgdk-pixbuf`), so this is most likely a host local-dev environment blocker, not proof of a production Docker failure.

Cleanup:
- QA users and owned docs were deleted automatically.
- Verification query returned `qa_export_users=0`, `qa_export_docs=0`.

Warnings observed:
- `urllib3` LibreSSL warning from local Python.
- Qdrant client/server minor version mismatch warning: client `1.16.1`, server `1.14.1`.

## Coverage Added

This run covers:
- Session export route authentication and ownership checks.
- Markdown and DOCX rendering with synthetic citation data.
- Export filename header hardening for non-ASCII title and CR/LF input.
- Free-plan backend gates for paid DOCX/PDF export.
- Invalid format and missing session error taxonomy.
- Export message-count validation.

## Not Covered

- Browser export buttons, downloaded file naming in the browser, and frontend paywall UX were not exercised in this slice.
- PDF export still needs verification in Docker/production-like backend where WeasyPrint system libraries are present.
- Export of real LLM-generated answers was not exercised because local `DEEPSEEK_API_KEY` is absent.
