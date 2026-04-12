# Cross-User Document Visibility Fix Plan

## Problem

When User A uploads a document and logs out, User B can see User A's document in their "My Documents" list after logging in on the same browser. The document is visible but cannot be opened (backend correctly denies access).

## Root Causes

### Frontend (PRIMARY — user-visible bug)

**`frontend/src/app/page.tsx`**

1. **localStorage never cleared on logout**: `localStorage['doctalk_docs']` stores uploaded document references. When User A logs out and User B logs in, the `useEffect([], [])` at line 130-133 reads the old localStorage data into `myDocs` state.

2. **`allDocs` merges stale local data with server data**: Line 146-156 combines `serverDocs` (properly filtered by backend JWT) with `localOnly` (from localStorage, no user scoping). Documents from the wrong user appear as "local-only" since their IDs don't match the new user's server docs.

3. **No state cleanup on logout**: `signOut()` in `UserMenu.tsx:190` doesn't clear `myDocs`, `serverDocs`, or localStorage.

### Backend (Security hardening)

4. **`/chunks/{chunk_id}` unauthenticated** (`backend/app/api/chunks.py:15-27`): No auth check — anyone with a chunk UUID can read any document's text. Must add document ownership verification.

5. **`list_documents` defaults `mine=False`** (`backend/app/api/documents.py:65`): While it returns `[]` when `mine=False`, authenticated users should always see only their own docs. Change default to `True` for authenticated users.

## Fix Specification

### Fix 1: Clear localStorage on logout (frontend/src/app/page.tsx)

Add a `useEffect` that clears document state when `isLoggedIn` transitions to `false`:

```typescript
// After the existing useEffect for fetching serverDocs (line 139), add:
useEffect(() => {
  if (!isLoggedIn) {
    setMyDocs([]);
    setServerDocs([]);
    localStorage.removeItem('doctalk_docs');
  }
}, [isLoggedIn]);
```

### Fix 2: Scope localStorage to user (frontend/src/app/page.tsx)

Make localStorage key user-specific so different users on the same browser never share cache:

1. Get user ID from session: the `useSession()` hook returns `session.data?.user?.id` or similar. Check what's available.

2. Change all `localStorage.getItem('doctalk_docs')` / `localStorage.setItem('doctalk_docs', ...)` to use a user-scoped key:
   - Pattern: `doctalk_docs_${userId}` where userId comes from session
   - For logged-out state, don't read/write localStorage at all (docs come from server)

3. The initial `useEffect([], [])` at line 130-133 should only read localStorage when logged in, and only for the current user's key.

**Implementation approach**: Since `useSession()` returns `session.data?.user`, use `session.data?.user?.email` or `session.data?.user?.id` as the scoping key. If session is still loading, skip localStorage read.

Actually, the simplest and most robust fix is:
- **Remove localStorage for document tracking entirely** for logged-in users. They already get documents from the server via `getMyDocuments()`. localStorage was originally for anonymous/demo users.
- Only use localStorage for documents uploaded before login (edge case).

**Recommended approach**: Clear localStorage on login and on logout. The server is the source of truth for logged-in users.

### Fix 3: Secure chunks endpoint (backend/app/api/chunks.py)

Add authentication + document ownership check:

```python
from app.core.deps import get_current_user_optional, get_db_session
from app.models.tables import Chunk, Document, Page

@chunks_router.get("/chunks/{chunk_id}")
async def get_chunk_detail(
    chunk_id: uuid.UUID,
    user: Optional[User] = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db_session),
):
    row = await db.execute(select(Chunk).where(Chunk.id == chunk_id))
    ch: Chunk | None = row.scalar_one_or_none()
    if not ch:
        raise HTTPException(status_code=404, detail="Chunk not found")

    # Verify document ownership
    doc_row = await db.execute(select(Document).where(Document.id == ch.document_id))
    doc = doc_row.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Chunk not found")

    # Allow if: demo doc (user_id is None) OR user owns the document
    if doc.user_id is not None:
        if not user or doc.user_id != user.id:
            raise HTTPException(status_code=404, detail="Chunk not found")

    return {
        "chunk_id": str(ch.id),
        "page_start": ch.page_start,
        "bboxes": ch.bboxes,
        "text": ch.text,
        "section_title": ch.section_title,
    }
```

Note: Chunk has `document_id` field directly (FK to documents.id). Use `ch.document_id` to look up the Document.

### Fix 4: Default `mine=True` for authenticated users (backend/app/api/documents.py)

Change the `list_documents` endpoint to always filter by user when authenticated:

```python
@documents_router.get("", response_model=list[DocumentBrief])
async def list_documents(
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    user: Optional[User] = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db_session),
):
    """List current user's documents. Requires authentication."""
    if not user:
        return []  # Anonymous users see nothing (demo docs have separate endpoint)

    result = await db.execute(
        select(Document)
        .where(Document.user_id == user.id)
        .where(Document.status != "deleting")
        .order_by(Document.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    docs = result.scalars().all()
    return [
        DocumentBrief(
            id=str(d.id),
            filename=d.filename,
            status=d.status,
            created_at=d.created_at.isoformat() if d.created_at else None,
        )
        for d in docs
    ]
```

Remove the `mine` query parameter entirely — it's no longer needed.

### Fix 5: Update frontend API call (frontend/src/lib/api.ts)

`getMyDocuments()` at line 22-29 currently calls `${PROXY_BASE}/api/documents?mine=1`. After Fix 4 removes the `mine` param, change to just `${PROXY_BASE}/api/documents`.

## Files to Modify

1. `frontend/src/app/page.tsx` — Fix 1 + Fix 2 (clear state on logout, remove cross-user localStorage)
2. `backend/app/api/chunks.py` — Fix 3 (add auth + ownership check)
3. `backend/app/api/documents.py` — Fix 4 (remove `mine` param, always filter by user)
4. `frontend/src/lib/api.ts` — Fix 5 (update `getMyDocuments()` if it passes `?mine=1`)

## Validation

After changes:
1. `cd backend && python3 -m ruff check app/` — no lint errors
2. `cd frontend && npx tsc --noEmit` — no type errors
3. `cd frontend && npx next build` — builds successfully
4. Manual test: Upload doc as User A → logout → login as User B → User A's doc should NOT appear
