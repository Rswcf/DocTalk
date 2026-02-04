# syntax=docker/dockerfile:1
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# System deps for PyMuPDF
RUN apt-get update \
    && apt-get install -y --no-install-recommends build-essential \
    && rm -rf /var/lib/apt/lists/*

# When Railway sets RAILWAY_DOCKERFILE_PATH, the build context is the repo root.
# Support both: running from backend/ (local) and from repo root (Railway).
COPY requirements.txt* backend/requirements.txt* /tmp/
RUN if [ -f /tmp/requirements.txt ]; then \
      pip install -r /tmp/requirements.txt greenlet psycopg[binary]; \
    else \
      pip install -r /tmp/backend/requirements.txt greenlet psycopg[binary]; \
    fi

# Copy app code (try backend/ first for Railway, then . for local)
COPY . /tmp/src/
RUN if [ -d /tmp/src/backend/app ]; then \
      cp -r /tmp/src/backend/* /app/; \
    else \
      cp -r /tmp/src/* /app/; \
    fi && rm -rf /tmp/src /tmp/requirements.txt /tmp/backend

EXPOSE 8000

# Run migrations then start server; Railway injects $PORT
CMD ["sh", "-c", "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
