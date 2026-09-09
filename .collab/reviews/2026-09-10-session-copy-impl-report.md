# Session-limit repair — implementation report

Date: 2026-09-10. Scope: frontend only, post-v0.30.0.

Implemented on `fix/session-limit-copy` (confirmed by reading `.git/HEAD`, without running git). The supplied base is `main @ a0a446f`; ancestry was not independently checked. Read `CLAUDE.md`, `.claude/rules/frontend.md`, and backlog decision §9.18 and §9.19 in full before implementation. No git commands, backend edits, migrations, API shape changes, cap/count changes, commits, or deployment.

## 1. Document surface in the store

- `frontend/src/store/index.ts:15`, `:140`, `:181`, `:190`, `:366`: added `isDemo`, false initially and on full reset; `setDocument` resets it on an actual document-ID change. The same transition resets `documentStatus` to `idle` until new metadata arrives, so session actions cannot interpret a limit using uninitialized document metadata.
- `frontend/src/lib/useDocumentLoader.ts:33`, `:97`: replaces hook-local demo state with the store selector/action, sets `Boolean(info.is_demo)` unconditionally from the existing response, behind the existing cancellation guard. The hook still returns `isDemo` for its current consumers.
- `frontend/src/components/SessionDropdown.tsx:21`, `:44`: subscribes to the document surface and clears document-specific error/confirmation state on retarget.
- Same-document locale changes/reloads preserve known demo-ness: `clearDocumentTransientState` deliberately does not erase it. Otherwise a demo could briefly become an own-document checkout surface during metadata refresh. Actual document changes and `reset()` still clear it. No demo accounting field was added to transient clearing.

## 2. Demo limit offers upload

- `frontend/src/lib/errorCopy.ts:66`, `:74`: optional client context branches only the shared `SESSION_LIMIT_REACHED` code. Demo body is “The demo allows 3 conversations per sample document. Upload your own document to keep going.” (`{limit}` defaults to 3.) It returns an upload CTA to `/`, with no `plan`, no `upgradeCta`, and no secondary delete action.
- `/` is the existing authenticated upload dashboard: `frontend/src/app/HomePageClient.tsx:26` dispatches to `DashboardPageClient` for authenticated users. No new route was created.
- `frontend/src/components/SessionDropdown.tsx:131`, `:349`: passes the live store surface to the mapper, and invokes billing only for authenticated CTAs carrying a billing plan. The demo CTA renders a plain link, so it cannot call Checkout.
- `frontend/src/app/d/[documentId]/DocumentReaderPageClient.tsx:93`: also passes demo context for initialization errors, avoiding the same shared-code copy defect on this adjacent reader surface.
- `frontend/src/lib/errorCopy.ts:425`: anonymous `DEMO_SESSION_LIMIT_REACHED` remains unchanged and separate.

## 3. Own-document limit names both exits

- `frontend/src/lib/errorCopy.ts:392`: body is “Free keeps 3 open conversations per document. Delete one to start another, or upgrade for unlimited.” The existing Plus upgrade CTA is retained; a typed `delete_session` secondary action supplies “Delete a conversation”.
- `frontend/src/components/SessionDropdown.tsx:335`: renders Delete beside Upgrade. It opens the existing deletion confirmation for the first non-active session (falling back to the current session), rather than deleting immediately. The existing hard-delete API call/removal frees the slot.
- `frontend/src/components/SessionDropdown.tsx:40`, `:55`, `:415`, `:471`: focuses the confirmation. CTA/confirmation wrappers stop only Enter/Space bubbling, so native button/link activation does not accidentally run the menu's New Chat handler; Escape/arrows retain menu handling.
- `frontend/src/components/SessionDropdown.tsx:234`: the own-document `onUpgrade` function is byte-for-byte unchanged versus the pre-edit snapshot, including Plus/monthly, `source=session_dropdown`, `reason=session_limit`, and `currentPlan: profile?.plan`.

## 4. Empty current sessions are reused

- `frontend/src/components/SessionDropdown.tsx:83`: reads the live Zustand transcript inside the event. If an existing current row has zero user messages, it calls `setMessages([])`, clears confirmation/error state, closes the menu, and returns without `createSession`. Assistant-only content is cleared as well. A transcript containing a user message still creates a session. Row `message_count` is not used to decide emptiness.
- Membership in the current sessions list prevents reuse of a just-deleted current session; deleting the last empty session still creates a real replacement. A synchronous creation latch prevents same-render double-click row creation.
- `frontend/src/store/index.ts:35`, `:152`, `:221`, `:296`: `messagesSessionId` distinguishes a loaded empty transcript from the temporary empty pane during a load. Setting a session invalidates that ownership; installing messages certifies it.
- `frontend/src/components/SessionDropdown.tsx:141`: switching waits for initial restore/current loads. Response generation/document/session guards reject late results. Failed switches restore the captured previous session/transcript and remain retryable. These protections are necessary to prevent a loading/stale empty array from being reused as though it were a loaded empty session.

### Demo counter argument

Contract stays `totalUsed = demoMessagesUsed + (transcript user-message count - demoRestoredUserMsgCount)`.

**Reuse path:** user-message count is zero before and after clearing assistant-only content. The same session remains active. Server usage, restored baseline, accounting epoch, and sessionStorage pointer remain unchanged; therefore `totalUsed` remains identical. There is no create/restore/accounting event and no new counter mutation. A pending re-anchor still targets the same session and unchanged user-count/accounting state.

**Create path:** the original `s.demo_messages_used != null` block at `SessionDropdown.tsx:110` remains in its original position and order: set restored baseline to 0, install `s.demo_messages_used`, bump the epoch, write the new demo-session pointer, then clear messages. Authenticated responses without `demo_messages_used` still execute no demo counter writes. Valid session-switch installs retain their original counter mutation sequence. A failed switch restores the old transcript without accounting writes because no new accounting was installed.

A direct comparison against the pre-edit snapshot verified that every `setDemoMessagesUsed`, `setDemoRestoredUserMsgCount`, `bumpDemoAccountingEpoch`, and `writeDemoSession` invocation in the dropdown is identical and in the original order. No counter mutation was added, moved, or removed. `useChatSession`, `useChatStream`, and `demoSessionStorage` were not edited. Backend caps/counts remain untouched, including empty-row counting and the number 3.

## i18n

Four new flat dotted keys, all consumed with `tOr(key, fallback)`:

- `errors.SESSION_LIMIT_REACHED.demoTitle`
- `errors.SESSION_LIMIT_REACHED.demoBody`
- `errors.cta.uploadDocument`
- `errors.cta.deleteConversation`

Updated existing key: `errors.SESSION_LIMIT_REACHED.body`.

All five are present with translated copy in en / zh / ja / ko / es / de / fr / pt / it / ar / hi. Both bodies retain exactly one `{limit}` placeholder. English references: `frontend/src/i18n/locales/en.json:2368` through the adjacent keys. Locale file references follow:

- `frontend/src/i18n/locales/en.json:2368`
- `frontend/src/i18n/locales/zh.json:2724`
- `frontend/src/i18n/locales/ja.json:2685`
- `frontend/src/i18n/locales/ko.json:2685`
- `frontend/src/i18n/locales/es.json:2685`
- `frontend/src/i18n/locales/de.json:2685`
- `frontend/src/i18n/locales/fr.json:2685`
- `frontend/src/i18n/locales/pt.json:2685`
- `frontend/src/i18n/locales/it.json:2685`
- `frontend/src/i18n/locales/ar.json:2685`
- `frontend/src/i18n/locales/hi.json:2685`

## Verification and review

`frontend/tests/session-limit.test.cjs:133` adds 15 focused tests using actual transpiled component/error mapper/store code with mocked React hooks and API/billing boundaries, matching the existing `.test.cjs` style. They cover rendered demo upload/no-checkout, own-document delete + exact billing arguments, empty and assistant-only reuse, live transcript vs stale row count, unchanged demo accounting/pointer writes, same-render double click, loading protection, last-empty deletion replacement, document reset, same-document refresh, anonymous-code separation, i18n completeness/placeholders, initial-restore/switch serialization, late cross-document responses, and failed-switch retry. Keyboard propagation is checked structurally; these unit tests do not substitute for browser interaction.

Independent Codex adversarial review was performed as required by AGENTS.md. Findings fixed before final gates: demo marker loss on same-document refresh; stale/initial transcript loads falsely certifying emptiness; confirmation keyboard propagation; and failed-switch retry after adding load serialization. Final reviewer disposition: “All previously reported findings are resolved. No remaining blockers in this review scope.”

Additional source verification: existing own-document `onUpgrade` byte-for-byte unchanged; demo mutation invocation/order unchanged; no forbidden palette utilities or `transition-all` in SessionDropdown.

Final gates:

| Command | Working directory | Exit | Result |
| --- | --- | --- | --- |
| `npm run build` | `frontend` | 0 | Compiled, lint/types passed, 425/425 pages generated |
| `npm run test:unit` | `frontend` | 0 | 37 tests, 37 passed, 0 failed/skipped |
| `python3.12 -m ruff check app/ tests/` | `backend` | 0 | `All checks passed!` |

Build emitted Sentry client-config deprecation, edge-runtime static-generation, and absent local `RESEND_API_KEY` warnings; none failed the build. These are captured verbatim below.

Backend behavior/tests should be unaffected because no backend code, API contract, migration, or counting logic changed. Backend pytest suites were not run for this frontend-only batch; the explicitly requested backend Ruff gate was run with Python 3.12.

## Not completed / limitations

- Browser golden path (upload → chat → citation jump) was not completed. No existing frontend dev server was listening; `npm run dev` failed to bind `0.0.0.0:3000` with `listen EPERM: operation not permitted`. Sandbox approval is unavailable. The dev command itself returned exit 0 despite the failure, so that exit is not treated as a successful browser check. Full attempted-server output is recorded below.
- No commit, push, deployment, or git command. Branch is already `fix/session-limit-copy`; this report does not claim production has this fix.
- No backend pytest run, as explained above. No authenticated live upload/chat or real Stripe action was performed; billing was verified at its mocked boundary.

## Exact final gate output

Raw stdout/stderr is retained in sibling files under `session-copy-gates/`. The following blocks contain the full captured output of the final runs (terminal carriage returns normalized for Markdown readability); raw files preserve the original bytes.

<details>
<summary>npm run build</summary>

Raw log: [session-copy-gates/build.log](session-copy-gates/build.log)

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
┌ ○ /                                       9.31 kB         211 kB
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

</details>

<details>
<summary>npm run test:unit</summary>

Raw log: [session-copy-gates/unit.log](session-copy-gates/unit.log)

```text

> doctalk-frontend@0.30.0 test:unit
> node --test tests/*.test.cjs

TAP version 13
# Subtest: document brief empty pane renders for a summary without questions
ok 1 - document brief empty pane renders for a summary without questions
  ---
  duration_ms: 21.574125
  type: 'test'
  ...
# Subtest: only chat-response failures expose existing regenerate as Retry
ok 2 - only chat-response failures expose existing regenerate as Retry
  ---
  duration_ms: 0.321209
  type: 'test'
  ...
# Subtest: the same rendered Retry then Send callbacks share one admission gate
ok 3 - the same rendered Retry then Send callbacks share one admission gate
  ---
  duration_ms: 31.007875
  type: 'test'
  ...
# Subtest: rejected fetches clean up Send and Regenerate with one Retry bubble
ok 4 - rejected fetches clean up Send and Regenerate with one Retry bubble
  ---
  duration_ms: 35.717917
  type: 'test'
  ...
# Subtest: user-aborted transport rejection stays silent
ok 5 - user-aborted transport rejection stays silent
  ---
  duration_ms: 17.861458
  type: 'test'
  ...
# Subtest: document brief polling responses are guarded by a switch token
ok 6 - document brief polling responses are guarded by a switch token
  ---
  duration_ms: 0.202958
  type: 'test'
  ...
# Subtest: poll 19 empty cannot overwrite the rendered poll 20 ready brief
ok 7 - poll 19 empty cannot overwrite the rendered poll 20 ready brief
  ---
  duration_ms: 10.933083
  type: 'test'
  ...
# Subtest: dashboard nudge uses durable 1-document and 3-message eligibility without lifetime cap
ok 8 - dashboard nudge uses durable 1-document and 3-message eligibility without lifetime cap
  ---
  duration_ms: 0.477708
  type: 'test'
  ...
# Subtest: startCheckout records the intent before the request and records checkout failures
ok 9 - startCheckout records the intent before the request and records checkout failures
  ---
  duration_ms: 28.941084
  type: 'test'
  ...
# Subtest: plan-aware billing starts Checkout for Free→Plus
ok 10 - plan-aware billing starts Checkout for Free→Plus
  ---
  duration_ms: 6.971416
  type: 'test'
  ...
# Subtest: plan-aware billing starts Checkout for Free→Pro
ok 11 - plan-aware billing starts Checkout for Free→Pro
  ---
  duration_ms: 7.324583
  type: 'test'
  ...
# Subtest: plan-aware billing routes Plus→Pro through the billing change-plan flow
ok 12 - plan-aware billing routes Plus→Pro through the billing change-plan flow
  ---
  duration_ms: 4.635666
  type: 'test'
  ...
# Subtest: plan-aware billing sends Pro insufficient-credit actions to credit packs
ok 13 - plan-aware billing sends Pro insufficient-credit actions to credit packs
  ---
  duration_ms: 9.216667
  type: 'test'
  ...
# Subtest: anonymous Quote Finder hint opens auth before panel or private analytics
ok 14 - anonymous Quote Finder hint opens auth before panel or private analytics
  ---
  duration_ms: 0.548458
  type: 'test'
  ...
# Subtest: local upload precheck maps free to plus
ok 15 - local upload precheck maps free to plus
  ---
  duration_ms: 46.151709
  type: 'test'
  ...
# Subtest: backend FILE_TOO_LARGE maps free to plus
ok 16 - backend FILE_TOO_LARGE maps free to plus
  ---
  duration_ms: 21.545209
  type: 'test'
  ...
# Subtest: local upload precheck maps plus to pro
ok 17 - local upload precheck maps plus to pro
  ---
  duration_ms: 17.450583
  type: 'test'
  ...
# Subtest: backend FILE_TOO_LARGE maps plus to pro
ok 18 - backend FILE_TOO_LARGE maps plus to pro
  ---
  duration_ms: 14.817792
  type: 'test'
  ...
# Subtest: local upload precheck maps pro to no upgrade
ok 19 - local upload precheck maps pro to no upgrade
  ---
  duration_ms: 10.068625
  type: 'test'
  ...
# Subtest: backend FILE_TOO_LARGE maps pro to no upgrade
ok 20 - backend FILE_TOO_LARGE maps pro to no upgrade
  ---
  duration_ms: 9.618541
  type: 'test'
  ...
# Subtest: top-tier collection caps also suppress downgrade CTAs
ok 21 - top-tier collection caps also suppress downgrade CTAs
  ---
  duration_ms: 8.916875
  type: 'test'
  ...
# Subtest: every terminal parse-worker code has specific copy in every locale
ok 22 - every terminal parse-worker code has specific copy in every locale
  ---
  duration_ms: 25.704792
  type: 'test'
  ...
# Subtest: signed-in demo session wall renders only upload exit to existing dashboard
ok 23 - signed-in demo session wall renders only upload exit to existing dashboard
  ---
  duration_ms: 43.0695
  type: 'test'
  ...
# Subtest: own-document wall renders both exits and preserves plan-aware upgrade
ok 24 - own-document wall renders both exits and preserves plan-aware upgrade
  ---
  duration_ms: 26.932791
  type: 'test'
  ...
# Subtest: New chat reuses current session with 0 assistant messages and zero users
ok 25 - New chat reuses current session with 0 assistant messages and zero users
  ---
  duration_ms: 16.760333
  type: 'test'
  ...
# Subtest: New chat reuses current session with 1 assistant messages and zero users
ok 26 - New chat reuses current session with 1 assistant messages and zero users
  ---
  duration_ms: 17.306334
  type: 'test'
  ...
# Subtest: New chat uses live user messages, not stale render or row message_count
ok 27 - New chat uses live user messages, not stale render or row message_count
  ---
  duration_ms: 17.291125
  type: 'test'
  ...
# Subtest: nonempty demo create preserves original baseline, epoch and stored-pointer install
ok 28 - nonempty demo create preserves original baseline, epoch and stored-pointer install
  ---
  duration_ms: 12.383875
  type: 'test'
  ...
# Subtest: New chat does not reuse the temporary empty pane while switching sessions
ok 29 - New chat does not reuse the temporary empty pane while switching sessions
  ---
  duration_ms: 10.951
  type: 'test'
  ...
# Subtest: deleting the last empty session still creates a real replacement
ok 30 - deleting the last empty session still creates a real replacement
  ---
  duration_ms: 14.180667
  type: 'test'
  ...
# Subtest: demo metadata resets on document change/reset and survives same-document locale refresh
ok 31 - demo metadata resets on document change/reset and survives same-document locale refresh
  ---
  duration_ms: 13.243583
  type: 'test'
  ...
# Subtest: anonymous demo code stays separate and session CTA keyboard activation does not bubble into New chat
ok 32 - anonymous demo code stays separate and session CTA keyboard activation does not bubble into New chat
  ---
  duration_ms: 0.372375
  type: 'test'
  ...
# Subtest: all session-limit copy keys are flat, nonempty and interpolated in all 11 locales
ok 33 - all session-limit copy keys are flat, nonempty and interpolated in all 11 locales
  ---
  duration_ms: 18.265
  type: 'test'
  ...
# Subtest: session switching waits for initial restore and an in-flight switch
ok 34 - session switching waits for initial restore and an in-flight switch
  ---
  duration_ms: 12.660916
  type: 'test'
  ...
# Subtest: late session-switch response cannot install messages or accounting on another document
ok 35 - late session-switch response cannot install messages or accounting on another document
  ---
  duration_ms: 10.797291
  type: 'test'
  ...
# Subtest: demo cap still offers upload during a same-document metadata refresh
ok 36 - demo cap still offers upload during a same-document metadata refresh
  ---
  duration_ms: 10.738042
  type: 'test'
  ...
# Subtest: failed session switch restores the loaded transcript and allows retry without counter writes
ok 37 - failed session switch restores the loaded transcript and allows retry without counter writes
  ---
  duration_ms: 9.842167
  type: 'test'
  ...
1..37
# tests 37
# suites 0
# pass 37
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 430.527959
```

</details>

<details>
<summary>python3.12 -m ruff check app/ tests/</summary>

Raw log: [session-copy-gates/ruff.log](session-copy-gates/ruff.log)

```text
All checks passed!
```

</details>

<details>
<summary>npm run dev — blocked browser prerequisite</summary>

Raw log: [session-copy-gates/dev.log](session-copy-gates/dev.log)

```text

> doctalk-frontend@0.30.0 dev
> next dev

 ⨯ Failed to start server
Error: listen EPERM: operation not permitted 0.0.0.0:3000
    at Server.setupListenHandle [as _listen2] (node:net:1918:21)
    at listenInCluster (node:net:1997:12)
    at Server.listen (node:net:2102:7)
    at /Users/mayijie/Projects/Code/010_DocTalk/frontend/node_modules/next/dist/server/lib/start-server.js:280:16
    at new Promise (<anonymous>)
    at startServer (/Users/mayijie/Projects/Code/010_DocTalk/frontend/node_modules/next/dist/server/lib/start-server.js:191:11)
    at /Users/mayijie/Projects/Code/010_DocTalk/frontend/node_modules/next/dist/server/lib/start-server.js:310:52
    at Span.traceAsyncFn (/Users/mayijie/Projects/Code/010_DocTalk/frontend/node_modules/next/dist/trace/trace.js:154:26)
    at process.<anonymous> (/Users/mayijie/Projects/Code/010_DocTalk/frontend/node_modules/next/dist/server/lib/start-server.js:310:35)
    at process.emit (node:events:519:28) {
  code: 'EPERM',
  errno: -1,
  syscall: 'listen',
  address: '0.0.0.0',
  port: 3000
}
[?25h
```

</details>
