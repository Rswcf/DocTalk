# Session-limit repair — adversarial review, round 2

Branch `fix/session-limit-copy`, HEAD `7a93ac5`. Round 1 was BLOCK
(`.collab/dialogue/2026-09-10-session-copy-codex-r1.md`); both findings are closed. Review
`git diff 30f7f1e..HEAD` for the fixes and `git diff a0a446f..HEAD` for the whole batch.

## Severity bar (unchanged)

**BLOCK only for:** money loss, a paid-feature leak, or breaking behaviour that previously worked.
Everything else is a note. **If it is sound, say SHIP plainly.** Your round-1 blocker was correct and
well-evidenced; a round-2 that finds nothing is a good outcome, not a failed one.

## What changed

- New store signal: `beginTranscriptRestore()` returns a `Symbol` token; `endTranscriptRestore(token)`
  clears only if the token still matches. Released in `useChatSession`'s `.finally()` **and** in the
  effect cleanup, so success, failure and cancellation all clear it.
- `onSwitchSession` and `onNewChat` now gate on `transcriptRestoreInFlight`, not on ownership.
- Ownership moved into the **reuse condition**: unknown ownership falls through to `createSession`
  (the pre-batch behaviour) instead of returning early.
- `setMessages` gained an optional `ownerSessionId`.
- `limit_hit` now carries `document_id` and `is_demo`.

## Attack these specifically

1. **Can the flag ever be left set?** That would reproduce the same brick with a different cause.
   Consider: React 18 StrictMode double-invoke, a document change mid-restore, an effect that throws
   before `.finally()` is attached, remounts, and two restores overlapping so the older one's cleanup
   runs after the newer one began (the token is supposed to make that safe — verify it does).
2. **Can the flag be cleared too early**, letting a switch interleave with a live restore and install
   the wrong document's transcript under the new session id — the hazard the original guard existed
   for?
3. **Is `ownerSessionId` on `setMessages` used consistently?** A wrong owner tag would either brick
   the dropdown again or, worse, certify a foreign transcript as owned and let reuse clear real user
   messages. That data-loss path is the worst outcome in this diff.
4. **Does unknown-ownership fall-through create sessions it should not?** e.g. repeated New Chat
   clicks while a restore keeps failing — is it bounded by `creatingSessionRef` and the server cap,
   and does it respect the cap error rather than looping?
5. **Re-verify the round-1 conclusions still hold** after these edits: no demo-surface path reaches
   Stripe; the demo counter contract has no added/moved/removed mutation; reuse cannot discard a
   session holding user messages.
6. **`limit_hit` metadata**: `document_id` and `is_demo` come from different sources (prop vs store).
   Can they disagree — an event tagged with one document's id and another's demo-ness? That would
   corrupt the 09-28 split more subtly than the missing field did.

## Out of scope

- The cap value (3), backend counting, `chat.py`, `FREE_MAX_SESSIONS_PER_DOC`.
- Excluding empty sessions from the backend count (rejected as unsafe — row-spam vector).
- `DEMO_SESSION_LIMIT_REACHED` (the anonymous cap).
- Re-opening the demo counter design.

## Gates Claude ran

| Gate | Result |
|---|---|
| `npm run build` | compiles |
| `npm run test:unit` | 47 passed (+10) |
| i18n | 4 keys, identical across 11 locales, flat |
| palette | clean |

Do not report a gate you did not execute. Write
`.collab/dialogue/2026-09-10-session-copy-codex-r2.md`: verdict, then findings with severity,
`file:line`, failing sequence, suggested fix.
