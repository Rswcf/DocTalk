# Beta Testing Engineering Plan

## Problem Statement

3-5 real users will test the production site (doctalk.site). Development of new features must continue without breaking the experience for testers. Current setup has no environment isolation — every push to `main` auto-deploys to production via Vercel.

## Strategy: Stable Branch + Preview Development

```
main (development) ──push──→ Vercel Preview URLs (dev testing)
                                    │
                    cherry-pick / merge when ready
                                    │
                                    ▼
stable (production) ──push──→ Vercel Production (doctalk.site)
                     ──manual──→ Railway Backend
```

**Core principle**: Testers see only **explicitly promoted** code. Development continues freely on `main`.

---

## Phase 1: Git Branch Setup

### 1.1 Create `stable` branch
```bash
git checkout main
git checkout -b stable
git push -u origin stable
```

### 1.2 Change Vercel production branch
- Vercel Dashboard → Project Settings → Git → Production Branch
- Change from `main` → `stable`
- After this: pushes to `main` create **Preview Deployments** (non-production URLs)
- Pushes to `stable` deploy to **production** (doctalk.site)

### 1.3 Railway stays manual
- Railway deployment is already manual (`railway up --detach`)
- When promoting to stable: checkout stable, then deploy
- No config change needed

---

## Phase 2: Daily Development Workflow

### For the developer (you):

```
1. Work on main (or feature branches)
   └── git push → CI runs → Vercel Preview URL generated
   └── Test on preview URL

2. When feature is ready for testers:
   └── git checkout stable
   └── git merge main  (or cherry-pick specific commits)
   └── git push origin stable → Vercel auto-deploys to doctalk.site

3. If backend changes included:
   └── (still on stable branch)
   └── railway up --detach → Backend redeploys
   └── git checkout main → Continue development
```

### Quick hotfix for testers:
```
1. Fix on main first
2. Cherry-pick to stable: git checkout stable && git cherry-pick <sha>
3. Push stable → auto-deploy
4. If backend: railway up --detach
```

---

## Phase 3: Database Migration Safety (CRITICAL)

**Shared database** = most dangerous part. Both `main` and `stable` run migrations on the same Postgres.

### Rules during beta testing period:

| ✅ Safe | ❌ Dangerous |
|---------|-------------|
| ADD new column (with default) | DROP/RENAME column |
| ADD new table | ALTER column type |
| ADD new index | DELETE rows in existing tables |
| ADD nullable column | Remove enum values |

### Migration protocol:
1. **All migrations must be backward-compatible** — stable code must work with new schema
2. Write migration on `main`, test locally
3. Before merging to `stable`: verify stable code still works with the new schema
4. **Never deploy backend from `main` to production** — only from `stable`
5. If you need a breaking migration: do it in 2 steps
   - Step 1: Add new column (deploy to both)
   - Step 2: Backfill data, update code (deploy together)
   - Step 3: (After stable catches up) Remove old column

### Pre-merge checklist:
```bash
# On main, after writing migration:
git stash  # save current work
git checkout stable
python3 -m alembic upgrade head  # run the new migration
python3 -m pytest tests/  # verify stable code still passes
git checkout main
git stash pop
```

---

## Phase 4: API Backward Compatibility

Since frontend (Vercel) and backend (Railway) deploy independently:

### Rules:
1. **Never remove an API field** — only add new ones
2. **Never change response structure** — add new fields alongside old
3. **New endpoints are fine** — stable code won't call them
4. **If changing an endpoint signature**: version it or keep both old/new working
5. **Frontend changes that need new backend**: deploy backend first, then frontend

### Example — adding a new field:
```python
# ✅ Safe: add optional field with default
class DocumentBrief(BaseModel):
    id: UUID
    filename: str
    new_field: Optional[str] = None  # stable frontend ignores this

# ❌ Dangerous: rename field
class DocumentBrief(BaseModel):
    id: UUID
    file_name: str  # breaks stable frontend expecting "filename"
```

---

## Phase 5: Release Cadence

### Recommended schedule:
- **Daily**: Develop on main, push freely, test via Vercel Preview URLs
- **Weekly** (or when milestone ready): Merge main → stable, deploy to production
- **Hotfix**: Cherry-pick immediately to stable when tester reports a bug

### Pre-release checklist (before merging to stable):
- [ ] CI passes on main
- [ ] Manual smoke test on Vercel Preview URL
- [ ] No pending breaking migrations
- [ ] Backend + frontend changes are compatible
- [ ] `alembic history` chain is valid

### Release script (helper):
```bash
#!/bin/bash
# release.sh — promote main to stable
set -e

echo "=== Pre-flight checks ==="
git checkout main
git pull origin main

echo "=== Running tests ==="
cd backend && python3 -m pytest tests/test_smoke.py tests/test_parse_service.py -v
cd ../frontend && npm run build

echo "=== Merging to stable ==="
git checkout stable
git pull origin stable
git merge main --no-ff -m "release: promote main to stable $(date +%Y-%m-%d)"
git push origin stable

echo "=== Frontend auto-deploying via Vercel ==="
echo "=== Deploy backend? (y/n) ==="
read -r answer
if [ "$answer" = "y" ]; then
    railway up --detach
fi

git checkout main
echo "=== Done! ==="
```

---

## Phase 6: Data Isolation — Recommendation

### Recommendation: NO data isolation needed

Reasons:
1. **user_id separation already works** — cross-user visibility bug was fixed (commit `cdd93a2`)
2. **Only 3-5 testers** — manageable scale
3. **No sensitive data concerns** — it's their own uploaded documents
4. **Separate DB adds complexity** — different Railway instance, env vars, cost
5. **Demo docs already shared** via `demo_slug` mechanism

### What to do instead:
- Give testers **real accounts** (Google OAuth or email magic link)
- Their data is naturally isolated by `user_id`
- Grant them **Plus or Pro plan** manually in DB for full feature testing:
  ```sql
  UPDATE users SET plan = 'plus', monthly_credits = 3000 WHERE email = 'tester@example.com';
  ```
- Or create a simple admin endpoint/script to upgrade test users

---

## Phase 7: Monitoring & Feedback

### Error tracking (already in place):
- Sentry integration on frontend (already configured in next.config.mjs)
- Backend logs on Railway

### Feedback collection (lightweight for 3-5 people):
- **WeChat/chat group** — direct informal feedback
- No need for in-app feedback widget at this scale
- Consider a shared doc/spreadsheet for bug tracking if needed

### Tester onboarding:
1. Send them the URL: `www.doctalk.site`
2. Ask them to sign up with Google or email
3. Manually upgrade their plan in DB
4. Share a brief "what to test" guide (upload doc, chat, try different modes, etc.)

---

## Implementation Steps

1. **Create `stable` branch** from current main — 1 min
2. **Change Vercel production branch** to `stable` — 2 min (Dashboard setting)
3. **Create `release.sh` helper script** — optional convenience
4. **Manually upgrade tester accounts** after they sign up — 1 min per user
5. **Brief testers** on what to test — async

### What NOT to do:
- ❌ Don't set up a separate staging environment (overkill for 3-5 people)
- ❌ Don't add feature flags (adds code complexity for temporary need)
- ❌ Don't create a separate database (unnecessary isolation overhead)
- ❌ Don't build an in-app feedback system (WeChat is fine for 3-5 people)
- ❌ Don't create invite codes or waitlist (just share the URL + upgrade manually)

---

## Risk Matrix

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Breaking migration on shared DB | Medium | High | Backward-compatible migrations only |
| Forgot to merge fix to stable | Medium | Low | Weekly release cadence |
| Backend/frontend version mismatch | Low | Medium | Deploy backend before frontend for breaking changes |
| Tester finds critical bug | Medium | Low | Cherry-pick hotfix to stable |
| Vercel branch switch breaks routing | Low | High | Test immediately after switching |

---

## Summary

**Total setup time: ~15 minutes.** The plan adds minimal overhead:
- One extra `git merge` + `git push` per release
- One optional `railway up --detach` if backend changed
- No new infrastructure, no new code, no new tools
