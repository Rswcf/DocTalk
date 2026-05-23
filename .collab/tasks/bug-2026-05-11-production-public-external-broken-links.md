# BUG-2026-05-11-PRODUCTION-PUBLIC-EXTERNAL-BROKEN-LINKS

## Summary

Production public pages contained two stale external links returning `404`.

## Severity

Low to Medium. The core app is unaffected, but broken outbound references hurt public-page trust, SEO quality, and reader UX.

## Environment

- Production frontend: `https://www.doctalk.site`
- Date: 2026-05-11
- Harness: `.collab/scripts/qa_production_public_external_links.py`
- Evidence: `.collab/tasks/qa-production-public-external-links-2026-05-11.json`

## Reproduction

```bash
python3 .collab/scripts/qa_production_public_external_links.py \
  --json-out .collab/tasks/qa-production-public-external-links-2026-05-11.json \
  --timeout 15
```

Production output:

```text
PRODUCTION_PUBLIC_EXTERNAL_LINKS FAIL: 40/52 external targets reachable, warnings=10 failed=2
FAIL https://owasp.org/www-community/attacks/Server-Side_Request_Forgery: status=404 reason=not_found_or_gone
FAIL https://blog.google/technology/ai/notebooklm/: status=404 reason=not_found_or_gone
```

## Affected Pages

- `/blog/ai-document-security-privacy`
  - Broken URL: `https://owasp.org/www-community/attacks/Server-Side_Request_Forgery`
- `/compare/notebooklm`
  - Broken URL: `https://blog.google/technology/ai/notebooklm/`

## Fix

- `frontend/content/blog/ai-document-security-privacy.md`
  - Replaced the OWASP SSRF URL with `https://owasp.org/www-community/attacks/Server_Side_Request_Forgery`.
- `frontend/src/app/compare/notebooklm/NotebooklmClient.tsx`
  - Replaced the Google NotebookLM URL with `https://blog.google/technology/ai/notebooklm-google-ai/`.

## Retest

Local production-server retest passed:

```text
PRODUCTION_PUBLIC_EXTERNAL_LINKS PASS: 42/52 external targets reachable, warnings=10 failed=0
```

Evidence: `.collab/tasks/qa-local-public-external-links-after-broken-link-fixes-2026-05-11.json`

Follow-up warning reduction also passed after replacing paywalled/unstable warning links with SEC and Thomson Reuters targets:

```text
PRODUCTION_PUBLIC_EXTERNAL_LINKS PASS: 45/52 external targets reachable, warnings=7 failed=0
```

Evidence: `.collab/tasks/qa-local-public-external-links-after-warning-link-fixes-2026-05-11.json`

## Remaining Work

Deploy frontend and rerun the production external-link audit to close the live production issue.
