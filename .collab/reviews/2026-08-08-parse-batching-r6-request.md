# Review request r6: verify the r5 fixes (commit 74dcef8) — final verification

Your r5 verdict was REVISE with exactly one IMPORTANT and one MINOR; both fixed
in `74dcef8`:

1. (IMPORTANT, reparse race) The reparse endpoint now claims atomically:
   `UPDATE documents SET status='parsing', parse_requested_locale=<body.locale
   or NULL> WHERE id=? AND status IN ('ready','error')`; rowcount 0 → 409
   DOCUMENT_PROCESSING; the task is published only for the winner, AFTER the
   claim commit. The friendly pre-check 409 (with the doc's actual status) is
   retained for the common case.
2. (MINOR) tables.py column comment and the migration docstring now describe the
   dispatcher-owned contract (worker reads only).

Everything else you verified in r5 is unchanged. Full suites: 818
non-integration + 28 integration green; ruff clean.

Verdict: BLOCKER / IMPORTANT / MINOR + scenario, then SHIP or REVISE. If nothing
survives at IMPORTANT+, say CONSENSUS-SHIP explicitly. Do not run git.
