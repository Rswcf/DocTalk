#!/usr/bin/env python3
"""Live Redis rate-limit smoke for DocTalk.

The script refuses to run against non-local Redis URLs. It exercises the
project's Redis-backed limiter classes directly without sending high-volume
traffic to production or local HTTP endpoints.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import sys
import time
from pathlib import Path
from types import SimpleNamespace
from typing import Any
from urllib.parse import urlparse

import redis.asyncio as redis

REPO_ROOT = Path(__file__).resolve().parents[2]
BACKEND_ROOT = REPO_ROOT / "backend"
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.core.config import settings  # noqa: E402
from app.core.rate_limit import (  # noqa: E402
    RedisDemoTracker,
    RedisRateLimiter,
    get_client_ip,
)

LOCAL_REDIS_HOSTS = {"localhost", "127.0.0.1", "::1"}


def check(condition: bool, name: str, checks: list[dict[str, Any]], **details: Any) -> None:
    checks.append(
        {
            "name": name,
            "result": "pass" if condition else "fail",
            "details": details,
        }
    )


async def delete_namespace(client: redis.Redis, namespace: str) -> int:
    deleted = 0
    async for key in client.scan_iter(f"{namespace}:*"):
        deleted += await client.delete(key)
    return deleted


def require_local_redis(redis_url: str) -> None:
    parsed = urlparse(redis_url)
    host = parsed.hostname
    if parsed.scheme not in {"redis", "rediss"} or host not in LOCAL_REDIS_HOSTS:
        raise SystemExit(
            f"Refusing to run Redis soak against non-local URL: {redis_url!r}. "
            "Use a localhost Redis instance."
        )


async def run(redis_url: str) -> dict[str, Any]:
    require_local_redis(redis_url)
    settings.CELERY_BROKER_URL = redis_url
    checks: list[dict[str, Any]] = []
    started = time.strftime("%Y%m%d%H%M%S")
    namespace = f"qa_rate_limit_soak:{started}"
    client = redis.from_url(redis_url, decode_responses=True)
    await client.ping()

    cleanup_before = await delete_namespace(client, namespace)
    try:
        limiter = RedisRateLimiter(namespace=namespace, max_requests=3, window_seconds=2)
        key = "client-a"
        observed = [await limiter.is_allowed(key) for _ in range(4)]
        redis_key = f"{namespace}:{key}"
        count_after_denial = await client.get(redis_key)
        ttl_after_denial = await client.ttl(redis_key)
        check(
            observed == [True, True, True, False],
            "redis_limiter_enforces_window_limit",
            checks,
            observed=observed,
            redis_count=count_after_denial,
            ttl=ttl_after_denial,
        )

        other_key_allowed = await limiter.is_allowed("client-b")
        check(
            other_key_allowed is True,
            "redis_limiter_isolates_keys",
            checks,
            client_b_allowed=other_key_allowed,
        )

        await asyncio.sleep(2.2)
        allowed_after_ttl = await limiter.is_allowed(key)
        count_after_ttl = await client.get(redis_key)
        check(
            allowed_after_ttl is True and count_after_ttl == "1",
            "redis_limiter_resets_after_ttl",
            checks,
            allowed_after_ttl=allowed_after_ttl,
            redis_count=count_after_ttl,
        )

        shared_namespace = f"{namespace}:shared"
        limiter_a = RedisRateLimiter(namespace=shared_namespace, max_requests=2, window_seconds=30)
        limiter_b = RedisRateLimiter(namespace=shared_namespace, max_requests=2, window_seconds=30)
        shared_observed = [
            await limiter_a.is_allowed("shared-client"),
            await limiter_a.is_allowed("shared-client"),
            await limiter_b.is_allowed("shared-client"),
        ]
        check(
            shared_observed == [True, True, False],
            "redis_limiter_state_shared_across_instances",
            checks,
            observed=shared_observed,
        )

        tracker_namespace = f"{namespace}:demo_tracker"
        tracker = RedisDemoTracker(namespace=tracker_namespace, ttl_seconds=30)
        tracker_key = "demo-session"
        tracker_observed = [
            await tracker.check_and_increment(tracker_key, limit=2),
            await tracker.check_and_increment(tracker_key, limit=2),
            await tracker.check_and_increment(tracker_key, limit=2),
        ]
        tracker_count = await client.get(f"{tracker_namespace}:{tracker_key}")
        check(
            tracker_observed == [(True, 1), (True, 2), (False, 2)] and tracker_count == "2",
            "redis_demo_tracker_limit_is_atomic_and_decrements_denied_increment",
            checks,
            observed=tracker_observed,
            redis_count=tracker_count,
        )

        original_auth_secret = settings.AUTH_SECRET
        settings.AUTH_SECRET = "qa-proxy-secret"
        try:
            trusted_request = SimpleNamespace(
                headers={
                    "x-real-client-ip": "203.0.113.9",
                    "x-proxy-ip-secret": "qa-proxy-secret",
                },
                client=SimpleNamespace(host="127.0.0.1"),
            )
            untrusted_request = SimpleNamespace(
                headers={
                    "x-real-client-ip": "203.0.113.10",
                    "x-proxy-ip-secret": "wrong",
                },
                client=SimpleNamespace(host="127.0.0.1"),
            )
            check(
                get_client_ip(trusted_request) == "203.0.113.9"
                and get_client_ip(untrusted_request) == "127.0.0.1",
                "client_ip_uses_hmac_signed_proxy_header_only",
                checks,
                trusted_ip=get_client_ip(trusted_request),
                untrusted_ip=get_client_ip(untrusted_request),
            )
        finally:
            settings.AUTH_SECRET = original_auth_secret
    finally:
        cleanup_after = await delete_namespace(client, namespace)
        await client.aclose()

    failed = [item for item in checks if item["result"] != "pass"]
    return {
        "run": "qa-rate-limit-redis-soak",
        "redis_url": redis_url,
        "status": "fail" if failed else "pass",
        "checks": checks,
        "cleanup": {
            "deleted_before": cleanup_before,
            "deleted_after": cleanup_after,
        },
    }


async def async_main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--redis-url", default=settings.CELERY_BROKER_URL)
    parser.add_argument("--json-out", required=True)
    args = parser.parse_args()

    result = await run(args.redis_url)
    out = Path(args.json_out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(result, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    passed = sum(1 for item in result["checks"] if item["result"] == "pass")
    total = len(result["checks"])
    print(f"RATE_LIMIT_REDIS_SOAK {result['status']}: {passed}/{total} checks")
    return 0 if result["status"] == "pass" else 1


def main() -> int:
    return asyncio.run(async_main())


if __name__ == "__main__":
    raise SystemExit(main())
