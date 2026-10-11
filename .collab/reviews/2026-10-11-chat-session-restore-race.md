# Reader chat: answer streamed into the user bubble — fix and Codex review record

Date: 2026-10-11. Branch: `fix/chat-session-restore-race` (base `main` 572c6e1a). Not pushed, not deployed.
Reviewer: Codex `gpt-5.5`, adversarial, read-only instructions, 3 rounds. Final verdict: **SHIP-WITH-FIXES** in every round; the one r3 regression is fixed in efde1f1c, which Codex has not re-reviewed.

## Problem

Production, 2026-10-10 ~20:40Z, desktop, signed-in Plus/Pro user, demo document "Attention Is All You
Need" (`182c1d7b-29df-4600-add2-420384c725a4`). The user opened
`/d/<id>?question=What BLEU score does the big Transformer reach on WMT 2014 English-to-German?`
(`?question=` auto-submits on demo documents) while they already had a conversation on that document.
After the stream, the UI showed one user bubble with the question and the whole answer concatenated:
literal `**`, no citation markers, no SOURCES strip, no assistant bubble. A reload rendered the
exchange correctly, so the server data was right and the client state was wrong.

## Root cause

`useChatSession`, signed-in reuse branch (`listSessions` → latest session):

1. `setSessionId(latest)` ran BEFORE `await getMessages(latest)`.
2. The reader mounts `ChatPanel` as soon as `sessionId` is set
   (`DocumentReaderPageClient.tsx`: `documentStatus === 'ready' && sessionId`).
3. `ChatPanel`'s auto-submit gate reads "no conversation messages" as a fresh session. It sent the
   question: local transcript `[question, empty assistant placeholder]`.
4. The backend commits the user message before it streams
   (`chat_service._persist_user_message_and_title`).
5. The late `setMessages(server rows)` replaced the local transcript. The last row was now the
   committed question.
6. `updateLastMessage`, `addCitationToLastMessage` and `updateLastMessageMeta` write to the LAST
   message. Every token and citation landed on the user row. User bubbles render `message.text`
   as plain text, which explains the literal `**`, the missing markers and the missing SOURCES strip.

If the GET returns before step 4, the answer is appended to the previous assistant answer instead.

The other start-up branches were already safe: anonymous adoption fetches before publishing, and a
created session is genuinely empty. `SessionDropdown.onSwitchSession` had the same order
(`setMessages([])` + `setSessionId(id)` then `await getMessages`). After the fix it becomes reachable
by the auto-submit: a `?question=` link that lands on a restored conversation does not fire, so the
`initialQuestionSubmittedRef` stays null and the next switch would fire into the gap.

## Reproduction (local isolated stack)

Stack: scratch DB `doctalk_bugfix` (migrated to head), MinIO bucket `doctalk-bugfix`, Qdrant
collection `doctalk_bugfix`, Redis db 9, backend 0.35.0 on :8001, Celery worker (`--pool=solo`),
`next dev` on :3000. Signed-in = a local Auth.js session minted for a fixture Pro user.

| Scenario | Before the fix | After the fix |
|---|---|---|
| Anonymous, no session | correct (SOURCES: 2, Page 8 / Page 1) | correct, demo counter 4/5 |
| Anonymous, existing session (stored pointer) | transcript restored, no resend | same |
| Signed-in, no session | correct | correct |
| Signed-in, existing session, full page load | DB got a second Q+A; UI showed one exchange: the new answer appended to the previous answer card (opening sentence ×2) | no send, no prefill; transcript renders correctly (5 Q, 5 A, all with SOURCES) |
| Signed-in, existing session, client navigation, transcript GET delayed 1.2 s | chat POST at 126 ms, GET at 1353 ms returned 9 rows ending with the committed question; user bubble = `Which optimizer was used to train the Transformer?- The Transformer was trained using the **Adam optimizer**…` (exact production variant) | no chat POST; transcript correct |

Session menu, after the fix (1.2 s delayed GET): switching keeps the previous conversation on screen
until the new one loads, no chat POST fires; deleting the open conversation shows the "initializing
chat" placeholder (no chat input) until the replacement loads.

Golden path (headless Chrome over CDP, fixture user): upload a synthetic 2-page PDF → ask "How much
did the lamp assembly cost?" → answer "31,200 euros", SOURCES: 4 (Page 2) → click citation 1 → page 2,
banner "Citation 1 · Page 2 · Exact passage", the budget sentence highlighted.

## Commits

| Commit | Content |
|---|---|
| 1f36ba8b | Fetch the transcript before publishing the session id (`useChatSession` reuse branch, `SessionDropdown.onSwitchSession`); `tests/chat-session-restore.test.cjs`; rule in `.claude/rules/frontend.md` |
| 187448be | r1 fixes |
| 6ad43c3a | r2 fixes |
| efde1f1c | r3 fix: one menu latch per document |

## Rounds

**r1 — SHIP-WITH-FIXES.** Root cause confirmed; no demo-counter regression.
- MAJOR: a pending switch was superseded only by a later switch click; a New Chat or delete could be
  overwritten and the anonymous pointer moved back. Fix 187448be: shared action ordinal (replaced in r2).
- MAJOR: deleting the open conversation kept it published during the replacement GET; a send there
  stranded the reader on a deleted session. Fix 187448be: unpublish it first.
- MINOR: the start-up restore could overwrite a conversation opened from the menu meanwhile.
  Fix 187448be: keep a session published meanwhile.

**r2 — SHIP-WITH-FIXES.** Three more menu interleavings the ordinal did not cover (New Chat resuming
over a later switch; a click on a conversation being deleted; a failed start-up GET falling through to
`createSession`) and one MINOR (an unrelated delete dropped a pending switch). Most were pre-existing
on `main`. Fix 6ad43c3a: the ordinal is replaced by the project's `acquireSingleFlight` latch (menu
actions run one at a time, never while streaming; clicks during a pending action are ignored); the
start-up guards cover every await; the 404/403 adoption clears the pointer only while it still names
the adopted session.

**r3 — SHIP-WITH-FIXES.**
- (R) MAJOR, regression from r2: a menu request that never settles keeps the latch closed. The header
  keeps `SessionDropdown` mounted across documents, so every menu action on the next document was
  ignored until reload. In production the proxy aborts non-chat requests after 30 s
  (`app/api/proxy/[...path]/route.ts`: 30 000 ms, 504), so the lock is bounded, not permanent.
  Fix efde1f1c: the latch is keyed by the live document id. A stale continuation is already dropped by
  the post-await document checks in each action. Test: "a menu action stalled on one document does not
  lock the menu on the next" (red before the fix).
- (P) MAJOR, pre-existing: New Chat and delete-current reject streaming only at action start. A send
  during their `createSession`/`deleteSession` await can be followed by a session change that drops
  the stream's `done` callback, which can leave `isStreaming` set. `main` has the same shape. Listed as
  a follow-up.

Stopped after r3 by plan: r3 was the last fix round. Its single regression is fixed; its other item is
pre-existing.

## Verification at efde1f1c

- `npm run test:unit`: 246/246 (`tests/chat-session-restore.test.cjs`: 18 tests).
- `npx tsc --noEmit`: clean. `npm run lint`: no warnings or errors, i18n checks passed.
- `npm run build`: passed.
- The browser checks above ran on 1f36ba8b–6ad43c3a. efde1f1c changes only the menu latch key and was
  not re-run in a browser.

## Behaviour change for the owner

A `?question=` link on a document where the visitor already has a non-empty conversation no longer
sends anything, and does not prefill the input. This is the gate `ChatPanel` has had since d4983c2e,
and anonymous visitors already behaved this way. Signed-in users only "got" the send through this race.
Options: keep it; prefill the input; or send after the transcript loads (then decide what stops a
reload of the same URL from sending it again).

## Follow-ups (not in this branch)

- `app/collections/[collectionId]/page.tsx` (start-up and `handleSelectSession`) still publishes the
  session id before its transcript. No auto-submit there, so only a manual send inside the GET window
  can hit it.
- Stream writes target "the last message" (`store/index.ts` `updateLastMessage` & co). Targeting the
  assistant placeholder by id would turn any future ordering bug of this kind into a no-op.
- New Chat and delete-current need a post-await stream guard (r3 (P), pre-existing).
- The per-document latch (efde1f1c) leaves one window, bounded by the 30 s proxy timeout. A menu
  request stalls on document A; the user moves to B, runs a menu action there, and returns to A. A
  fresh latch then lets a New Chat or switch on A run beside the stale request. If the stale request
  resolves last, it replaces that New Chat or switch (the r1 MAJOR shape). The id is still published
  with its own transcript. Without a menu action on B, the stale latch still locks A's menu until the
  request settles.
- "New Chat" after a `?question=` link that did not fire sends the question into the new chat
  (behaviour on `main`, unchanged).
