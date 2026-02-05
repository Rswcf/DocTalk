All steps executed and documented. I also fixed a minor dark-mode animation edge case and re-validated.

**Results**
- Step 1 — Build: Passed with no TS errors (`cd frontend && npm run build`).
- Step 2 — Lint: No warnings or errors (`cd frontend && npx next lint`).
- Step 3 — Dead code: No “HighlightOverlay” references in `frontend/src` or broader `frontend/` (excluding `node_modules`).
- Step 4 — Store flow:
  - `setPage` only writes `currentPage` in store: frontend/src/store/index.ts:68
  - Citation click updates page/highlights/scrollNonce: frontend/src/store/index.ts:71
  - PdfViewer calls `setPage` only from user action via toolbar: frontend/src/components/PdfViewer/PdfViewer.tsx:82
  - IntersectionObserver only sets local `visiblePage` (no store writes): frontend/src/components/PdfViewer/PdfViewer.tsx:43
  - Parent wires store → PdfViewer props and ChatPanel → `navigateToCitation`: frontend/src/app/d/[documentId]/page.tsx:80
  - Global search confirms single `setPage(...)` call site in PdfViewer.
- Step 5 — CSS animation:
  - Changed to CSS variables so 100% of keyframes equals static background in both themes:
    - Vars defined: frontend/src/app/globals.css:5,13
    - Highlight rule uses var: frontend/src/app/globals.css:46
    - Keyframes use vars: frontend/src/app/globals.css:54
  - This removes potential end-of-animation “flash” in dark mode.
- Step 6 — Potential issues:
  - No unused variable/import warnings found by lint; `isScrollingToPage` timeout (800ms) reasonable; `scrollNonce` compatibility verified in dependencies and store usage.
- Step 7 — Fix + re-build: Applied CSS variable fix and re-built; build passed.

**Changes Made**
- frontend/src/app/globals.css: Introduced `--highlight-base` and `--highlight-strong`, used them in `.pdf-highlight` and `@keyframes highlightPulse`, removed explicit dark override to rely on variables.

**Task File**
- Updated `.collab/tasks/current.md` STATUS to DONE and added detailed CX_NOTES for each step.

Want me to run a quick visual check (dark/light toggle) locally, or proceed to commit these changes?