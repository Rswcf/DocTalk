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
from sqlalchemy import and_, func, or_, select, update

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
    """The app-wide store's transfer client (minio-py's default HTTP
    policy, as before). Kept as a function because the demo-seed tests patch
    this name."""
    from app.services.storage_service import storage_service

    return storage_service.transfer_client


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

            # FIX-10 (Codex r1 MINOR #10, PARKED with ruling — see
            # .collab/dialogue/2026-08-02-m2-codex-r1-triage.md #10): there IS
            # a stat->put TOCTOU window here — two rolling-deploy containers
            # (or another restoration process) could both stat a missing
            # object and both reach this put_object. That's accepted, not
            # fixed, because the overwrite is idempotent by construction: the
            # ONLY source of truth for a demo object's bytes is the seed_data/
            # file keyed by `slug` (read fresh, above, on every call), so any
            # two concurrent overwrites always write the SAME bytes. This
            # assumption breaks only if demo seed assets ever become mutable
            # (e.g. per-user demo customization) — revisit locking/versioning
            # then, not before.
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
                        # Re-parse in place, never delete-and-recreate: a new id
                        # breaks the public /d/<id> link and drops the doc's
                        # sessions, and refresh_stale_demo_parses can now send
                        # a healthy demo doc here on a transient failure.
                        logger.info("Demo doc '%s' in error state, re-parsing in place", slug)
                        _ensure_demo_files([existing])
                        _reparse_in_place(db, existing, Document.status == "error")
                        continue
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

    try:
        refresh_stale_demo_parses()
    except Exception as e:
        logger.warning("demo_seed parse refresh failed: %s", e)


def refresh_stale_demo_parses() -> int:
    """Re-parse ready demo docs whose parse_version is older than the pipeline's.

    Nothing else refreshes them: the self-heal above only reacts to lost vectors
    or an error status, find_low_quality_docs.py skips demo rows, and
    POST /reparse is owner-only (demo docs have no owner). The re-parse is in
    place, so the document id (the public /d/<id> link) and its sessions survive.

    Runs at startup and on a beat tick (cleanup_tasks). During a deploy the old
    container's worker can take the startup dispatch and re-parse with the old
    parser, which stamps the old version; the next tick then claims it again.
    Returns the number of documents dispatched.
    """
    from app.services.parse_service import PARSE_PIPELINE_VERSION

    is_stale = or_(
        Document.parse_version.is_(None),
        Document.parse_version < PARSE_PIPELINE_VERSION,
    )
    dispatched = 0
    with SyncSessionLocal() as db:
        stale = db.execute(
            select(Document).where(
                Document.demo_slug.in_([spec["slug"] for spec in DEMO_DOCS]),
                Document.status == "ready",
                is_stale,
            )
        ).scalars().all()
        if not stale:
            return 0

        _ensure_demo_files(stale)
        for doc in stale:
            if _reparse_in_place(db, doc, and_(Document.status == "ready", is_stale)):
                dispatched += 1
    return dispatched


def _reparse_in_place(db, doc: Document, claim_filter) -> bool:
    """Claim one demo row for a re-parse under its own id, then dispatch it.

    Dispatch contract: one conditional UPDATE (`claim_filter` re-checks the
    status the caller saw) sets status='parsing' and resets
    parse_requested_locale, committed before .delay(). The original must be
    confirmed present first: the worker would return a doc whose object is
    missing to 'ready' at the old version, so the version refresh would claim
    it again on every tick. Returns True when the task was published.
    """
    from app.services.storage_service import storage_service

    doc_id, slug = doc.id, doc.demo_slug
    try:
        present = storage_service.object_exists(doc.storage_key)
    except Exception as e:
        logger.warning("demo_seed.reparse_skipped '%s': storage check failed: %s", slug, e)
        return False
    if not present:
        logger.warning("demo_seed.reparse_skipped '%s': original file missing", slug)
        return False

    claimed = db.execute(
        update(Document)
        .where(Document.id == doc_id, claim_filter)
        .values(status="parsing", parse_requested_locale=None, updated_at=func.now())
    )
    db.commit()
    if claimed.rowcount != 1:
        return False  # another claimer (startup vs beat) or a status change won
    try:
        from app.workers.parse_worker import parse_document

        parse_document.delay(str(doc_id))
    except Exception:
        # The claim stays 'parsing' with a fresh updated_at; the stale
        # processing watchdog re-dispatches it after 45 minutes.
        logger.exception("demo_seed.reparse dispatch failed for '%s'", slug)
        return False
    logger.info("demo_seed.reparse: re-parsing '%s' in place (doc=%s)", slug, doc_id)
    return True
