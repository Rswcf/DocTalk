"""Session sharing API — create, view, revoke shareable links."""

from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone
from typing import Literal
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel, Field, ValidationError
from sqlalchemy import delete, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.chat import verify_session_access
from app.core.config import settings
from app.core.deps import get_db_session, require_auth
from app.core.rate_limit import get_client_ip, shared_view_limiter
from app.core.security_log import log_security_event
from app.models.tables import (
    AnswerShare,
    ChatSession,
    Document,
    Message,
    SharedSession,
    User,
)
from app.services.export_service import _prepare_export
from app.services.share_anchor_service import message_share_anchor

router = APIRouter(tags=["sharing"])

SHARE_NOT_FOUND_DETAIL = {
    "error": "SHARE_NOT_FOUND",
    "message": "Share not found",
}


class ShareResponse(BaseModel):
    share_token: str
    url: str
    expires_at: str | None = None


class SharedSessionView(BaseModel):
    scope: Literal["answer", "conversation"] = "conversation"
    session_title: str
    document_name: str
    created_at: str
    messages: list[dict]


class PublicAnswerCitation(BaseModel):
    ref_index: int = Field(gt=0)
    page: int | None = None
    page_end: int | None = None
    text_snippet: str = ""
    document_filename: str = ""


class PublicAnswer(BaseModel):
    id: str = Field(pattern=r"^msg-[a-f0-9]{16}$")
    role: Literal["assistant"] = "assistant"
    content: str
    citations: list[PublicAnswerCitation] = Field(default_factory=list)


class AnswerSnapshot(BaseModel):
    scope: Literal["answer"] = "answer"
    # The conversation title comes from an unselected question. Never share it.
    session_title: Literal["Shared answer"] = "Shared answer"
    document_name: str
    created_at: str
    messages: list[PublicAnswer] = Field(min_length=1, max_length=1)


class AnswerShareCreateRequest(BaseModel):
    snapshot_digest: str = Field(pattern=r"^[a-f0-9]{64}$")


def _answer_snapshot(session, message) -> tuple[dict, str]:
    prepared, citations = _prepare_export([message])
    safe_citations = [
        PublicAnswerCitation(
            ref_index=c["ref_index"],
            page=c.get("page") if type(c.get("page")) is int else None,
            page_end=c.get("page_end") if type(c.get("page_end")) is int else None,
            text_snippet=c.get("text_snippet")
            if isinstance(c.get("text_snippet"), str)
            else "",
            document_filename=c.get("document_filename")
            if isinstance(c.get("document_filename"), str)
            else "",
        )
        for c in citations
    ]
    snapshot = AnswerSnapshot(
        document_name=(session.document.filename or "document")
        if session.document
        else "Sources",
        created_at=message.created_at.isoformat(),
        messages=[
            PublicAnswer(
                id=message_share_anchor(message.id),
                content=prepared[0][1],
                citations=safe_citations,
            )
        ],
    ).model_dump()
    digest = hashlib.sha256(
        json.dumps(snapshot, sort_keys=True, ensure_ascii=False).encode()
    ).hexdigest()
    return snapshot, digest


def _active(model, now):
    return model.expires_at.is_(None) | (model.expires_at > now)


async def _lock_share_user(user_id: UUID, db: AsyncSession) -> User:
    # Both link types serialize on this mutex. No document lock or document
    # writes may follow it (document deletion may await user credit settlement).
    user = await db.scalar(
        select(User)
        .where(User.id == user_id)
        .with_for_update(
            of=User,
            key_share=True,
        )
        .execution_options(populate_existing=True)
    )
    if not user:
        raise HTTPException(404, detail=SHARE_NOT_FOUND_DETAIL)
    return user


async def _check_share_limit(user: User, db: AsyncSession) -> None:
    if user.plan in ("plus", "pro"):
        return
    now = datetime.now(timezone.utc)
    active = 0
    for model in (SharedSession, AnswerShare):
        active += (
            await db.scalar(
                select(func.count())
                .select_from(model)
                .where(
                    model.user_id == user.id,
                    _active(model, now),
                )
            )
            or 0
        )
    if active >= 3:
        raise HTTPException(
            403,
            detail={
                "error": "SHARE_LIMIT_REACHED",
                "message": "Free plan limited to 3 active share links. Upgrade to Plus for unlimited.",
                "limit": 3,
                "plan": (user.plan or "free").lower(),
            },
        )


def _share_response(share) -> ShareResponse:
    return ShareResponse(
        share_token=str(share.share_token),
        url=f"{settings.FRONTEND_URL}/shared/{share.share_token}",
        expires_at=share.expires_at.isoformat() if share.expires_at else None,
    )


async def _owned_answer(session_id, message_id, user, db):
    session = await verify_session_access(session_id, user, db)
    if not session or session.user_id != user.id:
        raise HTTPException(404, detail=SHARE_NOT_FOUND_DETAIL)
    message = await db.scalar(
        select(Message)
        .where(
            Message.id == message_id,
            Message.session_id == session_id,
            Message.role == "assistant",
        )
        .execution_options(populate_existing=True)
    )
    if not message:
        raise HTTPException(404, detail=SHARE_NOT_FOUND_DETAIL)
    return session, message


@router.get("/api/sessions/{session_id}/answers/{message_id}/share")
async def answer_share_state(
    session_id: UUID,
    message_id: UUID,
    response: Response,
    user: User = Depends(require_auth),
    db: AsyncSession = Depends(get_db_session),
):
    response.headers["Cache-Control"] = "no-store"
    session, message = await _owned_answer(session_id, message_id, user, db)
    snapshot, digest = _answer_snapshot(session, message)
    count = (
        await db.scalar(
            select(func.count())
            .select_from(AnswerShare)
            .where(
                AnswerShare.user_id == user.id,
                AnswerShare.message_id == message_id,
                _active(AnswerShare, datetime.now(timezone.utc)),
            )
        )
        or 0
    )
    return {"active_count": count, "preview": snapshot, "snapshot_digest": digest}


@router.post(
    "/api/sessions/{session_id}/answers/{message_id}/share",
    response_model=ShareResponse,
)
async def create_answer_share(
    session_id: UUID,
    message_id: UUID,
    body: AnswerShareCreateRequest,
    user: User = Depends(require_auth),
    db: AsyncSession = Depends(get_db_session),
):
    session, message = await _owned_answer(session_id, message_id, user, db)
    snapshot, digest = _answer_snapshot(session, message)
    if body.snapshot_digest != digest:
        raise HTTPException(
            409,
            detail={
                "error": "SHARE_CHANGED",
                "message": "Answer changed. Reload the preview before sharing.",
            },
        )
    user = await _lock_share_user(user.id, db)
    share = await db.scalar(
        select(AnswerShare).where(
            AnswerShare.user_id == user.id,
            AnswerShare.message_id == message_id,
            AnswerShare.snapshot_digest == digest,
        )
    )
    if share and (
        share.expires_at is None or share.expires_at > datetime.now(timezone.utc)
    ):
        await db.commit()
        return _share_response(share)
    await _check_share_limit(user, db)
    if share:  # Expired snapshot: rotate the token, never revive an expired URL.
        share.share_token = uuid4()
        share.expires_at = None
    else:
        share = AnswerShare(
            user_id=user.id,
            session_id=session_id,
            message_id=message_id,
            snapshot=snapshot,
            snapshot_digest=digest,
        )
        db.add(share)
    try:
        await db.commit()
        await db.refresh(share)
    except IntegrityError as exc:
        await db.rollback()
        # A deleted parent must not leave an orphan public snapshot behind.
        raise HTTPException(409, detail=SHARE_NOT_FOUND_DETAIL) from exc
    except Exception:
        await db.rollback()
        raise
    return _share_response(share)


@router.delete("/api/sessions/{session_id}/answers/{message_id}/share", status_code=204)
async def revoke_answer_shares(
    session_id: UUID,
    message_id: UUID,
    user: User = Depends(require_auth),
    db: AsyncSession = Depends(get_db_session),
):
    await _owned_answer(session_id, message_id, user, db)
    await _lock_share_user(user.id, db)
    await db.execute(
        delete(AnswerShare).where(
            AnswerShare.user_id == user.id, AnswerShare.message_id == message_id
        )
    )
    await db.commit()


@router.delete("/api/shared/{share_token}", status_code=204)
async def revoke_share_token(
    share_token: UUID,
    user: User = Depends(require_auth),
    db: AsyncSession = Depends(get_db_session),
):
    await _lock_share_user(user.id, db)
    for model in (SharedSession, AnswerShare):
        await db.execute(
            delete(model).where(
                model.user_id == user.id, model.share_token == share_token
            )
        )
    await db.commit()


@router.post("/api/sessions/{session_id}/share", response_model=ShareResponse)
async def create_share(
    session_id: UUID,
    user: User = Depends(require_auth),
    db: AsyncSession = Depends(get_db_session),
):
    # Verify session access
    session = await verify_session_access(session_id, user, db)
    if not session:
        raise HTTPException(status_code=404, detail=SHARE_NOT_FOUND_DETAIL)
    user = await _lock_share_user(user.id, db)

    # Check existing share
    existing = await db.execute(
        select(SharedSession).where(
            SharedSession.session_id == session_id,
            SharedSession.user_id == user.id,
        )
    )
    share = existing.scalar_one_or_none()
    if share:
        await db.commit()
        return _share_response(share)

    await _check_share_limit(user, db)

    # Create share
    share = SharedSession(session_id=session_id, user_id=user.id)
    db.add(share)
    await db.commit()
    await db.refresh(share)

    return ShareResponse(
        share_token=str(share.share_token),
        url=f"{settings.FRONTEND_URL}/shared/{share.share_token}",
    )


@router.delete("/api/sessions/{session_id}/share", status_code=204)
async def revoke_share(
    session_id: UUID,
    user: User = Depends(require_auth),
    db: AsyncSession = Depends(get_db_session),
):
    await _lock_share_user(user.id, db)
    for model in (SharedSession, AnswerShare):
        await db.execute(
            delete(model).where(
                model.session_id == session_id, model.user_id == user.id
            )
        )
    await db.commit()


@router.get("/api/shared/{share_token}", response_model=SharedSessionView)
async def view_shared(
    share_token: UUID,
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db_session),
):
    response.headers["Cache-Control"] = "no-store"
    # Rate limit anonymous public endpoint: 60 req/min per IP. Prevents
    # share-token enumeration and traffic amplification on public URLs.
    client_ip = get_client_ip(request)
    if not await shared_view_limiter.is_allowed(client_ip):
        log_security_event("shared_view_rate_limit", ip=client_ip)
        raise HTTPException(
            status_code=429,
            detail={
                "error": "RATE_LIMITED",
                "message": "Too many requests",
                "retry_after": 60,
            },
            headers={"Retry-After": "60"},
        )

    result = await db.execute(
        select(SharedSession).where(SharedSession.share_token == share_token)
    )
    share = result.scalar_one_or_none()
    answer_share = await db.scalar(
        select(AnswerShare).where(AnswerShare.share_token == share_token)
    )
    if share and answer_share:
        # A collision must never select the broader conversation scope.
        raise HTTPException(status_code=404, detail=SHARE_NOT_FOUND_DETAIL)
    if not share and not answer_share:
        raise HTTPException(status_code=404, detail=SHARE_NOT_FOUND_DETAIL)

    # Check expiry
    selected = answer_share or share
    if selected.expires_at and selected.expires_at <= datetime.now(timezone.utc):
        raise HTTPException(
            status_code=410,
            detail={"error": "SHARE_EXPIRED", "message": "Share link has expired"},
        )

    if answer_share:
        try:
            # Validate again on read: a corrupted snapshot cannot smuggle private
            # fields or additional messages through the public response model.
            return SharedSessionView(
                **AnswerSnapshot.model_validate(answer_share.snapshot).model_dump()
            )
        except ValidationError as exc:
            raise HTTPException(404, detail=SHARE_NOT_FOUND_DETAIL) from exc

    # Load session
    session_result = await db.execute(
        select(ChatSession).where(ChatSession.id == share.session_id)
    )
    session = session_result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail=SHARE_NOT_FOUND_DETAIL)

    # Load messages
    rows = await db.execute(
        select(Message)
        .where(Message.session_id == share.session_id)
        .order_by(Message.created_at)
    )
    messages = list(rows.scalars())

    # Build safe response — exclude bboxes, documentId, chunkId, confidence
    safe_messages = []
    for msg in messages:
        safe_msg: dict = {
            "id": message_share_anchor(msg.id),
            "role": msg.role,
            "content": msg.content,
        }
        if msg.citations:
            safe_citations = []
            for c in msg.citations:
                if not isinstance(c, dict):
                    continue
                safe_citations.append(
                    {
                        "text_snippet": c.get("text_snippet", ""),
                        "page": c.get("page"),
                        "document_filename": c.get("document_filename", ""),
                    }
                )
            safe_msg["citations"] = safe_citations
        safe_messages.append(safe_msg)

    doc_name = "document"
    if session.document_id:
        doc_result = await db.execute(
            select(Document.filename).where(Document.id == session.document_id)
        )
        row = doc_result.first()
        if row:
            doc_name = row[0] or doc_name

    return SharedSessionView(
        session_title=session.title or "Untitled Conversation",
        document_name=doc_name,
        created_at=session.created_at.isoformat(),
        messages=safe_messages,
    )
