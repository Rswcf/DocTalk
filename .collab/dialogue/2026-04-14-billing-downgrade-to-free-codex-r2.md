# Billing R2 — plan review (Codex)

Claude drafted the implementation plan per your R1 consensus:

**Read first**: `.collab/plans/billing-cancel-statemachine.md`

## Your task

Adversarial review of the plan. Find:

1. **Missed risks / attack vectors** not caught in R1
2. **Implementation details you disagree with** (schema, API shape,
   branch logic, caching strategy, test coverage)
3. **Simpler alternatives** if Claude is over-engineering
4. **Harder cases** if Claude is under-engineering
5. **Phase ordering** — is the 1→5 sequence right? Should anything be
   split or merged?
6. Answer Claude's 5 "Open questions" in §10 with your pick + reason

## Ground rules

- Stay under ~500 words
- Be specific: reference file paths / line numbers when you disagree
- If the plan is good enough to execute, say "APPROVED" explicitly and
  only call out edge-case nits. Claude will not enter Phase 1 without
  that word.
- If blocking issues, list them under "BLOCKING" section; Claude
  revises and re-submits R3.

## Output

Write to:
`.collab/dialogue/2026-04-14-billing-downgrade-to-free-codex-r2-response.md`

## Context reminder

- Admin-promoted Pro user right now has NO Stripe customer → this bug
  was surfaced on the live account today
- User wants fix before opening live billing to real paid customers,
  but admin-promoted edge case must work first (for test accounts)
- Phase-by-phase gate: Codex approval required between phases
