# Browser Upload / URL Ingest UX Run - 2026-05-10

Scope: authenticated browser checks for the dashboard document ingestion surface, covering file upload, unsupported file feedback, URL input validation, URL import, desktop/mobile overflow, and reader handoff.

## Environment

- Backend: host FastAPI at `http://localhost:8000`.
- Frontend: Next.js dev server at `http://localhost:3000`.
- Worker: local Celery worker for `default,parse`.
- Infra: local Docker Compose Postgres, Redis, Qdrant, and MinIO.
- Browser driver: Playwright Chromium.
- Viewports: desktop `1440x900`, mobile `390x844`.

Important local note:

- Upload uses direct browser POSTs to `NEXT_PUBLIC_API_BASE`, not the Next.js proxy.
- This local backend was effectively in production-CORS mode because `SENTRY_ENVIRONMENT=production` and `FRONTEND_URL=http://localhost:3000`.
- `http://127.0.0.1:3001` failed CORS preflight for direct upload. The official run used `http://localhost:3000`, which matched `FRONTEND_URL`.

## Test Data

- Fixture script: `.collab/scripts/qa_browser_ingest_fixture.py`.
- Browser script: `.collab/scripts/qa_browser_ingest_ux.js`.
- Fixture output: `.collab/tasks/qa-browser-ingest-fixture-2026-05-10.json`.
- Cleanup output: `.collab/tasks/qa-browser-ingest-fixture-cleanup-2026-05-10.json`.
- Positive upload: `test_inputs/semiconductor.pdf`.
- Unsupported upload: `test_inputs/ai-report-2026-02-10-en.html`.
- Positive URL import: `https://example.com/`.
- Negative URL input: `ftp://example.com/nope` on desktop, `not-a-url` on mobile.

The fixture cleanup verified `users=0` and `documents=0`.

## Commands

```bash
cd backend && python3 -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
cd backend && OBJC_DISABLE_INITIALIZE_FORK_SAFETY=YES python3 -m celery -A app.workers.celery_app worker --loglevel=info -Q default,parse
cd frontend && npm run dev -- --hostname 127.0.0.1 --port 3000

python3 .collab/scripts/qa_browser_ingest_fixture.py create \
  --plan plus \
  --json-out .collab/tasks/qa-browser-ingest-fixture-2026-05-10.json

node .collab/scripts/qa_browser_ingest_ux.js \
  --base-url http://localhost:3000 \
  --fixture .collab/tasks/qa-browser-ingest-fixture-2026-05-10.json \
  --json-out .collab/tasks/qa-browser-ingest-ux-2026-05-10.json

python3 .collab/scripts/qa_browser_ingest_fixture.py cleanup \
  --user-id eddfc9b1-5bb6-4e0b-8bbc-31e90e62a0c0 \
  --json-out .collab/tasks/qa-browser-ingest-fixture-cleanup-2026-05-10.json
```

## Result

Final result: **pass**.

| Check | Result |
|---|---|
| Auth/session/profile | Pass: session 200, profile 200 |
| Desktop dashboard layout | Pass: upload input attached, URL input visible, no horizontal overflow |
| Desktop unsupported file | Pass: HTML file showed unsupported-format feedback |
| Desktop PDF upload | Pass: navigated to reader, `status=ready`, `file_type=pdf`, 2 pages, 12 indexed chunks |
| Desktop upload UX timing | 5.909s from file selection to reader-ready assertion |
| Desktop invalid URL | Pass: visible `Failed to import URL` alert |
| Desktop URL import | Pass: `https://example.com/` reached reader, `status=ready`, `file_type=url`, 1 page, 1 indexed chunk |
| Desktop URL import timing | 3.002s from submit to ready assertion |
| Desktop console errors | Pass: 0 |
| Mobile dashboard layout | Pass: upload input attached, URL input visible, no horizontal overflow |
| Mobile invalid URL | Pass: visible `Failed to import URL` alert |
| Mobile PDF upload | Pass: navigated to reader, `status=ready`, `file_type=pdf`, 2 pages, 12 indexed chunks |
| Mobile upload UX timing | 2.454s from file selection to reader-ready assertion |
| Mobile console errors | Pass: 0 |

Screenshots:

- `.collab/tasks/screenshots/2026-05-10/ingest-desktop-upload-reader.png`
- `.collab/tasks/screenshots/2026-05-10/ingest-desktop-url-reader.png`
- `.collab/tasks/screenshots/2026-05-10/ingest-mobile-upload-reader.png`

Raw evidence:

- `.collab/tasks/qa-browser-ingest-ux-2026-05-10.json`

## Findings

- Browser upload is sensitive to exact local origin because uploads bypass the Next.js proxy. With the current local backend settings, `http://localhost:3000` is allowed and `http://127.0.0.1:3001` is not.
- No product fix was made for that because AGENTS.md's default frontend dev command uses port 3000, and the passing run used the configured frontend origin.
- The browser path caught this environment issue; API-only upload matrices would not catch CORS preflight failures.

## Remaining Gaps

- This run did not send a real chat prompt after upload/import because local `DEEPSEEK_API_KEY` is absent.
- Positive mobile URL import was not repeated; desktop positive URL import and mobile URL error UX were covered.
- Broader URL cases remain: redirect chains, PDF URL, CJK pages, table-heavy pages, huge pages, and no-text pages through the browser.
- Browser plan-limit/paywall copy for upload and URL limits still needs focused UI coverage.
