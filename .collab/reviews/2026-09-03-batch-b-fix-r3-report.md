# Batch B reparse lock-order fix — r3 report

Date: 2026-09-03  
Branch/starting HEAD supplied by the task: `fix/growth-batch-b` / `def8d24`  
Scope: close Batch B Codex r2 finding 2 by changing reparse only to the global row-lock order `documents` before `users`.

## Implemented reparse sequence

1. `backend/app/api/documents.py:878-883` now selects the `Document` row with `.with_for_update(key_share=True)`, which the project's PostgreSQL dialect renders as `FOR NO KEY UPDATE`. `populate_existing=True` makes the locked database row authoritative even if the session identity map already contains that document.
2. `backend/app/api/documents.py:884-896` validates owner and status only from that locked row. Missing/wrong-owner rolls back and returns the unchanged `DOCUMENT_NOT_FOUND_DETAIL` 404 contract. A locked status outside `ready`/`error` rolls back and returns the unchanged `DOCUMENT_PROCESSING` 409 shape. The old unlocked `db.get`, `db.refresh`, and second status check are gone.
3. `backend/app/api/documents.py:898-917` locks `users` and performs the live-slot count only when the locked document status is `error`. The locked plan remains authoritative for `document_capacity_error_detail(..., errored_count=0)`. A `ready` document skips the user lock because it already occupies a live slot.
4. `backend/app/api/documents.py:927-943` retains the conditional UPDATE, including `Document.status.in_(("ready", "error"))`, then commits before calling `.delay()`. The predicate remains the documented claim contract even though the preceding document lock now serializes same-document reparses.

## Why this closes the cycle

Deletion still locks the parent document `FOR UPDATE`, holds it across the awaited fresh-session resolver, and lets that resolver update `users`; none of that code changed.

- If deletion locks the document first, reparse blocks on `FOR NO KEY UPDATE` before acquiring any user lock. The resolver can therefore update the user, deletion can commit its cascade, and the reparse's locked SELECT then observes no document and returns 404.
- If reparse locks the document first, an errored reparse next locks the user, counts, claims, and commits. Deletion waits at its first document lock and cannot reach the resolver until reparse has released both rows.
- Different-document errored reparses still lock their own document rows independently and then serialize on the shared user row. Because count and claim remain after the user lock under READ COMMITTED, the loser sees the winner's committed `parsing` row in the live count.
- Ready reparses never need a user lock, eliminating an unnecessary participant while preserving their already-counted slot semantics.

The former invisible cycle (`reparse: users -> documents`; `delete: documents -> awaited resolver`; `resolver: users`) therefore has no user-before-document reparse edge.

## Lock strength rationale

SQLAlchemy `.with_for_update(key_share=True)` compiles here to `FOR NO KEY UPDATE`; this rendering is asserted at `backend/tests/test_document_slots.py:64-79`.

`FOR NO KEY UPDATE` is the strength the later status/locale UPDATE takes. It conflicts with deletion's `FOR UPDATE` and another reparse's `FOR NO KEY UPDATE`, providing exactly the required parent/reparse serialization. It remains compatible with the `FOR KEY SHARE` parent protection taken by concurrent child inserts, so a new chat session, page/chunk, or saved quote is not stalled for the whole reparse transaction. Plain `FOR UPDATE` would add that unwanted conflict class.

## Regression coverage

- `backend/tests/test_predebited_job_deletion_integration.py:208-315` adds the real-Postgres cycle regression. It creates an errored document with a queued `DocumentJob` and unreconciled predebit ledger, monkeypatches `_settle_extraction_predebit_after_failure_sync` to wait on a thread event while delete holds the parent, starts reparse with `SET LOCAL lock_timeout = '2s'`, and uses `pg_stat_activity.wait_event_type = 'Lock'` to prove reparse has reached the document-row wait before releasing the resolver. It asserts delete completes, reparse preserves the post-delete 404 contract, the balance is refunded, and the document/job/ledger are removed. With the old user-first order, the reparse holds `users` while waiting on the document and raises a lock timeout.
- `backend/tests/test_document_slots_integration.py:93-151` adds a same-document real-Postgres race: two concurrent reparses produce exactly one claim/dispatch and one `DOCUMENT_PROCESSING` 409.
- `backend/tests/test_document_slots.py:116-144` proves a ready reparse performs only the document-lock scalar query and no users lock.
- `backend/tests/test_document_slots.py:42-79` retains and extends the full-live-slot error case: it uses the locked plan, returns 403, leaves the document `error`, and now also asserts document-before-user SQL and `FOR NO KEY UPDATE` rendering.
- `backend/tests/test_document_slots.py:147-164` verifies the status from the locked row is the source of the 409 path.
- `backend/tests/test_error_taxonomy.py:715-723` updates the endpoint taxonomy fixture to supply the document through the new locked scalar query and preserves the public 409 error contract.

The integration tests were written and collected, but could not be executed in this sandbox because real-Postgres integration tests require Docker and the suite defaults `SKIP_INTEGRATION=1`. They are included among the 54 skips below and must be run by the project owner with integration tests enabled.

## Required gates — exact final output

### Backend pytest

Command:

```text
cd /Users/mayijie/Projects/Code/010_DocTalk/backend && /usr/bin/python3 -m pytest -q
```

Output (exit 0):

```text
....................................ss.................................. [  7%]
........................................................................ [ 15%]
............................s........................................... [ 22%]
............................................................ss......ssss [ 30%]
ssssss.................................................................. [ 37%]
..........................s.s...............s.......ssss................ [ 45%]
................................s....................................... [ 52%]
...........................sss..........................sssssss......... [ 60%]
.........................................ssssssssssss................... [ 67%]
........................................................................ [ 75%]
........................................................................ [ 82%]
..........................................................ssssss........ [ 90%]
.......................s................................................ [ 97%]
.................ss...                                                   [100%]
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
904 passed, 54 skipped, 15 warnings in 4.53s
sys:1: DeprecationWarning: builtin type swigvarlink has no __module__ attribute
```

### Ruff

Command:

```text
cd /Users/mayijie/Projects/Code/010_DocTalk/backend && python3.12 -m ruff check app/ tests/
```

Output (exit 0):

```text
All checks passed!
```

### Frontend production build

Command:

```text
cd /Users/mayijie/Projects/Code/010_DocTalk/frontend && npm run build
```

Output (exit 0):

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
├ ○ /compare/humata                        321 B           176 kB
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
  ├ chunks/4661-bb0166e044393746.js         103 kB
  ├ chunks/fd9d1056-f9e81e1c5db09f1d.js     53.8 kB
  └ other shared chunks (total)             8.28 kB

○  (Static)   prerendered as static content
●  (SSG)      prerendered as static HTML (uses getStaticProps)
ƒ  (Dynamic)  server-rendered on demand
```

## Scope confirmation

No changes were made to document deletion, predebit settlement/resolution, extraction billing, upload/import paths, advisory lock namespaces 947/948, or frontend source. No git command was run.
