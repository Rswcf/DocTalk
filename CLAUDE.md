# CLAUDE.md

## Project

DocTalk — AI document Q&A web app. Upload PDF / DOCX / PPTX / XLSX / TXT / MD / URL; chat with AI that cites the exact source passage. 11 locales.

| Component | Stack | URL |
|---|---|---|
| Frontend | Next.js 14 (App Router), Vercel | https://www.doctalk.site |
| Backend | FastAPI + Celery, Railway | https://backend-production-a62e.up.railway.app |
| Infra | Postgres 16, Qdrant, MinIO, Redis | Railway (5 services) |
| Repo | GitHub (public) | https://github.com/Rswcf/DocTalk |

LLM via OpenRouter — Quick=DeepSeek V3.2 · Balanced=Mistral Medium 3.1 · Thorough=Mistral Large 2512. Auth.js v5 (Google / Microsoft / email magic link). Stripe billing (test mode until live switch).

## Dev commands (Claude can't guess these)

```bash
docker compose up -d                      # Start infra (pg/qdrant/minio/redis)
cd backend && python3 -m uvicorn app.main:app --reload
cd frontend && npm run dev

# macOS fork-safety flag is MANDATORY for Celery worker
cd backend && OBJC_DISABLE_INITIALIZE_FORK_SAFETY=YES \
  python3 -m celery -A app.workers.celery_app worker \
  --loglevel=info -Q default,parse

cd backend && python3 -m alembic upgrade head   # DB migration
```

## Verify before claiming done

Run these after any non-trivial change — they are the contract for "this ships":

```bash
cd frontend && npm run build       # must pass, not just `npm run dev`
cd backend && python3 -m ruff check app/ tests/
cd backend && python3 -m pytest tests/test_parse_service.py -v   # no deps
cd backend && python3 -m pytest -m integration -v                # docker required
```

For UI changes, also open the dev server in a browser and exercise the golden path (upload → chat → citation jump).

## Deploy

`main` = development → Vercel **preview** only. `stable` = production → Vercel `doctalk.site` + Railway backend.

```bash
git push origin main
git checkout stable && git merge main && git push origin stable
# Backend changes? Add this from stable:
railway up --detach
git checkout main
```

Full procedure + guardrails: see `.claude/skills/deploy/SKILL.md` (invoked via `/deploy`).

## Key env vars

- **Backend** (`.env` + Railway): `DATABASE_URL`, `OPENROUTER_API_KEY`, `AUTH_SECRET`, `ADAPTER_SECRET`, `STRIPE_SECRET_KEY` (currently `sk_test_*` — swap to `sk_live_*` before real selling), `STRIPE_WEBHOOK_SECRET`
- **Frontend** (Vercel): `NEXT_PUBLIC_API_BASE` (**never** localhost in prod), `AUTH_SECRET`, `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`, `MICROSOFT_CLIENT_ID` / `MICROSOFT_CLIENT_SECRET`, `RESEND_API_KEY`

Cross-origin IP trust chain is HMAC-signed with `ADAPTER_SECRET` — frontend and backend values **must match**.

## Path-scoped rules (imported)

@.claude/rules/backend.md — async safety, credits, parse worker, auth, demo system
@.claude/rules/frontend.md — API proxy, UI palette, i18n, react-pdf, subscriptions

## Avoid (learned the hard way)

- **BSD sed has no `\b` word boundary**. Use `s/pattern\([^a-z]\)/replacement\1/g` or GNU `sed`.
- **Don't `railway up` from `main`**. Always `git checkout stable` first.
- **Don't set cookies in `middleware.ts`**. Next.js auto-applies `Cache-Control: private, no-store` to the entire response tree, killing SEO. Locale detection already runs client-side in `LocaleProvider`.
- **Don't `await cookies()` in `app/layout.tsx`** for the same reason — it forces every page to `ƒ Dynamic` rendering.
- **Don't commit uncompressed build artifacts** (`frontend/tsconfig.tsbuildinfo` is `.gitignore`d; personal `.claude/settings.json` permission tweaks stay local).
- **i18n updates must hit all 11 locales** (en / zh / ja / ko / es / de / fr / pt / it / ar / hi). Use `tOr(key, fallback)` when shipping a new key ahead of translation.
- **Don't skip Codex adversarial review** for commits > 30 lines of logic or any security-adjacent change. See "Codex collaboration" below.
- **Universal rules**: don't start a second dev server without checking, and `"更新文档"` means update every affected `.md` — grep before assuming.

## Codex collaboration

Model name is **`gpt-5.3-codex`**. Codex sandbox **cannot run git** — commit from Claude.

```bash
cat prompt.md | codex exec --full-auto -m gpt-5.3-codex \
  -C /Users/mayijie/Projects/Code/010_DocTalk
```

(Positional-arg prompts hang in some Codex versions — pipe via stdin instead.)

- Major features + security-sensitive commits go through Claude → Codex adversarial review → multi-round until consensus.
- Collab artifacts live in `.collab/{plans,reviews,dialogue,tasks,archive}/`. Plans → reviews → dialogue per round.
- When user asks for implementation, prefer delegating to Codex unless told otherwise.

## Reference

- `docs/ARCHITECTURE.md` — runtime + operational integrity decisions (§10 is the living one)
- `.collab/reviews/2026-04-12-final-fix-report.md` — the P1/P2 fix-batch story; templates for how a Codex-reviewed batch reads
- `AGENTS.md` — mirror of this file for Codex / other agents that don't auto-read `CLAUDE.md`
