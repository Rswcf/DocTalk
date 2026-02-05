# Current Tasks
ISSUED_BY: CC
DATE: 2026-02-05

---

## Task: Fix PDF Toolbar Page Navigation (Prev/Next Arrows Don't Work)

- PRIORITY: P0
- STATUS: PENDING
- DESCRIPTION: |
    Clicking the left (prev) or right (next) arrows in the PDF toolbar does not navigate pages after the first click.

    ### Root Cause

    In `frontend/src/components/PdfViewer/PdfViewer.tsx`:

    1. `PdfToolbar` receives `currentPage={visiblePage}` (line 96) — a local state tracked by IntersectionObserver (IO)
    2. The scroll-to-page `useEffect` (lines 32-41) sets `isScrollingToPage.current = true` for 800ms to suppress the IO during programmatic scrolls
    3. After the smooth scroll completes and the 800ms timeout expires, the IO does NOT re-fire because no new intersection threshold crossings occur
    4. **`visiblePage` stays stale** (stuck at the old value before the scroll)
    5. On the next toolbar click, `PdfToolbar` computes the target page from the stale `visiblePage`. The computed target equals the already-stored `store.currentPage`, so Zustand sees no state change, the `useEffect` doesn't re-fire, and nothing happens

    **Example**: User is on page 1, clicks "next":
    - `setPage(2)` → store.currentPage=2 → scroll fires → IO suppressed → `visiblePage` stays 1
    - User clicks "next" again → `onPageChange(1+1=2)` → `setPage(2)` → store already 2 → no change → no scroll!

    ### Fix (Two Changes in `PdfViewer.tsx`)

    **Change 1: Sync `visiblePage` in the scroll-to-page useEffect (line 32-41)**

    Add `setVisiblePage(currentPage);` before the `scrollIntoView` call. This ensures `visiblePage` (and thus the toolbar's displayed page number and prev/next calculations) is always correct after a programmatic scroll.

    Current code:
    ```typescript
    useEffect(() => {
      if (!numPages) return;
      const target = pageRefs.current[currentPage - 1];
      if (target) {
        isScrollingToPage.current = true;
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        setTimeout(() => { isScrollingToPage.current = false; }, 800);
      }
    }, [currentPage, scrollNonce, numPages]);
    ```

    New code:
    ```typescript
    useEffect(() => {
      if (!numPages) return;
      const target = pageRefs.current[currentPage - 1];
      if (target) {
        isScrollingToPage.current = true;
        setVisiblePage(currentPage);
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        setTimeout(() => { isScrollingToPage.current = false; }, 800);
      }
    }, [currentPage, scrollNonce, numPages]);
    ```

    **Change 2: Bump `scrollNonce` in `handlePageChange` (line 82-84)**

    Handle the edge case where the user manually scrolls to a page adjacent to `store.currentPage` and then clicks prev/next targeting a page that already matches the store. By bumping `scrollNonce`, the useEffect always fires regardless of whether `currentPage` actually changed.

    Current code:
    ```typescript
    const handlePageChange = useCallback((page: number) => {
      setPage(page);
    }, [setPage]);
    ```

    New code:
    ```typescript
    const handlePageChange = useCallback((page: number) => {
      useDocTalkStore.setState((state) => ({
        currentPage: Math.max(1, page),
        scrollNonce: state.scrollNonce + 1,
      }));
    }, []);
    ```

    Note: `useDocTalkStore` is already imported in this file (line 9). The `setPage` destructure from the store (line 28) will no longer be used inside `handlePageChange`, but it is still referenced elsewhere or can be left for clarity. If the linter flags it as unused, remove it from the destructure.

- ACCEPTANCE:
    - `cd frontend && npm run build` passes with no errors
    - `cd frontend && npx next lint` passes (no new errors)
    - Clicking next/prev arrows in the toolbar repeatedly navigates one page at a time
    - Page number in toolbar always reflects the currently visible page
    - Citation click navigation still works correctly
    - Manual scrolling with mouse wheel still updates the toolbar page number
- FILES:
    - `frontend/src/components/PdfViewer/PdfViewer.tsx` (ONLY file to modify)
- NOTES: |
    Only modify the two specific code sections described above.
    After making the changes, check if `setPage` is still used — if not, remove it from
    the destructure `const { setPage, setScale } = useDocTalkStore();` (keep `setScale`).
    Run build and lint to verify.

---END---
