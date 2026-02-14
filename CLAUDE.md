# CLAUDE.md

## Project Overview

DocTalk — AI document Q&A web app. Upload documents (PDF/DOCX/PPTX/XLSX/TXT/MD/URL), chat with AI that cites original text with real-time highlight navigation. 11 languages.

| Component | Stack | URL |
|---|---|---|
| Frontend | Next.js 14 (App Router), Vercel | https://www.doctalk.site |
| Backend | FastAPI + Celery, Railway | https://backend-production-a62e.up.railway.app |
| Infra | PostgreSQL 16, Qdrant, MinIO, Redis | Railway (5 services) |
| GitHub | | https://github.com/Rswcf/DocTalk |

LLM via OpenRouter (Quick=DeepSeek V3.2, Balanced=Mistral Medium 3.1, Thorough=Mistral Large 2512). Auth.js v5 (Google/Microsoft OAuth + Email Magic Link). Stripe billing.

## Dev Commands

```bash
docker compose up -d                    # Infrastructure
cd backend && python3 -m uvicorn app.main:app --reload   # Backend
cd frontend && npm run dev              # Frontend
cd backend && python3 -m alembic upgrade head             # DB migration

# Celery worker (macOS MUST set fork safety variable)
cd backend && OBJC_DISABLE_INITIALIZE_FORK_SAFETY=YES python3 -m celery -A app.workers.celery_app worker --loglevel=info -Q default,parse
```

### Key Env Vars

Backend (`.env`): `DATABASE_URL`, `OPENROUTER_API_KEY`, `AUTH_SECRET`, `ADAPTER_SECRET`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`

Frontend: `NEXT_PUBLIC_API_BASE` (**never** localhost in prod), `AUTH_SECRET`, `GOOGLE_CLIENT_ID`/`SECRET`, `MICROSOFT_CLIENT_ID`/`SECRET`, `RESEND_API_KEY`

## Deployment — Two-Branch Workflow

`main` = development, `stable` = production. Vercel production branch = `stable`.

```bash
git push origin main                                      # Preview only
git checkout stable && git merge main && git push origin stable  # → Vercel prod
git checkout stable && railway up --detach                 # → Railway (if backend changed)
git checkout main
```

- **Vercel**: Root Directory = `frontend/`. Never run `vercel --prod`.
- **Railway**: `railway up --detach` from `stable`. Never deploy from `main`.
- **DB migrations during beta**: Backward-compatible only (add-only). Never drop/rename columns.

## Testing

```bash
cd backend && python3 -m pytest tests/test_smoke.py -v     # Smoke (needs docker compose)
cd backend && python3 -m pytest tests/test_parse_service.py -v  # Unit (no deps)
cd backend && python3 -m pytest -m integration -v           # Integration
cd backend && python3 -m ruff check app/ tests/             # Lint
```

CI: GitHub Actions — backend (ruff + pytest), frontend (eslint + next build), docker (build check).

## Conventions

Path-scoped rules are in `.claude/rules/`:
- `backend.md` — async safety, credits, parse worker, auth, demo system
- `frontend.md` — API proxy, UI palette, i18n, react-pdf, subscriptions

### Universal Rules
- Don't start multiple dev server processes; check for running servers first
- "更新文档" means ALL affected docs — grep `*.md` for affected keywords:
  - `README.md` ↔ `README.zh.md` must stay in sync
  - `docs/ARCHITECTURE.md` / `docs/ARCHITECTURE.zh.md`
  - `docs/PRODUCT_STRATEGY.md`

## Codex Collaboration

```bash
codex exec --full-auto -m gpt-5.3-codex \
  -C /Users/mayijie/Projects/Code/010_DocTalk \
  -o <output-file> "<prompt>"
```

- When user asks to implement changes, delegate to Codex unless told otherwise
- Model name is **`gpt-5.3-codex`** (not `gpt-5.3`)
- Codex sandbox cannot do git — handle git in Claude
- Collaboration files: `.collab/{plans,reviews,tasks,archive}/`
