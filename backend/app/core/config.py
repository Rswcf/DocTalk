from __future__ import annotations

from pathlib import Path
from typing import Optional

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # OpenRouter — 统一 API 网关
    OPENROUTER_API_KEY: Optional[str] = None
    OPENROUTER_BASE_URL: str = Field(default="https://openrouter.ai/api/v1")

    # Embedding — 模型与维度强绑定 (通过 OpenRouter 调用)
    EMBEDDING_MODEL: str = Field(default="openai/text-embedding-3-small")
    EMBEDDING_DIM: int = Field(default=1536)

    # Qdrant
    QDRANT_URL: str = Field(default="http://localhost:6333")
    QDRANT_API_KEY: Optional[str] = None
    QDRANT_COLLECTION: str = Field(default="doc_chunks")

    # LLM (通过 OpenRouter 调用)
    LLM_MODEL: str = Field(default="anthropic/claude-sonnet-4.5")
    LLM_MAX_CONTEXT_TOKENS: int = Field(default=180000)
    ALLOWED_MODELS: list[str] = Field(default=[
        "x-ai/grok-4.1-fast",
        "deepseek/deepseek-v3.2",
        "minimax/minimax-m2.1",
        "moonshotai/kimi-k2.5",
        "google/gemini-3-flash-preview",
        "openai/gpt-5.2",
        "google/gemini-3-pro-preview",
        "anthropic/claude-sonnet-4.5",
        "anthropic/claude-opus-4.6",
    ])

    # Object Storage (MinIO local / S3-compatible in production)
    MINIO_ENDPOINT: str = Field(default="localhost:9000")
    MINIO_ACCESS_KEY: str = Field(default="minioadmin")
    MINIO_SECRET_KEY: str = Field(default="minioadmin")
    MINIO_BUCKET: str = Field(default="doctalk-pdfs")
    MINIO_PRESIGN_TTL: int = Field(default=300)
    MINIO_SECURE: bool = Field(default=False)

    # Celery
    CELERY_BROKER_URL: str = Field(default="redis://localhost:6379/0")
    EMBED_BATCH_SIZE: int = Field(default=64)
    EMBED_MAX_CONCURRENCY: int = Field(default=4)

    # Limits
    MAX_PDF_SIZE_MB: int = Field(default=50)
    MAX_PDF_PAGES: int = Field(default=500)
    MAX_CHAT_HISTORY_TURNS: int = Field(default=6)
    MAX_RETRIEVAL_TOKENS: int = Field(default=1750)

    # OCR
    OCR_ENABLED: bool = Field(default=True)
    OCR_LANGUAGES: str = Field(default="eng+chi_sim")
    OCR_DPI: int = Field(default=300)

    # Multi-format support
    ALLOWED_FILE_TYPES: list[str] = Field(default=[
        'pdf', 'docx', 'pptx', 'xlsx', 'txt', 'md',
    ])

    # CORS
    FRONTEND_URL: str = Field(default="http://localhost:3000")

    # Optional DB URL placeholder for future use
    DATABASE_URL: Optional[str] = None

    # Auth
    AUTH_SECRET: Optional[str] = None  # Shared with Next.js Auth.js
    ADAPTER_SECRET: Optional[str] = None  # For internal adapter API calls

    # Sentry
    SENTRY_DSN: Optional[str] = None
    SENTRY_ENVIRONMENT: str = Field(default="production")
    SENTRY_TRACES_SAMPLE_RATE: float = Field(default=0.1)

    # Stripe
    STRIPE_SECRET_KEY: Optional[str] = None
    STRIPE_WEBHOOK_SECRET: Optional[str] = None
    STRIPE_PRICE_STARTER: str = "price_starter"
    STRIPE_PRICE_PRO: str = "price_pro"
    STRIPE_PRICE_ENTERPRISE: str = "price_enterprise"

    # Credit amounts
    CREDITS_STARTER: int = 50000
    CREDITS_PRO: int = 200000
    CREDITS_ENTERPRISE: int = 1000000
    SIGNUP_BONUS_CREDITS: int = 10000
    # Subscription tiers
    PLAN_FREE_MONTHLY_CREDITS: int = 5000
    PLAN_PLUS_MONTHLY_CREDITS: int = 30000
    PLAN_PRO_MONTHLY_CREDITS: int = 150000
    STRIPE_PRICE_PLUS_MONTHLY: str = ''
    STRIPE_PRICE_PLUS_ANNUAL: str = ''
    STRIPE_PRICE_PRO_MONTHLY: str = ''
    STRIPE_PRICE_PRO_ANNUAL: str = ''

    # Per-plan limits
    FREE_MAX_DOCUMENTS: int = 3
    PLUS_MAX_DOCUMENTS: int = 20
    PRO_MAX_DOCUMENTS: int = 999
    FREE_MAX_FILE_SIZE_MB: int = 25
    PLUS_MAX_FILE_SIZE_MB: int = 50
    PRO_MAX_FILE_SIZE_MB: int = 100

    # Model access by plan — Premium models (claude-opus-4.6) require Plus+
    PREMIUM_MODELS: list[str] = Field(default=[
        "anthropic/claude-opus-4.6",
    ])

    # Admin access — comma-separated email list
    ADMIN_EMAILS: str = ""

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", case_sensitive=False)


# Try to load .env from backend/ or repo root for local dev
_candidates = [Path(".env"), Path("..") / ".env"]
_env_file = next((str(p) for p in _candidates if p.exists()), None)

settings = Settings(_env_file=_env_file) if _env_file else Settings()

FILE_TYPE_MAP = {
    'application/pdf': 'pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
    'text/plain': 'txt',
    'text/markdown': 'md',
    'application/octet-stream': None,  # will be detected by extension
}

EXTENSION_TYPE_MAP = {
    '.pdf': 'pdf',
    '.docx': 'docx',
    '.pptx': 'pptx',
    '.xlsx': 'xlsx',
    '.txt': 'txt',
    '.md': 'md',
}
