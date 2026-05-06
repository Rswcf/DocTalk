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
- **`ChatRequest` exposes only `mode` field** (`quick`/`balanced`; legacy `thorough` is retired). `model` field removed — prevents billing bypass
- Stripe webhook: `checkout.session.completed` for subscriptions only updates plan (no credits); `invoice.payment_succeeded` grants monthly credits (idempotent by invoice.id)
- `POST /api/billing/cancel` is self-serve and records optional `cancel_reason`, `cancel_feedback`, and `refund_requested` metadata in `plan_transitions`. `refund_requested` is an internal review flag; do not issue Stripe refunds from this path unless an explicit refund workflow is added.

## Parse Worker
- `time_limit=600`, `soft_time_limit=540`, `autoretry_for=(Exception,)`, max 2 retries, 60s backoff
- Idempotent: deletes existing pages/chunks on re-run

## Auth
- **`FOR UPDATE` lock** on verification tokens to prevent TOCTOU
- Internal Auth Adapter API uses `X-Adapter-Secret` header

## Error Handling
- Use `HTTPException` (not `JSONResponse`) for all non-SSE endpoints
- Lifespan pattern (`@asynccontextmanager`) instead of deprecated `@app.on_event`

## Demo System
- 3 seed PDFs auto-deployed at startup from `backend/seed_data/`. Self-healing: detects Qdrant data loss → full re-seed
- Anonymous: 5 msgs/session, 500 sessions/doc, 10 req/min/IP, forced DeepSeek V4 Flash
- Logged-in users accessing demo docs use their credits with no message limit
