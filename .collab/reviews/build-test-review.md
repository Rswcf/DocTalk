Here’s what I found after running the Next.js build and checking the component barrels.

Build
- Build succeeds: “Compiled successfully” with no failures.

TypeScript
- No type errors reported during “Linting and checking validity of types”.

ESLint
- No ESLint warnings or errors reported during build.

Bundle Size
- Shared first load JS: 87.3 kB (chunks: 31.7 kB, 53.6 kB).
- Routes:
  - /: 4.58 kB, First Load JS 91.9 kB
  - /_not-found: 873 B, First Load JS 88.2 kB
  - /d/[documentId]: 161 kB, First Load JS 249 kB
- Assessment: New deps (react-markdown, remark-gfm, lucide-react, next-themes, @tailwindcss/typography) add modest overhead. The larger size on /d/[documentId] is expected from pdf rendering (react-pdf/pdf.js), not these new libs. Overall size impact looks acceptable.

Barrel Exports
- PdfViewer barrel: `frontend/src/components/PdfViewer/index.ts:1` exports `PdfViewer` and `HighlightOverlay`. `PdfToolbar` is not exported; it’s imported internally by `PdfViewer` (`frontend/src/components/PdfViewer/PdfViewer.tsx:6`). This is correct unless you need to import `PdfToolbar` elsewhere.
- Chat barrel: `frontend/src/components/Chat/index.ts:1` correctly exports `ChatPanel` (and also `MessageBubble`, `CitationCard`).