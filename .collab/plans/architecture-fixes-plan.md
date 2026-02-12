# Architecture-Level Fixes Plan

**Date**: 2026-02-12
**Author**: arch-planner agent
**Status**: Ready for review

---

## Table of Contents

1. [UX-01: Mobile Responsive Document Reader](#ux-01-mobile-responsive-document-reader)
2. [FE-01: Landing Page SSR/SSG](#fe-01-landing-page-ssrssg)
3. [FE-02: PDF Page Virtualization](#fe-02-pdf-page-virtualization)
4. [UX-02: Onboarding Tour](#ux-02-onboarding-tour)

---

## UX-01: Mobile Responsive Document Reader

### Current State Analysis

**File**: `frontend/src/app/d/[documentId]/page.tsx`

The document reader page uses `react-resizable-panels` v4 (`Group`/`Panel`/`Separator`) for a horizontal split layout:

```
lines 466-487:
<Group orientation="horizontal" className="flex-1 min-h-0">
  <Panel defaultSize={50} minSize={25}>   // Chat panel (left)
    <div className="h-full min-w-0 sm:min-w-[320px] ...">
  </Panel>
  <Separator ... />
  <Panel defaultSize={50} minSize={35}>   // Viewer panel (right)
  </Panel>
</Group>
```

**Problems on <640px screens**:
1. Both panels get ~50% width each = ~160px per panel on a 320px phone. Completely unusable.
2. `minSize={25}` and `minSize={35}` are percentages — 25% of 320px = 80px. The chat input alone needs ~300px minimum width.
3. The `Separator` (line 475-480) takes additional space and is hard to grab on touch.
4. `sm:min-w-[320px]` on the chat wrapper (line 468) tries to enforce minimum but still renders both panels.

**Existing functionality that MUST be preserved**:
- Citation navigation: `navigateToCitation` in store (line 144-155 of `store/index.ts`) sets `currentPage`, `highlights`, `highlightSnippet`, `scrollNonce`. `ChatPanel.onCitationClick` calls this, then PdfViewer/TextViewer responds.
- Session management: SessionDropdown in Header, session switching
- Custom instructions modal
- View mode toggle for converted PDFs (slide/text)
- Win98 theme variant (has its own separate layout, lines 312-446)

### Proposed Approach: Tab Switching on Mobile

**Strategy**: Below `sm` breakpoint (640px), replace side-by-side panels with a full-width tab switcher (Chat / Document tabs). Above `sm`, keep the existing resizable panel layout unchanged.

**Why tabs over drawer/sheet**:
- Tabs are the established mobile pattern for this type of app (ChatGPT, Google Docs, Notion)
- A drawer would require the user to constantly open/close it, adding friction
- Panel stacking (vertical) wastes vertical space on an already limited screen
- Tabs provide instant context switching with zero animation cost

**Architecture**:

```
┌──────────────────┐
│  Header (sticky)  │
├──────────────────┤
│                  │
│  Active Tab      │  ← Full-width, either Chat or Viewer
│  Content         │
│                  │
├──────────────────┤
│ [Chat] [Document]│  ← Bottom tab bar (fixed)
└──────────────────┘
```

### Implementation Details

**Files to modify**:
- `frontend/src/app/d/[documentId]/page.tsx` — main layout logic

**No new files needed** — the tab bar is a small piece of inline UI.

**Changes**:

1. **Add mobile tab state**:
```tsx
const [mobileTab, setMobileTab] = useState<'chat' | 'document'>('chat');
```

2. **Wrap the modern layout in a responsive conditional**:

```tsx
// Modern layout (light/dark)
return (
  <div className="flex flex-col h-screen w-full overflow-hidden">
    <Header isDemo={isDemo} isLoggedIn={isLoggedIn} />
    {error ? (
      /* ... error state unchanged ... */
    ) : (
      <>
        {/* Desktop: side-by-side resizable panels */}
        <div className="hidden sm:flex flex-1 min-h-0">
          <Group orientation="horizontal" className="flex-1">
            <Panel defaultSize={50} minSize={25}>
              <div className="h-full min-w-0 flex flex-col">
                <div className="flex-1 min-h-0">{chatContent}</div>
              </div>
            </Panel>
            <Separator ... />
            <Panel defaultSize={50} minSize={35}>
              <div className="h-full">{viewerContent}</div>
            </Panel>
          </Group>
        </div>

        {/* Mobile: full-width tab layout */}
        <div className="flex sm:hidden flex-col flex-1 min-h-0">
          <div className="flex-1 min-h-0">
            {mobileTab === 'chat' ? chatContent : viewerContent}
          </div>
          {/* Bottom tab bar */}
          <div className="flex border-t border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 shrink-0">
            <button
              onClick={() => setMobileTab('chat')}
              className={`flex-1 py-3 text-xs font-medium flex flex-col items-center gap-1 ${
                mobileTab === 'chat'
                  ? 'text-indigo-600 dark:text-indigo-400'
                  : 'text-zinc-500'
              }`}
            >
              <MessageSquare size={20} />
              {t('mobile.chatTab')}
            </button>
            <button
              onClick={() => setMobileTab('document')}
              className={`flex-1 py-3 text-xs font-medium flex flex-col items-center gap-1 ${
                mobileTab === 'document'
                  ? 'text-indigo-600 dark:text-indigo-400'
                  : 'text-zinc-500'
              }`}
            >
              <FileText size={20} />
              {t('mobile.documentTab')}
            </button>
          </div>
        </div>
      </>
    )}
    <CustomInstructionsModal ... />
  </div>
);
```

3. **Auto-switch tab on citation click**:
When a citation is clicked in the chat, the user expects to see the highlight in the document. On mobile, we must auto-switch to the document tab:

```tsx
const handleCitationClick = useCallback((citation: Citation) => {
  navigateToCitation(citation);
  // On mobile, switch to document tab to show the highlight
  if (window.innerWidth < 640) {
    setMobileTab('document');
  }
}, [navigateToCitation]);
```

Pass `handleCitationClick` instead of `navigateToCitation` directly to `ChatPanel.onCitationClick`.

4. **i18n keys to add** (2 keys, 11 locales):
- `mobile.chatTab`: "Chat" / "对话" / "チャット" / etc.
- `mobile.documentTab`: "Document" / "文档" / "ドキュメント" / etc.

5. **Win98 mobile layout**: The Win98 layout (lines 312-446) uses its own custom splitter. Apply the same tab pattern inside the Win98Window for `sm:` breakpoint. Lower priority — Win98 theme is a novelty; could defer.

### Migration Steps

1. Add i18n keys to all 11 locale files
2. Add `mobileTab` state and `handleCitationClick` wrapper
3. Wrap existing `<Group>` in `hidden sm:flex`, add mobile tab layout in `flex sm:hidden`
4. Import `MessageSquare` from lucide-react (already used elsewhere)
5. Test on mobile viewport: citation click auto-switch, session switching, view toggle

### Risks and Mitigation

| Risk | Mitigation |
|------|-----------|
| PdfViewer unmounts when switching tabs (loses scroll position, re-renders all pages) | Keep both panels mounted but use `hidden`/`block` CSS classes instead of conditional rendering. This preserves state. Trade-off: both panels render in DOM on mobile. |
| Chat input keyboard pushes tab bar off-screen on iOS | Tab bar uses `shrink-0` and is inside the flex column. The `flex-1 min-h-0` chat content will shrink. May need `env(safe-area-inset-bottom)` for notch phones. |
| Win98 theme not addressed | Acceptable — Win98 is a novelty theme, desktop-only is fine |

**Recommended approach for state preservation**: Use CSS visibility instead of conditional rendering:

```tsx
<div className="flex sm:hidden flex-col flex-1 min-h-0">
  <div className={`flex-1 min-h-0 ${mobileTab === 'chat' ? '' : 'hidden'}`}>
    {chatContent}
  </div>
  <div className={`flex-1 min-h-0 ${mobileTab === 'document' ? '' : 'hidden'}`}>
    {viewerContent}
  </div>
  {/* tab bar */}
</div>
```

This keeps both panels in the DOM so PdfViewer doesn't unmount/remount.

### Complexity Estimate

**Small-Medium**. ~2 hours implementation. The core change is wrapping the existing layout in responsive conditionals and adding a small tab bar. No new components, no architecture changes.

---

## FE-01: Landing Page SSR/SSG

### Current State Analysis

**File**: `frontend/src/app/page.tsx` (line 1: `"use client"`)

The entire homepage is a client component. The landing page (shown to logged-out users, lines 249-319) consists of:

| Component | File | Client Hooks Used | Can Be Server Component? |
|-----------|------|-------------------|--------------------------|
| `page.tsx` | `app/page.tsx` | `useSession`, `useRouter`, `useState`, `useEffect`, `useCallback`, `useMemo`, `useRef` | NO — auth gate + dashboard state |
| `HeroSection` | `landing/HeroSection.tsx` | `useLocale()` (React Context) | NO without i18n refactor |
| `ShowcasePlayer` | `landing/ShowcasePlayer.tsx` | `useTheme()`, `useState`, `useEffect`, lazy loading | NO — deeply client |
| `HowItWorks` | `landing/HowItWorks.tsx` | `useLocale()` | NO without i18n refactor |
| `FeatureGrid` | `landing/FeatureGrid.tsx` | `useLocale()` | NO without i18n refactor |
| `SocialProof` | `landing/SocialProof.tsx` | `useLocale()`, `useState`, `useEffect`, `useRef` (AnimatedCounter) | NO — intersection observer + animation |
| `SecuritySection` | `landing/SecuritySection.tsx` | `useLocale()` | NO without i18n refactor |
| `FAQ` | `landing/FAQ.tsx` | `useLocale()`, `useState` (accordion) | NO — interactive state |
| `FinalCTA` | `landing/FinalCTA.tsx` | `useLocale()` | NO without i18n refactor |
| `ScrollReveal` | `landing/ScrollReveal.tsx` | `useState`, `useEffect`, `useRef` (IntersectionObserver) | NO — observer + animation |
| `Footer` | `Footer.tsx` | `useLocale()` | NO without i18n refactor |
| `PrivacyBadge` | `PrivacyBadge.tsx` | `useLocale()`, `useState` | NO — interactive |
| `Header` | `Header.tsx` | `useTheme()`, `usePathname()`, `useLocale()`, Zustand store | NO — deeply client |

**Root cause**: Every single landing component uses `useLocale()` which is a React Context hook (`LocaleProvider` in `i18n/LocaleProvider.tsx`). This makes ALL of them client components regardless of whether they have interactive state.

The i18n system is purely client-side: `LocaleProvider` (line 32-94) detects locale from `localStorage` → loads translations via dynamic import → provides `t()` function via context.

### Proposed Approach: Hybrid Server/Client Split

**Strategy**: Split `page.tsx` into a Server Component landing page and a Client Component dashboard. The key insight is that `useSession()` determines which UI to show — but we can move that gate to a thin client wrapper.

**Alternative considered and rejected**:
- **Full SSR with server-side i18n**: Would require rewriting the entire i18n system (middleware-based locale detection, server-side translation loading, passing translations as props). Very high effort (L), breaks existing architecture.
- **next-intl or similar**: Heavy migration, changes URL structure (/en/..., /zh/...), breaks all existing links.

**Recommended approach**: **Partial SSR** — render the landing page structure server-side with English defaults, hydrate i18n client-side. This gives us:
- Crawlable HTML with real text content (English)
- Proper `<meta>` tags and semantic structure
- Fast First Contentful Paint
- Client-side hydration adds locale switching + animations

### Implementation Details

**Phase 1: Split page.tsx into landing vs dashboard** (Medium effort)

Create `frontend/src/app/(landing)/page.tsx` as a Server Component that renders the static landing shell, with a client boundary only for auth-gated switching.

Actually, a simpler approach that doesn't require route groups:

**Step 1**: Create a server-renderable landing component with hardcoded English text:

```
frontend/src/app/page.tsx (remains "use client" — the auth gate)
  └── LandingPage.tsx (NEW — Server Component, static HTML)
        ├── Renders all landing sections with English text as fallback
        └── Each section wrapped in a thin client boundary for i18n hydration
```

Wait — this still hits the `useLocale()` problem. Every section needs translation.

**Better approach**: **Static English + client hydration overlay**

**Step 1**: Modify `page.tsx` to conditionally render:
- During SSR / initial load: show the landing page (since `useSession` returns `loading` initially, the loading guard at line 240 triggers — this is the real SEO problem: crawlers see "Loading...")
- The fix: render the landing page by default, show dashboard only after auth check confirms logged in.

This is actually the most impactful change:

```tsx
// Current (line 240-246):
if (status === 'loading') {
  return <div>Loading...</div>;  // ← This is what crawlers see!
}

// Fixed:
if (status === 'loading') {
  // Render landing page while auth checks — crawlers see real content
  return <LandingContent />;
}
if (!isLoggedIn) {
  return <LandingContent />;
}
// Dashboard for logged-in users...
```

But `LandingContent` still uses client hooks everywhere...

### Revised Strategy: Server Component Landing Route

The cleanest approach:

1. **Create a separate landing page route** as a Server Component
2. **page.tsx** becomes a thin auth-gating client component that redirects

**Step 1**: Move landing page to a Server Component

Create `frontend/src/components/landing/LandingPage.tsx` as a **client component** but with **static English text baked into the HTML** plus client-side translation overlay:

Actually, let me propose the most pragmatic solution:

### Final Recommended Approach: Static Pre-rendering with Suspense Boundary

**The core SEO problem** is that `page.tsx` shows "Loading..." while `useSession()` resolves. Crawlers (Googlebot) execute JavaScript but may time out waiting for auth.

**Solution (in order of effort)**:

#### Phase 1: Fix the loading state (Quick win, ~1 hour)

Change the loading guard to render the full landing page instead of a spinner:

```tsx
// page.tsx line 240-246
if (status === 'loading') {
  return <LandingPageContent />;  // Full landing HTML instead of "Loading..."
}
```

Extract lines 249-319 into a `<LandingPageContent />` component and render it both for `loading` and `!isLoggedIn` states. This means:
- Crawlers see the full landing page HTML immediately
- Users see landing flash briefly before dashboard (acceptable — the flash is the correct content for logged-out users)

**Files to modify**: `frontend/src/app/page.tsx` only

#### Phase 2: Metadata + structured data (Quick win, ~30 min)

Add proper metadata to `layout.tsx` and `page.tsx`:

```tsx
// app/page.tsx — can't export metadata from client component
// Instead, add to app/layout.tsx metadata:
export const metadata: Metadata = {
  title: 'DocTalk - AI Document Chat with Cited Answers',
  description: 'Upload any document and chat with AI. Get instant answers with source citations that highlight in your document. Supports PDF, DOCX, PPTX, XLSX.',
  openGraph: {
    title: 'DocTalk - AI Document Chat',
    description: 'Chat with your documents. AI answers with page-level citations.',
    type: 'website',
  },
};
```

**Problem**: `page.tsx` is `"use client"` so it can't export `metadata`. But `layout.tsx` CAN and already does (line 21-24). Just enhance the existing metadata.

#### Phase 3: True SSR landing (Large effort, deferred)

Full SSR requires refactoring the i18n system to support server-side translation loading. This would involve:

1. Create `getServerTranslations(locale: string)` that loads JSON at build time
2. Detect locale from `Accept-Language` header in middleware
3. Pass translations as props to Server Components
4. Keep client `useLocale()` for interactive components only

**This is a major refactor** — every landing component's `t()` calls would need to become prop-based. Not recommended until traffic justifies the investment.

### Files to Create/Modify

**Phase 1** (recommended now):
- `frontend/src/app/page.tsx` — extract `LandingPageContent` component, render during loading state

**Phase 2** (recommended now):
- `frontend/src/app/layout.tsx` — enhance metadata

**Phase 3** (deferred):
- `frontend/src/i18n/server.ts` — server-side translation loader
- `frontend/src/middleware.ts` — locale detection
- All landing components — prop-based translations

### Risks and Mitigation

| Risk | Mitigation |
|------|-----------|
| Flash of landing page for logged-in users | Brief flash (~200ms while session loads) is acceptable. Could add CSS transition. |
| i18n not working during loading state | English translations load synchronously (imported directly in `LocaleProvider`), so `t()` works immediately for English. Other locales load async — during the brief loading state, English is shown. |
| Metadata still limited | Phase 1+2 solve 80% of SEO. True SSR (Phase 3) is diminishing returns for a SaaS app where most content is behind auth. |

### Complexity Estimate

- **Phase 1**: Small (~1 hour). Extract + reuse existing component.
- **Phase 2**: Small (~30 min). Metadata enhancement.
- **Phase 3**: Large (~2-3 days). Full i18n refactor. **Defer**.

---

## FE-02: PDF Page Virtualization

### Current State Analysis

**File**: `frontend/src/components/PdfViewer/PdfViewer.tsx`

Lines 337-351 render ALL pages simultaneously:

```tsx
<div className="flex flex-col items-center gap-4 py-4">
  {pages.map((pageNumber) => {
    const pageHighlights = highlights.filter(h => h.page === pageNumber);
    return (
      <div key={pageNumber} ref={(el) => { pageRefs.current[pageNumber - 1] = el; }}
           className="relative" data-page-number={pageNumber}>
        <PageWithHighlights pageNumber={pageNumber} scale={scale}
          highlights={pageHighlights} searchQuery={searchQuery}
          highlightSnippet={highlightSnippet} />
      </div>
    );
  })}
</div>
```

`pages` is `Array.from({ length: numPages }, (_, i) => i + 1)` (line 294).

For a 100-page PDF, this creates 100 `<Page>` components in the DOM simultaneously. Each `<Page>` renders a canvas + text layer + annotation layer. This causes:
- High memory usage (100 canvases)
- Slow initial render (all pages painted at once)
- Potential OOM on mobile for large documents

**Features that interact with page rendering**:

1. **Scroll to page** (lines 102-136): Uses `pageRefs.current[currentPage - 1]` to `scrollIntoView`. Relies on all page DOM elements existing.

2. **IntersectionObserver for visible page tracking** (lines 139-167): Observes ALL `pageRefs.current` elements. Used for the page counter in PdfToolbar.

3. **Search highlighting** (lines 169-231): Text extraction happens in `onDocumentLoadSuccess` via `pdf.getPage(p).getTextContent()` — this is independent of rendering. The highlighting happens in `PageWithHighlights` via `customTextRenderer`.

4. **Citation bbox highlighting** (PageWithHighlights): Renders overlay `<div>`s positioned over the page canvas using normalized bbox coordinates.

5. **Grab mode / pan** (lines 269-292): Mouse drag scrolling on the container.

### Proposed Approach: Windowed Rendering with Placeholder Heights

**Library choice**: `react-virtuoso` over `react-window` because:
- `react-window` requires fixed item heights. PDF pages have variable heights (different page sizes at different scales). Would require measuring each page.
- `react-virtuoso` supports variable sizes with `itemSize` estimation and automatic measurement.
- `react-virtuoso` has a `scrollToIndex` API that maps well to our `scrollToPage` needs.
- `react-virtuoso` works with `ref` forwarding and custom containers.

**However**, there is a significant challenge: `react-pdf`'s `<Page>` component renders asynchronously (it fetches page data from the PDF worker). Virtualized pages need to have correct heights BEFORE rendering, or the scroll position will jump.

**Alternative considered**: Simple "render nearby pages only" approach without a virtualization library. This is simpler and avoids the library dependency:

### Recommended Approach: DIY Viewport-Based Rendering

Render only pages within a window around the viewport (current page +/- N buffer pages). Use estimated heights for unrendered pages.

```
Page layout with buffer=3:

[Placeholder: page 1]     ← estimated height
[Placeholder: page 2]     ← estimated height
[Placeholder: page 3]     ← estimated height
[Rendered: page 4]         ← actual <Page> component
[Rendered: page 5]         ← VISIBLE IN VIEWPORT
[Rendered: page 6]         ← actual <Page> component
[Rendered: page 7]         ← actual <Page> component
[Placeholder: page 8]     ← estimated height
...
[Placeholder: page 100]   ← estimated height
```

**Why DIY over react-virtuoso**:
1. react-pdf `<Page>` has async rendering that fights with virtualization libraries
2. Our page heights are estimable: `pageHeight = (defaultAspectRatio * pageWidth * scale)`. We can get actual dimensions from `pdf.getPage(n).getViewport()`.
3. The IntersectionObserver pattern we already use (lines 139-167) naturally extends to detect which pages are near the viewport.
4. No new dependency.

### Implementation Details

**Files to modify**:
- `frontend/src/components/PdfViewer/PdfViewer.tsx`

**New state**:
```tsx
const [pageHeights, setPageHeights] = useState<number[]>([]);
const [visibleRange, setVisibleRange] = useState<{ start: number; end: number }>({ start: 0, end: 5 });
const BUFFER = 3; // render 3 pages above and below viewport
```

**Step 1: Get page dimensions on document load**

In `onDocumentLoadSuccess`, extract viewport dimensions for all pages:

```tsx
const onDocumentLoadSuccess = async (pdf: any) => {
  const n = pdf.numPages;
  setNumPages(n);
  setStoreTotalPages(n);
  pageRefs.current = new Array(n).fill(null);

  // Extract page dimensions for height estimation
  const heights: number[] = [];
  for (let p = 1; p <= n; p++) {
    const page = await pdf.getPage(p);
    const viewport = page.getViewport({ scale: 1 });
    heights.push(viewport.height / viewport.width); // aspect ratio
  }
  setPageHeights(heights);

  // ... existing text extraction code ...
};
```

**Step 2: Replace the page map with windowed rendering**

```tsx
const containerWidth = containerRef.current?.clientWidth ?? 800;
const GAP = 16; // gap-4 = 16px

<div className="flex flex-col items-center gap-4 py-4">
  {pages.map((pageNumber) => {
    const isInRange = pageNumber >= visibleRange.start && pageNumber <= visibleRange.end;

    if (!isInRange) {
      // Placeholder with estimated height
      const aspectRatio = pageHeights[pageNumber - 1] || 1.414; // A4 default
      const estimatedHeight = containerWidth * aspectRatio * scale;
      return (
        <div
          key={pageNumber}
          ref={(el) => { pageRefs.current[pageNumber - 1] = el; }}
          data-page-number={pageNumber}
          style={{ height: estimatedHeight, width: containerWidth * scale }}
          className="bg-zinc-200 dark:bg-zinc-800"
        />
      );
    }

    const pageHighlights = highlights.filter(h => h.page === pageNumber);
    return (
      <div key={pageNumber}
        ref={(el) => { pageRefs.current[pageNumber - 1] = el; }}
        className="relative" data-page-number={pageNumber}>
        <PageWithHighlights ... />
      </div>
    );
  })}
</div>
```

**Step 3: Update IntersectionObserver to track visible range**

Modify the existing IntersectionObserver (lines 139-167) to also update `visibleRange`:

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
        const center = sorted[Math.floor(sorted.length / 2)];
        if (!isScrollingToPage.current) setVisiblePage(center);

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
}, [numPages, BUFFER]);
```

The `rootMargin: '200% 0px'` pre-loads pages well before they enter the viewport.

**Step 4: Handle scroll-to-page for citation navigation**

When `currentPage` changes (citation click), we need to ensure the target page is rendered:

```tsx
useEffect(() => {
  if (!numPages || !containerRef.current) return;

  // Ensure target page is in render range
  setVisibleRange(prev => ({
    start: Math.min(prev.start, Math.max(1, currentPage - BUFFER)),
    end: Math.max(prev.end, Math.min(numPages, currentPage + BUFFER)),
  }));

  // Then scroll (existing logic)
  requestAnimationFrame(() => {
    const target = pageRefs.current[currentPage - 1];
    if (!target) return;
    // ... existing scroll logic ...
  });
}, [currentPage, scrollNonce, numPages]);
```

**Step 5: Search functionality remains unchanged**

Text extraction in `onDocumentLoadSuccess` iterates all pages via `pdf.getPage(p).getTextContent()` — this does NOT require the page to be rendered in the DOM. It accesses the PDF document object directly. So search is unaffected.

Search HIGHLIGHTING requires the page to be rendered (it uses `customTextRenderer` in `PageWithHighlights`). When a search match is on a non-rendered page, the `handleSearchNext`/`handleSearchPrev` callbacks call `handlePageChange` which triggers the scroll-to-page effect, which expands the render range to include that page.

### Migration Steps

1. Add `pageHeights` state and populate in `onDocumentLoadSuccess`
2. Add `visibleRange` state with initial value covering first 5 pages
3. Replace the page map with conditional rendering (placeholder vs real page)
4. Modify IntersectionObserver to track visible range
5. Ensure scroll-to-page expands range before scrolling
6. Test: large PDF (50+ pages), citation navigation, search, zoom, grab mode

### Risks and Mitigation

| Risk | Mitigation |
|------|-----------|
| Height estimation mismatch causes scroll jumps | Use actual page aspect ratios from `getViewport()`. Mismatch only occurs if the container width changes (window resize) — handle with `ResizeObserver` on container. |
| Placeholder flash when scrolling fast | Use generous buffer (BUFFER=3) and `rootMargin: '200%'` on observer. This pre-renders ~6 pages beyond viewport. Fast flick scrolling may still show placeholders briefly — acceptable trade-off. |
| Page refs for non-rendered pages | Placeholder `<div>`s still get refs and `data-page-number`, so IntersectionObserver works on all pages regardless of render state. |
| Initial render shows first 5 pages only | Default `visibleRange = { start: 1, end: 5 }` covers initial view. If user navigates to page 50 via URL (future feature), would need to initialize range around that page. |
| Zoom changes invalidate height estimates | Recalculate placeholder heights when `scale` changes. Heights are `aspectRatio * containerWidth * scale`, so just depends on the already-stored aspect ratios. |

### Complexity Estimate

**Medium**. ~3-4 hours implementation. No new dependencies. The main complexity is coordinating the visible range with scroll-to-page and ensuring no scroll position jumps.

---

## UX-02: Onboarding Tour

### Research: Tour Libraries

| Library | Size (gzipped) | Next.js Compatible | i18n Support | Customizable | Active? |
|---------|----------------|-------------------|--------------|-------------|---------|
| **driver.js** | ~5KB | Yes (DOM-based, no React dependency) | Manual (text props) | High (CSS + JS) | Active (1.6K GitHub stars, updated 2025) |
| **react-joyride** | ~15KB | Yes (React component) | Manual (step content) | Medium (limited styling API) | Active but heavy |
| **shepherd.js** | ~25KB | Yes (DOM-based) | Plugin available | High | Active but large |
| **intro.js** | ~10KB | Yes (DOM-based) | Built-in i18n | Medium | Dated, license issues |

**Recommendation: driver.js**

Reasons:
1. **Smallest bundle** (~5KB gzipped) — critical for landing page performance
2. **DOM-based** — works with any framework, no React wrapper needed
3. **Simple API** — `driver({ steps: [...] }).drive()` — zero boilerplate
4. **Highly customizable** — CSS classes for styling, fits our zinc palette
5. **No React state management conflicts** — doesn't interfere with our Zustand store or React lifecycle
6. **Popover positioning** — handles scroll, resize, and repositioning automatically

### Proposed Implementation

**When to show the tour**:
- First time a user opens a document (not the landing page — the tour highlights in-app features)
- Detection: `localStorage.getItem('doctalk_tour_completed')` — if not set, show tour
- Trigger: After document reaches `ready` state AND session is initialized (both chat and viewer are available)

**Tour steps** (4 steps, minimal):

1. **Citation demonstration** (target: first AI message's citation `[1]` button, or the chat area if no messages yet)
   - "Click any citation number to see the exact source highlighted in your document"

2. **Mode selector** (target: ModeSelector component in Header)
   - "Choose your AI mode: Quick for fast answers, Balanced for detail, Thorough for deep analysis"
   - Skip if user is anonymous (ModeSelector hidden for demo)

3. **Plus menu** (target: "+" button in ChatPanel input area)
   - "Access custom AI instructions and export your conversation"

4. **Session dropdown** (target: SessionDropdown in Header)
   - "Create multiple chat sessions per document to explore different topics"

**Tour steps for demo users** (3 steps, no ModeSelector):
Steps 1, 3, 4 only.

### Implementation Details

**Files to create**:
- `frontend/src/lib/onboarding.ts` — tour configuration and initialization

**Files to modify**:
- `frontend/src/app/d/[documentId]/page.tsx` — trigger tour after document ready
- All 11 `frontend/src/i18n/locales/*.json` — tour text keys
- `frontend/package.json` — add `driver.js` dependency

**`onboarding.ts`**:

```tsx
import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';

const TOUR_STORAGE_KEY = 'doctalk_tour_completed';

export function shouldShowTour(): boolean {
  if (typeof window === 'undefined') return false;
  return !localStorage.getItem(TOUR_STORAGE_KEY);
}

export function markTourCompleted(): void {
  try {
    localStorage.setItem(TOUR_STORAGE_KEY, '1');
  } catch {}
}

export function startOnboardingTour(
  t: (key: string) => string,
  options?: { showModeSelector?: boolean }
) {
  const steps = [
    {
      element: '[data-tour="chat-area"]',
      popover: {
        title: t('tour.citation.title'),
        description: t('tour.citation.desc'),
        side: 'left' as const,
      },
    },
    ...(options?.showModeSelector !== false ? [{
      element: '[data-tour="mode-selector"]',
      popover: {
        title: t('tour.mode.title'),
        description: t('tour.mode.desc'),
        side: 'bottom' as const,
      },
    }] : []),
    {
      element: '[data-tour="plus-menu"]',
      popover: {
        title: t('tour.plus.title'),
        description: t('tour.plus.desc'),
        side: 'top' as const,
      },
    },
    {
      element: '[data-tour="session-dropdown"]',
      popover: {
        title: t('tour.session.title'),
        description: t('tour.session.desc'),
        side: 'bottom' as const,
      },
    },
  ];

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

**Data attributes to add** (for tour targeting):
- `ChatPanel.tsx` — add `data-tour="chat-area"` to chat message container
- `ChatPanel.tsx` — add `data-tour="plus-menu"` to the "+" button
- `ModeSelector.tsx` — add `data-tour="mode-selector"` to the wrapper
- `SessionDropdown.tsx` — add `data-tour="session-dropdown"` to the trigger button

**Tour trigger in `page.tsx`**:

```tsx
useEffect(() => {
  if (documentStatus !== 'ready' || !sessionId) return;
  if (!shouldShowTour()) return;

  // Delay slightly to ensure UI is fully rendered
  const timer = setTimeout(() => {
    startOnboardingTour(t, {
      showModeSelector: isLoggedIn && !(isDemo && !isLoggedIn),
    });
  }, 1500);

  return () => clearTimeout(timer);
}, [documentStatus, sessionId]);
```

**i18n keys** (8 keys, 11 locales):
```json
{
  "tour.citation.title": "Cited Answers",
  "tour.citation.desc": "Click any [1] citation to see the exact source highlighted in your document.",
  "tour.mode.title": "AI Performance Modes",
  "tour.mode.desc": "Quick for fast answers, Balanced for detail, Thorough for deep analysis.",
  "tour.plus.title": "More Options",
  "tour.plus.desc": "Set custom AI instructions or export your conversation.",
  "tour.session.title": "Chat Sessions",
  "tour.session.desc": "Create multiple chats per document to explore different topics."
}
```

**Custom CSS** (add to `globals.css`):

```css
/* Onboarding tour */
.doctalk-tour-popover {
  --driverjs-bg: theme('colors.white');
  --driverjs-color: theme('colors.zinc.900');
  --driverjs-progress-color: theme('colors.indigo.500');
  border: 1px solid theme('colors.zinc.200');
  border-radius: 12px;
  box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
}

.dark .doctalk-tour-popover {
  --driverjs-bg: theme('colors.zinc.900');
  --driverjs-color: theme('colors.zinc.50');
  border-color: theme('colors.zinc.700');
}
```

### Migration Steps

1. `npm install driver.js`
2. Create `frontend/src/lib/onboarding.ts`
3. Add `data-tour` attributes to 4 components
4. Add 8 i18n keys to all 11 locale files
5. Add tour trigger in `page.tsx`
6. Add custom CSS to `globals.css`
7. Test: first visit shows tour, subsequent visits do not, dismiss works, all 4 targets found

### Risks and Mitigation

| Risk | Mitigation |
|------|-----------|
| Tour element not found (component not rendered yet) | 1.5s delay + `driver.js` gracefully skips missing elements |
| Tour shows on mobile where layout is different (UX-01) | If mobile tab layout is implemented, tour should only show on desktop (`window.innerWidth >= 640` guard). On mobile, a simpler "tip" approach may be better. |
| User finds tour annoying | Single show + easy dismiss (click outside or X). `localStorage` flag prevents re-show. Could add "Show Tour" button in help/settings for replay. |
| driver.js CSS conflicts with our design system | Custom `popoverClass` + overrides in globals.css. Scoped to `.doctalk-tour-popover`. |
| Bundle size impact on landing page | driver.js is only imported in `onboarding.ts` which is only imported in `page.tsx` (document reader). Not loaded on landing page. Dynamic import possible if needed: `const { driver } = await import('driver.js')`. |

### Complexity Estimate

**Small**. ~2 hours implementation. driver.js is a simple library with minimal configuration. The bulk of work is writing i18n strings for 11 locales.

---

## Summary: Priority and Sequencing

| Item | Priority | Effort | Dependencies |
|------|----------|--------|-------------|
| **UX-01: Mobile tabs** | P1 | Small-Medium (2h) | None |
| **FE-01 Phase 1+2: SEO quick wins** | P1 | Small (1.5h) | None |
| **FE-02: PDF virtualization** | P2 | Medium (3-4h) | None |
| **UX-02: Onboarding tour** | P2 | Small (2h) | UX-01 should land first (mobile layout affects tour) |
| **FE-01 Phase 3: Full SSR** | P3 | Large (2-3d) | Deferred |

**Recommended execution order**: UX-01 → FE-01 P1+P2 → FE-02 → UX-02

UX-01 and FE-01 are independent and can be parallelized. FE-02 is independent. UX-02 should wait for UX-01 to avoid tour targeting issues with the mobile layout.
