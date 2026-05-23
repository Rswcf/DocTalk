# QA Run - 2026-05-10 - Collections Matrix

Scope: execute the collections slice of the long-run `/goal`: multi-document collection creation, document filtering/deduplication, collection sessions, owner/other/anonymous boundaries, delete cascade behavior, and Free-plan collection limits.

## Environment

| Item | Result |
|---|---|
| Backend | Existing local `http://127.0.0.1:8000` healthy |
| Docker infra | Postgres, Redis, Qdrant, MinIO running |
| Celery | Existing `default,parse` worker processes running |
| Owner account | Temporary Pro QA user |
| Other account | Temporary Free QA user |
| Gate account | Temporary Free QA user |

## Artifacts

| Artifact | Purpose |
|---|---|
| `.collab/scripts/qa_collections_matrix.py` | Reusable collections workflow and boundary matrix. |
| `.collab/tasks/qa-collections-matrix-2026-05-10.json` | Machine-readable collections execution result. |

## Command Run

```bash
python3 .collab/scripts/qa_collections_matrix.py \
  --api-base http://127.0.0.1:8000 \
  --timeout 240 \
  --json-out .collab/tasks/qa-collections-matrix-2026-05-10.json
```

## Results

Overall: **Pass**. 28/28 checks passed.

Uploaded documents:

| Document | File | Ready Time |
|---|---|---:|
| Owner doc 1 | `test_inputs/semiconductor.pdf` | 3.102s |
| Owner doc 2 | `test_inputs/盘中解读.pdf` | 3.106s |
| Other-user doc | `test_inputs/semiconductor.pdf` | 3.080s |

Owner workflow:

| Step | Expected | Result |
|---|---|---|
| Initial collection list | 200, empty list | Pass |
| Create collection with one owned doc, one foreign doc, one invalid UUID | 201 | Pass |
| Detail after create | Only owner doc retained | Pass |
| Add second owned doc with duplicate, foreign doc, invalid UUID | 201, `added=1` | Pass |
| Add duplicate doc again | 201, `added=0` | Pass |
| Detail after add | 2 owner docs | Pass |
| List collections | 1 collection, `document_count=2` | Pass |
| Create collection session | 201 | Pass |
| List collection sessions | 1 session | Pass |
| Get collection session messages | 200, empty messages | Pass |
| Remove one document | 204 | Pass |
| Detail after remove | 1 remaining doc | Pass |
| Delete collection | 204 | Pass |
| Get deleted collection | 404 | Pass |
| Get deleted collection session messages | 404 | Pass |

Access boundaries:

| Boundary | Expected | Result |
|---|---|---|
| Other user get/add/remove/session/list/delete collection | 404 | Pass |
| Other user get collection-session messages | 404 | Pass |
| Anonymous list/get collection | 401 | Pass |
| Anonymous get collection-session messages | 404 | Pass |

Plan and validation:

| Case | Expected | Result |
|---|---|---|
| Free user creates first collection | 201 | Pass |
| Free user creates second collection | 403 `COLLECTION_LIMIT_REACHED` | Pass |
| Empty collection name | 422 validation error | Pass |

Cleanup:
- QA users and owned docs were deleted automatically.

Warnings observed:
- `urllib3` LibreSSL warning from local Python.
- Qdrant client/server minor version mismatch warning: client `1.16.1`, server `1.14.1`.

## Coverage Added

This run covers:
- Collection list/create/detail/delete.
- Initial document filtering when a collection payload includes foreign and invalid document IDs.
- Add-doc deduplication and foreign/invalid document filtering.
- Collection session create/list/read-empty-messages.
- Cross-account and anonymous boundaries for collection routes and collection-session messages.
- Delete cascade from collection to collection sessions.
- Free-plan collection count enforcement.

## Not Covered

- Real collection chat streaming and cross-document citation quality were not exercised because local `DEEPSEEK_API_KEY` is absent.
- Browser collections UI, mobile layout, drag/drop or selection UX, and frontend error copy were not exercised in this slice.
- Collection export and document-diff flows remain for later runs.
