# Section 3: Output Schema — Round 1

Section 1 (rows) + Section 2 (columns) LOCKED. This section defines the exact shape of one finding so that Claude's and Codex's independent outputs can be **diffed mechanically**, not by reading prose.

## Constraint

Any field that requires free-form interpretation prevents clean diff. Any missing field loses signal. Target: enough structure for automated comparison, enough narrative for a human to fix the bug.

## Claude's Draft Schema

Each finding is a markdown block with this exact frontmatter + body:

```yaml
---
id: A-<row>-<col>-<seq>          # e.g. A-03-C7-01 (matrix A, row 3 /api/chat, col C7 idempotency, finding 1)
matrix: A | B                     # ingress matrix or invariant matrix
row: <row number>                 # 1..24 (A) or 1..8 (B)
row_label: "<short name>"         # e.g. "chat SSE" — human anchor
column: <column id>               # C1..C12 or D1..D6
column_label: "<short name>"      # e.g. "idempotency/replay"
severity: P0 | P1 | P2 | P3       # P0 critical (data loss/security breach), P1 high (exploitable bug), P2 medium (edge case), P3 low (hardening)
confidence: high | medium | low   # high = read the code + can repro; medium = read the code; low = inference
status: bug | risk | deficiency | clear
# bug: reproducible flaw
# risk: correct code, but operating mode creates exposure (e.g. Stripe test mode live)
# deficiency: missing defense-in-depth (not a bug per se)
# clear: cell reviewed and no finding
files: ["path/to/file.py:123", "..."]
exploit_preconditions: ["network access", "authenticated free-tier user", ...]
---

## Observation
<1–3 sentences, what you saw in the code. Cite file:line.>

## Impact
<1–2 sentences: what happens if exploited / triggered.>

## Repro / Evidence
<concrete steps, curl, unit test, or code trace. Omit for `status: clear`.>

## Suggested Fix
<1 paragraph or bulleted. Reference the minimum diff.>
```

For `status: clear`, the body collapses to one line: `Reviewed, no finding. Rationale: <why>`.

## Constraints per Field

- `id` — must be unique per agent's output; enables diff tooling later
- `severity` — both agents must grade independently; severity disagreement is itself a finding
- `confidence` — low-confidence findings do NOT inflate severity; they go into a "to-verify" bucket in reconcile
- `files` — always an array, always `path:line` format, always relative to repo root
- `exploit_preconditions` — forces explicit enumeration, prevents "attacker has root" hand-waving

## Diff Protocol Preview (full version in Section 5)

After both agents emit, we compare:
1. **Cell coverage diff** — which `(row, column)` cells did only one agent produce a non-`clear` finding for? → blind spots.
2. **Same-cell divergence** — both agents flagged the same cell but differ on severity / root cause? → needs tie-break round.
3. **Preconditions diff** — same finding, but different `exploit_preconditions`? → one agent sees a shortcut the other missed.

## Your Job

1. **Is the schema sufficient?** Anything the diff tooling needs that I missed (e.g. `cwe`, `cvss`, `affected_version`, `first_introduced_commit`)?
2. **Is the schema overkill?** Any field I should drop because it'll create noise or ritual?
3. **`status: clear` entries** — should we emit them for every `(row, column)` cell (so the matrix is fully covered)? Or only for cells that were "suspicious but then cleared on closer look"? First option is exhaustive but massive; second might hide uninspected cells.
4. **Severity calibration** — P0/P1/P2/P3 is project-standard (from `.collab/plans/004-systematic-bug-hunt.md`). Codex's grading heuristic, please state yours: what makes P0 vs P1 in *this* codebase? (User has paying customers, no enterprise/regulated data, PII minimal.)
5. **Confidence vs severity** — should `confidence: low + severity: P0` be allowed, or auto-downgraded?
6. **For Matrix B findings** — add `invariant_state: held | partial | broken` instead of (or in addition to) `status`?

Format:
```
## SCHEMA CHANGES
- add/drop/rename field — rationale
## CLEAR-CELL POLICY
- <proposal>
## SEVERITY CALIBRATION (yours)
- P0: ...
- P1: ...
- P2: ...
- P3: ...
## CONFIDENCE × SEVERITY
- <rule>
## VERDICT
AGREE / AGREE_WITH_CHANGES / DISAGREE
```

Terse.
