from __future__ import annotations

from typing import Optional

from pydantic import BaseModel


class ReleaseInfo(BaseModel):
    version: str
    stage: str
    build: Optional[str] = None


class HealthResponse(BaseModel):
    status: str
    release: ReleaseInfo


class HealthComponentStatus(BaseModel):
    status: str
    detail: Optional[str] = None


class HealthDeepResponse(BaseModel):
    status: str
    release: ReleaseInfo
    components: dict[str, HealthComponentStatus]


class StatusResponse(BaseModel):
    status: str


class ReceivedResponse(BaseModel):
    received: bool


class DeletedResponse(BaseModel):
    deleted: bool
