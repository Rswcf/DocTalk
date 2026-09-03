# Batch B — adversarial review request, round 2

Branch `fix/growth-batch-b`, HEAD `1296f22`. Round 1 verdict was BLOCK
(`.collab/dialogue/2026-09-03-batch-b-codex-r1.md`); all five findings were confirmed at source and
fixed. Fix report: `.collab/reviews/2026-09-03-batch-b-fix-r1-report.md`.

Review `git diff c7bf834..1296f22` for the fixes, with `git diff 6c5d1fa..1296f22` as the full batch.

## Severity bar (unchanged)

**BLOCK only for:** money loss, a paid-feature leak, or rejecting work that previously succeeded.
Everything else is a note. **If the batch is sound, say SHIP plainly.** Do not manufacture a finding
to justify a round; a short SHIP is a good review. Do not re-raise anything listed as out of scope.

## What changed since r1

- **F1** reparse now takes `SELECT User.plan ... FOR UPDATE` and passes `locked_plan`; the two
  unlocked ingest pre-checks read a fresh scalar plan.
- **F2** new UI-only `Message.retryAction?: 'regenerate'`, set ONLY at the two chat-stream error
  paths in `useChatStream.ts` (including the partial-answer branch) and required by the Retry button
  in `MessageBubble.tsx:353`. The four non-chat producers in `ChatPanel.tsx` deliberately do not set it.
- **F3** new `frontend/src/lib/singleFlight.ts`; `regenerateLastResponse` and the continue path share
  one latch ref, acquired synchronously before any transcript/accounting mutation, reading live
  `useDocTalkStore.getState().isStreaming`, released in `finally`.
- **F4** `requestScopeRef` generation token in `useDocumentBrief.ts`, replaced synchronously on every
  `documentId` change and checked before every `setBrief` including the polling path.
- **F5** `ChatPanel` derives `usableDocumentBrief` only when `documentBrief?.status === 'ready'`.

## Attack these specifically

1. **Did F3's latch introduce a stuck state?** If it is never released — an early `return`, a throw
   before `finally`, an unmount mid-stream, a component remount — the user loses regenerate/continue
   permanently with no UI signal. Also check the latch is not shared across sessions/documents in a
   way that blocks a legitimate second action, and that it does not mask a genuine `isStreaming`
   desync.
2. **Is F2's discriminator complete?** Find a chat-response failure path that leaves `retryAction`
   unset (so the user loses Retry where they should have it), or a non-chat path that could acquire
   it. Consider abort, mid-stream failure after partial text, paywall/402, and re-render from
   persisted history — a message restored from the server will not carry a UI-only field.
3. **Does F1's fresh pre-check plan read cost or break anything?** Two extra scalar reads per ingest
   request; confirm no N+1 in a loop, no read outside a transaction that then contradicts the locked
   value in a way that returns an inconsistent error, and that `normalized_plan(None)` still degrades
   to free rather than raising.
4. **F4/F5 regressions.** Can the scope token now drop a response that SHOULD have been applied
   (e.g. the same documentId re-entering the effect), leaving a permanently empty pane? Can F5's
   gating hide a legitimately usable legacy brief — note the endpoint returns `status:"ready"` with a
   `legacy_summary` coverage marker for pre-table documents, which must still render.
5. **Anything r1 missed** in the original batch surface (slot rule, reparse contract, error taxonomy,
   B1 mount, B4 nudge).

## Out of scope — do not propose

- The demo counter accounting redesign (superseded 2026-09-03 §3).
- Re-mounting `DocumentBriefPanel` or the Brief tab.
- Widening the strict quote auto-route trigger.
- Batch A hardening rows 15-18.
- A `brief_pending` migration.
- Changing `_persist_brief_error`'s worker-side persistence (F5 was fixed at the render boundary
  deliberately; propose it only if the render-side gate is actually insufficient).

## Gates Claude ran on `1296f22` (real Postgres + Docker)

| Gate | Result |
|---|---|
| `ruff check app/ tests/` | clean |
| `pytest -q` | 952 passed / 3 skipped |
| `pytest -m integration -q` | 49 passed |
| `npm run build` | compiles |
| `npm run test:unit` | 19 passed |
| i18n | untouched this round |
| palette | no violations introduced |

Your sandbox cannot run integration tests or git. Do not report a gate you did not execute.

Write to `.collab/dialogue/2026-09-03-batch-b-codex-r2.md`: verdict line (BLOCK / REVISE / SHIP),
then each finding with severity, exact `file:line`, the concrete failing sequence, and a suggested fix.
