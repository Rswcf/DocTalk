# QA Run - Production Public Performance Smoke - 2026-05-11

## Scope

Browser-level performance and reliability smoke for production public DocTalk routes.

- Base URL: `https://www.doctalk.site`
- Inventory: `.collab/tasks/qa-route-inventory-2026-05-10.json`
- Harness: `.collab/scripts/qa_production_public_performance_smoke.js`
- Evidence: `.collab/tasks/qa-production-public-performance-smoke-2026-05-11.json`
- Route scope: public, non-gated, non-dynamic concrete routes
- Viewports: desktop `1366x900`, mobile `390x844`

## Command

```bash
node --check .collab/scripts/qa_production_public_performance_smoke.js
node .collab/scripts/qa_production_public_performance_smoke.js \
  --json-out .collab/tasks/qa-production-public-performance-smoke-2026-05-11.json
```

## Assertions And Metrics

The harness records:

- HTTP document status
- DOMContentLoaded, load, response-end timing
- Resource count and transfer size from browser performance entries
- Failed requests
- Page errors
- Console errors
- Subresource `4xx`/`5xx` responses
- Body text and visible H1 sanity

Hard failures are reserved for bad document status, page errors, navigation errors, or near-empty pages. Performance budgets and console errors are recorded as warnings.

Current warning budgets:

- DOMContentLoaded over `5000ms`
- Load over `9000ms`
- Resource count over `100`
- Transfer size over `4 MiB`

## Result

Final result: **pass with warning**.

- Total viewport-route checks: `136`
- Passed: `136`
- Failed: `0`
- Warning checks: `2`
- Console-error checks: `2`
- Failed-request checks: `0`
- Page-error checks: `0`
- Subresource status-error checks: `0`

Timing summary:

- DOMContentLoaded p50/p90/max: `45ms` / `76ms` / `238ms`
- Load p50/p90/max: `100ms` / `116ms` / `296ms`
- Resource count p50/p90/max: `46` / `53` / `65`
- Transfer bytes p50/p90/max: `121847` / `224450` / `693423`

Warning details:

- `/` desktop and mobile emitted `10` console errors each, matching the known production `media-src 'none'` CSP drift for inline audio media.
- No route exceeded the timing, resource count, or transfer-size warning budgets.

Slowest observed loads:

- `/compare/humata` desktop: `296ms`
- `/` desktop: `238ms`
- `/blog/citation-highlighting-matters` desktop: `229ms`
- `/compare/pdf-ai` mobile: `227ms`
- `/` mobile: `220ms`

## Raw Output

```text
PRODUCTION_PUBLIC_PERFORMANCE_SMOKE PASS_WITH_WARNING: 136/136 viewport-route checks passed, warnings=2
```

## Notes

These timings are synthetic browser smoke timings from a single QA environment, not a replacement for real-user monitoring. They are useful for regression comparison after deploy and for catching obvious production resource failures.
