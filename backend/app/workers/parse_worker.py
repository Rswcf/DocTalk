from __future__ import annotations

import time
import uuid
from typing import List, Optional

from celery.exceptions import SoftTimeLimitExceeded
from celery.utils.log import get_task_logger
from minio import Minio
from qdrant_client.models import PointStruct
from sqlalchemy import select

from app.core.config import settings
from app.models.sync_database import SyncSessionLocal
from app.models.tables import Chunk, Document, DocumentBrief, DocumentElement, Page
from app.services.conversion_service import CONVERTIBLE_TYPES, convert_to_pdf
from app.services.embedding_service import embedding_service
from app.services.parse_service import (
    PARSE_PIPELINE_VERSION,
    ParseService,
    detect_low_quality_text,
    detect_script_osd,
    resolve_ocr_languages,
    text_quality_score,
)

from .celery_app import celery_app

logger = get_task_logger(__name__)


_WORKER_ERROR_CODES: dict[str, str] = {
    "PARSE_TIMEOUT": "Document parsing timed out",
    "DOWNLOAD_FAILED": "Failed to download document file",
    "EXTRACTION_FAILED": "Failed to extract document content",
    "PDF_PARSE_FAILED": "PDF parsing failed, file may be corrupted",
    "OCR_DISABLED": "This document is a scanned PDF without a text layer. OCR is disabled.",
    "OCR_FAILED": "OCR text recognition failed",
    "OCR_INSUFFICIENT_TEXT": "OCR could not extract sufficient text",
    "PERSIST_PAGES_FAILED": "Failed to save document pages to database",
    "PERSIST_ELEMENTS_FAILED": "Failed to save document structure to database",
    "CHUNKING_FAILED": "Document chunking failed",
    "PERSIST_CHUNKS_FAILED": "Failed to save document chunks to database",
    "NO_CHUNKS": "No text content could be extracted from the document",
    "VECTORIZE_FAILED": "Vectorization or indexing failed",
}


def _set_doc_error(doc, code: str, human: str | None = None) -> None:
    """Mark a Document as errored with a structured ERR_CODE prefix.

    Wire contract (transitional bridge — full taxonomy is frontend/Phase 3):
        doc.error_msg = "ERR_CODE:<CODE>:<human text>"
    Idempotent: repeated calls on an already-prefixed message do NOT stack
    additional ERR_CODE: prefixes. Legacy free-text rows written before
    this migration remain readable by consumers that fall back to the raw
    string when no ERR_CODE: prefix is present.
    """
    text = human if human is not None else _WORKER_ERROR_CODES.get(code, "Document processing failed")
    payload = text if text.startswith("ERR_CODE:") else f"ERR_CODE:{code}:{text}"
    doc.status = "error"
    doc.error_msg = payload


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


def _download_file_bytes(bucket: str, object_key: str) -> bytes:
    client = _get_minio_client()
    response = client.get_object(bucket, object_key)
    try:
        data = response.read()
    finally:
        response.close()
        response.release_conn()
    return data


def _set_timeout_error(document_id: str, message: str) -> None:
    try:
        doc_uuid = uuid.UUID(document_id)
    except Exception:
        logger.warning("Failed to parse document id during timeout handling: %s", document_id)
        return

    with SyncSessionLocal() as db:
        doc: Optional[Document] = db.get(Document, doc_uuid)
        if not doc:
            logger.warning("Timeout handler could not find document: %s", document_id)
            return
        _set_doc_error(doc, "PARSE_TIMEOUT", message)
        db.add(doc)
        db.commit()


def _queue_document_brief(document_id: str) -> None:
    try:
        from app.workers.brief_worker import generate_document_brief

        generate_document_brief.delay(document_id)
    except Exception as exc:
        logger.warning("Failed to queue document brief generation for %s: %s", document_id, exc)


@celery_app.task(
    name="app.workers.parse_worker.parse_document",
    bind=True,
    time_limit=600,
    soft_time_limit=540,
    autoretry_for=(Exception,),
    retry_kwargs={"max_retries": 2},
    retry_backoff=60,
)
def parse_document(self, document_id: str, locale: str | None = None) -> None:
    """Parse a document from object storage, chunk it and persist metadata.

    Supports PDF (via PyMuPDF) and non-PDF formats (DOCX, PPTX, XLSX, TXT, MD)
    via format-specific extractors.
    """
    logger.info("Starting parse_document for %s", document_id)

    timeout_message = "Document parsing timed out after 9 minutes"
    service = ParseService()

    try:
        with SyncSessionLocal() as db:
            doc: Optional[Document] = db.get(Document, uuid.UUID(document_id))
            if not doc:
                logger.error("Document %s not found", document_id)
                return

            # Delete stale Qdrant vectors BEFORE deleting any DB rows (R2b ordering fix).
            # Doing Qdrant first means a Qdrant outage leaves the document's existing
            # Pages/Chunks intact (we only set an error + return) instead of committing the
            # row deletes alongside the error — which would have been silent data loss when
            # vectors also survived. The delete is by document_id filter, so it needs no
            # chunk rows. HARD, AWAITED precondition before re-indexing.
            try:
                # ensure_collection() first so a first parse on a fresh collection doesn't
                # fail the delete with "collection not found".
                embedding_service.ensure_collection()
                from qdrant_client.models import FieldCondition, Filter, MatchValue

                _qclient = embedding_service.get_qdrant_client()
                _qclient.delete(
                    collection_name=settings.QDRANT_COLLECTION,
                    points_selector=Filter(
                        must=[FieldCondition(key="document_id", match=MatchValue(value=str(doc.id)))]
                    ),
                    wait=True,
                )
            except SoftTimeLimitExceeded:
                raise
            except Exception as e:
                # Do NOT delete DB rows or re-index with stale vectors. Mark a structured
                # error (never leave the doc stuck in 'parsing') and stop; the user can retry.
                logger.error("Qdrant pre-delete failed for %s: %s", document_id, e)
                _set_doc_error(
                    doc, "QDRANT_CLEANUP_FAILED",
                    "Could not clear old vectors before re-processing; please retry.",
                )
                db.commit()
                return

            # Clean up partial data from previous attempts (idempotent re-parse). Only after
            # Qdrant vectors are confirmed gone (above) so the two stores can't diverge.
            from sqlalchemy import delete as sa_delete

            db.execute(sa_delete(DocumentBrief).where(DocumentBrief.document_id == doc.id))
            db.execute(sa_delete(DocumentElement).where(DocumentElement.document_id == doc.id))
            db.execute(sa_delete(Chunk).where(Chunk.document_id == doc.id))
            db.execute(sa_delete(Page).where(Page.document_id == doc.id))

            doc.pages_parsed = 0
            doc.chunks_total = 0
            doc.chunks_indexed = 0
            doc.summary = None
            doc.suggested_questions = None
            doc.status = "parsing"
            db.add(doc)
            db.commit()
            logger.info("Cleaned up partial data for %s, starting fresh parse", document_id)

            # Download file
            try:
                file_bytes = _download_file_bytes(settings.MINIO_BUCKET, doc.storage_key)
            except SoftTimeLimitExceeded:
                raise
            except Exception as e:
                logger.exception("Failed to download file for %s: %s", document_id, e)
                _set_doc_error(doc, "DOWNLOAD_FAILED", "Failed to download document file")
                db.add(doc)
                db.commit()
                return

            file_type = getattr(doc, "file_type", "pdf") or "pdf"

            # Parse-pipeline metadata (R2b), persisted at finalization.
            parse_method = "text"
            ocr_languages_used: Optional[str] = None

            # Map page_number → original extracted text for non-PDF (used when persisting Page.content)
            extracted_content_map: dict[int, str] = {}

            if file_type != "pdf":
                # ---- Non-PDF extraction path ----
                try:
                    from app.services.extractors import extract_document

                    extracted = extract_document(file_bytes, file_type)
                except SoftTimeLimitExceeded:
                    raise
                except Exception as e:
                    logger.exception("Extraction failed for %s (type=%s): %s", document_id, file_type, e)
                    _set_doc_error(doc, "EXTRACTION_FAILED", f"Failed to extract {file_type.upper()} content")
                    db.add(doc)
                    db.commit()
                    return

                doc.page_count = len(extracted)
                db.add(doc)
                db.commit()

                # Store original extracted text for Page.content
                for ep in extracted:
                    extracted_content_map[ep.page_number] = ep.text

                # Convert to PageInfo for the shared chunking pipeline
                from app.services.parse_service import BlockInfo, PageInfo

                pages = []
                for ep in extracted:
                    blocks = []
                    if ep.section_title:
                        blocks.append(
                            BlockInfo(
                                page=ep.page_number,
                                text=ep.section_title,
                                bbox=(0.0, 0.0, 1.0, 0.08),
                                font_size=18.0,
                            )
                        )
                    blocks.append(
                        BlockInfo(
                            page=ep.page_number,
                            text=ep.text,
                            bbox=(0.0, 0.1 if ep.section_title else 0.0, 1.0, 1.0),
                            font_size=12.0,
                        )
                    )
                    pages.append(
                        PageInfo(
                            page_number=ep.page_number,
                            width_pt=ep.width_pt or 612.0,
                            height_pt=ep.height_pt or 792.0,
                            rotation=0,
                            blocks=blocks,
                        )
                    )
            else:
                # ---- PDF extraction path (existing logic) ----
                try:
                    pages = service.extract_pages(file_bytes)
                except SoftTimeLimitExceeded:
                    raise
                except Exception as e:
                    logger.exception("PyMuPDF extraction failed for %s: %s", document_id, e)
                    _set_doc_error(doc, "PDF_PARSE_FAILED", "PDF parsing failed, file may be corrupted")
                    db.add(doc)
                    db.commit()
                    return

                doc.page_count = len(pages)
                db.add(doc)
                db.commit()

                # Decide whether OCR is needed. Two triggers:
                #  (a) scanned: no text layer at all (detect_scanned).
                #  (b) low-quality: a text layer is present but garbled (broken-font cmap)
                #      — detect_low_quality_text, the R2b fix for docs like U13 that
                #      detect_scanned() misses because garbage text *is* present.
                scanned = service.detect_scanned(pages)
                low_q, qscore = (False, None)
                if not scanned:
                    low_q, qscore = detect_low_quality_text(pages, file_type="pdf")
                need_ocr = scanned or low_q

                if need_ocr and not settings.OCR_ENABLED:
                    if scanned:
                        _set_doc_error(
                            doc,
                            "OCR_DISABLED",
                            "This document is a scanned PDF without a text layer. OCR is disabled.",
                        )
                        db.add(doc)
                        db.commit()
                        logger.info("Document %s marked as scanned / error (OCR disabled)", document_id)
                        return
                    # low-quality but OCR off: the poor text layer is all we have — keep it
                    # (don't hard-error a doc that has *some* extractable text).
                    logger.warning(
                        "Document %s has low-quality text (q=%.2f) but OCR disabled; keeping text layer",
                        document_id, qscore or 0.0,
                    )
                elif need_ocr:
                    reason = "appears scanned" if scanned else f"has garbled text (q={qscore:.2f})"
                    logger.info("Document %s %s, attempting OCR", document_id, reason)
                    doc.status = "ocr"
                    db.add(doc)
                    db.commit()

                    # Content-based OCR language selection (R2b): detect the script via OSD
                    # (locale-independent — handles en-locale users with non-Latin docs and
                    # retries/backfills that carry no locale), then narrow to that script's
                    # languages, with `locale` only disambiguating within the family.
                    try:
                        script = detect_script_osd(file_bytes)
                    except SoftTimeLimitExceeded:
                        raise
                    except Exception as e:
                        logger.warning("OSD script detection failed for %s: %s", document_id, e)
                        script = None
                    ocr_languages_used = resolve_ocr_languages(locale, script=script)
                    logger.info(
                        "Document %s OCR: script=%s locale=%s -> languages=%s",
                        document_id, script, locale, ocr_languages_used,
                    )

                    try:
                        ocr_pages = service.extract_pages_ocr(
                            file_bytes,
                            languages=ocr_languages_used,
                            dpi=settings.OCR_DPI,
                        )
                    except SoftTimeLimitExceeded:
                        raise
                    except Exception as e:
                        logger.exception("OCR extraction failed for %s: %s", document_id, e)
                        if scanned:
                            _set_doc_error(doc, "OCR_FAILED", "OCR text recognition failed")
                            db.add(doc)
                            db.commit()
                            return
                        ocr_pages = None  # low-quality fallback: keep the text layer below

                    if ocr_pages is not None:
                        total_chars = sum(sum(len(b.text) for b in p.blocks) for p in ocr_pages)
                        ocr_q = text_quality_score(ocr_pages)
                        if scanned and total_chars < 50:
                            _set_doc_error(doc, "OCR_INSUFFICIENT_TEXT", "OCR could not extract sufficient text")
                            db.add(doc)
                            db.commit()
                            logger.info("Document %s: OCR produced only %d chars", document_id, total_chars)
                            return
                        # For a low-quality re-OCR, only ADOPT the OCR result if it actually
                        # improved quality — otherwise keep the original text layer. Prevents
                        # making things worse and avoids a re-enqueue loop on un-OCR-able docs.
                        if scanned or (total_chars >= 50 and (qscore is None or ocr_q >= qscore)):
                            pages = ocr_pages
                            parse_method = "ocr"
                            logger.info(
                                "OCR adopted for %s: %d chars, q=%.2f", document_id, total_chars, ocr_q
                            )
                        else:
                            logger.warning(
                                "Document %s: OCR q=%.2f did not beat text-layer q=%.2f; keeping text layer",
                                document_id, ocr_q, qscore or 0.0,
                            )

                    doc.status = "parsing"
                    db.add(doc)
                    db.commit()

            # ---- Best-effort: convert PPTX/DOCX to PDF for visual rendering ----
            if file_type in CONVERTIBLE_TYPES and not doc.converted_storage_key:
                try:
                    pdf_bytes = convert_to_pdf(file_bytes, file_type)
                    converted_key = f"documents/{doc.id}/converted.pdf"
                    from app.services.storage_service import storage_service as _storage

                    _storage.upload_file(pdf_bytes, converted_key, content_type="application/pdf")
                    doc.converted_storage_key = converted_key
                    db.add(doc)
                    db.commit()
                    logger.info("Converted %s to PDF for %s (%d bytes)", file_type, document_id, len(pdf_bytes))
                except SoftTimeLimitExceeded:
                    raise
                except Exception as e:
                    logger.warning("PDF conversion failed for %s (non-blocking): %s", document_id, e)

            # ---- Shared path: persist pages, chunk, and embed ----

            # Persist pages and update progress every 10 pages
            try:
                for i, p in enumerate(pages, start=1):
                    raw_content = extracted_content_map.get(p.page_number)
                    db.add(
                        Page(
                            document_id=doc.id,
                            page_number=p.page_number,
                            width_pt=p.width_pt,
                            height_pt=p.height_pt,
                            rotation=p.rotation,
                            content=raw_content.replace("\x00", "") if raw_content else raw_content,
                        )
                    )
                    if (i % 10) == 0 or i == len(pages):
                        doc.pages_parsed = i
                        db.add(doc)
                        db.commit()
            except SoftTimeLimitExceeded:
                raise
            except Exception as e:
                logger.exception("Failed to persist pages for %s: %s", document_id, e)
                db.rollback()
                doc = db.get(Document, uuid.UUID(document_id))
                if doc:
                    _set_doc_error(doc, "PERSIST_PAGES_FAILED", "Failed to save document pages to database")
                    db.add(doc)
                    db.commit()
                return

            # Persist canonical document elements (heading/paragraph stream).
            try:
                element_infos = service.extract_elements(pages)
                for el in element_infos:
                    db.add(
                        DocumentElement(
                            document_id=doc.id,
                            element_type=el.element_type,
                            page_start=el.page_start,
                            page_end=el.page_end,
                            bbox=el.bbox,
                            text=el.text,
                            reading_order=el.reading_order,
                            metadata_json=el.metadata_json,
                        )
                    )
                db.commit()
            except SoftTimeLimitExceeded:
                raise
            except Exception as e:
                logger.exception("Failed to persist document elements for %s: %s", document_id, e)
                db.rollback()
                doc = db.get(Document, uuid.UUID(document_id))
                if doc:
                    _set_doc_error(doc, "PERSIST_ELEMENTS_FAILED", "Failed to save document structure to database")
                    db.add(doc)
                    db.commit()
                return

            # Chunk document (includes cleaning + bbox normalization)
            try:
                chunk_infos = service.chunk_document(pages)
            except SoftTimeLimitExceeded:
                raise
            except Exception as e:
                logger.exception("Chunking failed for %s: %s", document_id, e)
                _set_doc_error(doc, "CHUNKING_FAILED", "Document chunking failed")
                db.add(doc)
                db.commit()
                return

            # Persist chunks (sanitize text to remove NUL bytes for PostgreSQL)
            chunks_total = 0
            try:
                for ch in chunk_infos:
                    db.add(
                        Chunk(
                            document_id=doc.id,
                            chunk_index=ch.chunk_index,
                            text=ch.text.replace("\x00", "") if ch.text else ch.text,
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
            except SoftTimeLimitExceeded:
                raise
            except Exception as e:
                logger.exception("Failed to persist chunks for %s: %s", document_id, e)
                db.rollback()
                doc = db.get(Document, uuid.UUID(document_id))
                if doc:
                    _set_doc_error(doc, "PERSIST_CHUNKS_FAILED", "Failed to save document chunks to database")
                    db.add(doc)
                    db.commit()
                return

            logger.info("Completed parse stage for %s: %d chunks", document_id, chunks_total)

            # ---------------- Embedding & Qdrant indexing ----------------
            try:
                # Ensure collection exists (idempotent)
                try:
                    embedding_service.ensure_collection()
                except SoftTimeLimitExceeded:
                    raise
                except Exception as e:
                    logger.warning("ensure_collection failed or skipped: %s", e)

                # Load all chunks for this document
                rows = db.execute(select(Chunk).where(Chunk.document_id == doc.id).order_by(Chunk.chunk_index))
                chunks: List[Chunk] = list(rows.scalars())
                if not chunks:
                    _set_doc_error(doc, "NO_CHUNKS", "No text content could be extracted from the document")
                    db.add(doc)
                    db.commit()
                    logger.warning("No chunks to embed for %s; marked error", document_id)
                    return

                doc.status = "embedding"
                db.add(doc)
                db.commit()

                batch_size = int(getattr(settings, "EMBED_BATCH_SIZE", 64) or 64)
                qclient = embedding_service.get_qdrant_client()

                total_indexed = int(doc.chunks_indexed or 0)
                for i in range(0, len(chunks), batch_size):
                    batch_start = time.time()
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

                    # Adaptive spacing: only add delay if the batch was too fast.
                    elapsed = time.time() - batch_start
                    if elapsed < 0.2:
                        time.sleep(0.2 - elapsed)

                # All done — record parse-pipeline metadata (R2b) for observability + backfill.
                doc.status = "ready"
                doc.parse_version = PARSE_PIPELINE_VERSION
                doc.parse_method = parse_method
                try:
                    doc.text_quality = round(text_quality_score(pages), 4)
                except Exception:
                    doc.text_quality = None
                doc.ocr_languages = ocr_languages_used
                db.add(doc)
                db.commit()
                logger.info(
                    "Embedding completed for %s: %d indexed (parse_method=%s, text_quality=%s)",
                    document_id, total_indexed, parse_method, doc.text_quality,
                )

                # Best-effort: generate persisted brief + legacy summary fields in a separate task.
                _queue_document_brief(document_id)

            except SoftTimeLimitExceeded:
                raise
            except Exception as e:
                logger.exception("Embedding/indexing failed for %s: %s", document_id, e)
                _set_doc_error(doc, "VECTORIZE_FAILED", "Vectorization or indexing failed")
                db.add(doc)
                db.commit()
                return
    except SoftTimeLimitExceeded:
        logger.warning("parse_document soft time limit exceeded for %s", document_id)
        _set_timeout_error(document_id, timeout_message)
        raise
