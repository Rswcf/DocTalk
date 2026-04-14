from __future__ import annotations

import asyncio
import logging
import uuid
from datetime import datetime, timedelta, timezone
from typing import Literal, Optional

import stripe
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.cache import cache_delete, cache_get, cache_set
from app.core.config import settings
from app.core.deps import get_db_session, require_auth
from app.models.tables import CreditLedger, PlanTransition, User
from app.schemas.billing import (
    BillingProductsResponse,
    CancelSubscriptionResponse,
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
PENDING_SUBSCRIPTION_TTL = timedelta(minutes=10)
_ALLOWANCE_INVOICE_REASONS = {"subscription_create", "subscription_cycle"}
_ACTIVE_SUBSCRIPTION_STATUSES = {"active", "trialing"}
# Statuses for which a subscription is still cancellable (i.e. Stripe will
# accept `cancel_at_period_end=true`). `past_due` is cancellable so users
# can stop recurring billing even while a payment is failing.
_CANCELLABLE_SUBSCRIPTION_STATUSES = {"active", "trialing", "past_due"}
# Sentinel used in users.stripe_subscription_id while a checkout session
# is in flight (see /subscribe). Not a real Stripe ID.
_PENDING_SENTINEL = "pending"
_STRIPE_SUB_ID_PREFIX = "sub_"


def _interval_from_price_id(price_id: str) -> Optional[str]:
    monthly = {settings.STRIPE_PRICE_PLUS_MONTHLY, settings.STRIPE_PRICE_PRO_MONTHLY}
    annual = {settings.STRIPE_PRICE_PLUS_ANNUAL, settings.STRIPE_PRICE_PRO_ANNUAL}
    if price_id in monthly:
        return "monthly"
    if price_id in annual:
        return "annual"
    return None


def _as_utc(dt: Optional[datetime]) -> Optional[datetime]:
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def _pending_subscription_is_stale(user: User) -> bool:
    updated_at = _as_utc(getattr(user, "updated_at", None))
    if updated_at is None:
        return True
    return datetime.now(timezone.utc) - updated_at >= PENDING_SUBSCRIPTION_TTL


async def _list_customer_subscriptions(customer_id: str) -> list[dict]:
    subs = await asyncio.to_thread(
        stripe.Subscription.list,
        customer=customer_id,
        status="all",
        limit=10,
    )
    return list(getattr(subs, "data", []) or [])


async def _get_customer_active_subscription(customer_id: Optional[str]) -> Optional[dict]:
    if not customer_id:
        return None
    for sub in await _list_customer_subscriptions(customer_id):
        if sub.get("status") in _ACTIVE_SUBSCRIPTION_STATUSES:
            return sub
    return None


async def _recover_pending_subscription(user: User, db: AsyncSession) -> bool:
    """Recover or clear a stale pending subscription state.

    Returns True when an actual active subscription was recovered and persisted.
    Returns False when pending was cleared and checkout can continue.
    Raises 409 when a recent pending checkout should still be treated as in-flight.
    """
    active_sub = await _get_customer_active_subscription(user.stripe_customer_id)
    if active_sub:
        user.stripe_subscription_id = active_sub["id"]
        price_id = (
            active_sub.get("items", {})
            .get("data", [{}])[0]
            .get("price", {})
            .get("id", "")
        )
        detected_plan = _plan_from_price_id(price_id)
        if detected_plan:
            user.plan = detected_plan
        await db.commit()
        await _invalidate_user_caches(user.id)
        logger.info(
            "Recovered active subscription for user %s from pending state: %s",
            user.id,
            user.stripe_subscription_id,
        )
        return True

    if not _pending_subscription_is_stale(user):
        raise HTTPException(
            409,
            "A subscription checkout is already in progress. Please try again in a few minutes.",
        )

    user.stripe_subscription_id = None
    await db.commit()
    logger.info("Cleared stale pending subscription state for user %s", user.id)
    return False


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

    # Lock the user row to prevent concurrent subscribe requests (M3)
    locked_user = (
        await db.execute(
            select(User).where(User.id == user.id).with_for_update(of=User)
        )
    ).scalar_one()

    if locked_user.stripe_subscription_id == "pending":
        recovered = await _recover_pending_subscription(locked_user, db)
        if recovered:
            raise HTTPException(
                400,
                "You already have an active subscription. Use /change-plan to switch plans.",
            )
        # Recovery may have committed (releasing lock). Re-lock to close gap.
        locked_user = (
            await db.execute(
                select(User).where(User.id == user.id).with_for_update(of=User)
            )
        ).scalar_one()
    if locked_user.stripe_subscription_id:
        raise HTTPException(
            400,
            "You already have an active subscription. Use /change-plan to switch plans.",
        )

    price_id = _get_subscription_price_id(body.plan, body.billing)
    if not price_id:
        raise HTTPException(400, f"Stripe price not configured for {body.plan}/{body.billing}")

    # Atomic guard: prevent concurrent subscribe requests from creating
    # multiple checkout sessions before webhook reconciliation.
    locked_user.stripe_subscription_id = "pending"
    await db.commit()
    user = locked_user  # Use locked instance for rest of endpoint

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
                # Include trialing subs, not just active (Codex R1 §6).
                candidates = [
                    s for s in await _list_customer_subscriptions(user.stripe_customer_id)
                    if s.get("status") in _ACTIVE_SUBSCRIPTION_STATUSES
                ]
                if candidates:
                    user.stripe_subscription_id = candidates[0]["id"]
                    await db.commit()
                    logger.info(
                        "Auto-recovered subscription_id for user %s (status=%s)",
                        user.id,
                        candidates[0].get("status"),
                    )
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
    await _invalidate_user_caches(user.id)

    return {
        "status": "upgraded" if is_upgrade else "downgraded",
        "new_plan": body.plan,
        "effective": "immediate",
        "credits_supplemented": supplement,
    }


_BILLING_STATE_CACHE_TTL = 60  # seconds


async def _invalidate_user_caches(user_id) -> None:
    """Invalidate both the profile cache and the billing_state cache for a user.

    Called from every mutation path that changes `user.plan` or
    `user.stripe_subscription_id` so the next profile fetch refreshes
    `billing_state` within one call (not up to 60s stale).
    """
    await cache_delete(f"user:profile:{user_id}")
    await cache_delete(f"user:billing_state:{user_id}")


async def compute_billing_state(user: User) -> dict:
    """Return the BillingStateResponse dict for a given user.

    Stripe-derived fields are cached in Redis (60s) under
    `user:billing_state:{user_id}`. Invalidated by any self_serve_cancel
    write (see cancel_subscription). On Stripe error the last cached
    value is returned; if no cache, a degraded `status="none"` response
    is produced and a warning logged so the profile endpoint doesn't
    500.
    """
    sub_id = user.stripe_subscription_id
    plan = (user.plan or "free").lower()

    # Fast paths that don't need Stripe.
    if plan == "free" and not sub_id and not user.stripe_customer_id:
        return {
            "managed_by": "none",
            "can_cancel": False,
            "interval": None,
            "period_end": None,
            "cancel_at_period_end": False,
            "status": "none",
        }

    if sub_id == _PENDING_SENTINEL:
        return {
            "managed_by": "stripe",
            "can_cancel": False,  # checkout in flight — don't offer cancel
            "interval": None,
            "period_end": None,
            "cancel_at_period_end": False,
            "status": "pending",
        }

    if sub_id and not sub_id.startswith(_STRIPE_SUB_ID_PREFIX):
        # Branch F precondition — malformed ID, do not offer a 409-guaranteed cancel.
        return {
            "managed_by": "stripe",
            "can_cancel": False,
            "interval": None,
            "period_end": None,
            "cancel_at_period_end": False,
            "status": "none",
        }

    cache_key = f"user:billing_state:{user.id}"
    cached = await cache_get(cache_key)
    if isinstance(cached, dict) and cached.get("managed_by"):
        return cached

    try:
        if sub_id and sub_id.startswith(_STRIPE_SUB_ID_PREFIX):
            sub = await asyncio.to_thread(stripe.Subscription.retrieve, sub_id)
            state = _billing_state_from_stripe_sub(plan, sub)
        elif user.stripe_customer_id:
            # No sub_id but there may be a live sub on the customer.
            cancellable = [
                s for s in await _list_customer_subscriptions(user.stripe_customer_id)
                if s.get("status") in _CANCELLABLE_SUBSCRIPTION_STATUSES
            ]
            if len(cancellable) == 1:
                state = _billing_state_from_stripe_sub(plan, cancellable[0])
            elif len(cancellable) > 1:
                state = {
                    "managed_by": "stripe",
                    "can_cancel": False,  # ambiguous; support must resolve
                    "interval": None,
                    "period_end": None,
                    "cancel_at_period_end": False,
                    "status": "active",  # best-effort label
                }
            else:
                # No cancellable sub — user is admin-managed.
                state = {
                    "managed_by": "admin" if plan != "free" else "none",
                    "can_cancel": plan != "free",
                    "interval": None,
                    "period_end": None,
                    "cancel_at_period_end": False,
                    "status": "none",
                }
        else:
            state = {
                "managed_by": "admin" if plan != "free" else "none",
                "can_cancel": plan != "free",
                "interval": None,
                "period_end": None,
                "cancel_at_period_end": False,
                "status": "none",
            }
    except stripe.StripeError as e:
        logger.warning(
            "Stripe unavailable while computing billing_state for user %s: %s",
            user.id,
            e,
        )
        # Degraded fallback — best-effort local inference, flagged as "none".
        state = {
            "managed_by": "stripe" if sub_id else ("admin" if plan != "free" else "none"),
            "can_cancel": plan != "free",
            "interval": None,
            "period_end": None,
            "cancel_at_period_end": False,
            "status": "none",
        }
        # Don't cache degraded results — want to retry on next call.
        return state

    await cache_set(cache_key, state, ttl_seconds=_BILLING_STATE_CACHE_TTL)
    return state


def _billing_state_from_stripe_sub(plan: str, sub: dict) -> dict:
    """Project a Stripe subscription dict into BillingStateResponse fields."""
    status = sub.get("status", "none")
    items = sub.get("items", {}).get("data", [])
    price = items[0].get("price", {}) if items else {}
    recurring = price.get("recurring") or {}
    stripe_interval = recurring.get("interval")  # 'month' | 'year' | None
    interval: Optional[str] = stripe_interval if stripe_interval in {"month", "year"} else None
    period_end = _iso(sub.get("current_period_end"))
    cancel_at_period_end = bool(sub.get("cancel_at_period_end"))
    can_cancel = (
        status in _CANCELLABLE_SUBSCRIPTION_STATUSES
        and not cancel_at_period_end
        and plan != "free"
    )
    return {
        "managed_by": "stripe",
        "can_cancel": can_cancel,
        "interval": interval,
        "period_end": period_end,
        "cancel_at_period_end": cancel_at_period_end,
        "status": status if status in {"active", "trialing", "past_due", "canceled"} else "none",
    }


def _audit_plan_transition(
    db: AsyncSession,
    *,
    user_id: uuid.UUID,
    from_plan: str,
    to_plan: str,
    source: str,
    metadata: Optional[dict] = None,
    stripe_event_id: Optional[str] = None,
) -> None:
    """Append a plan_transitions audit row. Caller is responsible for commit."""
    db.add(
        PlanTransition(
            user_id=user_id,
            from_plan=from_plan,
            to_plan=to_plan,
            source=source,
            stripe_event_id=stripe_event_id,
            metadata_json=metadata or {},
        )
    )


def _iso(dt_value) -> Optional[str]:
    """Normalise a Stripe epoch int or datetime into ISO-8601 UTC string."""
    if dt_value is None:
        return None
    if isinstance(dt_value, (int, float)):
        dt = datetime.fromtimestamp(int(dt_value), tz=timezone.utc)
    elif isinstance(dt_value, datetime):
        dt = _as_utc(dt_value)
    else:
        return None
    return dt.isoformat() if dt else None


@router.post("/cancel", response_model=CancelSubscriptionResponse)
async def cancel_subscription(
    user: User = Depends(require_auth),
    db: AsyncSession = Depends(get_db_session),
):
    """Self-serve cancel / downgrade-to-Free, implementing the state machine
    described in `.collab/plans/billing-cancel-statemachine.md` §5.1.

    Branches evaluated in order D → E → A → F → C → B.
    """
    if not settings.STRIPE_SECRET_KEY:
        raise HTTPException(503, "Stripe not configured")

    current_plan = user.plan
    sub_id = user.stripe_subscription_id

    # Branch D: already on Free — nothing to cancel.
    if current_plan == "free":
        raise HTTPException(400, "Already on the Free plan")

    # Branch E: checkout in flight — don't interfere with pending state.
    if sub_id == _PENDING_SENTINEL:
        raise HTTPException(
            409,
            "A subscription checkout is in progress. Please try again in a few minutes.",
        )

    # Branch A: real Stripe subscription id present.
    if sub_id and sub_id.startswith(_STRIPE_SUB_ID_PREFIX):
        try:
            sub = await asyncio.to_thread(stripe.Subscription.retrieve, sub_id)
        except stripe.StripeError as e:
            logger.error("Stripe retrieve failed during cancel for user %s: %s", user.id, e)
            raise HTTPException(502, "Stripe temporarily unavailable, please try again")

        status = sub.get("status")
        if status in _CANCELLABLE_SUBSCRIPTION_STATUSES:
            try:
                updated = await asyncio.to_thread(
                    stripe.Subscription.modify,
                    sub_id,
                    cancel_at_period_end=True,
                )
            except stripe.StripeError as e:
                logger.error("Stripe modify (cancel) failed for user %s: %s", user.id, e)
                raise HTTPException(502, "Stripe temporarily unavailable, please try again")

            effective_at = _iso(updated.get("current_period_end") or sub.get("current_period_end"))
            _audit_plan_transition(
                db,
                user_id=user.id,
                from_plan=current_plan,
                to_plan=current_plan,  # not yet demoted; webhook flips it at period_end
                source="self_serve_cancel",
                metadata={
                    "sub_id": sub_id,
                    "status_at_cancel": status,
                    "cancel_at_period_end": True,
                    "effective_at": effective_at,
                },
            )
            await db.commit()
            await _invalidate_user_caches(user.id)
            logger.info("Self-serve cancel scheduled for user %s (sub=%s)", user.id, sub_id)
            return {
                "status": "scheduled_cancel",
                "effective_at": effective_at,
                "message": "Subscription will end at the current period end.",
            }

        # Already cancelled on Stripe side — sync local state (idempotent).
        if status == "canceled":
            locked = (
                await db.execute(
                    select(User).where(User.id == user.id).with_for_update(of=User)
                )
            ).scalar_one()
            was_paid = locked.plan != "free"
            locked.plan = "free"
            locked.stripe_subscription_id = None
            if was_paid:
                locked.monthly_credits_granted_at = None
            _audit_plan_transition(
                db,
                user_id=locked.id,
                from_plan=current_plan,
                to_plan="free",
                source="self_serve_cancel",
                metadata={
                    "sub_id": sub_id,
                    "status_at_cancel": status,
                    "reason": "stripe_already_canceled_sync",
                },
            )
            await db.commit()
            await _invalidate_user_caches(user.id)
            logger.info("Synced local state for user %s — Stripe sub already canceled", user.id)
            return {
                "status": "immediate_revert",
                "effective_at": None,
                "message": "Subscription was already canceled on Stripe; local state synced.",
            }

        # Other statuses (incomplete, unpaid, incomplete_expired) — not cancellable.
        raise HTTPException(
            409,
            f"Subscription is in state '{status}'. Please contact support.",
        )

    # Branch F: sub_id present but malformed (not sub_*, not pending).
    if sub_id:
        logger.warning(
            "Malformed stripe_subscription_id for user %s: %r", user.id, sub_id
        )
        raise HTTPException(
            409,
            "Subscription record is malformed. Please contact support.",
        )

    # No sub_id. Branch C vs B split on presence of customer_id.
    customer_id = user.stripe_customer_id
    if customer_id:
        try:
            candidates = [
                s for s in await _list_customer_subscriptions(customer_id)
                if s.get("status") in _CANCELLABLE_SUBSCRIPTION_STATUSES
            ]
        except stripe.StripeError as e:
            logger.error("Stripe list failed for cancel Branch C user %s: %s", user.id, e)
            raise HTTPException(502, "Stripe temporarily unavailable, please try again")

        if len(candidates) > 1:
            logger.warning(
                "Cancel Branch C ambiguous for user %s: %d cancellable subs",
                user.id,
                len(candidates),
            )
            raise HTTPException(
                409,
                "Multiple subscriptions found. Please contact support.",
            )

        if len(candidates) == 1:
            # Auto-heal: populate stripe_subscription_id, then act as Branch A.
            healed = candidates[0]
            healed_id = healed["id"]
            locked = (
                await db.execute(
                    select(User).where(User.id == user.id).with_for_update(of=User)
                )
            ).scalar_one()
            locked.stripe_subscription_id = healed_id
            await db.commit()
            logger.info(
                "Cancel Branch C auto-healed user %s with sub %s", user.id, healed_id
            )
            try:
                updated = await asyncio.to_thread(
                    stripe.Subscription.modify,
                    healed_id,
                    cancel_at_period_end=True,
                )
            except stripe.StripeError as e:
                logger.error("Stripe modify failed after auto-heal user %s: %s", user.id, e)
                raise HTTPException(502, "Stripe temporarily unavailable, please try again")

            effective_at = _iso(updated.get("current_period_end"))
            _audit_plan_transition(
                db,
                user_id=user.id,
                from_plan=current_plan,
                to_plan=current_plan,
                source="self_serve_cancel",
                metadata={
                    "sub_id": healed_id,
                    "status_at_cancel": healed.get("status"),
                    "cancel_at_period_end": True,
                    "effective_at": effective_at,
                    "reason": "branch_c_auto_heal",
                },
            )
            await db.commit()
            await _invalidate_user_caches(user.id)
            return {
                "status": "scheduled_cancel",
                "effective_at": effective_at,
                "message": "Subscription will end at the current period end.",
            }

        # len(candidates) == 0 → fall through to Branch B.

    # Branch B: admin-promoted (or orphaned) — no Stripe linkage, revert locally.
    # Concurrency note: the `customer.subscription.deleted` webhook handler
    # also sets plan='free' + nulls stripe_subscription_id. Both paths are
    # idempotent so racing them is safe; the lock-then-recheck below
    # collapses duplicate Branch B requests into a single 400.
    locked = (
        await db.execute(
            select(User).where(User.id == user.id).with_for_update(of=User)
        )
    ).scalar_one()
    # Re-check under lock (Branch D repeat).
    if locked.plan == "free":
        raise HTTPException(400, "Already on the Free plan")
    from_plan_locked = locked.plan
    locked.plan = "free"
    locked.stripe_subscription_id = None
    locked.monthly_credits_granted_at = None
    _audit_plan_transition(
        db,
        user_id=locked.id,
        from_plan=from_plan_locked,
        to_plan="free",
        source="self_serve_cancel",
        metadata={
            "reason": "admin_promoted_revert",
            "had_customer_id": bool(customer_id),
        },
    )
    await db.commit()
    await _invalidate_user_caches(user.id)
    logger.info("Self-serve immediate revert to free for user %s", user.id)
    return {
        "status": "immediate_revert",
        "effective_at": None,
        "message": "You are now on the Free plan. Your existing credits are kept.",
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
    await _invalidate_user_caches(user.id)
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

    billing_reason = invoice.get("billing_reason")
    should_grant_allowance = billing_reason in _ALLOWANCE_INVOICE_REASONS
    if not should_grant_allowance:
        logger.info(
            "Skipping monthly allowance grant for invoice %s with billing_reason=%s",
            invoice_id,
            billing_reason,
        )

    allowance = _credits_for_plan(plan) if should_grant_allowance else 0

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
        await _invalidate_user_caches(user.id)
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

    deleted_subscription_id = subscription.get("id")
    if (
        deleted_subscription_id
        and user.stripe_subscription_id
        and deleted_subscription_id != user.stripe_subscription_id
    ):
        logger.info(
            "Ignoring stale subscription.deleted webhook for user %s: deleted=%s current=%s",
            user.id,
            deleted_subscription_id,
            user.stripe_subscription_id,
        )
        return {"received": True}

    active_sub = await _get_customer_active_subscription(customer_id)
    if active_sub and active_sub.get("id") != deleted_subscription_id:
        active_sub_id = active_sub.get("id")
        detected_plan = _plan_from_price_id(
            active_sub.get("items", {}).get("data", [{}])[0].get("price", {}).get("id", "")
        )
        if active_sub_id and user.stripe_subscription_id != active_sub_id:
            user.stripe_subscription_id = active_sub_id
        if detected_plan:
            user.plan = detected_plan
        await db.commit()
        await _invalidate_user_caches(user.id)
        logger.info(
            "Ignored subscription.deleted for user %s because active subscription %s still exists",
            user.id,
            active_sub_id,
        )
        return {"received": True}

    if user.plan == "free" and not user.stripe_subscription_id:
        return {"received": True}

    was_already_free = user.plan == "free"
    user.plan = "free"
    user.stripe_subscription_id = None
    if not was_already_free:
        user.monthly_credits_granted_at = None
    await db.commit()
    await _invalidate_user_caches(user.id)
    return {"received": True}


async def _handle_checkout_session_expired(
    session: dict,
    db: AsyncSession,
):
    try:
        client_ref = session.get("client_reference_id")
        if not client_ref:
            return {"received": True}
        user_id = uuid.UUID(client_ref)
    except (ValueError, TypeError):
        return {"received": True}

    user = await db.get(User, user_id)
    if not user or user.stripe_subscription_id != "pending":
        return {"received": True}

    active_sub = await _get_customer_active_subscription(user.stripe_customer_id)
    if active_sub:
        user.stripe_subscription_id = active_sub.get("id")
        await db.commit()
        await _invalidate_user_caches(user.id)
        return {"received": True}

    user.stripe_subscription_id = None
    await db.commit()
    await _invalidate_user_caches(user.id)
    logger.info("Cleared pending subscription after checkout.session.expired for user %s", user.id)
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
        await _invalidate_user_caches(user.id)
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
        "checkout.session.expired": _handle_checkout_session_expired,
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
