# BUG - Session Limit New Chat Had No User-Facing Error

Date: 2026-05-11

## Summary

Free users who had already reached the per-document chat session limit could click **New Chat** in the reader session menu. The backend correctly returned `SESSION_LIMIT_REACHED`, but the frontend did not catch the error or show the upgrade path.

## Impact

- User sees no clear explanation of why New Chat failed.
- Browser records a blocking console/page error.
- The plan limit is enforced, but the UX is a dead end at the point of action.

## Reproduction

1. Create a Free user with one ready document and `FREE_MAX_SESSIONS_PER_DOC=3` existing sessions.
2. Open `/d/{document_id}` as that user.
3. Open the session dropdown.
4. Click **New Chat**.

Initial evidence:

- `.collab/tasks/qa-browser-session-limit-ux-2026-05-11.json`

Observed:

- API response: `403 SESSION_LIMIT_REACHED`
- Session count stayed at `3`, as expected.
- No visible Upgrade CTA appeared.
- Browser recorded `HTTP 403: {"detail":{"error":"SESSION_LIMIT_REACHED"...}}` as a console/page error.

Expected:

- The menu should show a concise session-limit explanation and an Upgrade CTA.
- The failed request should not become an unhandled browser error.

## Fix

Updated `frontend/src/components/SessionDropdown.tsx`:

- catch `createSession()` failures in `onNewChat`
- map structured API errors with `errorCopy`
- render an inline alert inside the session dropdown
- render the existing billing CTA for `reason=session_limit`
- track `limit_hit` / `upgrade_click` events for this source

## Retest

Passed:

- `.collab/tasks/qa-browser-session-limit-ux-after-fix-2026-05-11.json`

Desktop and mobile both showed:

- `Session limit reached`
- `Free plan is limited to 3 chat sessions per document. Upgrade for unlimited.`
- `Upgrade` link to `/billing?plan=plus&period=monthly&source=limit&reason=session_limit`
- 0 blocking console errors

Cleanup:

- `.collab/tasks/qa-browser-session-limit-fixture-cleanup-2026-05-11.json`
