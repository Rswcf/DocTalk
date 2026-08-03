# Codex M3 r2 — scoped verification of the r1 fix wave

Your M3 r1 verdicted REVISE with 7 findings (trust boundary cleared). Eight fix commits since your r1 head:

```
git log --oneline 38686d9..81b2725
git diff 38686d9..81b2725
```

Mapping: #1 HIGH → 1302ebd (pg_advisory_xact_lock(hashtext(user_id)) as save_quote's FIRST statement — idempotency check, cap check, insert all inside one serialized critical section; advisory lock chosen over users-row FOR UPDATE to avoid coupling to concurrent billing writes; no-write paths COMMIT rather than rollback to avoid re-introducing the MissingGreenlet expiration class; your 29-rows/concurrent-distinct scenario is a real-Postgres real-HTTP test — exactly one 201, rest 403, final count 30 across 6 runs; lock mutation-tested). #2 → 4566eb2 (export gains saved_quotes incl. notes + document_filename; real-Postgres test). #3 → 4d5af43 (confirmed-note baseline from PATCH response bubbled to parent; generation guard on overlapping saves). #4 → 0fc1630 (card key includes page + displayText slice → identity change forces remount). #5 → 1713571 (migration 0038: partial index on source_chunk_id WHERE NOT NULL; round-tripped). #6 → 2c5463a (saved-tab rows cleared at fetch START; error renders error-only). #7 → 5668c28 + 81b2725 (board feed carries document_filename via query-time join — board response shape only; frontend consumes it, getMyDocuments join deleted).

Task: verdict each of the 7 ADDRESSED / NOT ADDRESSED against the diff; probe the advisory-lock critical section adversarially (idempotent-save under lock, lock scope vs the fresh-session IntegrityError retry path, deadlock surface with reconcile_credits' locks); flag NEW breakage in these eight commits only. Everything settled in r1 stays settled.

Evidence (audit, don't repeat): 779 unit pass/26 skip, 23 real-Postgres integration pass (isolated scratch DB), ruff + tsc + lint + build clean at 81b2725.

Report: per-finding verdicts with file:line, new-breakage section, overall verdict CONSENSUS-SHIP / REVISE / BLOCK.
