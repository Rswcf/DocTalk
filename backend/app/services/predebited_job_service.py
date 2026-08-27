"""Creation contract and recovery policy for predebited document jobs."""

from __future__ import annotations

import asyncio
import uuid
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any

import sqlalchemy as sa
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.tables import CreditLedger, DocumentJob
from app.services import credit_service

# Redis can redeliver an unacknowledged task after 40 minutes. Every
# predebited job lease must remain exclusive beyond that broker window.
PREDEBITED_JOB_LEASE_SECONDS = 45 * 60
PREDEBITED_JOB_MAX_CLAIM_ATTEMPTS = 2
PREDEBITED_JOB_LOCK_NAMESPACE = 948


@dataclass(frozen=True)
class RecoveryPolicy:
    error_code: str
    error_message: str
    release_trial: bool = False


RECOVERY_POLICIES: dict[str, RecoveryPolicy] = {
    "extraction": RecoveryPolicy(
        error_code="EXTRACTION_RECOVERY_EXHAUSTED",
        error_message="Structured extraction could not be recovered",
        release_trial=True,
    ),
    "batch_template": RecoveryPolicy(
        error_code="BATCH_TEMPLATE_RECOVERY_EXHAUSTED",
        error_message="Question template run could not be recovered",
    ),
    "document_diff": RecoveryPolicy(
        error_code="DOCUMENT_DIFF_RECOVERY_EXHAUSTED",
        error_message="Document comparison could not be recovered",
    ),
}

PrepareJob = Callable[[DocumentJob], Awaitable[None]]


async def settle_active_predebited_jobs_before_parent_delete(
    db: AsyncSession,
    *,
    document_id: uuid.UUID | None = None,
    collection_id: uuid.UUID | None = None,
) -> int:
    """Terminally settle active predebits before a parent CASCADE.

    The caller must lock the parent row ``FOR UPDATE`` before entering this
    helper. PostgreSQL then serializes a concurrent child FK insert behind the
    eventual parent delete. For every already-committed active job, the
    transaction-scoped advisory lock shares namespace/key semantics with the
    worker's session lock, so a worker that wins the claim race finishes first.
    We re-read the ledger predicate after acquiring the lock and delegate the
    actual conditional refund/fail/trial-release decision to the one existing
    terminal resolver.
    """
    if (document_id is None) == (collection_id is None):
        raise ValueError("Exactly one document or collection parent is required")

    parent_filter = (
        DocumentJob.document_id == document_id
        if document_id is not None
        else DocumentJob.collection_id == collection_id
    )
    active_predebit = sa.exists(
        sa.select(CreditLedger.id).where(
            CreditLedger.ref_type == "document_job",
            CreditLedger.ref_id == sa.cast(DocumentJob.id, sa.String),
            CreditLedger.reconciled_at.is_(None),
        )
    )
    candidate_ids = list(
        (
            await db.scalars(
                sa.select(DocumentJob.id)
                .where(
                    parent_filter,
                    DocumentJob.status.in_(("queued", "running")),
                    active_predebit,
                )
                .order_by(DocumentJob.id)
            )
        ).all()
    )

    parent_kind = "document" if document_id is not None else "collection"
    settled = 0
    for job_id in candidate_ids:
        await db.execute(
            sa.text("SELECT pg_advisory_xact_lock(:ns, hashtext(:key))"),
            {"ns": PREDEBITED_JOB_LOCK_NAMESPACE, "key": str(job_id)},
        )

        # A worker may have claimed and settled while deletion waited for its
        # advisory lock. Only a still-active, still-unreconciled job is ours to
        # terminalize; a reconciled success must never be refunded.
        job_type = await db.scalar(
            sa.select(DocumentJob.job_type).where(
                DocumentJob.id == job_id,
                parent_filter,
                DocumentJob.status.in_(("queued", "running")),
                active_predebit,
            )
        )
        if job_type is None:
            continue

        # Local import avoids a module cycle: extraction_service owns the
        # durable terminal resolver and imports this module's policy constants.
        from app.services.extraction_service import (
            _settle_extraction_predebit_after_failure_sync,
        )

        policy = RECOVERY_POLICIES.get(job_type)
        won_refund = await asyncio.to_thread(
            _settle_extraction_predebit_after_failure_sync,
            job_id=job_id,
            error_code=f"{parent_kind.upper()}_DELETED",
            error_message=f"Job cancelled because its {parent_kind} was deleted",
            release_trial=bool(policy and policy.release_trial),
        )
        if won_refund:
            settled += 1

    return settled


async def create_predebited_document_job(
    db: AsyncSession,
    *,
    user_id: uuid.UUID,
    job_type: str,
    input_scope: dict[str, Any],
    predebit: int,
    reason: str,
    document_id: uuid.UUID | None = None,
    collection_id: uuid.UUID | None = None,
    metadata_json: dict[str, Any] | None = None,
    prepare_job: PrepareJob | None = None,
) -> tuple[DocumentJob, uuid.UUID | None]:
    """Create a leased job and its credit predebit in one caller transaction.

    Callers still own commit/rollback so their entitlement claims and product
    events can join the same transaction. Restricting this helper to recovery-
    registered job types prevents a future paid producer from getting durable
    billing without a watchdog dispatch/terminal policy.
    """
    if job_type not in RECOVERY_POLICIES:
        raise ValueError(
            f"Predebited document job type {job_type!r} has no recovery policy"
        )

    job = DocumentJob(
        id=uuid.uuid4(),
        user_id=user_id,
        document_id=document_id,
        collection_id=collection_id,
        job_type=job_type,
        status="queued",
        input_scope=input_scope,
        cost_credits=0,
        worker_lease_expires_at=datetime.now(timezone.utc)
        + timedelta(seconds=PREDEBITED_JOB_LEASE_SECONDS),
    )
    db.add(job)
    await db.flush()

    if prepare_job is not None:
        await prepare_job(job)

    ledger_id = await credit_service.debit_credits(
        db,
        user_id=user_id,
        cost=predebit,
        reason=reason,
        ref_type="document_job",
        ref_id=str(job.id),
    )
    if ledger_id is None:
        return job, None

    job.metadata_json = {
        **(metadata_json or {}),
        "predebit_ledger_id": str(ledger_id),
        "pre_debited": predebit,
    }
    return job, ledger_id
