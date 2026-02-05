# Plan v2: Layout Redesign + Model Switcher + Language Switcher

> Revised based on Codex review feedback (see `.collab/reviews/review-layout-model-i18n.md`)

---

## Feature 1: Layout Swap + Resizable Divider

### Install

```bash
cd frontend && npm install react-resizable-panels
```

### Files to modify

#### `frontend/src/app/d/[documentId]/page.tsx`

Replace the current flex layout (lines 78-93) with `react-resizable-panels`:

```tsx
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';

// Inside the return:
<PanelGroup direction="horizontal" className="flex-1 min-h-0">
  {/* Chat — left */}
  <Panel defaultSize={35} minSize={25}>
    <div className="h-full min-w-[320px]">
      {sessionId ? (
        <ChatPanel sessionId={sessionId} onCitationClick={navigateToCitation} />
      ) : (
        <div className="h-full w-full flex items-center justify-center text-gray-500">{t('doc.initChat')}</div>
      )}
    </div>
  </Panel>

  {/* Resize handle */}
  <PanelResizeHandle
    className="w-1.5 bg-gray-200 dark:bg-gray-700 hover:bg-blue-400 dark:hover:bg-blue-500 transition-colors cursor-col-resize flex items-center justify-center"
    aria-label="Resize panels"
  >
    <div className="w-0.5 h-8 bg-gray-400 dark:bg-gray-500 rounded-full" />
  </PanelResizeHandle>

  {/* PDF — right */}
  <Panel defaultSize={65} minSize={35}>
    <div className="h-full">
      {pdfUrl ? (
        <PdfViewer pdfUrl={pdfUrl} currentPage={currentPage} highlights={highlights} scale={scale} scrollNonce={scrollNonce} />
      ) : (
        <div className="h-full w-full flex items-center justify-center text-gray-500">{t('doc.loading')}</div>
      )}
    </div>
  </Panel>
</PanelGroup>
```

Key details (addressing review):
- `direction="horizontal"` — correct API for `react-resizable-panels`
- `className="flex-1 min-h-0"` on PanelGroup — preserves overflow/scroll behavior
- `min-w-[320px]` wrapper inside Chat Panel — enforces minimum pixel width
- `aria-label` on resize handle for accessibility
- Each `Panel` child has `h-full` to fill available space

Remove the old `<div className="flex flex-1 min-h-0">` wrapper and the `w-[400px]`/`min-w-[320px]`/`max-w-[480px]` styles.

#### `frontend/src/components/Chat/ChatPanel.tsx`

Line 124: Change `border-l` to `border-r` since Chat is now on the left:
```
- "flex h-full flex-col border-l dark:border-gray-700"
+ "flex h-full flex-col border-r dark:border-gray-700"
```

---

## Feature 2: Model Switcher

### Model list

```typescript
// frontend/src/lib/models.ts
export interface ModelOption {
  id: string;
  label: string;
  provider: string;
}

export const DEFAULT_MODEL_ID = "anthropic/claude-sonnet-4.5";

export const AVAILABLE_MODELS: ModelOption[] = [
  { id: "anthropic/claude-sonnet-4.5", label: "Claude Sonnet 4.5", provider: "Anthropic" },
  { id: "anthropic/claude-opus-4.5", label: "Claude Opus 4.5", provider: "Anthropic" },
  { id: "openai/gpt-5.2", label: "GPT-5.2", provider: "OpenAI" },
  { id: "openai/gpt-5.2-pro", label: "GPT-5.2 Pro", provider: "OpenAI" },
  { id: "google/gemini-3-pro-preview", label: "Gemini 3 Pro", provider: "Google" },
  { id: "deepseek/deepseek-v3.2", label: "DeepSeek V3.2", provider: "DeepSeek" },
  { id: "mistralai/mistral-large-2512", label: "Mistral Large", provider: "Mistral" },
  { id: "qwen/qwen3-coder-next", label: "Qwen3 Coder", provider: "Qwen" },
];
```

### Frontend changes

#### `frontend/src/store/index.ts`

Add to interface and state:
```typescript
// In DocTalkStore interface:
selectedModel: string;
setSelectedModel: (id: string) => void;

// In initialState:
selectedModel: localStorage.getItem('doctalk_model') || "anthropic/claude-sonnet-4.5",

// In create():
setSelectedModel: (id: string) => {
  set({ selectedModel: id });
  try { localStorage.setItem('doctalk_model', id); } catch {}
},

// In reset(): DON'T reset selectedModel (persist across sessions)
```

Note: Since Zustand `create` runs at module load, use a safe pattern for localStorage:
```typescript
// initialState:
selectedModel: "anthropic/claude-sonnet-4.5",

// Then in the store, add a hydration effect or use zustand persist middleware.
// Simplest approach: read from localStorage in the initialState safely:
selectedModel: (typeof window !== 'undefined' ? localStorage.getItem('doctalk_model') : null) || "anthropic/claude-sonnet-4.5",
```

#### `frontend/src/components/ModelSelector.tsx` — New file

A dropdown button:
- Shows current model short label (e.g. "Claude Sonnet 4.5") with a ChevronDown icon
- Click toggles a dropdown popover (positioned with `absolute`)
- Models grouped by provider
- Selected model shows a checkmark
- Close dropdown on outside click (useEffect with click listener)
- **Disable while `isStreaming`** (read from store) — show cursor-not-allowed, ignore clicks
- Use lucide `Cpu` or `Sparkles` icon prefix

#### `frontend/src/components/Header.tsx`

Add ModelSelector between doc name and the theme toggle:
```tsx
<div className="ml-auto flex items-center gap-2">
  <ModelSelector />
  <button onClick={toggleTheme} ... />
  <LanguageSelector />
</div>
```

#### `frontend/src/lib/sse.ts`

Add optional `model` parameter:
```typescript
export async function chatStream(
  sessionId: string,
  message: string,
  onToken: (p: TokenPayload) => void,
  onCitation: (c: Citation) => void,
  onError: (e: ErrorPayload) => void,
  onDone: (d: DonePayload) => void,
  model?: string,
) {
  const res = await fetch(`${API_BASE}/api/sessions/${sessionId}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, ...(model ? { model } : {}) }),
  });
  // ... rest unchanged
}
```

#### `frontend/src/components/Chat/ChatPanel.tsx`

Read model from store, pass to chatStream:
```typescript
const selectedModel = useDocTalkStore((s) => s.selectedModel);

// In sendMessage callback, add selectedModel to chatStream call:
await chatStream(sessionId, text, onToken, onCitation, onError, onDone, selectedModel);
```

### Backend changes

#### `backend/app/schemas/chat.py`

```python
class ChatRequest(BaseModel):
    message: str
    model: Optional[str] = None  # OpenRouter model ID override
```

#### `backend/app/core/config.py`

Add allowed models list:
```python
ALLOWED_MODELS: list[str] = Field(default=[
    "anthropic/claude-sonnet-4.5",
    "anthropic/claude-opus-4.5",
    "openai/gpt-5.2",
    "openai/gpt-5.2-pro",
    "google/gemini-3-pro-preview",
    "deepseek/deepseek-v3.2",
    "mistralai/mistral-large-2512",
    "qwen/qwen3-coder-next",
])
```

#### `backend/app/api/chat.py`

Pass model to service:
```python
# Line 51: add model parameter
async for ev in chat_service.chat_stream(session_id, body.message, db, model=body.model):
```

#### `backend/app/services/chat_service.py`

1. Add `model: Optional[str] = None` to `chat_stream` signature:
```python
async def chat_stream(
    self, session_id: uuid.UUID, user_message: str, db: AsyncSession,
    model: Optional[str] = None,
) -> AsyncGenerator[Dict[str, Any], None]:
```

2. Validate and select model (before the API call, around line 224):
```python
# Validate model selection
effective_model = settings.LLM_MODEL  # default
if model and model in settings.ALLOWED_MODELS:
    effective_model = model
```

3. Use `effective_model` in the API call (line 226):
```python
stream = await client.chat.completions.create(
    model=effective_model,   # was: settings.LLM_MODEL
    max_tokens=2048,
    messages=openai_messages,
    stream=True,
)
```

This ensures: per-request model override, no global mutation, whitelist validation, graceful fallback to default.

---

## Feature 3: Language Switcher (i18n)

### 8 Languages

| Code | Language | Native Name | Flag |
|------|----------|-------------|------|
| `en` | English | English | 🇺🇸 |
| `zh` | Chinese | 中文 | 🇨🇳 |
| `hi` | Hindi | हिन्दी | 🇮🇳 |
| `es` | Spanish | Español | 🇪🇸 |
| `ar` | Arabic | العربية | 🇸🇦 |
| `fr` | French | Français | 🇫🇷 |
| `bn` | Bengali | বাংলা | 🇧🇩 |
| `pt` | Portuguese | Português | 🇧🇷 |

### File structure

```
frontend/src/i18n/
├── index.ts              # Types, LOCALES array, useLocale hook
├── LocaleProvider.tsx     # Client provider component
└── locales/
    ├── en.json
    ├── zh.json
    ├── hi.json
    ├── es.json
    ├── ar.json
    ├── fr.json
    ├── bn.json
    └── pt.json
```

### Complete translation keys

All user-visible strings across all components:

```json
{
  "app.title": "DocTalk",
  "app.subtitle": "Upload a PDF to start chatting.",

  "upload.dragDrop": "Drag & drop your PDF here",
  "upload.or": "or",
  "upload.chooseFile": "Choose File",
  "upload.uploading": "Uploading…",
  "upload.parsing": "Parsing…",
  "upload.parsingProgress": "Parsing pages: {pagesParsed}, indexing: {chunksIndexed}",
  "upload.error": "Error during processing",
  "upload.networkError": "Upload failed, please check network or try again later",
  "upload.pdfOnly": "Please upload a PDF file",
  "upload.tooLarge": "File size cannot exceed 50MB",

  "doc.myDocuments": "My Documents",
  "doc.noDocuments": "No documents yet",
  "doc.open": "Open",
  "doc.notFound": "Document not found",
  "doc.loadError": "Failed to load document info",
  "doc.backHome": "Back to Home",
  "doc.loading": "Loading document…",
  "doc.initChat": "Initializing chat…",
  "doc.pdfLoadError": "Unable to load PDF. Please refresh or try again later.",
  "doc.pdfLoading": "Loading PDF…",

  "chat.placeholder": "Type a question…",
  "chat.send": "Send",
  "chat.trySuggested": "Try one of these questions to start:",
  "chat.suggestedQ1": "Summarize the key points of this document",
  "chat.suggestedQ2": "What are the main conclusions?",
  "chat.suggestedQ3": "What key concepts does this document cover?",
  "chat.suggestedQ4": "List important data and findings",
  "chat.error": "Chat error: ",
  "chat.networkError": "Network error, please try again later",

  "citation.jumpTo": "Jump to page {page}",

  "toolbar.zoomIn": "Zoom in",
  "toolbar.zoomOut": "Zoom out",
  "toolbar.prevPage": "Previous page",
  "toolbar.nextPage": "Next page",

  "header.darkMode": "Switch to dark mode",
  "header.lightMode": "Switch to light mode",
  "header.model": "Model",
  "header.language": "Language",

  "copy.button": "Copy",
  "copy.copied": "Copied",
  "feedback.helpful": "Helpful",
  "feedback.notHelpful": "Not helpful",

  "error.somethingWrong": "Something went wrong",
  "error.refresh": "Refresh page"
}
```

### Implementation

#### `frontend/src/i18n/index.ts`

```typescript
"use client";
import { createContext, useContext } from 'react';

export type Locale = 'en' | 'zh' | 'hi' | 'es' | 'ar' | 'fr' | 'bn' | 'pt';

export interface LocaleInfo {
  code: Locale;
  label: string;
  flag: string;
}

export const LOCALES: LocaleInfo[] = [
  { code: 'en', label: 'English', flag: '🇺🇸' },
  { code: 'zh', label: '中文', flag: '🇨🇳' },
  { code: 'hi', label: 'हिन्दी', flag: '🇮🇳' },
  { code: 'es', label: 'Español', flag: '🇪🇸' },
  { code: 'ar', label: 'العربية', flag: '🇸🇦' },
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
  { code: 'bn', label: 'বাংলা', flag: '🇧🇩' },
  { code: 'pt', label: 'Português', flag: '🇧🇷' },
];

export interface LocaleContextValue {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}

export const LocaleContext = createContext<LocaleContextValue>({
  locale: 'en',
  setLocale: () => {},
  t: (key) => key,
});

export function useLocale() {
  return useContext(LocaleContext);
}
```

#### `frontend/src/i18n/LocaleProvider.tsx`

```typescript
"use client";
import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { LocaleContext, Locale, LOCALES } from './index';

// Static imports of all locale files (bundled, ~1KB each)
import en from './locales/en.json';
import zh from './locales/zh.json';
import hi from './locales/hi.json';
import es from './locales/es.json';
import ar from './locales/ar.json';
import fr from './locales/fr.json';
import bn from './locales/bn.json';
import pt from './locales/pt.json';

const translations: Record<Locale, Record<string, string>> = { en, zh, hi, es, ar, fr, bn, pt };

function detectLocale(): Locale {
  // Check localStorage first
  const stored = typeof window !== 'undefined' ? localStorage.getItem('doctalk_locale') : null;
  if (stored && LOCALES.some(l => l.code === stored)) return stored as Locale;

  // Detect from navigator.language, map variants like 'pt-BR' → 'pt', 'zh-CN' → 'zh'
  if (typeof navigator !== 'undefined') {
    const nav = navigator.language;
    const prefix = nav.split('-')[0] as Locale;
    if (LOCALES.some(l => l.code === prefix)) return prefix;
  }
  return 'en';
}

export default function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('en'); // SSR-safe default

  // Hydrate from localStorage/navigator on mount
  useEffect(() => {
    setLocaleState(detectLocale());
  }, []);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    try { localStorage.setItem('doctalk_locale', l); } catch {}
  }, []);

  // Update <html lang> and dir via client effect (NOT in layout.tsx server component)
  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = locale === 'ar' ? 'rtl' : 'ltr';
  }, [locale]);

  const t = useCallback((key: string, params?: Record<string, string | number>): string => {
    let str = translations[locale]?.[key] || translations['en']?.[key] || key;
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        str = str.replace(`{${k}}`, String(v));
      });
    }
    return str;
  }, [locale]);

  const value = useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t]);

  return (
    <LocaleContext.Provider value={value}>
      {children}
    </LocaleContext.Provider>
  );
}
```

Key decisions (addressing review feedback):
- `<html lang>` and `dir` are set via `document.documentElement` in a client `useEffect`, NOT in `layout.tsx` (which is a server component with `export const metadata`)
- `layout.tsx` stays as-is: just wraps children with `<LocaleProvider>` inside `<ThemeProvider>`
- Navigator language detection maps `pt-BR` → `pt`, `zh-CN` → `zh` etc.
- The `t()` function supports simple `{param}` interpolation for strings like "Jump to page {page}"
- Fallback chain: current locale → English → raw key

#### `frontend/src/app/layout.tsx`

Add `LocaleProvider` wrapping:
```tsx
import LocaleProvider from '../i18n/LocaleProvider';

// Keep <html lang="en"> as static default (client effect will update it)
<ThemeProvider>
  <LocaleProvider>
    <ErrorBoundary>{children}</ErrorBoundary>
  </LocaleProvider>
</ThemeProvider>
```

#### `frontend/src/components/LanguageSelector.tsx` — New file

A dropdown button similar to ModelSelector:
- Shows globe icon (lucide `Globe`) + current locale code (e.g. "EN")
- Click opens dropdown with all 8 languages showing flag + native name
- Selected language has checkmark
- Close on outside click
- Saves to localStorage via `setLocale`

### Components to update with `t()` calls

All hardcoded strings replaced with `useLocale().t('key')`:

1. **`frontend/src/app/page.tsx`** — Homepage: title, subtitle, upload strings, error messages, "我的文档", "暂无历史文档", "打开"
2. **`frontend/src/app/d/[documentId]/page.tsx`** — "文档不存在", "加载文档信息失败", "返回首页", loading placeholders
3. **`frontend/src/components/Chat/ChatPanel.tsx`** — SUGGESTED_QUESTIONS array, "输入问题…", error messages, "试试以下问题开始对话："
4. **`frontend/src/components/Chat/MessageBubble.tsx`** — "复制" tooltip, feedback button tooltips
5. **`frontend/src/components/PdfViewer/PdfToolbar.tsx`** — "Zoom in/out", "Previous/Next page" titles
6. **`frontend/src/components/PdfViewer/PdfViewer.tsx`** — "Loading PDF…", PDF error message
7. **`frontend/src/components/Header.tsx`** — theme toggle tooltip
8. **`frontend/src/components/ErrorBoundary.tsx`** — "出了点问题", "刷新页面"

Note: ErrorBoundary is a class component that can't use hooks. For this, either:
- Convert to a functional component wrapped with an error boundary HOC, OR
- Keep the class component with hardcoded English + Chinese fallback (simplest, since error states are rare)

**Decision: Keep ErrorBoundary as-is with hardcoded strings** — it's a rare error state and converting a class-based error boundary to use hooks is complex.

---

## Execution Order

1. `cd frontend && npm install react-resizable-panels`
2. Create i18n infrastructure: `i18n/index.ts`, `LocaleProvider.tsx`, all 8 locale JSON files
3. Create `LanguageSelector.tsx`
4. Create `lib/models.ts`, `ModelSelector.tsx`
5. Update `store/index.ts` — add `selectedModel` + `setSelectedModel` with localStorage persistence
6. Update `layout.tsx` — add `LocaleProvider`
7. Update `Header.tsx` — add ModelSelector + LanguageSelector
8. Update `page.tsx` (document reader) — PanelGroup layout swap
9. Update `ChatPanel.tsx` — border swap + pass model to chatStream + i18n strings
10. Update `sse.ts` — add `model` parameter
11. Update all components with `t()` calls (page.tsx homepage, PdfToolbar, MessageBubble, PdfViewer)
12. Backend: update `schemas/chat.py`, `core/config.py`, `api/chat.py`, `services/chat_service.py`
13. Verification: `cd frontend && npm run build && npx next lint`

---

## Verification

- `cd frontend && npm run build` — no errors
- `cd frontend && npx next lint` — no new errors
- `cd backend && python3 -c "from app.main import app"` — backend imports OK
- Layout: Chat on left, PDF on right, drag handle resizes correctly
- Model selector: shows 8 models, persists across refresh, disabled during streaming
- Language selector: shows 8 languages, strings change when language switched, persists across refresh
- Arabic language sets `dir="rtl"` on `<html>`
