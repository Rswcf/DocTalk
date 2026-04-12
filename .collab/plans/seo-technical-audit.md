# DocTalk Technical SEO Audit Report

**Date:** 2026-02-18
**Auditor:** Claude (SEO Specialist Agent)
**Site:** https://www.doctalk.site
**Stack:** Next.js 14 (App Router), Vercel, 11 locales (client-side i18n)

---

## Executive Summary

DocTalk has a solid SEO foundation with proper meta tags, Open Graph/Twitter Cards, structured data (JSON-LD), a dynamic sitemap, and programmatic robots.txt. However, there are several **critical and high-severity issues** that significantly limit organic search potential, primarily around **client-side rendering (CSR) of the homepage**, **missing i18n URL structure/hreflang**, and **thin indexable page count**. Addressing these could unlock meaningful organic traffic growth.

---

## Findings by Severity

### CRITICAL Issues

#### C1. Homepage is entirely client-rendered (`"use client"`)
**File:** `frontend/src/app/page.tsx:1`
**Impact:** Google can render JavaScript, but CSR pages are deprioritized vs. SSR. More critically, the homepage content (landing page) is loaded via client components using `useLocale()` for all text. The `<h1>`, feature descriptions, FAQ answers, and all marketing copy are rendered client-side via i18n keys. Googlebot's initial crawl sees only the HTML shell with no meaningful text content.

**Evidence:** Live fetch of `https://www.doctalk.site` confirms "Minimal static text visible in the provided payload; primary content loads dynamically via React components."

**Risk:** Google may index the page with thin/empty content, or the page may be classified as a "Soft 404" despite returning 200. The FAQ structured data (JSON-LD) references hardcoded English text, but the actual page renders dynamically -- this mismatch could cause rich snippet rejection.

**Fix:**
- Split the homepage into a **server component wrapper** that renders static English content (h1, descriptions, FAQ text) as default/fallback, with client hydration for locale switching
- Or implement Next.js `generateStaticParams` with locale-based routes (`/en`, `/zh`, etc.)
- At minimum, ensure the landing page renders meaningful HTML on the server

---

#### C2. No hreflang tags despite supporting 11 locales
**File:** `frontend/src/app/layout.tsx` (no `alternates.languages` in metadata)
**Impact:** The site supports EN, ZH, ES, JA, DE, FR, KO, PT, IT, AR, HI but uses **client-side locale detection** (localStorage + `navigator.language`) with no URL differentiation. There are:
- No `/en/`, `/zh/`, etc. URL prefixes
- No `hreflang` link tags in HTML
- No locale variants in the sitemap
- `<html lang="en">` is hardcoded (updated client-side after hydration at `LocaleProvider.tsx:50`)

**Risk:** Search engines cannot discover or index non-English versions. International users searching in their language will never find DocTalk. The `<html lang="en">` tag tells Google all content is English, even when displayed in Chinese or Arabic.

**Fix (phased):**
- **Phase 1 (Quick win):** Add `alternates.languages` to the root layout metadata to declare all supported locales, even with the same URL (signals multilingual support)
- **Phase 2 (Recommended):** Implement locale-prefixed URLs (`/zh/`, `/es/`, etc.) using Next.js i18n routing or `[locale]` dynamic segment, with server-side locale detection and proper hreflang
- **Phase 3:** Add locale variants to sitemap.xml

---

#### C3. Sitemap only lists 5 URLs with no locale variants
**File:** `frontend/src/app/sitemap.ts`
**Impact:** The sitemap contains only 5 URLs: `/`, `/demo`, `/billing`, `/privacy`, `/terms`. With 11 locales, this should ideally be 55 URLs (5 pages x 11 locales). The extremely small sitemap signals to search engines that this is a very small site.

**Additional issue:** `lastModified` is set to `new Date()` (current timestamp) on every request. This means every crawl sees a new modification date, which dilutes the signal and may cause crawl budget waste.

**Fix:**
- Use actual last-modified dates (from git or hardcoded deploy dates)
- Add locale variants when URL-based i18n is implemented
- Consider adding a `/blog` or content pages to expand indexable surface

---

### HIGH Issues

#### H1. Homepage FAQ structured data uses hardcoded English text while page renders i18n
**File:** `frontend/src/app/page.tsx:99-158`
**Impact:** The FAQPage JSON-LD schema is hardcoded in English, but the FAQ component renders locale-specific text via `t()` keys. If a user views in Chinese, Google sees English structured data but Chinese page content -- a mismatch that can cause rich snippet penalties or rejection.

**Fix:**
- Move FAQ JSON-LD to server-side generation with locale-aware text
- Or ensure structured data always matches the rendered content language

---

#### H2. `<html lang>` attribute is hardcoded to `"en"`
**File:** `frontend/src/app/layout.tsx:49`
**Impact:** The HTML `lang` attribute is set to `"en"` at build time and only updated client-side in `LocaleProvider.tsx:50` via `document.documentElement.lang = locale`. Googlebot may not execute this JavaScript, so it always sees `lang="en"` regardless of content language.

**Fix:** Implement server-side locale detection (accept-language header or URL prefix) to set the correct `lang` attribute at render time.

---

#### H3. No middleware.ts for locale routing or SEO redirects
**File:** No `src/middleware.ts` exists
**Impact:** Without middleware, there is no:
- Server-side locale detection/redirect
- Trailing slash normalization (potential duplicate content)
- www/non-www redirect enforcement (handled by Vercel, but not explicitly configured)
- Geographic or language-based routing

**Fix:** Create `middleware.ts` with:
- Accept-Language based locale detection and redirect to locale-prefixed URLs
- Trailing slash normalization
- Any necessary SEO redirects (e.g., old URLs to new)

---

#### H4. Missing `robots` meta tag on auth-gated pages
**Files:** `frontend/src/app/profile/page.tsx`, `frontend/src/app/collections/page.tsx`, `frontend/src/app/admin/page.tsx`, `frontend/src/app/d/[documentId]/page.tsx`
**Impact:** These pages are disallowed in robots.txt (good), but they lack `<meta name="robots" content="noindex, nofollow">` as a defense-in-depth measure. If a link to `/profile` or `/d/xxx` is found elsewhere, Google may attempt to index it.

**Fix:** Add `metadata` exports with `robots: { index: false, follow: false }` to all auth-gated page files. Currently none of these pages export metadata at all.

---

#### H5. `next/image` component almost never used
**Files:** Only `frontend/src/components/UserMenu.tsx` uses `next/image`
**Impact:** The entire site uses SVGs and Lucide icons (fine), but if any raster images are added in the future, they should use `next/image` for automatic optimization, lazy loading, and WebP/AVIF conversion. The OG image is generated via `ImageResponse` (good). No critical images are missing optimization currently, but this is a gap in the development pattern.

**Fix:** Establish a convention to always use `next/image` for any future raster images.

---

### MEDIUM Issues

#### M1. No `vercel.json` for custom headers or redirects
**Impact:** All security headers are configured in `next.config.mjs` (good), but there is no `vercel.json` for Vercel-specific optimizations like:
- Edge-level redirects (faster than Next.js redirects)
- Custom caching headers for static assets
- Trailing slash handling

**Current state:** Headers are well-configured in `next.config.mjs:33-50` with HSTS, CSP, X-Frame-Options, etc. This is adequate.

---

#### M2. No `apple-touch-icon` or comprehensive favicon set
**Files:** `frontend/src/app/icon.svg`, `frontend/src/app/apple-icon.svg`
**Impact:** The site has SVG icons but may be missing:
- PNG fallback favicons for older browsers
- `apple-touch-icon` proper sizing (180x180)
- `favicon.ico` fallback
- `manifest.json` / `site.webmanifest` for PWA metadata

**Fix:** Generate a complete favicon set. Next.js 14 handles `icon.svg` and `apple-icon.svg` well, but a `manifest.json` would improve mobile bookmark experience and provide additional SEO signals.

---

#### M3. Open Graph image lacks branding visuals
**File:** `frontend/src/app/opengraph-image.tsx`
**Impact:** The OG image is programmatically generated with text-only content ("DocTalk" + "AI Document Chat with Cited Answers"). While functional, a more visually rich OG image with product screenshots or distinctive branding would improve click-through rates from social shares and search results.

---

#### M4. No breadcrumb structured data on homepage
**File:** `frontend/src/app/page.tsx`
**Impact:** The demo, billing, privacy, and terms pages all have BreadcrumbList JSON-LD (good), but the homepage does not. Adding WebPage type with breadcrumb would complete the structured data coverage.

---

#### M5. `contactPoint.email` in Organization schema uses non-matching domain
**File:** `frontend/src/app/layout.tsx:84`
**Impact:** The Organization schema lists `support@doctalk.app` but the site is `doctalk.site`. This domain mismatch may confuse search engines about organizational identity.

**Fix:** Use a consistent email domain, or add both domains to `sameAs`.

---

#### M6. Demo sample subpages (`/demo/[sample]`) are CSR-only redirect pages with no metadata
**File:** `frontend/src/app/demo/[sample]/page.tsx`
**Impact:** These pages are `"use client"` with no metadata export. They immediately redirect to `/d/{documentId}`. While they should not be indexed (robots.txt blocks `/d/`), the demo sample URLs themselves are not blocked and could be crawled as empty pages.

**Fix:** Either block `/demo/` subpages in robots.txt or add `noindex` metadata.

---

### LOW Issues

#### L1. Sitemap `changeFrequency` values may be inaccurate
**File:** `frontend/src/app/sitemap.ts`
**Impact:** Homepage and demo are marked `weekly`, but the content rarely changes between deploys. Legal pages are `monthly` which is reasonable. Minor impact -- Google largely ignores `changeFrequency`.

---

#### L2. No `manifest.json` / `site.webmanifest`
**Impact:** Missing PWA manifest means the site won't appear in "Add to Home Screen" prompts on mobile. Minor SEO signal for mobile-friendliness.

---

#### L3. 404 page (`not-found.tsx`) is client-rendered with no SEO guidance
**File:** `frontend/src/app/not-found.tsx`
**Impact:** The 404 page correctly returns a 404 status (Next.js handles this), but could link to the sitemap or popular pages to help users and crawlers find content.

---

#### L4. Missing `title` template pattern
**File:** `frontend/src/app/layout.tsx:23`
**Impact:** The root layout sets `title: 'DocTalk -- AI Document Chat with Cited Answers'`. Sub-pages override this entirely. Using Next.js `title: { default: '...', template: '%s | DocTalk' }` would ensure consistent branding across all pages.

**Current sub-page titles:**
- Demo: "Try DocTalk Free -- Interactive Demo" (no "DocTalk" suffix)
- Billing: "Pricing -- DocTalk" (has suffix, good)
- Privacy: "Privacy Policy -- DocTalk" (has suffix, good)
- Terms: "Terms of Service -- DocTalk" (has suffix, good)

---

#### L5. `host` field in robots.ts is non-standard
**File:** `frontend/src/app/robots.ts:13`
**Impact:** The `host` directive is a Yandex-specific extension and is ignored by Google/Bing. Not harmful, but unnecessary.

---

## What's Working Well

1. **Metadata on key pages:** Homepage, demo, billing, privacy, and terms all have proper `title`, `description`, and `canonical` tags
2. **Open Graph + Twitter Cards:** Properly configured with dynamically generated images
3. **JSON-LD structured data:** WebSite, Organization, FAQPage, SoftwareApplication (with pricing), and BreadcrumbList schemas are all present
4. **Robots.txt:** Correctly blocks auth, API, profile, collections, admin, and document pages
5. **Canonical URLs:** Set via `alternates.canonical` on all public pages
6. **Search console verification:** Google and Bing verification meta tags present
7. **Security headers:** HSTS, CSP, X-Frame-Options, etc. properly configured
8. **Dynamic sitemap:** Generated via Next.js route handler (not static file)
9. **OG image generation:** Edge-rendered, proper dimensions (1200x630)
10. **SSR for sub-pages:** Demo, billing, privacy, and terms use server component wrappers with metadata exports + client components for content (partial SSR pattern)

---

## Priority Action Plan

### Immediate (Week 1-2)
1. **[C1]** Convert homepage to hybrid SSR -- server-render default English content, hydrate with i18n
2. **[H2]** Fix `<html lang>` to reflect actual content language server-side
3. **[H4]** Add `noindex` metadata to all auth-gated pages
4. **[L4]** Implement title template pattern

### Short-term (Week 3-4)
5. **[C2/C3]** Implement locale-prefixed URL routing (`/[locale]/`) with hreflang tags
6. **[H1]** Make FAQ structured data language-aware
7. **[H3]** Create middleware.ts for locale detection and redirects
8. **[M5]** Fix contactPoint email domain mismatch
9. **[M6]** Block or noindex demo sample subpages

### Medium-term (Month 2)
10. **[C3]** Expand sitemap with locale variants and content pages
11. **[M2]** Add comprehensive favicon set and web manifest
12. **[M3]** Design visually richer OG images
13. **[M4]** Add breadcrumb to homepage

---

## Technical Debt Notes

- The i18n system is entirely client-side (localStorage + navigator.language). Migrating to URL-based i18n requires significant refactoring of the `LocaleProvider`, all `useLocale()` calls, and the routing structure. This is the single largest SEO improvement opportunity but also the highest effort.
- All pages marked `"use client"` at the top level cannot export metadata from the same file. The pattern used for demo/billing/privacy/terms (server wrapper + client component) is the correct approach and should be extended to all pages.
- The `page.tsx` homepage is the only public-facing page that does NOT use this server/client split pattern -- it is entirely `"use client"` with no server wrapper. This is the most impactful single fix.
