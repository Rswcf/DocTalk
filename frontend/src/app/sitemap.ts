import type { MetadataRoute } from "next";

const BASE_URL = "https://www.doctalk.site";

export default function sitemap(): MetadataRoute.Sitemap {
  const lastDeploy = "2026-02-18";

  return [
    // Static pages
    { url: BASE_URL, lastModified: lastDeploy, changeFrequency: "monthly", priority: 1.0 },
    { url: `${BASE_URL}/demo`, lastModified: lastDeploy, changeFrequency: "monthly", priority: 0.8 },
    { url: `${BASE_URL}/billing`, lastModified: lastDeploy, changeFrequency: "monthly", priority: 0.7 },
    { url: `${BASE_URL}/blog`, lastModified: lastDeploy, changeFrequency: "weekly", priority: 0.8 },
    { url: `${BASE_URL}/privacy`, lastModified: lastDeploy, changeFrequency: "yearly", priority: 0.3 },
    { url: `${BASE_URL}/terms`, lastModified: lastDeploy, changeFrequency: "yearly", priority: 0.3 },
    // Feature pages
    { url: `${BASE_URL}/features`, lastModified: lastDeploy, changeFrequency: "monthly", priority: 0.7 },
    { url: `${BASE_URL}/features/citations`, lastModified: lastDeploy, changeFrequency: "monthly", priority: 0.8 },
    { url: `${BASE_URL}/features/multi-format`, lastModified: lastDeploy, changeFrequency: "monthly", priority: 0.8 },
    { url: `${BASE_URL}/features/multilingual`, lastModified: lastDeploy, changeFrequency: "monthly", priority: 0.7 },
    { url: `${BASE_URL}/features/free-demo`, lastModified: lastDeploy, changeFrequency: "monthly", priority: 0.7 },
    { url: `${BASE_URL}/features/performance-modes`, lastModified: lastDeploy, changeFrequency: "monthly", priority: 0.6 },
    // Comparison pages
    { url: `${BASE_URL}/compare`, lastModified: lastDeploy, changeFrequency: "monthly", priority: 0.6 },
    { url: `${BASE_URL}/compare/chatpdf`, lastModified: lastDeploy, changeFrequency: "monthly", priority: 0.7 },
    { url: `${BASE_URL}/compare/askyourpdf`, lastModified: lastDeploy, changeFrequency: "monthly", priority: 0.7 },
    { url: `${BASE_URL}/compare/notebooklm`, lastModified: lastDeploy, changeFrequency: "monthly", priority: 0.7 },
    { url: `${BASE_URL}/compare/humata`, lastModified: lastDeploy, changeFrequency: "monthly", priority: 0.7 },
    { url: `${BASE_URL}/compare/pdf-ai`, lastModified: lastDeploy, changeFrequency: "monthly", priority: 0.7 },
    // Alternative pages
    { url: `${BASE_URL}/alternatives`, lastModified: lastDeploy, changeFrequency: "monthly", priority: 0.6 },
    { url: `${BASE_URL}/alternatives/chatpdf`, lastModified: lastDeploy, changeFrequency: "monthly", priority: 0.7 },
    { url: `${BASE_URL}/alternatives/notebooklm`, lastModified: lastDeploy, changeFrequency: "monthly", priority: 0.7 },
    { url: `${BASE_URL}/alternatives/humata`, lastModified: lastDeploy, changeFrequency: "monthly", priority: 0.7 },
    // Use case pages
    { url: `${BASE_URL}/use-cases`, lastModified: lastDeploy, changeFrequency: "monthly", priority: 0.7 },
    { url: `${BASE_URL}/use-cases/students`, lastModified: lastDeploy, changeFrequency: "monthly", priority: 0.7 },
    { url: `${BASE_URL}/use-cases/lawyers`, lastModified: lastDeploy, changeFrequency: "monthly", priority: 0.7 },
    { url: `${BASE_URL}/use-cases/finance`, lastModified: lastDeploy, changeFrequency: "monthly", priority: 0.7 },
    { url: `${BASE_URL}/use-cases/hr-contracts`, lastModified: lastDeploy, changeFrequency: "monthly", priority: 0.6 },
  ];
}
