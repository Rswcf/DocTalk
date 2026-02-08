"""Simple in-memory rate limiter for anonymous demo endpoints."""

from __future__ import annotations

import time
from collections import defaultdict


class RateLimiter:
    """Token-bucket style rate limiter keyed by arbitrary string (e.g. IP)."""

    def __init__(self, max_requests: int = 10, window_seconds: int = 60):
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self._buckets: dict[str, list[float]] = defaultdict(list)

    def is_allowed(self, key: str) -> bool:
        now = time.time()
        bucket = self._buckets[key]
        # Clean old entries
        self._buckets[key] = [t for t in bucket if now - t < self.window_seconds]
        if len(self._buckets[key]) >= self.max_requests:
            return False
        self._buckets[key].append(now)
        return True


demo_chat_limiter = RateLimiter(max_requests=10, window_seconds=60)
