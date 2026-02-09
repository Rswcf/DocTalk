# syntax=docker/dockerfile:1
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PYTHONPATH=/app

WORKDIR /app

# System deps for PyMuPDF
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
       build-essential \
       tesseract-ocr \
       tesseract-ocr-eng \
       tesseract-ocr-chi-sim \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY backend/requirements.txt /tmp/requirements.txt
RUN pip install -r /tmp/requirements.txt greenlet psycopg[binary] && rm /tmp/requirements.txt

# Create non-root user
RUN addgroup --system --gid 1001 app && adduser --system --uid 1001 --ingroup app app

# Copy backend code and entrypoint
COPY backend/ /app/

EXPOSE 8000

# Entrypoint script with process supervision:
# - Runs Alembic migrations
# - Starts Celery worker with automatic restart on crash
# - Starts uvicorn API server
# - Forwards SIGTERM to both processes for graceful shutdown
COPY backend/entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh && chown -R app:app /app

USER app

CMD ["/app/entrypoint.sh"]
