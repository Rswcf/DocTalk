<!-- Author: Fable 5.1 (planner), 2026-09-27. Executed by Claude on branch feat/pg-backup.
Context at execution: the one-time manual dump of 2026-09-27 15:11Z (restore-tested) is the stop-gap.
Version note: this plan's Release 2 said "v0.34.0"; 0.34.0 went to the missing-original-files release, so Release 2 becomes the next minor.
-->

# DocTalk — recurring off-site backups of production Postgres

Repo: `/Users/mayijie/Projects/Code/010_DocTalk` (main checkout; this worktree is `origin/main` at `a94faeb1`, v0.33.1). Claude saves this plan as `.collab/plans/2026-09-27-postgres-backups.md` before executing. Codex adversarial review is mandatory for both releases (Release 1 handles production DB credentials and an R2 write path; Release 2 is >30 lines of backend logic).

## 1. Decision summary

- **Mechanism: Option 2.** A dedicated Railway cron service `pg-backup` (source dir `infra/pg-backup/`, image `postgres:17.11-bookworm` + `curl age rclone`) runs nightly at `15 9 * * *` UTC: `pg_dump -Fc` over the private `DATABASE_URL` → **restores the dump into a throwaway Postgres cluster inside the same container and checks row counts** → encrypts with `age` to the owner's public key → uploads to `doctalk-ops/postgres/` with size+MD5 verification → reports to a Sentry cron monitor. Every run is therefore a restore test of the plaintext dump; nothing is uploaded that did not restore.
- **Off-provider, off-account for the blast radius that matters.** Copies live in Cloudflare R2, not Railway. An R2 lifecycle rule handles retention (35 daily + 13 monthly); an R2 **bucket lock** makes each backup undeletable and un-overwritable for 14 days, so a leaked token or a buggy script cannot erase the last two weeks.
- **Silence is never mistaken for success.** Layer 1: Sentry cron monitor (dead-man's switch; one monitor is free on every Sentry plan) alerts the owner on a missed, failed, or hung run. Layer 2 (Release 2): a beat task inside the backend independently lists R2 and alerts if the newest artifact is older than 30 h, smaller than 5 MB, or lacks a passing restore-test manifest; the admin dashboard shows "last backup" as a tile. Blocker stated plainly: **the production backend has no `SENTRY_DSN` today** (verified from the variable name list), so until the owner pastes a DSN into the `pg-backup` service, backups will run but nobody is told when they stop.
- **Rejected**: Railway Pro native volume backups (+$20/mo, same provider/account, no offline restore-test); Celery beat inside the backend (couples the backup to app deploys and a crash-looping backend); GitHub Actions (public repo + secrets, and scheduled workflows auto-disable after 60 days of inactivity, which is a built-in silent-failure mode).
- **Cost**: ≈ $0. Railway cron compute is cents/month (usage-billed within Hobby's included $5); R2 stays inside the free tier (~2.5 GB retained + 0.32 GB PDFs of 10 GB); Sentry monitor free. The only money item, Railway Pro, is recommended *against* for now.
- **RPO 24 h, RTO ≈ 30–45 min** (download 1 min, decrypt seconds, `pg_restore` 2–5 min over the TCP proxy, backend redeploy ~5 min, plus human steps).

## 2. Owner decisions

Money items are marked **[$]**. Everything else is $0 but only the owner can do it.

| # | Decision | Recommendation | Blocking? |
|---|---|---|---|
| 1 | **[$] Upgrade Railway to Pro for native volume backups?** ($20/mo seat + usage) | **No.** Backups would sit in the same provider/account, cannot be restore-tested offline, and Option 2 covers the need at ≈$0. If Pro is bought later for other reasons, enable daily+weekly volume backups as a bonus layer. | No |
| 2 | **Client-side encryption with `age`, owner-held key.** Threat covered: the R2 token leaks (it lives in two Railway services) → 183 users' emails, chat content, Stripe customer IDs in the dumps. Cost: if the identity file is lost, every backup is unreadable. | **Yes.** Owner runs `brew install age && age-keygen -o ~/Private/doctalk-backup-age.key` (mode 600, FileVault disk, not iCloud-synced), stores the identity in the password manager **and** one offline copy, and sends Claude only the public key (`age1…`, printed by `age-keygen`; it is not secret). Script fails closed without `AGE_RECIPIENT`; plaintext requires the owner to set `ALLOW_PLAINTEXT=1` explicitly. | **Yes — before deploy day** (the first `railway up` runs a real backup immediately; see §4.3) |
| 3 | **Sentry DSN for the dead-man's switch.** Paste a DSN into the `pg-backup` service variable `SENTRY_DSN` (the existing frontend project's DSN, `NEXT_PUBLIC_SENTRY_DSN` on Vercel, is fine — any project in the account works; the monitor is created on first check-in). Confirm the project's default "new issue" alert rule emails you. | **Yes.** Fallback if you prefer not to route this through Sentry: create a free Healthchecks.io account (20 checks, email alerts) and set `HEARTBEAT_URL` instead; the script supports either. | Yes for alerting; backups run without it |
| 4 | **Separately: set `SENTRY_DSN` on the `backend` service?** This turns on Sentry error capture for the whole backend for the first time (5k events/month free quota) — it is what makes Release 2's independent watcher able to email you rather than only log. | Yes, recommended, but it is a distinct choice with its own noise profile. | No (Release 2) |
| 5 | **Dedicated R2 token for `pg-backup`.** Day 0 reuses the backend's token via Railway references (Object R&W on `doctalk-pdfs` + `doctalk-ops`). Hardening: mint an **Object Read & Write token scoped to `doctalk-ops` only**, paste as `R2_ACCESS_KEY_ID`/`R2_SECRET_ACCESS_KEY` on **pg-backup only**. The backend token must keep both buckets (Release 2's watcher reads `doctalk-ops` with it). | Yes, week 1–2. Reduces what a compromised cron container can touch to the ops bucket. | No |
| 6 | **Retention**: 35 daily (lifecycle) + 13 monthly (400 d), 14-day lock on dailies, 60-day lock on monthlies. Longer retention costs nothing today (50 MB × 48 ≈ 2.4 GB). | Accept. | No |
| 7 | **Deploy-branch exception**: `infra/pg-backup` is deployed with `railway up infra/pg-backup --path-as-root` from the main checkout at the merged `main` SHA. The "don't `railway up` from `main`" rule exists so the backend image matches `stable`; a directory-scoped upload of an infra service does not touch backend or frontend, and merging `main → stable` just to deploy it would push unreleased app code to production. | Accept; CLAUDE.md/AGENTS.md "Avoid" bullet gets a one-clause qualifier. | No |
| 8 | **Restore drill in week 1** (owner decrypts and restores on the Mac; ~15 min) and quarterly thereafter. Until the first drill passes, the honest status is: "restorable in plaintext form, proved nightly in-container; decryptability of the stored artifact unverified." | Do it in week 1 — it is the acceptance gate (G2). | Yes for closing the plan |
| 9 | **Sentry `failure_issue_threshold`**: 1 (any failed attempt emails you, even if Railway's one retry succeeds) vs 2 (only persistent failure). | **1.** The backup path is the only one; a transient failure in it is worth one email. Expected volume ≈ 0. Raise to 2 only if there is more than one false alarm per month. | No |

## 3. Architecture

### 3.1 Options weighed

| | 1. Railway Pro volume backups | **2. `pg-backup` cron service → R2** | 3. Celery beat in backend | 4. GitHub Actions schedule |
|---|---|---|---|---|
| Cost | **$20/mo** + usage | ≈$0.05/mo compute; R2 free tier | $0; +~40 MB image (PGDG repo) | $0 (public repo minutes free) |
| Blast radius / independence | Same provider **and** account; account suspension or region loss takes both | Separate provider; needs one R2 token in one extra container (reduced by decision 5 + bucket lock) | Backup shares the app container: a crash-looping or misdeployed backend = no backups, exactly when you want them | Prod DB reachable via public TCP proxy from GitHub runners; R2 + DB creds in GitHub secrets of a **public** repo |
| Secret handling | None | Railway reference variables only; Claude never sees values | Already has `DATABASE_URL`; needs R2 (has it) | Owner pastes DB URL + R2 keys into GitHub |
| Failure visibility | Dashboard only | Sentry cron monitor (missed/failed/timeout) + independent watcher | `sentry_sdk` easy, but beat itself can be down silently | GitHub emails on failure; but **scheduled workflows are auto-disabled after 60 days without repo activity — silently** |
| Retention | Railway's schedule presets | R2 lifecycle + bucket lock, exact | Same as 2 | Same as 2 |
| Restore time | Minutes, dashboard, Railway-only | 30–45 min, anywhere `pg_restore` 17 runs | Same as 2 | Same as 2 |
| Restore verification | None offline | **Every run**: in-container restore + row counts; owner drill quarterly | Possible but heavy inside the app container | Possible on the runner |
| Verdict | Optional later layer | **Chosen** | Rejected | Rejected |

### 3.2 Components

```
Railway (us-west2, pinned)                          Cloudflare R2 (WNAM)
┌──────────────┐  ${{Postgres.DATABASE_URL}}         ┌──────────────────────────────┐
│  Postgres    │◄───────────────┐                   │ doctalk-ops                  │
│  17.11       │                │ pg_dump           │  postgres/          35d, lock 14d │
└──────────────┘        ┌───────┴────────┐  rclone  │   doctalk-<UTC>.dump.age     │
                        │  pg-backup     │─────────►│   doctalk-<UTC>.manifest.json│
┌──────────────┐  R2_*  │  cron 15 9 UTC │          │  postgres-monthly/  400d, lock 60d │
│  backend     │───────►│  restore-test  │          │  qdrant/2026-09-26/  (untouched) │
│  (beat task  │  refs  │  age encrypt   │          └──────────────────────────────┘
│   watches R2)│        └───────┬────────┘                    ▲ list (Release 2)
└──────┬───────┘                │ check-ins                   │
       │ capture_message        ▼                             │
       └──────────────► Sentry cron monitor  ──email──► owner ┘
```

**New files (Release 1)** — all under `/Users/mayijie/Projects/Code/010_DocTalk/infra/pg-backup/`:

- `Dockerfile` — `FROM postgres:17.11-bookworm` (pin by digest at execution: `docker manifest inspect postgres:17.11-bookworm`; if the tag is absent use `postgres:17-bookworm@sha256:…` — `pg_dump` only needs client major ≥ server major). `apt-get install -y --no-install-recommends curl age rclone ca-certificates` (bookworm: age 1.1.1, rclone 1.60.1, curl 7.88 — Debian-pinned, no GitHub downloads). `COPY backup.sh /opt/doctalk/backup.sh`, `USER postgres` (uid 999; `initdb` refuses root), `WORKDIR /tmp`, **`ENTRYPOINT []`** (the image's `docker-entrypoint.sh` would otherwise try to start a server), `CMD ["/opt/doctalk/backup.sh"]`. No `EXPOSE`.
- `backup.sh` — bash, `set -euo pipefail`, **never `set -x`**, never echoes any variable value; contract in §3.4.
- `railway.toml` — `[build] builder="DOCKERFILE" dockerfilePath="Dockerfile"`; `[deploy] restartPolicyType="ON_FAILURE" restartPolicyMaxRetries=1`; `[deploy.multiRegionConfig."us-west2"] numReplicas=1`. **No `healthcheckPath`** (no HTTP server). `cronSchedule` is added only in §4.3 step 8 after the smoke run.
- `README.md` — runbook: variables, schedule, object naming, restore procedure (§5), drill checklist, "how to read the manifest".
- `.dockerignore` — `README.md`.

**Release 2 (backend + frontend)** — `backend/app/workers/ops_monitor.py` (new), `backend/app/services/backup_status_service.py` (new), `backend/app/core/config.py`, `backend/app/workers/celery_app.py`, `backend/app/api/admin.py`, `backend/tests/test_backup_status_service.py` (new), `frontend/src/components/admin/OverviewTab.tsx` + `types.ts`.

### 3.3 Railway service `pg-backup` — exact settings

| Setting | Value | How |
|---|---|---|
| Service name | `pg-backup` | `railway add --service pg-backup` (or GraphQL `serviceCreate`) in project `dac672c5-19f2-442c-bde3-bf6199fb326e`, env `production` `4072a1f3-9dcc-4d46-bdbd-202daffd59bf` |
| Source | `railway up infra/pg-backup --path-as-root -s pg-backup -e production` from the main checkout | Directory-scoped upload; the root `.railwayignore` (`infra/` excluded) does not apply to a `--path-as-root` upload — confirm in the first build log that `Dockerfile` was found |
| Cron | `15 9 * * *` (UTC; Railway minimum 5-min granularity; a run still in progress makes Railway skip the next) | GraphQL `serviceInstanceUpdate(serviceId, environmentId, input:{cronSchedule:"15 9 * * *"})` after the smoke run; then also committed to `railway.toml` |
| Restart policy | `ON_FAILURE`, max retries 1 | `railway.toml`. One immediate retry covers private-DNS warm-up and transient R2 errors; unique keys make a retry safe |
| Region | `us-west2` via `multiRegionConfig` | `railway.toml`; if the toml key is not honoured, fall back to the GraphQL call documented in CLAUDE.md; verify with `RAILWAY_REPLICA_REGION`, which the script prints on its first line |
| Healthcheck | none | — |
| Variables (set **before** the first `railway up`) | `DATABASE_URL=${{Postgres.DATABASE_URL}}` · `R2_ACCESS_KEY_ID=${{backend.R2_ACCESS_KEY_ID}}` · `R2_SECRET_ACCESS_KEY=${{backend.R2_SECRET_ACCESS_KEY}}` · `R2_ENDPOINT=https://0a78c0c34d3e08a9297247ce98d44ad1.r2.cloudflarestorage.com` · `R2_BUCKET=doctalk-ops` · `BACKUP_PREFIX=postgres` · `MONTHLY_PREFIX=postgres-monthly` · `AGE_RECIPIENT=age1…` (owner's public key) · `SENTRY_DSN=` (owner pastes) · `SENTRY_MONITOR_SLUG=pg-backup-nightly` · `SENTRY_CRON_SCHEDULE=15 9 * * *` · `MIN_DUMP_BYTES=5000000` · `MAX_UPLOAD_BYTES=157286400` · `RESTORE_TEST=1` | `railway variables --service pg-backup --set 'DATABASE_URL=${{Postgres.DATABASE_URL}}' --set …` (single quotes in zsh). Rule for Claude: **never run `railway variables` bare** — only `railway variables --service X --json \| python3 -c 'import json,sys;print(sorted(json.load(sys.stdin)))'` (names only). Verify a reference resolved by seeing the job connect in its logs, not by reading the value back |

### 3.4 `backup.sh` contract (what the executor implements)

1. **Preamble**: print `RAILWAY_REPLICA_REGION`, `pg_dump --version`, image digest env if present. `TS=$(date -u +%Y%m%dT%H%M%SZ)`; `KEY_BASE="doctalk-${TS}"`. `WORK=/tmp/pgbackup.$$` (mktemp). Export rclone config from env: `RCLONE_CONFIG_R2_TYPE=s3 RCLONE_CONFIG_R2_PROVIDER=Cloudflare RCLONE_CONFIG_R2_ENDPOINT=$R2_ENDPOINT RCLONE_CONFIG_R2_REGION=auto RCLONE_CONFIG_R2_NO_CHECK_BUCKET=true RCLONE_CONFIG_R2_ACCESS_KEY_ID=… RCLONE_CONFIG_R2_SECRET_ACCESS_KEY=…` (`no_check_bucket` because an object-scoped token cannot create buckets — learned in the R2 cutover).
2. **Fail-closed checks**: `AGE_RECIPIENT` matches `^age1[a-z0-9]{58}$` unless `ALLOW_PLAINTEXT=1`; `DATABASE_URL`, `R2_*` non-empty (`set -u` reports names, never values).
3. **Heartbeat start**: if `SENTRY_DSN` set, derive `CRON_URL="https://${host}/api/${project}/cron/${SENTRY_MONITOR_SLUG}/${public_key}/"` from the DSN (`https://<key>@<host>/<project>`; works for `o<org>.ingest.sentry.io` and `ingest.us.sentry.io`), `CHECK_IN_ID=$(cat /proc/sys/kernel/random/uuid)`, then `curl -sS -X POST "$CRON_URL" -H 'Content-Type: application/json' --data-raw '{"check_in_id":"…","status":"in_progress","environment":"production","monitor_config":{"schedule":{"type":"crontab","value":"'"$SENTRY_CRON_SCHEDULE"'"},"checkin_margin":60,"max_runtime":30,"timezone":"UTC","failure_issue_threshold":1,"recovery_threshold":1}}'`. If `HEARTBEAT_URL` set instead: `curl -fsS -m 10 "$HEARTBEAT_URL/start"`. Heartbeat curl failures are logged but do **not** fail the backup.
4. **`trap`** on ERR/EXIT: on non-zero exit send `status=error` (same `check_in_id`) / `$HEARTBEAT_URL/fail`, `pg_ctl … stop -m immediate` if the test cluster is up, `rm -rf "$WORK"`, exit 1.
5. **Wait for DB**: `pg_isready -d "$DATABASE_URL"` up to 12 × 5 s (private `*.railway.internal` DNS can lag container start).
6. **Source facts** (one `psql -Atc`): `current_setting('server_version')`, `version_num FROM alembic_version`, counts of `users, documents, chunks, document_elements, credit_ledger`. Fail if server major > client major.
7. **Dump**: `timeout 1500 pg_dump -Fc --no-owner --no-privileges -f "$WORK/$KEY_BASE.dump" "$DATABASE_URL"`. Fail if size < `MIN_DUMP_BYTES`. `pg_restore --list "$WORK/$KEY_BASE.dump" | wc -l` must be > 50.
8. **Restore test** (`RESTORE_TEST=1`): `initdb -D /tmp/pgtest -U postgres --auth-local=trust --no-sync` — **always pass `-D`; the base image sets `PGDATA=/var/lib/postgresql/data` and declares a VOLUME there**. `pg_ctl -D /tmp/pgtest -w -o "-c listen_addresses='' -k /tmp/pgsock -c fsync=off -c synchronous_commit=off -c full_page_writes=off -c shared_buffers=128MB -c maintenance_work_mem=256MB" start`; `createdb -h /tmp/pgsock -U postgres restore_test`; `pg_restore -h /tmp/pgsock -U postgres -d restore_test --no-owner --no-privileges --exit-on-error -j 2 "$WORK/$KEY_BASE.dump"` (pgcrypto's `CREATE EXTENSION` works: superuser + contrib present). Same counts query against `restore_test`; **fail if any restored count < floor(0.98 × source) or if `users`/`documents`/`credit_ledger`/`chunks` is 0, or `alembic_version` differs**. `pg_ctl -D /tmp/pgtest -m immediate stop`.
9. **Encrypt**: `age -r "$AGE_RECIPIENT" -o "$WORK/$KEY_BASE.dump.age" "$WORK/$KEY_BASE.dump"`; `sha256sum` and `md5sum` of the ciphertext; fail if ciphertext > `MAX_UPLOAD_BYTES` (150 MiB) — rclone's MD5-via-ETag verification only holds below its 200 MiB single-part cutoff, so this guard forces a deliberate revisit before the verification method silently changes.
10. **Manifest** `$KEY_BASE.manifest.json` (printf; no PII, no URLs): `created_at, db, server_version, pg_dump_version, alembic_version, dump_bytes, dump_sha256, artifact, artifact_bytes, artifact_sha256, encrypted (bool), age_recipient, source_counts{…}, restored_counts{…}, restore_test:"ok"|"skipped", durations_s{dump,restore,upload}, region, railway_deployment_id`.
11. **Upload**: `rclone copyto "$WORK/$KEY_BASE.dump.age" "r2:$R2_BUCKET/$BACKUP_PREFIX/$KEY_BASE.dump.age" -q` then the manifest. **Verify**: `rclone lsjson --hash "r2:$R2_BUCKET/$BACKUP_PREFIX/$KEY_BASE.dump.age"` → `Size` equals local bytes and `Hashes.md5` equals local md5. On day-of-month `01`, additionally `rclone copyto r2:…/postgres/$KEY_BASE.dump.age r2:…/postgres-monthly/$KEY_BASE.dump.age` (+ manifest) and verify the same way.
12. **Invariant**: every key is unique (`TS` to the second); the script never overwrites, never writes a mutable `latest.json`, never deletes — the bucket lock forbids overwrite/delete anyway, so a retry after a partial upload writes a new key rather than failing.
13. **Summary line** (grep-able): `BACKUP OK key=postgres/doctalk-<TS>.dump.age bytes=<n> restore_test=ok users=<n> alembic=<rev> t_dump=<s> t_restore=<s> t_upload=<s>`. Heartbeat `status=ok` / `$HEARTBEAT_URL`. Cleanup. Exit 0 (Railway needs the container to exit).

### 3.5 Object naming and retention

| Prefix | Written | Lifecycle (expire) | Bucket lock (no delete/overwrite) |
|---|---|---|---|
| `postgres/doctalk-<UTC>.dump.age`, `.manifest.json` | nightly | 35 days | 14 days |
| `postgres-monthly/doctalk-<UTC>.dump.age`, `.manifest.json` | day 01 | 400 days | 60 days |
| `qdrant/…` | existing snapshot 2026-09-26; Phase 7 weekly | **none until Phase 7 ships** (it is the only Qdrant snapshot) | none yet |
| whole bucket | — | AbortIncompleteMultipartUpload 2 days | — |

Bucket lock rules take precedence over lifecycle; 35 > 14 and 400 > 60 so expiry proceeds after the lock lapses. Lifecycle deletion happens "within 24 h" of expiry.

### 3.6 Expected numbers (200 MB DB, 172k `document_elements`)

| Step | Expectation | Fail/alert threshold |
|---|---|---|
| `pg_dump -Fc` (gzip 6 default) | 20–60 MB, 10–60 s in-region | < 5 MB fails; `timeout 1500` |
| `initdb` + `pg_restore -j2` | 30–90 s, ~300 MB disk, < 500 MB RAM | `--exit-on-error`; counts < 98 % fail |
| `age` | < 3 s | > 150 MiB ciphertext fails (guard) |
| upload 50 MB from us-west2 to R2 | 5–20 s | size/md5 mismatch fails |
| whole run | 2–5 min | Sentry `max_runtime` 30 min; `checkin_margin` 60 min → "missed" alert by ~10:15 UTC |
| storage | ≈ 2.4 GB at steady state | revisit when dump > 150 MB |

## 4. Step-by-step execution (with verification after each step)

### 4.0 Prerequisites (owner, before deploy day — all $0)

1. `age-keygen` per decision 2; send Claude the `age1…` public key only. **Verify**: Claude checks the regex; owner confirms the identity file is in the password manager and offline.
2. Provide a Sentry DSN (decision 3) by pasting it into Railway → `pg-backup` → Variables → `SENTRY_DSN` (the service must exist first — Claude creates it in §4.3 step 1 and tells the owner). Or a Healthchecks.io ping URL as `HEARTBEAT_URL`. **Verify**: Claude sees the *name* in the keys-only listing.
3. Keep today's manual `pg_dump` on the Mac until gate G2 passes.

### 4.1 Release 1 — code (Claude; branch `feat/pg-backup` off `main`)

1. Create `infra/pg-backup/{Dockerfile,backup.sh,railway.toml,README.md,.dockerignore}` per §3.2–3.4. **Verify**: `shellcheck infra/pg-backup/backup.sh` clean (`docker run --rm -v "$PWD/infra/pg-backup:/s" koalaman/shellcheck:stable /s/backup.sh`); `docker build -t doctalk-pg-backup infra/pg-backup` succeeds; `docker run --rm --entrypoint pg_dump doctalk-pg-backup --version` prints 17.x.
2. **Local end-to-end** against `docker compose up -d` (Postgres + MinIO as the S3 stand-in; no `pg_dump`/`age` on the Mac needed): generate a throwaway key with `docker run --rm --entrypoint age-keygen doctalk-pg-backup`, run the image with `--network` of the compose project, `DATABASE_URL=postgresql://doctalk:doctalk@postgres:5432/doctalk`, `R2_ENDPOINT=http://minio:9000`, `R2_BUCKET=doctalk-ops-test` (create via `mc`/compose), `AGE_RECIPIENT=<throwaway>`, no Sentry. **Verify**: exit 0; `BACKUP OK` line; object + manifest present in MinIO; a second run with `RESTORE_TEST=1` against a DB where a table was truncated fails with the counts message (negative test); a run with `AGE_RECIPIENT` unset exits 1 before dumping; run with the dump truncated to 1 MB exits 1 (size floor). Decrypt the local artifact with the throwaway identity and `pg_restore --list` it (proves the age round-trip on the same toolchain).
3. CI: add to the `docker` job in `.github/workflows/ci.yml`: `docker build infra/pg-backup` and the shellcheck line. **Verify**: CI green on the PR.
4. Codex adversarial review (prompt via stdin, `--sandbox workspace-write`): focus on secret leakage in logs/traps, fail-closed paths, count comparison logic, trap ordering (`pg_ctl stop` before `rm -rf`), rclone verification, and the `ENTRYPOINT []`/`USER postgres`/`-D` details. Iterate to consensus; record in `.collab/reviews/2026-09-2x-pg-backup-r*.md`.
5. PR → `main` → merge. **Verify**: `git log origin/main -1` is the SHA to deploy; record it in `infra/pg-backup/README.md` deploy log at §4.3 step 9.

### 4.2 R2 rules (Claude via `npx wrangler@4`, OAuth) — **before the first deploy**

1. `npx wrangler@4 r2 bucket lifecycle list doctalk-ops` and `… lock list doctalk-ops` — record current state (expected: none). `npx wrangler@4 r2 bucket lifecycle add --help` / `lock add --help` to confirm flag names before use.
2. Lifecycle (prefer `lifecycle set doctalk-ops --file lifecycle.json` from the scratchpad, since `set` replaces the whole configuration — only acceptable because step 1 showed none): `{"Rules":[{"ID":"pg-daily-expire","Status":"Enabled","Filter":{"Prefix":"postgres/"},"Expiration":{"Days":35}},{"ID":"pg-monthly-expire","Status":"Enabled","Filter":{"Prefix":"postgres-monthly/"},"Expiration":{"Days":400}},{"ID":"abort-mpu","Status":"Enabled","Filter":{"Prefix":""},"AbortIncompleteMultipartUpload":{"DaysAfterInitiation":2}}]}`. **No `qdrant/` rule.**
3. Locks: `npx wrangler@4 r2 bucket lock add doctalk-ops --name pg-daily-lock --prefix postgres/ --retention-days 14` and `… --name pg-monthly-lock --prefix postgres-monthly/ --retention-days 60` (exact flags per `--help`).
4. **Verify**: `lifecycle list` shows 3 rules; `lock list` shows 2; `npx wrangler@4 r2 object put doctalk-ops/postgres/_locktest-$(date +%s) --file <1-byte file>` then `r2 object delete` of it **fails** (lock works) — the 1-byte test object expires via lifecycle in 35 days; note it in the README so nobody hunts for it.

### 4.3 Railway service (Claude; owner pastes `SENTRY_DSN`)

1. Create `pg-backup` (`railway add --service pg-backup` from the main checkout, or GraphQL `serviceCreate`). **Verify**: `railway status --json` lists it (keys-only parsing as done above).
2. Set every variable from §3.3 with `railway variables --service pg-backup --set …` (references as literal `${{…}}` strings; Railway resolves server-side). Tell the owner to add `SENTRY_DSN` now. **Verify**: keys-only listing shows all names including `SENTRY_DSN` and `AGE_RECIPIENT`. Do not proceed without `AGE_RECIPIENT` (fail-closed would just burn the first run) — if the key is not available, the deploy waits; the manual dump covers the gap.
3. Confirm the region/config path works before the run: after step 4's deploy, read back `serviceInstance { builder dockerfilePath restartPolicyType restartPolicyMaxRetries cronSchedule multiRegionConfig }` via GraphQL (token in `~/.railway/config.json`, same pattern as CLAUDE.md).
4. **First deploy = smoke run**: `cd /Users/mayijie/Projects/Code/010_DocTalk && git pull && railway up infra/pg-backup --path-as-root -s pg-backup -e production`. Without `cronSchedule`, the container starts immediately, performs one real backup, exits 0. **Verify** in `railway logs -s pg-backup`: first line shows `RAILWAY_REPLICA_REGION=us-west2`; `pg_isready` succeeded (proves the `${{Postgres.DATABASE_URL}}` reference resolved — never read the value); `restore_test=ok`; `BACKUP OK key=…`; build log shows the Dockerfile was picked up (not Railpack). If the region is wrong, apply `serviceInstanceUpdate(multiRegionConfig)` and redeploy before continuing.
5. **Gate G1 — artifact verification from outside**: `npx wrangler@4 r2 object get doctalk-ops/postgres/<key>.manifest.json --file <scratchpad>/m.json` and `… <key>.dump.age --file <scratchpad>/a.age`; `shasum -a 256 a.age` equals `artifact_sha256`; size equals `artifact_bytes`; `head -c 22 a.age` is `age-encryption.org/v1`; manifest `source_counts.users` ≈ 183, `restore_test == "ok"`, `alembic_version` equals the current head in `backend/alembic/versions/`. Delete the local copies.
6. Sentry: owner (or Claude via the owner's screen) confirms monitor `pg-backup-nightly` exists with one `ok` check-in and schedule `15 9 * * *` UTC, and that the project alert rule emails on new issues.
7. **Negative alert test (recommended, 10 min)**: temporarily set `MIN_DUMP_BYTES=999999999999`, redeploy (runs once, fails at the size floor, Railway retries once, both send `status=error`) → owner receives a Sentry email. Restore `MIN_DUMP_BYTES=5000000`, redeploy (one more successful run). This proves the failure path end-to-end before anyone relies on it. Two or three extra objects in `postgres/` are fine (unique keys).
8. Set the schedule: GraphQL `serviceInstanceUpdate(input:{cronSchedule:"15 9 * * *"})`. This may trigger another deployment that runs once more — harmless. Then add `cronSchedule = "15 9 * * *"` to `railway.toml`, commit to `main` (tiny PR, no review needed beyond CI), and redeploy once so config-as-code and dashboard agree (config-as-code overrides the dashboard permanently from here on). **Verify**: GraphQL readback shows the schedule; the service shows "Scheduled" in the dashboard.
9. Record in `infra/pg-backup/README.md`: deployed SHA, image digest, date, service id, the `_locktest` object.
10. **Gate G3 — first unattended nightly**: next day after 09:20 UTC, `railway logs -s pg-backup` shows `BACKUP OK`; Sentry monitor shows a second `ok`; wrangler `object get` of the new manifest passes the same checks as G1.

### 4.4 Gate G2 — owner restore drill (week 1, ~15 min; §5.2)

Until this passes, status in docs is "plaintext restorability proved nightly; stored-artifact decryptability unverified".

### 4.5 Release 2 — independent watcher + admin tile (Claude writes, Codex reviews, backend-first deploy, v0.34.0)

1. **Access check first** (execution-time, read-only, in the backend container via `railway ssh -s backend` + base64-delivered snippet): `storage_service.transfer_client.list_objects("doctalk-ops", prefix="postgres/")`. If `AccessDenied`, the backend's `MINIO_*` token differs from `R2_*`; then the service in step 2 builds a second `Minio` client from `settings.R2_ACCESS_KEY_ID/R2_SECRET_ACCESS_KEY` (add those two settings) — otherwise reuse `transfer_client`.
2. `backend/app/core/config.py`: `OPS_BUCKET="doctalk-ops"`, `PG_BACKUP_PREFIX="postgres/"`, `PG_BACKUP_MAX_AGE_HOURS=30`, `PG_BACKUP_MIN_BYTES=5_000_000`, `PG_BACKUP_MONITOR_ENABLED=False` (prod sets `1`; dev/CI MinIO has no ops bucket, so the task must return `disabled` cleanly).
3. `backend/app/services/backup_status_service.py`: `get_postgres_backup_status() -> dict` — list the prefix, choose the newest `*.dump.age`/`*.dump` by `last_modified`, GET its manifest (cap 64 KB), return `{status: ok|stale|small|unverified|missing|disabled, latest_key, created_at, age_hours, bytes, restore_test, alembic_version, encrypted}`. Sync minio-py; callers in the API wrap with `asyncio.to_thread` (backend rule).
4. `backend/app/workers/ops_monitor.py`: task `check_postgres_backup_freshness`; beat entry `celery.schedules.crontab(hour=12, minute=0)` UTC (≈ 3 h after the backup, so a missed run is stale by then) in `celery_app.py` `beat_schedule`, module added to `include`. On any non-`ok`: `logger.error("ops.pg_backup.%s", status)`, `sentry_sdk.capture_message(...)` (no-op without DSN — see decision 4), and one `product_events` row `event_name="ops.backup_stale", source="beat", metadata_json=<status dict>` via the sync-engine pattern in `cleanup_tasks.py`. On `ok`: `logger.info` only (no daily analytics noise).
5. `backend/app/api/admin.py`: `GET /api/admin/ops-health` (`require_admin`) → `{"postgres_backup": status}`, same shape as `billing-health`. Frontend: a "Backups" KPI card in `OverviewTab.tsx` ("Last Postgres backup · 7 h ago · 42 MB · restore test OK", red when not `ok`), type in `types.ts`.
6. Tests: `backend/tests/test_backup_status_service.py` with a FakeMinio (pattern from `test_storage_service.py`): newest-selection, stale (> 30 h), small, manifest missing → `unverified`, bucket missing/AccessDenied → `missing`, disabled flag. Beat task unit test asserts a `product_events` insert only on non-ok (fake session).
7. Version bump 0.34.0 (`version.json`, `frontend/package.json`, `package-lock.json` ×2, both changelogs; `python3 scripts/check_version_consistency.py`). Codex review. Normal `/deploy` order from `stable`: `railway up --detach` → `/health` shows 0.34.0 → push `stable`. Owner sets `PG_BACKUP_MONITOR_ENABLED=1` (and `SENTRY_DSN` if decision 4 is yes) on `backend`. **Verify**: admin dashboard tile green with today's key; `railway logs -s backend | grep ops.pg_backup` after 12:00 UTC; negative test by temporarily setting `PG_BACKUP_MAX_AGE_HOURS=1` → tile red, one `ops.backup_stale` row, Sentry message if DSN set; restore to 30.

### 4.6 Docs pass (same PR as Release 1's toml follow-up or Release 2)

- `docs/ARCHITECTURE.md`: §9 table gains a **Backups** row; §10 new subsection "Postgres backups (2026-09-2x)" — mechanism, invariants (unique keys, fail-closed encryption, lock, no `qdrant/` rule), alert layers, RPO/RTO, drill cadence; fix "PostgreSQL 16" → 17.11 at line 28; mirror in `docs/ARCHITECTURE.zh.md`.
- `CLAUDE.md` + `AGENTS.md`: infra row "Postgres 16" → "Postgres 17.11"; Reference line for `infra/pg-backup/README.md`; "Avoid" bullet qualifier per decision 7; new bullet: "Never print Railway variable values — keys-only listing".
- `.claude/rules/backend.md`: an Ops bullet (backup invariants; `doctalk-ops` is never presigned to browsers).
- `README.md` line 57 "PostgreSQL 16" → 17; `CHANGELOG.md`/`CHANGELOG.zh.md` under 0.34.0.

### 4.7 Phase 7 (optional, later) — weekly Qdrant snapshot in the same job

Same container, Sundays (`date -u +%u == 7`): `curl -X POST $QDRANT_URL/collections/$QDRANT_COLLECTION/snapshots` (refs `${{backend.QDRANT_URL}}`, `${{backend.QDRANT_COLLECTION}}`; no API key var exists on the backend) → download → sha256 vs Qdrant's `checksum` → `age` → `doctalk-ops/qdrant/doc_chunks-<UTC>.snapshot.age` + manifest (`points_count`) → `DELETE` the server-side snapshot. Only then add lifecycle `qdrant/` 90 days + lock 14 days. Shares the single Sentry monitor (the free plan includes exactly one; do not create a second). Restore = decrypt on the Mac, upload plaintext to a short-lived key, `PUT /collections/doc_chunks/snapshots/recover {"location": <presigned URL>}` per the r2-migration plan.

## 5. Restore procedure + restore-test

### 5.1 Disaster restore (owner + Claude)

1. **Pick the artifact**: latest `postgres/doctalk-<UTC>.manifest.json` (Cloudflare dashboard → R2 → `doctalk-ops`, or the key from Railway `pg-backup` logs / Sentry check-in time; keys sort by timestamp). Read `alembic_version` and `source_counts`.
2. **Download + verify** (Claude): `npx wrangler@4 r2 object get doctalk-ops/postgres/<key>.dump.age --file ~/Private/restore/<key>.dump.age` (+ manifest); `shasum -a 256` equals `artifact_sha256`.
3. **Decrypt** (owner only): `age -d -i ~/Private/doctalk-backup-age.key -o <key>.dump <key>.dump.age`.
4. **Target**: (a) Postgres service gone → create a new Railway Postgres (Hobby OK; pin us-west2), it exposes `DATABASE_PUBLIC_URL`; (b) service exists but data is bad → stop writers first (remove the backend deployment), then `psql "$MAINT_URL" -c 'DROP DATABASE railway' -c 'CREATE DATABASE railway'` using the public URL pointed at the `postgres` maintenance DB. Prefer (a) when in doubt; keep the old service untouched for forensics.
5. **Restore from the Mac** (owner supplies the URL through an env var, never in chat): `docker run --rm -v ~/Private/restore:/b postgres:17.11-bookworm pg_restore --no-owner --no-privileges -j 4 -d "$TARGET_PUBLIC_URL" /b/<key>.dump`. Expect 2–5 min over the TCP proxy. `psql "$TARGET_PUBLIC_URL" -Atc "select count(*) from users"` matches `restored_counts.users`.
6. **Repoint**: if (a), set `backend` `DATABASE_URL=${{<NewPostgres>.DATABASE_URL}}` and `pg-backup`'s reference likewise (staged change, one redeploy). Backend startup runs `alembic upgrade head`: no-op if the image matches `alembic_version`, forward migrations if newer — never deploy an image *older* than the dump's revision (see deploy skill rollback note).
7. **Reconcile the gap since the backup timestamp** (RPO ≤ 24 h): Stripe → Developers → Events → resend `invoice.payment_succeeded` / `checkout.session.completed` / subscription events after that timestamp (idempotent by invoice id / handled by the existing webhook); users who signed up after it re-create their account on next login; documents created after it are gone from Postgres — their R2 objects and Qdrant points are harmless orphans (optionally delete by `document_id` filter); chunks present in Postgres all predate the backup, so their vectors exist. Redis needs nothing.
8. **Verify**: `GET /health?deep=true` all `ok`; login, open a pre-existing document, chat with citation jump; admin dashboard counts ≈ manifest; next nightly `BACKUP OK` against the restored DB.

### 5.2 Restore drill (Gate G2, week 1; then quarterly)

1. Claude: download the newest artifact + manifest (step 5.1.2), verify sha256, hand the path to the owner.
2. Owner: decrypt (5.1.3); `docker run -d --name pgdrill -e POSTGRES_PASSWORD=drill -v ~/Private/restore:/b postgres:17.11-bookworm`; `docker exec pgdrill pg_restore -U postgres -d postgres --no-owner --no-privileges -j 2 /b/<key>.dump`; `docker exec pgdrill psql -U postgres -Atc "select (select count(*) from users),(select count(*) from documents),(select count(*) from credit_ledger),(select version_num from alembic_version)"`.
3. Compare with `restored_counts`/`alembic_version` in the manifest; `docker rm -f pgdrill`; `rm` the plaintext dump. Record counts only (no PII) in `.collab/reviews/<date>-pg-restore-drill.md`. This also re-proves the identity file is still readable — the point of the quarterly cadence.
4. Automated part every night already covers: archive validity, full `pg_restore` into a fresh cluster, row counts, alembic revision, upload integrity. What only the drill covers: the private key, and the human procedure.

## 6. Failure alerting

| Failure | Detected by | Owner sees |
|---|---|---|
| Run errors (DB unreachable, dump too small, restore-test count mismatch, upload mismatch) | Script exits 1 → Sentry `status=error`; Railway retries once | Sentry email (threshold 1); Railway deployment shows Crashed |
| Run never starts (schedule removed, service paused/deleted, Railway outage) or hangs past 30 min | Sentry cron monitor: missed check-in after 60-min margin / timeout | Sentry email ~10:15 UTC |
| Run "succeeds" but wrote a wrong bucket/prefix, nothing recent exists, or manifest lacks `restore_test: ok` | Release 2 watcher at 12:00 UTC (independent listing of R2) | Admin dashboard tile red; `product_events` `ops.backup_stale`; Sentry email if `SENTRY_DSN` is on `backend` |
| Sentry itself misconfigured / DSN missing | Layer 2 still writes the `product_events` row and the tile turns red; Sentry's own "monitor has never checked in" is visible in its UI | Only when the owner looks — hence decision 3 is blocking |
| Encrypted artifact undecryptable (lost key, wrong recipient) | Not detectable automatically (by design) | Week-1 and quarterly drill (G2) |

Alerts go only to the owner (Sentry/Healthchecks email). No user-facing lifecycle emails are involved anywhere in this plan.

## 7. Risks

- **Owner-gated alerting.** No `SENTRY_DSN` exists on the production backend today; if decision 3 is skipped, the only signals are Railway logs and (after Release 2) the admin tile. The plan makes it a blocking item and includes a negative alert test (§4.3.7) so the path is proven, not assumed.
- **Key custody.** A lost `age` identity makes every artifact worthless. Mitigations: two copies of the identity, drill in week 1 and quarterly, `age_recipient` recorded in every manifest so a mismatch is visible.
- **Shared R2 token blast radius.** Day 0 reuses the backend token in a second container. Mitigations: bucket lock (14/60 days of immutability), dedicated `doctalk-ops`-only token for `pg-backup` (decision 5), no secrets in logs. The lock also means a mistaken upload cannot be removed for 14 days — accepted for the ops bucket.
- **Railway unknowns to verify at execution**: whether Hobby honours `cronSchedule` (if the field is Pro-only, fallback is the same container run always-on with an internal 24 h sleep loop, ≈ $1–2/mo — flag to the owner before doing it); whether `multiRegionConfig` applies from `railway.toml` (fallback GraphQL; verify via `RAILWAY_REPLICA_REGION`); whether a deploy with a schedule also runs immediately (harmless either way); private-DNS warm-up (covered by the retry loop).
- **Wrangler flag names** for `lifecycle`/`lock` and the `postgres:17.11-bookworm` tag must be confirmed at execution (`--help`, `docker manifest inspect`).
- **Server major upgrade** (Railway moves Postgres to 18): `pg_dump` 17 refuses → loud failure → bump the image. Correct failure mode.
- **Coincident alembic migration**: a deploy at 09:15 UTC blocks on the dump's ACCESS SHARE locks for ≤ 5 min. Accepted; avoid deploying in that window.
- **Resource growth**: at ~2 GB DB the in-container restore needs more disk/RAM and the 150 MiB guard fires; revisit then (multipart + `X-Amz-Meta-Md5chksum`, or drop the in-container restore to weekly).
- **Config-as-code precedence**: once `cronSchedule` is in `railway.toml`, dashboard edits are silently overridden — documented in the README.
- **Public-repo hygiene**: `infra/pg-backup/` contains the account endpoint (already public in `storage_delta_copy.py`) and no credentials; gitleaks default rules apply.

## 8. Out of scope

Railway Pro; WAL archiving / PITR (RPO 24 h accepted for ~0 active users); a second cloud copy (e.g. B2) of `doctalk-ops`; backup of the `doctalk-pdfs` bucket itself (R2 has no versioning — candidate for a later `rclone sync` to a second bucket); Redis (broker/cache only); RetainPDF volume; Qdrant weekly snapshots (Phase 7 sketch only); per-user or per-row restores; cleanup of the stale `LEGACY_MINIO_*` variables on `backend`; rotating the backend's R2 token; any user-facing communication.

### Critical Files for Implementation
- /Users/mayijie/Projects/Code/010_DocTalk/infra/pg-backup/backup.sh (new — the whole backup/restore-test/upload/heartbeat contract in §3.4)
- /Users/mayijie/Projects/Code/010_DocTalk/infra/pg-backup/Dockerfile (new — `postgres:17.11-bookworm` + `curl age rclone`, `USER postgres`, `ENTRYPOINT []`)
- /Users/mayijie/Projects/Code/010_DocTalk/infra/pg-backup/railway.toml (new — restart policy, `us-west2` pin, later `cronSchedule`)
- /Users/mayijie/Projects/Code/010_DocTalk/backend/app/workers/celery_app.py (Release 2 — beat entry + include for `ops_monitor`)
- /Users/mayijie/Projects/Code/010_DocTalk/backend/app/api/admin.py (Release 2 — `GET /api/admin/ops-health`)

Also touched: `infra/pg-backup/README.md` (runbook), `backend/app/services/backup_status_service.py` and `backend/app/workers/ops_monitor.py` (new), `backend/app/core/config.py`, `backend/tests/test_backup_status_service.py`, `frontend/src/components/admin/OverviewTab.tsx` + `types.ts`, `.github/workflows/ci.yml`, `docs/ARCHITECTURE.md` / `docs/ARCHITECTURE.zh.md`, `CLAUDE.md`, `AGENTS.md`, `README.md`, `.claude/rules/backend.md`, `CHANGELOG.md` / `CHANGELOG.zh.md`, `version.json`.
