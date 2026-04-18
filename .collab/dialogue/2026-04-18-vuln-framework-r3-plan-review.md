# Plan Adversarial Review — Round 3 (final check)

r2 verified 10 of 11 r1 fixes but rejected with:
- 1 new blocker (Task 13 `os.environ["RUN_DIR"]` KeyError)
- 3 new must-fixes (incomplete pre-Codex gate, unsafe chunk retry / duplicate cell_ids, empty-glob loop false-fail)

**Fixes applied for r2 issues**:

1. **Task 13 env issue**: Switched to `python3 - "${RUN_DIR}" <<'PY'` passing `RUN_DIR` as `sys.argv[1]`, no env var dependency.
2. **Pre-Codex gate free-pick**: Gate now checks billing bucket hit, llm_processing bucket hit, all three picks in known-bucket union (billing ∪ llm ∪ free), and no duplicates.
3. **Chunk dedupe & conflict detection**: After each chunk validation, a Python block reads `codex/manifest.yaml`, flags hard failure on entries with the same `cell_id` but differing field values (indicates Codex produced inconsistent outputs for a cell), otherwise dedupes by keeping last write (so retry-after-fix works cleanly).
4. **Empty-glob safety**: Replaced all `for f in .../*.md; do ...` loops with Python blocks using `.glob("*.md")`. Each loop now reports counts explicitly. For Claude matrix pass, empty findings = hard fail (unexpected for 336-cell run). For chunk-level Codex validation, empty findings = OK (chunk may legitimately be all-clear).

**File**: `.collab/plans/2026-04-18-vuln-hunt-framework-implementation.md`

**Your job**: confirm all 4 r2 issues closed, flag any new blockers. Should be terse — this is a final check, not a full re-review. If approved, the plan is locked.

Format:
```
## r2 FIXES VERIFIED
- [Task 13 env] ✅ / ❌
- [free-pick gate] ✅ / ❌
- [chunk dedupe] ✅ / ❌
- [empty-glob] ✅ / ❌

## NEW BLOCKERS
- ...

## VERDICT
APPROVE / REJECT
```
