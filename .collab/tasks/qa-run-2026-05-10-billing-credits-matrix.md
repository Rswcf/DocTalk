# QA Run - 2026-05-10 - Billing, Credits, And Plan Gates

Scope: execute billing, credits, and plan-gate checks that do not require real Stripe checkout or real LLM calls.

## Environment

| Item | Result |
|---|---|
| Backend | Existing local `http://127.0.0.1:8000` healthy |
| Docker infra | Postgres, Redis, Qdrant, MinIO running |
| Celery | Existing `default,parse` worker processes running |
| Test file | `test_inputs/semiconductor.pdf` |
| Accounts | Temporary Free, Plus, and admin-promoted Plus QA users |

## Artifacts

| Artifact | Purpose |
|---|---|
| `.collab/scripts/qa_billing_credits_matrix.py` | Reusable billing/credits/plan-gate matrix that avoids real Stripe checkout and LLM calls. |
| `.collab/tasks/qa-billing-credits-matrix-2026-05-10.json` | Machine-readable billing/credits execution result. |

## Command Run

```bash
python3 .collab/scripts/qa_billing_credits_matrix.py \
  --api-base http://127.0.0.1:8000 \
  --file test_inputs/semiconductor.pdf \
  --timeout 240 \
  --json-out .collab/tasks/qa-billing-credits-matrix-2026-05-10.json
```

## Results

Overall: **Pass**. 23/23 checks passed.

Billing and credits:

| Case | Expected | Result |
|---|---|---|
| Public billing products | 200, `boost/power/ultra` | Pass |
| Anonymous credits/billing mutations | 401 | Pass |
| Credit balance after signup | 200, includes signup bonus transaction | Pass |
| Credit history bounds | 200, bounded to <=100 items, includes signup bonus | Pass |
| Admin-promoted Plus billing state | `managed_by=admin`, `can_cancel=true` | Pass |
| Admin-promoted Plus cancel | 200 `immediate_revert`, plan becomes Free, transition audit row written | Pass |
| Cancel again after Free revert | 400 | Pass |
| Billing portal with no Stripe customer | 400 | Pass |
| Change plan with no active subscription | 400 | Pass |

Plan gates:

| Case | Expected | Result |
|---|---|---|
| Free user uploads first 3 documents | 202 each | Pass |
| Free user uploads 4th document | 403 `DOCUMENT_LIMIT_REACHED` | Pass |
| Free user creates first 3 sessions for one document | 201 each | Pass |
| Free user creates 4th session | 403 `SESSION_LIMIT_REACHED` | Pass |
| Plus user with 0 credits starts chat | 402 `INSUFFICIENT_CREDITS` before LLM call | Pass |
| Free user over Pro-mode monthly cap starts `balanced` chat | 402 `PRO_MODE_LIMIT_REACHED` before LLM call | Pass |

Cleanup:
- QA users and owned docs were deleted automatically.
- Verification query returned `qa_billing_users=0`, `qa_billing_docs=0`.

Warnings observed:
- `urllib3` LibreSSL warning from local Python.
- Qdrant client/server minor version mismatch warning: client `1.16.1`, server `1.14.1`.

## Coverage Added

This run covers:
- Credit balance/history API.
- Public billing product list.
- Auth boundaries for credits and billing mutation endpoints.
- Admin-promoted paid-plan billing state and self-serve cancel Branch B.
- Free document count limit.
- Free sessions-per-document limit.
- Chat insufficient-credit precheck.
- Free Pro-mode monthly cap precheck.

## Not Covered

- Real Stripe checkout, credit-pack payment, subscription checkout, upgrade/downgrade through Stripe, portal session creation, and live webhook reconciliation were not executed in this slice.
- Real LLM debit/reconcile/refund behavior after streaming was not exercised because local `DEEPSEEK_API_KEY` is absent.
- Browser billing/pricing/paywall/cancel UX was not exercised in this slice.
