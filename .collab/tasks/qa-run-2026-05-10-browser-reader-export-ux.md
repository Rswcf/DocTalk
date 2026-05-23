# Browser Reader / Citation / Export UX Run - 2026-05-10

Scope: authenticated reader UI smoke for the core PDF conversation surface, with desktop and mobile browser assertions around citation jump/highlight, layout overflow, console errors, and conversation export.

## Environment

- Frontend: Next.js dev server at `http://127.0.0.1:3001`.
- Backend: Docker image built from `backend/Dockerfile`, served at `http://127.0.0.1:8001`.
- Infra: local Docker Compose Postgres, Redis, Qdrant, and MinIO.
- MinIO public URL for browser PDF fetches: `http://host.docker.internal:9000`, mapped to `127.0.0.1` in Playwright.
- Browser driver: Playwright Chromium, desktop `1440x900` and mobile `390x844`.

## Test Data

- Fixture script: `.collab/scripts/qa_browser_reader_fixture.py`.
- Fixture output: `.collab/tasks/qa-browser-reader-fixture-2026-05-10.json`.
- User: synthetic Plus QA user.
- Document: `test_inputs/semiconductor.pdf`.
- Session: synthetic user and assistant messages seeded into the database.
- Citation: generated from the document search API, including page and bbox metadata.

The fixture was cleaned up after the run:

- Cleanup output: `.collab/tasks/qa-browser-reader-fixture-cleanup-2026-05-10.json`.
- Cleanup verification: `users=0`, `documents=0` for the synthetic fixture owner.

## Commands

```bash
cd backend && docker build -t doctalk-backend-pdf-export-qa -f Dockerfile .

cd /Users/mayijie/Projects/Code/010_DocTalk
python3 .collab/scripts/qa_browser_reader_fixture.py create \
  --json-out .collab/tasks/qa-browser-reader-fixture-2026-05-10.json

cd frontend && npm run dev -- --hostname 127.0.0.1 --port 3001

node .collab/scripts/qa_browser_reader_export_ux.js \
  --base-url http://127.0.0.1:3001 \
  --fixture .collab/tasks/qa-browser-reader-fixture-2026-05-10.json \
  --json-out .collab/tasks/qa-browser-reader-export-ux-after-key-fix-2026-05-10.json

python3 .collab/scripts/qa_browser_reader_fixture.py cleanup \
  --user-id 5391122a-c2e3-4728-8994-090da84d6cd1 \
  --json-out .collab/tasks/qa-browser-reader-fixture-cleanup-2026-05-10.json
```

## Result

Final result: **pass**.

| Check | Result |
|---|---|
| Auth/session/profile in browser | Pass: `/api/auth/session` 200, `/api/profile` 200 |
| Desktop reader title | Pass: title contains `semiconductor.pdf` and `DocTalk` |
| Desktop layout | Pass: two-pane reader visible, no horizontal overflow |
| Desktop citation click | Pass: citation selected and PDF overlay rendered |
| Desktop PDF export | Pass: `conversation.pdf`, 146,604 bytes, `%PDF` header |
| Desktop DOCX export | Pass: `conversation.docx`, 36,919 bytes, `PK` header |
| Desktop console errors | Pass: 0 after key fix |
| Mobile reader | Pass: mobile citation click selected document tab |
| Mobile citation highlight | Pass: 69 highlight overlays detected |
| Mobile layout | Pass: no horizontal overflow |
| Mobile console errors | Pass: 0 after key fix |

Screenshots:

- `.collab/tasks/screenshots/2026-05-10/reader-desktop-citation-export.png`
- `.collab/tasks/screenshots/2026-05-10/reader-mobile-citation.png`

Raw evidence:

- Initial run before key fix: `.collab/tasks/qa-browser-reader-export-ux-2026-05-10.json`
- Passing rerun: `.collab/tasks/qa-browser-reader-export-ux-after-key-fix-2026-05-10.json`

## Findings And Fixes

1. Local browser PDF fetches from the Docker backend were blocked by dev CSP because the API and MinIO origins were not in `localDevSources`.
   - Fixed in `frontend/next.config.mjs`.
   - Scope is local development CSP only.

2. Citation highlight rendering produced repeated React duplicate-key warnings.
   - Fixed in `frontend/src/components/PdfViewer/PageWithHighlights.tsx` by including the bbox index in each overlay key.
   - Rerun showed 0 console errors on desktop and mobile.

## Verification

Frontend verification after the UI/CSP changes:

```bash
cd frontend && npm run lint
cd frontend && npm run build
```

Both passed. Build retained existing environment warnings about Sentry config migration, edge runtime static generation, and missing local `RESEND_API_KEY`.

## Remaining Gaps

- This run used a synthetic assistant message, so it validates reader/citation/export UX but not real LLM streaming answer quality.
- Browser upload from file input and browser URL import are still separate pending tests.
- Markdown export was already covered at API level, but this browser run focused on PDF and DOCX export UX.
- OAuth, email magic link, Stripe checkout/portal, and all 11 locales were not covered in this slice.
