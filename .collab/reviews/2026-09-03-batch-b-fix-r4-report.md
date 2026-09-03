# Batch B fix round 4 implementation report

Date: 2026-09-03  
Branch/starting HEAD supplied by planning authority: `fix/growth-batch-b` / `aefba60`  
Scope: close finding 1 in `.collab/dialogue/2026-09-03-batch-b-codex-r3.md`

## Change 1 — Domain Mode trial mutexes use `FOR NO KEY UPDATE`

Changed all four Domain Mode user-row serialization points from
`.with_for_update()` to `.with_for_update(key_share=True)`:

- `backend/app/services/domain_mode_access.py:77-79` — Free-plan Domain Mode claim.
- `backend/app/services/domain_mode_access.py:170-173` — async failed-extraction trial release.
- `backend/app/services/domain_mode_access.py:193-196` — sync failed-extraction trial release.
- `backend/app/services/domain_mode_access.py:225-228` — sync orphaned-extraction trial release.

On PostgreSQL, SQLAlchemy renders `with_for_update(key_share=True)` as `FOR NO KEY UPDATE` (and the
separate collection form with both `read=True, key_share=True` as `FOR KEY SHARE`). This was also
checked locally by compiling both statements with SQLAlchemy's PostgreSQL dialect.

The mutex semantics are preserved. `FOR NO KEY UPDATE` conflicts with another `FOR NO KEY UPDATE`,
`FOR SHARE`, and `FOR UPDATE`. Therefore two concurrent claims, a claim racing a release, and a claim
racing `debit_credits` still serialize: the credit-balance `UPDATE users SET credits_balance = ...`
takes a `FOR NO KEY UPDATE` row lock because it does not update the user's key. The only exclusion
removed is against `FOR KEY SHARE`. An FK key-share holder cannot participate in trial-slot
accounting: every read/insert/update of `feature_trial_usages` remains inside one of these user-row
mutexes. Consequently, weakening these four locks does not open a slot count/claim/release race.

The delete-time resolver's user-row demands are now at most `FOR NO KEY UPDATE` (refund, reconcile,
and trial release), so a transaction holding only an implicit user FK key-share cannot block that
resolver. None of these four mutexes was raised back to `FOR UPDATE`.

## Change 2 — `create_collection` locks document parents before inserting the collection

Changed `backend/app/api/collections.py:142-187`:

- `:142-152` parses UUIDs with the pre-existing `ValueError` skip behavior and deduplicates them.
- `:157-171` skips the query for an empty parsed list; otherwise it selects only owned, existing
  `Document.id` values, orders by `Document.id`, and locks them with
  `.with_for_update(read=True, key_share=True)` (`FOR KEY SHARE`).
- `:173-179` inserts and flushes the user-owned collection only after that locking read completes.
- `:181-187` inserts junction rows for exactly the IDs returned by the locking SELECT.

The returned rows, not the requested input list, define membership. This makes the adjudicated
delete-wins behavior race-free. If deletion already owns the document's `FOR UPDATE`, collection
creation waits before acquiring the collection INSERT's implicit users key-share. Once deletion
commits, PostgreSQL rechecks the locked row, the vanished document is not returned, and no junction
row is attempted for it. The collection is created without the deleted document, rather than
surfacing the old junction-FK violation. `FOR KEY SHARE` is deliberately no stronger than the lock
the junction FK needs, so it does not exclude a concurrent `FOR NO KEY UPDATE` reparse or another FK
key-share user such as chat-session creation.

No delete-side service, reparse ordering, add/remove/session/delete collection endpoint, import
path, frontend file, or timeout policy was changed.

## Integration regression added

Added
`backend/tests/test_predebited_job_deletion_integration.py:318-443`
(`test_delete_and_create_collection_complete_with_delete_winning`). It:

1. Creates a document with a queued, unreconciled extraction job and a job-owned Domain Mode trial.
2. Pauses the fresh-session extraction failure resolver on a thread event after document deletion
   has locked the parent.
3. Starts `create_collection` in another session with
   `SET LOCAL lock_timeout = '4s'`, including the deleting document, a malformed ID, and a duplicated
   surviving owned document.
4. Observes through `pg_stat_activity` that collection creation is waiting on a PostgreSQL lock,
   then releases the resolver event and requires both tasks to finish within eight seconds.
5. Asserts the delete committed, the collection was created, its exact membership is the one
   surviving document (once), the vanished document is absent, no FK exception surfaced, the
   predebit was refunded, the job/ledger were removed, and the trial was released.

This Docker-backed integration test could not be executed in the sandbox, as directed. The default
backend test gate skipped the repository's integration-marked tests; the new schedule must be run by
the planning authority in the Docker-enabled environment. Existing Domain Mode concurrency tests
remain in the suite and were included among those integration skips.

## Gate outputs

### Backend pytest

Command:

```text
cd /Users/mayijie/Projects/Code/010_DocTalk/backend && /usr/bin/python3 -m pytest -q
```

Exit code: `0`

Exact output:

```text
....................................ss.................................. [  7%]
........................................................................ [ 15%]
............................s........................................... [ 22%]
............................................................ss......ssss [ 30%]
ssssss.................................................................. [ 37%]
..........................s.s...............s.......ssss................ [ 45%]
................................s....................................... [ 52%]
...........................sss..........................ssssssss........ [ 60%]
..........................................ssssssssssss.................. [ 67%]
........................................................................ [ 75%]
........................................................................ [ 82%]
...........................................................ssssss....... [ 90%]
........................s............................................... [ 97%]
..................ss...                                                  [100%]
=============================== warnings summary ===============================
app/api/admin.py:958
  /Users/mayijie/Projects/Code/010_DocTalk/backend/app/api/admin.py:958: DeprecationWarning: `regex` has been deprecated, please use `pattern` instead
    period: str = Query("day", regex="^(day|week|month)$"),

app/api/admin.py:1094
  /Users/mayijie/Projects/Code/010_DocTalk/backend/app/api/admin.py:1094: DeprecationWarning: `regex` has been deprecated, please use `pattern` instead
    period: str = Query("day", regex="^(day|week|month)$"),

app/api/admin.py:2437
  /Users/mayijie/Projects/Code/010_DocTalk/backend/app/api/admin.py:2437: DeprecationWarning: `regex` has been deprecated, please use `pattern` instead
    by: str = Query("tokens", regex="^(tokens|credits|documents)$"),

../../../../Library/Python/3.9/lib/python/site-packages/urllib3/__init__.py:35
  /Users/mayijie/Library/Python/3.9/lib/python/site-packages/urllib3/__init__.py:35: NotOpenSSLWarning: urllib3 v2 only supports OpenSSL 1.1.1+, currently the 'ssl' module is compiled with 'LibreSSL 2.8.3'. See: https://github.com/urllib3/urllib3/issues/3020
    warnings.warn(

<frozen importlib._bootstrap>:228
<frozen importlib._bootstrap>:228
  <frozen importlib._bootstrap>:228: DeprecationWarning: builtin type SwigPyPacked has no __module__ attribute

<frozen importlib._bootstrap>:228
<frozen importlib._bootstrap>:228
  <frozen importlib._bootstrap>:228: DeprecationWarning: builtin type SwigPyObject has no __module__ attribute

<frozen importlib._bootstrap>:228
  <frozen importlib._bootstrap>:228: DeprecationWarning: builtin type swigvarlink has no __module__ attribute

app/schemas/chat.py:23
  /Users/mayijie/Projects/Code/010_DocTalk/backend/app/schemas/chat.py:23: PydanticDeprecatedSince20: Support for class-based `config` is deprecated, use ConfigDict instead. Deprecated in Pydantic V2.0 to be removed in V3.0. See Pydantic V2 Migration Guide at https://errors.pydantic.dev/2.12/migration/
    class ChatMessageResponse(BaseModel):

app/api/collections.py:46
  /Users/mayijie/Projects/Code/010_DocTalk/backend/app/api/collections.py:46: PydanticDeprecatedSince20: Support for class-based `config` is deprecated, use ConfigDict instead. Deprecated in Pydantic V2.0 to be removed in V3.0. See Pydantic V2 Migration Guide at https://errors.pydantic.dev/2.12/migration/
    class CollectionBrief(BaseModel):

app/api/users.py:39
  /Users/mayijie/Projects/Code/010_DocTalk/backend/app/api/users.py:39: PydanticDeprecatedSince20: Support for class-based `config` is deprecated, use ConfigDict instead. Deprecated in Pydantic V2.0 to be removed in V3.0. See Pydantic V2 Migration Guide at https://errors.pydantic.dev/2.12/migration/
    class UserMeResponse(BaseModel):

app/schemas/document.py:18
  /Users/mayijie/Projects/Code/010_DocTalk/backend/app/schemas/document.py:18: PydanticDeprecatedSince20: Support for class-based `config` is deprecated, use ConfigDict instead. Deprecated in Pydantic V2.0 to be removed in V3.0. See Pydantic V2 Migration Guide at https://errors.pydantic.dev/2.12/migration/
    class DocumentResponse(BaseModel):

tests/test_export_api.py::test_export_requires_auth
  /Users/mayijie/Projects/Code/010_DocTalk/backend/app/schemas/auth.py:18: PydanticDeprecatedSince20: Support for class-based `config` is deprecated, use ConfigDict instead. Deprecated in Pydantic V2.0 to be removed in V3.0. See Pydantic V2 Migration Guide at https://errors.pydantic.dev/2.12/migration/
    class UserResponse(BaseModel):

tests/test_export_api.py::test_export_requires_auth
  /Users/mayijie/Projects/Code/010_DocTalk/backend/app/schemas/auth.py:52: PydanticDeprecatedSince20: Support for class-based `config` is deprecated, use ConfigDict instead. Deprecated in Pydantic V2.0 to be removed in V3.0. See Pydantic V2 Migration Guide at https://errors.pydantic.dev/2.12/migration/
    class AccountResponse(BaseModel):

-- Docs: https://docs.pytest.org/en/stable/how-to/capture-warnings.html
904 passed, 55 skipped, 15 warnings in 4.51s
sys:1: DeprecationWarning: builtin type swigvarlink has no __module__ attribute
```

### Ruff

Command:

```text
cd /Users/mayijie/Projects/Code/010_DocTalk/backend && python3.12 -m ruff check app/ tests/
```

Exit code: `0`

Exact output:

```text
All checks passed!
```

### Frontend production build

Command:

```text
cd /Users/mayijie/Projects/Code/010_DocTalk/frontend && npm run build
```

Exit code: `0`

Exact output:

```text
> doctalk-frontend@0.28.1 build
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
┌ ○ /                                       9.26 kB         211 kB
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
  ├ chunks/4661-0ee8be6c9b89acd2.js         103 kB
  ├ chunks/fd9d1056-f9e81e1c5db09f1d.js     53.8 kB
  └ other shared chunks (total)             8.27 kB


○  (Static)   prerendered as static content
●  (SSG)      prerendered as static HTML (uses getStaticProps)
ƒ  (Dynamic)  server-rendered on demand
```

No Git command was run.
