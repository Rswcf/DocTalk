#!/bin/bash
# bash is required for `wait -n` (POSIX dash does not support it).
# python:3.12-slim ships /usr/bin/bash.
set -e

# --- 1. Run database migrations ---
echo "[entrypoint] Running Alembic migrations..."
python -m alembic upgrade head

# --- 2. Start Celery worker (background) ---
echo "[entrypoint] Starting Celery worker..."
python -m celery -A app.workers.celery_app worker \
    --loglevel=info \
    -Q default,parse \
    --concurrency=2 \
    --soft-time-limit=600 \
    --time-limit=660 &
CELERY_PID=$!

# --- 3. Start Celery beat (scheduler, background) ---
# Runs periodic tasks defined in celery_app.conf.beat_schedule (e.g.,
# cleanup-expired-tokens-daily). Schedule file in /tmp is fine: Railway /tmp
# is ephemeral but daily cadence tolerates redeploys.
#
# IMPORTANT: beat MUST run in exactly one container across the whole fleet.
# If this backend is ever horizontally scaled (multiple replicas), set
# ENABLE_CELERY_BEAT=0 on all-but-one replica (or factor beat into its own
# Railway service). Duplicate beats → duplicate scheduled tasks.
BEAT_PID=""
if [ "${ENABLE_CELERY_BEAT:-1}" = "1" ]; then
    echo "[entrypoint] Starting Celery beat..."
    python -m celery -A app.workers.celery_app beat \
        --loglevel=info \
        --schedule=/tmp/celerybeat-schedule &
    BEAT_PID=$!
else
    echo "[entrypoint] Celery beat disabled (ENABLE_CELERY_BEAT=0)"
fi

# --- 4. Graceful shutdown trap ---
# trap runs in the parent shell with the PIDs set above (no subshell scoping
# issues). On SIGTERM/SIGINT we kill all children and exit so Railway can
# recycle the container cleanly.
UVICORN_PID=""
cleanup() {
    echo "[entrypoint] Received signal, shutting down..."
    [ -n "$UVICORN_PID" ] && kill -TERM "$UVICORN_PID" 2>/dev/null || true
    [ -n "$BEAT_PID" ] && kill -TERM "$BEAT_PID" 2>/dev/null || true
    [ -n "$CELERY_PID" ] && kill -TERM "$CELERY_PID" 2>/dev/null || true
    wait
    exit 0
}
trap cleanup TERM INT

# --- 5. Start uvicorn (background so we can wait -n on all) ---
echo "[entrypoint] Starting uvicorn..."
uvicorn app.main:app \
    --host 0.0.0.0 \
    --port "${PORT:-8000}" \
    --proxy-headers \
    --forwarded-allow-ips="${FORWARDED_ALLOW_IPS:-127.0.0.1}" \
    --timeout-graceful-shutdown 30 &
UVICORN_PID=$!

# --- 6. Wait for first child to exit; then tear down and let Railway restart ---
# Rationale: shell is a poor supervisor. A crashed worker should not be
# silently restarted in-container while uvicorn/beat continue with stale
# state. Exit → Railway restarts the whole container → clean slate for all
# three processes. `wait -n` returns when the first child exits.
set +e
wait -n
EXIT=$?
set -e
echo "[entrypoint] A child process exited with code $EXIT; tearing down."
[ -n "$UVICORN_PID" ] && kill -TERM "$UVICORN_PID" 2>/dev/null || true
[ -n "$BEAT_PID" ] && kill -TERM "$BEAT_PID" 2>/dev/null || true
[ -n "$CELERY_PID" ] && kill -TERM "$CELERY_PID" 2>/dev/null || true
wait
exit $EXIT
