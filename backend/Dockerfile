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

# Debug: verify file structure
RUN ls -la /app/ && ls -la /app/app/ && echo "OK: app module found"

EXPOSE 8000

# Run migrations then start server; Railway injects $PORT
CMD ["sh", "-c", "cd /app && python -m alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
