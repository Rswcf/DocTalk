"""Celery task for layout-preserving PDF translation."""
from __future__ import annotations

from celery.utils.log import get_task_logger

from app.services.layout_translation_service import run_layout_translation_job_sync
from app.workers.celery_app import celery_app

logger = get_task_logger(__name__)


@celery_app.task(
    name="app.workers.layout_translation_worker.run_layout_translation_job",
    bind=True,
    time_limit=2100,
    soft_time_limit=1980,
    autoretry_for=(Exception,),
    retry_kwargs={"max_retries": 1},
    retry_backoff=60,
)
def run_layout_translation_job(self, job_id: str) -> None:
    logger.info("Starting layout-preserving translation job %s", job_id)
    run_layout_translation_job_sync(job_id)
