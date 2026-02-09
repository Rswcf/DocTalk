from __future__ import annotations

import sentry_sdk
from celery import Celery

from app.core.config import settings

# Initialize Sentry for Celery workers (no-op if DSN is not configured)
if settings.SENTRY_DSN:
    sentry_sdk.init(
        dsn=settings.SENTRY_DSN,
        environment=settings.SENTRY_ENVIRONMENT,
        traces_sample_rate=settings.SENTRY_TRACES_SAMPLE_RATE,
        send_default_pii=False,
    )

# Create Celery application
celery_app = Celery(
    "doctalk",
    broker=settings.CELERY_BROKER_URL,
    include=["app.workers.parse_worker", "app.workers.deletion_worker"],
)

# Basic configuration and task routing
celery_app.conf.update(
    task_default_queue="default",
    task_acks_late=True,
    worker_prefetch_multiplier=1,
)

# Route parsing-related tasks to a dedicated queue
celery_app.conf.task_routes = {
    "app.workers.parse_worker.parse_document": {"queue": "parse"},
}

