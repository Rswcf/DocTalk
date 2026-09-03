# Batch B — adversarial review request, round 1

Branch `fix/growth-batch-b`, HEAD `c7bf834`, based on Batch C @ `6c5d1fa`.
Design authority: `.collab/plans/2026-09-03-backlog-decision.md` §2 (B1, B2), §3 (B3), §4 (B4),
§7 (addendum). Implementation report: `.collab/reviews/2026-09-03-batch-b-impl-report.md`.

Review `git diff 6c5d1fa..c7bf834`. Read `CLAUDE.md`, `.claude/rules/backend.md` and
`.claude/rules/frontend.md` first — several invariants below were won over six-round consensus and
must not be re-litigated.

## Severity bar

**BLOCK only for:** money loss, a paid-feature leak, or rejecting work that previously succeeded.
Everything else is a note. If the batch is sound, say **SHIP** plainly — do not manufacture findings
to justify a round. A short review that says SHIP is a good review.

## What to attack, in priority order

1. **The slot rule can be farmed or can trap a user.** `count_plan_slot_documents` +
   `document_capacity_error_detail` (`backend/app/services/document_limits.py`), used at three
   ingest sites and in reparse. Rules: (A) live slots = `status NOT IN ('deleting','error')`;
   (B) errored rows have their own ceiling = plan max; (C) reparse of an `error` doc needs a free
   live slot, and deliberately passes `errored_count=0` so a user at the failed-row ceiling is not
   trapped. Find a sequence of uploads / failures / retries / deletions that yields more live
   documents than the plan allows, or unbounded stored objects, or a user who can never upload or
   retry again. Cross-check `layout_translations.py` and the URL-import path, not just upload.
2. **Concurrency.** The authoritative check is `SELECT users.plan ... FOR UPDATE` in the same
   transaction as the `documents` INSERT (`doc_service.create_document`), with an unlocked
   pre-check at the endpoint. Reparse takes the same user-row lock, re-reads status, then runs the
   existing conditional UPDATE claim. Look for: a lock held across the upload byte stream; a
   lock-order inversion against advisory namespaces 947/948 or the parent-delete path; a rollback
   that releases the lock before the decision it protects; two concurrent claims both succeeding.
3. **The reject path leaks or double-frees.** On an authoritative reject the code rolls back, then
   deletes the MinIO object best-effort, then raises 403. Can that delete remove an object belonging
   to a different document? Can a successful upload be rolled back after the object is deleted?
4. **Reparse contract regressions.** The conditional-UPDATE claim, the 409 `DOCUMENT_PROCESSING`
   while in flight, and the worker's terminal-state gating must be exactly as before. A Retry click
   that races an autoretry must not create the user-vs-autoretry race the gating exists to prevent.
5. **Demo counter.** B3 must be UI only. `useChatStream.ts`, `demoSessionStorage.ts` and
   `store/index.ts` have zero diff — confirm no counter mutation was added, moved or removed
   anywhere, and that the Retry button cannot double-submit or resurrect a stale session/epoch.
6. **B1 correctness.** The hook is called with `documentStatus === 'ready' && !isDemo ? documentId
   : undefined`. Check for a stale brief surviving a document switch, an unbounded poll, a request
   storm from the widened 10 -> 20 bound, and whether `failed` briefs correctly render nothing extra.
7. **Error copy honesty.** 15 terminal codes are classified retryable / content-fault /
   unrecoverable. `DOWNLOAD_FAILED` offers Delete and no Retry. Is any code misclassified such that
   we promise a retry that cannot work, or hide a retry that would?

## Explicitly out of scope — do not propose these

- The demo counter accounting redesign (superseded by decision 2026-09-03 §3; a failed demo answer
  consuming a question is the accepted contract, not a defect).
- Re-mounting `DocumentBriefPanel` or the Brief tab (its removal was deliberate).
- Widening the strict quote auto-route trigger (adjudicated; auto-routing is billed).
- Batch A hardening rows 15-18 (guard a subsystem dead in production since 2026-05-08).
- A `brief_pending` migration.

## Verification already run by Claude against real Postgres and Docker

| Gate | Result |
|---|---|
| `ruff check app/ tests/` | clean |
| `pytest -q` | 950 passed / 3 skipped |
| `pytest -m integration -q` | 49 passed |
| `npm run build` | compiles, 425 pages |
| `npm run test:unit` | 17 passed |
| i18n | 32 new keys, identical set in all 11 locales, all flat |

Your sandbox cannot run the integration tests (it denies local sockets) and cannot run git. Do not
report a gate you did not execute. Reason from the diff.

Write your review to `.collab/dialogue/2026-09-03-batch-b-codex-r1.md`: a verdict line
(BLOCK / REVISE / SHIP), then each finding with severity, the exact `file:line`, the concrete failing
sequence, and your suggested fix.
