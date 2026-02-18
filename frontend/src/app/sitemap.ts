import type { MetadataRoute } from "next";

const BASE_URL = "https://www.doctalk.site";

export default function sitemap(): MetadataRoute.Sitemap {
  const lastDeploy = "2026-02-18";

  return [
    {
      url: BASE_URL,
      lastModified: lastDeploy,
      changeFrequency: "monthly",
      priority: 1.0,
    },
    {
      url: `${BASE_URL}/demo`,
      lastModified: lastDeploy,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/billing`,
      lastModified: lastDeploy,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${BASE_URL}/privacy`,
      lastModified: lastDeploy,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${BASE_URL}/terms`,
      lastModified: lastDeploy,
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ];
}
