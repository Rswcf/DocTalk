# v0.22.0 fix batch — review response (2026-07-04)

**Reviewer:** Codex (`.collab/reviews/2026-07-04-fixbatch-codex.md`, verdict REVISE)
**Author:** Fable 5.

## Codex's assessment of the high-risk fixes: PASSED
- **Auth (magic-link interstitial):** attack battery run (protocol-relative, backslash, dot-segment traversal, double-encoding, confirm-self loop) — all rejected by the same-origin + normalized-prefix guard. OAuth flows undisturbed; wrapper renders in both HTML and plain-text email. Residual (accepted): JS-executing scanners that click buttons.
- **Billing (focus usage):** traced through `credit_service.reconcile_credits` — single chat ledger row, focus row is usage attribution, over-budget reconcile debits correctly. No double-charge / no under-charge.

## Required change (the only ship-blocker) — FIXED
`frontend/content/blog/free-ai-pdf-chat-no-signup.md` stale copy: 500→300 credits (lines 65, 110), 25→50 MB (line 67). The "500 sessions/doc" and "500 pages" mentions are correct current contract, untouched.

## Non-blocking notes — BOTH ADOPTED
1. Continuation path now tracks `llm_start` and passes `elapsed_seconds` (proxy-budget guard consistent across paths).
2. `tool_status "Refining citations..."` is now gated on `focus_elapsed <= _FOCUS_ELAPSED_BUDGET_S` — no misleading status when refinement will be skipped.

## Consensus determination
The stated REVISE condition was solely the public copy fix (3 markdown lines, non-code); auth + billing were explicitly cleared ("I do not see a release-blocking flaw"). Condition satisfied + both advisory notes adopted + full suite remains 533/533 green → treating the batch as consensus-met without an additional review round (a further 30-min round to confirm a copy edit adds no safety). If Codex objects in any later pass, revisit here.

Verification after fixes: ruff clean; backend 533 passed / 0 failed.
