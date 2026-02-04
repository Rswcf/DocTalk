I’ve updated the frontend API endpoints, types, and message mapping to match the backend, and marked Task 3.0 as DONE.

**What I Changed**
- API URLs fixed
  - `uploadDocument` → POST `api/documents/upload` (frontend/src/lib/api.ts:13–21)
  - `getDocumentFileUrl` → GET `api/documents/{id}/file-url` (frontend/src/lib/api.ts:29–31)
  - `searchDocument` → POST `api/documents/{id}/search` with `{ query, top_k }` and signature `searchDocument(docId: string, query: string, topK?: number)` (frontend/src/lib/api.ts:70–76)

- DocumentResponse type aligned with backend
  - Added and reshaped to `{ id, filename, status, page_count?, pages_parsed, chunks_total, chunks_indexed, created_at }` (frontend/src/types/index.ts:29–38)

- Home page progress usage updated
  - Replaced `info.parse_progress.pagesParsed` and `chunksIndexed` with `info.pages_parsed` and `info.chunks_indexed` (frontend/src/app/page.tsx:51–57)
  - `info.status` usage unchanged

- Message history mapping implemented
  - `getMessages` now maps backend messages to frontend shape:
    - `content` → `text`
    - generated `id` as `msg_${index}`
    - `created_at` → `createdAt` via `Date.parse`
    - `citations` keys converted from snake_case → camelCase:
      - `ref_index`→`refIndex`, `chunk_id`→`chunkId`, `text_snippet`→`textSnippet`
    - (frontend/src/lib/api.ts:42–68)

- Task status updated
  - Set Task 3.0 STATUS to DONE (.collab/tasks/current.md)

**Files Touched**
- frontend/src/lib/api.ts:1, 13–21, 29–31, 42–76
- frontend/src/types/index.ts:29–38
- frontend/src/app/page.tsx:51–57
- .collab/tasks/current.md

**Notes**
- Status type union remains compatible with store (`'idle' | 'uploading' | 'parsing' | 'embedding' | 'ready' | 'error'`).
- Search result and citation shapes remain snake_case from backend; mapping to camelCase is performed for citations in `getMessages`, and already handled for SSE in `frontend/src/lib/sse.ts`.

Want me to run a quick TS build check locally or proceed to the next task?