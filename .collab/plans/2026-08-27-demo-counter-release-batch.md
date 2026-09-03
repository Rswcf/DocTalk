> **SUPERSEDED 2026-09-03** — the accounting change specified below was **not built, by decision**
> (`.collab/plans/2026-09-03-backlog-decision.md` §3, Fable 5.1). Reserve-then-release was judged
> disproportionate and defer-to-done was rejected as a money-loss vector (an anonymous client that
> aborts before `done` would never be counted, leaving only the 10 req/min/IP limiter). Only §1's
> user-facing half ships, as Batch B item B3: expose the existing `regenerateLastResponse` path as a
> **Retry** control on error bubbles. A failed demo answer still consumes one of the five questions.
> Keep this file as the design record; do not implement it without a new ruling.

# Demo counter release — follow-up batch specification

Date: 2026-08-27  
Source batch: Batch C / C4  
Status: deferred from `fix/growth-batch-c`; implement as a separate batch  
Reference reviews: `.collab/dialogue/2026-08-27-batch-c-codex-r1.md` and
`.collab/dialogue/2026-08-27-batch-c-codex-r2.md`

## 1. Goal and current accepted behavior

C4 was intended to make an anonymous demo question consume one of the five
24-hour questions only when an answer succeeds. On an SSE error, raised
generator, disconnect, Stop, or terminal EOF without a backend `done`, the
server would release the request's reservation. The failed assistant bubble
would retain the original prompt and expose Retry.

That behavior is deferred. Until this follow-up lands, the accepted Batch A
contract remains in force: `check_and_increment()` consumes the demo question
before streaming and a failed answer still consumes it. This is a deliberate
return to status quo, not a claim that failure charging is desirable.

The follow-up must preserve all existing limits:

- five anonymous messages per `(IP, document)` per 24-hour bucket;
- an atomic reservation before expensive work, so at most five concurrent
  accepted attempts can exist;
- the existing request-rate and session-rate limits;
- the frontend counter equation and its session/epoch stale-write guards; and
- authenticated chat/credits, Quote Finder routing, and C1/C2/C3 behavior.

## 2. Why the first C4 design was not shippable

### 2.1 R1: cancellation could release two slots

The first wrapper kept an `active_key`, released it on an explicit SSE error,
then set `active_key = None`; its `finally` also released any still-active key.
The vulnerable ordering was:

1. Five requests hold the five shared reservations.
2. One request enters `remaining = await release(active_key)`.
3. Redis applies the decrement, taking the count from five to four.
4. The task is cancelled before the await receives Redis's reply, so
   `active_key = None` never executes.
5. `finally` calls `release(active_key)` again and decrements from four to
   three, stealing a different live request's slot.

One failed request could therefore admit two replacements while four other
requests were still live. Tokenizing the reservation made repeated release
against one known token at-most-once within one store, but it did not solve
durable ownership or at-least-once cleanup.

### 2.2 R2: complete orphan enumeration

The tokenized revision still had all four orphan schedules below.

#### Schedule 1 — reserve applied, caller cancelled before receiving the token

The token was created inside `check_and_increment()`. Redis could atomically
apply `SADD + INCR`, after which cancellation could escape the await before the
endpoint received the returned `DemoMessageReservation`. No caller or wrapper
then knew the token. The count and token remained held until the 24-hour Redis
TTL.

#### Schedule 2 — ambiguous Redis reserve created a second fallback reservation

Every ordinary Redis `EVAL` exception was treated as proof that the script had
not applied. If Redis committed but its reply was lost, the code immediately
reserved again in the in-memory fallback and returned that second token. The
request therefore occupied one Redis slot and one memory slot. Cleanup could
release only the returned memory token; the Redis reservation was orphaned.

#### Schedule 3 — reserve and release selected different stores

`DemoMessageReservation` carried only `key + token`, with no storage origin.

- Redis reserve followed by an outage caused release to look only in memory,
  where the token did not exist.
- Memory reserve followed by Redis recovery caused release to issue `SREM` in
  Redis, leaving the memory token/count present.
- The in-memory tracker had no 24-hour per-key expiry, so a shadow reservation
  survived for the process lifetime and could reappear as a hard lock during a
  later fallback.
- An ambiguous Redis release exception also fell back to memory. If the Redis
  release had not applied, the real Redis reservation stayed held.

#### Schedule 4 — cleanup ownership began too late and was not durable

The release awaits were unshielded, so cancellation could prevent cleanup from
reaching Redis. More fundamentally, the endpoint reserved the slot but the
wrapper did not take ownership until response-body iteration began. Teardown
before iteration, process death, or a disconnect in that gap left no live owner
that could release the token. Redis preserved the orphan for 24 hours; a
process restart instead erased memory reservations and weakened the cap in the
opposite direction.

### 2.3 R2 client convergence failure

The Stop/EOF re-anchor used session and epoch guards correctly for stale-write
safety, but a later successful send could invalidate the only correction:

1. Server and client start at three. Send A moves both to four.
2. Stop aborts A; the server eventually releases back to three and the client
   launches a fire-and-forget snapshot.
3. Before that snapshot resolves, Send B is allowed and advances the epoch.
4. A's snapshot returns three and is correctly dropped as stale. B succeeds
   and performs no replacement snapshot.
5. Server truth is four, while the transcript formula renders five and locks
   the user out one question early.

A browser-side fetch/reader abort also does not acknowledge completion of the
backend generator's cleanup. A snapshot can read the pre-release count and
install it immediately before the backend releases, with no later correction.
The follow-up therefore needs a server-acknowledged, attempt-scoped terminal
outcome; another uncoordinated GET is insufficient.

## 3. Required invariants

1. A reserve attempt has one stable token generated before any storage I/O.
2. A token belongs to exactly one storage origin: `redis` or `memory`.
3. After any Redis write may have been attempted, an unknown result is resolved
   or retried in Redis with the same token. It never falls through to memory.
4. `pending -> committed` and `pending -> released` are mutually exclusive,
   atomic state transitions. Retrying either operation may execute more than
   once, but its counter effect occurs at most once.
5. A live pending reservation participates in the five-slot admission count.
6. `committed` retains the consumed count; `released` decrements it exactly
   once. Expired pending leases are equivalent to release.
7. Cleanup ownership exists before response-body iteration can begin.
8. Caller cancellation cannot cancel the underlying release operation.
9. Redis-owned reservations are never cleaned up in memory, and memory-owned
   reservations are never cleaned up in Redis.
10. Both Redis and memory paths expire the 24-hour bucket and the shorter
    pending lease. Capacity pressure must not clear live counters.
11. The client cannot start a newer accounting mutation while the prior demo
    attempt has an unknown terminal state.

## 4. Reservation model and store interface

Use an explicit state and origin rather than a bare key/token pair:

```python
DemoReservationOrigin = Literal["redis", "memory"]
DemoReservationState = Literal["pending", "committed", "released"]

@dataclass(frozen=True)
class DemoMessageReservation:
    key: str
    token: str
    attempt_id: str
    origin: DemoReservationOrigin
    bucket_expires_at_ms: int
    lease_expires_at_ms: int
```

`attempt_id` is generated by the browser for reconciliation; `token` is a
server-generated unguessable ownership value. Both are created before reserve
I/O and remain stable across retries.

The store contract should be origin-bound:

```python
async def reserve(key, limit, attempt_id, token) -> ReserveResult: ...
async def renew(reservation) -> ReservationSnapshot: ...
async def commit(reservation, message_id) -> ReservationSnapshot: ...
async def release(reservation, reason) -> ReservationSnapshot: ...
async def resolve(reservation) -> ReservationSnapshot: ...
async def resolve_attempt(key, attempt_id) -> ReservationSnapshot: ...
```

`ReservationSnapshot` includes state and the authoritative bucket count. All
methods dispatch from `reservation.origin`; they must not dynamically choose a
store from current Redis health.

Fallback is permitted only when Redis is known unavailable before a reserve
mutation is attempted. Once `EVAL`/transaction dispatch occurs, an exception
is ambiguous: retry or resolve the same Redis token. If Redis cannot be
resolved within the endpoint's bounded admission window, return a retryable
503 and leave the pending token to its short lease/reaper. Do not create a
memory reservation for that attempt.

## 5. Redis state machine

Keep the bucket count, attempt state, and pending-lease index under one Redis
hash tag derived from the `(IP, document)` key so Lua transitions remain
atomic. A concrete shape is:

- `{bucket}:count` — admitted pending + committed count, with the existing
  24-hour bucket expiry;
- `{bucket}:pending` — sorted set of `token -> lease_deadline_ms`;
- `{bucket}:attempt:{attempt_id}` — token, state, message ID, and terminal
  metadata, with a TTL aligned to the bucket/client reconciliation window.

Every Lua operation first reaps expired pending members for that bucket and
decrements the count once per still-pending attempt. A periodic sweeper handles
idle buckets; reserve/renew/commit/release/resolve also sweep synchronously so
correctness does not depend on the periodic job running on time.

State transitions:

| Operation | Pending | Committed | Released / expired |
|---|---|---|---|
| `reserve` same attempt/token | return existing reservation, no increment | return terminal snapshot | return terminal snapshot |
| `renew` | extend pending lease | no-op terminal snapshot | no-op terminal snapshot |
| `commit` | remove pending lease, mark committed, keep count | idempotent no-op | conflict/no-op; never increment |
| `release` | remove pending lease, mark released, decrement once | no-op; successful answer remains consumed | idempotent no-op |

The reserve script checks the limit and records `pending + INCR` in one atomic
transition. A lost reserve reply is resolved by the same token/attempt record.
The release script's state compare-and-set owns the decrement, so both R1's
double-call schedule and ambiguous-release retries have one effective release.

Use a configurable short pending lease (for example 120 seconds) plus renewal
while a legitimate stream is active. The lease must exceed the frontend
proxy's maximum stream duration with cleanup margin, or be renewed well before
expiry. Process death stops renewal; the next synchronous sweep or periodic
reaper returns the slot without waiting 24 hours.

## 6. In-memory implementation

The memory store mirrors the same states and origin under a per-key async lock:

```text
Bucket(count, bucket_expires_at, attempts, pending_deadlines)
```

Before every operation, purge the bucket if its 24-hour expiry passed, then
transition each expired pending attempt to released and decrement once. Run a
small periodic sweep as well. Use a monotonic clock for deadlines.

When the store reaches its key cap, evict expired buckets only. If all entries
are live, reject new fallback admission with a retryable service error; never
clear live counts, because that silently admits more than five requests.
Memory reservations retain `origin="memory"` even if Redis recovers before
commit/release.

## 7. Ownership before body iteration and shielded cleanup

Immediately after `reserve()` returns, create and start a
`DemoReservationOwner` before constructing/returning `StreamingResponse`.
Starting the owner must:

- register a strong reference to its task in a process-level cleanup registry;
- begin a short body-start grace timer;
- renew the pending lease while the body is active; and
- release if body iteration never starts within the grace period.

The stream adapter reports `body_started`, explicit `done`, explicit `error`,
raised generator, and cancellation to this already-running owner. It does not
become the first owner merely by entering `async for`.

On `done`, await an idempotent `commit()` before exposing the terminal success
event. On explicit error, await release before exposing the terminal error and
include the terminal attempt state/count. On raised generator, disconnect, or
cancellation, schedule release once.

Cleanup must use a separately created task plus `asyncio.shield()`. If the
request task is cancelled while awaiting it, the cleanup task remains in the
strong-reference registry and retries the same origin/token with bounded
backoff. Redis outage never redirects cleanup to memory. If the process dies,
the pending lease/reaper is the surviving recovery owner.

## 8. Attempt-scoped frontend reconciliation

Add a client-generated `demo_attempt_id` to chat and continuation requests.
Expose a read-only attempt-status endpoint scoped through the existing session,
demo-document, and derived client-IP checks. It returns:

```json
{
  "attempt_id": "...",
  "state": "pending | committed | released",
  "demo_messages_used": 4,
  "message_id": "... or null"
}
```

Explicit `done`/`error` events carry the same attempt ID and terminal state.
For Stop, abort, or EOF without a terminal backend event, the UI marks that
attempt `reconciling` and polls/resolves its status. It must not enable Send,
Regenerate, Continue, or Retry until the attempt is `committed` or `released`.
This ordering prevents the R2 Stop-A -> Send-B lost-correction schedule.

When terminal state arrives, apply the authoritative count only if session ID,
attempt ID, and accounting epoch still match. Re-anchor the transcript
baseline in the same atomic store action. `released` marks the bubble failed
and enables Retry with the original prompt; `committed` follows success
semantics and uses the returned `message_id`, including the case where the
transport lost the final `done` event. Do not classify synthetic EOF as either
success or failure until the server attempt state is known.

## 9. Required tests

Backend tests must include:

1. R1 cancellation after release applies but before its reply: two calls, one
   state transition, count `5 -> 4`.
2. Redis reserve applies and its reply is lost: resolve the same Redis token;
   no memory reservation and one counted slot.
3. Redis reserve does not apply and its reply is lost: retry the same token and
   create at most one slot.
4. Redis reserve -> outage -> release: release remains Redis-owned and
   completes after recovery; memory is untouched.
5. Memory reserve -> Redis recovery -> release: release remains memory-owned.
6. Ambiguous Redis release in both halves (applied and not applied): retry the
   same token and converge to one decrement.
7. Cancellation before the endpoint receives a reserve reply.
8. Response body never iterated, cancellation during body iteration, and
   process-death/lease-expiry simulations.
9. In-memory 24-hour bucket expiry and short pending-lease expiry.
10. Five concurrent reservations admit no sixth; released pending work admits
    exactly one replacement; committed work does not.
11. Done/commit, error/release, raised generator, and continuation equivalents.

Frontend tests must include:

1. explicit error -> released count -> Retry enabled with original prompt;
2. initial Send -> Stop and clean EOF wait for terminal attempt state;
3. Stop/EOF -> immediate Send is gated until reconciliation, then server and
   client counts converge after the next successful send;
4. regenerate and continue versions of the same schedules;
5. committed outcome after a lost `done` uses the server message ID and does
   not present a false retry;
6. stale session, attempt, and epoch responses are dropped; and
7. authenticated/non-demo completion behavior is unchanged.

Run the full project gates from `AGENTS.md`, including both backend suites and
the frontend production build/unit suite. Because this is counter integrity
and cancellation-sensitive logic, require adversarial review before merge.

## 10. Observability and rollout

Emit structured metrics/logs for reserve origin, ambiguous reserve, release
retry, lease expiry, body-never-started, terminal transition conflict, and
client reconciliation latency. Alert on pending lease expiries and any attempt
whose origin-specific operation tries to cross stores. Roll out behind a
server flag first; confirm that `(reserved - committed - released - pending)`
remains zero and that client/server demo counts converge before enabling the
failed-bubble Retry UI broadly.
