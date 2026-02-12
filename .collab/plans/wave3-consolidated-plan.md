# Wave 3: Consolidated Fix Plan (Revised)

**Date**: 2026-02-12
**Status**: Revised per Codex review — resubmitting for approval
**Codex review**: `.collab/reviews/wave3-codex-review.md`

---

## Overview

33 remaining items from the 87-item product audit, organized into 5 executable batches (A-E).
Previous waves (1-2) fixed 50 items. This wave addresses the remaining 33.
FE-23 (extract suggested question keys) is absorbed into FE-18 and not counted separately.

**Removed per Codex review**:
- ~~FE-22~~ (standardize exports) — REJECTED: low value, high churn, breaks legitimate named exports
- ~~UX-24~~ (feedback API) — DEFERRED: requires message ID plumbing in chat schema/store first; incomplete design

**Key revisions**: Updated stale scope for BE-03, BE-12, BE-21, FE-14, UX-27. Fixed dependency sequencing. Adjusted effort estimates.

---

## Batch A: Backend Fixes (8 items)

### BE-03: Standardize error responses — JSONResponse → HTTPException
**Files**: `backend/app/api/chat.py`
**Change**: Convert ALL `JSONResponse(status_code=...)` calls to `raise HTTPException(...)` in chat.py. There are ~6 call sites (lines ~200, ~204, ~214, ~222, ~234, ~250), not just 1 as originally scoped. Preserve `Retry-After` headers via `HTTPException(headers={"Retry-After": ...})`. Ensure error payload shape remains compatible with `frontend/src/lib/sse.ts:34` parsing.

### BE-12: Reduce profile endpoint query count (3→2)
**Files**: `backend/app/api/users.py`
**Change**: In `get_profile()`, fold `total_tokens_used` aggregation into the existing stats aggregate query using `func.sum()`. Current state is ~3 queries (accounts, stats, tokens) — combine stats+tokens into one. The "6→3" claim in original plan was outdated.

### BE-15: Refactor stripe_webhook into handler functions
**Files**: `backend/app/api/billing.py`
**Change**: Extract the `stripe_webhook` function (lines ~145-377) into per-event handlers:
- `_handle_checkout_session_completed(session, db)` — further split by mode (subscription vs payment)
- `_handle_invoice_payment_succeeded(invoice, db)`
- `_handle_subscription_deleted(subscription, db)`
Main webhook becomes a ~20-line dispatcher. Preserve idempotency checks (CreditLedger lookups) and commit/rollback semantics. Return 5xx for retry-worthy DB errors.

### BE-16: Redis-backed rate limiter
**Files**: `backend/app/core/rate_limit.py`
**Change**: Replace both `InMemoryRateLimiter` AND `DemoMessageTracker` with Redis-backed implementations. `RedisRateLimiter` uses atomic INCR+EXPIRE with first-write expiration. `RedisDemoTracker` uses Redis hash per session for message counts. Graceful fallback to current in-memory implementations if Redis unavailable. Import `redis.asyncio` from existing dependency.

### BE-18: Standardize pagination across endpoints
**Files**: `backend/app/api/documents.py`, `backend/app/api/chat.py`, `backend/app/api/collections.py`, `backend/app/api/admin.py`
**Change**: Add `limit: int = Query(20, ge=1, le=100)` and `offset: int = Query(0, ge=0)` parameters to endpoints that currently return all results or have hardcoded limits. Maintain existing default limits for backward compatibility. Document sort order guarantees (created_at DESC).

### BE-19: Add Pydantic response_model to endpoints
**Files**: `backend/app/schemas/` (new schemas), all files in `backend/app/api/`
**Change**: Define response schemas and add `response_model=` to externally consumed endpoints first (documents, chat, billing, users, admin). Leave internal auth endpoints stable. Key schemas:
- `HealthResponse`, `HealthDeepResponse`
- `SessionListResponse`, `MessageListResponse`
- `AdminOverviewResponse`, `AdminTrendsResponse`
- `CreditBalanceResponse`, `CreditHistoryResponse`
- `UserProfileResponse`, `UsageBreakdownResponse`
**Note**: Do AFTER BE-21 to avoid churn from route prefix changes.

### BE-21: Standardize route prefixes
**Files**: `backend/app/main.py`, ALL router files in `backend/app/api/`
**Change**: Standardize ALL routers to Pattern 2: full prefix in router definition (`APIRouter(prefix="/api/...")`), `include_router()` with no prefix. This includes documents, search, chat, chunks, credits, users, billing, collections, admin routers — not just the subset originally listed. Each router file becomes self-documenting about its URL paths.
**Note**: Do BEFORE BE-19 to stabilize endpoint inventory.

### BE-24: Application-level Redis caching
**Files**: New `backend/app/core/cache.py`, plus modifications to endpoints
**Change**: Create thin cache helpers (`cache_get`, `cache_set`, `cache_delete`, `cache_delete_pattern`) wrapping `redis.asyncio`. Cache high-cost/DB-heavy paths only:
- Demo documents list: TTL 5min (rarely changes)
- User profile: TTL 30s (invalidate on plan change via webhook handlers)
- Admin overview aggregates: TTL 1min
**Note**: Do NOT cache credit balance — too many write paths to invalidate safely. Stripe products are static config, low query cost, not worth caching.
**Depends on**: BE-16 (shared Redis infrastructure patterns).

---

## Batch B: Frontend Core Refactoring (5 items)

### FE-06: Remove Win98 theme entirely
**Files**: ~12+ files with `isWin98` branches, ThemeProvider, ThemeSelector, globals.css, win98 components
**Change**: Remove all 99 `isWin98` conditional branches. Remove Win98 option from ThemeSelector. Delete win98-specific CSS/components. Add localStorage migration: if stored theme is `win98`, reset to `dark`. Update ThemeProvider to no longer recognize `win98` value.
**Affected files**: `page.tsx` (d/[documentId]), `ThemeSelector.tsx`, `Header.tsx`, `ChatPanel.tsx`, `MessageBubble.tsx`, `SessionDropdown.tsx`, `ModeSelector.tsx`, `PdfViewer.tsx`, `CustomInstructionsModal.tsx`, `UserMenu.tsx`, `CreditsDisplay.tsx`, `LanguageSelector.tsx`, `globals.css`, `ThemeProvider` (if exists)
**Effort**: Large (1-2 days). Must run FIRST in frontend batches to avoid duplicate work.

### FE-05: Extract hooks from document page (486→~200 lines)
**Files**: `frontend/src/app/d/[documentId]/page.tsx`, new hooks in `frontend/src/lib/`
**Change**: Extract 3 custom hooks:
- `useDocumentLoader(documentId)` — document fetching, status polling, file URL loading
- `useChatSession(documentId)` — session creation, session switching, message loading
- `useUserPlanProfile()` — profile loading, plan detection, permissions
**Note**: Do AFTER FE-06 (Win98 removal simplifies the page significantly).

### FE-07: Type authAdapter (eliminate 29 `as any`)
**Files**: `frontend/src/lib/authAdapter.ts`
**Change**: Define TypeScript interfaces matching actual backend payloads:
```typescript
interface BackendUser { id: string; email: string; name?: string; image?: string; email_verified?: string; }
interface BackendAccount { provider: string; provider_account_id: string; user_id: string; }
```
Add `toAdapterUser(data: BackendUser): AdapterUser` converter. Replace all 29 `as any` casts. Use narrow interfaces for external library types where needed.

### FE-13: Fix ~30 `any` types across priority files
**Files**: `ChatPanel.tsx`, `PdfViewer.tsx`, `store/index.ts`, `sse.ts`
**Change**: Replace `any` with proper types in priority files first. Use narrow interfaces for external library types (pdf.js). Avoid forcing types where library types are unstable.

### FE-18: Split ChatPanel (614→~250 lines)
**Files**: `frontend/src/components/Chat/ChatPanel.tsx`, new files
**Change**: Extract:
- `useChatStream()` hook — streaming logic, abort controller, message state
- `PlusMenu.tsx` component — the "+" dropdown menu
- Move `renumberCitations()` (currently inline ~line 58) to `frontend/src/lib/citations.ts`
- Move `SUGGESTED_KEYS` array (~line 86) to `frontend/src/lib/constants.ts` (absorbs FE-23)
**Note**: `MessageErrorBoundary` already exists in-file (~line 31) — just move it to separate file. Do BEFORE UX-01 and UX-02.

---

## Batch C: Frontend Quality & Features (9 items)

### FE-09: Replace `<img>` with `next/image`
**Files**: `frontend/src/components/UserMenu.tsx`, `frontend/next.config.mjs`
**Change**: Replace `<img src={user.image} ...>` with `<Image src={user.image} width={32} height={32} alt="" />`. Configure `remotePatterns` in `next.config.mjs` for Google/Microsoft avatar domains (e.g., `lh3.googleusercontent.com`, `graph.microsoft.com`).

### FE-10: Fix silent error swallowing
**Files**: `frontend/src/app/collections/page.tsx`, other files with empty catch blocks
**Change**: Add `console.error()` logging to remaining empty catch blocks. For collections page, add user-visible error state when operations fail. Add comments to intentional catches (e.g., localStorage in private browsing).

### FE-11: Dynamic import react-markdown
**Files**: `frontend/src/components/Chat/MessageBubble.tsx`, `frontend/src/components/TextViewer/TextViewer.tsx`
**Change**: Replace static `import ReactMarkdown from 'react-markdown'` with `React.lazy()` + `Suspense`. This moves ~50KB out of the initial bundle. Ensure no flash of unstyled content for first message render.
**Note**: Coordinate with FE-18 (MessageBubble is touched in both).

### FE-12: Create useUserProfile hook
**Files**: New `frontend/src/lib/useUserProfile.ts`, refactor callers
**Change**: Create hook `useUserProfile()` returning `{ profile, loading, error, refetch }`. Replace 4 independent `getUserProfile()` call sites. 60s stale-while-revalidate via `useRef` timestamp check.
**Note**: Helpful for FE-05 refactor.

### FE-14: Add route-level error boundaries (missing routes only)
**Files**: New `error.tsx` files in routes that lack them
**Change**: Some routes already have error boundaries (`d/[documentId]/error.tsx`, `collections/[collectionId]/error.tsx`, `global-error.tsx`). Add `error.tsx` only to routes that are MISSING: `app/`, `app/billing/`, `app/profile/`, `app/demo/`. Each renders a styled error card with "Try again" button.

### FE-15: Add `cn()` utility (clsx + tailwind-merge)
**Files**: `frontend/src/lib/utils.ts`, `frontend/package.json`
**Change**: Add `cn()` function. Install `clsx` and `tailwind-merge` dependencies. Do NOT refactor existing code to use it — just make it available.

### FE-16: Network status detection
**Files**: New `frontend/src/lib/useNetworkStatus.ts`, new `frontend/src/components/NetworkBanner.tsx`
**Change**: Create `useNetworkStatus()` hook with SSR guard (`typeof navigator !== 'undefined'`). Create `NetworkBanner` that shows dismissible offline warning. Dismiss resets on next offline event (not permanent). Add to `layout.tsx`.

### FE-17: i18n for remaining hardcoded strings
**Files**: Various components, all 11 locale files
**Change**: Targeted audit of remaining English strings. Add i18n keys for terms/privacy link text, error fallback messages. Coordinate with UX-01/UX-02 new keys to batch all locale file changes.

### UX-14: Document processing skeleton screen
**Files**: `frontend/src/app/d/[documentId]/page.tsx`
**Change**: Replace "Processing document..." text (~line 300-307) with skeleton layout: skeleton bars for chat area + skeleton rectangle for viewer. Use `animate-pulse` on `bg-zinc-200 dark:bg-zinc-800`. Keep ARIA live semantics.

---

## Batch D: UX Improvements (7 items)

### UX-10: Merge theme/language selectors on mobile
**Files**: `frontend/src/components/Header.tsx`, `frontend/src/components/UserMenu.tsx`
**Change**: On `<sm` screens, hide standalone ThemeSelector and LanguageSelector with `hidden sm:flex`. Add them as sub-items inside UserMenu dropdown (extend menu with theme/language options). Requires UserMenu extension beyond current profile/billing/signout items.

### UX-23: Standardize card hover effects
**Files**: Various card components
**Change**: Define consistent hover pattern: `hover:shadow-md hover:-translate-y-0.5 transition-shadow transition-transform duration-200`. Apply via reusable class or `cn()` utility. Apply to: feature cards, document cards, collection cards, pricing cards.

### UX-25: Responsive document name truncation
**Files**: `frontend/src/components/Header.tsx`, `frontend/src/components/SessionDropdown.tsx`
**Change**: Replace fixed `max-w-[200px] truncate` with responsive: `max-w-[120px] sm:max-w-[200px] md:max-w-[300px] truncate`. Apply to header document title and session dropdown names.

### UX-27: Collections empty state CTA
**Files**: `frontend/src/app/collections/page.tsx`
**Change**: The empty state is already partially styled (~lines 71-83). Add a prominent "Create Collection" CTA button to the existing empty panel. Reuse the create-action button behavior already in the page.

### UX-28: Account deletion modal animation
**Files**: `frontend/src/components/Profile/AccountActionsSection.tsx`
**Change**: Add `animate-fade-in` to deletion confirmation modal overlay and `animate-slide-up` to modal card. Add `motion-reduce:animate-none` for reduced-motion preferences.

### CL-04: Dark mode background consistency
**Files**: Various components
**Change**: Audit all `dark:bg-zinc-950` vs `dark:bg-zinc-900` usage. Standardize: page backgrounds → `dark:bg-zinc-950`, card/panel backgrounds → `dark:bg-zinc-900`. Use existing CSS variable `--page-background` (already in globals.css) where possible instead of hardcoded classes.

### CL-09: Hero section accent glow
**Files**: `frontend/src/components/landing/HeroSection.tsx`
**Change**: Add subtle radial gradient glow behind hero title using the existing accent color system (not hardcoded color). Avoid conflicting with existing dot pattern or showcase glow.

---

## Batch E: Architecture (4 items)

### UX-01: Mobile responsive document reader (P0)
**Files**: `frontend/src/app/d/[documentId]/page.tsx`, 11 locale files
**Change**: Below `sm` (640px), replace side-by-side resizable panels with full-width tab layout. Both panels stay mounted via CSS `hidden`/`block` to preserve state. Bottom tab bar with MessageSquare/FileText icons. Auto-switch to Document tab on citation click. Add `env(safe-area-inset-bottom)` for notch phones. 2 i18n keys × 11 locales.
**Note**: Do NOT address Win98 mobile layout (removed in FE-06). Effort: 4-8h with QA.
**Depends on**: FE-05, FE-06 (simplified page structure needed first).
**See**: `.collab/plans/architecture-fixes-plan.md`

### FE-01: Landing page SEO quick wins (Phase 1+2)
**Files**: `frontend/src/app/page.tsx`, `frontend/src/app/layout.tsx`
**Change**:
- **Phase 1**: Change loading state (~line 240-245) to render full landing page instead of "Loading..." spinner. Extract `<LandingPageContent />` component.
- **Phase 2**: Enhance metadata in `layout.tsx` (title, description, openGraph).
- This is SEO mitigation (loading-state fix), not true SSR conversion. Phase 3 (full SSR) deferred.

### FE-02: PDF page virtualization
**Files**: `frontend/src/components/PdfViewer/PdfViewer.tsx`
**Change**: DIY viewport-based rendering. BUFFER=3 pages. Use real page viewport dimensions from `pdf.getPage(p).getViewport()` for placeholder heights (not container-width heuristics). IntersectionObserver with `rootMargin: '200%'`. Handle zoom/resize recalculation. Citation scroll-to-page expands visible range before scrolling. Effort: 1-2 days with testing.
**Depends on**: Should coordinate with UX-01 (both panels mounted on mobile).
**See**: `.collab/plans/architecture-fixes-plan.md`

### UX-02: Onboarding tour with driver.js
**Files**: New `frontend/src/lib/onboarding.ts`, page.tsx, globals.css, 11 locale files, package.json
**Change**: Install `driver.js` (~5KB). 4-step tour targeting `data-tour` attributes. Skip on mobile (<640px). Triggers on first document ready + session init. 8 i18n keys × 11 locales. Custom CSS in zinc palette. Effort: 4-8h with locale copy.
**Depends on**: UX-01 (layout), FE-18 (UI structure for data-tour targets).
**See**: `.collab/plans/architecture-fixes-plan.md`

---

## Execution Order (Revised per Codex Review)

```
Phase 1 (parallel):
├── Batch A: Backend fixes
│   Order: BE-21 → BE-19 → BE-03 → BE-12 → BE-15 → BE-16 → BE-18 → BE-24
│
└── Batch B: Frontend refactoring
    Order: FE-06 (Win98 removal, FIRST) → FE-05 → FE-07 → FE-13 → FE-18

Phase 2 (after Phase 1):
├── Batch C: Frontend quality (FE-09→FE-10→FE-11→FE-12→FE-14→FE-15→FE-16→FE-17→UX-14)
└── Batch D: UX improvements (UX-10→UX-23→UX-25→UX-27→UX-28→CL-04→CL-09)

Phase 3 (after Phase 2):
└── Batch E: Architecture
    Order: FE-01 → UX-01 → FE-02 → UX-02
```

---

## Items NOT included

### Already fixed in Wave 1-2 (50 items):
UX-03, UX-04, UX-05, UX-06, UX-07, UX-08, UX-09, UX-11, UX-12, UX-13, UX-15, UX-16, UX-17, UX-18, UX-19, UX-20, UX-21, UX-22, UX-26, FE-03, FE-04, FE-08, FE-19, FE-20, FE-21, FE-24, FE-25, BE-01, BE-02, BE-04, BE-05, BE-06, BE-07, BE-08, BE-09, BE-10, BE-11, BE-13, BE-14, BE-17, BE-20, BE-22, BE-23, CL-02, CL-03, CL-05, CL-06, CL-07, CL-08, CL-10

### Removed per Codex review:
- FE-22 (standardize exports) — rejected: low value, high churn
- UX-24 (feedback API) — deferred: needs message ID plumbing in chat schema first

### Deferred (not in scope):
- FE-01 Phase 3 (full SSR) — requires i18n architecture refactor
- Part 4 competitive features (team workspaces, API keys, SSO) — product roadmap items
