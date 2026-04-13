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

LLM via OpenRouter — Quick=DeepSeek V3.2 · Balanced=Mistral Medium 3.1 · Thorough=Mistral Large 2512. Auth.js v5 (Google / Microsoft / email magic link). Stripe billing (test mode until live switch).

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

- **Backend** (`.env` + Railway): `DATABASE_URL`, `OPENROUTER_API_KEY`, `AUTH_SECRET`, `ADAPTER_SECRET`, `STRIPE_SECRET_KEY` (currently `sk_test_*` — swap before real selling), `STRIPE_WEBHOOK_SECRET`
- **Frontend** (Vercel): `NEXT_PUBLIC_API_BASE` (**never** localhost in prod), `AUTH_SECRET`, `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`, `MICROSOFT_CLIENT_ID` / `MICROSOFT_CLIENT_SECRET`, `RESEND_API_KEY`

Cross-origin IP trust chain is HMAC-signed with `ADAPTER_SECRET` — frontend and backend values must match.

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
