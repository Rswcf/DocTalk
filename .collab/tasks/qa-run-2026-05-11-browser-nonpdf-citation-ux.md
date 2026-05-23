# QA Run - Browser Non-PDF Citation UX - 2026-05-11

Scope: verify citation click and TextViewer highlighting for non-PDF documents in desktop and mobile reader layouts.

## Environment

| Item | Value |
|---|---|
| Backend | `http://127.0.0.1:8000`, temporary uvicorn process |
| Frontend | `http://localhost:3000`, temporary Next.js dev server |
| Fixture | Synthetic authenticated Plus user with TXT and Markdown ready documents plus cited assistant messages |
| Harnesses | `.collab/scripts/qa_browser_nonpdf_citation_fixture.py`, `.collab/scripts/qa_browser_nonpdf_citation_ux.js` |

## Initial Result

Fail.

Evidence:

- Fixture: `.collab/tasks/qa-browser-nonpdf-citation-fixture-2026-05-11.json`
- Initial UX run: `.collab/tasks/qa-browser-nonpdf-citation-ux-2026-05-11.json`

TXT passed. Markdown highlighted correctly, but desktop logged two 404 resource errors because the reader requested `/file-url` for a non-PDF document.

Bug:

- `.collab/tasks/bug-2026-05-11-nonpdf-reader-file-url-404.md`

## Fix

- `frontend/src/lib/useDocumentLoader.ts` only fetches the original file URL for native PDFs.
- `frontend/src/store/index.ts` allows clearing stale `pdfUrl` with `setPdfUrl(null)`.

## Retest

Pass.

Evidence:

- Retest: `.collab/tasks/qa-browser-nonpdf-citation-ux-after-fileurl-fix-2026-05-11.json`
- Cleanup: `.collab/tasks/qa-browser-nonpdf-citation-fixture-cleanup-2026-05-11.json`

Assertions passed for both TXT and Markdown on desktop and mobile:

- existing assistant message included citations
- citation buttons were visible before click
- citation click rendered the expected highlighted snippet
- document filename stayed visible
- mobile switched to the document tab
- no horizontal overflow
- console errors: `0`

Screenshots:

- `.collab/tasks/screenshots/2026-05-11/nonpdf-citation-txt-desktop.png`
- `.collab/tasks/screenshots/2026-05-11/nonpdf-citation-txt-mobile.png`
- `.collab/tasks/screenshots/2026-05-11/nonpdf-citation-md-desktop.png`
- `.collab/tasks/screenshots/2026-05-11/nonpdf-citation-md-mobile.png`

## Cleanup

Fixture cleanup returned:

```json
{"users": 0, "documents": 0}
```

## Validation

Passed:

- `python3 -m py_compile .collab/scripts/qa_browser_nonpdf_citation_fixture.py`
- `node --check .collab/scripts/qa_browser_nonpdf_citation_ux.js`
- `jq empty` for fixture, initial UX, fixed UX, and cleanup JSON artifacts
- `python3 -m ruff check app/ tests/ ../.collab/scripts/qa_browser_nonpdf_citation_fixture.py`
- `npm run build`
- `git diff --check`
- DB residual check: `{"qa_browser_nonpdf_citation_users": 0, "qa_browser_nonpdf_citation_documents": 0}`
- Port check: no listener on `3000` or `8000`

Note: frontend build printed `RESEND_API_KEY not set — email magic link provider disabled`, which is expected for this local environment and unrelated to this reader/citation test.

## Remaining Gap

This verifies deterministic non-PDF browser citation navigation for TXT and Markdown. It does not verify live LLM-generated citations for non-PDF documents, nor converted DOCX/PPTX slide-view citation behavior.
