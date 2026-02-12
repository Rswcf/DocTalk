from __future__ import annotations

import logging
import threading
import time
from functools import lru_cache
from typing import List, Optional

from openai import OpenAI
from qdrant_client import QdrantClient
from qdrant_client.models import Distance, VectorParams

from app.core.config import settings

logger = logging.getLogger(__name__)


class EmbeddingService:
    """Embedding + Qdrant collection utilities (config-driven).

    - Reads model/dim from settings
    - Provides batch embedding via OpenRouter (OpenAI-compatible)
    - Ensures Qdrant collection with exact vector dimension
    """

    def __init__(self) -> None:
        self.model: str = settings.EMBEDDING_MODEL
        self.dim: int = int(settings.EMBEDDING_DIM)
        self._client: Optional[OpenAI] = None
        self._lock = threading.Lock()

    # ---------------- Embedding -----------------
    def _get_client(self) -> OpenAI:
        if not settings.OPENROUTER_API_KEY:
            raise RuntimeError("OPENROUTER_API_KEY is not configured")
        if self._client is None:
            with self._lock:
                if self._client is None:
                    self._client = OpenAI(
                        api_key=settings.OPENROUTER_API_KEY,
                        base_url=settings.OPENROUTER_BASE_URL,
                    )
        return self._client

    def embed_texts(self, texts: List[str], *, _max_retries: int = 3) -> List[List[float]]:
        """Return embeddings for a list of texts (order-preserving).

        Retries with exponential backoff on transient failures (e.g. OpenRouter
        returning HTTP 200 with empty data).
        """
        if not texts:
            return []
        client = self._get_client()
        last_exc: Exception | None = None
        for attempt in range(_max_retries):
            try:
                resp = client.embeddings.create(model=self.model, input=texts)
                vectors: List[List[float]] = [d.embedding for d in resp.data]
                if not vectors:
                    raise ValueError("Empty embedding response")
                return vectors
            except (ValueError, Exception) as exc:
                last_exc = exc
                wait = 2 ** attempt  # 1s, 2s, 4s
                logger.warning(
                    "Embedding attempt %d/%d failed (%d texts): %s — retrying in %ds",
                    attempt + 1, _max_retries, len(texts), exc, wait,
                )
                time.sleep(wait)
        raise last_exc  # type: ignore[misc]

    # ---------------- Qdrant -----------------
    @lru_cache(maxsize=1)
    def get_qdrant_client(self) -> QdrantClient:
        return QdrantClient(
            url=settings.QDRANT_URL,
            api_key=settings.QDRANT_API_KEY or None,
        )

    def ensure_collection(self) -> None:
        """Validate or create the Qdrant collection with configured dimension.

        - If exists but dimension mismatches, raise RuntimeError
        - If not exists, create with cosine distance
        """
        client = self.get_qdrant_client()
        name = settings.QDRANT_COLLECTION
        if not name:
            raise RuntimeError("QDRANT_COLLECTION is not configured")

        existing = client.get_collections()
        exists = any(c.name == name for c in existing.collections)
        if exists:
            info = client.get_collection(name)
            # Newer qdrant-client exposes vectors config under .config.params
            configured = None
            try:
                configured = int(info.config.params.vectors.size)  # type: ignore[attr-defined]
            except Exception:
                # Fallback for older clients
                try:
                    configured = int(info.vectors_count)  # not accurate size, but keep for compatibility
                except Exception:
                    configured = None
            if configured is not None and configured != self.dim:
                raise RuntimeError(
                    f"Qdrant collection '{name}' dimension mismatch: {configured} != {self.dim}"
                )
            return

        # Create collection
        client.create_collection(
            collection_name=name,
            vectors_config=VectorParams(size=self.dim, distance=Distance.COSINE),
        )


# Singleton instance for app and workers
embedding_service = EmbeddingService()

