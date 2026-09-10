# Session copy: item-4 removal report

Completed the mechanical removal of item 4, retaining items 1–3. No new mechanism was introduced. No git command was run; no index, branch, or WIP branch mutation was performed.

Base: `a0a446f38c9b5e9738273a6420bf2e32bc1e72a4`. Base files were extracted directly from local loose objects with Python/zlib, verifying each object's SHA-1. Base snapshots: `/tmp/session-copy-strip-base/`; before-removal snapshots: `/tmp/session-copy-strip-before/`.

## Acceptance results

1. **PASS — `useChatSession.ts` is byte-identical to `a0a446f`, with zero diff.** Both SHA-256 hashes: `9bab8ecc7f2ba018814e04f5d27f1a9bd82a729b414eba88ae01ecc8913b6031`.
2. **PASS — zero occurrences anywhere under `frontend/src`** of `messagesSessionId`, `transcriptRestoreInFlight`, `beginTranscriptRestore`, `endTranscriptRestore`, `ownerSessionId`, `switchRequestRef`, `switchRestoreRef`, and `creatingSessionRef`. None remain in the stripped test file either. Original `setMessages(msgs)` / `setSessionId(id)` signatures and implementations restored; `setDocument` has no restore-state reference.
3. **PASS — `onSwitchSession` / `onDeleteSessionById` bodies equal base.** Entire declarations, including signatures, comments, and whitespace, compare exactly equal to `a0a446f`.
4. **PASS — demo CTA renders an upload link and cannot reach checkout through that CTA.** The unchanged demo mapping has `href: '/'` and no `plan`; the checkout button still requires `sessionErrorCopy.cta.plan`. The retained rendered-component test verifies the anchor, no checkout `onClick`, no upgrade copy, and zero billing calls. The own-document test still verifies both exits and plan-aware upgrade.
5. **PASS — all 11 locales retain the four new keys, flat and nonempty:** `errors.SESSION_LIMIT_REACHED.demoTitle`, `errors.SESSION_LIMIT_REACHED.demoBody`, `errors.cta.uploadDocument`, `errors.cta.deleteConversation`. Checked en / zh / ja / ko / es / de / fr / pt / it / ar / hi. The locale test additionally checks the updated existing own-document body and `{limit}` interpolation.

## Retained scope and review

- SHA-256 comparison confirms `errorCopy.ts`, `useDocumentLoader.ts`, `DocumentReaderPageClient.tsx`, and every locale JSON file are unchanged from before removal.
- Store retains `isDemo`, its setter/default, and new-document reset versus same-document preservation of `isDemo` / `documentStatus`.
- New Chat retains live document identity/readiness and streaming checks, both post-await document identity checks, contextual cap copy, and `limit_hit` enrichment with `document_id` / `is_demo`.
- Removed reuse, create serialization, switch refs, restore effect, and the `after-delete` escape parameter. Restored New Chat's button binding to base after removing the parameter. Base demo accounting/pointer code remains intact.
- Retained keyboard `stopPropagation`, `deleteConfirmRef` focus handling, secondary delete CTA, and checkout `cta.plan` condition.
- The retained metadata test lost only its obsolete ownership assertion. Removed-test-only harness support for initial restore, unmount, and deferred lifecycle requests was deleted. Original test-header spacing was preserved after the gate; transpiled JavaScript was verified identical to the passing version.
- Independent adversarial review by `/root/strip_review`: **PASS**, no concrete deviations. Independently checked all five acceptance conditions, retained scope, and deleted-test criteria. Reviewer ran no git commands and edited no files.

Authored changes: `frontend/src/lib/useChatSession.ts`, `frontend/src/store/index.ts`, `frontend/src/components/SessionDropdown.tsx`, `frontend/tests/session-limit.test.cjs`, and this report.

## Deleted tests and reasons

Removed 17 definition blocks expanding to **25 cases**. All eight copy/CTA/analytics/locale/demo-metadata cases remain in `session-limit.test.cjs`; the full unit suite now contains 30 cases.

| Deleted test | Reason |
| --- | --- |
| `New chat reuses current session with 0 assistant messages and zero users` | Directly tests the dropped empty/assistant-only session reuse and accounting invariance. |
| `New chat reuses current session with 1 assistant messages and zero users` | Directly tests the dropped empty/assistant-only session reuse and accounting invariance. |
| `New chat uses live user messages, not stale render or row message_count` | Tests the removed reuse-eligibility decision based on live transcript contents. |
| `nonempty demo create preserves original baseline, epoch and stored-pointer install` | Invokes two concurrent New Chat clicks and requires one create/accounting install, relying on removed creatingSessionRef serialization. Base accounting code remains intact. |
| `New chat does not reuse the temporary empty pane while switching sessions` | Tests the removed restore gate preventing temporary-empty-pane reuse. |
| `deleting the last empty session still creates a real replacement` | Tests the last-row-delete exception to empty-session reuse; reuse is removed and deletion is restored to base. |
| `session switching waits for initial restore and an in-flight switch` | Requires removed restore tokens and serialized user-action gates. |
| `late session-switch response cannot install messages or accounting on another document` | Tests item-4 switch response and ownership guards removed by exact base restoration. Separate New Chat late-response checks remain. |
| `failed session switch restores the loaded transcript and allows retry without counter writes` | Tests removed switch rollback and transcript ownership restoration. |
| `initial GET failure and capped create fallback allow exactly one explicit session retry GET` | Tests restore-token pending gates, ownership state, and the item-4 recovery repair. |
| `unknown/foreign ownership (null) creates instead of reusing an empty transcript` | Tests removed unknown/foreign transcript ownership and reuse fallback. |
| `unknown/foreign ownership (foreign) creates instead of reusing an empty transcript` | Tests removed unknown/foreign transcript ownership and reuse fallback. |
| `failed retry preserves unknown ownership so New Chat still falls through to create` | Tests removed ownership-preserving rollback and reuse fallback. |
| `initial restore clears pending on success and rejects a changed session identity` | Tests removed restore tokens and hook session-identity guards. |
| `cancelled initial restore releases immediately and its late finally cannot unlock a newer restore` | Tests removed restore-token acquisition/release, cancellation, and stale completion handling. |
| `pending restore resets on document change/reset and survives same-document transient refresh` | Tests removed pending-token store state; separate demo-metadata preservation coverage remains. |
| `unmount cancels a pending switch and its late completion cannot affect a newer restore` | Tests removed switch lifecycle effect, token, and request refs. |
| `active deletion supersedes initial restore: success-before-survivor` | Tests removed delete-during-initial-restore token supersession, identity retirement, and late-response coordination for this outcome. |
| `active deletion supersedes initial restore: success-after-survivor` | Tests removed delete-during-initial-restore token supersession, identity retirement, and late-response coordination for this outcome. |
| `active deletion supersedes initial restore: survivor-failure` | Tests removed delete-during-initial-restore token supersession, identity retirement, and late-response coordination for this outcome. |
| `active deletion supersedes initial restore: no-survivor` | Tests removed delete-during-initial-restore token supersession, identity retirement, and late-response coordination for this outcome. |
| `active deletion supersedes initial restore: create-failure` | Tests removed delete-during-initial-restore token supersession, identity retirement, and late-response coordination for this outcome. |
| `active deletion supersedes initial restore: deleted-get-failure` | Tests removed delete-during-initial-restore token supersession, identity retirement, and late-response coordination for this outcome. |
| `active deletion supersedes dropdown switch and its late success` | Tests removed delete/switch token coordination and late-response suppression for this outcome. |
| `active deletion supersedes dropdown switch and its late failure` | Tests removed delete/switch token coordination and late-response suppression for this outcome. |

## Gates

Both commands ran in `/Users/mayijie/Projects/Code/010_DocTalk/frontend`, capturing combined stdout/stderr without truncation. Exact output, including warnings and timing, follows. No real-browser upload → chat → citation run, backend gates, deployment, or real Stripe checkout was performed. CTA verification used retained transpiled-component tests and source inspection.

### `npm run build` — PASS, exit code 0

```text

> doctalk-frontend@0.30.0 build
> next build

  ▲ Next.js 14.2.35
  - Environments: .env.local
  - Experiments (use with caution):
    · instrumentationHook

   Creating an optimized production build ...
[@sentry/nextjs] DEPRECATION WARNING: It is recommended renaming your `sentry.client.config.ts` file, or moving its content to `instrumentation-client.ts`. When using Turbopack `sentry.client.config.ts` will no longer work. Read more about the `instrumentation-client.ts` file: https://nextjs.org/docs/app/api-reference/file-conventions/instrumentation-client
 ✓ Compiled successfully
   Linting and checking validity of types ...
   Collecting page data ...
RESEND_API_KEY not set — email magic link provider disabled
 ⚠ Using edge runtime on a page currently disables static generation for that page
   Generating static pages (0/425) ...
   Generating static pages (106/425) 
   Generating static pages (212/425) 
   Generating static pages (318/425) 
 ✓ Generating static pages (425/425)
   Finalizing page optimization ...
   Collecting build traces ...

Route (app)                                 Size     First Load JS
┌ ○ /                                       9.3 kB          211 kB
├ ○ /_not-found                             331 B           165 kB
├ ● /[locale]                               1.37 kB         278 kB
├   ├ /zh
├   ├ /ja
├   ├ /es
├   └ [+7 more paths]
├ ● /[locale]/alternatives                  1.58 kB         174 kB
├   ├ /zh/alternatives
├   ├ /ja/alternatives
├   ├ /es/alternatives
├   └ [+7 more paths]
├ ● /[locale]/alternatives/askyourpdf       321 B           176 kB
├   ├ /zh/alternatives/askyourpdf
├   ├ /ja/alternatives/askyourpdf
├   ├ /es/alternatives/askyourpdf
├   └ [+7 more paths]
├ ● /[locale]/alternatives/chatpdf          323 B           176 kB
├   ├ /zh/alternatives/chatpdf
├   ├ /ja/alternatives/chatpdf
├   ├ /es/alternatives/chatpdf
├   └ [+7 more paths]
├ ● /[locale]/alternatives/humata           2.5 kB          175 kB
├   ├ /zh/alternatives/humata
├   ├ /ja/alternatives/humata
├   ├ /es/alternatives/humata
├   └ [+7 more paths]
├ ● /[locale]/alternatives/notebooklm       2.5 kB          175 kB
├   ├ /zh/alternatives/notebooklm
├   ├ /ja/alternatives/notebooklm
├   ├ /es/alternatives/notebooklm
├   └ [+7 more paths]
├ ● /[locale]/alternatives/pdf-ai           323 B           176 kB
├   ├ /zh/alternatives/pdf-ai
├   ├ /ja/alternatives/pdf-ai
├   ├ /es/alternatives/pdf-ai
├   └ [+7 more paths]
├ ● /[locale]/compare                       1.58 kB         174 kB
├   ├ /zh/compare
├   ├ /ja/compare
├   ├ /es/compare
├   └ [+7 more paths]
├ ● /[locale]/compare/askyourpdf            321 B           176 kB
├   ├ /zh/compare/askyourpdf
├   ├ /ja/compare/askyourpdf
├   ├ /es/compare/askyourpdf
├   └ [+7 more paths]
├ ● /[locale]/compare/chatpdf               322 B           176 kB
├   ├ /zh/compare/chatpdf
├   ├ /ja/compare/chatpdf
├   ├ /es/compare/chatpdf
├   └ [+7 more paths]
├ ● /[locale]/compare/humata                322 B           176 kB
├   ├ /zh/compare/humata
├   ├ /ja/compare/humata
├   ├ /es/compare/humata
├   └ [+7 more paths]
├ ● /[locale]/compare/notebooklm            323 B           176 kB
├   ├ /zh/compare/notebooklm
├   ├ /ja/compare/notebooklm
├   ├ /es/compare/notebooklm
├   └ [+7 more paths]
├ ● /[locale]/compare/pdf-ai                321 B           176 kB
├   ├ /zh/compare/pdf-ai
├   ├ /ja/compare/pdf-ai
├   ├ /es/compare/pdf-ai
├   └ [+7 more paths]
├ ● /[locale]/demo                          375 B           279 kB
├   ├ /zh/demo
├   ├ /ja/demo
├   ├ /es/demo
├   └ [+7 more paths]
├ ● /[locale]/features                      1.58 kB         174 kB
├   ├ /zh/features
├   ├ /ja/features
├   ├ /es/features
├   └ [+7 more paths]
├ ● /[locale]/features/citations            322 B           176 kB
├   ├ /zh/features/citations
├   ├ /ja/features/citations
├   ├ /es/features/citations
├   └ [+7 more paths]
├ ● /[locale]/features/free-demo            2.62 kB         175 kB
├   ├ /zh/features/free-demo
├   ├ /ja/features/free-demo
├   ├ /es/features/free-demo
├   └ [+7 more paths]
├ ● /[locale]/features/layout-translation   1.58 kB         174 kB
├   ├ /zh/features/layout-translation
├   ├ /ja/features/layout-translation
├   ├ /es/features/layout-translation
├   └ [+7 more paths]
├ ● /[locale]/features/multi-format         2.62 kB         175 kB
├   ├ /zh/features/multi-format
├   ├ /ja/features/multi-format
├   ├ /es/features/multi-format
├   └ [+7 more paths]
├ ● /[locale]/features/multilingual         2.62 kB         175 kB
├   ├ /zh/features/multilingual
├   ├ /ja/features/multilingual
├   ├ /es/features/multilingual
├   └ [+7 more paths]
├ ● /[locale]/features/performance-modes    2.5 kB          175 kB
├   ├ /zh/features/performance-modes
├   ├ /ja/features/performance-modes
├   ├ /es/features/performance-modes
├   └ [+7 more paths]
├ ● /[locale]/pricing                       1.84 kB         175 kB
├   ├ /zh/pricing
├   ├ /ja/pricing
├   ├ /es/pricing
├   └ [+7 more paths]
├ ● /[locale]/tools                         1.58 kB         174 kB
├   ├ /zh/tools
├   ├ /ja/tools
├   ├ /es/tools
├   └ [+7 more paths]
├ ● /[locale]/trust                         1.58 kB         174 kB
├   ├ /zh/trust
├   ├ /ja/trust
├   ├ /es/trust
├   └ [+7 more paths]
├ ● /[locale]/use-cases                     1.58 kB         174 kB
├   ├ /zh/use-cases
├   ├ /ja/use-cases
├   ├ /es/use-cases
├   └ [+7 more paths]
├ ● /[locale]/use-cases/compliance          2.5 kB          175 kB
├   ├ /zh/use-cases/compliance
├   ├ /ja/use-cases/compliance
├   ├ /es/use-cases/compliance
├   └ [+7 more paths]
├ ● /[locale]/use-cases/consultants         2.5 kB          175 kB
├   ├ /zh/use-cases/consultants
├   ├ /ja/use-cases/consultants
├   ├ /es/use-cases/consultants
├   └ [+7 more paths]
├ ● /[locale]/use-cases/finance             2.5 kB          175 kB
├   ├ /zh/use-cases/finance
├   ├ /ja/use-cases/finance
├   ├ /es/use-cases/finance
├   └ [+7 more paths]
├ ● /[locale]/use-cases/healthcare          2.5 kB          175 kB
├   ├ /zh/use-cases/healthcare
├   ├ /ja/use-cases/healthcare
├   ├ /es/use-cases/healthcare
├   └ [+7 more paths]
├ ● /[locale]/use-cases/hr-contracts        2.5 kB          175 kB
├   ├ /zh/use-cases/hr-contracts
├   ├ /ja/use-cases/hr-contracts
├   ├ /es/use-cases/hr-contracts
├   └ [+7 more paths]
├ ● /[locale]/use-cases/lawyers             2.5 kB          175 kB
├   ├ /zh/use-cases/lawyers
├   ├ /ja/use-cases/lawyers
├   ├ /es/use-cases/lawyers
├   └ [+7 more paths]
├ ● /[locale]/use-cases/real-estate         2.5 kB          175 kB
├   ├ /zh/use-cases/real-estate
├   ├ /ja/use-cases/real-estate
├   ├ /es/use-cases/real-estate
├   └ [+7 more paths]
├ ● /[locale]/use-cases/students            2.5 kB          175 kB
├   ├ /zh/use-cases/students
├   ├ /ja/use-cases/students
├   ├ /es/use-cases/students
├   └ [+7 more paths]
├ ● /[locale]/use-cases/teachers            2.5 kB          175 kB
├   ├ /zh/use-cases/teachers
├   ├ /ja/use-cases/teachers
├   ├ /es/use-cases/teachers
├   └ [+7 more paths]
├ ○ /about                                  3.04 kB         176 kB
├ ○ /admin                                  126 kB          308 kB
├ ○ /alternatives                           1.58 kB         174 kB
├ ○ /alternatives/askyourpdf                322 B           176 kB
├ ○ /alternatives/chatpdf                   322 B           176 kB
├ ○ /alternatives/humata                    2.5 kB          175 kB
├ ○ /alternatives/notebooklm                2.5 kB          175 kB
├ ○ /alternatives/pdf-ai                    323 B           176 kB
├ ƒ /api/auth/[...nextauth]                 0 B                0 B
├ ƒ /api/contact                            0 B                0 B
├ ƒ /api/csp-report                         0 B                0 B
├ ƒ /api/indexnow                           0 B                0 B
├ ƒ /api/proxy/[...path]                    0 B                0 B
├ ƒ /api/upload-token                       0 B                0 B
├ ○ /auth                                   1.8 kB          179 kB
├ ○ /auth/confirm                           3.25 kB         173 kB
├ ○ /auth/error                             2.71 kB         172 kB
├ ○ /auth/verify-request                    1.64 kB         169 kB
├ ○ /billing                                13.6 kB         201 kB
├ ○ /blog                                   3.27 kB         176 kB
├ ● /blog/[slug]                            38.7 kB         222 kB
├   ├ /blog/ai-contract-review-guide
├   ├ /blog/ai-document-analysis-languages
├   ├ /blog/ai-document-security-privacy
├   └ [+16 more paths]
├ ● /blog/category/[category]               3.5 kB          176 kB
├   ├ /blog/category/guides
├   ├ /blog/category/comparisons
├   ├ /blog/category/use-cases
├   └ [+2 more paths]
├ ○ /collections                            7.63 kB         197 kB
├ ƒ /collections/[collectionId]             9.36 kB         263 kB
├ ○ /compare                                1.58 kB         174 kB
├ ○ /compare/askyourpdf                     321 B           176 kB
├ ○ /compare/chatpdf                        322 B           176 kB
├ ○ /compare/humata                         321 B           176 kB
├ ○ /compare/notebooklm                     323 B           176 kB
├ ○ /compare/pdf-ai                         323 B           176 kB
├ ○ /contact                                3.66 kB         176 kB
├ ƒ /d/[documentId]                         140 kB          388 kB
├ ○ /demo                                   462 B           181 kB
├ ƒ /demo/[sample]                          2.05 kB         171 kB
├ ○ /document-diff                          2.97 kB         189 kB
├ ○ /features                               1.58 kB         174 kB
├ ○ /features/citations                     323 B           176 kB
├ ○ /features/free-demo                     2.62 kB         175 kB
├ ○ /features/layout-translation            1.58 kB         174 kB
├ ○ /features/multi-format                  2.62 kB         175 kB
├ ○ /features/multilingual                  2.62 kB         175 kB
├ ○ /features/performance-modes             2.5 kB          175 kB
├ ○ /icon.svg                               0 B                0 B
├ ○ /imprint                                3.89 kB         177 kB
├ ○ /manifest.webmanifest                   0 B                0 B
├ ƒ /opengraph-image                        0 B                0 B
├ ○ /pricing                                1.84 kB         175 kB
├ ○ /privacy                                2.85 kB         176 kB
├ ○ /profile                                19.5 kB         204 kB
├ ○ /robots.txt                             0 B                0 B
├ ƒ /shared/[token]                         1.51 kB         174 kB
├ ○ /sitemap.xml                            0 B                0 B
├ ○ /terms                                  2.93 kB         176 kB
├ ○ /tools                                  1.58 kB         174 kB
├ ○ /tools/reading-time                     3.47 kB         179 kB
├ ○ /tools/word-counter                     3.52 kB         179 kB
├ ○ /trust                                  1.58 kB         174 kB
├ ƒ /twitter-image                          0 B                0 B
├ ○ /use-cases                              1.58 kB         174 kB
├ ○ /use-cases/compliance                   2.5 kB          175 kB
├ ○ /use-cases/consultants                  2.5 kB          175 kB
├ ○ /use-cases/finance                      2.5 kB          175 kB
├ ○ /use-cases/healthcare                   2.5 kB          175 kB
├ ○ /use-cases/hr-contracts                 2.5 kB          175 kB
├ ○ /use-cases/lawyers                      2.5 kB          175 kB
├ ○ /use-cases/real-estate                  2.5 kB          175 kB
├ ○ /use-cases/students                     2.5 kB          175 kB
└ ○ /use-cases/teachers                     2.5 kB          175 kB
+ First Load JS shared by all               165 kB
  ├ chunks/4661-c083a09f7b432cd5.js         103 kB
  ├ chunks/fd9d1056-f9e81e1c5db09f1d.js     53.8 kB
  └ other shared chunks (total)             8.28 kB


○  (Static)   prerendered as static content
●  (SSG)      prerendered as static HTML (uses getStaticProps)
ƒ  (Dynamic)  server-rendered on demand

```

### `npm run test:unit` — PASS, exit code 0; 30 passed, 0 failed

```text

> doctalk-frontend@0.30.0 test:unit
> node --test tests/*.test.cjs

TAP version 13
# Subtest: document brief empty pane renders for a summary without questions
ok 1 - document brief empty pane renders for a summary without questions
  ---
  duration_ms: 27.406
  type: 'test'
  ...
# Subtest: only chat-response failures expose existing regenerate as Retry
ok 2 - only chat-response failures expose existing regenerate as Retry
  ---
  duration_ms: 0.32125
  type: 'test'
  ...
# Subtest: the same rendered Retry then Send callbacks share one admission gate
ok 3 - the same rendered Retry then Send callbacks share one admission gate
  ---
  duration_ms: 46.463
  type: 'test'
  ...
# Subtest: rejected fetches clean up Send and Regenerate with one Retry bubble
ok 4 - rejected fetches clean up Send and Regenerate with one Retry bubble
  ---
  duration_ms: 42.741541
  type: 'test'
  ...
# Subtest: user-aborted transport rejection stays silent
ok 5 - user-aborted transport rejection stays silent
  ---
  duration_ms: 19.401583
  type: 'test'
  ...
# Subtest: document brief polling responses are guarded by a switch token
ok 6 - document brief polling responses are guarded by a switch token
  ---
  duration_ms: 0.22125
  type: 'test'
  ...
# Subtest: poll 19 empty cannot overwrite the rendered poll 20 ready brief
ok 7 - poll 19 empty cannot overwrite the rendered poll 20 ready brief
  ---
  duration_ms: 11.138167
  type: 'test'
  ...
# Subtest: dashboard nudge uses durable 1-document and 3-message eligibility without lifetime cap
ok 8 - dashboard nudge uses durable 1-document and 3-message eligibility without lifetime cap
  ---
  duration_ms: 0.411708
  type: 'test'
  ...
# Subtest: startCheckout records the intent before the request and records checkout failures
ok 9 - startCheckout records the intent before the request and records checkout failures
  ---
  duration_ms: 33.599458
  type: 'test'
  ...
# Subtest: plan-aware billing starts Checkout for Free→Plus
ok 10 - plan-aware billing starts Checkout for Free→Plus
  ---
  duration_ms: 6.217125
  type: 'test'
  ...
# Subtest: plan-aware billing starts Checkout for Free→Pro
ok 11 - plan-aware billing starts Checkout for Free→Pro
  ---
  duration_ms: 9.7105
  type: 'test'
  ...
# Subtest: plan-aware billing routes Plus→Pro through the billing change-plan flow
ok 12 - plan-aware billing routes Plus→Pro through the billing change-plan flow
  ---
  duration_ms: 4.195291
  type: 'test'
  ...
# Subtest: plan-aware billing sends Pro insufficient-credit actions to credit packs
ok 13 - plan-aware billing sends Pro insufficient-credit actions to credit packs
  ---
  duration_ms: 7.443
  type: 'test'
  ...
# Subtest: anonymous Quote Finder hint opens auth before panel or private analytics
ok 14 - anonymous Quote Finder hint opens auth before panel or private analytics
  ---
  duration_ms: 0.541542
  type: 'test'
  ...
# Subtest: local upload precheck maps free to plus
ok 15 - local upload precheck maps free to plus
  ---
  duration_ms: 51.072667
  type: 'test'
  ...
# Subtest: backend FILE_TOO_LARGE maps free to plus
ok 16 - backend FILE_TOO_LARGE maps free to plus
  ---
  duration_ms: 26.120917
  type: 'test'
  ...
# Subtest: local upload precheck maps plus to pro
ok 17 - local upload precheck maps plus to pro
  ---
  duration_ms: 15.281583
  type: 'test'
  ...
# Subtest: backend FILE_TOO_LARGE maps plus to pro
ok 18 - backend FILE_TOO_LARGE maps plus to pro
  ---
  duration_ms: 13.783542
  type: 'test'
  ...
# Subtest: local upload precheck maps pro to no upgrade
ok 19 - local upload precheck maps pro to no upgrade
  ---
  duration_ms: 10.760666
  type: 'test'
  ...
# Subtest: backend FILE_TOO_LARGE maps pro to no upgrade
ok 20 - backend FILE_TOO_LARGE maps pro to no upgrade
  ---
  duration_ms: 9.740583
  type: 'test'
  ...
# Subtest: top-tier collection caps also suppress downgrade CTAs
ok 21 - top-tier collection caps also suppress downgrade CTAs
  ---
  duration_ms: 11.115667
  type: 'test'
  ...
# Subtest: every terminal parse-worker code has specific copy in every locale
ok 22 - every terminal parse-worker code has specific copy in every locale
  ---
  duration_ms: 30.91525
  type: 'test'
  ...
# Subtest: signed-in demo session wall renders only upload exit to existing dashboard
ok 23 - signed-in demo session wall renders only upload exit to existing dashboard
  ---
  duration_ms: 55.91525
  type: 'test'
  ...
# Subtest: own-document wall renders both exits and preserves plan-aware upgrade
ok 24 - own-document wall renders both exits and preserves plan-aware upgrade
  ---
  duration_ms: 27.249209
  type: 'test'
  ...
# Subtest: demo metadata resets on document change/reset and survives same-document locale refresh
ok 25 - demo metadata resets on document change/reset and survives same-document locale refresh
  ---
  duration_ms: 17.909833
  type: 'test'
  ...
# Subtest: anonymous demo code stays separate and session CTA keyboard activation does not bubble into New chat
ok 26 - anonymous demo code stays separate and session CTA keyboard activation does not bubble into New chat
  ---
  duration_ms: 0.178209
  type: 'test'
  ...
# Subtest: all session-limit copy keys are flat, nonempty and interpolated in all 11 locales
ok 27 - all session-limit copy keys are flat, nonempty and interpolated in all 11 locales
  ---
  duration_ms: 20.070041
  type: 'test'
  ...
# Subtest: demo cap still offers upload during a same-document metadata refresh
ok 28 - demo cap still offers upload during a same-document metadata refresh
  ---
  duration_ms: 18.8
  type: 'test'
  ...
# Subtest: session limit analytics include request document and demo context (false) outside reader routes
ok 29 - session limit analytics include request document and demo context (false) outside reader routes
  ---
  duration_ms: 21.80225
  type: 'test'
  ...
# Subtest: session limit analytics include request document and demo context (true) outside reader routes
ok 30 - session limit analytics include request document and demo context (true) outside reader routes
  ---
  duration_ms: 14.028958
  type: 'test'
  ...
1..30
# tests 30
# suites 0
# pass 30
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 382.630667
```
