# Batch B — CONSENSUS-SHIP (2026-09-03)

Branch `fix/growth-batch-b`, HEAD `5f28f0c`, based on Batch C @ `6c5d1fa`.
Four adversarial rounds: R1 BLOCK → R2 BLOCK → R3 BLOCK → **R4 SHIP** (empty findings list).
Nine findings closed. Design authority: `.collab/plans/2026-09-03-backlog-decision.md` (Fable 5.1).
Dialogue in `.collab/dialogue/2026-09-03-batch-b-codex-r{1,2,3,4}.md`; fix reports in `.collab/reviews/`.

## What shipped

**B1 — the document brief was never racing; it was unmounted.** The plan diagnosed a first-visit race
between `status='ready'` and the queued brief. The real cause was narrower and older: `7a1546a`
(2026-05-09) removed the Brief tab and left `useDocumentBrief` and `DocumentBriefPanel` with zero
importers, while `documentSummary` was written to the store and read by no component. The bounded
polling and the renderer both already existed. The fix is a mount, not new logic: the hook is consumed
directly in the empty chat pane (summary → up to 3 key points → questions), skipped on demo docs, with
a skeleton while generating and nothing extra on `failed`. The `empty` poll bound widened 10 → 20
attempts. No loader change, no migration. This also made the 40 existing production briefs reachable
for the first time since May.

**B2 — parse failures stop being dead ends.** All 15 terminal parse-worker codes (the decision
document said 13; `OCR_DISABLED` and `QDRANT_CLEANUP_FAILED` were missed) map to specific copy in all
11 locales instead of falling through to "check your connection". Retry is wired to the existing
reparse endpoint from the dashboard row and the reader, and the reader's Retry bumps a `reloadKey` in
the loader's effect deps — without that the poll never re-arms and the button is dead.

Slot rule: `error` documents no longer consume a live plan slot, but errored rows carry their own
ceiling (= plan max) so failures cannot be farmed into unbounded storage, and reparse of an errored
document requires a free live slot so retry-into-success counts again.

**B3 — failed chat bubbles expose Retry** over the existing `regenerateLastResponse` path. No counter
mutation was added, moved or removed. A failed demo answer still consumes a question, deliberately —
the C4 accounting redesign remains superseded.

**B4 — the upgrade nudge loses its 3-impression lifetime cap**, which is what silenced it, and
eligibility moves from `2 docs OR 8 messages` to `1 ready doc AND 3 messages`. Copy says "Pro answers
without the monthly cap", not "unlimited" — Plus is still bounded by the 3,000-credit month.

## Defects found and fixed (four rounds, nine findings)

1. Reparse locked `User.id` but evaluated capacity with the plan the auth dependency loaded *before*
   the lock, so a concurrent plan transition let a downgraded account claim the old ceiling.
2. The Retry button was reachable from error bubbles that are not chat failures — checkout, export,
   share and layout-preview all append `role:'assistant', isError:true` — so "Retry" started a new
   **billed** LLM request instead of retrying what failed. Provenance is now an explicit UI-only
   `retryAction: 'regenerate'` discriminator, never inferred.
3. Regenerate/continue guarded on a *captured* `isStreaming`, so two activations before React
   committed both passed: two demo questions or two credit debits for one retry. **Pre-dated this
   batch** — the hover Regenerate had the same exposure — so the latch sits on the shared path.
4. The brief's polling refresh had no generation guard; document A's late response could paint into B.
5. `_persist_brief_error` reuses the row and sets `error_code` without clearing the payload, so with
   Celery late acks the endpoint can return `status:"failed"` **with** content. Gated at the render
   boundary.
6. `sendMessage` was never in the latch and still used a captured guard, so Retry-then-Send inside one
   render window opened two streams.
7. A transport-level `fetch()` rejection never reached `handleStreamError` — the only path that clears
   `isStreaming` and assigns provenance — so the user got no bubble, no Retry, and the new latch then
   read the stranded flag as permanently busy. Routed through one `errorHandled`-latched invocation.
8. **Reparse ↔ delete lock-order cycle.** Fixing (1) made reparse take `users → documents`; deletion
   takes `documents → (awaited fresh-session resolver) → users`. The closing edge is a Python `await`,
   not a lock wait, so PostgreSQL cannot see the cycle and never aborts it — and with no
   `statement_timeout` or `lock_timeout` configured anywhere in `backend/app`, both operations hang to
   the proxy's 30 s.
9. **`create_collection` reproduced (8) through implicit FK locks.** Flushing `Collection(user_id=...)`
   takes an implicit `FOR KEY SHARE` on the users row held to commit; the junction insert then wants a
   key-share on an existing document.

## The lock-order ruling, and why the fix is on the demand side

Global row-lock order is **`documents` before `users`**; reparse was reordered to lock the document
`FOR NO KEY UPDATE` first and take the `users` lock only when the locked status is `error`.

But "never hold any `users` lock, explicit or FK-implicit, before touching an existing document" is
**not enforceable**. 16 tables carry a `users` FK, and four — `ChatSession`, `DocumentJob`,
`SavedQuote`, `DocumentBiblio` — reference both `users` and an existing `documents` row in a single
INSERT, where the two key-shares are acquired by RI triggers in constraint-creation order that
application code cannot see or reorder.

So the cycle is closed on the **demand** side: the four Domain Mode trial mutex locks
(`domain_mode_access.py:79,173,196,228`) drop from `FOR UPDATE` to `FOR NO KEY UPDATE`. Every demand
the delete-time resolver makes on `users` is now at most NO KEY UPDATE, so implicit FK key-shares from
ordinary inserts on any of the 16 tables can never block it. Mutex semantics are unchanged.

Conflict matrix verified **empirically against this project's own Postgres**, not from documentation:

| Holder | Contender | Result |
|---|---|---|
| `FOR KEY SHARE` | `FOR NO KEY UPDATE` | acquired — no conflict |
| `FOR KEY SHARE` | `FOR UPDATE` | blocked — the defect |
| `FOR NO KEY UPDATE` | `FOR NO KEY UPDATE` | blocked — mutex survives |

`create_collection` was also reordered, but as the **race** fix it actually is: dedupe ids, SELECT the
owned surviving rows `FOR KEY SHARE`, treat that set as the membership, then flush. Delete wins. Today
a delete committing between the `db.get` and the junction insert raises an FK-violation 500.

## Corrections to the design documents, verified at source

- The decision document said 13 terminal parse codes; there are **15**.
- It cited nudge eligibility at `:143-147`; the actual condition was `readyDocumentCount >= 2` at
  `:144`/`:149`.
- The lock-order ruling's enumeration listed collection *deletion* and missed collection *creation*,
  because it searched for explicit `users` locks and not the implicit FK key-share that any user-owned
  INSERT acquires. That gap is what R3 found.
- The ruling named `UsageRecord.document_id` as the invariant's one live trap. **`UsageRecord` has no
  `document_id` column** (`tables.py:606-635`: `user_id` and `message_id` → `messages.id` only); the
  nearby `"document_id"` belongs to the `collection_documents` junction table. So it is four
  same-statement multi-FK tables, not five, and the rules text must not cite that column.

## A latent bug the new test flushed out

The concurrency test was the first thing ever to exercise the reparse loser path, and it failed — the
loser raised `MissingGreenlet`, not 409. The 409 detail read `doc.status` **after**
`await db.rollback()`; rollback expires every ORM attribute regardless of `expire_on_commit`, so that
read attempted lazy IO outside the async greenlet. The locked status is now captured before any
rollback. That shape pre-dated this batch.

## Verification (Claude's own runs against real Postgres + Docker, never the agent's self-report)

| Gate | Result |
|---|---|
| `ruff check app/ tests/` | clean |
| `SKIP_INTEGRATION= pytest -q` | 956 passed / 3 skipped |
| `SKIP_INTEGRATION= pytest -m integration -q` | 52 passed |
| domain-mode + trial subset | 39 passed (mutex weakening changed no slot outcome) |
| collection + deletion + lock-order subset | 8 passed |
| `npm run build` | compiles, 425 pages |
| `npm run test:unit` | 22 passed |
| i18n | 32 new keys, identical set across all 11 locales, all flat |
| palette | no `gray/indigo/violet/purple`, no `transition-all` introduced |
| migrations | none added; sole head remains `20260826_0043` |

Note on the environment: a Homebrew upgrade moved `python3` to 3.14, which has none of the backend
dependencies. The interpreter with them is `/usr/bin/python3` (3.9.6). A gate run that looks like 26
collection errors while `ruff` passes is this, not the code.

## Not yet done

- **Not pushed, not deployed.** `stable` holds v0.29.0 (Batch A + C) locally; Batch B is a separate
  v0.30.0 candidate on its own branch.
- The `.claude/rules/backend.md` paragraph recording the lock-order and demand-side invariants is
  **not written** — it awaits the owner's decision, and must omit the `UsageRecord.document_id` claim.
- `add_documents_to_collection` retains the same pre-existing FK-violation race as `create_collection`
  had; ruled optional hygiene, deliberately out of scope.
- One dormant, *detectable* worker-vs-delete cycle through advisory 948 remains: both edges are
  Postgres waits, so the detector aborts one side. No hang. Left alone.
