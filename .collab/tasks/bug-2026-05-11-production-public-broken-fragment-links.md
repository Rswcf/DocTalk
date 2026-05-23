# BUG-2026-05-11-PRODUCTION-PUBLIC-BROKEN-FRAGMENT-LINKS

Status: **fixed locally, production deploy/retest pending**.

## Summary

Production public pages have two broken fragment-link patterns:

1. `/blog/best-ai-pdf-tools-2026` TOC links for headings containing Markdown links point to ids that do not exist.
2. The footer's `/privacy#ccpa` link appears across public pages, but `/privacy` has no `ccpa` anchor.

The destination pages return `200`, so route-level checks did not catch this. The failure affects in-page navigation and footer privacy UX.

## Environment

- Frontend: `https://www.doctalk.site`
- Harness: `.collab/scripts/qa_production_public_link_integrity.py`
- Evidence: `.collab/tasks/qa-production-public-link-integrity-2026-05-11.json`

## Production Evidence

```json
{
  "source_routes": 65,
  "source_anchor_links": 4101,
  "unique_internal_targets": 70,
  "failed_internal_targets": 2,
  "hash_refs": 1162,
  "hash_failures": 74
}
```

Failed targets:

- `https://www.doctalk.site/blog/best-ai-pdf-tools-2026`
  - `10` hash failures.
  - Example bad fragment: `#2-chatpdfhttpschatpdfcom-simplest-pdf-chat`
  - Actual rendered id: `#2-chatpdf-simplest-pdf-chat`
- `https://www.doctalk.site/privacy`
  - `64` hash failures.
  - Every failure is a source page linking to `/privacy#ccpa`.
  - Production privacy page has no `ccpa` id.

## Root Cause

Blog TOC:

- `extractToc()` generated ids from the raw Markdown heading string.
- For headings like `### 2. [ChatPDF](https://chatpdf.com) — Simplest PDF Chat`, the raw string includes the URL.
- The rendered heading id is generated from ReactMarkdown children, where the link contributes only visible text.

Privacy anchor:

- Footer includes `/privacy#ccpa`.
- `PrivacyPageClient` had no CCPA / Do Not Sell section or anchor.

## Local Fix - 2026-05-11

Patched frontend:

- `frontend/src/app/blog/[slug]/BlogPostClient.tsx`
  - Added Markdown heading text normalization for TOC/id extraction.
  - Markdown links now contribute only their visible label.
- `frontend/src/app/privacy/PrivacyPageClient.tsx`
  - Added `section id="ccpa"` with scroll margin.
- `frontend/src/i18n/locales/{en,zh,ja,ko,es,de,fr,pt,it,ar,hi}.json`
  - Added localized `privacy.ccpa.title` and `privacy.ccpa.content`.

Validation:

- `cd frontend && npm run build` passed.
- Local production-server link-integrity retest passed:
  - JSON: `.collab/tasks/qa-local-public-link-integrity-after-anchor-fixes-2026-05-11.json`
  - `70/70` internal targets passed.
  - `1162` hash refs checked.
  - `0` hash failures.

## Remaining Work

Deploy the frontend, then rerun:

```bash
python3 .collab/scripts/qa_production_public_link_integrity.py \
  --json-out .collab/tasks/qa-production-public-link-integrity-after-anchor-fixes-2026-05-11.json
```

Close this bug when production has `0` failed internal targets and `0` hash failures.
