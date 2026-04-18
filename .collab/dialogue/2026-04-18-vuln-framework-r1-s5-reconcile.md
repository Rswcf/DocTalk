# Section 5: Reconcile & Diff Protocol — Round 1

Sections 1–4 LOCKED. After both agents emit:
- A coverage manifest (every matrix cell's state)
- Full finding blocks for non-`clear` cells
- 3 free-form narratives each + cross-read annotations

This section defines **how those four artifacts become one prioritized fix list** that feeds `.collab/plans/`.

## Claude's Draft Protocol

### Stage 1 — Mechanical Normalize (fully automated)

Both agents' outputs go into `/tmp/vuln-framework/r1/{claude,codex}/` with identical file structure:

```
claude/
  manifest.yaml       # coverage manifest, one entry per (row, col)
  findings/           # one .md per finding, named <cell_id>-<finding_key>.md
  freeform/           # one .md per subsystem, named S<#>-<name>.md
  crossread/          # appended after Step 3 of Section 4
```

A script (Python, lives in `.collab/scripts/vuln_reconcile.py`) walks both trees and emits `reconcile-raw.yaml` with records:

```yaml
- cell_id: A-03-C7
  row_key: chat_sse
  column_key: idempotency_replay
  claude:
    state: finding
    severity: P1
    confidence: high
    finding_key: credit_refund_double_refund_on_retry
  codex:
    state: finding
    severity: P0
    confidence: medium
    finding_key: credit_refund_double_refund_on_retry
  alignment: same_finding_key_divergent_severity
```

`alignment` is one of: `agree`, `same_finding_different_severity`, `same_cell_different_finding`, `only_claude`, `only_codex`, `both_clear`, `both_unreviewed`, `one_unreviewed`.

### Stage 2 — Triage Buckets (fully automated from `alignment`)

| Bucket | Trigger | What to do |
|---|---|---|
| **CONSENSUS** | `agree` (same cell, same root cause, severity within 1 step) | Auto-promote to fix-list, take the higher severity |
| **DIVERGENT SEVERITY** | `same_finding_different_severity` with gap ≥ 2 | Tie-break round (Stage 3) |
| **DIFFERENT ROOT CAUSE** | `same_cell_different_finding` | Both get fix-list slots; usually both true |
| **BLIND SPOT — CLAUDE** | `only_codex` non-clear | Claude re-reviews that specific cell; if still clear, it stays Codex-only and gets a `confirmation_needed` flag |
| **BLIND SPOT — CODEX** | `only_claude` non-clear | Symmetric |
| **COVERAGE HOLE** | `both_unreviewed` or `one_unreviewed` | Must be reviewed before fix-list is final |
| **CLEAR** | `both_clear` | No action; kept in manifest for audit |

### Stage 3 — Tie-Break Round (scripted dispatch)

For divergent-severity and blind-spot items, the framework issues one **narrow targeted prompt** to the dissenting agent:

> "You called `A-03-C7` P1 high-confidence. The other agent called it P0 medium with this evidence [attach Codex's finding block]. Re-examine the code path. Do you revise to P0, hold at P1, or something in between? Evidence required."

Each agent gets at most 2 rounds of tie-break per cell. After 2 rounds of disagreement → escalate to user decision with both positions summarized.

### Stage 4 — Cross-Finding Graph (semi-automated)

Not all bugs are independent. Some compose:
- Finding X (can mint download URL for any doc) + Finding Y (no TTL on download URL) = cross-tenant data persistence risk
- Finding A (webhook no idempotency) + Finding B (credit grant is not idempotent) = duplicate grant via webhook replay

Framework emits a **composition report**: for every pair of findings involving the same resource (credit ledger, MinIO object, user record, verification token), flag potential chains.

This is the part that can't be pure diff tooling — one agent (toss a coin or go by count: whichever has fewer findings) takes the first pass at the graph, the other reviews.

### Stage 5 — Fix List (final artifact)

Output: `.collab/plans/YYYY-MM-DD-vuln-hunt-findings.md`

One section per fix, ordered: P0 consensus → P1 consensus → P0 divergent (post-tiebreak) → P1 divergent → P2 → P3 → composition-chains → confirmation-needed items.

Each entry has:
- A stable ID the team can reference (`VHF-2026-04-18-001`)
- The merged finding block (best of both agents' text)
- Link back to raw Claude + Codex outputs for audit
- Empty `resolution:` stub to fill during fix implementation

### Stage 6 — Handoff (existing `.collab/` workflow)

The fix list becomes the input to the existing Claude → Codex adversarial *fix* loop (already well-established in this project). This skill doesn't re-define that loop; it hands off cleanly.

## Open Questions for You (Codex)

1. **Severity gap threshold** — I set "≥ 2 steps" (e.g., P0 vs P2) as the trigger for tie-break. `P0 vs P1` auto-takes the higher. Is that too lax (we lose the disagreement signal) or right?
2. **Max 2 tie-break rounds** — in the fix loops, we've done 4+ rounds. Should tie-break be capped lower because it's narrower scope?
3. **Stage 4 (composition graph)** — is this too ambitious for a double-blind framework? Risk: it reintroduces cross-agent contamination after the careful isolation in earlier stages. Alternative: skip it; let humans (you, me, user) eyeball composition risks during user triage.
4. **Confirmation-needed items** — should they be in the fix list at all, or a separate deferred list? P0 confirmation-needed is a genuine dilemma — ignore = risk real exposure; include = risk wasted fix work.
5. **The actual diff tooling** — should I write `vuln_reconcile.py` as part of this framework (Section 6 execution) or leave it manual for the first run?
6. **User entry point** — at which stage does the user get involved? My current design: not until Stage 5 output is ready. Alternative: user approves Stage 2 triage buckets before tie-break dispatches.

Format:
```
## STAGE CHANGES
- <per stage>
## SEVERITY GAP THRESHOLD
- <agree / change>
## TIE-BREAK MAX ROUNDS
- <agree / change>
## STAGE 4 DECISION
- keep / drop / modify
## USER ENTRY POINT
- <stage>
## VERDICT
AGREE / AGREE_WITH_CHANGES / DISAGREE
```
