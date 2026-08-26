"""Shared backend authorization for Legal/Academic Domain Mode."""
from __future__ import annotations

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.tables import ChatSession, DocumentJob, User

DOMAIN_MODE_REQUIRES_PLUS_DETAIL = {
    "error": "DOMAIN_MODE_REQUIRES_PLUS",
    "message": "Legal/Academic domain mode requires a Plus or Pro plan",
    "required_plan": "plus",
}


async def enforce_domain_mode_access(
    db: AsyncSession,
    user: User | None,
    domain_mode: str | None,
) -> None:
    """Allow paid access or an authenticated free user's remaining trial.

    A consumed chat trial is a distinct durable session row whose current
    ``domain_mode`` is non-null. Extraction requests do not write session
    state, so their durable jobs are counted as well; otherwise the second API
    entry point could repeat the free trial indefinitely. Anonymous users
    remain ineligible because there is no account against which to enforce or
    bill the allowance.
    """
    if domain_mode is None:
        return

    plan = (getattr(user, "plan", None) or "free").lower() if user is not None else "free"
    if plan in {"plus", "pro"}:
        return

    if user is not None and settings.FREE_DOMAIN_MODE_TRIALS > 0:
        consumed_sessions = await db.scalar(
            select(func.count(func.distinct(ChatSession.id))).where(
                ChatSession.user_id == user.id,
                ChatSession.domain_mode.is_not(None),
            )
        )
        consumed = int(consumed_sessions or 0)
        if consumed >= settings.FREE_DOMAIN_MODE_TRIALS:
            raise HTTPException(status_code=403, detail=DOMAIN_MODE_REQUIRES_PLUS_DETAIL)

        consumed_extractions = await db.scalar(
            select(func.count(func.distinct(DocumentJob.id))).where(
                DocumentJob.user_id == user.id,
                DocumentJob.job_type == "extraction",
                DocumentJob.status.in_(["queued", "running", "succeeded"]),
                DocumentJob.input_scope["domain_mode"].astext.is_not(None),
            )
        )
        if consumed + int(consumed_extractions or 0) < settings.FREE_DOMAIN_MODE_TRIALS:
            return

    raise HTTPException(status_code=403, detail=DOMAIN_MODE_REQUIRES_PLUS_DETAIL)
