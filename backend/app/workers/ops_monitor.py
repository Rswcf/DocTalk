"""Operational checks run by celery beat."""
from __future__ import annotations

import logging

import sentry_sdk

from app.models.sync_database import SyncSessionLocal
from app.models.tables import ProductEvent
from app.services.backup_status_service import get_postgres_backup_status
from app.workers.celery_app import celery_app

logger = logging.getLogger(__name__)


@celery_app.task(name="check_postgres_backup_freshness")
def check_postgres_backup_freshness() -> str:
    """Flag a missing, stale, small or unverified Postgres backup.

    Anything but ok/disabled is logged as an error, sent to Sentry (a no-op
    without SENTRY_DSN) and recorded as an `ops.backup_stale` product event,
    which the admin dashboard also surfaces. A healthy backup only logs.
    """
    status = get_postgres_backup_status()
    state = status["status"]
    if state in ("ok", "disabled"):
        logger.info("ops.pg_backup.%s key=%s age_h=%s", state, status["latest_key"], status["age_hours"])
        return state

    logger.error("ops.pg_backup.%s key=%s age_h=%s", state, status["latest_key"], status["age_hours"])
    sentry_sdk.capture_message(f"Postgres backup check: {state}", level="error")
    try:
        with SyncSessionLocal() as db:
            db.add(ProductEvent(event_name="ops.backup_stale", source="beat", reason=state, metadata_json=status))
            db.commit()
    except Exception:
        logger.exception("ops.pg_backup: could not record the product event")
    return state
