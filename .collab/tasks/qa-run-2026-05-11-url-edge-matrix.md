# QA Run - URL Edge Matrix - 2026-05-11

Scope: extend URL import coverage beyond `https://example.com` with deterministic extractor-level edge cases for redirects, CJK/table pages, PDF URLs, huge content, no-text pages, and redirect safety.

## Environment

| Item | Value |
|---|---|
| Harness | `.collab/scripts/qa_url_edge_matrix.py` |
| Fixture server | In-process `ThreadingHTTPServer` bound to `127.0.0.1` on a random port |
| DNS behavior | Harness patches `url_extractor.validate_and_resolve_url` so `fixture.test:{port}` resolves to the local fixture server while preserving redirect validation behavior |
| Backend services | No backend API server, database, Celery, Qdrant, or MinIO required |

## Result

Pass after fix.

Evidence:

- Initial run: `.collab/tasks/qa-url-edge-matrix-2026-05-11.json`
- Passing retest: `.collab/tasks/qa-url-edge-matrix-after-no-text-fix-2026-05-11.json`
- Bug: `.collab/tasks/bug-2026-05-11-url-image-only-title-imported.md`

Initial run:

- `7/8` cases passed.
- `image_only_no_text` failed because an image-only page with `<title>Image Only Landing</title>` imported as one page containing only the title instead of raising `NO_TEXT_CONTENT`.

Retest matrix:

| Case | Type | Expected | Result |
|---|---|---|---|
| `cjk_table_html` | positive | extracts Chinese article text and table cells | Pass |
| `single_safe_redirect` | positive | follows one safe redirect and extracts the destination | Pass |
| `pdf_url` | positive | returns PDF bytes and filename `sample.pdf` | Pass |
| `redirect_loop` | negative | `REDIRECT_LOOP` | Pass |
| `too_many_redirects` | negative | `TOO_MANY_REDIRECTS` | Pass |
| `huge_content_length` | negative | `URL_CONTENT_TOO_LARGE` | Pass |
| `image_only_no_text` | negative | `NO_TEXT_CONTENT` | Pass after fix |
| `redirect_to_private_host` | negative | `BLOCKED_HOST` | Pass |

Retest detail:

```json
{"total": 8, "passed": 8, "failed": 0}
```

The CJK/table extraction retained these source terms:

- `中文文章`
- `芯片`
- `FY2026 营收`
- `亚洲 Alpha`
- `42 亿美元`
- `Analyst note`

## Fix

Updated `backend/app/services/extractors/url_extractor.py` to reject title-only URL pages before page splitting. Added `test_fetch_and_extract_url_rejects_image_only_title_page` in `backend/tests/test_url_extractor.py`.

Also extended `backend/tests/test_error_taxonomy.py` so the authenticated `/api/documents/ingest-url` error surface maps these blocked fetch reasons to the same safe `URL_FETCH_BLOCKED` copy without leaking the internal reason:

- `BLOCKED_HOST`
- `BLOCKED_PORT`
- `REDIRECT_LOOP`
- `TOO_MANY_REDIRECTS`

## Validation

Passed:

- `python3 -m py_compile .collab/scripts/qa_url_edge_matrix.py`
- `python3 -m ruff check app/ tests/ ../.collab/scripts/qa_url_edge_matrix.py ../.collab/scripts/qa_url_import_matrix.py`
- `python3 -m pytest tests/test_parse_service.py tests/test_url_extractor.py tests/test_error_taxonomy.py -v` (`69 passed`)
- `jq empty .collab/tasks/qa-url-edge-matrix-2026-05-11.json .collab/tasks/qa-url-edge-matrix-after-no-text-fix-2026-05-11.json`
- `git diff --check`
- Port check: no listener on `3000` or `8000`

## Remaining Gap

This is extractor-level URL edge coverage. It does not run the full authenticated `/api/documents/ingest-url` document-creation path for every fixture case, because the production SSRF guard intentionally blocks local/private hosts. The existing API URL matrix still covers the authenticated API path for a public positive URL and selected SSRF negatives.
