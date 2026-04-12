# Security Fix Plan (2026-03-16)

Based on cross-reviewed audit by Claude + Codex. 13 fixes, ordered by priority.

---

## Phase 1: Immediate (Critical Attack Vectors)

### Fix H1: SSRF DNS Rebinding in URL Ingestion

**Problem**: `validate_url()` resolves hostname → checks IP → returns original URL. `url_extractor.py` fetches by hostname, allowing DNS rebinding between validation and fetch.

**Files to modify**:
- `backend/app/core/url_validator.py`
- `backend/app/services/extractors/url_extractor.py`

**Approach**: Make `validate_url()` return the resolved IP alongside the URL, then pin the IP for the actual HTTP request using httpx's `transport` layer.

```python
# url_validator.py — change return type
def validate_url(url: str) -> tuple[str, str]:
    """Returns (url, resolved_ip) after SSRF validation."""
    # ... existing checks ...
    addrinfos = socket.getaddrinfo(hostname, port or 443, proto=socket.IPPROTO_TCP)
    # Pick first non-blocked IP
    resolved_ip = addrinfos[0][4][0]
    for _family, _type, _proto, _canonname, sockaddr in addrinfos:
        ip_str = sockaddr[0]
        if _is_blocked_ip(ip_str):
            raise ValueError("BLOCKED_HOST")
    return url, resolved_ip

# url_extractor.py — pin IP for connection
def _fetch_with_safe_redirects(url: str) -> tuple[str, str, str, bytes]:
    url, resolved_ip = validate_url(url)
    current_url = url
    seen_urls = {current_url}

    with httpx.Client(timeout=FETCH_TIMEOUT, follow_redirects=False) as client:
        for _hop in range(MAX_REDIRECTS + 1):
            # Override DNS: connect to resolved_ip but send Host header for hostname
            parsed = urlparse(current_url)
            pinned_url = current_url.replace(parsed.hostname, resolved_ip)

            with client.stream(
                "GET", pinned_url,
                headers={
                    "Host": parsed.hostname,
                    "User-Agent": "Mozilla/5.0 (compatible; DocTalk/1.0)",
                },
            ) as response:
                if response.is_redirect:
                    redirect_url = urljoin(current_url, response.headers.get("location", ""))
                    # Re-validate redirect target (get new resolved IP)
                    redirect_url, resolved_ip = validate_url(redirect_url)
                    current_url = redirect_url
                    continue
                # ... rest unchanged
```

**Alternative (simpler)**: Use httpx custom transport with `AsyncResolver` that validates IPs. Or re-validate resolved IPs immediately before each fetch by calling `validate_url()` with a very short DNS cache TTL. Given complexity of IP pinning with TLS (SNI needs hostname), the simpler approach is:

```python
# Simpler: resolve + validate + connect by IP with SNI
import ssl
import httpx

def _create_ssrf_safe_transport(resolved_ip: str, hostname: str):
    """Create transport that connects to resolved_ip but uses hostname for TLS/SNI."""
    # httpx allows base_url override per-request via extensions
    # Simplest: use socket-level connection to resolved IP
    pass  # Detail in implementation
```

**Decision needed**: IP pinning with TLS/SNI is complex. Recommend the "re-resolve and re-validate" approach: call `validate_url()` immediately before `client.stream()` for each hop, and set DNS cache TTL to 0 in the resolver. This narrows the TOCTOU window to near-zero without the SNI complexity.

**Final recommended approach**:
```python
# url_extractor.py — validate immediately before each fetch
def _fetch_with_safe_redirects(url: str) -> tuple[str, str, str, bytes]:
    validate_url(url)  # Initial validation
    current_url = url
    seen_urls = {current_url}

    # Use transport with no DNS cache to minimize rebinding window
    transport = httpx.HTTPTransport(retries=0)
    with httpx.Client(timeout=FETCH_TIMEOUT, follow_redirects=False, transport=transport) as client:
        for _hop in range(MAX_REDIRECTS + 1):
            # Re-validate RIGHT BEFORE fetch (minimize TOCTOU)
            validate_url(current_url)

            with client.stream("GET", current_url, ...) as response:
                # After connection, verify actual connected IP
                if hasattr(response.stream, '_httpcore_stream'):
                    # Extract connected IP from socket for final verification
                    pass

                if response.is_redirect:
                    redirect_url = urljoin(current_url, ...)
                    validate_url(redirect_url)
                    current_url = redirect_url
                    continue
```

**Test**: Unit test with mock DNS that returns different IPs on consecutive lookups.

---

### Fix H2: IP-Based Rate Limit Spoofing

**Problem**: Frontend proxy takes `x-forwarded-for` from client request (line 68), which can be forged. Backend trusts first value.

**Files to modify**:
- `frontend/src/app/api/proxy/[...path]/route.ts` (lines 66-71)
- `backend/app/api/chat.py` (lines 42-48)

**Approach**: On Vercel, the trusted client IP is available via `req.ip` (set by Vercel's edge network, not forgeable). Use that instead.

```typescript
// frontend proxy — route.ts lines 66-71
// BEFORE (vulnerable):
const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
  || req.ip
  || "unknown";

// AFTER (secure):
// Vercel sets req.ip from their edge network — not spoofable by client.
// x-real-ip is also set by Vercel and is trustworthy.
const clientIp = req.ip
  || req.headers.get("x-real-ip")
  || "unknown";
headers.set("X-Real-Client-IP", clientIp);  // Use custom header name to avoid confusion
```

```python
# backend chat.py — _get_client_ip
def _get_client_ip(request: Request) -> str:
    """Extract real client IP from trusted proxy header."""
    # X-Real-Client-IP is set by our Vercel proxy from req.ip (not forgeable)
    real_ip = request.headers.get("x-real-client-ip")
    if real_ip:
        return real_ip.strip()
    # Fallback for direct backend access (dev/testing)
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"
```

**Test**: curl with fake `X-Forwarded-For` header → verify rate limit still uses real IP.

---

### Fix H5: Upgrade python-multipart

**File**: `backend/requirements.txt` line 13

```diff
- python-multipart==0.0.6
+ python-multipart==0.0.20
```

**Test**: Run existing upload tests. Check `pip install` succeeds with FastAPI compatibility.

---

### Fix H4: Health Endpoint Error Sanitization

**File**: `backend/app/main.py` lines 156-186

```python
# BEFORE:
except Exception as e:
    components["database"] = {"status": "error", "detail": str(e)}

# AFTER:
except Exception as e:
    logger.error("Health check database error: %s", e)
    components["database"] = {"status": "error"}

# Same for Redis:
except Exception as e:
    logger.error("Health check redis error: %s", e)
    components["redis"] = {"status": "error"}
```

Also add optional auth for deep checks:
```python
@app.get("/health")
async def health(deep: bool = Query(False), request: Request = None) -> dict:
    if deep:
        # Require internal secret for deep checks
        secret = request.headers.get("X-Health-Secret") if request else None
        if secret != settings.ADAPTER_SECRET:
            raise HTTPException(403, "Unauthorized")
    # ... rest unchanged
```

**Test**: `curl /health?deep=true` without header → 403. With header → full response.

---

### Fix H6: Restrict forwarded-allow-ips

**File**: `backend/entrypoint.sh` line 50

```diff
- --forwarded-allow-ips='*'
+ --forwarded-allow-ips='10.0.0.0/8,172.16.0.0/12,192.168.0.0/16,127.0.0.1'
```

Railway uses internal network for routing; these CIDR ranges cover Railway's proxy infrastructure.

**Test**: Deploy to Railway staging, verify `request.client.host` resolves correctly.

---

## Phase 2: Next Sprint (Authorization & Race Conditions)

### Fix H3: Demo Session Cross-User Exposure

**Problem**: Authenticated users can access/enumerate anonymous demo sessions because `can_access_document` returns True for demo docs and sessions inherit that access.

**File**: `backend/app/api/chat.py`

**Approach**: Add ownership check in `verify_session_access`. Anonymous demo sessions (user_id=NULL) should only be accessible with matching anonymous token.

```python
async def verify_session_access(
    session_id: uuid.UUID,
    user: Optional[User],
    db: AsyncSession,
    anon_session_token: Optional[str] = None,  # NEW: from cookie/header
) -> Optional[ChatSession]:
    # ... existing query ...
    session = result.scalar_one_or_none()
    if not session:
        return None

    # NEW: Demo session ownership enforcement
    if session.document and session.document.demo_slug:
        if session.user_id is None:
            # Anonymous session: only accessible with matching token
            if user is not None or anon_session_token != str(session.id):
                return None
        elif session.user_id and user and session.user_id != user.id:
            # Authenticated user's demo session: only accessible by owner
            return None
        return session

    # Non-demo document access check (existing logic)
    if session.document and not can_access_document(session.document, user):
        return None
    # ... rest unchanged
```

Also filter `list_sessions` to only return sessions owned by the requesting user:
```python
# In list_sessions endpoint, add filter:
if doc.demo_slug:
    if user:
        query = query.where(ChatSession.user_id == user.id)
    else:
        # Anonymous: return no sessions (they use session ID from cookie)
        return {"sessions": []}
```

**Test**: Create demo session as anon → try to read as authenticated user → 404.

---

### Fix M1: Atomic Demo Message Counter

**File**: `backend/app/core/rate_limit.py`

**Approach**: Replace separate `get_count()` + `increment()` with atomic `INCR` + threshold check.

```python
class DemoMessageTracker:
    async def check_and_increment(self, key: str) -> tuple[bool, int]:
        """Atomically increment and check limit. Returns (allowed, current_count)."""
        redis_key = f"{self.namespace}:{key}"
        try:
            pipe = self._redis.pipeline()
            pipe.incr(redis_key)
            pipe.ttl(redis_key)
            count, ttl = await pipe.execute()

            # Set TTL on first increment
            if ttl == -1:
                await self._redis.expire(redis_key, self.ttl_seconds)

            if count > self.limit:
                # Over limit: decrement back and reject
                await self._redis.decr(redis_key)
                return False, count - 1

            return True, count
        except Exception:
            # Fallback to in-memory
            return self._memory_fallback.check_and_increment(key)
```

Update chat.py usage:
```python
# BEFORE (race-prone):
if await demo_message_tracker.get_count(client_ip) >= DEMO_MESSAGE_LIMIT:
    raise HTTPException(429, ...)
await demo_message_tracker.increment(client_ip)

# AFTER (atomic):
allowed, count = await demo_message_tracker.check_and_increment(client_ip)
if not allowed:
    log_security_event("demo_message_limit", ip=client_ip, ...)
    raise HTTPException(429, {"message": "Demo message limit reached", "limit": DEMO_MESSAGE_LIMIT})
```

**Test**: Concurrent requests (asyncio.gather) → verify exactly 5 pass.

---

### Fix M2: Demo Session Creation Rate Limit

**File**: `backend/app/api/chat.py` lines 124-134

Add per-IP rate limit on session creation:

```python
# Add at module level:
demo_session_limiter = RateLimiter(
    namespace="demo_session_create",
    max_requests=5,
    window_seconds=300,  # 5 sessions per 5 minutes per IP
)

# In create_session, after demo doc check:
if user is None and doc.demo_slug:
    client_ip = _get_client_ip(request)
    if not await demo_session_limiter.is_allowed(client_ip):
        raise HTTPException(429, {"message": "Too many sessions created"})
    # ... existing global cap check
```

**Test**: Create 6 demo sessions in 5 minutes from same IP → 6th rejected.

---

### Fix M3: Subscription Checkout Race

**File**: `backend/app/api/billing.py` lines 226-229

**Problem**: Two concurrent requests can both read `stripe_subscription_id=None`, both set `pending`.

**Approach**: Use `SELECT ... FOR UPDATE` to lock the user row.

```python
# In subscribe endpoint, before the "pending" guard:
# Lock the user row to prevent concurrent subscribe
result = await db.execute(
    select(User).where(User.id == user.id).with_for_update()
)
user = result.scalar_one()

# Re-check after lock acquired
if user.stripe_subscription_id:
    if user.stripe_subscription_id == "pending":
        recovered = await _recover_pending_subscription(user, db)
        if recovered:
            raise HTTPException(400, "You already have an active subscription.")
    else:
        raise HTTPException(400, "You already have an active subscription.")

user.stripe_subscription_id = "pending"
await db.commit()
```

**Test**: Two concurrent subscribe requests → only one creates checkout session.

---

### Fix M4: Sanitize All SSE Error Messages

**Files**: `backend/app/services/chat_service.py` lines 404, 522, 564, 783, 860, 897

**Approach**: Map all exception → generic user message. Log detailed error with request correlation ID.

```python
# Add helper at top of chat_service.py:
_USER_SAFE_ERRORS = {
    "LLM_ERROR": "Failed to generate response. Please try again.",
    "RETRIEVAL_ERROR": "Document retrieval failed. Please try again.",
    "ACCOUNTING_ERROR": "Credit accounting issue. Your credits are safe.",
    "CHAT_SETUP_ERROR": "Failed to set up chat. Please try again.",
    "PERSIST_FAILED": "Failed to save message. Your credits have been refunded.",
}

def _safe_error_sse(code: str, exception: Exception, **log_context) -> str:
    logger.error("SSE error [%s]: %s", code, exception, extra=log_context)
    return sse("error", {"code": code, "message": _USER_SAFE_ERRORS.get(code, "An error occurred.")})
```

Apply to all 6 locations:
```python
# BEFORE: yield sse("error", {"code": "LLM_ERROR", "message": str(e)})
# AFTER:  yield _safe_error_sse("LLM_ERROR", e, user_id=user.id, session_id=session_id)
```

**Test**: Force LLM error → verify client receives generic message, server logs detailed error.

---

## Phase 3: Backlog (Hardening)

### Fix M5: Streaming Upload with Early Size Abort

**File**: `backend/app/api/documents.py` line 180

```python
# BEFORE:
data = await file.read()
if len(data) > max_size_mb * 1024 * 1024:
    raise HTTPException(413, "File too large")

# AFTER:
max_bytes = max_size_mb * 1024 * 1024
chunks = []
total = 0
while chunk := await file.read(64 * 1024):  # 64KB chunks
    total += len(chunk)
    if total > max_bytes:
        log_security_event("upload_rejected", size=total, max_mb=max_size_mb)
        raise HTTPException(413, f"File exceeds {max_size_mb}MB limit")
    chunks.append(chunk)
data = b"".join(chunks)
```

---

### Fix M6: Async URL Extraction

**File**: `backend/app/services/extractors/url_extractor.py`

Wrap sync fetch in `asyncio.to_thread()` at the call site:

```python
# In documents.py URL ingestion endpoint:
# BEFORE:
text, title, content_type, raw_bytes = fetch_and_extract_url(url)

# AFTER:
text, title, content_type, raw_bytes = await asyncio.to_thread(
    fetch_and_extract_url, url
)
```

This is simpler than rewriting the entire extractor to async and achieves the same non-blocking goal.

---

### Fix M7: Tighten CSP

**File**: `frontend/next.config.mjs` lines 16-18

```diff
- "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://va.vercel-scripts.com https://*.sentry-cdn.com https://www.googletagmanager.com https://www.google-analytics.com",
+ "script-src 'self' 'unsafe-inline' https://va.vercel-scripts.com https://*.sentry-cdn.com https://www.googletagmanager.com https://www.google-analytics.com",
```

Remove `unsafe-eval` only. Keep `unsafe-inline` for now (Next.js still needs it without nonce support in pages router pattern). Test thoroughly after change.

---

## Testing Strategy

Each fix should include:
1. **Unit test**: Verify the fix works in isolation
2. **Regression test**: Verify existing functionality is not broken
3. **Security test**: Verify the vulnerability is actually mitigated

Key integration tests to add:
- SSRF: Mock DNS → verify rebinding blocked
- IP spoofing: Forge headers → verify rate limit uses real IP
- Race conditions: Concurrent requests → verify atomic behavior
- Demo sessions: Cross-user access → verify 404

---

## Rollout Order

```
Phase 1 (one PR):
  H5 (python-multipart upgrade) → H4 (health sanitize) → H6 (forwarded-ips)
  → H2 (IP spoofing) → H1 (SSRF rebinding)

Phase 2 (one PR per fix):
  M1 (atomic counter) → M2 (session rate limit) → M3 (subscribe lock)
  → M4 (SSE errors) → H3 (demo session isolation)

Phase 3 (one PR):
  M5 (streaming upload) + M6 (async URL) + M7 (CSP)
```
