---
description: Run the DocTalk vulnerability-hunt framework (double-blind Claude+Codex)
argument-hint: "<start|codex-dispatch|freeze|cross-read|reconcile|stage2-checkpoint|tie-break|compose|finalize>"
---

Run the vuln-hunt framework subcommand `$ARGUMENTS`.

Load the skill `doctalk-vuln-hunt` for full operator instructions. The skill defines the state machine and all commands. Before running any subcommand, check `.collab/vuln-hunt/runs/<current-run>/run-state.yaml` to confirm the prior step completed.

If `$ARGUMENTS` is empty, treat as `start` for a fresh run — but first confirm with the user that it's OK to begin a full run (~7–9 hours wall-clock).
