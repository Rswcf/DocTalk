---
id: A-22-C10-01
matrix: A
agent: claude
cell_id: A-22-C10
row_key: stripe_return_urls
column_key: browser_flow_integrity
finding_key: stripe_return_url_param_reflection
severity: P3
confidence: low
status: risk
files:
  - "backend/app/api/billing.py:201"
  - "backend/app/api/billing.py:269"
  - "backend/app/api/billing.py:299"
exploit_preconditions:
  - "attacker convinces user to click a crafted billing link"
---

## Observation
Stripe checkout and portal sessions are created with hard-coded `success_url` / `cancel_url` / `return_url` pointing to `settings.FRONTEND_URL/billing`. The URL template uses `?success=1` / `?canceled=1` as query params. These are fine as long as:
1. `settings.FRONTEND_URL` is a trusted fixed value (it is — env var, not user input)
2. The frontend `/billing` page does NOT reflect arbitrary query params into the DOM

I did not read the frontend `/billing/page.tsx` in this pass, so this is risk, not confirmed bug. The pattern itself is safe; the unknown is what the landing page does with arbitrary additional params Stripe might append (session_id, etc.) during redirect flows.

## Impact
If the frontend `/billing` page reflects `searchParams.get("error")` or similar into an alert banner without escaping, a crafted `/billing?error=<img%20onerror=...>` link becomes DOM XSS. Requires the frontend to be misusing the URL.

## Suggested Fix
Audit `frontend/src/app/billing/BillingPageClient.tsx` (and `error.tsx`) for any `useSearchParams()` → raw rendering. Confirm all reflected params go through React's auto-escaping (should be default with JSX but innerHTML or `dangerouslySetInnerHTML` patterns would break it). If clean, upgrade this cell to `status: clear`.
