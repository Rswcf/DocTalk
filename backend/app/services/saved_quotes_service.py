"""Saved-quote CRUD + caps (M3-B2, plan D8 as amended by §8.5 M3 / §8.4
point 2, and §8.1's snapshot-at-save-time requirement — see M3-B3).

Trust boundary: this module NEVER constructs a SavedQuote from
client-supplied tier/score/bboxes. The API layer must always pass a
QuoteCard produced by quote_search_service.verify_saved_quote() (or by
quote_search() itself), so every persisted trust field traces back through
the SAME verify_quote gate the rest of the system uses. `quote_hash` is
likewise always SERVER-computed here (compute_quote_hash), never accepted
from a caller — see SavedQuote's model docstring for why.
"""
from __future__ import annotations

import hashlib
import uuid
from dataclasses import dataclass
from typing import Optional

import sqlalchemy as sa
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.database import AsyncSessionLocal
from app.models.tables import Document, SavedQuote, User
from app.services.quote_search_service import QuoteCard
from app.services.quote_verification_service import QUOTE_VERIFIER_VERSION
from app.services.text_normalizer import normalize

_LIMIT_BY_PLAN = {
    "free": lambda: settings.FREE_SAVED_QUOTES_LIMIT,
    "plus": lambda: settings.PLUS_SAVED_QUOTES_LIMIT,
    "pro": lambda: settings.PRO_SAVED_QUOTES_LIMIT,
}


def saved_quotes_limit_for_plan(plan: Optional[str]) -> int:
    """Same dict-lookup convention as documents.py's FREE/PLUS/PRO_MAX_DOCUMENTS
    enforcement (numeric sentinel for "unlimited", not the boolean-gate
    convention layout translation uses)."""
    normalized = (plan or "free").lower()
    getter = _LIMIT_BY_PLAN.get(normalized, _LIMIT_BY_PLAN["free"])
    return int(getter())


def compute_quote_hash(quote_text: str, page: int, page_end: int) -> str:
    """SERVER-side dedup/idempotency key (§8.1's dedup-key philosophy,
    scoped to one (user, document) pair via the table's UNIQUE constraint
    rather than needing document_id baked into the hash itself):
    normalized quote text + the VERIFIED page range — never the caller's
    raw text or an unverified page guess. Callers must pass the page/
    page_end that came back from verify_saved_quote()/quote_search(), not
    anything client-supplied, or dedup becomes forgeable (two different
    users' honest saves of the same passage should collide; a client
    claiming a fake page range to dodge the unique constraint must not)."""
    normalized_text, _ = normalize(quote_text or "", fuzzy=True)
    payload = f"{normalized_text}|{page}|{page_end}"
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


async def count_active_saved_quotes(db: AsyncSession, user_id: uuid.UUID) -> int:
    """§8.4 point 2: ACTIVE = currently-existing rows, counted ACROSS all of
    the user's documents. There is no soft-delete flag — a DELETE is what
    "frees a slot" means, so a plain COUNT(*) is always the current truth."""
    result = await db.execute(
        sa.select(sa.func.count()).select_from(SavedQuote).where(SavedQuote.user_id == user_id)
    )
    return int(result.scalar() or 0)


async def get_existing_saved_quote(
    db: AsyncSession, *, user_id: uuid.UUID, document_id: uuid.UUID, quote_hash: str,
) -> Optional[SavedQuote]:
    result = await db.execute(
        sa.select(SavedQuote)
        .where(SavedQuote.user_id == user_id)
        .where(SavedQuote.document_id == document_id)
        .where(SavedQuote.quote_hash == quote_hash)
    )
    return result.scalar_one_or_none()


@dataclass(frozen=True)
class SaveQuoteOutcome:
    row: Optional[SavedQuote]  # None only when limit_reached
    created: bool
    limit_reached: bool
    active_count: int  # meaningful on the limit_reached path; 0 on an idempotent hit


async def save_quote(
    db: AsyncSession, *, user: User, document: Document, card: QuoteCard,
) -> SaveQuoteOutcome:
    """Idempotent, cap-aware insert.

    `card` MUST already be the output of a server-side re-verification
    (quote_search_service.verify_saved_quote() or quote_search()'s own
    cards) — every persisted trust column is copied from it as-is, never
    recomputed here and never sourced from raw request data.

    FIX-1 (Codex M3 r1 HIGH — cap race): the idempotency check AND the cap
    check (count_active_saved_quotes vs saved_quotes_limit_for_plan) now
    run INSIDE the same serialized critical section as the insert — Codex's
    exact finding was that the old code ran the count check in the API
    layer, OUTSIDE any lock and outside this function entirely: at
    limit-1 rows, two concurrent DISTINCT saves (different quote_hash) both
    read "count < limit" and both commit, overshooting the cap (reproduced
    directly: 3 concurrent saves at 29/30 all succeeded, final count 32).

    Serialized via a Postgres TRANSACTION-SCOPED advisory lock keyed by the
    user's id (`pg_advisory_xact_lock(hashtext(user_id))`) — acquired
    FIRST, before either check. A second concurrent call for the SAME user
    blocks on this statement until the first call's transaction ends
    (commit or rollback, which releases the lock automatically), at which
    point its own count query sees a fresh READ COMMITTED snapshot
    including whatever the first call just committed. Chosen over
    SELECT...FOR UPDATE on the `users` row (this codebase's existing
    reconcile_credits() precedent) specifically to AVOID taking a real row
    lock on `users`: that would also serialize against unrelated
    concurrent work touching the same row (credit-balance debits from
    chat/quote-search billing), coupling this feature's cap enforcement to
    billing latency for no reason. The advisory lock only ever contends
    with other save_quote() calls for the same user.

    CRITICAL: every return path below explicitly commits (the lock is
    released when ITS transaction ends, so leaving one open would hold the
    lock — and block every other concurrent save for this user — for the
    rest of the request). Deliberately commits rather than rolls back even
    on a no-write decision (idempotent hit, cap reached): `expire_on_commit
    =False` (app/models/database.py) means a commit does NOT expire
    `document` or any row already loaded in this session, so the caller's
    later SYNCHRONOUS reads (response serialization) stay safe — a
    rollback here would expire those objects and reintroduce the exact
    MissingGreenlet class already fixed for the PATCH endpoint.

    SELECT-then-INSERT + IntegrityError-retry (same race biblio_service's
    FIX-9 precedent handles, for a genuinely simultaneous identical save)
    retries on a FRESH AsyncSessionLocal() session, not the just-rolled-
    back `db` — see the prior real-concurrency finding in this function's
    git history for why (NullPool-specific async/greenlet interaction
    under true concurrent load; a production QueuePool-backed engine does
    not exhibit it).
    """
    await db.execute(
        sa.text("SELECT pg_advisory_xact_lock(hashtext(:user_id))"),
        {"user_id": str(user.id)},
    )

    quote_hash = compute_quote_hash(card.display_text, card.page, card.page_end)
    existing = await get_existing_saved_quote(
        db, user_id=user.id, document_id=document.id, quote_hash=quote_hash
    )
    if existing is not None:
        await db.commit()  # release the lock; nothing written, see docstring
        return SaveQuoteOutcome(row=existing, created=False, limit_reached=False, active_count=0)

    active_count = await count_active_saved_quotes(db, user.id)
    limit = saved_quotes_limit_for_plan(user.plan)
    if active_count >= limit:
        await db.commit()  # release the lock; nothing written, see docstring
        return SaveQuoteOutcome(row=None, created=False, limit_reached=True, active_count=active_count)

    row = SavedQuote(
        user_id=user.id,
        document_id=document.id,
        page=card.page,
        page_end=card.page_end,
        quote_text=card.display_text,
        bboxes=card.bboxes,
        verification_tier=card.tier,
        verification_score=card.score,
        verifier_version=QUOTE_VERIFIER_VERSION,
        source_chunk_id=uuid.UUID(card.chunk_id),
        source_kind=card.source_kind,
        # M3 review addition (plan §8.1 anchor fields, 2026-08-03): copied
        # from the card as-is, same as every other trust field — None
        # whenever the caller's card didn't come from verify_saved_quote()
        # (the column is nullable for exactly that reason).
        source_text_hash=card.source_text_hash,
        quote_start=card.quote_start,
        quote_end=card.quote_end,
        quote_hash=quote_hash,
        note=None,
    )
    db.add(row)
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        async with AsyncSessionLocal() as retry_db:
            winner = await get_existing_saved_quote(
                retry_db, user_id=user.id, document_id=document.id, quote_hash=quote_hash
            )
        if winner is None:
            raise  # not the race we anticipated — a genuine failure
        return SaveQuoteOutcome(row=winner, created=False, limit_reached=False, active_count=active_count)
    return SaveQuoteOutcome(row=row, created=True, limit_reached=False, active_count=active_count + 1)


async def list_saved_quotes_for_document(
    db: AsyncSession, *, user_id: uuid.UUID, document_id: uuid.UUID,
) -> list[SavedQuote]:
    result = await db.execute(
        sa.select(SavedQuote)
        .where(SavedQuote.user_id == user_id)
        .where(SavedQuote.document_id == document_id)
        .order_by(SavedQuote.created_at.desc())
    )
    return list(result.scalars().all())


async def list_all_saved_quotes(db: AsyncSession, *, user_id: uuid.UUID) -> list[SavedQuote]:
    """The Evidence Board feed — every saved quote for this user, across
    every document, newest first. Uses idx_saved_quotes_user_created."""
    result = await db.execute(
        sa.select(SavedQuote)
        .where(SavedQuote.user_id == user_id)
        .order_by(SavedQuote.created_at.desc())
    )
    return list(result.scalars().all())


async def get_owned_saved_quote(
    db: AsyncSession, *, user_id: uuid.UUID, saved_quote_id: uuid.UUID,
) -> Optional[SavedQuote]:
    """Ownership is baked directly into the WHERE clause (sharing.py's
    revoke_share precedent) — a saved quote belonging to another user
    simply doesn't match, so callers get a uniform 404 for both
    "doesn't exist" and "exists but isn't yours," never leaking which."""
    result = await db.execute(
        sa.select(SavedQuote)
        .where(SavedQuote.id == saved_quote_id)
        .where(SavedQuote.user_id == user_id)
    )
    return result.scalar_one_or_none()


async def update_note(db: AsyncSession, *, row: SavedQuote, note: Optional[str]) -> SavedQuote:
    """Live E2E bug (team lead, 2026-08-03): PATCH .../quotes/{id} 500'd
    with `sqlalchemy.exc.MissingGreenlet`. Root cause: `updated_at`
    (server-side `onupdate=sa.func.now()`) gets marked EXPIRED by
    SQLAlchemy after this UPDATE's flush — UNLIKE a fresh INSERT (see
    save_quote() above), where INSERT...RETURNING auto-populates
    server_default columns synchronously as part of the flush, an UPDATE's
    onupdate-computed value is NOT auto-refreshed the same way. The
    caller's later SYNCHRONOUS read of that expired attribute
    (`row.updated_at.isoformat()` inside quotes.py's _saved_quote_response,
    which runs as plain Pydantic-model construction, never inside an
    `await`) triggered an implicit lazy DB reload from OUTSIDE an active
    greenlet/await context — exactly MissingGreenlet. `db.refresh(row)`
    here, INSIDE this awaited function, forces that reload to happen
    safely now, so every attribute is a normal in-memory value by the time
    any caller touches it synchronously. Mocked unit tests (row as a bare
    SimpleNamespace) cannot exercise this at all — only a REAL SQLAlchemy
    ORM object has attribute-expiration machinery to trigger it; see
    test_saved_quotes_integration.py's TestSavedQuotesEndpointsRealAsgiRealDb
    for the real-app/real-DB regression coverage."""
    row.note = note
    await db.commit()
    await db.refresh(row)
    return row


async def delete_saved_quote(db: AsyncSession, *, row: SavedQuote) -> None:
    await db.delete(row)
    await db.commit()
