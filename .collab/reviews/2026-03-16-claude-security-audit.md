# Claude Security Audit Findings (2026-03-16)

## CRITICAL

### 1. RESEND_API_KEY in Frontend
- **File**: `frontend/src/lib/auth.ts:87-90`
- **Issue**: `sendVerificationRequest` directly calls `api.resend.com` with RESEND_API_KEY from frontend env vars
- **Risk**: Secret key lives in frontend environment (Vercel), even though the callback is server-side only

### 2. `/health?deep=true` Unauthenticated + Leaks Errors
- **File**: `backend/app/main.py:156-186`
- **Issue**: No auth required. On DB/Redis failure, `str(e)` returned in response — may contain connection strings with credentials
- **Risk**: Information disclosure of internal infrastructure

### 3. LLM Errors Returned to Client
- **File**: `backend/app/services/chat_service.py:522`
- **Issue**: `str(e)` from OpenAI/OpenRouter exceptions sent via SSE to client
- **Risk**: Could expose API keys, internal URLs, or request details in error messages

## HIGH

### 4. Docker Images Unpinned
- `backend/Dockerfile`: `python:3.12-slim` (no patch version)
- `infra/minio/Dockerfile`: `minio/minio:latest`
- `infra/qdrant/Dockerfile`: `qdrant/qdrant:latest`

### 5. `--forwarded-allow-ips='*'` in entrypoint.sh:50
- Trusts X-Forwarded-For from any IP, enables IP spoofing for rate limiting

### 6. CORS `allow_methods=["*"]` and `allow_headers=["*"]`
- `backend/app/main.py:130-136`

### 7. Missing Startup Validation for Secrets
- OPENROUTER_API_KEY, ADAPTER_SECRET, AUTH_SECRET, STRIPE_SECRET_KEY not validated at startup
- `chat_service.py`, `embedding_service.py`, `auth.py`

## MEDIUM

### 8. CSP includes `unsafe-inline` + `unsafe-eval`
- `frontend/next.config.mjs:16-18`

### 9. Document Retrieval Error Messages Expose Internals
- `backend/app/services/chat_service.py:404-409`

### 10. URL Fetch Error Includes Raw Exception
- `backend/app/api/documents.py:280-282`

### 11. Admin Endpoints No Rate Limiting
- `backend/app/api/admin.py`

### 12. MinIO TLS Uses CERT_NONE for Non-Secure
- `backend/app/services/storage_service.py:51`

### 13. Weak Dev AUTH_SECRET
- `.env:42` uses `doctalk-local-dev-secret-change-in-production`

## LOW

- NEXT_LOCALE cookie missing `httpOnly`
- No `X-RateLimit` response headers
- Stripe `api_key` set globally instead of per-request

## CONFIRMED SECURE
- Git history clean (no real secrets ever committed)
- .gitignore comprehensive
- API Proxy properly injects JWT with header whitelisting
- Adapter Secret uses `hmac.compare_digest`
- JWT validation includes exp/iat/sub
- File upload has magic byte validation
- Stripe webhook signature properly verified
- Backend container runs as non-root (UID 1001)
- HSTS, X-Frame-Options: DENY, X-Content-Type-Options: nosniff set
- Sentry `send_default_pii=False`
- Source maps disabled in production
