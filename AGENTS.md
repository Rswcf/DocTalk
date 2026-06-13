# AGENTS.md

> Mirror of CLAUDE.md for Codex / other agents that do not auto-read
> `CLAUDE.md`. Keep the two files in sync. CLAUDE.md is authoritative for
> Claude Code (which supports `@import` syntax); this file is for agents
> that only read one top-level guide.

## Project

DocTalk — AI document Q&A web app. Upload PDF / DOCX / PPTX / XLSX / TXT / MD / URL; chat with AI that cites the exact source passage. 11 locales. Paid plans also expose layout-preserving PDF translation through the RetainPDF sidecar.

| Component | Stack | URL |
|---|---|---|
| Frontend | Next.js 14 (App Router), Vercel | https://www.doctalk.site |
| Backend | FastAPI + Celery, Railway | https://backend-production-a62e.up.railway.app |
| Infra | Postgres 16, Qdrant, MinIO, Redis; RetainPDF sidecar for layout translation | Railway |
| Repo | GitHub (public) | https://github.com/Rswcf/DocTalk |

LLM chat modes use DeepSeek V4 — internal `quick` = Flash, internal `balanced` = Pro. OpenRouter remains the embedding/fallback gateway. Layout PDF translation uses RetainPDF + DeepSeek translation + one OCR provider (`datalab`, `paddle`, or `mineru`). Auth.js v5 (Google / Microsoft / email magic link). Stripe billing is live in production; local/test environments may still use `sk_test_*`.

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

**Backend-first ordering is MANDATORY post-C1 (2026-05-20)** — see `docs/ARCHITECTURE.md §10` for the HMAC IP trust contract migration that requires backend-first deploys. Pushing `stable` triggers Vercel auto-deploy, so `railway up` must run BEFORE the push.

```bash
git push origin main
git checkout stable && git merge main          # merge but do NOT push yet
railway up --detach                             # 1. backend deploys FIRST
# 2. WAIT for Railway /health to confirm the new build is live:
curl -fsS https://backend-production-a62e.up.railway.app/health
# 3. NOW push — Vercel auto-deploys the frontend:
git push origin stable
# 4. Wait for Vercel deployment to show "Ready" in the dashboard.
git checkout main
# (C1 migration COMPLETE 2026-05-24: the legacy X-Proxy-IP-Secret/AUTH_SECRET
#  dual-accept path was removed after 24h at zero legacy_path_used. The IP
#  trust contract is now HMAC-only on both surfaces.)
```

- Vercel root directory = `frontend/`. Never run `vercel --prod`.
- Railway deploys only from `stable`. Never from `main`.
- DB migrations during beta: add-only. No drops/renames.

## Env vars

- **Backend** (`.env` + Railway): `DATABASE_URL`, `OPENROUTER_API_KEY`, `DEEPSEEK_API_KEY`, `AUTH_SECRET`, `ADAPTER_SECRET`, `STRIPE_SECRET_KEY` (`sk_live_*` in production; `sk_test_*` only for local/test), `STRIPE_WEBHOOK_SECRET`
- **Layout translation** (`.env` + Railway backend): `LAYOUT_TRANSLATION_ENGINE=retainpdf`, `RETAINPDF_API_BASE_URL`, `RETAINPDF_OCR_PROVIDER`, one provider token (`RETAINPDF_DATALAB_TOKEN` or `DATALAB_API_KEY`, `RETAINPDF_PADDLE_TOKEN`, or `RETAINPDF_MINERU_TOKEN`), optional `RETAINPDF_API_KEY`, optional `RETAINPDF_TRANSLATION_API_KEY`; caps are controlled by `FREE_LAYOUT_TRANSLATIONS_LIMIT`, `FREE_LAYOUT_TRANSLATION_MAX_PAGES`, `PLUS_LAYOUT_TRANSLATION_MAX_PAGES`, `PRO_LAYOUT_TRANSLATION_MAX_PAGES`, and `LAYOUT_TRANSLATION_MAX_FILE_SIZE_MB`
- **Frontend** (Vercel): `NEXT_PUBLIC_API_BASE` (**never** localhost in prod), `BACKEND_INTERNAL_URL` (preferred for server-side proxy hop), `AUTH_SECRET`, `ADAPTER_SECRET`, `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`, `MICROSOFT_CLIENT_ID` / `MICROSOFT_CLIENT_SECRET`, `RESEND_API_KEY`

Cross-origin IP trust chain is HMAC-signed with `ADAPTER_SECRET` — frontend and backend values must match. Proxy emits `X-Proxy-IP` / `X-Proxy-IP-Ts` / `X-Proxy-IP-Sig` (HMAC-SHA256 of `"{ip}:{ts}"`); backend verifies with `hmac.compare_digest` and ±60s skew. Never send `AUTH_SECRET` in an outbound header — it's the Auth.js JWE key.

## Path-scoped rules

Both agents (Claude + Codex) should read these when working in the matching area:

- `.claude/rules/backend.md` — async safety, credits, parse worker, auth, demo system
- `.claude/rules/frontend.md` — API proxy, UI palette, i18n, react-pdf, subscriptions

## Avoid (learned the hard way)

- **BSD sed has no `\b`** word boundary. Use `s/pattern\([^a-z]\)/replacement\1/g` or switch to GNU `sed`.
- **Don't `railway up` from `main`**. Always `git checkout stable` first.
- **Railway build config must match the Dockerfile's context.** `backend/Dockerfile` uses repo-root paths (`COPY backend/...`, `COPY version.json`), so the service needs `rootDirectory=""` + `dockerfilePath="backend/Dockerfile"` (NOT `rootDirectory=backend`). Set via the GraphQL API `serviceInstanceUpdate` (token in `~/.railway/config.json`), not env vars — `RAILWAY_ROOT_DIRECTORY` is only a reflection. A `"COPY backend/ not found"` / `"failed to compute cache key"` build error = this mismatch + a stale incremental base; the API config change resets the base. `railway up` has no `--no-cache`; keep `test_inputs/` in `.railwayignore` so uploads stay ~10 MB.
- **Don't set cookies in `middleware.ts`**. Next.js auto-applies `Cache-Control: private, no-store` to the entire response tree, killing SEO. Locale detection already runs client-side in `LocaleProvider`.
- **Don't `await cookies()` in `app/layout.tsx`** — same root cause, forces every page to `ƒ Dynamic` rendering.
- **Don't commit `frontend/tsconfig.tsbuildinfo`** (gitignored) or personal `.claude/settings.json` tweaks.
- **i18n updates must hit all 11 locales** (en / zh / ja / ko / es / de / fr / pt / it / ar / hi). Use `tOr(key, fallback)` when shipping a new key ahead of translation.
- **Layout translation is cost-sensitive**. Never bypass backend page/file/trial limits; preview/import/download must remain user-triggered, and marketing must not promise perfect output for invoices, bills, dense forms, or table-heavy PDFs.
- **Don't skip adversarial review** for commits > 30 lines of logic or any security-adjacent change. Claude ↔ Codex cross-review is the norm.
- **`"更新文档"` means every affected `.md`** — grep before assuming which doc needs touching.

## Codex collaboration (when Claude delegates)

Do NOT pass `-m gpt-5.3-codex` (rejected since 2026-06; omit `-m`, default = gpt-5.5). Use `--sandbox workspace-write` (not deprecated `--full-auto`). Codex sandbox **cannot run git** — Claude commits.

```bash
cat prompt.md | codex exec --sandbox workspace-write \
  -C /Users/mayijie/Projects/Code/010_DocTalk
```

(Positional-arg prompts hang in some versions — pipe via stdin.)

Collab artifacts: `.collab/{plans,reviews,dialogue,tasks,archive}/`.

## Reference

- `docs/ARCHITECTURE.md` §10 — runtime + operational integrity (living section)
- `.collab/reviews/2026-04-12-final-fix-report.md` — template of what a Codex-reviewed batch looks like
- `CLAUDE.md` — authoritative twin of this file; keep in sync
