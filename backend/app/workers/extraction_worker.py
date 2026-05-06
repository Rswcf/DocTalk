"""Celery tasks for structured document workbench jobs."""
from __future__ import annotations

from celery.utils.log import get_task_logger

from app.services.extraction_service import run_extraction_job_sync
from app.workers.celery_app import celery_app

logger = get_task_logger(__name__)


@celery_app.task(
    name="app.workers.extraction_worker.run_extraction_job",
    bind=True,
    time_limit=420,
    soft_time_limit=360,
    autoretry_for=(Exception,),
    retry_kwargs={"max_retries": 1},
    retry_backoff=30,
)
def run_extraction_job(self, job_id: str) -> None:
    logger.info("Starting structured extraction job %s", job_id)
    run_extraction_job_sync(job_id)
