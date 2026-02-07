from __future__ import annotations

import asyncio
import io
import os
import uuid
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.tables import Document
from app.services.storage_service import storage_service


class DocService:
    """Document lifecycle service."""

    async def create_document(
        self, upload, db: AsyncSession, user_id: Optional[uuid.UUID] = None
    ) -> uuid.UUID:
        """Save uploaded PDF to object storage, create DB record, dispatch parse.

        This method accepts an UploadFile-like object with attributes:
        - filename: str
        - content_type: str
        - read(): async -> bytes
        """
        filename: str = getattr(upload, "filename", "document.pdf") or "document.pdf"
        content_type: str = getattr(upload, "content_type", "application/pdf") or "application/pdf"
        if (content_type or "").lower() != "application/pdf":
            raise ValueError("NOT_PDF")

        data: bytes = await upload.read()
        max_bytes = int(settings.MAX_PDF_SIZE_MB) * 1024 * 1024
        if len(data) > max_bytes:
            raise ValueError("FILE_TOO_LARGE")

        # Persist to object storage under namespaced key
        doc_id = uuid.uuid4()
        storage_key = f"documents/{doc_id}/{os.path.basename(filename)}"
        storage_service.upload_file(data, storage_key, content_type=content_type)

        # Create document row (status=parsing)
        doc = Document(
            id=doc_id,
            filename=filename,
            file_size=len(data),
            storage_key=storage_key,
            status="parsing",
            user_id=user_id,  # Associate with user if authenticated
        )
        db.add(doc)
        await db.commit()

        # Dispatch parse worker (ignore failures in local dev)
        try:
            from app.workers.parse_worker import parse_document

            parse_document.delay(str(doc.id))
        except Exception:
            pass

        return doc_id

    async def get_document(self, document_id: uuid.UUID, db: AsyncSession) -> Optional[Document]:
        res = await db.execute(select(Document).where(Document.id == document_id))
        doc = res.scalar_one_or_none()
        return doc

    async def mark_deleting(self, document_id: uuid.UUID, db: AsyncSession) -> bool:
        res = await db.execute(select(Document).where(Document.id == document_id))
        doc = res.scalar_one_or_none()
        if not doc:
            return False
        doc.status = "deleting"
        db.add(doc)
        await db.commit()
        return True

    async def delete_document(self, document_id: uuid.UUID, db: AsyncSession) -> bool:
        """Delete document and all related data via ORM cascade.

        Pages, chunks, sessions, and messages are cascade-deleted by SQLAlchemy.
        Storage and vector cleanup is best-effort.
        """
        from sqlalchemy.orm import selectinload

        res = await db.execute(
            select(Document)
            .options(selectinload(Document.chunks))
            .where(Document.id == document_id)
        )
        doc = res.scalar_one_or_none()
        if not doc:
            return False

        # Best-effort: clean up object storage (sync call, run off event loop)
        try:
            await asyncio.to_thread(storage_service.delete_file, doc.storage_key)
        except Exception:
            pass

        # Best-effort: clean up Qdrant vectors (sync call, run off event loop)
        try:
            from app.services.embedding_service import embedding_service
            from app.core.config import settings as _settings
            from qdrant_client.models import Filter, FieldCondition, MatchValue

            qclient = embedding_service.get_qdrant_client()
            await asyncio.to_thread(
                qclient.delete,
                collection_name=_settings.QDRANT_COLLECTION,
                points_selector=Filter(
                    must=[FieldCondition(key="document_id", match=MatchValue(value=str(document_id)))]
                ),
            )
        except Exception:
            pass

        # ORM cascade deletes pages, chunks, sessions, messages
        await db.delete(doc)
        await db.commit()
        return True


# Singleton instance for routers
doc_service = DocService()
