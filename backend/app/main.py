from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .core.config import settings
from .api.documents import documents_router
from .api.search import search_router
from .api.chat import chat_router
from .api.chunks import chunks_router
from .api.credits import router as credits_router
from .api.users import router as users_router
from .api.billing import router as billing_router
from .api import auth
from .services.storage_service import storage_service
from .services.embedding_service import embedding_service


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

    # Run service initialization in background so app starts immediately
    t = threading.Thread(target=_init_services, daemon=True)
    t.start()


@app.get("/health")
async def health() -> dict:
    return {"status": "ok"}
