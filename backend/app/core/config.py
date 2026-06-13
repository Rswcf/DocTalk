from __future__ import annotations

from pathlib import Path
from typing import Optional

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # OpenRouter — 统一 API 网关
    OPENROUTER_API_KEY: Optional[str] = None
    OPENROUTER_BASE_URL: str = Field(default="https://openrouter.ai/api/v1")

    # DeepSeek official API — production chat modes
    DEEPSEEK_API_KEY: Optional[str] = None
    DEEPSEEK_BASE_URL: str = Field(default="https://api.deepseek.com")
    DEEPSEEK_OFFICIAL_MODELS: list[str] = Field(default=[
        "deepseek-v4-flash",
        "deepseek-v4-pro",
    ])

    # Embedding — 模型与维度强绑定 (通过 OpenRouter 调用)
    EMBEDDING_MODEL: str = Field(default="openai/text-embedding-3-small")
    EMBEDDING_DIM: int = Field(default=1536)

    # Qdrant
    QDRANT_URL: str = Field(default="http://localhost:6333")
    QDRANT_API_KEY: Optional[str] = None
    QDRANT_COLLECTION: str = Field(default="doc_chunks")

    # LLM defaults
    LLM_MODEL: str = Field(default="deepseek-v4-pro")
    ALLOWED_MODELS: list[str] = Field(default=[
        "deepseek-v4-flash",
        "deepseek-v4-pro",
        "deepseek/deepseek-v3.2",
        "mistralai/mistral-medium-3.1",
        "mistralai/mistral-large-2512",
        # Fallbacks
        "qwen/qwen3-30b-a3b",
        "mistralai/mistral-medium-3",
        "openai/gpt-5.2",
    ])

    # Object Storage (MinIO local / S3-compatible in production)
    MINIO_ENDPOINT: str = Field(default="localhost:9000")
    MINIO_ACCESS_KEY: str = Field(default="minioadmin")
    MINIO_SECRET_KEY: str = Field(default="minioadmin")
    MINIO_BUCKET: str = Field(default="doctalk-pdfs")
    MINIO_PRESIGN_TTL: int = Field(default=300)
    MINIO_SECURE: bool = Field(default=False)
    # Optional browser-facing endpoint used only for presigned file URLs.
    # Server-side upload/download should use MINIO_ENDPOINT, preferably via
    # Railway private networking in production.
    MINIO_PUBLIC_ENDPOINT: Optional[str] = None

    # Celery
    CELERY_BROKER_URL: str = Field(default="redis://localhost:6379/0")
    EMBED_BATCH_SIZE: int = Field(default=64)
    EMBED_MAX_CONCURRENCY: int = Field(default=4)

    # Limits
    MAX_PDF_SIZE_MB: int = Field(default=50)
    MAX_PDF_PAGES: int = Field(default=500)
    MAX_CHAT_HISTORY_TURNS: int = Field(default=6)
    MAX_RETRIEVAL_TOKENS: int = Field(default=1750)
    LLM_MAX_CONTEXT_TOKENS: int = Field(default=180000)
    MAX_CONTINUATIONS_PER_MESSAGE: int = 3

    # Chat-native tool planning. The planner may call the low-latency chat
    # model to classify ambiguous user requests, then falls back to the
    # deterministic router when the model or provider is unavailable.
    ACTION_PLANNER_USE_LLM: bool = Field(default=True)
    ACTION_PLANNER_TIMEOUT_SECONDS: float = Field(default=3.0)

    # Document Intelligence providers. Azure prebuilt-layout is the preferred
    # provider for PDF layout/table extraction; PyMuPDF remains the safe local
    # fallback when Azure is not configured or unavailable.
    DOCUMENT_INTELLIGENCE_PROVIDER: str = Field(default="azure")
    AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT: Optional[str] = None
    AZURE_DOCUMENT_INTELLIGENCE_KEY: Optional[str] = None
    DOCUMENT_INTELLIGENCE_TIMEOUT_SECONDS: int = Field(default=120)
    DOCUMENT_INTELLIGENCE_FALLBACK_PROVIDER: str = Field(default="pymupdf")

    # OCR
    OCR_ENABLED: bool = Field(default=True)
    OCR_LANGUAGES: str = Field(default="eng+chi_sim+jpn+kor+spa+deu+fra+por+ita+ara+hin+urd")
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

    # Demo LLM — faster model for anonymous demo conversations
    DEMO_LLM_MODEL: str = "deepseek-v4-flash"

    # Mode-based model selection.
    # Internal IDs are kept for backwards compatibility:
    # quick = Flash, balanced = Pro.
    MODE_MODELS: dict[str, str] = {
        "quick": "deepseek-v4-flash",
        "balanced": "deepseek-v4-pro",
    }
    MODE_CREDIT_MULTIPLIER: dict[str, float] = {
        "quick": 1.0,
        "balanced": 1.0,
    }
    PREMIUM_MODES: list[str] = Field(default=[])

    # Sentry
    SENTRY_DSN: Optional[str] = None
    SENTRY_ENVIRONMENT: str = Field(default="production")
    SENTRY_TRACES_SAMPLE_RATE: float = Field(default=0.1)

    # Stripe
    STRIPE_SECRET_KEY: Optional[str] = None
    STRIPE_WEBHOOK_SECRET: Optional[str] = None
    STRIPE_PRICE_BOOST: str = "price_boost"
    STRIPE_PRICE_POWER: str = "price_power"
    STRIPE_PRICE_ULTRA: str = "price_ultra"

    # Credit amounts
    CREDITS_BOOST: int = 500
    CREDITS_POWER: int = 2000
    CREDITS_ULTRA: int = 5000
    SIGNUP_BONUS_CREDITS: int = 500
    # Subscription tiers
    PLAN_FREE_MONTHLY_CREDITS: int = 300
    PLAN_PLUS_MONTHLY_CREDITS: int = 3000
    PLAN_PRO_MONTHLY_CREDITS: int = 9000
    # Legacy name kept for existing env vars; this now limits Free-plan Pro answers.
    FREE_BALANCED_MONTHLY_LIMIT: int = 20
    FREE_PRO_MONTHLY_LIMIT: Optional[int] = None
    STRIPE_PRICE_PLUS_MONTHLY: str = ''
    STRIPE_PRICE_PLUS_ANNUAL: str = ''
    STRIPE_PRICE_PRO_MONTHLY: str = ''
    STRIPE_PRICE_PRO_ANNUAL: str = ''

    # Per-plan limits
    FREE_MAX_DOCUMENTS: int = 3
    PLUS_MAX_DOCUMENTS: int = 20
    PRO_MAX_DOCUMENTS: int = 999
    FREE_MAX_SESSIONS_PER_DOC: int = 3
    # 25→50 (2026-06-12): the upload gate charged before any value was
    # experienced — the only payer converted at this wall and churned same-day.
    # Free matches Plus on size; differentiation stays on doc count/sessions/
    # credits/exports/layout translation.
    FREE_MAX_FILE_SIZE_MB: int = 50
    PLUS_MAX_FILE_SIZE_MB: int = 50
    PRO_MAX_FILE_SIZE_MB: int = 100

    # Collection limits per plan
    FREE_MAX_COLLECTIONS: int = 1
    PLUS_MAX_COLLECTIONS: int = 5
    PRO_MAX_COLLECTIONS: int = 999
    FREE_MAX_DOCS_PER_COLLECTION: int = 3
    PLUS_MAX_DOCS_PER_COLLECTION: int = 10
    PRO_MAX_DOCS_PER_COLLECTION: int = 999

    # Layout-preserving PDF translation. Free users get a small lifetime trial;
    # Plus/Pro users can run the workflow without this feature cap.
    FREE_LAYOUT_TRANSLATIONS_LIMIT: int = Field(default=2)
    FREE_LAYOUT_TRANSLATION_MAX_PAGES: int = Field(default=25)
    PLUS_LAYOUT_TRANSLATION_MAX_PAGES: int = Field(default=150)
    PRO_LAYOUT_TRANSLATION_MAX_PAGES: int = Field(default=300)
    LAYOUT_TRANSLATION_MAX_FILE_SIZE_MB: int = Field(default=50)
    LAYOUT_TRANSLATION_ENGINE: str = Field(default="retainpdf")
    RETAINPDF_API_BASE_URL: Optional[str] = None
    RETAINPDF_API_KEY: Optional[str] = None
    RETAINPDF_OCR_PROVIDER: str = Field(default="paddle")
    RETAINPDF_MINERU_TOKEN: Optional[str] = None
    RETAINPDF_PADDLE_TOKEN: Optional[str] = None
    RETAINPDF_DATALAB_TOKEN: Optional[str] = None
    RETAINPDF_DATALAB_API_URL: str = Field(default="https://www.datalab.to")
    RETAINPDF_DATALAB_MODE: str = Field(default="balanced")
    RETAINPDF_DATALAB_OUTPUT_FORMAT: str = Field(default="json,markdown")
    DATALAB_API_KEY: Optional[str] = None
    RETAINPDF_TRANSLATION_API_KEY: Optional[str] = None
    RETAINPDF_TRANSLATION_BASE_URL: str = Field(default="https://api.deepseek.com/v1")
    RETAINPDF_TRANSLATION_MODEL: str = Field(default="deepseek-v4-flash")
    RETAINPDF_POLL_INTERVAL_SECONDS: int = Field(default=5)
    RETAINPDF_TIMEOUT_SECONDS: int = Field(default=1800)
    RETAINPDF_WORKERS: int = Field(default=0)
    RETAINPDF_BATCH_SIZE: int = Field(default=1)
    RETAINPDF_CLASSIFY_BATCH_SIZE: int = Field(default=12)
    RETAINPDF_COMPILE_WORKERS: int = Field(default=0)

    # Admin access — comma-separated email list
    ADMIN_EMAILS: str = ""

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", case_sensitive=False, extra="ignore")


# Try to load .env from backend/ or repo root for local dev
_candidates = [Path(".env"), Path("..") / ".env"]
_env_file = next((str(p) for p in _candidates if p.exists()), None)

settings = Settings(_env_file=_env_file) if _env_file else Settings()

# Reverse lookup: model → mode (for enforcing correct credit multiplier)
MODEL_TO_MODE: dict[str, str] = {v: k for k, v in settings.MODE_MODELS.items()}

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
