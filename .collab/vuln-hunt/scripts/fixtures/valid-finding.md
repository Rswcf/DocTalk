---
id: A-03-C07-01
matrix: A
agent: claude
cell_id: A-03-C07
row_key: chat_sse
column_key: idempotency_replay
finding_key: credit_refund_double_refund_on_retry
severity: P1
confidence: high
status: bug
files: ["backend/app/services/chat_service.py:350"]
exploit_preconditions: ["authenticated user", "network retry during SSE"]
---

## Observation
Chat retry can cause double-refund when the SSE disconnects after reconcile but before ledger commit.

## Impact
User gets free credits back twice.

## Repro / Evidence
1. Start chat request. 2. Kill connection at t=5s. 3. Retry. 4. Observe balance.

## Suggested Fix
Wrap reconcile + commit in single transaction.
