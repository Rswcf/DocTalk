---
id: B-03-D01-01
matrix: B
agent: claude
cell_id: B-03-D01
row_key: ip_trust_chain
column_key: bypass
finding_key: proxy_ip_bypass_collapses_to_lb_ip
severity: P1
confidence: high
status: risk
invariant_state: partial
files:
  - "backend/app/core/rate_limit.py:254"
  - "backend/app/core/rate_limit.py:269"
exploit_preconditions:
  - "request reaches backend without X-Real-Client-IP header OR without valid X-Proxy-IP-Secret"
  - "backend runs behind a shared load balancer (Railway default)"
---

## Observation
`get_client_ip` (`rate_limit.py:254-270`) trusts `X-Real-Client-IP` only when accompanied by a valid `X-Proxy-IP-Secret` HMAC (matching `settings.AUTH_SECRET`). When the HMAC fails or headers are missing, it falls back to `request.client.host` — which on Railway is the load-balancer / platform proxy IP, **the same for all requests**.

All per-IP rate limits (`demo_chat_limiter` 10/min, `demo_message_tracker` 5 msgs, `demo_session_create_limiter` 5/5min, `shared_view_limiter` 60/min, `anon_read_limiter` 120/min) key off this IP. If any request path reaches the backend WITHOUT the frontend proxy setting `X-Real-Client-IP`+`X-Proxy-IP-Secret`, every such request shares the same bucket.

## Impact
Two scenarios expose this:

1. **Direct backend access**: `backend-production-a62e.up.railway.app` is internet-reachable. An attacker hitting it directly (bypassing `www.doctalk.site/api/proxy`) will:
   - Have their IP = Railway LB IP (not their real IP)
   - Share a rate bucket with all other direct-access clients
   - Fill the bucket = DoS the demo plane for everyone else going direct
   
2. **Frontend proxy misconfiguration**: If Vercel env vars `AUTH_SECRET` ≠ Railway `AUTH_SECRET` (common during deploys / rotation), the HMAC fails and every legit user shows up as the shared LB IP. Result: demo users rate-limit each other across sessions.

The invariant "per-IP rate limits isolate attackers" is thus **partial** — it only holds when the proxy path is used AND secrets are coherent.

## Repro / Evidence
```bash
# Skip frontend entirely
for i in {1..20}; do
  curl -X POST "https://backend-production-a62e.up.railway.app/api/documents/<demo_doc>/sessions" \
    -H "Content-Type: application/json" -d '{}'
done
# Observe: requests 11+ are rate-limited, affecting all other direct callers.
```

## Suggested Fix
Several options, in order of preference:

1. **Refuse direct backend access for rate-limited routes**: if `X-Proxy-IP-Secret` is missing on routes that touch `demo_*` or `shared_view_*` limiters, return 403. Codifies "you must go through the frontend proxy".
2. **Bind backend to non-public interface**: configure Railway to expose backend only to the Vercel proxy (private network). Removes the attack vector entirely.
3. **Add `X-Forwarded-For` parsing as defense-in-depth**: validate it against a known-Vercel CIDR allowlist; fall back to `request.client.host` only when both custom headers AND XFF fail validation.

Option 2 is the architecturally correct fix and matches the design intent of "frontend-only public surface".
