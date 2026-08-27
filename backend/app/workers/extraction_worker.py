"""Celery tasks for structured document workbench jobs."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

import sqlalchemy as sa
from celery.utils.log import get_task_logger
from sqlalchemy import select

from app.models.sync_database import SyncSessionLocal
from app.models.tables import CreditLedger, DocumentJob, ExtractionResult
from app.services.extraction_service import (
    EXTRACTION_LEASE_SECONDS,
    _settle_extraction_predebit_after_failure_sync,
    extraction_job_advisory_lock,
    run_extraction_job_sync,
    stage_stale_extraction_recovery_sync,
)
from app.services.predebited_job_service import RECOVERY_POLICIES
from app.workers.celery_app import celery_app

logger = get_task_logger(__name__)


def _stale_predebited_job_ids_statement(now: datetime):
    lease_age_cutoff = now - timedelta(seconds=EXTRACTION_LEASE_SECONDS)
    active_predebit = sa.exists(
        select(CreditLedger.id).where(
            CreditLedger.ref_type == "document_job",
            CreditLedger.ref_id == sa.cast(DocumentJob.id, sa.String),
            CreditLedger.reconciled_at.is_(None),
        )
    )
    expired_or_missing_lease = sa.or_(
        DocumentJob.worker_lease_expires_at <= now,
        sa.and_(
            DocumentJob.worker_lease_expires_at.is_(None),
            sa.or_(
                sa.and_(
                    DocumentJob.status == "queued",
                    DocumentJob.created_at <= lease_age_cutoff,
                ),
                sa.and_(
                    DocumentJob.status == "running",
                    DocumentJob.updated_at <= lease_age_cutoff,
                ),
            ),
        ),
    )
    return select(DocumentJob.id).where(
        DocumentJob.status.in_(("queued", "running")),
        expired_or_missing_lease,
        active_predebit,
    )


def _orphaned_predebit_ledger_ids_statement():
    live_job = sa.exists(
        select(DocumentJob.id).where(
            sa.cast(DocumentJob.id, sa.String) == CreditLedger.ref_id
        )
    )
    return (
        select(CreditLedger.id)
        .where(
            CreditLedger.ref_type == "document_job",
            CreditLedger.reconciled_at.is_(None),
            ~live_job,
        )
        .order_by(CreditLedger.created_at, CreditLedger.id)
        .limit(500)
    )


def _terminal_undelivered_predebit_job_ids_statement():
    active_predebit = sa.exists(
        select(CreditLedger.id).where(
            CreditLedger.ref_type == "document_job",
            CreditLedger.ref_id == sa.cast(DocumentJob.id, sa.String),
            CreditLedger.reconciled_at.is_(None),
        )
    )
    no_result = ~sa.exists(
        select(ExtractionResult.id).where(ExtractionResult.job_id == DocumentJob.id)
    )
    return (
        select(DocumentJob.id)
        .where(
            DocumentJob.status.in_(("failed", "cancelled", "canceled")),
            active_predebit,
            no_result,
        )
        .order_by(DocumentJob.updated_at, DocumentJob.id)
        .limit(500)
    )


def _recover_terminal_undelivered_predebits() -> int:
    """Refund safe terminal rows omitted by the active-lease predicate."""
    with SyncSessionLocal() as db:
        job_ids = list(
            db.scalars(_terminal_undelivered_predebit_job_ids_statement()).all()
        )

    refunded = 0
    for job_id in job_ids:
        try:
            with extraction_job_advisory_lock(str(job_id)) as got_lock:
                if not got_lock:
                    continue
                with SyncSessionLocal() as db:
                    job_type = db.scalar(
                        select(DocumentJob.job_type).where(DocumentJob.id == job_id)
                    )
                policy = RECOVERY_POLICIES.get(job_type or "")
                if _settle_extraction_predebit_after_failure_sync(
                    job_id=job_id,
                    error_code="DOCUMENT_JOB_TERMINAL_UNSETTLED",
                    error_message="Terminal document job had an unreconciled predebit",
                    release_trial=bool(policy and policy.release_trial),
                ):
                    refunded += 1
        except Exception:
            logger.exception(
                "Watchdog failed to settle terminal document job %s",
                job_id,
            )

    if refunded:
        logger.warning(
            "Watchdog refunded %d terminal undelivered document-job predebits",
            refunded,
        )
    return refunded


def _recover_orphaned_predebits() -> int:
    """Refund ledgers whose job anchor was removed out of band.

    Parent API deletions settle before cascading. This ledger-driven backstop
    covers rows stranded by the historical behavior and by direct SQL/admin
    deletion paths that bypass the service. The same per-job advisory lock
    waits out a worker that had claimed immediately before its anchor vanished.
    """
    with SyncSessionLocal() as db:
        ledger_ids = list(
            db.scalars(_orphaned_predebit_ledger_ids_statement()).all()
        )

    refunded = 0
    for ledger_id in ledger_ids:
        try:
            with SyncSessionLocal() as db:
                ledger = db.get(CreditLedger, ledger_id)
                if (
                    ledger is None
                    or ledger.ref_type != "document_job"
                    or ledger.reconciled_at is not None
                    or not ledger.ref_id
                ):
                    continue
                job_id = ledger.ref_id
                release_trial = ledger.reason == "extraction"

            with extraction_job_advisory_lock(job_id) as got_lock:
                if not got_lock:
                    continue
                if _settle_extraction_predebit_after_failure_sync(
                    job_id=job_id,
                    ledger_id=ledger_id,
                    error_code="DOCUMENT_JOB_ANCHOR_MISSING",
                    error_message="Predebited document job recovery anchor was deleted",
                    release_trial=release_trial,
                ):
                    refunded += 1
        except Exception:
            logger.exception(
                "Watchdog failed to settle orphaned document-job ledger %s",
                ledger_id,
            )

    if refunded:
        logger.warning(
            "Watchdog refunded %d orphaned document-job predebits",
            refunded,
        )
    return refunded


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
    """Recover any predebited document job whose delivery lease expired.

    The durable lease is longer than broker visibility. This task claims the
    next bounded attempt before publishing it and passes that exact token to
    the worker. An ambiguous publish therefore cannot authorize two workers,
    and a message that never arrives ages into atomic terminal settlement.
    A NULL lease falls back to the row's age, so legacy or malformed producers
    cannot make a committed predebit invisible to the sweep. Unreconciled
    ledgers whose job anchor is already gone are refunded first.
    """
    _recover_terminal_undelivered_predebits()
    _recover_orphaned_predebits()

    now = datetime.now(timezone.utc)
    with SyncSessionLocal() as db:
        candidate_ids = list(db.scalars(_stale_predebited_job_ids_statement(now)).all())

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
                with SyncSessionLocal() as db:
                    job_type = db.scalar(
                        select(DocumentJob.job_type).where(DocumentJob.id == job_id)
                    )
                if not _dispatch_recovery(job_type, job_id_str, str(claim_token)):
                    continue
                requeued += 1
                logger.info(
                    "Watchdog requeued stale %s job %s",
                    job_type,
                    job_id,
                )
            except Exception:
                # The lease/attempt commit precedes publication. If publication
                # was ambiguous, the tokenized message may still run; if it did
                # not, the bounded lease expires and the next sweep settles it.
                logger.exception("Watchdog failed to requeue document job %s", job_id)
        except Exception:
            logger.exception("Watchdog failed to recover document job %s", job_id)

    if requeued:
        logger.info("Watchdog requeued %d stale predebited document jobs", requeued)
    return requeued


def _dispatch_extraction(job_id: str, claim_token: str) -> None:
    run_extraction_job.delay(job_id, claim_token)


def _dispatch_batch_template(job_id: str, claim_token: str) -> None:
    from app.workers.question_template_worker import run_batch_template_job

    run_batch_template_job.delay(job_id, claim_token)


def _dispatch_document_diff(job_id: str, claim_token: str) -> None:
    from app.workers.document_diff_worker import run_document_diff_job

    run_document_diff_job.delay(job_id, claim_token)


RECOVERY_DISPATCHERS = {
    "extraction": _dispatch_extraction,
    "batch_template": _dispatch_batch_template,
    "document_diff": _dispatch_document_diff,
}


def _dispatch_recovery(
    job_type: str | None,
    job_id: str,
    claim_token: str,
) -> bool:
    dispatcher = RECOVERY_DISPATCHERS.get(job_type or "")
    if dispatcher is not None:
        dispatcher(job_id, claim_token)
        return True
    logger.error(
        "Watchdog staged job %s with unsupported predebit job type %r",
        job_id,
        job_type,
    )
    return False
