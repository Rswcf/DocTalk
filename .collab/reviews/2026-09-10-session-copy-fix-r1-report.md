# Session-limit copy — fix round 1 report

Scope: frontend only. Working tree supplied as branch `fix/session-limit-copy`, HEAD `30f7f1e`; these identifiers are user-provided, not independently checked. No git commands, backend changes, cap changes, or backend counting changes were made.

## Changes

- `frontend/src/store/index.ts:37`, `:157`, `:192`, `:228`: added `transcriptRestoreInFlight`, an explicit pending signal whose non-null value is a unique symbol token. Begin/end actions ensure an old request cannot clear a newer request's pending state. A real document change and `reset()` clear it; a same-document locale/transient refresh preserves it.
- `frontend/src/lib/useChatSession.ts:67`, `:191`, `:193`: initial initialization/restore owns a token through its list/adopt/GET/create flow. Promise `finally` releases it on success and failure, including early returns. Effect cleanup releases it immediately on cancellation, even if the request never settles; its later `finally` cannot clear another token.
- `frontend/src/lib/useChatSession.ts:149`: before installing the initial GET response, require that the effect is not cancelled and that both document and session identity still match. This implements optional requirement 5 with a small local guard.
- `frontend/src/components/SessionDropdown.tsx:87`: New Chat blocks while a transcript restore is actually pending. Reuse requires current-session membership, matching transcript ownership, and zero user messages. Unknown or foreign ownership falls through to the existing create request. No demo accounting or pointer mutations were added, moved, or removed from reuse or create.
- `frontend/src/components/SessionDropdown.tsx:144`: session switching uses the explicit pending signal instead of ownership. Switch requests also own a token, preserving existing serialization against another switch and New Chat. `finally` releases it; lifecycle cleanup at `:50` releases cancelled switches. Existing `switchRequestRef`, document, and session response guards remain.
- `frontend/src/store/index.ts:227`, `frontend/src/components/SessionDropdown.tsx:163`: `setMessages` accepts an optional explicit owner for rollback; existing one-argument callers keep their behavior. A failed switch restores both the previous buffer and its original ownership, including `null`. This closes the related case where a failed retry from an unloaded session would otherwise certify its empty buffer as loaded. No failed initial load is repaired with `setMessages([])`.
- `frontend/src/components/SessionDropdown.tsx:137`: `limit_hit` retains its name and existing `source`/`reason` metadata and automatic `path` enrichment, adding the request's `document_id` and request-time `is_demo`. Attribution therefore works when the retained-document dropdown is used on `/`.

## Reproduced sequence and regression coverage

`frontend/tests/session-limit.test.cjs:353` executes the actual transpiled hook, Zustand store, and dropdown against controlled API promises:

1. Initial list selects `current`; its GET remains pending. Session switching and New Chat issue no additional requests while this restore is active.
2. That GET rejects; fallback create rejects with `SESSION_LIMIT_REACHED`.
3. Assert `{sessionId: 'current', messagesSessionId: null, transcriptRestoreInFlight: null}` and the actual fallback error.
4. Explicitly click `older`: assert the entire GET history is exactly `['current', 'older']`, so the click issues exactly one retry GET.
5. Resolve the retry and verify both transcript contents and ownership are installed for `older`.

The failed load stays unknown, but it no longer looks pending. That permits the explicit retry without weakening the empty-session reuse proof.

Additional cases cover unknown/foreign ownership falling through to create (`:381`), failed retry preserving unknown ownership (`:393`), successful initial restore and session-identity mismatch (`:407`), cancellation followed by an older completion while a newer restore is pending (`:425`), document/reset versus same-document refresh (`:445`), own/demo analytics on `/` through the real analytics enrichment function (`:460`), and switch unmount cancellation with a late response (`:482`). The existing serialization test at `:291` now models an actual pending restore explicitly rather than using unknown ownership as a proxy.

All original 37 test cases remain; 10 new cases bring the suite to 47. Existing reuse/accounting and all-11-locale copy checks pass. No copy keys, styling, or locale files changed.

## Adversarial review and scope verification

A separate read-only Codex adversarial cross-review of the four edited frontend files against the pre-edit snapshots found **no blockers**. It checked failed initialization recovery, unknown-ownership rollback/create behavior, pending-token cancellation and stale completion, demo accounting call placement, and request-time analytics attribution. No independent Claude review is claimed.

A TypeScript AST comparison against pre-edit snapshots verified identical demo accounting/storage-pointer call text and lexical order in both production paths: 11 calls in `useChatSession.ts`, 9 in `SessionDropdown.tsx`. Source diff inspection also confirmed the accounting blocks retain their branches and ordering.

The focused tests exercise frontend request/state behavior with controlled failures. No browser upload → chat → citation-jump run, live backend test, checkout, or deployment was performed; those are not claimed as validated here.

## Gates

Both commands ran from `/Users/mayijie/Projects/Code/010_DocTalk/frontend` on the final edited files:

- `npm run build`: exit **0**; compiled successfully, lint/type validation completed, **425/425** static pages generated. Output contains the Sentry client-config deprecation warning reproduced below.
- `npm run test:unit`: exit **0**; **47 passed, 0 failed, 0 cancelled, 0 skipped**. The intentional failed-initial-GET/capped-create test emits the hook's existing warning/error diagnostics; these are expected test stimuli, not gate failures.

The first unit command was accidentally invoked from the repository root and exited 254; it was immediately rerun from the required frontend directory. The successful final frontend gate output follows in full.

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
┌ ○ /                                       9.4 kB          211 kB
├ ○ /_not-found                             330 B           165 kB
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
  ├ chunks/4661-f1fd8ecc36f73df0.js         103 kB
  ├ chunks/fd9d1056-f9e81e1c5db09f1d.js     53.8 kB
  └ other shared chunks (total)             8.28 kB


○  (Static)   prerendered as static content
●  (SSG)      prerendered as static HTML (uses getStaticProps)
ƒ  (Dynamic)  server-rendered on demand

```

### Exact final unit-test output

```text

> doctalk-frontend@0.30.0 test:unit
> node --test tests/*.test.cjs

TAP version 13
# Subtest: document brief empty pane renders for a summary without questions
ok 1 - document brief empty pane renders for a summary without questions
  ---
  duration_ms: 21.968583
  type: 'test'
  ...
# Subtest: only chat-response failures expose existing regenerate as Retry
ok 2 - only chat-response failures expose existing regenerate as Retry
  ---
  duration_ms: 0.3355
  type: 'test'
  ...
# Subtest: the same rendered Retry then Send callbacks share one admission gate
ok 3 - the same rendered Retry then Send callbacks share one admission gate
  ---
  duration_ms: 34.2965
  type: 'test'
  ...
# Subtest: rejected fetches clean up Send and Regenerate with one Retry bubble
ok 4 - rejected fetches clean up Send and Regenerate with one Retry bubble
  ---
  duration_ms: 33.474875
  type: 'test'
  ...
# Subtest: user-aborted transport rejection stays silent
ok 5 - user-aborted transport rejection stays silent
  ---
  duration_ms: 14.938958
  type: 'test'
  ...
# Subtest: document brief polling responses are guarded by a switch token
ok 6 - document brief polling responses are guarded by a switch token
  ---
  duration_ms: 0.195834
  type: 'test'
  ...
# Subtest: poll 19 empty cannot overwrite the rendered poll 20 ready brief
ok 7 - poll 19 empty cannot overwrite the rendered poll 20 ready brief
  ---
  duration_ms: 11.277875
  type: 'test'
  ...
# Subtest: dashboard nudge uses durable 1-document and 3-message eligibility without lifetime cap
ok 8 - dashboard nudge uses durable 1-document and 3-message eligibility without lifetime cap
  ---
  duration_ms: 0.468417
  type: 'test'
  ...
# Subtest: startCheckout records the intent before the request and records checkout failures
ok 9 - startCheckout records the intent before the request and records checkout failures
  ---
  duration_ms: 29.537583
  type: 'test'
  ...
# Subtest: plan-aware billing starts Checkout for Free→Plus
ok 10 - plan-aware billing starts Checkout for Free→Plus
  ---
  duration_ms: 6.463459
  type: 'test'
  ...
# Subtest: plan-aware billing starts Checkout for Free→Pro
ok 11 - plan-aware billing starts Checkout for Free→Pro
  ---
  duration_ms: 6.514958
  type: 'test'
  ...
# Subtest: plan-aware billing routes Plus→Pro through the billing change-plan flow
ok 12 - plan-aware billing routes Plus→Pro through the billing change-plan flow
  ---
  duration_ms: 4.22225
  type: 'test'
  ...
# Subtest: plan-aware billing sends Pro insufficient-credit actions to credit packs
ok 13 - plan-aware billing sends Pro insufficient-credit actions to credit packs
  ---
  duration_ms: 5.880542
  type: 'test'
  ...
# Subtest: anonymous Quote Finder hint opens auth before panel or private analytics
ok 14 - anonymous Quote Finder hint opens auth before panel or private analytics
  ---
  duration_ms: 0.510417
  type: 'test'
  ...
# Subtest: local upload precheck maps free to plus
ok 15 - local upload precheck maps free to plus
  ---
  duration_ms: 45.78575
  type: 'test'
  ...
# Subtest: backend FILE_TOO_LARGE maps free to plus
ok 16 - backend FILE_TOO_LARGE maps free to plus
  ---
  duration_ms: 18.709542
  type: 'test'
  ...
# Subtest: local upload precheck maps plus to pro
ok 17 - local upload precheck maps plus to pro
  ---
  duration_ms: 12.733209
  type: 'test'
  ...
# Subtest: backend FILE_TOO_LARGE maps plus to pro
ok 18 - backend FILE_TOO_LARGE maps plus to pro
  ---
  duration_ms: 10.1525
  type: 'test'
  ...
# Subtest: local upload precheck maps pro to no upgrade
ok 19 - local upload precheck maps pro to no upgrade
  ---
  duration_ms: 8.302
  type: 'test'
  ...
# Subtest: backend FILE_TOO_LARGE maps pro to no upgrade
ok 20 - backend FILE_TOO_LARGE maps pro to no upgrade
  ---
  duration_ms: 9.724291
  type: 'test'
  ...
# Subtest: top-tier collection caps also suppress downgrade CTAs
ok 21 - top-tier collection caps also suppress downgrade CTAs
  ---
  duration_ms: 7.968583
  type: 'test'
  ...
# Subtest: every terminal parse-worker code has specific copy in every locale
ok 22 - every terminal parse-worker code has specific copy in every locale
  ---
  duration_ms: 34.579916
  type: 'test'
  ...
# Subtest: signed-in demo session wall renders only upload exit to existing dashboard
ok 23 - signed-in demo session wall renders only upload exit to existing dashboard
  ---
  duration_ms: 49.196375
  type: 'test'
  ...
# Subtest: own-document wall renders both exits and preserves plan-aware upgrade
ok 24 - own-document wall renders both exits and preserves plan-aware upgrade
  ---
  duration_ms: 25.387292
  type: 'test'
  ...
# Subtest: New chat reuses current session with 0 assistant messages and zero users
ok 25 - New chat reuses current session with 0 assistant messages and zero users
  ---
  duration_ms: 17.673959
  type: 'test'
  ...
# Subtest: New chat reuses current session with 1 assistant messages and zero users
ok 26 - New chat reuses current session with 1 assistant messages and zero users
  ---
  duration_ms: 16.939
  type: 'test'
  ...
# Subtest: New chat uses live user messages, not stale render or row message_count
ok 27 - New chat uses live user messages, not stale render or row message_count
  ---
  duration_ms: 16.76575
  type: 'test'
  ...
# Subtest: nonempty demo create preserves original baseline, epoch and stored-pointer install
ok 28 - nonempty demo create preserves original baseline, epoch and stored-pointer install
  ---
  duration_ms: 11.121834
  type: 'test'
  ...
# Subtest: New chat does not reuse the temporary empty pane while switching sessions
ok 29 - New chat does not reuse the temporary empty pane while switching sessions
  ---
  duration_ms: 11.770458
  type: 'test'
  ...
# Subtest: deleting the last empty session still creates a real replacement
ok 30 - deleting the last empty session still creates a real replacement
  ---
  duration_ms: 11.742125
  type: 'test'
  ...
# Subtest: demo metadata resets on document change/reset and survives same-document locale refresh
ok 31 - demo metadata resets on document change/reset and survives same-document locale refresh
  ---
  duration_ms: 14.038041
  type: 'test'
  ...
# Subtest: anonymous demo code stays separate and session CTA keyboard activation does not bubble into New chat
ok 32 - anonymous demo code stays separate and session CTA keyboard activation does not bubble into New chat
  ---
  duration_ms: 0.382083
  type: 'test'
  ...
# Subtest: all session-limit copy keys are flat, nonempty and interpolated in all 11 locales
ok 33 - all session-limit copy keys are flat, nonempty and interpolated in all 11 locales
  ---
  duration_ms: 18.223917
  type: 'test'
  ...
# Subtest: session switching waits for initial restore and an in-flight switch
ok 34 - session switching waits for initial restore and an in-flight switch
  ---
  duration_ms: 13.197167
  type: 'test'
  ...
# Subtest: late session-switch response cannot install messages or accounting on another document
ok 35 - late session-switch response cannot install messages or accounting on another document
  ---
  duration_ms: 9.475
  type: 'test'
  ...
# Subtest: demo cap still offers upload during a same-document metadata refresh
ok 36 - demo cap still offers upload during a same-document metadata refresh
  ---
  duration_ms: 10.371583
  type: 'test'
  ...
# Subtest: failed session switch restores the loaded transcript and allows retry without counter writes
ok 37 - failed session switch restores the loaded transcript and allows retry without counter writes
  ---
  duration_ms: 9.707208
  type: 'test'
  ...
# Failed to load sessions, falling back to create: TypeError: initial GET failed
#     at TestContext.<anonymous> (/Users/mayijie/Projects/Code/010_DocTalk/frontend/tests/session-limit.test.cjs:363:20)
#     at async Test.run (node:internal/test_runner/test:1054:7)
#     at async Test.processPendingSubtests (node:internal/test_runner/test:744:7)
# Failed to create session: { code: 'SESSION_LIMIT_REACHED', detail: { limit: 3 }, status: 403 }
# Subtest: initial GET failure and capped create fallback allow exactly one explicit session retry GET
ok 38 - initial GET failure and capped create fallback allow exactly one explicit session retry GET
  ---
  duration_ms: 19.24675
  type: 'test'
  ...
# Subtest: unknown/foreign ownership (null) creates instead of reusing an empty transcript
ok 39 - unknown/foreign ownership (null) creates instead of reusing an empty transcript
  ---
  duration_ms: 12.276416
  type: 'test'
  ...
# Subtest: unknown/foreign ownership (foreign) creates instead of reusing an empty transcript
ok 40 - unknown/foreign ownership (foreign) creates instead of reusing an empty transcript
  ---
  duration_ms: 10.685167
  type: 'test'
  ...
# Subtest: failed retry preserves unknown ownership so New Chat still falls through to create
ok 41 - failed retry preserves unknown ownership so New Chat still falls through to create
  ---
  duration_ms: 12.095666
  type: 'test'
  ...
# Subtest: initial restore clears pending on success and rejects a changed session identity
ok 42 - initial restore clears pending on success and rejects a changed session identity
  ---
  duration_ms: 25.077917
  type: 'test'
  ...
# Subtest: cancelled initial restore releases immediately and its late finally cannot unlock a newer restore
ok 43 - cancelled initial restore releases immediately and its late finally cannot unlock a newer restore
  ---
  duration_ms: 16.901791
  type: 'test'
  ...
# Subtest: pending restore resets on document change/reset and survives same-document transient refresh
ok 44 - pending restore resets on document change/reset and survives same-document transient refresh
  ---
  duration_ms: 10.344084
  type: 'test'
  ...
# Subtest: session limit analytics include request document and demo context (false) outside reader routes
ok 45 - session limit analytics include request document and demo context (false) outside reader routes
  ---
  duration_ms: 10.983917
  type: 'test'
  ...
# Subtest: session limit analytics include request document and demo context (true) outside reader routes
ok 46 - session limit analytics include request document and demo context (true) outside reader routes
  ---
  duration_ms: 10.865833
  type: 'test'
  ...
# Subtest: unmount cancels a pending switch and its late completion cannot affect a newer restore
ok 47 - unmount cancels a pending switch and its late completion cannot affect a newer restore
  ---
  duration_ms: 12.098083
  type: 'test'
  ...
1..47
# tests 47
# suites 0
# pass 47
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 543.967083
```
