from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import List, Optional

import stripe
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel
from sqlalchemy import asc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import MODEL_TO_MODE, settings
from app.core.deps import get_db_session, require_auth
from app.core.security_log import log_security_event
from app.models.tables import (
    Account,
    ChatSession,
    CreditLedger,
    Document,
    Message,
    UsageRecord,
    User,
)
from app.services.doc_service import doc_service

router = APIRouter(prefix="/api/users", tags=["users"])


class UserMeResponse(BaseModel):
    id: str
    email: str
    name: Optional[str]
    image: Optional[str]
    credits_balance: int

    class Config:
        from_attributes = True


@router.get("/me", response_model=UserMeResponse)
async def get_me(user: User = Depends(require_auth)):
    return {
        "id": str(user.id),
        "email": user.email,
        "name": user.name,
        "image": user.image,
        "credits_balance": user.credits_balance,
    }


@router.get("/profile")
async def get_profile(
    user: User = Depends(require_auth),
    db: AsyncSession = Depends(get_db_session),
):
    # Connected accounts
    acc_rows = await db.execute(select(Account).where(Account.user_id == user.id))
    accounts: List[Account] = acc_rows.scalars().all()

    # Aggregated stats
    # Total documents
    total_documents = await db.scalar(
        select(func.count()).select_from(Document).where(Document.user_id == user.id)
    )

    # Total sessions (join sessions -> documents by user)
    total_sessions = await db.scalar(
        select(func.count())
        .select_from(ChatSession)
        .join(Document, ChatSession.document_id == Document.id)
        .where(Document.user_id == user.id)
    )

    # Total messages (join messages -> sessions -> documents by user)
    total_messages = await db.scalar(
        select(func.count())
        .select_from(Message)
        .join(ChatSession, Message.session_id == ChatSession.id)
        .join(Document, ChatSession.document_id == Document.id)
        .where(Document.user_id == user.id)
    )

    # Total credits spent (sum of abs(delta) where delta < 0)
    total_credits_spent = await db.scalar(
        select(func.coalesce(func.sum(-CreditLedger.delta), 0))
        .where(CreditLedger.user_id == user.id)
        .where(CreditLedger.delta < 0)
    )

    # Total tokens used
    total_tokens_used = await db.scalar(
        select(func.coalesce(func.sum(UsageRecord.total_tokens), 0)).where(UsageRecord.user_id == user.id)
    )

    # Monthly allowance by plan
    plan = (user.plan or "free").lower()
    if plan == "pro":
        monthly_allowance = int(settings.PLAN_PRO_MONTHLY_CREDITS or 0)
    elif plan == "plus":
        monthly_allowance = int(settings.PLAN_PLUS_MONTHLY_CREDITS or 0)
    else:
        monthly_allowance = int(settings.PLAN_FREE_MONTHLY_CREDITS or 0)

    return {
        "id": str(user.id),
        "email": user.email,
        "name": user.name,
        "image": user.image,
        "created_at": user.created_at.isoformat() if getattr(user, "created_at", None) else None,
        "plan": user.plan,
        "credits_balance": user.credits_balance,
        "monthly_allowance": monthly_allowance,
        "monthly_credits_granted_at": user.monthly_credits_granted_at.isoformat()
        if user.monthly_credits_granted_at
        else None,
        "signup_bonus_granted": bool(user.signup_bonus_granted_at),
        "connected_accounts": [
            {
                "provider": acc.provider,
                # Account model has no created_at column; return None for compatibility
                "created_at": None,
            }
            for acc in accounts
        ],
        "stats": {
            "total_documents": int(total_documents or 0),
            "total_sessions": int(total_sessions or 0),
            "total_messages": int(total_messages or 0),
            "total_credits_spent": int(total_credits_spent or 0),
            "total_tokens_used": int(total_tokens_used or 0),
        },
    }


@router.get("/usage-breakdown")
async def get_usage_breakdown(
    user: User = Depends(require_auth),
    db: AsyncSession = Depends(get_db_session),
):
    rows = await db.execute(
        select(
            UsageRecord.model.label("model"),
            func.count(UsageRecord.id).label("total_calls"),
            func.coalesce(func.sum(UsageRecord.cost_credits), 0).label("total_credits"),
        )
        .where(UsageRecord.user_id == user.id)
        .group_by(UsageRecord.model)
    )
    results = rows.all()

    # Aggregate by mode
    mode_agg: dict[str, dict] = {}
    for r in results:
        mode = MODEL_TO_MODE.get(r.model, "other")
        if mode not in mode_agg:
            mode_agg[mode] = {"total_calls": 0, "total_credits": 0}
        mode_agg[mode]["total_calls"] += int(r.total_calls or 0)
        mode_agg[mode]["total_credits"] += int(r.total_credits or 0)

    grand_total_credits = sum(m["total_credits"] for m in mode_agg.values())

    # Sort order: quick, balanced, thorough, then "other" last
    mode_order = {"quick": 0, "balanced": 1, "thorough": 2}
    sorted_modes = sorted(mode_agg.keys(), key=lambda m: mode_order.get(m, 99))

    return {
        "by_mode": [
            {
                "mode": mode,
                "total_calls": mode_agg[mode]["total_calls"],
                "total_credits": mode_agg[mode]["total_credits"],
                "avg_credits_per_chat": round(mode_agg[mode]["total_credits"] / mode_agg[mode]["total_calls"])
                if mode_agg[mode]["total_calls"] > 0
                else 0,
                "share": round(mode_agg[mode]["total_credits"] / grand_total_credits * 100, 1)
                if grand_total_credits > 0
                else 0,
            }
            for mode in sorted_modes
        ]
    }


_export_rate_limit: dict[str, float] = {}  # user_id -> last export timestamp
EXPORT_COOLDOWN_SECONDS = 3600  # 1 hour


@router.get("/me/export")
async def export_my_data(
    user: User = Depends(require_auth),
    db: AsyncSession = Depends(get_db_session),
):
    """Export all user data as JSON (GDPR Art. 20 data portability)."""
    uid = str(user.id)
    now = datetime.now(timezone.utc).timestamp()
    last_export = _export_rate_limit.get(uid, 0)
    if now - last_export < EXPORT_COOLDOWN_SECONDS:
        remaining = int(EXPORT_COOLDOWN_SECONDS - (now - last_export))
        return Response(
            content=json.dumps({"error": "EXPORT_RATE_LIMITED", "retry_after": remaining}),
            status_code=429,
            media_type="application/json",
            headers={"Retry-After": str(remaining)},
        )

    # 1. User profile
    profile = {
        "id": uid,
        "email": user.email,
        "name": user.name,
        "plan": user.plan,
        "created_at": user.created_at.isoformat() if user.created_at else None,
        "credits_balance": user.credits_balance,
    }

    # 2. Documents metadata
    doc_rows = await db.execute(
        select(Document).where(Document.user_id == user.id).order_by(Document.created_at)
    )
    docs = doc_rows.scalars().all()
    documents = [
        {
            "id": str(d.id),
            "filename": d.filename,
            "file_type": getattr(d, "file_type", "pdf"),
            "status": d.status,
            "created_at": d.created_at.isoformat() if d.created_at else None,
            "page_count": d.page_count,
        }
        for d in docs
    ]

    # 3. Sessions and messages
    conversations = []
    for d in docs:
        sess_rows = await db.execute(
            select(ChatSession).where(ChatSession.document_id == d.id)
        )
        for sess in sess_rows.scalars():
            msg_rows = await db.execute(
                select(Message).where(Message.session_id == sess.id).order_by(asc(Message.created_at))
            )
            conversations.append({
                "session_id": str(sess.id),
                "document_id": str(d.id),
                "title": sess.title,
                "created_at": sess.created_at.isoformat() if sess.created_at else None,
                "messages": [
                    {
                        "role": m.role,
                        "content": m.content,
                        "created_at": m.created_at.isoformat() if m.created_at else None,
                    }
                    for m in msg_rows.scalars()
                ],
            })

    # 4. Credit history
    ledger_rows = await db.execute(
        select(CreditLedger)
        .where(CreditLedger.user_id == user.id)
        .order_by(CreditLedger.created_at.desc())
        .limit(1000)
    )
    credit_history = [
        {
            "delta": entry.delta,
            "balance_after": entry.balance_after,
            "reason": entry.reason,
            "created_at": entry.created_at.isoformat() if entry.created_at else None,
        }
        for entry in ledger_rows.scalars()
    ]

    export_data = {
        "exported_at": datetime.now(timezone.utc).isoformat(),
        "user": profile,
        "documents": documents,
        "conversations": conversations,
        "credit_history": credit_history,
    }

    _export_rate_limit[uid] = now
    log_security_event("data_export", user_id=user.id)

    content = json.dumps(export_data, indent=2, ensure_ascii=False).encode("utf-8")
    return Response(
        content=content,
        media_type="application/json",
        headers={"Content-Disposition": "attachment; filename=doctalk-data-export.json"},
    )


@router.delete("/me")
async def delete_me(
    user: User = Depends(require_auth),
    db: AsyncSession = Depends(get_db_session),
):
    # 1) Cancel Stripe subscription if active
    try:
        if settings.STRIPE_SECRET_KEY and user.stripe_subscription_id:
            stripe.api_key = settings.STRIPE_SECRET_KEY
            try:
                # Prefer delete() which cancels the subscription
                stripe.Subscription.delete(user.stripe_subscription_id)
            except Exception:
                try:
                    # Fallback for environments expecting cancel()
                    getattr(stripe.Subscription, "cancel")(user.stripe_subscription_id)
                except Exception:
                    pass
    except Exception:
        # Best-effort: ignore Stripe errors during account deletion
        pass

    # 2) Find all user documents
    doc_rows = await db.execute(select(Document.id).where(Document.user_id == user.id))
    doc_ids = [row.id for row in doc_rows.all()]

    # 3) Best-effort delete storage and vectors via service, 4) Delete documents
    for doc_id in doc_ids:
        try:
            await doc_service.delete_document(doc_id, db)
        except Exception:
            # Continue deleting other documents even if one fails
            pass

    # 5) Delete user row (cascade handles accounts, credit_ledger, usage_records)
    try:
        await db.delete(user)
        await db.commit()
    except Exception:
        # If deletion fails, return error
        raise HTTPException(status_code=500, detail="Failed to delete user")

    # 6) Return confirmation
    log_security_event("account_deleted", user_id=user.id, email=user.email)
    return {"deleted": True}
