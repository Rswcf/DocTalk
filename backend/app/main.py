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
    # Ensure object storage bucket exists
    storage_service.ensure_bucket()
    # Ensure Qdrant collection exists with correct vector dimension
    try:
        embedding_service.ensure_collection()
    except Exception:
        # Avoid startup crash in dev; surface errors in logs
        # In production, this should fail fast.
        pass


@app.get("/health")
async def health() -> dict:
    return {"status": "ok"}
