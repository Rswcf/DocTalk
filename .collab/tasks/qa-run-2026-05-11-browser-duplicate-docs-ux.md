# QA Run - Browser Duplicate Docs UX - 2026-05-11

Scope: verify dashboard behavior for duplicate filenames and the deleted-document reader error state on desktop and mobile.

## Environment

| Item | Value |
|---|---|
| Backend | `http://127.0.0.1:8000`, temporary uvicorn process |
| Frontend | `http://localhost:3000`, temporary Next.js dev server |
| Fixture | Two synthetic authenticated Plus users, one per viewport, each with two ready documents named `semiconductor.pdf` |
| Corpus reference | Filename and file size sourced from `test_inputs/semiconductor.pdf`; the file was read only and not mutated |
| Harnesses | `.collab/scripts/qa_browser_duplicate_docs_fixture.py`, `.collab/scripts/qa_browser_duplicate_docs_ux.js` |

## Result

Pass.

Evidence:

- Fixture: `.collab/tasks/qa-browser-duplicate-docs-fixture-2026-05-11.json`
- Browser UX run: `.collab/tasks/qa-browser-duplicate-docs-ux-2026-05-11.json`
- First cleanup after a cold-start harness timeout: `.collab/tasks/qa-browser-duplicate-docs-fixture-cleanup-first-2026-05-11.json`
- Final cleanup: `.collab/tasks/qa-browser-duplicate-docs-fixture-cleanup-2026-05-11.json`

Assertions passed on desktop `1440x900` and mobile `390x844`:

- dashboard API returned two distinct documents with the same filename
- dashboard rendered two visible duplicate filename rows with distinct `/d/{document_id}` links
- deleting one duplicate removed only that document
- the surviving duplicate remained visible and returned from the document list API
- opening the deleted document URL rendered the reader's `Document not found` error state
- the reader error state included a visible Back Home action
- no horizontal overflow before deletion, after deletion, or on the deleted-document error state
- blocking console errors: `0`

The harness records expected browser resource errors for deleted-document `404` responses separately. The passing run recorded `4` ignored `404` console messages across desktop and mobile.

Screenshots:

- `.collab/tasks/screenshots/2026-05-11/duplicate-docs-desktop-before-delete.png`
- `.collab/tasks/screenshots/2026-05-11/duplicate-docs-desktop-after-delete.png`
- `.collab/tasks/screenshots/2026-05-11/duplicate-docs-desktop-deleted-reader.png`
- `.collab/tasks/screenshots/2026-05-11/duplicate-docs-mobile-before-delete.png`
- `.collab/tasks/screenshots/2026-05-11/duplicate-docs-mobile-after-delete.png`
- `.collab/tasks/screenshots/2026-05-11/duplicate-docs-mobile-deleted-reader.png`

## Cleanup

Fixture cleanup returned:

```json
{"result": "pass", "users": 0, "documents": 0, "duplicate_storage_documents": 0}
```

## Validation

Passed:

- `python3 -m py_compile .collab/scripts/qa_browser_duplicate_docs_fixture.py .collab/scripts/qa_browser_plan_limit_fixture.py .collab/scripts/qa_browser_converted_citation_fixture.py`
- `node --check .collab/scripts/qa_browser_duplicate_docs_ux.js`
- `jq empty` for fixture, UX, first cleanup, and final cleanup JSON artifacts
- `python3 -m ruff check app/ tests/ ../.collab/scripts/qa_browser_duplicate_docs_fixture.py ../.collab/scripts/qa_browser_plan_limit_fixture.py ../.collab/scripts/qa_browser_converted_citation_fixture.py`
- `npm run build`
- `git diff --check`
- DB residual check: `{"qa_browser_duplicate_docs_users": 0, "qa_browser_duplicate_docs_documents": 0}`
- Port check: no listener on `3000` or `8000`

Note: frontend build printed the expected local `RESEND_API_KEY not set` message, plus existing Sentry config and edge-runtime warnings. They are unrelated to this duplicate-document UX slice.

## Remaining Gap

This verifies duplicate-filename dashboard UX and deleted-document reader error UX. It does not cover duplicate upload de-duplication policy, because the current product contract allows multiple documents with the same filename.
