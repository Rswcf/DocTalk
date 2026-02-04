/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config) => {
    // pdf.js requires 'canvas' on server side — stub it out for Next.js
    config.resolve.alias.canvas = false;
    return config;
  },
}

export default nextConfig

