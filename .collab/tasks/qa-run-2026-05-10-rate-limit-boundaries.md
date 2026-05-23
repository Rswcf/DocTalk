# QA Run - Rate Limit Boundaries - 2026-05-10

Scope: broaden rate-limit verification without hammering production. This run uses existing backend tests that monkeypatch limiters into denied states and validates the API error contract.

## Command

```bash
cd backend && python3 -m pytest \
  tests/test_events_api.py tests/test_error_taxonomy.py \
  -k 'rate_limit or rate_limited or demo_message_limit' -v
```

## Result

Status: **pass**. 7 selected tests passed.

| Case | Expected | Result |
|---|---|---|
| Public product event rate limit | 429 | Pass |
| Demo session creation rate limit | 429 `DEMO_SESSION_RATE_LIMITED` | Pass |
| Authenticated chat rate limit | 429 `RATE_LIMITED` | Pass |
| Demo chat rate limit | 429 `RATE_LIMITED` | Pass |
| Demo message quota reached | 429 `DEMO_MESSAGE_LIMIT_REACHED` | Pass |
| Anonymous document search rate limit | 429 `RATE_LIMITED` | Pass |
| Anonymous chunk read rate limit | 429 `RATE_LIMITED` | Pass |

Pytest output:

```text
7 passed, 44 deselected
```

## Coverage Notes

The verified limiter surfaces are:

- `public_event_limiter` via `/api/events`
- `demo_session_create_limiter` via demo session creation
- `demo_chat_limiter` and `auth_chat_limiter` via chat endpoints
- demo message tracker quota
- `anon_read_limiter` via document search and chunk reads

## Remaining Gap

This is contract-level coverage, not a live Redis soak. A future integration run should exercise actual Redis counters across multiple requests and, ideally, multiple backend replicas.
