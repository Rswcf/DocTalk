# Review request r2: parse batching — verify the r1 fixes (commit 4356f0a)

Your r1 verdict was REVISE with 4 findings (1 BLOCKER, 3 IMPORTANT, recorded in
`.collab/reviews/2026-08-08-parse-batching-review-request.md` + your reply). All
four were accepted and fixed in commit `4356f0a` on top of `f4d1953`. Verify each
fix is correct and complete, and probe for NEW breakage the fixes may have
introduced.

## What changed per finding

1. (#1 BLOCKER, embedding handler) `except Exception` in the embedding block now:
   `_chain_has_soft_limit(e)` → `raise SoftTimeLimitExceeded() from e`; otherwise
   `_fail_doc_fresh_session(document_id, "VECTORIZE_FAILED")`, and if that write
   fails → bare `raise`.
2. (#2, terminal error vs pending retry) The outer `except SoftTimeLimitExceeded`
   now writes PARSE_TIMEOUT only when `self.request.retries >= _PARSE_MAX_RETRIES`
   (module constant, also fed to the decorator's retry_kwargs). Non-final attempts
   log and re-raise with the doc left at status='parsing' — the reparse endpoint
   409s on that status, closing the user-reparse-vs-autoretry race you described.
3. (#3, swallowed status-write failure) `_fail_doc_fresh_session` returns bool
   (True also when the doc row is gone — nothing to record); all four call sites
   re-raise the ORIGINAL exception when it returns False, so autoretry re-runs the
   parse instead of recording success with a doc stuck 'parsing'.
4. (#4, chain walk) `_chain_has_soft_limit` now does an explicit stack walk pushing
   BOTH `__cause__` and `__context__` per node, cycle-guarded by id().

## Things worth attacking in r2

- Attempt-counting semantics: `self.request.retries` on first run = 0, autoretry
  uses `retry_kwargs={"max_retries": _PARSE_MAX_RETRIES}`. Is `retries >=
  _PARSE_MAX_RETRIES` exactly "no further attempt will run" under Celery's
  autoretry (worker context, not .run())? Off-by-one here either writes terminal
  error with a retry still pending (the race returns) or never writes it (doc
  stuck 'parsing' after the last attempt).
- The stuck-'parsing' window when non-final attempts leave no terminal state and
  the pending retry is lost (broker flush, worker SIGKILL at hard time_limit,
  redeploy). Is that acceptable/mitigated? (Old behavior wrote error every
  attempt; new behavior trades that for the race fix.)
- `raise` (bare) inside the `except Exception` blocks after a False status write —
  confirm it re-raises the original exception and interacts sanely with
  autoretry_for=(Exception,) (retry storm risk? max 2 retries, backoff 60s).
- The embedding block's other DB touches (NO_CHUNKS path, status='embedding'
  write, per-batch commit) still use the task session directly — any remaining
  path where a corrupted connection could mislabel or lose status?
- Tests use `parse_document.push_request(retries=N)` + `.run()` — sanity-check
  that this actually models worker-context retries for the gating branch.

## Verdict format

BLOCKER / IMPORTANT / MINOR findings with concrete failure scenarios, then
overall SHIP / REVISE. Do not run git (sandbox); review the working tree.
