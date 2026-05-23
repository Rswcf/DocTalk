# QA Run - Browser Converted Citation UX - 2026-05-11

Scope: verify converted DOCX/PPTX citation clicks in the reader's slide view and text fallback on desktop and mobile.

## Environment

| Item | Value |
|---|---|
| Backend | `http://127.0.0.1:8000`, temporary uvicorn process |
| Frontend | `http://127.0.0.1:3000`, temporary Next.js dev server |
| Fixture | Synthetic authenticated Plus user with DOCX and PPTX ready documents, uploaded converted PDFs in MinIO, text pages, chunks, and cited assistant messages |
| Harnesses | `.collab/scripts/qa_browser_converted_citation_fixture.py`, `.collab/scripts/qa_browser_converted_citation_ux.js` |

## Initial Result

Fail.

Evidence:

- Fixture: `.collab/tasks/qa-browser-converted-citation-fixture-2026-05-11.json`
- Initial UX run: `.collab/tasks/qa-browser-converted-citation-ux-2026-05-11.json`
- Tightened viewport assertion run: `.collab/tasks/qa-browser-converted-citation-ux-after-scroll-fix-2026-05-11.json`

Observed:

- DOCX/PPTX slide view created PDF text-layer highlights.
- Citation click did not scroll the PDF viewer to the highlighted page; screenshots stayed on page 1 while the page 2 highlight was below the viewport.
- Text-view fallback highlighted the exact snippet.
- Mobile switched to the document tab.

Bug:

- `.collab/tasks/bug-2026-05-11-converted-pdf-citation-scroll-missed-target.md`

## Fix

- `frontend/src/components/PdfViewer/PdfViewer.tsx` retries when the target page ref or visible container is not ready.
- The no-anchor fallback now scrolls the PDF viewer container directly instead of relying on `target.scrollIntoView()`.
- The Playwright harness now asserts that PDF highlights enter the current viewport, not merely that they exist somewhere in the DOM.

## Retest

Pass.

Evidence:

- Retest: `.collab/tasks/qa-browser-converted-citation-ux-after-container-scroll-fix-2026-05-11.json`
- Cleanup: `.collab/tasks/qa-browser-converted-citation-fixture-cleanup-2026-05-11.json`

Assertions passed for DOCX and PPTX on desktop and mobile:

- existing assistant message included citations
- citation buttons were visible before click
- slide/text toggle was visible after citation click
- PDF text-layer highlight entered the viewport in slide view
- expected words from the cited snippet were highlighted
- text view highlighted the exact snippet after toggle
- mobile switched to the document tab
- no horizontal page overflow
- blocking console errors: `0`

The harness records benign React-PDF `TextLayer task cancelled` messages separately when switching away from PDF rendering after the slide-view assertion has completed.

Screenshots:

- `.collab/tasks/screenshots/2026-05-11/converted-citation-docx-desktop-slide.png`
- `.collab/tasks/screenshots/2026-05-11/converted-citation-docx-desktop-text.png`
- `.collab/tasks/screenshots/2026-05-11/converted-citation-docx-mobile-slide.png`
- `.collab/tasks/screenshots/2026-05-11/converted-citation-docx-mobile-text.png`
- `.collab/tasks/screenshots/2026-05-11/converted-citation-pptx-desktop-slide.png`
- `.collab/tasks/screenshots/2026-05-11/converted-citation-pptx-desktop-text.png`
- `.collab/tasks/screenshots/2026-05-11/converted-citation-pptx-mobile-slide.png`
- `.collab/tasks/screenshots/2026-05-11/converted-citation-pptx-mobile-text.png`

## Cleanup

Fixture cleanup returned:

```json
{"users": 0, "documents": 0}
```

## Validation

Passed:

- `python3 -m py_compile .collab/scripts/qa_browser_converted_citation_fixture.py`
- `node --check .collab/scripts/qa_browser_converted_citation_ux.js`
- `jq empty` for fixture, initial UX, tightened assertion UX, fixed UX, and cleanup JSON artifacts
- `python3 -m ruff check app/ tests/ ../.collab/scripts/qa_browser_converted_citation_fixture.py`
- `npm run build`
- `git diff --check`
- DB/MinIO residual check: `{"qa_browser_converted_citation_users": 0, "qa_browser_converted_citation_documents": 0, "qa_browser_converted_citation_objects": 0}`
- Port check: no listener on `3000` or `8000`

Note: frontend build printed `RESEND_API_KEY not set — email magic link provider disabled`, which is expected for this local environment and unrelated to this reader/citation test.

## Remaining Gap

This verifies deterministic converted DOCX/PPTX slide-view and text-view citation navigation. It does not verify live LLM-generated citations for converted DOCX/PPTX documents.
