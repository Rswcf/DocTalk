from __future__ import annotations

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


# Singleton instance for routers
doc_service = DocService()
