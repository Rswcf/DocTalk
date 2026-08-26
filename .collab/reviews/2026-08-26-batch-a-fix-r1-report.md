# Batch A findings 2/3/5 fix report — Codex R1

Date: 2026-08-26  
Branch supplied by owner: `fix/growth-batch-a`  
Scope: findings 2, 3, and 5 from `.collab/dialogue/2026-08-26-batch-a-codex-r1.md`

## Result

Findings 2, 3, and 5 are fixed in the working tree.

I did **not** modify either held implementation:

- `backend/app/services/domain_mode_access.py` (finding 1)
- `backend/app/services/extractors/url_extractor.py` (finding 4)

Nothing in the 2/3/5 fixes required touching those files. The frontend rule now states honestly that
the Free Domain Mode entitlement unit is pending the finding-1 owner decision; it does not invent a
session/request/message durability contract.

## Finding 2 — plan-aware direct billing actions

- Added one shared decision in `frontend/src/lib/billing.ts`.
  - Known Free users still call `startCheckout()` and preserve the existing `upgrade_click` →
    `createSubscription()` ordering.
  - Plus/Pro users, and authenticated users whose profile is not authoritative yet, go to `/billing`
    instead of attempting a second subscription.
  - Pro insufficient-credit actions target `/billing#credit-packs`.
- Migrated every direct subscription CTA outside the billing page to the shared plan-aware action,
  including PaywallModal, PlusMenu/ChatPanel, dashboard limits, collection limits, ModeSelector,
  SessionDropdown, and profile credits.
- The `/billing` sticky query-intent CTA now calls `handlePlanAction()`.
  - Plus → Pro enters the existing confirmation and `changePlan()` flow.
  - Pro + credit exhaustion scrolls to the credit-pack section.
  - The CTA stays disabled until the profile plan is loaded.
- `useUserPlanProfile()` no longer guesses that an authenticated-but-loading profile is Free; this
  prevents a transient second-subscription action.
- Added frontend unit coverage for Free→Plus, Free→Pro, Plus→Pro, and Pro insufficient credits.

The React/Next performance guidance influenced the implementation by keeping the decision in a small
shared module and continuing to reuse the existing deduplicated profile hooks rather than adding
per-click profile requests.

## Finding 3 — durable idempotent Checkout attempts

- Added `CheckoutAttempt` and Alembic revision `20260826_0040` with the required persisted state:
  UUID attempt id, unique idempotency key, user, plan, billing period, source/reason, attempt-owned
  `started_at`, Stripe Session id, Checkout URL, and status.
- The migration's `down_revision` is the actual prior head revision value: `20260808_0039`.
- Added a partial unique index allowing at most one `creating`/`open` subscription attempt per user.
- `/subscribe` commits the attempt before calling Stripe and uses the attempt's stable key on
  `stripe.checkout.Session.create`. Customer creation also uses an attempt-derived idempotency key.
- Ambiguous Stripe-create failures leave the attempt intact. A retry replays the same Stripe POST with
  the same key instead of clearing `pending` and creating a new attempt.
- Recovery is attempt-scoped and uses only `CheckoutAttempt.started_at`:
  - no Session id yet → replay the create call idempotently;
  - open within TTL → retrieve and return the same Checkout URL;
  - complete → adopt the subscription/customer/plan and return the billing success URL;
  - open after TTL → explicitly expire that Session before permitting a replacement;
  - expire/completion race → retrieve again and adopt completion rather than create a replacement.
- Checkout metadata carries `checkout_attempt_id`, allowing completed/expired webhooks to correlate an
  attempt even if the server lost the response before persisting the Stripe Session id.
- Expired webhooks only clear the sentinel owned by that attempt; an older expiry cannot clear a newer
  active attempt, and an expired credit-pack Checkout cannot clear subscription state.
- Added backend tests for ambiguous Stripe-create recovery, lost client response, open Session after
  TTL, and two-tab completion/adoption.

No recovery branch reads `User.updated_at`.

## Finding 5 — truthful caps and Domain Mode rule copy

- Updated the flat `landing.faq.a2` string in all 11 locales to state Free 50 MB / Plus 100 MB /
  Pro 200 MB and the shared 500-page cap.
- Updated the FAQ component fallback and homepage FAQ JSON-LD with the same plan-specific limits.
- Corrected both architecture limit tables to 50/100/200 MB.
- Corrected `.claude/rules/frontend.md` to describe Plus+ access, the current backend-enforced Free
  trial, and the still-pending entitlement-unit decision without claiming finding 1 is durable.
- Parsed all locale JSON and asserted `landing.faq.a2` remains a flat string containing 50/100/200.

## Verification

Passed:

- `cd frontend && npm run build`
- `cd frontend && npm run test:unit` — 5 passed
- `cd backend && ruff check app/ tests/` — passed
- `cd backend && python3.12 -m pytest tests/test_billing_logic.py tests/test_billing_state.py tests/test_billing_cancel.py -q` — 38 passed
- `cd backend && python3.12 -m alembic heads` — `20260826_0040 (head)`
- `cd backend && python3.12 -m alembic upgrade 20260808_0039:head --sql` — generated valid PostgreSQL DDL; no database mutation

Could not complete the broad backend commands in this environment:

- The shell's `python3` is Python 3.14 and has neither pytest nor Ruff. Python 3.12 has pytest/Ruff and
  the billing dependencies, but the full suite stops during collection because `rapidfuzz` and
  `psycopg` are not installed (25 collection errors). An isolated temporary-environment install was
  attempted, but outbound package access is blocked.
- Docker access is denied at the daemon socket, so database integration tests cannot provision their
  scratch PostgreSQL database here.
- I intentionally did **not** run the exact integration command because `tests/test_migrations.py`
  executes `alembic downgrade base`; the task explicitly says not to run any Alembic downgrade. No
  downgrade command was run against any database.

The focused tests covering all changed billing behavior are green, but the full `pytest -q` and safe
integration run should be repeated in the owner's normal dependency-complete environment (excluding
the downgrade test if the no-downgrade instruction remains in force).
