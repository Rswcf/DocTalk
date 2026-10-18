"""Operational checks run by celery beat."""
from __future__ import annotations

import logging

import sentry_sdk
from sqlalchemy import text

from app.models.sync_database import SyncSessionLocal
from app.models.tables import ProductEvent
from app.services.backup_status_service import get_postgres_backup_status
from app.services.refund_ops_service import get_refund_operations_status_sync
from app.workers.celery_app import celery_app

logger = logging.getLogger(__name__)


@celery_app.task(name="check_refund_operations", soft_time_limit=30, time_limit=45)
def check_refund_operations() -> str:
    """Read-only financial exception monitoring; never creates or repairs cash."""
    with SyncSessionLocal() as db:
        db.execute(text("SET TRANSACTION READ ONLY"))
        db.execute(text("SET LOCAL statement_timeout = '5s'"))
        state = get_refund_operations_status_sync(db)
    if state["status"] != "ok":
        logger.error(
            "ops.refunds_attention count=%s orphan_reservations=%s",
            state["attention_count"], state["orphan_reserved_users"],
        )
        # Existing Sentry channel; aggregate only, no payment IDs or user data.
        sentry_sdk.capture_message("Refund operations require admin review", level="error")
    return state["status"]


# Bounded: a slow bucket or a stuck database must not hold a worker process.
@celery_app.task(name="check_postgres_backup_freshness", soft_time_limit=120, time_limit=180)
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
            db.execute(text("SET LOCAL lock_timeout = '5s'"))
            db.execute(text("SET LOCAL statement_timeout = '15s'"))
            db.add(ProductEvent(event_name="ops.backup_stale", source="beat", reason=state, metadata_json=status))
            db.commit()
    except Exception:
        logger.exception("ops.pg_backup: could not record the product event")
    return state
