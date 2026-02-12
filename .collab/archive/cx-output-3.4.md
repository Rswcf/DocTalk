Implemented Batch A (8 backend fixes) in the required order with focused backend-only edits.

1. BE-21: Router prefix standardization (Pattern 2)
- Moved full `/api/...` prefixes into router definitions:
  - `backend/app/api/documents.py` → `APIRouter(prefix="/api/documents")`
  - `backend/app/api/search.py` → `APIRouter(prefix="/api/documents")`
  - `backend/app/api/chat.py` → `APIRouter(prefix="/api")`
  - `backend/app/api/chunks.py` → `APIRouter(prefix="/api")`
- Removed `prefix="/api"` usage in `include_router(...)` calls:
  - `backend/app/main.py`

2. BE-19: Added response models for external endpoints
- Added/expanded schema modules:
  - `backend/app/schemas/common.py` (health/status/received/deleted responses)
  - `backend/app/schemas/billing.py`
  - `backend/app/schemas/users.py`
  - `backend/app/schemas/admin.py`
  - `backend/app/schemas/document.py` (demo/docs ingest/text-content responses)
  - `backend/app/schemas/chat.py` (`SessionCreateResponse`)
- Added `response_model=` to externally consumed routes in:
  - `backend/app/api/documents.py`
  - `backend/app/api/chat.py`
  - `backend/app/api/billing.py`
  - `backend/app/api/users.py`
  - `backend/app/api/admin.py`
  - `backend/app/main.py` (`/health`)
- Internal auth endpoints were left unchanged.

3. BE-03: Chat error responses JSONResponse -> HTTPException
- Converted all error `JSONResponse(...)` return paths in `chat_stream()` to `raise HTTPException(...)` in:
  - `backend/app/api/chat.py`
- Preserved 429 retry signaling via `headers={"Retry-After": "60"}`.
- Kept non-error success JSONResponse path for demo session creation unchanged.

4. BE-12: get_profile query consolidation (3 -> 2)
- Folded `total_tokens_used` into the existing aggregate stats query in `get_profile()`:
  - `backend/app/api/users.py`
- Removed the separate tokens aggregation query.

5. BE-15: Stripe webhook handler refactor
- Split webhook logic into per-event handler functions:
  - `_handle_checkout_session_completed(...)` with mode split:
    - `_handle_checkout_session_subscription_completed(...)`
    - `_handle_checkout_session_payment_completed(...)`
  - `_handle_invoice_payment_succeeded(...)`
  - `_handle_subscription_deleted(...)`
- Main `stripe_webhook()` is now a dispatcher.
- Preserved idempotency checks (`CreditLedger` ref lookups), commit/rollback behavior, and retry-worthy DB `HTTP 500` handling:
  - `backend/app/api/billing.py`

6. BE-16: Redis-backed limiter/tracker with fallback
- Replaced in-memory-only runtime objects with Redis-first implementations:
  - `RedisRateLimiter` (INCR + first-write EXPIRE)
  - `RedisDemoTracker` (INCR + first-write EXPIRE)
  - graceful fallback to in-memory when Redis is unavailable
  - `backend/app/core/rate_limit.py`
- Updated chat usage sites to async `await ...is_allowed/get_count/increment`:
  - `backend/app/api/chat.py`

7. BE-18: Pagination params on unbounded/hardcoded list endpoints
- Added `limit/offset` params and applied them in SQL for:
  - `list_documents` (`backend/app/api/documents.py`, defaults preserve prior 50)
  - `list_collections` (`backend/app/api/collections.py`, optional limit + offset)
  - `list_sessions` (`backend/app/api/chat.py`, defaults preserve prior 10)
  - `admin_recent_users` (`backend/app/api/admin.py`, added offset)
  - `admin_top_users` (`backend/app/api/admin.py`, added offset)

8. BE-24: Thin cache layer + targeted endpoint caching
- Added cache helpers:
  - `cache_get`, `cache_set`, `cache_delete`, `cache_delete_pattern`
  - Redis-backed with graceful no-cache fallback
  - `backend/app/core/cache.py`
- Added caching to requested paths:
  - Demo documents list (TTL 5 min): `backend/app/api/documents.py`
  - User profile computed payload (TTL 30s): `backend/app/api/users.py`
    - Kept `credits_balance` live (not cached)
  - Admin overview (TTL 1 min): `backend/app/api/admin.py`
- Added profile cache invalidation on plan-change webhook paths:
  - `backend/app/api/billing.py`

Validation
- Ran required command after all changes:
  - `cd backend && python3 -m ruff check app/`
- Result: passed with no lint errors.

---

Implemented Batch B (5 frontend core refactors) in required order with frontend-only edits.

1. FE-06: Removed Win98 theme entirely
- Removed Win98 from theme system and selector:
  - `frontend/src/app/ThemeProvider.tsx` (themes now `light|dark`; added migration for stored `theme=win98 -> dark`)
  - `frontend/src/components/ThemeSelector.tsx` (removed Win98 option)
- Removed all Win98 conditional branches and kept modern light/dark paths in:
  - `frontend/src/app/d/[documentId]/page.tsx`
  - `frontend/src/components/Header.tsx`
  - `frontend/src/components/ModeSelector.tsx`
  - `frontend/src/components/LanguageSelector.tsx`
  - `frontend/src/components/CreditsDisplay.tsx`
  - `frontend/src/components/Chat/ChatPanel.tsx`
  - `frontend/src/components/Chat/MessageBubble.tsx`
  - `frontend/src/components/Chat/CitationCard.tsx`
  - `frontend/src/components/PdfViewer/PdfToolbar.tsx`
  - `frontend/src/components/PdfViewer/PdfViewer.tsx`
  - `frontend/src/components/TextViewer/TextViewer.tsx`
- Removed Win98 CSS and utility classes from:
  - `frontend/src/app/globals.css`
- Removed Win98 font entry from:
  - `frontend/tailwind.config.ts`
- Deleted Win98 component directory/files:
  - `frontend/src/components/win98/Win98Icons.tsx`
  - `frontend/src/components/win98/Win98Taskbar.tsx`
  - `frontend/src/components/win98/Win98Window.tsx`
  - `frontend/src/components/win98/index.ts`
  - `frontend/src/components/win98/useWin98Theme.ts`
- Removed `header.win98Mode` locale key from all locale files.

2. FE-05: Extracted hooks from document page
- Added:
  - `frontend/src/lib/useDocumentLoader.ts` (document polling/status/file URL/converted PDF/custom instructions)
  - `frontend/src/lib/useChatSession.ts` (session list/load/create + message initialization)
  - `frontend/src/lib/useUserPlanProfile.ts` (profile fetch + plan gating)
- Refactored page to consume hooks:
  - `frontend/src/app/d/[documentId]/page.tsx`

3. FE-07: Typed auth adapter
- Replaced unsafe casts in:
  - `frontend/src/lib/authAdapter.ts`
- Added typed backend payload interfaces and converters:
  - `BackendUser`, `BackendAccount`, `BackendVerificationToken`, `BackendLinkAccountRequest`
  - `toAdapterUser`, `toAdapterAccount`, `toVerificationToken`
- Removed all `as any`/`fetchAdapter<any>` usage.

4. FE-13: Fixed priority `any` usage
- Replaced `any` in target files using narrow types/guards:
  - `frontend/src/components/PdfViewer/PdfViewer.tsx`
  - `frontend/src/store/index.ts`
  - `frontend/src/lib/sse.ts`
  - `frontend/src/components/Chat/ChatPanel.tsx` (no remaining `any`)

5. FE-18: Split ChatPanel
- Extracted stream logic:
  - `frontend/src/lib/useChatStream.ts`
- Extracted plus menu UI:
  - `frontend/src/components/Chat/PlusMenu.tsx`
- Extracted message error boundary:
  - `frontend/src/components/Chat/MessageErrorBoundary.tsx`
- Moved citations renumbering helper:
  - `frontend/src/lib/citations.ts`
- Moved suggested key constants (absorbing FE-23):
  - `frontend/src/lib/constants.ts`
- Updated ChatPanel to consume extracted parts:
  - `frontend/src/components/Chat/ChatPanel.tsx`

Validation
- `cd frontend && npx next lint`
  - Passed with no lint errors (pre-existing warnings remain in unrelated files).
- `cd frontend && npx tsc --noEmit`
  - Passed.

---

Implemented Batch D (7 UX improvements) with frontend-only, minimal scoped edits.

1. UX-10: Merge theme/language selectors on mobile
- `frontend/src/components/Header.tsx`
  - Hid standalone selectors on `<sm` with `hidden sm:flex` wrappers for `ThemeSelector` and `LanguageSelector`.
- `frontend/src/components/UserMenu.tsx`
  - Added mobile-only (`sm:hidden`) Theme and Language sub-sections inside the dropdown.
  - Theme subsection adds Light/Dark controls using `next-themes`.
  - Language subsection adds locale selection using existing `LOCALES` + `setLocale`.

2. UX-23: Standardized card hover pattern
- Applied `hover:shadow-md hover:-translate-y-0.5 transition-shadow transition-transform duration-200` to target cards:
  - Feature cards: `frontend/src/components/landing/FeatureGrid.tsx`
  - Document cards: `frontend/src/app/page.tsx`
  - Collection cards: `frontend/src/components/Collections/CollectionList.tsx` (card renderer used by collections page)
  - Pricing cards: `frontend/src/app/billing/page.tsx` (plus/pro cards and top-up product cards)

3. UX-25: Responsive document/session name truncation
- `frontend/src/components/Header.tsx`
  - Updated document title truncation to `max-w-[120px] sm:max-w-[200px] md:max-w-[300px] truncate`.
- `frontend/src/components/SessionDropdown.tsx`
  - Updated trigger truncation to `max-w-[120px] sm:max-w-[200px] md:max-w-[300px] truncate`.

4. UX-27: Collections empty state CTA
- `frontend/src/app/collections/page.tsx`
  - Added prominent “Create Collection” CTA button in empty state.
  - Reused existing create flow by calling `setShowCreate(true)`.

5. UX-28: Account deletion modal animation
- `frontend/src/components/Profile/AccountActionsSection.tsx`
  - Added `animate-fade-in motion-reduce:animate-none` to modal overlay.
  - Added `animate-slide-up motion-reduce:animate-none` to modal card.

6. CL-04: Dark mode background consistency
- `frontend/src/app/globals.css`
  - Standardized page background token: `.dark { --page-background: #09090b; }`.
- Updated page-level wrappers to use existing page token (`bg-[var(--page-background)]`) in touched pages:
  - `frontend/src/app/page.tsx`
  - `frontend/src/app/collections/page.tsx`
  - `frontend/src/app/billing/page.tsx`
- Standardized touched card/panel backgrounds to `dark:bg-zinc-900` where inconsistent:
  - `frontend/src/components/landing/FeatureGrid.tsx`
  - `frontend/src/app/page.tsx` (document cards)
  - `frontend/src/components/Collections/CollectionList.tsx`
  - `frontend/src/app/billing/page.tsx`

7. CL-09: Hero section accent glow
- `frontend/src/components/landing/HeroSection.tsx`
  - Added subtle radial glow behind headline using accent token system:
    `bg-[radial-gradient(ellipse_at_center,var(--accent-light),transparent_70%)]`.

Validation (required)
- Ran: `cd frontend && npx next lint`
- Result: passed (warnings only, pre-existing/unrelated):
  - `frontend/src/app/collections/[collectionId]/page.tsx` (`react-hooks/exhaustive-deps`)
  - `frontend/src/components/Profile/ProfileInfoSection.tsx` (`@next/next/no-img-element`)
