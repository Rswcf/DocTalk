# DocTalk Feature Roadmap for Commercial Growth

**Date**: 2026-02-08
**Author**: Product Manager (AI-assisted research)

---

## Executive Summary

DocTalk currently offers a strong single-document PDF Q&A experience with citations, multi-model support, OCR, and a freemium credits system. However, the competitive landscape has shifted significantly: NotebookLM offers free multi-source cross-document Q&A, AskYourPDF supports multi-format documents with API access, and enterprise buyers demand team workspaces, SSO, and compliance certifications. This roadmap prioritizes features by revenue impact, implementation effort, and competitive necessity to maximize commercial growth over 90 days.

---

## 1. Feature Impact Matrix

| Feature | Revenue Impact | Effort (eng-weeks) | Competitive Necessity | Target Segment | Priority Score |
|---------|---------------|--------------------|-----------------------|----------------|---------------|
| **Multi-document / Collection Q&A** | HIGH | 3-4 | CRITICAL | Pro users, researchers | 10 |
| **Multi-format support (DOCX, PPTX, XLSX)** | HIGH | 2-3 | HIGH | All users | 9 |
| **API access (developer tier)** | HIGH | 3-4 | MEDIUM | Developers, enterprises | 9 |
| **Team workspaces** | HIGH | 4-6 | HIGH | Teams, enterprises | 8 |
| **Table/chart extraction** | MEDIUM | 3-4 | HIGH | Financial analysts, researchers | 8 |
| **Document comparison (diff)** | MEDIUM | 2-3 | MEDIUM | Legal, compliance | 7 |
| **Custom AI instructions per doc type** | MEDIUM | 1-2 | MEDIUM | Power users | 7 |
| **SSO (SAML/OIDC)** | HIGH | 2-3 | CRITICAL (enterprise) | Enterprise | 7 |
| **Chrome extension** | MEDIUM | 2-3 | HIGH | All users | 7 |
| **URL/webpage ingestion** | MEDIUM | 1-2 | MEDIUM | Researchers | 6 |
| **Slack/Teams integration** | MEDIUM | 3-4 | MEDIUM | Teams | 6 |
| **Document versioning** | LOW | 2-3 | LOW | Legal, compliance | 5 |
| **Audio overviews (podcast-style)** | MEDIUM | 4-6 | LOW | General users | 5 |
| **Email digests** | LOW | 1-2 | LOW | Retention play | 4 |
| **SOC 2 Type II** | HIGH (enterprise gate) | 12-18 months | HIGH (enterprise) | Enterprise | 4* (foundation laid: security logging, encryption at rest, SSRF protection, GDPR export, non-root Docker) |
| **Mobile PWA** | LOW | 2-3 | LOW | Mobile users | 3 |
| **Zapier/Make integration** | LOW | 1-2 | LOW | Automation users | 3 |

*SOC 2 scores low on priority because it's a long-term investment (12-18 months), not a sprint feature. However, it's a hard gate for enterprise deals.

---

## 2. Phase 1 (30 Days) -- Quick Wins with High Revenue Impact

### 2.1 Multi-Format Document Support

**What**: Accept DOCX, PPTX, XLSX, TXT, and Markdown files in addition to PDF.

**Why**: AskYourPDF and Humata already support multi-format. Users churning because they can't upload Word docs or spreadsheets is avoidable revenue loss. This removes a key objection at signup.

**Revenue Impact**: HIGH -- expands addressable use cases by ~40%. Students and business users frequently work with Word/PowerPoint.

**Implementation**:
- Backend: Add `python-docx`, `python-pptx`, `openpyxl` to parse pipeline
- Convert each format to structured text pages (preserve section/slide/sheet boundaries)
- Reuse existing chunking, embedding, and chat pipeline unchanged
- Frontend: Update upload dropzone to accept new MIME types, add file type icons
- Viewer: For non-PDF formats, show a text/HTML rendered view instead of react-pdf (or convert to PDF server-side for consistent viewing)

**Effort**: 2-3 eng-weeks
**Risk**: Low -- parsing libraries are mature. Main complexity is viewer experience for non-PDF.

### 2.2 Document Collections & Cross-Document Q&A

**What**: Allow users to group documents into "collections" (folders/projects) and ask questions across all documents in a collection simultaneously.

**Why**: This is the single most impactful differentiation feature. NotebookLM popularized multi-source Q&A and users expect it. Currently DocTalk is limited to single-document chat, which is the #1 competitive disadvantage.

**Revenue Impact**: HIGH -- unlocks research, legal discovery, and financial analysis use cases that require cross-referencing multiple documents.

**Implementation**:
- DB: New `Collection` model (id, user_id, name, created_at). Junction table `collection_documents` (collection_id, document_id)
- Qdrant: Already supports filtering by metadata. Add `collection_id` to chunk metadata, or query across multiple document IDs using Qdrant `should` filter
- Chat: New endpoint `POST /api/collections/{collection_id}/chat` that retrieves from all documents in the collection. Citations include document name + page
- Frontend: Collection management UI (create, add/remove docs, rename). Collection chat view with document-aware citations
- Migration: Existing single-doc chat remains unchanged

**Effort**: 3-4 eng-weeks
**Risk**: Medium -- Qdrant query across many documents may need performance tuning. Citation UX becomes more complex with multi-doc references.

### 2.3 Custom AI Instructions / Personas

**What**: Users can set custom system prompts per document or per collection. Examples: "You are a legal analyst. Focus on obligations and deadlines." or "Respond in bullet points with specific dollar amounts."

**Why**: Low-effort, high-perceived-value feature that power users love. Increases engagement and perceived intelligence of the AI.

**Revenue Impact**: MEDIUM -- differentiator for power users, increases Pro conversion.

**Implementation**:
- DB: Add `custom_instructions TEXT` to `Session` or `Document` model
- Chat service: Prepend custom instructions to system prompt
- Frontend: Settings panel in chat sidebar with textarea for instructions, with preset templates

**Effort**: 1-2 eng-weeks
**Risk**: Very low.

### 2.4 URL / Webpage Ingestion

**What**: Paste a URL and DocTalk fetches, parses, and indexes the webpage content for chat.

**Why**: Researchers frequently want to chat with web articles, arXiv papers (HTML), and blog posts. Easy win that broadens use cases.

**Revenue Impact**: MEDIUM -- expands input sources without complex parsing.

**Implementation**:
- Backend: `trafilatura` or `readability-lxml` for clean text extraction from HTML
- Create a "virtual document" from extracted text, reuse existing pipeline
- Frontend: Add URL input option alongside file upload

**Effort**: 1-2 eng-weeks
**Risk**: Low -- web scraping can be unreliable for some sites, but best-effort is acceptable.

---

## 3. Phase 2 (60 Days) -- Differentiation Features

### 3.1 REST API for Developers

**What**: Public API with API keys for programmatic document upload, search, and chat. Separate "Developer" pricing tier.

**Why**: API access creates a new revenue stream and locks in technical users. PDF.ai and AskYourPDF both offer APIs. Developer integrations create sticky, high-LTV customers.

**Revenue Impact**: HIGH -- new revenue stream. API customers typically have 3-5x higher LTV than UI-only users.

**Implementation**:
- Auth: API key model (hashed keys in DB, `api_keys` table with user_id, key_hash, name, created_at, last_used)
- Rate limiting: Per-key rate limits using Redis (`sliding window`)
- Endpoints: Mirror existing REST endpoints under `/api/v1/` with API key auth
- SDK: Auto-generated OpenAPI spec, optional Python/JS SDK
- Billing: Per-request or per-credit billing for API calls
- Documentation: Auto-generated from OpenAPI spec

**Effort**: 3-4 eng-weeks
**Risk**: Medium -- need to design rate limiting, abuse prevention, and API key management carefully.

### 3.2 Table & Chart Extraction

**What**: Detect and extract tables from PDFs into structured data (CSV/JSON). Show tables inline in chat responses. Allow users to ask quantitative questions about tabular data.

**Why**: Financial analysts and researchers frequently need to extract and query tables. This is a high-value use case that justifies Pro pricing. Google Document AI and Reducto charge premium prices for this capability.

**Revenue Impact**: MEDIUM-HIGH -- targets high-value segments (finance, legal, research).

**Implementation**:
- Use PyMuPDF's table detection (`page.find_tables()`) or integrate `camelot-py`/`tabula-py`
- Store extracted tables as structured metadata alongside chunks
- Enhanced prompt engineering: Include table data in context when relevant
- Frontend: Render extracted tables in chat responses with copy-to-clipboard

**Effort**: 3-4 eng-weeks
**Risk**: Medium -- table extraction accuracy varies significantly across PDF layouts.

### 3.3 Document Comparison

**What**: Upload two versions of a document and get AI-powered diff highlighting: what changed, what was added/removed, and semantic analysis of the changes.

**Why**: Legal professionals and compliance teams need this constantly (contract redlining, policy updates). Few AI tools do this well.

**Revenue Impact**: MEDIUM -- niche but high-value. Could command premium pricing.

**Implementation**:
- Backend: Chunk-level semantic diff using embedding similarity between two documents
- AI summary of changes with citations to both documents
- Frontend: Side-by-side view with highlighted differences

**Effort**: 2-3 eng-weeks
**Risk**: Medium -- defining "meaningful change" requires tuning.

### 3.4 Chrome Extension

**What**: Browser extension that lets users right-click any PDF or webpage and send it to DocTalk for AI chat.

**Why**: AskYourPDF's Chrome extension is a major acquisition channel. Reduces friction from "find PDF -> download -> upload to DocTalk" to "right-click -> chat."

**Revenue Impact**: MEDIUM -- primarily an acquisition and engagement tool.

**Implementation**:
- Manifest V3 Chrome extension
- Context menu integration for PDFs and web pages
- Auth: Use existing session token or API key
- Popup UI for quick questions, link to full app for deep analysis

**Effort**: 2-3 eng-weeks
**Risk**: Low -- well-understood technology, but Chrome Web Store review process adds time.

---

## 4. Phase 3 (90 Days) -- Enterprise & Scale

### 4.1 Team Workspaces

**What**: Shared workspaces where team members can collaborate on documents, share chat sessions, and manage permissions.

**Why**: Team features are the primary driver of B2B revenue. Adobe PDF Spaces, Box AI, and Glean all center on collaborative document intelligence. This is required to move from individual Pro subscriptions to team/enterprise deals.

**Revenue Impact**: HIGH -- enables B2B sales motion. Team plans typically 3-10x individual pricing.

**Implementation**:
- DB: `Team` model (id, name, owner_id), `TeamMember` (team_id, user_id, role), team-level documents
- Auth: Role-based access (owner, admin, member, viewer)
- Shared documents visible to all team members
- Shared chat sessions with attribution
- Team billing: Per-seat pricing via Stripe
- Frontend: Team switcher in header, team document list, invite flow

**Effort**: 4-6 eng-weeks
**Risk**: Medium-high -- RBAC and multi-tenant data isolation require careful design.

### 4.2 SSO (SAML/OIDC)

**What**: Enterprise single sign-on support for Okta, Azure AD, Google Workspace, and other identity providers.

**Why**: SSO is a hard requirement for enterprise procurement. No SSO = no enterprise deal, period. Every enterprise buyer's checklist starts here.

**Revenue Impact**: HIGH -- unlocks enterprise segment entirely.

**Implementation**:
- Auth.js v5 supports additional providers. Add SAML provider via `@auth/saml` or `passport-saml`
- Per-tenant SSO configuration stored in DB
- Admin UI for SSO setup (metadata URL, certificate upload)
- SCIM provisioning for automated user lifecycle management

**Effort**: 2-3 eng-weeks for basic SSO, +2 weeks for SCIM
**Risk**: Medium -- SSO debugging across different IdPs is notoriously painful.

### 4.3 Structured Data Extraction

**What**: Extract key fields from documents into structured JSON (dates, amounts, parties, obligations, key terms). Users define extraction schemas or use templates.

**Why**: Moves DocTalk from "chat with docs" to "process docs at scale." This is the bridge to enterprise document processing workflows.

**Revenue Impact**: MEDIUM-HIGH -- high value for legal, finance, procurement teams.

**Implementation**:
- Template system: Predefined extraction schemas (invoice, contract, financial report)
- LLM-based extraction with JSON mode output
- Batch processing: Extract from multiple documents using the same schema
- Export: CSV, JSON, or direct API response

**Effort**: 3-4 eng-weeks
**Risk**: Medium -- extraction accuracy varies. Need good error handling and confidence scores.

### 4.4 Slack/Teams Integration

**What**: Bot that allows users to ask questions about their DocTalk documents directly in Slack or Microsoft Teams channels.

**Why**: Reduces friction for team adoption. Meets users where they already work.

**Revenue Impact**: MEDIUM -- retention and engagement driver for team customers.

**Implementation**:
- Slack App: OAuth installation, slash commands (`/doctalk ask "question" in "collection"`)
- Teams Bot: Bot Framework integration
- Backend: Service layer already exists, need thin integration layer

**Effort**: 3-4 eng-weeks (Slack first, Teams adds +2 weeks)
**Risk**: Low-medium -- well-documented APIs, but ongoing maintenance burden.

### 4.5 SOC 2 Readiness (Initiate)

**What**: Begin SOC 2 Type I preparation. Implement required controls: audit logging, access reviews, encryption-at-rest verification, incident response procedures.

**Why**: SOC 2 is the minimum compliance certification for enterprise SaaS. Without it, security reviews will block procurement. Starting early is critical because Type I takes ~6 months and Type II takes 12-18 months.

**Revenue Impact**: HIGH (gating) -- required for any enterprise deal >$50K ARR.

**Implementation (Phase 3 scope: preparation only)**:
- ~~Audit logging: Log all data access, auth events, admin actions to structured log store~~ **DONE** — `security_log.py` emits structured JSON for auth failures, rate limits, SSRF blocks, uploads, deletions, account deletions
- Access control documentation
- ~~Data encryption verification (at rest and in transit)~~ **DONE** — SSE-S3 encryption on all MinIO objects + bucket default policy; HTTPS enforced in transit
- ~~SSRF protection~~ **DONE** — `url_validator.py` validates all URL imports against private IP ranges and internal ports
- ~~Non-root container~~ **DONE** — Docker runs as `app` user (UID 1001)
- ~~GDPR data portability~~ **DONE** — `GET /api/users/me/export` endpoint
- ~~OAuth token minimization~~ **DONE** — access/refresh/id tokens stripped on save
- Vendor risk assessment for Railway, Vercel, OpenRouter
- Engage compliance automation tool (Vanta, Drata, or Scytale)
- Target: SOC 2 Type I audit engagement by end of Phase 3

**Effort**: ~1 eng-week remaining (vendor assessment + compliance tooling), down from 2-3 weeks originally
**Risk**: Low technical risk (most controls already implemented), remaining work is process and documentation.

---

## 5. Technical Dependencies & Architecture Implications

### 5.1 Multi-Document Q&A Architecture

**Current state**: Qdrant collections store chunks per-document with `document_id` metadata. Chat queries filter by single document_id.

**Required changes**:
- Qdrant query with `should` filter across multiple document_ids (already supported)
- Citation system must include document reference (filename + page) not just page number
- Context window management: With 8 chunks from N documents, may need to increase top_k or use reranking
- Consider a reranker (e.g., Cohere Rerank or cross-encoder) for multi-doc retrieval quality

### 5.2 Multi-Format Parsing Pipeline

**Current state**: PyMuPDF (fitz) for PDF extraction.

**Required changes**:
- Factory pattern: `get_parser(file_type)` returns appropriate parser
- Each parser must output normalized `Page` objects (page_number, text, optional bboxes)
- Non-PDF formats won't have pixel-level bboxes -- citations link to page/section instead
- Viewer component must handle non-PDF rendering (HTML preview or server-side PDF conversion)

### 5.3 API Layer

**Current state**: All endpoints behind Auth.js session-based auth with JWT proxy.

**Required changes**:
- Dual auth: Session (UI) + API key (programmatic). `get_current_user` dependency checks both
- API key table with hashed keys, rate limit metadata
- OpenAPI spec already auto-generated by FastAPI -- needs cleanup for public consumption
- Versioned endpoints (`/api/v1/`) to allow breaking changes

### 5.4 Team/Multi-Tenant Data Model

**Current state**: All data scoped to `user_id`. No team/org concept.

**Required changes**:
- Documents owned by user OR team (polymorphic ownership)
- Query layer: "my documents" = personal + all teams I belong to
- Session isolation: team members can see shared docs but have private chat sessions by default
- Billing: Transition from per-user credits to per-team seat licensing

### 5.5 Infrastructure Scaling

**Current state**: Single Railway container (uvicorn + Celery), single Qdrant instance.

**Anticipated needs**:
- Phase 1-2: Current infra sufficient with minor tuning
- Phase 3 (teams): Need separate Celery scaling, potentially Qdrant cluster mode
- API access: Redis rate limiting, potentially API gateway (Kong/Tyk)
- SOC 2: Structured logging (e.g., Datadog/Loki), audit trail storage

---

## 6. Features to AVOID (Low ROI or Scope Creep Risks)

### 6.1 Audio Overviews / Podcast Generation

**Why avoid (for now)**: NotebookLM does this for free and exceptionally well. Competing on audio would require significant TTS investment with minimal differentiation. NotebookLM's interactive podcast feature (users can "join" the conversation) sets an extremely high bar. Better to focus on areas where NotebookLM is weak (citations with page highlights, OCR, multi-model choice, privacy).

**Revisit when**: TTS costs drop significantly or if a white-label TTS API makes this trivial.

### 6.2 Full Mobile Native App

**Why avoid**: PWA or responsive web covers 90% of mobile use cases. Native app development (iOS + Android) is a 3-6 month effort with ongoing maintenance. Document AI is primarily a desktop workflow.

**Alternative**: Ensure responsive web works well on mobile. Consider PWA with offline support later.

### 6.3 Document Editing / Annotation

**Why avoid**: Competes with Adobe Acrobat, Google Docs, and Microsoft Office -- mature products with decades of development. DocTalk's value is AI-powered reading and analysis, not editing.

**Alternative**: Export extracted insights to editable formats.

### 6.4 Image Generation from Documents

**Why avoid**: Not aligned with DocTalk's core value proposition. Adds complexity without clear revenue impact.

### 6.5 General-Purpose AI Chat (without documents)

**Why avoid**: Competes with ChatGPT, Claude, and every other chat interface. DocTalk's moat is document-grounded, cited responses. Diluting this with general chat weakens positioning.

### 6.6 Zapier/Make Integrations (Phase 1-2)

**Why avoid early**: Low demand signal, small addressable market for document AI automation. API access (Phase 2) is the prerequisite and covers most automation use cases. Zapier integration can be a Phase 4+ initiative.

### 6.7 Blockchain-Based Document Verification

**Why avoid**: No meaningful customer demand. Adds complexity without revenue impact. Marketing buzzword with no proven ROI in document AI.

---

## 7. Revenue Projection by Phase

### Phase 1 (Month 1): Foundation Expansion
- Multi-format support removes friction for ~40% of potential signups
- Cross-document Q&A is the #1 feature gap vs. NotebookLM
- Custom instructions increase Pro conversion by estimated 10-15%
- **Expected impact**: +20-30% signup conversion, +10-15% Free-to-Pro upgrade

### Phase 2 (Month 2): New Revenue Streams
- API access creates developer tier ($49-99/mo)
- Table extraction justifies premium pricing for financial/legal users
- Chrome extension is a low-CAC acquisition channel
- **Expected impact**: New developer revenue stream, +15-20% Pro upgrades

### Phase 3 (Month 3): Enterprise Readiness
- Team workspaces enable B2B sales ($20-50/seat/mo)
- SSO unlocks enterprise procurement
- SOC 2 preparation removes compliance blockers
- **Expected impact**: First enterprise deals, team plan revenue

---

## 8. Competitive Positioning Summary

| Competitor | Strengths | DocTalk Advantages |
|-----------|-----------|-------------------|
| **NotebookLM** | Free, multi-source, audio overviews, Google ecosystem | Precise page-level citations with bbox highlights, model choice (9 models with model-adaptive prompts), OCR, privacy (self-hosted option), encryption at rest, GDPR data export, security hardening, Pro features |
| **ChatPDF** | Simple UX, low price ($5/mo) | Multi-model choice, dark mode, multi-session, auto-summary, streaming indicators |
| **AskYourPDF** | Multi-format, API, Chrome extension, GPT plugin | Better citation UX (hover preview, page highlights), cleaner UI, multi-language |
| **Humata** | Research-focused, multi-format | Better citation accuracy (small chunks), more model options, credits transparency |
| **PDF.ai** | API + embeddable widget, team features | Open-source potential, better AI model flexibility, lower pricing |

### DocTalk's Defensible Moat (Post-Roadmap)

1. **Citation precision**: Small-chunk retrieval + bbox page highlights -- the most precise citation UX in the market
2. **Model flexibility**: 9+ LLM models via OpenRouter, user's choice, with model-adaptive prompts and benchmark-validated per-model tuning
3. **Multi-format + multi-document**: Combined with citation precision, creates unique value
4. **API + UI**: Serves both end-users and developers
5. **Privacy & Security**: Self-hostable architecture, no training on user data, encryption at rest (SSE-S3), SSRF protection, GDPR data export, cookie consent, structured security logging, non-root Docker, OAuth token minimization

---

## 9. Implementation Sequence (Gantt Overview)

```
Week 1-2:  [Multi-format parsing (DOCX/PPTX/XLSX)]
Week 2-3:  [Custom AI instructions] [URL ingestion]
Week 3-6:  [Collections + Cross-document Q&A]
Week 5-8:  [API access + API keys]
Week 6-8:  [Table extraction]
Week 7-9:  [Chrome extension]
Week 8-10: [Document comparison]
Week 9-12: [Team workspaces + RBAC]
Week 10-12: [SSO (SAML/OIDC)]
Week 11-12: [SOC 2 prep + audit logging]
Week 12+:  [Slack integration] [Structured extraction]
```

---

## 10. Key Metrics to Track

| Metric | Phase 1 Target | Phase 2 Target | Phase 3 Target |
|--------|---------------|---------------|---------------|
| Signup conversion | +25% | +35% | +45% |
| Free-to-Pro upgrade rate | 5% | 8% | 12% |
| Monthly churn (Pro) | <8% | <6% | <5% |
| Documents per user | 3 | 5 | 8 |
| API revenue (new) | -- | $2K MRR | $8K MRR |
| Team accounts | -- | -- | 10+ |
| NPS score | 40 | 50 | 60 |

---

## Sources

Research was informed by analysis of the following:

- [7 Best AI Tools for Chatting with PDF in 2026](https://kripeshadwani.com/best-ai-tools-for-chatting-with-pdf/) -- Kripesh Adwani
- [Best ChatPDF Alternative in 2026](https://denser.ai/blog/chatpdf-alternative/) -- Denser.ai
- [Best AI For Document Analysis: 2026 Comparison](https://customgpt.ai/best-ai-for-document-analysis/) -- CustomGPT
- [NotebookLM Audio Overviews](https://blog.google/technology/ai/notebooklm-audio-overviews/) -- Google Blog
- [AI in SaaS in 2026](https://qrvey.com/blog/ai-in-saas/) -- Qrvey
- [SOC 2 Compliance Checklist for 2026](https://scytale.ai/center/soc-2/the-soc-2-compliance-checklist/) -- Scytale
- [AI Document Analysis: Transforming Enterprise Collaboration](https://docanalyzer.ai/blog/2025/07/ai-document-analysis-tools-how) -- DocAnalyzer
- [Major AI Documentation Trends for 2026](https://document360.com/blog/ai-documentation-trends/) -- Document360
- [AskYourPDF Chrome Extension](https://askyourpdf.com/extension) -- AskYourPDF
- [Table Extraction using LLMs](https://nanonets.com/blog/table-extraction-using-llms-unlocking-structured-data-from-documents/) -- Nanonets
- [12 Best AI Document Management Software 2026](https://thedigitalprojectmanager.com/tools/best-ai-document-management-software/) -- Digital Project Manager
- [Compliance Frameworks for AI Infrastructure](https://introl.com/blog/compliance-frameworks-ai-infrastructure-soc2-iso27001-gdpr) -- Introl
