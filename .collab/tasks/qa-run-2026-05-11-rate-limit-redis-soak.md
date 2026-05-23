# QA Run - Live Redis Rate-Limit Soak - 2026-05-11

Scope: verify actual Redis-backed limiter behavior locally, beyond monkeypatched 429 contract tests. The script refuses non-local Redis URLs and does not hit production.

## Environment

| Item | Value |
|---|---|
| Redis | `redis://localhost:6379/0`, Docker `doctalk-redis` |
| Harness | `.collab/scripts/qa_rate_limit_redis_soak.py` |
| Raw JSON | `.collab/tasks/qa-rate-limit-redis-soak-2026-05-11.json` |

## Command

```bash
python3 .collab/scripts/qa_rate_limit_redis_soak.py \
  --json-out .collab/tasks/qa-rate-limit-redis-soak-2026-05-11.json
```

## Result

Status: **pass**. 6/6 checks passed.

| Check | Result |
|---|---|
| Redis limiter enforces window limit | Pass |
| Redis limiter isolates keys | Pass |
| Redis limiter resets after TTL | Pass |
| Redis limiter state is shared across limiter instances | Pass |
| Demo message tracker atomically decrements denied increment | Pass |
| Client IP trusts only HMAC-signed proxy headers | Pass |

Cleanup deleted the temporary Redis keys created for the run.

## Remaining Gap

This validates a real local Redis backend and shared state across limiter instances in one process. It does not prove multi-replica production behavior under Railway load; that remains a later environment-level soak.

