All three tasks completed and verified with a clean build.

**Task 1 (P0)**
- Removed store update from observer: `frontend/src/components/PdfViewer/PdfViewer.tsx:59`
- Simplified effect deps to `[# of pages]`: `frontend/src/components/PdfViewer/PdfViewer.tsx:72`
- Outcome: No feedback loop; toolbar uses `visiblePage`; citation/toolbar jumps still work.

**Task 2 (P1)**
- Deleted dead component: `frontend/src/components/PdfViewer/HighlightOverlay.tsx`
- Removed export: `frontend/src/components/PdfViewer/index.ts:1`
- Verified no references: `rg "HighlightOverlay" frontend/src` showed only removed lines.

**Task 3 (P2)**
- Added pulse animation and keyframes: `frontend/src/app/globals.css:40`, `frontend/src/app/globals.css:51`

**Build**
- Ran `cd frontend && npm run build` → Compiled successfully with Next.js 14.

If you’d like, I can also run `npm run dev` for a quick manual check, or open a PR summary.