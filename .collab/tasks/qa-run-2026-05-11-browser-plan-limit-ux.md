# QA Run - Browser Free Plan Limit UX - 2026-05-11

Scope: verify that a Free user already at the document limit gets clear, actionable limit/paywall UX for both file upload and URL import on desktop and mobile.

## Environment

| Item | Value |
|---|---|
| Backend | `http://127.0.0.1:8000`, temporary uvicorn process |
| Frontend | `http://localhost:3000`, temporary Next.js dev server |
| Fixture | Synthetic authenticated Free user with `FREE_MAX_DOCUMENTS=3` ready TXT documents |
| Test file | `test_inputs/semiconductor.pdf` |
| Test URL | `https://example.com/` |
| Harnesses | `.collab/scripts/qa_browser_plan_limit_fixture.py`, `.collab/scripts/qa_browser_plan_limit_ux.js` |

Note: the browser test uses `http://localhost:3000`, not `127.0.0.1`, because this local backend's CORS policy accepts the configured frontend origin.

## Result

Pass.

Evidence:

- Fixture: `.collab/tasks/qa-browser-plan-limit-fixture-2026-05-11.json`
- Browser UX run: `.collab/tasks/qa-browser-plan-limit-ux-2026-05-11.json`
- Cleanup: `.collab/tasks/qa-browser-plan-limit-fixture-cleanup-2026-05-11.json`

Assertions passed on desktop `1440x900` and mobile `390x844`:

- profile API returned plan `free`
- document list API returned exactly `3` existing documents
- uploading `test_inputs/semiconductor.pdf` showed the document-limit message instead of navigating to a reader
- importing `https://example.com/` showed the same document-limit message instead of navigating to a reader
- an Upgrade CTA linked to billing with `reason=document_limit`
- no horizontal page overflow after either failure state
- blocking console errors: `0`

The harness records expected browser resource errors for the plan-limit `403` responses separately as ignored evidence. The passing run recorded `4` ignored `403` console messages across desktop and mobile, matching the two intentional blocked actions per viewport.

Screenshots:

- `.collab/tasks/screenshots/2026-05-11/plan-limit-desktop-upload.png`
- `.collab/tasks/screenshots/2026-05-11/plan-limit-desktop-url.png`
- `.collab/tasks/screenshots/2026-05-11/plan-limit-mobile-upload.png`
- `.collab/tasks/screenshots/2026-05-11/plan-limit-mobile-url.png`

## Cleanup

Fixture cleanup returned:

```json
{"result": "pass", "users": 0, "documents": 0}
```

## Validation

Passed:

- `python3 -m py_compile .collab/scripts/qa_browser_plan_limit_fixture.py`
- `node --check .collab/scripts/qa_browser_plan_limit_ux.js`
- `jq empty` for fixture, UX, and cleanup JSON artifacts
- `python3 -m ruff check app/ tests/ ../.collab/scripts/qa_browser_plan_limit_fixture.py ../.collab/scripts/qa_browser_converted_citation_fixture.py`
- `npm run build`
- `git diff --check`
- DB residual check: `{"qa_browser_plan_limit_users": 0, "qa_browser_plan_limit_documents": 0}`
- Port check: no listener on `3000` or `8000`

Note: frontend build printed the expected local `RESEND_API_KEY not set` message, plus existing Sentry config and edge-runtime warnings. They are unrelated to this paywall UX slice.

## Remaining Gap

This verifies the browser UX for the Free document-count limit on upload and URL import. It does not replace Stripe-hosted checkout tests or real production payment/account testing.
