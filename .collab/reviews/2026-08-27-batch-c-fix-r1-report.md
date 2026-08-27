# Batch C accepted-findings fix report — R1

Date: 2026-08-27  
Starting revision supplied by reviewer: `468b63d` on `fix/growth-batch-c`  
Scope: close F1, F2, and F3 from `.collab/dialogue/2026-08-27-batch-c-codex-r1.md`  
Disposition: implementation complete; integration execution unavailable in this sandbox (details below)

## F1 — token-owned, idempotent reservation release

Implemented the preferred reservation-ID design rather than the release-task fallback.

- Added `DemoMessageReservation(key, token)` and made every accepted anonymous demo attempt return its own server-generated UUID token.
- The Redis reservation Lua script now atomically adds that token and increments the shared `(IP, document)` counter. The reservation-set TTL mirrors the counter TTL, including sub-second expiry via `PTTL`/`PEXPIRE`.
- Release uses `SREM` as the ownership test. It decrements only when that exact token was present; a retry of the same token returns the current count without touching another request's reservation.
- The in-memory fallback implements the same token-owned semantics.
- Both chat and continuation wrappers carry the returned reservation object through teardown.

The cancellation regression test reproduces the review probe's schedule: the first release applies its effective decrement, cancellation prevents receipt of that reply, and `finally` retries the same token. The observed/asserted terminal state is two release calls, exactly one effective release, and count `5 -> 4` (never `5 -> 3`). A separate in-memory test proves a duplicate release cannot steal one of four other live reservations.

Relevant files:

- `backend/app/core/rate_limit.py`
- `backend/app/api/chat.py`
- `backend/tests/test_demo_limits.py`
- `backend/tests/test_error_taxonomy.py`

## F2 — Stop and clean EOF converge to server accounting

- `useChatStream` now tracks the active attempt promise in a ref. Stop aborts immediately for UI responsiveness, captures the Stop-time `demoAccountingEpoch`, and starts its server re-anchor after the aborted client stream has unwound.
- A pre-header abort rejection no longer launches the generic error-path GET. That leaves Stop as the single reconciliation writer and prevents two same-epoch GETs from resolving out of order.
- The Stop re-anchor still writes only when both `sessionId` and the captured epoch match. A newer send/session/document mutation causes the late result to be dropped.
- An empty `message_id` terminal is now a dedicated truncation/failure branch. It marks the assistant message truncated, clears streaming state, and re-anchors. It does not update session activity, refresh credits, emit `chat_message_completed`, or install successful-message metadata.
- Counter resets remain exclusively in `useChatSession`'s documentId-keyed effect; no reset path was added here.

New frontend behavior tests cover:

1. initial Send -> Stop: server count `0`, live baseline `1`, rendered client usage `0`;
2. pre-header abort rejection: exactly one Stop-owned re-anchor;
3. regenerate -> Stop: optimistic `2` converges to server/client `1`;
4. clean EOF: truncated, no success side effects, server/client count `0`;
5. late clean-EOF snapshots dropped independently by the session and epoch guards.

Relevant files:

- `frontend/src/lib/useChatStream.ts`
- `frontend/tests/chat-stream-accounting.test.cjs`

## F3 — anonymous hint follows the toolbar auth gate

`handleTryQuoteFinder` now checks `isLoggedIn` before private analytics or panel state. Anonymous demo readers get `openAuthModal()` and return; authenticated readers retain the chip analytics, topic prefill, and panel open behavior. The backend 401 boundary is unchanged.

Relevant files:

- `frontend/src/app/d/[documentId]/DocumentReaderPageClient.tsx`
- `frontend/tests/chat-stream-accounting.test.cjs`

## Verification

Passed:

- `cd frontend && npm run build` — PASS; production compilation, lint/type validation, and 425 static pages completed.
- `cd frontend && npm run test:unit` — PASS; 19 passed.
- `cd backend && python3 -m ruff check app/ tests/` — PASS.
- Focused backend demo/error suite — PASS; 77 passed.
- Full non-integration backend fallback run, `SKIP_INTEGRATION=1 python3 -m pytest -q` — PASS; 898 passed, 51 skipped.

Could not execute against Docker from this Codex sandbox:

- `cd backend && SKIP_INTEGRATION= python3 -m pytest -q`
- `cd backend && SKIP_INTEGRATION= python3 -m pytest -m integration -q`

Both exact commands reached the autouse scratch-database fixture, but the sandbox denied the loopback PostgreSQL socket before any integration test body ran:

```text
sock.connect(('::1', 5432, 0, 0))
PermissionError: [Errno 1] Operation not permitted
```

The isolated integration invocation collected the expected 48 cases, deselected 901 non-integration cases, and reported 48 setup errors from that single denied socket. This is not claimed as an integration pass; Claude must rerun the Docker-backed gates outside this restricted sandbox.

No locale keys were added or changed. No Git commands were run.
