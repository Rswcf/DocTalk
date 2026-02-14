import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/auth/", "/profile", "/collections", "/admin", "/d/"],
      },
    ],
    sitemap: "https://www.doctalk.site/sitemap.xml",
    host: "https://www.doctalk.site",
  };
}
