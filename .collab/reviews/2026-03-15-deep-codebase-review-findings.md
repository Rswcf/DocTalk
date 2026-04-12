# Deep Codebase Review Findings

Date: 2026-03-15
Reviewer: Codex
Scope: backend + frontend full-pass review with emphasis on auth, billing, chat/credits, document lifecycle, workers, and viewer integration

## Finding 1 — `stripe_subscription_id="pending"` can still dead-lock subscription signup

- File: `backend/app/api/billing.py:123-176`
- Problem:
  - `/api/billing/subscribe` still writes `user.stripe_subscription_id = "pending"` before redirecting to Stripe.
  - The code only clears `"pending"` if checkout session creation itself throws.
  - There is no recovery path for abandoned checkout, expired checkout, or a user closing the tab before Stripe emits a webhook that updates the subscription state.
- Impact:
  - A user can get permanently blocked from retrying `/subscribe` because the next request sees a truthy `stripe_subscription_id` and returns 400.
- Suggested fix:
  - Track pending checkout separately with expiry or use a dedicated column/state machine.
  - Alternatively recover from stale `"pending"` in `/subscribe` by checking Stripe for an active subscription or clearing stale pending state after a short TTL.

## Finding 2 — `invoice.payment_succeeded` grants full monthly allowance on every successful invoice

- File: `backend/app/api/billing.py:471-534`
- Problem:
  - `_handle_invoice_payment_succeeded()` grants `_credits_for_plan(plan)` for any successful invoice tied to the customer, as long as the `invoice_id` is new.
  - It does not inspect invoice purpose such as `billing_reason`.
  - Mid-cycle upgrade/downgrade prorations also produce successful invoices.
  - The code already grants upgrade supplement separately in `/change-plan` and `customer.subscription.updated`.
- Impact:
  - A paid user can receive an extra full monthly credit allowance during plan changes or other non-renewal invoice events.
  - Credits ledger and entitlement behavior drift upward over time.
- Suggested fix:
  - Only grant allowance for the first subscription invoice and renewal invoices, based on Stripe billing reason or a similarly strict predicate.

## Finding 3 — `customer.subscription.deleted` can downgrade the wrong subscription

- File: `backend/app/api/billing.py:537-559`
- Problem:
  - `_handle_subscription_deleted()` looks up the user by `customer_id` only and then unconditionally sets `plan="free"` and `stripe_subscription_id=None`.
  - It never verifies that the deleted Stripe subscription id matches the user’s currently active `stripe_subscription_id`.
  - This is unsafe when duplicate/old subscriptions are cancelled after a replacement subscription already exists.
- Impact:
  - A late delete webhook for an old or duplicate subscription can silently downgrade an actively paying user to free.
- Suggested fix:
  - Ignore deletion events whose `subscription["id"]` does not match the current stored subscription id, or actively query Stripe before downgrading.

## Finding 4 — chat pre-debit refund only covers LLM errors, not earlier failures

- Files:
  - `backend/app/services/chat_service.py:248-314`
  - `backend/app/services/chat_service.py:616-815`
- Problem:
  - Credits are pre-debited before saving the user message, before retrieval, and before some continuation reconstruction work.
  - Refund logic only exists inside the LLM streaming `except` block.
  - If retrieval fails, message persistence fails before the LLM call, or continuation setup blows up, the generator returns without refunding the pre-debit.
- Impact:
  - Users can lose credits for chats that never actually reach the model.
- Suggested fix:
  - Wrap the entire post-predebit workflow in a refund-on-failure guard, or move the pre-debit later so it happens immediately before the LLM call.

## Finding 5 — account deletion still proceeds when Stripe cancellation fails

- File: `backend/app/api/users.py:356-372`
- Problem:
  - `/api/users/me` now correctly blocks user deletion if document cleanup fails.
  - But Stripe cancellation is still best-effort only: on failure the code logs and proceeds to delete the user row anyway.
  - Once the user row is gone, there is no remaining in-app entity to self-service or reconcile the active subscription.
- Impact:
  - A transient Stripe failure during account deletion can leave a live paid subscription charging a deleted user.
- Suggested fix:
  - Treat Stripe cancellation failure as a blocker when an active subscription exists, or persist a durable cleanup job before deleting the user.

## Finding 6 — failed converted-PDF deletion is never retried

- Files:
  - `backend/app/services/doc_service.py:143-188`
  - `backend/app/workers/deletion_worker.py:11-64`
- Problem:
  - `delete_document()` tracks failure of both the original object and `converted_storage_key`.
  - The retry task only accepts a single `storage_key`.
  - When converted PDF cleanup fails, the queued retry passes the original key instead of the converted key, so the converted object is orphaned permanently.
- Impact:
  - Converted PDFs can accumulate as undeletable orphaned objects after partial cleanup failures.
- Suggested fix:
  - Extend the retry task to carry both original and converted keys and retry them independently.

## Finding 7 — URL ingest enforces max size only after fully downloading the body

- File: `backend/app/services/extractors/url_extractor.py:24-29,62-67`
- Problem:
  - `_fetch_with_safe_redirects()` uses `httpx.Client.get()` which buffers the full response body.
  - `fetch_and_extract_url()` checks `len(response.content) > MAX_CONTENT_SIZE` only after the entire body has already been read into memory.
- Impact:
  - A remote server can force excessive bandwidth and memory usage despite the advertised 10 MB content limit.
- Suggested fix:
  - Stream the response, enforce `Content-Length` when present, and stop reading once the configured cap is exceeded.
