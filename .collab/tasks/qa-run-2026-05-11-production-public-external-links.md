# QA Run - Production Public External Links - 2026-05-11

## Scope

External-link health audit for rendered public DocTalk pages.

- Base URL: `https://www.doctalk.site`
- Inventory: `.collab/tasks/qa-route-inventory-2026-05-10.json`
- Harness: `.collab/scripts/qa_production_public_external_links.py`
- Production evidence: `.collab/tasks/qa-production-public-external-links-2026-05-11.json`
- Local fix evidence: `.collab/tasks/qa-local-public-external-links-after-broken-link-fixes-2026-05-11.json`
- Route scope: public, non-gated, non-auth, non-dynamic concrete routes

## Command

```bash
python3 -m py_compile .collab/scripts/qa_production_public_external_links.py
python3 .collab/scripts/qa_production_public_external_links.py \
  --json-out .collab/tasks/qa-production-public-external-links-2026-05-11.json \
  --timeout 15
```

The harness parses public page anchors, resolves external `http`/`https` links, deduplicates by canonical target without fragments, and checks each unique external target. `2xx`/`3xx` statuses pass. Clear `404`/`410`/`5xx` responses fail. Access-limited, paywalled, rate-limited, and network/TLS errors are warnings to avoid treating external anti-bot or transient behavior as product content defects.

## Production Result

Final production result: **fail**, fixed locally and pending deploy/retest.

- Public source routes loaded: `65`
- Rendered source anchor links parsed: `4101`
- External refs observed: `148`
- Unique external targets observed/checked: `52`
- Reachable targets: `40`
- Warning targets: `10`
- Failed targets: `2`
- Skipped non-HTTP links: `4`

Failed targets:

- `https://owasp.org/www-community/attacks/Server-Side_Request_Forgery` returned `404` from `/blog/ai-document-security-privacy`.
- `https://blog.google/technology/ai/notebooklm/` returned `404` from `/compare/notebooklm`.

Warning targets:

- `403` / access-limited: American Bar Association resources, OpenAI enterprise privacy, Consensus, Elicit, Claude.
- `402` / paywall-like response: Investopedia financial statement and annual report pages.
- Network/TLS warning: McKinsey Digital insights URL.

## Local Fix

Updated stale external URLs:

- `frontend/content/blog/ai-document-security-privacy.md`
  - OWASP SSRF link changed to `https://owasp.org/www-community/attacks/Server_Side_Request_Forgery`.
- `frontend/src/app/compare/notebooklm/NotebooklmClient.tsx`
  - Google NotebookLM article link changed to `https://blog.google/technology/ai/notebooklm-google-ai/`.

Both replacement targets returned `200` during direct verification.

Validation:

- `cd frontend && npm run build` passed.
- Local production-server external-link retest passed with `failed=0`.

Local retest result:

- Public source routes loaded: `65`
- Rendered source anchor links parsed: `4101`
- External refs observed: `148`
- Unique external targets observed/checked: `52`
- Reachable targets: `42`
- Warning targets: `10`
- Failed targets: `0`
- Skipped non-HTTP links: `4`

## Local Warning Reduction

Reviewed the `10` non-failing warning targets and replaced the ones that were clear UX risks or unstable references:

- `frontend/content/blog/ai-financial-report-analysis.md`
  - Replaced the Investopedia financial-statement-analysis link that returned `402` with the SEC's public `Beginner's Guide to Financial Statements`.
- `frontend/src/app/use-cases/finance/FinanceClient.tsx`
  - Replaced the Investopedia annual-report link that returned `402` with the SEC's public `How to Read a 10-K`.
- `frontend/src/app/use-cases/consultants/ConsultantsClient.tsx`
  - Replaced the unstable McKinsey Digital Insights link with Thomson Reuters' `2026 AI in Professional Services Report` PDF.

Validation:

- `cd frontend && npm run build` passed.
- Local production-server retest after warning-link fixes passed with `failed=0` and warnings reduced from `10` to `7`.
- Evidence: `.collab/tasks/qa-local-public-external-links-after-warning-link-fixes-2026-05-11.json`

Remaining warning targets are all `403` access-limited responses from third-party product or organizational pages:

- American Bar Association legal resources pages.
- OpenAI Enterprise Privacy.
- Consensus, Elicit, and Claude product home pages.

These are retained because the machine `403` response is likely bot/access-control behavior and the links point to the intended product or organization destination.

## Raw Output

```text
Production:
PRODUCTION_PUBLIC_EXTERNAL_LINKS FAIL: 40/52 external targets reachable, warnings=10 failed=2

Local after broken-link fixes:
PRODUCTION_PUBLIC_EXTERNAL_LINKS PASS: 42/52 external targets reachable, warnings=10 failed=0

Local after warning-link fixes:
PRODUCTION_PUBLIC_EXTERNAL_LINKS PASS: 45/52 external targets reachable, warnings=7 failed=0
```

## Remaining Production Gap

Deploy the frontend and rerun the production external-link audit. The remaining warning targets should be monitored but are not clear content defects unless they become user-visible broken destinations in a real browser session.
