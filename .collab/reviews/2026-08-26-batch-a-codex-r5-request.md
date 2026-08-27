# Codex adversarial review request — Batch A round 5 (closing round)

Under review: working tree at `eb5977e` on `fix/growth-batch-a`.
Chain: `580ad19` → `298088f` → `76efcc1` → `0781f88` → `f899277` → `eb5977e`.
Prior: R1 BLOCK, R2 REVISE, R3 BLOCK, R4 BLOCK — `.collab/dialogue/2026-08-26-batch-a-codex-r*.md`.

**This is the closing round.** Across four rounds you have found and we have fixed: a broken Plus→Pro
upgrade path, an infinitely resettable Domain Mode trial, a Content-Type resource-cap escalation, a
Pro→Plus downgrade funnel, a credit-minting extraction refund, and a permanent credit+slot strand. R4
independently confirmed no reconcile/refund race, no unbounded decompression, no paid-feature leak, no
duplicate subscription path, and no page-cap regression against the production population.

## What I need from this round

A verdict, and a **severity-honest** one. Specifically:

- If what remains is only LOW/MEDIUM polish, say **SHIP** and list the residue as known issues to be
  tracked separately. Do not return BLOCK for findings that would not lose money, leak a paid feature,
  or reject a document that used to work.
- Reserve BLOCK for a defect in that class. If you find one, say so without hedging.
- An empty findings list with a clear rationale is the correct outcome if the batch is sound.

Please state explicitly whether you consider Batch A to have reached consensus.

## Attack these

1. **Re-audit R4 #1 and #2.** Closed, or closed in appearance only?
2. **The lease mechanism** (migration `20260826_0042`, `extraction_service.py`, the new
   `requeue-stale-running-extractions` beat task). Can two workers hold a lease and both deliver or both
   settle? Can the watchdog reclaim a job that is genuinely still running — the 45-minute lease and
   cadence versus the 2400s visibility_timeout? Can terminal recovery double-refund, or refund a job
   that already delivered a result? Can a released trial slot be double-released or race a fresh claim?
3. **Whether the fix chain has drifted.** Five rounds of edits to billing, extraction, ingestion and
   four documentation files. Is anything now internally inconsistent, dead, or contradicted by a
   different round's change?
4. **Scope honesty.** Anything this batch touched that it should not have, or any invariant in
   `.claude/rules/*.md` it silently weakened.

## Verification already run by Claude

alembic linear `0040 -> 0041 -> 0042`, single head; ruff clean; `pytest -q` 876 passed / 45 skipped;
`SKIP_INTEGRATION= pytest -m integration -q` 42 passed, including
`test_claim_commit_landed_acknowledgement_lost_resolves_in_fresh_session` and
`test_worker_dies_after_claim_late_ack_redelivery_reclaims_after_lease`; `npm run build` compiles;
`npm run test:unit` 12 passed.

## Output

Write to `.collab/dialogue/2026-08-26-batch-a-codex-r5.md`. Verdict BLOCK / REVISE / SHIP, plus an
explicit consensus statement. You cannot run git.
