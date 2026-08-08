# Review request r5: verify the r4 fixes (commit 4bcf5b3) — final round, targeting CONSENSUS-SHIP

Your r4 verdict was REVISE (3 IMPORTANT, 1 MINOR); all four accepted and fixed in
`4bcf5b3`. Verify:

1. (lock leak) Unlock failure now calls `lock_conn.invalidate()` (physically
   terminates the PG session — the lock dies with it) before `close()`.
2. (locale ownership) `parse_requested_locale` is written by DISPATCHERS
   atomically with every transition to status='parsing' BEFORE publish:
   - upload constructor (doc_service), both ingest-url constructors and the
     layout-translation import constructor;
   - the reparse endpoint assigns `body.locale if body else None` — the
     intentional NULL reset you asked for;
   - the backfill script's new atomic claim (below) writes it too.
   The worker only READS the column and ignores the message argument entirely
   (logged when they disagree). Stale messages can no longer resurrect an older
   locale; messages lost before first run no longer lose it.
3. (backfill no-op) `find_low_quality_docs.py --enqueue` now claims each doc via
   `UPDATE ... SET status='parsing', parse_requested_locale=$2, updated_at=now()
   WHERE id=$1 AND status='ready'`, dispatches only on `UPDATE 1`, and prints a
   SKIP for claim losers.
4. (MINOR taxonomy) The outer generic handler unwraps chained soft limits via
   `_chain_has_soft_limit` and routes them through the shared
   `_log_and_maybe_terminalize_timeout` helper — final-attempt cleanup timeouts
   now terminalize as PARSE_TIMEOUT.

Remaining known trade-offs we consider acceptable (state disagreement explicitly
if you differ): pre-deploy queued messages carrying a locale for docs whose
column is NULL will parse with defaults (prod parse queue verified empty before
deploy); a duplicate that serializes behind a NON-terminal run re-parses
idempotently.

Tests: 47 focused (unit) + full suites 818 non-integration / 28 integration
green locally; ruff clean; alembic single head 20260808_0039.

Verdict format: BLOCKER / IMPORTANT / MINOR + failure scenario, then SHIP or
REVISE. If nothing survives at IMPORTANT+, say CONSENSUS-SHIP explicitly. Do not
run git.
