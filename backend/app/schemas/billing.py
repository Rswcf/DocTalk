from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel


class BillingProduct(BaseModel):
    id: str
    credits: int
    price_usd: float


class BillingProductsResponse(BaseModel):
    products: list[BillingProduct]


class CheckoutUrlResponse(BaseModel):
    checkout_url: str


class PortalUrlResponse(BaseModel):
    portal_url: str


class ChangePlanResponse(BaseModel):
    status: str
    new_plan: str
    effective: str
    credits_supplemented: int


class CancelSubscriptionResponse(BaseModel):
    status: Literal["scheduled_cancel", "immediate_revert"]
    effective_at: Optional[str] = None
    message: str
