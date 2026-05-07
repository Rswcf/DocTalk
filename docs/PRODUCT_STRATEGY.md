# DocTalk Product Strategy

**Date**: 2026-02-08
**Status**: Active

---

## 1. Executive Summary

DocTalk is an AI-powered document workbench with a unique competitive advantage: **citation-precise answers with bounding-box page highlights** — the most accurate citation UX in the market. As of `0.14.0 beta`, the product is moving beyond general-purpose chat by adding **Structured Extraction**, **Table Extraction**, **Deep Link Answer Share**, **Question Templates**, **Document Diff**, a cited **Document Brief** workspace, **Corrective RAG** that checks retrieval quality before generation, parser integrity improvements that preserve multi-column reading order and short-document chunks, table-aware RAG that brings scanned table rows into numeric answers, a deterministic query planner for comparison/multi-hop questions, and claim-level verification that reports whether generated answers are actually supported by their citations: users can turn a document into a cited deliverable, CSV-ready table data, a shareable cited answer, a reusable checklist, a cited semantic change report, a first-read structural brief, or a better-supported answer when exact names/numbers/comparisons need lexical, table, planned, balanced cross-document evidence, and post-generation quality checks. DocTalk can capture significant revenue in three high-value segments: **finance professionals** (highest willingness to pay), **legal professionals** (underserved solo/small firms), and **academic researchers** (largest addressable market with viral growth).

---

## 2. Market Opportunity Assessment

### Market Size
- Global AI document management SaaS: **$35B+ TAM** (2026), growing 25%+ YoY
- PDF AI chat tools specifically: **$2-3B addressable market**, fragmented across 15+ competitors
- Enterprise document AI (Hebbia, Harvey): **$500M+** segment at $3K-$10K/seat/year

### Market Dynamics
- **NotebookLM** (Google) offers free multi-source Q&A, raising baseline expectations for citation-backed answers
- **Enterprise buyers** increasingly demand team workspaces, SSO, and compliance certifications (SOC 2)
- **Multi-format** support (DOCX, PPTX, XLSX) becoming table stakes — users don't work exclusively with PDFs
- **API access** creating a new developer revenue stream (PDF.ai, AskYourPDF already offer this)
- **Cross-document Q&A** is the #1 missing capability vs. NotebookLM

### DocTalk's Position Today
- **Strengths**: Citation precision (small chunks + bbox highlights), query routing for whole-document summary vs local Q&A, deterministic query planning for comparison/multi-hop/multi-entity questions, persisted Document Briefs with cited outline/key-points/facts, corrective retrieval for exact terms/numbers, table-aware retrieval over scanned `document_tables`, balanced per-document evidence for collection comparison, claim-level RAG verification with admin quality reporting, parser integrity safeguards for simple two-column documents and concise source files, Structured Extraction with cited Markdown/CSV deliverables, Table Extraction with CSV export, Question Templates for repeat single-document and Pro collection checklist workflows, Pro Document Diff for cited semantic version comparison, per-answer deep link sharing for referral loops, 2 DeepSeek V4 modes (Flash=fast cited answers, Pro=deeper analysis) with model-adaptive prompts and per-model parameter tuning (benchmark-validated), OCR, dark mode, multi-language (11 languages), ChatGPT-style chat UI (stop generation, scroll-to-bottom, compact citation pills, "+" action menu, hover action buttons, styled code blocks with copy, antialiased typography, max-width centering), streaming indicators, auto-summary, security hardening (SSRF protection, SSE-S3 encryption at rest, file validation, structured security logging, GDPR data export, cookie consent, non-root Docker), branded email magic link with 11-locale i18n
- **Weaknesses**: No team features, no API, no SSO

---

## 3. Competitive Positioning

### Where DocTalk Wins Today
| vs. Competitor | DocTalk Advantage |
|----------------|-------------------|
| **NotebookLM** | Page-level bbox citations, Flash/Pro model choice, OCR, privacy, encryption at rest, GDPR data export |
| **ChatPDF** | Multi-model, dark mode, multi-session, auto-summary, streaming UX, cited extraction deliverables |
| **AskYourPDF** | Better citation UX (hover preview, page highlights), cleaner UI, multi-language, precise cited exports |
| **Humata** | Better citation accuracy (small chunks), more model options, credits transparency |
| **PDF.ai** | Better AI model flexibility, lower pricing, open-source potential |

### Where DocTalk Loses
| Gap | Impact | Fix Needed |
|-----|--------|-----------|
| ~~Single-document chat only~~ | ~~DONE~~ — Collections + cross-doc Q&A shipped | ~~Multi-document collections (Phase 1)~~ |
| ~~PDF-only~~ | ~~DONE~~ — DOCX/PPTX/XLSX/TXT/MD + URL import | ~~Multi-format parsing (Phase 1)~~ |
| No team features | HIGH — blocks B2B revenue | Team workspaces (Phase 3) |
| No API access | MEDIUM — developer segment lost | REST API (Phase 2) |
| No SSO | CRITICAL for enterprise | SAML/OIDC (Phase 3) |
| ~~Only 2 pricing tiers~~ | ~~DONE~~ — Free/Plus/Pro shipped | ~~Plus tier + Team tier~~ |

### Recommended Positioning Statement
> "DocTalk: AI document reader with the most precise citations in the market. Ask questions across your PDFs, get answers with exact page references and highlighted text. Trusted by finance analysts, lawyers, and researchers who need source-backed accuracy."

---

## 4. Target Segment Prioritization

### Priority 1: Finance & Investment Professionals
- **WTP**: $100-$500/seat/month (Hebbia: $3K-$10K/seat/year)
- **Fit**: NVIDIA 10-K already a demo document; DocTalk handles long SEC filings
- **Revenue potential**: 1,000 paying users × $50/month = **$600K ARR**
- **Key needs**: Table extraction, cross-quarter comparison, structured output, EDGAR integration
- **Channel**: FinTwit, LinkedIn, finance newsletters, r/CFA, r/FinancialCareers

### Priority 2: Legal Professionals (Solo/Small Firms)
- **WTP**: $50-$350/seat/month; solo firms can't afford Harvey ($100K+/year)
- **Fit**: NDA contract already a demo; citation accuracy = malpractice prevention
- **Revenue potential**: 5,000 lawyers × $30/month = **$1.8M ARR**
- **Key needs**: Clause extraction templates, contract comparison, due diligence batch processing
- **Channel**: Legal tech blogs, bar association events, G2/Capterra, LinkedIn outreach

### Priority 3: Academic Researchers & Students
- **WTP**: $10-$25/month individual; $100-$500/seat/year institutional
- **Fit**: Attention paper already a demo; 11-language support is a differentiator
- **Revenue potential**: 3-5K paid users × $12/month = **$432K-$720K ARR** + institutional licensing
- **Key needs**: Multi-paper Q&A, Zotero integration, literature review workflow
- **Channel**: #AcademicTwitter, Reddit r/GradSchool, YouTube tutorials, university partnerships

---

## 5. Pricing & Monetization Proposal

### Pricing Implementation Status
- ✅ **Credit rescaling deployed (÷10)**: All credit amounts reduced 10x for better unit economics (backend migration `20260210_0013_rescale_ledger.py`)
- ✅ **Free tier reduced to 300 credits**: Creates upgrade pressure without blocking trial usage
- ✅ **Plus tier launched ($9.99/month)**: Captures casual users between Free and Pro
- ✅ **Annual pricing with 20% discount**: Reduces churn and improves LTV
- ✅ **Credit packs repriced**: Boost/Power/Ultra now 1.2-2.4x more expensive per-credit than subscriptions, making subscriptions the better value
- ✅ **Feature gating deployed**: Free-plan Pro monthly cap, Export (Plus+), Custom Instructions (Pro), Sessions (Free=3/doc)
- ✅ **Cancellation feedback + refund review flow**: Billing cancel captures reason/feedback, optional refund-review intent, and exposes cancel/refund events in the admin funnel
- ✅ **7-day fair-use refund copy**: Pricing and Billing now set refund expectations before and after purchase
- ✅ **Structured Extraction launched (`0.3.0 beta`)**: Free users can try a limited number of cited extraction jobs; paid tiers continue through credit consumption and export value
- ✅ **Table Extraction launched (`0.4.0 beta`)**: Table previews are available after scan; CSV export is a Plus+ conversion lever for finance/research workflows
- ✅ **Deep Link Answer Share launched (`0.5.0 beta`)**: Every cited answer can become a precise shared link, adding low-friction referral loops while keeping private citation internals redacted
- ✅ **Question Templates launched (`0.6.0 beta`)**: Plus users can run reusable checklists on a document; Pro users can batch the same questions across Collections, creating repeat workflows and higher credit consumption
- ✅ **Document Diff launched (`0.7.0 beta`)**: Pro users can compare two ready documents and receive a cited semantic added/removed/modified report, directly targeting legal, compliance, and business review pain
- ✅ **Hierarchical Document Brief launched (`0.9.0 beta`)**: Every parsed document can expose a cited first-read workspace with summary, outline, key points, facts, and suggested questions, improving the first impression before users ask anything
- ✅ **Corrective RAG launched (`0.10.0 beta`)**: Ordinary chat now evaluates retrieval quality and applies scoped lexical fallback when vector top-k misses exact identifiers, numbers, existence checks, citation lookups, or exhaustive questions
- ✅ **Parser integrity launched (`0.11.0 beta`)**: Parsing now handles simple two-column reading order, preserves English block spacing, and keeps concise documents searchable instead of dropping all micro-chunks
- ✅ **Table-aware RAG launched (`0.12.0 beta`)**: Table/numeric chat routes now prioritize scanned table rows when available and keep short table chunks eligible for lexical fallback
- ✅ **Query Planner launched (`0.13.0 beta`)**: Comparison, multi-hop, and multi-entity metric questions now add planned subquery evidence and balanced per-document coverage for collection comparisons
- ✅ **Claim Verifier launched (`0.14.0 beta`)**: Chat answers now record claim-level citation verification signals and expose aggregate quality metrics in the admin dashboard
- ⏳ **Priority Queue**: Removed from pricing page pending implementation
- ⏳ **Team tier**: Planned for Phase 3 (requires workspace, RBAC, SSO features)

### Current Pricing Structure

| Tier | Monthly | Annual (save 20%) | Credits/mo | Documents | Models |
|------|---------|---------------------|-----------|-----------|--------|
| **Free** | $0 | — | 300 | 3 stored | Flash + limited Pro |
| **Plus** | $9.99 | $7.99/mo | 3,000 | 20 stored | Flash + Pro |
| **Pro** | $19.99 | $15.99/mo | 9,000 | Unlimited | Flash + Pro |
| **Team** (PLANNED) | $29.99/seat | $24.99/seat/mo | 200K/seat | Unlimited | Flash + Pro |
| **Enterprise** (PLANNED) | Custom | Custom | Custom | Unlimited | Flash + Pro + custom |

**Credit Packs** (one-time purchases, more expensive per-credit than subscriptions):
- **Boost**: 500 credits for $3.99 (0.798¢/credit)
- **Power**: 2,000 credits for $9.99 (0.500¢/credit)
- **Ultra**: 5,000 credits for $19.99 (0.400¢/credit)

For comparison, subscriptions range from 0.167¢/credit (Pro annual) to 0.333¢/credit (Plus monthly), making them 1.2-2.4x more cost-effective than packs.

**Refund trust policy**: users are told they can cancel within 7 days and request a fair-use refund review when usage is low. This is intentionally a review workflow, not an automatic refund promise.

### Key Changes (Completed)
1. **Reduced free tier** to 300 credits — creates upgrade pressure quickly
2. **Added Plus tier** ($9.99/month) — captures casual users who need more than Free but aren't power users
3. **Raised Pro price** to $19.99/month with 9,000 credits — aligns with market
4. **Add Team tier** ($29.99/seat/month) — unlock B2B revenue (planned)
5. **Added annual pricing** with 20-25% discount — improves LTV, reduces churn
6. **Limit Free-plan Pro usage** while keeping Flash broadly available
7. **Gate OCR** to Plus+ — it has real compute cost and is a strong differentiator (planned)
8. **Add credit overage option** — when credits exhausted, offer pay-as-you-go instead of hard block (planned)
9. **Collect cancellation intent data** — reason, optional feedback, and refund-review request are now captured before churn completes

### Feature Gating Summary

| Feature | Free | Plus | Pro | Team | Enterprise |
|---------|------|------|-----|------|------------|
| Core citation chat | Yes | Yes | Yes | Yes | Yes |
| Structured extraction | 2/mo | Credits | Credits | Credits | Custom |
| Table preview | Yes | Yes | Yes | Yes | Yes |
| Table CSV export | No | Yes | Yes | Yes | Yes |
| Pro mode | Limited | Yes | Yes | Yes | Yes |
| OCR | Yes | Yes | Yes | Yes | Yes |
| Sessions per doc | 3 | Unlimited | Unlimited | Unlimited | Unlimited |
| Custom prompts | No | No | Yes | Yes | Yes |
| Conversation export | No | MD | MD + PDF | All | All |
| API access | No | No | Read-only | Full | Full |
| Shared workspaces | No | No | No | Yes | Yes |
| SSO (SAML/OIDC) | No | No | No | Yes | Yes |
| Admin console | No | No | No | Yes | Yes |

---

## 6. Feature Roadmap (30/60/90 Days)

### Phase 1: Foundation Expansion (Days 1-30)

#### Completed

| # | Feature | Status |
|---|---------|--------|
| 1.1 | **Multi-format support** (DOCX, PPTX, XLSX, TXT, MD) | ✅ Shipped |
| 1.2 | **Document collections & cross-document Q&A** | ✅ Shipped |
| 1.3 | **Custom AI instructions per document** | ✅ Shipped |
| 1.4 | **URL/webpage ingestion** | ✅ Shipped |
| 1.5 | **Pricing restructure** (Plus tier, annual, reduced free) | ✅ Shipped |
| 1.6 | **Cancellation feedback + refund review** | ✅ Shipped |

**Expected Impact**: +20-30% signup conversion, +10-15% Free-to-Pro upgrade

### Phase 2: Differentiation & Revenue (Days 31-60)

| # | Feature | Effort | Revenue Impact | Segment |
|---|---------|--------|---------------|---------|
| 2.1 | **REST API for developers** (API keys, rate limits, docs) | 3-4 weeks | HIGH — new revenue stream | Developers, Enterprise |
| 2.2 | **Table & chart extraction** | 3-4 weeks | MEDIUM-HIGH — premium use case | Finance, Legal |
| 2.3 | **Document comparison** (semantic diff) | 2-3 weeks | MEDIUM — niche but high-value | Legal, Compliance |
| 2.4 | **Chrome extension** (right-click → chat) | 2-3 weeks | MEDIUM — acquisition channel | All |

**Expected Impact**: New developer revenue stream, +15-20% Pro upgrades

### Phase 3: Enterprise Readiness (Days 61-90)

| # | Feature | Effort | Revenue Impact | Segment |
|---|---------|--------|---------------|---------|
| 3.1 | **Team workspaces** (shared docs, RBAC, admin) | 4-6 weeks | HIGH — enables B2B sales | Teams, Enterprise |
| 3.2 | **SSO (SAML/OIDC)** | 2-3 weeks | HIGH — enterprise gate | Enterprise |
| 3.3 | **Structured data extraction** (key fields → JSON/CSV) | 3-4 weeks | MEDIUM-HIGH | Legal, Finance |
| 3.4 | **SOC 2 preparation** (audit logging, controls) | 2-3 weeks | HIGH (gating) — required for enterprise deals | Enterprise |

**Expected Impact**: First enterprise deals, team plan revenue

### Features to AVOID
- **Audio overviews** — NotebookLM does this for free and exceptionally well; competing here wastes resources
- **Native mobile app** — PWA/responsive web covers 90% of mobile use cases
- **Document editing** — competes with Adobe/Office; DocTalk's moat is AI reading, not editing
- **General chat without documents** — dilutes positioning; competes with ChatGPT
- **Blockchain/NFT anything** — no customer demand, pure hype

---

## 7. Key Risks & Mitigation

| Risk | Severity | Mitigation |
|------|----------|-----------|
| **NotebookLM goes paid** with better features | HIGH | Double down on citation precision + model choice — our defensible moats |
| **Credit rescaling causes confusion** | MEDIUM | Monitor user comprehension; provide clear in-app credit explanations |
| **Multi-document Q&A quality degrades** | MEDIUM | Reranker (Cohere Rerank) for cross-doc retrieval quality; tune top_k |
| **Enterprise sales cycle too long** for small team | HIGH | Focus on self-serve Team tier first; enterprise = later-stage |
| **Competitors undercut on price** | LOW | Compete on value (Flash/Pro model choice, citation quality, OCR), not price |
| **SOC 2 takes too long** | MEDIUM | Foundation laid: structured security logging, encryption at rest, SSRF protection, non-root Docker, GDPR data export, OAuth token cleanup. Engage compliance automation tool (Vanta/Drata) for formal audit |
| **Too many features dilute quality** | HIGH | Ship fewer features better; focus on citation precision as core differentiator |

---

## 8. Success Metrics & KPIs

| Metric | Current | 30-Day Target | 60-Day Target | 90-Day Target |
|--------|---------|--------------|--------------|--------------|
| Signup conversion rate | ~3% | 5% | 6% | 8% |
| Free-to-Paid upgrade rate | ~2% | 4% | 6% | 8% |
| Monthly churn (paid) | Unknown | <8% | <6% | <5% |
| Documents per user | ~2 | 3 | 5 | 8 |
| MRR | ~$200 | $600 | $1,500 | $3,000 |
| API revenue | $0 | $0 | $500 | $2,000 |
| Team accounts | 0 | 0 | 0 | 10+ |
| NPS score | Unknown | 40 | 50 | 55 |

### Leading Indicators to Track
- **Demo-to-signup rate**: How many demo users create accounts
- **Time to first document upload**: Shorter = better onboarding
- **Credit utilization rate**: % of monthly credits used (low = free tier too generous; high = upgrade trigger working)
- **Model mix**: Which models users choose (Premium model usage = willingness to pay for quality)
- **Session depth**: Average messages per chat session (deeper = more engaged)

---

## 9. Immediate Action Items (This Week)

1. ~~**Pricing page redesign**: Add annual toggle, credit translator tooltips, "Most Popular" badge~~ ✅ Done
2. ~~**Free tier adjustment**: Reduce credits with rescaling~~ ✅ Done
3. ~~**Start multi-format parsing**: Add python-docx, python-pptx, openpyxl to backend~~ ✅ Done
4. ~~**Start collection data model**: Design Collection + collection_documents tables~~ ✅ Done
5. ~~**Add cancellation feedback + refund-review flow**~~ ✅ Done
6. **Competitive monitoring**: Set up alerts for ChatPDF, AskYourPDF, Humata pricing changes

---

## Appendix: Research Reports

Detailed research supporting this strategy is available in `docs/research/`:
- [`competitive-analysis.md`](research/competitive-analysis.md) — 10+ competitor profiles with feature matrix
- [`user-segments.md`](research/user-segments.md) — 8 user segment analyses with revenue potential
- [`monetization-strategy.md`](research/monetization-strategy.md) — Current model analysis, pricing benchmarks, revenue projections
- [`feature-roadmap.md`](research/feature-roadmap.md) — Feature impact matrix with implementation details
