---
name: doctalk-vuln-hunt
description: Execute the DocTalk vulnerability-hunt framework in double-blind Claude+Codex mode. Activates when the user invokes /vuln-hunt or asks to "run the vuln audit", "hunt bugs systematically", or "execute the vuln-hunt framework".
---

# DocTalk Vuln-Hunt Framework — Operator Skill

Full design: `.collab/plans/2026-04-18-vuln-hunt-framework-design.md`
Implementation plan: `.collab/plans/2026-04-18-vuln-hunt-framework-implementation.md`
Framework artifacts: `.collab/vuln-hunt/`

## State Machine

Every run goes through these steps in order. Each step writes its state to `runs/<ts>/run-state.yaml`. Steps cannot be skipped.

`start → codex-dispatch → freeze → cross-read → reconcile → stage2-checkpoint → tie-break → compose → finalize`

## Commands

### `/vuln-hunt start`
1. Create `runs/$(date -u +%Y-%m-%d-%H%M)/` with `claude/{findings,freeform,crossread}`, `codex/{findings,freeform,crossread}`, `tie-break/` subtrees.
2. Write `run-state.yaml` with `state: started`, current `git_sha`, `script_version: 1`.
3. Write `current_run.yaml` pointer.
4. Claude: for each of the 24 Matrix A rows × 12 columns + 8 Matrix B rows × 6 columns = 336 cells, read the referenced code, produce a finding file (non-clear cells) and a manifest entry (every cell). Produce 3 free-form narratives per Section 4 bucket constraints (`subsystems.yaml`).
5. Validate every finding with `vuln_validate.py`.
6. Run pre-Codex gate: Claude manifest covers all 336 cells; picks.yaml has exactly 3 unique picks with billing + llm_processing buckets hit.

### `/vuln-hunt codex-dispatch`
Invoke Codex in **6 chunks** (A1-6, A7-12, A13-18, A19-24, B, FF) via `cat <prompt> | codex exec --full-auto -m gpt-5.3-codex -C <repo-root>`. Each chunk independently validated. Manifest is append-only with dedupe-on-retry (conflict = fail).

### `/vuln-hunt freeze`
Run `vuln_freeze.py claude/` and `vuln_freeze.py codex/`. Excludes `crossread/` and `tie-break/` from the hash so subsequent append-only writes don't trigger refreeze errors.

### `/vuln-hunt cross-read`
Each agent reads the OTHER agent's `freeform/` narratives and appends `crossread/S<#>-<slug>.md`. Only three comment types: `disagree`, `missed-threat`, `reasoning-hole`. New findings → `late-add` tag.

### `/vuln-hunt reconcile`
Run `vuln_reconcile.py claude/ codex/ reconcile-raw.yaml`.

### `/vuln-hunt stage2-checkpoint`
**USER INTERACTION**. Summarize 7 triage buckets with counts; ask user to approve before tie-break spend.

### `/vuln-hunt tie-break`
For each disputed cell, run `vuln_tie_break_prompt.py` to generate anonymized prompts. Send to dissenting agent. Max 2 rounds per cell. Outputs under `tie-break/<cell_id>-round<N>-{to,response}-<agent>.md`.

### `/vuln-hunt compose`
On post-tiebreak accepted findings, cross-reference shared resources (credit ledger, MinIO object, user record, verification token, session, share token) and emit `composition-candidates.yaml`.

### `/vuln-hunt finalize`
**USER INTERACTION** at Stage 5. Emit `../../plans/<ts>-vuln-hunt-findings.md` + `<ts>-vuln-hunt-findings.yaml`. Split into `actionable_fixes` and `confirmation_needed`. Each finding gets `VHF-YYYY-MM-DD-NNN` stable ID.

## Safety Rails
- No agent executes exploits. Findings are code-reading + reasoning only.
- Scripts reject writes outside `.collab/vuln-hunt/runs/<current-run>/`.
- Codex is always invoked with `--full-auto -m gpt-5.3-codex -C <repo-root>` and prompted NOT to read `claude/`.

## Time Budget
First full run: ~7–9 hours wall-clock, 2 sessions (matrix day + freeform/reconcile day).

## Cadence
Baseline every 8 weeks; ad-hoc before major releases or after architecture changes to auth, billing, or parser.

## Triage Rules (from design §5 Stage 2)

Alignment + severity gap + P0 asymmetry decide routing:

| Bucket | Trigger |
|---|---|
| CONSENSUS (auto-promote) | `agree` — gap 0 OR (gap 1 AND no P0 asymmetry); take higher severity |
| DIVERGENT SEVERITY (tie-break) | gap ≥ 2 OR P0 asymmetry |
| DIFFERENT ROOT CAUSE | same cell, different `finding_key` — both promoted |
| BLIND SPOT | `only_claude` / `only_codex` non-clear → re-review by other side |
| COVERAGE HOLE | `unreviewed` on either side — must review before final |
| CLEAR | both clear — audit-kept |

Precedence: `unreviewed` beats all → root-cause mismatch → severity mismatch.
