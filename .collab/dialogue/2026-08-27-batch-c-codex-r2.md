# Batch C adversarial review — Codex R2

Revision under review: `552bcb8` (`fix/growth-batch-c`)  
Review date: 2026-08-27  
Verdict: **BLOCK**

The request-owned token closes R1's demonstrated double-decrement schedule,
and the anonymous Quote Finder gate is closed. The batch is still not safe to
ship: the token is only an idempotency key, not a durable at-least-once release
mechanism, and the new re-anchor can be correctly rejected as stale without any
newer operation ever correcting the aborted transcript delta. Both failures
hold a demo slot that the user should have back, which breaks the five-message
cap in the user-hostile direction and meets the supplied BLOCK bar.

## 1. BLOCKER — tokenized release is idempotent within one store, but reservations can still be orphaned

The narrow R1 failure is genuinely fixed. Given a reservation that was
successfully returned to the wrapper and a release that reaches the same
storage backend, both implementations are request-owned and idempotent:

- in memory, membership is removed before decrement and a repeated token is a
  no-op (`backend/app/core/rate_limit.py:126-142`);
- in Redis, `SREM` owns the decrement and a repeated token only reads the
  current count (`rate_limit.py:308-349`); and
- the healthy Redis reservation remains one atomic `SADD + INCR` script, so
  concurrent requests still cannot all pass the five-slot check
  (`rate_limit.py:248-303`).

That proves **at most one** effective release. It does not prove **at least one**
release. There are several current orphan schedules:

1. **Cancellation after reserve applies but before its reply is received.**
   The token is generated inside `check_and_increment()` and is not returned to
   `chat_stream()` until the awaited `EVAL` returns (`rate_limit.py:265,291-303`;
   `backend/app/api/chat.py:470-472`). If Redis applies `SADD + INCR` and the
   task is then cancelled, `CancelledError` escapes the `except Exception`, the
   endpoint never receives the token, and nothing can release it. It remains
   counted until the 24-hour TTL.

2. **An ambiguous Redis exception creates a second reservation in another
   store.** `check_and_increment()` treats every ordinary `EVAL` exception as
   proof that Redis did not apply and immediately calls the in-memory fallback
   (`rate_limit.py:304-306`). A lost reply after Redis commits therefore leaves
   the Redis token/count active and returns a different fallback token/count to
   the request. The wrapper can release only the returned fallback token; one
   request has consumed two slots across the two stores, one of which is
   orphaned.

3. **Reserve and release dynamically choose different stores.**
   `DemoMessageReservation` carries only `key + token`, not its storage origin
   (`rate_limit.py:34-40`). A Redis reservation followed by an outage releases
   against the fallback, where its token does not exist
   (`rate_limit.py:317-319`). Conversely, a fallback reservation followed by
   Redis recovery performs an `SREM` miss in Redis and leaves the fallback
   token/count present. The in-memory tracker has no per-key 24-hour expiry at
   all (`rate_limit.py:96-142`), so that shadow reservation survives for the
   process lifetime and can reappear as a hard lock on a later fallback.
   `release()` also treats an ambiguous Redis release exception as a reason to
   release only in fallback (`rate_limit.py:339-349`); if the Redis script did
   not apply, the real reservation remains held.

4. **The wrapper is not durable cleanup.** Both release awaits are unshielded
   (`backend/app/api/chat.py:83,93-95`), so cancellation can also prevent a
   release from reaching Redis. More fundamentally, the reservation is made in
   the endpoint but the wrapper does not take ownership until the response body
   begins iteration (`chat.py:470-472,514-520` and `643-644,657-662`). A process
   death, or teardown before body iteration, retains the Redis reservation with
   no recovery owner. Across a process restart the Redis set preserves token
   idempotency, but no surviving code knows that token, so it leaks until the
   full demo TTL. The in-memory path instead forgets both count and ownership on
   restart and weakens the cap in the opposite direction.

I reproduced the first three storage problems with one-off probes against the
actual tracker classes:

```text
{'redis_count_after_caller_lost_token': 1,
 'orphan_token_count': 1,
 'fallback_count': 0}

{'cross_path_release_returned': 4,
 'fallback_count_still_held': 1}

{'allowed': True,
 'returned_count': 1,
 'redis_reservations_applied': 1,
 'fallback_count': 1,
 'returned_token_is_only_fallback_owned': True}
```

The new committed test covers only the favorable ambiguous-release half: Redis
applied the first release and the retry reaches the same logical token. There
are no tests of the actual `RedisDemoTracker`, cancellation during reservation,
"release did not apply," store transitions, or process loss.

Required direction: make a reservation's storage ownership durable and make
unknown Redis outcomes resolvable rather than falling through to a second
store. A robust shape is an atomic pending-token lease with a short in-flight
expiry and an explicit atomic commit-on-`done` versus release-on-failure;
shield/retry cleanup, preserve the token across an ambiguous reserve result,
and never release a Redis-owned token only in memory. The important invariant is
that crash recovery can distinguish pending work from a consumed 24-hour demo
message; merely adding more duplicate `release()` calls cannot establish it.

## 2. BLOCKER — the epoch guard drops stale re-anchors safely, but can also drop the only correction

The two new call sites are guarded as claimed:

- Stop captures the current epoch and passes it explicitly after the tracked
  client attempt unwinds (`frontend/src/lib/useChatStream.ts:521-536`); and
- synthesized clean EOF calls `reanchorDemoCounter(sessionId)`, which captures
  the current epoch synchronously (`useChatStream.ts:283-291,158-168`).

`applyDemoCounterSnapshot()` checks both `sessionId` and epoch before writing
(`useChatStream.ts:131-142`). Thus an aborted attempt's late GET cannot directly
overwrite a subsequent send's newer accounting state. That part is closed.

The convergence invariant is not. A realistic schedule starting from three
used messages is:

1. Send A appends a local user message and advances the epoch. Client/server
   counts are both four while it is reserved.
2. Stop aborts A. The server eventually releases back to three. The UI sets
   `isStreaming=false` immediately and launches a fire-and-forget GET after the
   *client* attempt unwinds.
3. Before that GET resolves, Send B is allowed because the UI currently shows
   four of five. B appends another user message and advances the epoch again.
4. A's GET returns three and is correctly dropped as stale. B succeeds, so its
   normal `done` path performs no re-anchor.
5. Server truth is four (A released, B retained), but the frontend formula is
   `3 + (5 transcript user messages - baseline 3) = 5`. The user is hard-locked
   one question early.

I ran that schedule through the committed hook harness. The adversarial
assertion passed with `demoMessagesUsed=3`, baseline `3`, rendered
`messagesUsed=5`, and `demoLimitReached=true` while the modeled server count was
four. The same loss occurs for clean EOF followed by a successful send, and for
an aborted optimistic regenerate/continue followed by a successful replacement.
The committed "late clean-EOF re-anchor is dropped by the epoch guard" test
proves stale-write safety but stops before checking eventual convergence; it
therefore captures only half of the counter contract.

There is a second ordering gap even when no newer send occurs. A browser abort
unwinding `chatStream()` proves only that the downstream fetch/reader stopped;
it does not acknowledge that the backend generator's `finally` has completed.
Likewise, a proxy-generated downstream EOF does not order the backend's upstream
disconnect cleanup before the browser's GET. The comment claiming that the
backend has released "before the response closes" (`useChatStream.ts:283-286`)
is true for an orderly backend EOF, but not for the timeout/proxy case this
branch was added to handle. The GET can therefore snapshot five and install it
just before the backend releases to four, with no later correction.

Stop does not normally launch two same-attempt writers now; the abort catch is
suppressed, and Stop owns that re-anchor. If a subsequent attempt also fails,
there can be two GETs, but its epoch advances and the newer writer wins. The
blocking case is the opposite: a subsequent **successful** attempt invalidates
the old writer and creates no replacement writer.

Required direction: do not re-enable demo input while the only reconciliation
is unresolved, and do not equate client fetch unwind with server release. The
client either needs a server-acknowledged terminal outcome/count for the attempt
or attempt-scoped accounting that a later mutation can merge instead of merely
invalidating. Whichever shape is chosen, add Stop/EOF -> immediate successful
send and regenerate/continue equivalents, asserting eventual server/client
equality rather than only asserting that a stale response was dropped.

## 3. R1 finding 3 is closed

`handleTryQuoteFinder()` now checks `isLoggedIn`, opens auth, and returns before
private analytics or panel state for anonymous readers
(`frontend/src/app/d/[documentId]/DocumentReaderPageClient.tsx:407-415`).
Authenticated behavior is unchanged. The chip still only opens/prefills the
panel, and the billed search still requires a separate form submit. I found no
paid-feature leak and no billed search fired without a click.

## 4. Completion-semantics widening

I found no additional blocker in treating the synthetic empty-ID terminal as
truncation:

- `_processSSEStream()` synthesizes the empty ID only after EOF without a
  backend `done` or terminal error (`frontend/src/lib/sse.ts:170-173`). All
  normal chat, verified-quote, and continuation `done` producers inspected in
  `chat_service.py` emit a real persisted message ID.
- The new branch applies to authenticated/non-demo users too, but it does not
  change backend persistence or billing. It conservatively skips session
  activity, credit refresh, `chat_message_completed`, and installation of a
  fabricated empty share anchor (`useChatStream.ts:283-306`). A persisted
  answer whose final `done` was lost will lack its client share anchor until a
  restore, and the displayed credit balance can remain stale, but the prior
  behavior falsely classified that transport outcome as success; this is not a
  new money or feature-gating failure.
- The assistant is marked truncated, so regenerate remains available and
  continue follows the existing backend-ID/latest-assistant fallback. No Quote
  Finder submit is introduced. `onTruncated` is invoked once by the SSE parser
  and again by the empty-ID branch, but the mutation is idempotent.

These semantics do not rescue the demo accounting races in findings 1 and 2.

## 5. Verification

Claude's supplied gates were accepted as evidence: ruff clean; 946 passed / 3
skipped non-integration tests; 48 integration tests passed; frontend build
passed; 19 frontend unit tests passed.

I additionally ran the seven committed chat-accounting tests plus the one-off
Stop -> immediate successful send probe described above: **8 passed** (the
eighth passes by reproducing the erroneous hard-lock state). I ran the three
tracker probes quoted in finding 1 against the actual `RedisDemoTracker` and
`InMemoryDemoMessageTracker` classes. I used no Git commands.

## 6. Verdict

**BLOCK.** R1 finding 1 is closed only for duplicate release against a known
token in one store; at-least-once cleanup and cross-store ownership remain
broken. R1 finding 2's stale-overwrite defense works, but a newer successful
attempt can invalidate the only correction and leave the client one slot ahead
of the server. R1 finding 3 is closed, and I found no new billed-search or paid
feature leak.
