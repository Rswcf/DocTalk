from __future__ import annotations

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
