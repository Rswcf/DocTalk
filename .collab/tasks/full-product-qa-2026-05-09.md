# Full Product QA - 2026-05-09

Scope: DocTalk full-product QA across public SEO pages, authenticated/product flows, upload/parse/chat/RAG, sharing, billing/auth, security boundaries, and mobile responsiveness.

Rules followed:
- No new product features.
- Fix only clear bugs, blocking regressions, and production risks.
- Every finding includes repro steps, expected/actual, severity, impact, evidence, root cause, fix, and retest.
- UI checks used the browser for desktop and mobile.
- `test_inputs/` remained untracked and was not staged.

## Environment Baseline

| Item | Result |
|---|---|
| Workspace | `/Users/mayijie/Projects/Code/010_DocTalk` |
| Date | 2026-05-09 |
| Branch | `main` |
| Baseline commit | `d4983c2` |
| Initial git status | `## main...origin/main`; untracked `test_inputs/` only |
| Frontend version | `0.17.1` |
| Test corpus | `test_inputs/`, 51 supported files, 207M |
| Local secrets | `OPENROUTER_API_KEY`, auth, storage, Redis, Postgres present; `DEEPSEEK_API_KEY` absent; frontend `RESEND_API_KEY` absent |

## Baseline Commands

| Command | Initial Result | Final Result |
|---|---|---|
| `python3 scripts/check_version_consistency.py` | Pass: `OK 0.17.1 beta` | Pass: `OK 0.17.1 beta` |
| `cd frontend && npm run lint` | Pass | Pass: no ESLint warnings/errors; critical i18n checks passed |
| `cd frontend && npm run build` | Pass | Pass: production build completed; public SEO routes remained static/SSG |
| `cd backend && python3 -m ruff check app/ tests/` | Pass | Pass |
| `cd backend && python3 -m pytest tests/test_parse_service.py -v` | Pass: 14 passed | Pass: 14 passed |
| `cd backend && python3 -m pytest tests/test_collections_api.py -v` | N/A | Pass: 1 passed |
| `cd backend && python3 -m pytest tests/test_chat_tool_executor.py -v` | N/A | Pass: 3 passed |

## Local Services

| Service | Status | Notes |
|---|---|---|
| Docker infra | Running | Postgres/Qdrant/MinIO/Redis healthy via `docker compose ps` |
| Backend | Running | `http://127.0.0.1:8000/health` and `/version` OK |
| Celery | Running | `default,parse`; parse and table scan jobs processed |
| Frontend | Running | `http://localhost:3000/` HTTP 200 |

## Page Coverage

HTTP/metadata sweep:
- 76 routes fetched.
- Bad HTTP status: none.
- Missing title/description/canonical: none.
- Special endpoints: `/robots.txt`, `/sitemap.xml`, `/opengraph-image`, `/twitter-image` returned 200 with expected content types.
- Build route output: public SEO pages are static/SSG; dynamic routes limited to APIs and expected app/document/shared routes.

Browser desktop + mobile coverage:
- Public pages: `/`, `/demo`, `/pricing`, `/features`, `/features/citations`, `/features/free-demo`, `/features/multi-format`, `/features/multilingual`, `/features/performance-modes`.
- Use cases: `/use-cases`, `/use-cases/lawyers`, `/use-cases/finance`, `/use-cases/students`, `/use-cases/teachers`, `/use-cases/consultants`, `/use-cases/hr-contracts`, `/use-cases/compliance`, `/use-cases/healthcare`, `/use-cases/real-estate`.
- Compare/alternatives: `/compare`, all requested compare slugs, `/alternatives`, all requested alternative slugs.
- Tools/content/legal: `/tools`, `/tools/word-counter`, `/tools/reading-time`, `/blog`, all 19 blog slugs, all 5 blog categories, `/about`, `/contact`, `/trust`, `/privacy`, `/terms`, `/imprint`.
- Auth/product gated: `/auth`, `/auth/error`, `/auth/verify-request`, `/profile`, `/billing`, `/collections`, `/document-diff`.

Blog slugs tested:
`ai-contract-review-guide`, `ai-document-analysis-languages`, `ai-document-security-privacy`, `ai-due-diligence-guide`, `ai-financial-report-analysis`, `ai-hr-contract-review`, `ai-research-paper-summarizer`, `best-ai-pdf-tools-2026`, `best-ai-tools-academic-research-2026`, `chat-with-excel-spreadsheet-ai`, `chat-with-powerpoint-ai`, `chatpdf-alternatives-2026`, `citation-highlighting-matters`, `free-ai-pdf-chat-no-signup`, `how-to-chat-with-docx-ai`, `how-to-chat-with-pdf-ai`, `how-to-chat-with-url-webpage-ai`, `notebooklm-alternatives-2026`, `rag-explained-simple`.

Blog categories tested:
`guides`, `comparisons`, `use-cases`, `product`, `ai-insights`.

Final targeted browser smoke after fixes:
- `/` desktop: H1 present, demo/pricing navigation visible.
- `/demo` mobile: H1 present, menu visible, sample cards visible.
- `/auth` mobile: exactly one H1 (`Sign In`).
- `/privacy` mobile: H1, banner, and footer present.
- `/collections` unauthenticated: clean redirect to `/auth?callbackUrl=/collections`.
- `/compare/notebooklm` desktop: H1 present and NotebookLM comparison content visible.
- `/blog/ai-document-security-privacy` desktop: H1 present and TOC visible.
- Demo reader sample: after local quota reset and settle, exactly one auto-submitted question, `4/5 questions remaining`, and clean provider-unavailable error due missing DeepSeek key.

## Functional Coverage

| Area | Result | Evidence / Notes |
|---|---|---|
| Upload and parse | Pass on representative corpus | 5 PDFs uploaded and parsed to ready; included English, Chinese, table-heavy finance, print-restricted encrypted, and 361-page PDF |
| Parse failures and limits | Pass | Invalid magic bytes returned `INVALID_FILE_CONTENT`; free 30M upload returned `FILE_TOO_LARGE` with `max_mb: 25` |
| PDF viewer | Pass with caveat | Demo sample rendered page text, zoom/page/search controls visible on desktop/mobile |
| Chat/RAG answer quality | Blocked | Local `DEEPSEEK_API_KEY` absent; chat returns clean SSE `LLM_ERROR` and refunds credits |
| Retrieval-adjacent search | Pass with caveat | Search returned chunk/page/bbox payloads for English, Chinese, and demo docs |
| Chat-native tools/artifacts | Pass | “Extract all tables and export CSV” queued table job, emitted artifact events, completed with 26 tables via PyMuPDF fallback |
| Tool clarification | Pass | “Compare this with the older version” asked for the two versions instead of fabricating |
| URL import | Pass | Invalid scheme and localhost blocked; `https://example.com` imported and parsed to ready |
| Collections | Pass after fix | Create/get/add/session/list/remove/delete tested; other user got 404 |
| Sharing | Pass | Create/view/revoke/invalid token tested; public payload leaked no `chunk_id`, `document_id`, `bboxes`, or confidence fields |
| Auth UI | Partial | OAuth/email UI visible; real OAuth and magic link blocked by local external credentials |
| Billing/plans | Partial | Products/profile/credits endpoints pass; real Stripe checkout not executed locally |
| Security boundaries | Pass for tested cases | Private document/file-url/collection/session access returned 404 for anonymous/other user |
| Mobile | Pass after fixes | Public nav, demo page, legal pages, auth, gated redirects, and reader controls checked at 390x844 |

## Test Corpus Inventory

Inventory:
- 51 supported files in `test_inputs/`, total 207M.
- Includes English and Chinese PDFs, financial research, strategy reports, AI reports, HTML export, long-form PDFs, table-heavy reports, graph/image-heavy reports, and filenames with spaces, punctuation, Chinese characters, parentheses, and uppercase `.PDF`.
- `pdfinfo` showed 49-page, 54-page, 90-page, 224-page, and 361-page files; some PDFs are encrypted with print permission.

Representative files parsed:
- `semiconductor.pdf` - small English PDF, 2 pages, ready, 12 chunks.
- `盘中解读.pdf` - Chinese PDF, 12 parsed pages, ready, 13 chunks.
- `Global Technology_ Semiconductors - Memory_ ...pdf` - finance/table-heavy, 28 pages, ready, 34 chunks.
- `1.Top of Mind_ Europe’s shifting security landscape.pdf` - encrypted/print-allowed, 31 pages, ready, 105 chunks.
- `ssrn-3247865.pdf` - 361 pages, ready, 581 chunks.

Negative/limit files:
- Temporary invalid `.pdf` bytes - rejected with `INVALID_FILE_CONTENT`.
- `Citrini Research _ Substack.pdf` as free user - rejected with `FILE_TOO_LARGE`, `max_mb: 25`.

## Findings

## BUG-001: Blog TOC duplicate heading ids and React keys
Severity: P2
Area: frontend/SEO/UX
Page/Feature: `/blog/ai-document-security-privacy`
Environment: local dev, desktop and mobile browser
Repro Steps:
1. Open `/blog/ai-document-security-privacy`.
2. Inspect browser console and article table of contents.
Expected:
Repeated headings should have unique anchor ids and no React key warnings.
Actual:
Repeated headings generated duplicate ids/keys such as `encryption`, `data-retention-and-deletion`, and `access-controls`.
Evidence:
Browser console warnings for duplicate keys; TOC anchors reused ids.
Root Cause:
Heading slugs were derived only from text with no deduplication.
Fix Plan:
Generate stable unique heading ids for TOC and rendered markdown headings.
Fix Commit:
`fix(qa): resolve full-product regression findings` (pending)
Retest Result:
Pass. `/blog/ai-document-security-privacy` desktop/mobile has no duplicate-key console errors.
Residual Risk:
Low.

## BUG-002: Collections unauth redirect mutates router during render
Severity: P2
Area: frontend/auth
Page/Feature: `/collections`
Environment: local dev, unauthenticated browser
Repro Steps:
1. Open `/collections` while signed out.
2. Watch browser console during redirect.
Expected:
Route redirects to `/auth?callbackUrl=/collections` without React warnings.
Actual:
React warning: cannot update `Router` while rendering `CollectionsPageClient`.
Evidence:
Browser console warning during `/collections` unauthenticated access.
Root Cause:
`router.push()` was called in render when `status !== 'authenticated'`.
Fix Plan:
Move redirect to `useEffect`; show loading screen while redirecting.
Fix Commit:
`fix(qa): resolve full-product regression findings` (pending)
Retest Result:
Pass. Redirects cleanly with no console error.
Residual Risk:
Low.

## BUG-003: Auth page has no mobile H1 and duplicate desktop H1 after naive fix
Severity: P2
Area: frontend/accessibility/SEO
Page/Feature: `/auth`
Environment: desktop and mobile browser
Repro Steps:
1. Open `/auth` at mobile width.
2. Count visible/DOM H1s.
Expected:
Exactly one H1 on desktop and mobile.
Actual:
Initial mobile page had 0 H1 because the only H1 was in a desktop-only panel. A first correction created 2 desktop H1s.
Evidence:
Browser H1 count: mobile 0 before fix; final retest desktop/mobile 1.
Root Cause:
Marketing heading used H1 in a hidden desktop column; form heading was H2.
Fix Plan:
Make the form title the single H1; demote marketing title to H2.
Fix Commit:
`fix(qa): resolve full-product regression findings` (pending)
Retest Result:
Pass. `/auth` desktop and mobile each have exactly one H1.
Residual Risk:
Low.

## BUG-004: Legal pages miss global header/footer
Severity: P2
Area: frontend/UX/SEO
Page/Feature: `/privacy`, `/terms`, `/imprint`
Environment: desktop and mobile browser
Repro Steps:
1. Open each legal page.
2. Check navigation, footer, and recoverability.
Expected:
Global header/nav and footer are present like other public pages.
Actual:
Pages rendered as standalone cards with only a back-home link.
Evidence:
Browser snapshots lacked banner/footer landmarks.
Root Cause:
Legal page clients did not use the shared `Header` and `Footer`.
Fix Plan:
Wrap legal pages in the shared public shell.
Fix Commit:
`fix(qa): resolve full-product regression findings` (pending)
Retest Result:
Pass. Mobile retest showed one H1, banner present, footer present.
Residual Risk:
Low.

## BUG-005: Document diff unauthenticated page renders blank while redirecting
Severity: P2
Area: frontend/auth/UX
Page/Feature: `/document-diff`
Environment: unauthenticated browser
Repro Steps:
1. Open `/document-diff` while signed out.
2. Observe content before redirect.
Expected:
Loading/redirect state is visible, then auth page opens.
Actual:
Component returned `null`, leaving a blank area while redirecting.
Evidence:
Browser snapshot during unauthenticated load.
Root Cause:
Unauthenticated branch returned `null`.
Fix Plan:
Return shared `LoadingScreen` during redirect.
Fix Commit:
`fix(qa): resolve full-product regression findings` (pending)
Retest Result:
Pass. Redirects to `/auth?callbackUrl=/document-diff` with no blank page.
Residual Risk:
Low.

## BUG-006: Demo `?question=` auto-submits twice on desktop
Severity: P1
Area: frontend/demo/chat
Page/Feature: `/demo` -> `/d/{demoDoc}?question=...`
Environment: desktop browser, anonymous demo
Repro Steps:
1. Clear local demo quota.
2. Open a demo sample URL with `?question=What%20was...`.
3. Observe message count and chat transcript.
Expected:
The suggested question submits once; remaining quota should go from 5/5 to 4/5.
Actual:
The suggested question submitted twice; remaining quota went to 3/5 and duplicate user/error messages appeared.
Evidence:
Browser snapshot showed duplicate question rows and `3/5 questions remaining`.
Root Cause:
Document reader mounts desktop and mobile chat panels at the same time; both `ChatPanel` instances ran the initial-question auto-submit effect.
Fix Plan:
Add a module-level guard keyed by `sessionId:initialQuestion` so only one mounted chat panel can auto-submit that initial question.
Fix Commit:
`fix(qa): resolve full-product regression findings` (pending)
Retest Result:
Pass. New browser tab showed one question, one provider error, and `4/5 questions remaining`.
Residual Risk:
Low. Full RAG answer still blocked by missing local DeepSeek key.

## BUG-007: Collection chat sessions lose owner attribution
Severity: P2
Area: backend/collections/security/audit
Page/Feature: Collection chat session creation
Environment: local backend API
Repro Steps:
1. Create a collection as an authenticated user.
2. Create a collection chat session.
3. Inspect the created `ChatSession`.
Expected:
Collection sessions should carry `user_id` like document sessions.
Actual:
Collection sessions were created with `user_id = null`.
Evidence:
Code path `ChatSession(collection_id=collection_id)`; API test added to assert owner id.
Root Cause:
`create_collection_session` omitted `user_id=user.id`.
Fix Plan:
Set `user_id` on collection sessions and add a unit test.
Fix Commit:
`fix(qa): resolve full-product regression findings` (pending)
Retest Result:
Pass. `tests/test_collections_api.py` passed and live collection access boundary still returned 404 for another user.
Residual Risk:
Existing historical collection sessions may still have null `user_id`; no migration was added in this QA fix.

## BUG-008: Dev console contains missing translation fallback warnings
Severity: P3
Area: frontend/i18n
Page/Feature: auth/demo/pricing/imprint/collections fallback keys
Environment: local dev browser/server logs
Repro Steps:
1. Open public and auth pages in dev.
2. Observe console/server logs.
Expected:
No missing translation warnings.
Actual:
Multiple `Missing translation key (using fallback)` warnings for existing `tOr` fallback keys.
Evidence:
Browser/dev logs included `common.menu`, `auth.preview.*`, `demo.*`, and related fallback warnings.
Root Cause:
Existing fallback keys have not been propagated to all 11 locale dictionaries.
Fix Plan:
Record only. Fixing requires an all-locale i18n pass.
Fix Commit:
N/A.
Retest Result:
Not fixed.
Residual Risk:
Low user-visible risk because `tOr` fallbacks render copy, but noisy QA logs can hide real warnings.

## Fix Log

Files changed:
- `frontend/src/app/blog/[slug]/BlogPostClient.tsx` - unique heading ids for repeated headings.
- `frontend/src/app/collections/CollectionsPageClient.tsx` - redirect in effect, loading state.
- `frontend/src/app/document-diff/page.tsx` - loading state during unauth redirect.
- `frontend/src/app/auth/page.tsx` - single H1 across desktop/mobile.
- `frontend/src/app/privacy/PrivacyPageClient.tsx` - shared header/footer shell.
- `frontend/src/app/terms/TermsPageClient.tsx` - shared header/footer shell.
- `frontend/src/app/imprint/ImprintPageClient.tsx` - shared header/footer shell.
- `frontend/src/components/Chat/ChatPanel.tsx` - cross-instance initial-question auto-submit guard.
- `backend/app/api/collections.py` - collection sessions now preserve `user_id`.
- `backend/tests/test_collections_api.py` - regression test for collection session owner attribution.

## Blocked / Not Covered

- Full LLM/RAG factuality and citation quality: blocked by missing local `DEEPSEEK_API_KEY`. The app returned a clean SSE `LLM_ERROR` and refunded credits.
- Real OAuth login: blocked by external provider account flow.
- Email magic link: blocked locally because frontend `RESEND_API_KEY` is absent and provider is disabled.
- Authenticated browser upload path: not completed in browser because login was blocked; backend upload/parse APIs were tested with a signed local QA JWT.
- Real Stripe checkout/portal/cancel: not executed to avoid creating external payment sessions; billing products/profile/credits were checked.
- Full 51-file corpus upload: inventoried, but only representative PDFs were uploaded/parsed because large-scale parsing would be slow/costly and LLM quality was blocked.
- Lighthouse: not run; SEO static output and browser smoke checks were completed instead.
