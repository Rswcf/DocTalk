# Wave 3 Phase 3: Batch E — Architecture Items

You are implementing 4 architecture-level improvements for the DocTalk project. Execute in order: FE-01 → UX-01 → FE-02 → UX-02.

## Current State
- Frontend builds successfully (`npx next build` passes)
- `lucide-react` is installed and used throughout the codebase
- `react-resizable-panels` is installed (Panel, Group, Separator)
- All pages are `"use client"` — no SSR
- i18n: 11 locales (en, zh, es, ja, de, fr, ko, pt, it, ar, hi) in `frontend/src/i18n/locales/*.json`
- UI palette: zinc monochrome + indigo accent. Zero `gray-*`/`blue-*` classes. Zero `transition-all`.

---

## FE-01: Landing Page SEO Quick Wins

### Phase 1: Fix loading state

**File**: `frontend/src/app/page.tsx`

The loading guard at lines 226-232 currently shows a spinner:
```tsx
if (status === 'loading') {
  return (
    <div className="min-h-screen bg-[var(--page-background)] flex items-center justify-center">
      <div className="animate-pulse text-zinc-400">{t('common.loading') || 'Loading...'}</div>
    </div>
  );
}
```

**Change**: Extract the landing page content (lines 237-305, the `!isLoggedIn` block) into a `LandingPageContent` component defined above the `HomePage` export. Then render `<LandingPageContent />` both in the loading state AND for the `!isLoggedIn` state.

Implementation:
1. Create a `function LandingPageContent()` component INSIDE `page.tsx` (not a separate file) that renders lines 237-305 (the landing page JSX). It should use the same hooks (`useLocale`, etc.) internally.
2. Replace the loading guard to render `<LandingPageContent />` instead of the spinner
3. Replace the `!isLoggedIn` block to render `<LandingPageContent />`

This way, crawlers see the full landing page HTML immediately instead of "Loading...".

### Phase 2: Enhance metadata

**File**: `frontend/src/app/layout.tsx`

Current metadata (lines 22-25):
```tsx
export const metadata: Metadata = {
  title: 'DocTalk',
  description: 'DocTalk — PDF chat assistant',
}
```

**Change**: Enhance to:
```tsx
export const metadata: Metadata = {
  title: 'DocTalk — AI Document Chat with Cited Answers',
  description: 'Upload any document and chat with AI. Get instant answers with source citations that highlight in your document. Supports PDF, DOCX, PPTX, XLSX, and more.',
  openGraph: {
    title: 'DocTalk — AI Document Chat',
    description: 'Chat with your documents. AI answers with page-level citations.',
    type: 'website',
  },
}
```

---

## UX-01: Mobile Responsive Document Reader

**File**: `frontend/src/app/d/[documentId]/page.tsx`

### Changes:

1. **Add mobile tab state**:
```tsx
const [mobileTab, setMobileTab] = useState<'chat' | 'document'>('chat');
```

2. **Add `MessageSquare` import** from lucide-react (already imports `Presentation`, `FileText`).

3. **Create handleCitationClick wrapper** that auto-switches to document tab on mobile:
```tsx
const handleCitationClick = useCallback((citation: Citation) => {
  navigateToCitation(citation);
  if (typeof window !== 'undefined' && window.innerWidth < 640) {
    setMobileTab('document');
  }
}, [navigateToCitation]);
```

You'll need to import `Citation` type — it's imported in ChatPanel already. Check if it's exported from `../../types`. Add import if needed: `import type { Citation } from '../../../types';`

4. **Replace the current layout** (lines 146-168 in the non-error branch). Currently:
```tsx
<Group orientation="horizontal" className="flex-1 min-h-0">
  <Panel ...>{chatContent}</Panel>
  <Separator ... />
  <Panel ...>{viewerContent}</Panel>
</Group>
```

Replace with responsive layout:
```tsx
{/* Desktop: side-by-side resizable panels */}
<div className="hidden sm:flex flex-1 min-h-0">
  <Group orientation="horizontal" className="flex-1 min-h-0">
    <Panel defaultSize={50} minSize={25}>
      <div className="h-full min-w-0 sm:min-w-[320px] flex flex-col">
        <div className="flex-1 min-h-0">
          {chatContent}
        </div>
      </div>
    </Panel>
    <Separator
      className="w-3 sm:w-1.5 bg-zinc-200 dark:bg-zinc-700 hover:bg-zinc-400 dark:hover:bg-zinc-500 transition-colors cursor-col-resize flex items-center justify-center"
      aria-label="Resize panels"
    >
      <div className="w-0.5 h-8 bg-zinc-400 dark:bg-zinc-500 rounded-full" />
    </Separator>
    <Panel defaultSize={50} minSize={35}>
      <div className="h-full">
        {viewerContent}
      </div>
    </Panel>
  </Group>
</div>

{/* Mobile: full-width tab layout with both panels mounted */}
<div className="flex sm:hidden flex-col flex-1 min-h-0">
  <div className={`flex-1 min-h-0 ${mobileTab === 'chat' ? '' : 'hidden'}`}>
    <div className="h-full min-w-0 flex flex-col">
      <div className="flex-1 min-h-0">
        {chatContent}
      </div>
    </div>
  </div>
  <div className={`flex-1 min-h-0 ${mobileTab === 'document' ? '' : 'hidden'}`}>
    <div className="h-full">
      {viewerContent}
    </div>
  </div>
  {/* Bottom tab bar */}
  <div className="flex border-t border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 shrink-0" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
    <button
      type="button"
      onClick={() => setMobileTab('chat')}
      className={`flex-1 py-3 text-xs font-medium flex flex-col items-center gap-1 transition-colors ${
        mobileTab === 'chat'
          ? 'text-indigo-600 dark:text-indigo-400'
          : 'text-zinc-400 dark:text-zinc-500'
      }`}
    >
      <MessageSquare size={20} />
      {t('mobile.chatTab')}
    </button>
    <button
      type="button"
      onClick={() => setMobileTab('document')}
      className={`flex-1 py-3 text-xs font-medium flex flex-col items-center gap-1 transition-colors ${
        mobileTab === 'document'
          ? 'text-indigo-600 dark:text-indigo-400'
          : 'text-zinc-400 dark:text-zinc-500'
      }`}
    >
      <FileText size={20} />
      {t('mobile.documentTab')}
    </button>
  </div>
</div>
```

IMPORTANT: Both panels must stay mounted (CSS `hidden` class, not conditional rendering) to preserve PdfViewer/TextViewer state.

5. **Pass handleCitationClick** to ChatPanel instead of `navigateToCitation`:

Change line 103 from:
```tsx
<ChatPanel ... onCitationClick={navigateToCitation} ...>
```
to:
```tsx
<ChatPanel ... onCitationClick={handleCitationClick} ...>
```

6. **Add i18n keys** (2 keys × 11 locales):

| Key | EN | ZH | ES | JA | DE | FR | KO | PT | IT | AR | HI |
|-----|----|----|----|----|----|----|----|----|----|----|-----|
| mobile.chatTab | Chat | 对话 | Chat | チャット | Chat | Chat | 채팅 | Chat | Chat | الدردشة | चैट |
| mobile.documentTab | Document | 文档 | Documento | ドキュメント | Dokument | Document | 문서 | Documento | Documento | المستند | दस्तावेज़ |

---

## FE-02: PDF Page Virtualization

**File**: `frontend/src/components/PdfViewer/PdfViewer.tsx`

### Changes:

1. **Add new state** after existing state declarations (around line 82):
```tsx
const [pageAspectRatios, setPageAspectRatios] = useState<number[]>([]);
const [visibleRange, setVisibleRange] = useState<{ start: number; end: number }>({ start: 1, end: 6 });
const BUFFER = 3;
```

2. **Modify `onDocumentLoadSuccess`** (line 209) to also extract page aspect ratios:

After `setStoreTotalPages(n)` and `pageRefs.current = new Array(n).fill(null)`, add:
```tsx
// Extract page aspect ratios for placeholder height estimation
(async () => {
  const ratios: number[] = [];
  for (let p = 1; p <= n; p++) {
    const page = await pdf.getPage(p);
    const viewport = page.getViewport({ scale: 1 });
    ratios.push(viewport.height / viewport.width);
  }
  setPageAspectRatios(ratios);
})();
```

Keep the existing text extraction code unchanged — it should run in parallel with this.

3. **Modify the IntersectionObserver** (lines 148-176) to also track visible range.

Replace the existing observer with one that has `rootMargin: '200% 0px'` and tracks both the visible page (for toolbar) and the visible range (for virtualization):

```tsx
useEffect(() => {
  if (!numPages || !containerRef.current) return;

  const visiblePages = new Set<number>();

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        const pageNum = Number(entry.target.getAttribute('data-page-number'));
        if (entry.isIntersecting) {
          visiblePages.add(pageNum);
        } else {
          visiblePages.delete(pageNum);
        }
      });

      if (visiblePages.size > 0) {
        const sorted = [...visiblePages].sort((a, b) => a - b);
        // Update visible page for toolbar (only when not programmatically scrolling)
        if (!isScrollingToPage.current) {
          const center = sorted[Math.floor(sorted.length / 2)];
          setVisiblePage(center);
        }
        // Update visible range for virtualization
        setVisibleRange({
          start: Math.max(1, sorted[0] - BUFFER),
          end: Math.min(numPages, sorted[sorted.length - 1] + BUFFER),
        });
      }
    },
    { root: containerRef.current, rootMargin: '200% 0px', threshold: [0] }
  );

  pageRefs.current.forEach((el) => {
    if (el) observer.observe(el);
  });

  return () => observer.disconnect();
}, [numPages]);
```

4. **Modify the scroll-to-page effect** (lines 111-145) to expand visible range before scrolling:

Add right after the `if (!numPages || !containerRef.current) return;` check:
```tsx
// Ensure target page is in render range before scrolling
setVisibleRange(prev => ({
  start: Math.min(prev.start, Math.max(1, currentPage - BUFFER)),
  end: Math.max(prev.end, Math.min(numPages, currentPage + BUFFER)),
}));
```

5. **Replace the page rendering** (lines 346-360) with virtualized rendering:

Get the container width for height calculation. Add a ref-based width tracker or use a simple approach:

```tsx
{pages.map((pageNumber) => {
  const isInRange = pageNumber >= visibleRange.start && pageNumber <= visibleRange.end;

  if (!isInRange && pageAspectRatios.length > 0) {
    // Placeholder with estimated height based on actual page aspect ratio
    const aspectRatio = pageAspectRatios[pageNumber - 1] || 1.414;
    return (
      <div
        key={pageNumber}
        ref={(el) => { pageRefs.current[pageNumber - 1] = el; }}
        data-page-number={pageNumber}
        className="bg-zinc-100 dark:bg-zinc-800 rounded"
        style={{ height: `calc(${aspectRatio} * min(100%, 800px) * ${scale})`, width: '100%', maxWidth: 800 * scale }}
      />
    );
  }

  const pageHighlights = highlights.filter(h => h.page === pageNumber);
  return (
    <div
      key={pageNumber}
      ref={(el) => { pageRefs.current[pageNumber - 1] = el; }}
      className="relative"
      data-page-number={pageNumber}
    >
      <PageWithHighlights pageNumber={pageNumber} scale={scale} highlights={pageHighlights} searchQuery={searchQuery} highlightSnippet={highlightSnippet} />
    </div>
  );
})}
```

**IMPORTANT**: The placeholders MUST keep `ref` and `data-page-number` so the IntersectionObserver can track them. If `pageAspectRatios` is empty (not loaded yet), render ALL pages (fall through to full render) — this avoids zero-height placeholders before aspect ratios are computed.

---

## UX-02: Onboarding Tour with driver.js

### Step 1: Install driver.js

Run: `cd frontend && npm install driver.js`

### Step 2: Create onboarding module

**New file**: `frontend/src/lib/onboarding.ts`

```tsx
import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';

const TOUR_STORAGE_KEY = 'doctalk_tour_completed';

export function shouldShowTour(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return !localStorage.getItem(TOUR_STORAGE_KEY);
  } catch {
    return false; // localStorage unavailable in private browsing
  }
}

export function markTourCompleted(): void {
  try {
    localStorage.setItem(TOUR_STORAGE_KEY, '1');
  } catch {} // localStorage unavailable in private browsing
}

export function startOnboardingTour(
  t: (key: string) => string,
  options?: { showModeSelector?: boolean }
) {
  // Skip on mobile — layout is different with tabs
  if (typeof window !== 'undefined' && window.innerWidth < 640) return;

  const steps: Array<{ element: string; popover: { title: string; description: string; side: 'left' | 'right' | 'top' | 'bottom' } }> = [
    {
      element: '[data-tour="chat-area"]',
      popover: {
        title: t('tour.citation.title'),
        description: t('tour.citation.desc'),
        side: 'left',
      },
    },
  ];

  if (options?.showModeSelector !== false) {
    steps.push({
      element: '[data-tour="mode-selector"]',
      popover: {
        title: t('tour.mode.title'),
        description: t('tour.mode.desc'),
        side: 'bottom',
      },
    });
  }

  steps.push(
    {
      element: '[data-tour="plus-menu"]',
      popover: {
        title: t('tour.plus.title'),
        description: t('tour.plus.desc'),
        side: 'top',
      },
    },
    {
      element: '[data-tour="session-dropdown"]',
      popover: {
        title: t('tour.session.title'),
        description: t('tour.session.desc'),
        side: 'bottom',
      },
    },
  );

  const d = driver({
    showProgress: true,
    steps,
    onDestroyed: () => {
      markTourCompleted();
    },
    popoverClass: 'doctalk-tour-popover',
  });

  d.drive();
}
```

### Step 3: Add data-tour attributes

**File `frontend/src/components/Chat/PlusMenu.tsx`** (line 44):
Change `<div className="relative shrink-0" data-plus-menu>` to:
```tsx
<div className="relative shrink-0" data-plus-menu data-tour="plus-menu">
```

**File `frontend/src/components/ModeSelector.tsx`** (line 38):
Add `data-tour="mode-selector"` to the wrapper div:
```tsx
<div
  role="radiogroup"
  aria-label="Performance mode"
  data-tour="mode-selector"
  className={`inline-flex rounded-full bg-zinc-100 dark:bg-zinc-800 p-0.5 ${isStreaming ? 'opacity-60 pointer-events-none' : ''}`}
>
```

**File `frontend/src/components/SessionDropdown.tsx`** (line ~152-153):
Add `data-tour="session-dropdown"` to the trigger button:
```tsx
<button
  ref={triggerRef}
  type="button"
  onClick={toggle}
  data-tour="session-dropdown"
  className="text-sm text-zinc-600 ..."
```

**File `frontend/src/components/Chat/ChatPanel.tsx`**:
Find the messages scroll container (the main div that wraps the message list). Add `data-tour="chat-area"` to it. It should be on the scrollable container that contains the messages. Look for the `ref` that tracks message scrolling — add `data-tour="chat-area"` to that element.

### Step 4: Add tour trigger in document reader page

**File**: `frontend/src/app/d/[documentId]/page.tsx`

Add import at the top:
```tsx
import { shouldShowTour, startOnboardingTour } from '../../../lib/onboarding';
```

Add useEffect after the existing hooks (before the return statement):
```tsx
// Onboarding tour — show once on first document ready
useEffect(() => {
  if (documentStatus !== 'ready' || !sessionId) return;
  if (!shouldShowTour()) return;

  const timer = setTimeout(() => {
    startOnboardingTour(t, {
      showModeSelector: isLoggedIn && !isDemo,
    });
  }, 1500);

  return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [documentStatus, sessionId]);
```

### Step 5: Add tour CSS

**File**: `frontend/src/app/globals.css`

Add at the end (before any closing comments):
```css
/* Onboarding tour (driver.js) */
.doctalk-tour-popover {
  --driverjs-bg: #ffffff;
  --driverjs-color: #18181b;
  border: 1px solid #e4e4e7;
  border-radius: 12px;
  box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
}

.dark .doctalk-tour-popover {
  --driverjs-bg: #18181b;
  --driverjs-color: #fafafa;
  border-color: #3f3f46;
}

.doctalk-tour-popover .driver-popover-progress-text {
  color: #71717a;
}

.doctalk-tour-popover .driver-popover-navigation-btns button {
  border-radius: 8px;
  font-size: 0.875rem;
  padding: 0.375rem 0.75rem;
}
```

### Step 6: Add i18n keys (8 keys × 11 locales)

Add these keys to ALL 11 locale files in `frontend/src/i18n/locales/*.json`:

**EN** (en.json):
```json
"tour.citation.title": "Cited Answers",
"tour.citation.desc": "Click any [1] citation to see the exact source highlighted in your document.",
"tour.mode.title": "AI Performance Modes",
"tour.mode.desc": "Quick for fast answers, Balanced for detail, Thorough for deep analysis.",
"tour.plus.title": "More Options",
"tour.plus.desc": "Set custom AI instructions or export your conversation.",
"tour.session.title": "Chat Sessions",
"tour.session.desc": "Create multiple chats per document to explore different topics."
```

**ZH** (zh.json):
```json
"tour.citation.title": "引用答案",
"tour.citation.desc": "点击任意 [1] 引用编号，查看文档中高亮标注的原文出处。",
"tour.mode.title": "AI 性能模式",
"tour.mode.desc": "快速模式回复更快，均衡模式更详细，深度模式提供深入分析。",
"tour.plus.title": "更多选项",
"tour.plus.desc": "设置自定义 AI 指令或导出对话记录。",
"tour.session.title": "对话会话",
"tour.session.desc": "为每篇文档创建多个对话，探索不同主题。"
```

**ES** (es.json):
```json
"tour.citation.title": "Respuestas con citas",
"tour.citation.desc": "Haz clic en cualquier cita [1] para ver la fuente exacta resaltada en tu documento.",
"tour.mode.title": "Modos de rendimiento IA",
"tour.mode.desc": "Rápido para respuestas inmediatas, Equilibrado para más detalle, Exhaustivo para análisis profundo.",
"tour.plus.title": "Más opciones",
"tour.plus.desc": "Configura instrucciones personalizadas o exporta tu conversación.",
"tour.session.title": "Sesiones de chat",
"tour.session.desc": "Crea múltiples chats por documento para explorar diferentes temas."
```

**JA** (ja.json):
```json
"tour.citation.title": "引用付き回答",
"tour.citation.desc": "[1] の引用番号をクリックすると、ドキュメント内の該当箇所がハイライト表示されます。",
"tour.mode.title": "AIパフォーマンスモード",
"tour.mode.desc": "クイックは高速回答、バランスは詳細回答、ソローは深層分析に対応。",
"tour.plus.title": "その他のオプション",
"tour.plus.desc": "カスタムAI指示の設定や会話のエクスポートができます。",
"tour.session.title": "チャットセッション",
"tour.session.desc": "ドキュメントごとに複数のチャットを作成し、さまざまなトピックを探索できます。"
```

**DE** (de.json):
```json
"tour.citation.title": "Zitierte Antworten",
"tour.citation.desc": "Klicke auf eine [1]-Zitatnummer, um die genaue Quelle in deinem Dokument hervorgehoben zu sehen.",
"tour.mode.title": "KI-Leistungsmodi",
"tour.mode.desc": "Schnell für schnelle Antworten, Ausgewogen für Details, Gründlich für tiefe Analysen.",
"tour.plus.title": "Weitere Optionen",
"tour.plus.desc": "Lege benutzerdefinierte KI-Anweisungen fest oder exportiere dein Gespräch.",
"tour.session.title": "Chat-Sitzungen",
"tour.session.desc": "Erstelle mehrere Chats pro Dokument, um verschiedene Themen zu erkunden."
```

**FR** (fr.json):
```json
"tour.citation.title": "Réponses citées",
"tour.citation.desc": "Cliquez sur n'importe quelle citation [1] pour voir la source exacte surlignée dans votre document.",
"tour.mode.title": "Modes de performance IA",
"tour.mode.desc": "Rapide pour des réponses instantanées, Équilibré pour plus de détails, Approfondi pour une analyse poussée.",
"tour.plus.title": "Plus d'options",
"tour.plus.desc": "Définissez des instructions IA personnalisées ou exportez votre conversation.",
"tour.session.title": "Sessions de chat",
"tour.session.desc": "Créez plusieurs chats par document pour explorer différents sujets."
```

**KO** (ko.json):
```json
"tour.citation.title": "인용 답변",
"tour.citation.desc": "[1] 인용 번호를 클릭하면 문서에서 해당 출처가 강조 표시됩니다.",
"tour.mode.title": "AI 성능 모드",
"tour.mode.desc": "빠른 모드는 즉시 답변, 균형 모드는 상세 답변, 심층 모드는 깊은 분석을 제공합니다.",
"tour.plus.title": "추가 옵션",
"tour.plus.desc": "맞춤 AI 지시를 설정하거나 대화를 내보낼 수 있습니다.",
"tour.session.title": "채팅 세션",
"tour.session.desc": "문서당 여러 채팅을 만들어 다양한 주제를 탐색하세요."
```

**PT** (pt.json):
```json
"tour.citation.title": "Respostas com citações",
"tour.citation.desc": "Clique em qualquer citação [1] para ver a fonte exata destacada no seu documento.",
"tour.mode.title": "Modos de desempenho IA",
"tour.mode.desc": "Rápido para respostas instantâneas, Equilibrado para mais detalhes, Completo para análise profunda.",
"tour.plus.title": "Mais opções",
"tour.plus.desc": "Defina instruções personalizadas de IA ou exporte sua conversa.",
"tour.session.title": "Sessões de chat",
"tour.session.desc": "Crie múltiplos chats por documento para explorar diferentes temas."
```

**IT** (it.json):
```json
"tour.citation.title": "Risposte con citazioni",
"tour.citation.desc": "Clicca su qualsiasi citazione [1] per vedere la fonte esatta evidenziata nel tuo documento.",
"tour.mode.title": "Modalità prestazioni IA",
"tour.mode.desc": "Veloce per risposte rapide, Bilanciato per dettagli, Approfondito per analisi profonde.",
"tour.plus.title": "Altre opzioni",
"tour.plus.desc": "Imposta istruzioni IA personalizzate o esporta la conversazione.",
"tour.session.title": "Sessioni di chat",
"tour.session.desc": "Crea più chat per documento per esplorare argomenti diversi."
```

**AR** (ar.json):
```json
"tour.citation.title": "إجابات مع اقتباسات",
"tour.citation.desc": "انقر على أي اقتباس [1] لرؤية المصدر الدقيق مُميَّزًا في مستندك.",
"tour.mode.title": "أوضاع أداء الذكاء الاصطناعي",
"tour.mode.desc": "سريع للإجابات الفورية، متوازن لمزيد من التفاصيل، شامل للتحليل العميق.",
"tour.plus.title": "خيارات إضافية",
"tour.plus.desc": "عيّن تعليمات ذكاء اصطناعي مخصصة أو صدّر محادثتك.",
"tour.session.title": "جلسات الدردشة",
"tour.session.desc": "أنشئ محادثات متعددة لكل مستند لاستكشاف مواضيع مختلفة."
```

**HI** (hi.json):
```json
"tour.citation.title": "उद्धृत उत्तर",
"tour.citation.desc": "किसी भी [1] उद्धरण पर क्लिक करें और अपने दस्तावेज़ में सटीक स्रोत हाइलाइट देखें।",
"tour.mode.title": "AI प्रदर्शन मोड",
"tour.mode.desc": "त्वरित तेज़ उत्तर के लिए, संतुलित विस्तृत उत्तर के लिए, गहन गहरे विश्लेषण के लिए।",
"tour.plus.title": "अधिक विकल्प",
"tour.plus.desc": "कस्टम AI निर्देश सेट करें या अपनी बातचीत निर्यात करें।",
"tour.session.title": "चैट सत्र",
"tour.session.desc": "प्रत्येक दस्तावेज़ के लिए कई चैट बनाएं और विभिन्न विषयों का अन्वेषण करें।"
```

---

## Validation

After ALL changes:
1. Run: `cd frontend && npx tsc --noEmit` — must pass
2. Run: `cd frontend && npx next lint` — must pass (pre-existing warnings OK)
3. Run: `cd frontend && npx next build` — must pass

## IMPORTANT RULES
- UI palette: zinc monochrome + indigo accent. Zero `gray-*`/`blue-*` classes
- All components using `t()` MUST be inside `<LocaleProvider>` (they already are if in pages)
- Do not touch files that are not mentioned
- Do not add features beyond what is specified
- Keep code minimal and focused
- Zero `transition-all` — use specific transition properties
- Both mobile panels MUST stay mounted via CSS `hidden`/`block` — NOT conditional rendering
