# DocTalk adversarial project audit - Codex

Date: 2026-07-04  
Repo state requested by caller: commit `649c6ca`, v0.21.0 in production.  
Constraint followed: no git commands.

## Executive verdict

No P0 found in this pass. The highest-risk open items are still operational/product: the magic-link scanner ghost bug is unfixed, the deploy skill still encodes the wrong production order, and the post-answer citation-focus Flash call is still unrecorded/unbilled and can add up to 8 seconds before `done`.

The named "6 failing tests" are not environment-only. They are mostly stale tests/fixtures after code evolved, plus one OCR test whose expected behavior now contradicts the project's narrowed OCR-language policy. That is still a risk because it leaves important collection-summary and RetainPDF behavior without a green regression harness.

## Part A - Known backlog verification

### A1. Magic-link scanner ghost bug - still open

Severity: P1. Evidence:

- `frontend/src/lib/auth.ts:53` receives Auth.js `url` in `sendVerificationRequest`.
- `frontend/src/lib/auth.ts:84-89` passes that same raw callback URL to `buildSignInEmail`.
- `frontend/src/lib/emailTemplate.ts:73` renders it directly as the CTA href.
- `frontend/src/lib/emailTemplate.ts:139` also prints the raw callback URL in the plain-text email.

There is no confirmation interstitial or scanner-safe landing URL. Corporate scanners can still consume the one-time token before the human user clicks. This also explains ghost users because the backend creates a user and signup bonus on Auth.js user creation (`backend/app/services/auth_service.py:46-53`, `:64-72`).

Recommendation: fix now. Send users to a stable confirmation page, then redeem the token only after an explicit user gesture.

### A2. Ghost-user pollution in metrics - still open

Severity: P2. Evidence:

- Standalone metrics only exclude the owner account: `backend/scripts/prod_metrics.py:42-44`, `:67-71`; no account-provider or zero-event ghost filter.
- Admin shared eligibility only excludes admin emails and the internal owner: `backend/app/api/admin.py:254-261`.
- Retention pulls recent signups into cohorts: `backend/app/api/admin.py:1661-1665`, then `_build_retention_payload` counts each eligible user in cohort denominators at `backend/app/api/admin.py:367-407`.
- `recent-users` has no eligibility filter at all: `backend/app/api/admin.py:2398-2411`.
- `top-users` also ranks all users with outer joins: `backend/app/api/admin.py:2447-2487`.

Churn is less directly polluted by zero-event ghosts because it starts from users with message activity (`backend/app/api/admin.py:1731-1745`), but the shared admin filter still has no ghost concept. Retention, signups, overview, trends, recent users, and standalone metrics remain polluted.

Recommendation: schedule soon. Add a reusable "real user" predicate, likely excluding accounts with only email magic-link provider and zero document/message/usage/product-event activity. Be explicit about whether signup bonus ledger rows count as activity; I would not count them.

### A3. Deploy skill contradicts backend-first production rule - still stale

Severity: P1. Evidence:

- `.claude/skills/deploy/SKILL.md:7-10` says merge to stable, push stable, then `railway up --detach` if backend changed.
- This contradicts the top-level project instruction requiring Railway backend deploy and health check before pushing `stable`.

Recommendation: fix now. This is an operational footgun because pushing `stable` auto-deploys Vercel.

### A4. Six pre-existing failing tests - root-cause diagnosis

Command attempted with the exact requested node IDs first. Three layout node IDs no longer exist, so pytest failed collection for those names. Current equivalent names were then run:

`python3 -m pytest tests/test_chat_summary_routing.py::test_collection_summary_uses_collection_brief_context_not_search_multi tests/test_layout_translation_service.py::test_layout_translation_worker_downloads_pdf_without_ready_flags tests/test_layout_translation_service.py::test_layout_translation_worker_sanitizes_sidecar_traceback_failure tests/test_layout_translation_service.py::test_retainpdf_create_job_payload_matches_grouped_api tests/test_layout_translation_service.py::test_retainpdf_create_job_payload_supports_datalab_provider tests/test_ocr_languages_baseline.py::test_resolve_ocr_languages_exists_and_covers_all_locales -v`

Result: 6 failed.

Diagnosis:

- `test_collection_summary_uses_collection_brief_context_not_search_multi`: test fixture drift, not env-only. `chat_service` now selects `Document.id, filename, file_type, page_count` and indexes `drow[2]`/`drow[3]` (`backend/app/services/chat_service.py:1215-1223`), but `_make_collection_db` still returns `(doc_id, filename)` (`backend/tests/test_chat_summary_routing.py:112-115`). No production bug proven, but the collection-summary route is no longer covered by this test.
- `test_layout_translation_worker_downloads_pdf_without_ready_flags`: test double drift, not env-only. Production `DocumentJob.input_scope` is non-null JSONB with default `{}` (`backend/app/models/tables.py:558`), while the test `SimpleNamespace` omits it. The service legitimately reads it at `backend/app/services/layout_translation_service.py:617`.
- `test_layout_translation_worker_sanitizes_sidecar_traceback_failure`: same stale fixture prevents the test from reaching the RetainPDF failed-job branch. The sanitizer itself still maps traceback/schema failures to public copy at `backend/app/services/layout_translation_service.py:117-143`.
- `test_retainpdf_create_job_payload_matches_grouped_api`: test drift, not env-only. `RetainPdfClient.create_book_job` now requires `target_language_label` (`backend/app/services/layout_translation_service.py:318`) and puts it into custom rules at `backend/app/services/layout_translation_service.py:367-370`; the test still calls the old signature.
- `test_retainpdf_create_job_payload_supports_datalab_provider`: same signature drift.
- `test_resolve_ocr_languages_exists_and_covers_all_locales`: stale expectation, not env-only. The test expects default OCR to include every locale pack (`backend/tests/test_ocr_languages_baseline.py:23-29`), but current policy intentionally returns a narrow language set and falls back to `eng` when script/locale are unknown (`backend/app/services/parse_service.py:58-95`). This matches `.claude/rules/backend.md`, which explicitly forbids the kitchen-sink OCR set.

Recommendation: schedule, but do not label as environment failures. Update these tests so they lock the current contracts.

### A5. Citation-focus Flash call is still unrecorded and unbilled

Severity: P2. Evidence:

- `_refine_citation_focus` calls `extract_focus_quotes` through `asyncio.wait_for(..., timeout=8.0)` at `backend/app/services/chat_service.py:973-1003`.
- It is invoked for main answers at `backend/app/services/chat_service.py:1855-1861` and continuations at `backend/app/services/chat_service.py:2509-2515`.
- `extract_focus_quotes` performs a non-streaming LLM request at `backend/app/services/citation_quote_service.py:113-127`.
- Accounting records only answer usage and summary usage at `backend/app/services/chat_service.py:1887-1927`; no focus-call prompt/completion usage is read, reconciled, or written to `UsageRecord`.
- Continuation accounting similarly records only the continuation generation at `backend/app/services/chat_service.py:2538-2555`.

Cost exposure: bounded to one extra Flash call per answer/continuation where at least one text citation lacks `focus_snippet`; each cited source is capped to 1200 chars and output to 512 tokens (`backend/app/services/citation_quote_service.py:27-28`, `:81`). Still, anonymous demo chats also enter this path because `_refine_citation_focus` is outside the `user is not None` accounting branch. The app can therefore pay for a second LLM call on uncredited demo traffic.

Recommendation: fix now or schedule as the next billing integrity patch. Either record/reconcile focus usage, or explicitly disable it for anonymous demo/free paths until billing is implemented.

### A6. Stripe Plus monthly-credit grant - static verification

Severity: P3 test gap, not a confirmed code bug. Evidence:

- Config defaults are correct: free 300, Plus 3000, Pro 9000 at `backend/app/core/config.py:140-142`.
- `_credits_for_plan("plus")` returns `settings.PLAN_PLUS_MONTHLY_CREDITS` at `backend/app/api/billing.py:97-103`.
- `invoice.payment_succeeded` derives plan from subscription price when possible (`backend/app/api/billing.py:1169-1188`), grants `allowance = _credits_for_plan(plan)` for `subscription_create` and `subscription_cycle` (`backend/app/api/billing.py:1190-1199`), and credits that exact allowance with `ref_type="stripe_invoice"` (`backend/app/api/billing.py:1201-1217`).
- Existing unit tests cover skipping proration invoices (`backend/tests/test_billing_logic.py:77-106`), but I found no unit test that simulates a Plus invoice and asserts +3000.

What can be verified statically: the code path should grant 3000 for Plus if Stripe price IDs map correctly. What cannot be verified statically: live/test Stripe checkout event shape, deployed env price IDs, webhook delivery, and resulting ledger row in a real purchase.

Recommendation: schedule a test-mode Plus checkout or add a direct unit test for `_handle_invoice_payment_succeeded` with `_plan_from_price_id -> "plus"`.

### A7. Quote Finder M2 not started; M1 substrate exists

Severity: P2 product-plan risk. Evidence:

- Plan says M2 should include quote-search endpoint, billing, telemetry, chat-intent routing, quote cards, academic demo doc, and i18n (`.collab/plans/2026-06-12-quote-finder-evidence-board.md:137-142`).
- Code has M1 substrate: `backend/app/services/text_normalizer.py`, `backend/app/services/quote_verification_service.py`, and tests.
- No `saved_quotes`, `document_biblio`, `quote-search`, QuoteFinder UI, `FREE_SAVED_QUOTES_LIMIT`, or quote-search endpoint appears in `backend/app`, `backend/alembic`, `backend/tests`, or `frontend/src`.
- PDF `Page.content` persistence is still missing for PDFs: `extracted_content_map` is only populated for `file_type != "pdf"` (`backend/app/workers/parse_worker.py:215-239`), and persisted pages read `raw_content = extracted_content_map.get(...)` (`backend/app/workers/parse_worker.py:408-418`).
- The plan's own implementation log still says this is not done and must be M2 work (`.collab/plans/2026-06-12-quote-finder-evidence-board.md:159-171`).

Recommendation: schedule. Do not market Quote Finder until PDF page text, verifier source selection, trust labels, endpoint, billing, and UI exist.

## Part B - New issues and fresh concerns

### B1. Citation-focus call delays `done` and can push SSE over the 60s proxy limit

Severity: P2. Evidence:

- `_refine_citation_focus` waits up to 8 seconds before returning (`backend/app/services/chat_service.py:991-1002`).
- It runs after answer generation/repair but before final persistence/accounting/done (`backend/app/services/chat_service.py:1855-1876`, `:1887-1935`).
- The frontend proxy aborts chat requests after 60 seconds (`frontend/src/app/api/proxy/[...path]/route.ts:117-125`) and exports `maxDuration = 60` (`:150-151`).
- There is no user-visible `tool_status` before this focus call, unlike the repair path.

Impact: a user can see token streaming stop, then wait silently for up to 8 seconds before `done`. Long answers near the 60s Vercel limit are more likely to become 504s because of an optional highlighting enhancement.

Recommendation: fix now with either a shorter timeout, fire-and-forget post-done refinement, or skip when elapsed time is close to the proxy budget.

### B2. Anonymous demo chats can trigger the unbilled focus call

Severity: P2. Evidence:

- Anonymous demo rate/message limits are enforced in `backend/app/api/chat.py:312-352`.
- Anonymous demo users are forced to quick mode only for demo docs (`backend/app/services/chat_service.py:1229-1232`).
- But `_refine_citation_focus` runs outside the `user is not None` billing/reconciliation block (`backend/app/services/chat_service.py:1855-1861`, `:1887-1927`).

Impact: every allowed anonymous demo answer can become two LLM calls while only the main answer is bounded by chat-message rate limits.

Recommendation: schedule with A5. Either disable focus refinement for anonymous demo or add provider-side budget/rate accounting around it.

### B3. 50MB free upload change is enforced, but stale 25MB copy remains

Severity: P2. Evidence:

- Backend config is correct: `FREE_MAX_FILE_SIZE_MB = 50`, `PLUS_MAX_FILE_SIZE_MB = 50`, `PRO_MAX_FILE_SIZE_MB = 100` (`backend/app/core/config.py:160-162`).
- Upload validator uses those settings dynamically and returns `max_mb` (`backend/app/api/documents.py:236-255`).
- Dashboard constants also mirror 50/50/100 (`frontend/src/components/dashboard/DashboardPageClient.tsx:30-35`).
- Stale 25MB copy remains in live structured data or pages: `frontend/src/app/features/free-demo/page.tsx:96-99`, `frontend/src/app/features/multi-format/page.tsx:109-113`.
- Stale docs remain: `docs/ARCHITECTURE.md:967`, `docs/ARCHITECTURE.zh.md:859`, `docs/research/monetization-strategy.md:56`, `:78`, and `docs/research/competitive-analysis.md:228` (also stale "500 credits" there).

Recommendation: fix now for live SEO pages; schedule docs cleanup.

### B4. Suggested-questions restore leaks prompts across document switches

Severity: P2. Evidence:

- Loader only sets questions when `info.suggested_questions` is truthy (`frontend/src/lib/useDocumentLoader.ts:107-110`).
- Document-switch cleanup intentionally leaves document summary/questions untouched (`frontend/src/store/index.ts:296-312`).
- `ChatPanel` renders suggestions whenever `messages.length === 0` and `suggestedQuestions.length > 0` (`frontend/src/components/Chat/ChatPanel.tsx:486-508`).

Impact: open a document with generated questions, then open a second document with no generated questions and an empty chat; the second document can display the first document's suggested prompts.

Recommendation: fix now. Clear `documentSummary` and `suggestedQuestions` on document switch, and set questions to `info.suggested_questions ?? []` on ready.

### B5. Plans have stale status metadata

Severity: P3. Evidence:

- `2026-06-13-precise-citations.md` still says `Status: DRAFT` (`.collab/plans/2026-06-13-precise-citations.md:5`) while its implementation log says all phases were implemented (`:41-46`).
- `2026-06-13-cross-lingual-citation-focus.md` still says implementation was "Uncommitted" (`.collab/plans/2026-06-13-cross-lingual-citation-focus.md:47-52`) although the code is present in the current tree.
- Quote Finder plan remains a "CONSENSUS CANDIDATE" and still lists M2 as not done (`.collab/plans/2026-06-12-quote-finder-evidence-board.md:5`, `:159-171`), which is accurate for M2 but confusing because M1 substrate exists.

Recommendation: schedule doc hygiene. Stale plan state makes future audits spend time re-proving already-shipped work.

## Part C - Prioritized table

| Item | Severity | Effort | Recommendation |
|---|---:|---:|---|
| Magic-link scanner consumes raw Auth.js callback URL | P1 | M | Fix now |
| Deploy skill says frontend-first production deploy | P1 | S | Fix now |
| Citation-focus Flash call unrecorded/unbilled | P2 | M | Fix now |
| Citation-focus 8s hidden wait can hit 60s proxy timeout | P2 | S/M | Fix now |
| Anonymous demo traffic can trigger extra unbilled focus calls | P2 | S/M | Fix now with billing patch |
| Ghost-user pollution in signup/retention/admin metrics | P2 | M | Schedule soon |
| Stale 25MB live SEO/marketing copy | P2 | S | Fix now |
| Suggested questions leak across document switches | P2 | S | Fix now |
| Quote Finder M2 not started; PDF `Page.content` for PDFs still missing | P2 | L | Schedule |
| Collection-summary test fixture drift | P2 | S | Schedule, restore coverage |
| RetainPDF tests stale after `input_scope` and `target_language_label` changes | P3 | S | Schedule |
| OCR baseline test contradicts narrow OCR policy | P3 | S | Schedule/update test |
| Stripe Plus +3000 static path looks correct but lacks real purchase/unit verification | P3 | S | Schedule |
| `.collab/plans` status metadata stale | P3 | S | Schedule/drop stale status fields |

