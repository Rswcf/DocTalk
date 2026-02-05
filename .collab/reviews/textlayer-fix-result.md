I checked the setup, verified the CSS path, and implemented Plan B by importing the TextLayer CSS to fix the visible text leak.

**What I Checked**
- react-pdf version: `frontend/package.json` shows `react-pdf` at `^7.7.1`.
- CSS path exists: `frontend/node_modules/react-pdf/dist/esm/Page/TextLayer.css` is present and mapped via `react-pdf/dist/Page/TextLayer.css` in the package exports.

**Change Made**
- Imported the TextLayer stylesheet so the text layer renders as an invisible overlay:
  - frontend/src/components/PdfViewer/PdfViewer.tsx:5
    - Added: `import 'react-pdf/dist/Page/TextLayer.css';`

**Why Plan B**
- Keeps text selectable/copyable while hiding the raw text layer.
- Path is correct for v7.7.x and is resolved via package exports.

**Build Verification**
- Ran `npm run -C frontend build`; Next.js built successfully with the import in the client component.

**HighlightOverlay Z-Index**
- react-pdf’s text layer CSS sets `z-index: 2`. `HighlightOverlay` is absolutely positioned without a z-index and is rendered after `<Page>`, so it remains above the canvas. The text layer’s text is transparent, so highlights remain visible and interactive behavior is unchanged (`pointer-events: none` on the overlay). No z-index adjustment needed; if you ever want highlights strictly above the text layer, we can bump the overlay to `z-index: 3`.

**File Changed**
- frontend/src/components/PdfViewer/PdfViewer.tsx:5