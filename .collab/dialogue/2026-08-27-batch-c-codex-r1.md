# Batch C adversarial review — Codex R1

Revision under review: `468b63d` (`fix/growth-batch-c`)  
Review date: 2026-08-27  
Verdict: **BLOCK**

The batch breaks the anonymous demo cap in both directions under cancellation:
one server teardown schedule can release a reservation twice, while the normal
client Stop/abort path can leave the browser believing a released reservation
was consumed. Those are blockers under the supplied verdict bar. C1's hint is
live and remains click-gated, C2's authenticated event surface is wired, and C3
is source-level responsive with complete flat i18n keys.

## 1. BLOCKER — cancellation during the error release can release one slot twice

`backend/app/api/chat.py:75-94` does prevent the ordinary "error event, then
generator teardown" double release: after a successful awaited release it sets
`active_key = None`, so the `finally` is a no-op. It does **not** provide
exactly-once release when cancellation lands during that await:

```python
remaining = await demo_message_tracker.release(active_key)
active_key = None
```

Redis may have executed the Lua `EVAL` before the cancelled task receives the
reply. In that schedule `active_key` is still non-null, cancellation enters the
wrapper's `finally`, and `release(active_key)` runs a second time. With five
shared reservations, one failed request can therefore take the Redis count from
5 to 3 instead of 4, allowing two replacements while four other reservations
remain live. Six requests can get through a five-request cap.

I reproduced the control-flow failure with a one-off async probe that models
"Redis applied the first release, then the awaiting task was cancelled." The
result was:

```text
{'release_calls': 2}
```

The committed tests do not exercise this window. The HTTP happy-error test only
asserts one call when the first release completes normally
(`backend/tests/test_error_taxonomy.py:907-938`). The in-memory test at
`backend/tests/test_demo_limits.py:23-33` shows that repeated release bottoms out
at zero, but release is not request-owned: before zero, the second decrement
steals another in-flight request's reservation.

Required direction: make all teardown paths await the **same single release
operation**, including under cancellation. A request-scoped release task that
is created once and shielded/re-awaited is the minimum viable shape; a
reservation ID with an idempotent token-based Redis release is stronger. Merely
moving `active_key = None` before the await trades this double release for a
leaked slot if cancellation wins before the release executes.

## 2. BLOCKER — Stop/abort and clean EOF can hard-lock the client while the server count is free

The backend intentionally releases any reservation whose wrapped stream does
not reach `done` (`backend/app/api/chat.py:92-94`). The frontend does not
re-anchor the counter for two matching terminal paths:

1. On Stop, `stopStreaming()` aborts and clears UI streaming state only
   (`frontend/src/lib/useChatStream.ts:490-495`). `_processSSEStream()` returns
   silently whenever `signal.aborted` is true (`frontend/src/lib/sse.ts:155-167`),
   so neither `handleAttemptError()` nor `reanchorDemoCounter()` runs.
2. If a timeout/proxy closes the stream as a clean EOF without an SSE `done` or
   `error`, `_processSSEStream()` synthesizes `onTruncated()` plus
   `onDone({ message_id: '' })` (`frontend/src/lib/sse.ts:170-173`). That is
   treated as successful completion and also skips re-anchoring, even though the
   server wrapper releases the reservation because it never saw `done`.

For an initial send, the transcript keeps the appended user message. Under the
document counter contract, that message remains in `localUserMsgCount` even
after Redis releases it. Starting from zero, five Send -> Stop cycles produce:

```text
server demo count = 0
client transcript delta = 5
client totalUsed = 0 + 5 = 5
```

The sixth attempt is blocked locally by `demoLimitReached` and opens auth even
though the backend would allow all five questions. Regenerate/continue have the
same mismatch in the other accounting field: they optimistically increment
`demoMessagesUsed` at `useChatStream.ts:413-419`, and abort never corrects it.

Required direction: cancellation and terminal-without-`done` need an explicit
failed terminal accounting path that converges to server truth under the same
session + epoch guards. Do not add an unguarded guessed rollback: an abort can
race with a server `done`. The client needs either a server-acknowledged terminal
count/outcome or a post-teardown re-anchor that cannot run before the backend's
release has settled. Clean EOF without `done` must not be promoted to accounting
success.

## 3. REVISE — C1 now exposes the working Quote Finder panel to anonymous demo users

The toolbar correctly gives anonymous users a sign-in CTA
(`frontend/src/app/d/[documentId]/DocumentReaderPageClient.tsx:255-280`), as the
frontend rule requires. The chat hint does not preserve that surface:

- `ChatPanel` receives `handleTryQuoteFinder` for anonymous demo readers too
  (`DocumentReaderPageClient.tsx:428-429`).
- The handler opens `QuoteFinderPanel` without checking `isLoggedIn`
  (`DocumentReaderPageClient.tsx:403-411`).
- C1 makes ordinary demo phrasing such as "Where does ..." produce the chip, so
  this path is no longer merely theoretical.

The billed search itself remains protected: it still requires a second explicit
form submit, and the backend returns 401 for anonymous users. This is therefore
not a paid-feature leak and not an additional blocker. It is nevertheless a
rule violation and a dead-end UX: the user sees the authenticated panel, clicks
Find quotes, then gets redirected to auth. Gate the hint action like the toolbar
(or omit the chip handler for anonymous readers) so anonymous users see the
sign-in affordance instead of the panel.

This also explains the C2 anonymous behavior: both new backend events are
private, so the panel/chip POSTs made by this anonymous path are rejected even
though the client-side `gtag` call still fires.

## 4. C1 disposition — hint is live; billed work remains click-gated

**Pass, apart from the anonymous surface issue above.**

- The strict billed route remains the narrow predicate
  `strict_trigger_matched and not quote_finder_hint`
  (`backend/app/services/action_planner.py:178-196`). The strict regexes and the
  whole-message suppressing-token policy remain the routing gate; the new broad
  citation hint does not feed `VERIFIED_QUOTE_SEARCH`.
- The broad `has_citation` fallthrough returns `CITATION_LOOKUP` with
  `quote_finder_hint=True` and the bounded topic
  (`action_planner.py:361-370`). `CITATION_LOOKUP` is in
  `uses_rag_answer_path`, so it does **not** use `_tool_action_stream`.
- The ordinary RAG `done` payload carries both `quote_finder_hint` and
  `quote_finder_topic` (`backend/app/services/chat_service.py:2575-2590`), and
  `frontend/src/lib/sse.ts:141-149` maps both onto the message. The change is not
  inert on the `CITATION_LOOKUP` path. The FIX3-B warning about tool-action
  `done` payloads does not apply to this action.
- A chip click only pre-fills and opens the panel. The billed request exists
  only in the panel form's `handleSearch` submit path
  (`frontend/src/components/Quotes/QuoteFinderPanel.tsx:184-226,295-314`). No
  new billed search fires on hint receipt, render, panel open, or prefill.

Focused routing tests include both realistic citation phrasing and end-to-end
RAG `done` propagation, while asserting the quote-search service was not called.

## 5. C2 disposition — both events are emitted and remain authenticated-only

**Pass.**

- `quote_finder_chip_clicked` fires in the chip click handler before the panel
  opens (`DocumentReaderPageClient.tsx:407-410`).
- `quote_finder_panel_opened` fires from the panel's open/retarget effect and
  distinguishes `chat_hint` from `document_toolbar`
  (`QuoteFinderPanel.tsx:80-105`).
- Both names are in `ALLOWED_EVENTS` but neither is in `PUBLIC_EVENTS`
  (`backend/app/api/events.py:15-72`). That is the correct backend boundary for
  an authenticated, billed feature. Anonymous `chat_message_sent` remains
  private as before, and the new tests explicitly prove 401/no row for all three
  Quote Finder events when anonymous (`backend/tests/test_events_api.py:267-302`).

The caveat is finding 3: because the UI currently opens the panel anonymously,
those rejected event attempts exist. Fixing the UI auth gate restores the
intended private-only funnel without widening `PUBLIC_EVENTS`.

## 6. C3 and i18n disposition

**Source-level pass; live visual verification unavailable in this sandbox.**

- The sample-card section now precedes "What you will test"
  (`frontend/src/app/demo/DemoPageClient.tsx:106-275`). The card grid is one
  column below `lg` and three columns at `lg`; the shared shell drops from 40px
  to 20px side padding at 640px. Cards have a `minHeight`, not a fixed height,
  so longer localized content can expand vertically rather than clip.
- Loading/non-ready cards remain non-links with the Preparing footer; ready
  cards remain links with Ready/Open copy. Reordering did not move the fetch or
  status predicates and does not alter their state transitions
  (`DemoPageClient.tsx:136-259`).
- All referenced demo, Retry, and Quote Finder chip strings are present and
  non-empty in all 11 locale files. Parsing all 11 locale JSON objects found no
  nested object-valued keys at all; the new/fallback accesses are flat dotted
  keys.
- The localized `/[locale]/demo` wrapper still server-seeds `LocaleProvider`
  with the `demo.` and `common.` prefixes, so the reorder does not regress
  localized first paint.

I attempted the required narrow-width render, but the local Next server could
not bind a port (`EPERM`) and the in-app browser connector failed to initialize.
I therefore do not claim a live 320/375px screenshot pass. This limitation does
not affect the BLOCK verdict, which is independently established by C4.

## 7. Counter invariants that did survive

Outside the two termination failures above, the intended contract remains
recognizable:

- reservation is still an atomic Redis `INCR` before stream work, with an
  over-limit decrement;
- the key remains `(IP, document)` and its 24-hour TTL is preserved across
  session recreation;
- anonymous session reuse restores the server count and transcript baseline
  from `GET messages`;
- SSE error counts and fallback GET snapshots are guarded by both `sessionId`
  and `demoAccountingEpoch`; document resets and A -> A session installs bump
  the epoch, so I found no path where a late GET resolve overwrites newer
  accounting; and
- normal explicit `error` completion releases before sending the server count,
  while normal `done` retains the reservation.

Those properties do not compensate for an exactly-once teardown failure or a
client terminal path that never reconciles.

## 8. Verification

Claude's supplied gate was accepted as evidence: ruff clean; 945 passed / 3
skipped non-integration tests; 48 integration tests passed; frontend build
passed; 12 frontend unit tests passed.

I additionally ran the focused backend selection for demo limits, action
planning, Quote Finder events, and relevant error taxonomy: **24 passed, 76
deselected**. I ran the cancellation-window probe described in finding 1 and
observed two release calls. I used no Git commands.

## 9. Verdict

**BLOCK.** Fix both C4 blockers and add regression tests for:

1. cancellation while the first release operation is pending/ambiguous, with
   other live reservations proving that no second slot is decremented;
2. initial Send -> Stop accounting;
3. regenerate/continue -> Stop accounting; and
4. clean EOF without SSE `done`/`error`.

Then gate the hint panel for anonymous readers and rerun this review. C1's
routing/payload and C2's authenticated allowlist do not need redesign.
