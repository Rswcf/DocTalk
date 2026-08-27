# Codex adversarial review request — Batch A round 6

Under review: `6d7d15f` on `fix/growth-batch-a`.
Prior: R1 BLOCK, R2 REVISE, R3 BLOCK, R4 BLOCK, R5 BLOCK — `.collab/dialogue/2026-08-26-batch-a-codex-r*.md`.

R5's producer-boundary blocker is fixed: every predebited `DocumentJob` producer now sets the lease in
the same commit as the job and its predebit, and the sweep predicate no longer requires
`worker_lease_expires_at IS NOT NULL` — a queued job older than the lease window, or a running job
stale by the same window, is swept regardless, gated on an unreconciled predebit still existing.
Migration `20260826_0043` adds a server default and backfills. Recovery reuses the existing terminal
path; no second refund implementation was added.

## What I need

1. **Is R5's blocker actually closed**, or closed in appearance only?
2. **Is the broadened sweep predicate now too aggressive?** This is the risk the fix introduces. Can it
   reclaim or fail a job that is legitimately mid-flight — a slow worker, a long OCR run, a retry in
   backoff, a job whose `updated_at` does not advance during long work? The age guard is asserted only
   inline in the chat-native test (`requeue... == 0` on a fresh job). Probe the boundaries yourself.
3. **Any predebited producer still missed**, now or structurally — could a future one forget again?
4. **Fix-chain drift.** Six rounds of edits across billing, extraction, ingestion, job leases and four
   documentation files. Anything internally inconsistent, dead, or contradicted by another round?

## Verdict bar (unchanged from R5, and it worked — R5's BLOCK correctly cleared it)

BLOCK is for a defect that loses money, leaks a paid feature, double-charges, or rejects/destroys work
that previously succeeded. If the residue is LOW/MEDIUM polish, say **SHIP** and list it as known
issues to track separately. An empty findings list with a clear rationale is the correct outcome if the
batch is sound. State explicitly whether Batch A has reached consensus.

## Verification already run by Claude

alembic linear `0041 -> 0042 -> 0043`, single head; ruff clean; `pytest -q` 882 passed / 47 skipped;
`SKIP_INTEGRATION= pytest -m integration -q` 44 passed; `npm run build` compiles; `npm run test:unit`
12 passed.

## Output

Write to `.collab/dialogue/2026-08-26-batch-a-codex-r6.md`. You cannot run git.
