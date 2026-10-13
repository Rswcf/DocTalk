# Codex adversarial review, round 1 (gpt-5.5)

Range: `8442a92e..97d3b544` (`74928e53` UA, `4f56fd9f` storage keepalive, `97d3b544` slide bullets).

Resolution:
- #1 fixed in `a9db3e1d`: a bullet is only a text item that holds nothing but marker glyphs, and both gates use that one rule. Codex's counterexample is now a test.
- #2 fixed in `8bb804eb`: the comment and the rule now say that urllib3 does not retry POSTs. The same commit adds the 120 s transfer read timeout that Codex recommended as defence in depth.

---

VERDICT: BLOCK

1. P1, issue 3, `frontend/src/lib/convertedEvidence.ts:40`: `–` is not safe in `LIST_MARKERS`. A converted page containing only `Revenue rose – sharply in 2025.` will pass `uniqueInPageRange` for focus text `Revenue rose sharply in 2025.`, because masking plus `squeeze` removes the dash. Then `PageWithHighlights.tsx:110` can render `exact` even though the exact focus is not present. Spaced ranges like `12 – 14` have the same problem. Fix: remove en dash from `LIST_MARKERS`, or mask it only with a stricter list-position/geometry rule and make the uniqueness index use the same rule.

2. P2, issue 2, `backend/app/services/storage_service.py:28` and `.claude/rules/backend.md:10`: the mechanism claim is too broad. urllib3 retries read errors only for default allowed methods: GET/HEAD/PUT/etc., not POST. minio-py multipart create and complete are POST, while parts are PUT. So a `TCP_USER_TIMEOUT` abort during multipart create/complete is not retried by urllib3. Fix the rule/comment/test wording. Do not set `allowed_methods=None` unless you add explicit idempotency handling for multipart POST.

Verified sound: issue 1 keeps DNS pinning, Host/SNI, per-hop validation, redirect guard, and size caps intact. The new Wikimedia UA is acceptable: the current policy allows omitted non-applicable parts and warns against browser impersonation (https://foundation.wikimedia.org/wiki/Policy:Wikimedia_Foundation_User-Agent_Policy).

Verified sound: transfer pool construction matches minio-py 7.2.20's default pool apart from socket options. Keepalive plus `TCP_USER_TIMEOUT` is directionally right for the production GET stall. I recommend also shortening transfer read timeout to about 120s as defense in depth; trade-off is a slow-but-alive response with no bytes for 120s would fail.

I attempted the targeted backend pytest run here. 53/54 passed; the remaining test failed before exercising code because this sandbox denies binding `127.0.0.1`.
