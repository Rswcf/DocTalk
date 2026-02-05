**What I Changed**
- Synced visible page during programmatic scrolls by setting `setVisiblePage(currentPage)` before `scrollIntoView` in `frontend/src/components/PdfViewer/PdfViewer.tsx:37`.
- Updated toolbar navigation to always trigger scroll by bumping `scrollNonce` via `useDocTalkStore.setState` in `frontend/src/components/PdfViewer/PdfViewer.tsx:83`.
- Removed unused `setPage` from the store destructure in `frontend/src/components/PdfViewer/PdfViewer.tsx:28`.

**Key Code References**
- Scroll effect sync: `frontend/src/components/PdfViewer/PdfViewer.tsx:31`
- Toolbar handler update: `frontend/src/components/PdfViewer/PdfViewer.tsx:83`

**Build and Lint Results**
- Ran: `cd frontend && npm run build`
  - Result: Build succeeded.
- Ran: `cd frontend && npx next lint`
  - Result: ✔ No ESLint warnings or errors.

**Notes**
- The toolbar page number will now stay in sync after programmatic scrolls.
- Prev/Next clicks will reliably navigate one page at a time, even if `currentPage` didn’t change, due to the `scrollNonce` bump.
- Citation navigation remains correct (it already bumps `scrollNonce` in the store).
- Manual scrolling continues to update the toolbar page number via the IntersectionObserver.