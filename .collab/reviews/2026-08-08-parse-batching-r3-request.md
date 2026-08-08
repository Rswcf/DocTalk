# Review request r3: verify the r2 fixes (commit 0dc96b5) — targeting consensus

Your r2 verdict was REVISE: 2 IMPORTANT + 1 MINOR, all accepted and fixed in
`0dc96b5`. This round is a verification pass — confirm the fixes hold, or name
concrete new breakage.

## What changed per r2 finding

1. (startup race) `main.py::_retry_stuck_documents` no longer blindly re-dispatches
   every parsing/ocr/embedding doc. It now calls the new
   `requeue_stale_processing_documents` synchronously — same age-gated atomic
   claim as the beat watchdog.
2. (lost retry → stuck forever) New beat task `requeue_stale_processing_documents`
   every 1800s. Claim = conditional
   `UPDATE documents SET updated_at=now() WHERE id=? AND status IN (parsing,ocr,embedding) AND updated_at < now() - interval '45 minutes'`,
   commit, `rowcount==1` → `parse_document.delay`. Threshold rationale (in code
   comments): worst legitimate write silence ≈ 11 min (540s soft limit + 120s max
   backoff); broker visibility_timeout = 2400s, so a worker-lost redelivery (≤40
   min) always beats the watchdog (>45 min) and the claim's WHERE fails once the
   redelivered run writes progress. Dispatch failure after a claim self-heals: the
   bumped timestamp re-ages by the next sweep.
3. (MINOR, worker-semantics test) `test_gating_matches_worker_retry_semantics`:
   `push_request(retries=N, called_directly=False)` for N=0/1/2, `task.retry`
   monkeypatched to capture `(exc, max_retries)` and raise `Retry`. Asserts the
   soft limit reaches retry with the decorator's max_retries, and terminal
   PARSE_TIMEOUT is written only at N=2.

## Attack surface for r3

- The claim loop: SELECT candidates then per-id conditional UPDATE + commit. Any
  TOCTOU that survives the conditional WHERE? Two replicas running startup
  recovery simultaneously; beat firing while a startup sweep is mid-loop.
- updated_at as the liveness signal: every parse write path (progress commits,
  status transitions, cleanup commit at task start) bumps it via ORM onupdate or
  explicit values. Is there any long-running LEGITIMATE phase with zero doc-row
  writes that could exceed 45 min under the 540s soft limit? (OCR/extract happen
  inside the same 540s budget.)
- The watchdog dispatches a FRESH parse chain (retries=0) for a doc whose
  previous chain died at attempt 2 of 3 — acceptable by design (the new chain
  terminates in ready or PARSE_TIMEOUT). Any scenario where chains ping-pong
  forever? (Requires the task to be lost every time — no longer plausible?)
- `requeue_stale_processing_documents` runs in BOTH the API startup thread and
  the celery worker (beat). Both import paths safe (no circulars, no async
  loop involvement)? It references parse_document defined later in the module —
  runtime resolution, but confirm no import-order trap.
- Beat cadence 1800s vs claim cutoff 45 min: bounded stuck time ~75 min. Sane?
- The layout translation pipeline uses different statuses/tables and its own
  35-min time_limit — confirm the watchdog cannot touch it (statuses filter is
  parsing/ocr/embedding on documents only).

## Verdict format

BLOCKER / IMPORTANT / MINOR + failure scenarios, then SHIP / REVISE. If SHIP,
say CONSENSUS-SHIP explicitly. Do not run git; review the working tree.
