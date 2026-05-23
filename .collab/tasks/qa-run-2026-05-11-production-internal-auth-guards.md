# Production Internal Auth Guards - 2026-05-11

Scope: non-destructive production security smoke for deep health checks and the internal Auth.js adapter API. The run intentionally used no real secret and one known-invalid secret. It did not create users, accounts, or verification tokens.

## Environment

- Backend: `https://backend-production-a62e.up.railway.app`
- Harness: `.collab/scripts/qa_production_internal_auth_guards.py`
- Secrets: no real `ADAPTER_SECRET` or health secret was provided to the harness.

## Command

```bash
python3 .collab/scripts/qa_production_internal_auth_guards.py \
  --json-out .collab/tasks/qa-production-internal-auth-guards-2026-05-11.json
```

## Result

Final result: **pass**.

```json
{
  "total": 10,
  "passed": 10,
  "failed": 0,
  "groups": {
    "health": {"total": 2, "failed": 0},
    "internal_auth": {"total": 8, "failed": 0}
  }
}
```

Evidence: `.collab/tasks/qa-production-internal-auth-guards-2026-05-11.json`

## Coverage

Deep health checks:

- `GET /health?deep=true` without `x-health-secret` returned `403`.
- `GET /health?deep=true` with an intentionally wrong `x-health-secret` returned `403`.

Internal Auth adapter checks:

- `GET /api/internal/auth/users/{id}` without secret returned `401`.
- `GET /api/internal/auth/users/{id}` with wrong secret returned `401`.
- `GET /api/internal/auth/users/by-email/{email}` without secret returned `401`.
- `GET /api/internal/auth/users/by-account/{provider}/{provider_account_id}` without secret returned `401`.
- `POST /api/internal/auth/users` without secret returned `401`.
- `POST /api/internal/auth/users` with wrong secret returned `401`.
- `POST /api/internal/auth/verification-tokens` without secret returned `401`.
- `POST /api/internal/auth/verification-tokens/use` with wrong secret returned `401`.

All responses were checked for sensitive marker leakage (`ADAPTER_SECRET`, `AUTH_SECRET`, DB URLs, provider keys, Stripe secret patterns, stack traces); none were found.

## Remaining Gap

This verifies the production guard behavior for missing/invalid internal secrets. It does not validate successful internal adapter operations with the real secret, which should only be done from the trusted frontend/Auth.js environment or a controlled staging environment.
