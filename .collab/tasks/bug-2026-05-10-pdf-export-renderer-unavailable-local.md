## BUG/ENV-2026-05-10-PDF-EXPORT-RENDERER-UNAVAILABLE-LOCAL: PDF export fails in host local backend because WeasyPrint system library is missing

Severity: P2 local QA blocker

Status: **Docker/Railway-like image passed on 2026-05-10; host-local dependency gap remains**

Area: Backend export / local runtime dependencies

Environment:
- Local host-Python backend at `http://127.0.0.1:8000`
- Version `0.17.1 beta`
- macOS Python environment

Test data:
- `test_inputs/semiconductor.pdf`
- Temporary Plus QA user
- Synthetic session with user and assistant messages plus citation data

Repro:
1. Upload and parse `test_inputs/semiconductor.pdf`.
2. Create a session.
3. Insert synthetic messages.
4. Call `GET /api/sessions/{session_id}/export?format=pdf` as a Plus user.

Expected:
- 200 `application/pdf`, response body starts with `%PDF`.

Actual:
- 500 with `{"error":"EXPORT_RENDERER_FAILED","message":"Export renderer failed"}`.
- Direct local reproduction of `render_pdf(...)` fails importing WeasyPrint because `libgobject-2.0-0` is missing.

Evidence:
- `.collab/tasks/qa-export-matrix-2026-05-10.json`
- `.collab/tasks/qa-run-2026-05-10-export-matrix.md`
- Local direct render stack shows `OSError: cannot load library 'libgobject-2.0-0'`.

Context:
- `backend/requirements.txt` includes `weasyprint==68.1`.
- `backend/Dockerfile` installs `libpango-1.0-0`, `libpangocairo-1.0-0`, and `libgdk-pixbuf-2.0-0`.
- This points to a local host-dev dependency gap.

Impact:
- Local QA cannot verify paid PDF export through the host dev command unless the missing WeasyPrint system libraries are installed.
- Docker/Railway-like runtime verified successfully, so the production-image dependency risk is reduced.

Fix recommendation:
- Verify PDF export in the actual Docker/Railway runtime.
- Document local system-library prerequisites for host-Python backend development, or make local dev run backend through Docker for PDF export tests.
- Consider returning a clearer typed environment/dependency error if PDF rendering is unavailable.

Retest:
- Run `.collab/scripts/qa_export_matrix.py` against a Docker/production-like backend.
- Confirm Plus PDF export returns 200 and starts with `%PDF`.

Retest evidence:
- `.collab/tasks/qa-run-2026-05-10-export-docker-api.md`
- `.collab/tasks/qa-export-matrix-docker-api-2026-05-10.json`
- `.collab/tasks/qa-run-2026-05-10-browser-reader-export-ux.md`
- `.collab/tasks/qa-browser-reader-export-ux-after-key-fix-2026-05-10.json`

Retest result:
- Built `doctalk-backend-pdf-export-qa` from `backend/Dockerfile`.
- Direct image smoke: `render_pdf(...)` returned 145,546 bytes with `%PDF` header.
- Docker API export matrix at `http://127.0.0.1:8001`: 11/11 checks passed.
- Plus PDF export returned 200 `application/pdf`, 185,587 bytes, and a `%PDF` body.
- Browser reader/export UX against the Docker API backend passed: PDF download returned `conversation.pdf`, 146,604 bytes, `%PDF` header.
- Temporary Docker backend was stopped after the run.

Remaining:
- Host-local docs should mention WeasyPrint system library prerequisites if host-Python PDF export is expected.
