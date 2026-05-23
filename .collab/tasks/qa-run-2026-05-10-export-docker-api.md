# QA Run - 2026-05-10 - Docker API Export Matrix

Scope: verify the PDF export environment issue in a Railway-like Docker backend image. The host-Python backend still lacks local WeasyPrint system libraries, so this run checks the Dockerfile path used by `backend/railway.toml`.

## Environment

| Item | Result |
|---|---|
| Docker image | `doctalk-backend-pdf-export-qa:latest` built from `backend/Dockerfile` |
| Docker image ID | `5afc21d14e0e` |
| Temporary API | `http://127.0.0.1:8001` |
| Database / Redis / Qdrant / MinIO | Local Docker services via `host.docker.internal` |
| Test account state | Temporary QA users, cleaned up |

## Commands Run

```bash
docker build -t doctalk-backend-pdf-export-qa -f backend/Dockerfile .

docker run --rm -i doctalk-backend-pdf-export-qa python - <<'PY'
from app.services.export_service import render_pdf
from types import SimpleNamespace
messages = [
    SimpleNamespace(role='user', content='Summarize the semiconductor document.', citations=None),
    SimpleNamespace(role='assistant', content='The document includes a semiconductor reading list and notes. [1]', citations=[{'ref_index': 1, 'page': 1, 'text_snippet': 'semiconductor reading list'}]),
]
data = render_pdf('QA PDF Export', 'semiconductor.pdf', messages).getvalue()
print({'bytes': len(data), 'header': data[:4].decode('latin1')})
assert data.startswith(b'%PDF')
PY

docker run --rm --name doctalk-backend-export-api-qa \
  -p 8001:8000 \
  --env-file .env \
  -e DATABASE_URL=postgresql+asyncpg://doctalk:doctalk@host.docker.internal:5432/doctalk \
  -e CELERY_BROKER_URL=redis://host.docker.internal:6379/0 \
  -e QDRANT_URL=http://host.docker.internal:6333 \
  -e MINIO_ENDPOINT=host.docker.internal:9000 \
  doctalk-backend-pdf-export-qa

python3 .collab/scripts/qa_export_matrix.py \
  --api-base http://127.0.0.1:8001 \
  --timeout 240 \
  --poll-interval 3 \
  --json-out .collab/tasks/qa-export-matrix-docker-api-2026-05-10.json

docker stop doctalk-backend-export-api-qa
```

## Results

Overall: **Pass**.

| Check | Result |
|---|---|
| Direct Docker `render_pdf` smoke | Pass: 145,546 bytes, `%PDF` header |
| Docker API export matrix | Pass: 11/11 checks |
| Plus Markdown export | 200, `text/markdown`, sanitized filename headers |
| Plus DOCX export | 200, DOCX content type, `PK` body |
| Plus PDF export | 200, `application/pdf`, 185,587 bytes, `%PDF` body |
| Free Markdown export | 200 |
| Free DOCX/PDF paid gate | 403 `EXPORT_REQUIRES_PAID_PLAN` |
| Other user / anonymous boundaries | 404 / 401 as expected |
| Invalid format / missing session / message limit | 422 / 404 / 400 as expected |
| Cleanup | QA users/docs deleted |

## Verdict

The production-style Docker image has the system libraries required for PDF export. The earlier `EXPORT_RENDERER_FAILED` is a host-local development dependency gap, not a Docker/Railway image failure.

Remaining gap: browser export UX still needs testing from the frontend.
