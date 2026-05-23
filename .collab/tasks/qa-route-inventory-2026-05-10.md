# QA Route Inventory - 2026-05-10

App dir: `frontend/src/app`

| Metric | Count |
|---|---:|
| pageFiles | 55 |
| apiRouteFiles | 6 |
| templates | 55 |
| concreteRoutes | 81 |
| dynamicTemplates | 6 |

## Concrete Routes

| Route | Kind | Area | Template |
|---|---|---|---|
| `/about` | public | about | `/about` |
| `/admin` | gated | admin | `/admin` |
| `/alternatives/askyourpdf` | seo-public | alternatives | `/alternatives/askyourpdf` |
| `/alternatives/chatpdf` | seo-public | alternatives | `/alternatives/chatpdf` |
| `/alternatives/humata` | seo-public | alternatives | `/alternatives/humata` |
| `/alternatives/notebooklm` | seo-public | alternatives | `/alternatives/notebooklm` |
| `/alternatives` | seo-public | alternatives | `/alternatives` |
| `/alternatives/pdf-ai` | seo-public | alternatives | `/alternatives/pdf-ai` |
| `/auth/error` | auth | auth | `/auth/error` |
| `/auth` | auth | auth | `/auth` |
| `/auth/verify-request` | auth | auth | `/auth/verify-request` |
| `/billing` | gated | billing | `/billing` |
| `/blog/ai-contract-review-guide` | seo-content | blog | `/blog/[slug]` |
| `/blog/ai-document-analysis-languages` | seo-content | blog | `/blog/[slug]` |
| `/blog/ai-document-security-privacy` | seo-content | blog | `/blog/[slug]` |
| `/blog/ai-due-diligence-guide` | seo-content | blog | `/blog/[slug]` |
| `/blog/ai-financial-report-analysis` | seo-content | blog | `/blog/[slug]` |
| `/blog/ai-hr-contract-review` | seo-content | blog | `/blog/[slug]` |
| `/blog/ai-research-paper-summarizer` | seo-content | blog | `/blog/[slug]` |
| `/blog/best-ai-pdf-tools-2026` | seo-content | blog | `/blog/[slug]` |
| `/blog/best-ai-tools-academic-research-2026` | seo-content | blog | `/blog/[slug]` |
| `/blog/chat-with-excel-spreadsheet-ai` | seo-content | blog | `/blog/[slug]` |
| `/blog/chat-with-powerpoint-ai` | seo-content | blog | `/blog/[slug]` |
| `/blog/chatpdf-alternatives-2026` | seo-content | blog | `/blog/[slug]` |
| `/blog/citation-highlighting-matters` | seo-content | blog | `/blog/[slug]` |
| `/blog/free-ai-pdf-chat-no-signup` | seo-content | blog | `/blog/[slug]` |
| `/blog/how-to-chat-with-docx-ai` | seo-content | blog | `/blog/[slug]` |
| `/blog/how-to-chat-with-pdf-ai` | seo-content | blog | `/blog/[slug]` |
| `/blog/how-to-chat-with-url-webpage-ai` | seo-content | blog | `/blog/[slug]` |
| `/blog/notebooklm-alternatives-2026` | seo-content | blog | `/blog/[slug]` |
| `/blog/rag-explained-simple` | seo-content | blog | `/blog/[slug]` |
| `/blog/category/guides` | seo-content | blog | `/blog/category/[category]` |
| `/blog/category/comparisons` | seo-content | blog | `/blog/category/[category]` |
| `/blog/category/use-cases` | seo-content | blog | `/blog/category/[category]` |
| `/blog/category/product` | seo-content | blog | `/blog/category/[category]` |
| `/blog/category/ai-insights` | seo-content | blog | `/blog/category/[category]` |
| `/blog` | seo-content | blog | `/blog` |
| `/collections` | gated | collections | `/collections` |
| `/compare/askyourpdf` | seo-public | compare | `/compare/askyourpdf` |
| `/compare/chatpdf` | seo-public | compare | `/compare/chatpdf` |
| `/compare/humata` | seo-public | compare | `/compare/humata` |
| `/compare/notebooklm` | seo-public | compare | `/compare/notebooklm` |
| `/compare` | seo-public | compare | `/compare` |
| `/compare/pdf-ai` | seo-public | compare | `/compare/pdf-ai` |
| `/contact` | public | contact | `/contact` |
| `/demo/earnings` | public | demo | `/demo/[sample]` |
| `/demo/paper` | public | demo | `/demo/[sample]` |
| `/demo/court` | public | demo | `/demo/[sample]` |
| `/demo/10k` | public | demo | `/demo/[sample]` |
| `/demo/contract` | public | demo | `/demo/[sample]` |
| `/demo/alphabet-earnings` | public | demo | `/demo/[sample]` |
| `/demo/attention-paper` | public | demo | `/demo/[sample]` |
| `/demo/court-filing` | public | demo | `/demo/[sample]` |
| `/demo` | public | demo | `/demo` |
| `/document-diff` | gated | document-diff | `/document-diff` |
| `/features/citations` | seo-public | features | `/features/citations` |
| `/features/free-demo` | seo-public | features | `/features/free-demo` |
| `/features/multi-format` | seo-public | features | `/features/multi-format` |
| `/features/multilingual` | seo-public | features | `/features/multilingual` |
| `/features` | seo-public | features | `/features` |
| `/features/performance-modes` | seo-public | features | `/features/performance-modes` |
| `/imprint` | public | imprint | `/imprint` |
| `/` | public | home | `/` |
| `/pricing` | public | pricing | `/pricing` |
| `/privacy` | public | privacy | `/privacy` |
| `/profile` | gated | profile | `/profile` |
| `/terms` | public | terms | `/terms` |
| `/tools` | seo-public | tools | `/tools` |
| `/tools/reading-time` | seo-public | tools | `/tools/reading-time` |
| `/tools/word-counter` | seo-public | tools | `/tools/word-counter` |
| `/trust` | public | trust | `/trust` |
| `/use-cases/compliance` | seo-public | use-cases | `/use-cases/compliance` |
| `/use-cases/consultants` | seo-public | use-cases | `/use-cases/consultants` |
| `/use-cases/finance` | seo-public | use-cases | `/use-cases/finance` |
| `/use-cases/healthcare` | seo-public | use-cases | `/use-cases/healthcare` |
| `/use-cases/hr-contracts` | seo-public | use-cases | `/use-cases/hr-contracts` |
| `/use-cases/lawyers` | seo-public | use-cases | `/use-cases/lawyers` |
| `/use-cases` | seo-public | use-cases | `/use-cases` |
| `/use-cases/real-estate` | seo-public | use-cases | `/use-cases/real-estate` |
| `/use-cases/students` | seo-public | use-cases | `/use-cases/students` |
| `/use-cases/teachers` | seo-public | use-cases | `/use-cases/teachers` |

## Dynamic Templates Requiring Fixtures

| Template | Area | Fixture Requirement |
|---|---|---|
| `/collections/[collectionId]` | collections | existing collection id owned by current user |
| `/d/[documentId]` | reader | existing document id or demo document id |
| `/shared/[token]` | sharing | valid shared-session token |

## API Routes

| Route | Area | File | Fixture Requirement |
|---|---|---|---|
| `/api/auth/[...nextauth]` | api | `frontend/src/app/api/auth/[...nextauth]/route.ts` | path parameter and endpoint-specific auth/body |
| `/api/contact` | api | `frontend/src/app/api/contact/route.ts` |  |
| `/api/csp-report` | api | `frontend/src/app/api/csp-report/route.ts` |  |
| `/api/indexnow` | api | `frontend/src/app/api/indexnow/route.ts` |  |
| `/api/proxy/[...path]` | api | `frontend/src/app/api/proxy/[...path]/route.ts` | path parameter and endpoint-specific auth/body |
| `/api/upload-token` | api | `frontend/src/app/api/upload-token/route.ts` |  |

