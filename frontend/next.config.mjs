import fs from "node:fs";
import path from "node:path";
import { withSentryConfig } from "@sentry/nextjs";

const repoRoot = path.resolve(process.cwd(), "..");
const versionFile = path.join(repoRoot, "version.json");
const releaseConfig = JSON.parse(fs.readFileSync(versionFile, "utf8"));
const buildSha =
  process.env.VERCEL_GIT_COMMIT_SHA ||
  process.env.RAILWAY_GIT_COMMIT_SHA ||
  process.env.GITHUB_SHA ||
  "";

// Content-Security-Policy directives (enforcing).
//
// NOTE: script-src still allows 'unsafe-inline' pending a full nonce-based
// rewrite (Next.js middleware + next/script nonce propagation). Tracked as a
// P3 follow-up — removing 'unsafe-inline' requires staging CSP-report-only
// observation for every third-party script path (GTM, Sentry CDN, Vercel
// analytics) before flipping. Same rationale for style-src 'unsafe-inline'
// (Tailwind + inline style attributes are pervasive in component code).
const cspDirectives = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' ${process.env.NODE_ENV === "development" ? "'unsafe-eval'" : ""} https://va.vercel-scripts.com https://*.sentry-cdn.com https://www.googletagmanager.com`.replace(/  +/g, " ").trim(),
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' blob: data: https://*.up.railway.app https://*.googleusercontent.com https://www.google-analytics.com",
  "font-src 'self' data:",
  "worker-src 'self' blob:",
  "media-src 'none'",
  "connect-src 'self' https://*.up.railway.app https://*.sentry.io https://*.ingest.sentry.io https://va.vercel-scripts.com https://vitals.vercel-insights.com https://www.google-analytics.com https://analytics.google.com https://*.google-analytics.com https://*.analytics.google.com",
  "frame-src 'none'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self' https://accounts.google.com https://login.microsoftonline.com",
  "upgrade-insecure-requests",
].join("; ");

// Content-Security-Policy-Report-Only directives (production only).
//
// Strict version without 'unsafe-inline' in script-src. Browser reports what
// WOULD be blocked to /api/csp-report, no actual enforcement. Purpose: collect
// 1-2 weeks of real-world violations to decide the nonce-migration strategy
// (Plan: .collab/plans/p3-csp-nonce-plan.md).
//
// Style-src keeps 'unsafe-inline' because Tailwind generates thousands of
// inline styles — reporting those would drown real violations.
//
// Reporting endpoint: the Reporting-Endpoints header spec (and some
// browsers, including Chrome) requires an absolute URL. Using a relative
// path silently no-ops on those browsers. Derive an absolute URL from the
// deployment origin so preview and production each report to themselves.
//
// Priority:
//   1. NEXT_PUBLIC_SITE_URL (explicit override, e.g. custom domain)
//   2. VERCEL_PROJECT_PRODUCTION_URL (Vercel's canonical production domain,
//      e.g. "www.doctalk.site" — only set when VERCEL_ENV === "production")
//   3. VERCEL_URL (per-deployment preview URL, for preview deploys)
//   4. Hardcoded fallback (local dev / non-Vercel)
//
// VERCEL_URL alone is wrong for production because it resolves to the
// per-build deployment hostname (e.g. "doctalk-abc.vercel.app"), which
// causes visitors on the custom domain to send reports cross-origin to a
// URL that rotates every deploy.
const VERCEL_PROD_ORIGIN =
  process.env.VERCEL_ENV === "production" &&
  process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "";
const VERCEL_DEPLOY_ORIGIN = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : "";
const SITE_ORIGIN =
  process.env.NEXT_PUBLIC_SITE_URL ||
  VERCEL_PROD_ORIGIN ||
  VERCEL_DEPLOY_ORIGIN ||
  "https://www.doctalk.site";
const REPORT_ENDPOINT = `${SITE_ORIGIN}/api/csp-report`;

// report-uri (legacy) + report-to (modern Reporting API) are BOTH included
// on purpose. Chromium 94+ and Firefox prefer report-to when present;
// older browsers only understand report-uri. The Sentry fingerprint in
// route.ts (directive + bucketized blocked-uri) collapses any duplicate
// reports the rare browser that sends both would generate.
const cspReportOnlyDirectives = [
  "default-src 'self'",
  "script-src 'self' https://va.vercel-scripts.com https://*.sentry-cdn.com https://www.googletagmanager.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' blob: data: https://*.up.railway.app https://*.googleusercontent.com https://www.google-analytics.com",
  "font-src 'self' data:",
  "worker-src 'self' blob:",
  "media-src 'none'",
  "connect-src 'self' https://*.up.railway.app https://*.sentry.io https://*.ingest.sentry.io https://va.vercel-scripts.com https://vitals.vercel-insights.com https://www.google-analytics.com https://analytics.google.com https://*.google-analytics.com https://*.analytics.google.com",
  "frame-src 'none'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self' https://accounts.google.com https://login.microsoftonline.com",
  `report-uri ${REPORT_ENDPOINT}`,
  "report-to csp-endpoint",
].join("; ");

const isProduction = process.env.NODE_ENV === "production";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "lh3.googleusercontent.com", pathname: "/**" },
      { protocol: "https", hostname: "graph.microsoft.com", pathname: "/**" },
    ],
  },
  env: {
    NEXT_PUBLIC_APP_VERSION: releaseConfig.version,
    NEXT_PUBLIC_RELEASE_STAGE: releaseConfig.stage,
    NEXT_PUBLIC_BUILD_SHA: buildSha,
  },
  webpack: (config) => {
    // pdf.js requires 'canvas' on server side — stub it out for Next.js
    config.resolve.alias.canvas = false;
    return config;
  },
  async headers() {
    const noindexHeader = { key: "X-Robots-Tag", value: "noindex, nofollow" };
    return [
      { source: "/auth/:path*", headers: [noindexHeader] },
      { source: "/billing/:path*", headers: [noindexHeader] },
      { source: "/profile/:path*", headers: [noindexHeader] },
      { source: "/collections/:path*", headers: [noindexHeader] },
      { source: "/admin/:path*", headers: [noindexHeader] },
      { source: "/d/:path*", headers: [noindexHeader] },
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          { key: "Content-Security-Policy", value: cspDirectives },
          ...(isProduction
            ? [
                {
                  key: "Content-Security-Policy-Report-Only",
                  value: cspReportOnlyDirectives,
                },
                {
                  key: "Reporting-Endpoints",
                  value: `csp-endpoint="${REPORT_ENDPOINT}"`,
                },
              ]
            : []),
        ],
      },
    ];
  },
}

export default withSentryConfig(nextConfig, {
  // Suppress source map upload logs in CI
  silent: true,
  // Disable source map upload (no auth token configured)
  disableServerWebpackPlugin: true,
  disableClientWebpackPlugin: true,
});
