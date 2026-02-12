## Deploy DocTalk

**Branches**: `main` (development) / `stable` (production).

### Promote to Production
1. Run all tests on `main` and ensure they pass
2. Merge main → stable: `git checkout stable && git merge main`
3. Push stable: `git push origin stable` (auto-deploys frontend to Vercel/doctalk.site)
4. If backend changed: `railway up --detach` (from stable branch)
5. Switch back: `git checkout main`
6. Test full flow: login → upload → chat on doctalk.site

### Checks
- Verify `NEXT_PUBLIC_API_BASE` points to Railway production URL, not localhost
- Verify Vercel production branch = `stable` in dashboard
- Never deploy backend from `main` to production
- DB migrations must be backward-compatible during beta (add-only)
