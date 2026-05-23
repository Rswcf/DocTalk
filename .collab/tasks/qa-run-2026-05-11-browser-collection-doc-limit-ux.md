# QA Run - Browser Collection Document Limit UX - 2026-05-11

Scope: verify the `/collections/[collectionId]` Add Documents modal when a Free user's collection has reached the documents-per-collection limit.

## Environment

| Item | Value |
|---|---|
| Backend | `http://127.0.0.1:8000`, temporary uvicorn process |
| Frontend | `http://localhost:3000`, temporary Next.js dev server |
| Fixture | Two synthetic authenticated Free users, one per viewport, each with one collection already at `FREE_MAX_DOCS_PER_COLLECTION=3` and one extra ready document |
| Harnesses | `.collab/scripts/qa_browser_collection_doc_limit_fixture.py`, `.collab/scripts/qa_browser_collection_doc_limit_ux.js` |

## Result

Pass after fix.

Evidence:

- Fixture: `.collab/tasks/qa-browser-collection-doc-limit-fixture-2026-05-11.json`
- Initial browser UX run: `.collab/tasks/qa-browser-collection-doc-limit-ux-2026-05-11.json`
- Passing retest: `.collab/tasks/qa-browser-collection-doc-limit-ux-after-fix-2026-05-11.json`
- Cleanup: `.collab/tasks/qa-browser-collection-doc-limit-fixture-cleanup-2026-05-11.json`
- Bug: `.collab/tasks/bug-2026-05-11-collection-doc-limit-add-docs-unhandled.md`

Initial run:

- desktop and mobile both correctly kept the collection at `3` documents
- desktop and mobile both showed no alert and no Upgrade CTA
- desktop and mobile each recorded one blocking `HTTP 403` console/page error for `COLLECTION_DOC_LIMIT_REACHED`

Retest assertions passed on desktop `1440x900` and mobile `390x844`:

- collection detail API returned exactly `3` documents before the add attempt
- attempting to add the extra ready document did not add a fourth document
- modal stayed open and showed `Too many documents`
- modal body showed `Your plan allows up to 3 documents per collection. Upgrade for more.`
- Upgrade CTA linked to `/billing?plan=plus&period=monthly&source=limit&reason=collection_doc_limit`
- no horizontal overflow before or after the blocked add attempt
- blocking console errors: `0`

The harness records expected browser resource errors for the intentionally blocked add-documents `403` response separately. The passing run recorded `2` ignored `403` console messages across desktop and mobile.

Screenshots:

- `.collab/tasks/screenshots/2026-05-11/collection-doc-limit-desktop.png`
- `.collab/tasks/screenshots/2026-05-11/collection-doc-limit-mobile.png`

## Cleanup

Fixture cleanup and residual DB check returned zero remaining QA rows:

```json
{"qa_browser_collection_doc_limit_users": 0, "qa_browser_collection_doc_limit_documents": 0, "qa_browser_collection_doc_limit_collections": 0}
```

## Validation

Passed:

- `python3 -m py_compile .collab/scripts/qa_browser_collection_doc_limit_fixture.py`
- `node --check .collab/scripts/qa_browser_collection_doc_limit_ux.js`
- `jq empty` for fixture, initial UX, retest UX, and cleanup JSON artifacts
- `python3 -m ruff check app/ tests/ ../.collab/scripts/qa_browser_collection_doc_limit_fixture.py ../.collab/scripts/qa_browser_collection_limit_fixture.py ../.collab/scripts/qa_browser_session_limit_fixture.py ../.collab/scripts/qa_browser_duplicate_docs_fixture.py ../.collab/scripts/qa_browser_plan_limit_fixture.py ../.collab/scripts/qa_browser_converted_citation_fixture.py`
- `npm run build`
- `git diff --check`
- DB residual check: `{"qa_browser_collection_doc_limit_users": 0, "qa_browser_collection_doc_limit_documents": 0, "qa_browser_collection_doc_limit_collections": 0}`
- Port check: no listener on `3000` or `8000`

Note: frontend build printed the expected local `RESEND_API_KEY not set` message, plus existing Sentry config and edge-runtime warnings. They are unrelated to this collection document-limit UX slice.

## Remaining Gap

This verifies Free documents-per-collection limit UX in the browser. It does not cover paid-plan higher collection document limits or real checkout after clicking Upgrade.
