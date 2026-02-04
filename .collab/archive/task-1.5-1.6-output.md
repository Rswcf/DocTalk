I’ve added embedding + Qdrant integration and the semantic search API, and wired everything into the app lifecycle.

**What I Implemented**
- Embedding service and Qdrant collection management
- Parse worker embedding/indexing stage
- Retrieval service for semantic search
- Search schemas and API route
- Startup hook to ensure Qdrant collection
- Updated tasks’ STATUS and CX_NOTES

**Key Changes**
- Embeddings + Qdrant
  - Added `EmbeddingService`:
    - Config-driven model/dim/provider; uses OpenAI embeddings.
    - `embed_texts(texts)` returns vectors in batch.
    - `ensure_collection()` validates/creates collection with configured dim (cosine).
    - `get_qdrant_client()` returns a singleton.
    - File: backend/app/services/embedding_service.py
  - Updated parse worker to embed after parsing:
    - Loads all chunks, sets `document.status = 'embedding'`.
    - Batches by `EMBED_BATCH_SIZE`, calls embeddings, upserts to Qdrant.
    - Each point: `id=chunk_uuid`, `vector`, `payload={document_id, chunk_index, page_start, text[:1000]}`.
    - Updates `chunks.vector_id` and `documents.chunks_indexed` per batch.
    - Coarse rate limit: `sleep(0.2)` between batches.
    - On success: `document.status = 'ready'`; on error: `status='error'`.
    - File: backend/app/workers/parse_worker.py
- Startup hook
  - Ensures object storage bucket and Qdrant collection on app start.
  - Files: backend/app/main.py
- Semantic search API
  - `RetrievalService.search(query, document_id, top_k)`:
    - Embeds the query.
    - Qdrant vector search with `document_id` filter.
    - Fetches chunk details from DB, returns results ordered by score.
    - File: backend/app/services/retrieval_service.py
  - Schemas:
    - `SearchRequest`, `SearchResultItem`, `SearchResponse`.
    - File: backend/app/schemas/search.py
  - Route:
    - `POST /api/documents/{document_id}/search`
    - File: backend/app/api/search.py
  - Router registration:
    - File: backend/app/main.py

**Startup + Routing**
- Qdrant collection check on startup:
  - backend/app/main.py:33
- Search router registered:
  - backend/app/main.py:25

**Tasks Updated**
- .collab/tasks/current.md: Task 1.5 and Task 1.6 STATUS set to DONE, with CX_NOTES detailing decisions and implementation.

**Files Touched**
- backend/app/services/embedding_service.py
- backend/app/services/retrieval_service.py
- backend/app/schemas/search.py
- backend/app/api/search.py
- backend/app/main.py
- backend/app/workers/parse_worker.py
- .collab/tasks/current.md

**Notes**
- Embedding provider currently supports `openai` as per spec. Others can be added later.
- Worker calls `ensure_collection()` as a safe guard; FastAPI also ensures it on startup.
- Payload text truncated to avoid oversized payloads.
- If you want, I can run a quick smoke test (with your environment keys) to verify embedding/search flows end-to-end.