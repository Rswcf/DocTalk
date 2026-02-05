**Per File**
- frontend/src/components/Header.tsx: LGTM. Imports correct, next-themes toggle works, dark classes applied.
- frontend/src/components/PdfViewer/PdfToolbar.tsx: LGTM. Props/types good, useEffect for page input sync correct, handlers clamp scale and pages properly, dark classes present.
- frontend/src/components/PdfViewer/PdfViewer.tsx: LGTM. Worker configured, IntersectionObserver uses container root and sensible thresholds, smooth scroll guard via isScrollingToPage works, page size capture on render is fine, useCallback/useMemo deps correct.
- frontend/src/components/Chat/ChatPanel.tsx: Issue — lucide icon name is misspelled. Import and usage should be SendHorizontal, not SendHorizonal (frontend/src/components/Chat/ChatPanel.tsx:4, frontend/src/components/Chat/ChatPanel.tsx:161). Everything else (textarea auto-resize, Enter/Shift+Enter, streaming, scroll-to-bottom, suggested questions) looks correct.
- frontend/src/components/Chat/MessageBubble.tsx: LGTM. ReactMarkdown + remark-gfm configured; citation markers inserted by offset then converted to clickable spans; copy button and feedback buttons with localStorage persistence work; dark prose styles applied.
- frontend/src/store/index.ts: LGTM. New documentName field and setter present; actions/types consistent; citation navigation updates currentPage + highlights; safe guards on page/scale.
- frontend/src/app/d/[documentId]/page.tsx: LGTM. Flex-col layout with Header; integrates PdfViewer and ChatPanel; error/empty states handled; store wiring correct.
- frontend/tailwind.config.ts: LGTM. darkMode: 'class' and typography plugin included; content globs cover app/components/pages.
- frontend/src/app/globals.css: LGTM. CSS vars for dark mode and tightened prose spacing present.
- backend/app/services/chat_service.py: LGTM. System prompt includes Markdown formatting rule; citation FSM computes offsets compatible with frontend rendering.

**Behavior Checks**
- Imports/type safety: Aside from the SendHorizontal typo, no missing imports spotted; types and hooks usage look correct under strict TS.
- Dark mode: next-themes provider with attribute="class" matches Tailwind darkMode: 'class'; components use dark: classes consistently.
- Citation integration: Offsets from backend FSM map to inserted [n] markers; ReactMarkdown components remap to clickable spans; CitationCard integration works.
- IntersectionObserver: Tracks max visible ratio within scroll container; guarded during programmatic scroll; updates store currentPage correctly.
- Textarea UX: Auto-resize via scrollHeight capping to 160px works; Enter submits, Shift+Enter inserts newline.

**Fix**
- Replace SendHorizonal with SendHorizontal in ChatPanel imports and JSX:
  - frontend/src/components/Chat/ChatPanel.tsx:4
  - frontend/src/components/Chat/ChatPanel.tsx:161

Everything else: LGTM.