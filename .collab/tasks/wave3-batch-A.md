Implemented all 8 Batch A backend fixes in the required order:

- `BE-21` router prefix standardization completed across `documents/search/chat/chunks/...` plus `main.py` `include_router(...)` cleanup.
- `BE-19` response models added with new schemas under `backend/app/schemas/` and `response_model=` applied to external endpoints (documents/chat/billing/users/admin, plus health).
- `BE-03` all chat error `JSONResponse` returns converted to `HTTPException`, with `Retry-After` headers preserved.
- `BE-12` `get_profile()` tokens aggregation folded into the existing stats query (query count reduced).
- `BE-15` `stripe_webhook` refactored into event handlers and dispatcher, preserving idempotency and DB error semantics.
- `BE-16` `rate_limit.py` replaced with Redis-backed limiter/tracker (`INCR+EXPIRE`) and in-memory fallback.
- `BE-18` pagination (`limit/offset`) added to the required list endpoints with backward-compatible defaults.
- `BE-24` new `backend/app/core/cache.py` created; caching added to demo documents (5m), user profile computed payload (30s), admin overview (1m), with plan-change profile cache invalidation in billing webhook paths and no credit-balance caching.

Validation run (as requested):
- `cd backend && python3 -m ruff check app/` passed cleanly.

Summary written to output file:
- `.collab/archive/cx-output-3.4.md`