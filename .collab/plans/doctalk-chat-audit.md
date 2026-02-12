# DocTalk Chat UI Component Audit

**Date**: 2026-02-09
**Purpose**: Complete inventory of all chat-related frontend components, their layout, styling, state management, interactions, and dependencies.

---

## Table of Contents

1. [File Inventory Summary](#1-file-inventory-summary)
2. [ChatPanel.tsx](#2-chatpaneltsx)
3. [MessageBubble.tsx](#3-messagebubbletsx)
4. [CitationCard.tsx](#4-citationcardtsx)
5. [Chat/index.ts](#5-chatindexts)
6. [Document Reader Page (d/[documentId]/page.tsx)](#6-document-reader-page)
7. [Collections Detail Page (collections/[collectionId]/page.tsx)](#7-collections-detail-page)
8. [Zustand Store (store/index.ts)](#8-zustand-store)
9. [Type Definitions (types/index.ts)](#9-type-definitions)
10. [SSE Client (lib/sse.ts)](#10-sse-client)
11. [Export (lib/export.ts)](#11-export)
12. [Header.tsx](#12-headertsx)
13. [SessionDropdown.tsx](#13-sessiondropdowntsx)
14. [ModelSelector.tsx](#14-modelselectortsx)
15. [PaywallModal.tsx](#15-paywallmodaltsx)
16. [CreditsDisplay.tsx](#16-creditsdisplaytsx)
17. [CustomInstructionsModal.tsx](#17-custominstructionsmodaltsx)
18. [API Client (lib/api.ts)](#18-api-client)
19. [Models (lib/models.ts)](#19-models)
20. [Cross-Cutting Observations](#20-cross-cutting-observations)

---

## 1. File Inventory Summary

| File | Lines | Purpose |
|------|-------|---------|
| `components/Chat/ChatPanel.tsx` | 371 | Main chat panel: message list, input bar, demo limits, suggested questions |
| `components/Chat/MessageBubble.tsx` | 251 | Individual message rendering: markdown, citations, feedback, streaming |
| `components/Chat/CitationCard.tsx` | 47 | Citation reference card below AI messages |
| `components/Chat/index.ts` | 5 | Barrel exports |
| `app/d/[documentId]/page.tsx` | 255 | Document reader page: resizable panels layout |
| `app/collections/[collectionId]/page.tsx` | 237 | Collection detail page: ChatPanel + document sidebar |
| `store/index.ts` | 194 | Zustand global store: chat state, PDF state, sessions |
| `types/index.ts` | 141 | TypeScript interfaces: Message, Citation, NormalizedBBox, etc. |
| `lib/sse.ts` | 104 | SSE streaming client for chat endpoint |
| `lib/export.ts` | 84 | Markdown export with citation footnotes |
| `components/Header.tsx` | 89 | Top navigation bar |
| `components/SessionDropdown.tsx` | 221 | Session management dropdown in header |
| `components/ModelSelector.tsx` | 198 | LLM model picker dropdown |
| `components/PaywallModal.tsx` | 62 | Insufficient credits modal |
| `components/CreditsDisplay.tsx` | 72 | Credits balance display with auto-refresh |
| `components/CustomInstructionsModal.tsx` | 110 | Per-document custom AI instructions |
| `lib/api.ts` | 289 | REST API client functions |
| `lib/models.ts` | 38 | Model definitions and availability logic |

**No CSS files** exist in `components/Chat/` -- all styling is Tailwind utility classes.

---

## 2. ChatPanel.tsx

**File**: `frontend/src/components/Chat/ChatPanel.tsx` (371 lines)

### Purpose
Main chat panel component. Manages the message list display, text input, message sending via SSE streaming, demo message limits, suggested questions, error handling, and conversation export.

### Props Interface
```typescript
interface ChatPanelProps {
  sessionId: string;
  onCitationClick: (c: Citation) => void;
  maxUserMessages?: number;        // Demo mode: cap on user messages (5)
  suggestedQuestions?: string[];   // Document-specific suggested questions
}
```

### Layout Approach
- **Root container**: `flex h-full flex-col border-r dark:border-zinc-700` -- full-height vertical flex with right border
- **Message list area**: `flex-1 overflow-auto p-6` -- scrollable, 24px padding all sides
- **Empty state**: Centered flex column with suggested question buttons
- **Demo progress bar**: Between message list and input. 1px height bar with colored fill
- **Demo info row**: `px-4 py-2` with remaining count left, sign-in CTA right
- **Input form**: `p-4 border-t dark:border-zinc-700`
  - Input container: `flex items-end border border-zinc-200 rounded-2xl bg-white focus-within:ring-2 focus-within:ring-zinc-400 transition-shadow`
  - Textarea: `flex-1 px-4 py-3 text-sm resize-none overflow-y-auto bg-transparent`, auto-resizes to max 160px
  - Button group: `flex items-center gap-1 pr-2 pb-2 shrink-0` (export + send buttons)

### Key Tailwind Classes
- **Suggested question buttons**: `w-full text-left text-sm px-4 py-2.5 border border-zinc-100 dark:border-zinc-700 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-800 shadow-sm hover:shadow-md transition-colors text-zinc-700 dark:text-zinc-300`
- **Send button**: `p-2 bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 rounded-full disabled:opacity-40 hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors`
- **Export button**: `p-2 rounded-full text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors`
- **Demo progress bar**: `h-1 bg-zinc-200 dark:bg-zinc-800` container; fill has `transition-all duration-300`, amber when <=2 remaining
- **Demo remaining text**: `text-sm text-zinc-600 dark:text-zinc-400`, amber warning when <=2

### State Management
- **From Zustand**: `messages`, `isStreaming`, `addMessage`, `updateLastMessage`, `addCitationToLastMessage`, `setStreaming`, `updateSessionActivity`, `selectedModel`
- **Local state**: `input` (textarea text), `showPaywall` (boolean)
- **Computed**: `userMsgCount`, `demoRemaining`, `demoLimitReached`
- **Refs**: `listRef` (scroll container), `textareaRef` (auto-resize)

### Interaction Patterns
- **Message send**: `sendMessage()` -- adds user msg + empty assistant msg to store, calls `chatStream()` SSE
- **Enter key**: Sends message (Shift+Enter for newline)
- **Suggested question click**: Sets input + immediately sends
- **Auto-scroll**: `useEffect` on `messages` scrolls to bottom with `behavior: 'smooth'`
- **Auto-resize textarea**: `useEffect` on `input`, clamped to 160px max
- **Error handling**: HTTP 402 -> PaywallModal, HTTP 409 -> processing message, HTTP 429 -> rate limit vs demo limit distinction
- **Regenerate**: `handleRegenerate()` trims messages to last user msg, re-sends
- **Export**: `handleExport()` calls `exportConversationAsMarkdown()`
- **Credits refresh**: `triggerCreditsRefresh()` called on stream done

### Key Helper Functions
- **`renumberCitations()`**: Deduplicates citations by refIndex, sorts by offset (appearance order), remaps to sequential 1,2,3...
- **`MessageErrorBoundary`**: Class component error boundary wrapping each message

### Dependencies
- `react`, `next/navigation` (useRouter)
- `lucide-react`: SendHorizontal, RotateCcw, Download
- `../../lib/sse`: chatStream
- `../../lib/export`: exportConversationAsMarkdown
- `../../store`: useDocTalkStore
- `./MessageBubble`, `./CitationCard`
- `../../i18n`: useLocale
- `../PaywallModal`: PaywallModal
- `../CreditsDisplay`: triggerCreditsRefresh

### Notable Design Decisions
- Citation cards are rendered OUTSIDE MessageBubble, in a `mt-2 pl-6 space-y-2` container after each assistant message
- `renumberCitations` is called per-message at render time, not stored
- Error boundary per-message prevents one broken message from crashing chat
- `setInput('')` is called AFTER `chatStream()` resolves (not immediately after sending), but the textarea is disabled during streaming

---

## 3. MessageBubble.tsx

**File**: `frontend/src/components/Chat/MessageBubble.tsx` (251 lines)

### Purpose
Renders a single chat message. Handles user vs assistant styling, markdown rendering with citation links, streaming indicators, copy/feedback/regenerate actions.

### Props Interface
```typescript
interface MessageBubbleProps {
  message: Message;
  onCitationClick?: (c: Citation) => void;
  isStreaming?: boolean;
  onRegenerate?: () => void;
  isLastAssistant?: boolean;
}
```

### Layout Approach
- **Outer wrapper**: `w-full flex` with `justify-end` (user) or `justify-start` (assistant), `my-3` (user) or `my-4` (assistant), `group` class for hover effects
- **Content container**: `relative` with `max-w-[80%]` (user) or `w-full` (assistant)
- **User message**: `rounded-2xl px-4 py-3 bg-zinc-800 dark:bg-zinc-700 text-white shadow-sm` -- dark bubble
- **Assistant message**: No card/border/background -- just `text-zinc-900 dark:text-zinc-100` plain text
- **Error message**: `rounded-2xl px-4 py-3 bg-red-600 text-white`
- **Action buttons**: `flex gap-1 mt-2` below assistant messages (Copy, ThumbsUp, ThumbsDown, Regenerate)

### Key Tailwind Classes
- **User bubble**: `rounded-2xl px-4 py-3 bg-zinc-800 dark:bg-zinc-700 text-white shadow-sm`
- **Assistant text**: `text-sm text-zinc-900 dark:text-zinc-100` (no background, no border, no bubble)
- **Markdown prose**: `prose prose-sm dark:prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0`
- **Streaming dots**: Three `w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce` with staggered delays
- **Streaming cursor**: `inline-block w-2 h-4 bg-zinc-400 dark:bg-zinc-500 animate-pulse rounded-sm ml-0.5 align-text-bottom`
- **Citation tooltip**: `absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-xs rounded-lg shadow-lg max-w-[280px] pointer-events-none opacity-0 group-hover/cite:opacity-100 transition-opacity z-50`
- **Action buttons**: `p-1 rounded transition-colors text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300`

### Citation System
- **`insertCitationMarkers(text, citations)`**: Inserts `[n]` markers into text at citation offsets (reverse order to preserve indices)
- **`processCitationLinks(children, citations, onClick, t)`**: Recursively walks React children, replaces `[n]` text nodes with clickable buttons + hover tooltips
- **`createCitationComponent(Tag, citations, onClick, t)`**: Factory that wraps markdown elements (p, li, td, h1-h6, strong, em, blockquote) with citation processing
- **Citation button**: `inline text-zinc-600 dark:text-zinc-400 hover:underline cursor-pointer select-none font-medium bg-transparent border-none p-0`
- **Tooltip**: Shows `textSnippet` (line-clamp-3) + page number. Uses `group-hover/cite` for visibility. Arrow via CSS border trick

### Feedback System
- **State**: localStorage-persisted per message (`doctalk_fb_${messageId}`)
- **Toggle behavior**: Click same feedback = remove, click different = switch
- **ThumbsUp active**: `text-zinc-600 dark:text-zinc-400` with `fill="currentColor"`
- **ThumbsDown active**: `text-red-500 dark:text-red-400` with `fill="currentColor"`
- **Note**: Feedback is client-side only (no API call)

### Streaming States
1. **Pre-text (searching)**: 3 bouncing dots + "Searching document..." text
2. **Streaming text**: Markdown renders progressively + blinking cursor at end
3. **Complete**: Full markdown, action buttons visible

### Dependencies
- `react`, `react-markdown`, `remark-gfm`
- `lucide-react`: Copy, Check, ThumbsUp, ThumbsDown, RotateCcw
- `../../types`: Citation, Message
- `../../i18n`: useLocale

---

## 4. CitationCard.tsx

**File**: `frontend/src/components/Chat/CitationCard.tsx` (47 lines)

### Purpose
Compact card displayed below assistant messages showing a citation reference with snippet text and page number. Clicking navigates to the cited location in the document viewer.

### Props Interface
```typescript
interface CitationCardProps {
  refIndex: number;
  textSnippet: string;
  page: number;
  onClick?: () => void;
}
```

### Layout Approach
- **Root**: `<button>` element, full width, `flex items-start gap-2.5`
- **Left**: Citation number `[n]` in `text-zinc-600 dark:text-zinc-400 font-semibold`
- **Right**: Snippet text (truncated to 80 chars) + page number below

### Key Tailwind Classes
- **Card container**: `w-full text-left border border-zinc-100 dark:border-zinc-700 rounded-xl p-3 bg-white dark:bg-zinc-950 shadow-sm hover:shadow-md transition-[box-shadow,color,background-color] duration-150`
- **Snippet text**: `text-sm text-zinc-800 dark:text-zinc-200`
- **Page label**: `text-xs text-zinc-500 dark:text-zinc-400 mt-1`

### Security
- `sanitizeText()` removes control characters (preserves whitespace)
- `validPage` validates page number is finite and positive

### Dependencies
- `react`, `../../i18n`

---

## 5. Chat/index.ts

**File**: `frontend/src/components/Chat/index.ts` (5 lines)

Barrel export file:
```typescript
export { default as ChatPanel } from './ChatPanel';
export { default as MessageBubble } from './MessageBubble';
export { default as CitationCard } from './CitationCard';
```

---

## 6. Document Reader Page

**File**: `frontend/src/app/d/[documentId]/page.tsx` (255 lines)

### Purpose
Main document reading page. Two-panel layout: Chat on left, PDF/Text viewer on right, with resizable divider.

### Layout Approach
- **Root**: `flex flex-col h-screen w-full`
- **Header**: Fixed height (h-14 from Header component)
- **Content area**: `react-resizable-panels` `<Group orientation="horizontal" className="flex-1 min-h-0">`
  - **Left Panel** (Chat): `defaultSize={50} minSize={25}`
    - Inner: `h-full min-w-0 sm:min-w-[320px] flex flex-col`
    - Settings bar (logged in + ready): `flex items-center justify-end px-3 py-1 border-b border-zinc-100 dark:border-zinc-800`
    - Chat area: `flex-1 min-h-0` wrapping ChatPanel
  - **Separator**: `w-3 sm:w-1.5 bg-zinc-200 dark:bg-zinc-700 hover:bg-zinc-400 dark:hover:bg-zinc-500 transition-colors cursor-col-resize`
    - Visual handle: `w-0.5 h-8 bg-zinc-400 dark:bg-zinc-500 rounded-full`
  - **Right Panel** (Viewer): `defaultSize={50} minSize={35}`
    - PDF: `<PdfViewer>` or TextViewer based on fileType

### State Management
- Uses `useSession` from next-auth for auth status
- Zustand store for: pdfUrl, currentPage, highlights, highlightSnippet, scale, scrollNonce, sessionId, documentStatus, etc.
- Local state: error, isDemo, fileType, showInstructions, customInstructions

### Data Flow
1. **Effect 1** (documentId change): Fetches document info (polling every 3s until ready/error), fetches file URL
2. **Effect 2** (documentStatus=ready): Lists sessions, loads latest session's messages, or creates new session
3. **ChatPanel receives**: sessionId, onCitationClick=navigateToCitation, maxUserMessages (5 for demo+anonymous), suggestedQuestions

### Error State
- Full-screen centered error message with "Back Home" button

### Dependencies
- `react-resizable-panels`: Panel, Group, Separator
- `PdfViewer`, `TextViewer`, `ChatPanel`, `Header`, `CustomInstructionsModal`
- API functions: listSessions, createSession, getDocument, getDocumentFileUrl, getMessages, updateDocumentInstructions

---

## 7. Collections Detail Page

**File**: `frontend/src/app/collections/[collectionId]/page.tsx` (237 lines)

### Purpose
Cross-document chat page for document collections. ChatPanel on left, document list sidebar on right.

### Layout Approach
- **Root**: `flex flex-col h-screen w-full`
- **Content**: `flex-1 flex min-h-0`
  - **Left (Chat)**: `flex-1 min-w-0` -- ChatPanel fills available space
  - **Right (Sidebar)**: `w-72 border-l border-zinc-200 dark:border-zinc-800 flex flex-col bg-zinc-50 dark:bg-zinc-900` -- fixed 288px width
    - Header: Collection name + description
    - Document list: scrollable, each doc has FileText icon + name + remove (X) button
    - Footer: "Add Documents" button

### ChatPanel Usage
```tsx
<ChatPanel
  sessionId={sessionId}
  onCitationClick={navigateToCitation}
  // No maxUserMessages (requires auth)
  // No suggestedQuestions
/>
```

### Notable Differences from Document Page
- No resizable panels (fixed sidebar width)
- No PDF/Text viewer (chat only + doc list)
- Auth-gated (redirects to /auth if not authenticated)
- Has "Add Documents" modal with available document picker

---

## 8. Zustand Store

**File**: `frontend/src/store/index.ts` (194 lines)

### Chat-Related State

| Field | Type | Initial | Description |
|-------|------|---------|-------------|
| `sessionId` | `string \| null` | `null` | Current active session |
| `messages` | `Message[]` | `[]` | Current chat messages |
| `isStreaming` | `boolean` | `false` | Whether AI is currently streaming |
| `selectedModel` | `string` | From localStorage or DEFAULT_MODEL_ID | Selected LLM model |
| `sessions` | `SessionItem[]` | `[]` | All sessions for current document |
| `documentSummary` | `string \| null` | `null` | Auto-generated document summary |
| `suggestedQuestions` | `string[]` | `[]` | AI-generated suggested questions |
| `highlightSnippet` | `string \| null` | `null` | Text snippet for non-PDF citation highlight |

### Chat-Related Actions

| Action | Behavior |
|--------|----------|
| `addMessage(msg)` | Appends to messages array |
| `setMessages(msgs)` | Replaces entire messages array |
| `updateLastMessage(text)` | **Appends** text to last message's text (streaming) |
| `addCitationToLastMessage(citation)` | Appends citation to last message's citations array |
| `setStreaming(v)` | Sets isStreaming flag |
| `setSessionId(id)` | Sets current session |
| `setSelectedModel(id)` | Sets model + persists to localStorage |
| `setSessions(sessions)` | Replaces sessions array |
| `addSession(session)` | Prepends new session |
| `removeSession(sessionId)` | Filters out session |
| `updateSessionActivity(sessionId)` | Updates last_activity_at + message_count, re-sorts |
| `navigateToCitation(citation)` | Sets currentPage, highlights (bboxes), highlightSnippet, increments scrollNonce |
| `reset()` | Resets to initial state (preserves selectedModel, lastDocument) |

### Key Design Notes
- `updateLastMessage` **appends** text (not replaces) -- designed for streaming token accumulation
- `selectedModel` is persisted in localStorage (`doctalk_model`)
- `navigateToCitation` sets BOTH `highlights` (bbox array for PDF) and `highlightSnippet` (text for TextViewer)
- Sessions are sorted by `last_activity_at` descending after activity update

---

## 9. Type Definitions

**File**: `frontend/src/types/index.ts` (141 lines)

### Chat-Critical Types

```typescript
interface Message {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  citations?: Citation[];
  createdAt?: number;
  isError?: boolean;
}

interface Citation {
  refIndex: number;      // [n] index starting from 1
  chunkId: string;
  page: number;          // 1-based page number
  bboxes: NormalizedBBox[];
  textSnippet: string;
  offset: number;        // char offset in assistant message text
  documentId?: string;   // for cross-document citations (collections)
  documentFilename?: string;
}

interface NormalizedBBox {
  x: number; y: number; w: number; h: number;  // [0,1] normalized
  page?: number;
}

interface SessionItem {
  session_id: string;
  title: string | null;
  message_count: number;
  created_at: string;
  last_activity_at: string;
}
```

---

## 10. SSE Client

**File**: `frontend/src/lib/sse.ts` (104 lines)

### Purpose
Handles Server-Sent Events streaming for the chat endpoint.

### Function Signature
```typescript
async function chatStream(
  sessionId: string,
  message: string,
  onToken: (p: { text: string }) => void,
  onCitation: (c: Citation) => void,
  onError: (e: { code: string; message: string }) => void,
  onDone: (d: { message_id: string }) => void,
  model?: string,
  locale?: string,
)
```

### Protocol
- **Endpoint**: `POST ${PROXY_BASE}/api/sessions/${sessionId}/chat`
- **Body**: `{ message, model?, locale? }`
- **Response**: SSE stream with `\n\n` delimited events
- **Event types**:
  - `token`: `{ text }` -- incremental text chunk
  - `citation`: `{ ref_index, chunk_id, page, bboxes, text_snippet, offset, document_id?, document_filename? }` -- mapped to Citation type
  - `error`: `{ code, message }`
  - `done`: `{ message_id }`
- **Error handling**: Non-OK HTTP -> `onError` with status code in message; parse errors -> `onError`; stream read errors -> `onError`

### Key Implementation Details
- Uses `ReadableStream` reader (not EventSource) for POST support
- Manual SSE parsing: splits on `\n\n`, extracts `event:` and `data:` lines
- Citation fields are snake_case -> camelCase mapped here
- No timeout/abort controller (relies on Vercel proxy 60s maxDuration)

---

## 11. Export

**File**: `frontend/src/lib/export.ts` (84 lines)

### Purpose
Exports current conversation as a Markdown file with citation footnotes.

### Format
```markdown
# {documentName} -- Chat Export
*Exported from DocTalk on {date}*
---
**You:** {user message}
---
**DocTalk:** {assistant message with [^n] footnotes}
---
## References
[^1]: Page N -- "snippet text"
```

### Implementation
- Iterates messages, replaces `[n]` with `[^n]` footnotes for assistant messages
- Downloads as Blob with `text/markdown;charset=utf-8` MIME type
- Filename: `{sanitizedDocName}_chat_export.md`

---

## 12. Header.tsx

**File**: `frontend/src/components/Header.tsx` (89 lines)

### Purpose
Top navigation bar. Two variants: `minimal` (landing/demo/auth pages) and `full` (document/billing/profile pages).

### Layout
- **Root**: `h-14 flex items-center px-4 sm:px-6 gap-3 min-w-0 shrink-0`
- **Left**: Logo link (`DocTalk`)
- **Center** (full variant): Breadcrumb separator `/` + SessionDropdown, or "Back to document" link + Collections link
- **Right**: `ml-auto flex items-center gap-1 sm:gap-2 shrink-0` -- ModelSelector, theme toggle, CreditsDisplay (hidden on small screens), UserMenu, LanguageSelector

### Chat-Related Behaviors
- **ModelSelector hidden**: When `isDemo && !isLoggedIn` (anonymous demo users)
- **SessionDropdown**: Only shown when `documentName` is set (on document pages)
- **CreditsDisplay**: `hidden sm:block` (responsive hide on mobile)

---

## 13. SessionDropdown.tsx

**File**: `frontend/src/components/SessionDropdown.tsx` (221 lines)

### Purpose
Dropdown menu in header for managing chat sessions: switch between sessions, create new, delete current, navigate home.

### Layout
- **Trigger**: Document name text + ChevronDown icon, truncated `max-w-[140px] sm:max-w-[300px]`
- **Dropdown**: `absolute left-0 mt-1 w-72 bg-white dark:bg-zinc-900 border rounded-md shadow-lg z-20 p-1`
- **Sections**: New Chat button | "Recent Chats" label + session list (max 10, scrollable max-h-64) | Delete + Back Home

### Session Item Rendering
- Current session: `font-medium` + small dot indicator (`w-2 h-2 rounded-full bg-zinc-600`)
- Each shows: title (or "Untitled") + message count
- Delete current: red text, confirmation dialog

### Keyboard Navigation
- ArrowUp/Down: Navigate items
- Home/End: Jump to first/last
- Escape: Close dropdown, return focus to trigger
- Uses `tabIndex` roving pattern

### State
- From Zustand: documentName, documentId, sessionId, sessions, isStreaming
- Local: open, focusIndex

---

## 14. ModelSelector.tsx

**File**: `frontend/src/components/ModelSelector.tsx` (198 lines)

### Purpose
Dropdown to select LLM model. Shows tier badges ($ for budget, Pro for premium), lock icons for unavailable models.

### Layout
- **Trigger**: `flex items-center gap-1.5 px-2 py-1 border border-zinc-200 rounded-md text-sm`
  - Cpu icon + model label (hidden on mobile via `hidden sm:inline`) + ChevronDown
- **Dropdown**: `absolute right-0 mt-1 w-64 max-h-80 overflow-auto bg-white dark:bg-zinc-900 border rounded-md shadow-lg z-20 p-1`
- **Tier groups**: Separated by `border-t` dividers
  - Budget: `bg-emerald-50` background, `$` badge
  - Standard: No special background
  - Premium: `bg-amber-50` background, `Pro` badge

### Gating Logic
- `isModelAvailable(modelId, userPlan)` checks plan hierarchy
- Unavailable models: `opacity-50 cursor-not-allowed` + Lock icon
- Click unavailable (logged in): redirect to `/billing`
- Click unavailable (anonymous): open auth modal (`?auth=1`)

### Keyboard Navigation
- Same pattern as SessionDropdown: Arrow keys, Home, End, Escape

---

## 15. PaywallModal.tsx

**File**: `frontend/src/components/PaywallModal.tsx` (62 lines)

### Purpose
Modal shown when user tries to chat with insufficient credits (HTTP 402).

### Layout
- **Overlay**: `fixed inset-0 z-50 flex items-center justify-center bg-black/40 animate-fade-in`
- **Modal**: `bg-white dark:bg-zinc-900 border rounded-2xl p-6 max-w-md w-full mx-4 shadow-xl animate-slide-up`
- **Buttons**: "Buy Credits" (primary) + "Cancel" (secondary)

### Interactions
- Click overlay -> close
- Escape key -> close
- "Buy Credits" -> `window.location.href = "/billing"`
- Auto-focuses overlay on open
- `aria-modal="true"`, `role="dialog"`

---

## 16. CreditsDisplay.tsx

**File**: `frontend/src/components/CreditsDisplay.tsx` (72 lines)

### Purpose
Shows remaining credits count in header. Auto-refreshes every 60s and on custom events.

### Layout
- `flex items-center gap-1 text-sm text-zinc-600 dark:text-zinc-400`
- Shows: `{credits} credits`
- Hidden when not authenticated or credits not yet loaded

### Refresh Mechanism
- **Periodic**: `setInterval(fetchCredits, 60_000)`
- **Event-driven**: `window.addEventListener('doctalk:credits-refresh', fetchCredits)`
- **Exported function**: `triggerCreditsRefresh()` dispatches the custom event
- Called from ChatPanel on stream completion and purchase completion

### Side Effect
- Also fetches user profile to set `userPlan` in Zustand store (for ModelSelector gating)

---

## 17. CustomInstructionsModal.tsx

**File**: `frontend/src/components/CustomInstructionsModal.tsx` (110 lines)

### Purpose
Modal for setting per-document custom AI instructions. Max 2000 characters.

### Layout
- **Overlay**: `fixed inset-0 z-50 flex items-center justify-center bg-black/50`
- **Modal**: `bg-white dark:bg-zinc-900 rounded-2xl shadow-xl w-full max-w-lg mx-4 p-6 animate-fade-in`
- **Content**: Title + description + textarea + char counter + Save/Clear buttons

### Interactions
- Click overlay -> close
- Auto-focuses textarea on open
- Character limit enforced in onChange handler (`slice(0, MAX_CHARS)`)
- Save: calls `onSave(text.trim() || null)`, shows "Saved" confirmation for 2s
- Clear: calls `onSave(null)`, resets text

---

## 18. API Client

**File**: `frontend/src/lib/api.ts` (289 lines)

### Chat-Related Functions

| Function | Endpoint | Description |
|----------|----------|-------------|
| `createSession(docId)` | `POST /api/documents/{id}/sessions` | Creates new chat session |
| `getMessages(sessionId)` | `GET /api/sessions/{id}/messages` | Loads message history, maps snake_case to camelCase |
| `listSessions(docId)` | `GET /api/documents/{id}/sessions` | Lists sessions for document |
| `deleteSession(sessionId)` | `DELETE /api/sessions/{id}` | Deletes a session |
| `createCollectionSession(collectionId)` | `POST /api/collections/{id}/sessions` | Creates session for collection |
| `listCollectionSessions(collectionId)` | `GET /api/collections/{id}/sessions` | Lists collection sessions |
| `updateDocumentInstructions(docId, instructions)` | `PATCH /api/documents/{id}` | Updates custom instructions |

### Message Mapping (getMessages)
Backend returns: `{ role, content, citations: [{ ref_index, chunk_id, page, bboxes, text_snippet, offset }], created_at }`
Frontend maps to: `{ id: "msg_{idx}", role, text: content, citations: [{ refIndex, chunkId, page, bboxes, textSnippet, offset }], createdAt }`

All requests go through `PROXY_BASE = '/api/proxy'` for JWT injection.

---

## 19. Models

**File**: `frontend/src/lib/models.ts` (38 lines)

### Available Models (9 total)
**Budget tier** (free): Grok 4.1 Fast, DeepSeek V3.2, MiniMax M2.1, Kimi K2.5, Gemini 3 Flash
**Standard tier** (free): GPT-5.2, Gemini 3 Pro, Claude Sonnet 4.5 (default)
**Premium tier** (plus+): Claude Opus 4.6

### Plan Hierarchy
`free: 0, plus: 1, pro: 2` -- model available if user level >= required level

---

## 20. Cross-Cutting Observations

### Design System Consistency
- **Color palette**: Strictly monochrome zinc. Only exceptions: emerald (budget tier), amber (premium tier, demo warning), red (errors, thumbs-down, delete), green (save confirmation)
- **Border radius**: `rounded-2xl` for cards/modals/input, `rounded-xl` for citation cards/buttons, `rounded-full` for send button, `rounded-md` for dropdowns, `rounded-lg` for secondary buttons
- **Shadows**: `shadow-sm` default, `shadow-md` hover for interactive cards, `shadow-lg` for dropdowns, `shadow-xl` for modals
- **Transitions**: `transition-colors` everywhere, `transition-shadow` on input container, `transition-opacity` on tooltips. No `transition-all`
- **Animations**: `animate-fade-in` (modals), `animate-slide-up` (paywall), `animate-bounce` (streaming dots), `animate-pulse` (streaming cursor), `animate-spin` (loading spinner)
- **Dark mode**: Consistent `dark:` variants throughout. Dark backgrounds: `dark:bg-zinc-950` (page), `dark:bg-zinc-900` (modals/cards), `dark:bg-zinc-800` (input/hover), `dark:bg-zinc-700` (borders/user bubble)

### Message Layout Pattern (ChatGPT-style)
- **User messages**: Right-aligned, max-width 80%, dark rounded bubble with white text
- **Assistant messages**: Left-aligned, full-width, no card/border/background, plain text with prose styling
- **Action buttons**: Below assistant message (not inside), always visible (not hover-only)
- **Citation cards**: Below action buttons, full-width, left-indented `pl-6`

### Chat Input Pattern
- **Unified container**: Single rounded border wrapping textarea + buttons
- **Focus indicator**: `focus-within:ring-2` on container (not on textarea)
- **Auto-resize**: JavaScript-driven, capped at 160px
- **Button placement**: Inside container, bottom-right aligned

### Data Flow Architecture
```
User types message
  -> ChatPanel.sendMessage()
    -> addMessage(userMsg) to Zustand
    -> addMessage(empty assistantMsg) to Zustand
    -> setStreaming(true)
    -> chatStream() SSE
      -> onToken: updateLastMessage(text) [appends]
      -> onCitation: addCitationToLastMessage(citation)
      -> onError: handle 402/409/429/generic
      -> onDone: setStreaming(false), triggerCreditsRefresh()
```

### Component Hierarchy (Document Page)
```
DocumentReaderPage
  +-- Header (variant="full", isDemo, isLoggedIn)
  |     +-- SessionDropdown
  |     +-- ModelSelector (hidden if anonymous demo)
  |     +-- CreditsDisplay
  |     +-- UserMenu
  |     +-- LanguageSelector
  +-- Group (react-resizable-panels)
        +-- Panel (left, 50%)
        |     +-- Settings bar (Settings2 icon for CustomInstructionsModal)
        |     +-- ChatPanel
        |           +-- MessageErrorBoundary
        |           |     +-- MessageBubble
        |           |     +-- CitationCard[]
        |           +-- Demo progress bar (conditional)
        |           +-- Input form (textarea + export + send)
        |           +-- PaywallModal
        +-- Separator (draggable)
        +-- Panel (right, 50%)
              +-- PdfViewer OR TextViewer
  +-- CustomInstructionsModal
```

### Component Hierarchy (Collection Page)
```
CollectionDetailPage
  +-- Header (variant="full")
  +-- Flex container
        +-- ChatPanel (flex-1)
        +-- Document sidebar (w-72, fixed)
              +-- Collection info
              +-- Document list
              +-- Add Documents button
  +-- Add Documents Modal
```

### Key Dimensions & Spacing
- Header height: `h-14` (56px)
- Chat message list padding: `p-6` (24px)
- Input form padding: `p-4` (16px)
- Citation cards margin: `mt-2 pl-6` (8px top, 24px left)
- Citation card padding: `p-3` (12px)
- User message padding: `px-4 py-3`
- Panel separator: `w-3 sm:w-1.5` (12px mobile, 6px desktop)
- Panel defaults: 50/50 split, chat minSize=25%, viewer minSize=35%
- Suggested question buttons: `px-4 py-2.5`
- Action button size: `p-1` with 14px icons
- Send button: `p-2` with 16px icon
- Textarea: min-height 40px, max-height 160px

### i18n Keys Used by Chat Components
**Chat**: `chat.placeholder`, `chat.send`, `chat.trySuggested`, `chat.suggestedQ1-Q4`, `chat.searching`, `chat.error`, `chat.networkError`, `chat.regenerate`, `chat.export`
**Demo**: `demo.questionsRemaining`, `demo.signInForUnlimited`, `demo.signInToContinue`, `demo.limitReachedMessage`, `demo.rateLimitMessage`
**Citation**: `citation.page`, `citation.jumpTo`
**Credits**: `credits.insufficientCredits`, `credits.purchasePrompt`, `credits.buyCredits`, `credits.credits`
**Document**: `doc.processing`, `doc.notFound`, `doc.loadError`, `doc.backHome`, `doc.loading`, `doc.initChat`
**Session**: `session.newChat`, `session.recentChats`, `session.noTitle`, `session.messageCount`, `session.deleteChat`, `session.deleteChatConfirm`, `session.backHome`
**Instructions**: `instructions.title`, `instructions.description`, `instructions.placeholder`, `instructions.charLimit`, `instructions.save`, `instructions.saved`, `instructions.clear`
**Feedback**: `feedback.helpful`, `feedback.notHelpful`
**Copy**: `copy.button`, `copy.copied`
**Common**: `common.cancel`, `common.loading`
**Models**: `header.model`, `models.upgradeToPlusTooltip`, `models.signInToUnlock`

### Potential Areas for UI Enhancement
1. **No sidebar/conversation list**: Session management is tucked into a small header dropdown (max 10 sessions visible)
2. **No message editing**: Users cannot edit sent messages
3. **No stop generation**: No button to abort streaming response
4. **No message timestamps**: createdAt is stored but never displayed
5. **Feedback is local-only**: ThumbsUp/Down stored in localStorage, no server-side persistence
6. **No typing indicator**: No visual indication that the system is preparing a response before streaming starts (only the bouncing dots during "Searching document...")
7. **No drag-and-drop file upload**: Only button-based upload in dashboard
8. **Citation cards always expanded**: No collapse/expand for long citation lists
9. **No message search/filter**: Cannot search within conversation history
10. **Export only as Markdown**: No PDF/text/JSON export options
11. **No multi-turn context display**: Cannot see which messages were in context for a response
12. **Input bar fixed at bottom**: No floating input option for long scrolled conversations
13. **No suggested follow-ups**: Only initial suggested questions, no follow-up suggestions after AI responds
14. **No streaming cancel/stop**: Cannot abort an in-flight streaming response

---

*End of audit*
