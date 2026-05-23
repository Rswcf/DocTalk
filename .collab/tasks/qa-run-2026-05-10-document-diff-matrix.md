# QA Run - 2026-05-10 - Document Diff Matrix

Scope: execute the document-diff slice of the long-run `/goal` without invoking the LLM worker: plan gate, input validation, collection membership, synthetic completed job list/get/artifact/export, and owner/other/anonymous boundaries.

## Environment

| Item | Result |
|---|---|
| Backend | Existing local `http://127.0.0.1:8000` healthy |
| Docker infra | Postgres, Redis, Qdrant, MinIO running |
| Celery | Existing `default,parse` worker processes running |
| Old document | `test_inputs/semiconductor.pdf` |
| New document | `test_inputs/盘中解读.pdf` |
| Pro account | Temporary Pro QA user |
| Plus account | Temporary Plus QA user |
| Other account | Temporary Free QA user |

## Artifacts

| Artifact | Purpose |
|---|---|
| `.collab/scripts/qa_document_diff_matrix.py` | Reusable document-diff API, artifact, export, and boundary matrix. |
| `.collab/tasks/qa-document-diff-matrix-2026-05-10.json` | Machine-readable document-diff execution result. |

## Command Run

```bash
python3 .collab/scripts/qa_document_diff_matrix.py \
  --api-base http://127.0.0.1:8000 \
  --timeout 240 \
  --json-out .collab/tasks/qa-document-diff-matrix-2026-05-10.json
```

## Results

Overall: **Pass**. 22/22 checks passed.

Document setup:

| Document | File | Ready Time |
|---|---|---:|
| Old document | `test_inputs/semiconductor.pdf` | 3.090s |
| New document | `test_inputs/盘中解读.pdf` | 3.111s |

Validation and gates:

| Case | Expected | Result |
|---|---|---|
| Plus user creates document diff | 403 `PLAN_REQUIRED` | Pass |
| Pro user compares same document | 400 `DOCUMENT_DIFF_SAME_DOCUMENT` | Pass |
| Pro user uses missing document | 404 | Pass |
| Anonymous creates document diff | 401 | Pass |
| Collection contains only old doc, diff uses old+new | 400 `DOCUMENT_DIFF_COLLECTION_MISMATCH` | Pass |

Synthetic completed job:

| Case | Expected | Result |
|---|---|---|
| List document diffs | 200, includes synthetic succeeded job and result | Pass |
| List document diffs filtered by collection | 200, exactly the synthetic job | Pass |
| Get document diff | 200, `status=succeeded`, result loaded | Pass |
| Get unified document job artifact | 200, `artifact_type=document_diff`, Markdown/CSV download URLs | Pass |
| Export document diff Markdown | 200 `text/markdown`, contains `# Document Diff` and QA change | Pass |
| Export document diff CSV | 200 `text/csv`, contains `kind,title,detail,old_refs,new_refs` | Pass |

Access boundaries:

| Boundary | Expected | Result |
|---|---|---|
| Other user get diff/job/export | 404 | Pass |
| Anonymous list/get diff, get job, export | 401 | Pass |
| Invalid export format `pdf` | 422 | Pass |
| Missing document diff job | 404 | Pass |

Cleanup:
- QA users and owned docs were deleted automatically.
- Verification query returned `qa_diff_users=0`, `qa_diff_docs=0`.

Warnings observed:
- `urllib3` LibreSSL warning from local Python.
- Qdrant client/server minor version mismatch warning: client `1.16.1`, server `1.14.1`.

## Coverage Added

This run covers:
- Document diff plan gate and request validation.
- Collection membership validation for diff jobs.
- Completed document-diff result serialization without lazy-load failures.
- Unified artifact API for document diff jobs.
- Markdown and CSV export for completed document diffs.
- Owner/other/anonymous access boundaries.

## Not Covered

- Real semantic diff execution, LLM quality, credit reconciliation, and citation quality were not exercised because local `DEEPSEEK_API_KEY` is absent.
- Browser document-diff UI, collection selector UX, artifact cards, and export button UX were not exercised in this slice.
