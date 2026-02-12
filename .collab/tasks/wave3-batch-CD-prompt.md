# Wave 3 Phase 2: Batch C + D Implementation

You are implementing the remaining items from Batch C (Frontend Quality) and Batch D (UX Improvements) for the DocTalk project. Some items are ALREADY DONE — skip those. Focus only on items marked NEEDS WORK.

## Current state
- Frontend builds successfully (npx next build passes)
- clsx and tailwind-merge are installed in frontend/
- A few FE-10 catches were already fixed (collections/page.tsx:49, page.tsx:228, collections/[collectionId]/page.tsx:80+95, billing/page.tsx:80)
- UserMenu.tsx line 137 "Theme" was changed to {t("header.theme")} but the i18n key does not exist yet — you need to add it

## BATCH C: Frontend Quality

### FE-10: Fix remaining silent error swallowing — PARTIALLY DONE
Already fixed: collections/page.tsx, page.tsx, collections/[collectionId]/page.tsx, billing/page.tsx
Still needs: Add comments to intentional empty catches (localStorage ones in store/index.ts, MessageBubble.tsx, i18n/LocaleProvider.tsx — add // localStorage unavailable in private browsing comment inside the catch)

### FE-11: Dynamic import react-markdown — NEEDS WORK
Files: frontend/src/components/Chat/MessageBubble.tsx, frontend/src/components/TextViewer/TextViewer.tsx
Change: Replace static import ReactMarkdown from react-markdown with React.lazy(() => import('react-markdown')). Wrap ReactMarkdown usage in Suspense with appropriate fallback (plain text for MessageBubble, loading spinner for TextViewer). Keep import remarkGfm from remark-gfm as static import (it is tiny).

### FE-12: Create useUserProfile shared hook — NEEDS WORK
File: New frontend/src/lib/useUserProfile.ts
Change: Create useUserProfile() hook returning { profile, loading, error, refetch } with 60s stale-while-revalidate via useRef timestamp. Uses getUserProfile() from ./api. Then refactor callers:
- frontend/src/app/page.tsx — replace direct getUserProfile() call with useUserProfile()
- frontend/src/app/billing/page.tsx — replace direct getUserProfile() call with useUserProfile()
- frontend/src/app/profile/page.tsx — replace direct getUserProfile() call with useUserProfile()
Note: useUserPlanProfile.ts already exists for the document page — leave it alone, it serves a different purpose (plan detection for doc reader).

### FE-14: Add route-level error boundaries — NEEDS WORK
Create error.tsx files for routes that are MISSING them:
- frontend/src/app/error.tsx (root)
- frontend/src/app/billing/error.tsx
- frontend/src/app/profile/error.tsx
- frontend/src/app/demo/error.tsx

Already exist (DO NOT touch):
- frontend/src/app/d/[documentId]/error.tsx
- frontend/src/app/collections/[collectionId]/error.tsx

Each error.tsx should:
- Be "use client"
- Accept { error, reset } props (standard Next.js error boundary)
- Render a styled card with error message and Try again button (zinc palette, matches existing design)
- Use useLocale() for i18n — keys: error.title, error.tryAgain (add to all 11 locales)
- Call reset() on button click

### FE-15: cn() utility — ALREADY DONE, SKIP

### FE-16: Network status detection — NEEDS WORK
Create 2 new files:

1. frontend/src/lib/useNetworkStatus.ts:
- useNetworkStatus() hook that returns boolean isOnline
- SSR guard: typeof navigator !== undefined check
- Listens to window online/offline events
- Cleanup on unmount

2. frontend/src/components/NetworkBanner.tsx:
- Shows a dismissible offline warning banner at the top of the page
- Uses useNetworkStatus() hook
- Shows You are offline message (i18n key: network.offline)
- Dismiss button — resets on next offline event (not permanent)
- Styled: amber/yellow background, zinc text, small dismiss X button
- Add motion-reduce:animate-none for reduced motion

Then add NetworkBanner to frontend/src/app/layout.tsx inside the body, before {children}. Make sure it is inside the locale/theme providers.

### FE-17: i18n for remaining hardcoded strings — NEEDS WORK
Add these i18n keys to ALL 11 locale files (en, zh, es, ja, de, fr, ko, pt, it, ar, hi):
- header.theme: Theme (for UserMenu mobile theme section)
- error.title: Something went wrong
- error.tryAgain: Try again
- network.offline: You are currently offline. Some features may be unavailable.

Translate appropriately for each locale. These keys should be added to the existing JSON structure in frontend/src/i18n/locales/*.json.

### UX-14: Document processing skeleton screen — NEEDS WORK
File: frontend/src/app/d/[documentId]/page.tsx
Change: Replace the processing state spinner (the documentStatus !== ready block around lines 104-109) with a skeleton layout using animate-pulse bars that mimic chat messages. Keep the status text underneath. Keep ARIA live semantics.

## BATCH D: UX Improvements

### UX-10: Merge theme/language on mobile — ALREADY DONE, SKIP
### UX-25: Responsive document name truncation — ALREADY DONE, SKIP
### UX-27: Collections empty state CTA — ALREADY DONE, SKIP
### UX-28: Account deletion modal animation — ALREADY DONE, SKIP
### CL-09: Hero accent glow — ALREADY DONE, SKIP

### UX-23: Standardize card hover effects — NEEDS WORK
Apply consistent hover pattern to interactive cards that do not already have it:
hover:shadow-md hover:-translate-y-0.5 transition-shadow transition-transform duration-200

Check and apply to:
- Document cards in frontend/src/app/page.tsx (the recent documents grid items)
- Collection cards in frontend/src/components/Collections/CollectionList.tsx
- Feature cards in frontend/src/components/landing/FeatureGrid.tsx
- Pricing cards in frontend/src/app/billing/page.tsx

Do not add hover to cards that should not move (e.g., static info panels, chat bubbles).

### CL-04: Dark mode background consistency — NEEDS WORK
Audit and standardize:
- Page backgrounds should use dark:bg-zinc-950 (or bg-[var(--page-background)])
- Card/panel backgrounds should use dark:bg-zinc-900
- Check frontend/src/app/billing/page.tsx, frontend/src/app/profile/page.tsx, frontend/src/app/admin/page.tsx for consistency
- The CSS variable --page-background is #09090b in dark mode (= zinc-950). Prefer using bg-[var(--page-background)] for page backgrounds where possible.

## Validation
After all changes:
1. Run: cd frontend && npx tsc --noEmit — must pass
2. Run: cd frontend && npx next lint — must pass (pre-existing warnings OK)
3. Run: cd frontend && npx next build — must pass

## IMPORTANT RULES
- UI palette: zinc monochrome + indigo accent. Zero gray-*/blue-* classes
- All components using t() MUST be inside LocaleProvider (they already are if in pages)
- Do not touch files that are not mentioned
- Do not add features beyond what is specified
- Keep code minimal and focused
