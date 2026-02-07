import { withSentryConfig } from "@sentry/nextjs";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config) => {
    // pdf.js requires 'canvas' on server side — stub it out for Next.js
    config.resolve.alias.canvas = false;
    return config;
  },
}

export default withSentryConfig(nextConfig, {
  // Suppress source map upload logs in CI
  silent: true,
  // Disable source map upload (no auth token configured)
  disableServerWebpackPlugin: true,
  disableClientWebpackPlugin: true,
});
