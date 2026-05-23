# QA Run - 2026-05-10 - Phase 0 Harness Bootstrap

Scope: bootstrap repeatable inventory tooling for the long-run `/goal` full-product QA program, then execute the initial static route and corpus inventories.

## Environment

| Item | Result |
|---|---|
| Workspace | `/Users/mayijie/Projects/Code/010_DocTalk` |
| Date | 2026-05-10 |
| Frontend env files | `.env`, `frontend/.env.local` present |
| `DEEPSEEK_API_KEY` | absent in shell and `.env` |
| `OPENROUTER_API_KEY` | present in `.env`, absent in shell |
| `RESEND_API_KEY` | absent in `frontend/.env.local` |
| PDF probe tooling | `pdfinfo` and PyMuPDF available |

## Artifacts Created

| Artifact | Purpose |
|---|---|
| `.collab/scripts/qa_route_inventory.js` | Enumerates Next.js App Router pages, expands known SEO/blog/demo dynamic routes, records fixture-only dynamic routes, inventories `app/api/*/route.ts`, and can optionally fetch routes from a running app. |
| `.collab/scripts/qa_corpus_inventory.py` | Inventories `test_inputs/` files, size tiers, support class, filename language hints, PDF page counts, and encrypted PDF metadata. |
| `.collab/tasks/qa-route-inventory-2026-05-10.json` | Machine-readable route inventory. |
| `.collab/tasks/qa-route-inventory-2026-05-10.md` | Human-readable route inventory. |
| `.collab/tasks/qa-route-http-2026-05-10.json` | Machine-readable localhost HTTP route sweep. |
| `.collab/tasks/qa-route-http-2026-05-10.md` | Human-readable localhost HTTP route sweep. |
| `.collab/tasks/qa-corpus-inventory-2026-05-10.json` | Machine-readable corpus inventory. |
| `.collab/tasks/qa-corpus-inventory-2026-05-10.md` | Human-readable corpus inventory. |
| `.collab/tasks/screenshots/2026-05-10/*.png` | Production-mode Playwright screenshots for representative public/auth pages. |

## Commands Run

```bash
node .collab/scripts/qa_route_inventory.js \
  --json-out .collab/tasks/qa-route-inventory-2026-05-10.json \
  --md-out .collab/tasks/qa-route-inventory-2026-05-10.md

python3 .collab/scripts/qa_corpus_inventory.py \
  --input-dir test_inputs \
  --json-out .collab/tasks/qa-corpus-inventory-2026-05-10.json \
  --md-out .collab/tasks/qa-corpus-inventory-2026-05-10.md

python3 -m json.tool .collab/tasks/qa-route-inventory-2026-05-10.json
python3 -m json.tool .collab/tasks/qa-corpus-inventory-2026-05-10.json

node .collab/scripts/qa_route_inventory.js --help
python3 .collab/scripts/qa_corpus_inventory.py --help

npm run dev

node .collab/scripts/qa_route_inventory.js \
  --base-url http://localhost:3001 \
  --json-out .collab/tasks/qa-route-http-2026-05-10.json \
  --md-out .collab/tasks/qa-route-http-2026-05-10.md

cd frontend && npm run lint
cd frontend && npm run build

AUTH_TRUST_HOST=true NEXTAUTH_URL=http://localhost:3001 npm run start -- --port 3001
cd frontend && npx playwright screenshot --viewport-size=1440,900 http://localhost:3001/ ../.collab/tasks/screenshots/2026-05-10/home-desktop.png
cd frontend && npx playwright screenshot --viewport-size=390,844 http://localhost:3001/demo ../.collab/tasks/screenshots/2026-05-10/demo-mobile.png
cd frontend && npx playwright screenshot --viewport-size=390,844 http://localhost:3001/auth ../.collab/tasks/screenshots/2026-05-10/auth-mobile.png
cd frontend && npx playwright screenshot --viewport-size=1440,900 http://localhost:3001/pricing ../.collab/tasks/screenshots/2026-05-10/pricing-desktop.png
cd frontend && npx playwright screenshot --viewport-size=390,844 http://localhost:3001/privacy ../.collab/tasks/screenshots/2026-05-10/privacy-mobile.png
cd frontend && npx playwright screenshot --viewport-size=1440,900 http://localhost:3001/blog/ai-document-security-privacy ../.collab/tasks/screenshots/2026-05-10/blog-security-desktop.png
cd frontend && npx playwright screenshot --viewport-size=390,844 http://localhost:3001/demo/earnings ../.collab/tasks/screenshots/2026-05-10/demo-redirect-mobile.png
```

## Results

Route inventory:

| Metric | Count |
|---|---:|
| page files | 55 |
| API route files | 6 |
| concrete browser routes | 81 |
| dynamic templates | 6 |
| dynamic templates needing runtime fixtures | 3 |

Runtime-fixture routes:
- `/collections/[collectionId]`
- `/d/[documentId]`
- `/shared/[token]`

API routes inventoried:
- `/api/auth/[...nextauth]`
- `/api/contact`
- `/api/csp-report`
- `/api/indexnow`
- `/api/proxy/[...path]`
- `/api/upload-token`

HTTP route sweep:

| Metric | Count |
|---|---:|
| fetched non-gated concrete routes | 76 |
| skipped gated routes | 5 |
| fetch errors | 0 |
| bad HTTP statuses | 0 |
| missing titles | 0 |
| missing descriptions | 0 |
| H1 issues | 0 |

Resolved during this run:
- Initial HTTP sweep found 8 H1 issues on legacy `/demo/[sample]` client redirect pages.
- Fix: `frontend/src/app/demo/[sample]/DemoRedirectPageClient.tsx` now renders an H1 in both loading and not-found states.
- Retest: reran HTTP sweep; H1 issues dropped from 8 to 0.
- Verification: `npm run lint` passed; `npm run build` passed.

Corpus inventory:

| Metric | Count |
|---|---:|
| files | 52 |
| total size | 206.604 MB |
| PDFs | 50 |
| PDFs with page count | 50 |
| encrypted PDFs | 6 |
| max pages | 361 |
| min pages | 1 |
| plus-sized files by size | 2 |
| CJK filename hints | 8 |

Support classes:
- 50 `upload_supported` PDFs
- 1 `url_or_negative_fixture` HTML file
- 1 `negative_fixture` `.DS_Store`

Screenshot smoke:

| Screenshot | Viewport |
|---|---|
| `screenshots/2026-05-10/home-desktop.png` | 1440 x 900 |
| `screenshots/2026-05-10/demo-mobile.png` | 390 x 844 |
| `screenshots/2026-05-10/auth-mobile.png` | 390 x 844 |
| `screenshots/2026-05-10/pricing-desktop.png` | 1440 x 900 |
| `screenshots/2026-05-10/privacy-mobile.png` | 390 x 844 |
| `screenshots/2026-05-10/blog-security-desktop.png` | 1440 x 900 |
| `screenshots/2026-05-10/demo-redirect-mobile.png` | 390 x 844 |

Notes:
- Production screenshot run used `AUTH_TRUST_HOST=true NEXTAUTH_URL=http://localhost:3001` to avoid Auth.js `UntrustedHost` noise when polling `/api/auth/session`.
- `RESEND_API_KEY not set — email magic link provider disabled` remains expected for this local environment.

## Coverage Added

This run converts Phase 0 from a plan into reusable tooling and initial evidence:
- The page/API surface is now explicitly enumerated.
- Known SEO dynamic routes are expanded into concrete test targets.
- Fixture-only dynamic product routes are called out instead of hidden.
- `test_inputs/` now has a repeatable inventory with page counts, encryption flags, size tiers, and language hints.
- The public/non-gated route set has an initial localhost HTTP status/title/description/H1 sweep.

## Not Yet Executed

- No interactive Playwright/browser UI pass was run in this slice.
- Representative Playwright screenshots were captured, but they are visual evidence only; no interactive click/form/chat assertions were executed.
- No upload, parse, chat, citation, URL import, auth, billing, or sharing flow was executed.
- Full RAG quality remains blocked locally until `DEEPSEEK_API_KEY` is available or the run targets an environment with DeepSeek V4 configured.
- Email magic-link testing remains blocked locally by absent `RESEND_API_KEY`.

## Verification

| Command | Result |
|---|---|
| `python3 -m json.tool .collab/tasks/qa-route-inventory-2026-05-10.json` | Pass |
| `python3 -m json.tool .collab/tasks/qa-route-http-2026-05-10.json` | Pass |
| `python3 -m json.tool .collab/tasks/qa-corpus-inventory-2026-05-10.json` | Pass |
| `cd frontend && npm run lint` | Pass: no ESLint warnings/errors; critical i18n checks passed |
| `cd frontend && npm run build` | Pass: production build completed; `RESEND_API_KEY` warning expected in local env |

## Next Slice

Recommended next execution:
1. Run an interactive browser pass for representative pages from the screenshot smoke: nav/menu, auth form focus, pricing toggles, blog TOC links, and mobile scroll/overflow.
2. Start full stack with Celery and execute TC-PDF-001, TC-PDF-003, TC-PDF-004, TC-URL-001, and TC-URL-002 from `.collab/tasks/2026-05-10-goal-full-product-testing.md`.
3. If `DEEPSEEK_API_KEY` is still absent locally, run chat/RAG scoring against a safe environment where it is configured, or mark those test cases blocked with evidence.
