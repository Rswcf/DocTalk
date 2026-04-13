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
  "report-uri /api/csp-report",
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
                  value: 'csp-endpoint="/api/csp-report"',
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
