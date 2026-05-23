# Production Public HTML Security Baseline - 2026-05-11

Scope: production sweep of all concrete non-gated public routes from the route inventory. This checks deployed HTML/status/security headers/SEO metadata for public pages without logging in or creating data.

## Environment

- Frontend: `https://www.doctalk.site`
- Route inventory: `.collab/tasks/qa-route-inventory-2026-05-10.json`
- Harness: `.collab/scripts/qa_production_public_html_security.py`

## Command

```bash
python3 .collab/scripts/qa_production_public_html_security.py \
  --base-url https://www.doctalk.site \
  --inventory .collab/tasks/qa-route-inventory-2026-05-10.json \
  --json-out .collab/tasks/qa-production-public-html-security-2026-05-11.json
```

## Result

Final result: **pass with warning**.

```json
{
  "passed": 68,
  "failed": 0,
  "warning_routes": 68,
  "csp_media_src_warning_routes": 68,
  "sensitive_marker_routes": 0,
  "missing_canonical_routes": 0,
  "missing_description_routes": 0
}
```

Evidence: `.collab/tasks/qa-production-public-html-security-2026-05-11.json`

## Coverage

For each of 68 public routes, the harness checked:

- HTTP 2xx status.
- Non-empty HTML body and title.
- Required security headers: `Content-Security-Policy`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`, and HSTS.
- Sensitive marker absence: localhost, loopback, Docker host, DB/Redis URLs, OpenRouter/DeepSeek/Auth/Adapter/Stripe secret names, and `sk_live`/`sk_test` patterns.
- Canonical URL and meta description presence for SEO public routes.

## Warning

All 68 routes still serve production CSP `media-src 'none'`, while the local branch has `media-src 'self' data:` in `frontend/next.config.mjs`. This confirms the CSP issue is production-wide deploy drift, not limited to `/pricing`, `/demo`, or `/`.

Tracking bug: `.collab/tasks/bug-2026-05-10-production-csp-media-src-none.md`.

## Notes

- The first run failed `/auth` and `/auth/error` because their server-rendered text bodies are intentionally short; Auth UI behavior is already covered by browser provider checks. The harness now applies a lower body-length threshold to auth pages while still requiring status/title/security headers/no sensitive markers.
- This is not a visual UX test; the separate production mobile sweep covers layout and console behavior.
