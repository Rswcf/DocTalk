---
# Review: Auth + Credits + Billing Feature
REVIEWER: CX
DATE: 2026-02-05
VERDICT: REQUEST_CHANGES

## Overall Assessment
Well thought-out plan with clear phases and a sensible data model. The hybrid approach aims to keep a single ORM and aligns credits/billing neatly with an append-only ledger. However, there are critical gaps around session validation between Next.js and FastAPI, completeness of the custom Auth.js adapter surface, concurrency-safe credit debiting, and a few security/operational details. These should be addressed before implementation to avoid costly rework.

## Architecture Decision (Option A/B/C)
Option C is viable and preferred to avoid dual ORMs, but only if the session strategy and cross-service auth story are locked down. I recommend Auth.js “JWT session” strategy (no DB sessions) with a shared signing secret so FastAPI can verify tokens directly. If you require DB sessions, you must mirror Auth.js hashing semantics and cookie naming, and carefully handle cookie domain/CORS. If the adapter complexity becomes high, Option B (all auth in FastAPI) is the simpler fallback.

## Technical Concerns
### Concern 1: Cross-service session and cookies
FastAPI reading `next-auth.session-token` from request cookies will not work reliably unless cookie domain/SameSite/CORS are configured for both services. Clarify domain strategy (apex cookie like `.example.com`), set `SameSite=Lax`, `Secure`, and ensure `credentials: 'include'` CORS. Prefer JWT sessions and pass `Authorization: Bearer <jwt>` to backend to decouple from cookie transport.

### Concern 2: Adapter surface completeness
The plan mentions user CRUD but an Auth.js adapter also needs accounts, sessions (if not JWT), and verification token CRUD: `createUser/getUser/getUserByEmail`, `getAccount/linkAccount`, `createSession/getSessionAndUser/updateSession/deleteSession`, `createVerificationToken/useVerificationToken`. Define explicit FastAPI endpoints for each with auth (internal key) and idempotency.

### Concern 3: Session token hashing and cookie names
Auth.js commonly hashes `sessionToken` and verification tokens at rest. Your `auth_sessions.session_token` lookup won’t work if hashing is used. Either adopt JWT sessions or match hashing exactly. Also handle cookie names for dev/prod: `next-auth.session-token`, `__Secure-next-auth.session-token`, and v5 `authjs.session-token`.

### Concern 4: Atomic credits debiting and race safety
Pre-checking balance is insufficient. Add an atomic debit path to prevent negatives under concurrency. Recommendation: keep the append-only ledger for audit but introduce a `users.credits_balance` (or `credit_balances`) and perform `UPDATE ... SET balance = balance - :cost WHERE user_id = :id AND balance >= :cost` in the same TX; if 0 rows affected, return 402. Maintain ledger + balance together transactionally.

### Concern 5: Stripe webhook path and idempotency
Your endpoint table says `POST /api/billing/webhook` but code shows `@router.post("/stripe/webhook")`. Align routes. Manual idempotency via `ref_id = payment_intent` is fine; keep it and also verify event signature and consider checking event `id` uniqueness. Ensure product/price IDs are config-driven and not hardcoded.

### Concern 6: Guest mode robustness
IP/fingerprint is fragile and privacy-sensitive. Prefer a signed, HTTP-only guest ID cookie with a Redis-backed counter and TTL. Enforce explicit expirations for guest keys and add lightweight rate limiting on guest actions.

## Answers to CC's Questions
### Q1: Architecture Decision
Yes to Option C, with JWT session strategy and a shared secret so FastAPI can validate tokens; otherwise Option B is safer than DB-session Hybrid.

### Q2: Auth.js Adapter
Yes—gotchas: implement full adapter methods, hash tokens consistently with Auth.js, align cookie names/domains, and avoid DB sessions unless truly needed.

### Q3: Credit Calculation
Model is clear. Suggest starting with a flat per-model-family rate and keeping a server-side mapping so you can adjust without migrations.

### Q4: Guest Mode
Use a signed guest ID cookie + Redis with TTL and rate limits. Avoid browser fingerprinting libraries unless absolutely necessary.

### Q5: Stripe Webhook
Manual idempotency via `payment_intent` is adequate. Keep `ref_id` uniqueness, verify signatures, and fix the route mismatch.

### Q6: Migration Risk
Adding nullable `user_id` with `SET NULL` is low risk. Add an index on `documents.user_id` and plan a backfill for any ownership you can infer later.

## Suggested Modifications
- Adopt Auth.js JWT sessions; share `AUTH_SECRET` with FastAPI and send `Authorization: Bearer <jwt>` from the client to backend. Add JWT verification middleware in `backend/app/core/deps.py`.
- If keeping DB sessions: store hashed `session_token`, support all cookie name variants, and index `session_token` and `expires`. Update `get_current_user` to hash lookup.
- Define internal adapter API in FastAPI (`backend/app/api/auth.py`) covering all adapter methods; protect with an internal API key. Document request/response shapes.
- Add `users.credits_balance` and an atomic debit path; keep `credit_ledger` as audit. Expose `GET /api/credits/balance` to return `balance` and last N ledger entries.
- Migrations: enable `pgcrypto` for `gen_random_uuid()` (or switch to `uuid_generate_v4()` with `uuid-ossp`). Add timezone-aware defaults and indexes for `user_id` FKs.
- Fix Stripe routes to `POST /api/billing/webhook`; load product/price IDs from `backend/app/core/config.py`. Add event `id` uniqueness guard.
- Guest mode: implement signed guest cookie issuance endpoint, Redis TTLs, and counters; add minimal rate limiting.
- Next.js: set `runtime = 'nodejs'` for `frontend/src/app/api/auth/[...nextauth]/route.ts` if the adapter needs Node APIs; configure cookie domain to apex in `frontend/src/lib/auth.ts`.
- Clarify CORS: allow credentials, set allowed origins to the frontend origin, and only expose needed headers.

## Approval Conditions
- Confirm Option C with JWT session strategy (or, if DB sessions, commit to hashing + cookie handling).
- Provide a concrete adapter endpoint spec and security model (internal key) and include all required methods.
- Implement atomic debit semantics with a maintained `credits_balance` and keep ledger as audit.
- Resolve Stripe webhook route mismatch and make product/price IDs configurable.
- Document and implement cookie domain/CORS configuration for dev and prod.

Once these are incorporated into the plan, I’m comfortable approving.

---END---