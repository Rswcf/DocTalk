from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db_session, require_auth
from app.models.tables import ProductEvent, User

router = APIRouter(prefix="/api/events", tags=["events"])

ALLOWED_EVENTS = {
    "billing_view",
    "upgrade_click",
    "checkout_created",
    "checkout_completed",
    "limit_hit",
    "document_upload_created",
    "url_ingest_created",
    "chat_message_sent",
    "chat_message_completed",
    "paywall_opened",
}


class ProductEventRequest(BaseModel):
    event_name: str = Field(min_length=1, max_length=64)
    properties: dict[str, Any] = Field(default_factory=dict)


def _safe_text(value: Any, max_len: int = 64) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    if not text:
        return None
    return text[:max_len]


def _safe_properties(raw: dict[str, Any]) -> dict[str, Any]:
    safe: dict[str, Any] = {}
    for key, value in list(raw.items())[:20]:
        safe_key = _safe_text(key, 64)
        if not safe_key:
            continue
        if isinstance(value, (str, int, float, bool)) or value is None:
            safe[safe_key] = value if not isinstance(value, str) else value[:256]
        else:
            safe[safe_key] = str(value)[:256]
    return safe


@router.post("", status_code=204)
async def record_product_event(
    body: ProductEventRequest,
    user: User = Depends(require_auth),
    db: AsyncSession = Depends(get_db_session),
):
    if body.event_name not in ALLOWED_EVENTS:
        raise HTTPException(status_code=400, detail="Unsupported event")

    properties = _safe_properties(body.properties)
    event = ProductEvent(
        user_id=user.id,
        event_name=body.event_name,
        source=_safe_text(properties.get("source")),
        reason=_safe_text(properties.get("reason")),
        plan=_safe_text(properties.get("plan"), 16),
        billing=_safe_text(properties.get("period") or properties.get("billing"), 16),
        metadata_json=properties,
    )
    db.add(event)
    await db.commit()
    return Response(status_code=204)
