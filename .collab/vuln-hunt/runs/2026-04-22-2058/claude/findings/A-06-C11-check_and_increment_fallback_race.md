---
id: A-06-C11-01
matrix: A
agent: claude
cell_id: A-06-C11
row_key: demo_plane
column_key: concurrency_toctou
finding_key: check_and_increment_fallback_race
severity: P2
confidence: medium
status: bug
files:
  - "backend/app/core/rate_limit.py:210"
  - "backend/app/core/rate_limit.py:227"
exploit_preconditions:
  - "Redis unavailable (fallback path)"
  - "attacker fires concurrent requests from one IP"
---

## Observation
`RedisDemoTracker.check_and_increment` fallback path (`rate_limit.py:210-215` and `227-232`):

```python
current = self._fallback.get_count(key)
if current >= limit:
    return False, current
self._fallback.increment(key)  # ← not atomic with the get_count above
return True, current + 1
```

The `get_count` + conditional `increment` is not atomic. Two concurrent coroutines on the same event loop can both read `current=4` (when limit=5), both proceed past the `>= limit` check, both call `increment`, and both return `allowed=True`. Net result: count jumps to 6 when only 5 were allowed.

Similar race in `InMemoryRateLimiter.is_allowed` (`rate_limit.py:77-83`) — read bucket length, append timestamp, no lock.

## Impact
During Redis fallback (see A-06-C06), this race lets anonymous users consume slightly more than their configured limit per IP. Combined with A-06-C06 (N replicas × M slippage per replica), the demo plane can admit significantly more traffic than intended.

Severity is P2 because:
- Only active during Redis outage
- Requires concurrent request burst (not trivial from one client but achievable with HTTP/2 or several parallel tabs)
- Slippage is bounded (race window ≈ µs to ms)

## Repro / Evidence
Unit-testable:
```python
async def test_race():
    tracker = InMemoryDemoMessageTracker()
    # Concurrent check_and_increment from same key
    results = await asyncio.gather(*[
        check_and_increment_fallback_path(tracker, "ip", limit=5)
        for _ in range(10)
    ])
    # With race, >5 can return allowed=True
```

## Suggested Fix
Wrap fallback state with `asyncio.Lock` per key (or one global lock for simplicity — demo fallback shouldn't see high QPS):

```python
class InMemoryDemoMessageTracker:
    def __init__(self):
        self._counts: dict[str, int] = {}
        self._lock = asyncio.Lock()

    async def check_and_increment(self, key, limit):
        async with self._lock:
            current = self._counts.get(key, 0)
            if current >= limit:
                return False, current
            self._counts[key] = current + 1
            return True, current + 1
```

Also consider: when Redis is unavailable and this limiter is `fail_closed=True` (fix recommended in A-06-C06), this race becomes moot.
