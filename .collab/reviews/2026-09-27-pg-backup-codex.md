# Codex adversarial review — pg-backup (PR #9)

Plan: `.collab/plans/2026-09-27-postgres-backups.md` (Fable). Reviewer: Codex (gpt-5.5, static review, read-only sandbox). Merged 2026-09-27 (1855ca30). **Not deployed**: waiting for the owner's `age` public key and an alert channel.

## Round 1 — BLOCKING (3 blocking, 4 should-fix)
1. **BLOCKING — the database URL (with its password) and the heartbeat URLs were in child argv.** → libpq `PG*` environment variables plus a private `PGPASSFILE`; curl reads its URL from `--config -` on stdin with stderr dropped. Verified with argv-logging shims on every external command: the old version put the URL on 4 command lines, the new one on none.
2. **BLOCKING — no `check_in_id`, and HTTP rejections were silent.** → One UUID per run on every check-in; non-2xx is logged as a sanitized warning.
3. **BLOCKING — `wrangler r2 object get/put/delete` defaults to LOCAL storage in wrangler 4.** → `--remote` is in every documented production command.
4. `RESTORE_TEST` accepted any value. → Only `0` or `1`; a skipped test ends in `BACKUP OK UNVERIFIED`.
5. The monthly manifest pointed at the daily key. → It has its own manifest.
6. There was no execution bound. → A timeout on every networked step, `lock_timeout`/`statement_timeout` for source queries, and `--lock-wait-timeout` for pg_dump.
7. The docs overstated the protection. → The status reads "built, not deployed", with acceptance gates.

## Round 2 — BLOCKING (2 blocking, 4 should-fix)
1. **BLOCKING — the URL parser could silently drop TLS settings** (e.g. an encoded `sslmode`). → Only the plain `postgresql://user:password@host[:port]/db` form is accepted; anything else is rejected with a sanitized error. TLS is set via `PGSSLMODE`.
2. **BLOCKING — curl honoured a long `Retry-After`, which could stall the run.** → `timeout -k 5 45` plus `--retry-max-time 30`. Tested: 503 with `Retry-After: 3600` → the whole run took 1 s.
3. TERM was deferred behind foreground children. → `run()` backgrounds long steps, and `on_signal` forwards TERM. Tested: exit within 0 s, and the slow child was stopped.
4. IPv6 and percent-escapes were mishandled. → Now rejected explicitly.
5. The restore docs put credentials in argv. → They use `PG*` variables plus a password file.
6. The UUID fallback was not a UUID. → It is now a v4 UUID from `/dev/urandom`.

## Round 3 — NO BLOCKING (3 should-fix, all fixed)
- R2 listing and manifest uploads also go through `run`.
- Every non-monitoring timeout has `-k 5`.
- The restore example passes `PGSSLMODE`.

## Round 4 — no findings

Verification:
- shellcheck and actionlint are clean.
- The local end-to-end run in postgres:17-alpine against compose Postgres + MinIO passed: happy path, decrypt + `pg_restore --list`, negative cases, monthly path via a date shim, heartbeat start/ok/fail.
- CI built the Debian image (pg_dump 17, age, rclone, jq, curl) and ran the full backend unit suite (1085).
