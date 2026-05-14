from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user_optional, get_db_session
from app.core.rate_limit import RedisRateLimiter, get_client_ip
from app.models.tables import ProductEvent, User, UserFeedback
from app.schemas.feedback import FeedbackRequest, FeedbackResponse

router = APIRouter(prefix="/api/feedback", tags=["feedback"])

feedback_limiter = RedisRateLimiter(
    namespace="rate_limit:feedback",
    max_requests=8,
    window_seconds=300,
)


def _clean_text(value: str | None, max_len: int) -> str | None:
    if value is None:
        return None
    text = value.strip()
    return text[:max_len] if text else None


@router.post("", response_model=FeedbackResponse)
async def submit_feedback(
    body: FeedbackRequest,
    request: Request,
    user: User | None = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db_session),
):
    limiter_key = f"user:{user.id}" if user else f"ip:{get_client_ip(request)}"
    if not await feedback_limiter.is_allowed(limiter_key):
        raise HTTPException(status_code=429, detail="Too many feedback submissions")

    path = _clean_text(body.path, 256)
    locale = _clean_text(body.locale, 16)
    plan = _clean_text(user.plan if user else body.plan, 16)
    message = _clean_text(body.message, 2000)
    user_agent = _clean_text(request.headers.get("user-agent"), 256)
    selected_options = {"items": [str(item).strip()[:80] for item in body.selected_options if str(item).strip()]}

    feedback = UserFeedback(
        user_id=user.id if user else None,
        type=body.type,
        area=body.area,
        severity=body.severity,
        selected_options=selected_options,
        message=message,
        path=path,
        locale=locale,
        plan=plan,
        user_agent=user_agent,
    )
    db.add(feedback)
    await db.flush()

    db.add(
        ProductEvent(
            user_id=user.id if user else None,
            event_name="structured_feedback_submitted",
            source="feedback_form",
            reason=body.type,
            plan=plan,
            metadata_json={
                "type": body.type,
                "area": body.area,
                "severity": body.severity,
                "path": path,
                "locale": locale,
                "has_message": bool(message),
                "selected_options_count": len(selected_options["items"]),
            },
        )
    )
    await db.commit()

    return FeedbackResponse(id=str(feedback.id))
