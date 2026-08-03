"""Real-Postgres integration tests for saved_quotes (M3-B1/B2/B3, plan D8
amended by §8.5 M3 / §8.1 / §8.4 point 2).

Mocked-db unit tests (test_saved_quotes_service.py, test_saved_quotes_api.py)
already cover the LOGIC; these prove the same behavior against a real
database — a genuine UNIQUE (user_id, document_id, quote_hash) index under
real concurrent inserts, and the ON DELETE SET NULL FK actually surviving a
real chunk deletion (§8.1's "saved quotes must survive reparses"
requirement, reproduced here as the parse worker's own deletion shape:
`sa_delete(Chunk).where(Chunk.document_id == doc.id)`).

Requires docker (Postgres) — SKIP_INTEGRATION=1 (the default) skips this
whole file.
"""
from __future__ import annotations

import asyncio
import sys
import uuid
from pathlib import Path

import pytest
from sqlalchemy import delete as sa_delete
from sqlalchemy import func, select

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

pytestmark = [pytest.mark.integration, pytest.mark.asyncio(loop_scope="session")]


async def _create_ready_document(user_id: uuid.UUID) -> uuid.UUID:
    from app.models.database import AsyncSessionLocal
    from app.models.tables import Document

    async with AsyncSessionLocal() as db:
        doc = Document(
            filename="integration-test.pdf",
            file_size=100,
            storage_key=f"documents/{uuid.uuid4()}/integration-test.pdf",
            status="ready",
            user_id=user_id,
        )
        db.add(doc)
        await db.commit()
        await db.refresh(doc)
        return doc.id


async def _create_chunk(document_id: uuid.UUID) -> uuid.UUID:
    from app.models.database import AsyncSessionLocal
    from app.models.tables import Chunk

    async with AsyncSessionLocal() as db:
        chunk = Chunk(
            document_id=document_id, chunk_index=0,
            text="Fluency is the most prized quality in translation today.",
            token_count=12, page_start=4, page_end=4, bboxes=[],
        )
        db.add(chunk)
        await db.commit()
        await db.refresh(chunk)
        return chunk.id


async def _saved_quote_rows(user_id: uuid.UUID):
    from app.models.database import AsyncSessionLocal
    from app.models.tables import SavedQuote

    async with AsyncSessionLocal() as db:
        result = await db.execute(select(SavedQuote).where(SavedQuote.user_id == user_id))
        return list(result.scalars().all())


def _card(chunk_id: uuid.UUID):
    from app.services.quote_search_service import QuoteCard

    return QuoteCard(
        display_text="the most prized quality in translation today",
        page=4, page_end=4, bboxes=[], tier="exact", source_kind="extracted_text",
        chunk_id=str(chunk_id), score=100.0,
    )


class TestConcurrentIdenticalSaveNeverDuplicates:
    async def test_two_concurrent_identical_saves_both_succeed_and_agree_on_one_row(
        self, auth_user,
    ) -> None:
        """Codex-style deterministic-race reproduction: two requests for the
        SAME quote (double-click, two tabs) both racing to save. Mocked
        tests can prove the retry LOGIC runs; only a real unique index (and
        now, FIX-1's advisory lock) can prove the DATABASE actually
        produces exactly one row under genuine concurrency.

        Tightened per Codex r2 (test-strength gap, their advisory-lock
        probe found zero defects — idempotent-under-lock, retry
        lock-release, no deadlock cycle): with FIX-1's per-user
        pg_advisory_xact_lock now serializing save_quote() end-to-end, the
        second caller's lock acquisition BLOCKS until the first caller's
        entire transaction (idempotency check through insert-and-commit)
        has ended — so the second caller's OWN idempotency check always
        observes the first caller's already-committed row. The loser never
        even reaches the INSERT/IntegrityError-retry path anymore; the
        lock makes the two calls effectively sequential from the
        database's point of view. Both concurrent calls must therefore
        succeed cleanly EVERY round: exactly one lands created=True (the
        API's 201 case), the other created=False (the 200 idempotent-hit
        case), and both report the identical row id. This replaces the
        prior `return_exceptions=True` tolerance, which existed only to
        absorb a NullPool-specific async-bridge artifact that could occur
        during a genuinely concurrent IntegrityError-retry — a scenario
        the lock no longer permits for this identical-save case."""
        from app.models.database import AsyncSessionLocal
        from app.models.tables import Document, SavedQuote
        from app.services import saved_quotes_service

        document_id = await _create_ready_document(auth_user.id)
        chunk_id = await _create_chunk(document_id)
        card = _card(chunk_id)
        expected_hash = saved_quotes_service.compute_quote_hash(card.display_text, card.page, card.page_end)

        async def _one_save():
            async with AsyncSessionLocal() as db:
                document = await db.get(Document, document_id)
                return await saved_quotes_service.save_quote(
                    db, user=auth_user, document=document, card=card,
                )

        for _round in range(5):
            outcome_a, outcome_b = await asyncio.gather(_one_save(), _one_save())

            created_flags = sorted([outcome_a.created, outcome_b.created])
            assert created_flags == [False, True], (
                f"round {_round}: expected exactly one winner (created=True) and one "
                f"idempotent loser (created=False) — both must succeed under the lock; "
                f"got {outcome_a!r}, {outcome_b!r}"
            )
            assert outcome_a.row.id == outcome_b.row.id  # both agree on the SAME row
            assert outcome_a.row.quote_hash == expected_hash

            rows = await _saved_quote_rows(auth_user.id)
            assert len(rows) == 1, f"round {_round}: expected exactly one row, got {len(rows)}"
            assert rows[0].id == outcome_a.row.id

            # Clean up between rounds so each round starts from "no row yet."
            async with AsyncSessionLocal() as db:
                await db.execute(sa_delete(SavedQuote).where(SavedQuote.id == outcome_a.row.id))
                await db.commit()


class TestSavedQuoteSurvivesChunkDeletion:
    async def test_reparse_style_chunk_deletion_leaves_the_saved_row_intact(
        self, auth_user,
    ) -> None:
        """§8.1: saved quotes must survive reparses. Reproduces the parse
        worker's own deletion shape (parse_worker.py:184,
        `sa_delete(Chunk).where(Chunk.document_id == doc.id)`) directly —
        the FK's ON DELETE SET NULL must leave the saved_quotes row (and
        every one of its snapshotted display fields) untouched, losing only
        the now-dangling chunk reference."""
        from app.models.database import AsyncSessionLocal
        from app.models.tables import Chunk, Document, SavedQuote
        from app.services import saved_quotes_service

        document_id = await _create_ready_document(auth_user.id)
        chunk_id = await _create_chunk(document_id)
        card = _card(chunk_id)

        async with AsyncSessionLocal() as db:
            document = await db.get(Document, document_id)
            outcome = await saved_quotes_service.save_quote(
                db, user=auth_user, document=document, card=card,
            )
            assert outcome.created is True
            saved_quote_id = outcome.row.id

        # Reproduce the parse worker's reparse-time chunk deletion exactly.
        async with AsyncSessionLocal() as db:
            await db.execute(sa_delete(Chunk).where(Chunk.document_id == document_id))
            await db.commit()

        async with AsyncSessionLocal() as db:
            survivor = await db.get(SavedQuote, saved_quote_id)
            assert survivor is not None
            assert survivor.source_chunk_id is None  # SET NULL, not a dangling reference
            # Every snapshotted display field is untouched by the chunk's death.
            assert survivor.quote_text == card.display_text
            assert survivor.page == card.page
            assert survivor.page_end == card.page_end
            assert survivor.verification_tier == card.tier
            assert survivor.verification_score == card.score
            assert survivor.source_kind == card.source_kind


class TestSavedQuotesEndpointsRealAsgiRealDb:
    """Real-server bug found by live E2E (team lead, 2026-08-03): PATCH
    /api/quotes/{id} -> 500 MissingGreenlet. Root cause: SavedQuote.updated_at
    (server-side `onupdate=sa.func.now()`) gets marked EXPIRED by SQLAlchemy
    after the UPDATE flush inside saved_quotes_service.update_note() —
    UNLIKE a fresh INSERT (save_quote's POST path), where INSERT...RETURNING
    auto-populates server_default columns synchronously as part of the
    flush, an UPDATE's onupdate-computed value is NOT auto-refreshed the
    same way. The endpoint's later SYNCHRONOUS read of that expired
    attribute (`row.updated_at.isoformat()` inside _saved_quote_response)
    triggers an implicit lazy DB reload from OUTSIDE an active
    greenlet/await context — exactly `MissingGreenlet`.

    Every mocked unit test in test_saved_quotes_api.py used a bare
    SimpleNamespace for `row`, which has no SQLAlchemy attribute-expiration
    machinery at all — structurally incapable of catching this class of
    bug. These tests hit the REAL app (app.main.app) via a REAL httpx
    client and a REAL scratch-DB session per request (conftest.py's
    `client`/`auth_user`/`auth_headers` fixtures), reproducing the exact
    conditions of the live bug report."""

    async def test_full_lifecycle_via_real_http_never_hits_missing_greenlet(
        self, client, auth_user, auth_headers,
    ) -> None:
        document_id = await _create_ready_document(auth_user.id)
        chunk_id = await _create_chunk(document_id)
        card = _card(chunk_id)

        # POST: genuinely new save -> 201.
        create_response = await client.post(
            f"/api/documents/{document_id}/quotes",
            json={"chunk_id": str(chunk_id), "quote_text": card.display_text, "page_hint": card.page},
            headers=auth_headers,
        )
        assert create_response.status_code == 201
        body = create_response.json()
        saved_quote_id = body["id"]
        assert body["tier"] == "exact"
        assert body["note"] is None

        # POST again, identical: idempotent hit -> 200, NOT 201 (team lead's
        # contract-alignment finding: the plan says "returns the existing
        # row (200 not 409)" — 201 for every response was a deviation).
        repeat_response = await client.post(
            f"/api/documents/{document_id}/quotes",
            json={"chunk_id": str(chunk_id), "quote_text": card.display_text, "page_hint": card.page},
            headers=auth_headers,
        )
        assert repeat_response.status_code == 200
        assert repeat_response.json()["id"] == saved_quote_id

        # GET (document-scoped) -> 200, one row.
        list_doc_response = await client.get(
            f"/api/documents/{document_id}/quotes", headers=auth_headers,
        )
        assert list_doc_response.status_code == 200
        assert len(list_doc_response.json()["quotes"]) == 1

        # GET (Evidence Board, all documents) -> 200, includes this row.
        list_all_response = await client.get("/api/quotes", headers=auth_headers)
        assert list_all_response.status_code == 200
        assert any(q["id"] == saved_quote_id for q in list_all_response.json()["quotes"])

        # PATCH: THE bug repro. Must be 200, never 500.
        patch_response = await client.patch(
            f"/api/quotes/{saved_quote_id}", json={"note": "cite this in the intro"},
            headers=auth_headers,
        )
        assert patch_response.status_code == 200
        assert patch_response.json()["note"] == "cite this in the intro"
        assert patch_response.json()["id"] == saved_quote_id

        # DELETE -> 204.
        delete_response = await client.delete(
            f"/api/quotes/{saved_quote_id}", headers=auth_headers,
        )
        assert delete_response.status_code == 204

        # Confirm it's actually gone.
        list_after_delete = await client.get(
            f"/api/documents/{document_id}/quotes", headers=auth_headers,
        )
        assert list_after_delete.json()["quotes"] == []

    async def test_save_populates_verification_anchor_columns_end_to_end(
        self, client, auth_user, auth_headers,
    ) -> None:
        """M3 review addition (plan §8.1 anchor fields, 2026-08-03): a real
        POST through the full stack (endpoint -> verify_saved_quote ->
        save_quote) must land non-NULL source_text_hash/quote_start/
        quote_end in the actual row — not just in mocked-unit-test
        plumbing. Not yet exposed via the API response (backend-only,
        v1 never reads them back), so this reads the DB directly."""
        import hashlib

        from app.models.database import AsyncSessionLocal
        from app.models.tables import SavedQuote

        document_id = await _create_ready_document(auth_user.id)
        chunk_id = await _create_chunk(document_id)
        chunk_text = "Fluency is the most prized quality in translation today."
        quote_text = "the most prized quality in translation today"

        response = await client.post(
            f"/api/documents/{document_id}/quotes",
            json={"chunk_id": str(chunk_id), "quote_text": quote_text, "page_hint": 4},
            headers=auth_headers,
        )
        assert response.status_code == 201

        async with AsyncSessionLocal() as db:
            row = await db.get(SavedQuote, uuid.UUID(response.json()["id"]))
            assert row.source_text_hash == hashlib.sha256(chunk_text.encode("utf-8")).hexdigest()
            assert row.quote_start == chunk_text.index(quote_text)
            assert row.quote_end == chunk_text.index(quote_text) + len(quote_text)


class TestConcurrentDistinctSavesRespectTheCap:
    """FIX-1 (Codex M3 r1 HIGH — cap race). Codex's exact finding: the old
    count check ran in the API layer, OUTSIDE any lock and outside
    save_quote() entirely — at limit-1 rows, concurrent DISTINCT saves
    (different quote_hash, unlike TestConcurrentIdenticalSaveNeverDuplicates
    above, which is about the SAME quote) all read "count < limit" and all
    committed. Reproduced directly before this fix: 3 concurrent saves at
    29/30 all succeeded, final count 32. Real HTTP, real scratch DB, real
    concurrency — the team lead's exact scenario: 29 pre-existing rows,
    concurrent distinct saves for the one remaining slot, exactly one
    succeeds, final count 30, every loser gets the 403 shape."""

    async def test_29_preexisting_rows_plus_concurrent_distinct_saves_yields_exactly_30(
        self, client, auth_user, auth_headers,
    ) -> None:
        from app.core.config import settings
        from app.models.database import AsyncSessionLocal
        from app.models.tables import SavedQuote

        document_id = await _create_ready_document(auth_user.id)
        chunk_id = await _create_chunk(document_id)
        chunk_text = "Fluency is the most prized quality in translation today."
        limit = settings.FREE_SAVED_QUOTES_LIMIT

        # Seed limit-1 pre-existing rows directly (bypassing verification —
        # their CONTENT doesn't matter, only that they count toward the
        # cap). One slot remains open.
        async with AsyncSessionLocal() as db:
            for i in range(limit - 1):
                db.add(SavedQuote(
                    user_id=auth_user.id, document_id=document_id, page=1, page_end=1,
                    quote_text=f"seed {i}", bboxes=None, verification_tier="exact",
                    verification_score=100.0, verifier_version="v1", source_chunk_id=chunk_id,
                    source_kind="extracted_text", quote_hash=f"seed-hash-{i}", note=None,
                ))
            await db.commit()

        # Three DISTINCT (genuinely different, all independently verifiable)
        # substrings of the SAME real chunk text — racing for the one open slot.
        distinct_quotes = ["Fluency is", "the most prized quality", "in translation today"]
        assert all(q in chunk_text for q in distinct_quotes)  # sanity: all real substrings

        async def _one_post(quote_text: str):
            return await client.post(
                f"/api/documents/{document_id}/quotes",
                json={"chunk_id": str(chunk_id), "quote_text": quote_text},
                headers=auth_headers,
            )

        responses = await asyncio.gather(*[_one_post(q) for q in distinct_quotes])

        succeeded = [r for r in responses if r.status_code == 201]
        rejected = [r for r in responses if r.status_code == 403]
        assert len(succeeded) == 1
        assert len(rejected) == 2
        for r in rejected:
            body = r.json()
            assert body["detail"]["error"] == "SAVED_QUOTES_LIMIT_REACHED"
            assert body["detail"]["limit"] == limit
            assert body["detail"]["plan"] == "free"

        async with AsyncSessionLocal() as db:
            final_count = await db.scalar(
                select(func.count()).select_from(SavedQuote).where(SavedQuote.user_id == auth_user.id)
            )
        assert final_count == limit  # never 31+, the cap held under real concurrency


class TestBoardFeedIncludesDocumentFilename:
    """FIX-7-backend (Codex M3 r1 LOW): GET /api/quotes (the Evidence
    Board feed) gains document_filename per row, joined at query time —
    real end-to-end proof (mocked-db can't convincingly fake
    selectinload eager-loading), not exposed on the document-scoped
    endpoints (POST/PATCH/per-document GET)."""

    async def test_board_feed_rows_carry_the_real_document_filename(
        self, client, auth_user, auth_headers,
    ) -> None:
        document_id = await _create_ready_document(auth_user.id)
        chunk_id = await _create_chunk(document_id)
        card = _card(chunk_id)

        from app.models.database import AsyncSessionLocal
        from app.models.tables import Document
        from app.services import saved_quotes_service

        async with AsyncSessionLocal() as db:
            document = await db.get(Document, document_id)
            outcome = await saved_quotes_service.save_quote(
                db, user=auth_user, document=document, card=card,
            )
            assert outcome.created is True
            real_filename = document.filename

        response = await client.get("/api/quotes", headers=auth_headers)

        assert response.status_code == 200
        quotes = response.json()["quotes"]
        assert len(quotes) == 1
        assert quotes[0]["document_filename"] == real_filename

        # The document-scoped list endpoint does NOT carry this field —
        # confirms the field is genuinely board-specific, not accidentally
        # shared onto the other response shape.
        doc_scoped = await client.get(
            f"/api/documents/{document_id}/quotes", headers=auth_headers,
        )
        assert "document_filename" not in doc_scoped.json()["quotes"][0]
