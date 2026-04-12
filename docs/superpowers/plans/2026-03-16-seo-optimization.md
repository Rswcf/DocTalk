# SEO Optimization Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement all actionable SEO optimizations identified in the comprehensive audit, excluding FAQ expansion and deep E-E-A-T construction per user decision.

**Architecture:** Changes span frontend config (robots.ts, seo.ts, next.config.mjs), component styling (zinc color contrast), schema markup (pricing AggregateOffer, datePublished), and new static files (llms.txt). All changes are additive and non-breaking. No backend changes required.

**Tech Stack:** Next.js 14 (App Router), TypeScript, Tailwind CSS, JSON-LD structured data

**Constraints:**
- No FAQ expansion (existing FAQs maintained as-is)
- No deep E-E-A-T construction (no author bio system, no team pages)
- `datePublished` is treated as basic metadata, not E-E-A-T
- Analysis-only items (locale URL migration, programmatic SEO, content production) are documented as future phases, not implemented here

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `frontend/src/app/robots.ts` | Modify | Add AI crawler Allow rules |
| `frontend/public/llms.txt` | Create | AI discoverability file |
| `frontend/src/lib/seo.ts` | Modify | Add locale parameter to OG metadata |
| `frontend/src/app/pricing/page.tsx` | Modify | Add AggregateOffer schema |
| `frontend/src/app/compare/chatpdf/page.tsx` | Modify | Add keywords + external links pattern |
| `frontend/src/app/compare/askyourpdf/page.tsx` | Modify | Add keywords |
| `frontend/src/app/compare/notebooklm/page.tsx` | Modify | Add keywords |
| `frontend/src/app/compare/humata/page.tsx` | Modify | Add keywords |
| `frontend/src/app/compare/pdf-ai/page.tsx` | Modify | Add keywords |
| `frontend/src/app/features/page.tsx` | Modify | Add keywords |
| `frontend/src/app/features/citations/page.tsx` | Modify | Add keywords |
| `frontend/src/app/features/multi-format/page.tsx` | Modify | Add keywords |
| `frontend/src/app/features/multilingual/page.tsx` | Modify | Add keywords |
| `frontend/src/app/features/free-demo/page.tsx` | Modify | Add keywords |
| `frontend/src/app/features/performance-modes/page.tsx` | Modify | Add keywords |
| `frontend/src/app/use-cases/page.tsx` | Modify | Add keywords |
| `frontend/src/app/use-cases/students/page.tsx` | Modify | Add keywords |
| `frontend/src/app/use-cases/lawyers/page.tsx` | Modify | Add keywords |
| `frontend/src/app/use-cases/finance/page.tsx` | Modify | Add keywords |
| `frontend/src/app/use-cases/hr-contracts/page.tsx` | Modify | Add keywords |
| `frontend/src/app/alternatives/page.tsx` | Modify | Add keywords |
| `frontend/src/app/alternatives/chatpdf/page.tsx` | Modify | Add keywords |
| `frontend/src/app/alternatives/notebooklm/page.tsx` | Modify | Add keywords |
| `frontend/src/app/alternatives/humata/page.tsx` | Modify | Add keywords |
| `frontend/src/app/about/page.tsx` | Modify | Add keywords |
| `frontend/src/app/demo/page.tsx` | Modify | Add keywords |
| `frontend/src/app/contact/page.tsx` | Modify | Add keywords |
| `frontend/src/app/compare/page.tsx` | Modify | Add keywords |
| `frontend/src/app/blog/page.tsx` | Modify | Add keywords |
| `frontend/src/app/page.tsx` | Modify | Add keywords + datePublished to schema |
| `frontend/src/app/globals.css` | No change | Colors defined via Tailwind, not CSS vars |
| `frontend/next.config.mjs` | Modify | Add X-Robots-Tag headers for private routes |
| All public `*Client.tsx` files | Modify | Fix dark:text-zinc-400→dark:text-zinc-300 |

---

## Chunk 1: AI Crawler Access & Discoverability

### Task 1: Add AI Crawler Rules to robots.txt

**Files:**
- Modify: `frontend/src/app/robots.ts`

- [ ] **Step 1: Update robots.ts to add AI crawler rules**

The current file has a single `rules` entry for `*`. Add explicit Allow rules for AI crawlers. Use a shared config to avoid 7x duplication (Codex review S1).

```typescript
import type { MetadataRoute } from "next";

const PRIVATE_ROUTES = ["/api/", "/auth", "/billing", "/profile", "/collections", "/admin", "/d/"];
const AI_CRAWLERS = ["GPTBot", "ChatGPT-User", "OAI-SearchBot", "PerplexityBot", "ClaudeBot", "Google-Extended"];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: PRIVATE_ROUTES,
      },
      ...AI_CRAWLERS.map((ua) => ({
        userAgent: ua,
        allow: "/" as const,
        disallow: PRIVATE_ROUTES,
      })),
    ],
    sitemap: "https://www.doctalk.site/sitemap.xml",
  };
}
```

- [ ] **Step 2: Verify build succeeds**

Run: `cd frontend && npx next build 2>&1 | tail -5`
Expected: Build completes without errors

- [ ] **Step 3: Commit**

```bash
git add frontend/src/app/robots.ts
git commit -m "feat(seo): add AI crawler Allow rules to robots.txt

Allow GPTBot, ChatGPT-User, OAI-SearchBot, PerplexityBot, ClaudeBot,
and Google-Extended explicit access for AI search discoverability."
```

---

### Task 2: Create llms.txt

**Files:**
- Create: `frontend/public/llms.txt`

- [ ] **Step 1: Create llms.txt in public directory**

```markdown
# DocTalk

> AI document chat with cited answers. Upload PDF, DOCX, PPTX, XLSX, TXT, Markdown, or a URL and chat with AI that cites original text with real-time highlight navigation.

## Product

- [Home](https://www.doctalk.site)
- [Features](https://www.doctalk.site/features)
- [Citation Highlighting](https://www.doctalk.site/features/citations)
- [Multi-Format Support](https://www.doctalk.site/features/multi-format)
- [Multilingual (11 Languages)](https://www.doctalk.site/features/multilingual)
- [Free Demo (No Signup)](https://www.doctalk.site/demo)
- [Pricing](https://www.doctalk.site/pricing)

## Use Cases

- [Students & Researchers](https://www.doctalk.site/use-cases/students)
- [Legal Professionals](https://www.doctalk.site/use-cases/lawyers)
- [Finance Teams](https://www.doctalk.site/use-cases/finance)
- [HR & Contracts](https://www.doctalk.site/use-cases/hr-contracts)

## Comparisons

- [DocTalk vs ChatPDF](https://www.doctalk.site/compare/chatpdf)
- [DocTalk vs AskYourPDF](https://www.doctalk.site/compare/askyourpdf)
- [DocTalk vs NotebookLM](https://www.doctalk.site/compare/notebooklm)
- [DocTalk vs Humata](https://www.doctalk.site/compare/humata)
- [DocTalk vs PDF.ai](https://www.doctalk.site/compare/pdf-ai)

## Blog

- [Best AI PDF Tools 2026](https://www.doctalk.site/blog/best-ai-pdf-tools-2026)
- [Free AI PDF Chat No Signup](https://www.doctalk.site/blog/free-ai-pdf-chat-no-signup)
- [How to Chat with DOCX Using AI](https://www.doctalk.site/blog/how-to-chat-with-docx-ai)
- [How to Chat with PDF Using AI](https://www.doctalk.site/blog/how-to-chat-with-pdf-ai)

## About

- [About DocTalk](https://www.doctalk.site/about)
- [Contact](https://www.doctalk.site/contact)
```

- [ ] **Step 2: Verify file is served**

Run: `cd frontend && npx next build && npx next start &` then `curl -s http://localhost:3000/llms.txt | head -5`
Expected: Shows "# DocTalk" header

- [ ] **Step 3: Commit**

```bash
git add frontend/public/llms.txt
git commit -m "feat(seo): add llms.txt for AI search discoverability

Emerging standard (844K+ sites). Points AI crawlers to key product,
use-case, comparison, and blog pages."
```

---

## Chunk 2: Schema & Metadata Fixes

### Task 3: Add datePublished to Homepage JSON-LD Schemas

**Files:**
- Modify: `frontend/src/app/page.tsx`

The homepage WebSite/Organization schema and SoftwareApplication schema lack `datePublished`/`dateModified`. The Article-type schemas on compare/use-case pages already have it via `buildArticleJsonLd()`, but the homepage schemas don't.

- [ ] **Step 1: Add dateModified to SoftwareApplication schema**

In `frontend/src/app/page.tsx`, find the SoftwareApplication JSON-LD block and add `datePublished` and `dateModified`:

```typescript
// Add these two fields to the SoftwareApplication schema object:
datePublished: '2026-01-15',
dateModified: '2026-03-16',
```

- [ ] **Step 2: Verify JSON-LD is valid**

Run: `cd frontend && npx next build 2>&1 | tail -5`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add frontend/src/app/page.tsx
git commit -m "feat(seo): add datePublished/dateModified to homepage schema"
```

---

### Task 4: Add AggregateOffer Schema to Pricing Page

**Files:**
- Modify: `frontend/src/app/pricing/page.tsx`

- [ ] **Step 1: Add AggregateOffer JSON-LD block**

After the existing FAQPage `<script>` block in `frontend/src/app/pricing/page.tsx`, add:

```tsx
<script
  type="application/ld+json"
  dangerouslySetInnerHTML={{
    __html: JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: 'DocTalk',
      applicationCategory: 'ProductivityApplication',
      operatingSystem: 'Web',
      url: absoluteUrl('/pricing'),
      offers: {
        '@type': 'AggregateOffer',
        priceCurrency: 'USD',
        lowPrice: '0',
        highPrice: '19.99',
        offerCount: 3,
        offers: [
          {
            '@type': 'Offer',
            name: 'Free',
            price: '0',
            priceCurrency: 'USD',
            description: '500 credits/month, 3 documents, Quick & Balanced AI modes',
          },
          {
            '@type': 'Offer',
            name: 'Plus',
            price: '9.99',
            priceCurrency: 'USD',
            description: '3,000 credits/month, unlimited documents, all AI modes including Thorough',
          },
          {
            '@type': 'Offer',
            name: 'Pro',
            price: '19.99',
            priceCurrency: 'USD',
            description: '9,000 credits/month, unlimited documents, custom instructions, priority support',
          },
        ],
      },
    }),
  }}
/>
```

- [ ] **Step 2: Verify build**

Run: `cd frontend && npx next build 2>&1 | tail -5`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add frontend/src/app/pricing/page.tsx
git commit -m "feat(seo): add AggregateOffer schema to pricing page

SoftwareApplication with 3 Offer tiers (Free/Plus/Pro).
No competitors implement this - competitive advantage for rich snippets."
```

---

### Task 5: Fix OG Locale Hardcoding in buildMarketingMetadata

**Files:**
- Modify: `frontend/src/lib/seo.ts`

The `buildMarketingMetadata()` function hardcodes `locale: 'en_US'` in openGraph. This should accept an optional locale parameter.

- [ ] **Step 1: Add locale to MarketingMetadataOptions interface**

In `frontend/src/lib/seo.ts`, add `locale?` to the interface:

```typescript
interface MarketingMetadataOptions {
  title: Metadata['title'];
  description: string;
  path: string;
  keywords?: string[];
  robots?: Metadata['robots'];
  openGraph?: Partial<OpenGraphInput>;
  twitter?: Partial<TwitterInput>;
  locale?: string;  // Add this line
}
```

- [ ] **Step 2: Add locale mapping and use in buildMarketingMetadata**

Add a locale mapping helper before the function, and use it:

```typescript
const OG_LOCALE_MAP: Record<string, string> = {
  en: 'en_US',
  zh: 'zh_CN',
  es: 'es_ES',
  ja: 'ja_JP',
  de: 'de_DE',
  fr: 'fr_FR',
  ko: 'ko_KR',
  pt: 'pt_BR',
  it: 'it_IT',
  ar: 'ar_SA',
  hi: 'hi_IN',
};
```

Then in the `buildMarketingMetadata` function, destructure `locale` and use it:

```typescript
export function buildMarketingMetadata({
  title,
  description,
  path,
  keywords,
  robots,
  openGraph,
  twitter,
  locale,  // Add this
}: MarketingMetadataOptions): Metadata {
  const titleText = resolveTitleText(title);

  return {
    title,
    description,
    ...(keywords ? { keywords } : {}),
    alternates: {
      canonical: path,
    },
    ...(robots ? { robots } : {}),
    openGraph: {
      title: titleText,
      description,
      url: absoluteUrl(path),
      siteName: 'DocTalk',
      locale: locale ? (OG_LOCALE_MAP[locale] ?? 'en_US') : 'en_US',
      // ... rest stays the same
```

- [ ] **Step 3: Verify build (no callers need changes since locale is optional)**

Run: `cd frontend && npx next build 2>&1 | tail -5`
Expected: Build succeeds (existing callers still work without locale param)

- [ ] **Step 4: Commit**

```bash
git add frontend/src/lib/seo.ts
git commit -m "feat(seo): add optional locale param to buildMarketingMetadata

OG locale was hardcoded to en_US. Now accepts locale code and maps
to proper OG locale (zh→zh_CN, ja→ja_JP, etc). Backward compatible."
```

---

## Chunk 3: Keywords Meta Tags

### Task 6: Add Keywords to All Public Marketing Pages

**Files:** All `page.tsx` files listed in file map above.

Currently only `/pricing` has keywords. Every public marketing page needs targeted keywords.

- [ ] **Step 1: Add keywords to homepage**

In `frontend/src/app/page.tsx`, add to the `buildMarketingMetadata` call:

```typescript
keywords: [
  'ai document chat',
  'chat with pdf',
  'ai pdf reader',
  'document analysis ai',
  'pdf question answering',
  'citation highlighting',
],
```

- [ ] **Step 2: Add keywords to features pages**

`frontend/src/app/features/page.tsx`:
```typescript
keywords: ['ai document features', 'pdf chat features', 'document ai capabilities'],
```

`frontend/src/app/features/citations/page.tsx`:
```typescript
keywords: ['citation highlighting', 'ai citation', 'document citation', 'source verification ai'],
```

`frontend/src/app/features/multi-format/page.tsx`:
```typescript
keywords: ['multi format document ai', 'pdf docx pptx ai', 'document converter chat'],
```

`frontend/src/app/features/multilingual/page.tsx`:
```typescript
keywords: ['multilingual document ai', 'ai chat any language', 'document translation ai'],
```

`frontend/src/app/features/free-demo/page.tsx`:
```typescript
keywords: ['free ai pdf demo', 'try document ai free', 'no signup pdf chat'],
```

`frontend/src/app/features/performance-modes/page.tsx`:
```typescript
keywords: ['ai performance modes', 'quick balanced thorough ai', 'ai model selection'],
```

- [ ] **Step 3: Add keywords to compare pages**

`frontend/src/app/compare/chatpdf/page.tsx`:
```typescript
keywords: ['doctalk vs chatpdf', 'chatpdf alternative', 'chatpdf comparison'],
```

`frontend/src/app/compare/askyourpdf/page.tsx`:
```typescript
keywords: ['doctalk vs askyourpdf', 'askyourpdf alternative', 'askyourpdf comparison'],
```

`frontend/src/app/compare/notebooklm/page.tsx`:
```typescript
keywords: ['doctalk vs notebooklm', 'notebooklm alternative', 'google notebooklm comparison'],
```

`frontend/src/app/compare/humata/page.tsx`:
```typescript
keywords: ['doctalk vs humata', 'humata alternative', 'humata ai comparison'],
```

`frontend/src/app/compare/pdf-ai/page.tsx`:
```typescript
keywords: ['doctalk vs pdf ai', 'pdf ai alternative', 'pdf.ai comparison'],
```

- [ ] **Step 4: Add keywords to alternatives pages**

`frontend/src/app/alternatives/page.tsx`:
```typescript
keywords: ['ai pdf alternatives', 'chatpdf alternatives', 'document ai tools'],
```

`frontend/src/app/alternatives/chatpdf/page.tsx`:
```typescript
keywords: ['chatpdf alternatives', 'best chatpdf alternative', 'chatpdf replacement'],
```

`frontend/src/app/alternatives/notebooklm/page.tsx`:
```typescript
keywords: ['notebooklm alternatives', 'best notebooklm alternative', 'google notebooklm replacement'],
```

`frontend/src/app/alternatives/humata/page.tsx`:
```typescript
keywords: ['humata alternatives', 'best humata alternative', 'humata ai replacement'],
```

- [ ] **Step 5: Add keywords to use-cases pages**

`frontend/src/app/use-cases/page.tsx`:
```typescript
keywords: ['ai document use cases', 'pdf ai for business', 'document chat applications'],
```

`frontend/src/app/use-cases/students/page.tsx`:
```typescript
keywords: ['ai for students', 'student pdf tool', 'research paper ai', 'academic document chat'],
```

`frontend/src/app/use-cases/lawyers/page.tsx`:
```typescript
keywords: ['ai for lawyers', 'legal document ai', 'contract analysis ai', 'legal pdf reader'],
```

`frontend/src/app/use-cases/finance/page.tsx`:
```typescript
keywords: ['ai for finance', 'financial document ai', 'annual report ai analysis'],
```

`frontend/src/app/use-cases/hr-contracts/page.tsx`:
```typescript
keywords: ['hr contract ai', 'employment document analysis', 'hr document review ai'],
```

- [ ] **Step 6: Add keywords to remaining pages**

`frontend/src/app/about/page.tsx`:
```typescript
keywords: ['about doctalk', 'ai document analysis company', 'doctalk team'],
```

`frontend/src/app/demo/page.tsx`:
```typescript
keywords: ['doctalk demo', 'try ai pdf chat', 'free document ai demo'],
```

`frontend/src/app/contact/page.tsx`:
```typescript
keywords: ['contact doctalk', 'doctalk support', 'document ai help'],
```

`frontend/src/app/compare/page.tsx` (hub):
```typescript
keywords: ['ai pdf tool comparison', 'chatpdf vs alternatives', 'document ai comparison'],
```

`frontend/src/app/blog/page.tsx` (index):
```typescript
keywords: ['ai document blog', 'pdf chat guides', 'document ai tutorials'],
```

- [ ] **Step 7: Verify build**

Run: `cd frontend && npx next build 2>&1 | tail -5`
Expected: Build succeeds

- [ ] **Step 8: Commit**

```bash
git add frontend/src/app/*/page.tsx frontend/src/app/*/*/page.tsx frontend/src/app/page.tsx
git commit -m "feat(seo): add targeted keywords to all 26 public marketing pages

Previously only /pricing had keywords meta tag. Now all features,
comparisons, alternatives, use-cases, about, demo, contact, compare hub,
and blog index pages have targeted keyword arrays."
```

---

## Chunk 4: Color Contrast Fix

### Task 7: Fix Dark Mode Color Contrast (dark:text-zinc-400 → dark:text-zinc-300)

**Files:**
- Modify: All public-facing component files (landing, header, footer, AND page-level client components)

The Squirrelscan audit flagged 217 color contrast issues. The root cause is `dark:text-zinc-400` (#a1a1aa) — insufficient contrast on dark backgrounds (#09090b). Upgrading to `dark:text-zinc-300` (#d4d4d8) resolves WCAG AA compliance.

**Scope:** Change `dark:text-zinc-400` to `dark:text-zinc-300` in ALL public-facing components. This includes:
- `frontend/src/components/landing/` (FAQ, FinalCTA, HowItWorks, SecuritySection, FeatureGrid, HeroSection, SocialProof)
- `frontend/src/components/PublicHeader.tsx`, `Footer.tsx`
- All public page client components: `FeaturesHubClient`, `CitationsClient`, `MultiFormatClient`, `MultilingualClient`, `FreeDemoClient`, `PerformanceModesClient`, `ChatpdfClient`, `AskyourpdfClient`, `NotebooklmClient`, `HumataClient`, `PdfaiClient`, `CompareHubClient`, `UseCasesHubClient`, `StudentsClient`, `LawyersClient`, `FinanceClient`, `HrContractsClient`, `AlternativesHubClient`, `ChatpdfAltsClient`, `HumataAltsClient`, `NotebooklmAltsClient`, `DemoPageClient`, `ContactPageClient`, `PricingPageClient`, `AboutPageClient`, `BlogIndexClient`

**Exclude** (app-internal, not crawled): `DocumentReaderPageClient`, `CollectionsPageClient`, `BillingPageClient`, `ProfilePageClient`, `AdminPageClient`

**Important:** Use **string matching** (`dark:text-zinc-400` → `dark:text-zinc-300`), NOT line numbers. Do NOT change bare `text-zinc-400` (without `dark:` prefix) as that affects light mode.

- [ ] **Step 1: Find all affected files**

Run: `grep -rln "dark:text-zinc-400" frontend/src/components/ frontend/src/app/`
This identifies every file containing the pattern. Exclude any files in the exclusion list above.

- [ ] **Step 2: Replace in landing components**

For each file in `frontend/src/components/landing/` (except ShowcasePlayer.tsx which uses bare `text-zinc-400`, not `dark:text-zinc-400`):
Use `replace_all` per file: `dark:text-zinc-400` → `dark:text-zinc-300`

Files: FAQ.tsx, FinalCTA.tsx, HowItWorks.tsx, SecuritySection.tsx, FeatureGrid.tsx, HeroSection.tsx, SocialProof.tsx

- [ ] **Step 3: Replace in shared components**

`PublicHeader.tsx` and `Footer.tsx`: `replace_all` `dark:text-zinc-400` → `dark:text-zinc-300`

- [ ] **Step 4: Replace in all public page client components**

For each `*Client.tsx` file identified in Step 1 that is NOT in the exclusion list:
Use `replace_all`: `dark:text-zinc-400` → `dark:text-zinc-300`

- [ ] **Step 5: Verify build**

Run: `cd frontend && npx next build 2>&1 | tail -5`
Expected: Build succeeds

- [ ] **Step 6: Verify no remaining instances in public components**

Run: `grep -rn "dark:text-zinc-400" frontend/src/components/landing/ frontend/src/components/PublicHeader.tsx frontend/src/components/Footer.tsx`
Expected: No matches (all replaced)

- [ ] **Step 7: Commit**

```bash
git add frontend/src/components/ frontend/src/app/
git commit -m "fix(a11y): improve dark mode text contrast zinc-400→zinc-300

Addresses 217 color contrast issues flagged by Squirrelscan audit.
All public-facing components updated (landing, header, footer, and
all public page client components). App-internal components excluded.
zinc-300 (#d4d4d8) provides WCAG AA compliant contrast on dark bg."
```

---

## Chunk 5: Security Headers & HTTP Fixes

### Task 8: Add X-Robots-Tag Headers for Private Routes

**Files:**
- Modify: `frontend/next.config.mjs`

Defense-in-depth: private routes already have meta robots noindex + robots.txt disallow, but adding HTTP header is best practice.

- [ ] **Step 1: Add X-Robots-Tag header rules**

In `frontend/next.config.mjs`, in the `headers()` async function, the return array currently has one entry `{ source: '/(.*)', headers: [...] }`. Add **separate entries before** it (Next.js `source` uses path-to-regexp, NOT regex groups — using `(auth|billing|...)` would break the build):

```javascript
// Add these entries BEFORE the existing catch-all entry in the returned array:
{
  source: '/auth/:path*',
  headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }],
},
{
  source: '/billing/:path*',
  headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }],
},
{
  source: '/profile/:path*',
  headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }],
},
{
  source: '/collections/:path*',
  headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }],
},
{
  source: '/admin/:path*',
  headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }],
},
{
  source: '/d/:path*',
  headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }],
},
```

- [ ] **Step 2: Verify build**

Run: `cd frontend && npx next build 2>&1 | tail -5`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add frontend/next.config.mjs
git commit -m "feat(seo): add X-Robots-Tag noindex header for private routes

Defense-in-depth alongside meta robots and robots.txt disallow.
Covers /auth, /billing, /profile, /collections, /admin, /d/*."
```

---

### Task 9: Fix non-www → www Redirect (Manual — Vercel Dashboard)

This is NOT a code change. Document for manual execution.

- [ ] **Step 1: Log into Vercel dashboard**

Go to: Project Settings → Domains

- [ ] **Step 2: Change doctalk.site redirect type**

Current: `doctalk.site` → `www.doctalk.site` (307 Temporary)
Change to: `doctalk.site` → `www.doctalk.site` (308 Permanent)

In Vercel: Remove `doctalk.site` domain, re-add it as redirect to `www.doctalk.site`. Vercel uses 308 for permanent redirects by default when configured correctly.

- [ ] **Step 3: Verify**

Run: `curl -sI http://doctalk.site 2>&1 | grep -i "location\|HTTP"`
Expected: 308 Permanent Redirect to `https://www.doctalk.site`

---

## Chunk 6: External Links for Content Pages

### Task 10: Add External Authority Links to Compare/Use-Case/Blog Pages

**Files:**
- Modify: Compare page client components
- Modify: Use-case page client components
- Modify: Blog post markdown files

16 pages have 0 external links. Each medium/long article should have at least 2 outbound links to authoritative sources. This signals content quality to Google.

**Note:** This task requires editorial judgment for link selection. Exact URLs are specified below for each page.

**Link pattern for TSX components:**
```tsx
<a href="URL" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">anchor text</a>
```

- [ ] **Step 1: Add external links to compare page client components**

| File | Links to Add |
|------|-------------|
| `frontend/src/app/compare/chatpdf/ChatpdfClient.tsx` | `https://chatpdf.com` (ChatPDF official), `https://arxiv.org/abs/2005.11401` (RAG paper) |
| `frontend/src/app/compare/askyourpdf/AskyourpdfClient.tsx` | `https://askyourpdf.com` (AskYourPDF official), `https://arxiv.org/abs/2005.11401` (RAG paper) |
| `frontend/src/app/compare/notebooklm/NotebooklmClient.tsx` | `https://notebooklm.google.com` (NotebookLM official), `https://blog.google/technology/ai/notebooklm/` (Google blog) |
| `frontend/src/app/compare/humata/HumataClient.tsx` | `https://www.humata.ai` (Humata official), `https://arxiv.org/abs/2005.11401` (RAG paper) |
| `frontend/src/app/compare/pdf-ai/PdfaiClient.tsx` | `https://pdf.ai` (PDF.ai official), `https://arxiv.org/abs/2005.11401` (RAG paper) |

Insert each link naturally in the section where the competitor is first described (e.g., "What is ChatPDF?" section).

- [ ] **Step 2: Add external links to use-case page client components**

| File | Links to Add |
|------|-------------|
| `frontend/src/app/use-cases/students/StudentsClient.tsx` | `https://scholar.google.com` (Google Scholar), `https://www.zotero.org` (Zotero reference manager) |
| `frontend/src/app/use-cases/lawyers/LawyersClient.tsx` | `https://www.americanbar.org/groups/law_practice/resources/tech-tools/` (ABA Legal Tech), `https://www.thomsonreuters.com/en/artificial-intelligence.html` (TR AI in Legal) |
| `frontend/src/app/use-cases/finance/FinanceClient.tsx` | `https://www.sec.gov/edgar/searchedgar/companysearch` (SEC EDGAR), `https://www.investopedia.com/terms/a/annual-report.asp` (Annual Reports) |
| `frontend/src/app/use-cases/hr-contracts/HrContractsClient.tsx` | `https://www.shrm.org` (SHRM), `https://www.dol.gov` (US Dept of Labor) |

Insert links in contextually appropriate sections (e.g., "industry resources" or "where professionals find documents").

- [ ] **Step 3: Add external links to blog posts**

| File | Links to Add |
|------|-------------|
| `frontend/content/blog/best-ai-pdf-tools-2026.md` | `https://chatpdf.com`, `https://askyourpdf.com`, `https://pdf.ai`, `https://www.humata.ai`, `https://notebooklm.google.com` (each tool's official site in its section) |
| `frontend/content/blog/free-ai-pdf-chat-no-signup.md` | `https://gdpr.eu/what-is-gdpr/` (GDPR), `https://arxiv.org/abs/2005.11401` (RAG paper) |
| `frontend/content/blog/how-to-chat-with-docx-ai.md` | `https://learn.microsoft.com/en-us/openspecs/office_standards/ms-docx/` (DOCX spec), `https://pandoc.org` (Pandoc converter) |
| `frontend/content/blog/how-to-chat-with-pdf-ai.md` | `https://www.adobe.com/acrobat/about-adobe-pdf.html` (Adobe PDF), `https://arxiv.org/abs/2005.11401` (RAG paper) |

- [ ] **Step 4: Verify build**

Run: `cd frontend && npx next build 2>&1 | tail -5`
Expected: Build succeeds

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/compare/ frontend/src/app/use-cases/ frontend/content/blog/
git commit -m "feat(seo): add external authority links to 16 content pages

All compare, use-case, and blog pages had 0 outbound links.
Added 2-3 authoritative external links per page linking to
competitor official sites, industry resources, and research papers."
```

---

## Chunk 7: Future Phases (Documentation Only)

These are NOT implemented in this plan. They are documented here for planning purposes.

### Phase A: Programmatic SEO (Next Sprint Priority)

**Goal:** Template-driven generation of "DocTalk vs [Competitor]" and "DocTalk for [Industry]" pages.
- Create comparison template component
- Create use-case template component
- Data-driven: JSON/YAML config per page, shared layout
- Target: 20+ competitor comparisons, 30+ industry use-cases
- This is the highest-ROI SEO work after the current plan

### Phase B: Locale URL Migration (Q2 2026)

**Goal:** Implement `/en/`, `/zh/`, `/ja/` etc. subdirectories.
- Refactor `app/` to `app/[locale]/` with Next.js App Router
- Update middleware to extract locale from URL path
- Implement hreflang between locale variants
- Submit per-locale sitemaps to Baidu, Naver, Yahoo Japan
- Prerequisite: All 2,089 translation keys already exist

### Phase C: Content Production (Ongoing)

**Goal:** Build topical authority with 50+ blog posts.
- 1-2 posts/week, minimum 2,500 words
- Focus areas: "how to chat with [format]", "best AI tools for [scenario]"
- Content clusters around "AI Document Q&A" pillar
- Include statistics, citations, comparison tables per AEO best practices

### Phase D: Off-Page Authority (Parallel)

**Goal:** Build "consensus signal" for AI search engines.
- Submit to G2, Capterra, Product Hunt, AlternativeTo, SourceForge
- Seek inclusion in "best AI document tools" roundup articles
- Reddit/HN community engagement (authentic, not promotional)

---

## Verification Checklist

After all tasks complete:

- [ ] `cd frontend && npx next build` succeeds
- [ ] `cd frontend && npx next lint` passes
- [ ] Visit `https://www.doctalk.site/robots.txt` — verify AI crawler rules present
- [ ] Visit `https://www.doctalk.site/llms.txt` — verify content renders
- [ ] Google Rich Results Test on `/pricing` — verify AggregateOffer
- [ ] Squirrelscan re-audit: `squirrel audit https://www.doctalk.site --refresh --format llm`
- [ ] Target: Score improvement from 83 → 87+
