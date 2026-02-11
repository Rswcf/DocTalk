"""Simple in-memory rate limiter for chat endpoints."""

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
auth_chat_limiter = RateLimiter(max_requests=30, window_seconds=60)


class DemoMessageTracker:
    """Track total demo messages per IP+document (in-memory).

    Survives session recreation — prevents bypassing the 5-message demo limit
    by hard-refreshing the page (which creates a new session).
    """

    def __init__(self) -> None:
        self._counts: dict[str, int] = {}

    def get_count(self, key: str) -> int:
        return self._counts.get(key, 0)

    def increment(self, key: str) -> None:
        # Auto-cleanup when dict grows too large (same pattern as RateLimiter)
        if len(self._counts) > 10_000:
            self._counts.clear()
        self._counts[key] = self._counts.get(key, 0) + 1


demo_message_tracker = DemoMessageTracker()
