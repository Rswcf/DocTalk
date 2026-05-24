# syntax=docker/dockerfile:1
# Pin to patch version for build reproducibility. Bump deliberately — major
# or minor drift can change OpenSSL, sqlite3, or glibc under us.
FROM python:3.12.7-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PYTHONPATH=/app \
    HOME=/home/app

WORKDIR /app

# System deps for PyMuPDF + LibreOffice headless (PPTX/DOCX→PDF conversion) + CJK fonts
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
       build-essential \
       tesseract-ocr \
       tesseract-ocr-eng \
       tesseract-ocr-chi-sim \
       tesseract-ocr-jpn \
       tesseract-ocr-kor \
       tesseract-ocr-spa \
       tesseract-ocr-deu \
       tesseract-ocr-fra \
       tesseract-ocr-por \
       tesseract-ocr-ita \
       tesseract-ocr-ara \
       tesseract-ocr-hin \
       libreoffice-core \
       libreoffice-impress \
       libreoffice-writer \
       fonts-liberation \
       fonts-noto-cjk \
       libpango-1.0-0 \
       libpangocairo-1.0-0 \
       libgdk-pixbuf-2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY backend/requirements.txt /tmp/requirements.txt
RUN pip install -r /tmp/requirements.txt greenlet psycopg[binary] && rm /tmp/requirements.txt

# Create non-root user with writable home (required by LibreOffice for user profile)
RUN addgroup --system --gid 1001 app && adduser --system --uid 1001 --ingroup app --home /home/app app \
    && mkdir -p /home/app && chown app:app /home/app

# Copy backend code and entrypoint. `COPY backend/ /app/` already brings in
# entrypoint.sh; a second explicit COPY of it was redundant and tripped a
# buildkit cache-key checksum ("/backend/entrypoint.sh": not found) on the
# Railway Metal builder, so it's removed. The chmod below still verifies the
# file is present — the build fails loudly here if entrypoint.sh is ever missing.
COPY version.json /app/version.json
COPY backend/ /app/

EXPOSE 8000

# Entrypoint script with process supervision:
# - Runs Alembic migrations
# - Starts Celery worker with automatic restart on crash
# - Starts uvicorn API server
# - Forwards SIGTERM to both processes for graceful shutdown
RUN chmod +x /app/entrypoint.sh && chown -R app:app /app

USER app

CMD ["/app/entrypoint.sh"]
