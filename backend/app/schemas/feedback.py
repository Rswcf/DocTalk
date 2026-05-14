from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

FeedbackType = Literal[
    "feature_request",
    "bug",
    "answer_quality",
    "citation_problem",
    "billing_pricing",
    "usability",
    "other",
]

FeedbackArea = Literal[
    "upload_parse",
    "chat_answer",
    "citation_jump",
    "collections",
    "export",
    "billing",
    "account",
    "performance",
    "mobile",
    "localization",
]

FeedbackSeverity = Literal["low", "medium", "high", "blocking"]


class FeedbackRequest(BaseModel):
    type: FeedbackType
    area: FeedbackArea
    severity: FeedbackSeverity = "medium"
    selected_options: list[str] = Field(default_factory=list, max_length=12)
    message: str | None = Field(default=None, max_length=2000)
    path: str | None = Field(default=None, max_length=256)
    locale: str | None = Field(default=None, max_length=16)
    plan: str | None = Field(default=None, max_length=16)


class FeedbackResponse(BaseModel):
    id: str
    status: Literal["received"] = "received"
