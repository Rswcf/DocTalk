# QA Run - Browser Document Diff Polling UX - 2026-05-11

Scope: verify that `/document-diff` updates in the browser from an in-progress comparison to a completed result through the existing frontend polling path.

## Environment

| Item | Value |
|---|---|
| Backend | `http://127.0.0.1:8000`, temporary uvicorn process |
| Frontend | `http://localhost:3000`, temporary Next.js dev server |
| Fixture | Synthetic Pro users, two ready Markdown documents, `running` document-diff jobs that are completed during the browser run |
| Harnesses | `.collab/scripts/qa_browser_document_diff_result_fixture.py`, `.collab/scripts/qa_browser_document_diff_polling_ux.js` |

## Result

Pass.

Evidence:

- Aggregate: `.collab/tasks/qa-browser-document-diff-polling-ux-2026-05-11.json`
- Desktop fixture: `.collab/tasks/qa-browser-document-diff-polling-fixture-desktop-2026-05-11.json`
- Desktop completion: `.collab/tasks/qa-browser-document-diff-polling-complete-desktop-2026-05-11.json`
- Desktop cleanup: `.collab/tasks/qa-browser-document-diff-polling-cleanup-desktop-2026-05-11.json`
- Mobile fixture: `.collab/tasks/qa-browser-document-diff-polling-fixture-mobile-2026-05-11.json`
- Mobile completion: `.collab/tasks/qa-browser-document-diff-polling-complete-mobile-2026-05-11.json`
- Mobile cleanup: `.collab/tasks/qa-browser-document-diff-polling-cleanup-mobile-2026-05-11.json`

## Assertions

Desktop and mobile both passed:

- Initial page displayed `running`/waiting state for the active diff job.
- Initial page did not show the completed change title before the job was completed.
- Fixture command changed the job to `succeeded` and inserted the diff result.
- Existing frontend polling refreshed the page without reload.
- Completed state appeared.
- Summary and change titles appeared:
  - `Refund window extended`
  - `Enterprise annual plans added`
- Citation labels appeared:
  - `O1`
  - `N1`
- No horizontal overflow.
- Console errors: `0`.

Screenshots:

- `.collab/tasks/screenshots/2026-05-11/document-diff-polling-desktop.png`
- `.collab/tasks/screenshots/2026-05-11/document-diff-polling-mobile.png`

## Cleanup

Both viewport fixtures were cleaned:

```json
{
  "desktop_cleanup": {"users": 0, "documents": 0, "jobs": 0},
  "mobile_cleanup": {"users": 0, "documents": 0, "jobs": 0}
}
```

Independent database cleanup check also returned zero rows for:

- `qa-browser-diff-result-%` users
- `qa/browser-diff-result/%` documents
- `document_jobs.metadata_json->>'qa_synthetic' = 'true'`

## Validation

Post-run checks passed:

- `python3 -m py_compile .collab/scripts/qa_browser_document_diff_result_fixture.py`
- `node --check .collab/scripts/qa_browser_document_diff_polling_ux.js`
- `jq empty` on the aggregate, fixture, completion, and cleanup JSON artifacts
- `cd backend && python3 -m ruff check app/ tests/ ../.collab/scripts/qa_*.py`
- `cd frontend && npm run build`
- `git diff --check`

## Remaining Gap

This verifies frontend polling and state transition with deterministic DB-backed fixture jobs. It does not exercise a real LLM/Celery document-diff worker from the browser, but that lower-level LLM execution and accounting path is already covered by `.collab/tasks/qa-run-2026-05-11-document-diff-live-llm.md`.
