# DocTalk Final Security Audit Report (2026-03-16)

Cross-reviewed by Claude (5 parallel agents) + Codex (independent audit).
Findings verified against actual source code.

---

## Methodology

- **Claude**: 5 parallel agents (source scan, frontend, backend, git history, infra)
- **Codex**: Independent review of Claude's findings + own 14-dimension audit
- **Claude**: Cross-review of Codex findings with code verification

## Corrections After Cross-Review

| Original Claude Finding | Codex Verdict | Claude Re-assessment | Final |
|---|---|---|---|
| #1 RESEND_API_KEY in frontend (CRITICAL) | FALSE POSITIVE — server-only code | **Agree with Codex**. `RESEND_API_KEY` is not `NEXT_PUBLIC_*`, never reaches browser. It's an architectural preference, not a vulnerability. | **Downgraded to LOW** |
| #2 /health?deep=true (CRITICAL) | AGREE, downgrade to HIGH | Agree. Real issue but not critical — error messages may contain connection details | **HIGH** |
| #3 LLM errors to client (CRITICAL) | AGREE, downgrade to MEDIUM | Agree. OpenAI SDK typically sanitizes keys from exceptions, but still bad practice | **MEDIUM** |
| #6 CORS wildcard methods (HIGH) | Partially agree, LOW | Agree. Origins are restricted; wildcard methods/headers is hardening only | **LOW** |
| #7 Missing startup validation (HIGH) | Partially agree, LOW | Agree. Runtime checks exist, startup validation is nice-to-have | **LOW** |

---

## FINAL CONSOLIDATED FINDINGS

### HIGH Severity

#### H1. SSRF DNS Rebinding / TOCTOU in URL Ingestion *(Codex found, Claude missed)*
- **Files**: `backend/app/core/url_validator.py:68-87`, `backend/app/services/extractors/url_extractor.py:49-53`
- **Issue**: `validate_url()` resolves hostname to verify it's not private IP, but returns the original URL. The subsequent `httpx.Client.stream()` resolves hostname again — between these two resolutions, a DNS rebinding attack can redirect to an internal IP.
- **Impact**: Attacker can reach internal services (Redis, PostgreSQL, MinIO) via crafted URL
- **Fix**: Pin resolved IP for the outbound connection, or re-validate after resolution at fetch time

#### H2. IP-Based Rate Limits Spoofable *(Codex found, Claude partially covered)*
- **Files**: `frontend/src/app/api/proxy/[...path]/route.ts:68`, `backend/app/api/chat.py:44`
- **Issue**: Proxy forwards client-supplied `x-forwarded-for` header. Backend trusts first value for rate limiting. Attacker can spoof IP to bypass demo message limits and rate limiting.
- **Impact**: Complete bypass of anonymous rate limits and demo message caps
- **Fix**: Use platform-provided IP (Vercel's `req.ip` or `x-real-ip`) instead of client-supplied `x-forwarded-for`

#### H3. Cross-User Demo Session Exposure *(Codex found, Claude missed)*
- **Files**: `backend/app/api/chat.py:66`, `backend/app/services/doc_service.py`
- **Issue**: Demo documents are globally readable (`can_access_document` returns True for any `demo_slug` doc). Sessions inherit this access. Authenticated users can enumerate and read anonymous demo sessions.
- **Impact**: Privacy violation — authenticated users can read other users' demo conversations
- **Fix**: Add session ownership checks (user_id or signed anonymous token) in `verify_session_access`

#### H4. /health?deep=true Unauthenticated + Error Leakage *(Claude found, Codex confirmed)*
- **File**: `backend/app/main.py:156-186`
- **Issue**: No auth required. `str(e)` on DB/Redis failure may contain connection strings
- **Fix**: Add auth or remove deep mode; return generic status, log details server-side

#### H5. `python-multipart==0.0.6` Known CVE *(Codex found, Claude missed)*
- **File**: `backend/requirements.txt:13`
- **Issue**: CVE-2024-24762 and CVE-2024-53981 — ReDoS/DoS in multipart parser
- **Fix**: Upgrade to `python-multipart>=0.0.18`

#### H6. `--forwarded-allow-ips='*'` *(Claude found, Codex confirmed)*
- **File**: `backend/entrypoint.sh:50`
- **Issue**: Uvicorn trusts X-Forwarded-For from any source, enabling IP header spoofing
- **Fix**: Restrict to Railway's proxy IP range

### MEDIUM Severity

#### M1. Demo Message Limit Race Condition *(Codex found)*
- **File**: `backend/app/api/chat.py:231-237`
- **Issue**: `get_count()` and `increment()` are separate Redis calls — concurrent requests can bypass the 5-message cap
- **Fix**: Atomic Redis `INCR` with threshold check (Lua script or `INCR` + check in pipeline)

#### M2. Demo Session Creation DoS *(Codex found)*
- **File**: `backend/app/api/chat.py:124-134`
- **Issue**: 500 global session cap per demo doc, no per-IP creation rate limit. Attacker can exhaust capacity.
- **Fix**: Add per-IP session creation rate limit

#### M3. Subscription Checkout Race *(Codex found)*
- **File**: `backend/app/api/billing.py:209-228`
- **Issue**: Concurrent `/subscribe` requests can both pass pre-check, creating duplicate checkout sessions
- **Fix**: `SELECT ... FOR UPDATE` or atomic conditional update on subscription state

#### M4. LLM/Retrieval Error Messages Expose Internals *(Claude found, Codex confirmed)*
- **Files**: `backend/app/services/chat_service.py:404,522,564,783,860,897`
- **Issue**: Raw `str(e)` sent to clients via SSE for LLM_ERROR, RETRIEVAL_ERROR, ACCOUNTING_ERROR, CHAT_SETUP_ERROR
- **Fix**: Return generic messages; log details with correlation IDs

#### M5. Upload Reads Full File Before Size Check *(Codex found)*
- **File**: `backend/app/api/documents.py:180`
- **Issue**: `await file.read()` loads entire file into memory before size rejection — memory pressure DoS
- **Fix**: Stream in chunks with early abort; enforce body size at ASGI/proxy layer

#### M6. URL Ingestion Sync I/O in Async Context *(Codex found)*
- **Files**: `backend/app/api/documents.py:269`, `backend/app/services/extractors/url_extractor.py:49`
- **Issue**: Sync `httpx.Client` blocks event loop
- **Fix**: Use `httpx.AsyncClient` or `asyncio.to_thread()`

#### M7. CSP Includes `unsafe-inline` + `unsafe-eval` *(Claude found, Codex confirmed)*
- **File**: `frontend/next.config.mjs:16-18`
- **Fix**: Remove `unsafe-eval`; consider nonce-based CSP for inline scripts

### LOW Severity

#### L1. Docker Images Unpinned *(Claude found, Codex agreed)*
#### L2. CORS Wildcard Methods/Headers *(Claude found, Codex downgraded)*
#### L3. Missing Startup Secret Validation *(Claude found, Codex downgraded)*
#### L4. NEXT_LOCALE Cookie Missing httpOnly *(Claude found)*
#### L5. Weak Dev AUTH_SECRET *(Claude found)*
#### L6. MinIO CERT_NONE on Non-TLS *(Claude found, contextually appropriate)*
#### L7. URL Fetch Error Includes Raw Exception *(Claude found)*

---

## CONFIRMED SECURE (Both Agree)

- Git history clean — no real secrets ever committed
- .gitignore comprehensive (.env, .key, .pem, credentials)
- JWT validation: exp/iat/sub required, `hmac.compare_digest` for adapter secret
- Stripe webhook signature properly verified
- File upload magic byte validation
- Credit pre-debit + reconcile (single ledger entry)
- Backend container runs non-root (UID 1001)
- Security headers: HSTS, X-Frame-Options: DENY, X-Content-Type-Options: nosniff
- Sentry `send_default_pii=False`
- Source maps disabled in production
- Stripe secret keys not in frontend code
- API proxy JWT injection with header whitelisting

---

## Priority Action Plan

### Immediate (This Week)
1. **H1**: Fix SSRF DNS rebinding — pin resolved IP for fetch
2. **H2**: Fix IP spoofing — use `req.ip` / `x-real-ip` in proxy, not client `x-forwarded-for`
3. **H5**: Upgrade `python-multipart` to >=0.0.18
4. **H4**: Add auth to `/health?deep=true` or sanitize error output
5. **H6**: Restrict `--forwarded-allow-ips` to Railway proxy range

### Next Sprint
6. **H3**: Add session ownership to demo conversations
7. **M1**: Make demo message counter atomic (Redis INCR)
8. **M2**: Add per-IP rate limit on demo session creation
9. **M3**: Add row lock on subscription state transitions
10. **M4**: Sanitize all SSE error messages

### Backlog
11. **M5**: Streaming upload with early size abort
12. **M6**: Async URL extraction
13. **M7**: Tighten CSP (remove unsafe-eval)
14. L1-L7: Low severity items
