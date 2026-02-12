# Wave 3 Consolidated Plan Review (Codex)

Date: 2026-02-12

## Scope Reviewed
- Plans: `.collab/plans/wave3-consolidated-plan.md`, `.collab/plans/architecture-fixes-plan.md`
- Backend files verified: `backend/app/api/billing.py`, `backend/app/api/chat.py`, `backend/app/api/users.py`, `backend/app/core/rate_limit.py`, `backend/app/main.py`, plus related API files
- Frontend files verified: `frontend/src/app/d/[documentId]/page.tsx`, `frontend/src/components/Chat/ChatPanel.tsx`, `frontend/src/lib/authAdapter.ts`, `frontend/src/components/PdfViewer/PdfViewer.tsx`, `frontend/src/components/Header.tsx`, plus related files

## Global Findings
- Plan count mismatch: document says 37 items, but Batches A-E list 36 items.
- Some plan assumptions are stale versus current code (notably BE-03, BE-12, FE-14, UX-27).
- Two items need redesign before execution: FE-22 and UX-24.

## Batch A: Backend Fixes

### BE-03: Standardize error responses — APPROVE WITH CHANGES
- Correctness/completeness: The issue exists, but not as described. `backend/app/api/chat.py:200`, `backend/app/api/chat.py:204`, `backend/app/api/chat.py:214`, `backend/app/api/chat.py:222`, `backend/app/api/chat.py:234`, `backend/app/api/chat.py:250` all return `JSONResponse` for errors, not just one call site.
- Risks/edge cases/alternatives: Keep `Retry-After` headers when converting to `HTTPException` (supported via `headers=`). Maintain error payload shape expected by SSE client (`frontend/src/lib/sse.ts:34`).
- Effort estimate: Small (0.5-1 day), but larger than currently scoped.
- Dependencies: Coordinate with frontend error parsing in `frontend/src/lib/sse.ts`.

### BE-12: Reduce profile endpoint query count — APPROVE WITH CHANGES
- Correctness/completeness: `get_profile` is already partially consolidated. Current behavior is ~3 queries: accounts, aggregated stats, tokens (`backend/app/api/users.py:60`, `backend/app/api/users.py:64`, `backend/app/api/users.py:103`). The “6→3” claim is outdated.
- Risks/edge cases/alternatives: Combine `total_tokens_used` into the same aggregate statement, but keep readability. Avoid correlated-subquery over-complexity that hurts planner performance.
- Effort estimate: Small (2-4 hours).
- Dependencies: None.

### BE-15: Refactor stripe_webhook — APPROVE
- Correctness/completeness: Strongly justified; `stripe_webhook` is long and deeply nested (`backend/app/api/billing.py:145`-`backend/app/api/billing.py:377`).
- Risks/edge cases/alternatives: Preserve current idempotency checks (`CreditLedger` checks) and commit/rollback semantics per handler. Keep failure mode that returns 5xx for retry-worthy DB errors.
- Effort estimate: Medium (0.5-1 day).
- Dependencies: Pairs well with BE-24 cache invalidation hooks (if BE-24 proceeds).

### BE-16: Redis-backed rate limiter — APPROVE WITH CHANGES
- Correctness/completeness: Good direction. Current limiter is process-local memory (`backend/app/core/rate_limit.py:11`-`backend/app/core/rate_limit.py:40`).
- Risks/edge cases/alternatives: Also address `DemoMessageTracker` (`backend/app/core/rate_limit.py:42`) or demo limits remain non-distributed. Use atomic Lua or `INCR` + `EXPIRE` with first-write expiration.
- Effort estimate: Medium (0.5-1 day including fallback and tests).
- Dependencies: Should be implemented before BE-24 (shared Redis infrastructure patterns).

### BE-18: Standardize pagination across endpoints — APPROVE WITH CHANGES
- Correctness/completeness: Goal is valid, but several endpoints already cap results with hardcoded limits (`backend/app/api/chat.py:312`, `backend/app/api/collections.py:304`, `backend/app/api/documents.py:77`, `backend/app/api/admin.py:219`, `backend/app/api/admin.py:274`).
- Risks/edge cases/alternatives: Add `offset` consistently, keep existing defaults for backward compatibility, and document sort order guarantees.
- Effort estimate: Small-Medium (0.5 day).
- Dependencies: Frontend list APIs should optionally pass `offset` where needed.

### BE-19: Add response_model to endpoints — APPROVE WITH CHANGES
- Correctness/completeness: Valid and high-value. Roughly 52 endpoints exist; only a subset currently uses `response_model`.
- Risks/edge cases/alternatives: Avoid big-bang rollout. Start with externally consumed endpoints (`documents`, `chat`, `billing`, `users`, `admin`) and leave internal auth endpoints stable.
- Effort estimate: Medium-Large (1-2 days if done safely with schema/tests).
- Dependencies: Best done after BE-21 route cleanup to reduce churn.

### BE-21: Standardize route prefixes — APPROVE WITH CHANGES
- Correctness/completeness: Correct problem statement; mixed prefix patterns exist in `backend/app/main.py:129`-`backend/app/main.py:138`.
- Risks/edge cases/alternatives: The proposed file list is incomplete. To fully standardize to Pattern 2, also update `documents`, `search`, `chat`, `chunks` router definitions.
- Effort estimate: Medium (0.5-1 day with regression testing).
- Dependencies: Should precede BE-19 (schema docs and endpoint inventory stabilize after path consistency).

### BE-24: Application-level Redis caching — APPROVE WITH CHANGES
- Correctness/completeness: Direction is reasonable, but target set is partly low-value. `billing/products` is static config output (`backend/app/api/billing.py:62`-`backend/app/api/billing.py:70`).
- Risks/edge cases/alternatives: Cache only high-cost/DB-heavy paths first (profile, demo docs, maybe admin aggregates). Credit balance caching is risky unless invalidated in every write path (chat pre-debit/reconcile, purchases, allowances).
- Effort estimate: Medium-Large (1-2 days with safe invalidation).
- Dependencies: Depends on BE-16 conventions and should hook into `credit_service` write operations.

## Batch B: Frontend Core Refactoring

### FE-05: Extract hooks from document page — APPROVE
- Correctness/completeness: Highly justified; `frontend/src/app/d/[documentId]/page.tsx` is multi-concern and large.
- Risks/edge cases/alternatives: Preserve existing polling/session ordering semantics.
- Effort estimate: Medium (1 day).
- Dependencies: Prefer before UX-01 and UX-02.

### FE-06: Remove Win98 theme entirely — APPROVE WITH CHANGES
- Correctness/completeness: Scope is underestimated. Theme touches more than 12 files: 99 `isWin98` usages plus `ThemeProvider`, `ThemeSelector`, `globals.css`, and `components/win98/*`.
- Risks/edge cases/alternatives: Add migration for persisted `win98` value in local storage/theme state.
- Effort estimate: Large (2-3 days with QA), not small.
- Dependencies: Must happen before/with FE-18, UX-01, UX-02 to avoid duplicate work.

### FE-07: Type authAdapter — APPROVE WITH CHANGES
- Correctness/completeness: Needed; heavy unsafe usage in `frontend/src/lib/authAdapter.ts` (many `as any` and `fetchAdapter<any>`).
- Risks/edge cases/alternatives: Type backend payloads using actual auth schema shapes (`email_verified`, UUID strings, timestamp parsing).
- Effort estimate: Small-Medium (0.5 day).
- Dependencies: None.

### FE-13: Fix remaining `any` types — APPROVE WITH CHANGES
- Correctness/completeness: Good target, but do it in priority files first (chat/PDF/store/SSE).
- Risks/edge cases/alternatives: Avoid forcing types where external library types are unstable; use narrow interfaces instead.
- Effort estimate: Medium (1 day).
- Dependencies: Benefits FE-18 and FE-02.

### FE-18: Split ChatPanel — APPROVE WITH CHANGES
- Correctness/completeness: Strongly justified; `frontend/src/components/Chat/ChatPanel.tsx` is very large and multi-responsibility.
- Risks/edge cases/alternatives: `MessageErrorBoundary` already exists in-file (`frontend/src/components/Chat/ChatPanel.tsx:31`), and citation renumbering exists in-file (`frontend/src/components/Chat/ChatPanel.tsx:58`). Refactor plan should acknowledge current state.
- Effort estimate: Medium (1-1.5 days).
- Dependencies: Should land before UX-02 (tour target hooks in chat UI).

### FE-22: Standardize all component exports to default — REJECT
- Correctness/completeness: Low value, high churn. Current mixed export style includes legitimate named exports (`Providers`, `CookieConsentBanner`, `PrivacyBadge`, utility exports).
- Risks/edge cases/alternatives: Mass export changes create noisy diffs and import break risk with minimal product impact.
- Effort estimate: Not worth planned effort.
- Dependencies: None; remove from wave.

### FE-23: Extract suggested question keys constants — APPROVE
- Correctness/completeness: Valid cleanup; keys currently inline (`frontend/src/components/Chat/ChatPanel.tsx:86`).
- Risks/edge cases/alternatives: Keep locale fallback logic intact.
- Effort estimate: Small (1-2 hours).
- Dependencies: Easy to combine with FE-18.

## Batch C: Frontend Quality & Features

### FE-09: Replace `<img>` with `next/image` — APPROVE WITH CHANGES
- Correctness/completeness: Valid issue at `frontend/src/components/UserMenu.tsx:100`.
- Risks/edge cases/alternatives: Must configure external image hosts in Next config (currently CSP allows domains, but `next/image` remotePatterns config is separate).
- Effort estimate: Small (2-4 hours).
- Dependencies: `frontend/next.config.mjs` update required.

### FE-10: Fix silent error swallowing — APPROVE WITH CHANGES
- Correctness/completeness: Valid; multiple empty catches remain (collections pages, account actions, store).
- Risks/edge cases/alternatives: Add user-visible errors where operations are destructive or blocking.
- Effort estimate: Small-Medium (0.5 day).
- Dependencies: None.

### FE-11: Dynamic import `react-markdown` — APPROVE WITH CHANGES
- Correctness/completeness: Static imports currently in `frontend/src/components/Chat/MessageBubble.tsx:4` and `frontend/src/components/TextViewer/TextViewer.tsx:4`.
- Risks/edge cases/alternatives: Ensure no UX regression for first-render message content; dynamic import can shift latency. Prefer measured bundle impact before rollout.
- Effort estimate: Small-Medium (0.5 day with verification).
- Dependencies: Coordinate with FE-18 (MessageBubble touch).

### FE-12: Create `useUserProfile` hook — APPROVE
- Correctness/completeness: Good consolidation; profile is fetched at 4 call sites.
- Risks/edge cases/alternatives: Prefer SWR/react-query semantics if already acceptable in stack; otherwise minimal custom cache is fine.
- Effort estimate: Small-Medium (0.5 day).
- Dependencies: Helpful for FE-05 refactor.

### FE-14: Route-level error boundaries — APPROVE WITH CHANGES
- Correctness/completeness: Partially already done (`frontend/src/app/d/[documentId]/error.tsx`, `frontend/src/app/collections/[collectionId]/error.tsx`, plus `global-error.tsx`).
- Risks/edge cases/alternatives: Adjust scope to missing routes only.
- Effort estimate: Small (2-4 hours incremental).
- Dependencies: None.

### FE-15: Add `cn()` utility — APPROVE
- Correctness/completeness: Straightforward; `frontend/src/lib/utils.ts` currently lacks it.
- Risks/edge cases/alternatives: Keep non-disruptive rollout (no forced refactor).
- Effort estimate: Small.
- Dependencies: Add `clsx` and `tailwind-merge` deps.

### FE-16: Network status detection — APPROVE WITH CHANGES
- Correctness/completeness: Reasonable enhancement.
- Risks/edge cases/alternatives: Guard SSR/hydration (`navigator` undefined server-side). Avoid persistent dismiss state causing hidden offline alerts forever.
- Effort estimate: Small-Medium.
- Dependencies: Add banner in shared layout carefully.

### FE-17: i18n remaining hardcoded strings — APPROVE WITH CHANGES
- Correctness/completeness: Ongoing cleanup; terms/privacy already use translation keys in main content.
- Risks/edge cases/alternatives: Use targeted audit to avoid broad churn in one wave.
- Effort estimate: Medium due 11 locales.
- Dependencies: Coordinate with UX-01/UX-02 new keys.

### UX-14: Processing skeleton screen — APPROVE
- Correctness/completeness: Valid; current processing state is spinner/text (`frontend/src/app/d/[documentId]/page.tsx:300`-`frontend/src/app/d/[documentId]/page.tsx:307`).
- Risks/edge cases/alternatives: Keep ARIA live semantics.
- Effort estimate: Small.
- Dependencies: Can bundle with FE-05.

### UX-24: Feedback API integration — REJECT
- Correctness/completeness: Incomplete design. Frontend currently stores feedback only in localStorage (`frontend/src/components/Chat/MessageBubble.tsx:171`-`frontend/src/components/Chat/MessageBubble.tsx:216`), and message IDs in UI are mostly synthetic; session message payload does not include backend message IDs (`backend/app/schemas/chat.py:16`-`backend/app/schemas/chat.py:35`, `frontend/src/lib/api.ts:75`-`frontend/src/lib/api.ts:99`).
- Risks/edge cases/alternatives: Must first define stable message ID flow in API/store, then add feedback table and endpoint.
- Effort estimate: Larger than proposed once dependency is included.
- Dependencies: Requires chat schema/store changes before feedback endpoint wiring.

## Batch D: UX Improvements

### UX-10: Merge theme/language selectors on mobile — APPROVE WITH CHANGES
- Correctness/completeness: Valid; selectors are always in header (`frontend/src/components/Header.tsx:75`-`frontend/src/components/Header.tsx:80`).
- Risks/edge cases/alternatives: Requires `UserMenu` extension (currently profile/billing/signout only).
- Effort estimate: Small-Medium.
- Dependencies: Coordinate with FE-06 (if Win98 removal proceeds).

### UX-23: Standardize card hover effects — APPROVE WITH CHANGES
- Correctness/completeness: Reasonable; hover styles are inconsistent across cards.
- Risks/edge cases/alternatives: Use a reusable card utility/class to avoid repetitive edits.
- Effort estimate: Small-Medium.
- Dependencies: None.

### UX-25: Responsive document name truncation — APPROVE WITH CHANGES
- Correctness/completeness: Partially addressed already, but not fully standardized (`frontend/src/components/Header.tsx:57`, `frontend/src/components/SessionDropdown.tsx:156`).
- Risks/edge cases/alternatives: Ensure long names truncate in both header and dashboard rows.
- Effort estimate: Small.
- Dependencies: None.

### UX-27: Collections empty state CTA — APPROVE WITH CHANGES
- Correctness/completeness: Empty state is already styled (`frontend/src/app/collections/page.tsx:71`-`frontend/src/app/collections/page.tsx:83`) but lacks CTA in empty panel.
- Risks/edge cases/alternatives: Reuse existing create-action button behavior.
- Effort estimate: Very small.
- Dependencies: None.

### UX-28: Account deletion modal animation — APPROVE
- Correctness/completeness: Valid; modal lacks entry animation (`frontend/src/components/Profile/AccountActionsSection.tsx:93`-`frontend/src/components/Profile/AccountActionsSection.tsx:100`).
- Risks/edge cases/alternatives: Respect reduced-motion preferences.
- Effort estimate: Small.
- Dependencies: None.

### CL-04: Dark mode background adjustment — APPROVE WITH CHANGES
- Correctness/completeness: Valid consistency issue, but infrastructure partly exists (`--page-background` already in `frontend/src/app/globals.css:7`, `frontend/src/app/globals.css:23`).
- Risks/edge cases/alternatives: Prefer token-driven cleanup instead of mass hardcoded class replacement.
- Effort estimate: Medium.
- Dependencies: Should not conflict with ongoing UI refactors.

### CL-09: Hero section accent glow — APPROVE WITH CHANGES
- Correctness/completeness: Acceptable enhancement. Keep accent based on existing tokenized accent system, not fixed hardcoded color.
- Risks/edge cases/alternatives: Avoid visual conflict with existing dot pattern and showcase glow.
- Effort estimate: Small.
- Dependencies: None.

## Batch E: Architecture (with architecture plan review)

### UX-01: Mobile responsive document reader — APPROVE WITH CHANGES
- Correctness/completeness: Correct problem statement; current mobile still uses side-by-side panels (`frontend/src/app/d/[documentId]/page.tsx:466`-`frontend/src/app/d/[documentId]/page.tsx:487`).
- Risks/edge cases/alternatives: Keep panel state on tab switch without remount. Add safe-area handling for bottom tab bar. Plan should not spend effort on Win98 mobile if FE-06 removes Win98.
- Effort estimate: 2h is optimistic; realistic 4-8h including i18n keys and QA.
- Dependencies: FE-05 first; coordinate with FE-02 for mobile performance.

### FE-01: Landing page SSR quick wins — APPROVE WITH CHANGES
- Correctness/completeness: Quick-win proposal is valid: current loading branch renders spinner (`frontend/src/app/page.tsx:240`-`frontend/src/app/page.tsx:245`). Metadata is minimal (`frontend/src/app/layout.tsx:21`-`frontend/src/app/layout.tsx:24`).
- Risks/edge cases/alternatives: This is not true SSR conversion; it is loading-state SEO mitigation. Keep terminology precise.
- Effort estimate: Phase 1+2 estimate is reasonable.
- Dependencies: None.

### FE-02: PDF page virtualization — APPROVE WITH CHANGES
- Correctness/completeness: Needed; current viewer renders all pages (`frontend/src/components/PdfViewer/PdfViewer.tsx:337`-`frontend/src/components/PdfViewer/PdfViewer.tsx:350`).
- Risks/edge cases/alternatives: Architecture doc’s placeholder height calculation should use real page viewport dimensions, not container-width heuristics, to prevent scroll jumps. Must handle zoom/resize recalculation and citation scroll-to-page reliability.
- Effort estimate: 3-4h is optimistic; likely 1-2 days with robust testing.
- Dependencies: Should land before/with UX-01 if both panels stay mounted on mobile.

### UX-02: Onboarding tour with driver.js — APPROVE WITH CHANGES
- Correctness/completeness: Reasonable approach, but current targets do not exist yet (`data-tour` attributes absent).
- Risks/edge cases/alternatives: Skip on mobile/tabbed layout by default, ensure elements exist before starting, and avoid blocking first interaction.
- Effort estimate: 2h is optimistic with 11-locale copy updates; likely 4-8h.
- Dependencies: Depends on UX-01 layout and FE-18 UI structure.

## Dependency Corrections (Execution Order)
1. Clarify FE-06 decision first (keep/remove Win98). Many items depend on it.
2. In backend, do BE-21 before BE-19; do BE-16 before BE-24.
3. In frontend, do FE-05 and FE-18 before UX-01 and UX-02.
4. For feedback (UX-24), add message ID plumbing first, then backend table/API, then UI wiring.

## Overall Verdict
**NEEDS REVISION**

Blocking revisions required before execution:
- Remove or redesign FE-22.
- Redesign UX-24 with message ID/data model dependency included.
- Update stale scope assumptions for BE-03, BE-12, FE-14, UX-27.
- Fix dependency sequencing to avoid rework.
