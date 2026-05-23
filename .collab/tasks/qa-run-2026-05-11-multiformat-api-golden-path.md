# QA Run - Multi-Format API Golden Path - 2026-05-11

Scope: verify generated DOCX, PPTX, XLSX, TXT, and Markdown fixtures through the API-level upload and parse path.

## Environment

| Item | Value |
|---|---|
| API | In-process FastAPI ASGI app |
| DB/Object storage | Local Docker Postgres + MinIO |
| Embedding/Qdrant | Deterministic fake embedding + fake Qdrant client, to avoid external provider credentials |
| Fixtures | Generated in memory by `.collab/scripts/qa_multiformat_extraction_matrix.py` |
| Harness | `.collab/scripts/qa_multiformat_api_golden_path.py` |
| Evidence | `.collab/tasks/qa-multiformat-api-golden-path-2026-05-11.json` |

The harness disables Celery auto-dispatch, calls the real upload endpoint, then runs the parse worker manually in the same process.

## Result

Pass.

Each case verified:

- `POST /api/documents/upload` returns `202`
- manual parse worker reaches `ready`
- document detail preserves `file_type`
- `GET /api/documents/{id}/text-content` returns extracted pages
- `POST /api/documents/{id}/search` returns at least one lexical result
- fake Qdrant received vector upserts, proving the shared indexing path was traversed

## Cases

| Case | Format | Pages | Chunks Indexed | Search Results |
|---|---:|---:|---:|---:|
| `docx_paragraphs_table_cjk` | DOCX | 2 | 3 | 1 |
| `pptx_slide_table_notes` | PPTX | 1 | 3 | 2 |
| `xlsx_multisheet_markdown_tables` | XLSX | 2 | 2 | 1 |
| `txt_utf8_long_en_cjk` | TXT | 1 | 10 | 3 |
| `md_headings_and_table` | MD | 2 | 3 | 2 |

## Cleanup

The harness-created QA user and documents were deleted. Independent DB check returned:

```json
{
  "qa_multiformat_api_users": 0,
  "qa_prefixed_documents": 0
}
```

## Validation

Post-run checks passed:

- `python3 -m py_compile .collab/scripts/qa_multiformat_api_golden_path.py`
- `jq empty .collab/tasks/qa-multiformat-api-golden-path-2026-05-11.json`
- `cd backend && python3 -m ruff check app/ tests/ ../.collab/scripts/qa_multiformat_api_golden_path.py`
- `git diff --check`

## Remaining Gap

This closes non-PDF API upload/parse/text/search coverage for generated fixtures. It does not verify non-PDF live chat answers, LLM citations, or browser citation jumps; those still require an LLM key and browser workflow coverage.
