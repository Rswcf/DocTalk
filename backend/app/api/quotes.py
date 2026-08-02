"""Quote Finder APIs: billed quote-search (B4) and per-user biblio (B6)."""
from __future__ import annotations

import asyncio
import json
import logging
import uuid
from typing import Any, Optional

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

# FIX-6 (Codex r1 IMPORTANT #6): the discarded list is unbounded (one entry
# per LLM proposal that failed verification) — cap what lands in telemetry
# metadata so a pathological/adversarial LLM response can't bloat a
# ProductEvent row; discarded_count above always reflects the true total.
_MAX_TELEMETRY_DISCARDED = 20


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


async def _refund_predebit(db: AsyncSession, user_id: uuid.UUID, pre_debited: int, ledger_id: uuid.UUID) -> bool:
    """Same idempotent, RACE-FREE refund idea as chat_service._refund_predebit,
    NOT a byte-for-byte mirror: that version does its own
    `try: await db.rollback() except: pass` internally before the delete.
    This one does not — callers roll back their OWN session themselves
    first when needed (MINOR-4, review round 1 correction).

    FIX3-A(c) (Codex r3 #4, NOT ADDRESSED): the delete is conditional on
    reconciled_at IS NULL — a SINGLE atomic statement that both checks and
    acts. See chat_service._refund_predebit's docstring for the full
    race-closure reasoning (identical here). Returns True if a refund was
    actually issued, False if the row was already reconciled or already
    removed by a prior settlement.
    """
    result = await db.execute(
        sa.delete(CreditLedger)
        .where(CreditLedger.id == ledger_id)
        .where(CreditLedger.reconciled_at.is_(None))
        .returning(CreditLedger.id)
    )
    refunded = result.scalar_one_or_none() is not None
    if refunded:
        await db.execute(
            sa.update(User).where(User.id == user_id)
            .values(credits_balance=User.credits_balance + pre_debited)
        )
    else:
        logger.info(
            "quote_billing.already_settled: ledger %s not refunded (already "
            "reconciled or previously removed)", ledger_id,
        )
    await db.commit()
    return refunded


async def _settle_quote_search_predebit_after_failure(
    *,
    user_id: uuid.UUID,
    pre_debited: int,
    ledger_id: uuid.UUID,
    use_independent_session: bool,
    db: Optional[AsyncSession] = None,
) -> bool:
    """FIX3-A (Codex r3 #4, NOT ADDRESSED): the SOLE settlement resolver for
    this endpoint's failure paths — CancelledError OR an ordinary exception
    (e.g. db.commit() itself raising after the COMMIT actually landed on
    the wire) — replacing FIX2-B(c)'s UsageRecord-marker existence check.

    That marker check is superseded by FIX3-A(b)/(c)'s durable ledger
    state: reconcile_credits() now ALWAYS stamps reconciled_at (including
    the equal-cost no-op path) under a row lock, and _refund_predebit's
    DELETE is now conditional on reconciled_at IS NULL — correct
    regardless of whether the atomic commit has landed, is still landing,
    or never will. There is nothing left for THIS function to "decide" —
    it just calls _refund_predebit with the right session and surfaces
    whether a refund actually happened.

    use_independent_session=True (CancelledError): the request's own `db`
    session may not be usable mid-cancellation — settle via a fresh
    AsyncSessionLocal(), shielded from the cancellation being handled.
    use_independent_session=False (ordinary exception): reuses the
    request's own `db` (rolled back first by the caller) — matches the
    existing pattern for non-cancellation failures.
    """
    if use_independent_session:
        async with AsyncSessionLocal() as settle_db:
            return await _refund_predebit(settle_db, user_id, pre_debited, ledger_id)
    assert db is not None
    return await _refund_predebit(db, user_id, pre_debited, ledger_id)


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
    # Client-generated (not server_default) — no billing-correctness
    # significance since FIX3-A (settlement now resolves via
    # credit_ledger.reconciled_at, not a marker-row existence check), kept
    # simply as a normal id assignment for the UsageRecord below.
    usage_record_id = uuid.uuid4()
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
        # FIX2-B(b) (Codex r2 #4, NOT ADDRESSED): capture the resulting
        # balance HERE, inside the guarded try — never a separate
        # get_user_credits() call after this block. That extra query was a
        # second failure point AFTER money had already correctly moved and
        # the work was committed: a reconcile-and-commit success followed by
        # a balance-read failure produced a raw 500 with zero refund
        # (correctly — nothing was wrong with the charge) but also zero
        # result delivered to the client.
        remaining_credits = await credit_service.reconcile_credits(
            db, user.id, ledger_id, QUOTE_SEARCH_PREDEBIT_CREDITS, actual_cost
        )

        db.add(
            UsageRecord(
                id=usage_record_id,
                user_id=user.id,
                message_id=None,
                model=result.model,
                prompt_tokens=prompt_tokens,
                completion_tokens=completion_tokens,
                total_tokens=prompt_tokens + completion_tokens,
                cost_credits=actual_cost,
            )
        )
        discarded_sample = [
            {"reason": reason, "tier": tier, "score": score}
            for reason, tier, score in result.discarded[:_MAX_TELEMETRY_DISCARDED]
        ]
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
                    # FIX-6 (Codex r1 IMPORTANT #6): §8.3's locked telemetry
                    # contract — retrieved_count/candidate_pages/no_result,
                    # plus a capped discarded(reason,tier,score) sample
                    # (discarded_truncated notes when the cap was hit; the
                    # true total is always discarded_count above).
                    "discarded": discarded_sample,
                    "discarded_truncated": len(result.discarded) > _MAX_TELEMETRY_DISCARDED,
                    "scanned_chunks": result.scanned_chunks,
                    "retrieved_count": result.retrieved_count,
                    "candidate_pages": result.candidate_pages,
                    "no_result": result.no_result,
                    "cards_count": len(result.cards),
                },
            )
        )
        await db.commit()
    except asyncio.CancelledError:
        # FIX3-A(d) (Codex r3 #4, NOT ADDRESSED): the request's own `db`
        # session may not be usable mid-cancellation — settle via an
        # independent, shielded session (never reuse `db` here). Resolution
        # is now the durable reconciled_at marker + atomic conditional
        # refund (FIX3-A(b)/(c)) — correct regardless of whether the final
        # atomic commit (reconcile + usage + telemetry) has landed, is
        # still landing, or never will. Resolver failure is NOT swallowed
        # into a blind fallback — it's logged as unresolved for ops.
        try:
            with anyio.CancelScope(shield=True):
                await asyncio.wait_for(
                    _settle_quote_search_predebit_after_failure(
                        user_id=user.id, pre_debited=QUOTE_SEARCH_PREDEBIT_CREDITS,
                        ledger_id=ledger_id, use_independent_session=True,
                    ),
                    timeout=_CANCEL_REFUND_TIMEOUT_S,
                )
        except Exception:
            logger.error(
                "quote_billing.unresolved user=%s ledger=%s pre_debited=%s: settlement "
                "resolver failed during cancellation — predebit left standing, requires "
                "manual review.",
                user.id, ledger_id, QUOTE_SEARCH_PREDEBIT_CREDITS, exc_info=True,
            )
        raise
    except Exception as exc:
        try:
            await db.rollback()
        except Exception:
            pass
        # FIX3-A(d) (Codex r3 #4, NOT ADDRESSED): ALL final-commit
        # exceptions — not just CancelledError — route through the SAME
        # atomic-conditional resolver, closing the "db.commit() itself
        # raises an ordinary exception after the COMMIT actually landed on
        # the wire" window (the old unconditional _refund_predebit call
        # here would have wrongly refunded a delivered, billed search).
        try:
            await _settle_quote_search_predebit_after_failure(
                user_id=user.id, pre_debited=QUOTE_SEARCH_PREDEBIT_CREDITS,
                ledger_id=ledger_id, use_independent_session=False, db=db,
            )
        except Exception:
            logger.error(
                "quote_billing.unresolved user=%s ledger=%s pre_debited=%s: settlement "
                "resolver failed after an ordinary billing exception — predebit left "
                "standing, requires manual review.",
                user.id, ledger_id, QUOTE_SEARCH_PREDEBIT_CREDITS, exc_info=True,
            )
        raise HTTPException(
            status_code=500,
            detail={"error": "QUOTE_SEARCH_FAILED", "message": "Quote search failed"},
        ) from exc

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
    # FIX-9 (Codex r1 MINOR #9): was `Field(default_factory=dict)` — a
    # missing csl_json silently became {} and overwrote the caller's row
    # with an empty biblio. Required (422 when absent) so a client bug/typo
    # can never wipe a user's saved metadata.
    csl_json: dict[str, Any] = Field(...)


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
