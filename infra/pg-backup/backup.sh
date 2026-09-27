#!/usr/bin/env bash
# Nightly Postgres backup: dump, prove the dump restores, encrypt, upload to
# R2, verify the upload, report to the dead-man's switch. Runs once and exits
# (Railway cron service). Runbook: README.md in this directory.
#
# Never add `set -x` and never print a variable that can hold a secret
# (DATABASE_URL, R2_*, SENTRY_DSN, HEARTBEAT_URL). `${VAR:?}` errors print the
# variable's name only.
set -euo pipefail
umask 077

log() { printf '%s %s\n' "$(date -u +%H:%M:%SZ)" "$*"; }

BACKUP_PREFIX="${BACKUP_PREFIX:-postgres}"
MONTHLY_PREFIX="${MONTHLY_PREFIX:-postgres-monthly}"
MIN_DUMP_BYTES="${MIN_DUMP_BYTES:-5000000}"
MAX_UPLOAD_BYTES="${MAX_UPLOAD_BYTES:-157286400}"   # rclone's MD5 check needs a single-part upload (< 200 MiB)
RESTORE_TEST="${RESTORE_TEST:-1}"
R2_PROVIDER="${R2_PROVIDER:-Cloudflare}"            # local tests against MinIO set Minio
SENTRY_MONITOR_SLUG="${SENTRY_MONITOR_SLUG:-pg-backup-nightly}"
SENTRY_CRON_SCHEDULE="${SENTRY_CRON_SCHEDULE:-15 9 * * *}"
KEY_TABLES=(users documents chunks document_elements credit_ledger)

STAGE=setup
WORK=""
PGTEST=/tmp/pgtest
PGSOCK=/tmp/pgsock
PGTEST_STARTED=""
CRON_URL=""

# ---- dead-man's switch -----------------------------------------------------
if [[ -n "${SENTRY_DSN:-}" ]]; then
  if [[ "$SENTRY_DSN" =~ ^https://([^@/]+)@([^/]+)/(.+)$ ]]; then
    CRON_URL="https://${BASH_REMATCH[2]}/api/${BASH_REMATCH[3]}/cron/${SENTRY_MONITOR_SLUG}/${BASH_REMATCH[1]}/"
  else
    log "WARN SENTRY_DSN is not in the https://<key>@<host>/<project> form; Sentry check-ins disabled"
  fi
fi

heartbeat() {  # $1: in_progress | ok | error. Never fails the backup.
  local status=$1 body suffix
  if [[ -n "$CRON_URL" ]]; then
    if [[ "$status" == in_progress ]]; then
      body=$(jq -nc --arg schedule "$SENTRY_CRON_SCHEDULE" '{
        status: "in_progress", environment: "production",
        monitor_config: {
          schedule: {type: "crontab", value: $schedule}, timezone: "UTC",
          checkin_margin: 60, max_runtime: 30,
          failure_issue_threshold: 1, recovery_threshold: 1
        }}')
    else
      body=$(jq -nc --arg status "$status" '{status: $status, environment: "production"}')
    fi
    curl -sS -o /dev/null -m 15 --retry 2 -X POST -H 'Content-Type: application/json' \
      --data-raw "$body" "$CRON_URL" || log "WARN Sentry check-in ($status) failed"
  fi
  if [[ -n "${HEARTBEAT_URL:-}" ]]; then
    case "$status" in in_progress) suffix=/start ;; error) suffix=/fail ;; *) suffix="" ;; esac
    curl -fsS -o /dev/null -m 10 --retry 3 "${HEARTBEAT_URL}${suffix}" || log "WARN heartbeat ($status) failed"
  fi
}

finish() {
  local rc=$?
  set +e
  if [[ -n "$PGTEST_STARTED" ]]; then
    pg_ctl -D "$PGTEST" -m immediate stop >/dev/null 2>&1
  fi
  [[ -n "$WORK" ]] && rm -rf "$WORK" "$PGTEST" "$PGSOCK"
  if [[ $rc -ne 0 ]]; then
    log "BACKUP FAILED stage=$STAGE exit=$rc"
    heartbeat error
  fi
  exit "$rc"
}
trap finish EXIT

log "pg-backup start region=${RAILWAY_REPLICA_REGION:-unknown} deployment=${RAILWAY_DEPLOYMENT_ID:-unknown} $(pg_dump --version)"
heartbeat in_progress

# ---- fail-closed configuration ---------------------------------------------
STAGE=config
: "${DATABASE_URL:?}" "${R2_ENDPOINT:?}" "${R2_BUCKET:?}" "${R2_ACCESS_KEY_ID:?}" "${R2_SECRET_ACCESS_KEY:?}"
if [[ "${ALLOW_PLAINTEXT:-0}" != "1" && ! "${AGE_RECIPIENT:-}" =~ ^age1[a-z0-9]{58}$ ]]; then
  log "FAIL AGE_RECIPIENT is missing or not an age public key (ALLOW_PLAINTEXT=1 stores dumps unencrypted)"
  exit 1
fi

export RCLONE_CONFIG=/dev/null   # configuration comes from the environment only
export RCLONE_CONFIG_R2_TYPE=s3
export RCLONE_CONFIG_R2_PROVIDER="$R2_PROVIDER"
export RCLONE_CONFIG_R2_ENDPOINT="$R2_ENDPOINT"
export RCLONE_CONFIG_R2_REGION=auto
export RCLONE_CONFIG_R2_ACCESS_KEY_ID="$R2_ACCESS_KEY_ID"
export RCLONE_CONFIG_R2_SECRET_ACCESS_KEY="$R2_SECRET_ACCESS_KEY"
# An object-scoped R2 token may not create buckets; never try.
export RCLONE_CONFIG_R2_NO_CHECK_BUCKET=true

TS=$(date -u +%Y%m%dT%H%M%SZ)
KEY_BASE="doctalk-${TS}"
WORK=$(mktemp -d /tmp/pgbackup.XXXXXX)
DUMP="$WORK/$KEY_BASE.dump"

# ---- source ------------------------------------------------------------------
STAGE=connect
for attempt in $(seq 1 12); do
  if pg_isready -q -d "$DATABASE_URL" -t 5; then break; fi
  [[ $attempt -eq 12 ]] && { log "FAIL database not reachable after 12 attempts"; exit 1; }
  sleep 5
done

counts_sql() {
  local sql="select current_setting('server_version_num'), (select version_num from alembic_version)"
  local table
  for table in "${KEY_TABLES[@]}"; do sql+=", (select count(*) from ${table})"; done
  printf '%s' "$sql"
}

STAGE=source_facts
# Command substitution first: a failing psql inside `read < <(...)` would not trip set -e.
source_line=$(psql -X -v ON_ERROR_STOP=1 -Atc "$(counts_sql)" -d "$DATABASE_URL")
IFS='|' read -r -a SOURCE <<<"$source_line"
SERVER_VERSION_NUM=${SOURCE[0]}
ALEMBIC=${SOURCE[1]}
CLIENT_MAJOR=$(pg_dump --version | awk '{print $3}' | cut -d. -f1)
if (( SERVER_VERSION_NUM / 10000 > CLIENT_MAJOR )); then
  log "FAIL server major $((SERVER_VERSION_NUM / 10000)) is newer than pg_dump $CLIENT_MAJOR; bump the image"
  exit 1
fi

STAGE=dump
t0=$SECONDS
timeout 1500 pg_dump -Fc -f "$DUMP" -d "$DATABASE_URL"
T_DUMP=$((SECONDS - t0))
DUMP_BYTES=$(stat -c %s "$DUMP")
if (( DUMP_BYTES < MIN_DUMP_BYTES )); then
  log "FAIL dump is $DUMP_BYTES bytes, below MIN_DUMP_BYTES=$MIN_DUMP_BYTES"
  exit 1
fi
TOC_ENTRIES=$(pg_restore --list "$DUMP" | grep -cv '^;')
if (( TOC_ENTRIES <= 50 )); then
  log "FAIL dump table of contents has only $TOC_ENTRIES entries"
  exit 1
fi
DUMP_SHA256=$(sha256sum "$DUMP" | cut -d' ' -f1)
log "dump ok bytes=$DUMP_BYTES toc=$TOC_ENTRIES seconds=$T_DUMP"

# ---- restore test: nothing is uploaded that did not restore ------------------
declare -a RESTORED=()
T_RESTORE=0
RESTORE_RESULT=skipped
if [[ "$RESTORE_TEST" == "1" ]]; then
  STAGE=restore_test
  t0=$SECONDS
  # Always pass -D: the base image points PGDATA at a declared volume.
  initdb -D "$PGTEST" -U postgres --auth=trust --no-sync >/dev/null
  mkdir -p "$PGSOCK"
  pg_ctl -D "$PGTEST" -w -l "$WORK/restore-test.log" \
    -o "-c listen_addresses='' -k $PGSOCK -c fsync=off -c synchronous_commit=off -c full_page_writes=off -c shared_buffers=128MB -c maintenance_work_mem=256MB" \
    start >/dev/null
  PGTEST_STARTED=1
  createdb -h "$PGSOCK" -U postgres restore_test
  pg_restore -h "$PGSOCK" -U postgres -d restore_test --no-owner --no-privileges --exit-on-error -j 2 "$DUMP"
  restored_line=$(psql -X -h "$PGSOCK" -U postgres -d restore_test -v ON_ERROR_STOP=1 -Atc "$(counts_sql)")
  IFS='|' read -r -a RESTORED <<<"$restored_line"
  pg_ctl -D "$PGTEST" -m immediate stop >/dev/null
  PGTEST_STARTED=""
  rm -rf "$PGTEST"
  T_RESTORE=$((SECONDS - t0))

  if [[ "${RESTORED[1]}" != "$ALEMBIC" ]]; then
    log "FAIL restored alembic revision ${RESTORED[1]} != source $ALEMBIC"
    exit 1
  fi
  for i in "${!KEY_TABLES[@]}"; do
    src=${SOURCE[$((i + 2))]}
    got=${RESTORED[$((i + 2))]}
    # The source counts are read just before the dump's snapshot, so a few
    # rows may differ; a large shortfall or an empty key table fails the run.
    if (( got < src * 98 / 100 )); then
      log "FAIL restored ${KEY_TABLES[$i]}=$got is below 98% of source $src"
      exit 1
    fi
    if (( got == 0 )) && [[ "${KEY_TABLES[$i]}" != document_elements ]]; then
      log "FAIL restored ${KEY_TABLES[$i]} is empty"
      exit 1
    fi
  done
  RESTORE_RESULT=ok
  log "restore test ok seconds=$T_RESTORE"
fi

# ---- encrypt -------------------------------------------------------------------
STAGE=encrypt
if [[ -n "${AGE_RECIPIENT:-}" ]]; then
  ARTIFACT="$WORK/$KEY_BASE.dump.age"
  age -r "$AGE_RECIPIENT" -o "$ARTIFACT" "$DUMP"
  ENCRYPTED=true
else
  ARTIFACT="$DUMP"
  ENCRYPTED=false
fi
rm -f "$WORK/restore-test.log"
ARTIFACT_NAME=$(basename "$ARTIFACT")
ARTIFACT_BYTES=$(stat -c %s "$ARTIFACT")
ARTIFACT_SHA256=$(sha256sum "$ARTIFACT" | cut -d' ' -f1)
ARTIFACT_MD5=$(md5sum "$ARTIFACT" | cut -d' ' -f1)
if (( ARTIFACT_BYTES > MAX_UPLOAD_BYTES )); then
  log "FAIL artifact is $ARTIFACT_BYTES bytes, above MAX_UPLOAD_BYTES=$MAX_UPLOAD_BYTES (upload verification assumes a single-part upload)"
  exit 1
fi

# ---- manifest (no PII, no URLs) ------------------------------------------------
MANIFEST="$WORK/$KEY_BASE.manifest.json"
counts_json() {  # $@: counts in KEY_TABLES order
  local -a values=("$@")
  local i out="{}"
  for i in "${!KEY_TABLES[@]}"; do
    out=$(jq -c --arg k "${KEY_TABLES[$i]}" --argjson v "${values[$i]:-null}" '. + {($k): $v}' <<<"$out")
  done
  printf '%s' "$out"
}
SOURCE_COUNTS=$(counts_json "${SOURCE[@]:2}")
if [[ "$RESTORE_RESULT" == ok ]]; then RESTORED_COUNTS=$(counts_json "${RESTORED[@]:2}"); else RESTORED_COUNTS=null; fi

# ---- upload + verify -----------------------------------------------------------
STAGE=upload
remote_matches() {  # $1: remote path. Size and MD5 must equal the local artifact.
  local listing
  listing=$(rclone lsjson --hash --files-only "r2:$1")
  [[ $(jq -r '.[0].Size' <<<"$listing") == "$ARTIFACT_BYTES" ]] \
    && [[ $(jq -r '.[0].Hashes.md5 // empty' <<<"$listing") == "$ARTIFACT_MD5" ]]
}
DAILY_KEY="$BACKUP_PREFIX/$ARTIFACT_NAME"
t0=$SECONDS
rclone copyto -q "$ARTIFACT" "r2:$R2_BUCKET/$DAILY_KEY"
if ! remote_matches "$R2_BUCKET/$DAILY_KEY"; then
  log "FAIL uploaded object does not match the local artifact (size or MD5)"
  exit 1
fi
T_UPLOAD=$((SECONDS - t0))

jq -n \
  --arg created_at "$TS" --arg db "railway" --arg server_version_num "$SERVER_VERSION_NUM" \
  --arg pg_dump_version "$(pg_dump --version)" --arg alembic_version "$ALEMBIC" \
  --argjson dump_bytes "$DUMP_BYTES" --arg dump_sha256 "$DUMP_SHA256" \
  --arg artifact "$DAILY_KEY" --argjson artifact_bytes "$ARTIFACT_BYTES" \
  --arg artifact_sha256 "$ARTIFACT_SHA256" --argjson encrypted "$ENCRYPTED" \
  --arg age_recipient "${AGE_RECIPIENT:-}" --arg restore_test "$RESTORE_RESULT" \
  --argjson source_counts "$SOURCE_COUNTS" --argjson restored_counts "$RESTORED_COUNTS" \
  --argjson t_dump "$T_DUMP" --argjson t_restore "$T_RESTORE" --argjson t_upload "$T_UPLOAD" \
  --arg region "${RAILWAY_REPLICA_REGION:-}" --arg deployment "${RAILWAY_DEPLOYMENT_ID:-}" \
  '{created_at: $created_at, db: $db, server_version_num: $server_version_num,
    pg_dump_version: $pg_dump_version, alembic_version: $alembic_version,
    dump_bytes: $dump_bytes, dump_sha256: $dump_sha256,
    artifact: $artifact, artifact_bytes: $artifact_bytes, artifact_sha256: $artifact_sha256,
    encrypted: $encrypted, age_recipient: $age_recipient, restore_test: $restore_test,
    source_counts: $source_counts, restored_counts: $restored_counts,
    durations_s: {dump: $t_dump, restore: $t_restore, upload: $t_upload},
    region: $region, railway_deployment_id: $deployment}' > "$MANIFEST"
rclone copyto -q "$MANIFEST" "r2:$R2_BUCKET/$BACKUP_PREFIX/$KEY_BASE.manifest.json"

# On the first of the month, keep a long-lived copy (server-side copy).
if [[ $(date -u +%d) == 01 ]]; then
  STAGE=monthly_copy
  MONTHLY_KEY="$MONTHLY_PREFIX/$ARTIFACT_NAME"
  rclone copyto -q "r2:$R2_BUCKET/$DAILY_KEY" "r2:$R2_BUCKET/$MONTHLY_KEY"
  if ! remote_matches "$R2_BUCKET/$MONTHLY_KEY"; then
    log "FAIL monthly copy does not match the local artifact"
    exit 1
  fi
  rclone copyto -q "$MANIFEST" "r2:$R2_BUCKET/$MONTHLY_PREFIX/$KEY_BASE.manifest.json"
fi

STAGE=finished
log "BACKUP OK key=$DAILY_KEY bytes=$ARTIFACT_BYTES encrypted=$ENCRYPTED restore_test=$RESTORE_RESULT users=${SOURCE[2]} alembic=$ALEMBIC t_dump=$T_DUMP t_restore=$T_RESTORE t_upload=$T_UPLOAD"
heartbeat ok
