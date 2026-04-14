from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel


class ConnectedAccountResponse(BaseModel):
    provider: str
    created_at: Optional[str] = None


class UserProfileStatsResponse(BaseModel):
    total_documents: int
    total_sessions: int
    total_messages: int
    total_credits_spent: int
    total_tokens_used: int


class BillingStateResponse(BaseModel):
    """Billing capability snapshot; source of truth for UI rendering decisions.
    Stripe-derived fields come via a 60s Redis cache (see `get_profile`).
    """
    managed_by: Literal["stripe", "admin", "none"]
    can_cancel: bool
    interval: Optional[Literal["month", "year"]] = None
    period_end: Optional[str] = None          # ISO-8601 UTC
    cancel_at_period_end: bool = False
    status: Literal[
        "active", "trialing", "past_due", "canceled", "pending", "none"
    ] = "none"


class UserProfileResponse(BaseModel):
    id: str
    email: str
    name: Optional[str] = None
    image: Optional[str] = None
    created_at: Optional[str] = None
    plan: str
    credits_balance: int
    monthly_allowance: int
    monthly_credits_granted_at: Optional[str] = None
    signup_bonus_granted: bool
    connected_accounts: list[ConnectedAccountResponse]
    stats: UserProfileStatsResponse
    billing_state: BillingStateResponse


class UsageByModeResponse(BaseModel):
    mode: str
    total_calls: int
    total_credits: int
    avg_credits_per_chat: int
    share: float


class UsageBreakdownResponse(BaseModel):
    by_mode: list[UsageByModeResponse]
