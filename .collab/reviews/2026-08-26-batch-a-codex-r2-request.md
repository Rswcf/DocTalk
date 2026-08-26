# Codex adversarial review request — Batch A round 2

Under review: the full working tree at `76efcc1` on `fix/growth-batch-a`
(`580ad19` original + `298088f` your R1 findings 2/3/5 + `76efcc1` your R1 findings 1/4 + page caps).
Your R1 review: `.collab/dialogue/2026-08-26-batch-a-codex-r1.md` (verdict BLOCK).

Owner decisions taken since R1:
- Domain Mode entitlement unit = **one free session** (unlimited messages within the owning session).
- The A4 file-size raise **stands** (Free 50 / Plus 100 / Pro 200 MB).
- Claude added a requirement you did not raise: enforced per-plan **page** caps (Free 750 / Plus 1500 /
  Pro 3000), because `MAX_PDF_PAGES` and `MAX_PDF_SIZE_MB` both had no reader anywhere, production
  already holds a 696-page document, and upload/parse debits no credits — so page count, the real
  driver of embedding and paid-OCR spend, was unbounded and free.

## Attack these specifically

1. **Re-audit your own R1 findings 1–5.** For each, is it actually closed, or closed in appearance only?
   Be willing to say a fix is worse than the bug.
2. **`feature_trial_usages` claim path** (`backend/app/services/domain_mode_access.py`,
   `backend/app/models/tables.py`, migration `20260826_0041`).
   - Is the `SELECT ... FOR UPDATE` on the user row genuinely held until the caller's transaction
     commits on BOTH entry points? Chat passes `commit_claim=True`; extraction commits later with the
     job. Can either path release the lock before the reservation is durable?
   - Can a slot leak — claimed but never usable — if chat streaming fails after the claim commits?
     The docstring says reservations are permanent. Is that the right call for a free trial, and is it
     what the tests assert?
   - Partial unique indexes on `owning_session_id` / `owning_job_id`: can a NULLed pointer (after the
     owner is deleted) collide, orphan a slot, or let `slot_index` reuse resurrect a trial?
   - Is the "session already owns a slot" fast path safe when `sessions.domain_mode` has been cleared?
3. **Page caps.** Where exactly is the count taken, and is it before object storage and the `documents`
   INSERT on BOTH upload and URL import? Can a document be counted, rejected, and still consume a
   free-plan document slot or leave an orphaned storage object? Is the page count trustworthy for
   encrypted, malformed, or streaming PDFs — and what happens if it cannot be determined?
4. **Deleting the dead knobs.** `MAX_PDF_PAGES` and `MAX_PDF_SIZE_MB` are gone from config but are still
   SET in Railway production env. Confirm nothing (entrypoint, settings validation, docs tooling) breaks
   on an unknown env var, and flag any remaining surface that still implies the old limits.
5. **URL byte caps.** Does the plan-derived cap reach every path in `url_extractor.py`, including
   redirects and content-type sniffing? Can an HTML page still pull 200 MB, or is the defensive 10 MB
   cap intact for non-PDF responses?
6. Anything in `.claude/rules/backend.md` / `.claude/rules/frontend.md` this now violates. Both files
   were edited in this batch — check the edits are accurate rather than aspirational.

## Verification already run by Claude

`alembic heads` = single head `20260826_0041`; `ruff check app/ tests/` clean; `pytest -q` 839 passed /
38 skipped; `SKIP_INTEGRATION= pytest -m integration -q` 35 passed; `npm run build` compiles;
`npm run test:unit` 5 passed.

## Output

Write to `.collab/dialogue/2026-08-26-batch-a-codex-r2.md`. Verdict BLOCK / REVISE / SHIP with numbered
findings, each with file:line and a concrete fix. If the batch is shippable, say so plainly — do not
manufacture findings to look thorough. You cannot run git.
