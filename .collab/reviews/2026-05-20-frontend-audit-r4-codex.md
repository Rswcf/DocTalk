web search: 
web search: 
codex
Not ready to lock yet.

1. Dual-accept window: **one contract mismatch bug remains**
- In current production contract, frontend sends `X-Real-Client-IP` (see [route.ts](/Users/mayijie/Projects/Code/010_DocTalk/frontend/src/app/api/proxy/[...path]/route.ts:79), [page.tsx](/Users/mayijie/Projects/Code/010_DocTalk/frontend/src/app/shared/[token]/page.tsx:31)) and backend reads `x-real-client-ip` (see [rate_limit.py](/Users/mayijie/Projects/Code/010_DocTalk/backend/app/core/rate_limit.py:264)).
- R4 legacy snippet returns `request.headers.get("x-real-ip")`, which is a different header and can drop to `request.client.host` during transition, recreating the false-429 collapse risk.
- Fix: legacy branch must read old trusted header (`x-real-client-ip`) exactly.

2. Pytest list: **good base, not complete operationally**
- Add at least:
  1. `both old+new headers present -> new path is preferred`
  2. `legacy success returns x-real-client-ip (not request.client.host)`
- Also operational gap: CI currently runs only `tests/test_smoke.py` + `tests/test_parse_service.py` in backend job (see [ci.yml](/Users/mayijie/Projects/Code/010_DocTalk/.github/workflows/ci.yml:29)). New verifier tests will not run unless CI command is expanded.

3. Final operational hazard
- Deploy sequencing note should explicitly require: **wait for Railway deploy healthy on new build before frontend cutover** (or rely on dual-accept and tolerate mixed-version window). Without that, partial Railway rollout can still produce transient mismatch.

After those are tightened, I’m comfortable giving `CONSENSUS`.
tokens used
