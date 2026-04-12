Implemented all 5 fixes from `.collab/plans/cross-user-doc-visibility-fix-v2.md` across the 4 target files.

**What changed**
1. `frontend/src/app/page.tsx:130`
- Guarded initial localStorage read to `status === 'unauthenticated'` only.
- Added abortable server-doc fetch effect using `AbortController` for logged-in users: `frontend/src/app/page.tsx:136`.
- Added logout/session cleanup effect on `status === 'unauthenticated'` to clear `myDocs`, `serverDocs`, and `doctalk_docs`: `frontend/src/app/page.tsx:145`.
- Changed `allDocs` so authenticated users use only `serverDocs` (no local merge): `frontend/src/app/page.tsx:158`.
- Wrapped localStorage write path in `onFiles` with `if (!isLoggedIn)`: `frontend/src/app/page.tsx:214`.
- Wrapped localStorage delete path in `confirmDeleteDocument` with `if (!isLoggedIn)`: `frontend/src/app/page.tsx:307`.

2. `backend/app/api/chunks.py:1`
- Rewrote endpoint to require ownership for non-demo docs:
  - Added `user: Optional[User] = Depends(get_current_user_optional)`.
  - Loaded parent `Document` and enforced:
    - public only when `doc.demo_slug is not None`
    - otherwise must be authenticated owner.
- Imports now include `get_current_user_optional`, `Document`, `User`.

3. `backend/app/api/documents.py:63`
- Removed `mine` query param from `list_documents`.
- Endpoint now always returns current user’s non-deleting docs.
- Anonymous users now get `[]` directly.

4. `frontend/src/lib/api.ts:22`
- Updated `getMyDocuments` to:
  - accept optional `signal?: AbortSignal`
  - call `${PROXY_BASE}/api/documents` (removed `?mine=1`).

**Validation results**
1. `cd backend && python3 -m ruff check app/api/chunks.py app/api/documents.py`
- Passed (exit 0, no lint errors).

2. `cd frontend && npx tsc --noEmit`
- Passed (exit 0, no type errors).

3. `cd frontend && npx next build`
- Passed (exit 0, successful production build).
- Existing unrelated warnings remained in:
  - `frontend/src/app/collections/[collectionId]/page.tsx`
  - `frontend/src/components/Profile/ProfileInfoSection.tsx`

No specialized AGENTS skill was needed for this turn; this was a direct code patch + validation workflow.