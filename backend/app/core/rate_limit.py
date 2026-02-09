"""Simple in-memory rate limiter for anonymous demo endpoints."""

from __future__ import annotations

import time
from collections import defaultdict

from app.core.security_log import log_security_event


class RateLimiter:
    """Token-bucket style rate limiter keyed by arbitrary string (e.g. IP)."""

    def __init__(self, max_requests: int = 10, window_seconds: int = 60):
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self._buckets: dict[str, list[float]] = defaultdict(list)

    def is_allowed(self, key: str) -> bool:
        now = time.time()
        # Prevent unbounded memory growth from unique IPs
        if len(self._buckets) > 10000:
            self._buckets = defaultdict(list, {
                k: [t for t in v if now - t < self.window_seconds]
                for k, v in self._buckets.items()
            })
            self._buckets = defaultdict(list, {k: v for k, v in self._buckets.items() if v})
        bucket = self._buckets[key]
        # Clean old entries for this key
        self._buckets[key] = [t for t in bucket if now - t < self.window_seconds]
        if len(self._buckets[key]) >= self.max_requests:
            log_security_event("rate_limit_hit", key=key, max_requests=self.max_requests)
            return False
        self._buckets[key].append(now)
        return True


demo_chat_limiter = RateLimiter(max_requests=10, window_seconds=60)
