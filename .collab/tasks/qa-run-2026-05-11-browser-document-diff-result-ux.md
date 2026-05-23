# QA Run - Browser Document Diff Result UX - 2026-05-11

Scope: cover the browser result and export UX for a completed Document Diff job. This complements the existing document-diff API matrix and real LLM job/accounting run by exercising the user-visible `/document-diff` result panel.

## Environment

| Item | Value |
|---|---|
| Backend | `http://127.0.0.1:8000`, temporary uvicorn process |
| Frontend | `http://localhost:3000`, temporary Next.js dev server |
| Fixture | Synthetic Pro user, two ready Markdown documents, completed `document_diff` job, structured result, rendered markdown, old/new citations |
| Harnesses | `.collab/scripts/qa_browser_document_diff_result_fixture.py`, `.collab/scripts/qa_browser_document_diff_result_ux.js` |

## Result

Pass.

Evidence:

- Fixture: `.collab/tasks/qa-browser-document-diff-result-fixture-2026-05-11.json`
- Browser run: `.collab/tasks/qa-browser-document-diff-result-ux-2026-05-11.json`
- Cleanup: `.collab/tasks/qa-browser-document-diff-result-fixture-cleanup-2026-05-11.json`

## Assertions

Desktop and mobile both passed:

- `/document-diff` rendered the completed run.
- Old/new filenames appeared: `refund-policy-v1.md -> refund-policy-v2.md`.
- Status appeared as `Completed`.
- Summary appeared.
- Added and Modified change groups appeared.
- Change titles appeared:
  - `Enterprise annual plans added`
  - `Refund window extended`
- Citation buttons `O1` and `N1` appeared.
- Clicking `N1` opened `/d/{new_document_id}?page=1&highlight={new_chunk_id}`.
- MD export downloaded `.md`, `391` bytes, containing the diff content.
- CSV export downloaded `.csv`, `236` bytes, containing the diff content.
- No horizontal overflow.
- Console errors: `0`.

Screenshots:

- `.collab/tasks/screenshots/2026-05-11/document-diff-result-desktop.png`
- `.collab/tasks/screenshots/2026-05-11/document-diff-result-mobile.png`

## Cleanup

The synthetic user, documents, and job were deleted:

```json
{"users": 0, "documents": 0, "jobs": 0}
```

## Remaining Gap

This proves completed result rendering/export UX. It does not replace a full browser run that starts a real diff job and watches queued -> running -> succeeded, because local Celery/LLM orchestration is intentionally not exercised in this deterministic browser slice.
