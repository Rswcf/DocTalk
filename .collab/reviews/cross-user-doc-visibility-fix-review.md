# Review: Cross-User Document Visibility Fix Plan
REVIEWER: CX
DATE: 2026-02-12
VERDICT: REQUEST_CHANGES

## Findings (ordered by severity)

### High: Fix 1 is unsafe as written and conflicts with Fix 2
The proposed effect in `.collab/plans/cross-user-doc-visibility-fix.md:33`-`.collab/plans/cross-user-doc-visibility-fix.md:39` clears storage whenever `isLoggedIn` is false. In the current page flow, `status === "loading"` before auth is resolved (`frontend/src/app/page.tsx:301`), so this runs on initial load too.

Impact:
- It does not implement the stated "transitions to false" behavior.
- It can wipe local cache before session resolution.
- It conflicts with the plan statement to keep local storage for pre-login edge cases (`.collab/plans/cross-user-doc-visibility-fix.md:57`-`.collab/plans/cross-user-doc-visibility-fix.md:60`).

Recommendation:
- Gate cleanup on explicit `status === "unauthenticated"` or a tracked transition `authenticated -> unauthenticated`.
- Pick one strategy and document it clearly: either remove logged-in local storage entirely, or keep strictly user-scoped storage.

### High: Proposed chunk authorization rule is too broad
The plan allows public chunk access whenever `doc.user_id is None` (`.collab/plans/cross-user-doc-visibility-fix.md:87`-`.collab/plans/cross-user-doc-visibility-fix.md:90`). But `user_id` is generally nullable (`backend/app/models/tables.py:37`), while demo/public docs are explicitly identified by `demo_slug` (`backend/app/models/tables.py:61`).

Impact:
- Any non-demo/orphaned/legacy document with `user_id = NULL` becomes publicly readable by chunk ID.

Recommendation:
- Public exception should be `doc.demo_slug is not None`, not `doc.user_id is None`.
- For all non-demo docs: require authenticated owner match.

### Medium: Request-race edge case is not addressed
`getMyDocuments()` is called without cancellation/identity guard (`frontend/src/app/page.tsx:135`, `frontend/src/app/page.tsx:204`). During rapid logout/login account switching, an in-flight response from User A can still call `setServerDocs` after User B signs in.

Recommendation:
- Add `AbortController` or a request token keyed by current user id.
- Ignore stale responses if session user changed before the response resolves.

### Medium: Logout cleanup should be centralized, not tied to one UI path
`signOut()` exists in `frontend/src/components/UserMenu.tsx:64` and `frontend/src/components/UserMenu.tsx:190`, but there is another sign-out path in `frontend/src/components/Profile/AccountActionsSection.tsx:47`.

Recommendation:
- Keep cleanup in a session-state effect on the dashboard page (or a shared auth cleanup utility), not only inside one menu component.

### Low: `list_documents` change is useful hardening, but not the root cause
Current backend behavior (`backend/app/api/documents.py:65`-`backend/app/api/documents.py:97`) returns `[]` unless `mine=1`, and frontend already passes `?mine=1` (`frontend/src/lib/api.ts:23`). So this is not causing cross-user visibility.

Recommendation:
- Keep this as API simplification/hardening, not as primary root cause.
- Consider temporary backward compatibility: accept both with/without `mine` during rollout.

## Answers to requested questions

1. Is the root cause diagnosis correct?
- Mostly yes for the frontend path (`localStorage` + merge + no cleanup) and for the `/chunks/{chunk_id}` IDOR risk.
- The `mine=False` default is not a root cause of this bug; it is a separate API cleanup/hardening item.

2. Are there any gaps or edge cases the plan misses?
- Yes: auth-loading cleanup bug, stale async fetch race on account switch, over-broad `user_id is None` public rule for chunks, and multiple sign-out paths.

3. Are the proposed fixes correct and complete?
- Partially. Direction is correct, but not complete/safe as written. The chunk visibility rule and logout cleanup semantics need adjustment before implementation.

4. Any suggestions for improvement?
- Use `session.user.id` (available in auth callback setup) as the only scoping identity if any local storage remains.
- Prefer server docs as source of truth for authenticated users; avoid merging anonymous local docs into authenticated dashboard data.
- Add automated regression tests:
  - Frontend: account-switch scenario should not render User A docs for User B.
  - Backend: `/api/chunks/{id}` returns 404 for non-owner, 200 for owner, and controlled behavior for demo docs.

5. Would you approve this plan for implementation?
- Not yet. I would approve after the above changes are incorporated, especially:
  - Fix 1 semantics (`unauthenticated`/transition-aware cleanup), and
  - Fix 3 authorization condition (`demo_slug`-based public access).

---END---
