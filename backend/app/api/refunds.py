"""Separate confirmed refunds; the existing cancellation review flag stays passive."""

from __future__ import annotations

import asyncio
import uuid
from datetime import datetime, timezone
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, StrictBool
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db_session, require_auth
from app.models.tables import RefundOperation, User
from app.services import refund_service as service

router = APIRouter(prefix="/api/billing", tags=["refunds"])


class RefundRequest(BaseModel):
    invoice_id: str = Field(min_length=4, max_length=255, pattern=r"^in_[A-Za-z0-9_]+$")
    request_kind: Literal["commercial", "statutory", "other"] = "commercial"
    reason: str | None = Field(default=None, max_length=1000)


class RefundConfirmation(BaseModel):
    confirm_full_refund: StrictBool = False
    confirm_immediate_cancellation: StrictBool = False
    confirm_credit_revocation: StrictBool = False


@router.get("/refund-options")
async def refund_options(user: User = Depends(require_auth)):
    if not service.sandbox_enabled() or not service.user_in_scope(user.id):
        return {"enabled": False, "policy_version": service.POLICY, "options": []}
    options = []
    if user.stripe_customer_id:
        try:
            invoices = await asyncio.to_thread(
                service.Provider().options, user.stripe_customer_id
            )
            for invoice in invoices:
                paid = (invoice.get("status_transitions") or {}).get("paid_at")
                if invoice.get("status") == "paid" and isinstance(paid, int):
                    options.append(
                        {
                            "invoice_id": invoice["id"],
                            "amount_minor": invoice.get("amount_paid", 0),
                            "currency": invoice.get("currency", "usd"),
                            "paid_at": datetime.fromtimestamp(
                                paid, timezone.utc
                            ).isoformat(),
                            "subscription_id": service.sid(invoice.get("subscription"))
                            or service.sid(
                                (
                                    (invoice.get("parent") or {}).get(
                                        "subscription_details"
                                    )
                                    or {}
                                ).get("subscription")
                            )
                            or "",
                        }
                    )
        except Exception as exc:
            raise HTTPException(503, "Refund options temporarily unavailable") from exc
    return {"enabled": True, "policy_version": service.POLICY, "options": options}


@router.post("/refund-requests")
async def create_refund(
    body: RefundRequest,
    user: User = Depends(require_auth),
    db: AsyncSession = Depends(get_db_session),
):
    if not service.sandbox_enabled() or not service.user_in_scope(user.id):
        raise HTTPException(503, "Automatic refunds are disabled")
    return service.view(
        await service.request_refund(
            db, user.id, body.invoice_id, body.request_kind, body.reason
        )
    )


@router.get("/refund-requests")
async def list_refunds(
    user: User = Depends(require_auth), db: AsyncSession = Depends(get_db_session)
):
    rows = (
        await db.scalars(
            select(RefundOperation)
            .where(RefundOperation.user_id == user.id)
            .order_by(RefundOperation.requested_at.desc())
            .limit(20)
        )
    ).all()
    return {"operations": [service.view(op) for op in rows]}


@router.get("/refund-requests/{operation_id}")
async def get_refund(
    operation_id: uuid.UUID,
    user: User = Depends(require_auth),
    db: AsyncSession = Depends(get_db_session),
):
    op = await db.get(RefundOperation, operation_id)
    if not op or op.user_id != user.id:
        raise HTTPException(404, "Refund request not found")
    return service.view(op)


@router.post("/refund-requests/{operation_id}/confirm")
async def confirm_refund(
    operation_id: uuid.UUID,
    body: RefundConfirmation,
    user: User = Depends(require_auth),
    db: AsyncSession = Depends(get_db_session),
):
    if not all(
        [
            body.confirm_full_refund,
            body.confirm_immediate_cancellation,
            body.confirm_credit_revocation,
        ]
    ):
        raise HTTPException(
            409, "Confirm the full refund, immediate cancellation and credit revocation"
        )
    return service.view(await service.confirm_refund(db, user.id, operation_id))
