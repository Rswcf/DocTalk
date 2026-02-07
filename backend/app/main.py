import sentry_sdk
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .api import auth
from .api.billing import router as billing_router
from .api.chat import chat_router
from .api.chunks import chunks_router
from .api.credits import router as credits_router
from .api.documents import documents_router
from .api.search import search_router
from .api.users import router as users_router
from .core.config import settings
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

app = FastAPI(title="DocTalk API")

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001", "http://localhost:3002", settings.FRONTEND_URL],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Register API routers
app.include_router(documents_router, prefix="/api")
app.include_router(search_router, prefix="/api")
app.include_router(chat_router, prefix="/api")
app.include_router(chunks_router, prefix="/api")
app.include_router(auth.router)
app.include_router(credits_router)
app.include_router(users_router)
app.include_router(billing_router)


@app.on_event("startup")
def on_startup() -> None:
    import logging
    import threading
    logger = logging.getLogger("doctalk.startup")

    def _init_services() -> None:
        try:
            storage_service.ensure_bucket()
            logger.info("MinIO bucket ready")
        except Exception as e:
            logger.warning("MinIO bucket check failed (will retry on first use): %s", e)
        try:
            embedding_service.ensure_collection()
            logger.info("Qdrant collection ready")
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


@app.get("/health")
async def health() -> dict:
    return {"status": "ok"}
