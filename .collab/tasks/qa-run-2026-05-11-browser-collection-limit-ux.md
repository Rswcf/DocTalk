# QA Run - Browser Collection Limit UX - 2026-05-11

Scope: verify the `/collections` create-workspace modal when a Free user has reached the collection limit.

## Environment

| Item | Value |
|---|---|
| Backend | `http://127.0.0.1:8000`, temporary uvicorn process |
| Frontend | `http://localhost:3000`, temporary Next.js dev server |
| Fixture | Two synthetic authenticated Free users, one per viewport, each with `FREE_MAX_COLLECTIONS=1` existing collection |
| Harnesses | `.collab/scripts/qa_browser_collection_limit_fixture.py`, `.collab/scripts/qa_browser_collection_limit_ux.js` |

## Result

Pass.

Evidence:

- Fixture: `.collab/tasks/qa-browser-collection-limit-fixture-2026-05-11.json`
- Browser UX run: `.collab/tasks/qa-browser-collection-limit-ux-2026-05-11.json`
- Cleanup: `.collab/tasks/qa-browser-collection-limit-fixture-cleanup-2026-05-11.json`

Assertions passed on desktop `1440x900` and mobile `390x844`:

- collection list API returned exactly `1` existing collection before create
- attempting to create another collection did not create a second collection
- modal stayed open and showed `Collection limit reached`
- Upgrade CTA linked to `/billing?plan=plus&period=monthly&source=limit&reason=collection_limit`
- no horizontal overflow before or after the blocked create attempt
- blocking console errors: `0`

The harness records expected browser resource errors for the intentionally blocked collection-create `403` response separately. The passing run recorded `2` ignored `403` console messages across desktop and mobile.

Screenshots:

- `.collab/tasks/screenshots/2026-05-11/collection-limit-desktop.png`
- `.collab/tasks/screenshots/2026-05-11/collection-limit-mobile.png`

## Cleanup

Fixture cleanup returned:

```json
{"result": "pass", "users": 0, "collections": 0, "collection_limit_users": 0}
```

## Validation

Passed:

- `python3 -m py_compile .collab/scripts/qa_browser_collection_limit_fixture.py`
- `node --check .collab/scripts/qa_browser_collection_limit_ux.js`
- `jq empty` for fixture, UX, and cleanup JSON artifacts
- `python3 -m ruff check app/ tests/ ../.collab/scripts/qa_browser_collection_limit_fixture.py ../.collab/scripts/qa_browser_session_limit_fixture.py ../.collab/scripts/qa_browser_duplicate_docs_fixture.py ../.collab/scripts/qa_browser_plan_limit_fixture.py ../.collab/scripts/qa_browser_converted_citation_fixture.py`
- `npm run build`
- `git diff --check`
- DB residual check: `{"qa_browser_collection_limit_users": 0, "qa_browser_collection_limit_collections": 0}`
- Port check: no listener on `3000` or `8000`

Note: frontend build printed the expected local `RESEND_API_KEY not set` message, plus existing Sentry config and edge-runtime warnings. They are unrelated to this collection-limit UX slice.

## Remaining Gap

This verifies Free collection-count limit UX in the browser. It does not cover collection document-count overflow in the add-documents flow or real checkout after clicking Upgrade.
