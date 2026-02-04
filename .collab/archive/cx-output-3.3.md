Implemented backend smoke tests and updated Task 3.3 to DONE.

What I added
- backend/tests/__init__.py
- backend/tests/conftest.py:42
  - Registers custom marker `integration` via `pytest_configure`.
  - Skips `@pytest.mark.integration` tests when `SKIP_INTEGRATION` is truthy (defaults to skip).
  - Ensures `backend/` is on `sys.path` for `from app.main import app`.
  - Sets a default `DATABASE_URL` to avoid import-time failures.
  - Provides async `client` fixture using `httpx.ASGITransport(app=app)` with `base_url='http://test'`.
- backend/tests/test_smoke.py:7
  - test_health(client): async, simple `/health` check (no integration marker).
  - test_full_document_lifecycle(client): async and marked `@pytest.mark.integration`
    - Uploads a minimal inline PDF to `POST /api/documents/upload` (expects 202 and document_id).
    - `GET /api/documents/{id}` expects 200.
    - `POST /api/documents/{id}/sessions` expects 201 and returns session_id.
    - `GET /api/sessions/{id}/messages` expects 200 with empty list.
    - Verifies `/health` is still 200.

Notes
- Integration tests are skipped by default. Set `SKIP_INTEGRATION=0` to run them, with all external services (PostgreSQL/Qdrant/MinIO/Redis) available.
- The client connects directly to the FastAPI app via `httpx.ASGITransport(app=app)` as required.

How to run
- Only health: `pytest -q backend/tests`
- Enable integration: `SKIP_INTEGRATION=0 pytest -q backend/tests -m integration`

Task status
- .collab/tasks/current.md: Task 3.3 STATUS → DONE.