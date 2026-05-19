   110	    const responseHeaders = new Headers();

web search: 
web search: 
web search: 
web search: 
codex
No lock yet. **R4 needed** on a small set.

1. `C1` spec itself is sound for this threat model.
- `ip:ts` + HMAC + `hmac.compare_digest` + `max_skew_s=60` is the correct hardening over window-bucket signing.
- In-window replay remains possible by design, but that is acceptable for IP attribution/rate-limit trust (not an auth primitive).

2. Secret choice: `ADAPTER_SECRET` now is the right call.
- Given current contract and existing usage, reusing `ADAPTER_SECRET` is acceptable in Wave 1.
- Keep the explicit TODO to split to `PROXY_IP_SECRET` later if blast-radius reduction becomes priority.

3. Doc-drift scope is not fully sufficient yet.
- If `CLAUDE.md` is updated, `AGENTS.md` must be updated in lockstep per mirror rule: [AGENTS.md:3](/Users/mayijie/Projects/Code/010_DocTalk/AGENTS.md:3), [AGENTS.md:105](/Users/mayijie/Projects/Code/010_DocTalk/AGENTS.md:105).
- Frontend env list should explicitly include `ADAPTER_SECRET` wherever this trust-chain contract is documented: [CLAUDE.md:61](/Users/mayijie/Projects/Code/010_DocTalk/CLAUDE.md:61), [AGENTS.md:66](/Users/mayijie/Projects/Code/010_DocTalk/AGENTS.md:66).

4. Still missing from Wave 1 (operationally important).
- Add rollout compatibility for staggered deploys: temporary dual-accept old/new header contract in backend (or strict deploy order), otherwise fallback in [rate_limit.py:273](/Users/mayijie/Projects/Code/010_DocTalk/backend/app/core/rate_limit.py:273) can collapse many users onto egress IP and spike false 429s.
- Add focused tests for signed-IP verification path in [rate_limit.py:257](/Users/mayijie/Projects/Code/010_DocTalk/backend/app/core/rate_limit.py:257) (valid, skew, malformed ts, bad sig, fallback path).
tokens used
51,143
