from __future__ import annotations

from app.services.document_diff_service import run_document_diff_job_sync
from app.workers.celery_app import celery_app


@celery_app.task(
    name="run_document_diff_job",
    time_limit=600,
    soft_time_limit=540,
    autoretry_for=(Exception,),
    retry_kwargs={"max_retries": 2},
    retry_backoff=60,
)
def run_document_diff_job(job_id: str) -> None:
    run_document_diff_job_sync(job_id)
