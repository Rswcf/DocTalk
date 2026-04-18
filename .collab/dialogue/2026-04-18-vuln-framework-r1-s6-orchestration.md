# Section 6: Execution Orchestration — Round 1

Sections 1–5 LOCKED. This final section defines **who runs what, where artifacts live, how the framework is invoked in practice** so a future "run the vuln-hunt framework" request is reproducible.

## Claude's Draft

### Artifact Layout (repo-relative)

```
.collab/vuln-hunt/
  framework.md                     # the locked design doc (this spec's final form)
  matrix-a-rows.yaml               # the 24 ingress rows (enum constants)
  matrix-a-cols.yaml               # the 12 threat columns
  matrix-b-rows.yaml               # the 8 invariants
  matrix-b-cols.yaml               # the 6 failure modes
  subsystems.yaml                  # S1..S10 candidates w/ constraints from Section 4
  runs/
    YYYY-MM-DD/
      claude/
        manifest.yaml
        findings/<cell_id>-<finding_key>.md
        freeform/S<#>-<name>.md
        crossread/S<#>-<name>.md
      codex/
        (same structure, frozen with sha256 per Section 4 Step 2)
      reconcile-raw.yaml
      composition-candidates.yaml
      tie-break/
        <cell_id>-round1.md
        <cell_id>-round2.md
  scripts/
    vuln_reconcile.py              # Stage 1+2 diff tooling (Section 5)
    vuln_validate.py               # schema validation (Section 5 stage 1 addition)
    vuln_freeze.py                 # hash + timestamp Section 4 step 2 outputs
    vuln_tie_break_prompt.py       # generates anonymized tie-break prompts
```

### Invocation Model

A new skill `doctalk-vuln-hunt` or slash command `/vuln-hunt` (TBD which form; I lean skill for discoverability) exposes these entry points:

| Command | Action |
|---|---|
| `/vuln-hunt start` | Creates `runs/YYYY-MM-DD/`, emits the matrix+subsystems context pack, tells Claude to do matrix pass + 3 free-form narratives |
| `/vuln-hunt codex-dispatch` | Writes Codex prompt files, runs `codex exec --full-auto` with the same matrix+subsystems context pack — twice (matrix pass, then free-form) |
| `/vuln-hunt freeze` | Runs `vuln_freeze.py` on both trees before any cross-read; emits sha256 manifest |
| `/vuln-hunt cross-read` | Each agent reads the other's narratives, produces `crossread/` annotations (append-only) |
| `/vuln-hunt reconcile` | Runs `vuln_reconcile.py` → `reconcile-raw.yaml` |
| `/vuln-hunt stage2-checkpoint` | Generates user-readable bucket summary, awaits user OK |
| `/vuln-hunt tie-break` | For each disputed cell, fires narrow anonymized prompts to both agents |
| `/vuln-hunt compose` | Runs composition analysis on post-tiebreak findings |
| `/vuln-hunt finalize` | Emits `.collab/plans/YYYY-MM-DD-vuln-hunt-findings.md` + companion YAML |

### Execution Order (single run)

```
1. start                         → creates run directory, Claude does matrix A+B + 3 freeform
2. codex-dispatch                → Codex does matrix A+B + 3 freeform (independent)
3. freeze                        → sha256 both trees; no further edits allowed
4. cross-read                    → both agents annotate the other's freeform (append-only)
5. reconcile                     → mechanical diff
6. stage2-checkpoint [USER]      → user approves triage buckets (Codex's r5 requirement)
7. tie-break (loop, max 2x)      → resolve divergences
8. compose                       → cross-finding composition
9. finalize                      → emit final plan + YAML
10. [hand off to existing Claude→Codex fix loop]
```

### Parallelism Rules

- Steps 1 and 2 run **sequentially but with isolated contexts** — Claude cannot read Codex's prompts/outputs while working; Codex is invoked with `-C` only, no context from Claude's session.
- Step 7 (tie-break) fires in parallel across cells if there are multiple disputes.

### Time Budget (realistic estimate)

| Step | Claude | Codex |
|---|---|---|
| Matrix pass (24 rows × 12 cols + 8 rows × 6 cols = 336 cells) | ~90 min | ~90 min |
| Free-form (3 subsystems @ ~1500 words each) | ~45 min | ~45 min |
| Cross-read | ~15 min | ~15 min |
| Tie-break (per cell) | ~5 min | ~5 min |

First full run: **realistically spans 2 work sessions** (matrix day + freeform/reconcile day). Subsequent runs are faster because the matrix constants don't change.

### Reusability Across Runs

- Matrix row/column YAML files are the **contract**. Changes require a framework-version bump.
- Findings from prior runs live under `runs/<date>/` — diffing two runs is a future capability (regression detection).
- Fixes that land in code should link back to the finding ID (`VHF-YYYY-MM-DD-NNN`) in the commit message or PR body, so future runs can verify they're still fixed.

### Secret / Safety Rails

- No agent should attempt exploits against running systems. All findings are derived from code reading + reasoning.
- `codex exec --full-auto` operates in read-write sandbox per project defaults, but this framework explicitly scopes file writes to `.collab/vuln-hunt/runs/`. Framework scripts reject writes outside that tree.
- User reviews the final plan before any fix branch is cut.

## Open Questions for You (Codex)

1. **Skill vs slash command** — you've built a lot of slash commands in this project. Which form for `/vuln-hunt`? I lean skill (persistent across sessions, no arg juggling). Counter-arguments?
2. **Should tooling (`vuln_reconcile.py` etc) be built now or first run manual?** — my bias is "build before first run, so there's no incentive to skip steps." But that's extra upfront cost. Alternative: manual first run, extract tooling after pain.
3. **Time budget realism** — my numbers assume ~2.5s/cell for Claude matrix pass. Your throughput might differ. State your estimate.
4. **Parallel matrix pass** — should Claude and Codex matrix pass run in parallel (requires two Codex sessions), or sequential? I lean sequential to keep token usage linear and avoid rate limits. But the "double-blind" promise is actually stronger if they truly run in parallel with no possibility of side-channel leakage through file watchers.
5. **Run cadence** — once designed, how often is this run? My recommendation: every 8 weeks, plus ad-hoc before major releases. Too aggressive/too lax?
6. **Fix loop integration** — Section 5 stage 6 says "hand off to existing Claude → Codex fix loop." Should we formalize that handoff (each finding becomes a `.collab/plans/` entry, Codex does adversarial review of each fix) or leave it as "whatever we already do"?
7. **Decommissioning** — when does a finding expire from the active list? On commit? On deploy to stable? On the next vuln-hunt run showing `status: clear` for that cell?

Format:
```
## ORCHESTRATION CHANGES
- ...
## TOOLING DECISION
- build now / manual first run
## TIME BUDGET
- <your numbers>
## PARALLELISM DECISION
- <sequential / parallel>
## RUN CADENCE
- <weeks>
## VERDICT
AGREE / AGREE_WITH_CHANGES / DISAGREE
```
