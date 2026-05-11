# QA Run - Recovery Deploy Scope - 2026-05-11

Scope: define the safe commit/deploy boundary after resuming the interrupted `/goal` thread.

## Current Worktree Shape

Status summary:

- `48` tracked modified files.
- `412` untracked paths.

Untracked path groups:

- `.collab/tasks`: `315` paths, mostly QA evidence JSON, run ledgers, and screenshots.
- `.collab/scripts`: `94` QA harness scripts.
- `backend/tests`: `1` new targeted regression test file.
- `frontend/src`: `1` new app manifest route.
- `test_inputs/`: `1` untracked corpus directory; must not be committed.

## Product/Fix Scope

Tracked product and regression files currently modified:

- Backend fixes/tests:
  - `backend/app/api/billing.py`
  - `backend/app/api/search.py`
  - `backend/app/services/action_planner.py`
  - `backend/app/services/chat_service.py`
  - `backend/app/services/extractors/url_extractor.py`
  - `backend/app/services/retrieval_service.py`
  - `backend/tests/test_action_planner.py`
  - `backend/tests/test_billing_cancel.py`
  - `backend/tests/test_billing_state.py`
  - `backend/tests/test_chat_setup_refunds.py`
  - `backend/tests/test_error_taxonomy.py`
  - `backend/tests/test_retrieval_service_lexical.py`
  - `backend/tests/test_url_extractor.py`
- Frontend fixes:
  - `frontend/next.config.mjs`
  - `frontend/src/app/blog/[slug]/BlogPostClient.tsx`
  - `frontend/src/app/collections/[collectionId]/page.tsx`
  - `frontend/src/app/compare/notebooklm/NotebooklmClient.tsx`
  - `frontend/src/app/d/[documentId]/DocumentReaderPageClient.tsx`
  - `frontend/src/app/demo/[sample]/DemoRedirectPageClient.tsx`
  - `frontend/src/app/document-diff/page.tsx`
  - `frontend/src/app/layout.tsx`
  - `frontend/src/app/privacy/PrivacyPageClient.tsx`
  - `frontend/src/app/use-cases/consultants/ConsultantsClient.tsx`
  - `frontend/src/app/use-cases/finance/FinanceClient.tsx`
  - `frontend/src/app/use-cases/healthcare/HealthcareClient.tsx`
  - `frontend/src/components/AuthFormContent.tsx`
  - `frontend/src/components/CookieConsentBanner.tsx`
  - `frontend/src/components/PdfViewer/PageWithHighlights.tsx`
  - `frontend/src/components/PdfViewer/PdfViewer.tsx`
  - `frontend/src/components/SessionDropdown.tsx`
  - `frontend/src/components/TextViewer/TextViewer.tsx`
  - `frontend/src/lib/auth.ts`
  - `frontend/src/lib/useDocumentLoader.ts`
  - `frontend/src/lib/useUserProfile.ts`
  - `frontend/src/store/index.ts`
- i18n content:
  - `frontend/src/i18n/locales/ar.json`
  - `frontend/src/i18n/locales/de.json`
  - `frontend/src/i18n/locales/en.json`
  - `frontend/src/i18n/locales/es.json`
  - `frontend/src/i18n/locales/fr.json`
  - `frontend/src/i18n/locales/hi.json`
  - `frontend/src/i18n/locales/it.json`
  - `frontend/src/i18n/locales/ja.json`
  - `frontend/src/i18n/locales/ko.json`
  - `frontend/src/i18n/locales/pt.json`
  - `frontend/src/i18n/locales/zh.json`
- Public content/link fixes:
  - `frontend/content/blog/ai-document-security-privacy.md`
  - `frontend/content/blog/ai-financial-report-analysis.md`

Untracked files that are part of the deployable fix scope:

- `backend/tests/test_search_api.py`
- `frontend/src/app/manifest.ts`

Untracked QA harness files that are useful for continuing `/goal`:

- `.collab/scripts/qa_post_deploy_public_regression.py`
- `.collab/scripts/qa_production_public_metadata_schema.py`
- Other `.collab/scripts/qa_*` files used by the recorded QA matrix.

Untracked recovery evidence that should be kept as QA evidence but does not need to be part of the product deploy:

- `.collab/tasks/qa-run-2026-05-11-recovery-local-closure.md`
- `.collab/tasks/qa-run-2026-05-11-recovery-deploy-scope.md`
- `.collab/tasks/qa-post-deploy-public-regression-recovery-local-preview*.json`
- `.collab/tasks/qa-post-deploy-public-regression-2026-05-11-recovery-local-preview*/`
- `.collab/tasks/qa-public-mobile-pages-ux-recovery-local-prod-backend-2026-05-11.json`
- `.collab/tasks/screenshots/`

## Must Exclude

- `test_inputs/`: project instruction says this corpus is the main QA corpus and should not be committed or mutated.
- Any local screenshots or bulky browser artifacts unless intentionally preserving QA evidence.
- `frontend/tsconfig.tsbuildinfo` if it appears later; it is gitignored and should not be committed.

## Validation Evidence

Recovered local gates:

- `cd frontend && npm run build`: pass.
- `cd backend && python3 -m ruff check app/ tests/`: pass.
- Focused backend regression suite: pass, `134 passed, 10 warnings`.
- Post-deploy public local preview:
  - Full orchestrator third run: `7` required suites pass, `public_performance_smoke` pass with warnings, `public_mobile_ux` initially failed due local proxy backend binding.
  - Focused public mobile rerun after rebuilding with production backend: pass, `68/68`.

## Deployment Boundary

Recommended product deploy scope:

- Include the 48 tracked product/test/documentation files.
- Include `backend/tests/test_search_api.py`.
- Include `frontend/src/app/manifest.ts`.
- Include the two patched orchestrator/metadata QA scripts if `.collab` QA tooling is intended to stay versioned.
- Exclude `test_inputs/` and screenshots unless explicitly preserving full QA evidence.

The overall `/goal` remains open after this scope is prepared because production deploy/retest and provider-blocked suites are still incomplete.
