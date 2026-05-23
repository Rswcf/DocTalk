# QA Run - Production Current Public Regression - 2026-05-11

Scope: run the public post-deploy regression orchestrator against the current production site before the local frontend fixes are deployed. This is a real production baseline, not a dry run.

## Environment

| Item | Value |
|---|---|
| Base URL | `https://www.doctalk.site` |
| Backend URL | `https://backend-production-a62e.up.railway.app` |
| Orchestrator | `.collab/scripts/qa_post_deploy_public_regression.py` |
| Manifest | `.collab/tasks/qa-post-deploy-public-regression-production-current-2026-05-11.json` |
| Child artifacts | `.collab/tasks/qa-post-deploy-public-regression-2026-05-11-production-current/` |
| Demo reader optional suite | Not included in this orchestrator run; executed separately in `.collab/tasks/qa-run-2026-05-11-production-current-demo-reader-ux.md` |

## Command

```bash
python3 .collab/scripts/qa_post_deploy_public_regression.py \
  --date-tag 2026-05-11-production-current \
  --json-out .collab/tasks/qa-post-deploy-public-regression-production-current-2026-05-11.json
```

## Result

Overall: **fail**.

```json
{
  "selected_suites": 8,
  "completed_suites": 8,
  "failed_required": 3,
  "failed_optional": 0,
  "not_run": 0
}
```

## Suite Summary

| Suite | Result | Notes |
|---|---|---|
| `public_html_security` | `pass_with_warning` | `68/68` routes passed hard checks; all 68 still warn on deployed `media-src 'none'` CSP |
| `public_mobile_ux` | `fail` | `67/68` routes passed; `/` fails due CSP media console errors |
| `public_performance_smoke` | `pass_with_warning` | `136/136` checks passed; 2 warning checks from home-page CSP console errors |
| `public_machine_entrypoints` | `pass_with_warning` | `14/14` passed; root HTML still missing Apple touch icon and web manifest links |
| `public_metadata_schema` | `pass` | `65/65` routes passed metadata/schema checks |
| `public_link_integrity` | `fail` | 2 failed internal targets and 74 hash failures, matching known stale production fragment-link drift |
| `public_external_links` | `fail` | 2 failed external targets, matching known stale OWASP and Google NotebookLM links |
| `public_accessibility_semantics` | `pass` | `130/130` checks passed hard gates; advisory data still shows healthcare heading-order drift and home-page CSP console errors |

## Concrete Failures

### Mobile UX

Failing route:

- `/`

Cause:

- Production CSP still serves `media-src 'none'`, blocking data-audio media from the landing page.
- This matches `BUG-2026-05-10-PRODUCTION-CSP-MEDIA-SRC-NONE`.

### Link Integrity

Failed internal targets:

- `/blog/best-ai-pdf-tools-2026`: broken table-of-contents fragments for headings that include Markdown links, such as `#2-chatpdfhttpschatpdfcom-simplest-pdf-chat`.
- `/privacy`: footer links to `/privacy#ccpa` fail because production still lacks the `ccpa` anchor.

These are already fixed locally and verified locally, but not deployed.

### External Links

Failed targets:

- `https://owasp.org/www-community/attacks/Server-Side_Request_Forgery`
- `https://blog.google/technology/ai/notebooklm/`

These are already replaced locally and verified locally, but not deployed.

### Warnings Still Present

- Root HTML lacks Apple touch icon and web manifest metadata in production.
- `/use-cases/healthcare` still has an `h1 -> h3` heading-order advisory in production.
- Home page desktop/mobile still emits CSP console errors.

All three are already fixed locally and need deployment/retest.

## Interpretation

This run confirms current production is still behind the locally fixed state. It does not add a new local bug; it provides a consolidated production baseline showing which deployed issues should close after the next frontend deploy and post-deploy rerun.
