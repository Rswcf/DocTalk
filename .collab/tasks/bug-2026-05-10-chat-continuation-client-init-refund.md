# BUG - Continuation LLM Client Init Did Not Refund Predebit - 2026-05-10

## Summary

`ChatService.continue_stream()` pre-debited authenticated users before reconstructing the continuation prompt, but initialized the LLM client outside the protected streaming `try` block. If `_get_llm_client()` failed after predebit, the generator raised before emitting a safe SSE error and before refunding the predebit.

## Impact

- A continuation attempt could charge credits even though no LLM call started.
- Users would not receive the normal `LLM_ERROR` SSE response.
- The ordinary `chat_stream()` path already handled this case correctly, so the issue was isolated to continuation.

## Fix

Wrapped continuation `_get_llm_client(effective_model)` in the same refund + safe SSE handling used by initial chat:

- Call `_refund_predebit(db, user.id, pre_debited, predebit_ledger_id)`.
- Emit `_safe_sse("error", "LLM_ERROR", ...)`.
- Return before building stream state.

## Regression Coverage

Added `test_continue_stream_refunds_predebit_when_llm_client_unavailable` in `backend/tests/test_chat_setup_refunds.py`.

Related accounting coverage added in the same file:

- `test_chat_stream_reconciles_predebit_and_records_usage`
- `test_continue_stream_reconciles_predebit_and_records_usage`

Verification:

```bash
cd backend && python3 -m pytest tests/test_chat_setup_refunds.py -v
```

Result: `11 passed`.

