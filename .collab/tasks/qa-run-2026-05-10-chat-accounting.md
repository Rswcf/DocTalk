# QA Run - Chat Streaming Credit Accounting - 2026-05-10

## Scope

Close the `/goal` billing-accounting gap for streaming chat:

- Authenticated chat predebit refund when retrieval/setup fails.
- Authenticated chat predebit refund when LLM client setup fails.
- Continuation predebit refund when setup fails.
- Continuation predebit refund when LLM client setup fails.
- Successful initial stream reconciles predebit to actual usage and records `UsageRecord`.
- Successful continuation stream reconciles predebit to actual usage and records `UsageRecord`.

## Evidence

Code change:

- `backend/app/services/chat_service.py`

Tests:

- `backend/tests/test_chat_setup_refunds.py`

Bug record:

- `.collab/tasks/bug-2026-05-10-chat-continuation-client-init-refund.md`

## Result

Status: **pass**

Command:

```bash
cd backend && python3 -m pytest tests/test_chat_setup_refunds.py -v
```

Observed result:

- `11 passed`

Broader related regression:

```bash
cd backend && python3 -m pytest tests/test_chat_setup_refunds.py tests/test_credit_reconcile.py tests/test_error_taxonomy.py -v
```

Observed result:

- `61 passed`

## Coverage Notes

- The test uses fake OpenAI-compatible streaming chunks with usage payloads, so it does not require `DEEPSEEK_API_KEY`.
- The tests verify service-level behavior directly, not a proxy health signal:
  - `_refund_predebit` is awaited with the exact user, amount, and ledger ID on failure.
  - `credit_service.reconcile_credits` receives `pre_debited` and the calculated actual cost on success.
  - `credit_service.record_usage` receives prompt tokens, completion tokens, message ID, model, and final credit cost.
- This covers accounting correctness for the streaming generator. It does not replace real private-upload live RAG quality testing, which still requires an LLM-enabled environment.
