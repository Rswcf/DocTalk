from __future__ import annotations

from typing import Optional

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # Embedding — 模型与维度强绑定
    EMBEDDING_MODEL: str = Field(default="text-embedding-3-small")
    EMBEDDING_DIM: int = Field(default=1536)
    EMBEDDING_PROVIDER: str = Field(default="openai")
    OPENAI_API_KEY: Optional[str] = None

    # Qdrant
    QDRANT_URL: str = Field(default="http://localhost:6333")
    QDRANT_COLLECTION: str = Field(default="doc_chunks")

    # LLM
    ANTHROPIC_API_KEY: Optional[str] = None
    LLM_MODEL: str = Field(default="claude-sonnet-4-5-20250929")
    LLM_MAX_CONTEXT_TOKENS: int = Field(default=180000)

    # Object Storage
    MINIO_ENDPOINT: str = Field(default="localhost:9000")
    MINIO_ACCESS_KEY: str = Field(default="minioadmin")
    MINIO_SECRET_KEY: str = Field(default="minioadmin")
    MINIO_BUCKET: str = Field(default="doctalk-pdfs")
    MINIO_PRESIGN_TTL: int = Field(default=300)

    # Celery
    CELERY_BROKER_URL: str = Field(default="redis://localhost:6379/0")
    EMBED_BATCH_SIZE: int = Field(default=64)
    EMBED_MAX_CONCURRENCY: int = Field(default=4)

    # Limits
    MAX_PDF_SIZE_MB: int = Field(default=50)
    MAX_PDF_PAGES: int = Field(default=500)
    MAX_CHAT_HISTORY_TURNS: int = Field(default=6)
    MAX_RETRIEVAL_TOKENS: int = Field(default=1750)

    # CORS
    FRONTEND_URL: str = Field(default="http://localhost:3000")

    # Optional DB URL placeholder for future use
    DATABASE_URL: Optional[str] = None

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", case_sensitive=False)


from pathlib import Path

# Try to load .env from backend/ or repo root for local dev
_candidates = [Path(".env"), Path("..") / ".env"]
_env_file = next((str(p) for p in _candidates if p.exists()), None)

settings = Settings(_env_file=_env_file) if _env_file else Settings()
