Implemented all remaining `NEEDS WORK` items, with one note: the UX-23 targets in this branch were already using the standardized hover pattern, so no additional class changes were needed there.

**Changes made**

1. FE-10 silent catch comments
- Added `// localStorage unavailable in private browsing` inside intentional localStorage catch blocks in:
`frontend/src/store/index.ts`
`frontend/src/components/Chat/MessageBubble.tsx`
`frontend/src/i18n/LocaleProvider.tsx`

2. FE-11 lazy `react-markdown`
- Switched to `React.lazy(() => import('react-markdown'))` and wrapped usage in `Suspense`:
`frontend/src/components/Chat/MessageBubble.tsx` (plain-text fallback)
`frontend/src/components/TextViewer/TextViewer.tsx` (spinner fallback)

3. FE-12 shared `useUserProfile` hook
- Added:
`frontend/src/lib/useUserProfile.ts`
- Includes 60s stale-while-revalidate caching with timestamp via `useRef`, `profile/loading/error/refetch`, and `getUserProfile()` usage.
- Refactored callers:
`frontend/src/app/page.tsx`
`frontend/src/app/billing/page.tsx`
`frontend/src/app/profile/page.tsx`

4. FE-14 route error boundaries
- Added:
`frontend/src/app/error.tsx`
`frontend/src/app/billing/error.tsx`
`frontend/src/app/profile/error.tsx`
`frontend/src/app/demo/error.tsx`
- All are `"use client"`, use `useLocale()`, render styled zinc card with error message and `reset()` “Try again” button.

5. FE-16 network status detection + banner
- Added:
`frontend/src/lib/useNetworkStatus.ts`
`frontend/src/components/NetworkBanner.tsx`
- Banner is dismissible, resets on next offline event, uses `network.offline`, includes `motion-reduce:animate-none`.
- Mounted in layout before children, inside providers:
`frontend/src/app/layout.tsx`

6. FE-17 i18n keys (all 11 locales)
- Added to all locale files in `frontend/src/i18n/locales/*.json`:
`header.theme`
`error.title`
`error.tryAgain`
`network.offline`
- Also preserved existing `header.win98Mode` keys to avoid regression.

7. UX-14 document processing skeleton
- Replaced processing spinner block with chat-like pulse skeleton + status text (with ARIA live semantics) in:
`frontend/src/app/d/[documentId]/page.tsx`

8. CL-04 dark mode background consistency
- Standardized page backgrounds to `bg-[var(--page-background)]` and panel/card dark surfaces to `dark:bg-zinc-900` in:
`frontend/src/app/profile/page.tsx`
`frontend/src/app/admin/page.tsx`
- `frontend/src/app/billing/page.tsx` already aligned in current branch.

**Validation run**

1. `cd frontend && npx tsc --noEmit` passed
2. `cd frontend && npx next lint` passed (pre-existing warnings only)
3. `cd frontend && npx next build` passed (same pre-existing warnings only)