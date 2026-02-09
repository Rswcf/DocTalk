from __future__ import annotations

import asyncio
import logging
import os
import re
import unicodedata
import uuid
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.security_log import log_security_event
from app.models.tables import Document
from app.services.storage_service import storage_service

logger = logging.getLogger(__name__)


def sanitize_filename(name: str, max_length: int = 200) -> str:
    """Sanitize filename to prevent path traversal and special character issues."""
    name = unicodedata.normalize("NFC", name)
    name = os.path.basename(name)
    name = re.sub(r'[\x00-\x1f\x7f]', '', name)
    name = re.sub(r'[<>:"|?*\\]', '_', name)
    # Block double extensions like .pdf.exe
    parts = name.rsplit('.', 1)
    if len(parts) == 2:
        base = parts[0].replace('.', '_')
        name = f"{base}.{parts[1]}"
    if len(name) > max_length:
        base, ext = os.path.splitext(name)
        name = base[:max_length - len(ext)] + ext
    return name or "document"


class DocService:
    """Document lifecycle service."""

    async def create_document(
        self, upload, db: AsyncSession, user_id: Optional[uuid.UUID] = None,
        file_type: str = "pdf",
    ) -> uuid.UUID:
        """Save uploaded document to object storage, create DB record, dispatch parse.

        This method accepts an UploadFile-like object with attributes:
        - filename: str
        - content_type: str
        - read(): async -> bytes
        """
        raw_filename: str = getattr(upload, "filename", "document.pdf") or "document.pdf"
        filename = sanitize_filename(raw_filename)
        content_type: str = getattr(upload, "content_type", "application/pdf") or "application/pdf"

        data: bytes = await upload.read()
        max_bytes = int(settings.MAX_PDF_SIZE_MB) * 1024 * 1024
        if len(data) > max_bytes:
            raise ValueError("FILE_TOO_LARGE")

        # Persist to object storage under namespaced key
        doc_id = uuid.uuid4()
        storage_key = f"documents/{doc_id}/{os.path.basename(filename)}"

        # Use appropriate content type for storage
        mime_types = {
            'pdf': 'application/pdf',
            'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'txt': 'text/plain',
            'md': 'text/markdown',
        }
        storage_content_type = mime_types.get(file_type, content_type)
        storage_service.upload_file(data, storage_key, content_type=storage_content_type)

        # Create document row (status=parsing)
        doc = Document(
            id=doc_id,
            filename=filename,
            file_size=len(data),
            storage_key=storage_key,
            status="parsing",
            user_id=user_id,  # Associate with user if authenticated
            file_type=file_type,
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

        storage_ok = True
        qdrant_ok = True
        storage_key = doc.storage_key

        # Best-effort: clean up object storage (sync call, run off event loop)
        try:
            await asyncio.to_thread(storage_service.delete_file, storage_key)
        except Exception as e:
            storage_ok = False
            logger.error("MinIO deletion failed for doc %s: %s", document_id, e)

        # Best-effort: clean up Qdrant vectors (sync call, run off event loop)
        try:
            from qdrant_client.models import FieldCondition, Filter, MatchValue

            from app.core.config import settings as _settings
            from app.services.embedding_service import embedding_service

            qclient = embedding_service.get_qdrant_client()
            await asyncio.to_thread(
                qclient.delete,
                collection_name=_settings.QDRANT_COLLECTION,
                points_selector=Filter(
                    must=[FieldCondition(key="document_id", match=MatchValue(value=str(document_id)))]
                ),
            )
        except Exception as e:
            qdrant_ok = False
            logger.error("Qdrant deletion failed for doc %s: %s", document_id, e)

        # ORM cascade deletes pages, chunks, sessions, messages
        await db.delete(doc)
        await db.commit()

        log_security_event(
            "document_deleted", document_id=document_id, user_id=doc.user_id,
            storage_cleaned=storage_ok, vectors_cleaned=qdrant_ok,
        )

        # Queue retry task if any cleanup failed
        if not storage_ok or not qdrant_ok:
            try:
                from app.workers.deletion_worker import retry_failed_deletion
                retry_failed_deletion.delay(
                    str(document_id),
                    storage_key=storage_key if not storage_ok else None,
                    cleanup_qdrant=not qdrant_ok,
                )
            except Exception:
                logger.error("Failed to queue deletion retry for doc %s", document_id)

        return True


# Singleton instance for routers
doc_service = DocService()
