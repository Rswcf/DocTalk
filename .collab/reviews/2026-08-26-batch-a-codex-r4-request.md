# Codex adversarial review request — Batch A round 4

Under review: working tree at `f899277` on `fix/growth-batch-a`.
Chain: `580ad19` → `298088f` (R1 #2/#3/#5) → `76efcc1` (R1 #1/#4 + page caps) → `0781f88` (R2 #1–#5)
→ `f899277` (R3 #1–#2).
Prior: R1 BLOCK, R2 REVISE, R3 BLOCK — all in `.collab/dialogue/2026-08-26-batch-a-codex-r*.md`.

Round 4. We are looking for consensus or a genuine remaining blocker.

## Decisions taken since R3 (do not relitigate unless they are actually unsafe)

- **URL import is a flat 10 MB feature for every plan.** You offered this or a documented
  "PDF-magic candidate" class; we took the flat cap because URL import has 3 lifetime uses by 2 users
  and died 2026-05-31, so removing the attacker-controlled branch beat hardening it. Direct upload
  keeps the per-plan 50/100/200 MB caps.
- Domain Mode entitlement = one free session; a slot releases only when no result was delivered and
  credits were refunded.

## Attack these

1. **Re-audit R3 #1 and #2.** Closed, or closed in appearance only?
2. **The extraction settlement repair** (`extraction_service.py`). This is the one that could mint
   credits, so be unsparing: does reconcile lock and stamp on EVERY path including equal cost? Is every
   refund conditional on `reconciled_at IS NULL`? Do ALL final-commit exceptions reach the resolver in a
   FRESH session? Can resolver failure still fall through to a blind refund anywhere? Does the trial
   release ride the same transaction as the winning conditional refund — and can refund and release now
   disagree (one commits, the other does not)?
3. **The bounded URL read.** Are BOTH raw-consumed and decoded-output bounded, such that a
   gzip/deflate/Brotli/Zstd bomb fails closed before allocation? Any path — redirects, streaming,
   `Content-Length` trust, chunked transfer — where more than 10 MB can still be read or retained?
4. **Regression sweep across the whole batch.** Anything that loses money, leaks a paid feature,
   double-charges, or rejects a document that previously worked. Confirm the page caps still cannot
   reject any document present in production today (largest is 696 pages; all 164 users are on free,
   whose cap is 750).
5. **Documentation honesty.** `.claude/rules/backend.md`, `.claude/rules/frontend.md`,
   `docs/ARCHITECTURE.md` and user-facing copy were edited repeatedly across four rounds. Verify every
   statement is now true of the code, not aspirational. You flagged inaccurate wording twice; this is
   the last chance to catch a third.

## Verification already run by Claude

`alembic heads` single head `20260826_0041`; ruff clean; `pytest -q` 871 passed / 42 skipped;
`SKIP_INTEGRATION= pytest -m integration -q` 39 passed; the new
`test_commit_landed_acknowledgement_lost_keeps_extraction_succeeded` passes; `npm run build` compiles;
`npm run test:unit` 12 passed.

## Output

Write to `.collab/dialogue/2026-08-26-batch-a-codex-r4.md`. Verdict BLOCK / REVISE / SHIP.
**If it is shippable, say SHIP plainly** — an empty findings list with a clear rationale is the correct
and useful outcome if the batch is sound. Do not manufacture findings. You cannot run git.
