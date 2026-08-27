# Codex adversarial review request — Batch C round 2

Under review: `552bcb8` on `fix/growth-batch-c`.
Your R1: `.collab/dialogue/2026-08-27-batch-c-codex-r1.md` (BLOCK — 2 blockers + 1 revise).

All three were fixed. F1 took the stronger shape you offered: reservations now carry a token and
release is idempotent on both the in-memory and Redis paths, so a second release for the same token is
a no-op rather than a decrement that steals another in-flight request's slot.

## Attack these

1. **Re-audit R1 findings 1–3.** Closed, or closed in appearance only?
2. **The tokenized release.** Does idempotency hold across *both* paths and across process restarts —
   can a token be reused, forged, or collide? Can a reservation now **leak** instead (token issued,
   never released, slot held until TTL) on any path: cancellation before the token is recorded, Redis
   unavailable mid-flight, an exception between reserve and the wrapper taking ownership? A leak is the
   opposite failure and equally breaks the cap.
3. **The re-anchor paths.** Stop/abort and synthesized clean-EOF now both re-anchor. Can a late
   re-anchor from an aborted attempt overwrite a newer count from a subsequent message? Verify the
   `demoAccountingEpoch` and sessionId guards actually cover the two new call sites — that guard exists
   precisely because late resolves used to corrupt the counter. Can Stop followed immediately by a new
   send produce two in-flight re-anchors racing?
4. **Whether the fix widened anything.** Treating synthesized `done` as truncation changes what counts
   as completion. Does that affect non-demo authenticated users, message persistence, share anchors, or
   the continue/regenerate flows?
5. Anything violating `.claude/rules/frontend.md`'s demo-counter contract or `.claude/rules/backend.md`.

## Verdict bar (unchanged)

BLOCK only for: losing money, leaking a paid feature, breaking the demo cap in either direction, or
making a billed search fire without a click. Otherwise REVISE or SHIP, stated plainly. An empty
findings list with a clear rationale is the correct outcome if the batch is sound.

## Verification already run by Claude

ruff clean; `SKIP_INTEGRATION= pytest -q` 946 passed / 3 skipped; `SKIP_INTEGRATION= pytest -m
integration -q` 48 passed; `npm run build` compiles; `npm run test:unit` 19 passed (was 12).

Write to `.collab/dialogue/2026-08-27-batch-c-codex-r2.md`. You cannot run git.
