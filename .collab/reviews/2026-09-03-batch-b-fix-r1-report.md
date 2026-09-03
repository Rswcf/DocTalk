# Batch B — fix round 1 report

Date: 2026-09-03  
Branch supplied by requester: `fix/growth-batch-b` at `c7bf834`  
Input review: `.collab/dialogue/2026-09-03-batch-b-codex-r1.md`

## Verdict

All five findings were valid and are fixed. I did not change the reparse conditional claim, its 409 in-flight behavior, terminal-state gating, parse dispatch order, or the demo-accounting contract. No migration or new i18n key was added.

## F1 [BLOCK] — stale plan under the reparse lock

### Change

- `backend/app/api/documents.py:892-910` now locks and returns `User.plan` with `SELECT users.plan ... FOR UPDATE`, stores it as `locked_plan`, and passes that exact value to `document_capacity_error_detail`.
- `backend/app/api/documents.py:222-229` and `backend/app/api/documents.py:367-374` now use fresh scalar `User.plan` reads for the unlocked upload and URL-import pre-checks instead of the auth dependency's identity-map object.
- `backend/app/api/layout_translations.py:158-164` does the same for the unlocked layout-import document-capacity pre-check.
- The conditional `UPDATE documents ... status IN ('ready', 'error')`, commit-before-dispatch sequence, and locale write remain unchanged after the capacity check.

### Why this closes the sequence

The user-row lock and the plan value are now obtained by the same database statement. A downgrade committed after authentication but before lock acquisition therefore makes every serialized reparse use the lower database ceiling. Conversely, an upgrade already committed before an unlocked pre-check is read from the database and is not rejected by a stale dependency object. The authoritative insert paths still repeat their checks under the existing user-row lock.

### Regression coverage

- `backend/tests/test_document_slots.py:41-71` deliberately supplies `user.plan == "plus"` while the locked scalar returns `"free"`; a full Free live set must return 403, report plan `free`, issue `SELECT users.plan ... FOR UPDATE`, and never execute the reparse claim.
- `backend/tests/test_document_slots.py:74-130` keeps the winner/loser conditional-claim and 409-order regressions aligned with the plan-valued lock.
- `backend/tests/test_error_taxonomy.py:223-246` supplies stale dependency plan `free`, fresh database plan `plus`, and three live documents; upload proceeds to document creation, proving the fresh upgrade wins the early pre-check.
- `backend/tests/test_layout_translations_api.py:97-107` provides the same stale-Free/fresh-Plus mismatch to the layout-import capacity pre-check.

## F2 [BLOCK] — Retry shown on unrelated operation errors

### Change

- `frontend/src/types/index.ts:77-90` adds the UI-only `retryAction?: 'regenerate'` provenance field.
- `frontend/src/lib/useChatStream.ts:247-268` sets that field only in the two generic chat-response error render paths: replacement of an empty assistant placeholder and append-after-partial/mid-stream failure.
- `frontend/src/components/Chat/MessageBubble.tsx:353-360` requires `message.retryAction === 'regenerate'` before it renders the error-bubble Retry button.
- The checkout, export, share, and per-answer-share errors at `frontend/src/components/Chat/ChatPanel.tsx:358-365`, `:388-397`, `:435-444`, and `:465-474` remain generic `isError` messages without retry provenance.
- The existing hover Regenerate action for successful last assistant messages remains unchanged.

### Why this closes the sequence

An error's styling no longer grants authority to start a billed LLM request. Non-chat producers can still render their existing red error bubbles, but they cannot satisfy the explicit chat-failure provenance predicate, so no Retry control is attached. Both the empty-placeholder and partial-answer chat failure shapes carry the discriminator and retain their intended retry.

### Regression coverage

`frontend/tests/batch-b.test.cjs:67-87` asserts that the Retry render predicate includes the discriminator, that exactly the two chat-stream error branches assign it, and that `ChatPanel`'s non-chat producers never assign it.

## F3 [BLOCK] — Regenerate/Continue re-entry can bill twice

### Change

- `frontend/src/lib/singleFlight.ts:1-19` adds a synchronous acquire/release latch whose acquisition happens before asynchronous work.
- `frontend/src/lib/useChatStream.ts:73-74` owns one shared latch for Regenerate and Continue.
- `frontend/src/lib/useChatStream.ts:407-454` acquires the latch and reads live `useDocTalkStore.getState().isStreaming` before any transcript trim, assistant insertion, demo-accounting bump, or stream start; release is guaranteed in `finally`.
- `frontend/src/lib/useChatStream.ts:456-500` applies the same shared gate to Continue before clearing truncation or mutating accounting.
- The existing accounting function remains at `frontend/src/lib/useChatStream.ts:398-405`, with one existing call in each operation after successful acquisition. No counter mutation was added, removed, or moved to a different lifecycle point.

### Why this closes the sequence

The first activation synchronously owns the latch before React needs to commit a streaming render. A second activation from the same rendered callback sees the latch immediately and returns before transcript or accounting mutation. The live Zustand read also rejects a callback whose captured render was stale after another path started streaming. Sharing the latch prevents Regenerate and Continue from racing each other as well as themselves.

### Regression coverage

`frontend/tests/batch-b.test.cjs:89-125` invokes the same callback twice while its first request is deliberately held open and asserts exactly one regeneration and one accounting mutation. It also asserts that both hook operations use the shared acquisition path and the live store guard.

## F4 [NOTE] — stale polling response after a document switch

### Change

- `frontend/src/lib/useDocumentBrief.ts:19-39` maintains an object-identity request scope and replaces it synchronously on every `documentId` transition, including disablement and A → B → A.
- `frontend/src/lib/useDocumentBrief.ts:41-63` captures that scope for every request, drops stale success and error results, and re-checks the scope before the sole response-driven `setBrief`.
- `frontend/src/lib/useDocumentBrief.ts:65-110` routes initial loads, timer polling, and manual refresh through the same guarded request/apply path; stale requests also cannot clear the new document's loading state.

### Why this closes the sequence

A timer-started request for A holds A's old scope object. Switching to B replaces the active object before the response can publish. Even if navigation returns to A, the new A scope is a different object, so the original A response is still discarded. Disablement replaces the scope with an undefined-document token and clears state without permitting late writes.

### Regression coverage

`frontend/tests/batch-b.test.cjs:127-136` locks in scope replacement, stale-result rejection before apply, and polling's use of the shared guarded refresh path.

## F5 [NOTE] — failed brief can render retained payload

### Change

- `frontend/src/components/Chat/ChatPanel.tsx:520-522` derives `usableDocumentBrief` only when `status === 'ready'`.
- `frontend/src/components/Chat/ChatPanel.tsx:521-522` sources the backend brief-question fallback and summary only from that gated value.
- `frontend/src/components/Chat/ChatPanel.tsx:559-577` sources key points only from the gated value.
- `suggestedQuestions` remains the first, independent source at `frontend/src/components/Chat/ChatPanel.tsx:521`.

### Why this closes the sequence

A `failed` response may still contain retained summary, key-point, and question arrays, but all three backend-brief display paths now see `null`. Pre-existing externally supplied `suggestedQuestions` still render independently, as required.

### Regression coverage

`frontend/tests/batch-b.test.cjs:42-56` requires the ready-status gate and requires key points to flow through `usableDocumentBrief`, while rejecting the former direct `documentBrief.key_points` path.

## Required gate output

### Backend full unit suite

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
903 passed, 52 skipped, 15 warnings in 4.95s
sys:1: DeprecationWarning: builtin type swigvarlink has no __module__ attribute
```

The 15 warnings are existing FastAPI/Pydantic, urllib3/LibreSSL, and PyMuPDF/SWIG deprecation warnings.

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

The build also printed the existing Sentry `sentry.client.config.ts` deprecation warning.

### Frontend unit suite

Command:

```text
cd /Users/mayijie/Projects/Code/010_DocTalk/frontend && npm run test:unit
```

Exact footer (exit 0):

```text
1..19
# tests 19
# suites 0
# pass 19
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 247.701375
```

## Integration-test note

Docker-dependent integration tests were not run in this sandbox. I am not claiming an integration pass; the required `/usr/bin/python3 -m pytest -q` run completed with 52 tests skipped by their environment/marker guards.

## Browser golden-path note

The upload → chat → citation-jump browser path was not runnable locally. Both `127.0.0.1:3000` and `127.0.0.1:8000` were unavailable, and `docker compose ps` could not access the Docker daemon socket (`operation not permitted`). I did not substitute the production site/backend because the upload/chat path would mutate live external state. The production build and frontend unit gates above are the UI verification completed in this sandbox.
