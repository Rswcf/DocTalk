#!/bin/sh
set -e

# --- 1. Run database migrations ---
echo "[entrypoint] Running Alembic migrations..."
python -m alembic upgrade head

# --- 2. Trap SIGTERM for graceful shutdown ---
CELERY_PID=""
UVICORN_PID=""

cleanup() {
    echo "[entrypoint] Received SIGTERM, shutting down..."
    [ -n "$CELERY_PID" ] && kill -TERM "$CELERY_PID" 2>/dev/null
    [ -n "$UVICORN_PID" ] && kill -TERM "$UVICORN_PID" 2>/dev/null
    wait
    exit 0
}
trap cleanup TERM INT

# --- 3. Start Celery worker with auto-restart ---
start_celery() {
    while true; do
        echo "[entrypoint] Starting Celery worker..."
        python -m celery -A app.workers.celery_app worker \
            --loglevel=info \
            -Q default,parse \
            --concurrency=1 \
            --soft-time-limit=600 \
            --time-limit=660 &
        CELERY_PID=$!
        wait $CELERY_PID
        EXIT_CODE=$?
        # If killed by our trap (SIGTERM=143), don't restart
        if [ $EXIT_CODE -eq 143 ] || [ $EXIT_CODE -eq 0 ]; then
            break
        fi
        echo "[entrypoint] Celery worker exited with code $EXIT_CODE, restarting in 5s..."
        sleep 5
    done
}
start_celery &

# --- 4. Start uvicorn (foreground) ---
echo "[entrypoint] Starting uvicorn..."
uvicorn app.main:app \
    --host 0.0.0.0 \
    --port "${PORT:-8000}" \
    --graceful-timeout 30 &
UVICORN_PID=$!

# Wait for either process to exit
wait -n 2>/dev/null || wait
