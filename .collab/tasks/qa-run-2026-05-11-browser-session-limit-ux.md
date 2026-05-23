# QA Run - Browser Session Limit UX - 2026-05-11

Scope: verify the reader session menu when a Free user has reached the per-document chat session limit.

## Environment

| Item | Value |
|---|---|
| Backend | `http://127.0.0.1:8000`, temporary uvicorn process |
| Frontend | `http://localhost:3000`, temporary Next.js dev server |
| Fixture | Two synthetic authenticated Free users, one per viewport, each with one ready TXT document and `FREE_MAX_SESSIONS_PER_DOC=3` existing sessions |
| Harnesses | `.collab/scripts/qa_browser_session_limit_fixture.py`, `.collab/scripts/qa_browser_session_limit_ux.js` |

## Initial Result

Fail.

Evidence:

- Fixture: `.collab/tasks/qa-browser-session-limit-fixture-2026-05-11.json`
- Initial UX run: `.collab/tasks/qa-browser-session-limit-ux-2026-05-11.json`

Observed:

- Backend correctly rejected the fourth session with `403 SESSION_LIMIT_REACHED`.
- The session count stayed at `3`.
- The reader session menu did not show an Upgrade CTA.
- Browser recorded an unhandled `HTTP 403` page/console error on desktop and mobile.

Bug:

- `.collab/tasks/bug-2026-05-11-session-limit-new-chat-unhandled.md`

## Fix

`frontend/src/components/SessionDropdown.tsx` now catches `createSession()` failures, maps the structured backend error through `errorCopy`, and renders an inline alert with the existing billing CTA.

## Retest

Pass.

Evidence:

- Retest: `.collab/tasks/qa-browser-session-limit-ux-after-fix-2026-05-11.json`
- Cleanup: `.collab/tasks/qa-browser-session-limit-fixture-cleanup-2026-05-11.json`

Assertions passed on desktop `1440x900` and mobile `390x844`:

- session list API returned exactly `3` existing sessions before New Chat
- clicking New Chat did not create a fourth session
- inline menu alert showed session-limit copy
- Upgrade CTA linked to `/billing?plan=plus&period=monthly&source=limit&reason=session_limit`
- session menu stayed open so the user could act on the error
- no horizontal overflow
- blocking console errors: `0`

The harness records expected browser resource errors for the intentionally blocked session-create `403` response separately. The passing run recorded `2` ignored `403` console messages across desktop and mobile.

Screenshots:

- `.collab/tasks/screenshots/2026-05-11/session-limit-desktop.png`
- `.collab/tasks/screenshots/2026-05-11/session-limit-mobile.png`

## Cleanup

Fixture cleanup returned:

```json
{"result": "pass", "users": 0, "documents": 0, "sessions": 0, "session_limit_storage_documents": 0}
```

## Validation

Passed:

- `python3 -m py_compile .collab/scripts/qa_browser_session_limit_fixture.py`
- `node --check .collab/scripts/qa_browser_session_limit_ux.js`
- `jq empty` for fixture, initial UX, fixed UX, and cleanup JSON artifacts
- `python3 -m ruff check app/ tests/ ../.collab/scripts/qa_browser_session_limit_fixture.py ../.collab/scripts/qa_browser_duplicate_docs_fixture.py ../.collab/scripts/qa_browser_plan_limit_fixture.py ../.collab/scripts/qa_browser_converted_citation_fixture.py`
- `npm run build`
- `git diff --check`
- DB residual check: `{"qa_browser_session_limit_users": 0, "qa_browser_session_limit_documents": 0, "qa_browser_session_limit_sessions": 0}`
- Port check: no listener on `3000` or `8000`

Note: frontend build printed the expected local `RESEND_API_KEY not set` message, plus existing Sentry config and edge-runtime warnings. They are unrelated to this session-limit UX slice.

## Remaining Gap

This verifies the Free per-document session-limit UX in the reader menu. It does not cover real Stripe checkout after clicking Upgrade, which is covered separately by hosted Stripe browser tests and still needs safe production-account verification.
