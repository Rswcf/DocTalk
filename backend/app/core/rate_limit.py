"""Redis-backed rate limiter and demo message tracker with in-memory fallback."""

from __future__ import annotations

import hmac
import logging
import time
from collections import defaultdict
from typing import TYPE_CHECKING

import redis.asyncio as redis

from app.core.config import settings
from app.core.security_log import log_security_event

if TYPE_CHECKING:
    from fastapi import Request

logger = logging.getLogger(__name__)

_REDIS_RETRY_SECONDS = 30
_DEMO_COUNTER_TTL_SECONDS = 24 * 60 * 60
_SENTRY_ALERT_INTERVAL_SECONDS = 600  # 10 min between Sentry events per namespace

# Per-namespace throttle for Sentry capture. Log every fallback, but only
# forward to Sentry once every _SENTRY_ALERT_INTERVAL_SECONDS so a prolonged
# outage doesn't burn through Sentry's monthly quota (4 namespaces × 30s
# reconnect cadence would otherwise = ~11k events/day).
_last_sentry_alert_at: dict[str, float] = {}


def _alert_redis_fallback(namespace: str, exc: Exception) -> None:
    """Log Redis fallback at error level and send to Sentry if configured.

    Log volume: one per failed reconnect (~2/min/namespace worst case).
    Sentry volume: one per namespace per _SENTRY_ALERT_INTERVAL_SECONDS.
    In-memory fallback means counts reset on restart and do NOT share state
    across replicas — this is a real correctness alert, not a noisy warning.
    """
    logger.error(
        "Redis unavailable for %s; using in-memory fallback (counts will not persist): %s",
        namespace, exc,
    )
    if not settings.SENTRY_DSN:
        return
    now = time.time()
    last = _last_sentry_alert_at.get(namespace, 0.0)
    if now - last < _SENTRY_ALERT_INTERVAL_SECONDS:
        return
    _last_sentry_alert_at[namespace] = now
    try:
        import sentry_sdk
        with sentry_sdk.push_scope() as scope:
            scope.set_tag("redis_namespace", namespace)
            scope.set_tag("degraded", "redis_fallback")
            sentry_sdk.capture_exception(exc)
    except Exception:
        pass


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
            _alert_redis_fallback(self._namespace, e)
            self._next_retry_at = now + _REDIS_RETRY_SECONDS
            if self._redis_client is not None:
                try:
                    await self._redis_client.aclose()
                except Exception:
                    pass
            self._redis_client = None
            return None

    async def _reset_client(self, error: Exception) -> None:
        _alert_redis_fallback(self._namespace, error)
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

    async def check_and_increment(self, key: str, limit: int) -> tuple[bool, int]:
        """Atomically increment counter and check against limit.

        Returns (allowed, current_count). If over limit, decrements back.
        """
        client = await self._get_client()
        if client is None:
            current = self._fallback.get_count(key)
            if current >= limit:
                return False, current
            self._fallback.increment(key)
            return True, current + 1

        redis_key = f"{self._namespace}:{key}"
        try:
            count = await client.incr(redis_key)
            if count == 1:
                await client.expire(redis_key, self.ttl_seconds)
            if count > limit:
                await client.decr(redis_key)
                return False, limit
            return True, int(count)
        except Exception as e:
            await self._reset_client(e)
            current = self._fallback.get_count(key)
            if current >= limit:
                return False, current
            self._fallback.increment(key)
            return True, current + 1


demo_chat_limiter = RedisRateLimiter(namespace="rate_limit:demo_chat", max_requests=10, window_seconds=60)
auth_chat_limiter = RedisRateLimiter(namespace="rate_limit:auth_chat", max_requests=30, window_seconds=60)
demo_message_tracker = RedisDemoTracker(namespace="rate_limit:demo_messages")
demo_session_create_limiter = RedisRateLimiter(
    namespace="rate_limit:demo_session_create", max_requests=5, window_seconds=300
)
# Public shared-view endpoint — anonymous, unauthenticated. Limit per IP to prevent
# token enumeration and traffic amplification. 60/min is generous for legitimate
# users refreshing but blocks brute-force UUID scanning.
shared_view_limiter = RedisRateLimiter(
    namespace="rate_limit:shared_view", max_requests=60, window_seconds=60
)
# Anonymous read endpoints for demo documents (search, chunk detail). Gated
# behind can_access_document so logged-in traffic bypasses this limiter.
anon_read_limiter = RedisRateLimiter(
    namespace="rate_limit:anon_read", max_requests=120, window_seconds=60
)
public_event_limiter = RedisRateLimiter(
    namespace="rate_limit:public_events", max_requests=30, window_seconds=60
)


# Pre-encode signing secrets once at import time. hmac.new() requires bytes,
# and re-encoding per-request is wasteful. Re-read at call time would re-import
# settings, which is unnecessary because the process is restarted on env change.
_ADAPTER_SECRET_BYTES: bytes = (settings.ADAPTER_SECRET or "").encode("utf-8")

# Max clock skew accepted on the new HMAC contract. 60s covers NTP drift between
# Vercel and Railway while keeping the replay window narrow. The signature is
# bound to a per-request unix timestamp so deterministic-bucket replay (the bug
# Codex caught in R3) is impossible.
_MAX_SIGNED_IP_SKEW_S = 60


def verify_signed_ip(
    *,
    ip: str | None,
    ts: str | None,
    sig: str | None,
    now: float | None = None,
    max_skew_s: int = _MAX_SIGNED_IP_SKEW_S,
) -> tuple[bool, str | None]:
    """Verify the triple-header HMAC IP claim emitted by the frontend proxy.

    Contract:
      X-Proxy-IP:     <ip>
      X-Proxy-IP-Ts:  <unix_seconds>
      X-Proxy-IP-Sig: hex(HMAC-SHA256(ADAPTER_SECRET, "{ip}:{ts}"))

    Returns (ok, reason). `reason` is a short tag suitable for log fields when
    `ok` is False; on success it is None.
    """
    if not ip or not ts or not sig:
        return False, "missing_headers"
    if not _ADAPTER_SECRET_BYTES:
        return False, "no_adapter_secret"
    try:
        ts_int = int(ts)
    except (TypeError, ValueError):
        return False, "malformed_ts"
    current = now if now is not None else time.time()
    skew = abs(current - ts_int)
    if skew > max_skew_s:
        return False, "skew_exceeded"
    expected = hmac.new(
        _ADAPTER_SECRET_BYTES,
        f"{ip}:{ts_int}".encode("utf-8"),
        digestmod="sha256",
    ).hexdigest()
    if not hmac.compare_digest(expected, sig):
        return False, "bad_signature"
    return True, None


def get_client_ip(request: "Request") -> str:
    """Extract real client IP from the trusted Vercel proxy.

    Contract: triple-header HMAC.
      X-Proxy-IP / X-Proxy-IP-Ts / X-Proxy-IP-Sig signed with ADAPTER_SECRET.

    Falls back to request.client.host for direct access (dev/testing). Never
    trust raw X-Forwarded-For. (The legacy X-Proxy-IP-Secret/AUTH_SECRET
    dual-accept path was removed 2026-05-24, 24h after the HMAC rollout with
    zero proxy.signed_ip.legacy_path_used — C1 follow-up.)
    """
    # New contract — prefer this when present.
    new_ip = request.headers.get("x-proxy-ip")
    new_ts = request.headers.get("x-proxy-ip-ts")
    new_sig = request.headers.get("x-proxy-ip-sig")
    if new_ip or new_ts or new_sig:
        ok, reason = verify_signed_ip(ip=new_ip, ts=new_ts, sig=new_sig)
        if ok:
            return new_ip.strip()  # type: ignore[union-attr]
        # Compute skew for logging (best-effort; never raise).
        skew_s: float | None = None
        if new_ts:
            try:
                skew_s = abs(time.time() - int(new_ts))
            except (TypeError, ValueError):
                skew_s = None
        logger.warning(
            "proxy.signed_ip.verification_failed",
            extra={
                "reason": reason,
                "claimed_ip": new_ip,
                "skew_s": skew_s,
            },
        )
        # Do NOT trust the claimed IP on failure; fall back to the connection host.

    return request.client.host if request.client else "unknown"
