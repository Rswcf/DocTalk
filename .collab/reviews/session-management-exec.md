I read the v3 plan and implemented all specified changes across backend and frontend, then verified build and lint.

**Backend**
- Alembic migration added: backend/alembic/versions/20260205_0002_add_session_title.py:1
  - Adds nullable `title` column to `sessions` with correct revision chain.
- ORM updated: backend/app/models/tables.py:113
  - `ChatSession` gains `title: Optional[str] = mapped_column(sa.String(200), nullable=True)`.
- Schemas updated: backend/app/schemas/chat.py:22
  - New `SessionListItem`, `SessionListResponse`.
  - `SessionResponse` now includes `title: Optional[str]` and `created_at: datetime`.
- API routes extended: backend/app/api/chat.py:1
  - `POST /documents/{document_id}/sessions` now `db.refresh(sess)` and returns full `SessionResponse`.
  - `GET /documents/{document_id}/sessions` lists sessions with COALESCE+MAX, full GROUP BY, `order_by(desc(last_activity))`, `limit(10)`.
  - `DELETE /api/sessions/{session_id}` deletes a session; returns 204 or 404 JSON.
  - Added imports `func`, `desc`.
- Chat service hardened: backend/app/services/chat_service.py:1
  - After saving user message, auto-set `session.title` from first user message (newline→space, trim, 50 chars).
  - Save assistant message wrapped in `try/except IntegrityError` with rollback and `sse("error", ...)` on failure. Only yields `done` if persistence succeeds.

**Frontend**
- Types added: frontend/src/types/index.ts:42
  - `SessionItem`, `SessionListResponse` exported.
- API client extended: frontend/src/lib/api.ts:1
  - `listSessions`, `deleteSession`, `deleteDocument` added.
  - `createSession` return type extended to include `title` and `created_at`.
- Store (Zustand) extended: frontend/src/store/index.ts:1
  - Added `sessions` state and actions `setMessages`, `setSessions`, `addSession`, `removeSession`, `updateSessionActivity`.
  - New actions implemented exactly per plan, with resorting by `last_activity_at`.
- New UI component: frontend/src/components/SessionDropdown.tsx:1
  - Dropdown on document name with New Chat, Recent Chats (max 10), Delete Current Chat, Back to Home.
  - Uses `useState`/`useRef`/click-outside pattern like `ModelSelector`/`LanguageSelector`.
  - Disables New/Switch/Delete while `isStreaming` is true.
- Header integration: frontend/src/components/Header.tsx:1
  - Replaces static document name with `<SessionDropdown />` when `documentName` exists.
- Document page logic: frontend/src/app/d/[documentId]/page.tsx:1
  - Fetches session list on load, resumes latest or creates a new session and loads its messages. Uses `setSessions`, `addSession`, `setMessages`.
- ChatPanel updates: frontend/src/components/Chat/ChatPanel.tsx:1
  - Removed internal messages loading effect; messages are now loaded in page.
  - On stream completion, calls `updateSessionActivity(sessionId)`.
- Home page delete: frontend/src/app/page.tsx:1
  - Adds `Trash2` delete button per document; confirm via `window.confirm`, calls `deleteDocument`, updates localStorage and refreshes list.
- i18n: Added keys to all 8 locales (en, zh, hi, es, ar, fr, bn, pt):
  - session.newChat, session.recentChats, session.deleteChat, session.deleteChatConfirm, session.backHome, session.noTitle, session.messageCount
  - doc.deleteDoc, doc.deleteDocConfirm

**Documentation**
- CLAUDE.md updated:
  - Route table includes `GET /api/documents/{document_id}/sessions` and `DELETE /api/sessions/{session_id}`.
  - Architecture decisions includes session management note.

**Verification**
- Build: cd frontend && npm run build → Compiled successfully.
- Lint: cd frontend && npx next lint → No ESLint warnings or errors.

**Notes**
- Followed the dropdown UI pattern; disabled actions while streaming (no tooltip string added to avoid introducing unspecified i18n keys).
- Backend list query groups all non-aggregated columns and orders by the labeled column object as requested.
- `createSession` now returns `created_at` to support accurate UI initialization of new sessions.

Want me to run backend migration locally as well or commit these changes?