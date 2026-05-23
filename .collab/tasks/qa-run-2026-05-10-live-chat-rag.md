# Live Chat/RAG QA Run - 2026-05-10

Scope: live streaming chat/RAG checks for the core document conversation path. This run adds a reusable harness for production demo, local `test_inputs` upload, and URL-ingest chat flows.

## Environment

- Production backend: `https://backend-production-a62e.up.railway.app`.
- Local backend: `http://127.0.0.1:8000`.
- Local worker/infra: existing Celery workers plus Docker Compose Postgres, Redis, Qdrant, and MinIO.
- Harness: `.collab/scripts/qa_live_chat_rag_matrix.py`.

## Test Data

- Production demo document: `attention-paper` (`Attention Is All You Need`).
- Local upload document: `test_inputs/semiconductor.pdf`.
- Local URL import: `https://example.com/`.

## Commands

```bash
python3 .collab/scripts/qa_live_chat_rag_matrix.py \
  --source demo \
  --demo-slug attention-paper \
  --message "Explain how multi-head attention works in this paper. Keep it concise and cite the source." \
  --expect-term attention \
  --expect-term head \
  --json-out .collab/tasks/qa-live-chat-rag-production-demo-2026-05-10.json

python3 .collab/scripts/qa_live_chat_rag_matrix.py \
  --source demo \
  --demo-slug attention-paper \
  --message "请用中文简要解释这篇论文中的多头注意力机制，并给出引用。" \
  --locale zh \
  --expect-term 注意力 \
  --json-out .collab/tasks/qa-live-chat-rag-production-demo-zh-2026-05-10.json

python3 .collab/scripts/qa_live_chat_rag_matrix.py \
  --api-base http://127.0.0.1:8000 \
  --source upload \
  --file test_inputs/semiconductor.pdf \
  --message "What is the document's core semiconductor thesis? Cite the source." \
  --expect-term semiconductor \
  --allow-blocked \
  --json-out .collab/tasks/qa-live-chat-rag-local-upload-blocked-2026-05-10.json

python3 .collab/scripts/qa_live_chat_rag_matrix.py \
  --api-base http://127.0.0.1:8000 \
  --source url \
  --url https://example.com/ \
  --message "What is this page about? Cite the source." \
  --expect-term example \
  --allow-blocked \
  --json-out .collab/tasks/qa-live-chat-rag-local-url-blocked-2026-05-10.json
```

Production cleanup:

```bash
DELETE /api/sessions/3914142a-085d-4d96-b178-601517181f8e -> 204
DELETE /api/sessions/28669c7c-ce5f-4070-ba25-42e09eaa9a1c -> 204
```

## Result

Overall result: **partial pass**.

Production public demo live RAG passed for English and Chinese prompts. Local authenticated upload and URL-ingest flows reached parsed-ready documents and created chat sessions, then were blocked at the expected local LLM provider boundary because `DEEPSEEK_API_KEY` is not configured locally.

| Flow | Result | Evidence |
|---|---:|---|
| Production demo, English prompt | Pass | SSE 200; 974 token events; 6 citations; `done`; messages API persisted assistant with citations; first citation chunk readable; quality score 1.0 |
| Production demo, Chinese prompt | Pass | SSE 200; 308 token events; 7 citations; `done`; messages API persisted assistant with citations; 3 citation chunks readable; quality score 1.0 |
| Local `test_inputs/semiconductor.pdf` upload chat | Blocked after setup | health 200; upload 202; poll `ready`; create session 201; SSE `LLM_ERROR`; cleanup deleted QA user/docs |
| Local URL ingest chat | Blocked after setup | health 200; ingest URL 202; poll `ready`; create session 201; SSE `LLM_ERROR`; cleanup deleted QA user/docs |

## Checks Covered

- Live SSE stream opens and emits token/citation/done events in production.
- Answer text is non-empty and contains expected query terms.
- Citation payloads include `chunk_id`, page, and snippets.
- Citation chunks can be fetched through `/api/chunks/{chunk_id}`.
- `/api/sessions/{session_id}/messages` persists assistant answer and citations.
- Chinese user prompt returns a Chinese cited answer with expected Chinese term coverage.
- Local upload and URL entry points reach ready/session state before the missing-key boundary.
- Local synthetic QA users/documents are cleaned up.

## Finding

Local live RAG quality remains environment-blocked:

- `DEEPSEEK_API_KEY=False`.
- `MODE_MODELS={'quick': 'deepseek-v4-flash', 'balanced': 'deepseek-v4-pro'}`.
- Both configured chat modes are DeepSeek official models, so local live LLM calls return the product-safe SSE error: `The AI provider is temporarily unavailable. Please try again shortly.`

This is an environment blocker, not a new product bug. The harness is now ready to rerun against local uploaded `test_inputs` files and URL imports as soon as a valid DeepSeek key is available.

## Remaining Gaps

- Production live RAG was only run on public demo `attention-paper`, not the private upload corpus.
- Browser-level live streaming UI and live citation jump from a real LLM answer still need a configured local/preview account.
- Full-corpus RAG factuality scoring, adversarial prompts, and hallucination checks still need execution with LLM access.
