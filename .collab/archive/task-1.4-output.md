I’ve implemented the PDF parse worker pipeline and wired task dispatch. Key parts:

**What I Added**
- Celery app and routing
  - backend/app/workers/celery_app.py: Celery app reads `CELERY_BROKER_URL`, routes `app.workers.parse_worker.parse_document` to `parse` queue.
- ParseService (PyMuPDF + cleaning + chunking)
  - backend/app/services/parse_service.py: 
    - extract_pages(...): 64
    - detect_scanned(...): 112
    - clean_text_blocks(...): 126
    - chunk_document(...): 161
  - Features: header/footer removal (top/bottom 10% repeated >60%), hyphenation repair, heading detection (size > median×1.3), 300–500 token chunks with 50-token overlap, normalized bboxes [0,1] top-left origin.
- Sync DB session for workers
  - backend/app/models/sync_database.py: sync engine/session, converts `postgresql+asyncpg` → `+psycopg`.
- Parse Worker task
  - backend/app/workers/parse_worker.py: 41
    - Downloads PDF from MinIO, extracts pages, scans detection, writes `pages` and `chunks`, updates `documents.pages_parsed` every 10 pages, sets `chunks_total`. Errors mark document as `status=error` with message.
- DocService dispatch
  - backend/app/services/doc_service.py:
    - create_document(...): 19 — uploads to MinIO (using `storage_service`), creates document (status=parsing), dispatches `parse_document.delay(id)`.
    - get_document(...): 63, mark_deleting(...): 68
- API already present is compatible
  - backend/app/api/documents.py (works with new DocService + StorageService)
- Task update
  - .collab/tasks/current.md: Task 1.4 set to DONE with CX_NOTES.

**How To Run**
- Start API: `cd backend && uvicorn app.main:app --reload`
- Start Celery worker: `cd backend && celery -A app.workers.celery_app.celery_app worker -Q parse -l info`
- Upload a PDF via POST `/api/documents/upload`. The parse worker runs; progress visible via GET `/api/documents/{id}`; file URL via GET `/api/documents/{id}/file-url`.

**Notes**
- Bboxes are normalized per-page; clamped to [0,1] for robustness.
- Sentences inherit paragraph bboxes (coarse but suitable for viewer highlights).
- Sync DB requires a sync Postgres driver. URL is auto-converted to `+psycopg`; ensure the driver is installed in the runtime image.

If you want, I can add a minimal embedding worker next or provide a simple script to validate parsed chunks for a sample PDF.