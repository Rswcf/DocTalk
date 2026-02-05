VERDICT: NEEDS_REVISION

## Issues Found

### [SEVERITY: critical] list_sessions SQL aggregation will error and sort incorrectly
The plan’s query selects non-aggregated columns (`ChatSession.title`, `ChatSession.created_at`) with `COUNT` and only groups by `ChatSession.id`, and orders by a string label. This will raise a Postgres error and sorting may not work reliably.
Fix:
- Group by all non-aggregated columns.
- Use the labeled column object in `order_by` instead of a string.
- Prefer destructuring rows or `result.mappings()` for clarity.
Suggested implementation in `backend/app/api/chat.py`:
- Compute `last_activity = func.coalesce(func.max(Message.created_at), ChatSession.created_at).label("last_activity_at")`
- `select_from(ChatSession)` then `.outerjoin(Message, Message.session_id == ChatSession.id)`
- `.group_by(ChatSession.id, ChatSession.title, ChatSession.created_at)`
- `.order_by(desc(last_activity))`
- Use `.limit(10)` to match the UI spec of “最多显示 10 条”.
- Get rows via `rows = (await db.execute(stmt)).all()` and either destructure or use `row._mapping[...]`.

### [SEVERITY: major] SSE error event and exception handling mismatch
The plan uses `_sse_error("PERSIST_FAILED", ...)`, which doesn’t exist in the current service; SSE client expects `event: "error"`. Broad `except Exception` is also too coarse.
Fix:
- Use the existing helper `sse("error", {...})` in `backend/app/services/chat_service.py`.
- Narrow the catch to `sqlalchemy.exc.IntegrityError` (and optionally `sqlalchemy.orm.exc.ObjectDeletedError`), indicating the session may have been deleted mid-stream, then emit a proper `error` event and return.
- Keep the “auto-set session title from first user message” snippet, but refer to the actual param name (`user_message`) and ensure title sanitation logic matches.

### [SEVERITY: major] Session deletion follow-up selects from stale state
The plan’s `onDeleteSession` uses `sessions[0]` after `removeSession(sessionId)`, but `sessions` is the stale pre-removal array.
Fix:
- Read the updated list from the store after removal, e.g. `const next = useDocTalkStore.getState().sessions; if (next.length) onSwitchSession(next[0].session_id) else onNewChat();`
- Alternatively, re-fetch via `listSessions(documentId)` and drive selection from the fresh list.

### [SEVERITY: major] Limit mismatch: UI says 10, backend uses 20
Plan states the dropdown shows at most 10 recent chats, but the query uses `.limit(20)`.
Fix:
- Align both to 10 (recommended), or update the UI spec to 20 and keep them consistent.

### [SEVERITY: major] Store/session recency isn’t updated after chatting
The plan sorts sessions by `last_activity_at` only on initial fetch. After sending messages, the in-memory `sessions` list will become stale (ordering and `last_activity_at` won’t update).
Fix:
- On each user message (or on `done`), either update the active session’s `last_activity_at` and move it to the top locally, or re-fetch via `listSessions(documentId)` to keep the dropdown accurate.

### [SEVERITY: minor] API client snippet missing deleteDocument
The plan references `deleteDocument` in `frontend/src/app/page.tsx` but the API section only shows `listSessions`/`deleteSession`.
Fix:
- Add in `frontend/src/lib/api.ts`:
  `export async function deleteDocument(docId: string): Promise<void> { const res = await fetch(\`${API_BASE}/api/documents/${docId}\`, { method: 'DELETE' }); if (!res.ok) throw new Error(\`HTTP ${res.status}: \${await res.text()}\`); }`

### [SEVERITY: minor] Documentation not updated
New endpoints aren’t reflected in `CLAUDE.md`.
Fix:
- Document `GET /api/documents/{document_id}/sessions` and `DELETE /api/sessions/{session_id}`.

### [SEVERITY: nit] Pydantic config and naming
- `SessionListItem.Config.from_attributes = True` isn’t needed when you’re constructing objects manually.
- Use consistent field names in snippets (`user_message` vs `message`) to avoid copy/paste bugs.

## Summary
The v2 plan addresses the core concerns from the first review (session listing/sorting, session title, unified message loading, guarded UI actions, and schema alignment). However, the backend `list_sessions` query as written will fail in Postgres without proper grouping and should order by the labeled expression, and a few frontend/state handling details (delete flow, session list freshness, limit mismatch) need tightening. Update the items above and this plan will be implementation-ready.