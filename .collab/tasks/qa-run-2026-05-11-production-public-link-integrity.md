# Production Public Link Integrity - 2026-05-11

Scope: production audit for rendered internal links and fragment anchors across public content pages.

This complements the route inventory and public HTML sweep. Those checks prove known routes render; this run proves the links that users actually see in nav, footer, article TOCs, CTAs, and content point to reachable internal targets and valid hash anchors.

## Environment

- Production frontend: `https://www.doctalk.site`
- Inventory: `.collab/tasks/qa-route-inventory-2026-05-10.json`
- Harness: `.collab/scripts/qa_production_public_link_integrity.py`

## Production Command

```bash
python3 .collab/scripts/qa_production_public_link_integrity.py \
  --json-out .collab/tasks/qa-production-public-link-integrity-2026-05-11.json
```

## Production Result

Final result: **fail**, fixed locally and pending deploy/retest.

```json
{
  "source_routes": 65,
  "source_pages_loaded": 65,
  "source_anchor_links": 4101,
  "unique_internal_targets": 70,
  "failed_internal_targets": 2,
  "external_links_observed": 148,
  "skipped_links": 4,
  "hash_refs": 1162,
  "hash_failures": 74
}
```

Evidence: `.collab/tasks/qa-production-public-link-integrity-2026-05-11.json`

## Findings

1. Blog TOC hash mismatch on `/blog/best-ai-pdf-tools-2026`

   The article's TOC generated fragments from raw Markdown link syntax, for example:

   - `#2-chatpdfhttpschatpdfcom-simplest-pdf-chat`
   - `#3-askyourpdfhttpsaskyourpdfcom-best-for-researchers`
   - `#4-notebooklmhttpsnotebooklmgooglecom-best-free-option`

   The rendered heading ids use the visible link text instead:

   - `#2-chatpdf-simplest-pdf-chat`
   - `#3-askyourpdf-best-for-researchers`
   - `#4-notebooklm-best-free-option`

   Impact: affected TOC links do not scroll users to the intended section.

2. Footer `/privacy#ccpa` target missing

   The footer links to `/privacy#ccpa` from 64 source pages, but production `/privacy` contains only `page-content` and `main-content` ids. The target route returns 200, but the intended section anchor is absent.

   Impact: "Do Not Sell" footer links open the privacy page without landing on a relevant section.

Bug record: `.collab/tasks/bug-2026-05-11-production-public-broken-fragment-links.md`

## Local Fix

Patched frontend:

- `frontend/src/app/blog/[slug]/BlogPostClient.tsx`
  - TOC extraction now normalizes Markdown headings by replacing Markdown links with their visible text before slug generation.
  - Heading id extraction uses the same normalization, keeping TOC hrefs and rendered heading ids aligned.
- `frontend/src/app/privacy/PrivacyPageClient.tsx`
  - Added a `section id="ccpa"` with California privacy / do-not-sell copy.
- `frontend/src/i18n/locales/{en,zh,ja,ko,es,de,fr,pt,it,ar,hi}.json`
  - Added `privacy.ccpa.title` and `privacy.ccpa.content` to all 11 locales.

Validation:

- `cd frontend && npm run build` passed.
- Local Next production-server retest:

  ```bash
  python3 .collab/scripts/qa_production_public_link_integrity.py \
    --base-url http://127.0.0.1:3000 \
    --json-out .collab/tasks/qa-local-public-link-integrity-after-anchor-fixes-2026-05-11.json
  ```

  Result: **pass**.

  ```json
  {
    "source_routes": 65,
    "source_pages_loaded": 65,
    "source_anchor_links": 4101,
    "unique_internal_targets": 70,
    "failed_internal_targets": 0,
    "external_links_observed": 148,
    "skipped_links": 4,
    "hash_refs": 1162,
    "hash_failures": 0
  }
  ```

Production remains open until the frontend is deployed and this harness passes against `https://www.doctalk.site`.
