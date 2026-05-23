# QA Run - Post-Deploy Public Regression Orchestrator - 2026-05-11

## Scope

Added a post-deploy orchestrator for DocTalk public production regression sweeps. This closes a process gap: several public-page fixes are already validated locally but need a consistent production retest after frontend deploy.

- Orchestrator: `.collab/scripts/qa_post_deploy_public_regression.py`
- Dry-run evidence: `.collab/tasks/qa-post-deploy-public-regression-dry-run-performance-2026-05-11.json`
- Default production base URL: `https://www.doctalk.site`
- Default backend for optional demo reader UX: `https://backend-production-a62e.up.railway.app`
- Inventory: `.collab/tasks/qa-route-inventory-2026-05-10.json`

## Covered Suites

Default required suites:

- `public_html_security`
- `public_mobile_ux`
- `public_performance_smoke`
- `public_machine_entrypoints`
- `public_metadata_schema`
- `public_link_integrity`
- `public_external_links`
- `public_accessibility_semantics`

Optional suite:

- `production_demo_reader_ux`, enabled with `--include-demo-reader`

## Commands

Dry-run validation:

```bash
python3 -m py_compile .collab/scripts/qa_post_deploy_public_regression.py
python3 .collab/scripts/qa_post_deploy_public_regression.py \
  --dry-run \
  --date-tag 2026-05-11-dry-run-performance \
  --json-out .collab/tasks/qa-post-deploy-public-regression-dry-run-performance-2026-05-11.json \
  --include-demo-reader
```

Production post-deploy command:

```bash
python3 .collab/scripts/qa_post_deploy_public_regression.py \
  --date-tag 2026-05-11-post-deploy \
  --json-out .collab/tasks/qa-post-deploy-public-regression-2026-05-11-post-deploy.json \
  --include-demo-reader
```

Local/preview command example:

```bash
python3 .collab/scripts/qa_post_deploy_public_regression.py \
  --base-url http://127.0.0.1:3000 \
  --expected-site-url http://127.0.0.1:3000 \
  --date-tag 2026-05-11-local-preview \
  --json-out .collab/tasks/qa-post-deploy-public-regression-local-preview-2026-05-11.json
```

## Dry-Run Result

Dry-run result: **pass**.

```json
{
  "selected_suites": 9,
  "completed_suites": 9,
  "failed_required": 0,
  "failed_optional": 0,
  "not_run": 0
}
```

The dry-run verified command generation and artifact paths for all selected suites without hitting production.

## Deployment Retest Use

After the frontend deploy that includes the local fixes, this orchestrator should verify:

- CSP `media-src 'self' data:` has reached production.
- Root HTML advertises Apple touch icon and web manifest links.
- Blog TOC and `/privacy#ccpa` fragment links pass in production.
- External links have no clear failed targets.
- Public page performance/reliability smoke has no hard failures or new budget warnings.
- `/use-cases/healthcare` heading-order advisory is gone in production.
- Optional production demo reader UX confirms mobile direct citation highlight visibility.

The orchestrator continues after failures by default, so one failing suite does not prevent collecting evidence from the rest of the public regression set.
