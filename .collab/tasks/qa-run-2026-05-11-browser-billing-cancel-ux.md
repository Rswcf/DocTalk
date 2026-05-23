# QA Run - Browser Billing Cancel UX - 2026-05-11

Scope: verify the authenticated `/billing` self-serve cancellation modal, including Back behavior, cancel reason selection, optional feedback, refund-review checkbox, API payload, success copy, profile refresh, and mobile/desktop layout.

## Environment

| Item | Value |
|---|---|
| Backend | `http://127.0.0.1:8000`, temporary uvicorn process |
| Frontend | `http://127.0.0.1:3000`, temporary Next.js dev server |
| Fixture | Synthetic authenticated `plus` users with no Stripe customer/subscription ids, one per viewport |
| Harnesses | `.collab/scripts/qa_browser_billing_cancel_fixture.py`, `.collab/scripts/qa_browser_billing_cancel_ux.js` |

## Result

Pass after fixes.

Evidence:

- Initial fixture: `.collab/tasks/qa-browser-billing-cancel-fixture-2026-05-11.json`
- Initial failed run: browser stopped on consent banner intercepting the cancel modal Back button
- Intermediate fixture: `.collab/tasks/qa-browser-billing-cancel-fixture-after-cookie-z-fix-2026-05-11.json`
- Intermediate failed run: `.collab/tasks/qa-browser-billing-cancel-ux-after-cookie-z-fix-2026-05-11.json`
- Passing fixture: `.collab/tasks/qa-browser-billing-cancel-fixture-after-profile-consent-fix-2026-05-11.json`
- Passing retest: `.collab/tasks/qa-browser-billing-cancel-ux-after-profile-consent-fix-2026-05-11.json`
- Cleanup:
  - `.collab/tasks/qa-browser-billing-cancel-fixture-cleanup-2026-05-11.json`
  - `.collab/tasks/qa-browser-billing-cancel-fixture-cleanup-after-cookie-z-fix-2026-05-11.json`
  - `.collab/tasks/qa-browser-billing-cancel-fixture-cleanup-after-profile-consent-fix-2026-05-11.json`
- Bug: `.collab/tasks/bug-2026-05-11-billing-cancel-modal-consent-and-stale-profile.md`

Initial findings:

- Mobile first-visit consent banner intercepted Billing cancel modal controls.
- Desktop cancellation succeeded in the API but the page could keep rendering the stale paid current-plan panel.

Retest assertions passed on desktop `1440x900` and mobile `390x844`:

- `/api/users/profile` before cancel returned `plan=plus`, `managed_by=admin`, `can_cancel=true`
- `/billing` rendered the current-plan panel and `Return to Free plan`
- cancel modal opened as `role=dialog` with 8 radio reasons
- modal included `Answers or citations were not good enough`
- modal included feedback textarea with `maxlength=1000`
- modal included `Request a refund review` and non-blocking refund-review hint copy
- `Back` closed the modal and made `0` `/api/billing/cancel` requests
- confirming cancellation sent:
  - `reason=answer_quality`
  - `feedback=QA browser cancellation feedback`
  - `refund_requested=true`
- cancel response returned `200`, `status=immediate_revert`, `refund_requested=true`
- final profile returned `plan=free`, `managed_by=none`, `can_cancel=false`
- modal closed and success copy included `Your refund request was recorded for review.`
- no horizontal overflow or clipped interactive controls before modal, in modal, or after cancellation
- console errors: `0`

Screenshots:

- `.collab/tasks/screenshots/2026-05-11/billing-cancel-desktop-before.png`
- `.collab/tasks/screenshots/2026-05-11/billing-cancel-desktop-modal.png`
- `.collab/tasks/screenshots/2026-05-11/billing-cancel-desktop-after.png`
- `.collab/tasks/screenshots/2026-05-11/billing-cancel-mobile-before.png`
- `.collab/tasks/screenshots/2026-05-11/billing-cancel-mobile-modal.png`
- `.collab/tasks/screenshots/2026-05-11/billing-cancel-mobile-after.png`

## Cleanup

All three fixture batches were cleaned up. The final cleanup report returned:

```json
{"users": 0, "plan_transitions": 0, "product_events": 0, "billing_cancel_users": 0}
```

## Validation

Passed:

- `python3 -m py_compile .collab/scripts/qa_browser_billing_cancel_fixture.py`
- `node --check .collab/scripts/qa_browser_billing_cancel_ux.js`
- `cd frontend && npx tsc --noEmit --pretty false`
- `cd frontend && npm run build`
- `cd backend && python3 -m ruff check app/ tests/ ../.collab/scripts/qa_browser_billing_cancel_fixture.py ../.collab/scripts/qa_url_edge_matrix.py ../.collab/scripts/qa_url_import_matrix.py`
- `cd backend && python3 -m pytest tests/test_parse_service.py tests/test_url_extractor.py tests/test_error_taxonomy.py tests/test_billing_cancel.py tests/test_billing_state.py -v` (`101 passed, 10 warnings`)
- `jq empty` for all Billing cancel fixture, UX, and cleanup JSON artifacts
- `git diff --check`
- Port check: no listener on `3000` or `8000`

Note: `npm run build` printed the expected local `RESEND_API_KEY not set` message, plus existing Sentry and edge-runtime warnings.

## Remaining Gap

This verifies the local admin-managed cancellation path in a real browser. Stripe-hosted Checkout/Portal and Stripe-backed scheduled cancellation already have separate test-mode/browser coverage; authenticated production cancellation and the manual refund-review business process still require safe accounts and operational verification.
