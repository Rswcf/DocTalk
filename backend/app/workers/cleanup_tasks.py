"""Periodic cleanup tasks for expired data."""
from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone

import sqlalchemy as sa

from app.core.config import settings
from app.workers.celery_app import celery_app

logger = logging.getLogger(__name__)


@celery_app.task(name="cleanup_expired_verification_tokens")
def cleanup_expired_verification_tokens():
    """Delete verification tokens that expired more than 48 hours ago.

    Uses synchronous DB connection since Celery tasks run in separate worker processes.
    """
    cutoff = datetime.now(timezone.utc) - timedelta(hours=48)

    # Convert async DB URL to sync for Celery worker
    db_url = settings.DATABASE_URL
    if not db_url:
        logger.error("DATABASE_URL not configured, skipping token cleanup")
        return
    sync_url = db_url.replace("postgresql+asyncpg://", "postgresql+psycopg://")

    engine = sa.create_engine(sync_url)
    try:
        with engine.begin() as conn:
            result = conn.execute(
                sa.text("DELETE FROM verification_tokens WHERE expires < :cutoff"),
                {"cutoff": cutoff},
            )
            deleted = result.rowcount
        if deleted:
            logger.info("Cleaned up %d expired verification tokens", deleted)
        else:
            logger.debug("No expired verification tokens to clean up")
    finally:
        engine.dispose()


@celery_app.task(name="cleanup_empty_demo_sessions")
def cleanup_empty_demo_sessions() -> int:
    """Delete anonymous demo sessions older than 7 days with no messages.

    Anonymous demo browsing creates session rows that never get pruned;
    the sessions table only ever grows. Uses synchronous DB connection
    since Celery tasks run in separate worker processes.
    """
    cutoff = datetime.now(timezone.utc) - timedelta(days=7)

    db_url = settings.DATABASE_URL
    if not db_url:
        logger.error("DATABASE_URL not configured, skipping demo session cleanup")
        return 0
    sync_url = db_url.replace("postgresql+asyncpg://", "postgresql+psycopg://")

    engine = sa.create_engine(sync_url)
    try:
        with engine.begin() as conn:
            result = conn.execute(
                sa.text(
                    """
                    DELETE FROM sessions
                    WHERE user_id IS NULL
                      AND created_at < :cutoff
                      AND document_id IN (SELECT id FROM documents WHERE demo_slug IS NOT NULL)
                      AND NOT EXISTS (
                          SELECT 1 FROM messages WHERE messages.session_id = sessions.id
                      )
                    """
                ),
                {"cutoff": cutoff},
            )
            deleted = result.rowcount or 0
        if deleted:
            logger.info("Cleaned up %d empty anonymous demo sessions", deleted)
        else:
            logger.debug("No empty anonymous demo sessions to clean up")
        return deleted
    finally:
        engine.dispose()
