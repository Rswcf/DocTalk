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
    include=[
        "app.workers.parse_worker",
        "app.workers.brief_worker",
        "app.workers.extraction_worker",
        "app.workers.table_worker",
        "app.workers.question_template_worker",
        "app.workers.document_diff_worker",
        "app.workers.layout_translation_worker",
        "app.workers.deletion_worker",
        "app.workers.cleanup_tasks",
    ],
)

# Basic configuration and task routing
celery_app.conf.update(
    task_default_queue="default",
    task_acks_late=True,
    worker_prefetch_multiplier=1,
    # Requeue unacked tasks after 40 minutes. This must exceed the longest
    # task time_limit (layout translation is 35 minutes), otherwise Redis can
    # redeliver a still-running PDF translation during normal execution.
    broker_transport_options={"visibility_timeout": 2400},
)

# Route parsing-related tasks to a dedicated queue
celery_app.conf.task_routes = {
    "app.workers.parse_worker.parse_document": {"queue": "parse"},
}

# Periodic tasks (requires celery beat scheduler)
celery_app.conf.beat_schedule = {
    "cleanup-expired-tokens-daily": {
        "task": "cleanup_expired_verification_tokens",
        "schedule": 86400,  # Every 24 hours
    },
    "cleanup-empty-demo-sessions-daily": {
        "task": "cleanup_empty_demo_sessions",
        "schedule": 86400,
    },
    # Watchdog for processing runs whose task was lost (broker flush, worker
    # SIGKILL past redelivery). The task itself only touches documents stale
    # for >45 min (see parse_worker._STALE_PROCESSING_MINUTES), so the 30-min
    # cadence bounds stuck time at ~75 min without risking double dispatch.
    "requeue-stale-processing-documents": {
        "task": "requeue_stale_processing_documents",
        "schedule": 1800,
    },
}
