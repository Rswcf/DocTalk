import { withSentryConfig } from "@sentry/nextjs";

// Content-Security-Policy directives
const cspDirectives = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://va.vercel-scripts.com https://*.sentry-cdn.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' blob: data: https://*.up.railway.app",
  "font-src 'self' data:",
  "worker-src 'self' blob:",
  "connect-src 'self' https://*.up.railway.app https://*.sentry.io https://*.ingest.sentry.io https://va.vercel-scripts.com https://vitals.vercel-insights.com",
  "frame-src 'none'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self' https://accounts.google.com",
].join("; ");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config) => {
    // pdf.js requires 'canvas' on server side — stub it out for Next.js
    config.resolve.alias.canvas = false;
    return config;
  },
  async headers() {
    return [
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
