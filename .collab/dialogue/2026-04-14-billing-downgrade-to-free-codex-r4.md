# Billing R4 — final approval request (Codex)

Plan v3 addresses your R3 BLOCKING finding.

**Read**: `.collab/plans/billing-cancel-statemachine.md` (see §11 changelog)

## Changes vs v2

1. **Branch A precondition** (§5.1): fixed to "non-empty, starts with
   `sub_`, not `"pending"`" — no more UUID confusion
2. **Branch F new** (§5.1): explicit malformed-ID fail-closed branch
   → 409, no local revert
3. **Precondition totality statement** added: every state maps to
   exactly one branch in D→E→A→F→C→B order
4. **New test case** in §7.1: malformed sub_id → 409 regression

## Your task

If these fixes resolve the R3 blocker and you see no new issues,
reply:

```
APPROVED

(non-blocking nits, optional)
```

Otherwise BLOCKING with line-referenced issues.

## Path

`.collab/dialogue/2026-04-14-billing-downgrade-to-free-codex-r4-response.md`
Under 300 words.
