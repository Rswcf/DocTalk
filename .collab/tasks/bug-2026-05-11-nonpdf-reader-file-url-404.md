# BUG-2026-05-11-NONPDF-READER-FILE-URL-404

Status: fixed locally and retested.

## Summary

The document reader requested `/api/documents/{id}/file-url` for non-PDF documents even when the active viewer was `TextViewer`.

For private non-PDF documents without an original PDF file URL, the backend correctly returned 404, but the browser still logged failed resource errors. This created noisy console failures in non-PDF reader QA and could mask real UI issues.

## Evidence

Initial failing run:

- `.collab/tasks/qa-browser-nonpdf-citation-ux-2026-05-11.json`

Observed:

- TXT citation jump passed with 0 console errors.
- Markdown citation jump highlighted correctly, but desktop logged two 404 resource errors after loading the reader.

## Fix

- `frontend/src/lib/useDocumentLoader.ts` now clears the previous PDF URL when loading a new document.
- It only requests the original file URL when the ready document has `file_type === "pdf"`.
- Converted PDF URL loading remains gated behind `has_converted_pdf`.
- `frontend/src/store/index.ts` now allows `setPdfUrl(null)` so stale PDF URLs can be cleared.

## Retest

Retest passed:

- `.collab/tasks/qa-browser-nonpdf-citation-ux-after-fileurl-fix-2026-05-11.json`

TXT and Markdown desktop/mobile checks all passed:

- citation count > 0
- citation click rendered one highlight
- expected snippet was highlighted
- mobile switched to the document tab
- no horizontal overflow
- console errors: `0`
