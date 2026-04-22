# Subsystem: S1 Credits State Machine

## Scope
Files: `backend/app/services/credit_service.py`, `backend/app/services/chat_service.py` (pre-debit / reconcile / refund hooks), `backend/app/api/chat.py` (402 pre-check), `backend/app/api/billing.py` (Stripe webhook grant paths), `backend/app/models/tables.py` (`User.credits_balance`, `CreditLedger`).

In scope: pre-debit → stream → reconcile → refund state transitions; monthly renewal via `ensure_monthly_credits`; Stripe payment-intent grants and subscription-invoice allowances; plan-change supplement. Out of scope: LLM rate logic itself.

## Model
The credits subsystem is meant to guarantee:
1. **Conservation**: `sum(CreditLedger.delta for user) == User.credits_balance` at all times.
2. **Non-negative balance**: `credits_balance >= 0` always.
3. **Exactly-once grant per billing event**: each `stripe_payment` / `stripe_invoice` / `monthly_cycle` / `plan_change` ref pair grants credits at most once.
4. **No free chats**: every successful LLM response deducts credits proportional to tokens; failures refund via atomic ledger delete.
5. **Single ledger row per chat**: the pre-debit row is updated in place during reconcile, not supplemented with a second row.

## Data / Control Flow

### Normal chat flow (authenticated user, balanced mode)
1. `POST /api/sessions/{id}/chat` → `chat.py:222` verify session → 402 pre-check (`chat.py:297`): `balance < estimated_cost` returns 402.
2. `chat_service.chat_stream` enters: `debit_credits(cost=15, reason="chat", ref_type="mode", ref_id="balanced")` atomically decrements balance and inserts ledger row with `delta=-15`. Returns `predebit_ledger_id`.
3. LLM streams; client sees SSE tokens. On completion, `reconcile_credits(predebit_ledger_id, pre_debited=15, actual_cost=N)` computes `diff = 15 - N` and updates BOTH the user balance and the ledger row in place (so final ledger has `delta=-N`, not `delta=-15` + secondary correction).
4. `record_usage` inserts a `UsageRecord` row for the `/api/billing/usage` analytics query.

### Failure paths
- Retrieval fails → `_refund_predebit`: deletes predebit ledger entry + restores balance (atomic via `rowcount` guard).
- LLM fails mid-stream → same refund.
- Assistant message persist fails → refund.
- Accounting reconcile fails → `WARN` SSE event, balance is NOT refunded (pre-debit stands as actual cost — safe-ish under-charge).

### Stripe webhook grant flow
- `checkout.session.completed` (mode=subscription) → `_handle_checkout_session_subscription_completed` sets `user.plan = detected_plan`, but **does NOT grant credits** (deferred to `invoice.payment_succeeded`).
- `invoice.payment_succeeded` with `billing_reason in {subscription_create, subscription_cycle}` → `_handle_invoice_payment_succeeded` grants `_credits_for_plan(plan)` with idempotency on `(ref_type="stripe_invoice", ref_id=invoice_id)`.
- Other `billing_reason` values (e.g., `manual`, `subscription_threshold`, `quote_accept`): no grant, but log.

### Monthly free allowance
- `ensure_monthly_credits` fires on every authenticated chat request. Grants `PLAN_FREE_MONTHLY_CREDITS` if `now - last_granted >= 30 days` AND no recent `monthly_allowance` ledger entry in last 30d.

## Threats I Considered
- **Double-grant via webhook replay**: ruled out — idempotency on `(ref_type, ref_id)` is tight, confirmed in both payment_intent and invoice paths (`billing.py:955`, `billing.py:1046`).
- **Balance underflow via concurrent chats**: ruled out — `debit_credits` uses `WHERE credits_balance >= cost` atomic guard.
- **Double-refund via SSE reconnect**: ruled out — `_refund_predebit` is idempotent via `DELETE ... RETURNING rowcount`; only restores if row still exists.
- **Ledger/balance drift under concurrent reconcile**: possible if two reconcile calls fire for same predebit_id. Inspected — only one caller per pre-debit (chat_service owns the ledger_id). Safe.
- **Plan-change supplement double-grant**: ruled out — idempotency on `(ref_type="plan_change", ref_id="plan_change_<sub_id>_<period_start>")` at `billing.py:386-393`.
- **Reconcile drives balance negative** (CONFIRMED BUG, A-03-C07-01): no `>= 0` guard on reconcile update; unknown model + long response = underflow. See matrix finding.
- **Plan fallback to "pro" on env drift** (CONFIRMED BUG, A-04-C07-01): silent mis-grant. See matrix finding.
- **Missing `record_usage` on failure path**: if LLM succeeds but `record_usage` throws, we eat the accounting but still commit the ledger reconcile. Acceptable (ledger is source of truth; usage is analytics).
- **Monthly renewal: user changes plan from free → plus DURING the 30-day window, then back to free**: `ensure_monthly_credits` gates on `plan == "free"`, so mid-window upgrade skips re-grant. When they downgrade back to free, `monthly_credits_granted_at` is still old → re-grants. This is probably intended.

## Findings (beyond matrix)

### F1: Monthly grant skipped for paid users but `monthly_credits_granted_at` is repurposed
- Status: risk / deficiency (P3)
- `_handle_invoice_payment_succeeded` grants monthly allowance for paid plans via `stripe_invoice` ref_id but does NOT update `user.monthly_credits_granted_at`. The field is named/documented only for the free-plan renewal path.
- Then: when a user churns from plus → free, `ensure_monthly_credits` uses whatever `monthly_credits_granted_at` was set to (likely the signup time, since it was never touched during paid period). If that's > 30 days old, the ledger idempotency check is the only barrier.
- Safe under current code (ledger check prevents double grant) but the `monthly_credits_granted_at` field is semantically stale, which is a future-bug substrate.
- **Fix**: either update `monthly_credits_granted_at` on paid grants too (rename to `last_allowance_granted_at`), or document the free-plan-only semantics inline.

### F2: `record_usage` inside try but outside reconcile idempotency boundary
- Status: risk (P3)
- If `reconcile_credits` succeeds then `record_usage` fails → ACCOUNTING_ERROR warn but balance was already updated and ledger persisted. On retry (e.g., client reconnects and somehow re-triggers), there's no protection against double-counting in usage analytics.
- Practical impact: analytics drift, not revenue loss. Low.
- **Fix**: `record_usage` idempotency key on `message_id`.

## Interactions
- Interacts with **S2 Stripe lifecycle** via webhook-initiated grants. Both subsystems share the idempotency contract; a bug in `billing.py` webhook dispatching (e.g., wrong event type routing) would silently skip or double-book grants.
- Interacts with **S4 Auth double-layer**: `User.id` is the key for all credit operations; a JWT forgery (which requires AUTH_SECRET compromise) gives attacker access to mint chats that drain OR mint grants. Though AUTH_SECRET controls identity, NOT credit amounts.
- Interacts with **S6 SSE pipeline**: client disconnect mid-stream does NOT trigger refund (the generator continues until LLM completes or errors). Users who disconnect get charged for completed LLM work they don't see. This is by design (OpenRouter still bills us) but could surprise users.
- No cross-subsystem dependency found with S9b retrieval boundary or S7 sharing.
