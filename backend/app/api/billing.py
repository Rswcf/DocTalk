from __future__ import annotations

import logging
import uuid
from typing import Literal

import stripe
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.deps import get_db_session, require_auth
from app.models.tables import CreditLedger, User
from app.services.credit_service import credit_credits

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/billing", tags=["billing"])

stripe.api_key = settings.STRIPE_SECRET_KEY


@router.get("/products")
async def list_products():
    return {
        "products": [
            {"id": "starter", "credits": settings.CREDITS_STARTER, "price_usd": 5},
            {"id": "pro", "credits": settings.CREDITS_PRO, "price_usd": 15},
            {"id": "enterprise", "credits": settings.CREDITS_ENTERPRISE, "price_usd": 50},
        ]
    }


@router.post("/checkout")
async def create_checkout(
    pack_id: Literal["starter", "pro", "enterprise"],
    user: User = Depends(require_auth),
):
    if not settings.STRIPE_SECRET_KEY:
        raise HTTPException(503, "Stripe not configured")

    price_map = {
        "starter": (settings.STRIPE_PRICE_STARTER, settings.CREDITS_STARTER),
        "pro": (settings.STRIPE_PRICE_PRO, settings.CREDITS_PRO),
        "enterprise": (settings.STRIPE_PRICE_ENTERPRISE, settings.CREDITS_ENTERPRISE),
    }
    price_id, credits = price_map[pack_id]

    session = stripe.checkout.Session.create(
        mode="payment",
        line_items=[{"price": price_id, "quantity": 1}],
        success_url=f"{settings.FRONTEND_URL}/billing?success=1",
        cancel_url=f"{settings.FRONTEND_URL}/billing?canceled=1",
        client_reference_id=str(user.id),
        metadata={"credits": str(credits), "pack_id": pack_id},
    )
    return {"checkout_url": session.url}


@router.post("/webhook")
async def stripe_webhook(request: Request, db: AsyncSession = Depends(get_db_session)):
    payload = await request.body()
    sig = request.headers.get("stripe-signature")

    if not settings.STRIPE_WEBHOOK_SECRET:
        raise HTTPException(503, "Webhook not configured")

    # Validate webhook signature - separate error handling for different failures
    try:
        event = stripe.Webhook.construct_event(
            payload, sig, settings.STRIPE_WEBHOOK_SECRET
        )
    except ValueError as e:
        logger.error("Webhook payload parsing error: %s", e)
        raise HTTPException(400, "Invalid payload")
    except stripe.error.SignatureVerificationError as e:
        logger.error("Webhook signature verification failed: %s", e)
        raise HTTPException(401, "Invalid signature")

    if event["type"] == "checkout.session.completed":
        event_data = event.get("data", {})
        session = event_data.get("object")
        if not session or not isinstance(session, dict):
            logger.error("Invalid event structure: missing data.object")
            return {"received": True}

        # Parse and validate client_reference_id (user_id)
        try:
            client_ref = session.get("client_reference_id")
            if not client_ref:
                logger.error("Missing client_reference_id in checkout session")
                return {"received": True}
            user_id = uuid.UUID(client_ref)
        except (ValueError, TypeError) as e:
            logger.error("Invalid client_reference_id: %s", e)
            return {"received": True}

        # Parse and validate credits amount
        try:
            metadata = session.get("metadata", {})
            credits_str = metadata.get("credits")
            if not credits_str:
                logger.error("Missing credits in session metadata")
                return {"received": True}
            credits = int(credits_str)
            if credits <= 0:
                logger.error("Invalid credits amount: %d", credits)
                return {"received": True}
        except (ValueError, TypeError) as e:
            logger.error("Cannot parse credits from metadata: %s", e)
            return {"received": True}

        # Get payment_intent for idempotency
        payment_intent = session.get("payment_intent")
        if not payment_intent:
            logger.warning("Checkout session has no payment_intent, skipping for safety")
            return {"received": True}

        # Verify user exists
        user = await db.get(User, user_id)
        if not user:
            logger.warning("Webhook for non-existent user %s", user_id)
            return {"received": True}

        # Idempotency check
        existing = await db.scalar(
            select(CreditLedger).where(
                CreditLedger.ref_type == "stripe_payment",
                CreditLedger.ref_id == payment_intent,
            )
        )

        if not existing:
            try:
                await credit_credits(
                    db,
                    user_id,
                    credits,
                    reason="purchase",
                    ref_type="stripe_payment",
                    ref_id=payment_intent,
                )
                await db.commit()
                logger.info("Credits granted: user_id=%s, credits=%d, payment_intent=%s",
                           user_id, credits, payment_intent)
            except Exception as e:
                await db.rollback()
                logger.error("Failed to grant credits: %s", e)
                # Return 5xx so Stripe retries
                raise HTTPException(500, "Database error")

    return {"received": True}

