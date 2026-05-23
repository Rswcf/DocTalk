# BUG-2026-05-11-READER-RESPONSIVE-LAYOUT-DOUBLE-MOUNT

Status: fixed locally and retested.

## Summary

The document reader mounted both the desktop split-pane layout and the mobile tab layout at the same time, relying on responsive CSS classes to hide one of them. Hidden React trees still mounted `ChatPanel` and `PdfViewer`, so long PDFs performed duplicate API/PDF work and produced extra hidden reader controls.

## Severity

P1 for long-PDF reader performance and citation UX. The user-visible citation jump could still work, but 300+ page PDFs fetched/rendered twice per viewport and created avoidable PDF.js work on the core document-chat screen.

## Evidence

Initial long-PDF browser run:

- `.collab/tasks/qa-browser-long-pdf-ux-2026-05-11.json`

Observed before the fix:

- Desktop and mobile each fetched the same PDF with duplicate full `200 application/pdf` responses.
- Desktop canvas count after citation jump was `12`; after the fix it dropped to `8`.
- Mobile citation behavior worked only after the harness followed the real flow: click a citation in Chat, then assert the Document tab becomes visible.
- PDF.js `TextLayer task cancelled` messages increased during the duplicate render path; the harness now records those as non-blocking PDF.js warnings.

## Root Cause

`DocumentReaderPageClient` rendered both responsive layouts unconditionally:

- desktop tree: `hidden sm:flex`
- mobile tree: `flex sm:hidden`

CSS hiding removed one layout visually, but React still mounted both trees. Because `viewerContent` was present in both branches, both `PdfViewer` instances loaded the long PDF.

## Fix

- `frontend/src/app/d/[documentId]/DocumentReaderPageClient.tsx` now uses a `matchMedia('(min-width: 640px)')` driven layout gate.
- Only the active desktop or mobile reader layout is mounted after hydration.
- The loading placeholder renders while the viewport gate initializes, avoiding a server/client layout mismatch and avoiding duplicate reader trees.
- `.collab/scripts/qa_browser_long_pdf_ux.js` now asserts no duplicate full PDF load per viewport and models the real mobile citation flow.

## Retest

Retest passed:

- `.collab/tasks/qa-browser-long-pdf-ux-after-single-layout-fix-2026-05-11.json`

Key checks:

- Desktop page 361 citation jump: `1457ms`
- Mobile Chat citation tap -> Document tab -> page 361 highlight: `1576ms`
- Desktop/mobile full PDF `200` response count: `1` each
- Desktop/mobile rendered canvas count after jump: `8`
- Desktop/mobile unique PDF pages available after jump: `361`
- Desktop/mobile blocking console errors: `0`
- Desktop/mobile horizontal overflow: `false`

Remaining note: React-PDF still emits one benign `TextLayer task cancelled` warning per viewport during the jump/virtualization path. The harness records it separately and does not treat it as a blocking runtime error.
