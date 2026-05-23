# QA Run: 2026-05-11 post-deploy public regression rerun closure

## Scope

Continue the long-running DocTalk full-product QA goal after local recovery fixes were committed and deployed to `main` and `stable`.

## Deploy state

- Commit deployed to frontend production: `97b44a8 fix(qa): close full-product regression batch`.
- `main` push succeeded.
- `stable` fast-forward merge and push succeeded.
- Railway backend deploy did not complete: `railway up --detach` failed with `Unauthorized. Please run railway login again.`
- Working branch was returned to `main` after the deploy attempt.

## Production public regression evidence

Initial post-deploy run failed because the root page was still observed with stale CSP behavior during Vercel propagation:

- `.collab/tasks/qa-post-deploy-public-regression-2026-05-11-post-deploy.json`
- Failure: `public-mobile-ux` route `/`, CSP console errors for `data:audio/mp3` under old `media-src 'none'`.

After propagation, direct response headers showed:

- `content-security-policy: ... media-src 'self' data: ...`
- `content-security-policy-report-only: ... media-src 'self' data: ...`
- Production footer showed `Beta v0.17.1 · 97b44a8fa4f0`.

Targeted reruns passed:

- `.collab/tasks/qa-production-public-html-security-post-deploy-rerun-2026-05-11.json`: `PASS: 68/68 routes, warnings=0`
- `.collab/tasks/qa-production-public-mobile-pages-ux-post-deploy-rerun-2026-05-11.json`: `PASS: 68/68 routes`

Full post-deploy orchestrator rerun passed:

- `.collab/tasks/qa-post-deploy-public-regression-2026-05-11-post-deploy-rerun.json`
- Result: `POST_DEPLOY_PUBLIC_REGRESSION PASS: 9/9 suites processed, failed_required=0 failed_optional=0`

## Readiness audit update

Updated `.collab/scripts/qa_goal_readiness_audit.py` so readiness reflects the post-deploy rerun manifest and requires a `sk_live_*` Stripe key for production payment readiness.

Latest loaded-env audit:

- `.collab/tasks/qa-goal-readiness-audit-post-deploy-rerun-loaded-env-live-stripe-check-2026-05-11.json`
- Summary: `total=10`, `complete=4`, `blocked=6`, `ready=0`, `ready_manual=0`

Complete suites:

- `surface_coverage_mapping`
- `production_contact_form_ux`
- `production_tools_ux`
- `production_post_deploy_regression`

Remaining blockers:

- `pdf_full_corpus_live_rag`: missing `DEEPSEEK_API_KEY`
- `nonpdf_live_rag`: missing `DEEPSEEK_API_KEY`
- `structured_output_live_quality`: missing `DEEPSEEK_API_KEY`
- `oauth_email_delivery`: missing `RESEND_API_KEY`, incomplete OAuth credentials, requires safe external test inbox/accounts
- `production_payment_safe_account`: requires business approval and `sk_live_*`; local `.env` only has `sk_test_*`
- `browser_real_worker_document_diff`: missing `DEEPSEEK_API_KEY`, frontend `127.0.0.1:3000` not listening, backend `127.0.0.1:8000` not listening

## Next unblock actions

1. Run `railway login` locally, then rerun backend deploy from `stable`: `railway up --detach`, then return to `main`.
2. Provide/load `DEEPSEEK_API_KEY` to execute live RAG, non-PDF RAG, structured outputs, and real worker document-diff suites.
3. Provide/load `RESEND_API_KEY` plus complete Google/Microsoft OAuth credentials and safe test inboxes for real auth/email delivery.
4. Provide explicit approval and `sk_live_*` production Stripe context before authenticated production payment or refund-review operations.
5. Start local frontend/backend when running browser-orchestrated real worker flows.
