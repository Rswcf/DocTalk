"""Shared backend authorization for Legal/Academic Domain Mode."""
from __future__ import annotations

import uuid

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.tables import FeatureTrialUsage, User

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

    Reservations are permanent once committed, including when downstream chat
    generation, extraction execution, or queue dispatch fails. Retrying the
    same surviving chat session is still allowed; deleting the owner only
    nulls the pointer and never restores the consumed slot. Failures before
    the extraction transaction commits (for example insufficient credits)
    roll back both the unaccepted job and its provisional claim.
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
        select(User.id).where(User.id == user.id).with_for_update()
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
