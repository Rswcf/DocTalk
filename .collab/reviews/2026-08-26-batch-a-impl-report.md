# Batch A implementation report — 2026-08-26

Scope: growth-fix Batch A items A1, A2, A3, and A4 only. A5, Batches B/C,
and every rejected finding in §0 were deliberately left untouched.

## What changed

### A1 — purchase intent now starts Checkout

- Added `frontend/src/lib/billing.ts` with `startCheckout({ plan, billing,
  source, reason })`. It calls the existing `createSubscription`, then assigns
  the returned Stripe-hosted URL to `window.location.href`.
- Preserved the analytics proof invariant: `upgrade_click` is called
  unconditionally immediately before `createSubscription`, with no conditional
  gate between them.
- Authenticated upgrade actions now call `startCheckout` from:
  - `frontend/src/components/PaywallModal.tsx`
  - `frontend/src/components/Chat/ChatPanel.tsx` (Plus-menu export/custom
    instructions intents)
  - `frontend/src/components/dashboard/DashboardPageClient.tsx` (proactive
    nudge and upload/URL limit CTAs)
  - `frontend/src/components/SessionDropdown.tsx`
  - `frontend/src/components/Profile/CreditsSection.tsx`
  - `frontend/src/app/collections/[collectionId]/page.tsx`
  - `frontend/src/components/ModeSelector.tsx`
- Anonymous/unknown-session states retain their previous `/billing` navigation.
  This is explicit in PaywallModal, ChatPanel, Dashboard, SessionDropdown, and
  ModeSelector. The collection/profile entry points are authenticated surfaces.
- Added the query-intent offer in
  `frontend/src/app/billing/BillingPageClient.tsx`: when both a valid `?plan=`
  and `?source=` are present, a sticky top bar shows the selected plan/price and
  one CTA bound directly to `handleSubscribe(plan)`.
- `DomainModeSelector` is intentionally not a checkout button after A3: a free
  user's first click selects the trial mode, and an exhausted chat request is
  routed by the existing stream error handler to `PaywallModal`. Wiring that
  selector to Checkout as A1 literally requested would make A3 impossible.

### A2 — checkout failures are visible and measurable

- `startCheckout` emits `checkout_failed` with `{ plan, period, source,
  reason }`, rethrows the original error, and all direct-entry UIs render the
  resulting backend detail or the existing localized `billing.error` fallback.
- Added `checkout_failed` to `backend/app/api/events.py::ALLOWED_EVENTS`.
- Moved the existing structured/legacy billing-error extraction into the shared
  `getBillingErrorMessage` helper. `BillingPageClient.handleSubscribe` now uses
  it instead of discarding the backend error.
- Added `frontend/tests/billing.test.cjs` and `npm run test:unit`. The test loads
  the real TypeScript source, proves `upgrade_click` precedes the subscription
  request, proves a rejected request emits `checkout_failed`, and proves the
  original error is rethrown for the UI.

### A3 — one backend-enforced free Domain Mode trial

- Added `FREE_DOMAIN_MODE_TRIALS = 1` in
  `backend/app/core/config.py`.
- Added one shared backend helper,
  `backend/app/services/domain_mode_access.py::enforce_domain_mode_access`, and
  called it from both required API entry points:
  - `backend/app/api/chat.py::chat_stream`
  - `backend/app/api/extractions.py::create_extraction`
- Paid Plus/Pro users bypass the count. Anonymous users remain ineligible.
  Authenticated free users pass only while their durable consumed count is
  below the configured cap.
- The helper first counts distinct `sessions.id` values with non-null
  `domain_mode`, as the plan requested. It also counts queued/running/succeeded
  extraction jobs whose durable `input_scope.domain_mode` is non-null.
- Removed the selector's frontend free-plan lock/redirect. The backend remains
  authoritative; when chat returns `DOMAIN_MODE_REQUIRES_PLUS`, the existing
  `useChatStream` handler opens `PaywallModal`.
- Updated endpoint tests to cover trial available, trial exhausted, anonymous,
  omitted mode, and paid-plan behavior at both sites. Added a regression test
  proving a prior Domain Mode extraction consumes the trial.

### A4 — paid file-size upgrades now increase the limit

- Raised effective backend limits in `backend/app/core/config.py`:
  - Free: 50 MB (unchanged)
  - Plus: 100 MB
  - Pro: 200 MB
- Mirrored those values in the dashboard client precheck and both in-app plan
  comparison tables.
- Updated the pricing cards, comparison values, billing feature copy, dashboard
  nudge, multi-format FAQ, and ChatPDF comparison claim in all 11 locale JSONs
  (`en/zh/ja/ko/es/de/fr/pt/it/ar/hi`). Added the flat dotted key
  `pricing.comparison.upload200` in every locale. Also updated the English
  hardcoded multi-format FAQ source.

## A4 enforcement trace

`MAX_PDF_SIZE_MB` (default 50) is not part of the active upload enforcement
path. Repository search finds no read of that setting outside its declaration
in `backend/app/core/config.py`.

The actual paths are:

1. Direct file upload: `backend/app/api/documents.py::upload_document` selects
   `FREE/PLUS/PRO_MAX_FILE_SIZE_MB`, streams 64 KiB chunks into a byte buffer,
   and aborts when the plan-specific byte cap is exceeded.
2. URL ingestion: the same module selects the same plan-specific cap and checks
   either the returned PDF bytes or the encoded HTML snapshot before storage.
3. Client precheck: `DashboardPageClient.tsx::MAX_UPLOAD_MB_BY_PLAN` mirrors the
   backend values for earlier feedback, but the backend checks remain
   authoritative.

Therefore raising the per-plan settings is effective by itself; there is no
global clamp to raise. I deliberately left the unused `MAX_PDF_SIZE_MB = 50`
unchanged rather than implying it protects a path it currently does not.

## Where the plan was wrong or underspecified

1. A1 listed `DomainModeSelector` as a direct Checkout entry point while A3
   requires that same free-user action to start a trial. A3 must win: the click
   now selects Domain Mode, and only an exhausted backend request opens the
   direct-checkout PaywallModal.
2. Counting only `sessions.domain_mode` does not protect the extraction API:
   extraction jobs do not write a session row. That would have allowed
   sequential Domain Mode extractions forever while the session count stayed
   zero. The shared helper prefers the requested session count and additionally
   counts durable extraction jobs, without a migration.
3. A4's suspected global clamp does not exist in the active code. The global
   setting is dead configuration; the two backend enforcement sites use the
   per-plan values directly.

## Verification

Passed:

- `cd frontend && npm run test:unit` — 1 passed.
- `cd frontend && npx tsc --noEmit` — passed.
- `cd frontend && npm run build` — complete production build passed: compiled,
  lint/type validation passed, and 425/425 static pages generated. The sandbox
  cannot resolve `fonts.googleapis.com`, so the first unmodified run stopped in
  `next/font` before application compilation. The successful rerun used Next's
  official `NEXT_FONT_GOOGLE_MOCKED_RESPONSES` test hook; the temporary response
  file was deleted afterward and no font-source changes were made.
- `cd backend && python3 -m ruff check app/ tests/` — passed.
- `cd backend && python3 -m pytest tests/test_parse_service.py -v` — 14 passed.
- Focused A3 suites:
  - `test_error_taxonomy.py -k domain_mode` — 5 passed.
  - `test_extractions_api.py -k domain_mode` — 5 passed.

Not executable in this sandbox:

- Browser golden path and direct hosted-Stripe navigation. No local services
  were already listening; attempts to start Next on both `0.0.0.0:3000` and
  `127.0.0.1:3001` failed with sandbox-level `listen EPERM`. Testing the live
  production URL would not exercise these working-tree changes.

## Residual risk for adversarial review

- The most important unverified item is an actual authenticated click through
  to Stripe Checkout. Code and unit coverage prove call ordering/failure
  telemetry, but a browser with local auth/backend/Stripe test configuration
  must still confirm the hosted redirect and inline failure UI.
- `trackEvent` is intentionally fire-and-forget. It uses `keepalive`, but a
  browser/network failure can still lose `upgrade_click` or `checkout_failed`;
  analytics must never block Checkout.
- The no-migration session approximation has known escape windows: a user can
  delete a Domain Mode session, a later successful default-mode request can
  clear its current `domain_mode`, and concurrent first-use requests can both
  observe a count below the cap. Extraction jobs close the plan's sequential
  extraction bypass, but strict lifetime/atomic enforcement would require a
  dedicated durable entitlement/usage record (migration) or a reservation
  contract.
- Raising Pro uploads to 200 MB increases per-request memory pressure because
  the current upload endpoint buffers the accepted file in memory after its
  chunked early-abort check. Railway memory headroom and real 100–200 MB parsing
  behavior were not load-tested in this batch.
- `MAX_PDF_SIZE_MB` remains misleading dead configuration. Removing or wiring
  it is outside Batch A and should be handled separately so future operators do
  not assume it is a global safety ceiling.

## Deliberately not done

- No A5 work.
- No Batch B or Batch C work.
- No implementation of either rejected §0 finding.
- No changes to credits/settlement, verified quotes, demo accounting, RetainPDF
  limits, migrations, deployment, or git state.
