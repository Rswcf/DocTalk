---
# Re-Review: Auth + Credits + Billing Feature v0.2
REVIEWER: CX
DATE: 2026-02-05
VERDICT: REQUEST_CHANGES

## Changes Assessment
- JWT session strategy + shared AUTH_SECRET: Partially addressed. Plan adopts JWT sessions and FastAPI verification with a shared `AUTH_SECRET` (good). However, `frontend/src/lib/api.ts` uses `getSession()` and sets `Authorization: Bearer ${session.accessToken}` while `authOptions.callbacks.session` assigns `session.accessToken = token` (an object), not the encoded JWT. This will send “[object Object]” rather than a compact JWS. Needs a concrete fix for passing the raw JWT.
- Full adapter API spec: Addressed. The internal adapter endpoints cover all required JWT-session methods (users, accounts, verification tokens) and add `X-Adapter-Secret` protection. Minor mismatch between documented path `/api/internal/auth/users` and the example decorator `@router.post("/internal/auth/users")` in `.collab/plans/003-auth-credits-billing-v2.md`—align them.
- Atomic credit debiting with users.credits_balance: Addressed. Uses a single `UPDATE ... WHERE balance >= cost RETURNING ...` and writes an audit ledger entry; note “commit handled by caller” so ensure callers always wrap in a single transaction to keep balance/ledger consistent.
- Stripe webhook route fix (/api/billing/webhook): Addressed. Route moved to `POST /api/billing/webhook` and signature verification added. Idempotency checks by `payment_intent` are good; comment says “check both event_id and payment_intent” but code only checks `payment_intent`—either update code or comment.
- Signed guest cookie + Redis with TTL: Addressed. Uses signed, HTTP-only cookie via itsdangerous and Redis counters with 24h TTL; includes simple guest limits.
- CORS and cookie domain configuration: Addressed. Dev and prod CORS settings provided, `allow_credentials` enabled, and explicit plan to use `Authorization` header (not cookies) across different origins.

## Remaining Concerns
- Bearer token propagation bug: The client currently passes an object as the Authorization header. Fix by one of:
  - Add a Next.js Route Handler proxy that uses `getToken({ raw: true })` server-side and forwards requests with `Authorization: Bearer <jwt>`.
  - In `callbacks.session`, encode the JWT string yourself with the same secret/alg and assign `session.accessToken` to that encoded string (e.g., using `jose` or `next-auth/jwt` encode), keeping backend verify settings in sync.
- Verification token hashing: Schema notes “hashed token,” but no explicit hashing step is specified for `createVerificationToken/useVerificationToken`. Define and implement a consistent hash (e.g., SHA-256 hex) on the adapter side to match Auth.js expectations.
- Minor route mismatch: Align the internal adapter paths to consistently use `/api/internal/auth/*` across docs and code snippets.
- Stripe webhook idempotency: Either also guard on `event.id` (e.g., unique constraint or lookup) as the comment states, or revise the comment to reflect the implemented `payment_intent` check.
- JWT algorithm/config parity: Backend verifies with HS256. Confirm Auth.js uses the same algorithm and secret (and document it) to avoid decode failures.

## Final Verdict
Good progress—core architectural shifts (JWT sessions, atomic credits, webhook route, guest cookie, CORS) are in place. However, the Authorization header propagation must be corrected to pass a real JWT, and verification token hashing needs to be specified. Address these and the noted minor inconsistencies, and this will be ready to approve.

---END---