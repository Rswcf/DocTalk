from __future__ import annotations

import logging
import uuid
from typing import Literal, Optional

import stripe
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.deps import get_db_session, require_auth
from app.models.tables import CreditLedger, User
from app.services.credit_service import credit_credits

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/billing", tags=["billing"])

stripe.api_key = settings.STRIPE_SECRET_KEY


class SubscribeRequest(BaseModel):
    plan: Literal["plus", "pro"] = "pro"
    billing: Literal["monthly", "annual"] = "monthly"


def _get_subscription_price_id(plan: str, billing: str) -> str:
    """Map plan+billing to Stripe price ID."""
    key = f"{plan}_{billing}"
    mapping = {
        "plus_monthly": settings.STRIPE_PRICE_PLUS_MONTHLY,
        "plus_annual": settings.STRIPE_PRICE_PLUS_ANNUAL,
        "pro_monthly": settings.STRIPE_PRICE_PRO_MONTHLY,
        "pro_annual": settings.STRIPE_PRICE_PRO_ANNUAL,
    }
    return mapping.get(key, "")


def _plan_from_price_id(price_id: str) -> Optional[str]:
    """Determine plan name from a Stripe price ID. Returns None if unknown."""
    plus_prices = {settings.STRIPE_PRICE_PLUS_MONTHLY, settings.STRIPE_PRICE_PLUS_ANNUAL}
    pro_prices = {settings.STRIPE_PRICE_PRO_MONTHLY, settings.STRIPE_PRICE_PRO_ANNUAL}
    if price_id in plus_prices:
        return "plus"
    if price_id in pro_prices:
        return "pro"
    return None


def _credits_for_plan(plan: str) -> int:
    """Return monthly credit allowance for a plan."""
    if plan == "pro":
        return int(settings.PLAN_PRO_MONTHLY_CREDITS or 0)
    if plan == "plus":
        return int(settings.PLAN_PLUS_MONTHLY_CREDITS or 0)
    return int(settings.PLAN_FREE_MONTHLY_CREDITS or 0)


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


# Subscriptions
@router.post("/subscribe")
async def subscribe(
    body: SubscribeRequest = SubscribeRequest(),
    user: User = Depends(require_auth),
    db: AsyncSession = Depends(get_db_session),
):
    if not settings.STRIPE_SECRET_KEY:
        raise HTTPException(503, "Stripe not configured")

    price_id = _get_subscription_price_id(body.plan, body.billing)
    if not price_id:
        raise HTTPException(400, f"Stripe price not configured for {body.plan}/{body.billing}")

    # Ensure customer exists
    if not user.stripe_customer_id:
        cust = stripe.Customer.create(email=user.email, name=user.name or None)
        user.stripe_customer_id = cust.id
        await db.commit()

    # Create Checkout Session for subscription
    session = stripe.checkout.Session.create(
        mode="subscription",
        line_items=[{"price": price_id, "quantity": 1}],
        success_url=f"{settings.FRONTEND_URL}/billing",
        cancel_url=f"{settings.FRONTEND_URL}/billing",
        customer=user.stripe_customer_id,
        client_reference_id=str(user.id),
    )
    return {"checkout_url": session.url}


@router.post("/portal")
async def customer_portal(user: User = Depends(require_auth)):
    if not settings.STRIPE_SECRET_KEY:
        raise HTTPException(503, "Stripe not configured")
    if not user.stripe_customer_id:
        raise HTTPException(400, "No Stripe customer for user")

    portal = stripe.billing_portal.Session.create(
        customer=user.stripe_customer_id,
        return_url=f"{settings.FRONTEND_URL}/billing",
    )
    return {"portal_url": portal.url}


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

        mode = session.get("mode")

        # Handle subscription checkout
        if mode == "subscription":
            try:
                client_ref = session.get("client_reference_id")
                if not client_ref:
                    logger.error("Missing client_reference_id in subscription session")
                    return {"received": True}
                user_id = uuid.UUID(client_ref)
            except (ValueError, TypeError) as e:
                logger.error("Invalid client_reference_id: %s", e)
                return {"received": True}

            user = await db.get(User, user_id)
            if not user:
                logger.warning("Subscription completed for non-existent user %s", user_id)
                return {"received": True}

            subscription_id = session.get("subscription")
            customer_id = session.get("customer")

            # Determine plan from subscription price_id
            plan = "pro"  # default for backward compatibility
            if subscription_id:
                try:
                    sub = stripe.Subscription.retrieve(subscription_id)
                    if sub.get("items") and sub["items"].get("data"):
                        sub_price_id = sub["items"]["data"][0].get("price", {}).get("id", "")
                        detected = _plan_from_price_id(sub_price_id)
                        if detected:
                            plan = detected
                except Exception as e:
                    logger.warning("Could not retrieve subscription to detect plan: %s", e)

            # Update user plan and subscription/customer ids
            user.plan = plan
            if subscription_id:
                user.stripe_subscription_id = subscription_id
            if customer_id and not user.stripe_customer_id:
                user.stripe_customer_id = customer_id

            allowance = _credits_for_plan(plan)

            # Idempotency: only one monthly grant per subscription id at start
            existing = await db.scalar(
                select(CreditLedger).where(
                    CreditLedger.ref_type == "stripe_subscription",
                    CreditLedger.ref_id == (subscription_id or ""),
                )
            )

            if not existing and allowance > 0:
                try:
                    await credit_credits(
                        db,
                        user_id=user.id,
                        amount=allowance,
                        reason="monthly_allowance",
                        ref_type="stripe_subscription",
                        ref_id=subscription_id or "",
                    )
                    await db.commit()
                    logger.info(
                        "Subscription start credits granted: user_id=%s, plan=%s, subscription=%s",
                        user.id,
                        plan,
                        subscription_id,
                    )
                except Exception as e:
                    await db.rollback()
                    logger.error("Failed to grant subscription start credits: %s", e)
                    raise HTTPException(500, "Database error")
            else:
                await db.commit()

            return {"received": True}

        # Handle one-time credit pack checkout
        if mode == "payment":
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
                    logger.info(
                        "Credits granted: user_id=%s, credits=%d, payment_intent=%s",
                        user_id,
                        credits,
                        payment_intent,
                    )
                except Exception as e:
                    await db.rollback()
                    logger.error("Failed to grant credits: %s", e)
                    # Return 5xx so Stripe retries
                    raise HTTPException(500, "Database error")
            return {"received": True}

    elif event["type"] == "invoice.payment_succeeded":

        obj = event.get("data", {}).get("object")
        if not obj or not isinstance(obj, dict):
            return {"received": True}

        invoice_id = obj.get("id")
        customer_id = obj.get("customer")
        if not invoice_id or not customer_id:
            return {"received": True}

        # Find user by customer id
        user = await db.scalar(select(User).where(User.stripe_customer_id == customer_id))
        if not user:
            return {"received": True}

        # Determine plan from subscription price_id
        plan = user.plan or "pro"  # default to current plan for backward compat
        subscription_id = obj.get("subscription")
        if subscription_id:
            try:
                sub = stripe.Subscription.retrieve(subscription_id)
                if sub.get("items") and sub["items"].get("data"):
                    sub_price_id = sub["items"]["data"][0].get("price", {}).get("id", "")
                    detected = _plan_from_price_id(sub_price_id)
                    if detected:
                        plan = detected
                        # Sync plan in case of upgrade/downgrade
                        if user.plan != plan:
                            user.plan = plan
            except Exception as e:
                logger.warning("Could not retrieve subscription to detect plan on invoice: %s", e)

        allowance = _credits_for_plan(plan)

        # Idempotency: ensure we haven't granted for this invoice
        existing = await db.scalar(
            select(CreditLedger).where(
                CreditLedger.ref_type == "stripe_invoice",
                CreditLedger.ref_id == invoice_id,
            )
        )
        if not existing and allowance > 0:
            try:
                await credit_credits(
                    db,
                    user_id=user.id,
                    amount=allowance,
                    reason="monthly_allowance",
                    ref_type="stripe_invoice",
                    ref_id=invoice_id,
                )
                await db.commit()
            except Exception as e:
                await db.rollback()
                logger.error("Failed to grant monthly credits on invoice: %s", e)
                raise HTTPException(500, "Database error")
        else:
            await db.commit()
        return {"received": True}

    elif event["type"] == "customer.subscription.deleted":
        obj = event.get("data", {}).get("object")
        if not obj or not isinstance(obj, dict):
            return {"received": True}

        customer_id = obj.get("customer")
        if not customer_id:
            return {"received": True}

        user = await db.scalar(select(User).where(User.stripe_customer_id == customer_id))
        if not user:
            return {"received": True}

        user.plan = "free"
        user.stripe_subscription_id = None
        await db.commit()
        return {"received": True}

    return {"received": True}
