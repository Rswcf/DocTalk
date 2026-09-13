# DocTalk RetainPDF image

The pinned upstream Paddle policy excludes ordinary `footnote` blocks from
translation, including substantive legal footnotes. DocTalk's image changes
only that allow-list entry in both the source copy and the installed Python package used by the entry point. The build imports the installed module to verify the actual runtime policy. Headers, footers, references, and non-text blocks
keep their upstream policies. Building fails if the expected upstream line is
missing or ambiguous.

```sh
docker build -t doctalk-retainpdf:footnotes-20260913 infra/retainpdf
```

This image is a local QA candidate, not a production deployment. Preserve the
existing sidecar authentication, private network placement, volume, resource
limits and backend-first release ordering when it is eventually reviewed and
released. See `docs/layout-translation-retainpdf.md` for the runtime contract.

Validation source: the existing public six-page
`USCOURTS-flnd-1_22-cv-00226-0.pdf`; page 5 contains a substantive footnote whose
upstream normalized policy was `provider_non_body:footnote` and which was absent
from translation inputs. Preserve the original and previous translation as
comparison evidence. Success requires actual translated footnote content in the
rendered PDF, retained numbering/page count and no overlap with the body.

2026-09-13 actual-PDF retest: job `c8145a3a-f529-4bda-a18c-5e2b528c72be` translated the page-5 footnote, preserved six pages, and showed no footnote/body overlap in the browser preview. A source-only first candidate failed because the entry point imported the installed wheel. Terminology remains review-required: page 3 still used a literal bias translation despite a scoped glossary; this is not a claim of complete translation accuracy.


Final local retest `74b10882-964f-41c0-948b-88dbf59fc71b` corrected the page-3 terminology and retained the translated page-5 footnote and six-page layout. The two Simplified Chinese dismissal entries remain context-restricted; `glossary_mode=all` keeps them available across joined paragraphs, and explicit translation rules are derived from the same entries. This also distinguishes the semantic request from older upstream unit-cache entries (mode alone is not in the unit-cache key). The prior failed mode-only job is preserved. No cache was purged and no further upstream pipeline patch was added. See the real PDF QA report for screenshots, failed intermediate runs and limits; review and production rollout are separate gates.


2026-09-13 independent review follow-up (local, not deployed):
`RETAINPDF_CONTEXTUAL_GLOSSARY_ENABLED` defaults to `false`. Enable it only after
confirming the installed sidecar's contextual matching contract. The pinned
Dockerfile now executes `verify_contract.py` against the actual installed wheel:
both court-dismissal terms are protected, qualifications remain, and unrelated
settlement-letter text is not hard-replaced. The local contract image
`doctalk-retainpdf:reviewed-contract-20260913` built successfully (manifest
`e8959e78d300b98b3fe9868827af68029e2fd82484dd6ef1e5d951268c81c24b`).
The earlier six-page visual regression ran on the equivalent footnote-policy image;
this added build step validates compatibility and does not change OCR/translation
code. Production image/configuration and end-to-end output remain unverified.
