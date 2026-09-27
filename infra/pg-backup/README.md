# pg-backup — nightly off-site backup of production Postgres

A Railway cron service that dumps production Postgres, proves the dump
restores, encrypts it to the owner's `age` key, and uploads it to the
Cloudflare R2 bucket `doctalk-ops`. Plan and rationale:
`.collab/plans/2026-09-27-postgres-backups.md`.

**Status:** built, not yet deployed. It protects anything only after these
acceptance gates pass (plan §4): (1) owner's `AGE_RECIPIENT` and an alert
channel (`SENTRY_DSN` or `HEARTBEAT_URL`) are set; (2) R2 lifecycle and lock
rules are in place and verified; (3) a smoke run's artifact is verified from
outside (G1) and a forced failure produces an alert; (4) `cronSchedule` is
set and the first unattended run succeeds (G3); (5) the owner decrypts and
restores one artifact (G2). Until then the only copy is the manual dump of
2026-09-27.

Why it exists: the Railway workspace is on the Hobby plan, where volume
backups are not available (`volumeInstanceBackupScheduleUpdate` and
`volumeInstanceBackupCreate` both return "Not Authorized"). Until 2026-09-27
production Postgres had no backup at all.

## What one run does

1. Reports `in_progress` to the Sentry cron monitor (or `HEARTBEAT_URL`).
2. Refuses to start without a valid `AGE_RECIPIENT`, unless `ALLOW_PLAINTEXT=1`.
3. Waits for the database (12 × 5 s), reads the server version, the alembic
   revision and the row counts of `users`, `documents`, `chunks`,
   `document_elements` and `credit_ledger`.
4. `pg_dump -Fc`. Fails below `MIN_DUMP_BYTES` or with a table of contents of
   50 entries or fewer.
5. **Restore test** (unless `RESTORE_TEST=0`): restores the dump into a
   throwaway cluster inside the container and compares the counts (each at
   least 98% of the source, key tables non-empty, same alembic revision).
   Nothing is uploaded that did not restore. With `RESTORE_TEST=0` the run
   logs `BACKUP OK UNVERIFIED` and the manifest says `restore_test: skipped`;
   only the owner should ever set it.
6. Encrypts with `age`, then uploads `postgres/doctalk-<UTC>.dump.age` and
   `postgres/doctalk-<UTC>.manifest.json`, and checks the uploaded object's
   size and MD5 against the local file. On the 1st of the month it also copies
   both to `postgres-monthly/`.
7. Prints `BACKUP OK key=… bytes=… restore_test=ok …` and reports `ok`.

Any failure prints `BACKUP FAILED stage=<stage>` and reports `error`; so does
a stop signal, which also stops the running step at once. Every networked
step has a timeout (check-ins at most 45 s each, whatever `Retry-After` says)
and source queries give up on a lock after 60 s, so a run cannot hang
forever. No secret reaches a
command line or the log (libpq environment + a private password file; curl
reads its URL from stdin). The script never overwrites or deletes an object
and never writes a mutable "latest" pointer. Check-ins carry one
`check_in_id` per run; a rejected check-in is logged, never fatal.

## Variables (service `pg-backup`)

| Name | Value |
|---|---|
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` (private network). Only the plain `postgresql://user:password@host[:port]/db` form is accepted; query parameters, percent-escapes and IPv6 literals are rejected so no connection setting is silently dropped. For TLS options set libpq's `PGSSLMODE` on the service |
| `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` | `${{backend.R2_ACCESS_KEY_ID}}`, `${{backend.R2_SECRET_ACCESS_KEY}}`, or a token scoped to `doctalk-ops` only |
| `R2_ENDPOINT` | `https://0a78c0c34d3e08a9297247ce98d44ad1.r2.cloudflarestorage.com` |
| `R2_BUCKET` | `doctalk-ops` |
| `AGE_RECIPIENT` | the owner's `age1…` public key (not secret) |
| `SENTRY_DSN` | any DSN in the owner's Sentry account; enables the `pg-backup-nightly` cron monitor. Without it (or `HEARTBEAT_URL`) nobody is told when backups stop |
| `HEARTBEAT_URL` | optional alternative to Sentry (Healthchecks.io ping URL) |
| optional | `BACKUP_PREFIX` (`postgres`), `MONTHLY_PREFIX` (`postgres-monthly`), `MIN_DUMP_BYTES` (5000000), `MAX_UPLOAD_BYTES` (157286400), `RESTORE_TEST` (1), `SENTRY_MONITOR_SLUG`, `SENTRY_CRON_SCHEDULE` |

List variable names only, never values:
`railway variables --service pg-backup --json | python3 -c 'import json,sys;print(sorted(json.load(sys.stdin)))'`.

## Retention (R2 bucket rules on `doctalk-ops`)

| Prefix | Expires | Locked (no delete or overwrite) |
|---|---|---|
| `postgres/` | 35 days | 14 days |
| `postgres-monthly/` | 400 days | 60 days |
| `qdrant/` | never (the only Qdrant snapshot) | no |

## Restore

1. Pick the newest `postgres/doctalk-<UTC>.manifest.json`; note
   `alembic_version`, `restored_counts` and `artifact_sha256`.
2. `npx wrangler@4 r2 object get --remote doctalk-ops/postgres/<key>.dump.age --file <key>.dump.age`
   (`--remote` is required: wrangler 4 object commands default to local storage)
   and check `shasum -a 256` against the manifest.
3. Owner decrypts: `age -d -i ~/Private/doctalk-backup-age.key -o <key>.dump <key>.dump.age`.
4. Restore into a new Railway Postgres (preferred) or an emptied database.
   Keep the credentials off every command line: write a password file
   (`host:port:db:user:password`, `chmod 600`) and export `PGHOST`, `PGPORT`,
   `PGUSER` and `PGDATABASE` in your shell, then pass them by name:
   `docker run --rm -v "$PWD:/b:ro" -e PGHOST -e PGPORT -e PGUSER -e PGDATABASE -e PGPASSFILE=/b/.pgpass postgres:17.11-bookworm pg_restore --no-owner --no-privileges -j 4 -d "$PGDATABASE" /b/<key>.dump`
   Never paste the password or URL into chat.
5. Point `backend` and `pg-backup` at the new database, redeploy, then check
   `/health?deep=true`, a login and a chat with a citation jump.

The full procedure, including reconciling Stripe events after the backup
timestamp, is in the plan (§5).

## Local test

The image runs against the docker compose stack, with MinIO standing in for
R2 (`R2_PROVIDER=Minio`, `R2_ENDPOINT=http://doctalk-minio:9000`) and a
throwaway `age` key from `docker run --rm --entrypoint age-keygen doctalk-pg-backup:local`.

## Deploy log

| Date | Commit | Image digest | Notes |
|---|---|---|---|
