from __future__ import annotations

from celery.exceptions import SoftTimeLimitExceeded
from celery.utils.log import get_task_logger

from app.services.summary_service import generate_document_brief_sync

from .celery_app import celery_app

logger = get_task_logger(__name__)


@celery_app.task(
    name="app.workers.brief_worker.generate_document_brief",
    bind=True,
    time_limit=240,
    soft_time_limit=210,
)
def generate_document_brief(self, document_id: str) -> None:
    try:
        generate_document_brief_sync(document_id)
    except SoftTimeLimitExceeded:
        logger.warning("Document brief generation timed out for %s", document_id)
        raise
