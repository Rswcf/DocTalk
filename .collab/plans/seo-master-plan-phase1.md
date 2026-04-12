# SEO Master Plan -- Phase 1 (Weeks 1-2): Technical Foundation

**Date**: 2026-02-18
**Scope**: Critical technical fixes, search engine registration, structured data enhancements
**Prerequisite reading**: `seo-deep-technical.md` (802-line audit), `seo-deep-international.md` (locale architecture)

---

## Overview

Phase 1 focuses on fixing the highest-impact technical SEO issues identified in the deep audit, registering DocTalk with all major search engines, and enhancing structured data for rich result eligibility. These are foundational tasks that must be complete before content marketing (Phase 2) or international URL routing (Phase 3) can deliver results.

**Estimated total effort**: ~3-4 developer-days across 2 weeks.

---

## Phase 1A: Critical Technical Fixes (Week 1)

### 1A-1. Inter Font `display: 'swap'` Fix

**Priority**: P0 -- Blocks LCP improvement
**Audit refs**: Technical audit 2.1, 4.1

**What**: Add `display: 'swap'` to the Inter font declaration. Currently, Inter loads without `display: 'swap'`, causing Flash of Invisible Text (FOIT) -- all body text is invisible until the font file downloads. This directly hurts Largest Contentful Paint (LCP) because the H1 in HeroSection (the LCP element) is invisible during font load.

**Where**: `frontend/src/app/layout.tsx`, line 14

**How**: Change the Inter font declaration from:
```ts
const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })
```
to:
```ts
const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' })
```

**Why this matters**: The Sora font (line 15-20) already has `display: 'swap'` -- Inter was missed. With `swap`, the browser immediately renders text with a system fallback font, then swaps to Inter once loaded. This eliminates FOIT and can improve LCP by 200-500ms on slow connections.

**Impact**: High -- directly improves Core Web Vitals (LCP), which is a Google ranking signal. Also prevents CLS from late font swap on pages that currently show invisible text.

**Effort**: S (1 line change)

**KPI**:
- Measure LCP before/after using PageSpeed Insights (`pagespeed.web.dev`)
- Target: LCP under 2.5s on mobile (Good threshold)
- Verify via Chrome DevTools > Performance tab: text should be visible on first paint, not after font load

---

### 1A-2. Hreflang Fix (Remove Useless Same-URL Hreflang)

**Priority**: P0 -- Current implementation sends contradictory signals to Google
**Audit refs**: Technical audit 7.1, International audit Section 1

**What**: Remove all hreflang annotations from `layout.tsx`. Currently, all 11 locale hreflang tags point to the identical URL (`https://www.doctalk.site`), which is semantically incorrect and potentially confusing to search engines. Hreflang is designed to map distinct URLs to distinct languages. When all alternates resolve to the same page, Google ignores them entirely -- but the noise in the HTML wastes crawl budget and may trigger validation warnings in Search Console.

**Where**: `frontend/src/app/layout.tsx`, lines 29-44 (the `alternates.languages` object)

**How**: Remove the entire `languages` block from the `alternates` property. Keep the `canonical` property.

Change the metadata `alternates` from:
```ts
alternates: {
  canonical: '/',
  languages: {
    'x-default': 'https://www.doctalk.site',
    'en': 'https://www.doctalk.site',
    'zh': 'https://www.doctalk.site',
    // ... all 11 locales point to same URL
  },
},
```
to:
```ts
alternates: {
  canonical: '/',
},
```

**Why not fix hreflang to use locale URLs instead?** Proper hreflang requires locale-specific URLs (e.g., `/zh/`, `/ja/`), which requires Next.js i18n routing with `[locale]` segments. That is a Phase 3 effort (subdirectory i18n migration). Until locale URLs exist, hreflang tags provide zero value and should be removed.

**Impact**: High -- eliminates contradictory international SEO signals. Google Search Console will stop showing hreflang errors. Clean foundation for when proper locale URLs are implemented in Phase 3.

**Effort**: S (delete ~15 lines)

**KPI**:
- After deploying: check Google Search Console > International Targeting > Hreflang errors. Should show zero errors (vs. current "all alternates point to same URL" warnings)
- Validate via `view-source:https://www.doctalk.site` -- no `<link rel="alternate" hreflang="...">` tags should appear

---

### 1A-3. HowTo Schema for "How it works" Section

**Priority**: P1 -- Rich result eligibility
**Audit ref**: Technical audit 3.1

**What**: Add a `HowTo` JSON-LD structured data block to the homepage, matching the 3-step "How it works" section visible on the landing page. This section (Upload > Ask > Get Answers) is a textbook HowTo and qualifies for Google's HowTo rich result, which displays expandable step cards directly in search results.

**Where**: `frontend/src/app/page.tsx` -- add a new `<script type="application/ld+json">` block alongside the existing FAQPage and SoftwareApplication schemas

**How**: Add the following JSON-LD block after the existing SoftwareApplication schema (after line 106):

```tsx
{/* HowTo JSON-LD */}
<script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
  '@context': 'https://schema.org',
  '@type': 'HowTo',
  name: 'How to chat with your documents using DocTalk',
  description: 'Upload any document and get AI-powered answers with source citations in 3 simple steps.',
  totalTime: 'PT2M',
  step: [
    {
      '@type': 'HowToStep',
      position: 1,
      name: 'Upload your document',
      text: 'Upload a PDF, Word, PowerPoint, Excel, or text file, or paste a web URL. Drag, drop, done.',
      url: 'https://www.doctalk.site/#how-it-works',
    },
    {
      '@type': 'HowToStep',
      position: 2,
      name: 'Ask questions',
      text: 'Type naturally — like asking a colleague who just read the whole thing.',
      url: 'https://www.doctalk.site/#how-it-works',
    },
    {
      '@type': 'HowToStep',
      position: 3,
      name: 'Get verified answers',
      text: 'Every answer cites specific pages. Click a citation to jump straight to the source.',
      url: 'https://www.doctalk.site/#how-it-works',
    },
  ],
})}} />
```

**Important**: The step text MUST match the visible content in `HowItWorks.tsx` (sourced from `en.json` keys `landing.howItWorks.step1-3`). The audit confirmed these match. If the i18n text changes, this schema must update too.

**Impact**: Medium-High -- HowTo rich results earn significantly more SERP real estate and higher CTR. Google shows expandable step cards with numbered steps, which is exactly what DocTalk's 3-step process looks like.

**Effort**: S (add ~30 lines of JSON-LD to page.tsx)

**KPI**:
- Validate with Google Rich Results Test (`search.google.com/test/rich-results`) -- should show "HowTo" as eligible
- Monitor Google Search Console > Enhancements > HowTo for valid items
- Track impression/CTR change for homepage in Search Console over 4 weeks

---

### 1A-4. Internal Linking Improvements

**Priority**: P1 -- Improves crawl depth and link equity distribution
**Audit ref**: Technical audit 5.1, 5.2

#### 1A-4a. Add "Pricing" and "Demo" Links to Header Minimal Variant

**What**: The landing page uses `Header variant="minimal"`, which currently shows only the logo, UserMenu, and LanguageSelector. There are zero navigation links to other public pages. Visitors (and crawlers) must scroll all the way to the footer to find links to `/demo` or `/billing`. This hurts both crawlability and user navigation.

**Where**: `frontend/src/components/Header.tsx`, within the `isMinimal` render path (around lines 38-75)

**How**: Add "Demo" and "Pricing" text links to the header when `variant === 'minimal'`. These should appear between the logo and the right-side controls. Example implementation:

```tsx
{isMinimal && (
  <nav className="hidden sm:flex items-center gap-4 ml-4" aria-label="Main navigation">
    <Link
      href="/demo"
      className="text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-accent transition-colors"
    >
      {t('footer.demo')}
    </Link>
    <Link
      href="/billing"
      className="text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-accent transition-colors"
    >
      {t('footer.pricing')}
    </Link>
  </nav>
)}
```

Use `hidden sm:flex` to keep mobile header clean (links accessible via footer on mobile). Wrap in `<nav>` with `aria-label` for accessibility.

**Impact**: Medium -- adds 2 internal links on the most-visited page, distributes link equity to `/demo` and `/billing`, and improves user navigation.

**Effort**: S

#### 1A-4b. Add Pricing CTA in Landing Page Body

**What**: The `/billing` (pricing) page is only linked from the footer and nowhere in the landing page body. Adding a "See Pricing" link after the SocialProof or FeatureGrid section provides crawlers another path to the pricing page and gives users a natural conversion touchpoint.

**Where**: `frontend/src/app/HomePageClient.tsx`, in the `LandingPageContent` function -- add a CTA link after one of the mid-page sections (e.g., after SocialProof, before SecuritySection)

**How**: Add a simple centered CTA between landing sections:

```tsx
<ScrollReveal>
  <div className="text-center py-8">
    <Link
      href="/billing"
      className="text-sm font-medium text-accent hover:underline"
    >
      {t('footer.pricing')} &rarr;
    </Link>
  </div>
</ScrollReveal>
```

Alternatively, incorporate it into the SocialProof or FeatureGrid section as a subtitle link: "See all plans and pricing."

**Impact**: Medium -- adds a contextually relevant internal link to `/billing` from the homepage body content.

**Effort**: S

**KPI for both 1A-4a and 1A-4b**:
- Verify with Screaming Frog or `site:doctalk.site` that `/demo` and `/billing` are reachable from the homepage via non-footer links
- Monitor internal link count per page in Google Search Console > Links
- Check Google cache of homepage includes the new nav links

---

### 1A-5. ScrollReveal First-Viewport Optimization

**Priority**: P1 -- Affects initial content visibility for crawlers
**Audit ref**: Technical audit 2.2

**What**: The `HeroSection` component is wrapped in `<ScrollReveal direction="up" delay={0}>`, which means all hero content starts at `opacity: 0` and only becomes visible after JavaScript loads and the IntersectionObserver fires. For SEO crawlers that partially render JS (Bing, older Googlebot configurations), the hero text may appear empty.

**Where**: `frontend/src/components/landing/HeroSection.tsx`, line 13

**How**: Remove the `ScrollReveal` wrapper from HeroSection. The hero is the first element on the page and is always in the viewport on load -- scroll-reveal animation provides no visual benefit for content that is immediately visible. The content should render at full opacity instantly.

Change from:
```tsx
export default function HeroSection() {
  // ...
  return (
    <ScrollReveal direction="up" delay={0}>
      <section className="relative max-w-6xl mx-auto px-6 py-24 md:py-32 overflow-hidden">
        {/* ... */}
      </section>
    </ScrollReveal>
  );
}
```
to:
```tsx
export default function HeroSection() {
  // ...
  return (
    <section className="relative max-w-6xl mx-auto px-6 py-24 md:py-32 overflow-hidden">
      {/* ... */}
    </section>
  );
}
```

**Impact**: Medium -- ensures the hero text (H1, subtitle, CTAs) is immediately visible without requiring JS execution. Improves perceived load speed and ensures crawlers always see the primary content.

**Effort**: S (remove wrapper element)

**KPI**:
- Use `curl https://www.doctalk.site | grep -c "opacity-0"` -- should not find the hero content wrapped in opacity-0
- Google Cache check: hero text should be visible in the cached version
- Test with "View Rendered Source" in Chrome DevTools -- hero should be visible in initial HTML

---

### 1A-6. Email Inconsistency Fix

**Priority**: P1 -- Trust signal consistency
**Audit ref**: Technical audit 5.3

**What**: The Footer component uses `support@doctalk.app` in the mailto link (line 56), while the Organization JSON-LD schema in `layout.tsx` uses `support@doctalk.site` (line 105). This inconsistency can confuse both users and search engines about the canonical contact email.

**Where**:
- `frontend/src/components/Footer.tsx`, line 56 -- the `mailto:` link
- `frontend/src/app/layout.tsx`, line 105 -- Organization schema contactPoint email

**How**: Decide on the canonical email domain and update both locations. Since the website is `www.doctalk.site`, the Organization schema's `support@doctalk.site` is the more appropriate choice. Update the Footer:

Change in `Footer.tsx` line 56:
```tsx
<a href="mailto:support@doctalk.app" ...>
```
to:
```tsx
<a href="mailto:support@doctalk.site" ...>
```

**Important**: Before making this change, verify that `support@doctalk.site` is a working email address (check DNS MX records or email provider configuration). If only `support@doctalk.app` works, update the Organization schema in `layout.tsx` instead.

**Impact**: Low-Medium -- consistent NAP (Name, Address, Phone/email) signals are a trust factor. Minor but easy to fix.

**Effort**: S (1 line change)

**KPI**:
- Verify consistency by searching `support@` across the codebase -- all instances should use the same domain
- Google Rich Results Test should show Organization with matching contact email

---

## Phase 1B: Search Engine Registration & Monitoring (Week 1-2)

### 1B-1. Google Search Console Setup + Sitemap Submission

**Priority**: P0 -- Must be done before any SEO progress can be measured
**Audit ref**: Foundational

**What**: Register `www.doctalk.site` in Google Search Console (GSC), verify ownership, and submit the sitemap. The site already has a `google-site-verification` meta tag in `layout.tsx` (line 72: `168G1TYJfQ7MNp4sNdF-7gC2wDWKGeds618LyLdkCUM`), suggesting GSC may already be partially set up. Verify this is complete and the sitemap is submitted.

**Where**: Google Search Console web interface (`search.google.com/search-console`)

**How**:
1. Log into GSC with the Google account that owns DocTalk
2. If property `https://www.doctalk.site` is not added, add it as a "URL prefix" property
3. Verify ownership via the existing HTML meta tag (already in `layout.tsx`)
4. Navigate to Sitemaps > Add: `https://www.doctalk.site/sitemap.xml`
5. Confirm sitemap status shows "Success" and all 5 URLs are discovered
6. Check Coverage report for any indexing errors
7. Submit the homepage for indexing via URL Inspection > "Request Indexing"

**Post-setup actions**:
- Check the International Targeting report for hreflang errors (these should disappear after 1A-2 deploys)
- Enable email notifications for critical issues (manual actions, security, coverage drops)
- Check the Core Web Vitals report once data accumulates (~28 days)

**Impact**: Critical -- GSC is the single most important SEO tool. Without it, you cannot measure indexing status, ranking performance, or diagnose issues.

**Effort**: S (30 minutes web interface)

**KPI**:
- GSC property verified: Yes/No
- Sitemap submitted: 5/5 URLs discovered
- Index Coverage: 5 valid pages, 0 errors on public pages
- Performance data starts appearing within 2-3 days

---

### 1B-2. Bing Webmaster Tools

**Priority**: P1
**Audit ref**: Foundational

**What**: Register DocTalk in Bing Webmaster Tools. The site already has a Bing verification meta tag in `layout.tsx` (line 73: `msvalidate.01` content `50E7D296303C85BC31C1BE98539EA393`), so verification should be straightforward.

**Where**: Bing Webmaster Tools web interface (`www.bing.com/webmasters`)

**How**:
1. Log into Bing Webmaster Tools
2. Add site `https://www.doctalk.site`
3. Verify via existing meta tag (already deployed)
4. Submit sitemap: `https://www.doctalk.site/sitemap.xml`
5. Review the SEO Reports for any issues
6. Check the URL Inspection tool for the homepage

**Note**: Bing Webmaster Tools also provides data for Yahoo Search, DuckDuckGo, and Ecosia -- so this single registration covers multiple search engines.

**Impact**: Medium -- Bing has ~3% global search share, but in certain markets (enterprise/US corporate) it can be higher due to Edge browser defaults. Also feeds into ChatGPT/Copilot search results.

**Effort**: S (20 minutes)

**KPI**:
- Property verified: Yes/No
- Sitemap submitted: 5/5 URLs discovered
- SEO Errors: 0 critical issues

---

### 1B-3. Baidu Webmaster Tools (ziyuan.baidu.com)

**Priority**: P1 -- Critical for Chinese market
**Audit ref**: International audit Section 3

**What**: Register DocTalk with Baidu's webmaster platform (Baidu Ziyuan). This is essential for visibility in the Chinese search market. Even without locale URLs (Phase 3), submitting the site helps Baidu discover and crawl the English version, and provides data on how Baidu sees the site.

**Where**: Baidu Ziyuan web interface (`ziyuan.baidu.com`)

**How**:
1. Create a Baidu account (requires phone number; international numbers work)
2. Add site `https://www.doctalk.site`
3. Verify ownership via one of:
   - HTML file upload (recommended: download verification file, place in `frontend/public/`)
   - Meta tag (add a `<meta name="baidu-site-verification" content="..." />` to `layout.tsx`)
   - DNS TXT record (requires domain registrar access)
4. Submit sitemap URL in Baidu's Sitemap Submission tool
5. Use Baidu's "Fetch as Baiduspider" to test how the site renders (critical -- Baidu's JS rendering is poor)

**Baidu-specific notes from the international audit**:
- Baidu's crawler has significantly worse JavaScript rendering than Google
- The landing page's client-rendered content (`HomePageClient.tsx`) may not render for Baiduspider
- This registration is primarily diagnostic in Phase 1; full Baidu optimization requires locale URLs (`/zh/`) in Phase 3
- ICP filing is NOT required for a `.site` TLD (only for `.cn` domains hosted in mainland China)

**Impact**: Medium (diagnostic now, high when `/zh/` is implemented in Phase 3). Having a Baidu account is prerequisite for any future Chinese SEO work.

**Effort**: S-M (30-60 minutes, account creation may require phone verification)

**KPI**:
- Property verified in Baidu Ziyuan: Yes/No
- Baidu Index check: search `site:www.doctalk.site` on `baidu.com` -- count indexed pages
- Baiduspider Fetch test: does it render the landing page content? (Likely partially, confirming need for SSR content in Phase 3)

---

### 1B-4. Naver Search Advisor

**Priority**: P1 -- Critical for Korean market
**Audit ref**: International audit Section 4

**What**: Register DocTalk with Naver Search Advisor (`searchadvisor.naver.com`). Naver dominates Korean search (~60% market share). Without explicit registration, Naver may never discover or index DocTalk.

**Where**: Naver Search Advisor web interface (`searchadvisor.naver.com`)

**How**:
1. Create a Naver account (requires email; Korean phone number helpful but not required for basic registration)
2. Add site `https://www.doctalk.site`
3. Verify ownership via:
   - HTML file upload (place in `frontend/public/`)
   - Meta tag (add `<meta name="naver-site-verification" content="..." />` to `layout.tsx`)
4. Submit sitemap URL
5. Use Naver's Site Diagnosis tool to check for issues

**Naver-specific considerations**:
- Naver uses its own crawler (Yeti/NaverBot), separate from Google
- Naver Blog and Naver Cafe results dominate Korean SERPs -- organic web results appear lower
- For Phase 3: Korean content at `/ko/` will be essential for Naver ranking
- Naver's JS rendering is limited but improving

**Impact**: Medium (diagnostic now, critical when `/ko/` content exists)

**Effort**: S (20-30 minutes)

**KPI**:
- Property verified in Naver Search Advisor: Yes/No
- Naver index check: search `site:www.doctalk.site` on `naver.com`

---

### 1B-5. Google Analytics 4 Setup

**Priority**: P1 -- Required for measuring SEO traffic and behavior
**Audit ref**: Foundational

**What**: Set up Google Analytics 4 (GA4) to track user behavior on DocTalk. The site already has Vercel Analytics (`AnalyticsWrapper` component, conditionally loaded after cookie consent), but GA4 provides deeper SEO-specific metrics: organic search traffic segmentation, landing page performance, engagement rates, and integration with Google Search Console.

**Where**:
- Google Analytics web interface (`analytics.google.com`)
- `frontend/src/components/AnalyticsWrapper.tsx` or `frontend/src/app/layout.tsx` -- for adding the GA4 script
- `frontend/next.config.mjs` -- may need CSP update for GA domains

**How**:
1. Create a GA4 property for `www.doctalk.site` in the Google Analytics interface
2. Get the Measurement ID (format: `G-XXXXXXXXXX`)
3. Add GA4 via Next.js `@next/third-parties` package (preferred) or manual script tag
4. **Respect cookie consent**: only load GA4 after the user accepts analytics cookies (integrate with existing `CookieConsentBanner` logic, same pattern as `AnalyticsWrapper`)
5. Update CSP in `next.config.mjs` to allow GA4 domains:
   - `script-src`: add `https://www.googletagmanager.com`
   - `connect-src`: add `https://www.google-analytics.com https://analytics.google.com`
   - `img-src`: add `https://www.google-analytics.com`
6. Link GA4 property to Google Search Console for combined reporting
7. Set up key events:
   - `sign_up` -- when user creates account
   - `demo_start` -- when user opens a demo document
   - `file_upload` -- when user uploads a document
   - `subscription_purchase` -- when user subscribes

**Alternative**: If adding a third analytics tool feels excessive (Vercel Analytics already exists), consider whether Vercel Analytics provides sufficient organic search segmentation. The primary reason to add GA4 is the Search Console integration, which Vercel Analytics cannot provide.

**Impact**: Medium-High -- cannot optimize what you cannot measure. GA4 + GSC integration provides the complete picture of search performance to behavior conversion.

**Effort**: M (1-2 hours for setup, event configuration, and CSP updates)

**KPI**:
- GA4 property created and receiving data: Yes/No
- GA4 linked to Search Console: Yes/No
- Real-time report shows live visitors: Yes/No
- GDPR compliant: only loads after cookie consent

---

## Phase 1C: Structured Data Enhancements (Week 2)

### 1C-1. SearchAction on WebSite Schema

**Priority**: P2
**Audit ref**: Technical audit 3.4

**What**: Add a `potentialAction` with `SearchAction` type to the existing `WebSite` JSON-LD schema. This enables Google's "sitelinks search box" -- a search input that appears directly in Google results when users search for "DocTalk". The search box would let users search directly within DocTalk from Google.

**Where**: `frontend/src/app/layout.tsx`, lines 82-88 (the WebSite schema object within the `@graph` array)

**How**: Add `potentialAction` to the WebSite schema:

```ts
{
  '@type': 'WebSite',
  name: 'DocTalk',
  alternateName: 'DocTalk AI',
  url: 'https://www.doctalk.site',
  description: 'AI document chat with cited answers',
  potentialAction: {
    '@type': 'SearchAction',
    target: {
      '@type': 'EntryPoint',
      urlTemplate: 'https://www.doctalk.site/?q={search_term_string}',
    },
    'query-input': 'required name=search_term_string',
  },
},
```

**Note**: DocTalk does not currently have a site-wide search feature. The `?q=` parameter would need to be handled by the homepage (e.g., auto-populate a document search or redirect to a search results page). If implementing a search handler is too much work, this can be deferred until a search feature exists. The SearchAction schema without a working endpoint will not pass Google's validation.

**Alternative (lower effort)**: Skip SearchAction until DocTalk has an actual search feature. The SEO benefit is minor for a site with only 5 public pages.

**Impact**: Low -- sitelinks search box is a nice-to-have. Google only shows it for well-established sites with significant search volume. May not appear for DocTalk in the near term.

**Effort**: S (if search endpoint exists), M (if search endpoint must be built)

**KPI**:
- Validate with Rich Results Test -- SearchAction should appear
- Monitor Google SERP for "DocTalk" brand query -- sitelinks search box appearance

---

### 1C-2. Organization Logo PNG Format

**Priority**: P2
**Audit ref**: Technical audit 3.5, 10.2

**What**: Google's rich results and Knowledge Panel prefer raster image formats (PNG/JPEG) for organization logos, with a minimum size of 112x112px. The current Organization schema references `/logo-icon.svg`, which is valid but suboptimal for Google's image processing pipeline. Creating a PNG version ensures maximum compatibility with Google's rich result rendering.

**Where**:
- Create: `frontend/public/logo-icon.png` (512x512px PNG)
- Update: `frontend/src/app/layout.tsx`, line 95 -- change logo URL in Organization schema

**How**:
1. Export the existing `logo-icon.svg` to PNG at 512x512px resolution (use Figma, Inkscape, or `npx svgexport logo-icon.svg logo-icon.png 512:512`)
2. Place the PNG at `frontend/public/logo-icon.png`
3. Update the Organization schema:
```ts
logo: {
  '@type': 'ImageObject',
  url: 'https://www.doctalk.site/logo-icon.png',
  width: 512,
  height: 512,
},
```
4. Keep the SVG favicon (`icon.svg`) unchanged -- SVG is correct for favicons

**Impact**: Low -- incremental improvement for Knowledge Panel logo rendering. Google may use the SVG fine, but PNG removes any ambiguity.

**Effort**: S (10 minutes)

**KPI**:
- Rich Results Test shows Organization logo without warnings
- Google Knowledge Panel (when it appears) uses the correct logo

---

### 1C-3. Remove Single-Item Homepage Breadcrumb

**Priority**: P2
**Audit ref**: Technical audit 3.3

**What**: The homepage has a BreadcrumbList JSON-LD with a single item (just "Home"). Google officially ignores single-item breadcrumbs because they provide no navigational value. This is unnecessary markup that adds bytes to the HTML with zero SEO benefit.

**Where**: `frontend/src/app/page.tsx`, lines 27-33 (the BreadcrumbList JSON-LD block)

**How**: Remove the entire BreadcrumbList `<script>` block from page.tsx:

```tsx
// DELETE this entire block:
<script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://www.doctalk.site' },
  ],
})}} />
```

The other pages (`/demo`, `/billing`, `/privacy`, `/terms`) correctly have 2-item breadcrumbs (Home > Page) and should be kept.

**Impact**: Low -- cleanup only. Removing noise from the HTML.

**Effort**: S (delete 6 lines)

**KPI**:
- Validate homepage JSON-LD with Rich Results Test -- should show FAQPage, SoftwareApplication, HowTo (after 1A-3), but NOT BreadcrumbList
- Breadcrumb rich results on other pages should be unaffected

---

### 1C-4. OG Image Improvements

**Priority**: P1 (moved up from P2 due to social sharing impact)
**Audit ref**: Technical audit 8.2, 10.1

**What**: The current OG image (`opengraph-image.tsx`) generates a plain text-on-dark-gradient image with just "DocTalk" + "AI Document Chat with Cited Answers" + file type labels. This underperforms in social media CTR compared to OG images that include a product screenshot or UI mockup. When someone shares DocTalk on Twitter/LinkedIn/Slack, the preview is indistinguishable from any generic tech product.

**Where**: `frontend/src/app/opengraph-image.tsx` (complete rewrite)

**How**: Two approaches, in order of preference:

**Option A: Static OG image (recommended for Phase 1)**
1. Take a screenshot of the DocTalk document reader UI (chat + document side by side, with citation highlights visible)
2. Create a 1200x630 PNG in Figma/design tool: product screenshot as background (slightly blurred or overlaid), DocTalk logo in top-left, tagline text overlay
3. Place as `frontend/public/og-image.png`
4. Update `layout.tsx` metadata:
```ts
openGraph: {
  // ...
  images: [{
    url: 'https://www.doctalk.site/og-image.png',
    width: 1200,
    height: 630,
    alt: 'DocTalk — AI Document Chat with Cited Answers',
  }],
},
```
5. Keep `opengraph-image.tsx` as a fallback or delete it (static images take priority if both exist in the same directory)

**Option B: Enhanced dynamic OG image**
Modify `opengraph-image.tsx` to include a simplified UI mockup rendered via the `next/og` ImageResponse API. This is more complex but keeps the image generation dynamic.

**Additionally**: Add per-page OG title/description to `/demo`, `/billing`, `/privacy`, `/terms` (audit ref 8.1 -- currently these pages inherit the layout's generic OG tags):

For each page, add to its `metadata` export:
```ts
// Example for demo/page.tsx:
export const metadata: Metadata = {
  // ... existing title, description, canonical ...
  openGraph: {
    title: 'Try DocTalk Free — Interactive Demo',
    description: 'Try DocTalk without signing up. Chat with sample documents and see AI-powered answers with real-time source citations.',
    url: 'https://www.doctalk.site/demo',
  },
};
```

Repeat for `/billing`, `/privacy`, `/terms` with their respective titles and descriptions.

**Impact**: High for social sharing -- OG images are the #1 factor in social media CTR. Every social share becomes a mini-advertisement. Per-page OG tags ensure correct title/description when specific pages are shared.

**Effort**: M (1-2 hours for design + implementation of static OG image; 30 minutes for per-page OG metadata)

**KPI**:
- Validate via Facebook Sharing Debugger (`developers.facebook.com/tools/debug/`), Twitter Card Validator, LinkedIn Post Inspector
- Each page should show its own unique OG title and description, not the homepage's
- OG image should include a product visual, not just text

---

## Cross-Phase Dependencies

| Phase 1 Task | Blocks | Notes |
|---|---|---|
| 1A-2 (hreflang removal) | Phase 3 (locale URLs) | Hreflang will be re-added with correct locale URLs when subdirectory routing is implemented |
| 1B-1 (GSC setup) | All future SEO measurement | Cannot track any SEO progress without GSC |
| 1B-5 (GA4 setup) | Phase 2 (content marketing ROI) | Need behavior data to measure content effectiveness |
| 1A-3 (HowTo schema) | None | Standalone improvement |
| 1A-4 (internal linking) | Phase 2 (new pages need links) | Header nav pattern should be extended as pages are added |

---

## Implementation Checklist

### Week 1 (Phase 1A + 1B starts)

- [ ] **Day 1**: Deploy 1A-1 (Inter font swap) + 1A-2 (hreflang removal) + 1A-6 (email fix) -- all are single-line changes, can be batched in one commit
- [ ] **Day 1**: Run PageSpeed Insights before/after 1A-1 to capture LCP improvement
- [ ] **Day 2**: Deploy 1A-5 (ScrollReveal hero fix) + 1A-4a (header nav links)
- [ ] **Day 2**: Complete 1B-1 (Google Search Console) + 1B-2 (Bing Webmaster Tools) -- web interface only, no code changes
- [ ] **Day 3**: Deploy 1A-3 (HowTo schema) + 1A-4b (pricing CTA in body)
- [ ] **Day 3**: Validate all structured data with Rich Results Test
- [ ] **Day 4-5**: Complete 1B-3 (Baidu) + 1B-4 (Naver) registrations

### Week 2 (Phase 1B completes + Phase 1C)

- [ ] **Day 6-7**: Set up GA4 (1B-5) including CSP updates, cookie consent integration, and event tracking
- [ ] **Day 7**: Link GA4 to Google Search Console
- [ ] **Day 8**: Deploy 1C-2 (logo PNG) + 1C-3 (remove homepage breadcrumb)
- [ ] **Day 9-10**: Create and deploy improved OG image (1C-4)
- [ ] **Day 10**: Add per-page OG metadata to all public pages (1C-4)
- [ ] **Day 10**: Deploy 1C-1 (SearchAction) if search endpoint can be built; otherwise defer

---

## Success Metrics (End of Phase 1)

| Metric | Baseline (2026-02-18) | Target (End of Week 2) |
|---|---|---|
| Google Search Console pages indexed | Unknown (setup needed) | 5/5 public pages indexed |
| LCP (mobile, PageSpeed Insights) | Measure before font fix | Improved by 200ms+ |
| Hreflang errors in GSC | Multiple (all same-URL) | 0 |
| Rich Results eligible | FAQPage, SoftwareApplication, Breadcrumb | + HowTo, cleaned breadcrumb |
| OG image has product visual | No (text only) | Yes |
| Per-page OG title/desc correct | Only homepage | All 5 public pages |
| Search engine registrations | 2 (GSC + Bing partial) | 4 (GSC, Bing, Baidu, Naver) |
| GA4 collecting data | No | Yes (with cookie consent) |
| Internal links from homepage header | 0 | 2 (Demo, Pricing) |
| Email consistency | Mismatched (app vs site) | Consistent |

---

## Files Modified Summary

| File | Changes |
|---|---|
| `frontend/src/app/layout.tsx` | Inter font `display: 'swap'`; remove hreflang `languages` block; SearchAction on WebSite schema; Organization logo PNG URL; Baidu/Naver verification meta tags (if using meta tag verification) |
| `frontend/src/app/page.tsx` | Add HowTo JSON-LD; remove single-item BreadcrumbList |
| `frontend/src/app/demo/page.tsx` | Add per-page OG title/description |
| `frontend/src/app/billing/page.tsx` | Add per-page OG title/description |
| `frontend/src/app/privacy/page.tsx` | Add per-page OG title/description |
| `frontend/src/app/terms/page.tsx` | Add per-page OG title/description |
| `frontend/src/components/Header.tsx` | Add Demo/Pricing nav links in minimal variant |
| `frontend/src/app/HomePageClient.tsx` | Add pricing CTA in landing page body |
| `frontend/src/components/landing/HeroSection.tsx` | Remove ScrollReveal wrapper |
| `frontend/src/components/Footer.tsx` | Fix email domain (app -> site) |
| `frontend/src/app/opengraph-image.tsx` | Redesign OG image (or replace with static PNG) |
| `frontend/next.config.mjs` | CSP updates for GA4 domains (if GA4 added) |
| `frontend/public/logo-icon.png` | New file: 512x512 PNG logo |
| `frontend/public/og-image.png` | New file: 1200x630 OG image with product screenshot (if using static approach) |
