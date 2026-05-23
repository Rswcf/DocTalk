# QA Run - 2026-05-10 - Upload And Parse Matrix

Scope: execute the upload, validation, parsing, filename, plan-limit, and negative-fixture slice of the long-run `/goal` using `test_inputs/`.

## Environment

| Item | Result |
|---|---|
| Backend | Existing local `http://127.0.0.1:8000` healthy |
| Docker infra | Postgres, Redis, Qdrant, MinIO running |
| Celery | Existing `default,parse` worker processes running |
| Positive account | Temporary Pro QA user |
| Negative account | Temporary Free QA user |

## Artifacts

| Artifact | Purpose |
|---|---|
| `.collab/scripts/qa_upload_parse_matrix.py` | Reusable upload/parse matrix for positive PDFs, filename sanitization, unsupported files, invalid content, zero-byte PDF, and Free-plan size limits. |
| `.collab/tasks/qa-upload-parse-matrix-2026-05-10-first-run-failure.json` | First failed execution: `semiconductor.pdf` parsed ready, but `/search` returned 0 results. |
| `.collab/tasks/qa-upload-parse-matrix-2026-05-10.json` | Second failed execution after search retries: same `semiconductor.pdf` search result gap. |
| `.collab/tasks/qa-upload-parse-matrix-debug-keep-2026-05-10.json` | Third execution with `--keep`: 12/12 passed; kept QA users were manually deleted after inspection. |
| `.collab/tasks/bug-2026-05-10-search-zero-after-ready.md` | Bug report for intermittent exact search miss after document status is ready. |

## Command Run

```bash
python3 .collab/scripts/qa_upload_parse_matrix.py \
  --api-base http://127.0.0.1:8000 \
  --timeout 300 \
  --json-out .collab/tasks/qa-upload-parse-matrix-2026-05-10.json
```

Debug confirmation run:

```bash
python3 .collab/scripts/qa_upload_parse_matrix.py \
  --api-base http://127.0.0.1:8000 \
  --timeout 300 \
  --keep \
  --json-out .collab/tasks/qa-upload-parse-matrix-debug-keep-2026-05-10.json
```

## Results

Overall:

| Run | Result | Notes |
|---|---|---|
| First matrix run | 11/12 pass | `small_english_pdf` parsed ready, but `/search` returned 0 results. |
| Second matrix run with search retries | 11/12 pass | `/search` returned 0 results across 4 attempts after ready. |
| Debug run with kept state | 12/12 pass | Same `small_english_pdf` returned 1 search result on first attempt. QA data was then manually cleaned. |

Positive parse cases:

| Case | File / Behavior | Result |
|---|---|---|
| `small_english_pdf` | `test_inputs/semiconductor.pdf` upload, parse, text-content, exact search | Intermittent fail: ready/text passed, search returned 0 in two runs and 1 in debug run |
| `cjk_pdf` | `test_inputs/盘中解读.pdf` | Pass |
| `uppercase_extension_cjk_filename` | `test_inputs/GS 资金流.PDF`, extension fallback from `application/octet-stream` | Pass, ready in about 21.3s |
| `very_long_mixed_filename` | Long CJK/English filename | Pass |
| `encrypted_permission_edge` | Encrypted/permission-edge PDF from inventory | Pass, became ready |
| `dangerous_filename_sanitization` | Valid PDF bytes sent as `../../QA:path*with?bad.pdf` | Pass, stored filename sanitized |

Negative validation cases:

| Case | Expected | Result |
|---|---|---|
| `.DS_Store` fixture | 400 `UNSUPPORTED_FORMAT` | Pass |
| HTML fixture uploaded as file | 400 `UNSUPPORTED_FORMAT` | Pass |
| Invalid PDF magic bytes | 400 `INVALID_FILE_CONTENT` | Pass |
| Zero-byte PDF | 400 `INVALID_FILE_CONTENT` | Pass |
| Free user uploads 30 MB PDF | 400 `FILE_TOO_LARGE` | Pass |
| Free user uploads 33 MB CJK PDF | 400 `FILE_TOO_LARGE` | Pass |

Cleanup:
- Normal matrix runs deleted QA users and owned docs automatically.
- Debug `--keep` run kept data for inspection, then the QA users and owned docs were manually deleted.
- Verification query returned `qa_upload_users=0`, `qa_upload_docs=0`.

Warnings observed:
- `urllib3` LibreSSL warning from local Python.
- Qdrant client/server minor version mismatch warning: client `1.16.1`, server `1.14.1`.

## Coverage Added

This run covers:
- Representative PDF parsing across English, Chinese, uppercase extension, long filename, and encrypted-permission-edge PDFs.
- Filename sanitization for path traversal and unsafe characters.
- Text-content backend availability after parsing.
- Free-plan upload size enforcement for large English and Chinese PDFs.
- Unsupported fixture handling for `.DS_Store` and HTML upload.
- Invalid and zero-byte PDF content validation.

## Finding

`BUG-2026-05-10-SEARCH-ZERO-AFTER-READY`: `semiconductor.pdf` can reach `ready` with chunks indexed while `/api/documents/{document_id}/search` returns 0 exact-term results for `semiconductor`. The failure reproduced in two matrix runs and did not reproduce in a later debug run or a standalone golden-path rerun, which points to an intermittent retrieval stability issue.

## Not Covered

- Browser upload UI states and frontend error copy were not exercised in this slice.
- DOCX/PPTX/XLSX/TXT/MD uploads were not covered because `test_inputs/` currently contains PDFs, one HTML negative fixture, and `.DS_Store`.
- Real chat answer quality and citation click behavior remain blocked locally by absent `DEEPSEEK_API_KEY`.
