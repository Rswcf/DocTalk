# Batch B — adversarial review request, round 3

Branch `fix/growth-batch-b`, HEAD `aefba60`. Round 2 was BLOCK
(`.collab/dialogue/2026-09-03-batch-b-codex-r2.md`); all four findings are now closed across two
commits. Review `git diff def8d24..aefba60` for the lock-order change, and
`git diff 6c5d1fa..aefba60` as the whole batch.

## Severity bar (unchanged)

**BLOCK only for:** money loss, a paid-feature leak, or rejecting work that previously succeeded.
Everything else is a note. **If the batch is sound, say SHIP plainly.** Do not manufacture a finding
to justify a round. Do not re-raise anything in the out-of-scope list.

## What changed since r2

r2 findings 1, 3, 4 (commit `def8d24`):
- All three chat entry points share one `chatOperationLatchRef`, acquired synchronously before any
  message or accounting mutation, reading live `useDocTalkStore.getState().isStreaming`.
- `streamAssistantResponse` routes non-abort transport rejections through the caller-selected error
  handler behind an `errorHandled` latch that guarantees exactly one invocation, then swallows it.
  The two `reanchorDemoCounter` calls previously in the regenerate/continue catch blocks are MERGED
  into that single override callback, not removed — verify that claim.
- `useDocumentBrief` requests carry a monotonic ordinal (`lib/latestRequest.ts`); a result applies
  only while both its scope and start ordinal are current.

r2 finding 2 (commit `aefba60`), per an adjudicated ruling — **global row-lock order is `documents`
before `users`**, and the delete side is deliberately unchanged:
- Reparse locks the document `FOR NO KEY UPDATE` (`with_for_update(key_share=True)`,
  `populate_existing=True`) and that locked row is the sole source of truth for owner and status.
- 404 and 409 derive from it; `db.refresh()` and the second status check are gone.
- The `users` `FOR UPDATE` + capacity count runs ONLY when the locked status is `error`; a `ready`
  reparse takes no user lock at all.
- The conditional claim UPDATE is kept verbatim, including its now-redundant status predicate.
- The locked status is captured into a local before any `await db.rollback()` — the new concurrency
  test showed the 409 detail was reading an expired attribute and raising `MissingGreenlet`.

## Attack these specifically

1. **Is `documents`-before-`users` actually complete?** Find any path that takes a `users` row lock
   and then locks, updates, or inserts a child of an EXISTING `documents` row (the child INSERT takes
   an implicit `FOR KEY SHARE` on the parent and counts). Upload/URL-import/layout-import insert a NEW
   document row and are believed safe — confirm or refute. Check collections, chat session creation,
   saved quotes, layout translation, billing.
2. **Did dropping the `users` lock for `ready` reparses break anything?** A `ready` reparse now takes
   no user lock. Can that race an upload or another reparse into exceeding the plan ceiling, or
   contradict the slot rule?
3. **`FOR NO KEY UPDATE` strength.** Is there any writer that `FOR UPDATE` would have excluded and
   `FOR NO KEY UPDATE` does not, such that reparse's decision can be invalidated between the lock and
   the claim? Consider concurrent UPDATEs to non-key columns of the same document row (parse worker
   status writes, brief backfill, layout translation).
4. **Post-rollback attribute reads elsewhere.** The 409 bug was reading an ORM attribute after
   `await db.rollback()`. Sweep the batch's touched endpoints for the same shape.
5. **r2 fix regressions.** Can the shared `chatOperationLatchRef` now block a legitimate action that
   used to be allowed (e.g. Send while a previous request already failed and cleared streaming)? Can
   the `errorHandled` latch swallow an error that a caller needed to see? Can the brief ordinal drop a
   result that should have applied?

## Out of scope — do not propose

- Changing the delete side's lock ordering, or narrowing the parent `FOR UPDATE` held across the
  awaited resolver (adjudicated; it is the mechanism that closes the orphaned-ledger hole from
  Batch A r6).
- The demo counter accounting redesign (superseded 2026-09-03 §3).
- Re-mounting `DocumentBriefPanel` or the Brief tab.
- Widening the strict quote auto-route trigger.
- Batch A hardening rows 15-18.
- A `brief_pending` migration.
- Adding `statement_timeout` / `lock_timeout` as a substitute for correct lock ordering.

## Gates Claude ran on `aefba60` (real Postgres + Docker)

| Gate | Result |
|---|---|
| `ruff check app/ tests/` | clean |
| `pytest -q` | 955 passed / 3 skipped |
| `pytest -m integration -q` | 51 passed |
| reparse + lock-order + deletion subset | 8 passed |
| `npm run build` | compiles |
| `npm run test:unit` | 22 passed |

Your sandbox cannot run integration tests or git. Do not report a gate you did not execute.

Write to `.collab/dialogue/2026-09-03-batch-b-codex-r3.md`: verdict line (BLOCK / REVISE / SHIP), then
each finding with severity, exact `file:line`, the concrete failing sequence, and a suggested fix.
