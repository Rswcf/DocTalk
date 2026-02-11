"""Admin analytics endpoints — protected by require_admin."""

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Query
from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db_session, require_admin
from app.models.tables import (
    ChatSession,
    CreditLedger,
    Document,
    Message,
    UsageRecord,
    User,
)

router = APIRouter(prefix="/api/admin", tags=["admin"])


@router.get("/overview")
async def admin_overview(
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db_session),
):
    """Top-level KPI snapshot."""
    user_stats = (
        await db.execute(
            select(
                func.count(User.id).label("total_users"),
                func.coalesce(func.sum(case((User.plan != "free", 1), else_=0)), 0).label("paid_users"),
                func.coalesce(func.sum(case((User.plan == "plus", 1), else_=0)), 0).label("plus_users"),
                func.coalesce(func.sum(case((User.plan == "pro", 1), else_=0)), 0).label("pro_users"),
            )
        )
    ).one()

    content_stats = (
        await db.execute(
            select(
                func.coalesce(select(func.count(Document.id)).scalar_subquery(), 0).label("total_documents"),
                func.coalesce(select(func.count(ChatSession.id)).scalar_subquery(), 0).label("total_sessions"),
                func.coalesce(select(func.count(Message.id)).scalar_subquery(), 0).label("total_messages"),
            )
        )
    ).one()

    financial_stats = (
        await db.execute(
            select(
                func.coalesce(select(func.sum(UsageRecord.total_tokens)).scalar_subquery(), 0).label("total_tokens"),
                func.coalesce(
                    select(func.sum(case((CreditLedger.delta < 0, -CreditLedger.delta), else_=0))).scalar_subquery(),
                    0,
                ).label("total_credits_spent"),
                func.coalesce(
                    select(func.sum(case((CreditLedger.delta > 0, CreditLedger.delta), else_=0))).scalar_subquery(),
                    0,
                ).label("total_credits_granted"),
            )
        )
    ).one()

    return {
        "total_users": int(user_stats.total_users or 0),
        "paid_users": int(user_stats.paid_users or 0),
        "plus_users": int(user_stats.plus_users or 0),
        "pro_users": int(user_stats.pro_users or 0),
        "total_documents": int(content_stats.total_documents or 0),
        "total_sessions": int(content_stats.total_sessions or 0),
        "total_messages": int(content_stats.total_messages or 0),
        "total_tokens": int(financial_stats.total_tokens or 0),
        "total_credits_spent": int(financial_stats.total_credits_spent or 0),
        "total_credits_granted": int(financial_stats.total_credits_granted or 0),
    }


@router.get("/trends")
async def admin_trends(
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db_session),
    period: str = Query("day", regex="^(day|week|month)$"),
    days: int = Query(30, ge=1, le=365),
):
    """Time series trends for key metrics."""
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    trunc = lambda col: func.date_trunc(period, col)  # noqa: E731

    # Signups
    signups_q = (
        select(
            trunc(User.created_at).label("date"),
            func.count(User.id).label("count"),
        )
        .where(User.created_at >= cutoff)
        .group_by("date")
        .order_by("date")
    )
    signups = [{"date": str(r.date.date()), "count": r.count} for r in (await db.execute(signups_q)).all()]

    # Documents
    docs_q = (
        select(
            trunc(Document.created_at).label("date"),
            func.count(Document.id).label("count"),
        )
        .where(Document.created_at >= cutoff)
        .group_by("date")
        .order_by("date")
    )
    documents = [{"date": str(r.date.date()), "count": r.count} for r in (await db.execute(docs_q)).all()]

    # Tokens
    tokens_q = (
        select(
            trunc(UsageRecord.created_at).label("date"),
            func.coalesce(func.sum(UsageRecord.total_tokens), 0).label("total_tokens"),
        )
        .where(UsageRecord.created_at >= cutoff)
        .group_by("date")
        .order_by("date")
    )
    tokens = [{"date": str(r.date.date()), "total_tokens": int(r.total_tokens)} for r in (await db.execute(tokens_q)).all()]

    # Credits spent (negative delta = spending)
    credits_q = (
        select(
            trunc(CreditLedger.created_at).label("date"),
            func.coalesce(func.sum(
                case((CreditLedger.delta < 0, func.abs(CreditLedger.delta)), else_=0)
            ), 0).label("amount"),
        )
        .where(CreditLedger.created_at >= cutoff)
        .group_by("date")
        .order_by("date")
    )
    credits_spent = [{"date": str(r.date.date()), "amount": int(r.amount)} for r in (await db.execute(credits_q)).all()]

    # Active users (distinct user_ids in usage_records)
    active_q = (
        select(
            trunc(UsageRecord.created_at).label("date"),
            func.count(func.distinct(UsageRecord.user_id)).label("count"),
        )
        .where(UsageRecord.created_at >= cutoff)
        .group_by("date")
        .order_by("date")
    )
    active_users = [{"date": str(r.date.date()), "count": r.count} for r in (await db.execute(active_q)).all()]

    return {
        "signups": signups,
        "documents": documents,
        "tokens": tokens,
        "credits_spent": credits_spent,
        "active_users": active_users,
    }


@router.get("/breakdowns")
async def admin_breakdowns(
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db_session),
):
    """Category distributions."""
    # Plan distribution
    plan_q = (
        select(User.plan.label("plan"), func.count(User.id).label("count"))
        .group_by(User.plan)
        .order_by(func.count(User.id).desc())
    )
    plan_distribution = [{"plan": r.plan, "count": r.count} for r in (await db.execute(plan_q)).all()]

    # Model usage
    model_q = (
        select(
            UsageRecord.model.label("model"),
            func.count(UsageRecord.id).label("calls"),
            func.coalesce(func.sum(UsageRecord.total_tokens), 0).label("tokens"),
            func.coalesce(func.sum(UsageRecord.cost_credits), 0).label("credits"),
        )
        .group_by(UsageRecord.model)
        .order_by(func.sum(UsageRecord.total_tokens).desc())
    )
    model_usage = [
        {"model": r.model, "calls": r.calls, "tokens": int(r.tokens), "credits": int(r.credits)}
        for r in (await db.execute(model_q)).all()
    ]

    # File types
    file_type_q = (
        select(Document.file_type.label("file_type"), func.count(Document.id).label("count"))
        .group_by(Document.file_type)
        .order_by(func.count(Document.id).desc())
    )
    file_types = [{"file_type": r.file_type, "count": r.count} for r in (await db.execute(file_type_q)).all()]

    # Doc status
    status_q = (
        select(Document.status.label("status"), func.count(Document.id).label("count"))
        .group_by(Document.status)
        .order_by(func.count(Document.id).desc())
    )
    doc_status = [{"status": r.status, "count": r.count} for r in (await db.execute(status_q)).all()]

    return {
        "plan_distribution": plan_distribution,
        "model_usage": model_usage,
        "file_types": file_types,
        "doc_status": doc_status,
    }


@router.get("/recent-users")
async def admin_recent_users(
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db_session),
    limit: int = Query(20, ge=1, le=100),
):
    """Latest signups with activity stats."""
    # Subqueries for per-user counts
    doc_count_sq = (
        select(func.count(Document.id))
        .where(Document.user_id == User.id)
        .correlate(User)
        .scalar_subquery()
    )
    msg_count_sq = (
        select(func.count(Message.id))
        .join(ChatSession, Message.session_id == ChatSession.id)
        .join(Document, ChatSession.document_id == Document.id)
        .where(Document.user_id == User.id)
        .correlate(User)
        .scalar_subquery()
    )

    q = (
        select(
            User.id,
            User.email,
            User.name,
            User.plan,
            User.credits_balance,
            User.created_at,
            doc_count_sq.label("doc_count"),
            msg_count_sq.label("message_count"),
        )
        .order_by(User.created_at.desc())
        .limit(limit)
    )
    rows = (await db.execute(q)).all()
    return {
        "users": [
            {
                "id": str(r.id),
                "email": r.email,
                "name": r.name,
                "plan": r.plan,
                "credits_balance": r.credits_balance,
                "created_at": r.created_at.isoformat() if r.created_at else None,
                "doc_count": r.doc_count or 0,
                "message_count": r.message_count or 0,
            }
            for r in rows
        ]
    }


@router.get("/top-users")
async def admin_top_users(
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db_session),
    limit: int = Query(20, ge=1, le=100),
    by: str = Query("tokens", regex="^(tokens|credits|documents)$"),
):
    """Power users ranked by tokens, credits, or document count."""
    if by == "documents":
        doc_count_sq = (
            select(func.count(Document.id))
            .where(Document.user_id == User.id)
            .correlate(User)
            .scalar_subquery()
        )
        q = (
            select(
                User.id, User.email, User.name, User.plan,
                func.coalesce(
                    select(func.sum(UsageRecord.total_tokens))
                    .where(UsageRecord.user_id == User.id)
                    .correlate(User)
                    .scalar_subquery(), 0
                ).label("total_tokens"),
                func.coalesce(
                    select(func.sum(UsageRecord.cost_credits))
                    .where(UsageRecord.user_id == User.id)
                    .correlate(User)
                    .scalar_subquery(), 0
                ).label("total_credits"),
                doc_count_sq.label("doc_count"),
            )
            .order_by(doc_count_sq.desc())
            .limit(limit)
        )
    else:
        order_col = UsageRecord.total_tokens if by == "tokens" else UsageRecord.cost_credits
        q = (
            select(
                User.id, User.email, User.name, User.plan,
                func.coalesce(func.sum(UsageRecord.total_tokens), 0).label("total_tokens"),
                func.coalesce(func.sum(UsageRecord.cost_credits), 0).label("total_credits"),
                func.coalesce(
                    select(func.count(Document.id))
                    .where(Document.user_id == User.id)
                    .correlate(User)
                    .scalar_subquery(), 0
                ).label("doc_count"),
            )
            .outerjoin(UsageRecord, UsageRecord.user_id == User.id)
            .group_by(User.id, User.email, User.name, User.plan)
            .order_by(func.coalesce(func.sum(order_col), 0).desc())
            .limit(limit)
        )

    rows = (await db.execute(q)).all()
    return {
        "users": [
            {
                "id": str(r.id),
                "email": r.email,
                "name": r.name,
                "plan": r.plan,
                "total_tokens": int(r.total_tokens),
                "total_credits": int(r.total_credits),
                "doc_count": int(r.doc_count),
            }
            for r in rows
        ]
    }
