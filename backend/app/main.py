import os
from contextlib import asynccontextmanager

import sentry_sdk
from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from qdrant_client.models import PayloadSchemaType
from sqlalchemy import text

from .api import auth
from .api.admin import router as admin_router
from .api.billing import router as billing_router
from .api.chat import chat_router
from .api.chunks import chunks_router
from .api.collections import collections_router
from .api.credits import router as credits_router
from .api.documents import documents_router
from .api.search import search_router
from .api.users import router as users_router
from .core.config import settings
from .models.database import AsyncSessionLocal
from .schemas.common import HealthDeepResponse, HealthResponse
from .services.embedding_service import embedding_service
from .services.storage_service import storage_service

# Initialize Sentry (no-op if DSN is not configured)
if settings.SENTRY_DSN:
    sentry_sdk.init(
        dsn=settings.SENTRY_DSN,
        environment=settings.SENTRY_ENVIRONMENT,
        traces_sample_rate=settings.SENTRY_TRACES_SAMPLE_RATE,
        send_default_pii=False,
    )

@asynccontextmanager
async def lifespan(app: FastAPI):
    import logging
    import threading

    # Configure startup logger with a handler so messages actually appear.
    # Python's lastResort handler only outputs WARNING+; we need INFO for
    # "Found N stuck documents" and other startup diagnostics.
    logger = logging.getLogger("doctalk.startup")
    if not logger.handlers:
        handler = logging.StreamHandler()
        handler.setFormatter(logging.Formatter("[%(name)s] %(message)s"))
        logger.addHandler(handler)
        logger.setLevel(logging.INFO)

    def _init_services() -> None:
        try:
            storage_service.ensure_bucket()
            logger.info("MinIO bucket ready")
        except Exception as e:
            logger.warning("MinIO bucket check failed (will retry on first use): %s", e)
        try:
            embedding_service.ensure_collection()
            logger.info("Qdrant collection ready")
            try:
                qdrant = embedding_service.get_qdrant_client()
                qdrant.create_payload_index(
                    collection_name=settings.QDRANT_COLLECTION,
                    field_name="document_id",
                    field_schema=PayloadSchemaType.KEYWORD,
                )
                logger.info("Qdrant payload index ready for field=document_id")
            except Exception as e:
                logger.info("Qdrant payload index create skipped or already exists: %s", e)
        except Exception as e:
            logger.warning("Qdrant collection check failed (will retry on first use): %s", e)

    def _retry_stuck_documents() -> None:
        """Re-dispatch parse tasks for documents stuck in 'parsing' status."""
        try:
            from sqlalchemy import select

            from app.models.sync_database import SyncSessionLocal
            from app.models.tables import Document

            with SyncSessionLocal() as db:
                rows = db.execute(
                    select(Document).where(Document.status.in_(["parsing", "ocr", "embedding"]))
                )
                stuck = list(rows.scalars())
                if not stuck:
                    return
                logger.info("Found %d stuck documents, re-dispatching parse tasks", len(stuck))
                from app.workers.parse_worker import parse_document
                for doc in stuck:
                    try:
                        parse_document.delay(str(doc.id))
                        logger.info("Re-dispatched parse for %s (%s)", doc.id, doc.filename)
                    except Exception as e:
                        logger.warning("Failed to re-dispatch parse for %s: %s", doc.id, e)
        except Exception as e:
            logger.warning("Stuck document retry failed: %s", e)

    def _seed_demo_documents() -> None:
        try:
            from app.services.demo_seed import seed_demo_documents
            seed_demo_documents()
        except Exception as e:
            logger.warning("Demo document seeding failed: %s", e)

    # Run service initialization in background so app starts immediately
    def _startup_tasks() -> None:
        _init_services()
        _retry_stuck_documents()
        _seed_demo_documents()

    t = threading.Thread(target=_startup_tasks, daemon=True)
    t.start()
    yield


app = FastAPI(title="DocTalk API", lifespan=lifespan)

# CORS configuration
environment = (os.getenv("ENVIRONMENT") or "").lower()
sentry_environment = (settings.SENTRY_ENVIRONMENT or "").lower()
is_production = environment == "production" or sentry_environment == "production"
cors_origins = [settings.FRONTEND_URL] if is_production else [
    "http://localhost:3000",
    "http://localhost:3001",
    "http://localhost:3002",
    settings.FRONTEND_URL,
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Register API routers
app.include_router(documents_router)
app.include_router(search_router)
app.include_router(chat_router)
app.include_router(chunks_router)
app.include_router(auth.router)
app.include_router(credits_router)
app.include_router(users_router)
app.include_router(billing_router)
app.include_router(collections_router)
app.include_router(admin_router)

@app.get("/health", response_model=HealthDeepResponse | HealthResponse)
async def health(deep: bool = Query(False)) -> dict:
    if not deep:
        return {"status": "ok"}

    components: dict[str, dict[str, str]] = {
        "database": {"status": "ok"},
        "redis": {"status": "ok"},
    }

    try:
        async with AsyncSessionLocal() as db:
            await db.execute(text("SELECT 1"))
    except Exception as e:
        components["database"] = {"status": "error", "detail": str(e)}

    redis_client = None
    try:
        import redis.asyncio as redis

        redis_client = redis.from_url(settings.CELERY_BROKER_URL)
        await redis_client.ping()
    except Exception as e:
        components["redis"] = {"status": "error", "detail": str(e)}
    finally:
        if redis_client is not None:
            await redis_client.aclose()

    overall = "ok" if all(comp["status"] == "ok" for comp in components.values()) else "degraded"
    return {"status": overall, "components": components}
