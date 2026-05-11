# QA Run - Recovery Local Closure - 2026-05-11

Scope: resume the interrupted `/goal` thread after token exhaustion, reconstruct the current QA state from local artifacts, and verify that the locally fixed QA batch still passes the key local gates before deployment or post-deploy regression.

## Context

The active objective is the long-running DocTalk full-product QA program recorded in:

- `.collab/tasks/2026-05-10-goal-full-product-testing.md`
- `.collab/tasks/qa-run-2026-05-11-goal-readiness-audit.md`
- `.collab/tasks/qa-goal-readiness-audit-2026-05-11.json`

The restored readiness state remains:

- Local fixed batch is ready for deploy/retest work.
- Public production regression is ready manual and still requires deployment of local frontend fixes.
- Live RAG, non-PDF live RAG, structured outputs, OAuth/email delivery, production payment, and browser-orchestrated real worker document-diff remain blocked by missing secrets, safe external accounts, production approval, or local servers.

## Local Validation

Commands run after recovery:

```bash
cd frontend && npm run build
```

Result: pass.

Notes:

- Next.js compiled successfully and generated `83/83` static pages.
- `/d/[documentId]`, `/collections/[collectionId]`, auth/proxy APIs, image routes, and shared routes remained dynamic where expected.
- Build emitted existing/expected warnings: Sentry client config deprecation, edge runtime static-generation limitation, and local `RESEND_API_KEY` absence disabling the email provider.

```bash
cd backend && python3 -m ruff check app/ tests/
```

Result: pass.

```bash
cd backend && python3 -m pytest \
  tests/test_parse_service.py \
  tests/test_url_extractor.py \
  tests/test_error_taxonomy.py \
  tests/test_billing_cancel.py \
  tests/test_billing_state.py \
  tests/test_action_planner.py \
  tests/test_retrieval_service_lexical.py \
  tests/test_chat_setup_refunds.py \
  tests/test_search_api.py \
  -q
```

Result: pass, `134 passed, 10 warnings`.

Warnings were existing dependency/framework warnings, including SWIG import deprecations, Pydantic class-based config deprecations, and urllib3 LibreSSL warning.

## Interpretation

The locally fixed QA batch is not blocked by frontend build, backend lint, or the targeted backend regression suite covering the changed backend areas:

- Stripe subscription period end fallback.
- Billing cancel state.
- URL extraction and safe URL error taxonomy.
- Search lexical fallback.
- Retrieval short-chunk fallback.
- Action planner summary/evidence-table routing.
- Chat pre-debit refund/reconcile usage paths.

This does not complete the overall `/goal`; it only closes the recovery-local verification step.

## Local Post-Deploy Regression Preview

The post-deploy public regression orchestrator was exercised against a local Next production server before production deploy.

First local preview:

```bash
python3 .collab/scripts/qa_post_deploy_public_regression.py \
  --base-url http://127.0.0.1:3000 \
  --expected-site-url http://127.0.0.1:3000 \
  --date-tag 2026-05-11-recovery-local-preview \
  --json-out .collab/tasks/qa-post-deploy-public-regression-recovery-local-preview-2026-05-11.json
```

Result: fail, `failed_required=3`.

Interpretation:

- `public_machine_entrypoints` and `public_metadata_schema` failed because local preview expected `127.0.0.1` canonical/site URLs while the app intentionally emits production `https://www.doctalk.site` SEO URLs.
- `public_mobile_ux` failed on Auth.js `UntrustedHost` session checks in the local production server.

Second local preview:

```bash
AUTH_TRUST_HOST=true npm run start -- -H 127.0.0.1 -p 3000

python3 .collab/scripts/qa_post_deploy_public_regression.py \
  --base-url http://127.0.0.1:3000 \
  --expected-site-url https://www.doctalk.site \
  --date-tag 2026-05-11-recovery-local-preview-trusted-host \
  --json-out .collab/tasks/qa-post-deploy-public-regression-recovery-local-preview-trusted-host-2026-05-11.json
```

Result: fail, `failed_required=2`.

Interpretation:

- Auth.js host-trust noise was removed.
- `public_machine_entrypoints` passed.
- `public_metadata_schema` still failed because the orchestrator did not pass `--expected-site-url` through to the metadata child script.
- `public_mobile_ux` still failed on `/demo` because the frontend proxy was built against the local backend and no local backend was listening.

Harness fix:

- `.collab/scripts/qa_production_public_metadata_schema.py` now accepts `--expected-site-url`.
- `.collab/scripts/qa_post_deploy_public_regression.py` now passes `--expected-site-url` to the metadata child suite.
- `python3 -m py_compile .collab/scripts/qa_post_deploy_public_regression.py .collab/scripts/qa_production_public_metadata_schema.py` passed.

Third local preview:

```bash
AUTH_TRUST_HOST=true NEXT_PUBLIC_API_BASE=https://backend-production-a62e.up.railway.app npm run build
AUTH_TRUST_HOST=true NEXT_PUBLIC_API_BASE=https://backend-production-a62e.up.railway.app npm run start -- -H 127.0.0.1 -p 3000

python3 .collab/scripts/qa_post_deploy_public_regression.py \
  --base-url http://127.0.0.1:3000 \
  --expected-site-url https://www.doctalk.site \
  --date-tag 2026-05-11-recovery-local-preview-prod-backend \
  --json-out .collab/tasks/qa-post-deploy-public-regression-recovery-local-preview-prod-backend-2026-05-11.json
```

Result: fail, `failed_required=1`.

Passing suites in the third preview:

- `public_html_security`: pass, `68/68`.
- `public_machine_entrypoints`: pass, `14/14`.
- `public_metadata_schema`: pass, `65/65`.
- `public_link_integrity`: pass, `0` failed internal targets and `0` hash failures.
- `public_external_links`: pass, `45/52` reachable and `7` access-limited warnings.
- `public_accessibility_semantics`: pass, `130/130`.
- `public_performance_smoke`: pass with warning, no hard failures.

The remaining failure was `public_mobile_ux` on `/demo`, still from a local proxy `502`.

Focused retest after rebuilding with production backend:

```bash
node .collab/scripts/qa_public_mobile_pages_ux.js \
  --base-url http://127.0.0.1:3000 \
  --inventory .collab/tasks/qa-route-inventory-2026-05-10.json \
  --json-out .collab/tasks/qa-public-mobile-pages-ux-recovery-local-prod-backend-2026-05-11.json \
  --screenshot-dir .collab/tasks/screenshots/2026-05-11-recovery-local-prod-backend/public-mobile
```

Result: pass, `68/68` routes.

Interpretation:

The local production preview now covers the public post-deploy regression concerns except the optional production demo-reader direct citation suite, which still needs to run against deployed production without mocked session setup.

## Next Step

Proceed in this order:

1. Prepare the intended commit/deploy scope, excluding `test_inputs/` and any local-only/generated artifacts.
2. Deploy the local frontend fixes through the normal `main` -> Vercel preview / `stable` -> production path.
3. Run the post-deploy public regression orchestrator:

```bash
python3 .collab/scripts/qa_post_deploy_public_regression.py \
  --date-tag 2026-05-11-post-deploy \
  --json-out .collab/tasks/qa-post-deploy-public-regression-2026-05-11-post-deploy.json \
  --include-demo-reader
```

4. Continue provider-blocked suites only when `DEEPSEEK_API_KEY`, OAuth/RESEND, Stripe approval, and required local services are available.
