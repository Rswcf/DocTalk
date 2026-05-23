# BUG - Blog Heading IDs Hydrated Differently - 2026-05-10

## Summary

The public mobile browser sweep found React hydration warnings on blog article pages. Server-rendered markdown headings used IDs like `why-traditional-contract-review-is-so-slow`, while the hydrated client sometimes generated `why-traditional-contract-review-is-so-slow-2`.

## Impact

- Dev console emitted React prop mismatch warnings on blog article routes.
- Table-of-contents anchor links could point to IDs that differ between SSR and hydrated client markup.
- The issue affected SEO/content pages rather than the authenticated reader, but it weakens UI reliability and anchor navigation.

## Root Cause

`BlogPostClient` generated heading IDs with a mutable `Map` during render. ReactMarkdown can invoke heading renderers differently between SSR and client hydration, so the mutable counter could advance inconsistently.

## Fix

Heading IDs are now precomputed from the markdown source offsets and looked up by each heading node position. The fallback remains deterministic when a node offset is unavailable.

Changed file:

- `frontend/src/app/blog/[slug]/BlogPostClient.tsx`

## Verification

Mobile public page sweep after the fix:

```bash
node .collab/scripts/qa_public_mobile_pages_ux.js \
  --base-url http://localhost:3000 \
  --inventory .collab/tasks/qa-route-inventory-2026-05-10.json \
  --json-out .collab/tasks/qa-public-mobile-pages-ux-after-blog-fix-2026-05-10.json \
  --screenshot-dir .collab/tasks/screenshots/2026-05-10/public-mobile-after-blog-fix
```

Result: `PUBLIC_MOBILE_UX PASS: 68/68 routes`.

