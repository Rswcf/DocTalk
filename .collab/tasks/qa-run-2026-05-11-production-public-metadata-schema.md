# Production Public Metadata Schema - 2026-05-11

Scope: non-destructive production audit for public content-page SEO metadata, social share cards, and JSON-LD schema served by `https://www.doctalk.site`.

This complements the earlier public HTML/security sweep. That sweep verified status, title/body, canonical presence, meta description, security headers, and sensitive-marker absence. This run verifies that public pages expose internally consistent canonical/OG/Twitter metadata and parseable schema.org JSON-LD with route-appropriate schema types.

## Environment

- Frontend: `https://www.doctalk.site`
- Inventory: `.collab/tasks/qa-route-inventory-2026-05-10.json`
- Harness: `.collab/scripts/qa_production_public_metadata_schema.py`

## Command

```bash
python3 .collab/scripts/qa_production_public_metadata_schema.py \
  --json-out .collab/tasks/qa-production-public-metadata-schema-2026-05-11.json
```

## Result

Final result: **pass**.

```json
{
  "total": 65,
  "passed": 65,
  "failed": 0,
  "warning_routes": 0,
  "json_ld_scripts": 154,
  "routes_with_article_schema": 38,
  "routes_with_faq_schema": 26,
  "routes_with_software_schema": 9
}
```

Evidence: `.collab/tasks/qa-production-public-metadata-schema-2026-05-11.json`

## Coverage

Routes:

- Covered 65 public content routes from the route inventory.
- Excluded auth pages and concrete `/demo/[sample]` redirect/detail aliases from this SEO schema assertion set.

Per-route metadata checks:

- HTML status is 2xx and `text/html`.
- `<title>` and meta description are present.
- Canonical URL exactly matches `https://www.doctalk.site{route}`.
- `og:title`, `og:description`, `og:url`, `og:site_name`, and HTTPS DocTalk `og:image` are present and consistent.
- Twitter card is `summary_large_image` with title, description, and HTTPS DocTalk image.
- No sensitive markers were present for localhost/loopback, Docker host, DB/Redis URLs, provider key names, Auth/Adapter/Stripe secret names, Stripe secret patterns, private keys, or stack traces.

JSON-LD checks:

- All `154` JSON-LD scripts parsed successfully.
- Every checked route had JSON-LD.
- Schema URLs were HTTPS and did not point to localhost/loopback/Docker host.
- Required schema types were present by route class:
  - Home: `WebSite`, `Organization`, `SoftwareApplication`, `FAQPage`, `HowTo`
  - Blog posts: `Article`, `BreadcrumbList`
  - Blog categories: `CollectionPage`, `BreadcrumbList`
  - Comparison / alternative / use-case detail pages: `Article`, `BreadcrumbList`
  - Pricing: `SoftwareApplication`, `FAQPage`, `BreadcrumbList`
  - Feature/tool detail pages: `SoftwareApplication`, `BreadcrumbList`
  - Legal/trust/index pages: `BreadcrumbList`

## Notes

- The first harness run was intentionally strict and failed because it treated `https://schema.org` and legitimate HTTPS competitor/reference URLs inside comparison `ItemList` schema as disallowed URLs. The script was corrected to fail only non-HTTPS and local/private hosts, while still checking for sensitive-marker leakage.
- The script also learned to recursively collect nested schema nodes such as `AboutPage.mainEntity.Organization` and `ContactPage.mainEntity.Organization`.
