"""Celery task to retry failed storage/vector cleanup on document deletion."""
from __future__ import annotations

import logging

from app.workers.celery_app import celery_app

logger = logging.getLogger(__name__)


@celery_app.task(bind=True, max_retries=3, default_retry_delay=30)
def retry_failed_deletion(self, document_id: str, storage_key: str | None = None, cleanup_qdrant: bool = False):
    """Retry MinIO and/or Qdrant cleanup that failed during document deletion.

    Uses exponential backoff: 30s, 60s, 120s.
    """
    from app.core.security_log import log_security_event

    storage_ok = True
    qdrant_ok = True

    if storage_key:
        try:
            from app.services.storage_service import storage_service
            storage_service.delete_file(storage_key)
            logger.info("Retry: MinIO cleanup succeeded for doc %s", document_id)
        except Exception as e:
            storage_ok = False
            logger.error("Retry: MinIO cleanup failed for doc %s: %s", document_id, e)

    if cleanup_qdrant:
        try:
            from qdrant_client.models import FieldCondition, Filter, MatchValue

            from app.core.config import settings
            from app.services.embedding_service import embedding_service

            qclient = embedding_service.get_qdrant_client()
            qclient.delete(
                collection_name=settings.QDRANT_COLLECTION,
                points_selector=Filter(
                    must=[FieldCondition(key="document_id", match=MatchValue(value=document_id))]
                ),
            )
            logger.info("Retry: Qdrant cleanup succeeded for doc %s", document_id)
        except Exception as e:
            qdrant_ok = False
            logger.error("Retry: Qdrant cleanup failed for doc %s: %s", document_id, e)

    if not storage_ok or not qdrant_ok:
        try:
            raise self.retry(countdown=30 * (2 ** self.request.retries))
        except self.MaxRetriesExceededError:
            log_security_event(
                "deletion_cleanup_failed_permanently",
                document_id=document_id,
                storage_key=storage_key,
                storage_ok=storage_ok,
                qdrant_ok=qdrant_ok,
            )
            logger.critical(
                "PERMANENT: Cleanup failed after all retries for doc %s (storage=%s, qdrant=%s)",
                document_id, storage_ok, qdrant_ok,
            )
