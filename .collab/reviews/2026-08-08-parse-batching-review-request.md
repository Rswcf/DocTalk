# Review request: parse persistence batching + soft-limit-aware error handling (r1)

Commit under review: `f4d1953` (HEAD of main).

## Context — the incident you are guarding against regressing INTO, and the one we just fixed

Production 2026-08-08: parse of a 10-page born-digital PDF took 190s; 220/289-page
documents died at the 540s Celery soft limit inside element persistence
(`PERSIST_ELEMENTS_FAILED`). Root cause was operational (backend redeployed into
europe-west4 on 2026-05-23 while Postgres/Redis/Qdrant/MinIO stayed in us-west2 →
every DB round trip ~150ms; region now pinned back, ~0.7ms) — but the code made
latency multiplicative: **one INSERT round trip per ORM row** for pages,
document_elements (>1k rows for a dense 10-pager, ~25k for a 291-pager), chunks;
plus one UPDATE and one expiry-refresh SELECT per chunk in the embedding loop.

Secondary bug, observed live on 8/7 (doc 71843cf7): SoftTimeLimitExceeded delivered
asynchronously inside a psycopg call surfaced as `OperationalError("sending query
failed: another command is already in progress")`; the persist handler caught it as a
generic Exception → mislabeled the doc `PERSIST_ELEMENTS_FAILED`, wrote the status
back through the same corrupted connection, and returned — Celery recorded the task
as **succeeded** so `autoretry_for` never fired.

## The change (backend/app/workers/parse_worker.py + tests)

1. `_insert_rows_batched(db, model, rows)` — pages/elements/chunks persist via
   `db.execute(insert(model), rows[i:i+500])` executemany batches, single commit per
   stage. Progress side effect: `doc.pages_parsed` is now set once (len(pages))
   instead of every 10 pages.
2. Embedding loop loads `(id, text, chunk_index, page_start)` tuples instead of ORM
   Chunk instances (which expired on every per-batch commit → refresh SELECT per
   chunk), and backfills `vector_id` with one
   `UPDATE chunks SET vector_id = CAST(id AS VARCHAR) WHERE id IN (batch)` per batch.
3. `_chain_has_soft_limit(exc)` walks `__cause__`/`__context__` (cycle-safe); each
   persist handler re-raises `SoftTimeLimitExceeded from e` when the chain contains
   one → outer handler marks `PARSE_TIMEOUT` on a fresh session and re-raises (Celery
   records failure, autoretry applies).
4. `_fail_doc_fresh_session(document_id, code)` — real persist failures write the
   error status on a NEW session instead of the possibly-corrupted task session.

## What to attack

- Correctness of executemany semantics: JSONB dict params (bbox/bboxes/metadata_json),
  server defaults (id gen_random_uuid, created_at, parent_id NULL), identical key
  sets across rows, batch boundary math.
- Transactionality drift: pages were previously committed every 10 pages (progress
  visible mid-parse); now one commit. Elements/chunks were already single-commit.
  Does anything (frontend progress polling, demo seeding, re-parse cleanup,
  get_document_text_content completeness rule) depend on incremental pages_parsed or
  partially-visible Page rows?
- The soft-limit unwrap: false positives (a genuine persist failure whose context
  happens to contain a soft limit?), the `raise SoftTimeLimitExceeded() from e` path
  interacting with `autoretry_for=(Exception,)` + `retry_backoff=60` + max_retries=2,
  and the fact that `.run()`-level behavior differs from worker-level behavior.
- The embedding rewrite: `chunks` is now a list of Row tuples — any code below that
  still expects ORM instances? `doc.chunks_indexed` accounting across batches;
  `cast(Chunk.id, String)` vs `str(uuid)` equivalence (lowercase hyphenated).
- The fresh-session error writer: reentrancy, exception swallowing, interaction with
  the stub-session monkeypatching in existing tests.
- Anything in the M2 verified-quote pipeline (quote_source_service page_text mode
  needs complete consecutive non-blank coverage) that could be affected by changed
  NULL/'' content semantics — the row construction is meant to be byte-identical to
  the old per-row path; verify that claim.

## Verdict format

Reply with findings as BLOCKER / IMPORTANT / MINOR, each with a concrete failure
scenario, then an overall SHIP / REVISE verdict. Do not run git (sandbox); the diff
is in the working tree at HEAD.
