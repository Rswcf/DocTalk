---
id: A-01-C08-01
matrix: A
agent: claude
cell_id: A-01-C08
row_key: auth_adapter
column_key: sensitive_exposure_enum
finding_key: delete_user_no_audit_log
severity: P3
confidence: high
status: deficiency
files:
  - "backend/app/api/auth.py:92"
  - "backend/app/services/auth_service.py:105"
exploit_preconditions:
  - "X-Adapter-Secret compromise (credential leak or env var exposure)"
---

## Observation
`DELETE /api/internal/auth/users/{user_id}` (`auth.py:92-101`) deletes a user after adapter-secret verification. `auth_service.delete_user` (`auth_service.py:105-107`) issues `db.delete(user); db.commit()` with NO audit log, NO security event emission, NO soft-delete.

Compare to `create_user` (`auth_service.py:27-74`), which emits a ledger entry for the signup bonus — create has a trail, delete does not.

## Impact
If `ADAPTER_SECRET` is compromised (env leak, CI misconfiguration, forensic scenario), an attacker can silently delete user accounts with zero audit signal. Post-incident forensics would struggle to distinguish attacker deletions from legitimate Auth.js adapter-triggered deletions.

Additionally: the PostgreSQL FK cascades will wipe documents, chat sessions, credit ledger entries. A compromised secret = full tenant annihilation with no forensic trail.

## Suggested Fix
1. Emit `log_security_event("user_deleted", user_id=..., source="adapter", ...)` before the delete.
2. Consider soft-delete (set `deleted_at` instead of `DELETE`) so the audit chain persists.
3. Rate-limit `DELETE /api/internal/auth/users/*` (e.g., max 10/min) to bound blast radius of a compromised secret.

Note: Auth.js adapter only triggers `delete_user` when the user deletes their own account from the UI. Legitimate traffic is very low — any spike is a red flag.
