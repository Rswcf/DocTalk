# CLAUDE.md

This file provides guidance to Claude Code when working with this repository. Keep it concise — only include what can't be inferred from reading the code.

## Workflow Protocol

When user asks to implement a plan or make code changes, ALWAYS delegate execution to Codex (`gpt-5.3-codex`) unless explicitly told otherwise. Claude's role is **architect/reviewer**, Codex's role is **implementer**. Use `codex exec --full-auto` for non-interactive execution.

---

## Project Overview

DocTalk — AI document Q&A web app. Users upload documents (PDF/DOCX/PPTX/XLSX/TXT/MD/URL), chat with AI that cites original text with real-time highlight navigation. 11 languages (EN, ZH, ES, JA, DE, FR, KO, PT, IT, AR, HI).

| Component | URL |
|---|---|
| **Frontend** (Vercel) | https://doctalk-liard.vercel.app |
| **Backend** (Railway) | https://backend-production-a62e.up.railway.app |
| **GitHub** | https://github.com/Rswcf/DocTalk |

**Stack**: Next.js 14 (App Router) + FastAPI + Celery + PostgreSQL 16 + Qdrant + MinIO + Redis + Stripe. Auth.js v5 (Google/Microsoft OAuth + Email Magic Link). LLM via OpenRouter (3 modes: Quick=DeepSeek V3.2, Balanced=Mistral Medium 3.1, Thorough=Mistral Large 2512). Embedding: `openai/text-embedding-3-small` (dim=1536). Railway has 5 services: backend, Postgres, Redis, qdrant-v2, minio-v2.

---

## Dev Commands

```bash
docker compose up -d                    # Infrastructure (Postgres, Qdrant, Redis, MinIO)
cd backend && python3 -m uvicorn app.main:app --reload   # Backend
cd frontend && npm run dev              # Frontend
cd backend && python3 -m alembic upgrade head             # DB migration

# Celery worker (macOS MUST set fork safety variable)
cd backend && OBJC_DISABLE_INITIALIZE_FORK_SAFETY=YES python3 -m celery -A app.workers.celery_app worker --loglevel=info -Q default,parse
```

Production: `entrypoint.sh` orchestrates Alembic → Celery worker (background, concurrency=2) → uvicorn (foreground). SIGTERM graceful shutdown.

### Key Env Vars

Backend loads from `.env` (root or `backend/`):
```bash
DATABASE_URL=postgresql+asyncpg://...   # Required
OPENROUTER_API_KEY=sk-or-...            # Required
AUTH_SECRET=<random>                     # Required (must match frontend)
ADAPTER_SECRET=<random>                  # Required
STRIPE_SECRET_KEY=sk_...                 # Optional
STRIPE_WEBHOOK_SECRET=whsec_...          # Optional
```

Frontend: `NEXT_PUBLIC_API_BASE` (backend URL, **never** localhost in prod), `AUTH_SECRET`, `GOOGLE_CLIENT_ID`/`SECRET`, `MICROSOFT_CLIENT_ID`/`SECRET`, `RESEND_API_KEY`.

### Deployment

**Vercel** (frontend): Deploy via `git push` (GitHub auto-deploy). Root Directory = `frontend/` in Dashboard. **Never** run `vercel --prod` from `frontend/`. `NEXT_PUBLIC_API_BASE` must point to Railway prod URL.

**Railway** (backend): `railway up --detach` from project root. Container runs as non-root `app` (UID 1001). Dockerfile includes LibreOffice headless + CJK fonts for PPTX/DOCX→PDF conversion. `HOME=/home/app` required for LibreOffice.

---

## Critical Conventions (Bug Prevention)

### Auth & API Proxy
- **ALL** frontend→backend calls go through `/api/proxy/*` route, which injects JWT. Including SSE chat stream (`sse.ts`). Missing this = 401 errors
- **JWT double-layer**: Auth.js uses encrypted JWE (unreadable by backend). Proxy creates plain HS256 JWT via `jose`. Backend `deps.py` validates exp/iat/sub
- Internal Auth Adapter API uses `X-Adapter-Secret` header
- `allowDangerousEmailAccountLinking: true` enables cross-provider auto-linking by email

### Backend
- **MinIO calls MUST use `asyncio.to_thread()`** in async endpoints. MinIO client is sync (urllib3). Direct calls block event loop; when MinIO is unreachable, blocks ALL requests for 30+s. Client configured with short timeouts (connect=5s, read=10s, 2 retries)
- **Celery uses sync DB** (`psycopg`), API uses async (`asyncpg`)
- **Credits two-stage debit**: ① Pre-check balance (402 if insufficient) → ② `debit_credits()` pre-debits estimated cost (returns ledger ID) → stream → `reconcile_credits()` UPDATEs same ledger entry to actual cost. Single ledger record per chat. LLM failure → DELETE entry + full refund
- **`ChatRequest` exposes only `mode` field** (quick/balanced/thorough). `model` field removed — prevents billing bypass
- **Parse worker**: `time_limit=600`, `soft_time_limit=540`, `autoretry_for=(Exception,)`, max 2 retries, 60s backoff. Idempotent (deletes existing pages/chunks on re-run)
- **`FOR UPDATE` lock** on verification tokens to prevent TOCTOU
- Error responses use `HTTPException` (not `JSONResponse`) for all non-SSE endpoints
- Lifespan pattern (`@asynccontextmanager`) instead of deprecated `@app.on_event`

### Frontend
- **All pages are `"use client"`** — no SSR
- **UI palette**: zinc monochrome + indigo accent (`#4f46e5`/`#818cf8`). Zero `gray-*`/`blue-*` classes (except Google OAuth brand + status colors). Zero `transition-all` (use specific properties)
- **i18n**: Components using `t()` MUST be inside `<LocaleProvider>`. Outside = raw key fallback. Only `en` is statically loaded; other 10 locales lazy-loaded
- **react-pdf v9 CJK**: After upgrading react-pdf/pdfjs-dist, MUST re-copy `cmaps/`, `standard_fonts/`, `pdf.worker.min.mjs` to `public/`. Worker loaded from same-origin (not CDN) for CSP compliance
- **Proxy maxDuration**: `route.ts` exports `maxDuration = 60` (Vercel Hobby limit). SSE chat 60s timeout, others 30s
- **bbox coordinates**: Normalized [0,1], top-left origin. Three citation highlight strategies: ① PDF bbox, ② TextViewer text-snippet match, ③ converted PDF fallback to text-snippet when dummy bbox detected
- **Dropdown keyboard nav**: All dropdowns use shared `useDropdownKeyboard` hook (Arrow/Home/End/Escape)

### Subscriptions & Pricing
- Free (500/mo) + Plus (3K/mo, $9.99) + Pro (9K/mo, $19.99). Annual = 20% discount
- Thorough mode: Plus+ only. Export: Plus+ (frontend gated). Custom Instructions: Pro (backend gated). Sessions: Free=3/doc (backend gated)
- Credit packs: Boost(500/$3.99), Power(2K/$9.99), Ultra(5K/$19.99)
- Stripe webhook: `checkout.session.completed` for subscriptions only updates plan (no credits); `invoice.payment_succeeded` grants monthly credits (idempotent by invoice.id)

### Demo System
- 3 seed PDFs auto-deployed at startup from `backend/seed_data/`. Self-healing: detects Qdrant data loss → full re-seed
- Anonymous: 5 msgs/session, 500 sessions/doc, 10 req/min/IP, forced DeepSeek V3.2 (hides ModeSelector)
- Logged-in users accessing demo docs use their credits with no message limit

---

## Testing

```bash
cd backend && python3 -m pytest tests/test_smoke.py -v     # Smoke (needs docker compose)
cd backend && python3 -m pytest tests/test_parse_service.py -v  # Unit (no deps)
cd backend && python3 -m pytest -m integration -v           # Integration
cd backend && python3 -m ruff check app/ tests/             # Lint
```

CI: GitHub Actions — backend (ruff + pytest), frontend (eslint + next build), docker (build check).

---

## Doc Maintenance

"更新文档" means ALL affected docs, not just CLAUDE.md:
- `README.md` ↔ `README.zh.md` must stay in sync
- `docs/ARCHITECTURE.md` / `docs/ARCHITECTURE.zh.md` — Mermaid diagrams
- `docs/PRODUCT_STRATEGY.md` — product positioning
- `docs/research/*` — referenced numbers (language count, model count, etc.)

**After every feature change**: Grep all `*.md` files for affected keywords to ensure consistency.

### CLAUDE.md Updating Rules

This file is loaded into context every session. Bloated CLAUDE.md = ignored instructions.

**What belongs here** — only things Claude can't infer from reading code:
- Commands Claude can't guess (build, test, deploy, env vars)
- Non-obvious conventions that differ from defaults
- Gotchas that cause real bugs if violated
- Architectural decisions not evident from code structure

**What does NOT belong here:**
- Anything Claude can learn by reading the source files (component props, API routes, file structure)
- Standard language/framework conventions Claude already knows
- Detailed implementation descriptions — use progressive disclosure (point to files, let Claude read on-demand)
- Information that changes frequently — link to the source of truth instead

**Maintenance rules:**
- For each line, ask: "Would removing this cause Claude to make mistakes?" If not, delete it
- Never duplicate information already in code — if a convention is enforced by linting/types, don't repeat it here
- When adding a new rule, remove one that's no longer needed
- Target: **under 200 lines**. If it grows past that, prune before adding more
- Review quarterly: delete rules for patterns Claude has never violated

---

## Dev Server Rules

- Don't start multiple dev server processes
- Check for running servers before starting new ones
- Kill orphan processes on conflicting ports

---

## CC + CX Collaboration

```bash
codex exec --full-auto -m gpt-5.3-codex \
  -C /Users/mayijie/Projects/Code/010_DocTalk \
  -o <output-file> "<prompt>"
```

- Model name is **`gpt-5.3-codex`** (not `gpt-5.3`)
- Codex sandbox cannot do git operations — handle git in Claude
- Collaboration files: `.collab/{plans,reviews,tasks,archive}/`
