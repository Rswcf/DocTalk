---
id: A-03-C07-01
matrix: A
agent: codex
cell_id: A-03-C07
row_key: chat_sse
column_key: idempotency_replay
finding_key: credit_refund_double_refund_on_retry
severity: P0
confidence: medium
status: bug
files: ["backend/app/services/chat_service.py:360"]
exploit_preconditions: ["authenticated user", "network retry"]
---

## Observation
Dry-run synthetic finding (deliberate P0 to trigger tie-break). Credits can be double-refunded via retry window.

## Impact
Unbounded payment fraud across concurrent sessions.

## Suggested Fix
Atomic reconcile + commit.
