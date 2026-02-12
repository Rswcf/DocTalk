Implemented all 6 requested backend performance fixes with minimal diffs.

- Fix 1 (singleton OpenAI client): added module-level `_openai_client` + `_get_openai_client()` and switched `chat_stream()` to use it in `backend/app/services/chat_service.py:35`, `backend/app/services/chat_service.py:38`, `backend/app/services/chat_service.py:343`.
- Fix 2 (indexes migration): added `backend/alembic/versions/20260211_0015_add_missing_indexes.py:1` with:
  - `idx_sessions_document_id` on `sessions.document_id`
  - `idx_sessions_collection_id` on `sessions.collection_id`
  - `idx_documents_status` on `documents.status`
  - `down_revision = "20260211_0014"` (actual current head revision ID).
- Fix 3 (SQL-level message limiting): replaced load-all-and-slice with DB `ORDER BY created_at DESC LIMIT max_msgs+1`, then reversed in memory in `backend/app/services/chat_service.py:261`.
- Fix 4 (Celery concurrency): changed `--concurrency=1` to `--concurrency=2` in `backend/entrypoint.sh:28`.
- Fix 5 (Qdrant payload): removed redundant `"text": c.text[:1000]` from payload in `backend/app/workers/parse_worker.py:302`.
- Fix 6 (DB pool config): added `pool_size=10`, `max_overflow=20`, `pool_recycle=1800` (keeping `pool_pre_ping=True`) in `backend/app/models/database.py:21`.

Validation run:
- `PYTHONPYCACHEPREFIX=/tmp/pycache python3 -m compileall ...` on touched Python files: passed.

No relevant AGENTS skill was needed for this backend patch set.