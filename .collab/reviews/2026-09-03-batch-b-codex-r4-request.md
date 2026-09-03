# Batch B — adversarial review request, round 4

Branch `fix/growth-batch-b`, HEAD `5f28f0c`. Round 3 was BLOCK on one finding
(`.collab/dialogue/2026-09-03-batch-b-codex-r3.md`), now closed. Review
`git diff aefba60..5f28f0c` for this round's change, `git diff 6c5d1fa..5f28f0c` for the whole batch.

## Severity bar (unchanged)

**BLOCK only for:** money loss, a paid-feature leak, or rejecting work that previously succeeded.
Everything else is a note. **If the batch is sound, say SHIP plainly.** Nine findings across three
rounds are closed; a fourth round that finds nothing is a good outcome, not a failed one. Do not
manufacture a finding. Do not re-raise anything out of scope.

## What changed

Your r3 fix suggestion (reorder `create_collection`) shipped, but the deadlock is closed on the
**demand side** instead, because the ordering rule you implied is not enforceable: 16 tables carry a
`users` FK, and five — `ChatSession`, `DocumentJob`, `SavedQuote`, `DocumentBiblio`, `UsageRecord`
with `document_id` — reference both `users` and an existing `documents` row in ONE insert, where the
two key-shares are acquired by RI triggers in constraint-creation order that application code cannot
see or reorder.

1. **The four Domain Mode trial mutex locks** (`domain_mode_access.py:79,173,196,228`) drop from
   `FOR UPDATE` to `FOR NO KEY UPDATE`. Every demand the delete-time resolver makes on `users` is now
   at most NO KEY UPDATE, so implicit FK key-shares from ordinary inserts on any of the 16 tables can
   never block it.
2. **`create_collection`** (`collections.py:142-190`) dedupes ids, SELECTs owned surviving rows
   `FOR KEY SHARE` ordered by id, uses that result set as the membership, then flushes the Collection
   and inserts junctions. Delete wins; a vanished document is simply omitted.

Conflict matrix verified empirically against this project's Postgres:
KEY SHARE + NO KEY UPDATE → acquired; KEY SHARE + FOR UPDATE → blocked; NO KEY UPDATE + NO KEY
UPDATE → blocked.

## Attack these specifically

1. **Does weakening the trial mutex break slot accounting?** The claim is that NO KEY UPDATE still
   serializes every participant in `feature_trial_usages` accounting, and that no key-share holder
   participates. Find a sequence — concurrent claim + claim, claim + release, claim + refund, chat
   entry + extraction entry, delete-triggered release + a fresh claim — that now yields two slots
   from one, a leaked slot, or a slot that is never released. This is the paid-feature-leak surface
   and is the highest-value thing to attack this round.
2. **Is `FOR NO KEY UPDATE` on `users` sufficient everywhere those four sites are reached?** Consider
   whether any caller relied on the stronger lock to exclude a key-share holder that DOES matter —
   e.g. something reading `users.plan` for an entitlement decision in the same window.
3. **`create_collection` semantics.** Can the locking SELECT now block something it should not (a
   long-running delete stalling collection creation), return a document the user does not own, or
   silently drop a document that was NOT deleted? Is the empty-list short-circuit correct? Does
   `add_documents_to_collection` — deliberately untouched — still have only the pre-existing
   FK-violation race and no new hazard from this change?
4. **Any remaining path where a transaction locks or WRITES the `users` row and then locks, updates,
   or inserts a child of an EXISTING `documents` row.** The claim is zero such paths after the
   reparse reorder. `UsageRecord.document_id` set inside a settle transaction is named as the one
   thing that would violate it — confirm it is unset on every settle path.
5. **Whole-batch regressions** across B1–B4 that four rounds have not surfaced.

## Out of scope — do not propose

- Changing the delete side's lock ordering or narrowing the parent `FOR UPDATE` held across the
  awaited resolver (adjudicated).
- Raising the four trial mutex locks back to `FOR UPDATE`.
- Changing `add_documents_to_collection` (ruled optional hygiene, explicitly not this round).
- The demo counter accounting redesign; re-mounting `DocumentBriefPanel`; widening the strict quote
  auto-route trigger; Batch A hardening rows 15-18; a `brief_pending` migration.
- Adding `statement_timeout` / `lock_timeout` as a substitute for correct lock ordering.
- The dormant worker-vs-delete advisory-948 cycle: both edges are Postgres waits, so the detector
  aborts one side. Known, detectable, no hang.

## Gates Claude ran on `5f28f0c` (real Postgres + Docker)

| Gate | Result |
|---|---|
| `ruff check app/ tests/` | clean |
| `pytest -q` | 956 passed / 3 skipped |
| `pytest -m integration -q` | 52 passed |
| domain-mode + trial subset | 39 passed |
| collection + deletion + lock-order subset | 8 passed |
| `npm run build` | compiles |
| `npm run test:unit` | 22 passed |

Your sandbox cannot run integration tests or git. Do not report a gate you did not execute.

Write to `.collab/dialogue/2026-09-03-batch-b-codex-r4.md`: verdict line (BLOCK / REVISE / SHIP), then
each finding with severity, exact `file:line`, the concrete failing sequence, and a suggested fix.
