# Deep Technical SEO Audit — DocTalk (www.doctalk.site)

**Date**: 2026-02-18
**Auditor**: Technical SEO Specialist
**Stack**: Next.js 14 (App Router) on Vercel, FastAPI backend on Railway

---

## Executive Summary

DocTalk's recent SEO overhaul (2026-02-18) delivered strong foundational improvements: server-wrapped pages for SSR metadata, hreflang alternates, structured data, and security headers. The site scores well on crawlability and structured data, but has critical gaps in **OG image quality**, **missing `display: 'swap'` on the primary font (Inter)**, **auth pages missing noindex**, and **hreflang pointing all locales to the same URL** (which is semantically incorrect). Of 15 dimensions audited, 2 are rated critical, 8 need improvement, and 5 are good.

**Quick wins with highest ROI**: Fix Inter font-display swap, add noindex to auth pages, improve OG image with screenshot/branding, add per-page OG titles.

---

## 1. Crawlability & Indexability

**Rating**: GOOD

### Current State

**robots.txt** (verified live at `www.doctalk.site/robots.txt`):
```
User-agent: *
Allow: /
Disallow: /api/
Disallow: /auth/
Disallow: /profile
Disallow: /collections
Disallow: /admin
Disallow: /d/
Sitemap: https://www.doctalk.site/sitemap.xml
```
- Source: `frontend/src/app/robots.ts:3-14`

**sitemap.xml** (verified live):
- 5 URLs: `/`, `/demo`, `/billing`, `/privacy`, `/terms`
- All with `lastModified: 2026-02-18`, correct `changeFrequency` values
- Source: `frontend/src/app/sitemap.ts:1-40`

**Middleware** (`frontend/src/middleware.ts:18-33`):
- Only sets a `NEXT_LOCALE` cookie on first visit via `Accept-Language` header detection
- Does NOT redirect or rewrite URLs — crawlers see the same URL regardless of locale
- Matcher excludes `/api/` and `/_next/` — no interference with static assets or API routes

### What's Good
- Clean robots.txt blocks all private routes (`/api/`, `/auth/`, `/profile`, `/collections`, `/admin`, `/d/`)
- Sitemap includes all 5 public pages with correct priorities
- Middleware is crawl-safe — only sets a cookie, no redirects
- Server-side metadata export on all public pages means crawlers get full `<head>` tags on first render

### What's Missing / Suboptimal
- **No `loading.tsx` files anywhere** — if JS fails to hydrate, there's no server-rendered placeholder content. The landing page content itself is rendered via `<HomePageClient />` (a `"use client"` component), meaning the actual body content (headlines, features, etc.) is **client-rendered**. The JSON-LD and meta tags are server-rendered via the `page.tsx` wrapper, but the visible DOM content requires JavaScript
- **Sitemap is static** — hardcoded 5 URLs. If blog posts or other public pages are added, sitemap won't auto-update
- `/collections/[collectionId]` page (`frontend/src/app/collections/[collectionId]/page.tsx`) is a `"use client"` component without a server wrapper — but it is correctly blocked by robots.txt

### Recommendations

| # | Recommendation | Priority | Effort | SEO Impact |
|---|---|---|---|---|
| 1.1 | Add `<noscript>` fallback to HomePageClient with key text content for crawlers that don't execute JS (rare but affects Bing in some configs) | P2 | S | Low |
| 1.2 | When adding blog/content pages, make sitemap dynamic (query database or filesystem) | P2 | M | Medium |

---

## 2. Core Web Vitals

**Rating**: NEEDS IMPROVEMENT

### Current State

**LCP (Largest Contentful Paint)**:
- The landing page's LCP element is the `<h1>` in HeroSection (`frontend/src/components/landing/HeroSection.tsx:33`): ~60-70px font, server-rendered text
- **Inter font** loaded at `frontend/src/app/layout.tsx:14`: `Inter({ subsets: ['latin'], variable: '--font-inter' })` — **missing `display: 'swap'`**. This causes FOIT (Flash of Invisible Text) until the font loads, directly hurting LCP
- **Sora font** has `display: 'swap'` at `layout.tsx:19` — good
- **ShowcasePlayer** (`frontend/src/components/landing/ShowcasePlayer.tsx:1-65`): lazy-loaded via `React.lazy()` with skeleton fallback — good, not blocking LCP
- No hero images to worry about — text-only hero is excellent for LCP

**INP (Interaction to Next Paint)**:
- ScrollReveal (`frontend/src/components/landing/ScrollReveal.tsx`) uses IntersectionObserver — lightweight, no heavy computation on interaction
- AnimatedCounter in SocialProof uses `requestAnimationFrame` — respects `prefers-reduced-motion` — good
- FAQ accordion (`FAQ.tsx:21`) is simple state toggle — fast
- No heavy click handlers on the landing page

**CLS (Cumulative Layout Shift)**:
- ShowcasePlayer has `aspect-video` on both skeleton and content — no layout shift during lazy load
- Fonts: Inter without `display: 'swap'` can cause layout shift when font loads (text reflow from fallback to Inter)
- No images on landing page (aside from the dynamic ShowcasePlayer video area) — minimal image CLS risk
- CookieConsentBanner uses `position: fixed` — no layout shift

### What's Good
- Text-only hero section — fastest possible LCP
- Lazy-loaded ShowcasePlayer with matching aspect-ratio skeleton
- IntersectionObserver for scroll animations instead of scroll listeners
- `prefers-reduced-motion` respected throughout
- No unoptimized images on landing page

### What's Missing / Suboptimal
- **Inter font missing `display: 'swap'`** — this is the primary body font used everywhere. Until Google Fonts delivers the font file, ALL body text is invisible. This directly hurts LCP and can cause CLS when the font arrives
- **Sentry SDK loaded** (via `withSentryConfig` in `next.config.mjs:53`), though source map upload is disabled. The Sentry client bundle still adds to the initial JS payload
- **ScrollReveal** wraps nearly every landing section — this means content starts at `opacity-0` and requires JS to become visible. For SEO crawlers that partially render JS, sections may appear empty

### Recommendations

| # | Recommendation | Priority | Effort | SEO Impact |
|---|---|---|---|---|
| 2.1 | Add `display: 'swap'` to Inter font declaration in `layout.tsx:14` | **P0** | S | **High** |
| 2.2 | Consider removing ScrollReveal from the first viewport (HeroSection already has it at `delay={0}`) — initial content should be immediately visible | P1 | S | Medium |
| 2.3 | Audit Sentry bundle impact — if not actively using it, remove `withSentryConfig` wrapper to reduce JS payload | P2 | S | Low |

---

## 3. Structured Data Completeness

**Rating**: GOOD

### Current State

**Layout-level JSON-LD** (`frontend/src/app/layout.tsx:77-112`):
- `@graph` containing `WebSite` + `Organization` schemas
- Organization has: name, url, logo (ImageObject), description, foundingDate, sameAs (GitHub), contactPoint

**Homepage** (`frontend/src/app/page.tsx:27-106`):
- `BreadcrumbList` — single-item breadcrumb (Home only)
- `FAQPage` — 6 questions matching the FAQ section content
- `SoftwareApplication` — with 3 `Offer` items (Free/Plus/Pro), `featureList`, `operatingSystem: Web`

**Billing page** (`frontend/src/app/billing/page.tsx:12-80`):
- `SoftwareApplication` with `AggregateOffer` containing 3 individual Offers with `UnitPriceSpecification` and `billingDuration: P1M`
- `BreadcrumbList` (Home > Pricing)

**Demo page** (`frontend/src/app/demo/page.tsx:13-25`):
- `BreadcrumbList` (Home > Demo)

**Privacy & Terms** (`privacy/page.tsx:15-26`, `terms/page.tsx:15-26`):
- `BreadcrumbList` only

### What's Good
- Rich structured data across all public pages
- FAQPage schema matches visible FAQ content — no discrepancy
- SoftwareApplication with proper Offer pricing — enables rich results in Google Search
- BreadcrumbList on every page
- Organization schema with logo, contact, and sameAs
- WebSite schema with alternateName

### What's Missing / Suboptimal
- **No `aggregateRating` on SoftwareApplication** — prevents star rating rich results
- **No `HowTo` schema** to match the "How it works" section (3-step process is perfect HowTo material)
- **No `VideoObject`** — the ShowcasePlayer section is a product demo video/animation but has no schema for it
- **BreadcrumbList on homepage is single-item** (just "Home") — this is technically valid but provides no value; Google ignores single-item breadcrumbs
- **Organization logo** points to `/logo-icon.svg` — Google recommends logos be at least 112x112px in a supported format (PNG/JPEG preferred over SVG for rich results)
- **No `potentialAction` on WebSite** — missing SearchAction which could enable sitelinks search box

### Recommendations

| # | Recommendation | Priority | Effort | SEO Impact |
|---|---|---|---|---|
| 3.1 | Add `HowTo` schema matching the 3-step "How it works" section | P1 | S | Medium |
| 3.2 | Add `aggregateRating` to SoftwareApplication once real reviews exist | P2 | S | High (when available) |
| 3.3 | Remove single-item BreadcrumbList from homepage (it adds no value) | P2 | S | Low |
| 3.4 | Add `SearchAction` to WebSite schema for sitelinks search box | P2 | S | Low |
| 3.5 | Convert Organization logo to PNG format (112x112+) for rich result eligibility | P2 | S | Low |

---

## 4. Page Speed Architecture

**Rating**: NEEDS IMPROVEMENT

### Current State

**next.config.mjs** (`frontend/next.config.mjs:1-59`):
- `reactStrictMode: true` — good
- `images.remotePatterns` configured for Google/Microsoft avatars — good
- Sentry wrapped with `disableServerWebpackPlugin: true` and `disableClientWebpackPlugin: true` — source maps not uploaded, but Sentry runtime SDK still bundled
- No `experimental.optimizeCss` or other advanced optimizations

**Font Loading**:
- Inter: `Inter({ subsets: ['latin'], variable: '--font-inter' })` — **No `display: 'swap'`**, only latin subset
- Sora: `Sora({ subsets: ['latin'], variable: '--font-logo', weight: ['500', '600', '700'], display: 'swap' })` — good, display swap + limited weights

**Third-party Scripts**:
- Sentry: 3 config files (`sentry.client.config.ts`, `sentry.edge.config.ts`, `sentry.server.config.ts`) — adds SDK bundle
- Vercel Analytics: Conditionally loaded via `AnalyticsWrapper` (requires cookie consent) — smart
- `google-site-verification` and `msvalidate.01` meta tags — zero performance impact

**Code Splitting**:
- ShowcasePlayer: `React.lazy()` with Suspense — good
- All landing page components are imported directly in `HomePageClient.tsx` — could be split further but they're all needed for the page

**Image Optimization**:
- No `<img>` or `next/image` on landing page — purely text-based hero
- OG image generated via `next/og` edge runtime (`opengraph-image.tsx`) — good, dynamic generation

### What's Good
- No render-blocking images on landing page
- Sora font properly optimized with `display: 'swap'` and limited weight selection
- ShowcasePlayer is lazy-loaded with skeleton fallback
- Vercel Analytics conditionally loaded (post-consent)
- CSP headers prevent unexpected third-party scripts

### What's Missing / Suboptimal
- **Inter font missing `display: 'swap'`** (repeated from CWV section — this is the #1 issue)
- **Inter only loads `latin` subset** — for an 11-locale app supporting Chinese, Japanese, Korean, Arabic, Hindi, this means CJK/Arabic/Devanagari text falls back to system font. While this is intentional for performance, there's no `font-display: swap` to ensure the Latin text renders during font load
- **Sentry SDK bundled but source maps disabled** — paying the bundle cost without full benefit
- **No `experimental.optimizeCss`** in next.config — Tailwind CSS purging handles most of this, but extracting critical CSS could improve FCP

### Recommendations

| # | Recommendation | Priority | Effort | SEO Impact |
|---|---|---|---|---|
| 4.1 | Add `display: 'swap'` to Inter font (same as 2.1) | **P0** | S | **High** |
| 4.2 | Evaluate Sentry necessity — if not actively monitoring, remove `withSentryConfig` to save ~50-80KB | P2 | S | Medium |
| 4.3 | Add `experimental: { optimizeCss: true }` to next.config if on Next.js 14.1+ | P2 | S | Low |

---

## 5. Internal Linking

**Rating**: NEEDS IMPROVEMENT

### Current State

**Header** (`frontend/src/components/Header.tsx:32-77`):
- Logo links to `/` — good
- Minimal variant (landing page): only logo + UserMenu + LanguageSelector
- Full variant: adds Collections link, back-to-document link, ModeSelector, ThemeSelector, CreditsDisplay

**Footer** (`frontend/src/components/Footer.tsx:1-96`):
- Product: `/demo`, `/billing`
- Company: DocTalk (no link), `mailto:support@doctalk.app`
- Legal: `/privacy`, `/terms`, `/privacy#ccpa`

**Landing Page CTAs**:
- HeroSection: `/demo`, `?auth=1` (sign up modal), `#how-it-works`
- FinalCTA: `/demo`, `?auth=1`
- Dashboard (logged in): `/demo` link, `/d/{docId}` document links

**Navigation Links (all pages)**:
- Header: `/` (logo)
- Footer: `/demo`, `/billing`, `/privacy`, `/terms`, `/privacy#ccpa`

### What's Good
- All 5 public pages are linked from the footer
- CTAs drive traffic to `/demo` (highest-priority conversion page)
- Logo links back to homepage from every page
- Footer has consistent structure across all pages

### What's Missing / Suboptimal
- **No `/billing` link in the header navigation** (landing page variant) — pricing page only accessible via footer
- **No cross-linking between demo and billing** — users on `/demo` have no CTA to see pricing
- **Header minimal variant has NO navigation links** except logo — landing page visitors must scroll to footer for /demo, /billing, /privacy, /terms
- **No anchor text diversity** — the word "Demo" is used for all links to `/demo`. Consider varying: "Try Free Demo", "Interactive Demo", "See How It Works"
- **`mailto:support@doctalk.app`** in Footer but Organization schema uses `support@doctalk.site` — inconsistency
- **No /billing link from landing page inline** — pricing info is only in the FAQ and footer

### Recommendations

| # | Recommendation | Priority | Effort | SEO Impact |
|---|---|---|---|---|
| 5.1 | Add "Pricing" and "Demo" links to the header minimal variant (landing page) | P1 | S | Medium |
| 5.2 | Add a CTA link to `/billing` within or after the landing page features/social proof section | P1 | S | Medium |
| 5.3 | Fix email inconsistency: Footer uses `support@doctalk.app`, Organization schema uses `support@doctalk.site` | P1 | S | Low (trust signal) |
| 5.4 | Add varied anchor text for `/demo` links | P2 | S | Low |

---

## 6. URL Structure

**Rating**: GOOD

### Current State

All routes under `frontend/src/app/`:
```
/                           — Homepage (public)
/demo                       — Demo landing (public)
/demo/[sample]              — Demo document reader (noindex)
/billing                    — Pricing page (public)
/privacy                    — Privacy policy (public)
/terms                      — Terms of service (public)
/auth                       — Login page (blocked by robots.txt)
/auth/error                 — Auth error (blocked by robots.txt)
/auth/verify-request        — Email verification (blocked by robots.txt)
/profile                    — User profile (blocked by robots.txt, noindex)
/collections                — Collections list (blocked by robots.txt, noindex)
/collections/[collectionId] — Collection detail (blocked by robots.txt)
/admin                      — Admin panel (blocked by robots.txt, noindex)
/d/[documentId]             — Document reader (blocked by robots.txt, noindex)
```

### What's Good
- Clean, semantic URLs — no query parameters for page identity
- Flat hierarchy — max 2 levels deep (`/demo/[sample]`, `/auth/error`, `/collections/[id]`, `/d/[id]`)
- Dynamic segments use `[param]` convention — clean when rendered
- Private routes properly blocked by robots.txt AND have `noindex` meta tags (belt and suspenders)

### What's Missing / Suboptimal
- **`/billing` URL is suboptimal for SEO** — `/pricing` would be more keyword-aligned and user-friendly. The `<title>` already says "Pricing", creating a URL-title mismatch
- **No blog/content URL structure** — when content marketing starts, should plan `/blog/[slug]` early

### Recommendations

| # | Recommendation | Priority | Effort | SEO Impact |
|---|---|---|---|---|
| 6.1 | Consider renaming `/billing` to `/pricing` (add redirect from old URL) | P2 | M | Medium |
| 6.2 | Plan `/blog/[slug]` URL structure before content marketing begins | P2 | S | Low (planning) |

---

## 7. Canonical Tags

**Rating**: NEEDS IMPROVEMENT

### Current State

**Layout-level** (`layout.tsx:30`): `canonical: '/'`
**Per-page overrides**:
- Homepage: `canonical: '/'` (page.tsx:7)
- Demo: `canonical: '/demo'` (demo/page.tsx:7)
- Billing: `canonical: '/billing'` (billing/page.tsx:7)
- Privacy: `canonical: '/privacy'` (privacy/page.tsx:7)
- Terms: `canonical: '/terms'` (terms/page.tsx:7)

**Verified live**: Homepage canonical resolves to `https://www.doctalk.site` (correct, `metadataBase` in layout.tsx:23 sets the base)

**Hreflang tags** (`layout.tsx:29-44`):
```javascript
languages: {
  'x-default': 'https://www.doctalk.site',
  'en': 'https://www.doctalk.site',
  'zh': 'https://www.doctalk.site',
  // ... all 11 locales point to SAME URL
}
```

### What's Good
- Every public page has an explicit canonical tag
- `metadataBase` properly set to `https://www.doctalk.site`
- Relative canonical paths resolve correctly against metadataBase
- www vs non-www: Vercel automatically redirects `doctalk.site` to `www.doctalk.site`

### What's Missing / Suboptimal
- **All hreflang tags point to the same URL** — this is semantically incorrect. Hreflang should point to locale-specific URLs (e.g., `https://www.doctalk.site/zh/`). If all locales serve the same URL, hreflang tags should be removed entirely to avoid confusing Google. Google ignores hreflang when all alternates are identical, but it's still noise in the HTML
- **No trailing slash enforcement** — Next.js defaults to no trailing slash, which is fine, but there's no explicit `trailingSlash: false` in next.config.mjs to make this intentional
- **Canonical on layout AND page** — the layout sets `canonical: '/'` which is inherited by all pages. Each page overrides it, so this works, but if a new page forgets to override, it'll incorrectly canonicalize to `/`

### Recommendations

| # | Recommendation | Priority | Effort | SEO Impact |
|---|---|---|---|---|
| 7.1 | **Remove hreflang tags** until locale-specific URLs exist (e.g., `/zh/`, `/es/`), OR implement proper i18n URL routing | **P0** | S | **High** |
| 7.2 | Add `trailingSlash: false` explicitly to next.config.mjs | P2 | S | Low |
| 7.3 | Remove `canonical: '/'` from layout.tsx metadata to prevent accidental inheritance | P2 | S | Low |

---

## 8. Meta Tags Completeness

**Rating**: NEEDS IMPROVEMENT

### Current State

| Page | Title | Len | Description | Len | OG Title | OG Desc | Twitter |
|------|-------|-----|-------------|-----|----------|---------|---------|
| `/` | DocTalk -- AI Document Chat with Cited Answers | 49 | Upload any document and chat with AI... | 142 | DocTalk -- AI Document Chat | Chat with your documents... | summary_large_image |
| `/demo` | Try DocTalk Free -- Interactive Demo | 37 | Try DocTalk without signing up... | 118 | *inherited from layout* | *inherited* | *inherited* |
| `/billing` | Pricing \| DocTalk | 18 | Choose your DocTalk plan... | 115 | *inherited* | *inherited* | *inherited* |
| `/privacy` | Privacy Policy \| DocTalk | 25 | Learn how DocTalk handles your data... | 106 | *inherited* | *inherited* | *inherited* |
| `/terms` | Terms of Service \| DocTalk | 27 | DocTalk terms of service... | 104 | *inherited* | *inherited* | *inherited* |

**Verified live on /demo page**: OG title shows "DocTalk -- AI Document Chat" (inherited from layout), not the page-specific "Try DocTalk Free -- Interactive Demo"

### What's Good
- Homepage title excellent: 49 chars, includes brand + primary keyword ("AI Document Chat") + unique value prop ("Cited Answers")
- All pages have unique, descriptive titles using the `%s | DocTalk` template
- Homepage has explicit, unique OG tags
- Twitter card set to `summary_large_image` — max visual impact
- OG image generated dynamically via `opengraph-image.tsx`

### What's Missing / Suboptimal
- **Pages other than homepage inherit OG tags from layout** — `/demo`, `/billing`, `/privacy`, `/terms` all show `og:title: "DocTalk -- AI Document Chat"` instead of their page-specific titles. This means social shares from these pages show the wrong title
- **No per-page OG descriptions** — all inherit layout's generic description
- **OG image is text-only** (`opengraph-image.tsx:8-69`) — just "DocTalk" + "AI Document Chat with Cited Answers" on a dark gradient. No screenshot, no product imagery. This underperforms in social sharing CTR
- **No `og:image` alt text** — the `alt` export exists (`opengraph-image.tsx:4`) but Google uses it for accessibility
- **Demo page title** uses `absolute` mode to bypass template — this is correct but means it won't get the `| DocTalk` suffix
- **Homepage description at 142 chars** — good length (recommended 150-160)

### Recommendations

| # | Recommendation | Priority | Effort | SEO Impact |
|---|---|---|---|---|
| 8.1 | Add explicit `openGraph.title` and `openGraph.description` to `/demo`, `/billing`, `/privacy`, `/terms` page.tsx files | **P0** | S | **High** |
| 8.2 | Improve OG image to include a product screenshot or mockup alongside the brand name | P1 | M | High |
| 8.3 | Create per-page OG images for `/demo` and `/billing` (higher social sharing potential) | P2 | M | Medium |

---

## 9. Heading Hierarchy

**Rating**: GOOD

### Current State (Landing Page)

```
H1: {t('landing.headline')} — "Every answer cites the exact page."
  └─ HeroSection.tsx:33

H2: {t('landing.showcase.title')} — "See it in action"
  └─ HomePageClient.tsx:49

H2: {t('landing.howItWorks.title')} — "How it works"
  └─ HowItWorks.tsx:20
  H3: Step 1 title — "Upload your document"
  H3: Step 2 title — "Ask questions"
  H3: Step 3 title — "Get verified answers"
    └─ HowItWorks.tsx:39

H2: {t('landing.features.title')} — "Built for serious readers"
  └─ FeatureGrid.tsx:21
  H3: Feature 1 — "Find anything in seconds"
  H3: Feature 2 — "Every answer has a source"
  H3: Feature 3 — "Your documents stay yours"
    └─ FeatureGrid.tsx:35

H2: {t('landing.social.title')} — "DocTalk by the numbers"
  └─ SocialProof.tsx:69

H2: {t('landing.security.title')} — "Your data, your control"
  └─ SecuritySection.tsx:22
  H3: Security card titles (4 cards)
    └─ SecuritySection.tsx:35

H2: {t('landing.faq.title')} — "Frequently Asked Questions"
  └─ FAQ.tsx:29

H2: {t('landing.finalCta.title')} — "Stop re-reading. Start asking."
  └─ FinalCTA.tsx:18
```

**Dashboard (logged in)**:
```
H2: "My Documents" — HomePageClient.tsx:402
H3: "No documents yet" — HomePageClient.tsx:406
```

### What's Good
- **Exactly one H1** per page — correct
- **Hierarchical structure**: H1 > H2 > H3 — no skipped levels
- **Keyword-rich headings**: "AI", "document", "answers", "source", "citations" naturally distributed
- **H1 is compelling and unique**: "Every answer cites the exact page." — good for both SEO and conversion
- Footer uses H3 for section headers (Product, Company, Legal) — acceptable in footer context

### What's Missing / Suboptimal
- **H1 doesn't contain the brand name "DocTalk"** — the brand is in the title tag and logo, but not the H1. This is a minor missed opportunity for brand-keyword association
- **No primary keyword "document chat" in H1** — the H1 is benefits-focused ("Every answer cites the exact page") which is great for conversion but less optimal for SEO keyword targeting
- **Dashboard H2 "My Documents"** is not keyword-rich — but this page is behind auth, so irrelevant for SEO

### Recommendations

| # | Recommendation | Priority | Effort | SEO Impact |
|---|---|---|---|---|
| 9.1 | Consider incorporating "document" or "AI" into the H1 for keyword targeting (e.g., "Every AI answer cites the exact page") | P2 | S | Low-Medium |

---

## 10. Image SEO

**Rating**: NEEDS IMPROVEMENT

### Current State

- **Landing page has ZERO `<img>` tags** — entirely text-based with CSS patterns and SVG icons (Lucide)
- **OG image**: Generated via `next/og` edge runtime (`opengraph-image.tsx:1-70`) — 1200x630 PNG, dark gradient background, "DocTalk" text + subtitle + file type badges
- **Favicon**: `frontend/src/app/icon.svg` — SVG format, good for resolution independence
- **Profile images**: Google/Microsoft avatars via `next/image` with `remotePatterns` in config — proper optimization
- **No product screenshots on landing page** — the ShowcasePlayer is a lazy-loaded Remotion video/animation, not an `<img>`

### What's Good
- No image optimization issues because there are no images to optimize (text-based landing page)
- `next/image` configured for external avatar sources
- OG image properly sized (1200x630) and dynamically generated
- SVG favicon is resolution-independent

### What's Missing / Suboptimal
- **OG image is generic text** — no product screenshot, no visual differentiation from competitors. When shared on social media, it's just white text on a dark background
- **No logo PNG** for Google rich results — Organization schema references `/logo-icon.svg`, but Google prefers raster formats (PNG/JPEG) for Knowledge Panel logos
- **No product screenshots for Google Images** — adding a "How it works" image gallery or screenshots could drive image search traffic
- **OG image has no product mockup** — competitors show actual UI screenshots in their OG images for higher social CTR

### Recommendations

| # | Recommendation | Priority | Effort | SEO Impact |
|---|---|---|---|---|
| 10.1 | Redesign OG image to include a product UI screenshot/mockup alongside brand text | P1 | M | High |
| 10.2 | Add PNG version of logo (512x512) and update Organization schema to reference it | P2 | S | Low |
| 10.3 | Consider adding product screenshots as static images on the landing page for Google Images traffic | P2 | M | Medium |

---

## 11. Security Signals

**Rating**: GOOD

### Current State (`frontend/next.config.mjs:4-50`):

**Headers served on all routes** (`/(.*)` pattern):
```
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
Content-Security-Policy: [comprehensive CSP]
```

**CSP directives**:
- `default-src 'self'`
- `script-src 'self' 'unsafe-inline' 'unsafe-eval'` + Vercel/Sentry CDNs
- `frame-src 'none'`
- `frame-ancestors 'none'`
- `object-src 'none'`
- `base-uri 'self'`

**Verified live**: HSTS header present, HTTPS enforced.

### What's Good
- **HSTS with preload** — maximum HTTPS enforcement with 2-year max-age
- **Comprehensive CSP** — tight restrictions with explicit allowlists
- **X-Frame-Options: DENY** — prevents clickjacking (redundant with `frame-ancestors 'none'` but good defense in depth)
- **X-Content-Type-Options: nosniff** — prevents MIME sniffing
- **Permissions-Policy** — explicitly disables camera/microphone/geolocation
- **Referrer-Policy: strict-origin-when-cross-origin** — protects user privacy while allowing referrer for analytics

### What's Missing / Suboptimal
- **`'unsafe-inline'` and `'unsafe-eval'` in script-src** — required by Next.js in development but could be replaced with nonce-based CSP in production. Not an SEO issue but affects security perception
- **No `Cross-Origin-Opener-Policy`** header — optional but recommended
- **No `X-DNS-Prefetch-Control`** — minor

### Recommendations

| # | Recommendation | Priority | Effort | SEO Impact |
|---|---|---|---|---|
| 11.1 | Security headers are excellent for SEO trust signals — no action needed | — | — | — |
| 11.2 | Consider adding COOP header for additional security posture | P2 | S | Low |

---

## 12. Mobile SEO

**Rating**: GOOD

### Current State

**Viewport** (verified live): `<meta name="viewport" content="width=device-width, initial-scale=1">`

**Responsive patterns**:
- Landing page uses Tailwind responsive prefixes extensively: `md:text-6xl lg:text-7xl`, `sm:px-8 lg:px-16`, `grid-cols-1 md:grid-cols-3`
- Header adapts: hides CreditsDisplay, ThemeSelector on mobile (`hidden sm:flex`, `hidden sm:block`)
- Touch targets: CTA buttons use `px-6 py-3` (48px+ height) — meets Google's 48x48px minimum

**Theme-color meta** (`layout.tsx:74-75`):
```html
<meta name="theme-color" content="#ffffff" media="(prefers-color-scheme: light)" />
<meta name="theme-color" content="#09090b" media="(prefers-color-scheme: dark)" />
```

### What's Good
- Proper viewport meta tag
- Responsive design with mobile-first Tailwind classes
- Touch targets meet minimum 48px requirements
- Theme-color adapts to system preference
- Header gracefully degrades on mobile (hides non-essential elements)
- `text-balance` on headlines prevents orphan words on mobile

### What's Missing / Suboptimal
- **Footer grid is `grid-cols-2 md:grid-cols-3`** — on mobile, the 3 sections collapse to 2 columns with the third wrapping. This is fine but could be `grid-cols-1 sm:grid-cols-2 md:grid-cols-3` for very small screens
- **No mobile-specific testing visible** — but the Tailwind responsive system handles most cases

### Recommendations

| # | Recommendation | Priority | Effort | SEO Impact |
|---|---|---|---|---|
| 12.1 | No critical mobile SEO issues found | — | — | — |
| 12.2 | Consider `grid-cols-1` breakpoint for footer on very small screens | P2 | S | Low |

---

## 13. Accessibility as SEO

**Rating**: NEEDS IMPROVEMENT

### Current State

**Semantic HTML**:
- `<header>`, `<main>`, `<footer>`, `<section>`, `<nav>` — proper semantic elements used
- `<section>` elements have no `aria-label` or `aria-labelledby` — they have `id` attributes on some (`#features`, `#how-it-works`)

**ARIA**:
- FAQ accordion: `aria-expanded`, `aria-controls`, `role="region"`, `aria-labelledby` — excellent
- Icons: `aria-hidden="true"` on all decorative icons — correct
- Delete button: `aria-label="Delete document"` — good
- Modals: `role="dialog"`, `aria-modal="true"`, `aria-labelledby` — correct
- `aria-live="polite"` on upload progress text — good

**Focus management**:
- `focus-visible:ring-2` on all interactive elements — consistent keyboard navigation
- `focus-visible:ring-offset-2` for dark mode — good contrast

**Color contrast**:
- Primary text: `text-zinc-900 dark:text-zinc-50` on `bg-white dark:bg-zinc-950` — passes WCAG AA
- Secondary text: `text-zinc-500 dark:text-zinc-400` — may fail WCAG AA on some backgrounds
- Accent text: `text-accent` (indigo) on white — passes AA

### What's Good
- Excellent ARIA implementation on FAQ accordion
- Consistent `focus-visible` indicators
- Decorative icons properly hidden from screen readers
- `role="list"` and `role="listitem"` on feature grid
- `prefers-reduced-motion` respected in animations
- Error messages use `role="alert"`

### What's Missing / Suboptimal
- **No skip navigation link** — keyboard users must tab through the entire header to reach content
- **Landing page sections lack `aria-label`** — screen readers can't easily navigate between sections
- **`text-zinc-500` secondary text** may fail WCAG AA contrast on `bg-white` (depends on exact rendering) — this is the text used for descriptions and subtitles throughout
- **Not-found page** (`not-found.tsx`) and **Document error page** (`d/[documentId]/error.tsx`) use hardcoded English strings instead of i18n — accessibility issue for non-English users
- **Footer contact link** uses `<a>` with `mailto:` but the visible text says just "Contact" — could be more descriptive

### Recommendations

| # | Recommendation | Priority | Effort | SEO Impact |
|---|---|---|---|---|
| 13.1 | Add skip navigation link ("Skip to main content") to layout | P1 | S | Medium |
| 13.2 | Add `aria-label` to landing page `<section>` elements | P2 | S | Low |
| 13.3 | Verify `text-zinc-500` meets WCAG AA (4.5:1) on all backgrounds | P2 | S | Low |
| 13.4 | Localize not-found.tsx and error.tsx strings | P2 | S | Low |

---

## 14. Redirect Handling

**Rating**: GOOD

### Current State

**Middleware** (`frontend/src/middleware.ts:18-33`):
- Only sets `NEXT_LOCALE` cookie — no redirects
- No locale-based URL redirects — all locales serve the same URL

**next.config.mjs**:
- No `redirects()` or `rewrites()` configured

**Page-level redirects**:
- `collections/[collectionId]/page.tsx:53`: `router.push('/collections')` on error — client-side only
- `collections/[collectionId]/page.tsx:137`: `router.push('/auth?callbackUrl=/collections')` if unauthenticated — client-side only

**Vercel**:
- Automatic `doctalk.site` -> `www.doctalk.site` redirect (configured in Vercel dashboard)

### What's Good
- No redirect chains
- No server-side redirect loops
- Middleware doesn't redirect — clean pass-through
- Domain canonicalization handled by Vercel (non-www -> www)

### What's Missing / Suboptimal
- **No `/billing` -> `/pricing` redirect** (if URL is ever renamed per recommendation 6.1)
- **No trailing slash redirect** — Next.js handles this by default, but no explicit configuration

### Recommendations

| # | Recommendation | Priority | Effort | SEO Impact |
|---|---|---|---|---|
| 14.1 | No redirect issues found — current setup is clean | — | — | — |

---

## 15. Error Pages

**Rating**: NEEDS IMPROVEMENT

### Current State

**Global 404** (`frontend/src/app/not-found.tsx:1-28`):
- `"use client"` component
- Shows "404" + "Page not found" + "Go Home" + "Try Demo" buttons
- **No metadata export** — no `title` or `robots` meta tag
- **Hardcoded English** — not localized

**Global error** (`frontend/src/app/error.tsx:1-29`):
- `"use client"` — required for error boundaries
- Uses `t("error.title")` — localized
- Shows error message + "Try Again" button

**Route-specific error boundaries**:
- `/d/[documentId]/error.tsx` — hardcoded English ("Something went wrong", "Try again", "Go home")
- `/collections/[collectionId]/error.tsx` — hardcoded English
- `/demo/error.tsx` — localized via `t()`
- `/billing/error.tsx` — localized via `t()`
- `/profile/error.tsx` — localized via `t()`

**Auth pages**:
- `/auth/page.tsx` — `"use client"`, **no server wrapper**, **no metadata export**, **no noindex**
- `/auth/error/page.tsx` — `"use client"`, **no server wrapper**, **no noindex**
- `/auth/verify-request/page.tsx` — `"use client"`, **no noindex**

### What's Good
- Error boundaries exist at multiple route levels — users always see a recoverable error UI
- Global error.tsx and demo/billing/profile error pages are localized
- Not-found page provides clear navigation back to public pages
- Auth pages are blocked by `robots.txt: Disallow: /auth/` — but missing noindex

### What's Missing / Suboptimal
- **Auth pages have NO `noindex` meta tag** — while robots.txt blocks them, belt-and-suspenders approach (like `/profile`, `/admin`, `/d/[id]`) should be applied. If auth pages are linked from elsewhere, Google may ignore robots.txt and index them
- **404 page has no metadata** — it should have `<title>Page Not Found | DocTalk</title>` and `noindex`
- **404 page is not localized** — hardcoded "Page not found", "Go Home", "Try Demo"
- **`/d/[documentId]/error.tsx` and `/collections/[collectionId]/error.tsx`** use hardcoded English
- **404 returns 200 status?** — Need to verify Vercel returns 404 HTTP status. Next.js App Router's `not-found.tsx` should return 404 by default

### Recommendations

| # | Recommendation | Priority | Effort | SEO Impact |
|---|---|---|---|---|
| 15.1 | Add server wrapper with `metadata: { robots: { index: false } }` to all 3 auth pages (`/auth`, `/auth/error`, `/auth/verify-request`) | **P0** | S | **High** |
| 15.2 | Add `title` and `robots: noindex` to not-found.tsx (requires converting to server component or adding metadata export) | P1 | S | Medium |
| 15.3 | Localize not-found.tsx and hardcoded error pages | P2 | S | Low |

---

## Priority Summary

### P0 — Critical (Do Immediately)

| # | Issue | File | Impact |
|---|---|---|---|
| 2.1/4.1 | Add `display: 'swap'` to Inter font | `layout.tsx:14` | Fixes FOIT, improves LCP |
| 7.1 | Remove hreflang tags (all point to same URL — confuses Google) | `layout.tsx:29-44` | Fixes incorrect signal to Google |
| 8.1 | Add per-page OG title/description to `/demo`, `/billing`, `/privacy`, `/terms` | Each page's `page.tsx` | Fixes incorrect social sharing |
| 15.1 | Add noindex to all auth pages via server wrappers | `auth/page.tsx`, `auth/error/page.tsx`, `auth/verify-request/page.tsx` | Prevents indexing of auth pages |

### P1 — Important (This Sprint)

| # | Issue | Impact |
|---|---|---|
| 2.2 | Remove ScrollReveal from first viewport | Better initial paint |
| 3.1 | Add HowTo structured data | Rich result eligibility |
| 5.1 | Add Pricing/Demo links to header minimal variant | Better internal linking |
| 5.2 | Add pricing CTA in landing page body | Better internal linking |
| 5.3 | Fix email inconsistency (doctalk.app vs doctalk.site) | Trust signal |
| 10.1 | Redesign OG image with product screenshot | Higher social CTR |
| 13.1 | Add skip navigation link | Accessibility + engagement |
| 15.2 | Add title/noindex to 404 page | Prevent indexing |

### P2 — Nice to Have (Next Sprint)

| # | Issue | Impact |
|---|---|---|
| 1.1 | Add noscript fallback | Minor crawlability |
| 1.2 | Dynamic sitemap for future content | Scalability |
| 3.2 | Add aggregateRating when reviews exist | Star ratings |
| 3.3 | Remove single-item breadcrumb from homepage | Cleanup |
| 3.4 | Add SearchAction to WebSite schema | Sitelinks search |
| 3.5 | Convert logo to PNG for rich results | Rich result eligibility |
| 4.2 | Evaluate Sentry bundle necessity | Bundle size |
| 4.3 | Enable experimental CSS optimization | Minor FCP |
| 5.4 | Vary anchor text for /demo links | Minor SEO |
| 6.1 | Rename /billing to /pricing | URL-keyword alignment |
| 6.2 | Plan /blog URL structure | Future readiness |
| 7.2 | Add explicit trailingSlash: false | Clarity |
| 7.3 | Remove canonical from layout | Prevent accidents |
| 8.2-8.3 | Per-page OG images | Social CTR |
| 9.1 | Incorporate keyword in H1 | Minor keyword targeting |
| 10.2 | PNG logo for Organization schema | Rich results |
| 10.3 | Product screenshots on landing | Image search traffic |
| 11.2 | Add COOP header | Security posture |
| 12.2 | Footer mobile grid breakpoint | Minor mobile UX |
| 13.2-13.4 | Accessibility improvements | Engagement metrics |
| 15.3 | Localize error pages | UX for non-English |

---

## Dimension Ratings Summary

| # | Dimension | Rating | Key Issue |
|---|---|---|---|
| 1 | Crawlability & Indexability | GOOD | Client-rendered body content |
| 2 | Core Web Vitals | NEEDS IMPROVEMENT | Inter font missing display:swap |
| 3 | Structured Data | GOOD | Missing HowTo, no aggregateRating |
| 4 | Page Speed Architecture | NEEDS IMPROVEMENT | Inter font, Sentry bundle |
| 5 | Internal Linking | NEEDS IMPROVEMENT | No header nav on landing, /billing not prominent |
| 6 | URL Structure | GOOD | /billing vs /pricing minor |
| 7 | Canonical Tags | NEEDS IMPROVEMENT | Hreflang all point to same URL |
| 8 | Meta Tags | NEEDS IMPROVEMENT | Per-page OG tags missing |
| 9 | Heading Hierarchy | GOOD | Clean H1-H3 structure |
| 10 | Image SEO | NEEDS IMPROVEMENT | Generic OG image, no product screenshots |
| 11 | Security Signals | GOOD | Excellent headers |
| 12 | Mobile SEO | GOOD | Responsive, proper viewport |
| 13 | Accessibility | NEEDS IMPROVEMENT | No skip nav, contrast concerns |
| 14 | Redirect Handling | GOOD | Clean, no chains |
| 15 | Error Pages | NEEDS IMPROVEMENT | Auth pages missing noindex |
