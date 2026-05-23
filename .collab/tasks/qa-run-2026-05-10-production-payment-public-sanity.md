# QA Run - Production Payment Public Sanity - 2026-05-10

Scope: non-destructive production billing/payment checks. This run does not authenticate, does not create Checkout sessions, and does not attempt a live payment.

## Environment

| Item | Value |
|---|---|
| Frontend | `https://www.doctalk.site` |
| Backend | `https://backend-production-a62e.up.railway.app` |
| Harness | `.collab/scripts/qa_production_payment_public_sanity.py` |
| Raw JSON | `.collab/tasks/qa-production-payment-public-sanity-2026-05-10.json` |

## Command

```bash
python3 .collab/scripts/qa_production_payment_public_sanity.py \
  --json-out .collab/tasks/qa-production-payment-public-sanity-2026-05-10.json
```

## Result

Status: **pass with warning**. 7/7 functional checks passed.

| Check | Result | Evidence |
|---|---|---|
| Pricing page loads | Pass | `GET /pricing` returned 200, matched `/pricing` |
| Pricing page has Plus/Pro/refund-review copy | Pass | Required copy markers present |
| Pricing page does not leak localhost or Stripe secrets | Pass | No `localhost`, `127.0.0.1`, `sk_live`, or `sk_test` markers found |
| Public billing products API | Pass | `boost=500/$3.99`, `power=2000/$9.99`, `ultra=5000/$19.99` |
| Backend CORS allows production frontend | Pass | OPTIONS returned 200 with `access-control-allow-origin: https://www.doctalk.site` |
| Anonymous subscribe mutation | Pass | 401 `Authentication required` |
| Anonymous cancel mutation | Pass | 401 `Authentication required` |

## Warning

Production currently serves `content-security-policy: media-src 'none'` on `/pricing`. The local branch has already changed the CSP to allow `media-src 'self' data:` for Remotion/landing media; production still appears to be on the older policy.

Related tracking: `.collab/tasks/bug-2026-05-10-production-csp-media-src-none.md`.

## Not Covered

- Authenticated production Checkout/Portal or live payment. Those require safe production accounts and must not be triggered casually.
- Real production refund review operations after `refund_requested=true`; that is an external manual/business process.
