# QA Run - Browser Long PDF Citation UX - 2026-05-11

Scope: verify long-PDF reader behavior for a 361-page `test_inputs` PDF, including desktop rendering, mobile citation tab switching, late-page citation jump, virtualization, duplicate PDF-load prevention, and UI overflow.

## Environment

| Item | Value |
|---|---|
| Backend | `http://127.0.0.1:8000`, temporary uvicorn process |
| Frontend | `http://127.0.0.1:3000`, temporary Next.js dev server |
| Worker | temporary Celery parse worker |
| Fixture | Synthetic authenticated Pro user uploading `test_inputs/ssrn-3247865.pdf` |
| Harnesses | `.collab/scripts/qa_browser_long_pdf_fixture.py`, `.collab/scripts/qa_browser_long_pdf_ux.js` |

## Fixture

Fixture creation passed:

- `.collab/tasks/qa-browser-long-pdf-fixture-2026-05-11.json`

Key data:

- File: `test_inputs/ssrn-3247865.pdf`
- Parsed pages: `361`
- Indexed chunks: `581`
- Target citation page: `361`
- Target chunk: `1da04a8d-aac1-4687-bfe3-3c516fa3d8fe`

The fixture inserted a deterministic cited assistant message so browser citation UX could be tested without relying on an LLM call.

## Initial Result

Fail, then narrowed.

Evidence:

- `.collab/tasks/qa-browser-long-pdf-ux-2026-05-11.json`
- `.collab/tasks/screenshots/2026-05-11/long-pdf-citation-mobile-failure.png`

Findings:

- Network was healthy: document API, file URL, PDF worker, and MinIO PDF requests returned `200`/`206`.
- The original mobile wait was too strict because mobile starts in the Chat tab; the user-like flow is to click a citation first, then assert the Document tab becomes active.
- After fixing the harness flow, the test exposed a real performance issue: hidden desktop/mobile reader layouts were both mounted and fetched/rendered the long PDF twice.

Bug:

- `.collab/tasks/bug-2026-05-11-reader-responsive-layout-double-mount.md`

## Fix

- `frontend/src/app/d/[documentId]/DocumentReaderPageClient.tsx` now mounts only the active desktop or mobile reader layout using a `matchMedia('(min-width: 640px)')` gate.
- `.collab/scripts/qa_browser_long_pdf_ux.js` now:
  - writes failure JSON instead of losing Playwright timeout context
  - captures relevant network responses, failed requests, console errors, DOM/page/canvas metrics, and screenshots
  - treats React-PDF `TextLayer task cancelled` as a recorded non-blocking warning
  - follows the real mobile flow: Chat citation tap -> Document tab -> target highlight
  - asserts at most one full PDF `200` load per viewport

## Retest

Pass.

Evidence:

- `.collab/tasks/qa-browser-long-pdf-ux-after-single-layout-fix-2026-05-11.json`
- `.collab/tasks/screenshots/2026-05-11/long-pdf-citation-desktop.png`
- `.collab/tasks/screenshots/2026-05-11/long-pdf-citation-mobile.png`

Assertions passed:

- Desktop and mobile both reached page `361`.
- Desktop citation jump: `1457ms`.
- Mobile citation tap switched to the Document tab and reached page `361` in `1576ms`.
- Desktop/mobile full PDF `200` response count was `1`.
- Desktop/mobile rendered canvas count after jump was `8`, keeping virtualization bounded.
- Desktop/mobile had `0` blocking console errors.
- Desktop/mobile had no horizontal overflow.
- Page input updated to the late page area after the jump.

## Cleanup

Fixture cleanup passed:

- `.collab/tasks/qa-browser-long-pdf-fixture-cleanup-2026-05-11.json`

Cleanup returned:

```json
{"users": 0, "documents": 0}
```

## Validation

Passed:

- `python3 -m py_compile .collab/scripts/qa_browser_long_pdf_fixture.py`
- `node --check .collab/scripts/qa_browser_long_pdf_ux.js`
- `jq empty` for fixture, failing UX, passing UX, and cleanup JSON artifacts
- `cd frontend && npm run build`
- `cd backend && python3 -m ruff check app/ tests/ ../.collab/scripts/qa_browser_long_pdf_fixture.py`
- `cd backend && python3 -m pytest tests/test_parse_service.py -v`

Notes:

- Frontend build printed the expected local warning: `RESEND_API_KEY not set — email magic link provider disabled`.
- `test_inputs/ssrn-3247865.pdf` was read only; `test_inputs/` was not modified.

## Remaining Gap

This covers deterministic long-PDF browser citation UX and reader performance. It does not replace full-corpus multi-prompt live LLM answer-quality scoring.
