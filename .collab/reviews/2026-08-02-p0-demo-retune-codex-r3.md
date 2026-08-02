# Codex r3 — scoped verification of the two r2 must-fix items

Review range: `98df9e3..f594007`

Scope is limited to r2 must-fix #2 and #3 plus regressions introduced by
`65046a5` and `f594007`. The seven settled findings and three accepted parked
rulings were not reopened. I audited the supplied typecheck/lint/build/browser
evidence rather than repeating it.

## MUST-FIX-A / r2 #2 — NOT ADDRESSED

The document-reset half is addressed. `clearDocumentTransientState` no longer
touches either demo-counter field (`frontend/src/store/index.ts:317-337`), so
the locale-sensitive `useDocumentLoader` effect cannot zero them on a language
change. `useChatSession` resets both fields before its async adoption/load path
and every successful anonymous adopt/create path then installs a fresh server
baseline (`frontend/src/lib/useChatSession.ts:25-39,52-88,128-151`). This
covers a ready document transition; while a destination is not ready, chat is
not rendered, and the same effect runs when its status reaches `ready`
(`frontend/src/lib/useChatSession.ts:25-26,165`). The supplied EN→中文 5/5
browser result is consistent with this control flow.

The regenerate/continue error convergence is still incomplete and introduces
two undercount paths:

1. The rollback exists only inside `handleStreamError`
   (`frontend/src/lib/useChatStream.ts:114-138`). A rejection from `fetch()`
   itself bypasses that callback: both SSE helpers await `fetch` outside any
   `try/catch` (`frontend/src/lib/sse.ts:157-205,212-258`), and their callers
   likewise await them without catching
   (`frontend/src/lib/useChatStream.ts:267-289,341-398`). A network failure
   therefore still leaves the optimistic bump installed, which is one of the
   concrete r2 repro classes.
2. Rolling back *every* non-abort callback error is not safe because it does
   not establish whether quota was consumed. In particular, the continuation
   endpoint increments the demo tracker before validating that the message
   exists or is still continuable (`backend/app/api/chat.py:508-550`). A 404
   `MESSAGE_NOT_FOUND` or 400 `CONTINUATION_LIMIT` is therefore charged by the
   backend, but `handleStreamError` restores the pre-bump client value. Errors
   emitted after the normal chat endpoint's tracker increment have the same
   ambiguity (`backend/app/api/chat.py:398-445`). This violates r2's requirement
   to roll back only failures known not to consume quota or otherwise refresh
   the authoritative count.

The ref is single-consumer under normal completion/error, so the same terminal
callback cannot double-restore it. Abort is not cleanly consumed, however:
`_processSSEStream` returns without `onError`/`onDone` when the signal is
aborted (`frontend/src/lib/sse.ts:136-153`), while `stopStreaming` neither
clears `preBumpDemoUsedRef` nor otherwise commits it
(`frontend/src/lib/useChatStream.ts:400-405`). A later ordinary `sendMessage`
does not overwrite that ref; if that later request fails, the shared
`handleStreamError` can restore the stale pre-abort value and undo usage from
the earlier, deliberately retained regenerate/continue charge.

Required revision: route thrown SSE/fetch failures through one terminal cleanup
path; consume the pending rollback token on abort without restoring it; and
either refresh `demo_messages_used` after an ambiguous non-abort failure or
restrict rollback to errors whose server ordering proves that the tracker did
not increment.

## MUST-FIX-B / r2 #3 — NOT ADDRESSED

The two requested lifecycle operations are present in isolation:

- A non-404/403 stored-session adoption failure sets `sessionError` and returns
  before `listSessions`/`createSession`, while preserving the pointer
  (`frontend/src/lib/useChatSession.ts:89-108`). Reload therefore retries the
  same stored ID.
- After a successful delete, a pointer naming the deleted session is cleared
  before either replacement GET/create begins
  (`frontend/src/components/SessionDropdown.tsx:119-140`). A successful
  replacement subsequently writes its own pointer through the existing switch
  or new-chat path (`frontend/src/components/SessionDropdown.tsx:59-114`).

The stopped adoption path is not state-safe on an in-app document transition.
Per-document clearing intentionally retains `sessionId`, `sessions`, and
`messages` (`frontend/src/store/index.ts:317-337`), and the new transient catch
does not clear them before returning. Thus, when document A already has a
truthy session and adoption of stored document-B session fails transiently,
the global store still identifies A's session/transcript. The reader tests
`documentStatus === 'ready' && sessionId` *before* `sessionErrorCopy`, so it
renders `ChatPanel` for that stale A session and hides the retryable error
(`frontend/src/app/d/[documentId]/DocumentReaderPageClient.tsx:366-393`). The
user can therefore remain on document B with document A's active chat/session,
rather than seeing the promised stop-and-retry error. Initial/full reload is
safer only because the store begins without a session ID.

Required revision: make a session-loading/adoption error dominate chat
rendering and prevent an old document's session/messages from remaining active
while the new document's adoption is unresolved. Preserve the stored B pointer
and retain the no-create behavior.

## New breakage introduced by these commits

1. **IMPORTANT — broad rollback can undercount a server-charged failure.**
   Introduced by `65046a5`: continuation validation and downstream stream
   failures can occur after the backend tracker increment, but every non-abort
   callback error restores the client pre-bump value.
2. **IMPORTANT — an abort leaves a live rollback token that can affect a later
   unrelated send.** Introduced by `65046a5`: the SSE abort path invokes no
   terminal callback and `stopStreaming` does not clear the new ref.
3. **IMPORTANT — transient adoption stop can expose the prior document's chat
   instead of its error.** Introduced by `f594007`: the new early return leaves
   the old truthy `sessionId` in place, and existing render precedence selects
   `ChatPanel` over `sessionErrorCopy`.

The thrown-network-failure drift is incomplete remediation of r2 #2, not a
separate new regression. The delete-pointer change itself introduces no new
breakage in the reviewed diff. `git diff --check 98df9e3..f594007` passes.

**Overall verdict: REVISE.**
