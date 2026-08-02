"""Quote Finder APIs: billed quote-search (B4) and per-user biblio (B6)."""
from __future__ import annotations

import asyncio
import json
import logging
import uuid
from typing import Any

import anyio
import sqlalchemy as sa
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db_session, require_auth
from app.core.rate_limit import auth_chat_limiter
from app.models.database import AsyncSessionLocal
from app.models.tables import CreditLedger, Document, ProductEvent, UsageRecord, User
from app.services import biblio_service, credit_service, quote_search_service
from app.services.doc_service import can_access_document

logger = logging.getLogger(__name__)

# Bounds the shielded cancel-path refund below (mirrors chat_service.py's
# _CANCEL_IO_TIMEOUT_S) — without a timeout a DB blip during a client
# disconnect could pin a task on asyncpg's default connect timeout.
_CANCEL_REFUND_TIMEOUT_S = 5.0

router = APIRouter(prefix="/api", tags=["quotes"])

# Same shape as chat's balanced-mode estimate (extraction_service.EXTRACTION_PREDEBIT_CREDITS
# precedent) — one LLM call over retrieved context, same cost class as a chat turn.
QUOTE_SEARCH_PREDEBIT_CREDITS = 15


class QuoteSearchRequest(BaseModel):
    topic: str = Field(..., min_length=1, max_length=300)
    locale: str | None = Field(None, max_length=16)


class QuoteCardResponse(BaseModel):
    display_text: str
    page: int
    page_end: int
    bboxes: list[dict]
    tier: str
    source_kind: str
    chunk_id: str
    score: float


class QuoteSearchResponse(BaseModel):
    cards: list[QuoteCardResponse]
    proposed: int
    verified: int
    discarded_count: int
    scanned_chunks: int
    remaining_credits: int


async def _verify_document(document_id: uuid.UUID, user: User, db: AsyncSession) -> Document:
    """Access control lives HERE, not in quote_search_service.quote_search().

    B3's quote_search() takes a `user` param it never reads for access
    control — it trusts the caller already resolved and authorized
    `document`. This endpoint is that caller: it MUST call
    can_access_document() itself before ever invoking quote_search(), same
    as every other document-scoped endpoint (extractions.py, documents.py).
    """
    doc = await db.get(Document, document_id)
    if not doc or not can_access_document(doc, user):
        raise HTTPException(
            status_code=404,
            detail={"error": "DOCUMENT_NOT_FOUND", "message": "Document not found"},
        )
    return doc


async def _refund_predebit(db: AsyncSession, user_id: uuid.UUID, pre_debited: int, ledger_id: uuid.UUID) -> None:
    """Same ledger-delete-is-the-source-of-truth idea as
    chat_service._refund_predebit, NOT a byte-for-byte mirror: that version
    does its own `try: await db.rollback() except: pass` internally before
    the delete. This one does not — callers roll back their OWN session
    themselves first when needed (MINOR-4, review round 1 correction)."""
    result = await db.execute(sa.delete(CreditLedger).where(CreditLedger.id == ledger_id))
    if result.rowcount and result.rowcount > 0:
        await db.execute(
            sa.update(User).where(User.id == user_id)
            .values(credits_balance=User.credits_balance + pre_debited)
        )
    await db.commit()


async def _refund_predebit_on_cancel(user_id: uuid.UUID, pre_debited: int, ledger_id: uuid.UUID) -> None:
    """FIX-4 (Codex r1 IMPORTANT #4): CancelledError refund uses an
    INDEPENDENT session, shielded from the very cancellation being handled —
    the request's own `db` session may not be usable in a cancelled task
    (same reasoning as chat_service._settle_predebit_on_cancel). Unlike
    chat, REST has no "answer already delivered" case to preserve: nothing
    is sent to the client until the handler returns, so any failure or
    cancellation after predebit always refunds in full."""
    try:
        with anyio.CancelScope(shield=True):
            async def _do_refund() -> None:
                async with AsyncSessionLocal() as refund_db:
                    await _refund_predebit(refund_db, user_id, pre_debited, ledger_id)

            await asyncio.wait_for(_do_refund(), timeout=_CANCEL_REFUND_TIMEOUT_S)
    except Exception:
        logger.exception(
            "Failed to refund quote-search predebit on cancel for user %s (ledger %s)",
            user_id, ledger_id,
        )


@router.post("/documents/{document_id}/quote-search", response_model=QuoteSearchResponse)
async def create_quote_search(
    document_id: uuid.UUID,
    body: QuoteSearchRequest,
    user: User = Depends(require_auth),
    db: AsyncSession = Depends(get_db_session),
):
    if not await auth_chat_limiter.is_allowed(str(user.id)):
        raise HTTPException(
            status_code=429,
            detail={"error": "RATE_LIMITED", "message": "Rate limit exceeded", "retry_after": 60},
            headers={"Retry-After": "60"},
        )

    doc = await _verify_document(document_id, user, db)
    if doc.status != "ready":
        raise HTTPException(
            status_code=409,
            detail={"error": "DOCUMENT_NOT_READY", "message": "Document is not ready"},
        )

    # Billing (predebit through reconcile/refund below) is entirely OWNED by
    # this endpoint too — quote_search_service.quote_search() does no
    # credit_service calls of its own. It returns .usage/.model precisely so
    # a caller can bill; it never bills itself.
    balance = await credit_service.get_user_credits(db, user.id)
    if balance < QUOTE_SEARCH_PREDEBIT_CREDITS:
        raise HTTPException(
            status_code=402,
            detail={
                "error": "INSUFFICIENT_CREDITS",
                "message": "Insufficient credits to search for quotes",
                "required": QUOTE_SEARCH_PREDEBIT_CREDITS,
                "balance": balance,
            },
        )

    ledger_id = await credit_service.debit_credits(
        db,
        user_id=user.id,
        cost=QUOTE_SEARCH_PREDEBIT_CREDITS,
        reason="quote_search",
        ref_type="document",
        ref_id=str(doc.id),
    )
    if ledger_id is None:
        await db.rollback()
        balance = await credit_service.get_user_credits(db, user.id)
        raise HTTPException(
            status_code=402,
            detail={
                "error": "INSUFFICIENT_CREDITS",
                "message": "Insufficient credits to search for quotes",
                "required": QUOTE_SEARCH_PREDEBIT_CREDITS,
                "balance": balance,
            },
        )
    await db.commit()

    # FIX-4 (Codex r1 IMPORTANT #4): reconcile/usage/telemetry/commit are
    # INSIDE this guarded region too, not just quote_search() — a failure
    # ANYWHERE after predebit (including CancelledError, handled explicitly
    # below) must refund it. The prior version's try/except wrapped only the
    # quote_search() call, leaving a real 15-credit predebit permanently
    # committed if reconcile/commit itself failed.
    try:
        result = await quote_search_service.quote_search(
            db, document=doc, user=user, topic=body.topic, locale=body.locale or ""
        )

        prompt_tokens, completion_tokens = result.usage
        actual_cost = credit_service.calculate_cost(prompt_tokens, completion_tokens, result.model, mode="balanced")
        # §8.4.1: reconcile the SAME ledger row (single row per search) to
        # actual tokens; charge the actual cost even when verified-empty —
        # the LLM call still ran, so a free retry would be a billing hole,
        # not generosity.
        await credit_service.reconcile_credits(db, user.id, ledger_id, QUOTE_SEARCH_PREDEBIT_CREDITS, actual_cost)

        db.add(
            UsageRecord(
                user_id=user.id,
                message_id=None,
                model=result.model,
                prompt_tokens=prompt_tokens,
                completion_tokens=completion_tokens,
                total_tokens=prompt_tokens + completion_tokens,
                cost_credits=actual_cost,
            )
        )
        db.add(
            ProductEvent(
                user_id=user.id,
                event_name="quote_search_completed",
                source="quote_finder",
                reason="quote_search",
                plan=(user.plan or "free").lower(),
                metadata_json={
                    "document_id": str(doc.id),
                    "proposed": result.proposed,
                    "verified": result.verified,
                    "discarded_count": len(result.discarded),
                    "scanned_chunks": result.scanned_chunks,
                    "cards_count": len(result.cards),
                },
            )
        )
        await db.commit()
    except asyncio.CancelledError:
        # The request's own `db` session may not be usable mid-cancellation —
        # refund via an independent, shielded session (never reuse `db` here).
        await _refund_predebit_on_cancel(user.id, QUOTE_SEARCH_PREDEBIT_CREDITS, ledger_id)
        raise
    except Exception as exc:
        try:
            await db.rollback()
        except Exception:
            pass
        await _refund_predebit(db, user.id, QUOTE_SEARCH_PREDEBIT_CREDITS, ledger_id)
        raise HTTPException(
            status_code=500,
            detail={"error": "QUOTE_SEARCH_FAILED", "message": "Quote search failed"},
        ) from exc

    remaining_credits = await credit_service.get_user_credits(db, user.id)

    return QuoteSearchResponse(
        cards=[
            QuoteCardResponse(
                display_text=c.display_text,
                page=c.page,
                page_end=c.page_end,
                bboxes=c.bboxes,
                tier=c.tier,
                source_kind=c.source_kind,
                chunk_id=c.chunk_id,
                score=c.score,
            )
            for c in result.cards
        ],
        proposed=result.proposed,
        verified=result.verified,
        discarded_count=len(result.discarded),
        scanned_chunks=result.scanned_chunks,
        remaining_credits=remaining_credits,
    )


# -------------------------- B6: per-user biblio --------------------------

_MAX_CSL_JSON_CHARS = 20_000  # generous cap against pathological/abusive payloads


class BiblioResponse(BaseModel):
    csl_json: dict[str, Any]
    source: str  # "system" | "user"


class BiblioUpdateRequest(BaseModel):
    csl_json: dict[str, Any] = Field(default_factory=dict)


@router.get("/documents/{document_id}/biblio", response_model=BiblioResponse)
async def get_document_biblio(
    document_id: uuid.UUID,
    user: User = Depends(require_auth),
    db: AsyncSession = Depends(get_db_session),
):
    doc = await _verify_document(document_id, user, db)
    row = await biblio_service.get_biblio_for_user(db, doc, user)
    return BiblioResponse(csl_json=row.csl_json, source=row.source)


@router.put("/documents/{document_id}/biblio", response_model=BiblioResponse)
async def update_document_biblio(
    document_id: uuid.UUID,
    body: BiblioUpdateRequest,
    user: User = Depends(require_auth),
    db: AsyncSession = Depends(get_db_session),
):
    if len(json.dumps(body.csl_json)) > _MAX_CSL_JSON_CHARS:
        raise HTTPException(
            status_code=400,
            detail={"error": "BIBLIO_TOO_LARGE", "message": "Biblio payload is too large"},
        )
    doc = await _verify_document(document_id, user, db)
    # Always writes to the CALLER's own row — never the system row or
    # another user's row (see biblio_service.upsert_user_biblio docstring).
    row = await biblio_service.upsert_user_biblio(db, doc, user, body.csl_json)
    return BiblioResponse(csl_json=row.csl_json, source=row.source)
