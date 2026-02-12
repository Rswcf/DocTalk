Applied all 4 requested performance fixes with minimal scope (using the React/Next performance skill guidelines).

### What changed

1. PDF search no longer re-downloads on every keystroke  
- Added cached extracted text ref and debounce state in `frontend/src/components/PdfViewer/PdfViewer.tsx:64` and `frontend/src/components/PdfViewer/PdfViewer.tsx:69`.
- Added 300ms debounced search query in `frontend/src/components/PdfViewer/PdfViewer.tsx:89`.
- Search effect now uses cached text + `debouncedSearch` (no `pdfjs.getDocument` in search path) in `frontend/src/components/PdfViewer/PdfViewer.tsx:169`.
- Text extraction now runs once on document load and stores per-URL cache in `frontend/src/components/PdfViewer/PdfViewer.tsx:200`.

2. Streaming updates are throttled (50ms) + explicit flush on stream end  
- Added `_pendingText` / `_flushTimer` state fields and `flushPendingText` action in `frontend/src/store/index.ts:54`, `frontend/src/store/index.ts:122`, and `frontend/src/store/index.ts:185`.
- `updateLastMessage` now buffers token chunks and flushes throttled updates in `frontend/src/store/index.ts:158`.
- `ChatPanel` now calls `flushPendingText()` on stream done, error, and stop in `frontend/src/components/Chat/ChatPanel.tsx:184`, `frontend/src/components/Chat/ChatPanel.tsx:227`, `frontend/src/components/Chat/ChatPanel.tsx:285`, `frontend/src/components/Chat/ChatPanel.tsx:291`, and `frontend/src/components/Chat/ChatPanel.tsx:298`.

3. Recharts code-splitting on admin page  
- Moved all chart/recharts rendering to new `frontend/src/components/AdminCharts.tsx:1`.
- `frontend/src/app/admin/page.tsx:6` now dynamically imports that component (`ssr: false`) and renders it in `frontend/src/app/admin/page.tsx:250`.
- Removed static recharts imports from admin page.

4. Locale files lazy-loaded (keep `en` static)  
- Kept static `en` import and replaced others with dynamic loaders in `frontend/src/i18n/LocaleProvider.tsx:5` and `frontend/src/i18n/LocaleProvider.tsx:7`.
- Added runtime locale loading + cached translation map in `frontend/src/i18n/LocaleProvider.tsx:34` and `frontend/src/i18n/LocaleProvider.tsx:53`.
- Translation lookup now uses loaded locale with `en` fallback in `frontend/src/i18n/LocaleProvider.tsx:73`.

### Validation

- Targeted lint for modified files passed:
  - `cd frontend && npx next lint --file src/components/PdfViewer/PdfViewer.tsx --file src/store/index.ts --file src/components/Chat/ChatPanel.tsx --file src/app/admin/page.tsx --file src/components/AdminCharts.tsx --file src/i18n/LocaleProvider.tsx`
- Full repo lint/type checks still show pre-existing unrelated issues outside these edits (existing hook/type errors in other files).