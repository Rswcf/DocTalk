All set. I implemented the scroll drift fix and text-level highlights per your plan, verified with a successful build.

**What Changed**
- Added `scrollNonce` to store; updated `navigateToCitation` to keep all bboxes with page fields and bump `scrollNonce`.
- Introduced `PageWithHighlights` to render text-level highlights via `customTextRenderer`.
- Refactored `PdfViewer` to use `PageWithHighlights`, removed overlay logic/state, and wired `scrollNonce` into the scroll effect.
- Passed `scrollNonce` from the page to `PdfViewer`.
- Replaced overlay CSS with `.textLayer mark.pdf-highlight` styles.
- Exported `PageWithHighlights` in the PdfViewer barrel.

**Modified Files**
- frontend/src/store/index.ts
  - Added `scrollNonce: number;` in interface: frontend/src/store/index.ts:21
  - Added `scrollNonce: 0,` in `initialState`: frontend/src/store/index.ts:58
  - Rewrote `navigateToCitation`: frontend/src/store/index.ts:71-81

- frontend/src/components/PdfViewer/PageWithHighlights.tsx
  - New component for per-page text-level highlights: frontend/src/components/PdfViewer/PageWithHighlights.tsx:1

- frontend/src/components/PdfViewer/PdfViewer.tsx
  - Replaced overlay with `PageWithHighlights`: frontend/src/components/PdfViewer/PdfViewer.tsx:111-124
  - Added `scrollNonce` prop: frontend/src/components/PdfViewer/PdfViewer.tsx:19,22
  - Scroll effect depends on `scrollNonce`: frontend/src/components/PdfViewer/PdfViewer.tsx:31-41
  - IntersectionObserver deps simplified: frontend/src/components/PdfViewer/PdfViewer.tsx:43-73
  - Removed `pageSizes` state and `onPageRender` usage; comment placeholder: frontend/src/components/PdfViewer/PdfViewer.tsx:81

- frontend/src/app/d/[documentId]/page.tsx
  - Selected `scrollNonce` from store: frontend/src/app/d/[documentId]/page.tsx:21
  - Passed `scrollNonce` to `PdfViewer`: frontend/src/app/d/[documentId]/page.tsx:81

- frontend/src/app/globals.css
  - Removed fadeIn animations and added text highlight styles: frontend/src/app/globals.css:39-48

- frontend/src/components/PdfViewer/index.ts
  - Added `PageWithHighlights` export: frontend/src/components/PdfViewer/index.ts:3

**Build**
- Ran `npm run build` in `frontend/` — compiled successfully with type checks and linting.

**Notes**
- `HighlightOverlay` is no longer used by `PdfViewer`, but remains exported; safe to keep for now.
- If you want, I can remove the unused `Page` import in `PdfViewer.tsx` to tidy up.

Want me to run the app locally or help test a few citations to confirm highlighting and scrolling behavior?