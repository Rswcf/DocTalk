---
id: A-03-C02-01
matrix: A
agent: claude
cell_id: A-03-C02
row_key: chat_sse
column_key: authz_idor
finding_key: continue_message_id_enumeration
severity: P3
confidence: medium
status: bug
files:
  - "backend/app/api/chat.py:396"
  - "backend/app/api/chat.py:399"
  - "backend/app/api/chat.py:413"
exploit_preconditions:
  - "authenticated attacker with a valid session of their own"
  - "attacker guesses / leaks a target Message UUID (low likelihood — UUIDv4)"
---

## Observation
`chat_continue` at `chat.py:396-413` fetches `msg_id` WITHOUT scoping to `session_id`:

```python
msg_id = uuid.UUID(body.message_id) if body.message_id else None
if msg_id:
    msg_row = await db.execute(sa_select(Message).where(Message.id == msg_id))
    msg = msg_row.scalar_one_or_none()
```

Then at line 413 it checks `msg.continuation_count >= MAX_CONTINUATIONS_PER_MESSAGE`, returning 400 vs 404 based on the foreign message's state.

The inner ownership check in `continue_stream` (chat_service.py:685) does catch the session mismatch and returns `MESSAGE_NOT_FOUND`, but only AFTER the pre-check 400 vs 404 branching in the API layer has already leaked the message's existence and continuation count.

## Impact
Side-channel disclosure:
- Attacker who knows / guesses a target Message UUID can distinguish:
  - 404 = message doesn't exist
  - 400 CONTINUATION_LIMIT = message exists and has hit max continuations
  - continues to chat_service which returns MESSAGE_NOT_FOUND = message exists in different session
  
Practical impact is low because Message UUIDs are v4 and not enumerable, but if UUIDs leak via logs, export files, or screenshots, this widens the leak.

## Repro / Evidence
1. User A creates a message `msg_A` (owned by session_A).
2. User B (different account, different session_B) sends:
   ```json
   POST /api/sessions/<session_B>/chat/continue
   {"message_id": "<msg_A_uuid>"}
   ```
3. Observe 400 vs 404 response pattern.

## Suggested Fix
Scope the message fetch by session_id:

```python
if msg_id:
    msg_row = await db.execute(
        sa_select(Message)
        .where(Message.id == msg_id)
        .where(Message.session_id == session_id)
    )
```

This returns None for cross-session access, yielding a clean 404 before any side-channel probing is possible.
