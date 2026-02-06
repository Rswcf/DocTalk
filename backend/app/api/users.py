from __future__ import annotations
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

import stripe

from app.core.config import settings
from app.core.deps import require_auth, get_db_session
from app.models.tables import (
    User,
    Account,
    Document,
    ChatSession,
    Message,
    UsageRecord,
    CreditLedger,
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
    monthly_allowance = (
        int(settings.PLAN_PRO_MONTHLY_CREDITS or 0)
        if (user.plan or "").lower() == "pro"
        else int(settings.PLAN_FREE_MONTHLY_CREDITS or 0)
    )

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
            func.coalesce(func.sum(UsageRecord.total_tokens), 0).label("total_tokens"),
            func.coalesce(func.sum(UsageRecord.cost_credits), 0).label("total_credits"),
        )
        .where(UsageRecord.user_id == user.id)
        .group_by(UsageRecord.model)
        .order_by(UsageRecord.model)
    )
    results = rows.all()

    return {
        "by_model": [
            {
                "model": r.model,
                "total_calls": int(r.total_calls or 0),
                "total_tokens": int(r.total_tokens or 0),
                "total_credits": int(r.total_credits or 0),
            }
            for r in results
        ]
    }


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
    return {"deleted": True}
