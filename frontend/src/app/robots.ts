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
