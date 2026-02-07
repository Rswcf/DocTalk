from __future__ import annotations

from typing import List, Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db_session, require_auth
from app.models.tables import CreditLedger, User

router = APIRouter(prefix="/api/credits", tags=["credits"])


class CreditsBalanceResponse(BaseModel):
    balance: int
    recent_transactions: List[dict]


class LedgerEntryResponse(BaseModel):
    id: str
    delta: int
    balance_after: int
    reason: str
    ref_type: Optional[str]
    ref_id: Optional[str]
    created_at: str


@router.get("/balance", response_model=CreditsBalanceResponse)
async def get_balance(
    user: User = Depends(require_auth),
    db: AsyncSession = Depends(get_db_session),
):
    # Get last 5 transactions
    result = await db.execute(
        select(CreditLedger)
        .where(CreditLedger.user_id == user.id)
        .order_by(CreditLedger.created_at.desc())
        .limit(5)
    )
    entries = result.scalars().all()

    return {
        "balance": user.credits_balance,
        "recent_transactions": [
            {
                "id": str(e.id),
                "delta": e.delta,
                "balance_after": e.balance_after,
                "reason": e.reason,
                "created_at": e.created_at.isoformat(),
            }
            for e in entries
        ],
    }


@router.get("/history")
async def get_history(
    user: User = Depends(require_auth),
    db: AsyncSession = Depends(get_db_session),
    limit: int = 20,
    offset: int = 0,
):
    # Enforce sane bounds
    limit = max(1, min(100, int(limit or 20)))
    offset = max(0, int(offset or 0))

    # Total count for pagination
    total = await db.scalar(
        select(func.count()).select_from(CreditLedger).where(CreditLedger.user_id == user.id)
    )

    # Page of items
    result = await db.execute(
        select(CreditLedger)
        .where(CreditLedger.user_id == user.id)
        .order_by(CreditLedger.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    entries = result.scalars().all()

    return {
        "items": [
            {
                "id": str(e.id),
                "delta": e.delta,
                "balance_after": e.balance_after,
                "reason": e.reason,
                "ref_type": e.ref_type,
                "ref_id": e.ref_id,
                "created_at": e.created_at.isoformat(),
            }
            for e in entries
        ],
        "total": int(total or 0),
    }
