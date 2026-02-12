"""Redis-backed rate limiter and demo message tracker with in-memory fallback."""

from __future__ import annotations

import logging
import time
from collections import defaultdict

import redis.asyncio as redis

from app.core.config import settings
from app.core.security_log import log_security_event

logger = logging.getLogger(__name__)

_REDIS_RETRY_SECONDS = 30
_DEMO_COUNTER_TTL_SECONDS = 24 * 60 * 60


class InMemoryRateLimiter:
    """Token-bucket style in-memory rate limiter keyed by arbitrary string."""

    def __init__(self, max_requests: int = 10, window_seconds: int = 60):
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self._buckets: dict[str, list[float]] = defaultdict(list)

    def is_allowed(self, key: str) -> bool:
        now = time.time()
        if len(self._buckets) > 10000:
            self._buckets = defaultdict(list, {
                k: [t for t in v if now - t < self.window_seconds]
                for k, v in self._buckets.items()
            })
            self._buckets = defaultdict(list, {k: v for k, v in self._buckets.items() if v})
        bucket = self._buckets[key]
        self._buckets[key] = [t for t in bucket if now - t < self.window_seconds]
        if len(self._buckets[key]) >= self.max_requests:
            log_security_event("rate_limit_hit", key=key, max_requests=self.max_requests)
            return False
        self._buckets[key].append(now)
        return True


class InMemoryDemoMessageTracker:
    """In-memory fallback tracker for demo message counts."""

    def __init__(self) -> None:
        self._counts: dict[str, int] = {}

    def get_count(self, key: str) -> int:
        return self._counts.get(key, 0)

    def increment(self, key: str) -> None:
        if len(self._counts) > 10_000:
            self._counts.clear()
        self._counts[key] = self._counts.get(key, 0) + 1


class _RedisClientMixin:
    def __init__(self, *, namespace: str):
        self._namespace = namespace
        self._redis_url = settings.CELERY_BROKER_URL
        self._redis_client: redis.Redis | None = None
        self._next_retry_at = 0.0

    async def _get_client(self) -> redis.Redis | None:
        now = time.time()
        if self._redis_client is not None:
            return self._redis_client
        if now < self._next_retry_at:
            return None
        try:
            self._redis_client = redis.from_url(self._redis_url, decode_responses=True)
            await self._redis_client.ping()
            return self._redis_client
        except Exception as e:
            logger.warning("Redis unavailable for %s; using in-memory fallback: %s", self._namespace, e)
            self._next_retry_at = now + _REDIS_RETRY_SECONDS
            if self._redis_client is not None:
                try:
                    await self._redis_client.aclose()
                except Exception:
                    pass
            self._redis_client = None
            return None

    async def _reset_client(self, error: Exception) -> None:
        logger.warning("Redis error for %s; using in-memory fallback: %s", self._namespace, error)
        self._next_retry_at = time.time() + _REDIS_RETRY_SECONDS
        if self._redis_client is not None:
            try:
                await self._redis_client.aclose()
            except Exception:
                pass
        self._redis_client = None


class RedisRateLimiter(_RedisClientMixin):
    """Redis-backed rate limiter using atomic INCR + EXPIRE."""

    def __init__(self, *, namespace: str, max_requests: int, window_seconds: int):
        super().__init__(namespace=namespace)
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self._fallback = InMemoryRateLimiter(max_requests=max_requests, window_seconds=window_seconds)

    async def is_allowed(self, key: str) -> bool:
        client = await self._get_client()
        if client is None:
            return self._fallback.is_allowed(key)

        redis_key = f"{self._namespace}:{key}"
        try:
            count = await client.incr(redis_key)
            if count == 1:
                await client.expire(redis_key, self.window_seconds)
            if count > self.max_requests:
                log_security_event("rate_limit_hit", key=key, max_requests=self.max_requests)
                return False
            return True
        except Exception as e:
            await self._reset_client(e)
            return self._fallback.is_allowed(key)


class RedisDemoTracker(_RedisClientMixin):
    """Redis-backed demo message counter using INCR + EXPIRE."""

    def __init__(self, *, namespace: str, ttl_seconds: int = _DEMO_COUNTER_TTL_SECONDS):
        super().__init__(namespace=namespace)
        self.ttl_seconds = ttl_seconds
        self._fallback = InMemoryDemoMessageTracker()

    async def get_count(self, key: str) -> int:
        client = await self._get_client()
        if client is None:
            return self._fallback.get_count(key)

        redis_key = f"{self._namespace}:{key}"
        try:
            value = await client.get(redis_key)
            return int(value or 0)
        except Exception as e:
            await self._reset_client(e)
            return self._fallback.get_count(key)

    async def increment(self, key: str) -> None:
        client = await self._get_client()
        if client is None:
            self._fallback.increment(key)
            return

        redis_key = f"{self._namespace}:{key}"
        try:
            count = await client.incr(redis_key)
            if count == 1:
                await client.expire(redis_key, self.ttl_seconds)
        except Exception as e:
            await self._reset_client(e)
            self._fallback.increment(key)


demo_chat_limiter = RedisRateLimiter(namespace="rate_limit:demo_chat", max_requests=10, window_seconds=60)
auth_chat_limiter = RedisRateLimiter(namespace="rate_limit:auth_chat", max_requests=30, window_seconds=60)
demo_message_tracker = RedisDemoTracker(namespace="rate_limit:demo_messages")
