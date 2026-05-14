"""Admin analytics endpoints — protected by require_admin."""

from __future__ import annotations

import asyncio
from datetime import datetime, timedelta, timezone
from typing import Any

import stripe
from fastapi import APIRouter, Depends, Query
from sqlalchemy import case, func, select, text, union_all
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.cache import cache_get, cache_set
from app.core.config import settings
from app.core.deps import get_db_session, require_admin
from app.models.tables import (
    ChatSession,
    CreditLedger,
    Document,
    Message,
    ProductEvent,
    UsageRecord,
    User,
    UserFeedback,
)
from app.schemas.admin import (
    AdminBreakdownsResponse,
    AdminOverviewResponse,
    AdminRecentUsersResponse,
    AdminTopUsersResponse,
    AdminTrendsResponse,
    AdminUserActivityResponse,
)

router = APIRouter(prefix="/api/admin", tags=["admin"])

PAID_INTENT_EVENTS = [
    "paywall_opened",
    "limit_hit",
    "billing_view",
    "upgrade_click",
    "checkout_created",
    "checkout_completed",
    "subscription_cancel_requested",
    "refund_requested",
]


def _rate(numerator: int | float, denominator: int | float) -> float:
    return round(float(numerator) / float(denominator), 4) if denominator else 0.0


def _delta_payload(current: int | float, previous: int | float) -> dict[str, int | float | None]:
    delta = current - previous
    return {
        "current": current,
        "previous": previous,
        "delta": delta,
        "delta_percent": round((delta / previous) * 100, 1) if previous else None,
    }


def _date_label(value: Any) -> str:
    if hasattr(value, "date"):
        return str(value.date())
    return str(value)[:10]


def _activity_subquery(start: datetime, end: datetime | None = None):
    usage_q = (
        select(UsageRecord.user_id.label("user_id"), UsageRecord.created_at.label("created_at"))
        .where(UsageRecord.user_id.is_not(None))
        .where(UsageRecord.created_at >= start)
    )
    message_q = (
        select(ChatSession.user_id.label("user_id"), Message.created_at.label("created_at"))
        .join(ChatSession, Message.session_id == ChatSession.id)
        .where(ChatSession.user_id.is_not(None))
        .where(Message.role == "user")
        .where(Message.created_at >= start)
    )
    document_q = (
        select(Document.user_id.label("user_id"), Document.created_at.label("created_at"))
        .where(Document.user_id.is_not(None))
        .where(Document.demo_slug.is_(None))
        .where(Document.created_at >= start)
    )
    event_q = (
        select(ProductEvent.user_id.label("user_id"), ProductEvent.created_at.label("created_at"))
        .where(ProductEvent.user_id.is_not(None))
        .where(ProductEvent.created_at >= start)
    )
    feedback_q = (
        select(UserFeedback.user_id.label("user_id"), UserFeedback.created_at.label("created_at"))
        .where(UserFeedback.user_id.is_not(None))
        .where(UserFeedback.created_at >= start)
    )
    if end is not None:
        usage_q = usage_q.where(UsageRecord.created_at < end)
        message_q = message_q.where(Message.created_at < end)
        document_q = document_q.where(Document.created_at < end)
        event_q = event_q.where(ProductEvent.created_at < end)
        feedback_q = feedback_q.where(UserFeedback.created_at < end)
    return union_all(usage_q, message_q, document_q, event_q, feedback_q).subquery()


def _stripe_secret_mode() -> str:
    key = settings.STRIPE_SECRET_KEY or ""
    if not key:
        return "missing"
    if key.startswith("sk_live_"):
        return "live"
    if key.startswith("sk_test_"):
        return "test"
    return "unknown"


def _price_hint(price_id: str) -> str | None:
    if not price_id:
        return None
    if len(price_id) <= 14:
        return price_id[:6] + "..."
    return f"{price_id[:8]}...{price_id[-6:]}"


async def _stripe_price_status(label: str, price_id: str, remote: bool) -> dict:
    payload = {
        "label": label,
        "configured": bool(price_id),
        "id_hint": _price_hint(price_id),
        "livemode": None,
        "active": None,
        "currency": None,
        "interval": None,
        "error": None,
    }
    if not remote or not price_id or not settings.STRIPE_SECRET_KEY:
        return payload

    try:
        stripe.api_key = settings.STRIPE_SECRET_KEY
        price = await asyncio.to_thread(stripe.Price.retrieve, price_id)
        recurring = price.get("recurring") or {}
        payload.update({
            "livemode": bool(price.get("livemode")),
            "active": bool(price.get("active")),
            "currency": price.get("currency"),
            "interval": recurring.get("interval"),
        })
    except stripe.StripeError as e:
        payload["error"] = str(e)[:200]
    return payload


@router.get("/overview", response_model=AdminOverviewResponse)
async def admin_overview(
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db_session),
):
    """Top-level KPI snapshot."""
    cache_key = "admin:overview"
    cached = await cache_get(cache_key)
    if isinstance(cached, dict):
        return cached

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

    payload = {
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
    await cache_set(cache_key, payload, ttl_seconds=60)
    return payload


@router.get("/trends", response_model=AdminTrendsResponse)
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


@router.get("/breakdowns", response_model=AdminBreakdownsResponse)
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


@router.get("/user-activity", response_model=AdminUserActivityResponse)
async def admin_user_activity(
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db_session),
    period: str = Query("day", regex="^(day|week|month)$"),
    days: int = Query(30, ge=1, le=365),
):
    """Composite user activity, retention, paid intent, and feedback analytics."""
    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(days=days)
    previous_cutoff = cutoff - timedelta(days=days)
    trunc = lambda col: func.date_trunc(period, col)  # noqa: E731

    async def composite_users(start: datetime, end: datetime | None = None) -> int:
        activity_sq = _activity_subquery(start, end)
        value = await db.scalar(
            select(func.count(func.distinct(activity_sq.c.user_id))).select_from(activity_sq)
        )
        return int(value or 0)

    dau = await composite_users(now - timedelta(days=1))
    wau = await composite_users(now - timedelta(days=7))
    mau = await composite_users(now - timedelta(days=30))
    active_users = await composite_users(cutoff)
    previous_active_users = await composite_users(previous_cutoff, cutoff)

    signups = int(await db.scalar(select(func.count(User.id)).where(User.created_at >= cutoff)) or 0)
    previous_signups = int(
        await db.scalar(
            select(func.count(User.id))
            .where(User.created_at >= previous_cutoff)
            .where(User.created_at < cutoff)
        )
        or 0
    )
    total_users = int(await db.scalar(select(func.count(User.id))) or 0)
    paid_users = int(await db.scalar(select(func.count(User.id)).where(User.plan != "free")) or 0)

    upload_users = int(
        await db.scalar(
            select(func.count(func.distinct(Document.user_id)))
            .where(Document.created_at >= cutoff)
            .where(Document.demo_slug.is_(None))
            .where(Document.user_id.is_not(None))
        )
        or 0
    )
    previous_upload_users = int(
        await db.scalar(
            select(func.count(func.distinct(Document.user_id)))
            .where(Document.created_at >= previous_cutoff)
            .where(Document.created_at < cutoff)
            .where(Document.demo_slug.is_(None))
            .where(Document.user_id.is_not(None))
        )
        or 0
    )
    chat_users = int(
        await db.scalar(
            select(func.count(func.distinct(ChatSession.user_id)))
            .join(Message, Message.session_id == ChatSession.id)
            .where(Message.created_at >= cutoff)
            .where(Message.role == "user")
            .where(ChatSession.user_id.is_not(None))
        )
        or 0
    )
    previous_chat_users = int(
        await db.scalar(
            select(func.count(func.distinct(ChatSession.user_id)))
            .join(Message, Message.session_id == ChatSession.id)
            .where(Message.created_at >= previous_cutoff)
            .where(Message.created_at < cutoff)
            .where(Message.role == "user")
            .where(ChatSession.user_id.is_not(None))
        )
        or 0
    )
    activated_users = int(
        await db.scalar(
            select(func.count(func.distinct(Document.user_id)))
            .join(ChatSession, ChatSession.user_id == Document.user_id)
            .join(Message, Message.session_id == ChatSession.id)
            .where(Document.created_at >= cutoff)
            .where(Document.demo_slug.is_(None))
            .where(Message.role == "user")
            .where(Message.created_at >= cutoff)
            .where(Document.user_id.is_not(None))
        )
        or 0
    )

    checkout_completed_users = int(
        await db.scalar(
            select(func.count(func.distinct(ProductEvent.user_id)))
            .where(ProductEvent.created_at >= cutoff)
            .where(ProductEvent.event_name == "checkout_completed")
            .where(ProductEvent.user_id.is_not(None))
        )
        or 0
    )
    previous_checkout_completed_users = int(
        await db.scalar(
            select(func.count(func.distinct(ProductEvent.user_id)))
            .where(ProductEvent.created_at >= previous_cutoff)
            .where(ProductEvent.created_at < cutoff)
            .where(ProductEvent.event_name == "checkout_completed")
            .where(ProductEvent.user_id.is_not(None))
        )
        or 0
    )

    series_map: dict[str, dict[str, int | str]] = {}

    def point_for(value: Any) -> dict[str, int | str]:
        label = _date_label(value)
        if label not in series_map:
            series_map[label] = {
                "date": label,
                "signups": 0,
                "active_users": 0,
                "ai_active_users": 0,
                "uploads": 0,
                "upload_users": 0,
                "chat_users": 0,
                "messages": 0,
                "credits_spent": 0,
                "paywall_opened": 0,
                "limit_hit": 0,
                "billing_view": 0,
                "upgrade_click": 0,
                "checkout_created": 0,
                "checkout_completed": 0,
                "feedback_submissions": 0,
            }
        return series_map[label]

    signup_rows = (
        await db.execute(
            select(trunc(User.created_at).label("date"), func.count(User.id).label("count"))
            .where(User.created_at >= cutoff)
            .group_by("date")
            .order_by("date")
        )
    ).all()
    for row in signup_rows:
        point_for(row.date)["signups"] = int(row.count or 0)

    activity_sq = _activity_subquery(cutoff)
    active_rows = (
        await db.execute(
            select(
                trunc(activity_sq.c.created_at).label("date"),
                func.count(func.distinct(activity_sq.c.user_id)).label("count"),
            )
            .select_from(activity_sq)
            .group_by("date")
            .order_by("date")
        )
    ).all()
    for row in active_rows:
        point_for(row.date)["active_users"] = int(row.count or 0)

    ai_active_rows = (
        await db.execute(
            select(
                trunc(UsageRecord.created_at).label("date"),
                func.count(func.distinct(UsageRecord.user_id)).label("count"),
            )
            .where(UsageRecord.created_at >= cutoff)
            .group_by("date")
            .order_by("date")
        )
    ).all()
    for row in ai_active_rows:
        point_for(row.date)["ai_active_users"] = int(row.count or 0)

    upload_rows = (
        await db.execute(
            select(
                trunc(Document.created_at).label("date"),
                func.count(Document.id).label("uploads"),
                func.count(func.distinct(Document.user_id)).label("users"),
            )
            .where(Document.created_at >= cutoff)
            .where(Document.demo_slug.is_(None))
            .where(Document.user_id.is_not(None))
            .group_by("date")
            .order_by("date")
        )
    ).all()
    for row in upload_rows:
        point = point_for(row.date)
        point["uploads"] = int(row.uploads or 0)
        point["upload_users"] = int(row.users or 0)

    chat_rows = (
        await db.execute(
            select(
                trunc(Message.created_at).label("date"),
                func.count(Message.id).label("messages"),
                func.count(func.distinct(ChatSession.user_id)).label("users"),
            )
            .join(ChatSession, Message.session_id == ChatSession.id)
            .where(Message.created_at >= cutoff)
            .where(Message.role == "user")
            .where(ChatSession.user_id.is_not(None))
            .group_by("date")
            .order_by("date")
        )
    ).all()
    for row in chat_rows:
        point = point_for(row.date)
        point["messages"] = int(row.messages or 0)
        point["chat_users"] = int(row.users or 0)

    credit_rows = (
        await db.execute(
            select(
                trunc(CreditLedger.created_at).label("date"),
                func.coalesce(
                    func.sum(case((CreditLedger.delta < 0, func.abs(CreditLedger.delta)), else_=0)),
                    0,
                ).label("amount"),
            )
            .where(CreditLedger.created_at >= cutoff)
            .group_by("date")
            .order_by("date")
        )
    ).all()
    for row in credit_rows:
        point_for(row.date)["credits_spent"] = int(row.amount or 0)

    event_rows = (
        await db.execute(
            select(
                trunc(ProductEvent.created_at).label("date"),
                ProductEvent.event_name.label("event_name"),
                func.count(ProductEvent.id).label("count"),
            )
            .where(ProductEvent.created_at >= cutoff)
            .where(ProductEvent.event_name.in_(PAID_INTENT_EVENTS))
            .group_by("date", ProductEvent.event_name)
            .order_by("date")
        )
    ).all()
    for row in event_rows:
        if row.event_name in point_for(row.date):
            point_for(row.date)[row.event_name] = int(row.count or 0)

    feedback_series_rows = (
        await db.execute(
            select(
                trunc(UserFeedback.created_at).label("date"),
                func.count(UserFeedback.id).label("count"),
            )
            .where(UserFeedback.created_at >= cutoff)
            .group_by("date")
            .order_by("date")
        )
    ).all()
    for row in feedback_series_rows:
        point_for(row.date)["feedback_submissions"] = int(row.count or 0)

    cohort_user_ids = select(User.id).where(User.created_at >= cutoff).subquery()
    cohort_upload_users = int(
        await db.scalar(
            select(func.count(func.distinct(Document.user_id)))
            .where(Document.created_at >= cutoff)
            .where(Document.demo_slug.is_(None))
            .where(Document.user_id.in_(select(cohort_user_ids.c.id)))
        )
        or 0
    )
    session_users = int(
        await db.scalar(
            select(func.count(func.distinct(ChatSession.user_id)))
            .where(ChatSession.created_at >= cutoff)
            .where(ChatSession.user_id.in_(select(cohort_user_ids.c.id)))
        )
        or 0
    )
    first_chat_users = int(
        await db.scalar(
            select(func.count(func.distinct(ChatSession.user_id)))
            .join(Message, Message.session_id == ChatSession.id)
            .where(Message.created_at >= cutoff)
            .where(Message.role == "user")
            .where(ChatSession.user_id.in_(select(cohort_user_ids.c.id)))
        )
        or 0
    )
    power_user_sq = (
        select(ChatSession.user_id.label("user_id"), func.count(Message.id).label("message_count"))
        .join(Message, Message.session_id == ChatSession.id)
        .where(Message.created_at >= cutoff)
        .where(Message.role == "user")
        .where(ChatSession.user_id.in_(select(cohort_user_ids.c.id)))
        .group_by(ChatSession.user_id)
        .subquery()
    )
    five_message_users = int(
        await db.scalar(select(func.count()).select_from(power_user_sq).where(power_user_sq.c.message_count >= 5))
        or 0
    )
    cohort_event_rows = (
        await db.execute(
            select(
                ProductEvent.event_name,
                func.count(func.distinct(ProductEvent.user_id)).label("users"),
            )
            .where(ProductEvent.created_at >= cutoff)
            .where(ProductEvent.user_id.in_(select(cohort_user_ids.c.id)))
            .where(ProductEvent.event_name.in_(PAID_INTENT_EVENTS))
            .group_by(ProductEvent.event_name)
        )
    ).all()
    cohort_event_counts = {row.event_name: int(row.users or 0) for row in cohort_event_rows}

    raw_stages = [
        ("signup", "Signups", signups),
        ("first_upload", "Uploaded document", cohort_upload_users),
        ("first_session", "Created chat session", session_users),
        ("first_chat", "Sent chat message", first_chat_users),
        ("five_chats", "5+ chat messages", five_message_users),
        ("paywall_opened", "Saw paid prompt", cohort_event_counts.get("paywall_opened", 0)),
        ("limit_hit", "Hit paid limit", cohort_event_counts.get("limit_hit", 0)),
        ("billing_view", "Viewed billing", cohort_event_counts.get("billing_view", 0)),
        ("upgrade_click", "Clicked upgrade", cohort_event_counts.get("upgrade_click", 0)),
        ("checkout_created", "Checkout created", cohort_event_counts.get("checkout_created", 0)),
        ("checkout_completed", "Checkout completed", cohort_event_counts.get("checkout_completed", 0)),
    ]
    funnel = []
    previous_stage_users: int | None = None
    for key, label, users in raw_stages:
        funnel.append({
            "key": key,
            "label": label,
            "users": users,
            "rate_from_signup": _rate(users, signups) if key != "signup" else None,
            "rate_from_previous": _rate(users, previous_stage_users) if previous_stage_users else None,
        })
        previous_stage_users = users

    retention_rows = (
        await db.execute(
            text(
                """
                WITH cohort AS (
                    SELECT id, date_trunc('day', created_at)::date AS cohort_date
                    FROM users
                    WHERE created_at >= :cutoff
                ),
                activity AS (
                    SELECT user_id, date_trunc('day', created_at)::date AS activity_date
                    FROM usage_records
                    WHERE created_at >= :cutoff AND user_id IS NOT NULL
                    UNION ALL
                    SELECT s.user_id, date_trunc('day', m.created_at)::date AS activity_date
                    FROM messages m
                    JOIN sessions s ON s.id = m.session_id
                    WHERE m.created_at >= :cutoff AND m.role = 'user' AND s.user_id IS NOT NULL
                    UNION ALL
                    SELECT user_id, date_trunc('day', created_at)::date AS activity_date
                    FROM documents
                    WHERE created_at >= :cutoff AND demo_slug IS NULL AND user_id IS NOT NULL
                    UNION ALL
                    SELECT user_id, date_trunc('day', created_at)::date AS activity_date
                    FROM product_events
                    WHERE created_at >= :cutoff AND user_id IS NOT NULL
                    UNION ALL
                    SELECT user_id, date_trunc('day', created_at)::date AS activity_date
                    FROM user_feedback
                    WHERE created_at >= :cutoff AND user_id IS NOT NULL
                )
                SELECT
                    c.cohort_date::text AS cohort_date,
                    count(DISTINCT c.id)::int AS cohort_size,
                    count(DISTINCT c.id) FILTER (WHERE a.activity_date = c.cohort_date)::int AS d0,
                    count(DISTINCT c.id) FILTER (WHERE a.activity_date = c.cohort_date + 1)::int AS d1,
                    count(DISTINCT c.id) FILTER (WHERE a.activity_date = c.cohort_date + 7)::int AS d7,
                    count(DISTINCT c.id) FILTER (WHERE a.activity_date = c.cohort_date + 30)::int AS d30
                FROM cohort c
                LEFT JOIN activity a ON a.user_id = c.id
                GROUP BY c.cohort_date
                ORDER BY c.cohort_date DESC
                LIMIT 30
                """
            ),
            {"cutoff": cutoff},
        )
    ).all()
    retention = [
        {
            "cohort_date": row.cohort_date,
            "cohort_size": int(row.cohort_size or 0),
            "d0": int(row.d0 or 0),
            "d1": int(row.d1 or 0),
            "d7": int(row.d7 or 0),
            "d30": int(row.d30 or 0),
            "d0_rate": _rate(row.d0 or 0, row.cohort_size or 0),
            "d1_rate": _rate(row.d1 or 0, row.cohort_size or 0),
            "d7_rate": _rate(row.d7 or 0, row.cohort_size or 0),
            "d30_rate": _rate(row.d30 or 0, row.cohort_size or 0),
        }
        for row in retention_rows
    ]
    retention_explanation = None
    if not retention:
        retention_explanation = "No signup cohorts in the selected window."
    elif days < 30:
        retention_explanation = "D30 retention is incomplete for windows shorter than 30 days."

    plan_rows = (
        await db.execute(
            select(User.plan.label("key"), func.count(User.id).label("count"))
            .group_by(User.plan)
            .order_by(func.count(User.id).desc())
        )
    ).all()
    file_type_rows = (
        await db.execute(
            select(Document.file_type.label("key"), func.count(Document.id).label("count"))
            .where(Document.created_at >= cutoff)
            .where(Document.demo_slug.is_(None))
            .group_by(Document.file_type)
            .order_by(func.count(Document.id).desc())
        )
    ).all()
    paid_reason_rows = (
        await db.execute(
            select(
                ProductEvent.event_name,
                ProductEvent.reason,
                ProductEvent.source,
                ProductEvent.plan,
                func.count(ProductEvent.id).label("events"),
                func.count(func.distinct(ProductEvent.user_id)).label("users"),
            )
            .where(ProductEvent.created_at >= cutoff)
            .where(ProductEvent.event_name.in_(PAID_INTENT_EVENTS))
            .group_by(ProductEvent.event_name, ProductEvent.reason, ProductEvent.source, ProductEvent.plan)
            .order_by(func.count(ProductEvent.id).desc())
            .limit(50)
        )
    ).all()
    paid_intent_reasons = [
        {
            "event_name": row.event_name,
            "reason": row.reason,
            "source": row.source,
            "plan": row.plan,
            "events": int(row.events or 0),
            "users": int(row.users or 0),
        }
        for row in paid_reason_rows
    ]
    conversion_blockers = [
        item for item in paid_intent_reasons if item["event_name"] in {"limit_hit", "paywall_opened", "refund_requested"}
    ][:20]

    async def feedback_group(column) -> list[dict[str, int | str]]:
        rows = (
            await db.execute(
                select(column.label("key"), func.count(UserFeedback.id).label("count"))
                .where(UserFeedback.created_at >= cutoff)
                .group_by(column)
                .order_by(func.count(UserFeedback.id).desc())
            )
        ).all()
        return [{"key": row.key or "unknown", "count": int(row.count or 0), "users": None} for row in rows]

    feedback_total = int(
        await db.scalar(select(func.count(UserFeedback.id)).where(UserFeedback.created_at >= cutoff)) or 0
    )
    feedback_recent_rows = (
        await db.execute(
            select(UserFeedback)
            .where(UserFeedback.created_at >= cutoff)
            .order_by(UserFeedback.created_at.desc())
            .limit(20)
        )
    ).scalars().all()
    feedback_recent = []
    for item in feedback_recent_rows:
        message = item.message or ""
        feedback_recent.append({
            "id": str(item.id),
            "created_at": item.created_at.isoformat() if item.created_at else None,
            "type": item.type,
            "area": item.area,
            "severity": item.severity,
            "status": item.status,
            "path": item.path,
            "locale": item.locale,
            "plan": item.plan,
            "has_message": bool(message),
            "message_preview": message[:180] if message else None,
        })

    return {
        "days": days,
        "period": period,
        "since": cutoff.isoformat(),
        "generated_at": now.isoformat(),
        "summary": {
            "dau": dau,
            "wau": wau,
            "mau": mau,
            "signups": signups,
            "activated_users": activated_users,
            "upload_users": upload_users,
            "chat_users": chat_users,
            "paid_users": paid_users,
            "total_users": total_users,
            "free_to_paid_rate": _rate(paid_users, total_users),
            "deltas": {
                "signups": _delta_payload(signups, previous_signups),
                "active_users": _delta_payload(active_users, previous_active_users),
                "upload_users": _delta_payload(upload_users, previous_upload_users),
                "chat_users": _delta_payload(chat_users, previous_chat_users),
                "checkout_completed": _delta_payload(
                    checkout_completed_users,
                    previous_checkout_completed_users,
                ),
            },
        },
        "series": [series_map[key] for key in sorted(series_map)],
        "funnel": funnel,
        "retention": retention,
        "retention_explanation": retention_explanation,
        "segments": {
            "plan_distribution": [
                {"key": row.key or "unknown", "count": int(row.count or 0), "users": None}
                for row in plan_rows
            ],
            "file_types": [
                {"key": row.key or "unknown", "count": int(row.count or 0), "users": None}
                for row in file_type_rows
            ],
            "paid_intent_reasons": paid_intent_reasons,
            "conversion_blockers": conversion_blockers,
        },
        "feedback": {
            "total": feedback_total,
            "by_type": await feedback_group(UserFeedback.type),
            "by_area": await feedback_group(UserFeedback.area),
            "by_severity": await feedback_group(UserFeedback.severity),
            "by_status": await feedback_group(UserFeedback.status),
            "recent": feedback_recent,
        },
    }


@router.get("/billing-health")
async def admin_billing_health(
    remote: bool = Query(False),
    _admin: User = Depends(require_admin),
):
    """Non-secret billing configuration health check."""
    prices = {
        "plus_monthly": settings.STRIPE_PRICE_PLUS_MONTHLY,
        "plus_annual": settings.STRIPE_PRICE_PLUS_ANNUAL,
        "pro_monthly": settings.STRIPE_PRICE_PRO_MONTHLY,
        "pro_annual": settings.STRIPE_PRICE_PRO_ANNUAL,
        "boost_pack": settings.STRIPE_PRICE_BOOST,
        "power_pack": settings.STRIPE_PRICE_POWER,
        "ultra_pack": settings.STRIPE_PRICE_ULTRA,
    }
    price_statuses = [
        await _stripe_price_status(label, price_id, remote)
        for label, price_id in prices.items()
    ]
    subscription_prices = price_statuses[:4]
    remote_modes = [p["livemode"] for p in price_statuses if p["livemode"] is not None]
    secret_mode = _stripe_secret_mode()
    has_mode_mismatch = (
        secret_mode in {"live", "test"}
        and any(mode is not None and mode != (secret_mode == "live") for mode in remote_modes)
    )

    return {
        "stripe_secret_configured": bool(settings.STRIPE_SECRET_KEY),
        "stripe_secret_mode": secret_mode,
        "stripe_webhook_configured": bool(settings.STRIPE_WEBHOOK_SECRET),
        "frontend_url_configured": bool(settings.FRONTEND_URL),
        "all_subscription_prices_configured": all(p["configured"] for p in subscription_prices),
        "remote_checked": remote,
        "has_mode_mismatch": has_mode_mismatch,
        "prices": price_statuses,
    }


@router.get("/funnel")
async def admin_funnel(
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db_session),
    days: int = Query(30, ge=1, le=365),
):
    """Activation and monetization funnel snapshot for the signup cohort."""
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    cohort_user_ids = select(User.id).where(User.created_at >= cutoff).subquery()

    signups = await db.scalar(select(func.count()).select_from(cohort_user_ids))
    upload_users = await db.scalar(
        select(func.count(func.distinct(Document.user_id)))
        .where(Document.created_at >= cutoff)
        .where(Document.user_id.in_(select(cohort_user_ids.c.id)))
    )
    session_users = await db.scalar(
        select(func.count(func.distinct(ChatSession.user_id)))
        .where(ChatSession.created_at >= cutoff)
        .where(ChatSession.user_id.in_(select(cohort_user_ids.c.id)))
    )
    chat_users = await db.scalar(
        select(func.count(func.distinct(ChatSession.user_id)))
        .join(Message, Message.session_id == ChatSession.id)
        .where(Message.created_at >= cutoff)
        .where(Message.role == "user")
        .where(ChatSession.user_id.in_(select(cohort_user_ids.c.id)))
    )
    power_user_sq = (
        select(
            ChatSession.user_id.label("user_id"),
            func.count(Message.id).label("message_count"),
        )
        .join(Message, Message.session_id == ChatSession.id)
        .where(Message.created_at >= cutoff)
        .where(Message.role == "user")
        .where(ChatSession.user_id.in_(select(cohort_user_ids.c.id)))
        .group_by(ChatSession.user_id)
        .subquery()
    )
    five_message_users = await db.scalar(
        select(func.count())
        .select_from(power_user_sq)
        .where(power_user_sq.c.message_count >= 5)
    )

    event_rows = (
        await db.execute(
            select(
                ProductEvent.event_name,
                func.count(ProductEvent.id).label("events"),
                func.count(func.distinct(ProductEvent.user_id)).label("users"),
            )
            .where(ProductEvent.created_at >= cutoff)
            .where(ProductEvent.user_id.in_(select(cohort_user_ids.c.id)))
            .group_by(ProductEvent.event_name)
        )
    ).all()
    event_counts = {
        r.event_name: {"events": int(r.events), "users": int(r.users)}
        for r in event_rows
    }

    reason_rows = (
        await db.execute(
            select(
                ProductEvent.event_name,
                ProductEvent.reason,
                ProductEvent.source,
                ProductEvent.plan,
                func.count(ProductEvent.id).label("events"),
                func.count(func.distinct(ProductEvent.user_id)).label("users"),
            )
            .where(ProductEvent.created_at >= cutoff)
            .where(ProductEvent.user_id.in_(select(cohort_user_ids.c.id)))
            .where(
                ProductEvent.event_name.in_(
                    [
                        "paywall_opened",
                        "limit_hit",
                        "upgrade_click",
                        "billing_view",
                        "checkout_created",
                        "checkout_completed",
                        "subscription_cancel_requested",
                        "refund_requested",
                    ]
                )
            )
            .group_by(ProductEvent.event_name, ProductEvent.reason, ProductEvent.source, ProductEvent.plan)
            .order_by(func.count(ProductEvent.id).desc())
            .limit(50)
        )
    ).all()
    event_tracking_started_at = await db.scalar(select(func.min(ProductEvent.created_at)))

    stages = [
        {"key": "signup", "label": "Signups", "users": int(signups or 0)},
        {"key": "first_upload", "label": "Uploaded document", "users": int(upload_users or 0)},
        {"key": "first_session", "label": "Created chat session", "users": int(session_users or 0)},
        {"key": "first_chat", "label": "Sent chat message", "users": int(chat_users or 0)},
        {"key": "five_chats", "label": "5+ chat messages", "users": int(five_message_users or 0)},
        {"key": "paywall_opened", "label": "Saw paid prompt", "users": event_counts.get("paywall_opened", {}).get("users", 0)},
        {"key": "limit_hit", "label": "Hit paid limit", "users": event_counts.get("limit_hit", {}).get("users", 0)},
        {"key": "billing_view", "label": "Viewed billing", "users": event_counts.get("billing_view", {}).get("users", 0)},
        {"key": "upgrade_click", "label": "Clicked upgrade", "users": event_counts.get("upgrade_click", {}).get("users", 0)},
        {"key": "checkout_created", "label": "Checkout created", "users": event_counts.get("checkout_created", {}).get("users", 0)},
        {"key": "checkout_completed", "label": "Checkout completed", "users": event_counts.get("checkout_completed", {}).get("users", 0)},
        {"key": "subscription_cancel_requested", "label": "Canceled paid plan", "users": event_counts.get("subscription_cancel_requested", {}).get("users", 0)},
        {"key": "refund_requested", "label": "Requested refund", "users": event_counts.get("refund_requested", {}).get("users", 0)},
    ]

    return {
        "days": days,
        "since": cutoff.isoformat(),
        "cohort": "signups",
        "event_tracking_started_at": event_tracking_started_at.isoformat() if event_tracking_started_at else None,
        "stages": stages,
        "event_counts": event_counts,
        "reasons": [
            {
                "event_name": r.event_name,
                "reason": r.reason,
                "source": r.source,
                "plan": r.plan,
                "events": int(r.events),
                "users": int(r.users),
            }
            for r in reason_rows
        ],
    }


def _metadata_number(metadata: dict[str, Any], key: str) -> float:
    value = metadata.get(key)
    if isinstance(value, (int, float)):
        return float(value)
    try:
        return float(str(value))
    except (TypeError, ValueError):
        return 0.0


RAG_QUALITY_SAMPLE_LIMIT = 1000


@router.get("/rag-quality")
async def admin_rag_quality(
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db_session),
    days: int = Query(30, ge=1, le=365),
):
    """RAG answer verification quality snapshot."""
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    rows = (
        await db.execute(
            select(ProductEvent)
            .where(ProductEvent.event_name == "rag_verification_completed")
            .where(ProductEvent.created_at >= cutoff)
            .order_by(ProductEvent.created_at.desc())
            .limit(RAG_QUALITY_SAMPLE_LIMIT)
        )
    ).scalars().all()

    status_counts = {"pass": 0, "warn": 0, "fail": 0, "unknown": 0}
    score_total = 0.0
    uncited_claims = 0
    invalid_citations = 0
    low_overlap_citations = 0
    numeric_mismatch_citations = 0
    for event in rows:
        metadata = event.metadata_json or {}
        status = str(metadata.get("status") or event.reason or "unknown").lower()
        if status not in status_counts:
            status = "unknown"
        status_counts[status] += 1
        score_total += _metadata_number(metadata, "score")
        uncited_claims += int(_metadata_number(metadata, "uncited_claim_count"))
        invalid_citations += int(_metadata_number(metadata, "invalid_citation_count"))
        low_overlap_citations += int(_metadata_number(metadata, "low_overlap_citation_count"))
        numeric_mismatch_citations += int(_metadata_number(metadata, "numeric_mismatch_citation_count"))

    total = len(rows)
    return {
        "days": days,
        "since": cutoff.isoformat(),
        "sample_limit": RAG_QUALITY_SAMPLE_LIMIT,
        "is_sampled": total >= RAG_QUALITY_SAMPLE_LIMIT,
        "evaluated_answers": total,
        "average_score": round(score_total / total, 3) if total else 0.0,
        "pass_rate": round(status_counts["pass"] / total, 3) if total else 0.0,
        "warn_rate": round(status_counts["warn"] / total, 3) if total else 0.0,
        "fail_rate": round(status_counts["fail"] / total, 3) if total else 0.0,
        "status_counts": status_counts,
        "uncited_claims": uncited_claims,
        "invalid_citations": invalid_citations,
        "low_overlap_citations": low_overlap_citations,
        "numeric_mismatch_citations": numeric_mismatch_citations,
        "recent": [
            {
                "created_at": event.created_at.isoformat() if event.created_at else None,
                "status": str((event.metadata_json or {}).get("status") or event.reason or "unknown"),
                "score": _metadata_number(event.metadata_json or {}, "score"),
                "route": (event.metadata_json or {}).get("route"),
                "strategy": (event.metadata_json or {}).get("retrieval_strategy"),
                "claim_count": int(_metadata_number(event.metadata_json or {}, "claim_count")),
                "citation_count": int(_metadata_number(event.metadata_json or {}, "citation_count")),
                "uncited_claim_count": int(_metadata_number(event.metadata_json or {}, "uncited_claim_count")),
                "numeric_mismatch_citation_count": int(
                    _metadata_number(event.metadata_json or {}, "numeric_mismatch_citation_count")
                ),
            }
            for event in rows[:20]
        ],
    }


@router.get("/recent-users", response_model=AdminRecentUsersResponse)
async def admin_recent_users(
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db_session),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
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
        .offset(offset)
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


@router.get("/top-users", response_model=AdminTopUsersResponse)
async def admin_top_users(
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db_session),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
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
            .offset(offset)
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
            .offset(offset)
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
