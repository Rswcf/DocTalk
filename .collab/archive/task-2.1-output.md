I’ve implemented the Chat API, reference parser, SSE streaming, and chunk detail endpoint, then wired routes into FastAPI.

**Core Services**
- RefParserFSM: Finite-state parser for inline [n] citations with 8-char buffer, offset tracking, fallback on invalid refs. See `backend/app/services/chat_service.py:40`.
- ChatService: Retrieval-augmented Claude streaming with prompt template, history (last N turns), FSM parsing, SSE pings, and DB persistence of assistant message + citations. See `backend/app/services/chat_service.py:120`.

**Prompt + Streaming**
- Strict prompt template (编号引用 [1]..[K]) embedded as system prompt with top-5 chunks, history, and user message. See `backend/app/services/chat_service.py:165`.
- Anthropic streaming via `AsyncAnthropic().messages.stream(...)`, emits:
  - token: `{"text": "..."}` per character as parsed by FSM
  - citation: `{"ref_index", "chunk_id", "page", "bboxes", "text_snippet", "offset"}`
  - ping every 15s
  - error on failure
  - done with `{"message_id", "citations_count"}`
- Assistant message (without raw “[n]” since citations are separate) and citations are saved post-stream.

**Schemas**
- Chat: `ChatRequest`, `ChatMessageResponse`, `SessionResponse`, `SessionMessagesResponse`. See `backend/app/schemas/chat.py:1`.

**API Routes**
- POST `/api/documents/{document_id}/sessions`: Create session. See `backend/app/api/chat.py:22`.
- GET `/api/sessions/{session_id}/messages`: List messages (role/content/citations/created_at). See `backend/app/api/chat.py:30`.
- POST `/api/sessions/{session_id}/chat`: SSE stream with headers per spec and format `event: <name>\ndata: {json}\n\n`. See `backend/app/api/chat.py:48`.
- GET `/api/chunks/{chunk_id}`: Chunk details for citation jump (page_start, bboxes, text, section_title). See `backend/app/api/chunks.py:17`.

**Router Registration**
- Added routers to FastAPI app:
  - `app.include_router(chat_router, prefix='/api')`
  - `app.include_router(chunks_router, prefix='/api')`
  See `backend/app/main.py:24`.

**Requirements**
- `anthropic` already present in `requirements.txt`.

**Status Update**
- Task 2.1 marked DONE in `.collab/tasks/current.md`.

**Notes**
- History limit uses `settings.MAX_CHAT_HISTORY_TURNS` (default 6).
- Retrieval chunks are heuristically truncated to ~1400 chars (~350 tokens target).
- If session not found or LLM errors, an `error` SSE is emitted.
- Citations saved as list of JSON dicts on assistant message.

Would you like me to add lightweight unit tests for FSM parsing or wire a local run script to sanity-check SSE locally?