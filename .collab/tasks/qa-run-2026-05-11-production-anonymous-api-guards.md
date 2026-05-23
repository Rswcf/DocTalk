# Production Anonymous API Guards - 2026-05-11

Scope: non-destructive production API security smoke for anonymous access. This verifies that production public endpoints remain reachable while private user, billing, collection, diff, and structured-workflow endpoints reject anonymous requests or hide private resources.

## Environment

- Backend: `https://backend-production-a62e.up.railway.app`
- Frontend origin for CORS check: `https://www.doctalk.site`
- Harness: `.collab/scripts/qa_production_anonymous_api_guards.py`

## Command

```bash
python3 .collab/scripts/qa_production_anonymous_api_guards.py \
  --json-out .collab/tasks/qa-production-anonymous-api-guards-2026-05-11.json
```

## Result

Final result: **pass**.

```json
{
  "total": 29,
  "passed": 29,
  "failed": 0,
  "groups": {
    "anonymous_not_found": {"total": 3, "failed": 0},
    "cors": {"total": 1, "failed": 0},
    "private_auth_guard": {"total": 19, "failed": 0},
    "public": {"total": 6, "failed": 0}
  }
}
```

Evidence: `.collab/tasks/qa-production-anonymous-api-guards-2026-05-11.json`

## Coverage

Public endpoints returned expected 200 responses:

- `GET /health`
- `GET /version`
- `GET /api/billing/products`
- `GET /api/documents`
- `GET /api/documents/demo`
- `GET /api/extraction-templates`

Private endpoints returned expected 401 responses:

- User/profile/export/delete APIs
- Credits balance/history APIs
- Collections list/create APIs
- Document Diff list/create APIs
- Question Templates list/create APIs
- Extraction create and table scan APIs
- Billing checkout/subscribe/portal/cancel APIs

Anonymous private-resource probes returned 404 without sensitive markers:

- Session messages
- Chunk detail
- Document search

CORS check passed for `https://www.doctalk.site` on a private API preflight.

## Notes

- The first run used `GET` for document search and correctly got `405`; the harness was corrected to use the production `POST /api/documents/{document_id}/search` contract, then passed 29/29.
- This does not replace authenticated owner/other-user production tests. It only verifies anonymous production guard behavior without creating data or using real accounts.
