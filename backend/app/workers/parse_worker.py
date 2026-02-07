from __future__ import annotations

import time
import uuid
from typing import List, Optional

from celery.utils.log import get_task_logger
from minio import Minio
from qdrant_client.models import PointStruct
from sqlalchemy import select

from app.core.config import settings
from app.models.sync_database import SyncSessionLocal
from app.models.tables import Chunk, Document, Page
from app.services.embedding_service import embedding_service
from app.services.parse_service import ParseService

from .celery_app import celery_app

logger = get_task_logger(__name__)


def _get_minio_client() -> Minio:
    from urllib.parse import urlparse
    endpoint = settings.MINIO_ENDPOINT
    access_key = settings.MINIO_ACCESS_KEY
    secret_key = settings.MINIO_SECRET_KEY
    # Parse endpoint for scheme-based secure detection
    if endpoint.startswith("http://") or endpoint.startswith("https://"):
        parsed = urlparse(endpoint)
        secure = parsed.scheme == "https"
        host = parsed.netloc
    else:
        host = endpoint
        secure = bool(settings.MINIO_SECURE)
    return Minio(host, access_key=access_key, secret_key=secret_key, secure=secure)


def _download_pdf_bytes(bucket: str, object_key: str) -> bytes:
    client = _get_minio_client()
    response = client.get_object(bucket, object_key)
    try:
        data = response.read()
    finally:
        response.close()
        response.release_conn()
    return data


@celery_app.task(name="app.workers.parse_worker.parse_document", bind=True)
def parse_document(self, document_id: str) -> None:
    """Parse a PDF from object storage, chunk it and persist metadata.

    - If the document appears scanned (insufficient text), mark error.
    - Writes pages and chunks tables.
    - Updates progress every 10 pages.
    - Leaves status for the embedding worker to finalize.
    """
    logger.info("Starting parse_document for %s", document_id)

    service = ParseService()

    with SyncSessionLocal() as db:
        doc: Optional[Document] = db.get(Document, uuid.UUID(document_id))
        if not doc:
            logger.error("Document %s not found", document_id)
            return

        # Clean up partial data from previous attempts (idempotent re-parse)
        from sqlalchemy import delete as sa_delete
        db.execute(sa_delete(Chunk).where(Chunk.document_id == doc.id))
        db.execute(sa_delete(Page).where(Page.document_id == doc.id))
        doc.pages_parsed = 0
        doc.chunks_total = 0
        doc.chunks_indexed = 0
        doc.status = "parsing"
        db.add(doc)
        db.commit()
        logger.info("Cleaned up partial data for %s, starting fresh parse", document_id)

        # Download PDF
        try:
            pdf_bytes = _download_pdf_bytes(settings.MINIO_BUCKET, doc.storage_key)
        except Exception as e:
            logger.exception("Failed to download PDF for %s: %s", document_id, e)
            doc.status = "error"
            doc.error_msg = "无法下载文档文件，请稍后重试"
            db.add(doc)
            db.commit()
            return

        # Extract pages
        try:
            pages = service.extract_pages(pdf_bytes)
        except Exception as e:
            logger.exception("PyMuPDF extraction failed for %s: %s", document_id, e)
            doc.status = "error"
            doc.error_msg = "PDF 解析失败，文件可能已损坏"
            db.add(doc)
            db.commit()
            return

        # Update total page count
        doc.page_count = len(pages)
        db.add(doc)
        db.commit()

        # Detect scanned PDFs — attempt OCR fallback
        if service.detect_scanned(pages):
            if not settings.OCR_ENABLED:
                doc.status = "error"
                doc.error_msg = "该文档为扫描版 PDF，暂不支持。请上传含文本层的 PDF。"
                db.add(doc)
                db.commit()
                logger.info("Document %s marked as scanned / error (OCR disabled)", document_id)
                return

            logger.info("Document %s appears scanned, attempting OCR", document_id)
            doc.status = "ocr"
            db.add(doc)
            db.commit()

            try:
                pages = service.extract_pages_ocr(
                    pdf_bytes,
                    languages=settings.OCR_LANGUAGES,
                    dpi=settings.OCR_DPI,
                )
            except Exception as e:
                logger.exception("OCR extraction failed for %s: %s", document_id, e)
                doc.status = "error"
                doc.error_msg = "OCR 文字识别失败"
                db.add(doc)
                db.commit()
                return

            # Verify OCR produced enough text
            total_chars = sum(
                sum(len(b.text) for b in p.blocks) for p in pages
            )
            if total_chars < 50:
                doc.status = "error"
                doc.error_msg = "OCR 未能识别出足够文字"
                db.add(doc)
                db.commit()
                logger.info("Document %s: OCR produced only %d chars", document_id, total_chars)
                return

            logger.info("OCR succeeded for %s: %d chars extracted", document_id, total_chars)
            doc.status = "parsing"
            db.add(doc)
            db.commit()

        # Persist pages and update progress every 10 pages
        for i, p in enumerate(pages, start=1):
            db.add(
                Page(
                    document_id=doc.id,
                    page_number=p.page_number,
                    width_pt=p.width_pt,
                    height_pt=p.height_pt,
                    rotation=p.rotation,
                )
            )
            if (i % 10) == 0 or i == len(pages):
                doc.pages_parsed = i
                db.add(doc)
                db.commit()

        # Chunk document (includes cleaning + bbox normalization)
        try:
            chunk_infos = service.chunk_document(pages)
        except Exception as e:
            logger.exception("Chunking failed for %s: %s", document_id, e)
            doc.status = "error"
            doc.error_msg = "PDF 切分失败"
            db.add(doc)
            db.commit()
            return

        # Persist chunks
        chunks_total = 0
        for ch in chunk_infos:
            db.add(
                Chunk(
                    document_id=doc.id,
                    chunk_index=ch.chunk_index,
                    text=ch.text,
                    token_count=ch.token_count,
                    page_start=ch.page_start,
                    page_end=ch.page_end,
                    bboxes=ch.bboxes,
                    section_title=ch.section_title,
                )
            )
            chunks_total += 1

        doc.chunks_total = chunks_total
        db.add(doc)
        db.commit()

        logger.info("Completed parse stage for %s: %d chunks", document_id, chunks_total)

        # ---------------- Embedding & Qdrant indexing ----------------
        try:
            # Ensure collection exists (idempotent)
            try:
                embedding_service.ensure_collection()
            except Exception as e:
                logger.warning("ensure_collection failed or skipped: %s", e)

            # Load all chunks for this document
            rows = db.execute(select(Chunk).where(Chunk.document_id == doc.id).order_by(Chunk.chunk_index))
            chunks: List[Chunk] = list(rows.scalars())
            if not chunks:
                doc.status = "ready"
                db.add(doc)
                db.commit()
                logger.info("No chunks to embed for %s; marked ready", document_id)
                return

            doc.status = "embedding"
            db.add(doc)
            db.commit()

            batch_size = int(getattr(settings, "EMBED_BATCH_SIZE", 64) or 64)
            qclient = embedding_service.get_qdrant_client()

            total_indexed = int(doc.chunks_indexed or 0)
            for i in range(0, len(chunks), batch_size):
                batch = chunks[i : i + batch_size]
                texts = [c.text for c in batch]
                vectors = embedding_service.embed_texts(texts)

                points: List[PointStruct] = []
                for c, v in zip(batch, vectors):
                    pid = str(c.id)
                    points.append(
                        PointStruct(
                            id=pid,
                            vector=v,
                            payload={
                                "document_id": str(doc.id),
                                "chunk_index": int(c.chunk_index),
                                "page_start": int(c.page_start),
                                "text": c.text[:1000],  # cap payload size
                            },
                        )
                    )

                # Upsert to Qdrant
                qclient.upsert(collection_name=settings.QDRANT_COLLECTION, points=points, wait=True)

                # Update vector_id for chunks in DB
                for c in batch:
                    c.vector_id = str(c.id)
                    db.add(c)

                total_indexed += len(batch)
                doc.chunks_indexed = total_indexed
                db.add(doc)
                db.commit()

                # Coarse global rate limit between batches
                time.sleep(0.2)

            # All done
            doc.status = "ready"
            db.add(doc)
            db.commit()
            logger.info("Embedding completed for %s: %d indexed", document_id, total_indexed)

        except Exception as e:
            logger.exception("Embedding/indexing failed for %s: %s", document_id, e)
            doc.status = "error"
            doc.error_msg = "向量化或索引失败"
            db.add(doc)
            db.commit()
            return
