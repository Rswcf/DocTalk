"""Thin Redis cache helpers with graceful no-cache fallback."""

from __future__ import annotations

import json
import logging
import time
from typing import Any

import redis.asyncio as redis

from app.core.config import settings

logger = logging.getLogger(__name__)

_CACHE_PREFIX = "cache:"
_RETRY_SECONDS = 30

_redis_client: redis.Redis | None = None
_next_retry_at = 0.0


async def _get_client() -> redis.Redis | None:
    global _next_retry_at
    global _redis_client

    if _redis_client is not None:
        return _redis_client

    now = time.time()
    if now < _next_retry_at:
        return None

    try:
        _redis_client = redis.from_url(settings.CELERY_BROKER_URL, decode_responses=True)
        await _redis_client.ping()
        return _redis_client
    except Exception as e:
        logger.warning("Redis cache unavailable; caching disabled temporarily: %s", e)
        _next_retry_at = now + _RETRY_SECONDS
        if _redis_client is not None:
            try:
                await _redis_client.aclose()
            except Exception:
                pass
        _redis_client = None
        return None


async def _reset_client(error: Exception) -> None:
    global _next_retry_at
    global _redis_client

    logger.warning("Redis cache error; falling back to uncached path: %s", error)
    _next_retry_at = time.time() + _RETRY_SECONDS
    if _redis_client is not None:
        try:
            await _redis_client.aclose()
        except Exception:
            pass
    _redis_client = None


async def cache_get(key: str) -> Any | None:
    client = await _get_client()
    if client is None:
        return None

    try:
        raw = await client.get(f"{_CACHE_PREFIX}{key}")
        if raw is None:
            return None
        return json.loads(raw)
    except Exception as e:
        await _reset_client(e)
        return None


async def cache_set(key: str, value: Any, ttl_seconds: int) -> None:
    client = await _get_client()
    if client is None:
        return

    try:
        payload = json.dumps(value, ensure_ascii=False)
        await client.setex(f"{_CACHE_PREFIX}{key}", ttl_seconds, payload)
    except Exception as e:
        await _reset_client(e)


async def cache_delete(key: str) -> None:
    client = await _get_client()
    if client is None:
        return

    try:
        await client.delete(f"{_CACHE_PREFIX}{key}")
    except Exception as e:
        await _reset_client(e)


async def cache_delete_pattern(pattern: str) -> int:
    client = await _get_client()
    if client is None:
        return 0

    try:
        deleted = 0
        async for redis_key in client.scan_iter(match=f"{_CACHE_PREFIX}{pattern}"):
            deleted += await client.delete(redis_key)
        return deleted
    except Exception as e:
        await _reset_client(e)
        return 0
