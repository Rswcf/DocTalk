---
id: A-03-C07-01
matrix: A
agent: claude
cell_id: A-03-C07
row_key: chat_sse
column_key: idempotency_replay
finding_key: reconcile_drives_balance_negative
severity: P2
confidence: high
status: bug
files:
  - "backend/app/services/credit_service.py:164"
  - "backend/app/services/credit_service.py:183"
  - "backend/app/services/credit_service.py:45"
exploit_preconditions:
  - "authenticated user with low credit balance (e.g. 6 credits)"
  - "LLM returns a model not in CREDIT_RATES (falls back to DEFAULT_RATE=(3,15))"
  - "LLM generates a long response (e.g. 10K output tokens)"
---

## Observation
`reconcile_credits` (`credit_service.py:183-188`) updates balance blindly with `diff = pre_debited - actual_cost`:

```python
sa.update(User).values(credits_balance=User.credits_balance + diff)
```

There is no `.where(User.credits_balance + diff >= 0)` guard. When `actual_cost > pre_debited` (common: pre-debit estimates are 5/15/35 for quick/balanced/thorough, but an unknown `model` hits `DEFAULT_RATE=(3,15)` — a 10K-token response costs ~150 credits), the balance is decremented by the overrun even if it drives the user negative.

Initial `debit_credits` (`credit_service.py:76-81`) DOES enforce `User.credits_balance >= cost`, but reconcile bypasses this guard.

## Impact
Users can finish chats with negative balance, bypassing per-call balance guards until their next action. In practice, small overruns are expected and acceptable (part of the pre-debit/reconcile design). But coupled with DEFAULT_RATE fallback, a single chat can consume 10× the pre-debit, leaving the user with a significant negative balance. Accounting invariant (`sum(deltas) == balance`) still holds because the ledger is updated with the new delta — but the "balance cannot go negative" invariant is broken.

## Repro / Evidence
1. User with `credits_balance=6`, selects `quick` mode (pre-debit=5).
2. System somehow routes to a model not in `CREDIT_RATES` (e.g., `settings.MODE_MODELS["quick"]` updated to new model, `CREDIT_RATES` not updated).
3. LLM returns 8K output tokens → `actual_cost = round(8000 * 15 / 1000) + prompt = ~120+` credits.
4. `reconcile_credits`: `diff = 5 - 120 = -115` → balance becomes `6 + (-115) = -114`.

## Suggested Fix
Add a floor on reconcile:

```python
# Cap reconcile at current balance; log overrun for ops visibility.
balance_result = await db.execute(
    sa.update(User)
    .where(User.id == user_id)
    .values(credits_balance=sa.func.greatest(User.credits_balance + diff, 0))
    .returning(User.credits_balance)
)
if diff < -balance_before:
    logger.warning("Reconcile overrun capped: user=%s overshoot=%d", user_id, -diff - balance_before)
```

Alternative: make pre-debit more conservative (match DEFAULT_RATE upper bound) OR fail loudly at app startup if `settings.MODE_MODELS` values are missing from `CREDIT_RATES`.
