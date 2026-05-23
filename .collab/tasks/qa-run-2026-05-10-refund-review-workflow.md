# QA Run - Refund Review Workflow - 2026-05-10

Scope: validate what DocTalk actually ships for cancellation-linked refund handling, and separate the in-product refund-review signal from any external/manual Stripe refund operation.

## Result

Status: **pass for the current in-product refund-review workflow; not applicable for automatic Stripe refund payout**.

The product currently implements a refund review request, not an automatic refund. That is consistent across backend behavior, frontend copy, analytics/admin funnel, and product documentation.

## Evidence

| Layer | Evidence | Result |
|---|---|---|
| Backend schema | `CancelSubscriptionRequest.refund_requested: bool = False`; `CancelSubscriptionResponse.refund_requested: bool = False` | Pass |
| Stripe-backed cancel | `.collab/tasks/qa-stripe-testmode-matrix-after-period-fix-2026-05-10.json` returned `scheduled_cancel`, period-end `effective_at`, and `refund_requested: true` | Pass |
| Admin-promoted cancel | `.collab/tasks/qa-billing-credits-matrix-2026-05-10.json` returned `immediate_revert` and `refund_requested: true` | Pass |
| Audit trail | `backend/tests/test_billing_cancel.py::test_branch_a_active_schedules_cancel` asserts `PlanTransition.metadata_json["refund_requested"] is True` | Pass |
| Frontend copy | Billing modal says "Request a refund review"; success copy says "Your refund request was recorded for review." | Pass |
| Analytics/admin | Frontend emits `refund_requested`; `/api/events` allows it; admin funnel includes "Requested refund" | Pass |
| Refund payout automation | Repo search found no `stripe.Refund.create`, no `charge.refunded` webhook handling, and no refund processor route/job | Expected absent |
| Product contract | `docs/ARCHITECTURE.md` and `docs/PRODUCT_STRATEGY.md` state refunds are manual/business review, not automatic | Pass |

## Interpretation

This is not a product bug under the current documented contract. A user can request a refund review while cancelling, and the request is recorded in cancellation metadata and analytics. The system does not currently issue a Stripe refund or decide eligibility automatically.

If the business expectation changes to "clicking refund review starts a Stripe refund", that would be a new feature requiring:

- Explicit eligibility rules, including purchase age, usage threshold, and credit-pack vs subscription behavior.
- A durable support/review queue or automatic `stripe.Refund` integration.
- Idempotency keys and audit records for each refund attempt.
- Webhook handling for refund success/failure/dispute events.
- End-to-end Stripe test-mode and production-safe verification.

## Remaining Gap

The external manual/business process after `refund_requested=true` is outside this repository and could not be verified from local code. Future production QA should confirm the operational path: where the signal is monitored, who reviews it, expected SLA, and how the final Stripe Dashboard action is reconciled with user support history.
