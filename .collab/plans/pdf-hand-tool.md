# PDF Pan/Drag (Hand Tool) Feature — Implementation Plan for Codex

## Goal
Add a hand/grab tool to the PDF toolbar. When active, clicking and dragging on the PDF container pans the scroll position. When inactive, normal text selection behavior is preserved.

## Files to Modify (11 files total)

### 1. `frontend/src/store/index.ts` — Add `grabMode` state

In `DocTalkStore` interface, add:
```ts
grabMode: boolean;
setGrabMode: (v: boolean) => void;
```

In `initialState`, add:
```ts
grabMode: false,
```

In the store creation, add:
```ts
setGrabMode: (v: boolean) => set({ grabMode: v }),
```

In `reset()`, ensure `grabMode` is reset (it will be via `...initialState`).

### 2. `frontend/src/components/PdfViewer/PdfToolbar.tsx` — Add hand tool toggle

- Import `Hand` from `lucide-react`
- Import `useLocale` (already imported)
- Add new props to `PdfToolbarProps`: `grabMode: boolean`, `onGrabModeToggle: () => void`
- Add a toggle button between the zoom controls divider and page navigation:

```
[ZoomOut] [100%] [ZoomIn] | [Hand] | [Prev] [1/10] [Next]
```

The button should look like:
```tsx
<button
  onClick={onGrabModeToggle}
  className={`p-1 rounded ${grabMode ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400' : 'hover:bg-gray-100 dark:hover:bg-gray-700'}`}
  title={t('toolbar.grabMode')}
>
  <Hand size={16} />
</button>
```

Add a divider after the hand button (same style as existing: `<div className="w-px h-5 bg-gray-300 dark:bg-gray-600 mx-1" />`).

### 3. `frontend/src/components/PdfViewer/PdfViewer.tsx` — Add drag-to-pan

- Read `grabMode` and `setGrabMode` from Zustand store
- Add `isDragging` state: `const [isDragging, setIsDragging] = useState(false);`
- Add `dragState` ref for tracking mouse positions without re-renders:
```ts
const dragState = useRef({ isDragging: false, startX: 0, startY: 0, scrollLeft: 0, scrollTop: 0 });
```

- Add mouse handlers:
```ts
const handleMouseDown = useCallback((e: React.MouseEvent) => {
  if (!grabMode || !containerRef.current) return;
  dragState.current = {
    isDragging: true,
    startX: e.clientX,
    startY: e.clientY,
    scrollLeft: containerRef.current.scrollLeft,
    scrollTop: containerRef.current.scrollTop,
  };
  setIsDragging(true);
}, [grabMode]);

const handleMouseMove = useCallback((e: React.MouseEvent) => {
  if (!dragState.current.isDragging || !containerRef.current) return;
  const dx = e.clientX - dragState.current.startX;
  const dy = e.clientY - dragState.current.startY;
  containerRef.current.scrollLeft = dragState.current.scrollLeft - dx;
  containerRef.current.scrollTop = dragState.current.scrollTop - dy;
}, []);

const handleMouseUp = useCallback(() => {
  dragState.current.isDragging = false;
  setIsDragging(false);
}, []);
```

- Attach handlers to the container div (the `ref={containerRef}` div on line ~140):
```tsx
<div
  className={`flex-1 overflow-auto ${grabMode ? (isDragging ? 'cursor-grabbing' : 'cursor-grab') : ''}`}
  style={grabMode ? { userSelect: 'none' } : undefined}
  ref={containerRef}
  onMouseDown={handleMouseDown}
  onMouseMove={handleMouseMove}
  onMouseUp={handleMouseUp}
  onMouseLeave={handleMouseUp}
>
```

- Pass `grabMode` and toggle to PdfToolbar:
```tsx
<PdfToolbar
  currentPage={visiblePage}
  totalPages={numPages}
  scale={scale}
  onPageChange={handlePageChange}
  onScaleChange={handleScaleChange}
  grabMode={grabMode}
  onGrabModeToggle={() => setGrabMode(!grabMode)}
/>
```

### 4-11. i18n locale files — Add `toolbar.grabMode` key

Add this key AFTER the existing `toolbar.nextPage` line in each file:

| File | Value |
|------|-------|
| `frontend/src/i18n/locales/en.json` | `"toolbar.grabMode": "Hand tool (drag to pan)"` |
| `frontend/src/i18n/locales/zh.json` | `"toolbar.grabMode": "抓手工具（拖动平移）"` |
| `frontend/src/i18n/locales/hi.json` | `"toolbar.grabMode": "हैंड टूल (पैन करने के लिए ड्रैग करें)"` |
| `frontend/src/i18n/locales/es.json` | `"toolbar.grabMode": "Herramienta mano (arrastrar para desplazar)"` |
| `frontend/src/i18n/locales/ar.json` | `"toolbar.grabMode": "أداة اليد (اسحب للتحريك)"` |
| `frontend/src/i18n/locales/fr.json` | `"toolbar.grabMode": "Outil main (glisser pour déplacer)"` |
| `frontend/src/i18n/locales/bn.json` | `"toolbar.grabMode": "হ্যান্ড টুল (প্যান করতে ড্র্যাগ করুন)"` |
| `frontend/src/i18n/locales/pt.json` | `"toolbar.grabMode": "Ferramenta mão (arrastar para mover)"` |

Each should be added right after the `"toolbar.nextPage"` line with a comma on the previous line.

## Verification
After all changes, run: `cd frontend && npm run build`
The build should succeed with no errors.
