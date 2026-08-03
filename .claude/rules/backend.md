---
paths:
  - "backend/**"
---

# Backend Conventions

## Async Safety
- **MinIO calls MUST use `asyncio.to_thread()`** in async endpoints. MinIO client is sync (urllib3). Direct calls block event loop; when MinIO is unreachable, blocks ALL requests for 30+s. Client configured with short timeouts (connect=5s, read=10s, 2 retries)
- **Celery uses sync DB** (`psycopg`), API uses async (`asyncpg`). Never mix.

## Credits & Billing
- **Two-stage debit**: ① Pre-check balance (402 if insufficient) → ② `debit_credits()` pre-debits estimated cost (returns ledger ID) → stream → `reconcile_credits()` UPDATEs same ledger entry to actual cost. Single ledger record per chat. LLM failure → DELETE entry + full refund
- **Durable settlement (v0.24.0, Codex-consensus)**: `credit_ledger.reconciled_at` is the settlement marker. `reconcile_credits()` takes `SELECT ... FOR UPDATE` and ALWAYS stamps `reconciled_at` — including the equal-cost no-op path. Every refund is a single atomic conditional `DELETE ... WHERE reconciled_at IS NULL RETURNING id`; rowcount 0 = money already settled = no refund. ALL final-commit exceptions (not just `CancelledError`) route through the marker resolver; resolver failure must NEVER fall through to a blind refund (leave predebit standing, log `*.unresolved`). Do not reintroduce read-then-act refund logic.
- Quote search billing: `reason="quote_search"`, predebit 15 (balanced estimate), reconcile to actual; verified-empty results charge actual cost. Chat-routed quote searches bill through the chat message's own ledger row (predebit forced to 15 when the strict trigger fires, regardless of selected mode) — never a second row.
- **`ChatRequest` exposes only `mode` field** (`quick`/`balanced`; legacy `thorough` is retired). `model` field removed — prevents billing bypass
- Stripe webhook: `checkout.session.completed` for subscriptions only updates plan (no credits); `invoice.payment_succeeded` grants monthly credits (idempotent by invoice.id)
- `POST /api/billing/cancel` is self-serve and records optional `cancel_reason`, `cancel_feedback`, and `refund_requested` metadata in `plan_transitions`. `refund_requested` is an internal review flag; do not issue Stripe refunds from this path unless an explicit refund workflow is added.

## Parse Worker
- `time_limit=600`, `soft_time_limit=540`, `autoretry_for=(Exception,)`, max 2 retries, 60s backoff
- Idempotent re-parse: **delete Qdrant vectors (by `document_id` filter) BEFORE deleting DB pages/chunks**. Ordering matters — a Qdrant outage must leave the existing rows intact (set error + return), else the two stores diverge / data is lost. Then re-index.
- **PDF page text is persisted forward-only (v0.24.0)**: the extract pass stores `page.get_text("text")` per page into `pages.content` (previously NULL for all PDFs). Legacy docs keep NULL until re-parsed. `get_document_text_content` uses page mode ONLY when coverage is complete and consecutive (`1..page_count`, all non-blank); otherwise chunk fallback.
- **OCR trigger = `detect_scanned` (no text layer) OR `detect_low_quality_text` (PDF text layer present but garbled — broken-font cmap, Unicode-aware quality score)**. R2b fix for docs like U13 that have garbage text and so were never detected as "scanned".
- **OCR language is content-based**: `detect_script_osd` runs `tesseract --psm 0` (OSD) on sample pages → `resolve_ocr_languages(locale, script)` returns a NARROW set (script family, ≤3, **no `eng` for non-Latin** — it injects Latin noise). Never the kitchen-sink set (causes cross-script hallucination); locale only refines within a script family. Adopt a low-quality re-OCR only if it beats the text-layer quality. Persist `parse_version`/`parse_method`/`text_quality`/`ocr_languages` on the doc.
- Backfill stale/low-quality docs with `scripts/find_low_quality_docs.py` (skips `parse_version>=current` unless `--force`).

## Verified Quote Pipeline (M2, v0.24.0 — Codex 6-round consensus; do not weaken)
- **The guarantee**: a quote card is NEVER rendered from LLM-emitted text. `verify_quote()` (M1 substrate) gates every proposal; display text is ALWAYS the raw source slice. Flagged-tier (fuzzy 90–95) results are discarded from cards, only counted.
- **Verification source** (`quote_source_service`): all pages in the chunk's range have `Page.content` → per-page verification, kind=`page_text`; else cited chunk ± neighbors, kind=`extracted_text`. Trust labels derive from kind and are honest per-kind (word-for-word claim only for `page_text`).
- **Page attribution derives from the VERIFIED slice** (plan §8.1): multi-page `extracted_text` segments are DISCARDED (`ambiguous_page_range`); `page_text` duplicates emit one card per matching page. Never attribute via majority-bbox voting.
- **Chat routing is deterministic-safe**: auto-route to the billed pipeline ONLY when the strict trigger matches AND zero negation/metalinguistic tokens appear anywhere in the message; otherwise the ordinary RAG path runs with `quote_finder_hint`/`quote_finder_topic` on the SSE `done` event (frontend chip). Guarded triggers FORCE the RAG path — never a tool action. Do not re-attempt regex intent-scope resolution; the policy is adjudicated (asymmetric loss).
- **Saved quotes re-verify server-side**: the save endpoint accepts only `chunk_id + quote_text` and re-derives tier/score/page/kind via `verify_saved_quote()`; client-supplied trust fields would forge "verified" cards. Fabrication = 422 `QUOTE_NOT_VERIFIABLE`. Saved rows snapshot trust fields at save time (survive reparses; `source_chunk_id` is ON DELETE SET NULL).
- Caps: `FREE_SAVED_QUOTES_LIMIT=30` counts ACTIVE rows per user across documents; delete frees a slot; idempotent re-saves are never capped.

## Auth
- **`FOR UPDATE` lock** on verification tokens to prevent TOCTOU
- Internal Auth Adapter API uses `X-Adapter-Secret` header

## Error Handling
- Use `HTTPException` (not `JSONResponse`) for all non-SSE endpoints
- Lifespan pattern (`@asynccontextmanager`) instead of deprecated `@app.on_event`

## Demo System
- 3 seed PDFs auto-deployed at startup from `backend/seed_data/`. Self-healing covers BOTH stores: Qdrant vector loss → full re-seed; missing MinIO objects → `_ensure_demo_files` stats each doc's `storage_key` and re-uploads from seed_data (id/key-preserving). Added after the 2026-08 MinIO-v2 migration silently lost ~106/108 stored files (chat worked, PDF pane didn't). Seed assets are immutable per slug — the stat→put TOCTOU is accepted on that invariant.
- Anonymous limits (v0.23.0): **5 msgs per (IP, document) per 24h** (matches marketing copy), session cap = 500 per doc counted over a **24h rolling window of anonymous sessions only**, 10 req/min/IP, forced DeepSeek V4 Flash. Nightly beat task prunes empty demo sessions >7d (anon AND authed).
- Free-plan authed users get a per-user session cap on demo docs (`FREE_MAX_SESSIONS_PER_DOC`, own sessions only) — closes the row-spam DoS on the anonymous cap.
- Logged-in users accessing demo docs use their credits with no message limit

## Testing
- **Integration tests NEVER touch the shared dev DB.** `tests/conftest.py` forces a scratch `doctalk_test` database (auto-provisioned + migrated) and hard-refuses non-loopback hosts unless `DOCTALK_TEST_DATABASE_URL` is explicitly set. Two dev-DB wipe incidents (2026-08-02: alembic downgrade-base; integration fixtures) led to this — do not weaken it back to setdefault/conditional form. Never run `alembic downgrade` against `doctalk`.
