# syntax=docker/dockerfile:1
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PYTHONPATH=/app

WORKDIR /app

# System deps for PyMuPDF
RUN apt-get update \
    && apt-get install -y --no-install-recommends build-essential \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY backend/requirements.txt /tmp/requirements.txt
RUN pip install -r /tmp/requirements.txt greenlet psycopg[binary] && rm /tmp/requirements.txt

# Copy backend code into /app
COPY backend/ /app/

EXPOSE 8000

# Run migrations, start Celery worker in background, then start API server.
# Railway injects $PORT. Celery concurrency=1 to conserve memory.
CMD ["sh", "-c", "cd /app && python -m alembic upgrade head && python -m celery -A app.workers.celery_app worker --loglevel=info -Q default,parse --concurrency=1 & uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
