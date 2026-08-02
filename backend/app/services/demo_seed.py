"""Seed demo documents at startup.

Reads PDFs from backend/seed_data/, uploads to MinIO, creates DB records,
and dispatches parse tasks. Uses SyncSessionLocal since it runs in a
background thread (same pattern as _retry_stuck_documents).
"""
from __future__ import annotations

import logging
import os
import uuid

from minio.error import S3Error
from sqlalchemy import select

from app.core.config import settings
from app.models.sync_database import SyncSessionLocal
from app.models.tables import Document

logger = logging.getLogger("doctalk.demo_seed")
if not logger.handlers:
    _handler = logging.StreamHandler()
    _handler.setFormatter(logging.Formatter("[%(name)s] %(message)s"))
    logger.addHandler(_handler)
    logger.setLevel(logging.INFO)

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


def _ensure_demo_files(docs: list) -> int:
    """Stat each demo doc's storage object; re-upload from seed_data/ (id- and
    key-preserving — the DB row is never touched) when the object is missing.

    2026-08-02 incident hardening: a MinIO v2 migration lost ~106/108 stored
    files and the old self-heal (Qdrant-vector-count only) never noticed,
    because a doc can have healthy vectors while its underlying PDF bytes are
    gone. Returns the count re-uploaded. Wrapped per-doc so one bad doc (S3
    outage, unknown slug, missing local seed file) never blocks startup.
    """
    base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    slug_to_spec = {spec["slug"]: spec for spec in DEMO_DOCS}
    restored = 0
    client = None

    for doc in docs:
        slug = doc.demo_slug
        spec = slug_to_spec.get(slug)
        if not spec:
            logger.warning(
                "demo_seed.file_restore_skipped: unknown slug '%s' for doc %s", slug, doc.id
            )
            continue
        try:
            if client is None:
                client = _get_minio_client()
            bucket = settings.MINIO_BUCKET
            try:
                client.stat_object(bucket, doc.storage_key)
                continue  # object present — nothing to do
            except S3Error as e:
                if e.code != "NoSuchKey":
                    raise

            pdf_path = os.path.join(base_dir, spec["local_path"])
            if not os.path.exists(pdf_path):
                logger.warning(
                    "demo_seed.file_restore_skipped: local seed file missing %s", pdf_path
                )
                continue

            with open(pdf_path, "rb") as f:
                data = f.read()

            from io import BytesIO

            client.put_object(
                bucket,
                doc.storage_key,
                BytesIO(data),
                length=len(data),
                content_type="application/pdf",
            )
            logger.warning(
                "demo_seed.file_restored: re-uploaded '%s' (doc=%s, key=%s)",
                slug, doc.id, doc.storage_key,
            )
            restored += 1
        except Exception as e:
            logger.warning(
                "demo_seed.file_restore_failed for '%s' (doc=%s): %s", slug, doc.id, e
            )
            continue

    return restored


def seed_demo_documents() -> None:
    """Seed demo documents if they don't exist. Idempotent."""
    # Resolve base path (backend/ directory)
    base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

    healthy_docs: list[Document] = []

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
                        # Verify Qdrant actually has vectors for this doc.
                        # If Qdrant/MinIO restarted without persistent volumes,
                        # the vectors and files may be gone despite DB saying "ready".
                        needs_reseed = False
                        try:
                            from sqlalchemy import func as sa_func

                            from app.models.tables import Chunk
                            chunk_count = db.scalar(
                                select(sa_func.count()).select_from(Chunk)
                                .where(Chunk.document_id == existing.id)
                            )
                            if chunk_count and chunk_count > 0:
                                from qdrant_client import QdrantClient
                                qc = QdrantClient(url=settings.QDRANT_URL)
                                vec_count = qc.count(collection_name=settings.QDRANT_COLLECTION,
                                                     count_filter={"must": [{"key": "document_id", "match": {"value": str(existing.id)}}]},
                                                     exact=True).count
                                if vec_count == 0:
                                    needs_reseed = True
                        except Exception as e:
                            logger.warning("Qdrant vector check failed for '%s': %s", slug, e)
                        if needs_reseed:
                            # Delete and fully re-seed (MinIO files may also be gone)
                            logger.warning("Demo doc '%s' lost Qdrant vectors — deleting and re-seeding", slug)
                            db.delete(existing)
                            db.commit()
                            # Fall through to re-create below
                        else:
                            logger.info("Demo doc '%s' already ready, skipping", slug)
                            healthy_docs.append(existing)
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

        # B0 (2026-08-02 incident hardening): the Qdrant vector check above
        # only catches missing embeddings — a doc can have healthy vectors
        # while its underlying MinIO PDF bytes are gone (the incident this
        # closes). Runs regardless of whether vectors were healthy: docs that
        # got re-created above already got a fresh upload; this covers the
        # ones that skipped re-seeding because they looked fine.
        try:
            restored = _ensure_demo_files(healthy_docs)
            if restored:
                logger.warning("demo_seed.storage_self_heal restored %d file(s)", restored)
        except Exception as e:
            logger.warning("demo_seed storage self-heal failed: %s", e)
