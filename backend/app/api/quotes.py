"""Quote Finder APIs: billed quote-search (B4) and per-user biblio (B6)."""
from __future__ import annotations

import asyncio
import json
import logging
import uuid
from typing import Any, Optional

import anyio
import sqlalchemy as sa
from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db_session, require_auth
from app.core.rate_limit import auth_chat_limiter
from app.models.database import AsyncSessionLocal
from app.models.tables import (
    CreditLedger,
    Document,
    ProductEvent,
    SavedQuote,
    UsageRecord,
    User,
)
from app.services import (
    biblio_service,
    credit_service,
    quote_search_service,
    saved_quotes_service,
)
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
                    # M3 acceptance-gate fix (2026-08-04): how often a card
                    # was emitted via the 2-page "honest range" fallback
                    # instead of a single unambiguous page — measures the
                    # policy reversal's real-world frequency.
                    "page_range_count": result.page_range_count,
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


# -------------------------- M3-B2: saved quotes --------------------------

_MAX_SAVED_QUOTE_TEXT_CHARS = 2000  # generous cap; real cards are display-length excerpts
_MAX_SAVED_QUOTE_NOTE_CHARS = 2000


class SaveQuoteRequest(BaseModel):
    chunk_id: str = Field(..., description="chunk_id from a QuoteCardResponse — identifies WHERE to look")
    quote_text: str = Field(..., min_length=1, max_length=_MAX_SAVED_QUOTE_TEXT_CHARS)
    # Disambiguation hint ONLY — picks which already-independently-verified
    # occurrence to persist when the SAME wording verifies on more than one
    # page (see quote_search_service.verify_saved_quote's docstring). Never
    # trusted for storage or verification on its own.
    page_hint: Optional[int] = None


class SavedQuoteResponse(BaseModel):
    id: str
    document_id: str
    page: int
    page_end: int
    quote_text: str
    bboxes: list[dict]
    tier: str
    score: float
    verifier_version: str
    source_kind: str
    note: Optional[str]
    created_at: str
    updated_at: str


class SavedQuoteBoardResponse(SavedQuoteResponse):
    """FIX-7-backend (Codex M3 r1 LOW): the Evidence Board feed (GET
    /api/quotes, ALL of a user's saved quotes across documents) gains
    document_filename so the frontend stops joining against its own
    document list to resolve a display name — that list is capped (50
    docs) and excludes demo docs, so a saved quote from doc #51 or a demo
    document would otherwise have no way to resolve a filename
    client-side. Populated via list_all_saved_quotes'
    selectinload(SavedQuote.document) — NOT a SQL join: SQLAlchemy issues
    one bounded second SELECT (`WHERE document_id IN (...)`) within the
    same request, not N+1 queries and not a client-side round trip.
    Document-scoped reads (POST/PATCH and the per-document GET) don't need
    this — the frontend already knows which document it's looking at."""
    document_filename: str


class SavedQuoteListResponse(BaseModel):
    quotes: list[SavedQuoteResponse]


class SavedQuoteBoardListResponse(BaseModel):
    quotes: list[SavedQuoteBoardResponse]


class UpdateSavedQuoteNoteRequest(BaseModel):
    note: Optional[str] = Field(None, max_length=_MAX_SAVED_QUOTE_NOTE_CHARS)


def _saved_quote_response(row: SavedQuote) -> SavedQuoteResponse:
    return SavedQuoteResponse(
        id=str(row.id),
        document_id=str(row.document_id),
        page=row.page,
        page_end=row.page_end,
        quote_text=row.quote_text,
        bboxes=row.bboxes or [],
        tier=row.verification_tier,
        score=row.verification_score,
        verifier_version=row.verifier_version,
        source_kind=row.source_kind,
        note=row.note,
        created_at=row.created_at.isoformat(),
        updated_at=row.updated_at.isoformat(),
    )


def _saved_quote_board_response(row: SavedQuote) -> SavedQuoteBoardResponse:
    return SavedQuoteBoardResponse(
        id=str(row.id),
        document_id=str(row.document_id),
        document_filename=row.document.filename if row.document else "",
        page=row.page,
        page_end=row.page_end,
        quote_text=row.quote_text,
        bboxes=row.bboxes or [],
        tier=row.verification_tier,
        score=row.verification_score,
        verifier_version=row.verifier_version,
        source_kind=row.source_kind,
        note=row.note,
        created_at=row.created_at.isoformat(),
        updated_at=row.updated_at.isoformat(),
    )


@router.post("/documents/{document_id}/quotes", response_model=SavedQuoteResponse, status_code=201)
async def create_saved_quote(
    document_id: uuid.UUID,
    body: SaveQuoteRequest,
    response: Response,
    user: User = Depends(require_auth),
    db: AsyncSession = Depends(get_db_session),
):
    """Save a quote card. `chunk_id`/`quote_text` (+ optional `page_hint`)
    identify WHAT to save — every trust field actually persisted (tier,
    score, page, page_end, bboxes, source_kind) is RE-DERIVED server-side
    via quote_search_service.verify_saved_quote(), never taken from the
    request body. A client cannot forge a "verified" card by supplying
    arbitrary tier/score/page values directly; see that function's
    docstring for the full rationale."""
    doc = await _verify_document(document_id, user, db)

    try:
        chunk_id = uuid.UUID(body.chunk_id)
    except ValueError:
        raise HTTPException(
            status_code=422,
            detail={"error": "INVALID_CHUNK_ID", "message": "chunk_id must be a UUID"},
        )

    card = await quote_search_service.verify_saved_quote(
        db, document=doc, chunk_id=chunk_id, quote_text=body.quote_text, page_hint=body.page_hint,
    )
    if card is None:
        raise HTTPException(
            status_code=422,
            detail={
                "error": "QUOTE_NOT_VERIFIABLE",
                "message": "This quote could not be independently verified against the document",
            },
        )

    # FIX-1 (Codex M3 r1 HIGH — cap race): the idempotency check AND the
    # cap check now run INSIDE save_quote()'s own serialized critical
    # section (a Postgres advisory lock keyed by user_id) — see its
    # docstring. This endpoint used to run both checks itself, OUTSIDE any
    # lock, before ever calling save_quote(): at limit-1 rows, two
    # concurrent DISTINCT saves both read "count < limit" and both
    # committed, overshooting the cap (reproduced directly: 3 concurrent
    # saves at 29/30 all succeeded, final count 32). Nothing left to check
    # here — one call now does the check-and-insert atomically.
    outcome = await saved_quotes_service.save_quote(db, user=user, document=doc, card=card)

    if outcome.limit_reached:
        limit = saved_quotes_service.saved_quotes_limit_for_plan(user.plan)
        db.add(
            ProductEvent(
                user_id=user.id,
                event_name="quote_save_limit_hit",
                source="quote_finder",
                reason="saved_quotes_limit",
                plan=(user.plan or "free").lower(),
                metadata_json={
                    "limit": limit, "current": outcome.active_count, "document_id": str(doc.id),
                },
            )
        )
        await db.commit()
        raise HTTPException(
            status_code=403,
            detail={
                "error": "SAVED_QUOTES_LIMIT_REACHED",
                "message": "Saved quote limit reached for current plan",
                "limit": limit,
                "plan": (user.plan or "free").lower(),
            },
        )

    row = outcome.row
    if outcome.created:
        db.add(
            ProductEvent(
                user_id=user.id,
                event_name="quote_saved",
                source="quote_finder",
                reason="quote_saved",
                plan=(user.plan or "free").lower(),
                metadata_json={
                    "document_id": str(doc.id),
                    "tier": row.verification_tier,
                    "source_kind": row.source_kind,
                },
            )
        )
        await db.commit()
    else:
        # Contract fix (live E2E finding, 2026-08-03): the plan says
        # "Idempotent save returns the existing row (200 not 409)" — the
        # decorator's status_code=201 default is for a genuinely NEW row
        # only; overriding here via the injected Response is the FastAPI
        # idiom for a per-request status code that still keeps a typed
        # response_model (no JSONResponse needed).
        response.status_code = 200

    return _saved_quote_response(row)


@router.get("/documents/{document_id}/quotes", response_model=SavedQuoteListResponse)
async def list_document_saved_quotes(
    document_id: uuid.UUID,
    user: User = Depends(require_auth),
    db: AsyncSession = Depends(get_db_session),
):
    """M3-B3 (plan §8.1/§8.5): returns each row's STORED trust snapshot
    (verification_tier/verification_score/verifier_version/source_kind,
    taken at save time) as-is — this path never calls verify_quote,
    verify_saved_quote, or quote_search again. That is what lets a saved
    quote survive a reparse: the row's display fields are independent of
    whatever chunks/pages happen to exist right now (source_chunk_id may
    even be NULL, per SavedQuote's ON DELETE SET NULL — see
    test_saved_quotes_integration.py's
    test_reparse_style_chunk_deletion_leaves_the_saved_row_intact)."""
    doc = await _verify_document(document_id, user, db)
    rows = await saved_quotes_service.list_saved_quotes_for_document(
        db, user_id=user.id, document_id=doc.id,
    )
    return SavedQuoteListResponse(quotes=[_saved_quote_response(r) for r in rows])


@router.get("/quotes", response_model=SavedQuoteBoardListResponse)
async def list_saved_quotes(
    user: User = Depends(require_auth),
    db: AsyncSession = Depends(get_db_session),
):
    """The Evidence Board feed — every saved quote for this user, across
    every document, newest first. M3-B3: same stored-snapshot contract as
    list_document_saved_quotes above — never re-verifies. FIX-7-backend
    (Codex M3 r1 LOW): response rows carry document_filename, populated by
    list_all_saved_quotes' eager-loaded query (one bounded second SELECT,
    not a SQL join) — see SavedQuoteBoardResponse's docstring for why the
    board feed specifically needs this."""
    rows = await saved_quotes_service.list_all_saved_quotes(db, user_id=user.id)
    return SavedQuoteBoardListResponse(quotes=[_saved_quote_board_response(r) for r in rows])


@router.patch("/quotes/{saved_quote_id}", response_model=SavedQuoteResponse)
async def update_saved_quote(
    saved_quote_id: uuid.UUID,
    body: UpdateSavedQuoteNoteRequest,
    user: User = Depends(require_auth),
    db: AsyncSession = Depends(get_db_session),
):
    """Note only — every other field is a verification snapshot and is
    never editable via this endpoint."""
    row = await saved_quotes_service.get_owned_saved_quote(
        db, user_id=user.id, saved_quote_id=saved_quote_id,
    )
    if row is None:
        raise HTTPException(
            status_code=404,
            detail={"error": "SAVED_QUOTE_NOT_FOUND", "message": "Saved quote not found"},
        )
    row = await saved_quotes_service.update_note(db, row=row, note=body.note)
    return _saved_quote_response(row)


@router.delete("/quotes/{saved_quote_id}", status_code=204)
async def delete_saved_quote(
    saved_quote_id: uuid.UUID,
    user: User = Depends(require_auth),
    db: AsyncSession = Depends(get_db_session),
):
    row = await saved_quotes_service.get_owned_saved_quote(
        db, user_id=user.id, saved_quote_id=saved_quote_id,
    )
    if row is None:
        raise HTTPException(
            status_code=404,
            detail={"error": "SAVED_QUOTE_NOT_FOUND", "message": "Saved quote not found"},
        )
    await saved_quotes_service.delete_saved_quote(db, row=row)
