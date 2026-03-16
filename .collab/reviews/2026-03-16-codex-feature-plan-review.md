**CRITICAL**
- **Task 3 + Task 5:** snippets use `get_current_user`, but this function does not exist. Current auth deps are `get_current_user_optional` and `require_auth` in [deps.py](/Users/mayijie/Projects/Code/010_DocTalk/backend/app/core/deps.py#L24).  
- **Task 13:** `chat_service.py` snippet uses `body.domain_mode`, but `chat_stream()` has no `body` parameter in [chat_service.py](/Users/mayijie/Projects/Code/010_DocTalk/backend/app/services/chat_service.py#L215), and caller wiring in [chat.py](/Users/mayijie/Projects/Code/010_DocTalk/backend/app/api/chat.py#L291) does not pass domain mode.
- **Task 10:** snippet references `request.document_ids` in `add_documents_to_collection`, but actual argument is `body` in [collections.py](/Users/mayijie/Projects/Code/010_DocTalk/backend/app/api/collections.py#L194). It also needs `settings` import (currently absent in that file).
- **Task 11:** snippet uses `setCurrentPage`, which does not exist; store exposes `setPage` in [store/index.ts](/Users/mayijie/Projects/Code/010_DocTalk/frontend/src/store/index.ts#L63).  
- **Task 6:** plan says only edit `ChatPanel.tsx` + `api.ts`, but export menu behavior is implemented in [PlusMenu.tsx](/Users/mayijie/Projects/Code/010_DocTalk/frontend/src/components/Chat/PlusMenu.tsx#L6) with a single `onExport` action, so per-format options cannot be integrated as written.
- **Task 14:** domain mode won’t actually flow unless `useChatStream` is updated (current call site is [useChatStream.ts](/Users/mayijie/Projects/Code/010_DocTalk/frontend/src/lib/useChatStream.ts#L155)).  
- **Task 14:** payload pattern `...(domainMode ? {...} : {})` cannot clear mode back to default/null.
- **Task 3 + Task 5 integration:** proposed ownership check `session.user_id == user.id` breaks collection sessions, because collection session creation currently omits `user_id` in [collections.py](/Users/mayijie/Projects/Code/010_DocTalk/backend/app/api/collections.py#L268). Must use access logic like [verify_session_access](/Users/mayijie/Projects/Code/010_DocTalk/backend/app/api/chat.py#L66).
- **Spec gap (Feature 1):** design requires `GET /shared/{token}` rate limit (30/min/IP) in [design spec](/Users/mayijie/Projects/Code/010_DocTalk/docs/superpowers/specs/2026-03-16-top4-features-design.md#L131), but Task 5 plan omits it.

**IMPORTANT**
- **Task 9:** only SSE mapping is updated; historical messages loaded via [getMessages in api.ts](/Users/mayijie/Projects/Code/010_DocTalk/frontend/src/lib/api.ts#L75) are not mapped for `confidenceScore/contextText`.
- **Task 13 + Task 14:** domain-mode restore on session switch is incomplete unless session list responses/types include it for both document and collection flows ([chat.py list_sessions](/Users/mayijie/Projects/Code/010_DocTalk/backend/app/api/chat.py#L419), [collections.py list_collection_sessions](/Users/mayijie/Projects/Code/010_DocTalk/backend/app/api/collections.py#L280), [types SessionItem](/Users/mayijie/Projects/Code/010_DocTalk/frontend/src/types/index.ts#L66)).
- **Task 7 vs spec:** missing “already shared: copy/revoke” UX and missing delete-session warning for active share links (required by spec section 1.2).
- **Task 2 + Task 3 integration:** export service raises `ValueError` for >500 messages, but API plan does not convert this to HTTP 400 (spec requires 400).
- **Task 11 vs spec:** collection page plan does not clearly include mode selector placement in chat area as required by spec 3.2.
- Several referenced line numbers are slightly off (non-blocking), e.g. `tables.py ~349` while file currently ends at line 348.

**SUGGESTIONS**
- Add/expand backend tests for: export plan gating, share rate limit, collection limits, domain mode persistence/gating, and default-mode reset behavior.
- Treat tasks **1, 2, 4, 8, 12, 15** as mostly structurally sound; tasks **3, 5, 6, 7, 9, 10, 11, 13, 14** need plan edits before implementation.

**VERDICT**
**NEEDS CHANGES**