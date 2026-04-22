# Subsystem: S4 Auth Double-Layer

## Scope
Files: `frontend/src/lib/auth.ts` (Auth.js v5 config, providers, JWE cookie), `frontend/src/app/api/proxy/[...path]/route.ts` (JWE → HS256 JWT mint), `frontend/src/lib/authAdapter.ts` (internal adapter API client), `backend/app/api/auth.py` (adapter endpoints guarded by X-Adapter-Secret), `backend/app/core/deps.py:40-65` (HS256 JWT verify), `backend/app/services/auth_service.py` (user/account/token CRUD + magic-link consumption).

In scope: token translation chain from user browser cookie to backend-trusted identity; adapter secret boundary; magic-link lifecycle; provider linking semantics.

## Model
Intended invariants:
1. **JWE cookie opaque to backend**: Auth.js v5 JWE is encrypted with AUTH_SECRET; backend cannot decrypt. All backend knows is the HS256 JWT that the frontend proxy mints per-request.
2. **Proxy is the only JWT issuer**: only `/api/proxy/[...path]/route.ts` can mint HS256 JWTs (it holds AUTH_SECRET on the server side). No other code path issues tokens to backend.
3. **Adapter API requires X-Adapter-Secret**: user/account/token CRUD endpoints (`/api/internal/auth/*`) are guarded with constant-time HMAC compare.
4. **Verification tokens consume atomically**: `FOR UPDATE` lock prevents magic-link reuse; token is deleted on successful use.
5. **OAuth tokens not stored**: `link_account` strips `access_token`, `refresh_token`, `id_token` before persisting — data minimization.

## Data / Control Flow

### Sign-in via Google (typical path)
1. User clicks Google in `/auth` page.
2. Auth.js initiates OAuth with Google; redirect includes `state` + `nonce`.
3. Google redirects to `/api/auth/[...nextauth]/route.ts` callback.
4. Auth.js calls `authAdapter.getUserByAccount(provider="google", account_id=<google_sub>)` → `GET /api/internal/auth/users/by-account/google/<sub>` (with `X-Adapter-Secret` header).
5. If user exists → session created. If not → `createUser` + `linkAccount`.
6. Auth.js sets JWE cookie (encrypted session) on browser.

### Any authenticated API call
1. Browser → `www.doctalk.site/api/proxy/<path>` with JWE cookie.
2. Proxy route reads JWE via `getToken()`, extracts user_id + email.
3. Proxy mints HS256 JWT: `sign({sub: user_id, email, iat, exp}, AUTH_SECRET)`.
4. Proxy forwards to backend with `Authorization: Bearer <jwt>` + `X-Real-Client-IP: <user-ip>` + `X-Proxy-IP-Secret: <AUTH_SECRET>`.
5. Backend `deps.get_current_user_optional` decodes HS256, validates `exp`/`iat`/`sub`, loads user via `db.get(User, UUID(sub))`.

### Magic-link email sign-in
1. User enters email, Auth.js triggers `sendVerificationRequest`.
2. Adapter: `POST /api/internal/auth/verification-tokens {identifier, token, expires}`.
3. Backend stores `hash_token(token)` in DB, sends email via Resend with raw token in URL.
4. User clicks URL → Auth.js calls adapter `POST /verification-tokens/use {identifier, token}`.
5. Backend `use_verification_token` uses `SELECT ... WITH FOR UPDATE` lock, verifies hash, deletes row, returns success.

## Threats I Considered

- **JWT forgery via AUTH_SECRET leak**: complete account takeover. Only mitigation is secret rotation — which is hobbled by the B-08-D03 finding (AUTH_SECRET reuse for IP HMAC).
- **Adapter secret leak**: silent CRUD against any user. User deletion (A-01-C08) has no audit trail.
- **Magic-link reuse**: prevented via `FOR UPDATE` + DELETE. Confirmed correct.
- **Magic-link token collision**: `hash_token(token)` is SHA256; token itself is 32-byte random from Auth.js. Collision-free.
- **Cross-provider account takeover via email linking**: see A-19-C10 — `allowDangerousEmailAccountLinking` is safe with current providers (Google/Microsoft/magic-link all verify email).
- **OAuth state / PKCE**: Auth.js v5 enforces by default. Not reviewed in detail but relies on Auth.js defaults.
- **`deps.get_current_user_optional` returns None on any JWT error**: fails open to "not authenticated" rather than "error". Subsequent `require_auth` returns 401. Correct.
- **Session fixation via JWE cookie**: Auth.js v5 rotates session on sign-in. Trust Auth.js.

## Findings (beyond matrix)

### F6: Adapter secret and AUTH_SECRET are both HMAC-compared, but under different patterns
- Status: deficiency (P3)
- `auth.py:34`: `hmac.compare_digest(x_adapter_secret, settings.ADAPTER_SECRET)` — explicitly constant-time.
- `rate_limit.py:267`: `hmac.compare_digest(proxy_secret, settings.AUTH_SECRET)` — also constant-time.
- Both OK. But the pattern:
  ```python
  if settings.AUTH_SECRET is None: return False
  ```
  in `get_client_ip` short-circuits BEFORE the compare. Timing difference between "secret not set" and "secret set but wrong" is theoretically observable. Low impact; probably fine.
- **Fix**: not worth changing.

### F7: `use_verification_token` returns token + expires verbatim; no re-hash on response
- Status: clear / by-design (P3)
- `auth.py:155`: `return {"identifier": vt.identifier, "token": data.token, "expires": vt.expires}` — returns the raw token the caller supplied, not the hashed value. This is intentional (Auth.js expects the raw token back). Not a leak since the caller already has it.

### F8: `email` in `/users/by-email/{email}` is URL-path-encoded, no length limit
- Status: deficiency (P3)
- `auth.py:60`: `email: str` as path parameter. FastAPI URL-decodes and passes. Max URL length in practice is ~2KB. Attacker with adapter secret could send a 2KB email as SQL injection attempt — but ORM params prevent SQL injection. Worst case: log size bloat or minor DB index fragmentation.
- **Fix**: add `EmailStr` validation at the schema layer to reject malformed emails early.

## Interactions

- **Deep interaction with S1 Credits**: user_id from JWT → credit ops. Any JWT forgery = credit fraud. AUTH_SECRET is the crown jewel.
- **Deep interaction with IP trust chain (Matrix B row 3)**: see B-03-D01 and B-08-D03. The same AUTH_SECRET gates two unrelated invariants. Rotating breaks both.
- **Interaction with S9b retrieval boundary**: user_id sourced from JWT is used as the scoping key for `can_access_document`. JWT forgery = cross-tenant retrieval. But attacker needs AUTH_SECRET — same crown jewel.
- Does NOT interact directly with S2 Stripe — Stripe identifies users by `client_reference_id` / `customer_id` stored in the DB, not by JWT. Stripe webhook is independent of the JWT chain.
