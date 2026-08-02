# Codex r2 — P0 demo re-tune verification

Review range: `aaeb334..98df9e3`

This review audits the nine accepted r1 findings, adjudicates the three parked
rulings, and considers only regressions introduced by the fix commits. I did
not repeat the supplied full build, full test-suite, migration round-trip, or
live-browser runs.

## Accepted-finding verification

### #1 — ADDRESSED: authenticated demo-session cap DoS

The anonymous rolling count now contains `ChatSession.user_id IS NULL`, so
authenticated sessions cannot consume the anonymous 500-session availability
budget while they remain authenticated
(`backend/app/api/chat.py:61-74,268-279`). Authenticated Free users on demo
documents now get a separate lifetime count scoped to exactly
`(document_id, user.id)`, using the normal
`FREE_MAX_SESSIONS_PER_DOC` limit (`backend/app/api/chat.py:231-252`).
That is the right count scope: neither another user's sessions nor sessions on
another sample document contribute.

The only other session-creation endpoint creates collection-only sessions
(`backend/app/api/collections.py:319-338`), so it cannot bypass the
document-demo guard. Paid accounts can still create empty demo sessions, but
those rows no longer affect anonymous availability and the cleanup now removes
empty authenticated as well as anonymous demo sessions after seven days
(`backend/app/workers/cleanup_tasks.py:46-87`). The check/insert remains
non-atomic; that is adjudicated separately under parked #6.

### #2 — NOT ADDRESSED (IMPORTANT): counter baseline has reset and error-path gaps

The core arithmetic is correct on the intended paths:

- Restore sets `demoMessagesUsed` to raw server usage and
  `demoRestoredUserMsgCount` to the restored transcript's user-message count
  (`frontend/src/lib/useChatSession.ts:63-76`).
- `useChatStream` then computes
  `serverBaseline + max(0, currentUserMessages - restoredUserMessages)`
  (`frontend/src/lib/useChatStream.ts:73-91`).
- Fresh-session creation resets the transcript baseline to zero, dropdown
  switching installs a new transcript baseline, and regenerate/continue add one
  because the backend charges both operations
  (`frontend/src/components/SessionDropdown.tsx:59-114`;
  `frontend/src/lib/useChatStream.ts:299-371`).

However, the new document-switch reset is also executed on a same-document
language change. `useDocumentLoader` calls
`clearDocumentTransientState()` whenever its effect reruns, and that effect
depends on `t` and `tOr`
(`frontend/src/lib/useDocumentLoader.ts:46-60,155-163`). Both translation
functions change identity when the locale or lazily loaded translation table
changes (`frontend/src/i18n/LocaleProvider.tsx:124-150`). The reset now zeros
both counter fields while deliberately leaving the transcript in place
(`frontend/src/store/index.ts:306-332`). `useChatSession` does not depend on
locale or either translation function, so it does not refetch the server count
after that reset (`frontend/src/lib/useChatSession.ts:25-26,147`).

Two reproducible consequences:

1. Restore a five-question transcript after the Redis TTL expires: server usage
   is 0 and the restored baseline is 5, so the UI correctly shows 5/5. Change
   language: both baseline fields become 0 while the five user messages remain,
   so the UI returns to 0/5 remaining and recreates the exact TTL-expiry
   hard-lock from r1.
2. If the per-document server count includes questions from another demo
   session, resetting to the active transcript's count under-reports usage and
   lets the composer submit requests the backend will reject.

There is also a smaller new drift path: regenerate/continue increment
`demoMessagesUsed` before `fetch` has received an HTTP response
(`frontend/src/lib/useChatStream.ts:308-312,332-350`). A network/proxy failure,
or a server rejection that occurs before
`demo_message_tracker.check_and_increment`, leaves the client one question
too high until another restore; the error handler does not roll that bump back.

Required revision: reset demo counter state only on an actual document-ID
transition and guarantee a server restore afterward. For optimistic
regenerate/continue accounting, either roll back failures known not to consume
quota or refresh the authoritative server count on error.

### #3 — NOT ADDRESSED (IMPORTANT): the pointer is still abandoned on transient failure

The shared storage helper correctly catches storage-disabled
`sessionStorage` operations, and successful create/switch paths now move the
pointer (`frontend/src/lib/demoSessionStorage.ts:18-47`;
`frontend/src/components/SessionDropdown.tsx:59-114`). Definitive 404/403
adoption failures clear it (`frontend/src/lib/useChatSession.ts:78-90`).

The transient failure path still has the same user-visible outcome as r1,
though. After a transient stored-session `getMessages` failure, the code
keeps the key only momentarily, then falls through to `listSessions`.
Anonymous demo listing is empty, so it creates a new session and overwrites the
still-valid pointer (`frontend/src/lib/useChatSession.ts:78-121`;
`backend/app/api/chat.py:606-610`). The old session is again unreachable.

Deletion is likewise not transition-safe:

1. Start with stored/current B and surviving session A in the in-memory list.
2. Delete B successfully.
3. `onDeleteSessionById` removes B and calls `onSwitchSession(A)`.
4. If A's message GET fails transiently, `onSwitchSession` has already
   blanked messages and changed `sessionId`, but it has not written A's
   pointer; the stored key still names deleted B
   (`frontend/src/components/SessionDropdown.tsx:94-133`).
5. Reload clears B on 404, anonymous listing returns no A, and a new session is
   created. A survives in the database but is unreachable.

Required revision: a transient adoption error must stop with a retryable error
instead of falling through to anonymous creation. After a confirmed delete,
clear or retarget the stored pointer immediately; do not leave it naming the
deleted row while awaiting a replacement GET.

### #5 — ADDRESSED: anonymous share copy

Both anonymous share surfaces now say “Sign in to share this conversation” in
their title and accessible name
(`frontend/src/components/Chat/ChatPanel.tsx:654-662`;
`frontend/src/components/Chat/MessageBubble.tsx:368-380`). The key exists and
is non-empty in all 11 locale JSON files. This satisfies the accepted P0 ruling
that the control must describe authentication rather than claim an immediate
share.

### #6-index — ADDRESSED

Migration `20260802_0033` creates
`(document_id, created_at) WHERE user_id IS NULL`
(`backend/alembic/versions/20260802_0033_add_sessions_demo_window_index.py:24-31`).
That predicate and column order match the anonymous rolling-window count
exactly. Upgrade and downgrade are symmetrical.

### #8 — ADDRESSED: typed messages response

`SessionMessagesResponse` declares optional `demo_messages_used`, and the
endpoint returns that model rather than bypassing response validation with a
manual `JSONResponse`
(`backend/app/schemas/chat.py:47-49`;
`backend/app/api/chat.py:335-344`). OpenAPI and runtime now agree.

### #9 — ADDRESSED: callback override origin validation

The override is resolved with `new URL(override, origin)` and accepted only
when the normalized origin equals the current origin
(`frontend/src/components/AuthModal.tsx:97-115`). Direct probes confirmed:

- `//evil.com`, a double-backslash authority form, `https://evil.com`,
  `https://www.doctalk.site@evil.com/path`, and `javascript:` are rejected.
- A single-backslash `\evil.com` normalizes to the same-origin `/evil.com`
  path; it cannot become an external host.
- `%2F%2Fevil.com` remains an encoded path on
  `https://www.doctalk.site`; it is not parsed as a host.

No current or exported-call-site cross-origin escape remains.

### #10 — ADDRESSED: progress-bar accessible name

The progress bar now uses the localized “Questions remaining” key while its
value and value text also describe remaining questions
(`frontend/src/components/Chat/ChatPanel.tsx:569-582`). The new key exists in
all 11 locale files.

### #11 — ADDRESSED: localized breadcrumb

The Home breadcrumb now calls
`localizedHrefIfAvailable(locale, '/')`
(`frontend/src/app/demo/DemoPageClient.tsx:71-76`). Because root is in
`LOCALIZED_PATHS`, translated demo routes link to `/{locale}` while English
continues to link to `/`
(`frontend/src/i18n/routing.ts:31-33,85-99`).

## Parked-ruling adjudication

### #4 shared-machine restore — ACCEPT WITH RULING

The privacy edge is real: `sessionStorage` is a tab/page-session boundary, not
a person boundary, and browser session restoration can preserve it. I still
accept the P0 ruling because only the three public samples can use this flow,
the transcript is capped at five questions, and New Chat is available from the
visible session control. This should be revisited before anonymous reuse ever
supports user-uploaded or otherwise private documents.

### #6 atomicity — ACCEPT

The 500-session check and the new Free-user check remain check-then-insert
operations. Overshoot is bounded by requests simultaneously past the check;
the anonymous path is additionally bounded per IP by the atomic Redis
five-per-five-minute limiter. These are abuse guards rather than billed quotas,
and authenticated rows no longer consume anonymous availability. Per-document
serialization is not justified for this P0.

### #7 cleanup race — ACCEPT

The race remains, and extending cleanup to authenticated empty demo sessions
widens the eligible population. An anonymous race can also consume one demo
counter slot before the first message fails. Nevertheless, it still requires a
session older than seven days with no messages, a once-daily cleanup statement,
and a request landing between access verification and the first committed
write. A subsequent page load receives 404 and recreates cleanly; authenticated
chat setup refunds a pre-debit on setup failure. I accept the ruling at the
current scale.

## New breakage introduced by the fix commits

1. **IMPORTANT — language changes corrupt the new baseline counter.** Introduced
   by adding both demo fields to `clearDocumentTransientState` in
   `6149931`; this is the primary #2 failure above.
2. **IMPORTANT — the new regenerate/continue bump can survive a request that
   never consumed server quota.** Also introduced in `6149931`; it causes a
   false remaining-count reduction until restore.

The #3 transient/delete behavior is incomplete remediation of an r1 finding,
not independent new breakage. I found no other fix-only regression. The fix
diff passes `git diff --check`; all 11 locale JSON files parse and contain
both new keys.

**Overall verdict: REVISE (must fix #2 counter reset/error convergence and #3 transient/delete pointer lifecycle).**
