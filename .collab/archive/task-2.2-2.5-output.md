I’ve read the tech spec and tasks, then implemented Tasks 2.2–2.5 across the frontend. No installs run; all imports are local and compatible with the current setup.

**Summary**
- PDF Viewer with react-pdf, scroll-to-page, and highlight overlay with normalized coords.
- Chat UI with streaming SSE consumer, inline [n] markers at offsets, and citation cards.
- Zustand store wiring for document/chat state and navigateToCitation → page jump + highlight.
- Upload page (drag & drop + progress polling + “我的文档”) and viewer route with split layout.

**Key Files**
- Types: frontend/src/types/index.ts:1
- Store: frontend/src/store/index.ts:1
- API client: frontend/src/lib/api.ts:1
- SSE consumer: frontend/src/lib/sse.ts:1
- PDF Viewer:
  - frontend/src/components/PdfViewer/PdfViewer.tsx:1
  - frontend/src/components/PdfViewer/HighlightOverlay.tsx:1
  - frontend/src/components/PdfViewer/index.ts:1
- Chat UI:
  - frontend/src/components/Chat/ChatPanel.tsx:1
  - frontend/src/components/Chat/MessageBubble.tsx:1
  - frontend/src/components/Chat/CitationCard.tsx:1
  - frontend/src/components/Chat/index.ts:1
- Pages:
  - Upload page: frontend/src/app/page.tsx:1
  - Reader page: frontend/src/app/d/[documentId]/page.tsx:1
  - Reader layout: frontend/src/app/d/[documentId]/layout.tsx:1

**Task 2.2: PDF Viewer + 高亮 Overlay**
- Uses react-pdf `Document` + `Page`; worker via CDN set in client component.
- Renders all pages in a scrollable column; scrolls to `currentPage`.
- Overlay maps normalized `[0,1]` bboxes to CSS absolute positions; pulse highlight styling.
- Page size measured from rendered canvas for correct overlay during zoom.
- Files: PdfViewer.tsx, HighlightOverlay.tsx, index.ts.

**Task 2.3: Chat + SSE**
- `chatStream` parses POST SSE stream: token/citation/error/done, using fetch + ReadableStream.
- ChatPanel streams assistant text, inserts [n] spans at citation offsets, and shows citation cards below each assistant message.
- Click handlers propagate to PDF via provided `onCitationClick`.
- Files: lib/sse.ts, components/Chat/*.

**Task 2.4: Zustand 联动**
- Store includes document, pdf, chat states and actions exactly per spec.
- `navigateToCitation` sets `currentPage` and `highlights` to drive PdfViewer scroll + overlay.
- Files: store/index.ts.

**Task 2.5: 页面布局**
- 上传页: drag & drop + file input; calls `uploadDocument`, polls `getDocument` every 2s for status; saves to localStorage “我的文档”; auto-navigates on ready.
- 阅读页: two-column layout, left `PdfViewer` (flex-1), right `ChatPanel` (w-[400px]).
  1) `getDocument(documentId)` for status
  2) `getDocumentFileUrl(documentId)` for PDF URL → PdfViewer
  3) `createSession(documentId)` → ChatPanel
- Files: app/page.tsx, app/d/[documentId]/page.tsx, app/d/[documentId]/layout.tsx.

**Implementation Notes**
- Tailwind used for layout/styling; highlight uses `bg-yellow-300/40` + `animate-pulse`.
- Inline citation markers split assistant text at `offset` positions; clicking triggers PDF jump.
- PDF overlay only displays highlights for the `currentPage` (others have empty lists).
- API base configurable: `NEXT_PUBLIC_API_BASE` with default `http://localhost:8000`.

**Status Updates**
- Marked as DONE in .collab/tasks/current.md for 2.2, 2.3, 2.4, 2.5.

If you’d like, I can add zoom controls, refine citation deduping per message, or load chat history on demand.