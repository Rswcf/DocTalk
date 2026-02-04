I reviewed the tech spec (Sec. 9), Task 1.3, and the backend code (config, models, deps). I then implemented StorageService, DocService, Pydantic schemas, API routes, router registration, and startup bucket init, and marked the task DONE with notes.

What I changed

- Storage service
  - File: backend/app/services/storage_service.py:1
  - MinIO client initialized from `settings`, supports endpoint with/without scheme.
  - Methods:
    - ensure_bucket(): creates bucket if not present.
    - upload_file(file_bytes, storage_key): uploads with content-type application/pdf.
    - get_presigned_url(storage_key, ttl): presigned GET URL using TTL (defaults to `MINIO_PRESIGN_TTL`).
    - delete_file(storage_key): removes object (ignores not-found).
  - Singleton: `storage_service`.

- Document service
  - File: backend/app/services/doc_service.py:1
  - Methods:
    - create_document(file, db_session): validates type/size; pre-generates UUID; storage_key = documents/{uuid}/{filename}; uploads first; then creates DB record with status=parsing; returns document_id.
    - get_document(document_id, db_session): fetches Document.
    - mark_deleting(document_id, db_session): sets status=deleting (no actual delete).
  - Singleton: `doc_service`.

- Schemas
  - File: backend/app/schemas/document.py:1
  - DocumentCreate (internal use).
  - DocumentResponse: id, filename, status, page_count, pages_parsed, chunks_total, chunks_indexed, created_at.
  - DocumentFileUrlResponse: url, expires_in.

- API routes
  - File: backend/app/api/documents.py:1
  - Router: `documents_router` with prefix `/documents`.
  - POST /api/documents/upload
    - Accepts multipart file.
    - Validates content-type application/pdf and size ≤ MAX_PDF_SIZE_MB.
    - Calls `DocService.create_document`.
    - Returns 202 with {document_id, status, filename}; errors as {error: NOT_PDF | FILE_TOO_LARGE}.
  - GET /api/documents/{document_id}
    - Returns DocumentResponse (status + progress).
  - GET /api/documents/{document_id}/file-url
    - Returns {url, expires_in} using MinIO presigned URL.
  - DELETE /api/documents/{document_id}
    - Marks status=deleting and returns 202 with {status, message}.

- Router registration and startup
  - File: backend/app/main.py:5
  - Includes router: `app.include_router(documents_router, prefix='/api')`.
  - Startup event calls `storage_service.ensure_bucket()`.

Task update

- File: .collab/tasks/current.md: Task 1.3 STATUS set to DONE with CX_NOTES:
  - storage_key format, initial status=parsing, error response shapes, presigned TTL from config, startup ensure_bucket, router registration, and leaving actual delete to worker.

Notes and assumptions

- Upload validation done in route; service validates again defensively.
- Filename sanitized to basename only for storage_key.
- No page count check at upload (will be handled during parsing in Task 1.4).
- Presigned URL TTL uses `MINIO_PRESIGN_TTL` (default 300s).
- Delete is async-by-contract: only marks status=deleting.

Want me to run a quick local FastAPI boot to sanity-check imports, or add minimal curl examples for testing the endpoints?