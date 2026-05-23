# QA Run - Hosted Stripe Browser Click-Through - 2026-05-10

## Scope

Validate the user-facing hosted Stripe payment handoff from DocTalk Billing in a real browser:

- Free user -> Billing -> Plus Checkout -> `checkout.stripe.com`
- Plus user -> Billing -> Manage -> Stripe Billing Portal -> `billing.stripe.com`
- Desktop and mobile viewports
- Auth.js session cookie, local profile state, billing API proxy response, hosted redirect, layout overflow, clipped controls, console errors, and cleanup

## Environment

- Frontend: `http://localhost:3000`
- Backend: `http://127.0.0.1:8000`
- Stripe mode: test (`sk_test_*`)
- Browser: Playwright Chromium via frontend dependency
- Fixture: `.collab/tasks/qa-browser-stripe-hosted-fixture-2026-05-10.json`
- Result JSON: `.collab/tasks/qa-browser-stripe-hosted-ux-2026-05-10.json`
- Cleanup JSON: `.collab/tasks/qa-browser-stripe-hosted-fixture-cleanup-2026-05-10.json`

## Result

Status: **pass**

| Flow | Viewport | Local API | Hosted Host | Billing State | Layout | Console |
|---|---:|---:|---|---|---|---|
| Checkout Plus | 1440x900 | 200 `/billing/subscribe` | `checkout.stripe.com` | `pending` | Pass | 0 errors |
| Checkout Plus | 390x844 | 200 `/billing/subscribe` | `checkout.stripe.com` | `pending` | Pass | 0 errors |
| Billing Portal | 1440x900 | 200 `/billing/portal` | `billing.stripe.com` | `active` Plus | Pass | 0 errors |
| Billing Portal | 390x844 | 200 `/billing/portal` | `billing.stripe.com` | `active` Plus | Pass | 0 errors |

Screenshots:

- `.collab/tasks/screenshots/2026-05-10/stripe-hosted-checkout-desktop-before.png`
- `.collab/tasks/screenshots/2026-05-10/stripe-hosted-checkout-desktop-hosted.png`
- `.collab/tasks/screenshots/2026-05-10/stripe-hosted-checkout-mobile-before.png`
- `.collab/tasks/screenshots/2026-05-10/stripe-hosted-checkout-mobile-hosted.png`
- `.collab/tasks/screenshots/2026-05-10/stripe-hosted-portal-desktop-before.png`
- `.collab/tasks/screenshots/2026-05-10/stripe-hosted-portal-desktop-hosted.png`
- `.collab/tasks/screenshots/2026-05-10/stripe-hosted-portal-mobile-before.png`
- `.collab/tasks/screenshots/2026-05-10/stripe-hosted-portal-mobile-hosted.png`

## Notes

- The browser script was hardened after an initial click timeout so future runs write a JSON failure report instead of dropping evidence. It now selects visible/enabled CTA buttons and records the click target.
- Checkout creates a Stripe customer and stores local `stripe_subscription_id="pending"` before redirecting to hosted Checkout.
- Portal fixtures used real Stripe test subscriptions and returned period-end values through `billing_state`, exercising the period-end fix from `BUG-2026-05-10-STRIPE-PERIOD-END-NULL`.

## Cleanup

Cleanup status: **pass**

- Cancelled 2 Stripe test subscriptions.
- Deleted 4 Stripe test customers, including the 2 customers created by Checkout browser clicks.
- Deleted 4 local QA users.

