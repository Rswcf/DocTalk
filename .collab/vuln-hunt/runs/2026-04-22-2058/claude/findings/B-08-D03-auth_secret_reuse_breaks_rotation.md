---
id: B-08-D03-01
matrix: B
agent: claude
cell_id: B-08-D03
row_key: secret_rotation
column_key: secret_rotation_break
finding_key: auth_secret_reuse_breaks_rotation
severity: P2
confidence: high
status: deficiency
invariant_state: broken
files:
  - "backend/app/core/deps.py:42"
  - "backend/app/core/rate_limit.py:267"
  - "frontend/src/app/api/proxy/[...path]/route.ts:32"
exploit_preconditions:
  - "operator rotates AUTH_SECRET (standard security hygiene)"
---

## Observation
`AUTH_SECRET` is used for TWO distinct security purposes in the backend:
1. **JWT verification** at `deps.py:42`: `jwt.decode(token, settings.AUTH_SECRET, algorithms=["HS256"])` — validates user identity JWT minted by the frontend proxy.
2. **Proxy IP HMAC** at `rate_limit.py:267`: `hmac.compare_digest(proxy_secret, settings.AUTH_SECRET)` — validates that `X-Real-Client-IP` was forwarded by a trusted frontend.

The frontend proxy (`route.ts:32`) also uses `AUTH_SECRET` for both:
- Signing outgoing JWT to backend
- Signing `X-Proxy-IP-Secret` header

A single secret serves JWT signing + HMAC — typical cryptographic hygiene forbids this (different purposes should use different keys to limit blast radius of compromise).

## Impact
Coupled rotation window: rotating `AUTH_SECRET` requires ALL of these to happen atomically:
- Vercel env update
- Railway env update
- Backend restart
- Frontend rebuild/deploy

In practice, these happen over ~60 seconds. During that window:
- JWTs minted with old secret fail verification on new-secret backend → users get logged out
- `X-Proxy-IP-Secret` signed with old secret fails HMAC → rate limits collapse to LB-IP bucket (see B-03-D01)
- `X-Proxy-IP-Secret` signed with new secret but backend still on old → same collapse

Both effects are "visible outage" during rotation, but together they discourage rotating the secret at all. A compromised `AUTH_SECRET` allows both JWT forgery AND rate-limit impersonation.

Also: observability blind — rotation failures manifest as distributed symptoms (some users logged out, some rate limits collapsed) that don't cleanly attribute to secret drift.

## Suggested Fix
Split into two secrets:
- `AUTH_SECRET` — JWT signing only
- `PROXY_IP_HMAC_SECRET` — proxy IP forwarding HMAC only

Add support for secret rotation via versioned keys (e.g., JWT kid header; HMAC includes key version). Backend accepts both old and new for a grace period. Reduces rotation coupling from "simultaneous redeploy" to "deploy, wait, retire old key".

As a cheaper intermediate: leave a deployment runbook in `docs/ARCHITECTURE.md §10` making the coupled-rotation requirement explicit, including "bring backend up first with both secrets in a comma-separated allow-list, then frontend, then retire old value".
