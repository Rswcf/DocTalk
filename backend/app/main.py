import asyncio
import hmac
import logging
import os
from contextlib import asynccontextmanager

import sentry_sdk
from fastapi import FastAPI, HTTPException, Query, Request
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
from .api.export import router as export_router
from .api.search import search_router
from .api.sharing import router as sharing_router
from .api.users import router as users_router
from .core.config import settings
from .core.version import get_product_version, get_release_payload
from .models.database import AsyncSessionLocal
from .schemas.common import HealthDeepResponse, HealthResponse, ReleaseInfo
from .services.embedding_service import embedding_service
from .services.storage_service import storage_service

logger = logging.getLogger(__name__)

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

    def _alert(exc: Exception, context: str) -> None:
        """Log an error with traceback and send to Sentry if configured."""
        logger.error("%s: %s", context, exc, exc_info=True)
        if settings.SENTRY_DSN:
            try:
                import sentry_sdk
                sentry_sdk.capture_exception(exc)
            except Exception:
                pass

    def _is_already_exists(exc: Exception) -> bool:
        """Detect Qdrant 409 Conflict (index/collection already exists).

        qdrant-client raises UnexpectedResponse with .status_code for REST
        non-2xx; fall back to 409 substring only if the attribute is absent.
        """
        status = getattr(exc, "status_code", None)
        if isinstance(status, int):
            return status == 409
        # Fallback for wrappers that don't expose status_code
        msg = str(exc)
        return "409" in msg

    def _init_services() -> None:
        try:
            storage_service.ensure_bucket()
            logger.info("MinIO bucket ready")
        except Exception as e:
            _alert(e, "MinIO bucket ensure failed at startup")
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
                # 409 = already exists (expected on restart, not actionable).
                # Any other failure degrades retrievals — alert.
                if _is_already_exists(e):
                    logger.info("Qdrant payload index already exists (skipping)")
                else:
                    _alert(e, "Qdrant payload index create failed")
        except Exception as e:
            # Missing collection = all retrievals fail. Must alert.
            _alert(e, "Qdrant collection ensure failed")

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


app = FastAPI(title=f"DocTalk API {get_product_version()}", lifespan=lifespan)

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
app.include_router(export_router)
app.include_router(sharing_router)

@app.get("/version", response_model=ReleaseInfo)
async def version() -> dict:
    return get_release_payload()


@app.get("/health", response_model=HealthDeepResponse | HealthResponse)
async def health(request: Request, deep: bool = Query(False)) -> dict:
    release = get_release_payload()
    if not deep:
        return {"status": "ok", "release": release}

    # Require shared secret for deep health checks to prevent info leakage
    expected = settings.ADAPTER_SECRET
    provided = request.headers.get("x-health-secret")
    if not expected or not provided or not hmac.compare_digest(provided, expected):
        raise HTTPException(status_code=403, detail="Unauthorized")

    components: dict[str, dict[str, str]] = {
        "database": {"status": "ok"},
        "redis": {"status": "ok"},
        "qdrant": {"status": "ok"},
        "minio": {"status": "ok"},
    }

    async def _check_db() -> None:
        async with AsyncSessionLocal() as db:
            await db.execute(text("SELECT 1"))

    async def _check_redis() -> None:
        import redis.asyncio as redis

        client = redis.from_url(settings.CELERY_BROKER_URL)
        try:
            await client.ping()
        finally:
            await client.aclose()

    async def _check_qdrant() -> None:
        # get_collections is the lightest healthy Qdrant REST call; sync client
        # → wrap in to_thread so it does not block the event loop.
        await asyncio.to_thread(
            lambda: embedding_service.get_qdrant_client().get_collections()
        )

    async def _check_minio() -> None:
        await asyncio.to_thread(storage_service.health_check)

    probes = {
        "database": _check_db(),
        "redis": _check_redis(),
        "qdrant": _check_qdrant(),
        "minio": _check_minio(),
    }
    # Run probes concurrently with per-probe timeout so a single slow backend
    # cannot push the whole deep-health response past its own timeout.
    names = list(probes.keys())
    results = await asyncio.gather(
        *(asyncio.wait_for(coro, timeout=5.0) for coro in probes.values()),
        return_exceptions=True,
    )
    for name, result in zip(names, results):
        if isinstance(result, Exception):
            logger.warning("Health check %s error: %s", name, result)
            components[name] = {"status": "error"}

    overall = "ok" if all(comp["status"] == "ok" for comp in components.values()) else "degraded"
    return {"status": overall, "release": release, "components": components}
