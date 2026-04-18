# DocTalk Vuln-Hunt Framework

See `../plans/2026-04-18-vuln-hunt-framework-design.md` for the full spec and
`../plans/2026-04-18-vuln-hunt-framework-implementation.md` for the step-by-step plan.

**Quick start**: `/vuln-hunt start` in Claude Code — see the `doctalk-vuln-hunt` skill for the operator guide.

**Directory layout**:
- `matrix-*.yaml` — locked enum definitions (rows and columns of both matrices)
- `subsystems.yaml` — free-form deep-dive candidate list + pick constraints
- `scripts/` — validation, freeze, reconcile, tie-break prompt generators
- `runs/YYYY-MM-DD-HHMM/` — per-run artifacts, immutable post-freeze
- `current_run.yaml` — active run pointer (set by `/vuln-hunt start`)
