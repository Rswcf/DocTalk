from __future__ import annotations

from celery import Celery

from app.core.config import settings


# Create Celery application
celery_app = Celery(
    "doctalk",
    broker=settings.CELERY_BROKER_URL,
    include=["app.workers.parse_worker"],
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

