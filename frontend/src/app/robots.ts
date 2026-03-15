import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/auth", "/billing", "/profile", "/collections", "/admin", "/d/"],
      },
    ],
    sitemap: "https://www.doctalk.site/sitemap.xml",
  };
}
