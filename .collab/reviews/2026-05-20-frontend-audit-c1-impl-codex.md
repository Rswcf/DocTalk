Reading prompt from stdin...
2026-05-20T00:10:00.077305Z ERROR codex_core::session: failed to load skill /Users/mayijie/Projects/Code/010_DocTalk/.agents/skills/deploy/SKILL.md: missing YAML frontmatter delimited by ---
2026-05-20T00:10:00.077322Z ERROR codex_core::session: failed to load skill /Users/mayijie/Projects/Code/010_DocTalk/.agents/skills/codex-implement/SKILL.md: missing YAML frontmatter delimited by ---
OpenAI Codex v0.131.0
--------
workdir: /Users/mayijie/Projects/Code/010_DocTalk
model: gpt-5.3-codex
provider: openai
approval: never
sandbox: workspace-write [workdir, /tmp, $TMPDIR]
reasoning effort: xhigh
reasoning summaries: none
session id: 019e42b7-c40e-7943-97fe-972c37299e21
--------
user
C1 implementation landed at commit fe7269e on branch editorial-marketing (your R6 CONSENSUS). I need ONE final adversarial pass — review the actual committed diff (BASE 8ca0145 → HEAD fe7269e) against the locked consensus spec at .collab/dialogue/2026-05-20-frontend-audit-CONSENSUS.md.

Specifically verify:
1. The backend verify_signed_ip + get_client_ip dispatcher matches the spec exactly (hmac.compare_digest, byte handling, 60s skew, NEW path tries first, legacy uses AUTH_SECRET + reads x-real-client-ip).
2. The frontend triple-header generation in proxy/[...path]/route.ts and shared/[token]/page.tsx uses createHmac('sha256', ADAPTER_SECRET).update(ip+':'+ts).digest('hex') correctly.
3. The 10 pytest cases in backend/tests/test_proxy_ip_verification.py actually cover the regression-guard scenarios you caught (AUTH vs ADAPTER, x-real-client-ip vs client.host).
4. CLAUDE.md + AGENTS.md + ARCHITECTURE.md (+.zh.md) + README.md + TrustPageClient.tsx all match the code (header names, secret names, deploy sequence).
5. Any implementation-translation bug not caught in the spec rounds.

If everything ships safely, write 'IMPLEMENTATION OK'. If anything is wrong, itemize for a fix-up commit BEFORE deploy.

Run git show fe7269e --stat first to see the file list, then verify each.

codex
I’m reviewing the exact committed range `8ca0145..fe7269e` against the locked consensus file and will start by running `git show fe7269e --stat` to confirm the touched file set, then verify each of the five checkpoints line-by-line.
exec
/bin/zsh -lc 'git show fe7269e --stat' in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
commit fe7269e38fb766e31b72379eccf5e56e0692ffb5
Author: Yijie Ma <mayijie@Mac.fritz.box>
Date:   Wed May 20 02:05:00 2026 +0200

    fix(security): replace plaintext X-Proxy-IP-Secret with HMAC IP trust chain [Wave-1 C1]
    
    Vulnerability: the proxy was sending AUTH_SECRET in plaintext as the
    X-Proxy-IP-Secret HTTP header to authenticate IP claims to the backend.
    AUTH_SECRET is the same key Auth.js v5 uses to decrypt session JWEs.
    Exposure on the wire (Railway internal network, log pipelines, debug
    headers) allowed arbitrary session forgery.
    
    Fix: triple-header HMAC contract.
      Frontend (proxy/route.ts + shared/[token]/page.tsx) emits:
        X-Proxy-IP:     <ip>
        X-Proxy-IP-Ts:  <unix_seconds>
        X-Proxy-IP-Sig: hex(HMAC-SHA256(ADAPTER_SECRET, "{ip}:{ts}"))
      Backend (rate_limit.py) verifies with hmac.compare_digest, max_skew_s=60.
      Signing key migrated AUTH_SECRET -> ADAPTER_SECRET (separation of concerns;
      matches the already-documented contract in CLAUDE.md).
    
    Dual-accept rollout window: backend accepts BOTH contracts during
    transition. Legacy branch compares X-Proxy-IP-Secret against AUTH_SECRET
    (the OLD signing secret) and reads X-Real-Client-IP (the OLD trusted IP
    header). Observability: logger.info("proxy.signed_ip.legacy_path_used")
    on each legacy-path hit; logger.warning on verification failures with
    reason / claimed_ip / skew_s.
    
    Deploy sequence (MANDATORY):
      1. Railway backend first (railway up). Wait for /health.
      2. Then push frontend to stable (Vercel). Wait for "Ready".
      3. Watch `grep proxy.signed_ip.legacy_path_used` in Railway logs — should
         drop to ~0 within minutes of step 2.
      4. After 24h with the counter at 0, land a follow-up commit removing
         the legacy branch + X-Proxy-IP-Secret/X-Real-Client-IP code from
         both frontend and backend.
    
    Adversarial review: Claude <-> Codex 6 rounds. Codex caught 3 bugs in
    earlier spec drafts that would have shipped regressions (window-bucket
    replay, wrong fallback header name, wrong legacy secret) — locked
    consensus at .collab/dialogue/2026-05-20-frontend-audit-CONSENSUS.md.
    
    Bundles C2 (proxy BACKEND_URL env priority preferring BACKEND_INTERNAL_URL).
    
    Tests: backend/tests/test_proxy_ip_verification.py — 10 cases including
    2 regression guards for the bugs Codex caught.
    
    Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
    Co-Authored-By: Codex gpt-5.3-codex <noreply@openai.com>

 .github/workflows/ci.yml                      |   2 +-
 AGENTS.md                                     |   4 +-
 CLAUDE.md                                     |   4 +-
 README.md                                     |   2 +
 backend/app/core/rate_limit.py                | 100 +++++++++++++-
 backend/tests/test_proxy_ip_verification.py   | 188 ++++++++++++++++++++++++++
 docs/ARCHITECTURE.md                          |  24 +++-
 docs/ARCHITECTURE.zh.md                       |  24 +++-
 frontend/src/app/api/proxy/[...path]/route.ts |  32 +++--
 frontend/src/app/shared/[token]/page.tsx      |  23 +++-
 frontend/src/app/trust/TrustPageClient.tsx    |   2 +-
 11 files changed, 370 insertions(+), 35 deletions(-)

codex
I have the touched files list. Next I’m reading the locked consensus spec and the exact changed file hunks to verify behavior, headers, and doc wording against what actually shipped.
exec
/bin/zsh -lc "sed -n '1,260p' .collab/dialogue/2026-05-20-frontend-audit-CONSENSUS.md" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
# Frontend Audit — CONSENSUS (locked 2026-05-20)

**Process:** 6 rounds of Claude ↔ Codex adversarial review.
**Result:** Codex signed `**CONSENSUS**` in R6.

## What the iteration caught that the original audit missed

The audit started with 33 findings. Codex challenged every one over 6 rounds. The process surfaced THREE substantive errors in my own implementation specs that would have shipped real bugs:

- **R3 caught:** my original C1 spec used 30s window-bucket signing → deterministic header within window = trivial in-window replay. Fixed to per-request timestamp + 60s skew + constant-time compare.
- **R4 caught:** my legacy-branch fallback read `x-real-ip` but the production contract uses `x-real-client-ip` → would have collapsed all users to egress IP during the rollout window, triggering mass false-429s.
- **R5 caught:** my legacy-branch HMAC compared against `ADAPTER_SECRET` but the existing production secret is `AUTH_SECRET` → would have rejected all in-flight legacy requests, same false-429 collapse.

The adversarial review prevented an outage during the security fix itself. This is exactly the failure mode the CLAUDE.md collaboration protocol exists to prevent.

## Locked Wave 1 — 29 items, fix before merging branch

### C1 — Replace plaintext `X-Proxy-IP-Secret` with HMAC contract (the cross-cutting one)

**Frontend** (`route.ts:81`, `shared/[token]/page.tsx:32`): emit triple-header — `X-Proxy-IP`, `X-Proxy-IP-Ts` (unix seconds), `X-Proxy-IP-Sig` (HMAC-SHA256 of `ip + ":" + ts` with `ADAPTER_SECRET`).

**Backend** (`rate_limit.py:257-273`): `verify_signed_ip()` with `hmac.compare_digest` + `max_skew_s=60`. **Dual-accept legacy branch** that compares `X-Proxy-IP-Secret` against `AUTH_SECRET` (old contract) and reads `X-Real-Client-IP` for the trusted IP. Counters/logs: `proxy.signed_ip.verification_failed{reason}` + `proxy.signed_ip.legacy_path_used`.

**Tests** (`backend/tests/test_proxy_ip_verification.py`): 9 cases — valid, skew ±, malformed ts, bad sig, both-headers (new preferred), legacy-AUTH-SECRET passes, legacy-ADAPTER_SECRET fails (regression guard), legacy returns x-real-client-ip not client.host.

**CI** (`.github/workflows/ci.yml:29`): add the new test file to the backend job invocation.

**Docs** (the comprehensive .md sweep): `CLAUDE.md:61,63` + `AGENTS.md:66,105` + `docs/ARCHITECTURE.md §10:967` + `docs/ARCHITECTURE.zh.md` + `README.md:157` + `rate_limit.py:260,273` comments + `TrustPageClient.tsx:82` (soften "cannot be spoofed" → honest description) + `.env.example` (frontend `ADAPTER_SECRET`).

**Deploy sequence** (commit message + ARCHITECTURE §10 new subsection): Railway first → wait for /health → Vercel second → watch legacy_path_used → 24h later, follow-up commit removes legacy branch.

### C2 — Proxy env priority
`route.ts:5` → `BACKEND_INTERNAL_URL || NEXT_PUBLIC_API_BASE || localhost`.

### C3, C4, C5, C6, I28 — Silent failure family
- C3 `HomePageClient.tsx:337-354` — move delete UI update into try block; surface error on catch.
- C4 `collections/[collectionId]/page.tsx:150-156` — wrap `getMyDocuments()` in try/catch.
- C5 `HomePageClient.tsx:254-281` — upload polling timer in useRef + useEffect cleanup.
- C6 `MessageBubble.tsx:210` — `navigator.clipboard.writeText` add `.catch`.
- I28 `AccountActionsSection.tsx:36` — surface `exportError` state instead of silent swallow.

### C7, C8, C9 — Accessibility / correctness
- C7 `PdfToolbar.tsx:137,140` — fix search button labels + add `toolbar.prevMatch`/`toolbar.nextMatch` keys to 11 locales.
- C8 `MessageBubble.tsx:85-88` — skip citation-link recursion when child type is `code/pre/a/kbd/samp`.
- C9 `AppHeaderShell.tsx:33`, `PublicHeader.tsx:25,36` — replace `hover:text-white` with `hover:text-zinc-950 dark:hover:text-white`.

### I11–I15 — Editorial + Profile a11y
- I11 `editorial.css:8` — `--ed-ink-3: #8b857a` → `#6e6860` (4.6:1 contrast on `--ed-paper`).
- I12 `EditorialHeader.tsx:68`, `EditorialMarketingHeader.tsx:68` — add mobile hamburger / collapsed nav.
- I13 — focus trap + restore on 5 modals (ConfirmUpgrade / ConfirmDowngrade / ConfirmCancel / AccountActionsSection delete / FeedbackButton). PaywallModal already has trap — excluded.
- I14 `ProfileTabs.tsx:33`, `ProfilePageClient.tsx:159-205` — wire `role="tabpanel"` + `aria-controls` + `aria-labelledby`.
- I15 — add `scope="col"` to 4 tables (CreditsSection L193-198 + UsageStatsSection L158-163 + AdminPageClient L227-232 / L696-706 / L769-779).

### I16–I20 — Content / billing / i18n
- I16 — `billing.free.credits: "500" → "300"` in all 11 locales.
- I17 — translate `billing.perMonth` in `ar/es/hi/it/ja/ko`.
- I18 `PaywallModal.tsx:113-118` — derive target plan from `reason` (PRO_MODE_LIMIT + already-on-plus → 'pro').
- I19 `BillingPageClient.tsx` confirm dialogs — inject `{ targetPlan, period, price }` into copy.
- I20 `ChatPanel.tsx:361` — drop the `locale === 'en'` guard on `displayedSuggestedQuestions`.
- I27 `useChatStream.ts:108` — derive analytics `plan` from context, not hardcoded `'plus'`.

### I22, I23, I26 — Misc UX/visual
- I22 `CookieConsentBanner.tsx:26-34` — scope MutationObserver tighter than `document.body` subtree.
- I23 `SocialProof.tsx:84` — `border-[var(--ed-rule)]` → `md:border-[var(--ed-rule)]`.
- I26 `ModeSelector.tsx:35,50` — `slate-*` → `zinc-*`. `AdminPageClient.tsx:145` — Tailwind blue → `--accent` token.

### Q32, Q33 — Hygiene promoted into Wave 1
- Q32 `ErrorBoundary.tsx:35-37` — at minimum `console.error("ErrorBoundary caught:", error, errorInfo)`.
- Q33 `useDocumentLoader.ts` — call store reset on document switch (clear searchQuery / searchMatches / highlights / grabMode).

## Wave 2 — 10 items deferred

`C10` (FAQ height flash via useLayoutEffect), `I21` (MessageBubble memo + parent ref stabilization + avoid clone), `I25` (TextViewer markdown citation duplicate display), `Q27` (HomePageClient split), `Q28` (EditorialHeader shared base), `Q29` (extend EdComparisonTable to N cols), `Q30` (consolidate `formatNumber`), `Q31` (centralize price source-of-truth), `Q34` (admin i18n discipline), `Q35` (prometheus_client + /metrics endpoint).

## Dropped

`I24` (citation overlay zoom replay) — no repro, static evidence didn't support.

## Implementation order

C1 first (security, cross-cutting, deploy-sensitive). Then the silent-failure family (C3/C4/C5/C6/I28). Then a11y batches (C7/C8/C9 + I11–I15). Then content/billing (I16–I20/I27). Then misc (I22/I23/I26) + hygiene (Q32/Q33). Each batch: implementer → spec review → code review → fixes → build → commit.

C2 ships **inside** the C1 commit (small env-priority change, no separate review needed; verified by the proxy still reaching the backend under integration).

exec
/bin/zsh -lc 'git diff --unified=200 8ca0145 fe7269e -- frontend/src/app/api/proxy/[...path]/route.ts frontend/src/app/shared/[token]/page.tsx' in /Users/mayijie/Projects/Code/010_DocTalk
 exited 1 in 0ms:
zsh:1: no matches found: frontend/src/app/api/proxy/[...path]/route.ts

exec
/bin/zsh -lc 'git diff --unified=200 8ca0145 fe7269e -- backend/app/core/rate_limit.py' in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
diff --git a/backend/app/core/rate_limit.py b/backend/app/core/rate_limit.py
index ceff9b3..3904f3e 100644
--- a/backend/app/core/rate_limit.py
+++ b/backend/app/core/rate_limit.py
@@ -57,217 +57,305 @@ def _alert_redis_fallback(namespace: str, exc: Exception) -> None:
     except Exception:
         pass
 
 
 class InMemoryRateLimiter:
     """Token-bucket style in-memory rate limiter keyed by arbitrary string."""
 
     def __init__(self, max_requests: int = 10, window_seconds: int = 60):
         self.max_requests = max_requests
         self.window_seconds = window_seconds
         self._buckets: dict[str, list[float]] = defaultdict(list)
 
     def is_allowed(self, key: str) -> bool:
         now = time.time()
         if len(self._buckets) > 10000:
             self._buckets = defaultdict(list, {
                 k: [t for t in v if now - t < self.window_seconds]
                 for k, v in self._buckets.items()
             })
             self._buckets = defaultdict(list, {k: v for k, v in self._buckets.items() if v})
         bucket = self._buckets[key]
         self._buckets[key] = [t for t in bucket if now - t < self.window_seconds]
         if len(self._buckets[key]) >= self.max_requests:
             log_security_event("rate_limit_hit", key=key, max_requests=self.max_requests)
             return False
         self._buckets[key].append(now)
         return True
 
 
 class InMemoryDemoMessageTracker:
     """In-memory fallback tracker for demo message counts."""
 
     def __init__(self) -> None:
         self._counts: dict[str, int] = {}
 
     def get_count(self, key: str) -> int:
         return self._counts.get(key, 0)
 
     def increment(self, key: str) -> None:
         if len(self._counts) > 10_000:
             self._counts.clear()
         self._counts[key] = self._counts.get(key, 0) + 1
 
 
 class _RedisClientMixin:
     def __init__(self, *, namespace: str):
         self._namespace = namespace
         self._redis_url = settings.CELERY_BROKER_URL
         self._redis_client: redis.Redis | None = None
         self._next_retry_at = 0.0
 
     async def _get_client(self) -> redis.Redis | None:
         now = time.time()
         if self._redis_client is not None:
             return self._redis_client
         if now < self._next_retry_at:
             return None
         try:
             self._redis_client = redis.from_url(self._redis_url, decode_responses=True)
             await self._redis_client.ping()
             return self._redis_client
         except Exception as e:
             _alert_redis_fallback(self._namespace, e)
             self._next_retry_at = now + _REDIS_RETRY_SECONDS
             if self._redis_client is not None:
                 try:
                     await self._redis_client.aclose()
                 except Exception:
                     pass
             self._redis_client = None
             return None
 
     async def _reset_client(self, error: Exception) -> None:
         _alert_redis_fallback(self._namespace, error)
         self._next_retry_at = time.time() + _REDIS_RETRY_SECONDS
         if self._redis_client is not None:
             try:
                 await self._redis_client.aclose()
             except Exception:
                 pass
         self._redis_client = None
 
 
 class RedisRateLimiter(_RedisClientMixin):
     """Redis-backed rate limiter using atomic INCR + EXPIRE."""
 
     def __init__(self, *, namespace: str, max_requests: int, window_seconds: int):
         super().__init__(namespace=namespace)
         self.max_requests = max_requests
         self.window_seconds = window_seconds
         self._fallback = InMemoryRateLimiter(max_requests=max_requests, window_seconds=window_seconds)
 
     async def is_allowed(self, key: str) -> bool:
         client = await self._get_client()
         if client is None:
             return self._fallback.is_allowed(key)
 
         redis_key = f"{self._namespace}:{key}"
         try:
             count = await client.incr(redis_key)
             if count == 1:
                 await client.expire(redis_key, self.window_seconds)
             if count > self.max_requests:
                 log_security_event("rate_limit_hit", key=key, max_requests=self.max_requests)
                 return False
             return True
         except Exception as e:
             await self._reset_client(e)
             return self._fallback.is_allowed(key)
 
 
 class RedisDemoTracker(_RedisClientMixin):
     """Redis-backed demo message counter using INCR + EXPIRE."""
 
     def __init__(self, *, namespace: str, ttl_seconds: int = _DEMO_COUNTER_TTL_SECONDS):
         super().__init__(namespace=namespace)
         self.ttl_seconds = ttl_seconds
         self._fallback = InMemoryDemoMessageTracker()
 
     async def get_count(self, key: str) -> int:
         client = await self._get_client()
         if client is None:
             return self._fallback.get_count(key)
 
         redis_key = f"{self._namespace}:{key}"
         try:
             value = await client.get(redis_key)
             return int(value or 0)
         except Exception as e:
             await self._reset_client(e)
             return self._fallback.get_count(key)
 
     async def increment(self, key: str) -> None:
         client = await self._get_client()
         if client is None:
             self._fallback.increment(key)
             return
 
         redis_key = f"{self._namespace}:{key}"
         try:
             count = await client.incr(redis_key)
             if count == 1:
                 await client.expire(redis_key, self.ttl_seconds)
         except Exception as e:
             await self._reset_client(e)
             self._fallback.increment(key)
 
     async def check_and_increment(self, key: str, limit: int) -> tuple[bool, int]:
         """Atomically increment counter and check against limit.
 
         Returns (allowed, current_count). If over limit, decrements back.
         """
         client = await self._get_client()
         if client is None:
             current = self._fallback.get_count(key)
             if current >= limit:
                 return False, current
             self._fallback.increment(key)
             return True, current + 1
 
         redis_key = f"{self._namespace}:{key}"
         try:
             count = await client.incr(redis_key)
             if count == 1:
                 await client.expire(redis_key, self.ttl_seconds)
             if count > limit:
                 await client.decr(redis_key)
                 return False, limit
             return True, int(count)
         except Exception as e:
             await self._reset_client(e)
             current = self._fallback.get_count(key)
             if current >= limit:
                 return False, current
             self._fallback.increment(key)
             return True, current + 1
 
 
 demo_chat_limiter = RedisRateLimiter(namespace="rate_limit:demo_chat", max_requests=10, window_seconds=60)
 auth_chat_limiter = RedisRateLimiter(namespace="rate_limit:auth_chat", max_requests=30, window_seconds=60)
 demo_message_tracker = RedisDemoTracker(namespace="rate_limit:demo_messages")
 demo_session_create_limiter = RedisRateLimiter(
     namespace="rate_limit:demo_session_create", max_requests=5, window_seconds=300
 )
 # Public shared-view endpoint — anonymous, unauthenticated. Limit per IP to prevent
 # token enumeration and traffic amplification. 60/min is generous for legitimate
 # users refreshing but blocks brute-force UUID scanning.
 shared_view_limiter = RedisRateLimiter(
     namespace="rate_limit:shared_view", max_requests=60, window_seconds=60
 )
 # Anonymous read endpoints for demo documents (search, chunk detail). Gated
 # behind can_access_document so logged-in traffic bypasses this limiter.
 anon_read_limiter = RedisRateLimiter(
     namespace="rate_limit:anon_read", max_requests=120, window_seconds=60
 )
 public_event_limiter = RedisRateLimiter(
     namespace="rate_limit:public_events", max_requests=30, window_seconds=60
 )
 
 
+# Pre-encode signing secrets once at import time. hmac.new() requires bytes,
+# and re-encoding per-request is wasteful. Re-read at call time would re-import
+# settings, which is unnecessary because the process is restarted on env change.
+_ADAPTER_SECRET_BYTES: bytes = (settings.ADAPTER_SECRET or "").encode("utf-8")
+_AUTH_SECRET_BYTES: bytes = (settings.AUTH_SECRET or "").encode("utf-8")
+
+# Max clock skew accepted on the new HMAC contract. 60s covers NTP drift between
+# Vercel and Railway while keeping the replay window narrow. The signature is
+# bound to a per-request unix timestamp so deterministic-bucket replay (the bug
+# Codex caught in R3) is impossible.
+_MAX_SIGNED_IP_SKEW_S = 60
+
+
+def verify_signed_ip(
+    *,
+    ip: str | None,
+    ts: str | None,
+    sig: str | None,
+    now: float | None = None,
+    max_skew_s: int = _MAX_SIGNED_IP_SKEW_S,
+) -> tuple[bool, str | None]:
+    """Verify the triple-header HMAC IP claim emitted by the frontend proxy.
+
+    Contract:
+      X-Proxy-IP:     <ip>
+      X-Proxy-IP-Ts:  <unix_seconds>
+      X-Proxy-IP-Sig: hex(HMAC-SHA256(ADAPTER_SECRET, "{ip}:{ts}"))
+
+    Returns (ok, reason). `reason` is a short tag suitable for log fields when
+    `ok` is False; on success it is None.
+    """
+    if not ip or not ts or not sig:
+        return False, "missing_headers"
+    if not _ADAPTER_SECRET_BYTES:
+        return False, "no_adapter_secret"
+    try:
+        ts_int = int(ts)
+    except (TypeError, ValueError):
+        return False, "malformed_ts"
+    current = now if now is not None else time.time()
+    skew = abs(current - ts_int)
+    if skew > max_skew_s:
+        return False, "skew_exceeded"
+    expected = hmac.new(
+        _ADAPTER_SECRET_BYTES,
+        f"{ip}:{ts_int}".encode("utf-8"),
+        digestmod="sha256",
+    ).hexdigest()
+    if not hmac.compare_digest(expected, sig):
+        return False, "bad_signature"
+    return True, None
+
+
 def get_client_ip(request: "Request") -> str:
-    """Extract real client IP from trusted Vercel proxy.
+    """Extract real client IP from the trusted Vercel proxy.
 
-    The proxy sends X-Real-Client-IP along with X-Proxy-IP-Secret (shared
-    AUTH_SECRET) to prove authenticity. Falls back to request.client.host for
-    direct access (dev/testing). Never trust raw X-Forwarded-For.
+    New contract (preferred): triple-header HMAC.
+      X-Proxy-IP / X-Proxy-IP-Ts / X-Proxy-IP-Sig signed with ADAPTER_SECRET.
+
+    Legacy contract (dual-accept transition window — remove 24h after rollout):
+      X-Real-Client-IP + X-Proxy-IP-Secret compared against AUTH_SECRET.
+
+    Falls back to request.client.host for direct access (dev/testing). Never
+    trust raw X-Forwarded-For.
     """
+    # New contract — prefer this when present.
+    new_ip = request.headers.get("x-proxy-ip")
+    new_ts = request.headers.get("x-proxy-ip-ts")
+    new_sig = request.headers.get("x-proxy-ip-sig")
+    if new_ip or new_ts or new_sig:
+        ok, reason = verify_signed_ip(ip=new_ip, ts=new_ts, sig=new_sig)
+        if ok:
+            return new_ip.strip()  # type: ignore[union-attr]
+        # Compute skew for logging (best-effort; never raise).
+        skew_s: float | None = None
+        if new_ts:
+            try:
+                skew_s = abs(time.time() - int(new_ts))
+            except (TypeError, ValueError):
+                skew_s = None
+        logger.warning(
+            "proxy.signed_ip.verification_failed",
+            extra={
+                "reason": reason,
+                "claimed_ip": new_ip,
+                "skew_s": skew_s,
+            },
+        )
+        # Do NOT trust the claimed IP on failure. Fall through to legacy/host.
+
+    # Legacy contract — dual-accept during the rollout window. The compare uses
+    # AUTH_SECRET (the OLD signing secret, NOT ADAPTER_SECRET — Codex R5) and
+    # reads X-Real-Client-IP (the OLD trusted IP header, NOT X-Real-IP — R4).
     proxied_ip = request.headers.get("x-real-client-ip")
     proxy_secret = request.headers.get("x-proxy-ip-secret")
     if (
         proxied_ip
         and proxy_secret
-        and settings.AUTH_SECRET
-        and hmac.compare_digest(proxy_secret, settings.AUTH_SECRET)
+        and _AUTH_SECRET_BYTES
+        and hmac.compare_digest(proxy_secret.encode("utf-8"), _AUTH_SECRET_BYTES)
     ):
+        logger.info("proxy.signed_ip.legacy_path_used")
         return proxied_ip.strip()
+
     return request.client.host if request.client else "unknown"

codex
I confirmed backend rate-limit changes and now I’m pulling the frontend/test/docs diffs directly; the first frontend diff command failed because zsh treated `[...path]` as a glob, so I’m rerunning with proper quoting.
exec
/bin/zsh -lc 'git diff --unified=260 8ca0145 fe7269e -- backend/tests/test_proxy_ip_verification.py' in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
diff --git a/backend/tests/test_proxy_ip_verification.py b/backend/tests/test_proxy_ip_verification.py
new file mode 100644
index 0000000..3699cc5
--- /dev/null
+++ b/backend/tests/test_proxy_ip_verification.py
@@ -0,0 +1,188 @@
+"""Tests for the HMAC IP trust chain (Wave-1 C1).
+
+Covers the new triple-header contract (`X-Proxy-IP` / `X-Proxy-IP-Ts` /
+`X-Proxy-IP-Sig` signed with `ADAPTER_SECRET`), the dual-accept legacy branch
+(`X-Real-Client-IP` + `X-Proxy-IP-Secret` compared against `AUTH_SECRET`), and
+two regression guards for bugs Codex caught in R4 (wrong fallback header) and
+R5 (wrong legacy secret) during the consensus loop.
+"""
+
+from __future__ import annotations
+
+import hmac
+import time
+from dataclasses import dataclass
+from typing import Any
+
+import pytest
+
+from app.core import rate_limit
+from app.core.rate_limit import get_client_ip, verify_signed_ip
+from tests.conftest import TEST_ADAPTER_SECRET, TEST_AUTH_SECRET
+
+
+def _sign(ip: str, ts: int, secret: str = TEST_ADAPTER_SECRET) -> str:
+    return hmac.new(
+        secret.encode("utf-8"),
+        f"{ip}:{ts}".encode("utf-8"),
+        digestmod="sha256",
+    ).hexdigest()
+
+
+@dataclass
+class _FakeClient:
+    host: str
+
+
+class _FakeRequest:
+    """Minimal Request stand-in. get_client_ip only reads .headers and .client."""
+
+    def __init__(self, headers: dict[str, str], client_host: str = "10.0.0.1"):
+        # FastAPI Request headers are case-insensitive; replicate that.
+        self.headers = _CaseInsensitiveHeaders(headers)
+        self.client = _FakeClient(host=client_host)
+
+
+class _CaseInsensitiveHeaders(dict):
+    def __init__(self, mapping: dict[str, str]):
+        super().__init__()
+        for k, v in mapping.items():
+            self[k.lower()] = v
+
+    def get(self, key: str, default: Any = None) -> Any:  # type: ignore[override]
+        return super().get(key.lower(), default)
+
+
+@pytest.fixture(autouse=True)
+def _ensure_secrets_loaded(monkeypatch: pytest.MonkeyPatch) -> None:
+    """conftest sets env vars, but rate_limit.py snapshots bytes at import.
+    Force them to the test values so tests are independent of import order.
+    """
+    monkeypatch.setattr(
+        rate_limit, "_ADAPTER_SECRET_BYTES", TEST_ADAPTER_SECRET.encode("utf-8")
+    )
+    monkeypatch.setattr(
+        rate_limit, "_AUTH_SECRET_BYTES", TEST_AUTH_SECRET.encode("utf-8")
+    )
+
+
+# 1
+def test_valid_new_contract_passes() -> None:
+    ts = int(time.time())
+    ok, reason = verify_signed_ip(ip="1.2.3.4", ts=str(ts), sig=_sign("1.2.3.4", ts))
+    assert ok is True
+    assert reason is None
+
+
+# 2
+def test_skew_within_window_passes() -> None:
+    ts = int(time.time()) - 50  # within 60s window
+    ok, reason = verify_signed_ip(ip="1.2.3.4", ts=str(ts), sig=_sign("1.2.3.4", ts))
+    assert ok is True
+    assert reason is None
+
+
+# 3
+def test_skew_exceeds_window_fails() -> None:
+    ts = int(time.time()) - 120  # outside 60s window
+    ok, reason = verify_signed_ip(ip="1.2.3.4", ts=str(ts), sig=_sign("1.2.3.4", ts))
+    assert ok is False
+    assert reason == "skew_exceeded"
+
+
+# 4
+def test_malformed_timestamp_fails() -> None:
+    ok, reason = verify_signed_ip(ip="1.2.3.4", ts="not-a-number", sig="deadbeef")
+    assert ok is False
+    assert reason == "malformed_ts"
+
+
+# 5
+def test_bad_signature_fails() -> None:
+    ts = int(time.time())
+    ok, reason = verify_signed_ip(ip="1.2.3.4", ts=str(ts), sig="0" * 64)
+    assert ok is False
+    assert reason == "bad_signature"
+
+
+# 6
+def test_missing_headers_returns_none() -> None:
+    ok, reason = verify_signed_ip(ip=None, ts=None, sig=None)
+    assert ok is False
+    assert reason == "missing_headers"
+
+    ok, reason = verify_signed_ip(ip="1.2.3.4", ts=None, sig=None)
+    assert ok is False
+    assert reason == "missing_headers"
+
+    # Through the request-level path: no headers at all → falls back to host.
+    req = _FakeRequest(headers={}, client_host="10.0.0.5")
+    assert get_client_ip(req) == "10.0.0.5"
+
+
+# 7
+def test_legacy_secret_with_auth_secret_passes() -> None:
+    """Legacy contract: X-Proxy-IP-Secret compared against AUTH_SECRET."""
+    req = _FakeRequest(
+        headers={
+            "X-Real-Client-IP": "203.0.113.7",
+            "X-Proxy-IP-Secret": TEST_AUTH_SECRET,
+        },
+        client_host="10.0.0.1",
+    )
+    assert get_client_ip(req) == "203.0.113.7"
+
+
+# 8 — regression guard for the Codex R5 catch
+def test_legacy_secret_with_adapter_secret_fails() -> None:
+    """If we mistakenly compared the legacy secret against ADAPTER_SECRET, the
+    rollout would 429-collapse all in-flight legacy requests. Guard against
+    re-introducing that bug. AUTH_SECRET is the legitimate legacy key.
+    """
+    assert TEST_ADAPTER_SECRET != TEST_AUTH_SECRET  # sanity
+    req = _FakeRequest(
+        headers={
+            "X-Real-Client-IP": "203.0.113.7",
+            "X-Proxy-IP-Secret": TEST_ADAPTER_SECRET,  # WRONG secret for legacy
+        },
+        client_host="10.0.0.1",
+    )
+    # Should reject the legacy claim and fall through to client.host.
+    assert get_client_ip(req) == "10.0.0.1"
+
+
+# 9 — regression guard for the Codex R4 catch
+def test_legacy_returns_x_real_client_ip_not_client_host() -> None:
+    """The production legacy contract is `X-Real-Client-IP`, not `X-Real-IP`.
+    If we'd read the wrong header, all traffic would collapse to Vercel egress
+    IPs and mass-429 legitimate users during the rollout window. Guard.
+    """
+    req = _FakeRequest(
+        headers={
+            # The OLD/WRONG header name — must NOT be trusted.
+            "X-Real-IP": "8.8.8.8",
+            # The correct legacy header.
+            "X-Real-Client-IP": "203.0.113.42",
+            "X-Proxy-IP-Secret": TEST_AUTH_SECRET,
+        },
+        client_host="10.0.0.1",
+    )
+    assert get_client_ip(req) == "203.0.113.42"
+
+
+# 10 — bonus: when both contracts arrive, the new path wins.
+def test_both_old_and_new_headers_new_path_preferred() -> None:
+    ts = int(time.time())
+    req = _FakeRequest(
+        headers={
+            # New contract — should win.
+            "X-Proxy-IP": "198.51.100.5",
+            "X-Proxy-IP-Ts": str(ts),
+            "X-Proxy-IP-Sig": _sign("198.51.100.5", ts),
+            # Legacy contract — present but should be ignored when new is valid.
+            "X-Real-Client-IP": "203.0.113.99",
+            "X-Proxy-IP-Secret": TEST_AUTH_SECRET,
+        },
+        client_host="10.0.0.1",
+    )
+    assert get_client_ip(req) == "198.51.100.5"

exec
/bin/zsh -lc "git diff --unified=220 8ca0145 fe7269e -- 'frontend/src/app/api/proxy/[...path]/route.ts' 'frontend/src/app/shared/[token]/page.tsx'" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
diff --git a/frontend/src/app/api/proxy/[...path]/route.ts b/frontend/src/app/api/proxy/[...path]/route.ts
index 43e6d45..413fd62 100644
--- a/frontend/src/app/api/proxy/[...path]/route.ts
+++ b/frontend/src/app/api/proxy/[...path]/route.ts
@@ -1,134 +1,150 @@
+import { createHmac } from "node:crypto";
 import { getToken } from "next-auth/jwt";
 import { SignJWT } from "jose";
 import { NextRequest, NextResponse } from "next/server";
 
-const BACKEND_URL = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";
+// C2: prefer BACKEND_INTERNAL_URL (Railway private network) over the public
+// NEXT_PUBLIC_API_BASE so server-side proxy hops stay on the internal mesh.
+const BACKEND_URL =
+  process.env.BACKEND_INTERNAL_URL ||
+  process.env.NEXT_PUBLIC_API_BASE ||
+  "http://localhost:8000";
 const AUTH_SECRET = process.env.AUTH_SECRET;
+// C1: ADAPTER_SECRET is the per-deployment shared secret used to HMAC-sign
+// the X-Proxy-IP claim sent to the backend. Distinct from AUTH_SECRET (which
+// Auth.js v5 uses to encrypt session JWEs) — separation of concerns.
+const ADAPTER_SECRET = process.env.ADAPTER_SECRET;
 
 // Whitelist of safe headers to forward to backend
 const ALLOWED_REQUEST_HEADERS = new Set([
   "content-type",
   "accept",
   "accept-language",
   "accept-encoding",
   "user-agent",
   "cache-control",
   "if-none-match",
   "if-modified-since",
 ]);
 
 // Headers to exclude from response (security-sensitive)
 const EXCLUDED_RESPONSE_HEADERS = new Set([
   "set-cookie",
   "transfer-encoding",
   "connection",
 ]);
 
 /**
  * Create a backend-compatible JWT from the decoded Auth.js session token.
  * Auth.js v5 encrypts session tokens (JWE), so we need to create a plain JWT
  * that the backend can verify with the shared AUTH_SECRET.
  */
 async function createBackendToken(userId: string): Promise<string> {
   if (!AUTH_SECRET) {
     throw new Error("AUTH_SECRET not configured");
   }
   const secret = new TextEncoder().encode(AUTH_SECRET);
   const now = Math.floor(Date.now() / 1000);
 
   return new SignJWT({ sub: userId })
     .setProtectedHeader({ alg: "HS256" })
     .setIssuedAt(now)
     .setExpirationTime(now + 3600) // 1 hour
     .sign(secret);
 }
 
 async function handler(req: NextRequest) {
   // Get decoded token (not raw encrypted token)
   // Must pass secret explicitly for Auth.js v5
   // secureCookie must be true on HTTPS (Vercel) — otherwise getToken looks for
   // "authjs.session-token" instead of "__Secure-authjs.session-token"
   const secureCookie = req.nextUrl.protocol === "https:";
   const token = await getToken({ req, secret: AUTH_SECRET, secureCookie });
 
   const path = req.nextUrl.pathname.replace("/api/proxy", "");
   const url = `${BACKEND_URL}${path}${req.nextUrl.search}`;
 
   // Build headers with whitelist filtering
   const headers = new Headers();
   req.headers.forEach((value, key) => {
     const lowerKey = key.toLowerCase();
     if (ALLOWED_REQUEST_HEADERS.has(lowerKey)) {
       headers.set(key, value);
     }
   });
 
   // Forward the real client IP so backend rate limiting and demo message
   // tracking work correctly (Railway sees Vercel's IP otherwise).
   // On Vercel, both req.ip (Edge) and x-real-ip / x-forwarded-for (Node Serverless)
   // are injected by Vercel itself and strip client-supplied values — they are
   // trustworthy. req.ip is commonly undefined on Node runtime; x-forwarded-for
   // is the authoritative source there.
   const xff = req.headers.get("x-forwarded-for");
   const clientIp =
     req.ip ||
     (xff ? xff.split(",")[0]?.trim() : undefined) ||
     req.headers.get("x-real-ip") ||
     undefined;
-  if (clientIp) {
-    headers.set("X-Real-Client-IP", clientIp);
-    // Prove this header came from our proxy, not a direct attacker
-    const proxySecret = process.env.AUTH_SECRET;
-    if (proxySecret) {
-      headers.set("X-Proxy-IP-Secret", proxySecret);
-    }
+  if (clientIp && ADAPTER_SECRET) {
+    // C1: triple-header HMAC contract. The signature binds the IP to a
+    // per-request unix timestamp so an attacker who scrapes one header set
+    // from a log cannot replay it indefinitely. Backend accepts ±60s skew.
+    // Signing key is ADAPTER_SECRET (NOT AUTH_SECRET — the latter encrypts
+    // session JWEs and must never traverse the wire as a plaintext header).
+    const ts = Math.floor(Date.now() / 1000).toString();
+    const sig = createHmac("sha256", ADAPTER_SECRET)
+      .update(`${clientIp}:${ts}`)
+      .digest("hex");
+    headers.set("X-Proxy-IP", clientIp);
+    headers.set("X-Proxy-IP-Ts", ts);
+    headers.set("X-Proxy-IP-Sig", sig);
   }
 
   // Add authorization if authenticated - create a backend-compatible JWT
   if (token?.sub) {
     try {
       const backendToken = await createBackendToken(token.sub);
       headers.set("Authorization", `Bearer ${backendToken}`);
     } catch (error) {
       console.error("Failed to create backend token:", error);
     }
   }
 
   try {
     // SSE chat endpoints need a longer timeout for streaming responses
     const isChat = /\/sessions\/[^/]+\/chat(\/continue)?$/.test(path);
     const timeout = isChat ? 60000 : 30000;
 
     const response = await fetch(url, {
       method: req.method,
       headers,
       body: req.method !== "GET" && req.method !== "HEAD" ? await req.arrayBuffer() : undefined,
       signal: AbortSignal.timeout(timeout),
     });
 
     // Build response headers with exclusion filtering
     const responseHeaders = new Headers();
     response.headers.forEach((value, key) => {
       const lowerKey = key.toLowerCase();
       if (!EXCLUDED_RESPONSE_HEADERS.has(lowerKey)) {
         responseHeaders.set(key, value);
       }
     });
 
     return new NextResponse(response.body, {
       status: response.status,
       headers: responseHeaders,
     });
   } catch (error) {
     console.error("Proxy request failed:", error);
     if (error instanceof Error && error.name === "TimeoutError") {
       return new NextResponse("Gateway Timeout", { status: 504 });
     }
     return new NextResponse("Bad Gateway", { status: 502 });
   }
 }
 
 // Vercel Hobby max is 60s; needed for SSE chat streaming
 export const maxDuration = 60;
 
 export { handler as GET, handler as POST, handler as PUT, handler as DELETE, handler as PATCH };
diff --git a/frontend/src/app/shared/[token]/page.tsx b/frontend/src/app/shared/[token]/page.tsx
index b63c3e0..ded7867 100644
--- a/frontend/src/app/shared/[token]/page.tsx
+++ b/frontend/src/app/shared/[token]/page.tsx
@@ -1,112 +1,121 @@
+import { createHmac } from 'node:crypto';
 import { notFound } from 'next/navigation';
 import { headers } from 'next/headers';
 import type { Metadata } from 'next';
 
 const BACKEND_URL = process.env.BACKEND_INTERNAL_URL || process.env.NEXT_PUBLIC_API_BASE || '';
-const AUTH_SECRET = process.env.AUTH_SECRET;
+// C1: ADAPTER_SECRET signs the X-Proxy-IP claim. Must match the backend's
+// settings.ADAPTER_SECRET. NOT AUTH_SECRET — AUTH_SECRET stays inside Auth.js.
+const ADAPTER_SECRET = process.env.ADAPTER_SECRET;
 
 interface SharedCitation {
   text_snippet: string;
   page: number;
   document_filename: string;
 }
 
 interface SharedMessage {
   id: string;
   role: string;
   content: string;
   citations?: SharedCitation[];
 }
 
 async function fetchShared(token: string) {
   const headersList = await headers();
   const xff = headersList.get('x-forwarded-for') || '';
   const clientIp = xff.split(',')[0]?.trim() || headersList.get('x-real-ip') || '';
 
   const backendHeaders: Record<string, string> = {};
-  // Pass the real client IP with HMAC proxy-secret proof so backend rate
-  // limiting on /api/shared/{token} counts per real visitor, not per Vercel
-  // egress IP. Same trust model as /api/proxy.
-  if (clientIp && AUTH_SECRET) {
-    backendHeaders['X-Real-Client-IP'] = clientIp;
-    backendHeaders['X-Proxy-IP-Secret'] = AUTH_SECRET;
+  // C1: triple-header HMAC contract. Backend rate-limits /api/shared/{token}
+  // per real visitor; this proves the IP claim came from our SSR origin and
+  // not a direct attacker who can set arbitrary headers. Same trust model as
+  // /api/proxy. Per-request timestamp + 60s skew window blocks replay.
+  if (clientIp && ADAPTER_SECRET) {
+    const ts = Math.floor(Date.now() / 1000).toString();
+    const sig = createHmac('sha256', ADAPTER_SECRET)
+      .update(`${clientIp}:${ts}`)
+      .digest('hex');
+    backendHeaders['X-Proxy-IP'] = clientIp;
+    backendHeaders['X-Proxy-IP-Ts'] = ts;
+    backendHeaders['X-Proxy-IP-Sig'] = sig;
   }
 
   try {
     const res = await fetch(`${BACKEND_URL}/api/shared/${token}`, {
       headers: backendHeaders,
       cache: 'no-store',
     });
     if (!res.ok) return null;
     return res.json();
   } catch {
     return null;
   }
 }
 
 export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
   const { token } = await params;
   const data = await fetchShared(token);
   if (!data) return { title: 'Not Found' };
   const preview = data.messages?.find((m: SharedMessage) => m.role === 'assistant')?.content?.slice(0, 150) || '';
   return {
     title: data.session_title,
     description: preview,
     robots: { index: false, follow: false },
     openGraph: { title: data.session_title, description: preview },
   };
 }
 
 export default async function SharedPage({ params }: { params: Promise<{ token: string }> }) {
   const { token } = await params;
   const data = await fetchShared(token);
   if (!data) notFound();
 
   return (
     <div className="min-h-screen bg-white dark:bg-zinc-950">
       <div className="max-w-3xl mx-auto px-4 py-8">
         <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 mb-1">{data.session_title}</h1>
         <p className="text-sm text-zinc-500 mb-6">Document: {data.document_name}</p>
 
         <div className="space-y-4">
           {data.messages.map((msg: SharedMessage, i: number) => (
             <div
               key={msg.id || i}
               id={msg.id}
               className={`scroll-mt-6 rounded-2xl transition-[background-color,box-shadow] target:bg-blue-50 target:ring-2 target:ring-blue-300 target:ring-offset-4 target:ring-offset-white dark:target:bg-blue-950/30 dark:target:ring-blue-700 dark:target:ring-offset-zinc-950 ${
                 msg.role === 'user' ? 'flex justify-end' : ''
               }`}
             >
               <div className={`max-w-[85%] rounded-xl px-4 py-3 ${
                 msg.role === 'user'
                   ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                   : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100'
               }`}>
                 <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                 {msg.citations && msg.citations.length > 0 && (
                   <div className="mt-2 space-y-1">
                     {msg.citations.map((c, j: number) => (
                       <div key={j} className="text-xs text-zinc-500 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-700 rounded px-2 py-1">
                         p. {c.page}{c.document_filename ? ` — ${c.document_filename}` : ''}: &ldquo;{c.text_snippet}&rdquo;
                       </div>
                     ))}
                   </div>
                 )}
               </div>
             </div>
           ))}
         </div>
 
         <div className="mt-12 text-center border-t border-zinc-200 dark:border-zinc-800 pt-6">
           <p className="text-sm text-zinc-500 mb-3">Powered by DocTalk</p>
           <a
             href="https://www.doctalk.site"
             className="inline-block px-6 py-2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
           >
             Try DocTalk Free
           </a>
         </div>
       </div>
     </div>
   );
 }

exec
/bin/zsh -lc 'git diff --unified=220 8ca0145 fe7269e -- CLAUDE.md AGENTS.md docs/ARCHITECTURE.md docs/ARCHITECTURE.zh.md README.md frontend/src/app/trust/TrustPageClient.tsx .github/workflows/ci.yml' in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
diff --git a/.github/workflows/ci.yml b/.github/workflows/ci.yml
index 7b93bc0..28814b6 100644
--- a/.github/workflows/ci.yml
+++ b/.github/workflows/ci.yml
@@ -1,91 +1,91 @@
 name: CI
 
 on:
   push:
     branches: [main]
   pull_request:
     branches: [main]
 
 concurrency:
   group: ci-${{ github.ref }}
   cancel-in-progress: true
 
 jobs:
   backend:
     runs-on: ubuntu-latest
     defaults:
       run:
         working-directory: backend
     steps:
       - uses: actions/checkout@v4
       - uses: actions/setup-python@v5
         with:
           python-version: "3.12"
           cache: pip
           cache-dependency-path: backend/requirements-dev.txt
       - run: pip install -r requirements-dev.txt
       - run: python ../scripts/check_version_consistency.py
       - run: ruff check app/ tests/
-      - run: python -m pytest tests/test_smoke.py tests/test_parse_service.py -v
+      - run: python -m pytest tests/test_smoke.py tests/test_parse_service.py tests/test_proxy_ip_verification.py -v
         env:
           DATABASE_URL: postgresql+asyncpg://postgres:postgres@localhost:5432/postgres
 
   migrations:
     # Catches broken alembic downgrade() paths, which would silently make
     # production rollback impossible.
     runs-on: ubuntu-latest
     defaults:
       run:
         working-directory: backend
     services:
       postgres:
         image: postgres:16.6
         env:
           POSTGRES_USER: postgres
           POSTGRES_PASSWORD: postgres
           POSTGRES_DB: doctalk_ci
         ports:
           - 5432:5432
         options: >-
           --health-cmd pg_isready
           --health-interval 5s
           --health-timeout 3s
           --health-retries 10
     steps:
       - uses: actions/checkout@v4
       - uses: actions/setup-python@v5
         with:
           python-version: "3.12"
           cache: pip
           cache-dependency-path: backend/requirements-dev.txt
       - run: pip install -r requirements-dev.txt
       - run: python -m pytest tests/test_migrations.py -v -m integration
         env:
           DATABASE_URL: postgresql+asyncpg://postgres:postgres@localhost:5432/doctalk_ci
           # conftest.py defaults SKIP_INTEGRATION=1 so integration tests skip
           # locally; this job has a real postgres service and must run them.
           SKIP_INTEGRATION: "0"
 
   frontend:
     runs-on: ubuntu-latest
     defaults:
       run:
         working-directory: frontend
     steps:
       - uses: actions/checkout@v4
       - uses: actions/setup-node@v4
         with:
           node-version: 20
           cache: npm
           cache-dependency-path: frontend/package-lock.json
       - run: npm ci
       - run: npm run lint
       - run: npm run build
         env:
           NEXT_PUBLIC_API_BASE: http://localhost:8000
 
   docker:
     runs-on: ubuntu-latest
     steps:
       - uses: actions/checkout@v4
       - run: docker build -t doctalk-test -f backend/Dockerfile .
diff --git a/AGENTS.md b/AGENTS.md
index f27d966..0222f79 100644
--- a/AGENTS.md
+++ b/AGENTS.md
@@ -1,105 +1,105 @@
 # AGENTS.md
 
 > Mirror of CLAUDE.md for Codex / other agents that do not auto-read
 > `CLAUDE.md`. Keep the two files in sync. CLAUDE.md is authoritative for
 > Claude Code (which supports `@import` syntax); this file is for agents
 > that only read one top-level guide.
 
 ## Project
 
 DocTalk — AI document Q&A web app. Upload PDF / DOCX / PPTX / XLSX / TXT / MD / URL; chat with AI that cites the exact source passage. 11 locales.
 
 | Component | Stack | URL |
 |---|---|---|
 | Frontend | Next.js 14 (App Router), Vercel | https://www.doctalk.site |
 | Backend | FastAPI + Celery, Railway | https://backend-production-a62e.up.railway.app |
 | Infra | Postgres 16, Qdrant, MinIO, Redis | Railway (5 services) |
 | Repo | GitHub (public) | https://github.com/Rswcf/DocTalk |
 
 LLM chat modes use DeepSeek V4 — internal `quick` = Flash, internal `balanced` = Pro. OpenRouter remains the embedding/fallback gateway. Auth.js v5 (Google / Microsoft / email magic link). Stripe billing is live in production; local/test environments may still use `sk_test_*`.
 
 ## Dev commands
 
 ```bash
 docker compose up -d
 cd backend && python3 -m uvicorn app.main:app --reload
 cd frontend && npm run dev
 
 # macOS fork-safety flag is MANDATORY for Celery worker
 cd backend && OBJC_DISABLE_INITIALIZE_FORK_SAFETY=YES \
   python3 -m celery -A app.workers.celery_app worker \
   --loglevel=info -Q default,parse
 
 cd backend && python3 -m alembic upgrade head
 ```
 
 ## Verify before claiming done
 
 ```bash
 cd frontend && npm run build       # must pass, not just `npm run dev`
 cd backend && python3 -m ruff check app/ tests/
 cd backend && python3 -m pytest tests/test_parse_service.py -v   # no deps
 cd backend && python3 -m pytest -m integration -v                # docker required
 ```
 
 For UI changes, exercise the golden path in a browser: upload → chat → citation jump.
 
 ## Deploy
 
 `main` = dev → Vercel preview. `stable` = prod → `doctalk.site` + Railway.
 
 ```bash
 git push origin main
 git checkout stable && git merge main && git push origin stable
 # Backend changes? From stable:
 railway up --detach
 git checkout main
 ```
 
 - Vercel root directory = `frontend/`. Never run `vercel --prod`.
 - Railway deploys only from `stable`. Never from `main`.
 - DB migrations during beta: add-only. No drops/renames.
 
 ## Env vars
 
 - **Backend** (`.env` + Railway): `DATABASE_URL`, `OPENROUTER_API_KEY`, `DEEPSEEK_API_KEY`, `AUTH_SECRET`, `ADAPTER_SECRET`, `STRIPE_SECRET_KEY` (`sk_live_*` in production; `sk_test_*` only for local/test), `STRIPE_WEBHOOK_SECRET`
-- **Frontend** (Vercel): `NEXT_PUBLIC_API_BASE` (**never** localhost in prod), `AUTH_SECRET`, `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`, `MICROSOFT_CLIENT_ID` / `MICROSOFT_CLIENT_SECRET`, `RESEND_API_KEY`
+- **Frontend** (Vercel): `NEXT_PUBLIC_API_BASE` (**never** localhost in prod), `BACKEND_INTERNAL_URL` (preferred for server-side proxy hop), `AUTH_SECRET`, `ADAPTER_SECRET`, `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`, `MICROSOFT_CLIENT_ID` / `MICROSOFT_CLIENT_SECRET`, `RESEND_API_KEY`
 
-Cross-origin IP trust chain is HMAC-signed with `ADAPTER_SECRET` — frontend and backend values must match.
+Cross-origin IP trust chain is HMAC-signed with `ADAPTER_SECRET` — frontend and backend values must match. Proxy emits `X-Proxy-IP` / `X-Proxy-IP-Ts` / `X-Proxy-IP-Sig` (HMAC-SHA256 of `"{ip}:{ts}"`); backend verifies with `hmac.compare_digest` and ±60s skew. Never send `AUTH_SECRET` in an outbound header — it's the Auth.js JWE key.
 
 ## Path-scoped rules
 
 Both agents (Claude + Codex) should read these when working in the matching area:
 
 - `.claude/rules/backend.md` — async safety, credits, parse worker, auth, demo system
 - `.claude/rules/frontend.md` — API proxy, UI palette, i18n, react-pdf, subscriptions
 
 ## Avoid (learned the hard way)
 
 - **BSD sed has no `\b`** word boundary. Use `s/pattern\([^a-z]\)/replacement\1/g` or switch to GNU `sed`.
 - **Don't `railway up` from `main`**. Always `git checkout stable` first.
 - **Don't set cookies in `middleware.ts`**. Next.js auto-applies `Cache-Control: private, no-store` to the entire response tree, killing SEO. Locale detection already runs client-side in `LocaleProvider`.
 - **Don't `await cookies()` in `app/layout.tsx`** — same root cause, forces every page to `ƒ Dynamic` rendering.
 - **Don't commit `frontend/tsconfig.tsbuildinfo`** (gitignored) or personal `.claude/settings.json` tweaks.
 - **i18n updates must hit all 11 locales** (en / zh / ja / ko / es / de / fr / pt / it / ar / hi). Use `tOr(key, fallback)` when shipping a new key ahead of translation.
 - **Don't skip adversarial review** for commits > 30 lines of logic or any security-adjacent change. Claude ↔ Codex cross-review is the norm.
 - **`"更新文档"` means every affected `.md`** — grep before assuming which doc needs touching.
 
 ## Codex collaboration (when Claude delegates)
 
 Model: **`gpt-5.3-codex`**. Codex sandbox **cannot run git** — Claude commits.
 
 ```bash
 cat prompt.md | codex exec --full-auto -m gpt-5.3-codex \
   -C /Users/mayijie/Projects/Code/010_DocTalk
 ```
 
 (Positional-arg prompts hang in some versions — pipe via stdin.)
 
 Collab artifacts: `.collab/{plans,reviews,dialogue,tasks,archive}/`.
 
 ## Reference
 
 - `docs/ARCHITECTURE.md` §10 — runtime + operational integrity (living section)
 - `.collab/reviews/2026-04-12-final-fix-report.md` — template of what a Codex-reviewed batch looks like
 - `CLAUDE.md` — authoritative twin of this file; keep in sync
diff --git a/CLAUDE.md b/CLAUDE.md
index 147ec5b..e01f39e 100644
--- a/CLAUDE.md
+++ b/CLAUDE.md
@@ -1,100 +1,100 @@
 # CLAUDE.md
 
 ## Project
 
 DocTalk — AI document Q&A web app. Upload PDF / DOCX / PPTX / XLSX / TXT / MD / URL; chat with AI that cites the exact source passage. 11 locales.
 
 | Component | Stack | URL |
 |---|---|---|
 | Frontend | Next.js 14 (App Router), Vercel | https://www.doctalk.site |
 | Backend | FastAPI + Celery, Railway | https://backend-production-a62e.up.railway.app |
 | Infra | Postgres 16, Qdrant, MinIO, Redis | Railway (5 services) |
 | Repo | GitHub (public) | https://github.com/Rswcf/DocTalk |
 
 LLM chat modes use DeepSeek V4 — internal `quick` = Flash, internal `balanced` = Pro. OpenRouter remains the embedding/fallback gateway. Auth.js v5 (Google / Microsoft / email magic link). Stripe billing is live in production; local/test environments may still use `sk_test_*`.
 
 ## Dev commands (Claude can't guess these)
 
 ```bash
 docker compose up -d                      # Start infra (pg/qdrant/minio/redis)
 cd backend && python3 -m uvicorn app.main:app --reload
 cd frontend && npm run dev
 
 # macOS fork-safety flag is MANDATORY for Celery worker
 cd backend && OBJC_DISABLE_INITIALIZE_FORK_SAFETY=YES \
   python3 -m celery -A app.workers.celery_app worker \
   --loglevel=info -Q default,parse
 
 cd backend && python3 -m alembic upgrade head   # DB migration
 ```
 
 ## Verify before claiming done
 
 Run these after any non-trivial change — they are the contract for "this ships":
 
 ```bash
 cd frontend && npm run build       # must pass, not just `npm run dev`
 cd backend && python3 -m ruff check app/ tests/
 cd backend && python3 -m pytest tests/test_parse_service.py -v   # no deps
 cd backend && python3 -m pytest -m integration -v                # docker required
 ```
 
 For UI changes, also open the dev server in a browser and exercise the golden path (upload → chat → citation jump).
 
 ## Deploy
 
 `main` = development → Vercel **preview** only. `stable` = production → Vercel `doctalk.site` + Railway backend.
 
 ```bash
 git push origin main
 git checkout stable && git merge main && git push origin stable
 # Backend changes? Add this from stable:
 railway up --detach
 git checkout main
 ```
 
 Full procedure + guardrails: see `.claude/skills/deploy/SKILL.md` (invoked via `/deploy`).
 
 ## Key env vars
 
 - **Backend** (`.env` + Railway): `DATABASE_URL`, `OPENROUTER_API_KEY`, `DEEPSEEK_API_KEY`, `AUTH_SECRET`, `ADAPTER_SECRET`, `STRIPE_SECRET_KEY` (`sk_live_*` in production; `sk_test_*` only for local/test), `STRIPE_WEBHOOK_SECRET`
-- **Frontend** (Vercel): `NEXT_PUBLIC_API_BASE` (**never** localhost in prod), `AUTH_SECRET`, `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`, `MICROSOFT_CLIENT_ID` / `MICROSOFT_CLIENT_SECRET`, `RESEND_API_KEY`
+- **Frontend** (Vercel): `NEXT_PUBLIC_API_BASE` (**never** localhost in prod), `BACKEND_INTERNAL_URL` (preferred for server-side proxy hop), `AUTH_SECRET`, `ADAPTER_SECRET`, `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`, `MICROSOFT_CLIENT_ID` / `MICROSOFT_CLIENT_SECRET`, `RESEND_API_KEY`
 
-Cross-origin IP trust chain is HMAC-signed with `ADAPTER_SECRET` — frontend and backend values **must match**.
+Cross-origin IP trust chain is HMAC-signed with `ADAPTER_SECRET` — frontend and backend values **must match**. The proxy emits `X-Proxy-IP` / `X-Proxy-IP-Ts` / `X-Proxy-IP-Sig` (HMAC-SHA256 of `"{ip}:{ts}"`); backend verifies with `hmac.compare_digest` and ±60s skew. Never put `AUTH_SECRET` in an outbound header — it's the Auth.js JWE encryption key.
 
 ## Path-scoped rules (imported)
 
 @.claude/rules/backend.md — async safety, credits, parse worker, auth, demo system
 @.claude/rules/frontend.md — API proxy, UI palette, i18n, react-pdf, subscriptions
 
 ## Avoid (learned the hard way)
 
 - **BSD sed has no `\b` word boundary**. Use `s/pattern\([^a-z]\)/replacement\1/g` or GNU `sed`.
 - **Don't `railway up` from `main`**. Always `git checkout stable` first.
 - **Don't set cookies in `middleware.ts`**. Next.js auto-applies `Cache-Control: private, no-store` to the entire response tree, killing SEO. Locale detection already runs client-side in `LocaleProvider`.
 - **Don't `await cookies()` in `app/layout.tsx`** for the same reason — it forces every page to `ƒ Dynamic` rendering.
 - **Don't commit uncompressed build artifacts** (`frontend/tsconfig.tsbuildinfo` is `.gitignore`d; personal `.claude/settings.json` permission tweaks stay local).
 - **i18n updates must hit all 11 locales** (en / zh / ja / ko / es / de / fr / pt / it / ar / hi). Use `tOr(key, fallback)` when shipping a new key ahead of translation.
 - **Don't skip Codex adversarial review** for commits > 30 lines of logic or any security-adjacent change. See "Codex collaboration" below.
 - **Universal rules**: don't start a second dev server without checking, and `"更新文档"` means update every affected `.md` — grep before assuming.
 
 ## Codex collaboration
 
 Model name is **`gpt-5.3-codex`**. Codex sandbox **cannot run git** — commit from Claude.
 
 ```bash
 cat prompt.md | codex exec --full-auto -m gpt-5.3-codex \
   -C /Users/mayijie/Projects/Code/010_DocTalk
 ```
 
 (Positional-arg prompts hang in some Codex versions — pipe via stdin instead.)
 
 - Major features + security-sensitive commits go through Claude → Codex adversarial review → multi-round until consensus.
 - Collab artifacts live in `.collab/{plans,reviews,dialogue,tasks,archive}/`. Plans → reviews → dialogue per round.
 - When user asks for implementation, prefer delegating to Codex unless told otherwise.
 
 ## Reference
 
 - `docs/ARCHITECTURE.md` — runtime + operational integrity decisions (§10 is the living one)
 - `.collab/reviews/2026-04-12-final-fix-report.md` — the P1/P2 fix-batch story; templates for how a Codex-reviewed batch reads
 - `AGENTS.md` — mirror of this file for Codex / other agents that don't auto-read `CLAUDE.md`
diff --git a/README.md b/README.md
index 968f491..812c78b 100644
--- a/README.md
+++ b/README.md
@@ -1,258 +1,260 @@
 <p align="center">
   <strong>English</strong> ·
   <a href="README.zh.md">中文</a> ·
   <a href="README.fr.md">Français</a> ·
   <a href="README.es.md">Español</a> ·
   <a href="README.de.md">Deutsch</a> ·
   <a href="README.pt.md">Português</a> ·
   <a href="README.ja.md">日本語</a> ·
   <a href="README.ko.md">한국어</a>
 </p>
 
 <h1 align="center">DocTalk</h1>
 
 <p align="center">
   <strong>Chat with any document. Get answers with citations that highlight the source.</strong>
 </p>
 
 <p align="center">
   <a href="https://github.com/Rswcf/DocTalk/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="MIT License" /></a>
   <a href="https://github.com/Rswcf/DocTalk/stargazers"><img src="https://img.shields.io/github/stars/Rswcf/DocTalk?style=social" alt="GitHub Stars" /></a>
   <a href="https://www.doctalk.site/demo"><img src="https://img.shields.io/badge/Live%20Demo-doctalk.site-brightgreen" alt="Live Demo" /></a>
   <a href="https://github.com/Rswcf/DocTalk/pulls"><img src="https://img.shields.io/badge/PRs-welcome-orange.svg" alt="PRs Welcome" /></a>
 </p>
 
 <p align="center">
   <a href="https://www.doctalk.site/demo">
     <img src="https://www.doctalk.site/opengraph-image" alt="DocTalk Screenshot" width="720" />
   </a>
 </p>
 
 ---
 
 Upload PDFs, Word docs, PowerPoints, spreadsheets, or any webpage — then ask questions in natural language. DocTalk returns AI-generated answers with numbered citations (`[1]`, `[2]`) that link directly to the source text. Click a citation and the original passage highlights on the page.
 
 ## Why DocTalk?
 
 - **Cited answers with page highlighting** — Every answer references exact passages. Click a citation to jump to the page with the text highlighted.
 - **Multi-format support** — PDF, DOCX, PPTX, XLSX, TXT, Markdown, and URL import. Tables, slides, and spreadsheets are all fully supported.
 - **2 AI performance modes** — Flash for fast cited answers and Pro for deeper analysis, powered by DeepSeek V4.
 - **11 languages** — Full UI and AI responses in English, Chinese, Spanish, Japanese, German, French, Korean, Portuguese, Italian, Arabic, and Hindi.
 - **Split-view reader** — Resizable chat panel alongside a PDF viewer with zoom, search, and drag-to-pan.
 - **Document collections** — Group documents together and ask cross-document questions with source attribution.
 - **Auto-summary** — AI generates a document summary and suggested questions after upload.
 - **Privacy-first** — GDPR data export, cookie consent, encryption at rest, SSRF protection, non-root containers.
 
 <p align="center">
   <a href="https://www.doctalk.site/demo"><strong>Try the live demo &rarr;</strong></a>
 </p>
 
 ## Tech Stack
 
 | Layer | Technology |
 |-------|------------|
 | **Frontend** | Next.js 14 (App Router), Auth.js v5, react-pdf v9, Tailwind CSS, Radix UI, Zustand |
 | **Backend** | FastAPI, Celery, Redis |
 | **Database** | PostgreSQL 16, Qdrant (vector search) |
 | **Storage** | MinIO / S3-compatible |
 | **Auth** | Auth.js v5 — Google OAuth, Microsoft OAuth, Email Magic Link |
 | **Payments** | Stripe Checkout + Subscriptions |
 | **AI** | DeepSeek V4 Flash/Pro for chat; OpenRouter for embeddings and fallback models |
 | **Parsing** | Azure AI Document Intelligence, PyMuPDF, Tesseract OCR, python-docx, python-pptx, openpyxl, LibreOffice |
 | **Monitoring** | Sentry, Vercel Analytics |
 
 ## Architecture
 
 ```
 Browser ──→ Vercel (Next.js) ──→ Railway (FastAPI) ──→ PostgreSQL
                 │                       │                Qdrant
                 │                       │                Redis
                 └── API Proxy ──────────┘                MinIO
                    (JWT injection)
 ```
 
 **How it works:** The reader is chat-native: users ask in natural language, and
 an action planner decides whether the request should use ordinary cited RAG,
 whole-document summary context, structured extraction, table scan/export,
 template guidance, document comparison clarification, or citation lookup.
 Documents are still chunked with bounding-box coordinates and embedded into
 Qdrant for local questions, but async work products return as artifact cards in
 the same chat instead of separate workspace tabs. Citations map back to exact
 page locations for real-time highlighting.
 
 Parsing now also writes canonical document elements for headings, paragraphs,
 and detected tables. Chunk RAG remains the citation anchor and local Q&A path,
 while summaries, structured extraction, table questions, and semantic diff use
 element-aware coverage before falling back to chunk retrieval.
 
 For PDF tables, production can use Azure AI Document Intelligence
 `prebuilt-layout` to extract table cells, headers, merged-cell spans, and layout
 regions before falling back to PyMuPDF. This keeps table export and table-aware
 RAG grounded in table objects rather than ad hoc chunk reconstruction.
 
 For detailed diagrams see [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).
 
 ## Quick Start
 
 ### Prerequisites
 
 - Docker & Docker Compose
 - Python 3.11+, Node.js 18+
 - An [OpenRouter](https://openrouter.ai) API key
 - [Google OAuth credentials](https://console.cloud.google.com/)
 
 ### Setup
 
 ```bash
 # 1. Clone and configure
 git clone https://github.com/Rswcf/DocTalk.git
 cd DocTalk
 cp .env.example .env   # Edit with your keys
 
 # 2. Start infrastructure
 docker compose up -d   # PostgreSQL, Qdrant, Redis, MinIO
 
 # 3. Backend
 cd backend
 pip install -r requirements.txt
 python3 -m alembic upgrade head
 python3 -m uvicorn app.main:app --reload
 
 # 4. Celery worker (separate terminal)
 cd backend
 OBJC_DISABLE_INITIALIZE_FORK_SAFETY=YES python3 -m celery \
   -A app.workers.celery_app worker --loglevel=info -Q default,parse
 
 # 5. Frontend (separate terminal)
 cd frontend
 npm install && npm run dev
 ```
 
 Open [http://localhost:3000](http://localhost:3000).
 
 > `OBJC_DISABLE_INITIALIZE_FORK_SAFETY=YES` is only required on macOS.
 
 <details>
 <summary><strong>Environment Variables</strong></summary>
 
 ### Backend (`.env`)
 
 | Variable | Required | Description |
 |----------|----------|-------------|
 | `DATABASE_URL` | Yes | PostgreSQL connection string (`postgresql+asyncpg://...`) |
 | `OPENROUTER_API_KEY` | Yes | OpenRouter API key |
 | `AUTH_SECRET` | Yes | Random secret (shared with frontend) |
 | `ADAPTER_SECRET` | Yes | Secret for internal auth API |
 | `STRIPE_SECRET_KEY` | No | Stripe secret key |
 | `STRIPE_WEBHOOK_SECRET` | No | Stripe webhook signing secret |
 | `SENTRY_DSN` | No | Sentry DSN for error tracking |
 | `OCR_ENABLED` | No | Enable OCR for scanned PDFs (default: `true`) |
 | `OCR_LANGUAGES` | No | Tesseract language codes (default: `eng+chi_sim`) |
 
 ### Frontend (`.env.local`)
 
 | Variable | Required | Description |
 |----------|----------|-------------|
 | `NEXT_PUBLIC_API_BASE` | Yes | Backend URL (default: `http://localhost:8000`) |
+| `BACKEND_INTERNAL_URL` | No | Server-side proxy target (private network). Preferred over `NEXT_PUBLIC_API_BASE` when set. |
 | `AUTH_SECRET` | Yes | Must match backend `AUTH_SECRET` |
+| `ADAPTER_SECRET` | Yes | Must match backend `ADAPTER_SECRET`. Used to HMAC-sign the `X-Proxy-IP` claim sent to the backend. |
 | `GOOGLE_CLIENT_ID` | Yes | Google OAuth client ID |
 | `GOOGLE_CLIENT_SECRET` | Yes | Google OAuth client secret |
 | `MICROSOFT_CLIENT_ID` | No | Microsoft OAuth client ID |
 | `MICROSOFT_CLIENT_SECRET` | No | Microsoft OAuth client secret |
 | `RESEND_API_KEY` | No | Resend API key for magic link emails |
 
 </details>
 
 <details>
 <summary><strong>Project Structure</strong></summary>
 
 ```
 DocTalk/
 ├── backend/
 │   ├── app/
 │   │   ├── api/            # Route handlers (documents, chat, search, billing, auth, users)
 │   │   ├── core/           # Config, dependencies, SSRF protection, security logging
 │   │   ├── models/         # SQLAlchemy ORM models
 │   │   ├── schemas/        # Pydantic request/response schemas
 │   │   ├── services/       # Business logic (chat, credits, parsing, retrieval, extractors)
 │   │   └── workers/        # Celery task definitions
 │   ├── alembic/            # Database migrations
 │   ├── seed_data/          # Demo PDF files
 │   └── tests/
 ├── frontend/
 │   ├── src/
 │   │   ├── app/            # Next.js pages
 │   │   ├── components/     # React components
 │   │   ├── lib/            # API client, auth, SSE, utilities
 │   │   ├── i18n/           # 11 language locale files
 │   │   ├── store/          # Zustand state management
 │   │   └── types/
 │   └── public/
 ├── docs/
 │   ├── ARCHITECTURE.md
 │   └── PRODUCT_STRATEGY.md
 └── docker-compose.yml
 ```
 
 </details>
 
 ## Deployment
 
 **Branching:** `main` (development) / `stable` (production).
 
 | Target | Method |
 |--------|--------|
 | **Frontend** (Vercel) | Push to `stable` → auto-deploys. Root directory: `frontend/`. |
 | **Backend** (Railway) | `git checkout stable && railway up --detach` |
 
 Railway runs 5 services: backend, PostgreSQL, Redis, Qdrant, MinIO.
 
 ## Versioning
 
 DocTalk uses Semantic Versioning with pre-1.0 release numbers in `0.minor.patch`
 format. The source of truth is the repository root [`version.json`](version.json).
 
 - `0.2.0` means: major API stability has not been promised yet, but releases still
   follow a predictable three-part version.
 - Use `python3 scripts/bump_version.py patch` for bug-fix releases such as
   `0.2.0 -> 0.2.1`.
 - Use `python3 scripts/bump_version.py minor` for backward-compatible feature
   releases such as `0.2.1 -> 0.3.0`.
 - Use `python3 scripts/check_version_consistency.py` to verify that
   `version.json`, `frontend/package.json`, `frontend/package-lock.json`, and the
   changelog stay in sync.
 
 Runtime release metadata is exposed at backend `/version` and included in `/health`.
 The frontend footer also shows the current release label.
 
 ## Testing
 
 ```bash
 cd backend && python3 -m pytest tests/test_smoke.py -v     # Smoke tests
 cd backend && python3 -m pytest -m integration -v           # Integration tests
 cd backend && python3 -m ruff check app/ tests/             # Lint
 python3 scripts/check_version_consistency.py                # Version metadata check
 ```
 
 ## Contributing
 
 Contributions are welcome! Please open an issue first to discuss what you'd like to change.
 
 1. Fork the repository
 2. Create your feature branch (`git checkout -b feature/amazing-feature`)
 3. Commit your changes
 4. Push to the branch and open a Pull Request
 
 ## License
 
 [MIT](LICENSE)
 
 ---
 
 <p align="center">
   If you find DocTalk useful, consider giving it a star. It helps others discover the project.
 </p>
 
 <p align="center">
   <a href="https://github.com/Rswcf/DocTalk/stargazers"><img src="https://img.shields.io/github/stars/Rswcf/DocTalk?style=social" alt="Star on GitHub" /></a>
 </p>
diff --git a/docs/ARCHITECTURE.md b/docs/ARCHITECTURE.md
index 3de4049..f0216f4 100644
--- a/docs/ARCHITECTURE.md
+++ b/docs/ARCHITECTURE.md
@@ -745,447 +745,463 @@ graph TD
         CollDetail["/collections/[id]<br/>Collection Detail"]
         Privacy["/privacy"]
         Terms["/terms"]
     end
 
     subgraph HeaderComp["Header"]
         Logo["Logo"]
         ModelSel["ModeSelector"]
         LangSel["LanguageSelector"]
         SessionDrop["SessionDropdown"]
         CreditsDis["CreditsDisplay"]
         UserMenuC["UserMenu"]
     end
 
     subgraph LandingComp["Landing Components (editorial layer, .dt-editorial)"]
         EdHeader["EditorialHeader<br/>Masthead + dateline"]
         Hero["HeroSection<br/>Mixed-voice headline + HeroCollage"]
         HowItWorks["HowItWorks<br/>3 numbered steps"]
         Features["FeatureGrid<br/>Numbered editorial entries"]
         SocialProof["SocialProof<br/>Hairline-framed metrics"]
         Security["SecuritySection<br/>Editorial privacy points"]
         FAQ["FAQ<br/>Hairline-ruled accordion"]
         FinalCTA["FinalCTA<br/>Closing band"]
         EdFooter["EditorialFooter<br/>Colophon"]
     end
 
     subgraph DocViewComp["Document Viewer"]
         ResizablePanels["react-resizable-panels<br/>Group / Panel / Separator"]
         ChatPanel["ChatPanel<br/>Messages + Input<br/>single primary workspace"]
         ArtifactCard["ChatArtifactCard<br/>job status + preview<br/>download + citations"]
         PdfViewer["PdfViewer<br/>react-pdf"]
         ViewToggle["View Toggle<br/>Slides / Text<br/>(PPTX/DOCX)"]
         TextViewer["TextViewer<br/>Non-PDF Viewer<br/>Markdown Rendering + Search<br/>Snippet Highlights"]
     end
 
     subgraph ChatComp["Chat Components"]
         MsgBubble["MessageBubble<br/>Flat AI / Pill Bubble User<br/>+ Hover Copy/Feedback/Regen"]
         CitCard["CitationCard<br/>Compact Pills"]
         PlusMenu["'+' Menu<br/>Instructions + Export"]
         ScrollBtn["Scroll-to-Bottom"]
     end
 
     subgraph PdfComp["PDF Components"]
         PdfToolbar["PdfToolbar<br/>Zoom + Hand + Search"]
         PageHL["PageWithHighlights<br/>bbox + Search Overlays"]
     end
 
     subgraph ProfileComp["Profile Components"]
         ProfTabs["ProfileTabs"]
         ProfInfo["ProfileInfoSection"]
         CreditsSec["CreditsSection"]
         UsageSec["UsageStatsSection"]
         AccountSec["AccountActionsSection"]
     end
 
     subgraph CollComp["Collection Components"]
         CollList["CollectionList"]
         CreateColl["CreateCollectionModal"]
         CustomInst["CustomInstructionsModal"]
     end
 
     Layout --> Pages
     Layout --> HeaderComp
     Home --> LandingComp
     Home -->|"logged in"| DocViewComp
     DocView --> ResizablePanels
     ResizablePanels --> ChatPanel
     ResizablePanels --> PdfViewer
     ChatPanel --> ChatComp
     PdfViewer --> PdfComp
     Profile --> ProfileComp
     Collections --> CollComp
 
     AuthModal["AuthModal<br/>?auth=1 trigger"]
     PaywallMod["PaywallModal"]
 
     Layout -.-> AuthModal
     Layout -.-> PaywallMod
 ```
 
 **Header variants:**
 - `variant="minimal"` — Logo + UserMenu only (transparent background) — used on Home, Demo, Auth pages
 - `variant="full"` — All controls (ModeSelector, ThemeSelector, LanguageSelector, SessionDropdown, CreditsDisplay, UserMenu) — used on Document, Billing, Profile pages. ThemeSelector is a dropdown (Light/Dark/Windows 98) replacing the old icon-cycle button. Additional `isDemo`/`isLoggedIn` props hide ModeSelector for anonymous demo users
 
 **Editorial marketing surface** (redesigned 2026-05-19 in a "Monocle-crisp" editorial visual language; every marketing page renders inside a `.dt-editorial` scope, light-only — see `editorial.css`).
 - **Landing page** (`/`): EditorialHeader → HeroSection (mixed sans/italic-serif headline + `HeroCollage` editorial collage) → FeatureGrid → HowItWorks → SocialProof → SecuritySection → FAQ → FinalCTA → EditorialFooter. (The old Remotion product showcase and `PrivacyBadge` were dropped; `HeroArtifact.tsx` remains in the repo but is unused.)
 - **Inner marketing pages** (`use-cases/*`, `compare/*`, `alternatives/*`, `features/*`, `tools/*`, `pricing`, `trust`, `demo`) compose the shared editorial kit in `frontend/src/components/marketing/`: `MarketingShell` (wraps the page — `.dt-editorial` root + `EditorialMarketingHeader` with breadcrumb + `EditorialFooter`), `EdPageHero`, `EdSection`, `EdProse`, `EdFeatureList`, `EdCardGrid`, `EdStepRow`, `EdFaqList`, `EdCtaBanner`, `EdComparisonTable`, `EdInlineCell`, `EdRelatedLinks`, `EdCheckList`, `EdChoiceList`. Each page is a thin `*Client.tsx` that keeps its `t()` data assembly + the `page.tsx` JSON-LD and swaps its JSX body for kit composition. The `tools/*` pages keep their functional widgets; the `demo` page keeps its document-fetch logic. Pages still on the zinc/blue app palette (not yet editorialized): `about`, `contact`, `imprint`, `privacy`, `terms`, `blog/*`, `document-diff`.
 
 **Chat features:**
 - **ChatGPT-style UI**: AI messages render flat without card/border/background (full width, base `prose` size); user messages keep `rounded-3xl` bubbles (light gray `bg-zinc-100` in light mode, `dark:bg-zinc-700` in dark mode). Messages area + input bar use `max-w-3xl mx-auto` centering for comfortable reading width on wide panels. Action buttons (Copy, ThumbsUp/Down, Regenerate) appear on hover for older messages (`opacity-0 group-hover:opacity-100`), always visible on the latest AI message
 - **Brand logo**: "Talk Flow" mark — two overlapping chat bubbles (back bubble = document source in Indigo 200 `#c7d2fe`, front bubble = AI conversation in Indigo 600 `#4f46e5`). `DocTalkLogo.tsx` component with Tailwind `fill-indigo-*` + `dark:` variants for automatic dark mode adaptation. Favicon via `app/icon.svg` (auto-detected by Next.js), Apple touch icon via `app/apple-icon.svg`. Static exports: `public/logo-icon.svg` (512px), `public/logo-full-light.svg` / `logo-full-dark.svg` (combination marks with Sora wordmark)
 - **Font families**: Five fonts loaded via `next/font/google` — `font-logo` (Sora 600) for the "DocTalk" brand wordmark, `font-display` (Instrument Serif 400), `font-sans` (Inter) for all app body text and UI, plus **Newsreader** (serif) and **IBM Plex Mono** used exclusively by the editorial marketing layer (`--font-newsreader`, `--font-plex-mono`). CSS variables: `--font-logo`, `--font-display`, `--font-inter`, `--font-newsreader`, `--font-plex-mono`
 - **Typography polish**: `antialiased` font rendering on body for smoother text on Retina displays. Prose text color overridden from Tailwind Typography default gray-700 (`#374151`) to zinc-950 (`#09090b`, near-black); dark mode uses zinc-50 (`#fafafa`). Paragraph and list spacing tightened for denser, more readable chat output
 - **Code blocks**: `PreBlock` component intercepts `<pre>` elements and renders styled code blocks with dark background (`bg-zinc-900`), language label header bar (`bg-zinc-800`), and Copy code button. Uses `not-prose` to escape Typography styling. Inline `code` renders as a gray background pill (backtick decorations removed via Typography config)
 - **Input bar**: `rounded-3xl` pill-shaped container with resting `shadow-sm` for elevation. Left: "+" button with dropdown menu (Custom Instructions + Export Chat). Right: Send/Stop toggle (Stop button with `Square` icon during streaming, aborts SSE via `AbortController`). Disclaimer text below input bar (11 locales)
 - **Scroll-to-bottom**: Floating `ArrowDown` button appears when scrolled >80px from bottom
 - **Compact citations**: `CitationCard` renders as inline `rounded-lg` pills in a `flex-wrap` row (not full-width stacked cards)
 - **Suggested questions**: Displayed as `rounded-full` pill chips in a centered flex-wrap layout
 - **Auto-Summary**: New sessions inject a synthetic assistant message with the AI-generated document summary
 - **Regenerate**: Re-send the last user message to get a new AI response
 - **Export**: Download the full conversation as a Markdown file with citations converted to footnotes (accessed via "+" menu)
 - **Per-answer deep links**: Assistant message actions include `Share this answer`
   when the message has a persisted backend id. The frontend derives the same
   safe `msg-*` anchor as the backend, reuses the existing session share token,
   and copies `/shared/{token}#msg-*` so public viewers land on the highlighted
   answer.
 
 **PDF Search**: Ctrl+F triggers an in-viewer search bar. Text is extracted via `pdfjs page.getTextContent()`, matches are highlighted using `customTextRenderer` with `<mark>` tags, and prev/next navigation scrolls between matches.
 
 **State management:**
 - **Zustand store** manages document state, selected model, active session, PDF viewer state, search state (query, matches, currentMatchIndex), document summary, and suggested questions
 - **Auth.js SessionProvider** wraps the entire app via `Providers.tsx`
 
 ---
 
 ## 8. Security & Compliance
 
 ### Security Layers
 
 | Layer | Mechanism |
 |-------|-----------|
 | **SSRF Protection** | `url_validator.py` — DNS resolution + private IP blocking (RFC 1918, link-local, cloud metadata `169.254.169.254`), internal port blocking (5432/6379/6333/9000), manual redirect following (max 3 hops) with per-hop validation |
 | **File Validation** | Magic-byte checks: PDF `%PDF` header, Office ZIP structure + `[Content_Types].xml` presence, 500MB zip bomb protection. Double-extension blocking (`.pdf.exe` becomes `_pdf.exe`) |
 | **Encryption at Rest** | MinIO SSE-S3 on all `put_object()` calls + bucket-level default encryption policy |
 | **Per-Plan Limits** | FREE: 3 docs / 25MB, PLUS: 20 docs / 50MB, PRO: 999 docs / 100MB — enforced at upload endpoint |
 | **Filename Sanitization** | Unicode NFC normalization, control character stripping, double-extension blocking, 200 character truncation — applied in both frontend (`utils.ts`) and backend |
 | **Rate Limiting** | In-memory token-bucket for anonymous chat (10 req/min/IP), automatic cleanup when bucket dict exceeds 10K entries |
 | **OAuth Token Cleanup** | `link_account()` strips access_token, refresh_token, and id_token — DocTalk stores only identity binding (provider + provider_account_id) |
 | **Non-Root Docker** | Container runs as `app` user (UID 1001), not root |
 | **Deletion Verification** | Failed MinIO/Qdrant cleanup queued as Celery retry task (`deletion_worker.py`, 3 retries with exponential backoff); structured security logging replaces silent exception swallowing |
 | **Security Event Logging** | `security_log.py` emits structured JSON logs for: auth failures, rate limit hits, SSRF blocks, file uploads, document deletions, account deletions |
 
 ### Privacy & Compliance
 
 | Requirement | Implementation |
 |-------------|---------------|
 | **GDPR Art. 17 (Right to Erasure)** | `DELETE /api/users/me` — cascading deletion of all user data, Stripe subscription cancellation, MinIO + Qdrant cleanup |
 | **GDPR Art. 20 (Data Portability)** | `GET /api/users/me/export` — JSON export of all user data (profile, documents, sessions, messages, credits, usage) |
 | **GDPR ePrivacy (Cookies)** | `CookieConsentBanner.tsx` — Accept/Decline banner; `AnalyticsWrapper.tsx` conditionally loads Vercel Analytics only on consent; consent stored in localStorage |
 | **AI Processing Disclosure** | `AuthModal` displays `auth.aiDisclosure` notice: documents are processed by third-party AI services (OpenRouter) |
 | **CCPA (Do Not Sell)** | Footer Legal column includes "Do Not Sell My Info" link |
 | **False Claims Removed** | All 11 locale files corrected: removed "end-to-end encryption", "30-day auto-deletion", "no third-party sharing", "we retain nothing" — replaced with accurate descriptions |
 
 ---
 
 ## 9. Infrastructure & Deployment
 
 ```mermaid
 graph LR
     subgraph GitHub["GitHub Repository"]
         Repo["Rswcf/DocTalk"]
     end
 
     subgraph VercelDeploy["Vercel"]
         VBuild["Build<br/>Root: frontend/"]
         VDeploy["Deploy<br/>Serverless Functions"]
         VDomain["www.doctalk.site"]
     end
 
     subgraph RailwayDeploy["Railway"]
         RBuild["Docker Build<br/>Root: ./"]
         subgraph Container["Single Container (entrypoint.sh)"]
             Alembic["1. Alembic Migrate"]
             CeleryW["2. Celery Worker<br/>(background, auto-restart)"]
             Uvicorn["3. Uvicorn<br/>(foreground, graceful shutdown)"]
         end
         subgraph RServices["Managed Services"]
             RPG["PostgreSQL"]
             RRedis["Redis"]
             RQdrant["Qdrant"]
             RMinIO["MinIO"]
         end
     end
 
     Repo -->|"push stable<br/>(auto-deploy)"| VBuild
     VBuild --> VDeploy --> VDomain
     Repo -->|"railway up<br/>(manual, stable)"| RBuild
     RBuild --> Alembic --> CeleryW --> Uvicorn
     Uvicorn --> RServices
     CeleryW --> RServices
 ```
 
 **Branching**: `main` (development) / `stable` (production). Push `main` → Vercel Preview only. Push `stable` → production deploy.
 
 **Deployment details:**
 
 | Aspect | Frontend (Vercel) | Backend (Railway) |
 |--------|-------------------|-------------------|
 | **Trigger** | Push `stable` (auto) | `railway up --detach` from `stable` (manual) |
 | **Build** | Next.js static export from `frontend/` | Dockerfile from project root (includes LibreOffice headless + CJK fonts for PPTX/DOCX→PDF conversion) |
 | **Runtime** | Serverless functions (Hobby plan) | Single container (`entrypoint.sh`): alembic → celery worker + celery beat + uvicorn (parallel; any exit → container restart by Railway) |
 | **Domain** | `www.doctalk.site` | `backend-production-a62e.up.railway.app` |
 | **Limits** | 4.5 MB function body, 60s max duration | Container memory based on Railway plan |
 
 **Celery Beat scheduler**: The backend container runs both the Celery worker (for async tasks) and Celery Beat (for periodic tasks). Beat schedule is defined in `celery_app.py` and includes daily cleanup of expired verification tokens. See §10 for the single-instance invariant when scaling replicas.
 
 **Environment sync:**
 - `AUTH_SECRET` and `ADAPTER_SECRET` must match between Vercel and Railway
 - `NEXT_PUBLIC_API_BASE` on Vercel must point to the Railway backend URL
 - `BACKEND_INTERNAL_URL` on Vercel is the same Railway URL (used by the auth adapter)
 
 ---
 
 ## 10. Runtime & Operational Integrity
 
 ### Process Supervision (backend container)
 
 `entrypoint.sh` no longer tries to act as a supervisor. Celery worker, Celery Beat, and uvicorn are started as parallel background processes; `wait -n` returns as soon as any of them exits, and the script then kills the other two and exits. **Railway's container restart policy** is the supervisor — a crash in any one process triggers a whole-container restart so the three processes always share a consistent lifecycle.
 
 Requires `/bin/bash` (not POSIX `dash`) because of `wait -n`. `python:3.12.7-slim` ships bash at `/usr/bin/bash`.
 
 ### Celery Beat — single-instance invariant
 
 Celery Beat schedules periodic tasks (currently: daily cleanup of expired verification tokens). **Exactly one Beat process must run across the whole backend fleet.** If the backend is ever horizontally scaled to multiple Railway replicas, set `ENABLE_CELERY_BEAT=0` on all-but-one replica (or factor Beat into its own dedicated Railway service). Duplicate Beats = duplicate scheduled side-effects.
 
 ### Client IP trust chain
 
 Anonymous rate limiting counts per real visitor IP. The trust chain is:
 
 1. **Vercel edge** strips client-supplied `X-Forwarded-For` / `X-Real-IP` and rewrites them with the real client IP (see [Vercel request headers](https://vercel.com/docs/headers/request-headers#x-forwarded-for)).
-2. **Frontend proxy** (`/api/proxy/*`, and the SSR fetch in `/shared/[token]`) reads the rewritten headers, then forwards them to the backend as:
-   - `X-Real-Client-IP`: the IP
-   - `X-Proxy-IP-Secret`: HMAC-compared against `AUTH_SECRET`
-3. **Backend** `get_client_ip(request)` (in `app/core/rate_limit.py`) only trusts `X-Real-Client-IP` when the HMAC secret matches; otherwise falls back to `request.client.host`.
+2. **Frontend proxy** (`/api/proxy/*`, and the SSR fetch in `/shared/[token]`) reads the rewritten headers, then forwards a triple-header HMAC proof to the backend:
+   - `X-Proxy-IP`: the IP
+   - `X-Proxy-IP-Ts`: unix seconds at sign time
+   - `X-Proxy-IP-Sig`: hex(HMAC-SHA256(`ADAPTER_SECRET`, `"{ip}:{ts}"`))
+3. **Backend** `get_client_ip(request)` (in `app/core/rate_limit.py`) verifies the signature with `hmac.compare_digest` and accepts a ±60s clock skew. Only on a successful verify does it trust the claimed IP; otherwise it falls back to `request.client.host`.
+
+The signing key is `ADAPTER_SECRET`, not `AUTH_SECRET`. Reusing `AUTH_SECRET` as a wire-level proof header would expose the JWE encryption key on the Railway internal network and in any debug-header log pipeline — that was the C1 vulnerability fixed 2026-05-20. `AUTH_SECRET` now stays inside Auth.js (session-cookie encryption + backend JWT verification only).
+
+Threat model honesty: HMAC binds the IP claim to the timestamp and proves the request originated from someone with `ADAPTER_SECRET`. It is **not** a defense against an active wire-level MITM with TLS-termination capability. Transport security is the responsibility of TLS between Vercel ↔ Railway.
 
 Because the backend does **not** trust raw `X-Forwarded-For`, `--forwarded-allow-ips=127.0.0.1` (uvicorn default) is safe — no production env override is required.
 
+#### Deploy sequence for C1 HMAC contract (Wave-1, 2026-05-20)
+
+The fix-batch ships a dual-accept transition window — backend simultaneously recognizes BOTH the new triple-header contract AND the legacy `X-Real-Client-IP` + `X-Proxy-IP-Secret` pair (compared against `AUTH_SECRET`, the OLD signing secret). This is the only safe rollout order:
+
+1. **Railway backend first.** `git checkout stable && git merge main && railway up --detach`. Wait for `GET /health` to return 200. At this point the backend accepts both contracts; production frontend is still emitting the legacy headers, which continue to work.
+2. **Then push frontend to Vercel.** `git push origin stable`. Wait for the Vercel deployment to land "Ready". Frontend now emits only the new triple-header contract.
+3. **Watch the legacy-path log counter** in Railway logs: `grep proxy.signed_ip.legacy_path_used`. It should drop to ~0 within minutes of step 2 as Vercel completes its rolling deploy.
+4. **24h soak window**, then a follow-up commit removes the legacy branch from `get_client_ip()` + `X-Proxy-IP-Secret` / `X-Real-Client-IP` env references from both surfaces.
+
+Reverse order (frontend first) would 401/429-collapse all in-flight traffic because the legacy proxy header would not match the new backend verifier.
+
 ### Redis degradation behavior
 
 The rate limiter and demo-message tracker both have an in-memory fallback when Redis is unreachable. When that fallback activates, `_alert_redis_fallback` logs at `error` and emits one Sentry event **per namespace per 10 minutes** (to stay within the Sentry Free 5k/month quota during prolonged outages). Counts in the in-memory fallback do NOT persist across restarts and do NOT share state across replicas — degraded consistency is the correctness trade-off.
 
 ### Deep health endpoint
 
 `GET /health?deep=true` (guarded by `X-Health-Secret` HMAC) probes all four data stores — Postgres, Redis, Qdrant, MinIO — concurrently with a 5 s per-probe timeout. Total response time is bounded by the slowest single probe, not by the sum of probes. Any probe failure flips `status` to `degraded` but does not return an error status code; callers must inspect `components`.
 
 ### Pre-debit refund invariant
 
 Chat pre-debit refunds are now **fully idempotent**: `_refund_predebit` deletes the pre-debit ledger row first and only credits back the user balance when `DELETE` reports `rowcount > 0`. A double-invocation (e.g., retry on a partially-failed request) is safe. All SSE error branches (`LLM_ERROR`, `PERSIST_FAILED`, continuation variants) invoke the refund path before yielding the error.
 
 Structured Extraction uses the same accounting shape for async workbench jobs:
 `POST /api/documents/{id}/extractions` creates a `document_jobs` row, pre-debits
 25 credits, stores the ledger id in `metadata_json`, and queues
 `run_extraction_job` on Celery's `default` queue. The worker marks the job
 `running`, retrieves cited chunks, calls the configured Pro-quality model,
 stores an `extraction_results` payload, records `UsageRecord`, and reconciles
 the original ledger row to actual token cost. Queue/worker failure deletes the
 pre-debit ledger row before restoring the user's balance.
 
 Chat-native structured extraction can create the same extraction jobs from a
 chat turn. The tool executor stores a `source='chat_tool'` marker in job
 metadata and returns an `extraction` artifact card with Markdown/CSV export URLs
 instead of requiring the user to open the retired Extract workspace.
 
 Table Extraction reuses `document_jobs` with `job_type='table_scan'` but does
 not pre-debit credits because table detection is parser/provider work rather
 than an LLM call. As of `0.16.0 beta`, native PDFs prefer Azure AI Document
 Intelligence `prebuilt-layout` when `DOCUMENT_INTELLIGENCE_PROVIDER=azure` and
 `AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT` / `AZURE_DOCUMENT_INTELLIGENCE_KEY` are
 configured. Each Azure attempt writes a `document_layout_runs` row, stores the
 raw layout payload in object storage when possible, and maps Azure tables into
 `document_tables.cells` with rows, cell regions, header metadata, merged-cell
 spans, provider metadata, and the layout run id. If Azure is not configured or
 fails due SDK, auth, timeout, malformed response, or service error, the worker
 records the failed run and falls back to PyMuPDF `page.find_tables()`.
 DOCX/PPTX/XLSX/TXT/MD/URL-derived documents continue to use markdown-table
 detection from stored `pages.content`. Free users can preview detected tables;
 CSV export is gated to Plus+.
 
 Chat-native table requests reuse the same `table_scan` jobs. If tables already
 exist, the executor returns an immediate `table_scan` or `table_export` artifact
 preview. If a Free user asks for CSV, the artifact shows the Plus requirement
 instead of exposing a download link that would fail later. Polling
 `/api/document-jobs/{job_id}` returns provider/fallback metadata so the artifact
 can show confidence and fallback warnings without exposing raw layout payloads.
 Each successful scan also writes `document_elements.element_type='table'` rows
 with the stable `document_tables.id`, provider metadata, confidence, page span,
 and compact table text. Table-aware retrieval uses these canonical table
 locations for coverage and falls back to any same-document chunk as a citation
 anchor if the chunker did not create a fragment on the exact table page.
 
 Question Templates reuse `document_jobs` with `job_type='batch_template'` and
 store outputs in `extraction_results` with `template_key='question_template'`.
 `question_templates` stores per-user saved checklists as JSONB question arrays.
 Single-document runs are gated to Plus+, Collection batch runs are gated to Pro,
 and each answer cell uses the same cited retrieval/LLM path as Structured
 Extraction. Runs pre-debit credits by question × document count, queue
 `run_batch_template_job` on Celery's `default` queue, then reconcile the
 original ledger row to actual token cost.
 
 Document Diff reuses the same job/result foundation with
 `job_type='document_diff'` and `template_key='document_diff'`. It is gated to
 Pro, requires two different ready documents owned by the same user, optionally
 scopes the run to a Collection, and pre-debits 60 credits before queueing
 `run_document_diff_job` on Celery's `default` queue. The worker retrieves cited
 chunks from both the old and new document, asks the Pro-quality model for a
 semantic added/removed/modified report, stores old/new citation payloads in
 `extraction_results.citations`, records `UsageRecord`, and reconciles the
 original ledger row to actual token cost. The MVP is a cited semantic change
 report, not a byte-level redline renderer.
 
 Public shared-session responses expose only safe message anchors, role/content,
 and page/snippet/document-filename citation summaries. They intentionally omit
 bbox coordinates, chunk ids, document ids, and confidence scores; private
 authenticated document pages remain the only surfaces that can jump to exact
 bbox highlights.
 
 ### Self-serve subscription cancel state machine
 
 `POST /api/billing/cancel` (introduced 2026-04-14) implements a six-branch
 state machine so every combination of `user.plan`, `user.stripe_subscription_id`,
 and `user.stripe_customer_id` maps deterministically to one action. Branches
 are evaluated in order **D → E → A → F → C → B**:
 
 | # | Precondition | Action | Return |
 |---|---|---|---|
 | D | `plan == "free"` | No-op | 400 |
 | E | `stripe_subscription_id == "pending"` | No-op (checkout in flight) | 409 |
 | A | `sub_id` starts with `sub_` (real Stripe ID) | `Subscription.retrieve` → dispatch on status: active/trialing/past_due → `modify(cancel_at_period_end=true)`; canceled → local sync to free; other → 409 | 200 `scheduled_cancel` or `immediate_revert` |
 | F | `sub_id` is non-empty, non-`pending`, not `sub_*` (malformed) | No local revert; fail closed | 409 |
 | C | no `sub_id` but `stripe_customer_id` present | List customer subs filtered by cancellable status. 1 → auto-heal + Branch A. 0 → fall through to Branch B. >1 → 409 ambiguous | (varies) |
 | B | no `sub_id` AND (no `customer_id` OR Branch C found 0) | Row-lock user, set `plan='free'`, null `stripe_subscription_id`, clear `monthly_credits_granted_at`, write `plan_transitions` audit row | 200 `immediate_revert` |
 
 Branch B is what closes the admin-promoted user gap (user whose plan was
 elevated directly in the DB with no Stripe customer).
 
 **Fail-closed contract**: any `stripe.StripeError` during Branch A retrieve,
 Branch A modify, Branch C list, or Branch C auto-heal modify returns **502
 without any local revert to Free and without writing an audit row**. Retry
 is user-driven. (One exception: Branch C auto-heal persists
 `stripe_subscription_id` on the user row BEFORE calling `Subscription.modify`,
 because the healed value has already been confirmed by Stripe's list call
 and is correct regardless of whether the subsequent modify succeeds —
 clearing data drift is a positive side-effect even on fail.)
 
 **Audit trail**: every successful cancel writes one row to `plan_transitions`
 (new table, migration `20260414_0021`) with `source='self_serve_cancel'`
 and a metadata blob including `sub_id`, `status_at_cancel`, branch reason
 codes (`admin_promoted_revert`, `branch_c_auto_heal`,
 `stripe_already_canceled_sync`), plus user-supplied cancellation context:
 `cancel_reason`, `cancel_feedback`, and `refund_requested`.
 Webhook / change-plan / admin audit writes are intentionally **deferred**
 to a follow-up PR to keep this scope tight.
 
 `refund_requested` is only an internal review signal. The cancel endpoint does
 not call Stripe Refunds or automatically decide eligibility; refunds are
 handled by a separate manual/business process until an explicit refund
 workflow is implemented.
 
 **`billing_state` projection**: `GET /api/users/profile` now returns a
 `billing_state` object (`managed_by`, `can_cancel`, `interval`, `period_end`,
 `cancel_at_period_end`, `status`) derived from Stripe (60 s Redis cache,
 invalidated on every cancel / change-plan / webhook plan mutation via
 `_invalidate_user_caches`). `can_cancel` is intentionally narrower than
 "plan != free" — it also excludes pending checkout, malformed sub_id,
 multi-sub drift, and already-scheduled cancel — so the frontend can trust
 the flag without duplicating state logic.
 
 **Frontend integration**: the `/billing` page shows a Current Plan panel
 above the Plus/Pro cards for any paid user. The Cancel CTA is BGB §312k
 compliant (visibly labeled "Cancel subscription" / "Abonnement kündigen",
 one click, no nested menus). The confirmation dialog may collect an optional
 reason, optional feedback, and a refund-review checkbox, but cancellation is
 not blocked on any of those fields. Admin-managed users see "Return to Free
 plan" instead of "Manage billing in Stripe". Pricing and Billing surfaces show
 the 7-day fair-use refund review copy to reduce purchase anxiety without
 promising automatic refunds.
 
 **Analytics**: cancel intent emits `subscription_cancel_requested`; checking
 the refund-review option also emits `refund_requested`. The admin funnel
 includes both events after paid-plan intent so cancellation/refund pressure is
 visible without querying Stripe manually.
 
 Tests: `backend/tests/test_billing_cancel.py` (18 branch tests) and
 `backend/tests/test_billing_state.py` (11 projection tests) cover the
 happy path, failure modes, and all branch preconditions.
 
 ### Error taxonomy (wire contract)
 
 Introduced 2026-04-14 to fix a class of bugs where the frontend surfaced
 generic "Upload failed, please check network…" copy for structured 4xx
 responses (the triggering case was 403 `DOCUMENT_LIMIT_REACHED` on a
 Free-plan user's fourth upload). The cure is a single wire-level code
 enum so the frontend can route once instead of each call-site
 substring-matching English prose.
 
 **Response shape** — every user-facing `HTTPException` returns:
 
 ```jsonc
 {
   "detail": {
     "error": "UPPER_SNAKE_CODE",        // authoritative; frontend routes on this
     "message": "English human fallback", // present during deprecation window, logs-only after
     /* context fields, per-code, documented below */
   }
 }
 ```
 
 Codes in use (status · code · required context):
 
 - `400` — `UNSUPPORTED_FORMAT` · `INVALID_FILE_CONTENT` · `FILE_TOO_LARGE {max_mb, plan}` · `URL_INVALID` · `URL_FETCH_BLOCKED` · `URL_CONTENT_TOO_LARGE` · `NO_TEXT_CONTENT` · `URL_FETCH_FAILED` · `INSTRUCTIONS_TOO_LONG {max}` · `CONTINUATION_LIMIT {max}` · `EXPORT_VALIDATION_FAILED {reason}`
 - `402` — `INSUFFICIENT_CREDITS {required, balance}` (HTTP + SSE — same code across both transports)
 - `403` — `DOCUMENT_LIMIT_REACHED {limit, current}` · `SESSION_LIMIT_REACHED {limit, plan}` · `COLLECTION_LIMIT_REACHED {limit, plan}` · `COLLECTION_DOC_LIMIT_REACHED {limit, plan}` · `SHARE_LIMIT_REACHED {limit, plan}` · `EXPORT_REQUIRES_PAID_PLAN {format, required_plans}` · `CUSTOM_INSTRUCTIONS_REQUIRE_PRO`
 - `404` — `DOCUMENT_NOT_FOUND` · `SESSION_NOT_FOUND` · `MESSAGE_NOT_FOUND` · `COLLECTION_NOT_FOUND` · `CHUNK_NOT_FOUND` · `SHARE_NOT_FOUND` (identical copy regardless of existence-vs-authorization — no enumeration oracle)
 - `409` — `DOCUMENT_PROCESSING {status}`
 - `410` — `SHARE_EXPIRED`
 - `429` — `RATE_LIMITED {retry_after}` · `DEMO_SESSION_RATE_LIMITED {retry_after}` · `DEMO_SESSION_LIMIT_REACHED {limit}` · `DEMO_MESSAGE_LIMIT_REACHED {limit}`
 - `500` — `SERVER_ERROR` (unknown `ValueError` / uncaught exceptions; `str(e)` logged server-side only) · `EXPORT_RENDERER_FAILED`
 - `502` — `STORAGE_UNAVAILABLE` · `STRIPE_UNAVAILABLE`
 - SSE-only `event: error` frames — `MODE_NOT_ALLOWED {required_plan}` · `CHAT_SETUP_ERROR` · `RETRIEVAL_ERROR` · `LLM_ERROR` · `ACCOUNTING_ERROR` · `PERSIST_FAILED` · `INSUFFICIENT_CREDITS` (shared with HTTP 402)
 
 **Security posture:**
 
 1. **SSRF reason collapse.** The URL validator and extractor emit six
    specific reasons (`BLOCKED_HOST` / `BLOCKED_PORT` /
    `INVALID_URL_SCHEME` / `INVALID_URL_HOST` / `DNS_RESOLUTION_FAILED` /
    `REDIRECT_LOOP` / `TOO_MANY_REDIRECTS`). All collapse to a single
    wire code `URL_FETCH_BLOCKED`; the specific reason is logged via
    `log_security_event(name="url_fetch_blocked", reason=..., url=...)`
    and never returned to the client. This removes a network-topology
    probing oracle.
 2. **Unknown `ValueError` → 500.** Service-layer `except ValueError` in
    `documents.upload`, `documents.ingest_url`, and `export.export_session`
    allowlists known codes and routes anything else to `500 SERVER_ERROR`
    with the raw `str(e)` logged but not returned. An unexpected
    exception is a bug, not user fault, and the raw string may leak
    internals.
 3. **404 masking.** Every "not found" path returns identical copy
    regardless of whether the resource exists but is inaccessible, or
    doesn't exist at all — see `DOCUMENT_NOT_FOUND` etc.
 
 **Frontend contract:**
 
 - `frontend/src/lib/api.ts` throws an `ApiError { status, code, detail, raw }` from `handle()` for every non-2xx response. `ApiError.message` stays in the literal shape `HTTP <status>: <raw>` for **one deprecation window** (2026-04-14 + next release) so legacy substring consumers — specifically the billing detail regex at `BillingPageClient.tsx:157-168` — keep working. After the deprecation window `message` becomes non-authoritative (logs only) and consumers must read `code` + `status`.
 - `frontend/src/lib/sse.ts` does the same parsing on pre-stream HTTP failures in `chatStream` and `continueStream`, emitting `{ code, message, status }` so `useChatStream` routes by code/status instead of English prose.
 - `frontend/src/lib/errorCopy.ts` is the single consumer-facing mapper (`errorCopy(err, t, tOr) → { title, body, cta?, severity, openPaywall? }`). Paywall auto-open is gated to `402 INSUFFICIENT_CREDITS` and SSE `MODE_NOT_ALLOWED` only — all other plan-limit 403s ship an inline CTA button to `/pricing`. This avoids modal thrash on upload / collection / share flows.
 - English copy lives in `en.json` under the `errors.<CODE>.title/body` prefix. Ten other locales fall back through `tOr()` until a dedicated localization pass lands.
 
 **Parse-worker bridge** (`backend/app/workers/parse_worker.py`): the
 worker can't raise `HTTPException`, so error state is written to
 `Document.error_msg` as `ERR_CODE:<CODE>:<human>`. The `_set_doc_error`
 helper is idempotent — repeated calls on an already-prefixed message do
 **not** stack prefixes. Legacy rows written before this contract remain
 readable because the frontend's `parseWorkerErrorMsg()` gracefully falls
 back to the raw string when no prefix is present.
 
 **Deliberately scoped out of this contract migration:**
 
diff --git a/docs/ARCHITECTURE.zh.md b/docs/ARCHITECTURE.zh.md
index eca33c0..c93fc91 100644
--- a/docs/ARCHITECTURE.zh.md
+++ b/docs/ARCHITECTURE.zh.md
@@ -641,285 +641,301 @@ graph TD
         Demo["/demo<br/>Demo 选择"]
         Auth["/auth<br/>登录页"]
         Billing["/billing<br/>购买页"]
         Profile["/profile<br/>个人中心"]
         Collections["/collections<br/>文档集合"]
         CollDetail["/collections/[id]<br/>集合详情"]
         Privacy["/privacy"]
         Terms["/terms"]
     end
 
     subgraph HeaderComp["Header 组件"]
         Logo["Logo"]
         ModelSel["ModeSelector"]
         LangSel["LanguageSelector"]
         SessionDrop["SessionDropdown"]
         CreditsDis["CreditsDisplay"]
         UserMenuC["UserMenu"]
     end
 
     subgraph LandingComp["Landing 组件"]
         Hero["HeroSection<br/>大字标题 + CTA"]
         Showcase["产品展示<br/>Remotion 动画<br/>macOS 窗口风格"]
         HowItWorks["HowItWorks<br/>3 步引导"]
         Features["FeatureGrid<br/>3 列特性卡片"]
         SocialProof["SocialProof<br/>信任指标"]
         Security["SecuritySection<br/>4 张安全卡片"]
         FAQ["FAQ<br/>6 项手风琴"]
         FinalCTA["FinalCTA<br/>转化 CTA"]
         PrivBadge["PrivacyBadge"]
         FooterComp["Footer<br/>3 列链接"]
     end
 
     subgraph DocViewComp["文档阅读器"]
         ResizablePanels["react-resizable-panels<br/>Group / Panel / Separator"]
         ChatPanel["ChatPanel<br/>消息 + 输入框<br/>唯一主工作区"]
         ArtifactCard["ChatArtifactCard<br/>job 状态 + 预览<br/>下载 + 引用"]
         PdfViewer["PdfViewer<br/>react-pdf"]
         ViewToggle["视图切换<br/>幻灯片 / 文本<br/>(PPTX/DOCX)"]
         TextViewer["TextViewer<br/>非 PDF 查看器<br/>Markdown 渲染 + 搜索<br/>片段高亮"]
     end
 
     subgraph ChatComp["Chat 组件"]
         MsgBubble["MessageBubble<br/>AI 平铺 / 药丸气泡<br/>+ Hover 复制/反馈/重新生成"]
         CitCard["CitationCard<br/>紧凑药丸"]
         PlusMenu["'+' 菜单<br/>指令 + 导出"]
         ScrollBtn["滚动到底部"]
     end
 
     subgraph PdfComp["PDF 组件"]
         PdfToolbar["PdfToolbar<br/>缩放 + 拖拽 + 搜索"]
         PageHL["PageWithHighlights<br/>边界框 + 搜索覆盖层"]
     end
 
     subgraph ProfileComp["Profile 组件"]
         ProfTabs["ProfileTabs"]
         ProfInfo["ProfileInfoSection"]
         CreditsSec["CreditsSection"]
         UsageSec["UsageStatsSection"]
         AccountSec["AccountActionsSection"]
     end
 
     subgraph CollComp["集合组件"]
         CollList["CollectionList"]
         CreateColl["CreateCollectionModal"]
         CustomInst["CustomInstructionsModal"]
     end
 
     Layout --> Pages
     Layout --> HeaderComp
     Home --> LandingComp
     Home -->|"已登录"| DocViewComp
     DocView --> ResizablePanels
     ResizablePanels --> ChatPanel
     ResizablePanels --> PdfViewer
     ChatPanel --> ChatComp
     PdfViewer --> PdfComp
     Profile --> ProfileComp
     Collections --> CollComp
 
     AuthModal["AuthModal<br/>?auth=1 触发"]
     PaywallMod["PaywallModal"]
 
     Layout -.-> AuthModal
     Layout -.-> PaywallMod
 ```
 
 **Header 变体：**
 - `variant="minimal"` — 仅 Logo + UserMenu（透明背景）— 用于首页、Demo、登录页
 - `variant="full"` — 所有控件（ModeSelector、ThemeSelector、LanguageSelector、SessionDropdown、CreditsDisplay、UserMenu）— 用于文档页、购买页、个人中心。ThemeSelector 为下拉菜单（Light/Dark/Windows 98），替代原先的图标循环按钮。额外支持 `isDemo`/`isLoggedIn` props，匿名 Demo 用户时隐藏 ModeSelector
 
 **Landing 页面各区块**（按顺序）：HeroSection → 产品展示（Remotion `<Player>` 动画演示，300帧@30fps，lazy-loaded）→ HowItWorks → FeatureGrid → SocialProof → SecuritySection → FAQ → FinalCTA → PrivacyBadge → Footer
 
 **Chat 功能：**
 - **ChatGPT 风格 UI**：AI 消息无卡片/边框/背景，基础 `prose` 级别全宽渲染；用户消息 `rounded-3xl` 圆角气泡（浅色模式 `bg-zinc-100`，深色模式 `dark:bg-zinc-700`）。消息区域 + 输入栏使用 `max-w-3xl mx-auto` 居中，宽面板时保持舒适阅读宽度。操作按钮（复制/点赞/点踩/重新生成）在旧消息上 hover 显示（`opacity-0 group-hover:opacity-100`），最新 AI 消息始终可见
 - **单一入口**：文档阅读页只保留 Chat + 文档查看器，不再显示 Brief/Extract 主标签。结构化提取、表格导出、模板和对比都通过自然语言聊天触发，并以 artifact card 回到同一条 assistant 消息中。
 - **品牌 Logo**："Talk Flow" 标识 — 两个重叠聊天气泡（后方气泡=文档来源，Indigo 200 `#c7d2fe`；前方气泡=AI 对话，Indigo 600 `#4f46e5`）。`DocTalkLogo.tsx` 组件通过 Tailwind `fill-indigo-*` + `dark:` 变体自动适配 dark mode。Favicon 通过 `app/icon.svg`（Next.js 自动检测），Apple Touch Icon 通过 `app/apple-icon.svg`。静态导出：`public/logo-icon.svg`（512px）、`public/logo-full-light.svg` / `logo-full-dark.svg`（组合标识 + Sora wordmark）
 - **字体体系**：通过 `next/font/google` 加载 3 种字体 — `font-logo`（Sora 600）用于品牌 wordmark "DocTalk"，`font-display`（Instrument Serif 400）用于 Landing 页面标题，`font-sans`（Inter）用于正文和 UI。CSS 变量：`--font-logo`、`--font-display`、`--font-inter`
 - **排版精修**：body 添加 `antialiased` 字体渲染，Retina 屏上更细腻。prose 正文颜色从 Tailwind Typography 默认 gray-700（`#374151`）覆盖为 zinc-950（`#09090b`，近纯黑）；dark mode 为 zinc-50（`#fafafa`）。段落和列表间距收紧，chat 输出更紧凑易读
 - **代码块**：`PreBlock` 组件拦截 `<pre>` 元素，渲染为深色背景代码块（`bg-zinc-900`），顶部 header bar（`bg-zinc-800`）显示语言标签 + Copy code 按钮。`not-prose` 避免 Typography 样式干扰。内联 `code` 渲染为灰色背景药丸（通过 Typography 配置去除反引号装饰）
 - **输入栏**：`rounded-3xl` 药丸形容器 + `shadow-sm` 静态阴影提升层次感。左侧 "+" 按钮弹出下拉菜单（自定义指令 + 导出对话）。右侧 Send/Stop 切换（streaming 时显示 Square 停止按钮，通过 `AbortController` 中止 SSE）。输入栏下方显示免责声明（11 语言）
 - **滚动到底部**：滚动离底部 >80px 时显示浮动 ArrowDown 按钮
 - **紧凑引用**：`CitationCard` 渲染为 `rounded-lg` 内联药丸，`flex-wrap` 水平排列（非全宽竖向卡片）
 - **推荐问题**：`rounded-full` 药丸按钮 + 居中 flex-wrap 布局
 - **自动摘要**：新会话注入一条合成的 assistant 消息，展示 AI 生成的文档摘要
 - **重新生成**：重新发送上一条用户消息，获取新的 AI 回答
 - **导出**：将完整对话下载为 Markdown 文件，引用转为脚注（通过 "+" 菜单访问）
 
 **PDF 搜索**：Ctrl+F 触发阅读器内搜索栏。通过 `pdfjs page.getTextContent()` 提取文本，使用 `customTextRenderer` 的 `<mark>` 标签高亮匹配，上下翻页在匹配项之间滚动。
 
 **状态管理：**
 - **Zustand store** 管理文档状态、选中模型、活跃会话、PDF 查看器状态、搜索状态（query/matches/currentMatchIndex）、文档摘要和推荐问题
 - **Auth.js SessionProvider** 通过 `Providers.tsx` 包裹整个应用
 
 ---
 
 ## 8. 安全与合规
 
 ### 安全层级
 
 | 层级 | 机制 |
 |------|------|
 | **SSRF 防护** | `url_validator.py` — DNS 解析 + 私有 IP 阻断（RFC 1918、链路本地、云元数据 `169.254.169.254`），内部端口封锁（5432/6379/6333/9000），手动重定向跟踪（最多 3 跳）并逐跳验证 |
 | **文件验证** | Magic-byte 检查：PDF `%PDF` 头、Office ZIP 结构 + `[Content_Types].xml`、500MB zip bomb 防护。双扩展名阻断（`.pdf.exe` → `_pdf.exe`） |
 | **静态加密** | MinIO SSE-S3 应用于所有 `put_object()` 调用 + bucket 级默认加密策略 |
 | **按套餐限制** | FREE: 3 文档 / 25MB，PLUS: 20 文档 / 50MB，PRO: 999 文档 / 100MB — 在上传端点强制执行 |
 | **文件名清洗** | Unicode NFC 规范化、控制字符剥离、双扩展名阻断、200 字符截断 — 前端（`utils.ts`）和后端同时执行 |
 | **速率限制** | 内存级 token-bucket 限制匿名 chat（10 req/min/IP），bucket 字典超 10K 条目时自动清理 |
 | **OAuth 令牌清理** | `link_account()` 剥离 access_token、refresh_token 和 id_token — DocTalk 仅存储身份绑定信息（provider + provider_account_id） |
 | **非 root Docker** | 容器以 `app` 用户（UID 1001）运行，非 root |
 | **删除验证** | MinIO/Qdrant 清理失败时排入 Celery 重试任务（`deletion_worker.py`，3 次重试，指数退避）；结构化安全日志替代静默异常吞没 |
 | **安全事件日志** | `security_log.py` 输出结构化 JSON 日志：认证失败、速率限制命中、SSRF 阻断、文件上传、文档删除、账户删除 |
 
 ### 隐私与合规
 
 | 要求 | 实现 |
 |------|------|
 | **GDPR Art. 17（被遗忘权）** | `DELETE /api/users/me` — 级联删除所有用户数据，取消 Stripe 订阅，清理 MinIO + Qdrant |
 | **GDPR Art. 20（数据可携带性）** | `GET /api/users/me/export` — JSON 导出所有用户数据（个人信息、文档、会话、消息、积分、使用记录） |
 | **GDPR ePrivacy（Cookie）** | `CookieConsentBanner.tsx` — Accept/Decline 横栏；`AnalyticsWrapper.tsx` 仅在同意后条件加载 Vercel Analytics；consent 存储在 localStorage |
 | **AI 处理披露** | `AuthModal` 显示 `auth.aiDisclosure` 通知：文档由第三方 AI 服务（OpenRouter）处理 |
 | **CCPA（禁止出售）** | Footer Legal 列包含 "Do Not Sell My Info" 链接 |
 | **虚假声明移除** | 11 种语言的 i18n 文件已修正：移除 "端到端加密"、"30 天自动删除"、"不与第三方共享"、"我们不保留任何内容"，替换为准确描述 |
 
 ---
 
 ## 9. 基础设施与部署
 
 ```mermaid
 graph LR
     subgraph GitHub["GitHub 仓库"]
         Repo["Rswcf/DocTalk"]
     end
 
     subgraph VercelDeploy["Vercel"]
         VBuild["构建<br/>Root: frontend/"]
         VDeploy["部署<br/>Serverless Functions"]
         VDomain["www.doctalk.site"]
     end
 
     subgraph RailwayDeploy["Railway"]
         RBuild["Docker 构建<br/>Root: ./"]
         subgraph Container["单容器 (entrypoint.sh)"]
             Alembic["1. Alembic 迁移"]
             CeleryW["2. Celery Worker<br/>（后台，崩溃自动重启）"]
             Uvicorn["3. Uvicorn<br/>（前台，优雅关闭）"]
         end
         subgraph RServices["托管服务"]
             RPG["PostgreSQL"]
             RRedis["Redis"]
             RQdrant["Qdrant"]
             RMinIO["MinIO"]
         end
     end
 
     Repo -->|"push stable<br/>（自动部署）"| VBuild
     VBuild --> VDeploy --> VDomain
     Repo -->|"railway up<br/>（手动，stable 分支）"| RBuild
     RBuild --> Alembic --> CeleryW --> Uvicorn
     Uvicorn --> RServices
     CeleryW --> RServices
 ```
 
 **分支策略**：`main`（开发）/ `stable`（生产）。推送 `main` → 仅 Vercel Preview。推送 `stable` → 生产部署。
 
 **部署详情：**
 
 | 方面 | 前端 (Vercel) | 后端 (Railway) |
 |------|---------------|----------------|
 | **触发方式** | 推送 `stable`（自动） | 从 `stable` 分支 `railway up --detach`（手动） |
 | **构建** | 从 `frontend/` 导出 Next.js | 从项目根目录构建 Dockerfile（含 LibreOffice headless + CJK 字体，用于 PPTX/DOCX→PDF 转换） |
 | **运行时** | Serverless 函数（Hobby 计划） | 单容器（`entrypoint.sh`）：alembic → celery worker + celery beat + uvicorn 并行运行（任一退出 → Railway 重启整个容器） |
 | **域名** | `www.doctalk.site` | `backend-production-a62e.up.railway.app` |
 | **限制** | 4.5 MB 函数体积，60s 最大时长 | 容器内存取决于 Railway 计划 |
 
 **Celery Beat 调度器**：后端容器同时运行 Celery worker（异步任务）和 Celery Beat（定期任务）。Beat 调度配置在 `celery_app.py` 中，包括每日清理过期验证令牌。横向扩展多副本时的单实例约束见 §10。
 
 **环境变量同步：**
 - `AUTH_SECRET` 和 `ADAPTER_SECRET` 在 Vercel 和 Railway 之间必须一致
 - Vercel 上的 `NEXT_PUBLIC_API_BASE` 必须指向 Railway 后端 URL
 - Vercel 上的 `BACKEND_INTERNAL_URL` 是相同的 Railway URL（Auth Adapter 使用）
 
 ---
 
 ## 10. 运行时与运维完整性
 
 ### 进程监管（后端容器）
 
 `entrypoint.sh` 不再尝试扮演 supervisor 角色。Celery worker、Celery Beat、uvicorn 作为并行后台进程启动；`wait -n` 在任一进程退出时返回，脚本随后 kill 另外两个并退出。**Railway 的容器重启策略** 才是真正的 supervisor —— 任一进程崩溃触发整容器重启，保证三进程永远共享一致的生命周期。
 
 需要 `/bin/bash`（不是 POSIX 的 `dash`），因为用到 `wait -n`。`python:3.12.7-slim` 自带 `/usr/bin/bash`。
 
 ### Celery Beat —— 单实例约束
 
 Celery Beat 调度定期任务（目前：每日清理过期验证令牌）。**整个后端集群只能有一个 Beat 进程运行。** 如未来后端横向扩展到多 Railway 副本，需在其他副本设置 `ENABLE_CELERY_BEAT=0`（或把 Beat 拆到独立的 Railway service）。重复 Beat = 重复的定时副作用。
 
 ### 客户端 IP 信任链
 
 匿名限流按真实访问者 IP 计数。信任链如下：
 
 1. **Vercel edge** 剥离客户端自带的 `X-Forwarded-For` / `X-Real-IP` 并重写为真实客户端 IP（见 [Vercel request headers](https://vercel.com/docs/headers/request-headers#x-forwarded-for)）。
-2. **前端代理**（`/api/proxy/*`，以及 `/shared/[token]` 的 SSR fetch）读取重写后的头，转发到后端时附加：
-   - `X-Real-Client-IP`：真实 IP
-   - `X-Proxy-IP-Secret`：与 `AUTH_SECRET` 做 HMAC 比对
-3. **后端** `get_client_ip(request)`（在 `app/core/rate_limit.py`）仅在 HMAC 签名匹配时信任 `X-Real-Client-IP`，否则回退到 `request.client.host`。
+2. **前端代理**（`/api/proxy/*`，以及 `/shared/[token]` 的 SSR fetch）读取重写后的头，转发到后端时附加三个 HMAC 证明头：
+   - `X-Proxy-IP`：真实 IP
+   - `X-Proxy-IP-Ts`：签名时刻的 unix 秒
+   - `X-Proxy-IP-Sig`：hex(HMAC-SHA256(`ADAPTER_SECRET`, `"{ip}:{ts}"`))
+3. **后端** `get_client_ip(request)`（在 `app/core/rate_limit.py`）用 `hmac.compare_digest` 验证签名，并接受 ±60 秒时钟漂移。只有验证通过才信任声明的 IP，否则回退到 `request.client.host`。
+
+签名密钥是 `ADAPTER_SECRET`，**不是** `AUTH_SECRET`。把 `AUTH_SECRET` 当作 wire-level 证明 header 重用，会让 JWE 加密密钥暴露在 Railway 内网及任何 debug header 日志管线里 —— 这正是 2026-05-20 修复的 C1 漏洞。`AUTH_SECRET` 现在只留在 Auth.js 内（session cookie 加密 + 后端 JWT 验证）。
+
+威胁建模实事求是：HMAC 把 IP 声明绑定到时间戳，证明请求来自掌握 `ADAPTER_SECRET` 的源；但它**不**防御具备 TLS 终止能力的主动 wire-level MITM。传输层安全由 Vercel ↔ Railway 之间的 TLS 负责。
 
 因为后端**不**信任原始 `X-Forwarded-For`，`--forwarded-allow-ips=127.0.0.1`（uvicorn 默认值）是安全的，生产无需覆盖该 env。
 
+#### C1 HMAC 契约的部署顺序（Wave-1，2026-05-20）
+
+本次修复采用 dual-accept 过渡窗口 —— 后端同时识别新的三 header 契约和旧的 `X-Real-Client-IP` + `X-Proxy-IP-Secret`（与 `AUTH_SECRET` 比对，旧契约的签名 secret）。安全的发布顺序只有一种：
+
+1. **先发 Railway 后端。** `git checkout stable && git merge main && railway up --detach`，等 `GET /health` 返回 200。此时后端两种契约都接受，生产前端仍在用旧 header，无影响。
+2. **然后推 Vercel 前端。** `git push origin stable`，等 Vercel 部署 "Ready"。前端切换为只发新三 header。
+3. **观察 legacy_path 日志计数**：Railway 日志中 `grep proxy.signed_ip.legacy_path_used`，应在 Vercel rolling deploy 完成后几分钟内降到 ~0。
+4. **24h soak window** 后，follow-up commit 删除 `get_client_ip()` 里的 legacy 分支以及双方代码中的 `X-Proxy-IP-Secret` / `X-Real-Client-IP` env 引用。
+
+反向顺序（前端先发）会让在途流量 401/429 全面坍塌 —— 旧 proxy header 与新后端 verifier 不匹配。
+
 ### Redis 降级行为
 
 速率限制器和演示消息计数器在 Redis 不可达时都会回退到内存。降级触发时，`_alert_redis_fallback` 以 `error` 级记录日志，并**每个 namespace 每 10 分钟**最多发一次 Sentry 事件（避免持续故障打满 Sentry Free 5k/月配额）。内存 fallback 中的计数**不**跨重启持久化，也**不**跨副本共享 —— 一致性降级是该场景的正确性取舍。
 
 ### 深度健康检查端点
 
 `GET /health?deep=true`（由 `X-Health-Secret` HMAC 守护）**并发**探活所有四个数据存储 —— Postgres、Redis、Qdrant、MinIO，每个 probe 5s 超时。总响应时间受限于**最慢单项**，不是各项之和。任一 probe 失败会把 `status` 标为 `degraded`，但不返回 error 状态码；调用方必须检查 `components`。
 
 ### 预扣积分退款不变量
 
 聊天预扣积分退款现已**完全幂等**：`_refund_predebit` 先 DELETE 预扣的 ledger 行，仅当 `DELETE` 报告 `rowcount > 0` 时才恢复用户余额。重复调用（例如部分失败请求的重试）是安全的。所有 SSE 错误分支（`LLM_ERROR`、`PERSIST_FAILED`、续写变体）都在 yield 错误之前调用退款路径。
 
 ### 表格扫描与 Document Intelligence
 
 Table Extraction 复用 `document_jobs`，`job_type='table_scan'`。因为表格扫描是
 parser/provider 工作而不是 LLM 调用，目前不预扣 credits。从 `0.16.0 beta` 开始，
 原生 PDF 在配置 `DOCUMENT_INTELLIGENCE_PROVIDER=azure` 且提供
 `AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT` / `AZURE_DOCUMENT_INTELLIGENCE_KEY` 时，
 优先调用 Azure AI Document Intelligence `prebuilt-layout`。每次 Azure 尝试都会写入
 `document_layout_runs`，记录 provider、状态、页数/表格数、原始 layout payload 的
 对象存储 key 和失败 metadata。
 
 Azure 表格会被映射到 `document_tables.cells`，保存 rows、cell region、表头行/列、
 合并单元格 span、provider metadata 和 layout run id。若 Azure 未配置、SDK 不可用、
 鉴权失败、超时或服务调用失败，worker 会记录失败 run，并 fallback 到 PyMuPDF
 `page.find_tables()`。DOCX/PPTX/XLSX/TXT/MD/URL 派生文档仍使用 `pages.content` 中的
 markdown table detection。Free 用户可以预览表格，CSV 导出限制为 Plus+。
 
 Chat-native 表格请求复用同一套 `table_scan` job。若已有表格，executor 直接返回
 `table_scan` 或 `table_export` artifact preview；若 Free 用户请求 CSV，artifact 显示
 Plus 要求，不暴露稍后会失败的下载链接。`/api/document-jobs/{job_id}` 会返回
 provider/fallback metadata，使 artifact 能展示 confidence 和 fallback warning，但不会
 暴露原始 layout payload。
 每次成功扫描还会写入 `document_elements.element_type='table'`，保存稳定的
 `document_tables.id`、provider metadata、confidence、页码范围和压缩后的表格文本。
 Table-aware retrieval 会使用这些 canonical table 位置做覆盖选择；如果 chunker 没有在
 精确表格页生成片段，则 fallback 到同文档 chunk 作为 citation anchor，同时保留表格页码。
 
 ### 自助取消订阅状态机
 
 `POST /api/billing/cancel` 实现确定性的六分支状态机，覆盖 `user.plan`、`user.stripe_subscription_id`、`user.stripe_customer_id` 的组合。分支按 **D → E → A → F → C → B** 顺序执行：
 
 | # | 前置条件 | 动作 | 返回 |
 |---|---|---|---|
 | D | `plan == "free"` | 不处理 | 400 |
 | E | `stripe_subscription_id == "pending"` | 不处理（Checkout 进行中） | 409 |
 | A | `sub_id` 以 `sub_` 开头（真实 Stripe ID） | `Subscription.retrieve` 后按状态分发：active/trialing/past_due → `modify(cancel_at_period_end=true)`；canceled → 本地同步为 Free；其他状态 → 409 | 200 `scheduled_cancel` 或 `immediate_revert` |
 | F | `sub_id` 非空、非 `pending`、但不是 `sub_*`（格式异常） | fail closed，不做本地降级 | 409 |
 | C | 无 `sub_id` 但有 `stripe_customer_id` | 查询 customer 的可取消订阅。1 个 → auto-heal + 分支 A；0 个 → 进入分支 B；多个 → 409 ambiguous | 视情况而定 |
 | B | 无 `sub_id`，且无 `customer_id` 或分支 C 找到 0 个订阅 | 行锁用户，设为 `plan='free'`，清空 `stripe_subscription_id`，清空 `monthly_credits_granted_at`，写入 `plan_transitions` 审计行 | 200 `immediate_revert` |
 
 每次成功取消都会写入 `plan_transitions`，`source='self_serve_cancel'`。metadata 包含 `sub_id`、`status_at_cancel`、分支原因码（如 `admin_promoted_revert`、`branch_c_auto_heal`、`stripe_already_canceled_sync`），以及用户提供的取消上下文：`cancel_reason`、`cancel_feedback`、`refund_requested`。
 
 `refund_requested` 只是内部审核信号。取消端点不会调用 Stripe Refunds，也不会自动判定退款资格；在独立退款工作流实现前，退款仍由人工/业务流程处理。
 
 前端 `/billing` 的取消入口保持自助可达，确认弹窗可收集可选取消原因、可选反馈和退款审核勾选，但取消动作不依赖这些字段。Pricing 和 Billing 页面展示 7-day fair-use refund review 文案，用于降低付费焦虑但不承诺自动退款。
 
 取消意图会记录 `subscription_cancel_requested` 事件；勾选退款审核会额外记录 `refund_requested`。Admin funnel 已纳入这两个事件，便于跟踪付费后取消和退款压力。
diff --git a/frontend/src/app/trust/TrustPageClient.tsx b/frontend/src/app/trust/TrustPageClient.tsx
index b6d4526..66f750a 100644
--- a/frontend/src/app/trust/TrustPageClient.tsx
+++ b/frontend/src/app/trust/TrustPageClient.tsx
@@ -1,302 +1,302 @@
 "use client";
 
 import React from "react";
 import Link from "next/link";
 import {
   Lock,
   ShieldCheck,
   FileWarning,
   KeyRound,
   UserX,
   Database,
   Globe2,
   AlertTriangle,
   type LucideIcon,
 } from "lucide-react";
 import MarketingShell from "../../components/marketing/MarketingShell";
 import EdPageHero from "../../components/marketing/EdPageHero";
 import EdSection from "../../components/marketing/EdSection";
 import EdCtaBanner from "../../components/marketing/EdCtaBanner";
 import { usePageTitle } from "../../lib/usePageTitle";
 import { useLocale } from "../../i18n";
 
 /* Trust Center content is intentionally specific and hand-maintained here
  * rather than i18n'd, because the technical claims (SSE-S3, SSRF, RFC 7748)
  * need precise English terminology to be credible. Copy will translate at
  * the section-heading level; the control names stay in English.
  *
  * Honest rule for this page: everything listed is something we actually
  * implemented (see backend code + docs/ARCHITECTURE.md §10). Things we have
  * NOT done (SOC2, HIPAA, SSO) are listed openly in the "What we don't have
  * yet" section so the reader can judge the gap.
  */
 
 interface Control {
   icon: LucideIcon;
   title: string;
   detail: string;
   evidence?: string;
 }
 
 const encryptionControls: Control[] = [
   {
     icon: Lock,
     title: "AES-256 encryption at rest",
     detail:
       "Uploaded documents are written to MinIO with SSE-S3 server-side encryption by default. Production (Railway) runs MinIO with KMS enabled so SSE-S3 is always applied. In unsupported self-hosted deployments without KMS, MinIO may fall back to unencrypted writes — that is a deployment choice, not a silent downgrade in production.",
     evidence: "backend/app/services/storage_service.py · upload_file()",
   },
   {
     icon: KeyRound,
     title: "TLS 1.2+ in transit",
     detail:
       "Every network hop — browser to Vercel edge, edge to Railway backend, backend to LLM providers — uses TLS. HSTS with max-age=63072000 and includeSubDomains is set on the apex domain.",
   },
   {
     icon: UserX,
     title: "No training on your data",
     detail:
       "DocTalk routes LLM calls through OpenRouter. Your documents and questions are never used by DocTalk to train models. Provider-side retention depends on the upstream model (DeepSeek / Mistral) — for guaranteed zero retention we rely on OpenRouter's account-level privacy setting (operational control, not yet code-enforced at the request level), and can tighten further with a provider allow-list on request.",
   },
 ];
 
 const ingestControls: Control[] = [
   {
     icon: FileWarning,
     title: "Magic-byte file validation",
     detail:
       "Uploads are validated against file signature bytes, not file extensions. A .pdf with an executable payload inside is rejected at ingest — you cannot trick the parser by renaming a file.",
     evidence: "backend/app/services/upload_service.py · magic-byte check",
   },
   {
     icon: Globe2,
     title: "SSRF protection on URL ingestion",
     detail:
       "When you drop a URL to summarize, the backend validates the target against an allow-list of public hosts and rejects any request to private IP ranges, link-local addresses, or cloud metadata endpoints (169.254.169.254, etc).",
     evidence: "backend/app/core/url_validator.py",
   },
   {
     icon: AlertTriangle,
     title: "Rate limits on anonymous endpoints",
     detail:
-      "Public endpoints (shared views, anonymous reads) have per-IP rate limits with HMAC-signed IP trust chain via the Vercel edge — the real client IP cannot be spoofed. Authenticated users bypass.",
+      "Public endpoints (shared views, anonymous reads) have per-IP rate limits. The real client IP is forwarded from the Vercel edge to our backend with an HMAC-SHA256 signature bound to a per-request timestamp, so the backend can authenticate the proxy origin and reject header-spoofing attempts. This is not a defense against an active wire-level MITM — TLS handles that layer. Authenticated users bypass IP rate limiting.",
     evidence: "backend/app/core/rate_limit.py · shared_view_limiter, anon_read_limiter",
   },
 ];
 
 const dataRightsControls: Control[] = [
   {
     icon: Database,
     title: "Full data export",
     detail:
       "From your Profile → Account you can export all your documents and session data. The export includes everything DocTalk stores about you, in portable formats.",
   },
   {
     icon: UserX,
     title: "Account deletion",
     detail:
       "You can delete your account from Profile → Account. All documents, sessions, chat history, embeddings, and billing records are removed; the account is not recoverable after deletion.",
   },
   {
     icon: ShieldCheck,
     title: "User isolation",
     detail:
       "Every document and session is scoped to its owner's user_id at the database and vector-store layer. There is no shared namespace, no org-wide collection by default, and the isolation is enforced at query time — not just at render time.",
   },
 ];
 
 const gaps = [
   {
     name: "SOC 2 Type II",
     status: "Not audited",
     note: "We are a small team without the engineering spend for a full SOC 2 audit yet. The underlying controls are in place; the certification is not.",
   },
   {
     name: "HIPAA",
     status: "Not compliant",
     note: "DocTalk is not a HIPAA-covered business associate. If you handle Protected Health Information, do not upload PHI until we announce BAA support.",
   },
   {
     name: "Enterprise SSO / SAML",
     status: "Not available",
     note: "Individual OAuth (Google, Microsoft) and magic-link email sign-in only. Enterprise SSO is on the roadmap but not shipped.",
   },
   {
     name: "On-premise / air-gapped deployment",
     status: "Not offered",
     note: "DocTalk is SaaS only. Self-hosted is not currently supported.",
   },
 ];
 
 const trustStats = [
   { label: "Encryption", value: "AES-256" },
   { label: "Transport", value: "TLS 1.2+" },
   { label: "Retention stance", value: "No training" },
 ];
 
 function ControlCard({ icon: Icon, title, detail, evidence }: Control) {
   return (
     <div className="ed-card h-full" style={{ display: "flex", flexDirection: "column" }}>
       <span style={{ color: "var(--ed-ink-3)", display: "flex", marginBottom: "12px" }}>
         <Icon aria-hidden size={18} />
       </span>
       <h3 className="ed-h3">{title}</h3>
       <p className="ed-body" style={{ marginTop: "8px" }}>
         {detail}
       </p>
       {evidence && (
         <p
           className="ed-caption"
           style={{
             marginTop: "auto",
             paddingTop: "12px",
             borderTop: "1px solid var(--ed-rule)",
           }}
         >
           {evidence}
         </p>
       )}
     </div>
   );
 }
 
 export default function TrustPageClient() {
   const { t } = useLocale();
   usePageTitle(t("trust.title", {}) || "Trust & Security");
 
   return (
     <MarketingShell
       breadcrumb={[
         { label: t("useCasesHub.breadcrumb.home"), href: "/" },
         { label: "Trust & Security" },
       ]}
     >
       <EdPageHero
         eyebrow="Trust Center"
         title="The real controls protecting your documents."
         lede="What DocTalk actually does to keep your uploads private, isolated, and unused for model training. And openly, what we haven't certified yet."
         meta={
           <div className="flex gap-4 flex-wrap items-center">
             <Link href="/privacy" className="ed-cta">
               Privacy policy
             </Link>
             <Link href="/contact" className="ed-link">
               Report security issue <span aria-hidden="true">→</span>
             </Link>
           </div>
         }
       />
 
       <EdSection alt label="Control summary">
         <div
           className="grid grid-cols-1 sm:grid-cols-3"
           style={{ gap: "16px" }}
         >
           {trustStats.map((stat) => (
             <div
               key={stat.label}
               style={{
                 border: "1px solid var(--ed-rule)",
                 background: "var(--ed-paper-2)",
                 padding: "16px",
               }}
             >
               <div className="ed-h3">{stat.value}</div>
               <p className="ed-caption" style={{ marginTop: "6px" }}>
                 {stat.label}
               </p>
             </div>
           ))}
         </div>
         <p
           className="ed-caption"
           style={{
             marginTop: "20px",
             padding: "12px 14px",
             border: "1px solid var(--ed-rule)",
             color: "var(--ed-ochre)",
           }}
         >
           Compliance badges are not claimed unless they are actually audited.
         </p>
       </EdSection>
 
       <EdSection num="01" title="Encryption & transit">
         <div
           className="grid grid-cols-1 md:grid-cols-3"
           style={{ gap: "16px", gridAutoRows: "1fr" }}
         >
           {encryptionControls.map((c) => (
             <ControlCard key={c.title} {...c} />
           ))}
         </div>
       </EdSection>
 
       <EdSection alt num="02" title="Ingest safety">
         <div
           className="grid grid-cols-1 md:grid-cols-3"
           style={{ gap: "16px", gridAutoRows: "1fr" }}
         >
           {ingestControls.map((c) => (
             <ControlCard key={c.title} {...c} />
           ))}
         </div>
       </EdSection>
 
       <EdSection num="03" title="Your data, your control">
         <div
           className="grid grid-cols-1 md:grid-cols-3"
           style={{ gap: "16px", gridAutoRows: "1fr" }}
         >
           {dataRightsControls.map((c) => (
             <ControlCard key={c.title} {...c} />
           ))}
         </div>
       </EdSection>
 
       <EdSection alt num="04" title="What we don't have yet">
         <div>
           {gaps.map((g, i) => (
             <div
               key={g.name}
               className="flex flex-col md:flex-row"
               style={{
                 padding: "18px 0",
                 borderTop: "1px solid var(--ed-rule)",
                 borderBottom:
                   i === gaps.length - 1 ? "1px solid var(--ed-rule)" : undefined,
                 gap: "12px",
               }}
             >
               <div className="md:w-64 shrink-0">
                 <div className="ed-body" style={{ fontWeight: 600 }}>
                   {g.name}
                 </div>
                 <div
                   className="ed-caption"
                   style={{
                     marginTop: "6px",
                     display: "inline-flex",
                     alignItems: "center",
                     gap: "6px",
                     textTransform: "uppercase",
                     color: "var(--ed-ochre)",
                   }}
                 >
                   <span
                     aria-hidden
                     style={{
                       width: "5px",
                       height: "5px",
                       background: "var(--ed-ochre)",
                     }}
                   />
                   {g.status}
                 </div>
               </div>
               <p className="ed-body" style={{ flex: 1 }}>
                 {g.note}
               </p>
             </div>
           ))}
         </div>

web search: 
web search: 
codex
I’ve validated the core backend/frontend code paths and now I’m cross-checking tests plus the targeted docs for stale header/secret wording or deploy-order mismatches, including the Chinese architecture mirror.
exec
/bin/zsh -lc 'rg -n "X-Proxy-IP|X-Proxy-IP-Ts|X-Proxy-IP-Sig|X-Proxy-IP-Secret|X-Real-Client-IP|AUTH_SECRET|ADAPTER_SECRET|legacy_path_used|Railway first|先发 Railway|Vercel second|24h" CLAUDE.md AGENTS.md README.md docs/ARCHITECTURE.md docs/ARCHITECTURE.zh.md frontend/src/app/trust/TrustPageClient.tsx backend/app/core/rate_limit.py frontend/src/app/api/proxy/[...path]/route.ts frontend/src/app/shared/[token]/page.tsx' in /Users/mayijie/Projects/Code/010_DocTalk
 exited 1 in 0ms:
zsh:1: no matches found: frontend/src/app/api/proxy/[...path]/route.ts

exec
/bin/zsh -lc "sed -n '920,1085p' docs/ARCHITECTURE.md" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
    VBuild --> VDeploy --> VDomain
    Repo -->|"railway up<br/>(manual, stable)"| RBuild
    RBuild --> Alembic --> CeleryW --> Uvicorn
    Uvicorn --> RServices
    CeleryW --> RServices
```

**Branching**: `main` (development) / `stable` (production). Push `main` → Vercel Preview only. Push `stable` → production deploy.

**Deployment details:**

| Aspect | Frontend (Vercel) | Backend (Railway) |
|--------|-------------------|-------------------|
| **Trigger** | Push `stable` (auto) | `railway up --detach` from `stable` (manual) |
| **Build** | Next.js static export from `frontend/` | Dockerfile from project root (includes LibreOffice headless + CJK fonts for PPTX/DOCX→PDF conversion) |
| **Runtime** | Serverless functions (Hobby plan) | Single container (`entrypoint.sh`): alembic → celery worker + celery beat + uvicorn (parallel; any exit → container restart by Railway) |
| **Domain** | `www.doctalk.site` | `backend-production-a62e.up.railway.app` |
| **Limits** | 4.5 MB function body, 60s max duration | Container memory based on Railway plan |

**Celery Beat scheduler**: The backend container runs both the Celery worker (for async tasks) and Celery Beat (for periodic tasks). Beat schedule is defined in `celery_app.py` and includes daily cleanup of expired verification tokens. See §10 for the single-instance invariant when scaling replicas.

**Environment sync:**
- `AUTH_SECRET` and `ADAPTER_SECRET` must match between Vercel and Railway
- `NEXT_PUBLIC_API_BASE` on Vercel must point to the Railway backend URL
- `BACKEND_INTERNAL_URL` on Vercel is the same Railway URL (used by the auth adapter)

---

## 10. Runtime & Operational Integrity

### Process Supervision (backend container)

`entrypoint.sh` no longer tries to act as a supervisor. Celery worker, Celery Beat, and uvicorn are started as parallel background processes; `wait -n` returns as soon as any of them exits, and the script then kills the other two and exits. **Railway's container restart policy** is the supervisor — a crash in any one process triggers a whole-container restart so the three processes always share a consistent lifecycle.

Requires `/bin/bash` (not POSIX `dash`) because of `wait -n`. `python:3.12.7-slim` ships bash at `/usr/bin/bash`.

### Celery Beat — single-instance invariant

Celery Beat schedules periodic tasks (currently: daily cleanup of expired verification tokens). **Exactly one Beat process must run across the whole backend fleet.** If the backend is ever horizontally scaled to multiple Railway replicas, set `ENABLE_CELERY_BEAT=0` on all-but-one replica (or factor Beat into its own dedicated Railway service). Duplicate Beats = duplicate scheduled side-effects.

### Client IP trust chain

Anonymous rate limiting counts per real visitor IP. The trust chain is:

1. **Vercel edge** strips client-supplied `X-Forwarded-For` / `X-Real-IP` and rewrites them with the real client IP (see [Vercel request headers](https://vercel.com/docs/headers/request-headers#x-forwarded-for)).
2. **Frontend proxy** (`/api/proxy/*`, and the SSR fetch in `/shared/[token]`) reads the rewritten headers, then forwards a triple-header HMAC proof to the backend:
   - `X-Proxy-IP`: the IP
   - `X-Proxy-IP-Ts`: unix seconds at sign time
   - `X-Proxy-IP-Sig`: hex(HMAC-SHA256(`ADAPTER_SECRET`, `"{ip}:{ts}"`))
3. **Backend** `get_client_ip(request)` (in `app/core/rate_limit.py`) verifies the signature with `hmac.compare_digest` and accepts a ±60s clock skew. Only on a successful verify does it trust the claimed IP; otherwise it falls back to `request.client.host`.

The signing key is `ADAPTER_SECRET`, not `AUTH_SECRET`. Reusing `AUTH_SECRET` as a wire-level proof header would expose the JWE encryption key on the Railway internal network and in any debug-header log pipeline — that was the C1 vulnerability fixed 2026-05-20. `AUTH_SECRET` now stays inside Auth.js (session-cookie encryption + backend JWT verification only).

Threat model honesty: HMAC binds the IP claim to the timestamp and proves the request originated from someone with `ADAPTER_SECRET`. It is **not** a defense against an active wire-level MITM with TLS-termination capability. Transport security is the responsibility of TLS between Vercel ↔ Railway.

Because the backend does **not** trust raw `X-Forwarded-For`, `--forwarded-allow-ips=127.0.0.1` (uvicorn default) is safe — no production env override is required.

#### Deploy sequence for C1 HMAC contract (Wave-1, 2026-05-20)

The fix-batch ships a dual-accept transition window — backend simultaneously recognizes BOTH the new triple-header contract AND the legacy `X-Real-Client-IP` + `X-Proxy-IP-Secret` pair (compared against `AUTH_SECRET`, the OLD signing secret). This is the only safe rollout order:

1. **Railway backend first.** `git checkout stable && git merge main && railway up --detach`. Wait for `GET /health` to return 200. At this point the backend accepts both contracts; production frontend is still emitting the legacy headers, which continue to work.
2. **Then push frontend to Vercel.** `git push origin stable`. Wait for the Vercel deployment to land "Ready". Frontend now emits only the new triple-header contract.
3. **Watch the legacy-path log counter** in Railway logs: `grep proxy.signed_ip.legacy_path_used`. It should drop to ~0 within minutes of step 2 as Vercel completes its rolling deploy.
4. **24h soak window**, then a follow-up commit removes the legacy branch from `get_client_ip()` + `X-Proxy-IP-Secret` / `X-Real-Client-IP` env references from both surfaces.

Reverse order (frontend first) would 401/429-collapse all in-flight traffic because the legacy proxy header would not match the new backend verifier.

### Redis degradation behavior

The rate limiter and demo-message tracker both have an in-memory fallback when Redis is unreachable. When that fallback activates, `_alert_redis_fallback` logs at `error` and emits one Sentry event **per namespace per 10 minutes** (to stay within the Sentry Free 5k/month quota during prolonged outages). Counts in the in-memory fallback do NOT persist across restarts and do NOT share state across replicas — degraded consistency is the correctness trade-off.

### Deep health endpoint

`GET /health?deep=true` (guarded by `X-Health-Secret` HMAC) probes all four data stores — Postgres, Redis, Qdrant, MinIO — concurrently with a 5 s per-probe timeout. Total response time is bounded by the slowest single probe, not by the sum of probes. Any probe failure flips `status` to `degraded` but does not return an error status code; callers must inspect `components`.

### Pre-debit refund invariant

Chat pre-debit refunds are now **fully idempotent**: `_refund_predebit` deletes the pre-debit ledger row first and only credits back the user balance when `DELETE` reports `rowcount > 0`. A double-invocation (e.g., retry on a partially-failed request) is safe. All SSE error branches (`LLM_ERROR`, `PERSIST_FAILED`, continuation variants) invoke the refund path before yielding the error.

Structured Extraction uses the same accounting shape for async workbench jobs:
`POST /api/documents/{id}/extractions` creates a `document_jobs` row, pre-debits
25 credits, stores the ledger id in `metadata_json`, and queues
`run_extraction_job` on Celery's `default` queue. The worker marks the job
`running`, retrieves cited chunks, calls the configured Pro-quality model,
stores an `extraction_results` payload, records `UsageRecord`, and reconciles
the original ledger row to actual token cost. Queue/worker failure deletes the
pre-debit ledger row before restoring the user's balance.

Chat-native structured extraction can create the same extraction jobs from a
chat turn. The tool executor stores a `source='chat_tool'` marker in job
metadata and returns an `extraction` artifact card with Markdown/CSV export URLs
instead of requiring the user to open the retired Extract workspace.

Table Extraction reuses `document_jobs` with `job_type='table_scan'` but does
not pre-debit credits because table detection is parser/provider work rather
than an LLM call. As of `0.16.0 beta`, native PDFs prefer Azure AI Document
Intelligence `prebuilt-layout` when `DOCUMENT_INTELLIGENCE_PROVIDER=azure` and
`AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT` / `AZURE_DOCUMENT_INTELLIGENCE_KEY` are
configured. Each Azure attempt writes a `document_layout_runs` row, stores the
raw layout payload in object storage when possible, and maps Azure tables into
`document_tables.cells` with rows, cell regions, header metadata, merged-cell
spans, provider metadata, and the layout run id. If Azure is not configured or
fails due SDK, auth, timeout, malformed response, or service error, the worker
records the failed run and falls back to PyMuPDF `page.find_tables()`.
DOCX/PPTX/XLSX/TXT/MD/URL-derived documents continue to use markdown-table
detection from stored `pages.content`. Free users can preview detected tables;
CSV export is gated to Plus+.

Chat-native table requests reuse the same `table_scan` jobs. If tables already
exist, the executor returns an immediate `table_scan` or `table_export` artifact
preview. If a Free user asks for CSV, the artifact shows the Plus requirement
instead of exposing a download link that would fail later. Polling
`/api/document-jobs/{job_id}` returns provider/fallback metadata so the artifact
can show confidence and fallback warnings without exposing raw layout payloads.
Each successful scan also writes `document_elements.element_type='table'` rows
with the stable `document_tables.id`, provider metadata, confidence, page span,
and compact table text. Table-aware retrieval uses these canonical table
locations for coverage and falls back to any same-document chunk as a citation
anchor if the chunker did not create a fragment on the exact table page.

Question Templates reuse `document_jobs` with `job_type='batch_template'` and
store outputs in `extraction_results` with `template_key='question_template'`.
`question_templates` stores per-user saved checklists as JSONB question arrays.
Single-document runs are gated to Plus+, Collection batch runs are gated to Pro,
and each answer cell uses the same cited retrieval/LLM path as Structured
Extraction. Runs pre-debit credits by question × document count, queue
`run_batch_template_job` on Celery's `default` queue, then reconcile the
original ledger row to actual token cost.

Document Diff reuses the same job/result foundation with
`job_type='document_diff'` and `template_key='document_diff'`. It is gated to
Pro, requires two different ready documents owned by the same user, optionally
scopes the run to a Collection, and pre-debits 60 credits before queueing
`run_document_diff_job` on Celery's `default` queue. The worker retrieves cited
chunks from both the old and new document, asks the Pro-quality model for a
semantic added/removed/modified report, stores old/new citation payloads in
`extraction_results.citations`, records `UsageRecord`, and reconciles the
original ledger row to actual token cost. The MVP is a cited semantic change
report, not a byte-level redline renderer.

Public shared-session responses expose only safe message anchors, role/content,
and page/snippet/document-filename citation summaries. They intentionally omit
bbox coordinates, chunk ids, document ids, and confidence scores; private
authenticated document pages remain the only surfaces that can jump to exact
bbox highlights.

### Self-serve subscription cancel state machine

`POST /api/billing/cancel` (introduced 2026-04-14) implements a six-branch
state machine so every combination of `user.plan`, `user.stripe_subscription_id`,
and `user.stripe_customer_id` maps deterministically to one action. Branches
are evaluated in order **D → E → A → F → C → B**:

| # | Precondition | Action | Return |
|---|---|---|---|
| D | `plan == "free"` | No-op | 400 |
| E | `stripe_subscription_id == "pending"` | No-op (checkout in flight) | 409 |
| A | `sub_id` starts with `sub_` (real Stripe ID) | `Subscription.retrieve` → dispatch on status: active/trialing/past_due → `modify(cancel_at_period_end=true)`; canceled → local sync to free; other → 409 | 200 `scheduled_cancel` or `immediate_revert` |
| F | `sub_id` is non-empty, non-`pending`, not `sub_*` (malformed) | No local revert; fail closed | 409 |
| C | no `sub_id` but `stripe_customer_id` present | List customer subs filtered by cancellable status. 1 → auto-heal + Branch A. 0 → fall through to Branch B. >1 → 409 ambiguous | (varies) |
| B | no `sub_id` AND (no `customer_id` OR Branch C found 0) | Row-lock user, set `plan='free'`, null `stripe_subscription_id`, clear `monthly_credits_granted_at`, write `plan_transitions` audit row | 200 `immediate_revert` |

Branch B is what closes the admin-promoted user gap (user whose plan was
elevated directly in the DB with no Stripe customer).


exec
/bin/zsh -lc "sed -n '930,1115p' docs/ARCHITECTURE.zh.md" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
| A | `sub_id` 以 `sub_` 开头（真实 Stripe ID） | `Subscription.retrieve` 后按状态分发：active/trialing/past_due → `modify(cancel_at_period_end=true)`；canceled → 本地同步为 Free；其他状态 → 409 | 200 `scheduled_cancel` 或 `immediate_revert` |
| F | `sub_id` 非空、非 `pending`、但不是 `sub_*`（格式异常） | fail closed，不做本地降级 | 409 |
| C | 无 `sub_id` 但有 `stripe_customer_id` | 查询 customer 的可取消订阅。1 个 → auto-heal + 分支 A；0 个 → 进入分支 B；多个 → 409 ambiguous | 视情况而定 |
| B | 无 `sub_id`，且无 `customer_id` 或分支 C 找到 0 个订阅 | 行锁用户，设为 `plan='free'`，清空 `stripe_subscription_id`，清空 `monthly_credits_granted_at`，写入 `plan_transitions` 审计行 | 200 `immediate_revert` |

每次成功取消都会写入 `plan_transitions`，`source='self_serve_cancel'`。metadata 包含 `sub_id`、`status_at_cancel`、分支原因码（如 `admin_promoted_revert`、`branch_c_auto_heal`、`stripe_already_canceled_sync`），以及用户提供的取消上下文：`cancel_reason`、`cancel_feedback`、`refund_requested`。

`refund_requested` 只是内部审核信号。取消端点不会调用 Stripe Refunds，也不会自动判定退款资格；在独立退款工作流实现前，退款仍由人工/业务流程处理。

前端 `/billing` 的取消入口保持自助可达，确认弹窗可收集可选取消原因、可选反馈和退款审核勾选，但取消动作不依赖这些字段。Pricing 和 Billing 页面展示 7-day fair-use refund review 文案，用于降低付费焦虑但不承诺自动退款。

取消意图会记录 `subscription_cancel_requested` 事件；勾选退款审核会额外记录 `refund_requested`。Admin funnel 已纳入这两个事件，便于跟踪付费后取消和退款压力。

exec
/bin/zsh -lc "sed -n '150,230p' README.md" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
| `OCR_LANGUAGES` | No | Tesseract language codes (default: `eng+chi_sim`) |

### Frontend (`.env.local`)

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_API_BASE` | Yes | Backend URL (default: `http://localhost:8000`) |
| `BACKEND_INTERNAL_URL` | No | Server-side proxy target (private network). Preferred over `NEXT_PUBLIC_API_BASE` when set. |
| `AUTH_SECRET` | Yes | Must match backend `AUTH_SECRET` |
| `ADAPTER_SECRET` | Yes | Must match backend `ADAPTER_SECRET`. Used to HMAC-sign the `X-Proxy-IP` claim sent to the backend. |
| `GOOGLE_CLIENT_ID` | Yes | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Yes | Google OAuth client secret |
| `MICROSOFT_CLIENT_ID` | No | Microsoft OAuth client ID |
| `MICROSOFT_CLIENT_SECRET` | No | Microsoft OAuth client secret |
| `RESEND_API_KEY` | No | Resend API key for magic link emails |

</details>

<details>
<summary><strong>Project Structure</strong></summary>

```
DocTalk/
├── backend/
│   ├── app/
│   │   ├── api/            # Route handlers (documents, chat, search, billing, auth, users)
│   │   ├── core/           # Config, dependencies, SSRF protection, security logging
│   │   ├── models/         # SQLAlchemy ORM models
│   │   ├── schemas/        # Pydantic request/response schemas
│   │   ├── services/       # Business logic (chat, credits, parsing, retrieval, extractors)
│   │   └── workers/        # Celery task definitions
│   ├── alembic/            # Database migrations
│   ├── seed_data/          # Demo PDF files
│   └── tests/
├── frontend/
│   ├── src/
│   │   ├── app/            # Next.js pages
│   │   ├── components/     # React components
│   │   ├── lib/            # API client, auth, SSE, utilities
│   │   ├── i18n/           # 11 language locale files
│   │   ├── store/          # Zustand state management
│   │   └── types/
│   └── public/
├── docs/
│   ├── ARCHITECTURE.md
│   └── PRODUCT_STRATEGY.md
└── docker-compose.yml
```

</details>

## Deployment

**Branching:** `main` (development) / `stable` (production).

| Target | Method |
|--------|--------|
| **Frontend** (Vercel) | Push to `stable` → auto-deploys. Root directory: `frontend/`. |
| **Backend** (Railway) | `git checkout stable && railway up --detach` |

Railway runs 5 services: backend, PostgreSQL, Redis, Qdrant, MinIO.

## Versioning

DocTalk uses Semantic Versioning with pre-1.0 release numbers in `0.minor.patch`
format. The source of truth is the repository root [`version.json`](version.json).

- `0.2.0` means: major API stability has not been promised yet, but releases still
  follow a predictable three-part version.
- Use `python3 scripts/bump_version.py patch` for bug-fix releases such as
  `0.2.0 -> 0.2.1`.
- Use `python3 scripts/bump_version.py minor` for backward-compatible feature
  releases such as `0.2.1 -> 0.3.0`.
- Use `python3 scripts/check_version_consistency.py` to verify that
  `version.json`, `frontend/package.json`, `frontend/package-lock.json`, and the
  changelog stay in sync.

Runtime release metadata is exposed at backend `/version` and included in `/health`.
The frontend footer also shows the current release label.

## Testing

exec
/bin/zsh -lc "rg -n \"X-Proxy-IP|X-Proxy-IP-Ts|X-Proxy-IP-Sig|X-Proxy-IP-Secret|X-Real-Client-IP|AUTH_SECRET|ADAPTER_SECRET|legacy_path_used\" CLAUDE.md AGENTS.md README.md docs/ARCHITECTURE.md docs/ARCHITECTURE.zh.md frontend/src/app/trust/TrustPageClient.tsx backend/app/core/rate_limit.py 'frontend/src/app/api/proxy/[...path]/route.ts' 'frontend/src/app/shared/[token]/page.tsx'" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
frontend/src/app/shared/[token]/page.tsx:7:// C1: ADAPTER_SECRET signs the X-Proxy-IP claim. Must match the backend's
frontend/src/app/shared/[token]/page.tsx:8:// settings.ADAPTER_SECRET. NOT AUTH_SECRET — AUTH_SECRET stays inside Auth.js.
frontend/src/app/shared/[token]/page.tsx:9:const ADAPTER_SECRET = process.env.ADAPTER_SECRET;
frontend/src/app/shared/[token]/page.tsx:34:  if (clientIp && ADAPTER_SECRET) {
frontend/src/app/shared/[token]/page.tsx:36:    const sig = createHmac('sha256', ADAPTER_SECRET)
frontend/src/app/shared/[token]/page.tsx:39:    backendHeaders['X-Proxy-IP'] = clientIp;
frontend/src/app/shared/[token]/page.tsx:40:    backendHeaders['X-Proxy-IP-Ts'] = ts;
frontend/src/app/shared/[token]/page.tsx:41:    backendHeaders['X-Proxy-IP-Sig'] = sig;
frontend/src/app/api/proxy/[...path]/route.ts:12:const AUTH_SECRET = process.env.AUTH_SECRET;
frontend/src/app/api/proxy/[...path]/route.ts:13:// C1: ADAPTER_SECRET is the per-deployment shared secret used to HMAC-sign
frontend/src/app/api/proxy/[...path]/route.ts:14:// the X-Proxy-IP claim sent to the backend. Distinct from AUTH_SECRET (which
frontend/src/app/api/proxy/[...path]/route.ts:16:const ADAPTER_SECRET = process.env.ADAPTER_SECRET;
frontend/src/app/api/proxy/[...path]/route.ts:40: * that the backend can verify with the shared AUTH_SECRET.
frontend/src/app/api/proxy/[...path]/route.ts:43:  if (!AUTH_SECRET) {
frontend/src/app/api/proxy/[...path]/route.ts:44:    throw new Error("AUTH_SECRET not configured");
frontend/src/app/api/proxy/[...path]/route.ts:46:  const secret = new TextEncoder().encode(AUTH_SECRET);
frontend/src/app/api/proxy/[...path]/route.ts:62:  const token = await getToken({ req, secret: AUTH_SECRET, secureCookie });
frontend/src/app/api/proxy/[...path]/route.ts:88:  if (clientIp && ADAPTER_SECRET) {
frontend/src/app/api/proxy/[...path]/route.ts:92:    // Signing key is ADAPTER_SECRET (NOT AUTH_SECRET — the latter encrypts
frontend/src/app/api/proxy/[...path]/route.ts:95:    const sig = createHmac("sha256", ADAPTER_SECRET)
frontend/src/app/api/proxy/[...path]/route.ts:98:    headers.set("X-Proxy-IP", clientIp);
frontend/src/app/api/proxy/[...path]/route.ts:99:    headers.set("X-Proxy-IP-Ts", ts);
frontend/src/app/api/proxy/[...path]/route.ts:100:    headers.set("X-Proxy-IP-Sig", sig);
README.md:144:| `AUTH_SECRET` | Yes | Random secret (shared with frontend) |
README.md:145:| `ADAPTER_SECRET` | Yes | Secret for internal auth API |
README.md:158:| `AUTH_SECRET` | Yes | Must match backend `AUTH_SECRET` |
README.md:159:| `ADAPTER_SECRET` | Yes | Must match backend `ADAPTER_SECRET`. Used to HMAC-sign the `X-Proxy-IP` claim sent to the backend. |
docs/ARCHITECTURE.zh.md:353:3. 后端使用共享的 `AUTH_SECRET` 验证这个简单的 JWT
docs/ARCHITECTURE.zh.md:838:- `AUTH_SECRET` 和 `ADAPTER_SECRET` 在 Vercel 和 Railway 之间必须一致
docs/ARCHITECTURE.zh.md:862:   - `X-Proxy-IP`：真实 IP
docs/ARCHITECTURE.zh.md:863:   - `X-Proxy-IP-Ts`：签名时刻的 unix 秒
docs/ARCHITECTURE.zh.md:864:   - `X-Proxy-IP-Sig`：hex(HMAC-SHA256(`ADAPTER_SECRET`, `"{ip}:{ts}"`))
docs/ARCHITECTURE.zh.md:867:签名密钥是 `ADAPTER_SECRET`，**不是** `AUTH_SECRET`。把 `AUTH_SECRET` 当作 wire-level 证明 header 重用，会让 JWE 加密密钥暴露在 Railway 内网及任何 debug header 日志管线里 —— 这正是 2026-05-20 修复的 C1 漏洞。`AUTH_SECRET` 现在只留在 Auth.js 内（session cookie 加密 + 后端 JWT 验证）。
docs/ARCHITECTURE.zh.md:869:威胁建模实事求是：HMAC 把 IP 声明绑定到时间戳，证明请求来自掌握 `ADAPTER_SECRET` 的源；但它**不**防御具备 TLS 终止能力的主动 wire-level MITM。传输层安全由 Vercel ↔ Railway 之间的 TLS 负责。
docs/ARCHITECTURE.zh.md:875:本次修复采用 dual-accept 过渡窗口 —— 后端同时识别新的三 header 契约和旧的 `X-Real-Client-IP` + `X-Proxy-IP-Secret`（与 `AUTH_SECRET` 比对，旧契约的签名 secret）。安全的发布顺序只有一种：
docs/ARCHITECTURE.zh.md:879:3. **观察 legacy_path 日志计数**：Railway 日志中 `grep proxy.signed_ip.legacy_path_used`，应在 Vercel rolling deploy 完成后几分钟内降到 ~0。
docs/ARCHITECTURE.zh.md:880:4. **24h soak window** 后，follow-up commit 删除 `get_client_ip()` 里的 legacy 分支以及双方代码中的 `X-Proxy-IP-Secret` / `X-Real-Client-IP` env 引用。
backend/app/core/rate_limit.py:260:_ADAPTER_SECRET_BYTES: bytes = (settings.ADAPTER_SECRET or "").encode("utf-8")
backend/app/core/rate_limit.py:261:_AUTH_SECRET_BYTES: bytes = (settings.AUTH_SECRET or "").encode("utf-8")
backend/app/core/rate_limit.py:281:      X-Proxy-IP:     <ip>
backend/app/core/rate_limit.py:282:      X-Proxy-IP-Ts:  <unix_seconds>
backend/app/core/rate_limit.py:283:      X-Proxy-IP-Sig: hex(HMAC-SHA256(ADAPTER_SECRET, "{ip}:{ts}"))
backend/app/core/rate_limit.py:290:    if not _ADAPTER_SECRET_BYTES:
backend/app/core/rate_limit.py:301:        _ADAPTER_SECRET_BYTES,
backend/app/core/rate_limit.py:314:      X-Proxy-IP / X-Proxy-IP-Ts / X-Proxy-IP-Sig signed with ADAPTER_SECRET.
backend/app/core/rate_limit.py:317:      X-Real-Client-IP + X-Proxy-IP-Secret compared against AUTH_SECRET.
backend/app/core/rate_limit.py:348:    # AUTH_SECRET (the OLD signing secret, NOT ADAPTER_SECRET — Codex R5) and
backend/app/core/rate_limit.py:349:    # reads X-Real-Client-IP (the OLD trusted IP header, NOT X-Real-IP — R4).
backend/app/core/rate_limit.py:355:        and _AUTH_SECRET_BYTES
backend/app/core/rate_limit.py:356:        and hmac.compare_digest(proxy_secret.encode("utf-8"), _AUTH_SECRET_BYTES)
backend/app/core/rate_limit.py:358:        logger.info("proxy.signed_ip.legacy_path_used")
docs/ARCHITECTURE.md:374:3. The backend validates this simple JWT using the shared `AUTH_SECRET`
docs/ARCHITECTURE.md:942:- `AUTH_SECRET` and `ADAPTER_SECRET` must match between Vercel and Railway
docs/ARCHITECTURE.md:966:   - `X-Proxy-IP`: the IP
docs/ARCHITECTURE.md:967:   - `X-Proxy-IP-Ts`: unix seconds at sign time
docs/ARCHITECTURE.md:968:   - `X-Proxy-IP-Sig`: hex(HMAC-SHA256(`ADAPTER_SECRET`, `"{ip}:{ts}"`))
docs/ARCHITECTURE.md:971:The signing key is `ADAPTER_SECRET`, not `AUTH_SECRET`. Reusing `AUTH_SECRET` as a wire-level proof header would expose the JWE encryption key on the Railway internal network and in any debug-header log pipeline — that was the C1 vulnerability fixed 2026-05-20. `AUTH_SECRET` now stays inside Auth.js (session-cookie encryption + backend JWT verification only).
docs/ARCHITECTURE.md:973:Threat model honesty: HMAC binds the IP claim to the timestamp and proves the request originated from someone with `ADAPTER_SECRET`. It is **not** a defense against an active wire-level MITM with TLS-termination capability. Transport security is the responsibility of TLS between Vercel ↔ Railway.
docs/ARCHITECTURE.md:979:The fix-batch ships a dual-accept transition window — backend simultaneously recognizes BOTH the new triple-header contract AND the legacy `X-Real-Client-IP` + `X-Proxy-IP-Secret` pair (compared against `AUTH_SECRET`, the OLD signing secret). This is the only safe rollout order:
docs/ARCHITECTURE.md:983:3. **Watch the legacy-path log counter** in Railway logs: `grep proxy.signed_ip.legacy_path_used`. It should drop to ~0 within minutes of step 2 as Vercel completes its rolling deploy.
docs/ARCHITECTURE.md:984:4. **24h soak window**, then a follow-up commit removes the legacy branch from `get_client_ip()` + `X-Proxy-IP-Secret` / `X-Real-Client-IP` env references from both surfaces.
AGENTS.md:65:- **Backend** (`.env` + Railway): `DATABASE_URL`, `OPENROUTER_API_KEY`, `DEEPSEEK_API_KEY`, `AUTH_SECRET`, `ADAPTER_SECRET`, `STRIPE_SECRET_KEY` (`sk_live_*` in production; `sk_test_*` only for local/test), `STRIPE_WEBHOOK_SECRET`
AGENTS.md:66:- **Frontend** (Vercel): `NEXT_PUBLIC_API_BASE` (**never** localhost in prod), `BACKEND_INTERNAL_URL` (preferred for server-side proxy hop), `AUTH_SECRET`, `ADAPTER_SECRET`, `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`, `MICROSOFT_CLIENT_ID` / `MICROSOFT_CLIENT_SECRET`, `RESEND_API_KEY`
AGENTS.md:68:Cross-origin IP trust chain is HMAC-signed with `ADAPTER_SECRET` — frontend and backend values must match. Proxy emits `X-Proxy-IP` / `X-Proxy-IP-Ts` / `X-Proxy-IP-Sig` (HMAC-SHA256 of `"{ip}:{ts}"`); backend verifies with `hmac.compare_digest` and ±60s skew. Never send `AUTH_SECRET` in an outbound header — it's the Auth.js JWE key.
CLAUDE.md:60:- **Backend** (`.env` + Railway): `DATABASE_URL`, `OPENROUTER_API_KEY`, `DEEPSEEK_API_KEY`, `AUTH_SECRET`, `ADAPTER_SECRET`, `STRIPE_SECRET_KEY` (`sk_live_*` in production; `sk_test_*` only for local/test), `STRIPE_WEBHOOK_SECRET`
CLAUDE.md:61:- **Frontend** (Vercel): `NEXT_PUBLIC_API_BASE` (**never** localhost in prod), `BACKEND_INTERNAL_URL` (preferred for server-side proxy hop), `AUTH_SECRET`, `ADAPTER_SECRET`, `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`, `MICROSOFT_CLIENT_ID` / `MICROSOFT_CLIENT_SECRET`, `RESEND_API_KEY`
CLAUDE.md:63:Cross-origin IP trust chain is HMAC-signed with `ADAPTER_SECRET` — frontend and backend values **must match**. The proxy emits `X-Proxy-IP` / `X-Proxy-IP-Ts` / `X-Proxy-IP-Sig` (HMAC-SHA256 of `"{ip}:{ts}"`); backend verifies with `hmac.compare_digest` and ±60s skew. Never put `AUTH_SECRET` in an outbound header — it's the Auth.js JWE encryption key.

exec
/bin/zsh -lc 'rg -n "Deploy sequence for C1|C1 HMAC|双重|legacy|X-Proxy-IP-Secret|X-Real-Client-IP|X-Proxy-IP" docs/ARCHITECTURE.zh.md docs/ARCHITECTURE.md' in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
docs/ARCHITECTURE.zh.md:433:4. **Plus/Pro 订阅**：Stripe 循环订阅（月付或年付）。`checkout.session.completed`（mode=subscription）仅更新用户套餐——**不发放积分**（防止与 invoice Webhook 双重发放）。积分仅通过 `invoice.payment_succeeded` Webhook 发放（Plus: 3K，Pro: 9K），按 `invoice.id` 幂等。收到 `customer.subscription.deleted` 后将套餐重置为 Free。
docs/ARCHITECTURE.zh.md:862:   - `X-Proxy-IP`：真实 IP
docs/ARCHITECTURE.zh.md:863:   - `X-Proxy-IP-Ts`：签名时刻的 unix 秒
docs/ARCHITECTURE.zh.md:864:   - `X-Proxy-IP-Sig`：hex(HMAC-SHA256(`ADAPTER_SECRET`, `"{ip}:{ts}"`))
docs/ARCHITECTURE.zh.md:873:#### C1 HMAC 契约的部署顺序（Wave-1，2026-05-20）
docs/ARCHITECTURE.zh.md:875:本次修复采用 dual-accept 过渡窗口 —— 后端同时识别新的三 header 契约和旧的 `X-Real-Client-IP` + `X-Proxy-IP-Secret`（与 `AUTH_SECRET` 比对，旧契约的签名 secret）。安全的发布顺序只有一种：
docs/ARCHITECTURE.zh.md:879:3. **观察 legacy_path 日志计数**：Railway 日志中 `grep proxy.signed_ip.legacy_path_used`，应在 Vercel rolling deploy 完成后几分钟内降到 ~0。
docs/ARCHITECTURE.zh.md:880:4. **24h soak window** 后，follow-up commit 删除 `get_client_ip()` 里的 legacy 分支以及双方代码中的 `X-Proxy-IP-Secret` / `X-Real-Client-IP` env 引用。
docs/ARCHITECTURE.md:244:  The legacy `documents.summary` and `documents.suggested_questions` fields are
docs/ARCHITECTURE.md:262:  document. If no elements exist for legacy documents, it falls back to
docs/ARCHITECTURE.md:966:   - `X-Proxy-IP`: the IP
docs/ARCHITECTURE.md:967:   - `X-Proxy-IP-Ts`: unix seconds at sign time
docs/ARCHITECTURE.md:968:   - `X-Proxy-IP-Sig`: hex(HMAC-SHA256(`ADAPTER_SECRET`, `"{ip}:{ts}"`))
docs/ARCHITECTURE.md:977:#### Deploy sequence for C1 HMAC contract (Wave-1, 2026-05-20)
docs/ARCHITECTURE.md:979:The fix-batch ships a dual-accept transition window — backend simultaneously recognizes BOTH the new triple-header contract AND the legacy `X-Real-Client-IP` + `X-Proxy-IP-Secret` pair (compared against `AUTH_SECRET`, the OLD signing secret). This is the only safe rollout order:
docs/ARCHITECTURE.md:981:1. **Railway backend first.** `git checkout stable && git merge main && railway up --detach`. Wait for `GET /health` to return 200. At this point the backend accepts both contracts; production frontend is still emitting the legacy headers, which continue to work.
docs/ARCHITECTURE.md:983:3. **Watch the legacy-path log counter** in Railway logs: `grep proxy.signed_ip.legacy_path_used`. It should drop to ~0 within minutes of step 2 as Vercel completes its rolling deploy.
docs/ARCHITECTURE.md:984:4. **24h soak window**, then a follow-up commit removes the legacy branch from `get_client_ip()` + `X-Proxy-IP-Secret` / `X-Real-Client-IP` env references from both surfaces.
docs/ARCHITECTURE.md:986:Reverse order (frontend first) would 401/429-collapse all in-flight traffic because the legacy proxy header would not match the new backend verifier.
docs/ARCHITECTURE.md:1193:- `frontend/src/lib/api.ts` throws an `ApiError { status, code, detail, raw }` from `handle()` for every non-2xx response. `ApiError.message` stays in the literal shape `HTTP <status>: <raw>` for **one deprecation window** (2026-04-14 + next release) so legacy substring consumers — specifically the billing detail regex at `BillingPageClient.tsx:157-168` — keep working. After the deprecation window `message` becomes non-authoritative (logs only) and consumers must read `code` + `status`.

exec
/bin/zsh -lc "sed -n '840,900p' docs/ARCHITECTURE.zh.md" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
- Vercel 上的 `BACKEND_INTERNAL_URL` 是相同的 Railway URL（Auth Adapter 使用）

---

## 10. 运行时与运维完整性

### 进程监管（后端容器）

`entrypoint.sh` 不再尝试扮演 supervisor 角色。Celery worker、Celery Beat、uvicorn 作为并行后台进程启动；`wait -n` 在任一进程退出时返回，脚本随后 kill 另外两个并退出。**Railway 的容器重启策略** 才是真正的 supervisor —— 任一进程崩溃触发整容器重启，保证三进程永远共享一致的生命周期。

需要 `/bin/bash`（不是 POSIX 的 `dash`），因为用到 `wait -n`。`python:3.12.7-slim` 自带 `/usr/bin/bash`。

### Celery Beat —— 单实例约束

Celery Beat 调度定期任务（目前：每日清理过期验证令牌）。**整个后端集群只能有一个 Beat 进程运行。** 如未来后端横向扩展到多 Railway 副本，需在其他副本设置 `ENABLE_CELERY_BEAT=0`（或把 Beat 拆到独立的 Railway service）。重复 Beat = 重复的定时副作用。

### 客户端 IP 信任链

匿名限流按真实访问者 IP 计数。信任链如下：

1. **Vercel edge** 剥离客户端自带的 `X-Forwarded-For` / `X-Real-IP` 并重写为真实客户端 IP（见 [Vercel request headers](https://vercel.com/docs/headers/request-headers#x-forwarded-for)）。
2. **前端代理**（`/api/proxy/*`，以及 `/shared/[token]` 的 SSR fetch）读取重写后的头，转发到后端时附加三个 HMAC 证明头：
   - `X-Proxy-IP`：真实 IP
   - `X-Proxy-IP-Ts`：签名时刻的 unix 秒
   - `X-Proxy-IP-Sig`：hex(HMAC-SHA256(`ADAPTER_SECRET`, `"{ip}:{ts}"`))
3. **后端** `get_client_ip(request)`（在 `app/core/rate_limit.py`）用 `hmac.compare_digest` 验证签名，并接受 ±60 秒时钟漂移。只有验证通过才信任声明的 IP，否则回退到 `request.client.host`。

签名密钥是 `ADAPTER_SECRET`，**不是** `AUTH_SECRET`。把 `AUTH_SECRET` 当作 wire-level 证明 header 重用，会让 JWE 加密密钥暴露在 Railway 内网及任何 debug header 日志管线里 —— 这正是 2026-05-20 修复的 C1 漏洞。`AUTH_SECRET` 现在只留在 Auth.js 内（session cookie 加密 + 后端 JWT 验证）。

威胁建模实事求是：HMAC 把 IP 声明绑定到时间戳，证明请求来自掌握 `ADAPTER_SECRET` 的源；但它**不**防御具备 TLS 终止能力的主动 wire-level MITM。传输层安全由 Vercel ↔ Railway 之间的 TLS 负责。

因为后端**不**信任原始 `X-Forwarded-For`，`--forwarded-allow-ips=127.0.0.1`（uvicorn 默认值）是安全的，生产无需覆盖该 env。

#### C1 HMAC 契约的部署顺序（Wave-1，2026-05-20）

本次修复采用 dual-accept 过渡窗口 —— 后端同时识别新的三 header 契约和旧的 `X-Real-Client-IP` + `X-Proxy-IP-Secret`（与 `AUTH_SECRET` 比对，旧契约的签名 secret）。安全的发布顺序只有一种：

1. **先发 Railway 后端。** `git checkout stable && git merge main && railway up --detach`，等 `GET /health` 返回 200。此时后端两种契约都接受，生产前端仍在用旧 header，无影响。
2. **然后推 Vercel 前端。** `git push origin stable`，等 Vercel 部署 "Ready"。前端切换为只发新三 header。
3. **观察 legacy_path 日志计数**：Railway 日志中 `grep proxy.signed_ip.legacy_path_used`，应在 Vercel rolling deploy 完成后几分钟内降到 ~0。
4. **24h soak window** 后，follow-up commit 删除 `get_client_ip()` 里的 legacy 分支以及双方代码中的 `X-Proxy-IP-Secret` / `X-Real-Client-IP` env 引用。

反向顺序（前端先发）会让在途流量 401/429 全面坍塌 —— 旧 proxy header 与新后端 verifier 不匹配。

### Redis 降级行为

速率限制器和演示消息计数器在 Redis 不可达时都会回退到内存。降级触发时，`_alert_redis_fallback` 以 `error` 级记录日志，并**每个 namespace 每 10 分钟**最多发一次 Sentry 事件（避免持续故障打满 Sentry Free 5k/月配额）。内存 fallback 中的计数**不**跨重启持久化，也**不**跨副本共享 —— 一致性降级是该场景的正确性取舍。

### 深度健康检查端点

`GET /health?deep=true`（由 `X-Health-Secret` HMAC 守护）**并发**探活所有四个数据存储 —— Postgres、Redis、Qdrant、MinIO，每个 probe 5s 超时。总响应时间受限于**最慢单项**，不是各项之和。任一 probe 失败会把 `status` 标为 `degraded`，但不返回 error 状态码；调用方必须检查 `components`。

### 预扣积分退款不变量

聊天预扣积分退款现已**完全幂等**：`_refund_predebit` 先 DELETE 预扣的 ledger 行，仅当 `DELETE` 报告 `rowcount > 0` 时才恢复用户余额。重复调用（例如部分失败请求的重试）是安全的。所有 SSE 错误分支（`LLM_ERROR`、`PERSIST_FAILED`、续写变体）都在 yield 错误之前调用退款路径。

### 表格扫描与 Document Intelligence

Table Extraction 复用 `document_jobs`，`job_type='table_scan'`。因为表格扫描是
parser/provider 工作而不是 LLM 调用，目前不预扣 credits。从 `0.16.0 beta` 开始，
原生 PDF 在配置 `DOCUMENT_INTELLIGENCE_PROVIDER=azure` 且提供

exec
/bin/zsh -lc 'rg -n "railway up|stable|deploy|X-Proxy-IP|ADAPTER_SECRET|AUTH_SECRET|X-Proxy-IP-Secret|X-Real-Client-IP|legacy" README.md' in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
144:| `AUTH_SECRET` | Yes | Random secret (shared with frontend) |
145:| `ADAPTER_SECRET` | Yes | Secret for internal auth API |
158:| `AUTH_SECRET` | Yes | Must match backend `AUTH_SECRET` |
159:| `ADAPTER_SECRET` | Yes | Must match backend `ADAPTER_SECRET`. Used to HMAC-sign the `X-Proxy-IP` claim sent to the backend. |
203:**Branching:** `main` (development) / `stable` (production).
207:| **Frontend** (Vercel) | Push to `stable` → auto-deploys. Root directory: `frontend/`. |
208:| **Backend** (Railway) | `git checkout stable && railway up --detach` |

exec
/bin/zsh -lc "sed -n '196,220p' README.md" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
└── docker-compose.yml
```

</details>

## Deployment

**Branching:** `main` (development) / `stable` (production).

| Target | Method |
|--------|--------|
| **Frontend** (Vercel) | Push to `stable` → auto-deploys. Root directory: `frontend/`. |
| **Backend** (Railway) | `git checkout stable && railway up --detach` |

Railway runs 5 services: backend, PostgreSQL, Redis, Qdrant, MinIO.

## Versioning

DocTalk uses Semantic Versioning with pre-1.0 release numbers in `0.minor.patch`
format. The source of truth is the repository root [`version.json`](version.json).

- `0.2.0` means: major API stability has not been promised yet, but releases still
  follow a predictable three-part version.
- Use `python3 scripts/bump_version.py patch` for bug-fix releases such as
  `0.2.0 -> 0.2.1`.

exec
/bin/zsh -lc "nl -ba backend/app/core/rate_limit.py | sed -n '240,390p'" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
   240	)
   241	# Public shared-view endpoint — anonymous, unauthenticated. Limit per IP to prevent
   242	# token enumeration and traffic amplification. 60/min is generous for legitimate
   243	# users refreshing but blocks brute-force UUID scanning.
   244	shared_view_limiter = RedisRateLimiter(
   245	    namespace="rate_limit:shared_view", max_requests=60, window_seconds=60
   246	)
   247	# Anonymous read endpoints for demo documents (search, chunk detail). Gated
   248	# behind can_access_document so logged-in traffic bypasses this limiter.
   249	anon_read_limiter = RedisRateLimiter(
   250	    namespace="rate_limit:anon_read", max_requests=120, window_seconds=60
   251	)
   252	public_event_limiter = RedisRateLimiter(
   253	    namespace="rate_limit:public_events", max_requests=30, window_seconds=60
   254	)
   255	
   256	
   257	# Pre-encode signing secrets once at import time. hmac.new() requires bytes,
   258	# and re-encoding per-request is wasteful. Re-read at call time would re-import
   259	# settings, which is unnecessary because the process is restarted on env change.
   260	_ADAPTER_SECRET_BYTES: bytes = (settings.ADAPTER_SECRET or "").encode("utf-8")
   261	_AUTH_SECRET_BYTES: bytes = (settings.AUTH_SECRET or "").encode("utf-8")
   262	
   263	# Max clock skew accepted on the new HMAC contract. 60s covers NTP drift between
   264	# Vercel and Railway while keeping the replay window narrow. The signature is
   265	# bound to a per-request unix timestamp so deterministic-bucket replay (the bug
   266	# Codex caught in R3) is impossible.
   267	_MAX_SIGNED_IP_SKEW_S = 60
   268	
   269	
   270	def verify_signed_ip(
   271	    *,
   272	    ip: str | None,
   273	    ts: str | None,
   274	    sig: str | None,
   275	    now: float | None = None,
   276	    max_skew_s: int = _MAX_SIGNED_IP_SKEW_S,
   277	) -> tuple[bool, str | None]:
   278	    """Verify the triple-header HMAC IP claim emitted by the frontend proxy.
   279	
   280	    Contract:
   281	      X-Proxy-IP:     <ip>
   282	      X-Proxy-IP-Ts:  <unix_seconds>
   283	      X-Proxy-IP-Sig: hex(HMAC-SHA256(ADAPTER_SECRET, "{ip}:{ts}"))
   284	
   285	    Returns (ok, reason). `reason` is a short tag suitable for log fields when
   286	    `ok` is False; on success it is None.
   287	    """
   288	    if not ip or not ts or not sig:
   289	        return False, "missing_headers"
   290	    if not _ADAPTER_SECRET_BYTES:
   291	        return False, "no_adapter_secret"
   292	    try:
   293	        ts_int = int(ts)
   294	    except (TypeError, ValueError):
   295	        return False, "malformed_ts"
   296	    current = now if now is not None else time.time()
   297	    skew = abs(current - ts_int)
   298	    if skew > max_skew_s:
   299	        return False, "skew_exceeded"
   300	    expected = hmac.new(
   301	        _ADAPTER_SECRET_BYTES,
   302	        f"{ip}:{ts_int}".encode("utf-8"),
   303	        digestmod="sha256",
   304	    ).hexdigest()
   305	    if not hmac.compare_digest(expected, sig):
   306	        return False, "bad_signature"
   307	    return True, None
   308	
   309	
   310	def get_client_ip(request: "Request") -> str:
   311	    """Extract real client IP from the trusted Vercel proxy.
   312	
   313	    New contract (preferred): triple-header HMAC.
   314	      X-Proxy-IP / X-Proxy-IP-Ts / X-Proxy-IP-Sig signed with ADAPTER_SECRET.
   315	
   316	    Legacy contract (dual-accept transition window — remove 24h after rollout):
   317	      X-Real-Client-IP + X-Proxy-IP-Secret compared against AUTH_SECRET.
   318	
   319	    Falls back to request.client.host for direct access (dev/testing). Never
   320	    trust raw X-Forwarded-For.
   321	    """
   322	    # New contract — prefer this when present.
   323	    new_ip = request.headers.get("x-proxy-ip")
   324	    new_ts = request.headers.get("x-proxy-ip-ts")
   325	    new_sig = request.headers.get("x-proxy-ip-sig")
   326	    if new_ip or new_ts or new_sig:
   327	        ok, reason = verify_signed_ip(ip=new_ip, ts=new_ts, sig=new_sig)
   328	        if ok:
   329	            return new_ip.strip()  # type: ignore[union-attr]
   330	        # Compute skew for logging (best-effort; never raise).
   331	        skew_s: float | None = None
   332	        if new_ts:
   333	            try:
   334	                skew_s = abs(time.time() - int(new_ts))
   335	            except (TypeError, ValueError):
   336	                skew_s = None
   337	        logger.warning(
   338	            "proxy.signed_ip.verification_failed",
   339	            extra={
   340	                "reason": reason,
   341	                "claimed_ip": new_ip,
   342	                "skew_s": skew_s,
   343	            },
   344	        )
   345	        # Do NOT trust the claimed IP on failure. Fall through to legacy/host.
   346	
   347	    # Legacy contract — dual-accept during the rollout window. The compare uses
   348	    # AUTH_SECRET (the OLD signing secret, NOT ADAPTER_SECRET — Codex R5) and
   349	    # reads X-Real-Client-IP (the OLD trusted IP header, NOT X-Real-IP — R4).
   350	    proxied_ip = request.headers.get("x-real-client-ip")
   351	    proxy_secret = request.headers.get("x-proxy-ip-secret")
   352	    if (
   353	        proxied_ip
   354	        and proxy_secret
   355	        and _AUTH_SECRET_BYTES
   356	        and hmac.compare_digest(proxy_secret.encode("utf-8"), _AUTH_SECRET_BYTES)
   357	    ):
   358	        logger.info("proxy.signed_ip.legacy_path_used")
   359	        return proxied_ip.strip()
   360	
   361	    return request.client.host if request.client else "unknown"

codex
I’m now validating the committed test suite itself by running the new proxy-IP test module, then I’ll do a final consistency sweep for any spec-to-implementation drift before giving the ship/no-ship verdict.
exec
/bin/zsh -lc 'cd backend && python3 -m pytest tests/test_proxy_ip_verification.py -v' in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 433ms:
============================= test session starts ==============================
platform darwin -- Python 3.9.6, pytest-8.4.2, pluggy-1.6.0 -- /Applications/Xcode.app/Contents/Developer/usr/bin/python3
cachedir: .pytest_cache
rootdir: /Users/mayijie/Projects/Code/010_DocTalk/backend
configfile: pytest.ini
plugins: anyio-4.12.1, asyncio-0.24.0
asyncio: mode=strict, default_loop_scope=function
collecting ... collected 10 items

tests/test_proxy_ip_verification.py::test_valid_new_contract_passes PASSED [ 10%]
tests/test_proxy_ip_verification.py::test_skew_within_window_passes PASSED [ 20%]
tests/test_proxy_ip_verification.py::test_skew_exceeds_window_fails PASSED [ 30%]
tests/test_proxy_ip_verification.py::test_malformed_timestamp_fails PASSED [ 40%]
tests/test_proxy_ip_verification.py::test_bad_signature_fails PASSED     [ 50%]
tests/test_proxy_ip_verification.py::test_missing_headers_returns_none PASSED [ 60%]
tests/test_proxy_ip_verification.py::test_legacy_secret_with_auth_secret_passes PASSED [ 70%]
tests/test_proxy_ip_verification.py::test_legacy_secret_with_adapter_secret_fails PASSED [ 80%]
tests/test_proxy_ip_verification.py::test_legacy_returns_x_real_client_ip_not_client_host PASSED [ 90%]
tests/test_proxy_ip_verification.py::test_both_old_and_new_headers_new_path_preferred PASSED [100%]

============================== 10 passed in 0.08s ==============================

web search: 
web search: 
web search: 
web search: 
exec
/bin/zsh -lc 'rg -n "X-Proxy-IP-Secret|X-Real-Client-IP" backend frontend docs CLAUDE.md AGENTS.md README.md' in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
docs/ARCHITECTURE.zh.md:875:本次修复采用 dual-accept 过渡窗口 —— 后端同时识别新的三 header 契约和旧的 `X-Real-Client-IP` + `X-Proxy-IP-Secret`（与 `AUTH_SECRET` 比对，旧契约的签名 secret）。安全的发布顺序只有一种：
docs/ARCHITECTURE.zh.md:880:4. **24h soak window** 后，follow-up commit 删除 `get_client_ip()` 里的 legacy 分支以及双方代码中的 `X-Proxy-IP-Secret` / `X-Real-Client-IP` env 引用。
docs/ARCHITECTURE.md:979:The fix-batch ships a dual-accept transition window — backend simultaneously recognizes BOTH the new triple-header contract AND the legacy `X-Real-Client-IP` + `X-Proxy-IP-Secret` pair (compared against `AUTH_SECRET`, the OLD signing secret). This is the only safe rollout order:
docs/ARCHITECTURE.md:984:4. **24h soak window**, then a follow-up commit removes the legacy branch from `get_client_ip()` + `X-Proxy-IP-Secret` / `X-Real-Client-IP` env references from both surfaces.
backend/tests/test_proxy_ip_verification.py:5:(`X-Real-Client-IP` + `X-Proxy-IP-Secret` compared against `AUTH_SECRET`), and
backend/tests/test_proxy_ip_verification.py:125:    """Legacy contract: X-Proxy-IP-Secret compared against AUTH_SECRET."""
backend/tests/test_proxy_ip_verification.py:128:            "X-Real-Client-IP": "203.0.113.7",
backend/tests/test_proxy_ip_verification.py:129:            "X-Proxy-IP-Secret": TEST_AUTH_SECRET,
backend/tests/test_proxy_ip_verification.py:145:            "X-Real-Client-IP": "203.0.113.7",
backend/tests/test_proxy_ip_verification.py:146:            "X-Proxy-IP-Secret": TEST_ADAPTER_SECRET,  # WRONG secret for legacy
backend/tests/test_proxy_ip_verification.py:156:    """The production legacy contract is `X-Real-Client-IP`, not `X-Real-IP`.
backend/tests/test_proxy_ip_verification.py:165:            "X-Real-Client-IP": "203.0.113.42",
backend/tests/test_proxy_ip_verification.py:166:            "X-Proxy-IP-Secret": TEST_AUTH_SECRET,
backend/tests/test_proxy_ip_verification.py:183:            "X-Real-Client-IP": "203.0.113.99",
backend/tests/test_proxy_ip_verification.py:184:            "X-Proxy-IP-Secret": TEST_AUTH_SECRET,
backend/app/core/rate_limit.py:317:      X-Real-Client-IP + X-Proxy-IP-Secret compared against AUTH_SECRET.
backend/app/core/rate_limit.py:349:    # reads X-Real-Client-IP (the OLD trusted IP header, NOT X-Real-IP — R4).

web search: 
web search: 
exec
/bin/zsh -lc "nl -ba CLAUDE.md | sed -n '42,58p'; nl -ba AGENTS.md | sed -n '47,63p'; nl -ba README.md | sed -n '201,211p'" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
    42	For UI changes, also open the dev server in a browser and exercise the golden path (upload → chat → citation jump).
    43	
    44	## Deploy
    45	
    46	`main` = development → Vercel **preview** only. `stable` = production → Vercel `doctalk.site` + Railway backend.
    47	
    48	```bash
    49	git push origin main
    50	git checkout stable && git merge main && git push origin stable
    51	# Backend changes? Add this from stable:
    52	railway up --detach
    53	git checkout main
    54	```
    55	
    56	Full procedure + guardrails: see `.claude/skills/deploy/SKILL.md` (invoked via `/deploy`).
    57	
    58	## Key env vars
    47	## Deploy
    48	
    49	`main` = dev → Vercel preview. `stable` = prod → `doctalk.site` + Railway.
    50	
    51	```bash
    52	git push origin main
    53	git checkout stable && git merge main && git push origin stable
    54	# Backend changes? From stable:
    55	railway up --detach
    56	git checkout main
    57	```
    58	
    59	- Vercel root directory = `frontend/`. Never run `vercel --prod`.
    60	- Railway deploys only from `stable`. Never from `main`.
    61	- DB migrations during beta: add-only. No drops/renames.
    62	
    63	## Env vars
   201	## Deployment
   202	
   203	**Branching:** `main` (development) / `stable` (production).
   204	
   205	| Target | Method |
   206	|--------|--------|
   207	| **Frontend** (Vercel) | Push to `stable` → auto-deploys. Root directory: `frontend/`. |
   208	| **Backend** (Railway) | `git checkout stable && railway up --detach` |
   209	
   210	Railway runs 5 services: backend, PostgreSQL, Redis, Qdrant, MinIO.
   211	

exec
/bin/zsh -lc "nl -ba docs/ARCHITECTURE.md | sed -n '975,990p'; nl -ba docs/ARCHITECTURE.zh.md | sed -n '871,886p'" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
   975	Because the backend does **not** trust raw `X-Forwarded-For`, `--forwarded-allow-ips=127.0.0.1` (uvicorn default) is safe — no production env override is required.
   976	
   977	#### Deploy sequence for C1 HMAC contract (Wave-1, 2026-05-20)
   978	
   979	The fix-batch ships a dual-accept transition window — backend simultaneously recognizes BOTH the new triple-header contract AND the legacy `X-Real-Client-IP` + `X-Proxy-IP-Secret` pair (compared against `AUTH_SECRET`, the OLD signing secret). This is the only safe rollout order:
   980	
   981	1. **Railway backend first.** `git checkout stable && git merge main && railway up --detach`. Wait for `GET /health` to return 200. At this point the backend accepts both contracts; production frontend is still emitting the legacy headers, which continue to work.
   982	2. **Then push frontend to Vercel.** `git push origin stable`. Wait for the Vercel deployment to land "Ready". Frontend now emits only the new triple-header contract.
   983	3. **Watch the legacy-path log counter** in Railway logs: `grep proxy.signed_ip.legacy_path_used`. It should drop to ~0 within minutes of step 2 as Vercel completes its rolling deploy.
   984	4. **24h soak window**, then a follow-up commit removes the legacy branch from `get_client_ip()` + `X-Proxy-IP-Secret` / `X-Real-Client-IP` env references from both surfaces.
   985	
   986	Reverse order (frontend first) would 401/429-collapse all in-flight traffic because the legacy proxy header would not match the new backend verifier.
   987	
   988	### Redis degradation behavior
   989	
   990	The rate limiter and demo-message tracker both have an in-memory fallback when Redis is unreachable. When that fallback activates, `_alert_redis_fallback` logs at `error` and emits one Sentry event **per namespace per 10 minutes** (to stay within the Sentry Free 5k/month quota during prolonged outages). Counts in the in-memory fallback do NOT persist across restarts and do NOT share state across replicas — degraded consistency is the correctness trade-off.
   871	因为后端**不**信任原始 `X-Forwarded-For`，`--forwarded-allow-ips=127.0.0.1`（uvicorn 默认值）是安全的，生产无需覆盖该 env。
   872	
   873	#### C1 HMAC 契约的部署顺序（Wave-1，2026-05-20）
   874	
   875	本次修复采用 dual-accept 过渡窗口 —— 后端同时识别新的三 header 契约和旧的 `X-Real-Client-IP` + `X-Proxy-IP-Secret`（与 `AUTH_SECRET` 比对，旧契约的签名 secret）。安全的发布顺序只有一种：
   876	
   877	1. **先发 Railway 后端。** `git checkout stable && git merge main && railway up --detach`，等 `GET /health` 返回 200。此时后端两种契约都接受，生产前端仍在用旧 header，无影响。
   878	2. **然后推 Vercel 前端。** `git push origin stable`，等 Vercel 部署 "Ready"。前端切换为只发新三 header。
   879	3. **观察 legacy_path 日志计数**：Railway 日志中 `grep proxy.signed_ip.legacy_path_used`，应在 Vercel rolling deploy 完成后几分钟内降到 ~0。
   880	4. **24h soak window** 后，follow-up commit 删除 `get_client_ip()` 里的 legacy 分支以及双方代码中的 `X-Proxy-IP-Secret` / `X-Real-Client-IP` env 引用。
   881	
   882	反向顺序（前端先发）会让在途流量 401/429 全面坍塌 —— 旧 proxy header 与新后端 verifier 不匹配。
   883	
   884	### Redis 降级行为
   885	
   886	速率限制器和演示消息计数器在 Redis 不可达时都会回退到内存。降级触发时，`_alert_redis_fallback` 以 `error` 级记录日志，并**每个 namespace 每 10 分钟**最多发一次 Sentry 事件（避免持续故障打满 Sentry Free 5k/月配额）。内存 fallback 中的计数**不**跨重启持久化，也**不**跨副本共享 —— 一致性降级是该场景的正确性取舍。

web search: 
web search: 
web search: 
web search: 
web search: 
web search: 
web search: 
web search: 
codex
I found one non-code blocker: deploy instructions are inconsistent across docs and could trigger the exact rollout-order failure this patch is designed to avoid. I’m collecting precise line references now for a fix-up commit recommendation.
exec
/bin/zsh -lc "nl -ba frontend/src/app/shared/[token]/page.tsx | sed -n '28,44p'" in /Users/mayijie/Projects/Code/010_DocTalk
exec
/bin/zsh -lc "nl -ba frontend/src/app/api/proxy/[...path]/route.ts | sed -n '82,104p'" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
zsh:1: no matches found: frontend/src/app/api/proxy/[...path]/route.ts

 succeeded in 0ms:
zsh:1: no matches found: frontend/src/app/shared/[token]/page.tsx

exec
/bin/zsh -lc "nl -ba backend/tests/test_proxy_ip_verification.py | sed -n '120,190p'" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
   120	    assert get_client_ip(req) == "10.0.0.5"
   121	
   122	
   123	# 7
   124	def test_legacy_secret_with_auth_secret_passes() -> None:
   125	    """Legacy contract: X-Proxy-IP-Secret compared against AUTH_SECRET."""
   126	    req = _FakeRequest(
   127	        headers={
   128	            "X-Real-Client-IP": "203.0.113.7",
   129	            "X-Proxy-IP-Secret": TEST_AUTH_SECRET,
   130	        },
   131	        client_host="10.0.0.1",
   132	    )
   133	    assert get_client_ip(req) == "203.0.113.7"
   134	
   135	
   136	# 8 — regression guard for the Codex R5 catch
   137	def test_legacy_secret_with_adapter_secret_fails() -> None:
   138	    """If we mistakenly compared the legacy secret against ADAPTER_SECRET, the
   139	    rollout would 429-collapse all in-flight legacy requests. Guard against
   140	    re-introducing that bug. AUTH_SECRET is the legitimate legacy key.
   141	    """
   142	    assert TEST_ADAPTER_SECRET != TEST_AUTH_SECRET  # sanity
   143	    req = _FakeRequest(
   144	        headers={
   145	            "X-Real-Client-IP": "203.0.113.7",
   146	            "X-Proxy-IP-Secret": TEST_ADAPTER_SECRET,  # WRONG secret for legacy
   147	        },
   148	        client_host="10.0.0.1",
   149	    )
   150	    # Should reject the legacy claim and fall through to client.host.
   151	    assert get_client_ip(req) == "10.0.0.1"
   152	
   153	
   154	# 9 — regression guard for the Codex R4 catch
   155	def test_legacy_returns_x_real_client_ip_not_client_host() -> None:
   156	    """The production legacy contract is `X-Real-Client-IP`, not `X-Real-IP`.
   157	    If we'd read the wrong header, all traffic would collapse to Vercel egress
   158	    IPs and mass-429 legitimate users during the rollout window. Guard.
   159	    """
   160	    req = _FakeRequest(
   161	        headers={
   162	            # The OLD/WRONG header name — must NOT be trusted.
   163	            "X-Real-IP": "8.8.8.8",
   164	            # The correct legacy header.
   165	            "X-Real-Client-IP": "203.0.113.42",
   166	            "X-Proxy-IP-Secret": TEST_AUTH_SECRET,
   167	        },
   168	        client_host="10.0.0.1",
   169	    )
   170	    assert get_client_ip(req) == "203.0.113.42"
   171	
   172	
   173	# 10 — bonus: when both contracts arrive, the new path wins.
   174	def test_both_old_and_new_headers_new_path_preferred() -> None:
   175	    ts = int(time.time())
   176	    req = _FakeRequest(
   177	        headers={
   178	            # New contract — should win.
   179	            "X-Proxy-IP": "198.51.100.5",
   180	            "X-Proxy-IP-Ts": str(ts),
   181	            "X-Proxy-IP-Sig": _sign("198.51.100.5", ts),
   182	            # Legacy contract — present but should be ignored when new is valid.
   183	            "X-Real-Client-IP": "203.0.113.99",
   184	            "X-Proxy-IP-Secret": TEST_AUTH_SECRET,
   185	        },
   186	        client_host="10.0.0.1",
   187	    )
   188	    assert get_client_ip(req) == "198.51.100.5"

exec
/bin/zsh -lc "nl -ba 'frontend/src/app/shared/[token]/page.tsx' | sed -n '28,44p'" in /Users/mayijie/Projects/Code/010_DocTalk
exec
/bin/zsh -lc "nl -ba backend/app/core/rate_limit.py | sed -n '270,362p'" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
    28	
    29	  const backendHeaders: Record<string, string> = {};
    30	  // C1: triple-header HMAC contract. Backend rate-limits /api/shared/{token}
    31	  // per real visitor; this proves the IP claim came from our SSR origin and
    32	  // not a direct attacker who can set arbitrary headers. Same trust model as
    33	  // /api/proxy. Per-request timestamp + 60s skew window blocks replay.
    34	  if (clientIp && ADAPTER_SECRET) {
    35	    const ts = Math.floor(Date.now() / 1000).toString();
    36	    const sig = createHmac('sha256', ADAPTER_SECRET)
    37	      .update(`${clientIp}:${ts}`)
    38	      .digest('hex');
    39	    backendHeaders['X-Proxy-IP'] = clientIp;
    40	    backendHeaders['X-Proxy-IP-Ts'] = ts;
    41	    backendHeaders['X-Proxy-IP-Sig'] = sig;
    42	  }
    43	
    44	  try {

 succeeded in 0ms:
   270	def verify_signed_ip(
   271	    *,
   272	    ip: str | None,
   273	    ts: str | None,
   274	    sig: str | None,
   275	    now: float | None = None,
   276	    max_skew_s: int = _MAX_SIGNED_IP_SKEW_S,
   277	) -> tuple[bool, str | None]:
   278	    """Verify the triple-header HMAC IP claim emitted by the frontend proxy.
   279	
   280	    Contract:
   281	      X-Proxy-IP:     <ip>
   282	      X-Proxy-IP-Ts:  <unix_seconds>
   283	      X-Proxy-IP-Sig: hex(HMAC-SHA256(ADAPTER_SECRET, "{ip}:{ts}"))
   284	
   285	    Returns (ok, reason). `reason` is a short tag suitable for log fields when
   286	    `ok` is False; on success it is None.
   287	    """
   288	    if not ip or not ts or not sig:
   289	        return False, "missing_headers"
   290	    if not _ADAPTER_SECRET_BYTES:
   291	        return False, "no_adapter_secret"
   292	    try:
   293	        ts_int = int(ts)
   294	    except (TypeError, ValueError):
   295	        return False, "malformed_ts"
   296	    current = now if now is not None else time.time()
   297	    skew = abs(current - ts_int)
   298	    if skew > max_skew_s:
   299	        return False, "skew_exceeded"
   300	    expected = hmac.new(
   301	        _ADAPTER_SECRET_BYTES,
   302	        f"{ip}:{ts_int}".encode("utf-8"),
   303	        digestmod="sha256",
   304	    ).hexdigest()
   305	    if not hmac.compare_digest(expected, sig):
   306	        return False, "bad_signature"
   307	    return True, None
   308	
   309	
   310	def get_client_ip(request: "Request") -> str:
   311	    """Extract real client IP from the trusted Vercel proxy.
   312	
   313	    New contract (preferred): triple-header HMAC.
   314	      X-Proxy-IP / X-Proxy-IP-Ts / X-Proxy-IP-Sig signed with ADAPTER_SECRET.
   315	
   316	    Legacy contract (dual-accept transition window — remove 24h after rollout):
   317	      X-Real-Client-IP + X-Proxy-IP-Secret compared against AUTH_SECRET.
   318	
   319	    Falls back to request.client.host for direct access (dev/testing). Never
   320	    trust raw X-Forwarded-For.
   321	    """
   322	    # New contract — prefer this when present.
   323	    new_ip = request.headers.get("x-proxy-ip")
   324	    new_ts = request.headers.get("x-proxy-ip-ts")
   325	    new_sig = request.headers.get("x-proxy-ip-sig")
   326	    if new_ip or new_ts or new_sig:
   327	        ok, reason = verify_signed_ip(ip=new_ip, ts=new_ts, sig=new_sig)
   328	        if ok:
   329	            return new_ip.strip()  # type: ignore[union-attr]
   330	        # Compute skew for logging (best-effort; never raise).
   331	        skew_s: float | None = None
   332	        if new_ts:
   333	            try:
   334	                skew_s = abs(time.time() - int(new_ts))
   335	            except (TypeError, ValueError):
   336	                skew_s = None
   337	        logger.warning(
   338	            "proxy.signed_ip.verification_failed",
   339	            extra={
   340	                "reason": reason,
   341	                "claimed_ip": new_ip,
   342	                "skew_s": skew_s,
   343	            },
   344	        )
   345	        # Do NOT trust the claimed IP on failure. Fall through to legacy/host.
   346	
   347	    # Legacy contract — dual-accept during the rollout window. The compare uses
   348	    # AUTH_SECRET (the OLD signing secret, NOT ADAPTER_SECRET — Codex R5) and
   349	    # reads X-Real-Client-IP (the OLD trusted IP header, NOT X-Real-IP — R4).
   350	    proxied_ip = request.headers.get("x-real-client-ip")
   351	    proxy_secret = request.headers.get("x-proxy-ip-secret")
   352	    if (
   353	        proxied_ip
   354	        and proxy_secret
   355	        and _AUTH_SECRET_BYTES
   356	        and hmac.compare_digest(proxy_secret.encode("utf-8"), _AUTH_SECRET_BYTES)
   357	    ):
   358	        logger.info("proxy.signed_ip.legacy_path_used")
   359	        return proxied_ip.strip()
   360	
   361	    return request.client.host if request.client else "unknown"

exec
/bin/zsh -lc "nl -ba 'frontend/src/app/api/proxy/[...path]/route.ts' | sed -n '82,104p'" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
    82	  const xff = req.headers.get("x-forwarded-for");
    83	  const clientIp =
    84	    req.ip ||
    85	    (xff ? xff.split(",")[0]?.trim() : undefined) ||
    86	    req.headers.get("x-real-ip") ||
    87	    undefined;
    88	  if (clientIp && ADAPTER_SECRET) {
    89	    // C1: triple-header HMAC contract. The signature binds the IP to a
    90	    // per-request unix timestamp so an attacker who scrapes one header set
    91	    // from a log cannot replay it indefinitely. Backend accepts ±60s skew.
    92	    // Signing key is ADAPTER_SECRET (NOT AUTH_SECRET — the latter encrypts
    93	    // session JWEs and must never traverse the wire as a plaintext header).
    94	    const ts = Math.floor(Date.now() / 1000).toString();
    95	    const sig = createHmac("sha256", ADAPTER_SECRET)
    96	      .update(`${clientIp}:${ts}`)
    97	      .digest("hex");
    98	    headers.set("X-Proxy-IP", clientIp);
    99	    headers.set("X-Proxy-IP-Ts", ts);
   100	    headers.set("X-Proxy-IP-Sig", sig);
   101	  }
   102	
   103	  // Add authorization if authenticated - create a backend-compatible JWT
   104	  if (token?.sub) {

exec
/bin/zsh -lc "nl -ba frontend/src/app/trust/TrustPageClient.tsx | sed -n '78,92p'" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
    78	  {
    79	    icon: AlertTriangle,
    80	    title: "Rate limits on anonymous endpoints",
    81	    detail:
    82	      "Public endpoints (shared views, anonymous reads) have per-IP rate limits. The real client IP is forwarded from the Vercel edge to our backend with an HMAC-SHA256 signature bound to a per-request timestamp, so the backend can authenticate the proxy origin and reject header-spoofing attempts. This is not a defense against an active wire-level MITM — TLS handles that layer. Authenticated users bypass IP rate limiting.",
    83	    evidence: "backend/app/core/rate_limit.py · shared_view_limiter, anon_read_limiter",
    84	  },
    85	];
    86	
    87	const dataRightsControls: Control[] = [
    88	  {
    89	    icon: Database,
    90	    title: "Full data export",
    91	    detail:
    92	      "From your Profile → Account you can export all your documents and session data. The export includes everything DocTalk stores about you, in portable formats.",

exec
/bin/zsh -lc "nl -ba .github/workflows/ci.yml | sed -n '24,33p'" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
    24	          cache: pip
    25	          cache-dependency-path: backend/requirements-dev.txt
    26	      - run: pip install -r requirements-dev.txt
    27	      - run: python ../scripts/check_version_consistency.py
    28	      - run: ruff check app/ tests/
    29	      - run: python -m pytest tests/test_smoke.py tests/test_parse_service.py tests/test_proxy_ip_verification.py -v
    30	        env:
    31	          DATABASE_URL: postgresql+asyncpg://postgres:postgres@localhost:5432/postgres
    32	
    33	  migrations:

codex
**Findings**
1. **High: deploy-order docs are internally inconsistent for C1 and can cause rollout breakage.**  
   `CLAUDE.md` and `AGENTS.md` still tell operators to push `stable` (frontend deploy) before `railway up`, while the C1 contract requires backend-first rollout.  
   - Old order: [CLAUDE.md:48](/Users/mayijie/Projects/Code/010_DocTalk/CLAUDE.md:48), [CLAUDE.md:50](/Users/mayijie/Projects/Code/010_DocTalk/CLAUDE.md:50), [CLAUDE.md:52](/Users/mayijie/Projects/Code/010_DocTalk/CLAUDE.md:52), [AGENTS.md:52](/Users/mayijie/Projects/Code/010_DocTalk/AGENTS.md:52), [AGENTS.md:53](/Users/mayijie/Projects/Code/010_DocTalk/AGENTS.md:53), [AGENTS.md:55](/Users/mayijie/Projects/Code/010_DocTalk/AGENTS.md:55), [README.md:207](/Users/mayijie/Projects/Code/010_DocTalk/README.md:207), [README.md:208](/Users/mayijie/Projects/Code/010_DocTalk/README.md:208)  
   - Required order (correct): [docs/ARCHITECTURE.md:981](/Users/mayijie/Projects/Code/010_DocTalk/docs/ARCHITECTURE.md:981), [docs/ARCHITECTURE.md:982](/Users/mayijie/Projects/Code/010_DocTalk/docs/ARCHITECTURE.md:982), [docs/ARCHITECTURE.zh.md:877](/Users/mayijie/Projects/Code/010_DocTalk/docs/ARCHITECTURE.zh.md:877), [docs/ARCHITECTURE.zh.md:878](/Users/mayijie/Projects/Code/010_DocTalk/docs/ARCHITECTURE.zh.md:878)

**Verified OK**
- Backend verifier/dispatcher matches spec (`hmac.compare_digest`, byte handling, ±60s skew, new path first, legacy `AUTH_SECRET` + `X-Real-Client-IP`): [rate_limit.py:270](/Users/mayijie/Projects/Code/010_DocTalk/backend/app/core/rate_limit.py:270), [rate_limit.py:305](/Users/mayijie/Projects/Code/010_DocTalk/backend/app/core/rate_limit.py:305), [rate_limit.py:326](/Users/mayijie/Projects/Code/010_DocTalk/backend/app/core/rate_limit.py:326), [rate_limit.py:350](/Users/mayijie/Projects/Code/010_DocTalk/backend/app/core/rate_limit.py:350), [rate_limit.py:356](/Users/mayijie/Projects/Code/010_DocTalk/backend/app/core/rate_limit.py:356)
- Frontend HMAC generation is correct in both places: [route.ts:95](/Users/mayijie/Projects/Code/010_DocTalk/frontend/src/app/api/proxy/[...path]/route.ts:95), [route.ts:96](/Users/mayijie/Projects/Code/010_DocTalk/frontend/src/app/api/proxy/[...path]/route.ts:96), [route.ts:100](/Users/mayijie/Projects/Code/010_DocTalk/frontend/src/app/api/proxy/[...path]/route.ts:100), [page.tsx:36](/Users/mayijie/Projects/Code/010_DocTalk/frontend/src/app/shared/[token]/page.tsx:36), [page.tsx:37](/Users/mayijie/Projects/Code/010_DocTalk/frontend/src/app/shared/[token]/page.tsx:37), [page.tsx:41](/Users/mayijie/Projects/Code/010_DocTalk/frontend/src/app/shared/[token]/page.tsx:41)
- 10 pytest cases exist and include both regression guards (`AUTH` vs `ADAPTER`, `X-Real-Client-IP` behavior): [test_proxy_ip_verification.py:137](/Users/mayijie/Projects/Code/010_DocTalk/backend/tests/test_proxy_ip_verification.py:137), [test_proxy_ip_verification.py:155](/Users/mayijie/Projects/Code/010_DocTalk/backend/tests/test_proxy_ip_verification.py:155), [test_proxy_ip_verification.py:174](/Users/mayijie/Projects/Code/010_DocTalk/backend/tests/test_proxy_ip_verification.py:174); test run passed locally (`10 passed`).
- CI includes the new test: [ci.yml:29](/Users/mayijie/Projects/Code/010_DocTalk/.github/workflows/ci.yml:29)
- Trust-page wording is corrected and aligned: [TrustPageClient.tsx:82](/Users/mayijie/Projects/Code/010_DocTalk/frontend/src/app/trust/TrustPageClient.tsx:82)

Fix the deploy-order doc mismatch before prod rollout.
tokens used
70,180
**Findings**
1. **High: deploy-order docs are internally inconsistent for C1 and can cause rollout breakage.**  
   `CLAUDE.md` and `AGENTS.md` still tell operators to push `stable` (frontend deploy) before `railway up`, while the C1 contract requires backend-first rollout.  
   - Old order: [CLAUDE.md:48](/Users/mayijie/Projects/Code/010_DocTalk/CLAUDE.md:48), [CLAUDE.md:50](/Users/mayijie/Projects/Code/010_DocTalk/CLAUDE.md:50), [CLAUDE.md:52](/Users/mayijie/Projects/Code/010_DocTalk/CLAUDE.md:52), [AGENTS.md:52](/Users/mayijie/Projects/Code/010_DocTalk/AGENTS.md:52), [AGENTS.md:53](/Users/mayijie/Projects/Code/010_DocTalk/AGENTS.md:53), [AGENTS.md:55](/Users/mayijie/Projects/Code/010_DocTalk/AGENTS.md:55), [README.md:207](/Users/mayijie/Projects/Code/010_DocTalk/README.md:207), [README.md:208](/Users/mayijie/Projects/Code/010_DocTalk/README.md:208)  
   - Required order (correct): [docs/ARCHITECTURE.md:981](/Users/mayijie/Projects/Code/010_DocTalk/docs/ARCHITECTURE.md:981), [docs/ARCHITECTURE.md:982](/Users/mayijie/Projects/Code/010_DocTalk/docs/ARCHITECTURE.md:982), [docs/ARCHITECTURE.zh.md:877](/Users/mayijie/Projects/Code/010_DocTalk/docs/ARCHITECTURE.zh.md:877), [docs/ARCHITECTURE.zh.md:878](/Users/mayijie/Projects/Code/010_DocTalk/docs/ARCHITECTURE.zh.md:878)

**Verified OK**
- Backend verifier/dispatcher matches spec (`hmac.compare_digest`, byte handling, ±60s skew, new path first, legacy `AUTH_SECRET` + `X-Real-Client-IP`): [rate_limit.py:270](/Users/mayijie/Projects/Code/010_DocTalk/backend/app/core/rate_limit.py:270), [rate_limit.py:305](/Users/mayijie/Projects/Code/010_DocTalk/backend/app/core/rate_limit.py:305), [rate_limit.py:326](/Users/mayijie/Projects/Code/010_DocTalk/backend/app/core/rate_limit.py:326), [rate_limit.py:350](/Users/mayijie/Projects/Code/010_DocTalk/backend/app/core/rate_limit.py:350), [rate_limit.py:356](/Users/mayijie/Projects/Code/010_DocTalk/backend/app/core/rate_limit.py:356)
- Frontend HMAC generation is correct in both places: [route.ts:95](/Users/mayijie/Projects/Code/010_DocTalk/frontend/src/app/api/proxy/[...path]/route.ts:95), [route.ts:96](/Users/mayijie/Projects/Code/010_DocTalk/frontend/src/app/api/proxy/[...path]/route.ts:96), [route.ts:100](/Users/mayijie/Projects/Code/010_DocTalk/frontend/src/app/api/proxy/[...path]/route.ts:100), [page.tsx:36](/Users/mayijie/Projects/Code/010_DocTalk/frontend/src/app/shared/[token]/page.tsx:36), [page.tsx:37](/Users/mayijie/Projects/Code/010_DocTalk/frontend/src/app/shared/[token]/page.tsx:37), [page.tsx:41](/Users/mayijie/Projects/Code/010_DocTalk/frontend/src/app/shared/[token]/page.tsx:41)
- 10 pytest cases exist and include both regression guards (`AUTH` vs `ADAPTER`, `X-Real-Client-IP` behavior): [test_proxy_ip_verification.py:137](/Users/mayijie/Projects/Code/010_DocTalk/backend/tests/test_proxy_ip_verification.py:137), [test_proxy_ip_verification.py:155](/Users/mayijie/Projects/Code/010_DocTalk/backend/tests/test_proxy_ip_verification.py:155), [test_proxy_ip_verification.py:174](/Users/mayijie/Projects/Code/010_DocTalk/backend/tests/test_proxy_ip_verification.py:174); test run passed locally (`10 passed`).
- CI includes the new test: [ci.yml:29](/Users/mayijie/Projects/Code/010_DocTalk/.github/workflows/ci.yml:29)
- Trust-page wording is corrected and aligned: [TrustPageClient.tsx:82](/Users/mayijie/Projects/Code/010_DocTalk/frontend/src/app/trust/TrustPageClient.tsx:82)

Fix the deploy-order doc mismatch before prod rollout.
