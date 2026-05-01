"""Admin analytics endpoints — protected by require_admin."""

import asyncio
from datetime import datetime, timedelta, timezone

import stripe
from fastapi import APIRouter, Depends, Query
from sqlalchemy import case, func, select
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
)
from app.schemas.admin import (
    AdminBreakdownsResponse,
    AdminOverviewResponse,
    AdminRecentUsersResponse,
    AdminTopUsersResponse,
    AdminTrendsResponse,
)

router = APIRouter(prefix="/api/admin", tags=["admin"])


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
    """Activation and monetization funnel snapshot."""
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)

    signups = await db.scalar(select(func.count(User.id)).where(User.created_at >= cutoff))
    upload_users = await db.scalar(
        select(func.count(func.distinct(Document.user_id)))
        .where(Document.created_at >= cutoff)
        .where(Document.user_id.is_not(None))
    )
    session_users = await db.scalar(
        select(func.count(func.distinct(ChatSession.user_id)))
        .where(ChatSession.created_at >= cutoff)
        .where(ChatSession.user_id.is_not(None))
    )
    chat_users = await db.scalar(
        select(func.count(func.distinct(ChatSession.user_id)))
        .join(Message, Message.session_id == ChatSession.id)
        .where(Message.created_at >= cutoff)
        .where(Message.role == "user")
        .where(ChatSession.user_id.is_not(None))
    )
    power_user_sq = (
        select(
            ChatSession.user_id.label("user_id"),
            func.count(Message.id).label("message_count"),
        )
        .join(Message, Message.session_id == ChatSession.id)
        .where(Message.created_at >= cutoff)
        .where(Message.role == "user")
        .where(ChatSession.user_id.is_not(None))
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
            .where(ProductEvent.event_name.in_(["limit_hit", "upgrade_click", "billing_view"]))
            .group_by(ProductEvent.event_name, ProductEvent.reason, ProductEvent.source, ProductEvent.plan)
            .order_by(func.count(ProductEvent.id).desc())
            .limit(50)
        )
    ).all()

    stages = [
        {"key": "signup", "label": "Signups", "users": int(signups or 0)},
        {"key": "first_upload", "label": "Uploaded document", "users": int(upload_users or 0)},
        {"key": "first_session", "label": "Created chat session", "users": int(session_users or 0)},
        {"key": "first_chat", "label": "Sent chat message", "users": int(chat_users or 0)},
        {"key": "five_chats", "label": "5+ chat messages", "users": int(five_message_users or 0)},
        {"key": "limit_hit", "label": "Hit paid limit", "users": event_counts.get("limit_hit", {}).get("users", 0)},
        {"key": "billing_view", "label": "Viewed billing", "users": event_counts.get("billing_view", {}).get("users", 0)},
        {"key": "upgrade_click", "label": "Clicked upgrade", "users": event_counts.get("upgrade_click", {}).get("users", 0)},
        {"key": "checkout_created", "label": "Checkout created", "users": event_counts.get("checkout_created", {}).get("users", 0)},
        {"key": "checkout_completed", "label": "Checkout completed", "users": event_counts.get("checkout_completed", {}).get("users", 0)},
    ]

    return {
        "days": days,
        "since": cutoff.isoformat(),
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
