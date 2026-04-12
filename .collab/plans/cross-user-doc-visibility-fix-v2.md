# Cross-User Document Visibility Fix Plan (v2)

Incorporates all Codex review feedback from `.collab/reviews/cross-user-doc-visibility-fix-review.md`.

## Problem

When User A uploads a document and logs out, User B can see User A's document in their "My Documents" list after logging in on the same browser. The document is visible but cannot be opened (backend correctly denies access).

## Root Causes

### Frontend (PRIMARY — user-visible bug)

**`frontend/src/app/page.tsx`**

1. **localStorage never cleared on logout**: `localStorage['doctalk_docs']` stores uploaded document references. When User A logs out and User B logs in, the `useEffect([], [])` at line 130-133 reads the old localStorage data into `myDocs` state.

2. **`allDocs` merges stale local data with server data**: Line 146-156 combines `serverDocs` (properly filtered by backend JWT) with `localOnly` (from localStorage, no user scoping). Documents from the wrong user appear as "local-only" since their IDs don't match the new user's server docs.

3. **No state cleanup on logout**: `signOut()` in `UserMenu.tsx:190` doesn't clear `myDocs`, `serverDocs`, or localStorage.

### Backend (Security hardening)

4. **`/chunks/{chunk_id}` unauthenticated** (`backend/app/api/chunks.py:15-27`): No auth check — anyone with a chunk UUID can read any document's text.

5. **`list_documents` defaults `mine=False`** (`backend/app/api/documents.py:65`): Not the root cause (frontend passes `?mine=1`), but bad API design.

## Fix Specification

### Fix 1: Clean up document state on logout (frontend/src/app/page.tsx)

**Key insight from Codex review**: `isLoggedIn` (`status === 'authenticated'`) is `false` during the `loading` state too. A naive `if (!isLoggedIn)` cleanup would wipe localStorage on every initial page load before auth resolves.

**Solution**: Use `status === 'unauthenticated'` (explicit logout/not-logged-in) instead of `!isLoggedIn`:

```typescript
// After the existing useEffect for fetching serverDocs (around line 139), add:
useEffect(() => {
  if (status === 'unauthenticated') {
    setMyDocs([]);
    setServerDocs([]);
    localStorage.removeItem('doctalk_docs');
  }
}, [status]);
```

This fires when:
- User explicitly logs out (status goes from authenticated → unauthenticated)
- User is not logged in on page load (status goes from loading → unauthenticated)

This does NOT fire during `loading` state, so localStorage is preserved until auth is resolved.

**Additional cleanup for the serverDocs fetch (race condition fix from Codex review)**:

The `getMyDocuments()` call at line 135-139 and line 204 can race during rapid account switching. Add `AbortController`:

```typescript
useEffect(() => {
  if (!isLoggedIn) return;
  const controller = new AbortController();
  getMyDocuments(controller.signal).then(setServerDocs).catch((err) => {
    if (err.name !== 'AbortError') console.error(err);
  });
  return () => controller.abort();
}, [isLoggedIn]);
```

Update `getMyDocuments` in `frontend/src/lib/api.ts` to accept an optional `signal`:

```typescript
export async function getMyDocuments(signal?: AbortSignal): Promise<DocumentBrief[]> {
  const res = await fetch(`${PROXY_BASE}/api/documents?mine=1`, { signal });
  if (!res.ok) {
    if (res.status === 401) return [];
    throw new Error(`Failed to fetch documents: ${res.status}`);
  }
  return res.json();
}
```

**For the `allDocs` merge logic**: For logged-in users, server is the source of truth. Stop merging localStorage docs into the authenticated dashboard:

```typescript
const allDocs = useMemo(() => {
  if (isLoggedIn) {
    // Server is source of truth for authenticated users
    return serverDocs.map((d) => ({
      document_id: d.id,
      filename: d.filename,
      status: d.status,
      createdAt: d.created_at ? new Date(d.created_at).getTime() : Date.now(),
    })).sort((a, b) => b.createdAt - a.createdAt);
  }
  // Anonymous: use localStorage only
  return myDocs;
}, [isLoggedIn, serverDocs, myDocs]);
```

This eliminates the merge entirely for logged-in users, making cross-contamination impossible.

### Fix 2: Remove localStorage for logged-in upload tracking (frontend/src/app/page.tsx)

Currently, `onFiles` at line 200-202 saves to localStorage after upload. For logged-in users, the server already tracks documents. After upload, we just refresh `serverDocs` (which line 204 already does via `getMyDocuments()`).

**Change**: Only write to localStorage for anonymous uploads (if that's ever needed). For logged-in users, skip localStorage writes:

In `onFiles` callback (around line 200-204):
```typescript
if (!isLoggedIn) {
  const docs: StoredDoc[] = JSON.parse(localStorage.getItem('doctalk_docs') || '[]');
  const entry: StoredDoc = { document_id: docId, filename: res.filename, status: res.status, createdAt: Date.now() };
  localStorage.setItem('doctalk_docs', JSON.stringify([entry, ...docs.filter(d => d.document_id !== docId)]));
  setMyDocs([entry, ...docs.filter(d => d.document_id !== docId)].sort((a, b) => b.createdAt - a.createdAt));
}
getMyDocuments().then(setServerDocs).catch(console.error);
```

Similarly in `confirmDeleteDocument` callback (around line 291-293):
```typescript
if (!isLoggedIn) {
  const docs: StoredDoc[] = JSON.parse(localStorage.getItem('doctalk_docs') || '[]');
  const next = docs.filter((x) => x.document_id !== documentId);
  localStorage.setItem('doctalk_docs', JSON.stringify(next));
  setMyDocs(next.sort((a, b) => b.createdAt - a.createdAt));
}
setServerDocs((prev) => prev.filter((s) => s.id !== documentId));
```

### Fix 3: Secure chunks endpoint (backend/app/api/chunks.py)

Add authentication + document ownership check. **Per Codex review**: use `doc.demo_slug is not None` for the public exception, NOT `doc.user_id is None` (because user_id can be NULL for orphaned/legacy docs too).

```python
from __future__ import annotations

import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user_optional, get_db_session
from app.models.tables import Chunk, Document, User

chunks_router = APIRouter(prefix="/api", tags=["chunks"])


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
    doc: Document | None = doc_row.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Chunk not found")

    # Allow if: demo doc (has demo_slug) — accessible to all
    # Otherwise: require authenticated user who owns the document
    if not doc.demo_slug:
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

### Fix 4: Simplify list_documents endpoint (backend/app/api/documents.py)

Remove the `mine` param and always filter by authenticated user:

```python
@documents_router.get("", response_model=list[DocumentBrief])
async def list_documents(
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    user: Optional[User] = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db_session),
):
    """List current user's documents. Returns empty list for anonymous users."""
    if not user:
        return []

    from sqlalchemy import select
    from app.models.tables import Document

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

### Fix 5: Update frontend API call (frontend/src/lib/api.ts)

Remove `?mine=1` from `getMyDocuments()` since backend now always filters by user:

```typescript
export async function getMyDocuments(signal?: AbortSignal): Promise<DocumentBrief[]> {
  const res = await fetch(`${PROXY_BASE}/api/documents`, { signal });
  if (!res.ok) {
    if (res.status === 401) return [];
    throw new Error(`Failed to fetch documents: ${res.status}`);
  }
  return res.json();
}
```

## Files to Modify

1. `frontend/src/app/page.tsx` — Fix 1 + Fix 2 (status-aware cleanup, server-only allDocs for auth users, AbortController, conditional localStorage)
2. `backend/app/api/chunks.py` — Fix 3 (auth + demo_slug-based ownership check)
3. `backend/app/api/documents.py` — Fix 4 (remove `mine` param, always filter by user)
4. `frontend/src/lib/api.ts` — Fix 5 (remove `?mine=1`, add optional `signal` param)

## Validation

After changes:
1. `cd backend && python3 -m ruff check app/` — no lint errors
2. `cd frontend && npx tsc --noEmit` — no type errors
3. `cd frontend && npx next build` — builds successfully

## Summary of changes from v1 → v2 (Codex review feedback)

- **Fix 1**: Changed from `!isLoggedIn` to `status === 'unauthenticated'` to avoid clearing during loading state
- **Fix 1**: Added `AbortController` for `getMyDocuments()` to prevent request race on account switching
- **Fix 1**: Server is sole source of truth for authenticated users — removed `allDocs` merge of localStorage for logged-in users
- **Fix 3**: Changed chunk public access condition from `doc.user_id is None` to `doc.demo_slug is not None` (per Codex)
- **Fix 2**: Centralized cleanup in session-state effect on dashboard page, not tied to signOut UI paths
