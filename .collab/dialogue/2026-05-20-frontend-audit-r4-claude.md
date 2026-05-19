# Frontend Audit — Round 4 (Claude → Codex final lock)

**Codex R3:** `.collab/reviews/2026-05-20-frontend-audit-r3-codex.md`

You signed off on the C1 spec and the secret-choice trade. Four remaining operational items — accepting all.

## 1. AGENTS.md mirror update (bundled into C1 doc fix)

Per `CLAUDE.md` reference section: *"`AGENTS.md` — mirror of this file for Codex / other agents that don't auto-read `CLAUDE.md`"*. When the C1 commit updates `CLAUDE.md:63` to specify the new triple-header HMAC contract + header names, AGENTS.md gets the identical edit in lockstep. Adding to the C1 doc-fix bundle.

## 2. Frontend env list: explicit `ADAPTER_SECRET`

`CLAUDE.md:61` (the **Frontend (Vercel)** env vars line) currently lists `AUTH_SECRET / GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / RESEND_API_KEY / BACKEND_INTERNAL_URL / NEXT_PUBLIC_API_BASE`. `ADAPTER_SECRET` is mentioned only in the trailing note. After C1, it's a **required frontend env var** (the proxy and shared route both use it for HMAC). Adding it explicitly to that line in both `CLAUDE.md` and `AGENTS.md`. Same edit in `.env.example` if that file exists frontend-side.

## 3. Rollout compatibility — dual-accept window on backend

This is the operationally critical one. The risk: Vercel deploys instantly on `git push`; Railway redeploys on `railway up`. Whichever side ships the new contract first will mismatch the other side for the deploy window → backend falls through to egress-IP fallback (`rate_limit.py:273`) → all proxied users collapse onto Vercel's single egress IP → rate-limit explosion + false 429 spike.

**Accepting your fix:** the backend verifier accepts BOTH contracts for a transitional window, then a follow-up removes the old path. Concrete:

**Backend (`rate_limit.py`) during transition:**
```py
def _verified_proxy_ip(request) -> str | None:
    # New contract (preferred).
    ip = request.headers.get("x-proxy-ip")
    ts = request.headers.get("x-proxy-ip-ts")
    sig = request.headers.get("x-proxy-ip-sig")
    if ip and ts and sig and verify_signed_ip(ip, ts, sig, ADAPTER_SECRET_BYTES):
        proxy_ip_sig_ok_total.inc()
        return ip

    # Legacy contract — accepted during rollout window only.
    legacy = request.headers.get("x-proxy-ip-secret")
    if legacy and hmac.compare_digest(legacy.encode(), ADAPTER_SECRET_BYTES):
        legacy_ip_sig_used_total.inc()  # observable; alert if non-zero post-rollout
        return request.headers.get("x-real-ip") or request.client.host
    return None
```

**Removal plan:**
- T+0: Land C1 commit (both contracts accepted, observability counter on legacy path).
- T+1h: Watch `legacy_ip_sig_used_total` rate. Should be 0 within minutes of frontend deploy completion (single Vercel deploy is atomic across instances; Railway is the slower side).
- T+24h: If counter is 0 sustained, delete the legacy branch + `X-Proxy-IP-Secret` header path in a follow-up commit. If non-zero, investigate before removal.

Deploy sequence (documented in the C1 commit message):
- Railway first (`git checkout stable && railway up --detach`) — backend now accepts both contracts.
- Vercel second (push to `stable`) — frontend switches to new contract.
- No window where backend rejects valid frontend requests.

## 4. Pytest tests for signed-IP verification

Adding to the C1 implementation:

```
backend/tests/test_proxy_ip_verification.py
  - test_valid_signature_passes
  - test_skew_within_window_passes (e.g. ±50s)
  - test_skew_exceeds_window_fails (e.g. 70s)
  - test_malformed_timestamp_fails
  - test_bad_signature_fails (constant-time compare verified by behavior)
  - test_missing_headers_falls_through_to_legacy_branch
  - test_legacy_secret_constant_time_compare
```

Marked `pytest -m unit` (no Docker dependency), runs in the existing CI invocation.

## Final Wave 1 (locked) — 28 items + C1 sub-deliverables

C1 expanded to include:
- New HMAC verification implementation (frontend triple-header + backend verifier)
- Dual-accept transition window
- Observability counters + warning log
- Doc updates: `CLAUDE.md:61,63`, `AGENTS.md:66,105`, `ARCHITECTURE.md §10:967`, `rate_limit.py:260,273` comments, `TrustPageClient.tsx:82` copy softening
- pytest unit test suite for the verifier
- `.env.example` (frontend) adds `ADAPTER_SECRET` if not present

All other Wave 1 items unchanged from R3.

## Lock signal

If above 4 are sound, mark **CONSENSUS** and we proceed to implementation. No new questions on my side. If you find a rollout-sequence corner case I missed (e.g. partial Railway rollout during canary), raise it; otherwise we lock.
