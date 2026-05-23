# QA Run - 2026-05-10 - Access Boundary And Sharing

Scope: execute the permissions/privacy slice of the long-run `/goal`: cross-user document access, session access, chunk access, share creation, public share sanitization, revoke behavior, and cleanup.

## Environment

| Item | Result |
|---|---|
| Backend | Existing local `http://127.0.0.1:8000` healthy |
| Test document | `test_inputs/semiconductor.pdf` |
| Docker infra | Postgres, Redis, Qdrant, MinIO running |
| Celery | Existing `default,parse` worker processes running |

## Artifacts

| Artifact | Purpose |
|---|---|
| `.collab/scripts/qa_access_boundary.py` | Reusable access-boundary smoke: creates owner/other QA users, uploads a PDF, waits for parsing, checks owner/other/anonymous boundaries, creates/revokes share, checks public payload sanitization, cleans up. |
| `.collab/tasks/qa-access-boundary-2026-05-10.json` | Machine-readable access-boundary execution result. |

## Command Run

```bash
python3 .collab/scripts/qa_access_boundary.py \
  --api-base http://127.0.0.1:8000 \
  --file test_inputs/semiconductor.pdf \
  --query semiconductor \
  --timeout 240 \
  --json-out .collab/tasks/qa-access-boundary-2026-05-10.json
```

## Results

Overall: **Pass**. 28/28 checks passed.

Document parse:

| Step | Result |
|---|---|
| Owner upload `semiconductor.pdf` | 202 |
| Poll document | `parsing` at 0.010s, `ready` at 3.029s |
| Search `semiconductor` | 200, 1 result, page 1, 69 bboxes |
| Create session | 201 |
| Cleanup | QA users and owned docs deleted |

Owner-allowed endpoints:

| Endpoint class | Expected | Result |
|---|---|---|
| Document metadata | 200 | Pass |
| File URL | 200 | Pass |
| Text content | 200 | Pass |
| Chunk detail | 200 | Pass |
| Session messages | 200 | Pass |

Other-user isolation:

| Endpoint class | Expected | Result |
|---|---|---|
| Document metadata | 404 | Pass |
| File URL | 404 | Pass |
| Text content | 404 | Pass |
| Search | 404 | Pass |
| Chunk detail | 404 | Pass |
| Create session | 404 | Pass |
| Session messages | 404 | Pass |
| Create share | 404 | Pass |

Anonymous isolation:

| Endpoint class | Expected | Result |
|---|---|---|
| Document metadata | 404 | Pass |
| File URL | 404 | Pass |
| Text content | 404 | Pass |
| Search | 404 | Pass |
| Chunk detail | 404 | Pass |
| Create session | 404 | Pass |
| Create share | 401 | Pass |

Sharing:

| Step | Expected | Result |
|---|---|---|
| Owner creates share | 200 | Pass |
| Public shared response loads | 200 | Pass |
| Public payload omits `chunk_id`, `document_id`, `bboxes`, `confidence_score` | private fields absent | Pass |
| Owner revokes share | 204 | Pass |
| Public shared response after revoke | 404 | Pass |

Warnings observed:
- `urllib3` LibreSSL warning from local Python.
- Qdrant client/server minor version mismatch warning: client `1.16.1`, server `1.14.1`.

## Coverage Added

This run covers:
- Owner-only document surfaces for PDF metadata, source URL, text content, chunks, and messages.
- Cross-user 404 hiding for another authenticated user.
- Anonymous 404/401 behavior on private resources and share creation.
- Public share response sanitization for private citation fields.
- Share revoke invalidation.

## Not Covered

- Browser share UI, copied share URL UX, and mobile shared-page layout were not exercised in this slice.
- Collection ownership, collection chat, exports, and document-diff access boundaries remain for a later authenticated run.
- Real chat streaming and real citation generation were not exercised because local `DEEPSEEK_API_KEY` is absent.
