"""Shared backend authorization for Legal/Academic Domain Mode."""
from __future__ import annotations

import uuid
from datetime import datetime

import sqlalchemy as sa
from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.tables import DocumentJob, ExtractionResult, FeatureTrialUsage, User

DOMAIN_MODE_FEATURE = "domain_mode"
DOMAIN_MODE_REQUIRES_PLUS_DETAIL = {
    "error": "DOMAIN_MODE_REQUIRES_PLUS",
    "message": "Legal/Academic domain mode requires a Plus or Pro plan",
    "required_plan": "plus",
}


def _deny_domain_mode() -> None:
    raise HTTPException(status_code=403, detail=DOMAIN_MODE_REQUIRES_PLUS_DETAIL)


async def enforce_domain_mode_access(
    db: AsyncSession,
    user: User | None,
    domain_mode: str | None,
    *,
    owning_session_id: uuid.UUID | None = None,
    owning_job_id: uuid.UUID | None = None,
    commit_claim: bool = False,
) -> None:
    """Authorize Domain Mode and durably claim a Free-plan trial slot.

    Paid plans are unrestricted. A Free-plan slot belongs to exactly one chat
    session or extraction job. Once a session owns a slot, all later Domain
    Mode messages in that session remain authorized even if
    ``sessions.domain_mode`` is cleared by an ordinary message.

    Claims serialize on the user's row, then use the database's unique
    ``(user_id, feature, slot_index)`` constraint as defense in depth. Chat
    passes ``commit_claim=True`` so the claim is committed before streaming
    begins. Extraction creates its job first and commits the job, trial claim,
    credit debit, and event together.

    Chat reservations remain durable across downstream generation failures,
    so retrying the same surviving session is allowed. Extraction reservations
    are released only when the owning job is terminally failed/cancelled, has
    no delivered result, and its credit predebit is refunded in the same
    transaction. Successful extraction reservations are never released.
    Deleting an owner only nulls its pointer and does not itself restore a slot.
    The orphan-ledger watchdog may later release one legacy NULL-owner
    extraction slot, but only when its unreconciled refund wins.
    """
    if domain_mode is None:
        return

    plan = (getattr(user, "plan", None) or "free").lower() if user is not None else "free"
    if plan in {"plus", "pro"}:
        return

    if user is None or settings.FREE_DOMAIN_MODE_TRIALS <= 0:
        _deny_domain_mode()

    owner_count = int(owning_session_id is not None) + int(owning_job_id is not None)
    if owner_count != 1:
        raise RuntimeError("Free Domain Mode authorization requires exactly one durable owner")

    # Serialize every slot decision for this user. Unlike a count-then-act
    # check, this lock remains held until the durable reservation is flushed
    # and its caller-controlled transaction commits.
    locked_user_id = await db.scalar(
        select(User.id)
        .where(User.id == user.id)
        .with_for_update(key_share=True)
    )
    if locked_user_id is None:
        _deny_domain_mode()

    owner_predicate = (
        FeatureTrialUsage.owning_session_id == owning_session_id
        if owning_session_id is not None
        else FeatureTrialUsage.owning_job_id == owning_job_id
    )
    existing_owner = await db.scalar(
        select(FeatureTrialUsage.id).where(
            FeatureTrialUsage.user_id == user.id,
            FeatureTrialUsage.feature == DOMAIN_MODE_FEATURE,
            owner_predicate,
        )
    )
    if existing_owner is not None:
        if commit_claim:
            await db.commit()
        return

    occupied_result = await db.execute(
        select(FeatureTrialUsage.slot_index).where(
            FeatureTrialUsage.user_id == user.id,
            FeatureTrialUsage.feature == DOMAIN_MODE_FEATURE,
        )
    )
    occupied = {int(row[0]) for row in occupied_result.all()}
    slot_index = next(
        (candidate for candidate in range(settings.FREE_DOMAIN_MODE_TRIALS) if candidate not in occupied),
        None,
    )
    if slot_index is None:
        _deny_domain_mode()

    db.add(
        FeatureTrialUsage(
            user_id=user.id,
            feature=DOMAIN_MODE_FEATURE,
            slot_index=slot_index,
            owning_session_id=owning_session_id,
            owning_job_id=owning_job_id,
        )
    )
    await db.flush()
    if commit_claim:
        await db.commit()


def _failed_extraction_release_statement(
    *,
    user_id: uuid.UUID,
    owning_job_id: uuid.UUID,
):
    no_delivered_result = ~sa.exists(
        select(ExtractionResult.job_id).where(ExtractionResult.job_id == owning_job_id)
    )
    terminal_undelivered_job = sa.exists(
        select(DocumentJob.id).where(
            DocumentJob.id == owning_job_id,
            DocumentJob.user_id == user_id,
            DocumentJob.job_type == "extraction",
            DocumentJob.status.in_(("failed", "cancelled", "canceled")),
            no_delivered_result,
        )
    )
    return (
        sa.delete(FeatureTrialUsage)
        .where(
            FeatureTrialUsage.user_id == user_id,
            FeatureTrialUsage.feature == DOMAIN_MODE_FEATURE,
            FeatureTrialUsage.owning_job_id == owning_job_id,
            terminal_undelivered_job,
        )
        .returning(FeatureTrialUsage.id)
    )


async def release_failed_extraction_trial(
    db: AsyncSession,
    *,
    user_id: uuid.UUID,
    owning_job_id: uuid.UUID,
) -> bool:
    """Idempotently release one terminal, undelivered extraction claim.

    The caller owns commit/rollback and must invoke this only in the same
    transaction that performs the credit refund. Locking the user row uses the
    same serialization point as claiming, closing release+claim races.
    """
    locked_user_id = await db.scalar(
        select(User.id)
        .where(User.id == user_id)
        .with_for_update(key_share=True)
    )
    if locked_user_id is None:
        return False
    result = await db.execute(
        _failed_extraction_release_statement(
            user_id=user_id,
            owning_job_id=owning_job_id,
        )
    )
    return result.scalar_one_or_none() is not None


def release_failed_extraction_trial_sync(
    db: Session,
    *,
    user_id: uuid.UUID,
    owning_job_id: uuid.UUID,
) -> bool:
    """Synchronous worker counterpart of ``release_failed_extraction_trial``."""
    locked_user_id = db.scalar(
        select(User.id)
        .where(User.id == user_id)
        .with_for_update(key_share=True)
    )
    if locked_user_id is None:
        return False
    result = db.execute(
        _failed_extraction_release_statement(
            user_id=user_id,
            owning_job_id=owning_job_id,
        )
    )
    return result.scalar_one_or_none() is not None


def release_orphaned_extraction_trial_sync(
    db: Session,
    *,
    user_id: uuid.UUID,
    ledger_created_at: datetime,
) -> bool:
    """Release one legacy NULL-owner slot after an orphan refund wins.

    ``DocumentJob.owning_job_id`` uses ``ON DELETE SET NULL``, so a historical
    parent CASCADE erased the identity needed by the normal job-specific
    release predicate. The caller must invoke this only after atomically
    deleting an unreconciled extraction ledger whose job no longer exists.
    That marker proves no result was committed. Job trial and predebit rows use
    the same transaction-scoped PostgreSQL ``now()`` timestamp, which recovers
    their lost identity without freeing an unrelated NULL-owner chat slot.
    """
    locked_user_id = db.scalar(
        select(User.id)
        .where(User.id == user_id)
        .with_for_update(key_share=True)
    )
    if locked_user_id is None:
        return False

    orphan_id = (
        select(FeatureTrialUsage.id)
        .where(
            FeatureTrialUsage.user_id == user_id,
            FeatureTrialUsage.feature == DOMAIN_MODE_FEATURE,
            FeatureTrialUsage.owning_session_id.is_(None),
            FeatureTrialUsage.owning_job_id.is_(None),
            FeatureTrialUsage.created_at == ledger_created_at,
        )
        .order_by(FeatureTrialUsage.created_at, FeatureTrialUsage.id)
        .limit(1)
        .scalar_subquery()
    )
    result = db.execute(
        sa.delete(FeatureTrialUsage)
        .where(FeatureTrialUsage.id == orphan_id)
        .returning(FeatureTrialUsage.id)
    )
    return result.scalar_one_or_none() is not None
