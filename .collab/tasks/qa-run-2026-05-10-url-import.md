# QA Run - 2026-05-10 - URL Import Matrix

Scope: execute the URL import slice of the long-run `/goal`: positive webpage import, SSRF/security negatives, document ready polling, text-content retrieval, and cleanup.

## Environment

| Item | Result |
|---|---|
| Backend | Existing local `http://127.0.0.1:8000` healthy |
| Version | `0.17.1 beta` |
| Docker infra | Postgres, Redis, Qdrant, MinIO running |
| Celery | Existing `default,parse` worker processes running |

## Artifacts

| Artifact | Purpose |
|---|---|
| `.collab/scripts/qa_url_import_matrix.py` | Reusable URL import matrix: creates QA user/JWT, runs negative URL cases, imports a positive URL, waits for ready, checks text-content, cleans up. |
| `.collab/tasks/qa-url-import-matrix-2026-05-10.json` | Machine-readable URL import execution result. |

## Command Run

```bash
python3 .collab/scripts/qa_url_import_matrix.py \
  --api-base http://127.0.0.1:8000 \
  --positive-url https://example.com \
  --timeout 180 \
  --json-out .collab/tasks/qa-url-import-matrix-2026-05-10.json
```

## Results

Negative matrix:

| Case | URL | Expected | Actual | Result |
|---|---|---|---|---|
| missing supported scheme | `ftp://example.com/report` | `400 URL_INVALID` | `400 URL_INVALID` | Pass |
| localhost blocked | `http://127.0.0.1:8000/health` | `400 URL_FETCH_BLOCKED` | `400 URL_FETCH_BLOCKED` | Pass |
| internal port blocked | `http://example.com:5432/` | `400 URL_FETCH_BLOCKED` | `400 URL_FETCH_BLOCKED` | Pass |

Positive import:

| Step | Result |
|---|---|
| POST `/api/documents/ingest-url` with `https://example.com` | 202, filename `Example Domain`, status `parsing` |
| Poll document | `parsing` at 0.211s, `ready` at 3.227s |
| Document metadata | `file_type=url`, `source_url=https://example.com` |
| Text content | 200, 1 page |
| Cleanup | QA user and owned docs deleted |

Warnings observed:
- `urllib3` LibreSSL warning from local Python.
- Qdrant client/server minor version mismatch warning: client `1.16.1`, server `1.14.1`.

## Coverage Added

This run covers:
- URL import authentication and plan path.
- Positive HTML-to-document parse path.
- URL-derived document metadata.
- TextViewer backend data for URL documents.
- SSRF guardrails for invalid scheme, localhost, and blocked internal ports.

## Not Covered

- Browser URL import UI was not exercised in this slice.
- URL chat/citations were not exercised because local `DEEPSEEK_API_KEY` is absent.
- Redirect loop, too-many-redirects, huge content, PDF URL, CJK article, and table-heavy webpage cases remain for the broader URL matrix.

