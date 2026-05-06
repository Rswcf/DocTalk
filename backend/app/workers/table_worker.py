"""Celery tasks for document table extraction."""
from __future__ import annotations

from celery.utils.log import get_task_logger

from app.services.table_service import run_table_scan_job_sync
from app.workers.celery_app import celery_app

logger = get_task_logger(__name__)


@celery_app.task(
    name="app.workers.table_worker.run_table_scan_job",
    bind=True,
    time_limit=300,
    soft_time_limit=240,
    autoretry_for=(Exception,),
    retry_kwargs={"max_retries": 1},
    retry_backoff=30,
)
def run_table_scan_job(self, job_id: str) -> None:
    logger.info("Starting table scan job %s", job_id)
    run_table_scan_job_sync(job_id)
