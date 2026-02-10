"""Seed demo documents at startup.

Reads PDFs from backend/seed_data/, uploads to MinIO, creates DB records,
and dispatches parse tasks. Uses SyncSessionLocal since it runs in a
background thread (same pattern as _retry_stuck_documents).
"""
from __future__ import annotations

import logging
import os
import uuid

from sqlalchemy import select

from app.core.config import settings
from app.models.sync_database import SyncSessionLocal
from app.models.tables import Document

logger = logging.getLogger("doctalk.demo_seed")

DEMO_DOCS = [
    {
        "slug": "alphabet-earnings",
        "filename": "Alphabet Q4 2025 Earnings Release.pdf",
        "local_path": "seed_data/alphabet-earnings.pdf",
    },
    {
        "slug": "attention-paper",
        "filename": "Attention Is All You Need.pdf",
        "local_path": "seed_data/attention-paper.pdf",
    },
    {
        "slug": "court-filing",
        "filename": "US District Court Filing (1:22-cv-00226).pdf",
        "local_path": "seed_data/court-filing.pdf",
    },
]


def _get_minio_client():
    """Create a MinIO client (same logic as parse_worker)."""
    from urllib.parse import urlparse

    from minio import Minio

    endpoint = settings.MINIO_ENDPOINT
    access_key = settings.MINIO_ACCESS_KEY
    secret_key = settings.MINIO_SECRET_KEY
    if endpoint.startswith("http://") or endpoint.startswith("https://"):
        parsed = urlparse(endpoint)
        secure = parsed.scheme == "https"
        host = parsed.netloc
    else:
        host = endpoint
        secure = bool(settings.MINIO_SECURE)
    return Minio(host, access_key=access_key, secret_key=secret_key, secure=secure)


def seed_demo_documents() -> None:
    """Seed demo documents if they don't exist. Idempotent."""
    # Resolve base path (backend/ directory)
    base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

    with SyncSessionLocal() as db:
        for spec in DEMO_DOCS:
            slug = spec["slug"]
            try:
                # Check if already exists
                result = db.execute(
                    select(Document).where(Document.demo_slug == slug)
                )
                existing = result.scalar_one_or_none()

                if existing:
                    if existing.status == "ready":
                        logger.info("Demo doc '%s' already ready, skipping", slug)
                        continue
                    if existing.status in ("parsing", "embedding"):
                        logger.info("Demo doc '%s' stuck in %s, re-dispatching", slug, existing.status)
                        from app.workers.parse_worker import parse_document
                        parse_document.delay(str(existing.id))
                        continue
                    if existing.status == "error":
                        logger.info("Demo doc '%s' in error state, re-seeding", slug)
                        # Delete the old record so we can re-create
                        db.delete(existing)
                        db.commit()
                    else:
                        logger.info("Demo doc '%s' in status %s, skipping", slug, existing.status)
                        continue

                # Read local PDF
                pdf_path = os.path.join(base_dir, spec["local_path"])
                if not os.path.exists(pdf_path):
                    logger.warning("Demo PDF not found: %s", pdf_path)
                    continue

                with open(pdf_path, "rb") as f:
                    data = f.read()

                # Upload to MinIO
                doc_id = uuid.uuid4()
                storage_key = f"documents/{doc_id}/{spec['filename']}"
                from io import BytesIO
                client = _get_minio_client()
                bucket = settings.MINIO_BUCKET
                client.put_object(
                    bucket,
                    storage_key,
                    BytesIO(data),
                    length=len(data),
                    content_type="application/pdf",
                )

                # Create DB record
                doc = Document(
                    id=doc_id,
                    filename=spec["filename"],
                    file_size=len(data),
                    storage_key=storage_key,
                    status="parsing",
                    user_id=None,
                    demo_slug=slug,
                )
                db.add(doc)
                db.commit()

                # Dispatch parse task
                from app.workers.parse_worker import parse_document
                parse_document.delay(str(doc_id))
                logger.info("Seeded demo doc '%s' (id=%s), dispatched parse", slug, doc_id)

            except Exception as e:
                logger.warning("Failed to seed demo doc '%s': %s", slug, e)
                db.rollback()
