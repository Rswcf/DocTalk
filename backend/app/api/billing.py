from __future__ import annotations

import asyncio
import logging
import uuid
from typing import Literal, Optional

import stripe
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.cache import cache_delete
from app.core.config import settings
from app.core.deps import get_db_session, require_auth
from app.models.tables import CreditLedger, User
from app.schemas.billing import (
    BillingProductsResponse,
    ChangePlanResponse,
    CheckoutUrlResponse,
    PortalUrlResponse,
)
from app.schemas.common import ReceivedResponse
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


PLAN_HIERARCHY = {"free": 0, "plus": 1, "pro": 2}


def _interval_from_price_id(price_id: str) -> Optional[str]:
    monthly = {settings.STRIPE_PRICE_PLUS_MONTHLY, settings.STRIPE_PRICE_PRO_MONTHLY}
    annual = {settings.STRIPE_PRICE_PLUS_ANNUAL, settings.STRIPE_PRICE_PRO_ANNUAL}
    if price_id in monthly:
        return "monthly"
    if price_id in annual:
        return "annual"
    return None


@router.get("/products", response_model=BillingProductsResponse)
async def list_products():
    return {
        "products": [
            {"id": "boost", "credits": settings.CREDITS_BOOST, "price_usd": 3.99},
            {"id": "power", "credits": settings.CREDITS_POWER, "price_usd": 9.99},
            {"id": "ultra", "credits": settings.CREDITS_ULTRA, "price_usd": 19.99},
        ]
    }


@router.post("/checkout", response_model=CheckoutUrlResponse)
async def create_checkout(
    pack_id: Literal["boost", "power", "ultra"],
    user: User = Depends(require_auth),
):
    if not settings.STRIPE_SECRET_KEY:
        raise HTTPException(503, "Stripe not configured")

    price_map = {
        "boost": (settings.STRIPE_PRICE_BOOST, settings.CREDITS_BOOST),
        "power": (settings.STRIPE_PRICE_POWER, settings.CREDITS_POWER),
        "ultra": (settings.STRIPE_PRICE_ULTRA, settings.CREDITS_ULTRA),
    }
    price_id, credits = price_map[pack_id]

    session = await asyncio.to_thread(
        stripe.checkout.Session.create,
        mode="payment",
        line_items=[{"price": price_id, "quantity": 1}],
        success_url=f"{settings.FRONTEND_URL}/billing?success=1",
        cancel_url=f"{settings.FRONTEND_URL}/billing?canceled=1",
        client_reference_id=str(user.id),
        metadata={"credits": str(credits), "pack_id": pack_id},
    )
    return {"checkout_url": session.url}


# Subscriptions
@router.post("/subscribe", response_model=CheckoutUrlResponse)
async def subscribe(
    body: SubscribeRequest = SubscribeRequest(),
    user: User = Depends(require_auth),
    db: AsyncSession = Depends(get_db_session),
):
    if not settings.STRIPE_SECRET_KEY:
        raise HTTPException(503, "Stripe not configured")
    if user.stripe_subscription_id:
        raise HTTPException(
            400,
            "You already have an active subscription. Use /change-plan to switch plans.",
        )

    price_id = _get_subscription_price_id(body.plan, body.billing)
    if not price_id:
        raise HTTPException(400, f"Stripe price not configured for {body.plan}/{body.billing}")

    # Atomic guard: prevent concurrent subscribe requests from creating
    # multiple checkout sessions before webhook reconciliation.
    user.stripe_subscription_id = "pending"
    await db.commit()

    try:
        # Ensure customer exists
        if not user.stripe_customer_id:
            cust = await asyncio.to_thread(
                stripe.Customer.create, email=user.email, name=user.name or None
            )
            user.stripe_customer_id = cust.id
            await db.commit()

        # Create Checkout Session for subscription
        session = await asyncio.to_thread(
            stripe.checkout.Session.create,
            mode="subscription",
            line_items=[{"price": price_id, "quantity": 1}],
            success_url=f"{settings.FRONTEND_URL}/billing?success=1",
            cancel_url=f"{settings.FRONTEND_URL}/billing",
            customer=user.stripe_customer_id,
            client_reference_id=str(user.id),
        )
    except stripe.StripeError as e:
        logger.error("Failed to create subscription checkout: %s", e)
        await db.rollback()
        user.stripe_subscription_id = None
        await db.commit()
        raise HTTPException(502, "Failed to create subscription checkout")
    except Exception:
        await db.rollback()
        user.stripe_subscription_id = None
        await db.commit()
        raise
    return {"checkout_url": session.url}


@router.post("/portal", response_model=PortalUrlResponse)
async def customer_portal(user: User = Depends(require_auth)):
    if not settings.STRIPE_SECRET_KEY:
        raise HTTPException(503, "Stripe not configured")
    if not user.stripe_customer_id:
        raise HTTPException(400, "No Stripe customer for user")

    try:
        portal = await asyncio.to_thread(
            stripe.billing_portal.Session.create,
            customer=user.stripe_customer_id,
            return_url=f"{settings.FRONTEND_URL}/billing",
        )
    except stripe.StripeError as e:
        logger.error("Failed to create billing portal session: %s", e)
        raise HTTPException(502, "Failed to create billing portal session")
    return {"portal_url": portal.url}


@router.post("/change-plan", response_model=ChangePlanResponse)
async def change_plan(
    body: SubscribeRequest = SubscribeRequest(),
    user: User = Depends(require_auth),
    db: AsyncSession = Depends(get_db_session),
):
    if not settings.STRIPE_SECRET_KEY:
        raise HTTPException(503, "Stripe not configured")
    if not user.stripe_subscription_id:
        if user.stripe_customer_id:
            try:
                subs = await asyncio.to_thread(
                    stripe.Subscription.list,
                    customer=user.stripe_customer_id,
                    status="active",
                    limit=1,
                )
                if subs.data:
                    user.stripe_subscription_id = subs.data[0].id
                    await db.commit()
                    logger.info("Auto-recovered subscription_id for user %s", user.id)
            except stripe.StripeError as e:
                logger.warning("Failed to lookup subscription for user %s: %s", user.id, e)
        if not user.stripe_subscription_id:
            raise HTTPException(400, "No active subscription. Use /subscribe instead.")
    if user.plan == body.plan:
        raise HTTPException(400, "You are already on this plan")
    if user.plan == "free":
        raise HTTPException(400, "Free users must use /subscribe")

    old_plan = user.plan
    try:
        sub = await asyncio.to_thread(
            stripe.Subscription.retrieve, user.stripe_subscription_id
        )
    except stripe.StripeError as e:
        logger.error("Stripe retrieve subscription failed: %s", e)
        raise HTTPException(502, "Stripe subscription retrieval failed")

    if sub.get("status") not in ("active", "trialing"):
        raise HTTPException(400, "Subscription is not active")

    items = sub.get("items", {}).get("data", [])
    if not items:
        raise HTTPException(400, "Subscription has no line items")
    current_item = items[0]
    current_price_id = current_item.get("price", {}).get("id", "")
    current_interval = _interval_from_price_id(current_price_id)
    if current_interval != body.billing:
        raise HTTPException(400, "Cannot switch billing interval during beta")

    new_price_id = _get_subscription_price_id(body.plan, body.billing)
    if not new_price_id:
        raise HTTPException(400, f"Stripe price not configured for {body.plan}/{body.billing}")

    is_upgrade = PLAN_HIERARCHY.get(body.plan, 0) > PLAN_HIERARCHY.get(old_plan, 0)

    try:
        await asyncio.to_thread(
            stripe.Subscription.modify,
            user.stripe_subscription_id,
            items=[{"id": current_item["id"], "price": new_price_id}],
            proration_behavior="always_invoice" if is_upgrade else "create_prorations",
        )
    except stripe.StripeError as e:
        logger.error("Stripe modify subscription failed: %s", e)
        raise HTTPException(502, "Stripe subscription update failed")

    user.plan = body.plan
    supplement = 0
    if is_upgrade:
        supplement = _credits_for_plan(body.plan) - _credits_for_plan(old_plan)
        if supplement > 0:
            ref_id = (
                f"plan_change_{user.stripe_subscription_id}_{sub.get('current_period_start', '')}"
            )
            existing = await db.scalar(
                select(CreditLedger).where(
                    CreditLedger.user_id == user.id,
                    CreditLedger.ref_type == "plan_change",
                    CreditLedger.ref_id == ref_id,
                )
            )
            if not existing:
                await credit_credits(
                    db=db,
                    user_id=user.id,
                    amount=supplement,
                    reason="plan_upgrade_supplement",
                    ref_type="plan_change",
                    ref_id=ref_id,
                )
            else:
                supplement = 0
    await db.commit()
    await cache_delete(f"user:profile:{user.id}")

    return {
        "status": "upgraded" if is_upgrade else "downgraded",
        "new_plan": body.plan,
        "effective": "immediate",
        "credits_supplemented": supplement,
    }


async def _handle_checkout_session_subscription_completed(
    session: dict,
    db: AsyncSession,
):
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

    if (
        user.stripe_subscription_id
        and user.stripe_subscription_id != "pending"
        and user.stripe_subscription_id != subscription_id
    ):
        logger.warning(
            "Duplicate subscription webhook: user=%s existing=%s incoming=%s",
            user.id,
            user.stripe_subscription_id,
            subscription_id,
        )
        if subscription_id:
            try:
                await asyncio.to_thread(stripe.Subscription.cancel, subscription_id)
            except Exception as e:
                logger.warning(
                    "Failed to cancel duplicate subscription %s for user %s: %s",
                    subscription_id,
                    user.id,
                    e,
                )
        return {"received": True}

    # Determine plan from subscription price_id
    plan = "pro"  # default for backward compatibility
    if subscription_id:
        try:
            sub = await asyncio.to_thread(
                stripe.Subscription.retrieve, subscription_id
            )
            if sub.get("items") and sub["items"].get("data"):
                sub_price_id = sub["items"]["data"][0].get("price", {}).get("id", "")
                detected = _plan_from_price_id(sub_price_id)
                if detected:
                    plan = detected
        except stripe.StripeError as e:
            logger.error("Could not retrieve subscription to detect plan: %s", e)
            raise HTTPException(500, "Failed to retrieve subscription")

    # Update user plan and subscription/customer ids
    user.plan = plan
    if subscription_id:
        user.stripe_subscription_id = subscription_id
    if customer_id and not user.stripe_customer_id:
        user.stripe_customer_id = customer_id

    # Credits are granted solely via invoice.payment_succeeded to prevent
    # double-granting (checkout.session.completed + first invoice both fire).
    await db.commit()
    await cache_delete(f"user:profile:{user.id}")
    logger.info(
        "Subscription checkout completed: user_id=%s, plan=%s, subscription=%s (credits deferred to invoice)",
        user.id,
        plan,
        subscription_id,
    )
    return {"received": True}


async def _handle_checkout_session_payment_completed(
    session: dict,
    db: AsyncSession,
):
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


async def _handle_checkout_session_completed(
    session: dict,
    db: AsyncSession,
):
    mode = session.get("mode")
    if mode == "subscription":
        return await _handle_checkout_session_subscription_completed(session, db)
    if mode == "payment":
        return await _handle_checkout_session_payment_completed(session, db)
    return {"received": True}


async def _handle_invoice_payment_succeeded(
    invoice: dict,
    db: AsyncSession,
):
    invoice_id = invoice.get("id")
    customer_id = invoice.get("customer")
    if not invoice_id or not customer_id:
        return {"received": True}

    # Find user by customer id
    user = await db.scalar(select(User).where(User.stripe_customer_id == customer_id))
    if not user:
        return {"received": True}

    # Determine plan from subscription price_id
    plan = user.plan or "pro"  # default to current plan for backward compat
    plan_changed = False
    subscription_id = invoice.get("subscription")
    if subscription_id:
        try:
            sub = await asyncio.to_thread(
                stripe.Subscription.retrieve, subscription_id
            )
            if sub.get("items") and sub["items"].get("data"):
                sub_price_id = sub["items"]["data"][0].get("price", {}).get("id", "")
                detected = _plan_from_price_id(sub_price_id)
                if detected:
                    plan = detected
                    # Sync plan in case of upgrade/downgrade
                    if user.plan != plan:
                        user.plan = plan
                        plan_changed = True
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
    if plan_changed:
        await cache_delete(f"user:profile:{user.id}")
    return {"received": True}


async def _handle_subscription_deleted(
    subscription: dict,
    db: AsyncSession,
):
    customer_id = subscription.get("customer")
    if not customer_id:
        return {"received": True}

    user = await db.scalar(select(User).where(User.stripe_customer_id == customer_id))
    if not user:
        return {"received": True}

    if user.plan == "free" and not user.stripe_subscription_id:
        return {"received": True}

    was_already_free = user.plan == "free"
    user.plan = "free"
    user.stripe_subscription_id = None
    if not was_already_free:
        user.monthly_credits_granted_at = None
    await db.commit()
    await cache_delete(f"user:profile:{user.id}")
    return {"received": True}


async def _handle_subscription_updated(
    subscription: dict,
    db: AsyncSession,
    event: dict,
):
    customer_id = subscription.get("customer")
    if not customer_id:
        return {"received": True}
    # Don't change plan if subscription is just marked for cancellation
    if subscription.get("cancel_at_period_end"):
        return {"received": True}
    user = await db.scalar(select(User).where(User.stripe_customer_id == customer_id))
    if not user:
        return {"received": True}
    status = subscription.get("status", "")
    if status not in ("active", "trialing"):
        return {"received": True}
    if subscription.get("id") != user.stripe_subscription_id:
        return {"received": True}

    items = subscription.get("items", {}).get("data", [])
    if not items:
        return {"received": True}
    price_id = items[0].get("price", {}).get("id", "")
    detected_plan = _plan_from_price_id(price_id)
    if detected_plan and detected_plan != user.plan:
        old_plan = user.plan
        user.plan = detected_plan
        sub_id = subscription.get("id")
        if sub_id:
            user.stripe_subscription_id = sub_id

        is_upgrade = PLAN_HIERARCHY.get(detected_plan, 0) > PLAN_HIERARCHY.get(old_plan, 0)
        supplement = 0
        if is_upgrade:
            supplement = _credits_for_plan(detected_plan) - _credits_for_plan(old_plan)
            if supplement > 0:
                event_subscription = event.get("data", {}).get("object", {})
                current_period_start = subscription.get(
                    "current_period_start",
                    event_subscription.get("current_period_start", ""),
                )
                ref_id = f"plan_change_{user.stripe_subscription_id}_{current_period_start}"
                existing = await db.scalar(
                    select(CreditLedger).where(
                        CreditLedger.user_id == user.id,
                        CreditLedger.ref_type == "plan_change",
                        CreditLedger.ref_id == ref_id,
                    )
                )
                if not existing:
                    await credit_credits(
                        db=db,
                        user_id=user.id,
                        amount=supplement,
                        reason="plan_upgrade_supplement",
                        ref_type="plan_change",
                        ref_id=ref_id,
                    )
                else:
                    supplement = 0

        await db.commit()
        await cache_delete(f"user:profile:{user.id}")
        logger.info(
            "Plan synced from webhook: user=%s, %s -> %s, supplement=%s",
            user.id,
            old_plan,
            detected_plan,
            supplement,
        )
    return {"received": True}


async def _handle_invoice_payment_failed(
    invoice: dict,
    _db: AsyncSession,
):
    customer_id = invoice.get("customer")
    invoice_id = invoice.get("id")
    logger.warning(
        "Invoice payment failed: customer=%s, invoice=%s",
        customer_id,
        invoice_id,
    )
    return {"received": True}


@router.post("/webhook", response_model=ReceivedResponse)
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
    except stripe.SignatureVerificationError as e:
        logger.error("Webhook signature verification failed: %s", e)
        raise HTTPException(401, "Invalid signature")

    handlers = {
        "checkout.session.completed": _handle_checkout_session_completed,
        "invoice.payment_succeeded": _handle_invoice_payment_succeeded,
        "customer.subscription.deleted": _handle_subscription_deleted,
        "customer.subscription.updated": _handle_subscription_updated,
        "invoice.payment_failed": _handle_invoice_payment_failed,
    }
    handler = handlers.get(event["type"])
    if not handler:
        return {"received": True}

    obj = event.get("data", {}).get("object")
    if not obj or not isinstance(obj, dict):
        if event["type"] == "checkout.session.completed":
            logger.error("Invalid event structure: missing data.object")
        return {"received": True}

    if event["type"] == "customer.subscription.updated":
        return await handler(obj, db, event)
    return await handler(obj, db)
