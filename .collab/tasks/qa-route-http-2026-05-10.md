# QA Route Inventory - 2026-05-10

App dir: `frontend/src/app`

| Metric | Count |
|---|---:|
| pageFiles | 55 |
| apiRouteFiles | 6 |
| templates | 55 |
| concreteRoutes | 81 |
| dynamicTemplates | 6 |

## Fetch Summary

Fetched: 76; skipped: 5

| Check | Count |
|---|---:|
| Fetch errors | 0 |
| Bad status | 0 |
| Missing title | 0 |
| Missing description | 0 |
| H1 issues | 0 |

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

## Fetch Results

| Route | Status | H1 | Title | Notes |
|---|---:|---:|---|---|
| `/about` | 200 | 1 | About DocTalk: Verified AI Document Chat \| DocTalk |  |
| `/admin` |  |  |  | gated route; rerun with --include-gated-fetch to fetch |
| `/alternatives/askyourpdf` | 200 | 1 | 7 Best AskYourPDF Alternatives in 2026 (Free &amp; Paid) \| DocTalk |  |
| `/alternatives/chatpdf` | 200 | 1 | 7 Best ChatPDF Alternatives in 2026 (Free &amp; Paid) \| DocTalk |  |
| `/alternatives/humata` | 200 | 1 | 5 Best Humata AI Alternatives in 2026 \| DocTalk |  |
| `/alternatives/notebooklm` | 200 | 1 | Best NotebookLM Alternatives for Documents \| DocTalk |  |
| `/alternatives` | 200 | 1 | Best Alternatives to ChatPDF, NotebookLM, Humata &amp; More \| DocTalk |  |
| `/alternatives/pdf-ai` | 200 | 1 | 7 Best PDF.ai Alternatives in 2026 (Free &amp; Paid) \| DocTalk |  |
| `/auth/error` | 200 | 1 | Sign In \| DocTalk |  |
| `/auth` | 200 | 1 | Sign In \| DocTalk |  |
| `/auth/verify-request` | 200 | 1 | Sign In \| DocTalk |  |
| `/billing` |  |  |  | gated route; rerun with --include-gated-fetch to fetch |
| `/blog/ai-contract-review-guide` | 200 | 1 | How to Review a Contract with AI: A Step-by-Step Guide \| DocTalk |  |
| `/blog/ai-document-analysis-languages` | 200 | 1 | AI Document Analysis in 11 Languages: How Cross-Lingual RAG Works \| DocTalk |  |
| `/blog/ai-document-security-privacy` | 200 | 1 | Is AI Document Chat Safe? Security and Privacy Guide for 2026 \| DocTalk |  |
| `/blog/ai-due-diligence-guide` | 200 | 1 | AI-Powered Due Diligence: Analyze Documents 10x Faster \| DocTalk |  |
| `/blog/ai-financial-report-analysis` | 200 | 1 | How to Analyze Financial Reports with AI: Annual Reports, 10-Ks, and Earnings \| DocTalk |  |
| `/blog/ai-hr-contract-review` | 200 | 1 | AI for HR: How to Review Employment Contracts and Policies Faster \| DocTalk |  |
| `/blog/ai-research-paper-summarizer` | 200 | 1 | How to Summarize a Research Paper with AI in Under 2 Minutes \| DocTalk |  |
| `/blog/best-ai-pdf-tools-2026` | 200 | 1 | 7 Best AI PDF Tools in 2026: A Detailed Comparison \| DocTalk |  |
| `/blog/best-ai-tools-academic-research-2026` | 200 | 1 | Best AI Tools for Academic Research in 2026: A Researcher&#x27;s Guide \| DocTalk |  |
| `/blog/chat-with-excel-spreadsheet-ai` | 200 | 1 | How to Analyze Excel Spreadsheets with AI: A Complete Guide \| DocTalk |  |
| `/blog/chat-with-powerpoint-ai` | 200 | 1 | How to Chat with a PowerPoint Presentation Using AI \| DocTalk |  |
| `/blog/chatpdf-alternatives-2026` | 200 | 1 | 7 Best ChatPDF Alternatives in 2026 (Free and Paid) \| DocTalk |  |
| `/blog/citation-highlighting-matters` | 200 | 1 | Why Citation Highlighting Matters in AI Document Analysis \| DocTalk |  |
| `/blog/free-ai-pdf-chat-no-signup` | 200 | 1 | Free AI PDF Chat — No Signup Required \| DocTalk |  |
| `/blog/how-to-chat-with-docx-ai` | 200 | 1 | How to Chat with Word Documents (DOCX) Using AI \| DocTalk |  |
| `/blog/how-to-chat-with-pdf-ai` | 200 | 1 | How to Chat with a PDF Using AI \| DocTalk |  |
| `/blog/how-to-chat-with-url-webpage-ai` | 200 | 1 | How to Chat with Any Webpage Using AI \| DocTalk |  |
| `/blog/notebooklm-alternatives-2026` | 200 | 1 | 5 Best NotebookLM Alternatives in 2026 \| DocTalk |  |
| `/blog/rag-explained-simple` | 200 | 1 | What Is RAG? How AI Document Chat Actually Works Under the Hood \| DocTalk |  |
| `/blog/category/guides` | 200 | 1 | Guides &amp; Tutorials on the DocTalk Blog \| DocTalk |  |
| `/blog/category/comparisons` | 200 | 1 | Comparisons on the DocTalk Blog \| DocTalk |  |
| `/blog/category/use-cases` | 200 | 1 | Use Cases on the DocTalk Blog \| DocTalk |  |
| `/blog/category/product` | 200 | 1 | Product Updates on the DocTalk Blog \| DocTalk |  |
| `/blog/category/ai-insights` | 200 | 1 | AI Insights on the DocTalk Blog \| DocTalk |  |
| `/blog` | 200 | 1 | DocTalk Blog: Guides, Comparisons &amp; Tips \| DocTalk |  |
| `/collections` |  |  |  | gated route; rerun with --include-gated-fetch to fetch |
| `/compare/askyourpdf` | 200 | 1 | DocTalk vs AskYourPDF Comparison \| DocTalk |  |
| `/compare/chatpdf` | 200 | 1 | DocTalk vs ChatPDF: Full Comparison (2026) \| DocTalk |  |
| `/compare/humata` | 200 | 1 | DocTalk vs Humata: AI Document Tool Comparison \| DocTalk |  |
| `/compare/notebooklm` | 200 | 1 | DocTalk vs NotebookLM: Which AI Document Tool? \| DocTalk |  |
| `/compare` | 200 | 1 | Compare DocTalk with ChatPDF, NotebookLM &amp; More \| DocTalk |  |
| `/compare/pdf-ai` | 200 | 1 | DocTalk vs PDF.ai: AI PDF Tool Comparison (2026) \| DocTalk |  |
| `/contact` | 200 | 1 | Contact DocTalk Support \| DocTalk |  |
| `/demo/earnings` | 200 | 1 | DocTalk — AI Document Chat with Cited Answers |  |
| `/demo/paper` | 200 | 1 | DocTalk — AI Document Chat with Cited Answers |  |
| `/demo/court` | 200 | 1 | DocTalk — AI Document Chat with Cited Answers |  |
| `/demo/10k` | 200 | 1 | DocTalk — AI Document Chat with Cited Answers |  |
| `/demo/contract` | 200 | 1 | DocTalk — AI Document Chat with Cited Answers |  |
| `/demo/alphabet-earnings` | 200 | 1 | DocTalk — AI Document Chat with Cited Answers |  |
| `/demo/attention-paper` | 200 | 1 | DocTalk — AI Document Chat with Cited Answers |  |
| `/demo/court-filing` | 200 | 1 | DocTalk — AI Document Chat with Cited Answers |  |
| `/demo` | 200 | 1 | Try DocTalk Free — Interactive Demo |  |
| `/document-diff` |  |  |  | gated route; rerun with --include-gated-fetch to fetch |
| `/features/citations` | 200 | 1 | AI Answers with Source Citations \| DocTalk |  |
| `/features/free-demo` | 200 | 1 | Free AI Document Chat Demo \| DocTalk |  |
| `/features/multi-format` | 200 | 1 | Chat with PDF, DOCX, PPTX, XLSX &amp; More \| DocTalk |  |
| `/features/multilingual` | 200 | 1 | AI Document Chat in 11 Languages \| DocTalk |  |
| `/features` | 200 | 1 | DocTalk Features: Citations, OCR &amp; 11 Languages \| DocTalk |  |
| `/features/performance-modes` | 200 | 1 | Flash and Pro AI Modes \| DocTalk |  |
| `/imprint` | 200 | 1 | Impressum \| DocTalk |  |
| `/` | 200 | 1 | DocTalk — AI Document Chat with Cited Answers |  |
| `/pricing` | 200 | 1 | DocTalk Pricing for Free, Plus, and Pro \| DocTalk |  |
| `/privacy` | 200 | 1 | Privacy Policy for DocTalk \| DocTalk |  |
| `/profile` |  |  |  | gated route; rerun with --include-gated-fetch to fetch |
| `/terms` | 200 | 1 | Terms of Service for DocTalk \| DocTalk |  |
| `/tools` | 200 | 1 | Free AI Document Tools \| DocTalk |  |
| `/tools/reading-time` | 200 | 1 | Reading Time Calculator - Estimate How Long to Read Any Text \| DocTalk |  |
| `/tools/word-counter` | 200 | 1 | Free Document Word Counter - Count Words in PDF, DOCX, TXT \| DocTalk |  |
| `/trust` | 200 | 1 | Trust &amp; Security at DocTalk \| DocTalk |  |
| `/use-cases/compliance` | 200 | 1 | AI Document Analysis for Compliance and Risk Teams \| DocTalk |  |
| `/use-cases/consultants` | 200 | 1 | AI Document Analysis for Consultants and Advisors \| DocTalk |  |
| `/use-cases/finance` | 200 | 1 | AI Financial Report Analysis \| DocTalk |  |
| `/use-cases/healthcare` | 200 | 1 | AI Document Analysis for Healthcare Professionals \| DocTalk |  |
| `/use-cases/hr-contracts` | 200 | 1 | AI Contract &amp; HR Document Review Tool \| DocTalk |  |
| `/use-cases/lawyers` | 200 | 1 | AI Legal Document Analysis \| DocTalk |  |
| `/use-cases` | 200 | 1 | Use Cases for Students, Legal, Finance &amp; HR \| DocTalk |  |
| `/use-cases/real-estate` | 200 | 1 | AI Document Analysis for Real Estate Professionals \| DocTalk |  |
| `/use-cases/students` | 200 | 1 | AI Research Paper Analysis for Students \| DocTalk |  |
| `/use-cases/teachers` | 200 | 1 | AI Document Analysis for Teachers and Educators \| DocTalk |  |

