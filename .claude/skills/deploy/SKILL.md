## Deploy DocTalk

**Branches**: `main` (development) / `stable` (production).

### Promote to Production — BACKEND FIRST (mandatory post-C1, 2026-05-20)

The HMAC IP-trust contract (see `docs/ARCHITECTURE.md §10`) requires the
backend to be live BEFORE the frontend deploys. Pushing `stable` triggers
Vercel auto-deploy, so `railway up` must run and be health-verified FIRST.

1. Run all tests on `main` and ensure they pass
   (`cd frontend && npm run build`; `cd backend && python3 -m ruff check app/ tests/ && python3 -m pytest -m "not integration"`)
2. Merge main → stable: `git checkout stable && git merge main` — but do **NOT** push yet
3. Deploy backend: `railway up --detach` (from `stable` branch)
4. **WAIT** until the new backend is live:
   `curl -fsS https://backend-production-a62e.up.railway.app/health`
   must report the NEW version before proceeding
5. NOW push: `git push origin stable` (auto-deploys frontend to Vercel/doctalk.site)
6. Wait for the Vercel deployment to show "Ready"
7. Switch back: `git checkout main`
8. Test full flow: login → upload → chat → citation jump on doctalk.site

### Checks
- Version bump = 3 files + changelogs: `version.json`, `frontend/package.json`,
  `frontend/package-lock.json` (2 places), `CHANGELOG.md`, `CHANGELOG.zh.md`;
  verify with `python3 scripts/check_version_consistency.py`
- Verify `NEXT_PUBLIC_API_BASE` points to Railway production URL, not localhost
- Verify Vercel production branch = `stable` in dashboard
- Never deploy backend from `main` to production
- Never push `stable` before the Railway `/health` check confirms the new backend
- DB migrations must be backward-compatible during beta (add-only)
- Railway CLI must be logged into the project-owning account (`yijiema123@icloud.com`)
