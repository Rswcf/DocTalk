from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel, Field


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


class CancelSubscriptionRequest(BaseModel):
    reason: Optional[
        Literal[
            "not_a_fit",
            "answer_quality",
            "pdf_or_parsing",
            "too_expensive",
            "temporary_need",
            "missing_feature",
            "found_alternative",
            "other",
        ]
    ] = None
    feedback: Optional[str] = Field(default=None, max_length=1000)
    refund_requested: bool = False


class CancelSubscriptionResponse(BaseModel):
    status: Literal["scheduled_cancel", "immediate_revert"]
    effective_at: Optional[str] = None
    message: str
    refund_requested: bool = False
