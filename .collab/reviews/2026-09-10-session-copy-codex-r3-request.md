# Session-limit copy (items 1-3 only) — bounded review

Branch `fix/session-limit-copy-only`, based on `main` = `a0a446f`. **This review is scope-bounded:
confirm the strip is exact and that what remains is safe.** It is not a re-review of the copy paths,
which you already cleared twice (r1 attack 1, r2 attack 5).

## Read this first — an expected, accepted regression

Reverting `onSwitchSession` to `a0a446f` restores base's **absence of a late-response guard**. The
A→B→A switch clobber window — a late GET for B installing over a newer A — is therefore back. This is
**a return to the accepted status quo, not a new defect**: it has been in production for months and
predates this batch entirely. Do not file it as a regression; the same framing was used for `b718493`
when Batch C reverted its counter work.

If you find a *different* late-response hazard that base did not have, that IS a finding.

## Why the strip happened

Items 1-3 (demo/own session-limit copy, `isDemo` plumbing, delete affordance, `limit_hit` enrichment)
are shipping. **Item 4 ("New chat" reuses an empty session) is dropped**, and all of its lifecycle
machinery with it. Your two BLOCKs both came from the *oracle* item 4 needed — transcript ownership,
then a restore-in-flight token — each of which gated a user action on a condition that only clears
when an async request settles, and `api.ts` has no request timeout.

Production settled its value: of 21 empty authenticated sessions ever, only **7** came from "New
chat"; 14 are first-open rows item 4 cannot touch. ~1 row/month. The residual is a backend prune in a
different batch. The full item-4 work is preserved on `wip/session-reuse-r3`.

## Acceptance checks — confirm each

1. `frontend/src/lib/useChatSession.ts` is **identical** to `a0a446f`.
2. No occurrence anywhere under `frontend/src` of: `messagesSessionId`, `transcriptRestoreInFlight`,
   `beginTranscriptRestore`, `endTranscriptRestore`, `ownerSessionId`, `switchRequestRef`,
   `switchRestoreRef`, `creatingSessionRef`.
3. `onSwitchSession` and `onDeleteSessionById` bodies equal `a0a446f`.
4. `store/index.ts` retains `isDemo` and its `setDocument` reset semantics, and has lost every
   lifecycle field; `setMessages`/`setSessionId` have their base signatures.
5. `onNewChat` retains only the `documentId`/`documentStatus === 'ready'` pre-check and the
   post-await `documentId` identity checks (late-response DROPS), and nothing else new.

## Then attack only these

1. **Can any demo-surface session limit still reach Stripe or emit an `upgrade_click`?** The claim is
   structural: the demo CTA carries no `plan` and the checkout button requires `cta.plan`.
2. **Is `isDemo` ever wrong when the copy renders?** Especially during a document transition —
   `setDocument(newId)` zeroes `isDemo` until the loader's fetch lands, while `AppHeaderShell` keeps
   the dropdown mounted whenever `documentName` is set. The `documentStatus === 'ready'` pre-check in
   `onNewChat` is claimed to cover this; verify it does, and that it cannot itself become a dead gate
   (the loader always settles to a status, unlike a bare request).
3. **`limit_hit` attribution:** can `document_id` and `is_demo` disagree, producing an event that
   misclassifies in the 09-28 demo/own split?
4. **Did the strip remove anything items 1-3 depend on**, or leave an orphan (an unused import, a
   store field written but never read, a test asserting a removed symbol)?
5. **Demo counter contract:** confirm the diff adds, moves and removes **nothing** — with the
   lifecycle work gone this should be trivially true.

## Out of scope

- Item 4, empty-session reuse, and any emptiness oracle. Dropped by ruling.
- The A→B→A clobber window (see the top of this brief).
- The cap value, backend counting, `chat.py`, `FREE_MAX_SESSIONS_PER_DOC`.
- `DEMO_SESSION_LIMIT_REACHED` (the anonymous cap).

## Severity bar

**BLOCK only for:** money loss, a paid-feature leak, or breaking behaviour that previously worked
**relative to `a0a446f`**. Everything else is a note. If the strip is exact and the remainder is
sound, say **SHIP** plainly.

Write `.collab/dialogue/2026-09-10-session-copy-codex-r3.md`: the five acceptance results, then
verdict, then any findings with `file:line` and a failing sequence.
