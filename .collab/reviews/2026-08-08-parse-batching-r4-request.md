# Review request r4: verify the r3 fixes (commit 6dc2488) — targeting CONSENSUS-SHIP

Your r3 verdict was REVISE (3 IMPORTANT, 1 MINOR). All were accepted; fixes are in
commit `6dc2488`. This is a verification round.

## What changed per r3 finding

1. (duplicate queued/redelivered parse) Chosen mechanism: **per-document
   serialization + stale-message rejection** (the alternative you explicitly
   allowed), NOT a message generation column:
   - `parse_document` takes `pg_try_advisory_lock(947, hashtext(document_id))` on a
     DEDICATED autocommit connection held for the entire task; unlock+close in a
     `finally`. Lock busy → log + return (a live task owns the doc; if it dies the
     watchdog recovers later). Worker death releases the lock with the connection.
   - After acquiring the lock: if `doc.status not in (parsing, ocr, embedding)` →
     log + return. Every legitimate dispatcher (upload doc_service:93, ingest-url
     documents.py:443/489, reparse :843, demo_seed, layout-translation import)
     sets status='parsing' before `.delay`, so only stale duplicates see terminal
     states. A duplicate that serializes behind a NON-terminal outcome (soft-limit
     chain still in progress) re-parses idempotently — acting as the retry.
   - The ORM-no-op window you found: the cleanup commit now assigns
     `doc.updated_at = func.now()` explicitly, so a live re-run always bumps the
     watchdog's liveness signal within seconds of starting.
2. (endless fresh chains on persistent non-soft failure) New outer
   `except Exception` handler mirrors the soft-limit gating: final attempt
   (`retries >= _PARSE_MAX_RETRIES`) writes terminal `PARSE_FAILED` via the
   fresh-session writer, then re-raises; non-final attempts re-raise for autoretry.
   `PARSE_FAILED` added to `_WORKER_ERROR_CODES`.
3. (dropped OCR locale) Add-only migration `20260808_0039`:
   `documents.parse_requested_locale` VARCHAR(16) NULL. The task persists a
   provided locale on first run (written with the cleanup commit) and falls back
   to the stored value when invoked without one — watchdog/startup dispatches
   need no signature change. `resolve_ocr_languages` therefore sees the original
   locale on recovery.
4. (MINOR, test fidelity) The fake `retry` now models exhaustion: it re-raises
   the supplied exception once `current + 1 > max_retries`, and the test expects
   `Retry` at N=0/1 but `SoftTimeLimitExceeded` at N=2.

## r4 attack surface

- Advisory lock lifecycle: acquisition happens BEFORE the SyncSessionLocal block;
  `finally` unlocks then closes, tolerating a dead connection. Any path where the
  lock outlives the task or is released early (autocommit connection, soft-limit
  raise, hard time_limit SIGKILL)? Pool exhaustion risk (one extra connection per
  concurrent parse, worker concurrency=2)?
- Stale-rejection false positives: any dispatcher that legitimately enqueues a
  parse for a doc whose status is NOT in (parsing, ocr, embedding) at run time?
  (We audited all 9 dispatch sites; demo_seed dispatches only for
  parsing/embedding or freshly created 'parsing' docs.)
- The lock-busy no-op returns WITHOUT retry: is there a scenario where that
  drops the only message that would ever parse the doc? (Our analysis: lock busy
  ⇒ a live task holds it; that task either finishes the doc or dies, and death
  paths are covered by autoretry/watchdog.)
- Locale fallback correctness: layout-translation import passes target_language
  as locale — persisted on first run; demo seeds pass None — unchanged. Any
  consumer that must NOT see a persisted stale locale after user changes their
  request? (Reparse endpoint forwards a NEW body.locale which overwrites.)
- Migration: add-only, nullable, chain 20260803_0038 → 20260808_0039. Scratch DB
  auto-migration covers integration tests.
- The new outer generic handler: any exception class that should NOT terminalize
  on final attempt (e.g. the no-op `return` paths can't reach it; Ignore/Retry
  are Celery-internal and raised only from task.retry AFTER our handler re-raises
  — confirm ordering is sound in worker context).

## Verdict format

BLOCKER / IMPORTANT / MINOR + concrete failure scenarios, then SHIP / REVISE.
If nothing survives at IMPORTANT+, say CONSENSUS-SHIP explicitly. Do not run git.
