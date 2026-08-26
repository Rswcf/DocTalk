"""Celery tasks for structured document workbench jobs."""
from __future__ import annotations

from datetime import datetime, timezone

from celery.utils.log import get_task_logger
from sqlalchemy import select

from app.models.sync_database import SyncSessionLocal
from app.models.tables import DocumentJob
from app.services.extraction_service import (
    EXTRACTION_JOB_TYPE,
    extraction_job_advisory_lock,
    run_extraction_job_sync,
    stage_stale_extraction_recovery_sync,
)
from app.workers.celery_app import celery_app

logger = get_task_logger(__name__)


@celery_app.task(
    name="app.workers.extraction_worker.run_extraction_job",
    bind=True,
    time_limit=420,
    soft_time_limit=360,
    autoretry_for=(Exception,),
    retry_kwargs={"max_retries": 1},
    retry_backoff=30,
)
def run_extraction_job(self, job_id: str, claim_token: str | None = None) -> None:
    logger.info("Starting structured extraction job %s", job_id)
    run_extraction_job_sync(job_id, expected_claim_token=claim_token)


@celery_app.task(name="requeue_stale_running_extractions")
def requeue_stale_running_extractions() -> int:
    """Lease and re-dispatch queued/running extractions whose delivery died.

    The durable lease is longer than broker visibility. This task claims the
    next bounded attempt before publishing it and passes that exact token to
    the worker. An ambiguous publish therefore cannot authorize two workers,
    and a message that never arrives ages into atomic terminal settlement.
    """
    now = datetime.now(timezone.utc)
    with SyncSessionLocal() as db:
        candidate_ids = list(
            db.scalars(
                select(DocumentJob.id).where(
                    DocumentJob.job_type == EXTRACTION_JOB_TYPE,
                    DocumentJob.status.in_(("queued", "running")),
                    DocumentJob.worker_lease_expires_at.is_not(None),
                    DocumentJob.worker_lease_expires_at <= now,
                )
            ).all()
        )

    requeued = 0
    for job_id in candidate_ids:
        job_id_str = str(job_id)
        try:
            # Match the parse-worker house pattern: never reclaim a job whose
            # live worker still owns the session advisory lock.
            with extraction_job_advisory_lock(job_id_str) as got_lock:
                if not got_lock:
                    continue
                claim_token = stage_stale_extraction_recovery_sync(job_id)
            if claim_token is None:
                continue
            try:
                run_extraction_job.delay(job_id_str, str(claim_token))
                requeued += 1
                logger.info("Watchdog requeued stale extraction job %s", job_id)
            except Exception:
                # The lease/attempt commit precedes publication. If publication
                # was ambiguous, the tokenized message may still run; if it did
                # not, the bounded lease expires and the next sweep settles it.
                logger.exception("Watchdog failed to requeue extraction %s", job_id)
        except Exception:
            logger.exception("Watchdog failed to recover extraction %s", job_id)

    if requeued:
        logger.info("Watchdog requeued %d stale extraction jobs", requeued)
    return requeued
