# Phase 5 review request — docs

## Changes

1. `docs/ARCHITECTURE.md` §10 — new subsection **"Self-serve
   subscription cancel state machine"** ~70 lines, covering:
   - Branch table (D/E/A/F/C/B)
   - Fail-closed contract
   - `plan_transitions` audit scope (cancel-only, webhook deferred)
   - `billing_state` projection contract + cache invariant
   - Frontend BGB §312k compliance note
   - Test inventory

2. `.collab/plans/billing-cancel-statemachine.md` — added
   **Status: Implemented 2026-04-14** header pointing to
   `docs/ARCHITECTURE.md §10`.

## What's NOT in this phase

- No code changes
- No additional tests (Phases 2-4 tests are sufficient: 33 total
  covering branches + billing_state projection + cache paths)
- No CHANGELOG (repo doesn't keep one; architecture doc is the
  authoritative record)

## Review request

Output: `.collab/reviews/2026-04-14-billing-phase5-docs-response.md`

APPROVED if:
- Architecture doc subsection is technically accurate vs the merged
  code behaviour
- No logical gaps between the branch table and §5.1 of the original
  plan
- Cancel state machine description reads correctly standalone (new
  engineer can understand the invariants without reading the code)

BLOCKING if anything misrepresents behaviour.

Under 250 words.
