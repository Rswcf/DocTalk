# Technical Audit Report: Pricing/Credit/Billing Implementation

**Auditor**: tech-auditor
**Date**: 2026-02-10
**Scope**: All pricing, credit, and billing code in backend + frontend

---

## CRITICAL Findings

### C1. Alembic Migration Incomplete — Ledger Not Rescaled
**File**: `backend/alembic/versions/20260210_0012_rescale_credits.py:10-12`
**Severity**: CRITICAL

The migration divides `users.credits_balance` by 10 but does **not** touch `credit_ledger.delta` or `credit_ledger.balance_after`. After migration:
- All historical ledger entries still reference old 10x values (e.g., `delta=10000` for signup bonus)
- `balance_after` in ledger entries become inconsistent with actual `credits_balance`
- The Profile/Credits transaction history UI will display inflated historical amounts
- The `ensure_monthly_credits` idempotency check via ledger is unaffected (checks reason/cutoff, not amounts) but the displayed history will confuse users

**Recommended fix**: Add `UPDATE credit_ledger SET delta = delta / 10, balance_after = balance_after / 10` to the migration, or document this as intentional (old entries are pre-rescale).

### C2. auth_service.py Signup Bonus Hardcoded — Diverges from config.py
**File**: `backend/app/services/auth_service.py:18`
**Severity**: CRITICAL

```python
SIGNUP_BONUS_CREDITS = 1000  # hardcoded
```

But `config.py` has:
```python
SIGNUP_BONUS_CREDITS: int = 1000
```

These happen to match **now** (both 1000), but the auth_service value is a hardcoded constant, NOT read from `settings.SIGNUP_BONUS_CREDITS`. If an operator changes the config value, auth_service will still grant the old amount. The comment `# Must match settings.SIGNUP_BONUS_CREDITS in config.py` acknowledges the coupling but doesn't enforce it.

**Recommended fix**: Import and use `settings.SIGNUP_BONUS_CREDITS` instead of the local constant.

### C3. Debit Happens AFTER Response Delivery — Free Ride on Failed Debit
**File**: `backend/app/services/chat_service.py:413-450`
**Severity**: CRITICAL

The credit debit happens **after** the full AI response has already been streamed to the user:
1. Lines 192-205 in `chat.py`: Balance check (MIN_CREDITS_FOR_CHAT = 10)
2. Line 202-217: Stream opens and delivers full AI response
3. Lines 413-450 in `chat_service.py`: Debit attempt post-stream

If a user has exactly 10 credits and the response costs 15 credits, the debit fails (`User.credits_balance >= cost` check in `debit_credits` returns False), and the user gets the response **for free** (only a `warn` SSE event is emitted, no enforcement). This is by design for UX (don't cut off mid-stream), but it's exploitable:
- A user at low balance can send unlimited messages, each costing more than their balance
- The `MIN_CREDITS_FOR_CHAT=10` gate is the only prevention, but real costs range 1-27+ credits
- Worst case: a thorough-mode query costing ~27 credits is served to a user with 10 credits

**Recommended fix**: Either (a) pre-estimate cost and pre-debit, refunding unused portion, or (b) accumulate debt and block subsequent requests until debt is cleared.

### C4. Double Credit Check with No Lock — TOCTOU Race Condition
**Files**: `backend/app/api/chat.py:192-205` + `backend/app/services/chat_service.py:202-217`
**Severity**: CRITICAL

Credits are checked in **two separate places** without coordination:
1. `chat.py:196` — `get_user_credits(db, user.id)` (reads balance)
2. `chat_service.py:204` — `get_user_credits(db, user.id)` again (reads balance again)

Between these checks, another concurrent request could drain the balance. More importantly, neither check uses `FOR UPDATE` locking. Two concurrent requests each passing the balance check could **both** proceed to stream, then both attempt to debit. The `debit_credits` function's `WHERE credits_balance >= cost` is atomic at the SQL level, so one will fail and get a free ride (see C3).

With rapid-fire concurrent requests, a user with 10 credits could get multiple free responses before any debit lands.

---

## HIGH Findings

### H1. PricingTable Claims Not Enforced by Backend
**File**: `frontend/src/components/PricingTable.tsx:22-24`
**Severity**: HIGH

The PricingTable shows:
- **Export**: X (free), Check (plus), Check (pro)
- **Custom Prompts**: X (free), X (plus), Check (pro)
- **OCR**: Check for all plans

But the backend enforcement:
- **Export**: No plan gating. Export is a frontend-only operation (`export.ts:exportConversationAsMarkdown`). Any logged-in user can export (the code in ChatPanel line 294 gates it client-side: `userPlan === 'plus' || userPlan === 'pro'`, but this is trivially bypassable)
- **Custom Prompts**: Backend correctly gates on Pro (`documents.py:449-452`), frontend also gates (`page.tsx:204`: `profile?.plan === 'pro'`). This is properly enforced.
- **OCR**: Available to all (correct per PricingTable showing Check for all)
- **Sessions per document**: PricingTable shows "1 per document" for Free, "Unlimited" for Plus/Pro. But there is **zero backend enforcement** — free users can create unlimited sessions via `POST /documents/{id}/sessions`. Only anonymous demo users have session limits.

**Recommended fix**: Add backend enforcement for session limits per plan, or change the PricingTable to reflect reality.

### H2. Frontend Feature List Not i18n — Hardcoded English
**File**: `frontend/src/app/billing/page.tsx:133-145`
**Severity**: HIGH (UX/i18n)

The Plus and Pro feature lists are hardcoded English strings:
```javascript
const plusFeatures = [
  '3,000 credits/month',
  'All 3 performance modes',
  'Markdown export',
  '20 documents, 50MB files',
];
```

These are never translated, even though the app supports 11 locales. Users viewing the billing page in ZH, JA, etc. will see English feature bullets mixed with translated labels.

### H3. No `model` Field Validation in ChatRequest
**File**: `backend/app/schemas/chat.py:13`
**Severity**: HIGH

The `model` field in `ChatRequest` is `Optional[str]` with no validation. In `chat_service.py:184-185`:
```python
elif model and model in settings.ALLOWED_MODELS:
    effective_model = model
```

This allows any authenticated user to bypass mode selection and directly specify a model from `ALLOWED_MODELS`. For example, a Free user could send `{"message": "...", "model": "mistralai/mistral-large-2512"}` to use the Thorough-tier model **without** the 3x multiplier, because the `effective_mode` remains "balanced" (line 182: `effective_mode = mode or "balanced"`).

The multiplier is applied based on `effective_mode`, not `effective_model`, so a user specifying `model` directly gets the expensive model at the balanced (1.0x) credit rate instead of the thorough (3.0x) rate.

**Recommended fix**: Either remove the `model` field override entirely (it's marked deprecated), or if kept, resolve the mode from the model to apply correct multiplier.

### H4. Annual Pricing Discount Inconsistency
**File**: `frontend/src/app/billing/page.tsx:199,206,244,251`
**Severity**: HIGH (Business)

The billing page shows:
- Plus: $9.99/mo monthly, $7.99/mo annual → "Save 25%" badge (line 206: `percent: 25`)
- Pro: $19.99/mo monthly, $15.99/mo annual → "Save 20%" badge (line 251: `percent: 20`)

Actual calculation:
- Plus: ($9.99 - $7.99) / $9.99 = 20.0% savings (NOT 25%)
- Pro: ($19.99 - $15.99) / $19.99 = 20.0% savings (correct)

The Plus "Save 25%" claim is mathematically wrong. It would need to be $7.49/mo for a 25% discount, or the badge should say 20%.

---

## MEDIUM Findings

### M1. `calculate_cost` Integer Division Truncation — Systematic Under-Charging
**File**: `backend/app/services/credit_service.py:38-39`
**Severity**: MEDIUM

```python
input_cost = (prompt_tokens * input_rate) // 1000
output_cost = (completion_tokens * output_rate) // 1000
```

Integer division (`//`) always rounds DOWN. For a Quick-mode request with DeepSeek V3.2:
- 800 prompt tokens * rate 1 // 1000 = 0 credits (should be ~0.8)
- 200 completion tokens * rate 5 // 1000 = 1 credit
- base_cost = max(1, 0 + 1) = 1
- After 0.5x quick multiplier: max(1, int(0.5)) = 1 credit

Effectively, any request under ~1000 prompt tokens pays 0 input credits. The `max(1, ...)` floor saves from zero-total, but systematic truncation means revenue is lower than expected at small token counts. At scale with many small Quick-mode requests, this could add up.

### M2. `ensure_monthly_credits` Grants Additive, Not Reset
**File**: `backend/app/services/credit_service.py:202-210`
**Severity**: MEDIUM (Business logic)

Monthly credits are **added** to the existing balance, not reset to the allowance amount. A user who doesn't spend credits accumulates them indefinitely:
- Month 1: 500 free + 1000 bonus = 1500
- Month 2: 1500 + 500 = 2000
- Month 3: 2000 + 500 = 2500 ...

This is a deliberate design choice (additive grants are friendlier), but could lead to large accumulated balances. Combined with C3 (free rides on failed debits), users have less incentive to ever upgrade.

### M3. Subscription Webhook Doesn't Grant Monthly Credits on First Invoice
**File**: `backend/app/api/billing.py:216-247`
**Severity**: MEDIUM

When `checkout.session.completed` fires for a subscription, credits are granted (line 224-233). Then the first `invoice.payment_succeeded` also fires. The idempotency check uses different `ref_type` values:
- Checkout: `ref_type="stripe_subscription"`, `ref_id=subscription_id`
- Invoice: `ref_type="stripe_invoice"`, `ref_id=invoice_id`

These are **different** idempotency keys, so the user gets **double credits** on first subscription:
1. `checkout.session.completed` → grants allowance (ref_type=stripe_subscription)
2. First `invoice.payment_succeeded` → grants allowance again (ref_type=stripe_invoice)

Subsequent monthly invoices correctly get only one grant each.

**Recommended fix**: Skip credit grant on `checkout.session.completed` for subscriptions (let `invoice.payment_succeeded` handle it), or filter out the first invoice.

### M4. `billing/page.tsx` Prices are Hardcoded — Not from Stripe/Backend
**File**: `frontend/src/app/billing/page.tsx:199,244`
**Severity**: MEDIUM

Subscription prices ($9.99, $7.99, $19.99, $15.99) are hardcoded in the JSX. If Stripe prices change, the frontend will show stale amounts. The credit pack prices come from the API (`/api/billing/products`), but subscription prices don't.

### M5. Credit Pack Amounts and Prices Mismatch Documentation
**File**: `backend/app/core/config.py:103-105` + `backend/app/api/billing.py:64-70`
**Severity**: MEDIUM

Config defines:
- CREDITS_STARTER = 5,000 → $5
- CREDITS_PRO = 20,000 → $15
- CREDITS_ENTERPRISE = 100,000 → $50

The value per dollar varies dramatically:
- Starter: 1,000 credits/$
- Pro: 1,333 credits/$
- Enterprise: 2,000 credits/$

Enterprise users get 2x the credits-per-dollar compared to Starter. This may be intentional (volume discount), but it's worth confirming it matches the business intent.

### M6. Demo Session Cleanup Is Overly Broad
**File**: `backend/app/api/chat.py:89-96`
**Severity**: MEDIUM

The TTL cleanup in `create_session` deletes **all** sessions for the demo document older than 24 hours, including sessions from logged-in users. The `WHERE` clause doesn't filter by user:
```python
await db.execute(
    delete(ChatSession)
    .where(ChatSession.document_id == document_id)
    .where(ChatSession.created_at < cutoff)
)
```

A logged-in user's demo document sessions older than 24h will be deleted when any anonymous user triggers session creation.

---

## LOW Findings

### L1. `mode` Field Accepts Arbitrary Strings
**File**: `backend/app/schemas/chat.py:12`
**Severity**: LOW

`mode: Optional[str] = None` — no enum/Literal validation. Unknown modes fall through to `balanced` in `chat_service.py:188`, so there's no exploit, but it's sloppy.

### L2. CreditsDisplay Shows Stale Balance Until Refresh
**File**: `frontend/src/components/CreditsDisplay.tsx:22-31`
**Severity**: LOW

Balance is fetched once on auth, then every 60s. After a chat, `triggerCreditsRefresh()` is called, but there's a moment where the balance is stale (debit hasn't landed yet due to post-stream debit). Not a security issue but can confuse users.

### L3. `billing.comparison.sessionsFree` Says "1 per document" — Not Enforced
**File**: `frontend/src/i18n/locales/en.json:301`
**Severity**: LOW

This is the frontend text counterpart of H1. "1 per document" is displayed to free users but backend creates unlimited sessions for any logged-in user regardless of plan.

### L4. PricingTable Uses `transition-all` via `transition-colors`
**File**: Various
**Severity**: LOW

Minor: consistent with the project's `transition-colors` policy.

### L5. No Rate Limiting on Authenticated Chat Endpoint
**File**: `backend/app/api/chat.py:168-176`
**Severity**: LOW

Rate limiting only applies to anonymous users (`if user is None`). Authenticated users have no rate limit on the chat endpoint beyond the credit check. A malicious authenticated user could spam concurrent requests to exploit the TOCTOU race (C4) or simply consume their credits rapidly.

---

## Cross-Cutting Concerns

### XC1. Model Override Bypass (H3 Detail)
A user can manipulate the `model` field in the chat API request to use an expensive model without the correct credit multiplier. Specifically, sending `model: "mistralai/mistral-large-2512"` without `mode: "thorough"` results in the thorough-tier model being used at the balanced (1.0x) rate instead of 3.0x.

### XC2. Race Condition in Credit Deduction (C4 Detail)
Two concurrent chat requests from the same user can both pass the credit check and both stream responses. Only one debit may succeed (the `WHERE credits_balance >= cost` is atomic per-row), giving the other a free response.

### XC3. What Happens at Credits = 0 During Streaming
The response is fully delivered. Debit is attempted post-stream and fails. A `warn` SSE event is emitted but the user keeps the response. Next request will be blocked by the `MIN_CREDITS_FOR_CHAT` check.

### XC4. Frontend Export Gating is Client-Side Only
Export functionality is in `export.ts` — pure client-side Markdown generation. The ChatPanel gates visibility (`userPlan === 'plus' || userPlan === 'pro'`), but a tech-savvy user can call `exportConversationAsMarkdown()` from the browser console. Since export doesn't hit the backend, there's no server-side enforcement possible. This is acceptable if export is considered a soft feature gate.

---

## Summary Matrix

| ID | Severity | Category | Summary |
|----|----------|----------|---------|
| C1 | CRITICAL | Migration | Alembic rescale misses ledger table |
| C2 | CRITICAL | Config | Signup bonus hardcoded, diverges from settings |
| C3 | CRITICAL | Billing | Post-stream debit allows free rides |
| C4 | CRITICAL | Security | TOCTOU race on concurrent credit checks |
| H1 | HIGH | Enforcement | PricingTable features not enforced (export, sessions) |
| H2 | HIGH | i18n | Feature lists hardcoded English on billing page |
| H3 | HIGH | Security | `model` field bypass gets expensive model at cheap rate |
| H4 | HIGH | Business | Plus annual discount says 25%, actual is 20% |
| M1 | MEDIUM | Billing | Integer truncation under-charges small requests |
| M2 | MEDIUM | Business | Monthly credits accumulate unbounded |
| M3 | MEDIUM | Billing | Double credits on first subscription |
| M4 | MEDIUM | Consistency | Subscription prices hardcoded in frontend |
| M5 | MEDIUM | Business | Credit pack value-per-dollar varies 2x |
| M6 | MEDIUM | Data | Demo session cleanup deletes logged-in user sessions |
| L1 | LOW | Validation | `mode` field accepts arbitrary strings |
| L2 | LOW | UX | Credits display stale momentarily |
| L3 | LOW | Consistency | "1 per document" claim not enforced |
| L4 | LOW | Code style | Minor transition class alignment |
| L5 | LOW | Security | No rate limit on authenticated chat |
