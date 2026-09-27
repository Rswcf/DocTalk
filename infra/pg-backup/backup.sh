#!/usr/bin/env bash
# Nightly Postgres backup: dump, prove the dump restores, encrypt, upload to
# R2, verify the upload, report to the dead-man's switch. Runs once and exits
# (Railway cron service). Runbook: README.md in this directory.
#
# Secrets (DATABASE_URL, R2_*, SENTRY_DSN, HEARTBEAT_URL) never reach a
# command line or the log: the database URL becomes libpq environment
# variables plus a private password file, curl reads its URL from a config on
# stdin and its own messages are dropped, and rclone reads its credentials
# from the environment. Never add `set -x`. `${VAR:?}` errors print names only.
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
# Source-side queries give up instead of queueing behind a lock forever.
SOURCE_PGOPTIONS="-c lock_timeout=60s -c statement_timeout=20min"

STAGE=setup
WORK=""
PGTEST=/tmp/pgtest
PGSOCK=/tmp/pgsock
PGTEST_STARTED=""
CRON_URL=""
new_uuid() {  # a random (version 4) UUID
  local hex
  if [[ -r /proc/sys/kernel/random/uuid ]]; then cat /proc/sys/kernel/random/uuid; return; fi
  hex=$(od -An -tx1 -N16 /dev/urandom | tr -d ' \n')
  printf '%s-%s-4%s-%x%s-%s\n' "${hex:0:8}" "${hex:8:4}" "${hex:13:3}" \
    $(( (16#${hex:16:1} & 3) | 8 )) "${hex:17:3}" "${hex:20:12}"
}
CHECK_IN_ID=$(new_uuid)
RUN_STARTED=$SECONDS
CHILD=""

# ---- helpers -----------------------------------------------------------------
curl_quiet() {  # $1: URL; rest: curl options. Prints the HTTP status (000 = no response).
  local url=$1 escaped
  shift
  escaped=${url//\\/\\\\}
  escaped=${escaped//\"/\\\"}
  # --max-time bounds one attempt, --retry-max-time the retries (a long
  # Retry-After cannot stall the run), and timeout the whole invocation.
  timeout -k 5 45 curl --silent --globoff --output /dev/null --write-out '%{http_code}' \
    --max-time 15 --retry 2 --retry-max-time 30 --config - "$@" \
    <<<"url = \"$escaped\"" 2>/dev/null || true
}

# Long commands run as a background job so a TERM from Railway is handled at
# once (bash defers traps while a foreground child runs) and forwarded to it.
run() {
  "$@" &
  CHILD=$!
  local rc=0
  wait "$CHILD" || rc=$?
  CHILD=""
  return "$rc"
}


# ---- dead-man's switch -----------------------------------------------------
if [[ -n "${SENTRY_DSN:-}" ]]; then
  if [[ "$SENTRY_DSN" =~ ^https://([^@/]+)@([^/]+)/(.+)$ ]]; then
    dsn_key=${BASH_REMATCH[1]} dsn_host=${BASH_REMATCH[2]} dsn_path=${BASH_REMATCH[3]}
    dsn_project=${dsn_path##*/}
    dsn_prefix=""
    [[ "$dsn_path" == */* ]] && dsn_prefix="/${dsn_path%/*}"
    CRON_URL="https://${dsn_host}${dsn_prefix}/api/${dsn_project}/cron/${SENTRY_MONITOR_SLUG}/${dsn_key}/"
    unset dsn_key dsn_host dsn_path dsn_project dsn_prefix
  else
    log "WARN SENTRY_DSN is not in the https://<key>@<host>/<project> form; Sentry check-ins disabled"
  fi
fi

heartbeat() {  # $1: in_progress | ok | error. Never fails the backup.
  local status=$1 body code suffix
  if [[ -n "$CRON_URL" ]]; then
    if [[ "$status" == in_progress ]]; then
      body=$(jq -nc --arg id "$CHECK_IN_ID" --arg schedule "$SENTRY_CRON_SCHEDULE" '{
        check_in_id: $id, status: "in_progress", environment: "production",
        monitor_config: {
          schedule: {type: "crontab", value: $schedule}, timezone: "UTC",
          checkin_margin: 60, max_runtime: 30,
          failure_issue_threshold: 1, recovery_threshold: 1
        }}')
    else
      body=$(jq -nc --arg id "$CHECK_IN_ID" --arg status "$status" \
        --argjson duration "$((SECONDS - RUN_STARTED))" \
        '{check_in_id: $id, status: $status, duration: $duration, environment: "production"}')
    fi
    code=$(curl_quiet "$CRON_URL" -X POST -H 'Content-Type: application/json' --data-raw "$body")
    [[ "$code" == 2* ]] || log "WARN Sentry check-in ($status) not accepted: HTTP $code"
  fi
  if [[ -n "${HEARTBEAT_URL:-}" ]]; then
    case "$status" in in_progress) suffix=/start ;; error) suffix=/fail ;; *) suffix="" ;; esac
    code=$(curl_quiet "${HEARTBEAT_URL}${suffix}")
    [[ "$code" == 2* ]] || log "WARN heartbeat ($status) not accepted: HTTP $code"
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
on_signal() {
  [[ -n "$CHILD" ]] && kill -TERM "$CHILD" 2>/dev/null
  exit 143
}
trap finish EXIT
# Railway stopping the container is a failure too: stop the running step and
# exit so the EXIT trap reports it.
trap on_signal TERM INT

log "pg-backup start region=${RAILWAY_REPLICA_REGION:-unknown} deployment=${RAILWAY_DEPLOYMENT_ID:-unknown} $(pg_dump --version)"
heartbeat in_progress

# ---- fail-closed configuration ---------------------------------------------
STAGE=config
: "${DATABASE_URL:?}" "${R2_ENDPOINT:?}" "${R2_BUCKET:?}" "${R2_ACCESS_KEY_ID:?}" "${R2_SECRET_ACCESS_KEY:?}"
if [[ "${ALLOW_PLAINTEXT:-0}" != "1" && ! "${AGE_RECIPIENT:-}" =~ ^age1[a-z0-9]{58}$ ]]; then
  log "FAIL AGE_RECIPIENT is missing or not an age public key (ALLOW_PLAINTEXT=1 stores dumps unencrypted)"
  exit 1
fi
if [[ "$RESTORE_TEST" != 0 && "$RESTORE_TEST" != 1 ]]; then
  log "FAIL RESTORE_TEST must be 1 (default) or 0"
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
RCLONE_FLAGS=(-q --contimeout 30s --timeout 120s --retries 3)

TS=$(date -u +%Y%m%dT%H%M%SZ)
KEY_BASE="doctalk-${TS}"
WORK=$(mktemp -d /tmp/pgbackup.XXXXXX)
DUMP="$WORK/$KEY_BASE.dump"

# DATABASE_URL -> libpq environment + a private password file. Only the plain
# form Railway's ${{Postgres.DATABASE_URL}} produces is accepted: no query
# parameters, percent-escapes or IPv6 literals, so nothing the URL asks for
# (TLS settings included) can be silently dropped. Set TLS with the libpq
# environment variable PGSSLMODE on the service if it is ever needed.
url_re='^postgres(ql)?://([A-Za-z0-9._~-]+):([A-Za-z0-9._~-]+)@([A-Za-z0-9.-]+)(:([0-9]+))?/([A-Za-z0-9_-]+)$'
if [[ ! "$DATABASE_URL" =~ $url_re ]]; then
  log "FAIL DATABASE_URL must be postgresql://user:password@host[:port]/db with no query parameters, percent-escapes or IPv6 (see README)"
  exit 1
fi
export PGUSER=${BASH_REMATCH[2]} PGHOST=${BASH_REMATCH[4]} PGPORT=${BASH_REMATCH[6]:-5432}
export PGDATABASE=${BASH_REMATCH[7]} PGPASSFILE="$WORK/.pgpass"
# Fields are restricted to characters that need no pgpass escaping.
printf '%s:%s:%s:%s:%s\n' "$PGHOST" "$PGPORT" "$PGDATABASE" "$PGUSER" "${BASH_REMATCH[3]}" > "$PGPASSFILE"
unset DATABASE_URL

# ---- source ------------------------------------------------------------------
STAGE=connect
for attempt in $(seq 1 12); do
  if pg_isready -q -t 5; then break; fi
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
# Through run (not $(...)) so a TERM during a slow query is handled at once.
PGOPTIONS="$SOURCE_PGOPTIONS" run timeout -k 5 330 psql -X -v ON_ERROR_STOP=1 -Atc "$(counts_sql)" -o "$WORK/source_facts"
IFS='|' read -r -a SOURCE < "$WORK/source_facts"
SERVER_VERSION_NUM=${SOURCE[0]}
ALEMBIC=${SOURCE[1]}
CLIENT_MAJOR=$(pg_dump --version | awk '{print $3}' | cut -d. -f1)
if (( SERVER_VERSION_NUM / 10000 > CLIENT_MAJOR )); then
  log "FAIL server major $((SERVER_VERSION_NUM / 10000)) is newer than pg_dump $CLIENT_MAJOR; bump the image"
  exit 1
fi

STAGE=dump
t0=$SECONDS
PGOPTIONS="$SOURCE_PGOPTIONS" run timeout -k 5 1500 pg_dump -Fc --lock-wait-timeout=120s -f "$DUMP"
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
# Local commands talk to the throwaway cluster over its own socket, with none
# of the source connection settings.
local_pg() { PGHOST="$PGSOCK" PGPORT=5432 PGUSER=postgres PGDATABASE=restore_test PGSSLMODE=disable PGOPTIONS="" "$@"; }

declare -a RESTORED=()
T_RESTORE=0
RESTORE_RESULT=skipped
if [[ "$RESTORE_TEST" == 1 ]]; then
  STAGE=restore_test
  t0=$SECONDS
  # Always pass -D: the base image points PGDATA at a declared volume.
  initdb -D "$PGTEST" -U postgres --auth=trust --no-sync >/dev/null
  mkdir -p "$PGSOCK"
  pg_ctl -D "$PGTEST" -w -t 120 -l "$WORK/restore-test.log" \
    -o "-p 5432 -c listen_addresses='' -k $PGSOCK -c fsync=off -c synchronous_commit=off -c full_page_writes=off -c shared_buffers=128MB -c maintenance_work_mem=256MB" \
    start >/dev/null
  PGTEST_STARTED=1
  local_pg createdb restore_test
  local_pg run timeout -k 5 1800 pg_restore -d restore_test --no-owner --no-privileges --exit-on-error -j 2 "$DUMP"
  restored_line=$(local_pg psql -X -v ON_ERROR_STOP=1 -Atc "$(counts_sql)")
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
else
  log "WARN RESTORE_TEST=0: this run's dump is NOT restore-tested"
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
  local listing="$WORK/listing.json"
  run timeout -k 5 120 rclone lsjson --hash --files-only "${RCLONE_FLAGS[@]}" "r2:$1" > "$listing" || return 1
  [[ $(jq -r '.[0].Size' "$listing") == "$ARTIFACT_BYTES" ]] \
    && [[ $(jq -r '.[0].Hashes.md5 // empty' "$listing") == "$ARTIFACT_MD5" ]]
}
write_manifest() {  # $1: artifact key the manifest points at; $2: output file
  jq -n \
    --arg created_at "$TS" --arg db "$PGDATABASE" --arg server_version_num "$SERVER_VERSION_NUM" \
    --arg pg_dump_version "$(pg_dump --version)" --arg alembic_version "$ALEMBIC" \
    --argjson dump_bytes "$DUMP_BYTES" --arg dump_sha256 "$DUMP_SHA256" \
    --arg artifact "$1" --argjson artifact_bytes "$ARTIFACT_BYTES" \
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
      region: $region, railway_deployment_id: $deployment}' > "$2"
}

DAILY_KEY="$BACKUP_PREFIX/$ARTIFACT_NAME"
t0=$SECONDS
run timeout -k 5 900 rclone copyto "${RCLONE_FLAGS[@]}" "$ARTIFACT" "r2:$R2_BUCKET/$DAILY_KEY"
if ! remote_matches "$R2_BUCKET/$DAILY_KEY"; then
  log "FAIL uploaded object does not match the local artifact (size or MD5)"
  exit 1
fi
T_UPLOAD=$((SECONDS - t0))
write_manifest "$DAILY_KEY" "$WORK/daily.manifest.json"
run timeout -k 5 120 rclone copyto "${RCLONE_FLAGS[@]}" "$WORK/daily.manifest.json" "r2:$R2_BUCKET/$BACKUP_PREFIX/$KEY_BASE.manifest.json"

# On the first of the month, keep a long-lived copy with its own manifest
# (the daily objects expire long before the monthly ones).
if [[ $(date -u +%d) == 01 ]]; then
  STAGE=monthly_copy
  MONTHLY_KEY="$MONTHLY_PREFIX/$ARTIFACT_NAME"
  run timeout -k 5 900 rclone copyto "${RCLONE_FLAGS[@]}" "r2:$R2_BUCKET/$DAILY_KEY" "r2:$R2_BUCKET/$MONTHLY_KEY"
  if ! remote_matches "$R2_BUCKET/$MONTHLY_KEY"; then
    log "FAIL monthly copy does not match the local artifact"
    exit 1
  fi
  write_manifest "$MONTHLY_KEY" "$WORK/monthly.manifest.json"
  run timeout -k 5 120 rclone copyto "${RCLONE_FLAGS[@]}" "$WORK/monthly.manifest.json" "r2:$R2_BUCKET/$MONTHLY_PREFIX/$KEY_BASE.manifest.json"
fi

STAGE=finished
verdict="BACKUP OK"
[[ "$RESTORE_RESULT" == ok ]] || verdict="BACKUP OK UNVERIFIED"
log "$verdict key=$DAILY_KEY bytes=$ARTIFACT_BYTES encrypted=$ENCRYPTED restore_test=$RESTORE_RESULT users=${SOURCE[2]} alembic=$ALEMBIC t_dump=$T_DUMP t_restore=$T_RESTORE t_upload=$T_UPLOAD"
heartbeat ok
