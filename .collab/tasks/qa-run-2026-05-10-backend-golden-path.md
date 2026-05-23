# QA Run - 2026-05-10 - Backend Upload/Parse Golden Path

Scope: execute the first real backend functional slice for the long-run `/goal`: authenticated PDF upload, Celery parse, document ready polling, search retrieval, text-content retrieval, and cleanup.

## Environment

| Item | Result |
|---|---|
| Backend | Existing local `http://127.0.0.1:8000` healthy |
| Version | `0.17.1 beta` |
| Docker infra | Postgres, Redis, Qdrant, MinIO running |
| Celery | Existing `default,parse` worker processes running |
| `DEEPSEEK_API_KEY` | absent locally, so chat/RAG answer quality was not executed |
| `OPENROUTER_API_KEY` | present in `.env`, enough for embedding path |

## Artifacts

| Artifact | Purpose |
|---|---|
| `.collab/scripts/qa_backend_golden_path.py` | Reusable backend smoke: creates QA user/JWT, uploads a file, polls document ready, calls search/text-content, cleans up. |
| `.collab/tasks/qa-backend-golden-path-2026-05-10.json` | Machine-readable execution result with API responses and poll timeline. |

## Commands Run

```bash
docker compose ps
python3 -m alembic upgrade head
curl -sS http://127.0.0.1:8000/health
curl -sS http://127.0.0.1:8000/version
cd backend && python3 -m ruff check app/ tests/
cd backend && python3 -m pytest tests/test_parse_service.py tests/test_url_extractor.py -v

python3 .collab/scripts/qa_backend_golden_path.py \
  --api-base http://127.0.0.1:8000 \
  --file test_inputs/semiconductor.pdf \
  --query semiconductor \
  --timeout 240 \
  --json-out .collab/tasks/qa-backend-golden-path-2026-05-10.json
```

## Results

Baseline:

| Check | Result |
|---|---|
| `docker compose ps` | Postgres, Redis, Qdrant, MinIO running |
| Alembic upgrade | Pass, no pending migration output |
| `/health` | 200, status ok |
| `/version` | 200, `0.17.1 beta` |
| Ruff | Pass |
| Parse + URL extractor tests | Pass: 17 passed |

Golden path:

| Step | Result |
|---|---|
| Create QA user and JWT | Pass |
| Upload `test_inputs/semiconductor.pdf` | 202, document status `parsing` |
| Poll document | `parsing` at 0.452s, `ready` at 3.473s |
| Search `semiconductor` | 200, returned one result with page and normalized bbox payload |
| Text content | 200, returned 2 pages |
| Cleanup | QA user and owned docs deleted |

Warnings observed:
- `urllib3` LibreSSL warning from local Python.
- Qdrant client/server minor version mismatch warning: client `1.16.1`, server `1.14.1`.

## Coverage Added

This run covers a real authenticated backend path:
- JWT auth accepted by backend.
- Upload endpoint accepts a real file from `test_inputs`.
- Celery parse worker processes the document to `ready`.
- Search/retrieval returns chunk text plus page/bbox data.
- TextViewer data endpoint returns page content.
- Cleanup path deletes the temporary QA user and owned documents.

## Not Covered

- Browser upload UI was not exercised in this slice.
- Chat streaming and answer/citation quality were not executed because local `DEEPSEEK_API_KEY` is absent.
- Citation click/highlight UX was not exercised; this run only validates the backend bbox payload exists.
- URL import API was not exercised in this slice.

## Next Slice

1. Run URL import positive/negative matrix against the existing backend.
2. Run browser upload path through the frontend proxy/direct upload token flow.
3. Run chat/RAG answer quality against an environment with `DEEPSEEK_API_KEY`.

