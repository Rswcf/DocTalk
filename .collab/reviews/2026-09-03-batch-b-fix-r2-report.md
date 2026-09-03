# Batch B — fix round 2 report

Date: 2026-09-03  
Branch supplied by requester: `fix/growth-batch-b` at `1296f22`  
Input review: `.collab/dialogue/2026-09-03-batch-b-codex-r2.md`

## Verdict

Findings 1, 3, and 4 were valid and are fixed. Finding 2 was deliberately left untouched because its reparse/delete lock order is a cross-subsystem architecture decision reserved for the planning authority. No lock acquisition or ordering was changed in `backend/app/api/documents.py`, `backend/app/services/doc_service.py`, `backend/app/services/predebited_job_service.py`, or `backend/app/services/extraction_service.py`.

The demo-counter contract is unchanged. No counter mutation was added, removed, or moved to a different lifecycle point. No migration, i18n key, or UI styling change was introduced.

## F1 [BLOCK] — Retry then Send escaped single-flight

### Change

- `frontend/src/lib/useChatStream.ts:72-73` replaces the narrower Regenerate/Continue latch name with one hook-owned `chatOperationLatchRef` shared by all three billable chat entry points.
- `frontend/src/lib/useChatStream.ts:360-407` makes `sendMessage` acquire that same latch and read live `useDocTalkStore.getState().isStreaming` before the demo-limit action, transcript append, existing demo-accounting epoch bump, streaming mutation, or request. It preserves the existing `false` return for blank, busy, or demo-limited sends and releases in `finally`.
- `frontend/src/lib/useChatStream.ts:433-470` and `:472-525` keep Regenerate and Continue on the same latch and live busy predicate.
- The existing Send accounting mutation remains at `frontend/src/lib/useChatStream.ts:398`; the existing Regenerate/Continue mutation helper remains at `:424-431`, with its calls still after successful admission at `:458` and `:486`.

### Why this closes the sequence

Retry acquires the shared ref synchronously before trimming the transcript, mutating demo usage, or setting the Zustand streaming flag. A Send callback from that same rendered UI then observes the already-owned latch even though its React closure predates the streaming update, returns `false`, and cannot append a second turn or open a second request. The reverse ordering and all Regenerate/Continue combinations are covered by the same gate and live busy read.

### Regression

`frontend/tests/batch-b.test.cjs:295-327` loads one rendered hook instance, starts Retry against a deferred request, and invokes Send from the same hook result without a re-render. It asserts Send returns `false`, only one request starts, and only one Regenerate accounting write/epoch bump occurs.

## F3 [NOTE] — rejected transport stranded streaming and Retry provenance

### Change

- `frontend/src/lib/useChatStream.ts:316-358` selects the normal or caller-overridden error callback once, wraps it in a once-only reporter, and routes a non-abort rejected `chatStream` promise through that reporter. The handled rejection is swallowed. An aborted controller or Abort-like rejection remains silent.
- `frontend/src/lib/useChatStream.ts:461-466` leaves Regenerate's caller-selected callback responsible for the existing one-time demo re-anchor followed by `handleStreamError`; the obsolete catch/rethrow path is removed, so transport, HTTP, and SSE failures share one route.
- `frontend/src/lib/useChatStream.ts:492-521` gives Continue the same once-only callback/catch structure. Its non-abort transport rejection performs exactly one existing re-anchor and one shared cleanup/error render.
- `handleStreamError` remains the single cleanup/provenance owner: it flushes pending text, clears `isStreaming`/the abort ref, ignores abort bubbles, and assigns `retryAction: 'regenerate'` only for generic chat-response failures.

### Why this closes the sequence

A rejection before an HTTP response or SSE frame can no longer escape the hook. Send routes it to `handleStreamError`; Regenerate and Continue route it to their existing re-anchor-then-`handleStreamError` callback. The once-only flag prevents a callback-plus-rejection edge case from duplicating cleanup, an error bubble, or the re-anchor. Consequently the streaming flag is cleared and the one rendered failure bubble carries Retry provenance, while Stop/Abort still creates no failure bubble.

### Regression

`frontend/tests/batch-b.test.cjs:329-365` rejects the stream promise for Send and Regenerate independently. For each operation it asserts one request, `isStreaming === false`, and exactly one assistant error with `retryAction === 'regenerate'`; Regenerate additionally asserts exactly one re-anchor request. `frontend/tests/batch-b.test.cjs:367-393` aborts an active Send and proves the rejected transport remains silent while streaming still clears.

## F4 [NOTE] — stale same-document poll could erase `ready`

### Change

- `frontend/src/lib/latestRequest.ts:1-31` adds a small request-ticket helper: starting a request advances a monotonic ordinal and records it on the current scope; applying a result requires both scope identity and the latest started ordinal.
- `frontend/src/lib/useDocumentBrief.ts:20-78` retains the existing per-document object-identity guard and adds the request ordinal to every success/error result. Both resolution and application reject a ticket superseded by a later request for the same document.
- `frontend/src/lib/useDocumentBrief.ts:33-46` adds a synchronous poll-attempt ref reset with each document scope.
- `frontend/src/lib/useDocumentBrief.ts:107-119` increments the bounded count only immediately before `refresh()` starts a real poll for the still-current document. The ref enforces the 20-request `empty` cap even before React commits the corresponding state render.

### Why this closes the sequence

Poll 19 and poll 20 retain the same document scope but receive distinct ordinals. When poll 20 starts it becomes the sole current ticket. Its `ready` result can apply; poll 19's later `empty` result fails the ordinal check at resolution and cannot reach `setBrief`. The original scope-identity protection still rejects document-switch and A-to-B-to-A stale responses.

### Regression

`frontend/tests/batch-b.test.cjs:407-475` mounts the actual hook in a deterministic hook/timer harness, resolves the initial brief as `empty`, starts exactly 20 overlapping polls, resolves poll 20 as `ready`, then resolves poll 19 and the older polls as `empty`. It asserts the rendered brief remains `ready` and that the interval stops at exactly 20 started polls.

## Finding 2 [BLOCK] — explicitly not changed

The reparse/delete lock-order finding was not implemented in this round, as directed. Its resolution can affect the Document lock, User lock, advisory-lock settlement, and fresh-session resolver across four backend files. Changing any one acquisition edge here would pre-empt the pending planning-authority ruling and risk colliding with the eventual cross-subsystem design. All four named backend files' locking behavior is therefore unchanged.

## Required gate output

### Backend full test suite

Command:

```text
cd /Users/mayijie/Projects/Code/010_DocTalk/backend && /usr/bin/python3 -m pytest -q
```

Terminal summary (exit 0):

```text
....................................ss.................................. [  7%]
........................................................................ [ 15%]
............................s........................................... [ 22%]
...........................................................s......ssssss [ 30%]
ssss.................................................................... [ 37%]
........................s.s...............s.......ssss.................. [ 45%]
..............................s......................................... [ 52%]
.........................sss..........................ssssss............ [ 60%]
......................................ssssssssssss...................... [ 67%]
........................................................................ [ 75%]
........................................................................ [ 82%]
.......................................................ssssss........... [ 90%]
....................s................................................... [ 98%]
..............ss...                                                      [100%]
903 passed, 52 skipped, 15 warnings in 4.52s
sys:1: DeprecationWarning: builtin type swigvarlink has no __module__ attribute
```

The 15 warnings are existing FastAPI/Pydantic, urllib3/LibreSSL, and SWIG deprecation warnings.

### Backend Ruff

Command:

```text
cd /Users/mayijie/Projects/Code/010_DocTalk/backend && python3.12 -m ruff check app/ tests/
```

Exact output (exit 0):

```text
All checks passed!
```

### Frontend production build

Command:

```text
cd /Users/mayijie/Projects/Code/010_DocTalk/frontend && npm run build
```

Terminal milestones (exit 0; the route-size table completed normally):

```text
> doctalk-frontend@0.28.1 build
> next build

  ▲ Next.js 14.2.35
  - Environments: .env.local
  - Experiments (use with caution):
    · instrumentationHook

   Creating an optimized production build ...
 ✓ Compiled successfully
   Linting and checking validity of types ...
   Collecting page data ...
RESEND_API_KEY not set — email magic link provider disabled
 ⚠ Using edge runtime on a page currently disables static generation for that page
 ✓ Generating static pages (425/425)
   Finalizing page optimization ...
   Collecting build traces ...

○  (Static)   prerendered as static content
●  (SSG)      prerendered as static HTML (uses getStaticProps)
ƒ  (Dynamic)  server-rendered on demand
```

The build also emitted the existing Sentry `sentry.client.config.ts` deprecation warning.

### Frontend unit suite

Command:

```text
cd /Users/mayijie/Projects/Code/010_DocTalk/frontend && npm run test:unit
```

New regression subtests and exact footer (exit 0):

```text
ok 3 - the same rendered Retry then Send callbacks share one admission gate
ok 4 - rejected fetches clean up Send and Regenerate with one Retry bubble
ok 5 - user-aborted transport rejection stays silent
ok 7 - poll 19 empty cannot overwrite the rendered poll 20 ready brief
1..22
# tests 22
# suites 0
# pass 22
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 235.04025
```

## Not run

- Docker-dependent integration tests were not run because Docker is unavailable in this sandbox. I am not claiming an integration pass. Integration/environment-guarded tests account for part of the default suite's 52 skips.
- The browser upload → chat → citation-jump golden path was not run because the authenticated local frontend/backend/data-service stack was not available. The production build and deterministic hook regressions are the frontend verification completed here, not a substitute claim for browser coverage.
- Git commands, deployment, commits, and version changes were not performed.
