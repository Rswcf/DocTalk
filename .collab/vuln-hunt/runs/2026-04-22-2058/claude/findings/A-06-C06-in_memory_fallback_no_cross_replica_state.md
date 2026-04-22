---
id: A-06-C06-01
matrix: A
agent: claude
cell_id: A-06-C06
row_key: demo_plane
column_key: rate_limit_abuse
finding_key: in_memory_fallback_no_cross_replica_state
severity: P1
confidence: high
status: bug
files:
  - "backend/app/core/rate_limit.py:147"
  - "backend/app/core/rate_limit.py:152"
  - "backend/app/core/rate_limit.py:227"
exploit_preconditions:
  - "Railway deployment with N>=2 backend replicas"
  - "Redis briefly unavailable OR permanently misconfigured"
---

## Observation
`RedisRateLimiter` (`rate_limit.py:140-165`) uses `InMemoryRateLimiter` as fallback when Redis is unreachable. The fallback is per-process (`self._fallback = InMemoryRateLimiter(...)`), so counters live in each replica's local memory and never synchronize.

The same pattern applies to `demo_message_tracker` (used for the 5-msg demo limit), `demo_chat_limiter` (10/min/IP), `auth_chat_limiter` (30/min/user), `demo_session_create_limiter`, `shared_view_limiter`, `anon_read_limiter`.

## Impact
When Redis is down AND the backend runs N replicas (Railway auto-scales; Production currently runs 1 but may scale up), effective rate limits multiply by N:
- Demo message limit: 5 msgs → 5×N msgs per attacker
- Anon chat rate limit: 10/min → 10×N/min per attacker
- Demo session create: 5/5min → 5×N/5min

Worse: `_REDIS_RETRY_SECONDS=30` means during a Redis restart (common during Railway maintenance), the fallback is active for 30s windows. An attacker who knows this timing can wait for Redis failures or trigger ones via connection exhaustion.

The limits exist specifically to prevent demo abuse + LLM cost amplification. Bypassing them = free infinite chats against `DEMO_LLM_MODEL`, which in turn costs real money at OpenRouter.

## Repro / Evidence
1. Scale backend to 2 replicas (Railway → Settings → Replicas).
2. Disconnect Redis (kill container or block network).
3. Send concurrent requests from same IP; observe allowed count ≈ 2× configured limit.

Also: the fallback pattern is silent to the user — only an `ERROR`-level log + throttled Sentry alert. Ops visibility depends on alert routing.

## Suggested Fix
Two-pronged:

1. **Hard-fail mode for rate-critical namespaces**: add a `fail_closed: bool` flag to `RedisRateLimiter`. For `demo_chat_limiter` + `demo_message_tracker` + `demo_session_create_limiter` (all anonymous-plane limits), set `fail_closed=True` so requests are rejected (503) when Redis is down rather than admitted via unsafe fallback.

2. **Prometheus/Sentry metric on replica count**: if the app detects it has peers (via Redis keyspace notifications or a periodic heartbeat) and is in fallback mode, escalate alerts immediately rather than waiting for `_SENTRY_ALERT_INTERVAL_SECONDS=600`.

Authenticated-user limits (`auth_chat_limiter`) can stay `fail_open` since authenticated traffic is billed via credits regardless.
