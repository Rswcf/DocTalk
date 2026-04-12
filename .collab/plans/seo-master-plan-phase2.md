# SEO Master Plan — Phase 2: Content Architecture & Production (Weeks 3-6)

**Date**: 2026-02-18
**Status**: Draft
**Prerequisite**: Phase 1 (Technical SEO Foundations) completed — robots.txt, enhanced sitemap, hreflang, JSON-LD schema, GSC/Bing verification, basic on-page optimization
**Product**: DocTalk (www.doctalk.site) — AI document Q&A with citation highlighting

---

## Table of Contents

1. [Phase 2A: Blog Infrastructure (Week 3)](#phase-2a-blog-infrastructure-week-3)
2. [Phase 2B: Comparison & Alternative Pages (Weeks 3-4)](#phase-2b-comparison--alternative-pages-weeks-3-4)
3. [Phase 2C: Feature Landing Pages (Weeks 4-5)](#phase-2c-feature-landing-pages-weeks-4-5)
4. [Phase 2D: Use Case Pages (Weeks 5-6)](#phase-2d-use-case-pages-weeks-5-6)
5. [Phase 2E: Content Production Plan](#phase-2e-content-production-plan)
6. [Implementation Checklist](#implementation-checklist)

---

## Phase 2A: Blog Infrastructure (Week 3)

### 2A.1 Next.js Blog Setup with MDX

**Recommended approach**: MDX files in the repository (no external CMS). This keeps content in Git, deploys with the app, and avoids third-party CMS costs and complexity during the early content phase.

#### Technical Architecture

```
frontend/
├── content/
│   └── blog/
│       ├── how-to-chat-with-pdf-ai.mdx
│       ├── doctalk-vs-chatpdf.mdx
│       └── ...
├── src/
│   └── app/
│       └── blog/
│           ├── page.tsx                    # Blog index (list all posts)
│           ├── [slug]/
│           │   └── page.tsx               # Individual blog post
│           └── category/
│               └── [category]/
│                   └── page.tsx           # Category archive
```

#### Dependencies to Install

```bash
cd frontend && npm install @next/mdx @mdx-js/react @mdx-js/loader gray-matter reading-time rehype-slug rehype-autolink-headings remark-gfm
```

| Package | Purpose |
|---------|---------|
| `@next/mdx` + `@mdx-js/react` + `@mdx-js/loader` | MDX compilation in Next.js |
| `gray-matter` | Parse YAML frontmatter (title, date, description, category, tags, author) |
| `reading-time` | Auto-calculate reading time for each post |
| `rehype-slug` + `rehype-autolink-headings` | Auto-generate heading IDs and anchor links (good for SEO deep links) |
| `remark-gfm` | Already installed; GFM tables, strikethrough in MDX |

#### MDX Frontmatter Schema

Every blog post MDX file begins with this frontmatter:

```yaml
---
title: "How to Chat with a PDF Using AI in 2026"
description: "Step-by-step guide to uploading a PDF and asking questions with AI. Get cited answers with source highlighting."
date: "2026-03-01"
updated: "2026-03-01"
author: "DocTalk Team"
category: "guides"
tags: ["pdf", "ai-chat", "tutorial", "how-to"]
image: "/blog/images/chat-with-pdf-hero.png"
imageAlt: "Screenshot of DocTalk AI chat interface with PDF citation highlighting"
canonical: "https://www.doctalk.site/blog/how-to-chat-with-pdf-ai"
keywords: ["chat with pdf", "ai pdf reader", "pdf question answering"]
---
```

#### Blog Index Page (`/blog/page.tsx`)

- **URL**: `/blog`
- **Content**: Paginated list of all posts (12 per page), newest first
- **Features**: Category filter sidebar, search (client-side), reading time display
- **Metadata**: `title: "Blog | DocTalk"`, `description: "Guides, comparisons, and tips for AI document analysis. Learn how to chat with PDFs, DOCX, PPTX, and more."`
- **Schema**: `Blog` + `CollectionPage` JSON-LD
- **Effort**: 4-6 hours

#### Individual Blog Post Page (`/blog/[slug]/page.tsx`)

- **URL**: `/blog/[slug]`
- **Features**: MDX content rendered with custom components, table of contents (auto-generated from H2/H3), author box, related posts, CTA banner, social share buttons, reading time, published/updated dates
- **Metadata**: Dynamic from frontmatter — unique title, description, canonical, OG image per post
- **Schema**: `Article` + `BreadcrumbList` JSON-LD (see section 2A.4)
- **Effort**: 6-8 hours

#### Static Generation

Use `generateStaticParams()` to pre-render all blog posts at build time:

```typescript
// frontend/src/app/blog/[slug]/page.tsx
import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';

export async function generateStaticParams() {
  const postsDir = path.join(process.cwd(), 'content', 'blog');
  const files = fs.readdirSync(postsDir).filter(f => f.endsWith('.mdx'));
  return files.map(file => ({ slug: file.replace('.mdx', '') }));
}
```

This ensures blog posts are fully server-rendered HTML — crawlable by Googlebot without JavaScript execution.

### 2A.2 Blog URL Structure

| Route | Purpose | Example |
|-------|---------|---------|
| `/blog` | Blog index / listing page | `www.doctalk.site/blog` |
| `/blog/[slug]` | Individual post | `www.doctalk.site/blog/how-to-chat-with-pdf-ai` |
| `/blog/category/[category]` | Category archive | `www.doctalk.site/blog/category/guides` |

**URL slug conventions**:
- Lowercase, hyphen-separated, no trailing slash
- Include primary keyword in slug (e.g., `doctalk-vs-chatpdf`, not `comparison-1`)
- Max 60 characters
- No stop words unless necessary for readability

**Blog categories** (used for filtering and category pages):

| Category slug | Display Name | Description |
|--------------|-------------|-------------|
| `guides` | Guides & Tutorials | How-to content, step-by-step instructions |
| `comparisons` | Comparisons | DocTalk vs competitors, tool comparisons |
| `use-cases` | Use Cases | Industry and role-specific applications |
| `product` | Product Updates | Feature announcements, changelogs |
| `ai-insights` | AI Insights | Technical explainers, RAG, NLP, citations |

### 2A.3 Dynamic Sitemap Enhancement

Update `frontend/src/app/sitemap.ts` to auto-discover all blog posts, comparison pages, feature pages, and use-case pages:

```typescript
import type { MetadataRoute } from "next";
import fs from "fs";
import path from "path";
import matter from "gray-matter";

const BASE_URL = "https://www.doctalk.site";

export default function sitemap(): MetadataRoute.Sitemap {
  const lastDeploy = new Date().toISOString().split("T")[0];

  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
    { url: BASE_URL, lastModified: lastDeploy, changeFrequency: "monthly", priority: 1.0 },
    { url: `${BASE_URL}/demo`, lastModified: lastDeploy, changeFrequency: "monthly", priority: 0.8 },
    { url: `${BASE_URL}/billing`, lastModified: lastDeploy, changeFrequency: "monthly", priority: 0.7 },
    { url: `${BASE_URL}/blog`, lastModified: lastDeploy, changeFrequency: "weekly", priority: 0.8 },
    { url: `${BASE_URL}/privacy`, lastModified: lastDeploy, changeFrequency: "yearly", priority: 0.3 },
    { url: `${BASE_URL}/terms`, lastModified: lastDeploy, changeFrequency: "yearly", priority: 0.3 },
  ];

  // Blog posts (from MDX frontmatter)
  const blogDir = path.join(process.cwd(), "content", "blog");
  const blogPages: MetadataRoute.Sitemap = fs.existsSync(blogDir)
    ? fs.readdirSync(blogDir)
        .filter((f) => f.endsWith(".mdx"))
        .map((file) => {
          const content = fs.readFileSync(path.join(blogDir, file), "utf-8");
          const { data } = matter(content);
          return {
            url: `${BASE_URL}/blog/${file.replace(".mdx", "")}`,
            lastModified: data.updated || data.date || lastDeploy,
            changeFrequency: "monthly" as const,
            priority: 0.7,
          };
        })
    : [];

  // Feature pages
  const featurePages: MetadataRoute.Sitemap = [
    "citations", "multi-format", "multilingual", "free-demo", "performance-modes",
  ].map((slug) => ({
    url: `${BASE_URL}/features/${slug}`,
    lastModified: lastDeploy,
    changeFrequency: "monthly" as const,
    priority: 0.8,
  }));

  // Comparison pages
  const comparePages: MetadataRoute.Sitemap = [
    "chatpdf", "askyourpdf", "notebooklm", "humata", "pdf-ai",
  ].map((slug) => ({
    url: `${BASE_URL}/compare/${slug}`,
    lastModified: lastDeploy,
    changeFrequency: "quarterly" as const,
    priority: 0.7,
  }));

  // Alternative pages
  const altPages: MetadataRoute.Sitemap = [
    "chatpdf", "notebooklm", "humata",
  ].map((slug) => ({
    url: `${BASE_URL}/alternatives/${slug}`,
    lastModified: lastDeploy,
    changeFrequency: "quarterly" as const,
    priority: 0.7,
  }));

  // Use case pages
  const useCasePages: MetadataRoute.Sitemap = [
    "students", "researchers", "lawyers", "finance",
  ].map((slug) => ({
    url: `${BASE_URL}/use-cases/${slug}`,
    lastModified: lastDeploy,
    changeFrequency: "monthly" as const,
    priority: 0.7,
  }));

  return [
    ...staticPages,
    ...blogPages,
    ...featurePages,
    ...comparePages,
    ...altPages,
    ...useCasePages,
  ];
}
```

**Effort**: 2-3 hours (update existing `sitemap.ts`)

### 2A.4 Blog Schema Markup

Every blog post page injects `Article` JSON-LD:

```json
{
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "How to Chat with a PDF Using AI in 2026",
  "description": "Step-by-step guide...",
  "image": "https://www.doctalk.site/blog/images/chat-with-pdf-hero.png",
  "author": {
    "@type": "Organization",
    "name": "DocTalk",
    "url": "https://www.doctalk.site"
  },
  "publisher": {
    "@type": "Organization",
    "name": "DocTalk",
    "url": "https://www.doctalk.site",
    "logo": {
      "@type": "ImageObject",
      "url": "https://www.doctalk.site/logo-icon.svg"
    }
  },
  "datePublished": "2026-03-01",
  "dateModified": "2026-03-01",
  "mainEntityOfPage": {
    "@type": "WebPage",
    "@id": "https://www.doctalk.site/blog/how-to-chat-with-pdf-ai"
  }
}
```

Plus `BreadcrumbList`:

```json
{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://www.doctalk.site" },
    { "@type": "ListItem", "position": 2, "name": "Blog", "item": "https://www.doctalk.site/blog" },
    { "@type": "ListItem", "position": 3, "name": "How to Chat with a PDF Using AI" }
  ]
}
```

### 2A.5 Author Page with E-E-A-T Signals

For launch, use an "Organization as Author" approach (DocTalk Team). This avoids needing individual author profiles immediately while still providing E-E-A-T signals.

**Author section on each blog post** (rendered at bottom of article):

```
About DocTalk
DocTalk is an AI-powered document chat tool used by researchers, students,
lawyers, and professionals to analyze documents with cited, verifiable answers.
Built with RAG technology, DocTalk supports 7 file formats and 11 languages.
→ Try DocTalk Free (link to /demo)
→ View Features (link to /features/citations)
```

**Future enhancement** (Phase 3+): Add individual author pages at `/blog/author/[name]` when the team expands or guest contributors are onboarded. Each author page would include:
- Bio, photo, credentials (E-E-A-T: Expertise, Experience)
- List of articles by this author
- Links to social profiles (LinkedIn, Twitter)
- `Person` schema markup with `sameAs` for social links

**Effort**: 1-2 hours (component, not a separate page yet)

### 2A.6 Blog Infrastructure — Total Effort Summary

| Task | Effort | Priority |
|------|--------|----------|
| Install MDX dependencies | 0.5h | P0 |
| Update `next.config.mjs` for MDX | 1h | P0 |
| Create `content/blog/` directory + first MDX post | 1h | P0 |
| Blog index page (`/blog/page.tsx`) | 4-6h | P0 |
| Blog post page (`/blog/[slug]/page.tsx`) | 6-8h | P0 |
| Category page (`/blog/category/[category]/page.tsx`) | 3-4h | P1 |
| Dynamic sitemap update | 2-3h | P0 |
| Article + BreadcrumbList JSON-LD | 2h | P0 |
| Author box component | 1-2h | P1 |
| Blog CTA banner component | 1h | P1 |
| Blog social share component | 1-2h | P2 |
| **Total** | **~22-30h** | |

---

## Phase 2B: Comparison & Alternative Pages (Weeks 3-4)

### 2B.1 Comparison Page Template

All comparison pages follow a consistent, SEO-optimized template structure. These target "commercial investigation" intent queries (44% of our keyword universe).

#### Standard Comparison Page Structure

```
H1: DocTalk vs [Competitor]: Full Comparison [Year]

[50-word intro paragraph answering "which is better" immediately — targets featured snippet]

H2: Quick Comparison Table
  [Side-by-side feature matrix table — targets table featured snippet]

H2: What Is DocTalk?
  [100-word product summary with link to /features/citations]

H2: What Is [Competitor]?
  [100-word competitor summary — fair and accurate]

H2: Feature-by-Feature Comparison
  H3: Document Format Support
  H3: AI Answer Quality & Citations
  H3: Language Support
  H3: Pricing & Free Tier
  H3: Performance & Speed
  H3: Security & Privacy

H2: Who Should Choose DocTalk?
  [Bullet points — use cases where DocTalk is better]

H2: Who Should Choose [Competitor]?
  [Bullet points — fair assessment of competitor strengths]

H2: Verdict: DocTalk vs [Competitor]
  [Clear recommendation with nuance]

H2: FAQ
  [3-5 questions targeting PAA queries]

[CTA: "Try DocTalk Free — No Signup Required" → /demo]
```

**Word count target**: 2,000-2,500 words per comparison page
**Internal links per page**: 4-6 (to /features/*, /demo, /billing, related /compare/* pages)

#### Comparison Table Component

Reusable React component for the feature matrix:

```tsx
// frontend/src/components/blog/ComparisonTable.tsx
// Columns: Feature | DocTalk | [Competitor]
// Rows rendered from a data array
// Checkmarks (green), X marks (red), partial support (yellow)
// Schema: renders as standard HTML <table> for crawlability
```

### 2B.2 Priority Comparison Pages

#### Page 1: DocTalk vs ChatPDF

| Field | Value |
|-------|-------|
| **Target keywords** | "doctalk vs chatpdf" (new), "chatpdf comparison" (~200/mo), "chatpdf review 2026" (~150/mo) |
| **Title tag** | `DocTalk vs ChatPDF: Full Comparison (2026) | DocTalk` |
| **Meta description** | `Compare DocTalk and ChatPDF side by side. See how they differ on document format support, citation quality, multilingual features, pricing, and free tier. Updated for 2026.` |
| **URL** | `/compare/chatpdf` |
| **H1** | DocTalk vs ChatPDF: Complete Feature Comparison (2026) |
| **H2s** | Quick Comparison Table, What Is DocTalk?, What Is ChatPDF?, Feature-by-Feature Comparison, Who Should Choose DocTalk?, Who Should Choose ChatPDF?, Verdict, FAQ |
| **Word count** | 2,200-2,500 |
| **Internal links to** | `/features/citations`, `/features/multi-format`, `/features/multilingual`, `/demo`, `/billing`, `/alternatives/chatpdf` |
| **Internal links from** | `/alternatives/chatpdf`, `/blog/best-ai-pdf-tools-2026`, homepage |
| **Schema** | `Article` + `FAQPage` + `BreadcrumbList` |
| **Key differentiators to emphasize** | ChatPDF = PDF only; DocTalk = 7 formats. ChatPDF = no inline citations; DocTalk = real-time citation highlighting. ChatPDF = English-focused; DocTalk = 11 languages. |
| **Effort** | 4-5h (writing) + 2h (page build) |

#### Page 2: DocTalk vs AskYourPDF

| Field | Value |
|-------|-------|
| **Target keywords** | "doctalk vs askyourpdf" (new), "askyourpdf review" (~300/mo), "askyourpdf alternative" (~400/mo) |
| **Title tag** | `DocTalk vs AskYourPDF: Which AI PDF Tool Is Better? | DocTalk` |
| **Meta description** | `DocTalk vs AskYourPDF comparison. Citation highlighting, multi-format support, 11 languages, and pricing compared. Find the right AI document tool for you.` |
| **URL** | `/compare/askyourpdf` |
| **H1** | DocTalk vs AskYourPDF: Which Is Better in 2026? |
| **H2s** | Quick Comparison Table, What Is DocTalk?, What Is AskYourPDF?, Feature-by-Feature Comparison, Who Should Choose DocTalk?, Who Should Choose AskYourPDF?, Verdict, FAQ |
| **Word count** | 2,000-2,300 |
| **Internal links to** | `/features/citations`, `/features/multi-format`, `/demo`, `/billing`, `/compare/chatpdf` |
| **Internal links from** | `/blog/best-ai-pdf-tools-2026`, `/alternatives/chatpdf` |
| **Schema** | `Article` + `FAQPage` + `BreadcrumbList` |
| **Key differentiators** | AskYourPDF = Chrome extension + Zotero; DocTalk = cleaner UX + citation highlighting. AskYourPDF = more complex (API, plugins); DocTalk = simpler and faster. |
| **Effort** | 4-5h (writing) + 1h (page build, reuse template) |

#### Page 3: DocTalk vs PDF.ai

| Field | Value |
|-------|-------|
| **Target keywords** | "doctalk vs pdf.ai" (new), "pdf.ai review" (~200/mo), "pdf.ai alternative" (~300/mo) |
| **Title tag** | `DocTalk vs PDF.ai: AI PDF Tool Comparison (2026) | DocTalk` |
| **Meta description** | `Compare DocTalk and PDF.ai for AI-powered document analysis. Multi-format support, citation quality, multilingual features, and pricing compared.` |
| **URL** | `/compare/pdf-ai` |
| **H1** | DocTalk vs PDF.ai: Detailed Comparison (2026) |
| **H2s** | Quick Comparison Table, What Is DocTalk?, What Is PDF.ai?, Feature-by-Feature Comparison, Who Should Choose DocTalk?, Who Should Choose PDF.ai?, Verdict, FAQ |
| **Word count** | 1,800-2,200 |
| **Internal links to** | `/features/citations`, `/features/multi-format`, `/demo`, `/billing` |
| **Internal links from** | `/blog/best-ai-pdf-tools-2026`, `/alternatives/chatpdf` |
| **Schema** | `Article` + `FAQPage` + `BreadcrumbList` |
| **Key differentiators** | PDF.ai = PDF only + declining backlinks; DocTalk = 7 formats + actively growing. PDF.ai = no inline citations; DocTalk = citation highlighting. |
| **Effort** | 3-4h (writing) + 1h (page build) |

#### Page 4: DocTalk vs Humata

| Field | Value |
|-------|-------|
| **Target keywords** | "doctalk vs humata" (new), "humata review" (~300/mo), "humata alternative" (~900/mo) |
| **Title tag** | `DocTalk vs Humata: AI Document Tool Comparison | DocTalk` |
| **Meta description** | `DocTalk vs Humata side-by-side. Compare AI accuracy, citation features, file format support, multilingual capabilities, and pricing for 2026.` |
| **URL** | `/compare/humata` |
| **H1** | DocTalk vs Humata: Head-to-Head Comparison (2026) |
| **H2s** | Quick Comparison Table, What Is DocTalk?, What Is Humata?, Feature-by-Feature Comparison, Who Should Choose DocTalk?, Who Should Choose Humata?, Verdict, FAQ |
| **Word count** | 1,800-2,200 |
| **Internal links to** | `/features/citations`, `/features/multilingual`, `/demo`, `/billing`, `/alternatives/humata` |
| **Internal links from** | `/alternatives/humata`, `/blog/best-ai-pdf-tools-2026` |
| **Schema** | `Article` + `FAQPage` + `BreadcrumbList` |
| **Key differentiators** | Humata = team features + video; DocTalk = citation highlighting + 11 languages + cheaper. Humata = no content strategy; DocTalk = actively investing. |
| **Effort** | 3-4h (writing) + 1h (page build) |

#### Page 5: DocTalk vs NotebookLM

| Field | Value |
|-------|-------|
| **Target keywords** | "doctalk vs notebooklm" (new), "notebooklm alternative" (~2,200/mo), "notebooklm vs chatpdf" (~500/mo) |
| **Title tag** | `DocTalk vs NotebookLM: Which AI Document Tool? | DocTalk` |
| **Meta description** | `Compare DocTalk and Google NotebookLM. See how they differ on document formats, citation accuracy, privacy, multilingual support, and pricing.` |
| **URL** | `/compare/notebooklm` |
| **H1** | DocTalk vs NotebookLM: Complete Comparison (2026) |
| **H2s** | Quick Comparison Table, What Is DocTalk?, What Is NotebookLM?, Feature-by-Feature Comparison, NotebookLM's Audio Summaries vs DocTalk's Citation Highlighting, Privacy Comparison, Who Should Choose DocTalk?, Who Should Choose NotebookLM?, Verdict, FAQ |
| **Word count** | 2,200-2,500 |
| **Internal links to** | `/features/citations`, `/features/multi-format`, `/features/multilingual`, `/demo`, `/alternatives/notebooklm` |
| **Internal links from** | `/alternatives/notebooklm`, `/blog/best-ai-pdf-tools-2026` |
| **Schema** | `Article` + `FAQPage` + `BreadcrumbList` |
| **Key differentiators** | NotebookLM = Google-locked, audio podcasts, free; DocTalk = privacy-first, citation highlighting, multi-format, 11 languages, no vendor lock-in. |
| **Effort** | 4-5h (writing) + 1h (page build) |

### 2B.3 Alternative Pages

Alternative pages target users searching for options to replace a specific competitor. These are distinct from comparison pages: comparison = "A vs B", alternative = "list of options to replace A".

#### Standard Alternative Page Structure

```
H1: Best [Competitor] Alternatives in [Year]

[60-word intro — why someone might need an alternative]

H2: Quick Comparison of Top [Competitor] Alternatives
  [Table: Tool | Format Support | Citations | Languages | Free Tier | Price]

H2: 1. DocTalk — Best Overall [Competitor] Alternative
  [200-word feature summary positioning DocTalk as #1 alternative]

H2: 2. [Alt 2] — Best for [specific use case]
  [150-word summary]

H2: 3. [Alt 3] — Best for [specific use case]
  [150-word summary]

... (5-7 alternatives total, DocTalk always first)

H2: How to Choose the Right [Competitor] Alternative
  [Decision framework — bullet points by need]

H2: FAQ
  [3-5 PAA-targeted questions]

[CTA: "Try DocTalk Free" → /demo]
```

**Word count target**: 2,500-3,000 words
**Internal links per page**: 5-8

#### Page A1: ChatPDF Alternatives

| Field | Value |
|-------|-------|
| **Target keywords** | "chatpdf alternative" (~1,800/mo), "chatpdf alternatives 2026" (~500/mo), "free chatpdf alternative" (~320/mo), "best chatpdf alternative" (~400/mo) |
| **Title tag** | `7 Best ChatPDF Alternatives in 2026 (Free & Paid) | DocTalk` |
| **Meta description** | `Looking for a ChatPDF alternative? Compare the 7 best AI PDF chat tools including DocTalk, AskYourPDF, Humata, and more. Multi-format support, citations, and free options.` |
| **URL** | `/alternatives/chatpdf` |
| **H1** | 7 Best ChatPDF Alternatives in 2026 |
| **Alternatives listed** | 1. DocTalk (best overall), 2. AskYourPDF (best for researchers), 3. Humata (best for teams), 4. NotebookLM (best free), 5. PDF.ai (simplest), 6. ChatDOC (best for tables), 7. Sharly (best for summaries) |
| **Word count** | 2,800-3,200 |
| **Internal links to** | `/compare/chatpdf`, `/compare/askyourpdf`, `/features/citations`, `/features/multi-format`, `/demo`, `/billing` |
| **Internal links from** | All `/compare/*` pages, blog posts mentioning ChatPDF |
| **Schema** | `Article` + `FAQPage` + `ItemList` + `BreadcrumbList` |
| **Effort** | 5-6h (writing + research) + 1h (page build) |

#### Page A2: NotebookLM Alternatives

| Field | Value |
|-------|-------|
| **Target keywords** | "notebooklm alternative" (~2,200/mo), "notebooklm alternatives 2026" (~300/mo), "google notebooklm alternative" (~200/mo) |
| **Title tag** | `6 Best NotebookLM Alternatives for Document Analysis (2026) | DocTalk` |
| **Meta description** | `Need a NotebookLM alternative? Compare 6 AI document analysis tools with better format support, citation features, and privacy controls. DocTalk, ChatPDF, and more.` |
| **URL** | `/alternatives/notebooklm` |
| **H1** | 6 Best NotebookLM Alternatives for Document Analysis (2026) |
| **Alternatives listed** | 1. DocTalk (best for citations + multi-format), 2. ChatPDF (simplest PDF chat), 3. AskYourPDF (best for researchers), 4. Humata (best for teams), 5. Consensus (best for scientific papers), 6. Elicit (best for literature review) |
| **Word count** | 2,500-3,000 |
| **Internal links to** | `/compare/notebooklm`, `/features/citations`, `/features/multilingual`, `/demo` |
| **Internal links from** | `/compare/notebooklm`, blog posts mentioning NotebookLM |
| **Schema** | `Article` + `FAQPage` + `ItemList` + `BreadcrumbList` |
| **Effort** | 4-5h (writing) + 1h (page build) |

#### Page A3: Humata Alternatives

| Field | Value |
|-------|-------|
| **Target keywords** | "humata alternative" (~900/mo), "humata alternatives 2026" (~150/mo), "humata ai alternative" (~100/mo) |
| **Title tag** | `5 Best Humata AI Alternatives in 2026 | DocTalk` |
| **Meta description** | `Looking for a Humata alternative? Compare 5 AI document tools with better citation accuracy, multi-format support, and multilingual features.` |
| **URL** | `/alternatives/humata` |
| **H1** | 5 Best Humata AI Alternatives in 2026 |
| **Alternatives listed** | 1. DocTalk (best for citations + languages), 2. ChatPDF (most popular), 3. AskYourPDF (best for integrations), 4. NotebookLM (best free), 5. PDF.ai (simplest) |
| **Word count** | 2,000-2,500 |
| **Internal links to** | `/compare/humata`, `/features/citations`, `/features/multi-format`, `/demo` |
| **Internal links from** | `/compare/humata`, blog posts |
| **Schema** | `Article` + `FAQPage` + `ItemList` + `BreadcrumbList` |
| **Effort** | 3-4h (writing) + 1h (page build) |

### 2B.4 Comparison Schema Markup

All comparison and alternative pages include:

**ItemList schema** (for alternative pages — targets "list" rich results):

```json
{
  "@context": "https://schema.org",
  "@type": "ItemList",
  "name": "Best ChatPDF Alternatives in 2026",
  "numberOfItems": 7,
  "itemListElement": [
    {
      "@type": "ListItem",
      "position": 1,
      "name": "DocTalk",
      "url": "https://www.doctalk.site"
    },
    {
      "@type": "ListItem",
      "position": 2,
      "name": "AskYourPDF",
      "url": "https://askyourpdf.com"
    }
  ]
}
```

**FAQPage schema** (on all comparison and alternative pages):

```json
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "Is DocTalk better than ChatPDF?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "DocTalk offers several advantages over ChatPDF: support for 7 document formats (vs PDF only), real-time citation highlighting, 11 languages, and a free demo without signup. ChatPDF has stronger brand recognition and a simpler interface."
      }
    }
  ]
}
```

### 2B.5 Comparison/Alternative Pages — Next.js Implementation

All comparison and alternative pages follow the same implementation pattern as blog posts: server-rendered pages with metadata exports.

```
frontend/src/app/
├── compare/
│   ├── page.tsx                    # Comparison hub (links to all comparisons)
│   ├── [competitor]/
│   │   └── page.tsx               # Individual comparison (data-driven)
├── alternatives/
│   ├── page.tsx                    # Alternatives hub
│   ├── [competitor]/
│       └── page.tsx               # Individual alternatives page
```

Each page uses `generateStaticParams()` to pre-render. Content stored in a TypeScript data file (`frontend/src/data/comparisons.ts`) or individual MDX files depending on how often content changes.

**Recommended**: Use MDX files in `content/compare/` and `content/alternatives/` — same approach as blog, keeps content in Git.

### 2B.6 Comparison & Alternative Pages — Effort Summary

| Page | Effort (Write) | Effort (Build) | Priority |
|------|----------------|----------------|----------|
| Comparison template (reusable component) | — | 4-5h | P0 |
| DocTalk vs ChatPDF | 4-5h | 2h | P0 |
| DocTalk vs AskYourPDF | 4-5h | 1h | P0 |
| DocTalk vs PDF.ai | 3-4h | 1h | P1 |
| DocTalk vs Humata | 3-4h | 1h | P1 |
| DocTalk vs NotebookLM | 4-5h | 1h | P0 |
| Alternative template (reusable component) | — | 3-4h | P0 |
| ChatPDF Alternatives | 5-6h | 1h | P0 |
| NotebookLM Alternatives | 4-5h | 1h | P0 |
| Humata Alternatives | 3-4h | 1h | P1 |
| Compare hub page | 1h | 2h | P1 |
| Alternatives hub page | 1h | 2h | P1 |
| **Total** | **~33-44h** | **~20-22h** | |

---

## Phase 2C: Feature Landing Pages (Weeks 4-5)

Each feature landing page targets a cluster of transactional and commercial-investigation keywords. These are *product pages* (not blog posts) — shorter, more conversion-focused, with prominent CTAs.

### Feature Page Template Structure

```
H1: [Feature Name] — [Benefit Statement]

[Hero section: 60-word description + screenshot/demo GIF + CTA button]

H2: How [Feature] Works
  [3-step explanation with screenshots/diagrams]

H2: Why [Feature] Matters
  [Benefits, not just features — tied to user outcomes]

H2: [Feature] vs Other Tools
  [Brief comparison table showing DocTalk advantage]

H2: Supported Document Types / Use Cases
  [Relevant details specific to this feature]

H2: FAQ
  [3-5 questions targeting PAA queries]

[CTA: "Try It Now — Free Demo" → /demo]
```

**Word count target**: 1,200-1,800 words per page
**Schema**: `SoftwareApplication` (or `WebApplication`) + `FAQPage` + `BreadcrumbList`

### Page F1: Multi-Format Support

| Field | Value |
|-------|-------|
| **Target keywords** | "ai document reader" (~550/mo), "chat with word document ai" (~180/mo), "ai chat with pptx" (~90/mo), "chat with excel ai" (~140/mo), "ai tool reads pdf and docx" (~80/mo), "upload any document ai" (~50/mo) |
| **Title tag** | `Chat with Any Document: PDF, DOCX, PPTX, XLSX & More | DocTalk` |
| **Meta description** | `Upload PDF, Word, PowerPoint, Excel, TXT, Markdown, or any URL. DocTalk's AI reads your document and answers questions with cited sources. Try free.` |
| **URL** | `/features/multi-format` |
| **H1** | Chat with Any Document Format Using AI |
| **Content outline** | |
| | **H2: Supported Formats** — table of all 7 formats with icons, what DocTalk extracts from each |
| | **H2: Why Multi-Format Matters** — most AI tools only support PDF; DocTalk handles your actual workflow |
| | **H2: How It Works** — upload → parse → chat (3-step with screenshots) |
| | **H2: Format-Specific Features** — H3 per format (PDF: page citations, DOCX: paragraph-level, PPTX: slide-level, XLSX: table extraction, URL: web content analysis) |
| | **H2: Compared to PDF-Only Tools** — comparison mini-table (DocTalk vs ChatPDF vs AskYourPDF) |
| | **H2: FAQ** — "Can I upload DOCX?", "Does DocTalk read PowerPoint slides?", "Can I analyze an Excel spreadsheet with AI?", "Can I chat with a webpage?" |
| **Word count** | 1,500-1,800 |
| **Internal links to** | `/demo`, `/billing`, `/compare/chatpdf`, `/features/citations`, `/blog/how-to-chat-with-docx` (future), `/blog/how-to-chat-with-pptx` (future) |
| **Internal links from** | Homepage, all comparison pages, blog posts about document formats |
| **Schema** | `SoftwareApplication` (applicationCategory: "Productivity", operatingSystem: "Web") + `FAQPage` + `BreadcrumbList` |
| **Effort** | 3-4h (writing) + 3-4h (page build with screenshots) |

### Page F2: Citation Highlighting

| Field | Value |
|-------|-------|
| **Target keywords** | "ai pdf reader with citations" (~70/mo), "ai document citations" (~70/mo), "ai answers with page number citations" (~60/mo), "document ai with text highlighting" (~40/mo), "ai tool that shows where answer came from" (~50/mo), "no hallucination ai document reader" (~30/mo) |
| **Title tag** | `AI Answers with Source Citations & Highlighting | DocTalk` |
| **Meta description** | `Every AI answer includes numbered citations. Click any citation to jump to the exact source text, highlighted in your document. Verify every answer. Try free.` |
| **URL** | `/features/citations` |
| **H1** | AI Answers You Can Trust: Source Citations with Real-Time Highlighting |
| **Content outline** | |
| | **H2: How Citation Highlighting Works** — numbered references → click → scroll to source → text highlighted in yellow (with screenshot/GIF) |
| | **H2: Why Citations Matter** — AI hallucination problem, trust gap, citations = verifiable answers |
| | **H2: Three Layers of Citation Accuracy** — H3: Source extraction (RAG), H3: Page-level attribution, H3: Visual highlighting navigation |
| | **H2: Citation Quality Compared** — DocTalk vs ChatPDF (no citations) vs AskYourPDF (text-only references) vs Humata (minimal) |
| | **H2: Use Cases for Cited Answers** — academic research (verify claims), legal (cite exact clauses), finance (reference specific figures) |
| | **H2: FAQ** — "How accurate are the citations?", "Can I click to see the source?", "Does it work with DOCX/PPTX?", "How does DocTalk prevent hallucination?" |
| **Word count** | 1,500-2,000 |
| **Internal links to** | `/demo`, `/features/multi-format`, `/use-cases/researchers`, `/use-cases/lawyers`, `/compare/chatpdf` |
| **Internal links from** | Homepage, all comparison pages, all alternative pages, blog posts about AI accuracy |
| **Schema** | `SoftwareApplication` + `FAQPage` + `BreadcrumbList` + `HowTo` (for the citation workflow steps) |
| **Effort** | 3-4h (writing) + 3-4h (page build with GIF/screenshots) |

### Page F3: Multilingual Support

| Field | Value |
|-------|-------|
| **Target keywords** | "multilingual pdf chat tool" (~50/mo), "ai pdf reader chinese language" (~120/mo), "chat with pdf in japanese" (~90/mo), "ai that reads pdf in any language" (~70/mo), "multilingual ai document chat" (~50/mo), "cross language document ai" (~30/mo) |
| **Title tag** | `AI Document Chat in 11 Languages | DocTalk` |
| **Meta description** | `Chat with documents in English, Chinese, Japanese, Spanish, German, French, Korean, Portuguese, Italian, Arabic, and Hindi. AI understands and responds in your language.` |
| **URL** | `/features/multilingual` |
| **H1** | Chat with Documents in 11 Languages |
| **Content outline** | |
| | **H2: Supported Languages** — grid of 11 language flags with native name + English name |
| | **H2: How Multilingual Chat Works** — upload doc in any language → ask questions in any language → get answers in your preferred language |
| | **H2: Cross-Language Document Analysis** — ask in English about a Chinese PDF, or ask in Japanese about an English report |
| | **H2: Multilingual vs Other Tools** — table showing DocTalk (11 langs) vs ChatPDF (English mainly) vs AskYourPDF (English) vs NotebookLM (English) |
| | **H2: Language-Specific Tips** — brief guidance per major language (Chinese: CJK PDF support, Japanese: vertical text support, Arabic: RTL) |
| | **H2: FAQ** — "Can I ask in a different language than the document?", "Does DocTalk support CJK PDFs?", "How many languages are supported?" |
| **Word count** | 1,200-1,500 |
| **Internal links to** | `/demo`, `/features/multi-format`, `/compare/chatpdf`, `/compare/notebooklm` |
| **Internal links from** | Homepage, comparison pages, blog posts about multilingual features |
| **Schema** | `SoftwareApplication` + `FAQPage` + `BreadcrumbList` |
| **Effort** | 2-3h (writing) + 3h (page build) |

### Page F4: Free Demo / No-Signup

| Field | Value |
|-------|-------|
| **Target keywords** | "chat with pdf free online" (~480/mo), "upload pdf and ask questions free" (~260/mo), "free ai pdf analysis no registration" (~180/mo), "try ai pdf tool free no account" (~120/mo), "ai pdf reader free trial no credit card" (~90/mo), "ai document chat demo online" (~60/mo) |
| **Title tag** | `Try AI Document Chat Free — No Signup Required | DocTalk` |
| **Meta description** | `Chat with AI about sample documents instantly. No account, no credit card, no signup. See citation highlighting in action. 3 demo documents ready to explore.` |
| **URL** | `/features/free-demo` |
| **H1** | Try DocTalk Free — No Account Required |
| **Content outline** | |
| | **H2: Instant Demo — No Signup Needed** — 3 sample documents ready to chat with immediately (link directly to /demo) |
| | **H2: What You Get in the Free Demo** — 5 messages per session, 3 documents, citation highlighting, all features visible |
| | **H2: Free Plan vs Paid Plans** — comparison table (Free: 500 credits/mo, Plus: 3K, Pro: 9K) with link to /billing |
| | **H2: How to Get Started** — Step 1: Click "Try Demo", Step 2: Choose a document, Step 3: Ask a question, Step 4: Click a citation to verify |
| | **H2: FAQ** — "Is DocTalk really free?", "Do I need to create an account?", "What happens after the free demo?", "Can I upload my own documents for free?" |
| **Word count** | 1,000-1,200 |
| **Internal links to** | `/demo` (primary CTA), `/billing`, `/features/citations`, `/features/multi-format` |
| **Internal links from** | All comparison pages (CTA), all alternative pages (CTA), blog posts |
| **Schema** | `SoftwareApplication` + `FAQPage` + `BreadcrumbList` + `Offer` (freePrice for demo) |
| **Note** | This is essentially an SEO-optimized landing page that funnels traffic to the existing `/demo` page. It captures "free" intent queries that the demo page itself may not rank for. |
| **Effort** | 2-3h (writing) + 2-3h (page build) |

### Page F5: Performance Modes

| Field | Value |
|-------|-------|
| **Target keywords** | "ai pdf tool comparison" (~60/mo), "best ai model for documents" (~80/mo), secondary keyword support |
| **Title tag** | `3 AI Performance Modes: Quick, Balanced, Thorough | DocTalk` |
| **Meta description** | `Choose your AI speed and depth. Quick mode for fast answers, Balanced for everyday use, Thorough for deep analysis. Powered by DeepSeek, Mistral Medium, and Mistral Large.` |
| **URL** | `/features/performance-modes` |
| **H1** | Choose Your AI Performance Mode |
| **Content outline** | |
| | **H2: Three Modes for Every Need** — Quick (fast, 2 credits), Balanced (everyday, 8 credits), Thorough (deep, 24 credits) |
| | **H2: When to Use Each Mode** — use case guidance per mode |
| | **H2: Model Technology** — brief explanation of LLMs powering each mode (without overpromising) |
| | **H2: FAQ** — "Which mode should I use?", "How many credits does each mode cost?", "Can I switch modes mid-conversation?" |
| **Word count** | 800-1,000 |
| **Internal links to** | `/billing`, `/demo`, `/features/citations` |
| **Internal links from** | `/billing`, blog posts about AI model comparisons |
| **Schema** | `SoftwareApplication` + `FAQPage` + `BreadcrumbList` |
| **Note** | Lower SEO priority — primarily supports internal linking and user education. Not a high-volume keyword target. |
| **Effort** | 2h (writing) + 2h (page build) |

### Feature Pages — Next.js Implementation

```
frontend/src/app/
└── features/
    ├── page.tsx                        # Features hub (links to all feature pages)
    ├── citations/page.tsx
    ├── multi-format/page.tsx
    ├── multilingual/page.tsx
    ├── free-demo/page.tsx
    └── performance-modes/page.tsx
```

Each page is a server component with `export const metadata` for title/description/canonical. No MDX needed here — these are product pages built with React components.

### Feature Pages — Effort Summary

| Page | Effort (Write) | Effort (Build) | Priority |
|------|----------------|----------------|----------|
| Features hub page | 1h | 2h | P1 |
| Multi-Format Support | 3-4h | 3-4h | P0 |
| Citation Highlighting | 3-4h | 3-4h | P0 |
| Multilingual Support | 2-3h | 3h | P1 |
| Free Demo Landing | 2-3h | 2-3h | P0 |
| Performance Modes | 2h | 2h | P2 |
| **Total** | **~13-17h** | **~15-18h** | |

---

## Phase 2D: Use Case Pages (Weeks 5-6)

Use case pages target high-intent users with specific professional needs. These are "industry vertical" pages that demonstrate DocTalk's value for particular roles and document types.

### Use Case Page Template Structure

```
H1: AI Document Analysis for [Role/Industry]

[Hero: 60-word description of how DocTalk helps this audience + CTA]

H2: The [Industry] Document Challenge
  [Pain point description — why manual reading is insufficient]

H2: How DocTalk Helps [Role]
  [3-4 specific workflow examples with before/after]

H2: Supported Document Types for [Industry]
  [Relevant formats with examples: "10-K filings (PDF)", "contracts (DOCX)"]

H2: Real-World Use Cases
  H3: [Use case 1 with specific example]
  H3: [Use case 2]
  H3: [Use case 3]

H2: Why [Role] Trust DocTalk's Citations
  [Citation accuracy pitch tied to this industry's need for verification]

H2: Getting Started
  [3-step workflow specific to this audience]

H2: FAQ
  [3-5 questions specific to this industry]

[CTA: "Analyze Your First [Document Type] Free" → /demo]
```

**Word count target**: 1,500-2,000 words
**Schema**: `Article` + `FAQPage` + `BreadcrumbList`

### Page U1: Academic Research / Students

| Field | Value |
|-------|-------|
| **Target keywords** | "ai tool to analyze research papers free" (~390/mo), "ai pdf reader for academic papers" (~260/mo), "ai tool for literature review papers" (~260/mo), "ai read textbook and answer questions" (~150/mo), "ai for students" (~200/mo), "ai research paper assistant" (~150/mo) |
| **Title tag** | `AI Research Paper Analysis for Students & Academics | DocTalk` |
| **Meta description** | `Analyze research papers, textbooks, and academic documents with AI. Get cited answers with page-level references. Upload PDF, DOCX, or paste a URL. Free to try.` |
| **URL** | `/use-cases/students` |
| **H1** | AI-Powered Research Paper Analysis for Students and Academics |
| **Content outline** | |
| | **H2: The Academic Reading Challenge** — volume of papers, time pressure, need for source verification |
| | **H2: How DocTalk Helps Researchers** — summarize papers, extract key findings, compare methodologies, literature review acceleration |
| | **H2: Supported Academic Document Types** — PDF papers, DOCX theses, PPTX lecture slides, URLs from arXiv/PubMed |
| | **H2: Real-World Academic Use Cases** — H3: Analyzing a 50-page thesis, H3: Reviewing 10 papers for literature review, H3: Understanding methodology sections, H3: Preparing for exams with textbook Q&A |
| | **H2: Why Citations Matter for Academic Work** — AI hallucination risks in research, DocTalk's page-level citations let you verify every claim |
| | **H2: Multilingual Academic Research** — analyze papers in Chinese, Japanese, German — get answers in your language |
| | **H2: Getting Started** — 3 steps: upload paper → ask question → verify citation |
| | **H2: FAQ** — "Can DocTalk summarize a research paper?", "Does it work with arXiv papers?", "How accurate is AI for academic research?", "Is there a student discount?", "Can I upload a URL to a paper?" |
| **Word count** | 1,800-2,200 |
| **Internal links to** | `/demo`, `/features/citations`, `/features/multi-format`, `/features/multilingual`, `/billing`, `/compare/notebooklm` |
| **Internal links from** | Blog posts about research, comparison pages, `/features/citations` |
| **Schema** | `Article` + `FAQPage` + `BreadcrumbList` |
| **Effort** | 4-5h (writing) + 3h (page build) |

### Page U2: Legal Document Analysis

| Field | Value |
|-------|-------|
| **Target keywords** | "ai tool for legal document analysis" (~480/mo), "ai review legal contract pdf" (~210/mo), "ai tool for contract review" (~480/mo), "ai summarize court filing" (~80/mo), "ai pdf tool for lawyers" (~80/mo), "ai analyze patent document" (~80/mo) |
| **Title tag** | `AI Legal Document Analysis: Contracts, Filings & More | DocTalk` |
| **Meta description** | `Review contracts, court filings, and legal documents with AI. Get cited answers with exact clause references. Secure, private, and GDPR-compliant. Try free.` |
| **URL** | `/use-cases/lawyers` |
| **H1** | AI-Powered Legal Document Analysis with Verifiable Citations |
| **Content outline** | |
| | **H2: The Legal Document Challenge** — volume, complexity, billable hours on document review |
| | **H2: How DocTalk Helps Legal Professionals** — contract clause extraction, due diligence acceleration, filing summarization, key term identification |
| | **H2: Supported Legal Document Types** — PDF contracts, DOCX briefs, court filings, patent documents |
| | **H2: Real-World Legal Use Cases** — H3: Contract review (find indemnification clauses), H3: Due diligence (analyze 100+ documents), H3: Court filing analysis, H3: Patent prior art search |
| | **H2: Why Citations Are Critical for Legal Work** — every answer must be verifiable, DocTalk shows exact source text |
| | **H2: Security & Privacy for Legal Documents** — AES-256 encryption, no data used for training, GDPR compliance |
| | **H2: Getting Started** — upload → ask → verify |
| | **H2: FAQ** — "Is DocTalk secure for confidential legal documents?", "Can it analyze contracts?", "How accurate is AI for legal analysis?", "Does it work with scanned PDFs?", "Is there a team plan?" |
| **Word count** | 1,800-2,200 |
| **Internal links to** | `/demo`, `/features/citations`, `/features/multi-format`, `/billing`, `/compare/humata` |
| **Internal links from** | Blog posts about legal AI, comparison pages, `/features/citations` |
| **Schema** | `Article` + `FAQPage` + `BreadcrumbList` |
| **Effort** | 4-5h (writing) + 3h (page build) |

### Page U3: Financial Report Analysis

| Field | Value |
|-------|-------|
| **Target keywords** | "how to analyze earnings report with ai" (~170/mo), "ai analyze earnings report pdf" (~170/mo), "ai financial report analysis" (~200/mo), "ai analyze SEC filing" (~90/mo), "ai tool for reading financial documents" (~60/mo) |
| **Title tag** | `AI Financial Report Analysis: 10-K, Earnings & SEC Filings | DocTalk` |
| **Meta description** | `Analyze 10-K filings, earnings reports, and financial documents with AI. Ask questions and get cited answers referencing specific figures. Try free.` |
| **URL** | `/use-cases/finance` |
| **H1** | AI-Powered Financial Report Analysis with Cited Sources |
| **Content outline** | |
| | **H2: The Financial Analysis Challenge** — 100+ page 10-K filings, quarterly earnings, time-sensitive decisions |
| | **H2: How DocTalk Helps Financial Analysts** — extract key metrics, compare periods, summarize risk factors, find specific disclosures |
| | **H2: Supported Financial Document Types** — PDF 10-K/10-Q filings, XLSX financial models, DOCX research reports, PPTX investor presentations |
| | **H2: Real-World Financial Use Cases** — H3: Analyzing a 10-K annual report, H3: Earnings call transcript Q&A, H3: Comparing quarterly results, H3: Due diligence document review |
| | **H2: Why Cited Answers Matter for Finance** — numbers must be verifiable, page-level citations point to exact figures |
| | **H2: Excel (XLSX) Support** — upload financial models and spreadsheets directly |
| | **H2: FAQ** — "Can DocTalk analyze a 10-K filing?", "Does it work with Excel files?", "How fast is analysis?", "Is my financial data secure?", "Can I analyze earnings transcripts?" |
| **Word count** | 1,500-2,000 |
| **Internal links to** | `/demo`, `/features/citations`, `/features/multi-format`, `/billing` |
| **Internal links from** | Blog posts about financial analysis, `/features/multi-format` |
| **Schema** | `Article` + `FAQPage` + `BreadcrumbList` |
| **Effort** | 4-5h (writing) + 3h (page build) |

### Page U4: HR / Contract Review

| Field | Value |
|-------|-------|
| **Target keywords** | "ai contract review tool" (~480/mo), "ai hr policy document reader" (~50/mo), "ai help understand insurance policy pdf" (~70/mo), "ai read employee handbook" (~40/mo) |
| **Title tag** | `AI Contract & HR Document Review Tool | DocTalk` |
| **Meta description** | `Review employment contracts, HR policies, and company handbooks with AI. Get instant answers about specific clauses with source citations. Try free.` |
| **URL** | `/use-cases/hr-contracts` |
| **H1** | AI-Powered Contract & HR Document Review |
| **Content outline** | |
| | **H2: The HR Document Challenge** — lengthy policies, frequent updates, employee questions, compliance requirements |
| | **H2: How DocTalk Helps HR Teams** — policy Q&A, contract clause lookup, handbook navigation, onboarding document analysis |
| | **H2: Supported HR Document Types** — DOCX employment contracts, PDF company handbooks, PPTX training materials, XLSX benefits tables |
| | **H2: Real-World HR Use Cases** — H3: Employee asking about PTO policy, H3: Reviewing non-compete clauses, H3: Comparing benefits across plans, H3: Onboarding document orientation |
| | **H2: Privacy for HR Documents** — sensitive employee data, encryption, no training |
| | **H2: FAQ** — "Can DocTalk review employment contracts?", "Is it secure for HR documents?", "Does it understand legal language?", "Can multiple people access the same document?" |
| **Word count** | 1,200-1,500 |
| **Internal links to** | `/demo`, `/features/citations`, `/features/multi-format`, `/billing`, `/use-cases/lawyers` |
| **Internal links from** | `/use-cases/lawyers`, blog posts about contract review |
| **Schema** | `Article` + `FAQPage` + `BreadcrumbList` |
| **Effort** | 3-4h (writing) + 2-3h (page build) |

### Use Case Pages — Next.js Implementation

```
frontend/src/app/
└── use-cases/
    ├── page.tsx                        # Use cases hub
    ├── students/page.tsx
    ├── lawyers/page.tsx
    ├── finance/page.tsx
    └── hr-contracts/page.tsx
```

### Use Case Pages — Effort Summary

| Page | Effort (Write) | Effort (Build) | Priority |
|------|----------------|----------------|----------|
| Use cases hub page | 1h | 2h | P1 |
| Academic / Students | 4-5h | 3h | P0 |
| Legal Document Analysis | 4-5h | 3h | P0 |
| Financial Report Analysis | 4-5h | 3h | P1 |
| HR / Contract Review | 3-4h | 2-3h | P2 |
| **Total** | **~16-20h** | **~13-14h** | |

---

## Phase 2E: Content Production Plan

### 2E.1 First 12 Blog Posts — Prioritized by Keyword Opportunity

Posts are ordered by a composite score of: search volume, competition level, alignment with DocTalk's differentiators, and conversion potential.

| # | Title | Target Keyword(s) | Est. Vol | Competition | Cluster | Word Count | Priority |
|---|-------|--------------------|----------|-------------|---------|------------|----------|
| 1 | How to Chat with a PDF Using AI (Step-by-Step Guide) | "chat with pdf", "how to chat with pdf ai" | 3,900 | Medium | 1 (Doc Chat) | 2,000-2,500 | P0 — Week 3 |
| 2 | Best AI PDF Tools Compared: Features, Pricing & Accuracy (2026) | "best ai pdf tools 2026", "ai pdf tool comparison" | 800+ | Low-Med | 3 (Comparisons) | 3,000-3,500 | P0 — Week 3 |
| 3 | How to Chat with a Word Document (DOCX) Using AI | "chat with word document ai", "chat with docx file" | 180 | Very Low | 1 (Doc Chat) | 1,500-2,000 | P0 — Week 3 |
| 4 | ChatPDF vs AskYourPDF vs DocTalk: 3-Way Comparison | "chatpdf vs askyourpdf", "chatpdf vs doctalk" | 300+ | Very Low | 3 (Comparisons) | 2,500-3,000 | P0 — Week 4 |
| 5 | AI Document Chat: The Complete Guide (2026) | "ai document chat", "document chat ai" | 900 | Low-Med | 1 (Doc Chat) | 3,500-4,000 | P1 — Week 4 |
| 6 | How to Analyze a PowerPoint (PPTX) with AI | "ai chat with pptx", "ai analyze powerpoint" | 90 | Very Low | 1 (Doc Chat) | 1,500-1,800 | P1 — Week 4 |
| 7 | Why AI Citations Matter: Preventing Hallucination in Document Analysis | "ai document citations", "ai hallucination documents" | 120+ | Very Low | 2 (Citations) | 2,000-2,500 | P1 — Week 5 |
| 8 | How to Chat with an Excel (XLSX) Spreadsheet Using AI | "chat with excel ai", "ai read excel file" | 140 | Very Low | 1 (Doc Chat) | 1,500-1,800 | P1 — Week 5 |
| 9 | AI for Research Papers: How to Analyze Academic Literature | "ai analyze research papers", "ai literature review tool" | 650 | Low | 4 (Industry) | 2,000-2,500 | P1 — Week 5 |
| 10 | Free AI PDF Chat: No Signup, No Credit Card | "free ai pdf chat no signup", "chat with pdf free online" | 800 | Low | 1 (Doc Chat) | 1,200-1,500 | P0 — Week 5 |
| 11 | How to Analyze Earnings Reports with AI | "ai analyze earnings report", "ai financial report analysis" | 370 | Very Low | 4 (Industry) | 2,000-2,500 | P2 — Week 6 |
| 12 | Chat with Documents in Any Language: Multilingual AI Guide | "multilingual ai document chat", "ai pdf analysis chinese" | 200+ | Very Low | 5 (Multilingual) | 1,800-2,200 | P2 — Week 6 |

### 2E.2 Topic Cluster Strategy

Three pillar pages with supporting article clusters. Each pillar page is a comprehensive, long-form guide (3,000-4,000 words) that links to and from all its supporting articles.

#### Pillar 1: "AI Document Chat — Complete Guide" (Cluster 1)

| Role | Page | Target Keyword |
|------|------|----------------|
| **Pillar** | `/blog/ai-document-chat-complete-guide` | "ai document chat", "chat with document ai" |
| Support | `/blog/how-to-chat-with-pdf-ai` | "chat with pdf", "how to chat with pdf ai" |
| Support | `/blog/how-to-chat-with-docx-ai` | "chat with word document ai" |
| Support | `/blog/how-to-chat-with-pptx-ai` | "ai chat with pptx" |
| Support | `/blog/how-to-chat-with-excel-ai` | "chat with excel ai" |
| Support | `/blog/free-ai-pdf-chat-no-signup` | "free ai pdf chat no signup" |
| Support | `/features/multi-format` | "ai document reader", "upload any document ai" |
| Support | `/features/free-demo` | "try ai pdf tool free" |

**Internal linking structure**:
- Pillar links to all 7 supporting pages
- Each supporting page links back to pillar (breadcrumb + contextual)
- Supporting pages cross-link to 1-2 related supports
- All support pages link to `/demo` as CTA

#### Pillar 2: "Best AI PDF Tools Compared" (Cluster 3)

| Role | Page | Target Keyword |
|------|------|----------------|
| **Pillar** | `/blog/best-ai-pdf-tools-2026` | "best ai pdf tools 2026" |
| Support | `/compare/chatpdf` | "doctalk vs chatpdf" |
| Support | `/compare/askyourpdf` | "doctalk vs askyourpdf" |
| Support | `/compare/notebooklm` | "doctalk vs notebooklm" |
| Support | `/compare/humata` | "doctalk vs humata" |
| Support | `/compare/pdf-ai` | "doctalk vs pdf.ai" |
| Support | `/alternatives/chatpdf` | "chatpdf alternatives 2026" |
| Support | `/alternatives/notebooklm` | "notebooklm alternatives" |
| Support | `/blog/chatpdf-vs-askyourpdf-vs-doctalk` | "chatpdf vs askyourpdf" |

**Internal linking structure**:
- Pillar links to all comparison and alternative pages
- Each comparison page links back to pillar
- Comparison pages link to related alternative pages
- All pages link to `/demo` as CTA

#### Pillar 3: "AI Citations & Source Verification" (Cluster 2)

| Role | Page | Target Keyword |
|------|------|----------------|
| **Pillar** | `/blog/ai-citations-source-verification-guide` | "ai document citations", "ai citation verification" |
| Support | `/blog/why-ai-citations-matter` | "ai hallucination documents", "ai citations importance" |
| Support | `/features/citations` | "ai pdf reader with citations" |
| Support | `/use-cases/students` | "ai research paper citations" |
| Support | `/use-cases/lawyers` | "ai legal document source citation" |

**Internal linking structure**:
- Pillar links to all supports
- Feature page and use case pages link back to pillar
- Blog post links to feature page
- All pages link to `/demo`

### 2E.3 Content Calendar Template (Weeks 3-6)

#### Week 3 (Blog Infrastructure + First Content)

| Day | Task | Deliverable |
|-----|------|-------------|
| Mon | Blog infrastructure setup | MDX deps, blog index page, blog post page |
| Tue | Blog infrastructure (cont.) | Category page, sitemap update, schema markup |
| Wed | Write Blog Post #1 | "How to Chat with a PDF Using AI" |
| Thu | Write Blog Post #2 | "Best AI PDF Tools Compared (2026)" |
| Fri | Comparison template + ChatPDF comparison | `/compare/chatpdf` page build + content |

#### Week 4 (Comparisons + Blog Posts)

| Day | Task | Deliverable |
|-----|------|-------------|
| Mon | Write Blog Post #3 | "How to Chat with DOCX Using AI" |
| Tue | Write comparison content | `/compare/askyourpdf`, `/compare/notebooklm` |
| Wed | Write Blog Post #4 | "ChatPDF vs AskYourPDF vs DocTalk" |
| Thu | Alternative page template + ChatPDF alts | `/alternatives/chatpdf` page build + content |
| Fri | Write Blog Post #5 (Pillar) | "AI Document Chat: Complete Guide" |

#### Week 5 (Feature Pages + Blog Posts)

| Day | Task | Deliverable |
|-----|------|-------------|
| Mon | Feature pages build | `/features/citations`, `/features/multi-format` |
| Tue | Feature page content | Citation + multi-format page content writing |
| Wed | Write Blog Post #7 | "Why AI Citations Matter" |
| Thu | Write Blog Post #8 + #10 | "Chat with Excel AI" + "Free AI PDF Chat" |
| Fri | Feature pages | `/features/multilingual`, `/features/free-demo` |

#### Week 6 (Use Case Pages + Remaining Blog Posts)

| Day | Task | Deliverable |
|-----|------|-------------|
| Mon | Use case page template + Students page | `/use-cases/students` |
| Tue | Legal use case page | `/use-cases/lawyers` |
| Wed | Write Blog Post #9 | "AI for Research Papers" |
| Thu | Write Blog Post #11 | "How to Analyze Earnings Reports with AI" |
| Fri | Finance use case + Blog Post #12 | `/use-cases/finance` + "Multilingual AI Guide" |

### 2E.4 SEO Writing Guidelines

Every page and blog post must follow these guidelines:

#### Title Tag Rules
- **Length**: 50-60 characters (Google truncates at ~60)
- **Format**: `Primary Keyword: Benefit/Context | DocTalk`
- **Include year** for comparison/listicle content (e.g., "2026")
- **Front-load keyword** — primary keyword within first 30 characters
- **Never duplicate** title tags across pages

#### Meta Description Rules
- **Length**: 140-155 characters
- **Include primary keyword** naturally
- **Include CTA language** ("Try free", "Compare now", "Learn how")
- **Unique** per page
- **Avoid** quotes, special characters that break in SERPs

#### Heading Hierarchy Rules
- **H1**: One per page, contains primary keyword, 40-70 characters
- **H2**: 4-8 per page, each targets a secondary keyword or subtopic
- **H3**: Used within H2 sections for granularity
- **Never skip levels** (no H1 → H3)
- **Never use headings for styling** — use CSS instead

#### Internal Linking Rules
- **Minimum 3 internal links** per page
- **Use descriptive anchor text** (not "click here")
- **Link to relevant pages** (feature page from use case, comparison from blog)
- **Every page links to `/demo`** with CTA
- **Every blog post links to** at least 1 feature page and 1 other blog post
- **Hub pages link to all their child pages**

#### Schema Markup Rules

| Page Type | Required Schema |
|-----------|----------------|
| Blog post | `Article` + `BreadcrumbList` |
| Blog post with FAQ section | `Article` + `FAQPage` + `BreadcrumbList` |
| Blog post with how-to steps | `Article` + `HowTo` + `BreadcrumbList` |
| Comparison page | `Article` + `FAQPage` + `BreadcrumbList` |
| Alternative page | `Article` + `ItemList` + `FAQPage` + `BreadcrumbList` |
| Feature page | `SoftwareApplication` + `FAQPage` + `BreadcrumbList` |
| Use case page | `Article` + `FAQPage` + `BreadcrumbList` |
| Hub page | `CollectionPage` + `BreadcrumbList` |

#### Content Quality Rules
- **No thin content**: Minimum 1,000 words for any indexed page
- **No keyword stuffing**: Primary keyword appears 3-5 times naturally
- **Answer first**: Put the most important answer/insight in the first paragraph
- **Use lists and tables**: Break up text for scannability and featured snippet eligibility
- **Include images**: At least 1 screenshot or diagram per page, with descriptive `alt` text containing keywords
- **Update dates**: Show "Last updated: [date]" on all comparison and listicle pages
- **Cite sources**: When making claims about competitors, link to their actual pages

#### Image SEO Rules
- **File names**: Descriptive, hyphenated (`doctalk-citation-highlighting-screenshot.png`, not `IMG_001.png`)
- **Alt text**: Describe the image content with relevant keyword (`"DocTalk interface showing citation highlighting in a PDF document"`)
- **Format**: WebP preferred, PNG for screenshots, SVG for diagrams
- **Size**: Compress to < 200KB; use Next.js `<Image>` component for automatic optimization
- **Location**: `/public/blog/images/[post-slug]/`

---

## Implementation Checklist

### Week 3 Checklist

- [ ] Install MDX dependencies (`@next/mdx`, `@mdx-js/react`, `@mdx-js/loader`, `gray-matter`, `reading-time`, `rehype-slug`, `rehype-autolink-headings`)
- [ ] Update `next.config.mjs` to support MDX
- [ ] Create `content/blog/` directory structure
- [ ] Build `/blog` index page with category filtering
- [ ] Build `/blog/[slug]` post page with MDX rendering, TOC, author box, schema
- [ ] Build `/blog/category/[category]` category archive page
- [ ] Update `sitemap.ts` to dynamically include blog posts
- [ ] Build `ComparisonTable` reusable component
- [ ] Build comparison page template (`/compare/[competitor]`)
- [ ] Write and publish Blog Post #1: "How to Chat with a PDF Using AI"
- [ ] Write and publish Blog Post #2: "Best AI PDF Tools Compared (2026)"
- [ ] Write and publish `/compare/chatpdf` comparison page
- [ ] Verify all new pages appear in sitemap.xml
- [ ] Test Article + BreadcrumbList JSON-LD with Google Rich Results Test

### Week 4 Checklist

- [ ] Write and publish Blog Post #3: "How to Chat with DOCX Using AI"
- [ ] Write and publish Blog Post #4: "ChatPDF vs AskYourPDF vs DocTalk"
- [ ] Write and publish Blog Post #5 (Pillar): "AI Document Chat: Complete Guide"
- [ ] Write and publish `/compare/askyourpdf` comparison page
- [ ] Write and publish `/compare/notebooklm` comparison page
- [ ] Build alternative page template (`/alternatives/[competitor]`)
- [ ] Write and publish `/alternatives/chatpdf` alternative page
- [ ] Write and publish Blog Post #6: "How to Analyze PowerPoint with AI"
- [ ] Add internal links from new pages to existing pages (homepage, /demo, /billing)
- [ ] Submit new URLs to Google Search Console for indexing
- [ ] Submit new URLs to Bing Webmaster Tools

### Week 5 Checklist

- [ ] Build feature page components (hero, steps, comparison mini-table, FAQ)
- [ ] Build and publish `/features/citations` page
- [ ] Build and publish `/features/multi-format` page
- [ ] Build and publish `/features/multilingual` page
- [ ] Build and publish `/features/free-demo` page
- [ ] Write and publish Blog Post #7: "Why AI Citations Matter"
- [ ] Write and publish Blog Post #8: "Chat with Excel Using AI"
- [ ] Write and publish Blog Post #10: "Free AI PDF Chat: No Signup"
- [ ] Build `/features` hub page (links to all feature pages)
- [ ] Update homepage to add links to new feature pages
- [ ] Update sitemap.ts to include feature pages

### Week 6 Checklist

- [ ] Build use case page template
- [ ] Write and publish `/use-cases/students` page
- [ ] Write and publish `/use-cases/lawyers` page
- [ ] Write and publish `/use-cases/finance` page
- [ ] Write and publish Blog Post #9: "AI for Research Papers"
- [ ] Write and publish Blog Post #11: "Analyze Earnings Reports with AI"
- [ ] Write and publish Blog Post #12: "Multilingual AI Document Chat"
- [ ] Build `/use-cases` hub page
- [ ] Write and publish `/compare/humata` and `/compare/pdf-ai`
- [ ] Write and publish `/alternatives/notebooklm` and `/alternatives/humata`
- [ ] Build `/features/performance-modes` page
- [ ] Build `/use-cases/hr-contracts` page
- [ ] Update sitemap.ts to include use case and remaining pages
- [ ] Full internal link audit — ensure all cross-links are in place
- [ ] Submit all new URLs to GSC and Bing
- [ ] Validate all pages with Google Rich Results Test
- [ ] Run Lighthouse SEO audit on all new pages (target 95+)

---

## Effort Summary — Phase 2 Total

| Component | Writing Effort | Build Effort | Total |
|-----------|---------------|-------------|-------|
| 2A: Blog Infrastructure | — | 22-30h | 22-30h |
| 2B: Comparison & Alternative Pages | 33-44h | 20-22h | 53-66h |
| 2C: Feature Landing Pages | 13-17h | 15-18h | 28-35h |
| 2D: Use Case Pages | 16-20h | 13-14h | 29-34h |
| 2E: 12 Blog Posts | 36-48h | — (MDX, no page build) | 36-48h |
| **Grand Total** | **~98-129h** | **~70-84h** | **~168-213h** |

**Estimated timeline**: 4 weeks at ~40-50h/week, or 3 weeks with focused effort and Codex delegation for template builds.

**Codex delegation candidates** (mechanical implementation, well-defined specs):
- Blog infrastructure setup (install deps, config, page scaffolding)
- Comparison page template component
- Feature page template component
- Sitemap.ts update
- Schema markup injection
- ComparisonTable reusable component

**Must be human-written** (requires research, judgment, brand voice):
- All blog post content
- All comparison page content (fair competitor analysis)
- All feature page copy (product positioning)
- All use case page content (industry-specific knowledge)

---

## Expected Outcomes After Phase 2

| Metric | Before Phase 2 | After Phase 2 (Week 6) | 3 Months Post-Launch |
|--------|---------------|----------------------|---------------------|
| Indexed pages | 5 | ~35-40 | ~40-50 (with updates) |
| Blog posts | 0 | 12 | 20+ |
| Comparison pages | 0 | 5 | 5 (quarterly updates) |
| Alternative pages | 0 | 3 | 3-5 |
| Feature pages | 0 | 5 | 5 |
| Use case pages | 0 | 4 | 6-8 |
| Sitemap URLs | 5 | 35-40 | 50+ |
| Monthly organic visits | ~0 | 100-300 (indexation lag) | 2,000-5,000 |
| Target keywords ranked | 0 | 20-40 (mostly long-tail) | 80-150 |

**Key success factors**:
1. Publish consistently (12 posts in 4 weeks = 3/week)
2. Build internal links aggressively (every new page linked to 3+ existing pages)
3. Submit URLs to GSC immediately after publishing
4. Update comparison pages quarterly to maintain freshness signals
5. Monitor GSC for cannibalization signals and fix within 2 weeks

---

*Phase 2 plan drafted 2026-02-18. All search volume estimates from the keyword strategy analysis (seo-deep-keywords.md). Volumes are approximations — validate with Ahrefs, Semrush, or Google Keyword Planner before finalizing content priorities.*
