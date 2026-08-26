# Batch A adversarial review — Codex R1

Commit under review: `580ad19` (`fix/growth-batch-a`)  
Review date: 2026-08-26  
Verdict: **BLOCK**

Per the request, I did not invoke Git. I reviewed the checked-out implementation against the Batch A
plan, implementation report, both path-scoped rule files, all references/call sites found by repository
search, and the focused tests.

## Findings

1. **[BLOCKER — paid-feature leak] The Domain Mode trial is neither durable nor atomic, and it does not implement a coherent “one free session” contract.**

   Files: `backend/app/services/domain_mode_access.py:39-61`,
   `backend/app/services/chat_service.py:956-991`,
   `backend/app/api/chat.py:395`, `backend/app/api/chat.py:685-697`,
   `backend/app/models/tables.py:562-570`.

   The authorization decision is a count-then-act with no lock or reservation. For chat, the count is
   checked at `chat.py:395`, but the session's `domain_mode` is not durably changed until a later
   successful terminal commit in the streaming service. Concurrent requests on fresh sessions (or even
   concurrent requests on the same fresh session) can all observe zero and all receive the paid prompt
   overlay. The authenticated rate limit and credit balance bound the immediate cost, but they do not
   enforce the one-trial entitlement. A lock around only the two `COUNT`s would not fix this: the lock
   must remain coupled to a durable reservation that the next transaction can see.

   The supposedly durable chat counter is also directly resettable. `_sync_session_domain_mode()`
   deliberately stores the *current* request mode, including `None`; one successful default-mode message
   therefore clears the evidence of a prior trial. `DELETE /sessions/{session_id}` removes it outright.
   Deleting the owning document also cascades both its sessions and extraction jobs, because both foreign
   keys use `ON DELETE CASCADE`. A free user can consequently repeat the trial sequentially without any
   concurrency trick.

   The “one free session” semantics are not what the code delivers for the default cap of 1. After the
   first successful Domain Mode answer, that same session is included in `consumed_sessions`, so its next
   Domain Mode message is rejected. It is one successful request, not one session. For caps greater than
   1, repeated messages in a single session keep counting as one row and remain allowed until enough
   *other* sessions consume the remaining distinct-session slots; a chat-routed extraction can instead
   count twice (once as a session and once as a `DocumentJob`). The two branches at `domain_mode_access.py:47-59`
   are arithmetically correct for the row counts they receive, but those rows are not a sound trial unit.

   Failed/queue-failed extraction jobs are excluded. That is defensible when no extraction result was
   delivered and credits were refunded; queued/running jobs are correctly counted. A request that fails
   before persisting `input_scope` also has not invoked the extraction. The exploitable reset is deletion
   of a succeeded job's document, plus the much simpler chat-mode clear/delete paths above.

   **Concrete fix:** define the entitlement unit first, then store it independently of mutable/deletable
   feature state. For the stated “one free session” policy, add an add-only trial-usage/reservation table
   keyed by user and slot, recording the owning chat session (or extraction attempt) without cascading on
   document/session deletion. Claim a slot atomically under a user-row/advisory lock or unique slot
   constraint before releasing the authorization transaction. Once a chat session owns a slot, allow
   further Domain Mode messages in that same session; do not infer ownership from the session's current
   display mode. Define and test whether a failed attempt releases a reservation. Add real concurrent
   integration tests, clear-mode and delete-session/document reset tests, same-session multi-message tests,
   cross chat/extraction tests, and `FREE_DOMAIN_MODE_TRIALS > 1` tests.

2. **[BLOCKER — revenue path] Newly direct Pro-upgrade/top-up CTAs call an endpoint that rejects every existing subscriber.**

   Files: `frontend/src/lib/billing.ts:19-30`,
   `backend/app/api/billing.py:268-285`,
   `frontend/src/components/Chat/PlusMenu.tsx:71-83`,
   `frontend/src/components/Chat/ChatPanel.tsx:340-351`,
   `frontend/src/components/dashboard/DashboardPageClient.tsx:138-140` and `:486-490`,
   `frontend/src/app/collections/[collectionId]/page.tsx:65-74`,
   `frontend/src/components/PaywallModal.tsx:77-89`,
   `frontend/src/app/billing/BillingPageClient.tsx:244-263` and `:446-469`.

   `startCheckout()` always calls `createSubscription()` (`POST /api/billing/subscribe`). The backend
   explicitly rejects any non-pending `stripe_subscription_id` with “already have an active subscription;
   use /change-plan”. Several new callers intentionally choose Pro when the current user is Plus:

   - the custom-instructions item in `PlusMenu`;
   - a Plus user hitting the 100 MB upload limit in the dashboard;
   - a Plus user hitting the per-collection document limit;
   - generic/insufficient-credit paywalls whose `deriveUpgradePlan()` returns Pro for Plus/Pro users.

   All of those clicks now record `upgrade_click`, then fail instead of earning the Pro upgrade. A Pro user
   who opens the generic insufficient-credits paywall is also sent to a new Pro subscription rather than
   the credit-pack UI, so that top-up path fails too. The sticky query-intent bar compounds the issue by
   calling `handleSubscribe(offerPlan)` directly, bypassing the existing paid-user `handlePlanAction()` /
   `changePlan()` flow immediately below it.

   **Concrete fix:** make the direct action plan-aware. Free users may call `startCheckout`/`subscribe`.
   Existing Plus users targeting Pro must enter the existing confirmed `changePlan` path (or navigate to a
   billing offer whose CTA calls `handlePlanAction`, not `handleSubscribe`). Existing Pro users with low
   credits must land on credit packs/manage billing, not attempt another Pro subscription. Pass the
   authoritative current plan into the shared decision or keep paid-user actions on `/billing`. Add tests
   for Free→Plus, Free→Pro, Plus→Pro, and Pro insufficient-credits behavior; the current single unit test
   covers only a rejected Free-style subscription request.

3. **[HIGH — double-charge/recovery risk] `pending` is not an attempt-specific, idempotent Checkout record.**

   Files: `backend/app/api/billing.py:138-142`, `:164-200`, `:291-365`, `:973-994`,
   `backend/app/models/tables.py:280-285`, `frontend/src/lib/billing.ts:27-33`.

   Ordinary UI double-clicks are handled: most callers disable locally, and the backend user-row lock plus
   committed `pending` sentinel serializes concurrent `/subscribe` requests. The partial-failure window is
   not fully covered, however:

   - If Stripe creates the Checkout Session but the server receives an ambiguous network error, the catch
     clears `pending`; there is no Stripe idempotency key, so an immediate retry can create a second Session.
   - If the backend response is lost after it returns a URL, the UI emits `checkout_failed` while the
     sentinel remains. Recovery uses generic `users.updated_at` as the pending age. That column has a model
     `onupdate`, so unrelated user writes (including credit-balance work) can move the timestamp and extend
     the purported ten-minute bound.
   - Once the timestamp is considered stale, recovery checks only for an *active subscription* and clears
     the sentinel. It does not retrieve or expire the still-open Checkout Session. Stripe documents that a
     Checkout Session defaults to a 24-hour expiry, so the old Session can remain completable long after the
     application's ten-minute TTL and alongside a newly created Session. The duplicate webhook path cancels
     the later subscription only after completion and contains no refund for an already-paid first invoice.

   This is distinct from the rejected “abandoned Checkout permanently locks the user out” claim: the state
   can recover, but it is neither bounded by an attempt-specific clock nor safe against duplicate live
   Checkout Sessions. Stripe explicitly recommends idempotency keys for safely retrying POSTs after
   connection errors: <https://docs.stripe.com/api/idempotent_requests>. Session expiry behavior:
   <https://docs.stripe.com/api/checkout/sessions/create#checkout_session_create-expires_at>.

   **Concrete fix:** persist a checkout-attempt record (attempt UUID/idempotency key, user, plan/period,
   `started_at`, Stripe Session ID/status/URL). Use the same idempotency key for ambiguous retries. Recovery
   should retrieve the attempt's Checkout Session: return its URL while open, adopt it when complete, or
   expire/clear it before creating a replacement. Use `started_at`, never `User.updated_at`. Add ambiguous
   Stripe-create, lost-client-response, open-session-after-TTL, and two-tab completion tests.

4. **[MEDIUM — A4 incomplete] URL ingestion is clamped at 10 MB before the new per-plan limit is reached.**

   Files: `backend/app/services/extractors/url_extractor.py:17`, `:63-84`, `:336-352`,
   `backend/app/api/documents.py:369-419`.

   The implementation report's direct-upload trace is correct: `MAX_PDF_SIZE_MB` has no active reader,
   browser file uploads bypass Vercel's 4.5 MB proxy limit, and `upload_document` enforces the 50/100/200 MB
   plan settings directly. URL ingestion is different. `fetch_and_extract_url()` downloads the response
   through `_read_response_bytes_limited()` with a hard-coded 10 MB default; only after that succeeds does
   `documents.py` apply the per-plan 50/100/200 MB check. Therefore paid URL-imported PDFs never receive the
   advertised per-plan headroom, and the downstream plan check is unreachable above 10 MB.

   **Concrete fix:** pass a caller-selected byte cap into the safe URL fetcher, derived from the user's plan,
   while retaining a separately documented defensive cap for HTML if needed. Alternatively, explicitly
   document URL import as a separate 10 MB feature and remove the dead per-plan URL check. Add 10–100 MB and
   100–200 MB URL-PDF tests for Plus/Pro.

5. **[LOW — contradictory public/living copy] Some active and authoritative surfaces still say 50 MB globally or 50 MB for Plus.**

   Files: `frontend/src/i18n/locales/en.json:397` (the same `landing.faq.a2` key in all 10 other locales),
   `frontend/src/components/landing/FAQ.tsx:7-13`, `frontend/src/app/page.tsx:81-86`,
   `docs/ARCHITECTURE.md:967`, `docs/ARCHITECTURE.zh.md:859`,
   `.claude/rules/frontend.md:42`.

   The live homepage FAQ and its JSON-LD still claim “Files up to 50MB ... are supported” without saying
   that this is the Free cap. The living architecture tables still state Plus=50 MB and Pro=100 MB. The
   frontend rule file still defines Domain Mode as strictly Plus+ with two unconditional 403 gates, which
   now contradicts A3 and will misdirect the next change/review.

   **Concrete fix:** update the homepage FAQ in all 11 locales and the English JSON-LD to state Free 50 MB /
   Plus 100 MB / Pro 200 MB; update both architecture tables; and amend the frontend Domain Mode contract to
   describe the backend-enforced trial and its durable accounting semantics. Historical research snapshots
   can remain historical if labeled as such.

## Requested checks with no finding

- `upgrade_click` remains immediately and unconditionally before `createSubscription` in
  `frontend/src/lib/billing.ts:27-30`; `trackEvent()` catches its own failures, so analytics does not gate
  Checkout. The failure event is allowed server-side, and the original error is rethrown.
- No new caller found invokes `startCheckout` for a known anonymous user. Paywall, chat, dashboard,
  session-dropdown, and mode-selector paths retain auth checks; collection/profile are authenticated
  surfaces; `/billing` redirects unauthenticated users to auth.
- Both explicit Domain Mode gates run before credit debit or job creation. Chat has only access/status reads
  first; extraction has only document access/status reads first. The chat-native extraction tool is not an
  ungated third API: it is reached through the already-gated chat endpoint. `/chat/continue` neither accepts
  nor injects Domain Mode.
- `MAX_PDF_SIZE_MB` is unused outside its declaration/example. Direct upload enforcement, the dashboard
  precheck, billing comparison table, public pricing cards/table, multi-format FAQ, ChatPDF comparison, and
  dashboard nudge use 50/100/200 as intended.
- `pricing.comparison.upload200` exists in en/zh/ja/ko/es/de/fr/pt/it/ar/hi as a top-level dotted string key;
  all 11 locale JSON files parse. I found no newly nested i18n key. The pre-existing finance q6 exception was
  ignored as requested.
- I found no Batch A change to credit predebit/reconciliation/refund settlement or to demo counter/session
  accounting. The new gates precede those paths and do not alter their invariants.

## Verification performed

- `cd frontend && npm run test:unit` — 1/1 passed.
- `cd frontend && npx tsc --noEmit` — passed.
- Parsed all 11 locale JSON files and asserted `pricing.comparison.upload200` is a flat string key in each.
- Repository-wide reference traces for Domain Mode, Checkout, plan-size settings, URL size caps, and 50/100/200 MB copy.

I did not rerun the already-green full backend/integration/build suites; the active shell lacks the backend
Python dependencies, and the findings above are control-flow/state-model defects not contradicted by the
current mocked endpoint tests. The supplied `pytest -q`, integration, Ruff, and Next build results remain
useful regression evidence, but none exercises the reset/concurrency, paid-upgrade, or ambiguous-Checkout
cases identified here.
