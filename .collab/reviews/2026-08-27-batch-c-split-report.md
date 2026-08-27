# Batch C split report — C1/C2/C3 retained, C4 deferred

Date: 2026-08-27  
Branch/revision supplied: `fix/growth-batch-c` at `552bcb8`  
Reference base: `fix/growth-batch-a` at `9394801`  
Disposition: split implementation complete; Docker-backed verification blocked
by the Codex sandbox's localhost socket policy

## Outcome

C4 has been removed from this branch. C1, C2, and C3 remain intact. Anonymous
demo counting is back to the Batch A contract: `check_and_increment()` consumes
an attempt before streaming and failures are not released. A failed answer
therefore consumes one of the five demo questions, exactly as it did before C4.

The deferred design is recorded in
`.collab/plans/2026-08-27-demo-counter-release-batch.md`. It contains C4's goal,
the R1 double-release schedule, all four R2 orphan schedules, the R2 client
convergence failure, and an implementation-ready origin-bound reservation
state machine with pre-iteration ownership, shielded cleanup, pending leases,
and in-memory TTL behavior.

## Removed C4 work

Backend:

- Removed `_release_failed_demo_reservation` and all chat/continuation wiring.
- Removed `DemoMessageReservation`, reservation UUID/set storage, Redis release
  Lua, and in-memory release ownership.
- Restored `check_and_increment(key, limit) -> tuple[bool, int]` and the Batch A
  INCR/EXPIRE/fallback behavior.
- Restored continuation quota charging to its Batch A position before message
  and continuation-limit validation.
- Removed the C4 in-memory release test and all three C4 error-taxonomy tests,
  including
  `test_demo_release_is_effectively_once_when_cancelled_after_redis_applies`.

Frontend:

- Removed failed-bubble `retryPrompt`, Retry props/callbacks, and Retry button.
- Removed C4 parsing of `demo_messages_used` from SSE/HTTP errors.
- Removed the C4 empty-ID failure branch, attempt tracking, Stop reconciliation,
  and C4 error/count snapshot handling.
- Removed the six C4 accounting tests. The C1 anonymous Quote Finder auth-gate
  test remains in `frontend/tests/chat-stream-accounting.test.cjs`.

A source audit found no remaining `DemoMessageReservation`,
`_release_failed_demo_reservation`, `retryPrompt`, `onRetry`,
`activeAttemptRef`, `handleAttemptError`, `epochAtStop`, or C4 cancellation-test
symbols under backend/frontend source and tests.

## Mixed-file hunk audit

### `frontend/src/lib/sse.ts`

Kept for C1:

- `DonePayload.quote_finder_hint` and `.quote_finder_topic` at lines 23–31.
- Mapping of backend `done` payloads into those two fields at lines 133–141.

Removed for C4:

- `ErrorPayload.demo_messages_used` and its SSE/HTTP error parsing.

Restored completion semantics:

- Abort still returns quietly.
- EOF without backend `done`/terminal error again invokes `onTruncated()` and
  the pre-C4 synthesized `onDone({ message_id: '' })` at lines 162–165.
- No C4 accounting or release interpretation remains in this file.

### `frontend/src/lib/useChatStream.ts`

Kept for C1:

- `handleStreamDone` accepts `quote_finder_hint` and `quote_finder_topic` at
  lines 272–278.
- A real backend message ID installs `quoteFinderHint` and `quoteFinderTopic`
  on the assistant message at lines 285–292, which is what renders the manual
  Quote Finder chip.

Removed for C4:

- Empty `message_id` reclassification/re-anchor.
- `demo_messages_used` error metadata and direct server-count snapshots.
- `handleAttemptError`, Retry prompt propagation, `activeAttemptRef`,
  `runTrackedAttempt`, tracked Stop teardown, and Stop/EOF re-anchor call sites.

Important Batch A distinction: the older `reanchorDemoCounter` used only by
failed regenerate/continue already existed on the Batch A base and is required
by `.claude/rules/frontend.md`. It was restored exactly, including its
session/epoch guards and its pre-C4 call sites. Only C4's expanded helper shape
and new send/Stop/EOF call sites were removed. After the hunk-level reversal,
the complete `useChatStream.ts` content matches the Batch A blob while still
containing the pre-existing quote-hint mapping above.

## Batch A equality checks

Content comparison against the supplied Batch A tree showed exact equality for:

- `backend/app/api/chat.py`
- `backend/app/core/rate_limit.py`
- `backend/tests/test_demo_limits.py`
- `backend/tests/test_error_taxonomy.py`
- `frontend/src/components/Chat/ChatPanel.tsx`
- `frontend/src/lib/useChatStream.ts`

The remaining differences in `MessageBubble.tsx`, `sse.ts`, and
`frontend/src/types/index.ts` are C1-only Quote Finder hint comments/types; all
C4 executable behavior and C4-only types are gone.

## How C1 preservation was verified

The complete live path was checked at every boundary:

1. `action_planner.py`'s broad citation branch still returns
   `CITATION_LOOKUP` with `quote_finder_hint=True` and a bounded topic.
2. `chat_service.py` still emits both fields on the ordinary RAG `done` event.
3. `sse.ts` still parses both fields.
4. `useChatStream.ts` still maps them onto the assistant message.
5. `MessageBubble.tsx` still renders the click-only chip; no automatic search
   or submit was introduced.
6. `DocumentReaderPageClient.tsx` still sends anonymous readers to auth before
   private analytics or panel state.

Evidence:

- Focused action-planner and quote-routing/propagation tests: **87 passed**.
- Frontend unit suite: the retained anonymous auth-gate test passed.
- Frontend production type/build validation passed.

No C1 backend service file was reverted; in particular,
`backend/app/services/chat_service.py` was left untouched.

## Verification

Passed:

- `cd frontend && npm run build` — PASS; compiled/type-checked and generated
  425 static pages.
- `cd frontend && npm run test:unit` — PASS; **13 passed**.
- `cd backend && python3 -m ruff check app/ tests/` — PASS.
- `cd backend && SKIP_INTEGRATION=1 python3 -m pytest -q` — PASS;
  **894 passed, 51 skipped**.
- Focused C1 suite,
  `SKIP_INTEGRATION=1 python3 -m pytest tests/test_action_planner.py tests/test_quote_intent_routing.py -q`
  — PASS; **87 passed**.

Attempted exactly as requested but blocked before test bodies by the sandbox:

- `cd backend && SKIP_INTEGRATION= python3 -m pytest -q` — the autouse scratch
  database fixture could not connect to `::1:5432`; **942 setup errors,
  3 skipped**.
- `cd backend && SKIP_INTEGRATION= python3 -m pytest -m integration -q` — the
  same fixture/socket denial; **48 setup errors, 897 deselected**.

Both failures have the same root cause:

```text
sock.connect(('::1', 5432, 0, 0))
PermissionError: [Errno 1] Operation not permitted
```

This environment result is not claimed as a Docker/integration pass. The two
exact commands must be rerun in a shell allowed to reach the local PostgreSQL
container. No Git commands were used.
