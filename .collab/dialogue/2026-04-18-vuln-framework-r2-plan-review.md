# Plan Adversarial Review — Round 2

You rejected the implementation plan in r1 with 5 blockers + 6 must-fixes. I've applied all fixes. Please re-review:

**File**: `.collab/plans/2026-04-18-vuln-hunt-framework-implementation.md`

**Fixes applied**:

1. **Run-ID plumbing** — added `current_run.yaml` in Task 1; every Phase B task reads `RUN_TS` via Python one-liner; Tasks 8/10/11/13/14 use consistent `${RUN_DIR}` variable.
2. **cell_id regex** — moved to 2-digit zero-padded column convention (`A-03-C07` not `A-03-C7`); validator regex + range checks now enforce 01–24 rows × 01–12 cols for A, 01–08 × 01–06 for B; all examples throughout plan updated.
3. **Manifest shape** — standardized on top-level YAML list per design spec §3; reconcile test writes the list shape; reconcile `load_manifest` accepts list + tolerates legacy `{entries:[...]}`.
4. **Triage rule correctness** — `classify()` now returns alignment + `severity_gap` + `p0_asymmetry` + `severity_disputed`; gap ≤ 1 without P0 asymmetry → `agree`; gap ≥ 2 OR P0 asymmetry → `same_finding_different_severity`. Four tests cover: gap=0 agree, gap=1 no-P0 agree+disputed, gap=1 with P0 tie-break, gap=2 tie-break.
5. **Task 13 yq removal** — replaced with inline Python that reads `reconcile-raw.yaml` and iterates disputed cells; explicit `mkdir -p tie-break` at task start.
6. **All subdirs upfront** — Task 8 Step 1 creates `claude/{findings,freeform,crossread}`, `codex/{same}`, `tie-break/` in one mkdir.
7. **Freeze excludes crossread/tie-break** — `vuln_freeze.py` has `EXCLUDED_PREFIXES = ("crossread/", "tie-break/")`; new test `test_freeze_excludes_crossread_and_tiebreak` confirms adding files under those dirs post-freeze does not trigger refreeze errors.
8. **Matrix B validator test coverage** — added `fixtures/valid-matrix-b-finding.md` (with `invariant_state: partial`), `fixtures/invalid-matrix-b-missing-invariant-state.md`, and corresponding tests.
9. **Codex chunking** — Task 10 now dispatches 6 chunks (4 × Matrix A row-batches, 1 Matrix B, 1 freeform). Each chunk independently validated. Failure mode: re-run single chunk, manifest append-only.
10. **Pre-Codex gate** — new Task 9 Step 4 runs Python check: Claude's manifest has all 336 expected cells AND picks.yaml satisfies bucket constraints. Fails hard if not.
11. **Phase B intermediate commits** — commit points added after Task 8 (Claude matrix), Task 10 (Codex pass), Task 11 (freeze+reconcile), Task 13 (tie-break), Task 14 (final).

**Your job (r2)**:
- Verify each r1 blocker/must-fix is actually closed (read the updated sections).
- Surface any NEW issues introduced by these fixes (e.g., does the chunked Codex dispatch create a new coordination bug? does the triage rule now have a corner case?).
- Only report blockers and must-fixes. Skip nice-to-haves.

Format:
```
## r1 FIXES VERIFIED
- [1 run-id] ✅ / ❌ with specifics
- [2 cell_id] ✅ / ❌
- [3 manifest shape] ✅ / ❌
- [4 triage rule] ✅ / ❌
- [5 yq removal] ✅ / ❌
- [6 subdirs upfront] ✅ / ❌
- [7 freeze excludes] ✅ / ❌
- [8 matrix B tests] ✅ / ❌
- [9 chunking] ✅ / ❌
- [10 pre-codex gate] ✅ / ❌
- [11 intermediate commits] ✅ / ❌

## NEW BLOCKERS
- ...

## NEW MUST-FIX
- ...

## VERDICT
APPROVE / APPROVE_WITH_FIXES / REJECT
```
