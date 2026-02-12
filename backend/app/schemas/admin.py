from __future__ import annotations

from pydantic import BaseModel


class AdminOverviewResponse(BaseModel):
    total_users: int
    paid_users: int
    plus_users: int
    pro_users: int
    total_documents: int
    total_sessions: int
    total_messages: int
    total_tokens: int
    total_credits_spent: int
    total_credits_granted: int


class AdminTrendCountPoint(BaseModel):
    date: str
    count: int


class AdminTrendTokensPoint(BaseModel):
    date: str
    total_tokens: int


class AdminTrendAmountPoint(BaseModel):
    date: str
    amount: int


class AdminTrendsResponse(BaseModel):
    signups: list[AdminTrendCountPoint]
    documents: list[AdminTrendCountPoint]
    tokens: list[AdminTrendTokensPoint]
    credits_spent: list[AdminTrendAmountPoint]
    active_users: list[AdminTrendCountPoint]


class AdminPlanDistributionItem(BaseModel):
    plan: str
    count: int


class AdminModelUsageItem(BaseModel):
    model: str
    calls: int
    tokens: int
    credits: int


class AdminFileTypeItem(BaseModel):
    file_type: str
    count: int


class AdminDocStatusItem(BaseModel):
    status: str
    count: int


class AdminBreakdownsResponse(BaseModel):
    plan_distribution: list[AdminPlanDistributionItem]
    model_usage: list[AdminModelUsageItem]
    file_types: list[AdminFileTypeItem]
    doc_status: list[AdminDocStatusItem]


class AdminRecentUserItem(BaseModel):
    id: str
    email: str
    name: str | None = None
    plan: str
    credits_balance: int
    created_at: str | None = None
    doc_count: int
    message_count: int


class AdminRecentUsersResponse(BaseModel):
    users: list[AdminRecentUserItem]


class AdminTopUserItem(BaseModel):
    id: str
    email: str
    name: str | None = None
    plan: str
    total_tokens: int
    total_credits: int
    doc_count: int


class AdminTopUsersResponse(BaseModel):
    users: list[AdminTopUserItem]
