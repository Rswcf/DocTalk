# Production Demo Document Read Surfaces - 2026-05-11

Scope: non-destructive production smoke for public demo document reader and retrieval surfaces. This does not create sessions or send chat messages, so it does not consume demo LLM quota.

## Environment

- Backend: `https://backend-production-a62e.up.railway.app`
- Harness: `.collab/scripts/qa_production_demo_document_read_surfaces.py`
- Selected demo document: `alphabet-earnings` / `Alphabet Q4 2025 Earnings Release.pdf`

## Command

```bash
python3 .collab/scripts/qa_production_demo_document_read_surfaces.py \
  --json-out .collab/tasks/qa-production-demo-document-read-surfaces-2026-05-11.json
```

## Result

Final result: **pass**.

```json
{
  "total": 8,
  "passed": 8,
  "failed": 0,
  "groups": {
    "demo_catalog": {"total": 1, "failed": 0},
    "document_reader_api": {"total": 5, "failed": 0},
    "retrieval_api": {"total": 2, "failed": 0}
  }
}
```

Evidence: `.collab/tasks/qa-production-demo-document-read-surfaces-2026-05-11.json`

## Coverage

- `GET /api/documents/demo` returned a non-empty catalog with ready demo documents.
- `GET /api/documents/{document_id}` returned a ready demo detail with positive `pages_parsed` and `chunks_indexed`.
- `GET /api/documents/{document_id}/file-url` returned a positive `expires_in` and an HTTP presigned URL.
- A range fetch against the presigned URL returned `206` and `%PDF` bytes.
- `GET /api/documents/{document_id}/brief` returned the brief surface with a valid status.
- `GET /api/documents/{document_id}/text-content` returned non-empty text pages containing expected Alphabet/revenue terms.
- `POST /api/documents/{document_id}/search` for `revenue` returned citation candidates with chunk id, text, page, bbox, and score fields.
- `GET /api/chunks/{chunk_id}` returned the cited source chunk text and bbox list.

## Observation

The first revenue search candidate was functionally valid but table-heavy/noisy: repeated numeric cells appeared in the chunk text. This is not a guard failure, but it remains a reader/citation snippet quality issue to monitor for PDF table-heavy documents.

## Notes

- This complements the production demo RAG prompt matrix by testing reader/retrieval APIs without another LLM call.
- It does not replace browser-level production reader UI assertions or authenticated private-document production checks.
