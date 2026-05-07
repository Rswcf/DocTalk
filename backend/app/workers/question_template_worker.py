"""Celery tasks for reusable question template runs."""
from __future__ import annotations

from celery.utils.log import get_task_logger

from app.services.question_template_service import run_batch_template_job_sync
from app.workers.celery_app import celery_app

logger = get_task_logger(__name__)


@celery_app.task(
    name="app.workers.question_template_worker.run_batch_template_job",
    bind=True,
    time_limit=720,
    soft_time_limit=660,
    autoretry_for=(Exception,),
    retry_kwargs={"max_retries": 1},
    retry_backoff=30,
)
def run_batch_template_job(self, job_id: str) -> None:
    logger.info("Starting question template job %s", job_id)
    run_batch_template_job_sync(job_id)
