# DocTalk Full Product QA Goal Closure

Date: 2026-05-11

## Scope decision

The following suites were explicitly waived by the user for this closure:

- Stripe production payment safe-account testing
- Real OAuth/login email delivery page testing

DeepSeek live quality testing was enabled with a user-provided key for process runtime only. The key was not written to this report.

## Final readiness result

Final readiness artifact:

- `.collab/tasks/qa-goal-readiness-audit-final-scope-waived-2026-05-11.json`

Result:

- `complete=true`
- `complete=8`
- `skipped=2`
- `ready=0`
- `ready_manual=0`
- `blocked=0`

Completed suites:

- `surface_coverage_mapping`
- `production_contact_form_ux`
- `production_tools_ux`
- `pdf_full_corpus_live_rag`
- `nonpdf_live_rag`
- `structured_output_live_quality`
- `production_post_deploy_regression`
- `browser_real_worker_document_diff`

Skipped suites:

- `oauth_email_delivery`
- `production_payment_safe_account`

## Evidence summary

Public production regression passed after frontend propagation:

- `.collab/tasks/qa-post-deploy-public-regression-2026-05-11-post-deploy-rerun.json`
- Required failures: 0
- Optional failures: 0

PDF live RAG full corpus passed by shard plus focused retries:

- Shards 0 through 9 completed.
- Shard 0 transient timeout was closed by focused rerun.
- Shard 2 planner misroute was closed by local planner fix and focused rerun.
- Shard 8 large-file free-plan blocker was closed by QA identity Pro upgrade and focused rerun.

Non-PDF live RAG passed:

- `.collab/tasks/qa-live-rag-nonpdf-deepseek-after-negative-terms-fix-2026-05-11.json`
- `.collab/tasks/qa-live-rag-nonpdf-txt-negative-rerun-deepseek-2026-05-11.json`

Structured output live quality passed:

- `.collab/tasks/qa-live-structured-outputs-deepseek-2026-05-11.json`

Real worker document-diff browser UX passed:

- `.collab/tasks/qa-browser-document-diff-real-worker-fixture-2026-05-11.json`
- `.collab/tasks/qa-browser-document-diff-real-worker-ux-2026-05-11.json`
- `.collab/tasks/qa-browser-document-diff-real-worker-cleanup-2026-05-11.json`

## Product fixes applied locally after the previous deploy commit

Local script/harness fixes:

- `.collab/scripts/qa_goal_readiness_audit.py`
- `.collab/scripts/qa_live_chat_rag_matrix.py`
- `.collab/scripts/qa_live_rag_multi_prompt_matrix.py`
- `.collab/scripts/qa_live_rag_nonpdf_matrix.py`
- `.collab/scripts/qa_browser_document_diff_result_fixture.py`
- `.collab/scripts/qa_browser_document_diff_result_ux.js`

Local product fix:

- `backend/app/services/action_planner.py`

The planner fix prevents explicit direct-chat requests such as "answer directly" / "directly in chat" / "do not start a separate job" / "直接在聊天" / "不要启动" from being routed into deliverable extraction jobs.

## Deployment resolution

Railway backend deploy is complete:

- Git commit: `15f74cf fix(backend): respect direct chat RAG intent`
- Branches pushed: `main`, `stable`
- Railway deployment: `17f5a101-599f-4201-89cf-41378122bb91`
- Railway status: `SUCCESS`
- Image digest: `sha256:4ed8b05b80c265f3b7b47f9f4ad68cdac7cb6f69380b562f411a9c6b1818b17f`

Deployment packaging note:

- The first root `railway up --detach` attempt failed with `413 Payload Too Large` because the local workspace contains large untracked QA artifacts.
- The successful deployment used a clean `stable` archive and `railway up --detach --path-as-root <archive-dir>` so only versioned project files were uploaded.

## Residual risk to track separately

During live RAG cleanup, background document-brief Celery tasks occasionally attempted to refresh or write brief data for QA documents already deleted by cleanup. This produced non-blocking deleted-object or foreign-key errors. It did not fail the completed RAG suites, but it is a real cleanup race worth tracking as a worker robustness issue.
