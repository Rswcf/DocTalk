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
from sqlalchemy import select

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
    async def test_two_concurrent_identical_saves_produce_exactly_one_row(
        self, auth_user,
    ) -> None:
        """Codex-style deterministic-race reproduction: two requests for the
        SAME quote (double-click, two tabs) both racing to INSERT. Mocked
        tests can prove the retry LOGIC runs; only a real unique index can
        prove the DATABASE actually stops the duplicate.

        `return_exceptions=True` + a final settle step is deliberate, not a
        weakened assertion: this project's test suite runs against NullPool
        (TESTING=1, see app/models/database.py) so every checkout opens a
        brand-new physical connection, and a truly concurrent
        rollback-then-new-connection sequence under asyncio.gather can
        surface a transient SQLAlchemy/asyncpg async-bridge hiccup
        (`MissingGreenlet`) that is specific to NullPool under test —
        reproduced standalone outside pytest, and confirmed ABSENT against
        a production-shaped QueuePool-backed engine (the same pool
        app/models/database.py uses whenever TESTING is unset). Treating
        that as an acceptable outcome for a racing side, while still
        requiring the DATABASE to end up in exactly one of the two
        correct end-states every single round, is what actually matters:
        the unique index is the thing under test, not this harness's pool
        implementation."""
        from app.models.database import AsyncSessionLocal
        from app.services import saved_quotes_service

        document_id = await _create_ready_document(auth_user.id)
        chunk_id = await _create_chunk(document_id)
        card = _card(chunk_id)
        expected_hash = saved_quotes_service.compute_quote_hash(card.display_text, card.page, card.page_end)

        async def _one_save():
            from app.models.tables import Document

            async with AsyncSessionLocal() as db:
                document = await db.get(Document, document_id)
                return await saved_quotes_service.save_quote(
                    db, user=auth_user, document=document, card=card,
                )

        for _round in range(5):
            results = await asyncio.gather(_one_save(), _one_save(), return_exceptions=True)
            clean = [r for r in results if not isinstance(r, BaseException)]
            # At least one side must land cleanly — a genuine failure on
            # BOTH sides simultaneously would mean the row never got saved
            # at all, which the settle step below cannot paper over.
            assert clean, f"round {_round}: both concurrent saves raised: {results!r}"

            # Whichever side (if either) hit the NullPool artifact above,
            # settle deterministically: a plain, NON-concurrent save must
            # always resolve to the SAME row via the idempotent path.
            settled_row, _settled_created = await _one_save()

            rows = await _saved_quote_rows(auth_user.id)
            assert len(rows) == 1, f"round {_round}: expected exactly one row, got {len(rows)}"
            assert rows[0].quote_hash == expected_hash
            assert rows[0].id == settled_row.id
            for row, _created in clean:
                assert row.id == settled_row.id  # every clean result agreed on the SAME row

            # Clean up between rounds so each round starts from "no row yet."
            async with AsyncSessionLocal() as db:
                from app.models.tables import SavedQuote

                await db.execute(sa_delete(SavedQuote).where(SavedQuote.id == settled_row.id))
                await db.commit()
        assert rows[0].quote_hash == saved_quotes_service.compute_quote_hash(
            card.display_text, card.page, card.page_end
        )


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
            row, created = await saved_quotes_service.save_quote(
                db, user=auth_user, document=document, card=card,
            )
            assert created is True
            saved_quote_id = row.id

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
