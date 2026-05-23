# Production Document Entry Guards - 2026-05-11

Scope: non-destructive production checks for anonymous document entry points, especially upload, URL import, reader/file access, and document chat-session entry surfaces. This slice verifies that anonymous requests cannot create documents/sessions, fetch URLs before auth, receive presigned file URLs, or leak sensitive server details.

## Environment

- Backend: `https://backend-production-a62e.up.railway.app`
- Harness: `.collab/scripts/qa_production_document_entry_guards.py`

## Command

```bash
python3 .collab/scripts/qa_production_document_entry_guards.py \
  --json-out .collab/tasks/qa-production-document-entry-guards-2026-05-11.json
```

## Result

Final result: **pass**.

```json
{
  "total": 18,
  "passed": 18,
  "failed": 0,
  "groups": {
    "document_access_404": {"total": 5, "failed": 0},
    "document_chat_entry_404": {"total": 2, "failed": 0},
    "document_input_validation": {"total": 3, "failed": 0},
    "document_mutation_auth_guards": {"total": 3, "failed": 0},
    "ingest_auth_guards": {"total": 3, "failed": 0},
    "public_document_baseline": {"total": 2, "failed": 0}
  }
}
```

Evidence: `.collab/tasks/qa-production-document-entry-guards-2026-05-11.json`

## Coverage

Public document baselines returned expected `200` responses:

- `GET /api/documents`
- `GET /api/documents/demo`

Anonymous ingest and mutation guards returned expected `401` responses:

- `POST /api/documents/upload` with a valid multipart PDF body
- `POST /api/documents/ingest-url` with `https://example.com/`
- `POST /api/documents/ingest-url` with a localhost/private URL probe
- `POST /api/documents/{id}/reparse`
- `PATCH /api/documents/{id}`
- `DELETE /api/documents/{id}`

Anonymous fake-resource probes returned expected `404` responses without leaks:

- Document detail and brief
- Original and converted file URL endpoints, with no presigned URL data
- Text-content endpoint
- Document chat session create/list, with no session id returned

Input-validation probes returned expected `422` responses without leaks:

- Invalid document UUID on detail and file-url routes
- Invalid search `top_k=0`

All checks had no sensitive marker leakage, no unexpected `document_id` or `session_id`, and no URL fetch/SSRF error surfaced before auth on anonymous URL import.

## Notes

- This complements the broader anonymous API guard matrix. It is narrower but exercises the document/product entry points that users touch first.
- This does not replace authenticated owner/other-user production checks, which still need safe test accounts.
