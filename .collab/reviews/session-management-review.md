VERDICT: NEEDS_REVISION

## Issues Found

### [SEVERITY: critical] “Recent session” ordering relies on ChatSession.updated_at which never changes
- The plan restores the “most recent” session by sorting on `updated_at DESC`, but `ChatSession.updated_at` is not updated when messages are added; only the `messages` table changes. This will cause incorrect session ordering and always pick by creation time.
- Suggested fix:
  - Option A: Update the parent session’s `updated_at` on every user/assistant message save in `backend/app/services/chat_service.py`.
  - Option B: In the list-sessions query, compute `last_activity_at = COALESCE(MAX(messages.created_at), sessions.created_at)` and sort by that.

### [SEVERITY: major] Missing store action to replace/clear messages on session switch
- The plan loads history via `getMessages(sessionId)` when restoring/switching sessions, but the Zustand store lacks a way to clear/replace messages. Using only `addMessage()` will append to old messages.
- Suggested fix:
  - Add `setMessages: (msgs: Message[]) => void` or at least `clearMessages()` in `frontend/src/store/index.ts`, and use it for initial load and on session switch/new chat.

### [SEVERITY: major] Double-loading and race conditions between page.tsx and ChatPanel
- The plan proposes removing `ChatPanel`’s initial history load `useEffect` and centralizing in `page.tsx` to avoid duplication/races (good). Make this explicit and delete the effect in `frontend/src/components/Chat/ChatPanel.tsx`.
- Suggested fix:
  - Remove the `useEffect` that calls `getMessages(sessionId)` in `ChatPanel.tsx`.
  - Ensure `page.tsx` is the single source of message loading and uses `setMessages()`.

### [SEVERITY: major] Switching/deleting sessions while streaming not handled (backend and frontend)
- If a user deletes the current session during streaming, the backend tries to save the assistant message after the stream and will likely hit a foreign key violation. That exception is not caught (it occurs after the current try/except), causing abrupt stream termination.
- Suggested fix:
  - Frontend: disable SessionDropdown actions and deletion when `isStreaming` is true. Consider showing a tooltip/disabled state.
  - Backend: wrap the assistant message save/commit in try/except and yield an `error` SSE event (e.g., `PERSIST_FAILED`) if it fails. Optionally re-check session existence before saving.

### [SEVERITY: major] Session list API should return last activity and be consistent with schema
- The plan mentions LEFT JOIN + COUNT and sort by `updated_at`. Given the `updated_at` issue, the endpoint should compute `message_count` and `last_activity_at`. Also ensure response aligns with new Pydantic schema and includes `title`.
- Suggested fix:
  - In `backend/app/api/chat.py`, implement `GET /api/documents/{document_id}/sessions` using `GROUP BY` with `COUNT(messages.id)` and `MAX(messages.created_at)`; return fields in `SessionListItem` including computed `last_activity_at` or set `updated_at` as last activity.

### [SEVERITY: major] Schema and API client alignment gaps
- The plan adds `SessionListItem`, `SessionListResponse`, and extends `SessionResponse` to include `title`, but current `create_session` returns only `session_id` and `document_id`.
- Suggested fix:
  - Update `backend/app/schemas/chat.py` and `backend/app/api/chat.py` to include `title` in `SessionResponse`. Ensure `frontend/src/lib/api.ts` types reflect it.
  - When creating a session on the frontend, do not fabricate `created_at/updated_at`; either request them from the API or handle them as optional to avoid misleading UI.

### [SEVERITY: minor] TypeScript export and usage consistency
- The plan adds `SessionItem` to `frontend/src/types/index.ts` but it must be exported for use by store/components. Also, consider adding `SessionListResponse` type for API client parity.
- Suggested fix:
  - `export interface SessionItem { ... }` and reuse it across `store`, `api.ts`, and `SessionDropdown`.

### [SEVERITY: minor] Store shape and reset semantics
- The plan adds `sessions: SessionItem[]` and actions; ensure `reset()` clears `sessions` and `messages`, and that `setSessionId()` is coordinated with message replacement to avoid stale UI.
- Suggested fix:
  - Implement `reset()` to clear `sessions` and `messages`. After switching sessions, call `clearMessages()`/`setMessages()` before adding new messages.

### [SEVERITY: minor] Backend migration snippet incomplete
- The migration example lacks Alembic boilerplate (`revision`, `down_revision`, imports). This will matter when implemented.
- Suggested fix:
  - Follow existing style in `backend/alembic/versions/20260204_0001_initial_tables.py` and include `from alembic import op` and `import sqlalchemy as sa` with proper revision metadata.

### [SEVERITY: minor] API client: deleteDocument return handling
- `DELETE /api/documents/{id}` returns 202 with a JSON body. The plan’s `deleteDocument()` discards the body. Not wrong, but inconsistent with `handle()` usage and may hide useful status.
- Suggested fix:
  - Either reuse `handle()` to parse the body or keep as-is but document that the body is ignored intentionally.

### [SEVERITY: nit] Title derivation details
- The plan sets `title = first 50 chars of the first user message`. Consider trimming whitespace, collapsing newlines, and handling emoji/surrogate pairs to avoid mid-grapheme truncation.
- Suggested fix:
  - Sanitize title by replacing newlines with spaces and trimming; optionally use a grapheme splitter or be conservative (e.g., limit by code units is acceptable for MVP).

### [SEVERITY: nit] i18n coverage note
- Plan adds keys across 8 languages; ensure the new UI strings in `SessionDropdown` and Home page delete menu actually use `t('...')` and provide fallbacks where appropriate.
- Suggested fix:
  - Add the new keys to all `frontend/src/i18n/locales/*.json`, wire the strings in `SessionDropdown` and the home page menu.

## Summary
Good direction and aligns with project conventions, but needs fixes around session “recency” (critical `updated_at` semantics), message-loading orchestration, and concurrency/safety when modifying sessions mid-stream. Addressing these, plus small schema/types/store gaps, will make the plan technically sound and consistent with the existing codebase.