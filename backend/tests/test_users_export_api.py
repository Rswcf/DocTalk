"""Real-Postgres integration test for the GDPR data-portability export
(FIX-2, Codex M3 r1 MED): GET /api/users/me/export omitted saved_quotes
entirely — including user-authored `note` text, which is personal data in
its own right, not just a research artifact. Requires the real endpoint
(rate-limit dict, real relationship eager-loading), so this is a real-app,
real-scratch-DB test rather than a mocked one — a mocked `db` cannot
convincingly fake `selectinload(SavedQuote.document)` eager loading.

Requires docker (Postgres) — SKIP_INTEGRATION=1 (the default) skips this
whole file.
"""
from __future__ import annotations

import sys
import uuid
from pathlib import Path

import pytest

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

pytestmark = [pytest.mark.integration, pytest.mark.asyncio(loop_scope="session")]


async def _create_ready_document(user_id: uuid.UUID, *, filename: str) -> uuid.UUID:
    from app.models.database import AsyncSessionLocal
    from app.models.tables import Document

    async with AsyncSessionLocal() as db:
        doc = Document(
            filename=filename, file_size=100,
            storage_key=f"documents/{uuid.uuid4()}/{filename}", status="ready", user_id=user_id,
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
            document_id=document_id, chunk_index=0, text="hello world", token_count=2,
            page_start=1, page_end=1, bboxes=[],
        )
        db.add(chunk)
        await db.commit()
        await db.refresh(chunk)
        return chunk.id


class TestGdprExportIncludesSavedQuotes:
    async def test_export_includes_saved_quotes_with_note_and_document_filename(
        self, client, auth_user, auth_headers,
    ) -> None:
        from app.models.database import AsyncSessionLocal
        from app.models.tables import Document
        from app.services import saved_quotes_service
        from app.services.quote_search_service import QuoteCard

        document_id = await _create_ready_document(auth_user.id, filename="export-test.pdf")
        chunk_id = await _create_chunk(document_id)
        card = QuoteCard(
            display_text="the exact quoted sentence", page=4, page_end=4, bboxes=[],
            tier="exact", source_kind="extracted_text", chunk_id=str(chunk_id), score=100.0,
        )
        async with AsyncSessionLocal() as db:
            document = await db.get(Document, document_id)
            outcome = await saved_quotes_service.save_quote(
                db, user=auth_user, document=document, card=card,
            )
            assert outcome.created is True
            row = await saved_quotes_service.update_note(
                db, row=outcome.row, note="cite this in the introduction — personal working note",
            )
            saved_quote_id = row.id

        response = await client.get("/api/users/me/export", headers=auth_headers)

        assert response.status_code == 200
        body = response.json()
        assert "saved_quotes" in body
        quotes = body["saved_quotes"]
        assert len(quotes) == 1
        exported = quotes[0]
        assert exported["id"] == str(saved_quote_id)
        assert exported["quote_text"] == "the exact quoted sentence"
        assert exported["note"] == "cite this in the introduction — personal working note"
        assert exported["document_filename"] == "export-test.pdf"
        assert exported["page"] == 4
        assert exported["created_at"] is not None

    async def test_export_saved_quotes_section_is_empty_list_when_user_has_none(
        self, client, auth_user, auth_headers,
    ) -> None:
        response = await client.get("/api/users/me/export", headers=auth_headers)
        assert response.status_code == 200
        assert response.json()["saved_quotes"] == []
