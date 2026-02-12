Implemented all 5 security fixes with minimal, focused changes.

1. Collection session authorization gap fixed  
- Added collection ownership enforcement in `verify_session_access`:
  - Loads session with collection relationship.
  - If `session.collection_id` exists, loads/verifies collection ownership (`collection.user_id == user.id`).
  - Preserves existing behavior for ownerless demo resources.
- File: `backend/app/api/chat.py:55`
- File: `backend/app/api/chat.py:69`

2. `ingest-url` now enforces plan limits  
- Added the same per-plan document count check used by upload.
- Added per-plan size limit check (`FREE/PLUS/PRO_MAX_FILE_SIZE_MB`) for both:
  - PDF URL ingestion (`pdf_bytes`)
  - HTML/text URL ingestion (`text_bytes`)
- File: `backend/app/api/documents.py:222`
- File: `backend/app/api/documents.py:263`
- File: `backend/app/api/documents.py:269`
- File: `backend/app/api/documents.py:303`

3. Removed conflicting global PDF size check in `DocService`  
- Deleted redundant `MAX_PDF_SIZE_MB` enforcement from service layer, so API per-plan limits are the source of truth.
- File: `backend/app/services/doc_service.py:56`

4. Replaced `datetime.utcnow()` with timezone-aware UTC  
- Updated user creation timestamps to `datetime.now(timezone.utc)`.
- File: `backend/app/services/auth_service.py:52`
- File: `backend/app/services/auth_service.py:53`

5. Production-safe CORS origins  
- CORS is now environment-aware:
  - If `ENVIRONMENT=production` **or** `SENTRY_ENVIRONMENT=production`: only `FRONTEND_URL`.
  - Otherwise: includes localhost origins plus `FRONTEND_URL`.
- File: `backend/app/main.py:33`
- File: `backend/app/main.py:45`

Validation run:
- `PYTHONPYCACHEPREFIX=/tmp/pycache python3 -m compileall backend/app/api/chat.py backend/app/api/documents.py backend/app/services/doc_service.py backend/app/services/auth_service.py backend/app/main.py` passed.