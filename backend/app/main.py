from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .core.config import settings
from .api.documents import documents_router
from .api.search import search_router
from .api.chat import chat_router
from .api.chunks import chunks_router
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


@app.on_event("startup")
def on_startup() -> None:
    import logging
    logger = logging.getLogger("doctalk.startup")
    # Ensure object storage bucket exists (non-fatal on startup)
    try:
        storage_service.ensure_bucket()
    except Exception as e:
        logger.warning("MinIO bucket check failed on startup (will retry on first use): %s", e)
    # Ensure Qdrant collection exists with correct vector dimension
    try:
        embedding_service.ensure_collection()
    except Exception as e:
        logger.warning("Qdrant collection check failed on startup (will retry on first use): %s", e)


@app.get("/health")
async def health() -> dict:
    return {"status": "ok"}
