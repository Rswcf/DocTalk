# Session-limit copy — fix round 2 report

Scope: frontend only, on the user-supplied `fix/session-limit-copy` working tree. No git commands were run, so branch/HEAD were not independently verified. No backend, cap, counting, locale, or palette changes.

## Changes and why the reproduced sequence is closed

- `frontend/src/components/SessionDropdown.tsx:87` and `:145`: New Chat and switch accept an explicit internal `reason?: 'after-delete'`. Only the pending-restore gate admits that reason; ordinary clicks omit it (`:332`) and remain serialized. Streaming, creation, readiness (New Chat), and document guards remain. Switch response generation/document/session checks remain at `:160` and `:175`; creation now also checks request generation on success and failure (`:102`, `:105`, `:134`).
- `frontend/src/components/SessionDropdown.tsx:202`: confirmed deletion uses live document/streaming/creation state, and checks document identity after DELETE. The existing anon-demo pointer clearing block and its comment remain before replacement (`:210`). Active-session selection uses live state after deletion (`:220`), rather than the render-time id.
- `frontend/src/components/SessionDropdown.tsx:225`: when the deleted row is active, synchronously invalidate the switch generation, retire its id to null, clear its transcript with null ownership, and release its restore token. This occurs before any replacement await. The survivor switch (`:230`) or real create (`:232`) then runs through the internal path. With no survivor, the null id and absent row cannot satisfy the reuse condition, so a real create request is issued. A failed create leaves null, never the deleted id.
- `frontend/src/lib/useChatSession.ts:70`: continuation validity now requires the effect to be uncancelled, the document to match, and the restore to still own its token. Checks at the async restore/adoption/create boundaries reject superseded success. The catch/fallback checks (`:161`, `:165`) also prevent a deleted session's late GET failure from spawning an extra create. Existing session-id validation remains at `:156`. Token release alone is therefore not the cancellation guarantee: the hook explicitly verifies ownership before installing messages or continuing recovery.
- `frontend/src/components/SessionDropdown.tsx:165`: a replacement GET failure leaves the survivor selected, its empty buffer with unknown ownership, and the existing error copy. It cannot roll back to the deleted session. Ordinary switches retain their original previous-id/message/owner rollback, including null or foreign ownership, and the survivor can be explicitly retried.

For the reproduced A/B sequence: initial GET(A) owns token A; confirmed DELETE(A) removes its row and clears its stored pointer, then clears the active A identity and releases token A synchronously. GET(B) starts with its own generation/token and selects B. A's delayed successful response fails both token ownership and session identity checks, and its finally cannot release B's token. B's transcript is installed when GET(B) succeeds. If GET(B) fails, B remains active with unknown ownership; A never becomes installable again. The last-row path likewise rejects A even while replacement creation is still pending.

## New regression coverage

`frontend/tests/session-limit.test.cjs:57`, `:101`, `:105`: extend the existing actual-transpiled-source harness with configurable initial session rows and deferred creation. React hooks/API responses are controlled; the Zustand store, hook, and dropdown implementation are real source.

Six initial-restore cases at `frontend/tests/session-limit.test.cjs:501`:

1. Deleted A's GET succeeds before survivor B's GET; assert A is never installed and A's finally preserves B's pending token.
2. Deleted A's GET succeeds after B's transcript is installed; assert B's active id/transcript remain.
3. B's replacement GET fails, then A succeeds; assert B remains selected with unknown ownership, no rollback to A, and explicit retry loads B successfully.
4. No survivor: a real create is deferred, A succeeds during the pending create, then the real new session is installed; assert A stays retired throughout.
5. No survivor and create fails, then A succeeds; assert active id stays null and no deleted transcript is installed.
6. B succeeds, then deleted A's GET fails; assert the invalidated initial restore never starts a fallback create.

The tests subscribe to store changes to detect even transient installation of A's transcript, check GET/create histories and pending-token ownership, and check that stale results do not write demo accounting or pointers.

Two additional cases at `frontend/tests/session-limit.test.cjs:568` delete the active target of a dropdown-initiated switch, then deliver that old GET's success or failure while replacement is pending. Both verify the new generation/token and survivor transcript survive, including rejection of stale demo accounting.

All 47 existing cases remain passing; 8 new cases bring the final suite to **55 passed, 0 failed**. Before implementation, the initial six regressions were executed against the supplied source and all six failed at the assertion that the deleted id must be retired before replacement awaits.

## Adversarial review and constraints

A separate read-only Codex agent performed the project-required adversarial cross-review against pre-edit snapshots. It found **no blockers**, independently ran the then-current 53-test suite successfully, and independently executed two passing late-success/late-failure dropdown deletion probes. It also inspected the subsequently strengthened deferred-create test and the two added dropdown tests. No independent Claude or browser review is claimed.

A TypeScript AST comparison against pre-edit snapshots confirmed identical accounting/pointer mutation call text and lexical order: **9 calls in SessionDropdown.tsx, 11 in useChatSession.ts**. Source comparison verified their existing blocks and pointer-clear ordering/comment remain in place. No accounting, epoch, or pointer mutations were added, moved, or removed. Round 1's pending-token lifetime, owner-aware reuse (unknown → create), ordinary rollback ownership, demo upload exit, and `limit_hit` document/demo attribution remain intact and covered by the existing passing tests.

Trailing whitespace was stripped from the two prior implementation reports: `.collab/reviews/2026-09-10-session-copy-impl-report.md` and `.collab/reviews/2026-09-10-session-copy-fix-r1-report.md`. A direct whitespace scan was used; no `git diff --check` was run.

Browser upload → chat → citation jump was not run. Validation here covers controlled frontend lifecycle/request races plus the production build, not live browser/backend behavior. No backend tests, checkout, deployment, or git operations were performed.

## Gates

Both final gates ran from `/Users/mayijie/Projects/Code/010_DocTalk/frontend`:

- `npm run build`: **exit 0**. Compilation, lint/type checks, and **425/425** static pages completed. Existing Sentry deprecation, edge-runtime/static-generation, and missing local RESEND_API_KEY diagnostics appear below.
- `npm run test:unit`: **exit 0**, **55 tests, 55 pass, 0 fail, 0 cancelled, 0 skipped**. Intentional initial-GET and capped-create failures emit the hook's existing diagnostics.

One preliminary unit invocation from the repository root exited 254; it was corrected to the required frontend directory. The final successful outputs follow in full. Build carriage-return progress markers and trailing whitespace are normalized for Markdown; output wording is otherwise unchanged. Raw captured output is also available at `/tmp/session-copy-fix-r2/build.log` and `/tmp/session-copy-fix-r2/unit.log`.

### Exact final build output

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
 ⚠ Using edge runtime on a page currently disables static generation for that page
RESEND_API_KEY not set — email magic link provider disabled
   Generating static pages (0/425) ...
   Generating static pages (106/425)
   Generating static pages (212/425)
   Generating static pages (318/425)
 ✓ Generating static pages (425/425)
   Finalizing page optimization ...
   Collecting build traces ...

Route (app)                                 Size     First Load JS
┌ ○ /                                       9.4 kB          211 kB
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
├ ƒ /d/[documentId]                         140 kB          389 kB
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
  ├ chunks/4661-d55c70a301b1f9ce.js         103 kB
  ├ chunks/fd9d1056-f9e81e1c5db09f1d.js     53.8 kB
  └ other shared chunks (total)             8.28 kB


○  (Static)   prerendered as static content
●  (SSG)      prerendered as static HTML (uses getStaticProps)
ƒ  (Dynamic)  server-rendered on demand

```

### Exact final unit output

```text

> doctalk-frontend@0.30.0 test:unit
> node --test tests/*.test.cjs

TAP version 13
# Subtest: document brief empty pane renders for a summary without questions
ok 1 - document brief empty pane renders for a summary without questions
  ---
  duration_ms: 18.987541
  type: 'test'
  ...
# Subtest: only chat-response failures expose existing regenerate as Retry
ok 2 - only chat-response failures expose existing regenerate as Retry
  ---
  duration_ms: 0.28675
  type: 'test'
  ...
# Subtest: the same rendered Retry then Send callbacks share one admission gate
ok 3 - the same rendered Retry then Send callbacks share one admission gate
  ---
  duration_ms: 31.20575
  type: 'test'
  ...
# Subtest: rejected fetches clean up Send and Regenerate with one Retry bubble
ok 4 - rejected fetches clean up Send and Regenerate with one Retry bubble
  ---
  duration_ms: 30.393791
  type: 'test'
  ...
# Subtest: user-aborted transport rejection stays silent
ok 5 - user-aborted transport rejection stays silent
  ---
  duration_ms: 17.949917
  type: 'test'
  ...
# Subtest: document brief polling responses are guarded by a switch token
ok 6 - document brief polling responses are guarded by a switch token
  ---
  duration_ms: 0.225875
  type: 'test'
  ...
# Subtest: poll 19 empty cannot overwrite the rendered poll 20 ready brief
ok 7 - poll 19 empty cannot overwrite the rendered poll 20 ready brief
  ---
  duration_ms: 10.043542
  type: 'test'
  ...
# Subtest: dashboard nudge uses durable 1-document and 3-message eligibility without lifetime cap
ok 8 - dashboard nudge uses durable 1-document and 3-message eligibility without lifetime cap
  ---
  duration_ms: 0.409
  type: 'test'
  ...
# Subtest: startCheckout records the intent before the request and records checkout failures
ok 9 - startCheckout records the intent before the request and records checkout failures
  ---
  duration_ms: 28.511
  type: 'test'
  ...
# Subtest: plan-aware billing starts Checkout for Free→Plus
ok 10 - plan-aware billing starts Checkout for Free→Plus
  ---
  duration_ms: 5.967708
  type: 'test'
  ...
# Subtest: plan-aware billing starts Checkout for Free→Pro
ok 11 - plan-aware billing starts Checkout for Free→Pro
  ---
  duration_ms: 5.554042
  type: 'test'
  ...
# Subtest: plan-aware billing routes Plus→Pro through the billing change-plan flow
ok 12 - plan-aware billing routes Plus→Pro through the billing change-plan flow
  ---
  duration_ms: 4.867458
  type: 'test'
  ...
# Subtest: plan-aware billing sends Pro insufficient-credit actions to credit packs
ok 13 - plan-aware billing sends Pro insufficient-credit actions to credit packs
  ---
  duration_ms: 5.70175
  type: 'test'
  ...
# Subtest: anonymous Quote Finder hint opens auth before panel or private analytics
ok 14 - anonymous Quote Finder hint opens auth before panel or private analytics
  ---
  duration_ms: 0.541584
  type: 'test'
  ...
# Subtest: local upload precheck maps free to plus
ok 15 - local upload precheck maps free to plus
  ---
  duration_ms: 43.128625
  type: 'test'
  ...
# Subtest: backend FILE_TOO_LARGE maps free to plus
ok 16 - backend FILE_TOO_LARGE maps free to plus
  ---
  duration_ms: 21.472875
  type: 'test'
  ...
# Subtest: local upload precheck maps plus to pro
ok 17 - local upload precheck maps plus to pro
  ---
  duration_ms: 11.361209
  type: 'test'
  ...
# Subtest: backend FILE_TOO_LARGE maps plus to pro
ok 18 - backend FILE_TOO_LARGE maps plus to pro
  ---
  duration_ms: 13.776375
  type: 'test'
  ...
# Subtest: local upload precheck maps pro to no upgrade
ok 19 - local upload precheck maps pro to no upgrade
  ---
  duration_ms: 9.156291
  type: 'test'
  ...
# Subtest: backend FILE_TOO_LARGE maps pro to no upgrade
ok 20 - backend FILE_TOO_LARGE maps pro to no upgrade
  ---
  duration_ms: 8.852792
  type: 'test'
  ...
# Subtest: top-tier collection caps also suppress downgrade CTAs
ok 21 - top-tier collection caps also suppress downgrade CTAs
  ---
  duration_ms: 9.395208
  type: 'test'
  ...
# Subtest: every terminal parse-worker code has specific copy in every locale
ok 22 - every terminal parse-worker code has specific copy in every locale
  ---
  duration_ms: 27.276041
  type: 'test'
  ...
# Subtest: signed-in demo session wall renders only upload exit to existing dashboard
ok 23 - signed-in demo session wall renders only upload exit to existing dashboard
  ---
  duration_ms: 41.589083
  type: 'test'
  ...
# Subtest: own-document wall renders both exits and preserves plan-aware upgrade
ok 24 - own-document wall renders both exits and preserves plan-aware upgrade
  ---
  duration_ms: 24.818791
  type: 'test'
  ...
# Subtest: New chat reuses current session with 0 assistant messages and zero users
ok 25 - New chat reuses current session with 0 assistant messages and zero users
  ---
  duration_ms: 20.067
  type: 'test'
  ...
# Subtest: New chat reuses current session with 1 assistant messages and zero users
ok 26 - New chat reuses current session with 1 assistant messages and zero users
  ---
  duration_ms: 19.578209
  type: 'test'
  ...
# Subtest: New chat uses live user messages, not stale render or row message_count
ok 27 - New chat uses live user messages, not stale render or row message_count
  ---
  duration_ms: 16.07825
  type: 'test'
  ...
# Subtest: nonempty demo create preserves original baseline, epoch and stored-pointer install
ok 28 - nonempty demo create preserves original baseline, epoch and stored-pointer install
  ---
  duration_ms: 17.93075
  type: 'test'
  ...
# Subtest: New chat does not reuse the temporary empty pane while switching sessions
ok 29 - New chat does not reuse the temporary empty pane while switching sessions
  ---
  duration_ms: 11.620041
  type: 'test'
  ...
# Subtest: deleting the last empty session still creates a real replacement
ok 30 - deleting the last empty session still creates a real replacement
  ---
  duration_ms: 11.623042
  type: 'test'
  ...
# Subtest: demo metadata resets on document change/reset and survives same-document locale refresh
ok 31 - demo metadata resets on document change/reset and survives same-document locale refresh
  ---
  duration_ms: 10.651166
  type: 'test'
  ...
# Subtest: anonymous demo code stays separate and session CTA keyboard activation does not bubble into New chat
ok 32 - anonymous demo code stays separate and session CTA keyboard activation does not bubble into New chat
  ---
  duration_ms: 0.346084
  type: 'test'
  ...
# Subtest: all session-limit copy keys are flat, nonempty and interpolated in all 11 locales
ok 33 - all session-limit copy keys are flat, nonempty and interpolated in all 11 locales
  ---
  duration_ms: 17.602375
  type: 'test'
  ...
# Subtest: session switching waits for initial restore and an in-flight switch
ok 34 - session switching waits for initial restore and an in-flight switch
  ---
  duration_ms: 11.365917
  type: 'test'
  ...
# Subtest: late session-switch response cannot install messages or accounting on another document
ok 35 - late session-switch response cannot install messages or accounting on another document
  ---
  duration_ms: 10.894042
  type: 'test'
  ...
# Subtest: demo cap still offers upload during a same-document metadata refresh
ok 36 - demo cap still offers upload during a same-document metadata refresh
  ---
  duration_ms: 9.184167
  type: 'test'
  ...
# Subtest: failed session switch restores the loaded transcript and allows retry without counter writes
ok 37 - failed session switch restores the loaded transcript and allows retry without counter writes
  ---
  duration_ms: 10.754
  type: 'test'
  ...
# Failed to load sessions, falling back to create: TypeError: initial GET failed
#     at TestContext.<anonymous> (/Users/mayijie/Projects/Code/010_DocTalk/frontend/tests/session-limit.test.cjs:366:20)
#     at async Test.run (node:internal/test_runner/test:1054:7)
#     at async Test.processPendingSubtests (node:internal/test_runner/test:744:7)
# Failed to create session: { code: 'SESSION_LIMIT_REACHED', detail: { limit: 3 }, status: 403 }
# Subtest: initial GET failure and capped create fallback allow exactly one explicit session retry GET
ok 38 - initial GET failure and capped create fallback allow exactly one explicit session retry GET
  ---
  duration_ms: 18.225083
  type: 'test'
  ...
# Subtest: unknown/foreign ownership (null) creates instead of reusing an empty transcript
ok 39 - unknown/foreign ownership (null) creates instead of reusing an empty transcript
  ---
  duration_ms: 10.897292
  type: 'test'
  ...
# Subtest: unknown/foreign ownership (foreign) creates instead of reusing an empty transcript
ok 40 - unknown/foreign ownership (foreign) creates instead of reusing an empty transcript
  ---
  duration_ms: 9.076375
  type: 'test'
  ...
# Subtest: failed retry preserves unknown ownership so New Chat still falls through to create
ok 41 - failed retry preserves unknown ownership so New Chat still falls through to create
  ---
  duration_ms: 10.999333
  type: 'test'
  ...
# Subtest: initial restore clears pending on success and rejects a changed session identity
ok 42 - initial restore clears pending on success and rejects a changed session identity
  ---
  duration_ms: 23.292625
  type: 'test'
  ...
# Subtest: cancelled initial restore releases immediately and its late finally cannot unlock a newer restore
ok 43 - cancelled initial restore releases immediately and its late finally cannot unlock a newer restore
  ---
  duration_ms: 16.079
  type: 'test'
  ...
# Subtest: pending restore resets on document change/reset and survives same-document transient refresh
ok 44 - pending restore resets on document change/reset and survives same-document transient refresh
  ---
  duration_ms: 10.596417
  type: 'test'
  ...
# Subtest: session limit analytics include request document and demo context (false) outside reader routes
ok 45 - session limit analytics include request document and demo context (false) outside reader routes
  ---
  duration_ms: 11.179917
  type: 'test'
  ...
# Subtest: session limit analytics include request document and demo context (true) outside reader routes
ok 46 - session limit analytics include request document and demo context (true) outside reader routes
  ---
  duration_ms: 13.000292
  type: 'test'
  ...
# Subtest: unmount cancels a pending switch and its late completion cannot affect a newer restore
ok 47 - unmount cancels a pending switch and its late completion cannot affect a newer restore
  ---
  duration_ms: 11.514875
  type: 'test'
  ...
# Subtest: active deletion supersedes initial restore: success-before-survivor
ok 48 - active deletion supersedes initial restore: success-before-survivor
  ---
  duration_ms: 15.485833
  type: 'test'
  ...
# Subtest: active deletion supersedes initial restore: success-after-survivor
ok 49 - active deletion supersedes initial restore: success-after-survivor
  ---
  duration_ms: 10.826375
  type: 'test'
  ...
# Subtest: active deletion supersedes initial restore: survivor-failure
ok 50 - active deletion supersedes initial restore: survivor-failure
  ---
  duration_ms: 13.430208
  type: 'test'
  ...
# Subtest: active deletion supersedes initial restore: no-survivor
ok 51 - active deletion supersedes initial restore: no-survivor
  ---
  duration_ms: 13.405792
  type: 'test'
  ...
# Subtest: active deletion supersedes initial restore: create-failure
ok 52 - active deletion supersedes initial restore: create-failure
  ---
  duration_ms: 13.598917
  type: 'test'
  ...
# Subtest: active deletion supersedes initial restore: deleted-get-failure
ok 53 - active deletion supersedes initial restore: deleted-get-failure
  ---
  duration_ms: 11.394875
  type: 'test'
  ...
# Subtest: active deletion supersedes dropdown switch and its late success
ok 54 - active deletion supersedes dropdown switch and its late success
  ---
  duration_ms: 12.676167
  type: 'test'
  ...
# Subtest: active deletion supersedes dropdown switch and its late failure
ok 55 - active deletion supersedes dropdown switch and its late failure
  ---
  duration_ms: 10.71625
  type: 'test'
  ...
1..55
# tests 55
# suites 0
# pass 55
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 628.51
```
