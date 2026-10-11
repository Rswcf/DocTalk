# Session menu: stream guard after New Chat and delete-current — fix and Codex review record

Date: 2026-10-11. Branch: `fix/session-menu-stream-guard` (base `fix/chat-session-restore-race` 331f4fe1),
fast-forwarded into `fix/chat-session-restore-race`. Not pushed, not deployed.
Reviewer: Codex `gpt-5.5`, adversarial, review-only instructions, 1 round. Verdict: **SHIP**.
Parent record: `2026-10-11-chat-session-restore-race.md` (this fixes its r3 (P) follow-up).

## Problem

Pre-existing on `main`. `SessionDropdown`'s New Chat and delete-current checked for a running stream only
when they started. A send on the conversation still on screen during `createSession` / `deleteSession`
was then followed by a session change. `useChatStream` drops every stream callback once the store's
session id or demo accounting epoch differs from the one the send started on (`active()`), its `done`
included. Nothing else cleared `isStreaming`.

- New Chat: published the new session over the stream. The answer never finished on screen,
  `isStreaming` stayed set, and the input showed the Stop button.
- Delete-current: unpublished the conversation, then the replacement load refused to run
  (`openSession`'s post-await check, `startNewChat`'s pre-check). The reader stayed on "initializing
  chat" with `sessionId` null, no ChatPanel (so no Stop button), and the menu disabled. Only a reload
  recovered.

## Fix (eb95c412)

- New Chat: after `createSession`, publish nothing if a stream started (same rule as `openSession`):
  no session switch, no demo accounting, no pointer move, no epoch bump. The created session stays
  listed, unopened: it exists on the server and counts toward the Free 3-sessions/doc cap.
- Delete-current: the server row is already gone, so the delete goes ahead. A stream started on the
  deleted conversation is ended locally first: `flushPendingText()`, then `setStreaming(false)`, then
  unpublish and load the replacement. Its request is not aborted (`SessionDropdown` has no handle on
  `useChatStream`'s `abortRef`, and `useChatStream` has no unmount cleanup); every later callback is
  dropped by `active()`. Without the flush, the store's 50 ms text timer appended the dead answer to
  the replacement's last message (mutation-tested: the test fails without it).
- Rejected: keep the deleted conversation on screen until the stream settles (strands the reader on a
  deleted session, the parent r1 MAJOR); wait for the stream, then switch (needs a subscription, and the
  row is gone anyway).
- `.claude/rules/frontend.md` ("A session id is published only together with its transcript") now
  states the post-await re-check for all three menu actions and the delete-current decision.

Tests (red first, `frontend/tests/chat-session-restore.test.cjs`): "a send during a pending New Chat
keeps its conversation and its stream"; "a send during the delete of the open conversation never leaves
the reader streaming" (replacement and none-left branches). `startStreamLikeSendMessage` models
`useChatStream`: session id and epoch captured at send, every later write gated on both.

## Codex r1 — SHIP

- [MINOR, pre-existing, backend] `backend/app/api/chat.py:431`: a Free Domain Mode user sends on the
  conversation during a pending delete-current. If the POST reaches the backend before the delete
  commits, the Domain Mode trial claim commits before streaming; the frontend then drops the stream and
  the session is deleted. A deleted, invisible attempt can consume a durable trial slot. Suggested:
  block sends while a current-session delete is pending, or release a chat claim when no answer is
  delivered. Not in this branch.

No stuck `isStreaming` or dead-stream write into the replacement found. Codex ran
`tests/chat-session-restore.test.cjs` (20/20) and `npm run test:unit` (248/248).

## Verification at eb95c412

- `npm run test:unit`: 248/248 (`tests/chat-session-restore.test.cjs`: 20 tests).
- `npx tsc --noEmit`: clean. `npm run lint`: no warnings or errors, i18n checks passed.
- `npm run build`: passed (no dev server running).
- Not exercised in a browser.

## Follow-ups (not in this branch)

- Codex r1 MINOR above (Domain Mode trial slot during a pending delete-current).
- `useChatStream` never aborts its request on unmount or on a session change; a dropped stream keeps
  generating server-side until it ends.
