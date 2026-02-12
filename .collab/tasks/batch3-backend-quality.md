Implemented all 6 fixes with focused backend changes.

1. Error response normalization
- Converted non-streaming error `JSONResponse(...)` paths to `raise HTTPException(status_code=..., detail=...)` in:
  - `backend/app/api/chunks.py:20`
  - `backend/app/api/search.py:26`
  - `backend/app/api/search.py:28`
  - `backend/app/api/collections.py:152`
  - `backend/app/api/collections.py:182`
  - `backend/app/api/collections.py:198`
  - `backend/app/api/collections.py:240`
  - `backend/app/api/collections.py:261`
  - `backend/app/api/collections.py:284`
  - `backend/app/api/chat.py:107`
  - `backend/app/api/chat.py:116`
  - `backend/app/api/chat.py:131`
  - `backend/app/api/chat.py:171`
  - `backend/app/api/chat.py:289`
  - `backend/app/api/chat.py:338`
  - `backend/app/api/documents.py:137`
  - `backend/app/api/documents.py:157`
  - `backend/app/api/documents.py:171`
  - `backend/app/api/documents.py:176`
  - `backend/app/api/documents.py:192`
  - `backend/app/api/documents.py:214`
  - `backend/app/api/documents.py:221`
  - `backend/app/api/documents.py:241`
  - `backend/app/api/documents.py:254`
  - `backend/app/api/documents.py:256`
  - `backend/app/api/documents.py:258`
  - `backend/app/api/documents.py:259`
  - `backend/app/api/documents.py:274`
  - `backend/app/api/documents.py:307`
  - `backend/app/api/documents.py:344`
  - `backend/app/api/documents.py:347`
  - `backend/app/api/documents.py:364`
  - `backend/app/api/documents.py:367`
  - `backend/app/api/documents.py:371`
  - `backend/app/api/documents.py:380`
  - `backend/app/api/documents.py:402`
  - `backend/app/api/documents.py:404`
  - `backend/app/api/documents.py:458`
  - `backend/app/api/documents.py:477`
  - `backend/app/api/documents.py:480`
  - `backend/app/api/documents.py:500`
- Kept SSE endpoint pre-stream JSON responses in `backend/app/api/chat.py` (e.g. `backend/app/api/chat.py:200`).

2. N+1 in `export_my_data`
- Replaced per-document/per-session queries with eager loading:
  - `backend/app/api/users.py:229`
- Added `selectinload` import and iterated preloaded relations:
  - `backend/app/api/users.py:13`
  - `backend/app/api/users.py:232`
  - `backend/app/api/users.py:251`

3. Profile endpoint query consolidation
- Combined core 4 stats into one SQL execution using scalar subqueries:
  - `backend/app/api/users.py:63`
  - `backend/app/api/users.py:64`
  - `backend/app/api/users.py:137`

4. Admin overview query consolidation
- Grouped into 3 queries:
  - User-related aggregates: `backend/app/api/admin.py:28`
  - Content-related aggregates: `backend/app/api/admin.py:39`
  - Financial aggregates: `backend/app/api/admin.py:49`

5. Health endpoint deep check
- Added `deep` query param and deep dependency checks:
  - `backend/app/main.py:131`
  - DB `SELECT 1`: `backend/app/main.py:142`
  - Redis `ping()`: `backend/app/main.py:150`

6. Lifespan migration
- Replaced deprecated startup event with lifespan pattern:
  - `backend/app/main.py:34`
  - `backend/app/main.py:96`

Validation run
- `python3 -m py_compile ...` (changed files): passed.
- `python3 -m pytest -q tests -k "users or admin or health or documents or chat or collections or search or chunks"`: passed (`1 passed, 10 deselected`).
- `python3 -m compileall app` failed due sandbox cache write permissions; syntax was validated via `py_compile` workaround.