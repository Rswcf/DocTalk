# Plan Adversarial Review

You already participated in the **design** of this vuln-hunt framework (`.collab/plans/2026-04-18-vuln-hunt-framework-design.md`). Now Claude has written the **implementation plan** that executes the design.

**Plan file**: `.collab/plans/2026-04-18-vuln-hunt-framework-implementation.md`

Your job: **must-fix-only adversarial review**. Skip nice-to-haves.

Focus on:

1. **Task ordering bugs** — does any later task depend on something an earlier task never produced? Example: Task 11 Step 2 says "write `claude/crossread/S<#>-<slug>.md`" — is the `crossread/` directory created in Task 8 or do we hit a missing-dir error?
2. **Schema drift** — does the code in Task 4 validator match the schema fields used in the fixture in Task 2? Cross-check `cell_id` regex, enum sources, required fields.
3. **Codex dispatch realism** — Task 10 tells Codex to write under `.collab/vuln-hunt/runs/<ts>/codex/` and read enums from the same directory. Is anything broken in how I've framed that prompt? Would Codex actually reliably produce 336 valid findings in one invocation, or does it need chunking?
4. **Freeze correctness** — Task 11 freezes BEFORE cross-read. Cross-read then writes to `crossread/`. My freeze.yaml includes the full tree — so will the subsequent cross-read trigger "already frozen" errors?
5. **TDD scope** — Tasks 2–5 TDD the scripts. Any test that's critical and missing? e.g., I didn't test `validate` on a Matrix B finding with `invariant_state`.
6. **Phase A gate** — Task 7 gates Phase A before Phase B. Is that the right gate point, or should there be an earlier sanity checkpoint?
7. **Time budget sanity** — Phase B Task 8 (336 cells @ 20-30s/cell for Claude). Can Claude actually sustain that? Or should I chunk Matrix pass into sub-tasks (per row) to avoid context blowup?
8. **Commit discipline** — Phase A commits per task. Phase B commits only at the end. Is that intentional, or should there be intermediate commits during Phase B in case of mid-run failure?

For each issue:
- **Severity**: blocker / must-fix / nice-to-have
- **Task / line**: specific pointer
- **Fix**: concrete change

Only report blockers and must-fixes. If everything is fine, say so.

Format:
```
## BLOCKERS
- ...
## MUST-FIX
- ...
## VERDICT
APPROVE / APPROVE_WITH_FIXES / REJECT
```

Terse. You don't need to re-review design choices; only implementation correctness.
